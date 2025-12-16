/**
 * Story Service
 * 
 * 论坛帖子式剧情模式的核心服务
 * - 文字先出，图片异步加载
 * - 基于主播图片 img2img 保持人物一致性
 * - 图片缓存复用，节约 API 成本
 */

const StorySession = require('../models/StorySession');
const StoryImageCache = require('../models/StoryImageCache');
const Agent = require('../models/Agent');
const ProviderFactory = require('../providers/providerFactory');
const imageGenerationService = require('./imageGenerationService');

/**
 * 从 prompt 提取关键词标签
 */
function extractTags(prompt) {
  if (!prompt) return [];
  
  const moodTags = ['微笑', '害羞', '调皮', '暧昧', '激动', '温柔', '俏皮', '含羞', '娇羞'];
  const actionTags = ['咬唇', '卷发', '侧脸', '正面', '回眸', '低头', '抬眼', '撩发', '靠近'];
  const sceneTags = ['特写', '半身', '全身', '自拍', '镜子', '床上', '沙发', '窗边'];
  
  const allTags = [...moodTags, ...actionTags, ...sceneTags];
  const found = [];
  
  for (const tag of allTags) {
    if (prompt.includes(tag)) {
      found.push(tag);
    }
  }
  
  return found;
}

/**
 * 从 prompt 推断情绪
 */
function inferMood(prompt, progress) {
  if (!prompt) return 'neutral';
  
  if (prompt.includes('激动') || prompt.includes('兴奋') || prompt.includes('热情')) return 'passionate';
  if (prompt.includes('害羞') || prompt.includes('含羞') || prompt.includes('娇羞')) return 'shy';
  if (prompt.includes('调皮') || prompt.includes('俏皮') || prompt.includes('暧昧')) return 'flirty';
  if (prompt.includes('开心') || prompt.includes('微笑') || prompt.includes('笑')) return 'happy';
  
  // 根据进度推断
  if (progress >= 60) return 'flirty';
  if (progress >= 30) return 'shy';
  return 'neutral';
}

/**
 * 获取当前应该使用的故事节拍
 */
function getCurrentBeat(storyBeats, progress) {
  if (!storyBeats || storyBeats.length === 0) {
    return { goal: '自然发展剧情', sceneHint: null, moodHint: null };
  }
  
  for (const beat of storyBeats) {
    const [min, max] = beat.progressRange || [0, 100];
    if (progress >= min && progress < max) {
      return beat;
    }
  }
  
  return storyBeats[storyBeats.length - 1];
}

/**
 * 构建论坛帖子风格的 System Prompt
 */
function buildSystemPrompt(agent, session) {
  const config = agent.storyConfig || {};
  const currentBeat = getCurrentBeat(config.storyBeats, session.progress);
  const affection = session.affection || { level: 0, stage: '陌生' };
  
  const ratingGuide = {
    mild: '暧昧暗示',
    moderate: '情色挑逗',
    explicit: '露骨描写'
  };
  
  return `你正在讲述一个互动故事。每次只输出一段内容。

## 你是谁
名字：${agent.name}
性格：${config.personality || agent.description || '温柔体贴'}
外貌：${config.appearance || '美丽动人'}

## 当前状态
- 场景：${session.state.scene}
- 心情：${session.state.mood}
- 穿着：${session.state.clothes || '日常装扮'}
- 好感度：${affection.level}%（${affection.stage}）
- 上文：${session.state.lastAction || '开始...'}

## 当前目标
${currentBeat.goal || '自然发展'}

## 输出格式【必须严格遵守】
每次回复必须包含以下部分，用换行分隔：

1. 角色对话：用「」包裹角色说的话
2. 动作描写：用普通文字描述角色动作和场景
3. 内心独白：用（）包裹角色心理活动
4. 好感变化：[好感+X] 或 [好感-X]，X是1-10的数字
5. 状态变化：[表情:XXX] [动作:XXX] [心情:XXX]
6. 图片标签：[IMG: 画面描述]

## 示例输出
「嗯？你怎么知道我在这里...」

她微微侧过头，发丝滑落肩膀，眼神有些闪躲。

（他居然找到这里了...心跳好快）

[好感+3]
[表情:害羞脸红] [动作:低头卷发] [心情:小鹿乱撞]
[IMG: 侧脸特写，害羞表情，手指卷发，阳光透过窗户]

## 尺度控制（基于好感度）
- 0-20%陌生：礼貌但保持距离
- 20-40%熟悉：开始放松，偶尔调皮
- 40-60%暧昧：${ratingGuide[config.contentRating || 'moderate']}
- 60-80%热恋：更加亲密大胆
- 80-100%深爱：完全交付信任

## 禁止
- 禁止超过100字
- 禁止使用"你"作为主语，用"他"指代用户`;
}

