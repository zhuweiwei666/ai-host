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
  
  const ratingGuide = {
    mild: '暧昧暗示',
    moderate: '情色挑逗',
    explicit: '露骨描写'
  };
  
  return `你正在以论坛帖子的方式讲述一个故事。每次只发一层楼的内容。

## 你是谁
名字：${agent.name}
性格：${config.personality || agent.description || '温柔体贴'}
外貌：${config.appearance || '美丽动人'}

## 当前状态
- 场景：${session.state.scene}
- 氛围：${session.state.mood}
- 穿着：${session.state.clothes || '日常装扮'}
- 进度：${session.progress}%
- 上文：${session.state.lastAction || '开始...'}

## 当前目标
${currentBeat.goal || '自然发展'}

## 输出格式【必须严格遵守】
每次回复必须包含两部分，用换行分隔：

1. 文字内容：30-50字，第一人称"我"视角，像论坛回帖一样简短有趣
2. 图片标签：[IMG: 画面描述]，描述当前配图，必须包含人物动作、表情、视角

## 示例输出
我轻轻咬着嘴唇，手指不自觉地卷起发梢，偷偷看了他一眼。
[IMG: 咬唇，手指卷发，眼神含羞，侧脸特写，微微低头]

## 尺度控制
- 0-30%：暧昧期（眼神、试探、初次接触）
- 30-60%：升温期（肢体接触、暧昧氛围）
- 60-90%：高潮期（${ratingGuide[config.contentRating || 'moderate']}）
- 90-100%：余韵

## 禁止
- 禁止超过50字
- 禁止总结或旁白
- 禁止使用"你"作为主语`;
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
  const imgMatch = response.match(/\[IMG:\s*([^\]]+)\]/i);
  
  let content = response;
  let imagePrompt = null;
  
  if (imgMatch) {
    imagePrompt = imgMatch[1].trim();
    content = response.replace(imgMatch[0], '').trim();
  }
  
  content = content.replace(/\s+/g, ' ').trim();
  
  if (content.length > 60) {
    content = content.slice(0, 57) + '...';
  }
  
  return { content, imagePrompt };
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
    state: {
      scene: '初始场景',
      time: '傍晚',
      mood: '平静',
      clothes: '',
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
  const { content, imagePrompt } = parseAIResponse(rawResponse);
  
  const stateUpdate = extractStateUpdate(content);
  
  // 先保存文字，imageUrl 为 null
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'ai', null, null, imagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(3 + Math.random() * 2);
  
  await session.save();
  
  // 异步生成图片（不阻塞返回）
  if (imagePrompt) {
    generateImageAsync(session._id, paragraphIndex, imagePrompt, session.agentId);
  }
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%`);
  
  return {
    content,
    imageUrl: null, // 前端显示 loading
    imagePrompt,
    paragraphIndex, // 用于轮询
    progress: session.progress,
    state: session.state,
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
  const { content, imagePrompt } = parseAIResponse(rawResponse);
  
  const stateUpdate = extractStateUpdate(content);
  
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'user_input', userInput, null, imagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(2 + Math.random() * 3);
  
  await session.save();
  
  // 异步生成图片
  if (imagePrompt) {
    generateImageAsync(session._id, paragraphIndex, imagePrompt, session.agentId);
  }
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, progress=${session.progress}%`);
  
  return {
    content,
    imageUrl: null,
    imagePrompt,
    paragraphIndex,
    progress: session.progress,
    state: session.state,
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

module.exports = {
  startStory,
  continueStory,
  inputStory,
  getStoryState,
  restartStory,
  getParagraphImage,
};
