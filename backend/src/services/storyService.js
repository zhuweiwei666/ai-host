/**
 * Story Service
 * 
 * 论坛帖子式剧情模式的核心服务
 * - 短内容生成 (30-50字，像论坛回帖)
 * - 每层楼配图 (Grok API 优先，Fal.ai 降级)
 * - 状态管理
 */

const StorySession = require('../models/StorySession');
const Agent = require('../models/Agent');
const ProviderFactory = require('../providers/providerFactory');
const grokImageProvider = require('../providers/grokImageProvider');
const imageGenerationService = require('./imageGenerationService');

/**
 * 获取当前应该使用的故事节拍
 */
function getCurrentBeat(storyBeats, progress) {
  if (!storyBeats || storyBeats.length === 0) {
    return {
      goal: '自然发展剧情',
      sceneHint: null,
      moodHint: null
    };
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
  
  // 尺度描述
  const ratingGuide = {
    mild: '暧昧暗示',
    moderate: '情色挑逗',
    explicit: '露骨描写'
  };
  
  const prompt = `你正在以论坛帖子的方式讲述一个故事。每次只发一层楼的内容。

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
2. 图片标签：[IMG: 画面描述]，描述当前这层楼应该配什么图

## 示例输出
我轻轻咬着嘴唇，手指不自觉地卷起发梢，偷偷看了他一眼。
[IMG: 少女咬唇，手指卷发，眼神含羞，侧脸特写]

## 尺度控制
- 0-30%：暧昧期（眼神、试探、初次接触）
- 30-60%：升温期（肢体接触、暧昧氛围）
- 60-90%：高潮期（${ratingGuide[config.contentRating || 'moderate']}）
- 90-100%：余韵

## 禁止
- 禁止超过50字
- 禁止总结或旁白
- 禁止使用"你"作为主语`;

  return prompt;
}

/**
 * 构建继续剧情的 User Prompt
 */
function buildContinuePrompt(session) {
  return `继续。进度 ${session.progress}%。直接输出内容+图片标签，不要解释。`;
}

/**
 * 构建响应用户输入的 User Prompt
 */
function buildUserInputPrompt(session, userInput) {
  return `用户说/做了："${userInput}"
回应他。进度 ${session.progress}%。直接输出内容+图片标签。`;
}

/**
 * 调用 AI 生成内容
 */
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

/**
 * 解析 AI 回复，提取文字内容和图片描述
 */
function parseAIResponse(response) {
  // 匹配 [IMG: xxx] 标签
  const imgMatch = response.match(/\[IMG:\s*([^\]]+)\]/i);
  
  let content = response;
  let imagePrompt = null;
  
  if (imgMatch) {
    imagePrompt = imgMatch[1].trim();
    content = response.replace(imgMatch[0], '').trim();
  }
  
  // 清理内容，移除多余空白
  content = content.replace(/\s+/g, ' ').trim();
  
  // 如果内容太长，截断到 60 字
  if (content.length > 60) {
    content = content.slice(0, 57) + '...';
  }
  
  return { content, imagePrompt };
}

/**
 * 生成图片 (Grok 优先，Fal.ai 降级)
 */
async function generateImage(imagePrompt, agent, isNsfw = false) {
  if (!imagePrompt) {
    console.log('[StoryService] 无图片描述，跳过图片生成');
    return null;
  }

  // 构建完整的图片 prompt
  const config = agent.storyConfig || {};
  const appearance = config.appearance || agent.description || '';
  const style = agent.style === 'anime' ? 'anime style, illustration, ' : 'photorealistic, 8k, ';
  
  let fullPrompt = `${style}${appearance}, ${imagePrompt}`;
  
  // 如果是 NSFW 阶段，添加相关关键词
  if (isNsfw) {
    fullPrompt = `nsfw, ${fullPrompt}`;
  }

  console.log(`[StoryService] 生成图片: ${fullPrompt.substring(0, 50)}...`);

  // 尝试 Grok 图片 API
  try {
    const results = await grokImageProvider.generate(fullPrompt, { n: 1 });
    if (results && results.length > 0 && results[0].url) {
      console.log('[StoryService] Grok 图片生成成功');
      return results[0].url;
    }
  } catch (grokError) {
    console.warn('[StoryService] Grok 图片生成失败，降级到 Fal.ai:', grokError.message);
  }

  // 降级到 Fal.ai
  try {
    // 获取参考图
    const referenceImage = agent.avatarUrls?.[0] || agent.avatarUrl;
    
    if (!referenceImage) {
      console.warn('[StoryService] 无参考图，无法使用 Fal.ai img2img');
      return null;
    }

    const results = await imageGenerationService.generate(fullPrompt, {
      referenceImage,
      count: 1,
      width: 768,
      height: 1024,
      strength: 0.6,
      style: agent.style || 'realistic'
    });

    if (results && results.length > 0 && results[0].url) {
      console.log('[StoryService] Fal.ai 图片生成成功');
      return results[0].url;
    }
  } catch (falError) {
    console.error('[StoryService] Fal.ai 图片生成也失败:', falError.message);
  }

  return null;
}