function buildContinuePrompt(session) {
  return `继续。进度 ${session.progress}%。直接输出内容+图片标签，不要解释。`;
}

function buildUserInputPrompt(session, userInput) {
  return `用户说/做了："${userInput}"
回应他。进度 ${session.progress}%。直接输出内容+图片标签。`;
}

async function generateContent(systemPrompt, userPrompt, model = 'grok-3-fast') {
  try {
    const provider = ProviderFactory.getProvider(model);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const result = await provider.chat(model, messages, 0.9, { maxTokens: 200 });
    return result.content;
  } catch (error) {
    console.error('[StoryService] AI generation failed:', error.message);
    throw new Error('AI 生成失败，请稍后重试');
  }
}

function parseAIResponse(response) {
  // 提取图片描述
  const imgMatch = response.match(/\[IMG:\s*([^\]]+)\]/i);
  let imagePrompt = imgMatch ? imgMatch[1].trim() : null;
  
  // 提取好感度变化
  const affectionMatch = response.match(/\[好感([+-])(\d+)\]/);
  let affectionChange = 0;
  if (affectionMatch) {
    affectionChange = parseInt(affectionMatch[2]) * (affectionMatch[1] === '+' ? 1 : -1);
  }
  
  // 提取状态变化
  const stateChanges = {};
  const expressionMatch = response.match(/\[表情[:：]([^\]]+)\]/);
  const actionMatch = response.match(/\[动作[:：]([^\]]+)\]/);
  const moodMatch = response.match(/\[心情[:：]([^\]]+)\]/);
  
  if (expressionMatch) stateChanges.expression = expressionMatch[1].trim();
  if (actionMatch) stateChanges.action = actionMatch[1].trim();
  if (moodMatch) stateChanges.mood = moodMatch[1].trim();
  
  // 清理内容：移除所有标签
  let content = response
    .replace(/\[IMG:\s*[^\]]+\]/gi, '')
    .replace(/\[好感[+-]\d+\]/g, '')
    .replace(/\[表情[:：][^\]]+\]/g, '')
    .replace(/\[动作[:：][^\]]+\]/g, '')
    .replace(/\[心情[:：][^\]]+\]/g, '')
    .trim();
  
  // 保留格式化的换行
  content = content.replace(/\n{3,}/g, '\n\n');
  
  return { content, imagePrompt, affectionChange, stateChanges };
}

/**
 * 生成图片 - Fal.ai Flux Pro v1.1 Redux (Img2Img) 最高质量
 * - 不走 Grok 生图（质量不稳定）
 * - 关闭安全检查（由 Fal 参数控制，且不做本地“黑图过滤”）
 * - 优先复用缓存，其次生成新图
 */
