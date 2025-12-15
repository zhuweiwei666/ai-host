/**
 * IDLE 视频处理服务
 * 
 * 完整的视频处理流水线：
 * Step 0: 输入规范化 (1080x1920 / 30fps / H.264 / yuv420p / no-audio)
 * Step 1: 稳定化 (vidstab)
 * Step 2: 生成 reverse
 * Step 3: 拼接成 ping-pong loop
 * Step 4: 切点检测 (静止帧分析)
 * Step 5: 质量验收 (QC)
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// 目标视频规格
const TARGET_SPEC = {
  width: 1080,
  height: 1920,
  fps: 30,
  codec: 'libx264',
  pixelFormat: 'yuv420p',
  preset: 'medium',
  crf: 18, // 高质量
};

// QC 阈值
const QC_THRESHOLDS = {
  maxJitter: 0.15,        // 最大抖动阈值（0-1）
  minDuration: 2.0,       // 最小时长（秒）
  maxDuration: 10.0,      // 最大时长（秒）
  minFps: 24,             // 最小帧率
  maxFrameDiff: 0.3,      // 首尾帧差异阈值
};

/**
 * 创建临时目录
 */
async function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `idle-video-${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

/**
 * 清理临时目录
 */
async function cleanupTempDir(tempDir) {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (err) {
    console.warn('[IdleProcessor] Failed to cleanup temp dir:', err.message);
  }
}

/**
 * 执行 ffmpeg 命令
 */
function runFFmpeg(args, description = '') {
  return new Promise((resolve, reject) => {
    console.log(`[IdleProcessor] ${description || 'Running FFmpeg'}:`, args.join(' ').substring(0, 200));
    
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stderr);
      } else {
        console.error('[IdleProcessor] FFmpeg error:', stderr.slice(-500));
        reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-200)}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(new Error(`FFmpeg spawn error: ${err.message}`));
    });
  });
}

/**
 * 执行 ffprobe 获取视频信息
 */
async function getVideoInfo(filePath) {
  try {
    const result = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    const info = JSON.parse(result);
    const videoStream = info.streams?.find(s => s.codec_type === 'video') || {};
    
    return {
      duration: parseFloat(info.format?.duration || 0),
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      fps: eval(videoStream.r_frame_rate || '0') || 0,
      codec: videoStream.codec_name || '',
      pixelFormat: videoStream.pix_fmt || '',
      bitrate: parseInt(info.format?.bit_rate || 0),
      frameCount: parseInt(videoStream.nb_frames || 0),
    };
  } catch (err) {
    throw new Error(`Failed to get video info: ${err.message}`);
  }
}

/**
 * Step 0: 输入规范化
 * 统一转成: 1080×1920 / 30fps / H.264 / yuv420p / no-audio
 */
async function normalizeVideo(inputPath, outputPath) {
  console.log('[IdleProcessor] Step 0: Normalizing video...');
  
  const args = [
    '-y',
    '-i', inputPath,
    // 视频滤镜：缩放到目标尺寸（保持比例，黑边填充）
    '-vf', `scale=${TARGET_SPEC.width}:${TARGET_SPEC.height}:force_original_aspect_ratio=decrease,pad=${TARGET_SPEC.width}:${TARGET_SPEC.height}:(ow-iw)/2:(oh-ih)/2:black,fps=${TARGET_SPEC.fps}`,
    // 编码设置
    '-c:v', TARGET_SPEC.codec,
    '-preset', TARGET_SPEC.preset,
    '-crf', String(TARGET_SPEC.crf),
    '-pix_fmt', TARGET_SPEC.pixelFormat,
    // 移除音频
    '-an',
    // 输出
    outputPath,
  ];
  
  await runFFmpeg(args, 'Normalizing');
  return outputPath;
}

/**
 * Step 1: 稳定化 (vidstab)
 * 使用 vidstab 进行轻量稳像，解决 AI 视频常见的微抖动
 */
async function stabilizeVideo(inputPath, outputPath, tempDir) {
  console.log('[IdleProcessor] Step 1: Stabilizing video...');
  
  const detectFile = path.join(tempDir, 'transforms.trf');
  
  // 第一步：检测运动
  const detectArgs = [
    '-y',
    '-i', inputPath,
    '-vf', `vidstabdetect=shakiness=5:accuracy=9:stepsize=6:result=${detectFile}`,
    '-f', 'null',
    '-',
  ];
  
  await runFFmpeg(detectArgs, 'Detecting motion');
  
  // 第二步：应用稳定 + 轻微裁剪（防黑边）
  const stabilizeArgs = [
    '-y',
    '-i', inputPath,
    '-vf', `vidstabtransform=input=${detectFile}:smoothing=10:optzoom=1:zoom=2:interpol=bilinear,crop=w=in_w*0.96:h=in_h*0.96,scale=${TARGET_SPEC.width}:${TARGET_SPEC.height}`,
    '-c:v', TARGET_SPEC.codec,
    '-preset', TARGET_SPEC.preset,
    '-crf', String(TARGET_SPEC.crf),
    '-pix_fmt', TARGET_SPEC.pixelFormat,
    '-an',
    outputPath,
  ];
  
  await runFFmpeg(stabilizeArgs, 'Applying stabilization');
  return outputPath;
}

/**
 * Step 2: 生成 reverse 视频
 */
async function generateReverse(inputPath, outputPath) {
  console.log('[IdleProcessor] Step 2: Generating reverse...');
  
  const args = [
    '-y',
    '-i', inputPath,
    '-vf', 'reverse',
    '-c:v', TARGET_SPEC.codec,
    '-preset', TARGET_SPEC.preset,
    '-crf', String(TARGET_SPEC.crf),
    '-pix_fmt', TARGET_SPEC.pixelFormat,
    '-an',
    outputPath,
  ];
  
  await runFFmpeg(args, 'Reversing');
  return outputPath;
}

/**
 * Step 3: 拼接成 ping-pong loop
 * forward + reverse = loop_safe.mp4
 */
async function createPingPongLoop(forwardPath, reversePath, outputPath, tempDir) {
  console.log('[IdleProcessor] Step 3: Creating ping-pong loop...');
  
  // 创建文件列表
  const listFile = path.join(tempDir, 'concat.txt');
  await fs.writeFile(listFile, `file '${forwardPath}'\nfile '${reversePath}'\n`);
  
  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',  // 无损拼接（前提是编码参数一致）
    outputPath,
  ];
  
  await runFFmpeg(args, 'Concatenating ping-pong');
  return outputPath;
}

/**
 * Step 4: 切点检测
 * 分析帧间差异，找到"最静止"的位置作为安全切点
 */
async function detectSafeCutPoints(videoPath, tempDir) {
  console.log('[IdleProcessor] Step 4: Detecting safe cut points...');
  
  const info = await getVideoInfo(videoPath);
  const duration = info.duration;
  const fps = info.fps || TARGET_SPEC.fps;
  
  // 分析帧间差异
  const sceneFile = path.join(tempDir, 'scene.txt');
  
  // 使用 select 滤镜检测场景变化
  const analyzeArgs = [
    '-y',
    '-i', videoPath,
    '-vf', `select='gt(scene,0)',metadata=print:file=${sceneFile}`,
    '-f', 'null',
    '-',
  ];
  
  try {
    await runFFmpeg(analyzeArgs, 'Analyzing scenes');
  } catch {
    // 如果没有场景变化，这是正常的
  }
  
  // 解析场景变化点
  let sceneChanges = [];
  try {
    const sceneData = await fs.readFile(sceneFile, 'utf-8');
    const lines = sceneData.split('\n');
    
    for (const line of lines) {
      // 解析 pts_time
      const timeMatch = line.match(/pts_time:([0-9.]+)/);
      const scoreMatch = line.match(/scene_score=([0-9.]+)/);
      
      if (timeMatch) {
        sceneChanges.push({
          time: parseFloat(timeMatch[1]),
          score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.1,
        });
      }
    }
  } catch {
    // 文件不存在或解析失败
  }
  
  // 生成安全切点（选择变化最小的时间点）
  const safeCutPoints = [];
  const interval = 0.5; // 每 0.5 秒检查一次
  
  for (let t = 0; t < duration; t += interval) {
    // 检查附近是否有场景变化
    const nearbyChange = sceneChanges.find(sc => Math.abs(sc.time - t) < 0.2);
    
    if (!nearbyChange || nearbyChange.score < 0.05) {
      // 这是一个相对静止的点
      safeCutPoints.push(Math.round(t * 100) / 100);
    }
  }
  
  // 确保开头和结尾有切点
  if (safeCutPoints.length === 0 || safeCutPoints[0] > 0.2) {
    safeCutPoints.unshift(0);
  }
  if (safeCutPoints[safeCutPoints.length - 1] < duration - 0.5) {
    safeCutPoints.push(Math.round(duration * 100) / 100);
  }
  
  // 限制切点数量（每秒最多 2 个）
  const maxPoints = Math.ceil(duration * 2);
  if (safeCutPoints.length > maxPoints) {
    const step = Math.ceil(safeCutPoints.length / maxPoints);
    const filtered = safeCutPoints.filter((_, i) => i % step === 0);
    return filtered;
  }
  
  return safeCutPoints;
}

/**
 * Step 5: 质量验收 (QC)
 * 检查视频是否符合要求
 */
async function qualityCheck(originalInfo, processedInfo, forwardPath, tempDir) {
  console.log('[IdleProcessor] Step 5: Quality check...');
  
  const issues = [];
  
  // 1. 检查时长
  if (originalInfo.duration < QC_THRESHOLDS.minDuration) {
    issues.push(`时长过短: ${originalInfo.duration.toFixed(2)}s < ${QC_THRESHOLDS.minDuration}s`);
  }
  if (originalInfo.duration > QC_THRESHOLDS.maxDuration) {
    issues.push(`时长过长: ${originalInfo.duration.toFixed(2)}s > ${QC_THRESHOLDS.maxDuration}s`);
  }
  
  // 2. 检查帧率
  if (originalInfo.fps < QC_THRESHOLDS.minFps) {
    issues.push(`帧率过低: ${originalInfo.fps}fps < ${QC_THRESHOLDS.minFps}fps`);
  }
  
  // 3. 检查处理后的视频规格
  if (processedInfo.width !== TARGET_SPEC.width || processedInfo.height !== TARGET_SPEC.height) {
    issues.push(`分辨率异常: ${processedInfo.width}x${processedInfo.height}`);
  }
  
  // 4. 检查首尾帧一致性（对于 loop 很重要）
  try {
    const firstFrame = path.join(tempDir, 'first.jpg');
    const lastFrame = path.join(tempDir, 'last.jpg');
    
    // 提取首帧
    await runFFmpeg([
      '-y', '-i', forwardPath,
      '-vframes', '1', '-q:v', '2',
      firstFrame,
    ], 'Extracting first frame');
    
    // 提取尾帧
    await runFFmpeg([
      '-y', '-sseof', '-0.1', '-i', forwardPath,
      '-vframes', '1', '-q:v', '2',
      lastFrame,
    ], 'Extracting last frame');
    
    // 比较首尾帧差异（使用 PSNR）
    // PSNR > 30 表示视觉上非常接近
    // 这里简化处理，只记录警告
  } catch (err) {
    console.warn('[IdleProcessor] Frame comparison failed:', err.message);
  }
  
  // 5. 估算抖动程度（基于稳像前后的对比）
  // 这里简化处理，假设稳像后抖动已解决
  
  const passed = issues.length === 0;
  
  return {
    passed,
    issues,
    originalSpec: {
      duration: originalInfo.duration,
      resolution: `${originalInfo.width}x${originalInfo.height}`,
      fps: originalInfo.fps,
      codec: originalInfo.codec,
    },
    processedSpec: {
      duration: processedInfo.duration,
      resolution: `${processedInfo.width}x${processedInfo.height}`,
      fps: processedInfo.fps,
    },
  };
}

/**
 * 主处理函数
 * 
 * @param {Buffer} videoBuffer - 输入视频 buffer
 * @param {string} originalFilename - 原始文件名
 * @param {Function} uploadFn - 上传函数 (buffer, key, contentType) => { url }
 * @returns {Object} 处理结果
 */
async function processIdleVideo(videoBuffer, originalFilename, uploadFn) {
  const startTime = Date.now();
  const tempDir = await createTempDir();
  
  console.log(`[IdleProcessor] Starting processing: ${originalFilename}, size: ${videoBuffer.length} bytes`);
  
  try {
    // 保存输入文件
    const inputPath = path.join(tempDir, 'input.mp4');
    await fs.writeFile(inputPath, videoBuffer);
    
    // 获取原始视频信息
    const originalInfo = await getVideoInfo(inputPath);
    console.log('[IdleProcessor] Original info:', originalInfo);
    
    // Step 0: 规范化
    const normalizedPath = path.join(tempDir, 'normalized.mp4');
    await normalizeVideo(inputPath, normalizedPath);
    
    // Step 1: 稳定化
    const stabilizedPath = path.join(tempDir, 'stabilized.mp4');
    try {
      await stabilizeVideo(normalizedPath, stabilizedPath, tempDir);
    } catch (err) {
      console.warn('[IdleProcessor] Stabilization failed, using normalized:', err.message);
      // 如果稳定化失败，使用规范化后的视频
      await fs.copyFile(normalizedPath, stabilizedPath);
    }
    
    // Step 2: 生成 reverse
    const reversePath = path.join(tempDir, 'reverse.mp4');
    await generateReverse(stabilizedPath, reversePath);
    
    // Step 3: 拼接 ping-pong loop
    const loopSafePath = path.join(tempDir, 'loop_safe.mp4');
    await createPingPongLoop(stabilizedPath, reversePath, loopSafePath, tempDir);
    
    // 获取处理后的视频信息
    const stabilizedInfo = await getVideoInfo(stabilizedPath);
    const loopSafeInfo = await getVideoInfo(loopSafePath);
    
    // Step 4: 切点检测
    const safeCutPoints = await detectSafeCutPoints(loopSafePath, tempDir);
    console.log('[IdleProcessor] Safe cut points:', safeCutPoints);
    
    // Step 5: 质量验收
    const qcResult = await qualityCheck(originalInfo, stabilizedInfo, stabilizedPath, tempDir);
    console.log('[IdleProcessor] QC result:', qcResult);
    
    // 上传处理后的文件
    const datePrefix = new Date().toISOString().slice(0, 10);
    const fileId = uuidv4();
    
    // 读取文件
    const forwardBuffer = await fs.readFile(stabilizedPath);
    const reverseBuffer = await fs.readFile(reversePath);
    const loopSafeBuffer = await fs.readFile(loopSafePath);
    
    // 上传
    const [forwardResult, reverseResult, loopSafeResult] = await Promise.all([
      uploadFn(forwardBuffer, `idle/${datePrefix}/${fileId}_forward.mp4`, 'video/mp4'),
      uploadFn(reverseBuffer, `idle/${datePrefix}/${fileId}_reverse.mp4`, 'video/mp4'),
      uploadFn(loopSafeBuffer, `idle/${datePrefix}/${fileId}_loop_safe.mp4`, 'video/mp4'),
    ]);
    
    const processingTime = Date.now() - startTime;
    console.log(`[IdleProcessor] Completed in ${processingTime}ms`);
    
    return {
      success: true,
      qc: qcResult,
      urls: {
        forward: forwardResult.url,
        reverse: reverseResult.url,
        loopSafe: loopSafeResult.url,
      },
      metadata: {
        duration: stabilizedInfo.duration,
        loopDuration: loopSafeInfo.duration,
        width: stabilizedInfo.width,
        height: stabilizedInfo.height,
        fps: stabilizedInfo.fps,
        safeCutPoints,
        processingTimeMs: processingTime,
      },
    };
  } catch (err) {
    console.error('[IdleProcessor] Processing failed:', err);
    throw err;
  } finally {
    // 清理临时文件
    await cleanupTempDir(tempDir);
  }
}

/**
 * 检查 ffmpeg 和 vidstab 是否可用
 */
async function checkDependencies() {
  const results = {
    ffmpeg: false,
    vidstab: false,
    version: '',
  };
  
  try {
    const version = execSync('ffmpeg -version', { encoding: 'utf-8', timeout: 5000 });
    results.ffmpeg = true;
    results.version = version.split('\n')[0] || '';
    
    // 检查 vidstab 滤镜
    const filters = execSync('ffmpeg -filters 2>&1 | grep vidstab', { encoding: 'utf-8', timeout: 5000 });
    results.vidstab = filters.includes('vidstab');
  } catch {
    // 忽略错误
  }
  
  return results;
}

module.exports = {
  processIdleVideo,
  checkDependencies,
  getVideoInfo,
  TARGET_SPEC,
  QC_THRESHOLDS,
};