/**
 * 提取状态更新（规则提取）
 */
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
  
  return {
    scene,
    mood,
    clothes: null,
    newEvent: null,
    lastAction,
  };
}

/**
 * 开始新故事
 */
async function startStory(userId, agentId) {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('角色不存在');
  }
  
  let session = await StorySession.findOne({
    userId,
    agentId,
    status: 'active'
  });
  
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
  
  // 创建新故事，生成开场白
  const openingText = agent.storyConfig?.opening || agent.defaultGreeting || `嗨，我是${agent.name}，我们的故事开始了...`;
  
  // 为开场生成配图
  const openingImagePrompt = `${agent.name}，微笑，打招呼，正面特写`;
  let openingImageUrl = null;
  
  try {
    openingImageUrl = await generateImage(openingImagePrompt, agent, false);
  } catch (imgErr) {
    console.error('[StoryService] 开场图片生成失败:', imgErr.message);
  }
  
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
      imageUrl: openingImageUrl,
      imagePrompt: openingImagePrompt,
      source: 'ai',
      createdAt: new Date(),
    }],
    totalParagraphs: 1,
  });
  
  await session.save();
  
  console.log(`[StoryService] New story started: userId=${userId}, agentId=${agentId}, sessionId=${session._id}`);
  
  return {
    sessionId: session._id,
    opening: openingText,
    openingImageUrl,
    progress: 0,
    state: session.state,
    paragraphs: session.paragraphs,
    isExisting: false,
  };
}

/**
 * 继续故事（AI 自动推进）
 */
async function continueStory(sessionId) {
  const session = await StorySession.findById(sessionId);
  if (!session) {
    throw new Error('故事不存在');
  }
  
  if (session.status !== 'active') {
    throw new Error('故事已结束');
  }
  
  const agent = await Agent.findById(session.agentId);
  if (!agent) {
    throw new Error('角色不存在');
  }
  
  // 构建 Prompt
  const systemPrompt = buildSystemPrompt(agent, session);
  const userPrompt = buildContinuePrompt(session);
  
  // 调用 AI 生成文字+图片描述
  const rawResponse = await generateContent(systemPrompt, userPrompt, agent.modelName || 'grok-3-fast');
  
  // 解析响应
  const { content, imagePrompt } = parseAIResponse(rawResponse);
  
  // 判断是否是 NSFW 阶段
  const isNsfw = session.progress >= 60;
  
  // 生成图片
  const imageUrl = await generateImage(imagePrompt, agent, isNsfw);
  
  // 提取状态更新
  const stateUpdate = extractStateUpdate(content);
  
  // 更新 Session
  session.addParagraph(content, 'ai', null, imageUrl, imagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) {
    session.addEvent(stateUpdate.newEvent);
  }
  session.advanceProgress(3 + Math.random() * 2);
  
  await session.save();
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%, hasImage=${!!imageUrl}`);
  
  return {
    content,
    imageUrl,
    imagePrompt,
    progress: session.progress,
    state: session.state,
    isEnding: session.status === 'completed',
  };
}

/**
 * 用户输入推进故事
 */
async function inputStory(sessionId, userInput) {
  const session = await StorySession.findById(sessionId);
  if (!session) {
    throw new Error('故事不存在');
  }
  
  if (session.status !== 'active') {
    throw new Error('故事已结束');
  }
  
  const agent = await Agent.findById(session.agentId);
  if (!agent) {
    throw new Error('角色不存在');
  }
  
  // 构建 Prompt
  const systemPrompt = buildSystemPrompt(agent, session);
  const userPrompt = buildUserInputPrompt(session, userInput);
  
  // 调用 AI 生成文字+图片描述
  const rawResponse = await generateContent(systemPrompt, userPrompt, agent.modelName || 'grok-3-fast');
  
  // 解析响应
  const { content, imagePrompt } = parseAIResponse(rawResponse);
  
  // 判断是否是 NSFW 阶段
  const isNsfw = session.progress >= 60;
  
  // 生成图片
  const imageUrl = await generateImage(imagePrompt, agent, isNsfw);
  
  // 提取状态更新
  const stateUpdate = extractStateUpdate(content);
  
  // 更新 Session
  session.addParagraph(content, 'user_input', userInput, imageUrl, imagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) {
    session.addEvent(stateUpdate.newEvent);
  }
  session.advanceProgress(2 + Math.random() * 3);
  
  await session.save();
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, userInput="${userInput.slice(0, 20)}...", progress=${session.progress}%, hasImage=${!!imageUrl}`);
  
  return {
    content,
    imageUrl,
    imagePrompt,
    progress: session.progress,
    state: session.state,
    isEnding: session.status === 'completed',
  };
}

/**
 * 获取故事状态
 */
async function getStoryState(sessionId) {
  const session = await StorySession.findById(sessionId)
    .populate('agentId', 'name avatarUrls storyConfig');
    
  if (!session) {
    throw new Error('故事不存在');
  }
  
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

/**
 * 重新开始故事
 */
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
};