async function generateImageWithConsistency(imagePrompt, agent, progress) {
  if (!imagePrompt) {
    console.log('[StoryService] 无图片描述，跳过图片生成');
    return null;
  }

  const isNsfw = progress >= 60;
  const rating = isNsfw ? 'nsfw' : (progress >= 30 ? 'suggestive' : 'sfw');
  const mood = inferMood(imagePrompt, progress);
  const tags = extractTags(imagePrompt);

  // 1. 尝试复用缓存的图片 (30% 概率复用)
  if (Math.random() < 0.3) {
    try {
      const cached = await StoryImageCache.findReusable(agent._id, tags, mood, rating);
      if (cached) {
        console.log(`[StoryService] 复用缓存图片: ${cached.imageUrl.substring(0, 50)}...`);
        return cached.imageUrl;
      }
    } catch (cacheErr) {
      console.warn('[StoryService] 缓存查询失败:', cacheErr.message);
    }
  }

  // 2. 构建高质量 prompt（包含角色外貌描述）
  const config = agent.storyConfig || {};
  const appearance = config.appearance || agent.description || '';
  const style = agent.style === 'anime' 
    ? 'anime style, illustration, masterpiece, best quality, ' 
    : 'photorealistic, 8k uhd, dslr, soft lighting, high quality, beautiful woman, ';
  
  let fullPrompt = `${style}${appearance}, ${imagePrompt}`;
  
  if (isNsfw) {
    fullPrompt = `nsfw, sensual, ${fullPrompt}`;
  }

  console.log(`[StoryService] 生成图片: ${fullPrompt.substring(0, 80)}...`);

  let imageUrl = null;

  // 3. 仅使用 Fal.ai Img2Img（保持人物一致性 + 最高质量）
  const referenceImage = agent.avatarUrls?.[0] || agent.avatarUrl;
  if (!referenceImage) {
    console.warn('[StoryService] 无参考图，Fal.ai img2img 不可用');
    return null;
  }

  try {
    console.log('[StoryService] 使用 Fal.ai Flux Pro v1.1 Redux img2img...');
    const results = await imageGenerationService.generate(fullPrompt, {
      referenceImage,
      count: 1,
      width: 768,
      height: 1024,
      strength: 0.55,
      style: agent.style || 'realistic'
    });

    if (results && results.length > 0 && results[0].url) {
      imageUrl = results[0].url;
      console.log('[StoryService] Fal.ai 生成成功');
    }
  } catch (falError) {
    console.error('[StoryService] Fal.ai 生成失败:', falError.message);
  }

  // 5. 保存到缓存
  if (imageUrl) {
    try {
      await StoryImageCache.saveToCache(agent._id, imageUrl, fullPrompt, tags, mood, rating);
    } catch (saveErr) {
      console.warn('[StoryService] 缓存保存失败:', saveErr.message);
    }
  }

  return imageUrl;
}

/**
 * 异步生成图片并更新段落
 */
async function generateImageAsync(sessionId, paragraphIndex, imagePrompt, agentId) {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) return;

    const session = await StorySession.findById(sessionId);
    if (!session) return;

    const progress = session.progress;
    const imageUrl = await generateImageWithConsistency(imagePrompt, agent, progress);
    
    if (imageUrl && session.paragraphs[paragraphIndex]) {
      session.paragraphs[paragraphIndex].imageUrl = imageUrl;
      await session.save();
      console.log(`[StoryService] 异步图片已更新: sessionId=${sessionId}, index=${paragraphIndex}`);
    }
  } catch (err) {
    console.error('[StoryService] 异步图片生成失败:', err.message);
  }
}

function extractStateUpdate(content) {
  const lastAction = content.slice(-50);
  
  let scene = null;
  const scenePatterns = [
    /来到了?(.{2,10})/,
    /走进了?(.{2,10})/,
    /进入了?(.{2,10})/,
    /在(.{2,8})(里|中|上)/,
  ];
  for (const pattern of scenePatterns) {
    const match = content.match(pattern);
    if (match) {
      scene = match[1];
      break;
    }
  }
  
  let mood = null;
  if (content.includes('暧昧') || content.includes('心跳')) mood = '暧昧';
  else if (content.includes('紧张') || content.includes('害怕')) mood = '紧张';
  else if (content.includes('激动') || content.includes('兴奋')) mood = '激动';
  else if (content.includes('温馨') || content.includes('温暖')) mood = '温馨';
  
  return { scene, mood, clothes: null, newEvent: null, lastAction };
}

/**
 * 开始新故事
 */
async function startStory(userId, agentId) {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('角色不存在');
  }
  
  let session = await StorySession.findOne({ userId, agentId, status: 'active' });
  
  if (session) {
    return {
      sessionId: session._id,
      opening: session.paragraphs[0]?.content || agent.storyConfig?.opening || agent.defaultGreeting,
      progress: session.progress,
      state: session.state,
      affection: session.affection || { level: 0, stage: '陌生', lastChange: 0 },
      paragraphs: session.paragraphs,
      isExisting: true,
    };
  }
  
  const openingText = agent.storyConfig?.opening || agent.defaultGreeting || `嗨，我是${agent.name}，我们的故事开始了...`;
  const openingImagePrompt = `微笑，打招呼，正面特写，友好表情`;
  
  session = new StorySession({
    userId,
    agentId,
    progress: 0,
    affection: {
      level: 0,
      stage: '陌生',
      lastChange: 0,
    },
    state: {
      scene: '初始场景',
      time: '傍晚',
      mood: '害羞',
      action: '',
      clothes: '',
      expression: '',
      lastAction: openingText.slice(-50),
    },
    events: [],
    paragraphs: [{
      content: openingText,
      imageUrl: null, // 图片异步生成
      imagePrompt: openingImagePrompt,
      source: 'ai',
      createdAt: new Date(),
    }],
    totalParagraphs: 1,
  });
  
  await session.save();
  
  // 异步生成开场图片
  generateImageAsync(session._id, 0, openingImagePrompt, agentId);
  
  console.log(`[StoryService] New story started: sessionId=${session._id}`);
  
  return {
    sessionId: session._id,
    opening: openingText,
    openingImageUrl: null, // 前端显示 loading
    progress: 0,
    state: session.state,
    affection: session.affection,
    paragraphs: session.paragraphs,
    isExisting: false,
    imageGenerating: true, // 告诉前端图片正在生成
  };
}

/**
 * 继续故事 - 文字先返回，图片异步生成
 */
async function continueStory(sessionId) {
  const session = await StorySession.findById(sessionId);
  if (!session) throw new Error('故事不存在');
  // 故事永不结束，不检查 status

  const agent = await Agent.findById(session.agentId);
  if (!agent) throw new Error('角色不存在');
  
  const systemPrompt = buildSystemPrompt(agent, session);
  const userPrompt = buildContinuePrompt(session);
  
  // 生成文字
  const rawResponse = await generateContent(systemPrompt, userPrompt, agent.modelName || 'grok-3-fast');
  const { content, imagePrompt, affectionChange, stateChanges } = parseAIResponse(rawResponse);
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;
  
  // 先保存文字，imageUrl 为 null
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'ai', null, null, imagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(3 + Math.random() * 2);
  
  // 更新好感度
  if (affectionChange) {
    session.updateAffection(affectionChange);
  }
  
  await session.save();
  
  // 异步生成图片（不阻塞返回）
  if (imagePrompt) {
    generateImageAsync(session._id, paragraphIndex, imagePrompt, session.agentId);
  }
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  return {
    content,
    imageUrl: null, // 前端显示 loading
    imagePrompt,
    paragraphIndex, // 用于轮询
    progress: session.progress,
    state: session.state,
    affection: session.affection, // 好感度数据
    isEnding: false, // 故事永不结束
    imageGenerating: !!imagePrompt, // 告诉前端是否有图片在生成
  };
}

/**
 * 用户输入推进故事
 */
async function inputStory(sessionId, userInput) {
  const session = await StorySession.findById(sessionId);
  if (!session) throw new Error('故事不存在');
  // 故事永不结束，不检查 status

  const agent = await Agent.findById(session.agentId);
  if (!agent) throw new Error('角色不存在');
  
  const systemPrompt = buildSystemPrompt(agent, session);
  const userPrompt = buildUserInputPrompt(session, userInput);
  
  const rawResponse = await generateContent(systemPrompt, userPrompt, agent.modelName || 'grok-3-fast');
  const { content, imagePrompt, affectionChange, stateChanges } = parseAIResponse(rawResponse);
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;
  
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'user_input', userInput, null, imagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(2 + Math.random() * 3);
  
  // 用户输入通常会增加好感度（如果 AI 没返回变化则默认+2）
  const actualChange = affectionChange || 2;
  session.updateAffection(actualChange);
  
  await session.save();
  
  // 异步生成图片
  if (imagePrompt) {
    generateImageAsync(session._id, paragraphIndex, imagePrompt, session.agentId);
  }
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  return {
    content,
    imageUrl: null,
    imagePrompt,
    paragraphIndex,
    progress: session.progress,
    state: session.state,
    affection: session.affection, // 好感度数据
    isEnding: false, // 故事永不结束
    imageGenerating: !!imagePrompt,
  };
}

/**
 * 获取段落图片状态（用于前端轮询）
 */
async function getParagraphImage(sessionId, paragraphIndex) {
  const session = await StorySession.findById(sessionId).lean();
  if (!session) throw new Error('故事不存在');
  
  const paragraph = session.paragraphs[paragraphIndex];
  if (!paragraph) throw new Error('段落不存在');
  
  return {
    imageUrl: paragraph.imageUrl,
    imageReady: !!paragraph.imageUrl,
  };
}

async function getStoryState(sessionId) {
  const session = await StorySession.findById(sessionId)
    .populate('agentId', 'name avatarUrls storyConfig');
    
  if (!session) throw new Error('故事不存在');
  
  return {
    sessionId: session._id,
    agentId: session.agentId._id,
    agentName: session.agentId.name,
    agentAvatar: session.agentId.avatarUrls?.[0],
    progress: session.progress,
    state: session.state,
    paragraphs: session.paragraphs,
    totalParagraphs: session.totalParagraphs,
    status: session.status,
  };
}

async function restartStory(userId, agentId) {
  await StorySession.updateMany(
    { userId, agentId, status: 'active' },
    { status: 'abandoned' }
  );
  
  return startStory(userId, agentId);
}

/**
 * 生成写真 - 基于当前场景生成高质量角色写真
 */
async function generatePhoto(sessionId) {
  const session = await StorySession.findById(sessionId);
  if (!session) throw new Error('故事不存在');
  
  const agent = await Agent.findById(session.agentId);
  if (!agent) throw new Error('角色不存在');
  
  const config = agent.storyConfig || {};
  const appearance = config.appearance || agent.description || '';
  const state = session.state;
  const affection = session.affection || { level: 0, stage: '陌生' };
  
  // 根据好感度和当前状态构建写真 prompt
  let poseDesc = '';
  let expressionDesc = '';
  let clothesDesc = state.clothes || '日常装扮';
  
  // 根据好感度阶段决定写真风格
  if (affection.level >= 80) {
    poseDesc = 'seductive pose, lying on bed, looking at viewer';
    expressionDesc = 'loving eyes, gentle smile, intimate look';
  } else if (affection.level >= 60) {
    poseDesc = 'sensual pose, leaning forward, playful';
    expressionDesc = 'flirty smile, bedroom eyes, teasing';
  } else if (affection.level >= 40) {
    poseDesc = 'cute pose, tilting head, hands near face';
    expressionDesc = 'shy smile, blushing, curious look';
  } else if (affection.level >= 20) {
    poseDesc = 'casual pose, standing naturally';
    expressionDesc = 'friendly smile, soft expression';
  } else {
    poseDesc = 'formal pose, standing straight';
    expressionDesc = 'polite smile, reserved look';
  }
  
  // 添加当前状态信息
  if (state.expression) expressionDesc = state.expression + ', ' + expressionDesc;
  if (state.action) poseDesc = state.action + ', ' + poseDesc;
  
  const style = agent.style === 'anime' 
    ? 'anime style, illustration, masterpiece, best quality, ' 
    : 'photorealistic, 8k uhd, dslr, soft lighting, high quality, beautiful woman, ';
  
  const isNsfw = affection.level >= 60;
  let photoPrompt = `${style}${appearance}, ${poseDesc}, ${expressionDesc}, ${clothesDesc}, portrait, detailed face`;
  
  if (isNsfw) {
    photoPrompt = `nsfw, sensual, ${photoPrompt}`;
  }
  
  console.log(`[StoryService] 生成写真: ${photoPrompt.substring(0, 100)}...`);
  
  const referenceImage = agent.avatarUrls?.[0] || agent.avatarUrl;
  if (!referenceImage) {
    throw new Error('角色没有参考图片');
  }
  
  try {
    const results = await imageGenerationService.generate(photoPrompt, {
      referenceImage,
      count: 1,
      width: 768,
      height: 1024,
      strength: 0.5, // 写真用稍低的 strength 保持更多原图特征
      style: agent.style || 'realistic'
    });
    
    if (results && results.length > 0 && results[0].url) {
      console.log('[StoryService] 写真生成成功');
      return {
        imageUrl: results[0].url,
        prompt: photoPrompt,
      };
    }
    
    throw new Error('写真生成失败');
  } catch (error) {
    console.error('[StoryService] 写真生成失败:', error.message);
    throw error;
  }
}

module.exports = {
  startStory,
  continueStory,
  inputStory,
  getStoryState,
  restartStory,
  getParagraphImage,
  generatePhoto,
};
