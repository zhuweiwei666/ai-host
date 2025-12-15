/**
 * Story Service
 * 
 * 论坛式剧情模式的核心服务
 * - Prompt 构建
 * - 状态管理
 * - AI 调用
 */

const StorySession = require('../models/StorySession');
const Agent = require('../models/Agent');
const axios = require('axios');

// AI API 配置
const AI_API_URL = process.env.XAI_API_URL || 'https://api.x.ai/v1/chat/completions';
const AI_API_KEY = process.env.XAI_API_KEY;

/**
 * 获取当前应该使用的故事节拍
 */
function getCurrentBeat(storyBeats, progress) {
  if (!storyBeats || storyBeats.length === 0) {
    // 默认节拍
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
  
  // 如果超出所有节拍，使用最后一个
  return storyBeats[storyBeats.length - 1];
}

/**
 * 构建 System Prompt
 */
function buildSystemPrompt(agent, session) {
  const config = agent.storyConfig || {};
  const currentBeat = getCurrentBeat(config.storyBeats, session.progress);
  
  // 尺度描述
  const ratingGuide = {
    mild: '保持暧昧和浪漫，不要有过于露骨的描写',
    moderate: '可以有情色暗示和挑逗，但不要过于直白',
    explicit: '可以有详细的情色描写，但保持文学性'
  };
  
  const prompt = `你是一个专业的情色小说作者，正在以第一人称视角创作一个沉浸式故事。

## 角色设定
名字：${agent.name}
性格：${config.personality || agent.description || '温柔体贴'}
外貌：${config.appearance || '美丽动人'}
背景：${config.backstory || '神秘的邂逅'}

## 当前状态（必须严格遵守）
- 场景：${session.state.scene}
- 时间：${session.state.time}
- 氛围：${session.state.mood}
- 她的穿着：${session.state.clothes || '日常装扮'}
- 剧情进度：${session.progress}%
- 已发生事件：${session.events.length > 0 ? session.events.join('、') : '故事刚刚开始'}

## 上一段结尾（必须自然承接）
${session.state.lastAction || '故事即将开始...'}

## 当前目标
${currentBeat.goal || '自然发展剧情'}
${currentBeat.sceneHint ? `场景提示：${currentBeat.sceneHint}` : ''}
${currentBeat.moodHint ? `氛围提示：${currentBeat.moodHint}` : ''}

## 输出规则
1. 字数：${config.paragraphLength?.min || 200}-${config.paragraphLength?.max || 500}字
2. 视角：第一人称（"我"）
3. 必须自然承接上一段结尾，禁止重复已写内容
4. 保持人物性格、外貌、穿着一致
5. 段落结尾留悬念或动作中断，吸引继续阅读
6. 根据进度控制尺度：
   - 0-30%：暧昧期（言语试探、眼神交流、初次接触）
   - 30-60%：升温期（肢体接触、气氛暧昧、情感升温）
   - 60-90%：高潮期（${ratingGuide[config.contentRating || 'moderate']}）
   - 90-100%：收尾期（余韵、温馨）

## 禁止事项
- 禁止使用"你"作为主语，改用第一人称"我"
- 禁止总结或旁白解释
- 禁止在结尾提问或征求意见
- 禁止跳跃式推进剧情
- 禁止重复之前已经写过的内容`;

  return prompt;
}

/**
 * 构建继续剧情的 User Prompt
 */
function buildContinuePrompt(session) {
  return `继续故事。当前进度 ${session.progress}%，自然过渡到下一个场景/动作。直接输出故事内容，不要有任何前缀或解释。`;
}

/**
 * 构建响应用户输入的 User Prompt
 */
function buildUserInputPrompt(session, userInput) {
  return `用户（"我"）说/做了以下内容：
"${userInput}"

请根据用户的行为，以 ${session.state.scene} 的场景为背景，让故事自然发展。直接输出故事内容，不要有任何前缀或解释。`;
}

/**
 * 调用 AI 生成内容
 */
async function generateContent(systemPrompt, userPrompt, model = 'grok-4-1-fast-reasoning') {
  try {
    const response = await axios.post(
      AI_API_URL,
      {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000,
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('[StoryService] AI generation failed:', error.message);
    throw new Error('AI 生成失败，请稍后重试');
  }
}

/**
 * 提取状态更新（使用 AI）
 */
async function extractStateUpdate(content) {
  try {
    const response = await axios.post(
      AI_API_URL,
      {
        model: 'grok-3-mini-fast',
        messages: [
          {
            role: 'system',
            content: '你是一个JSON提取器。根据给定的故事段落，提取状态变化。只输出JSON，不要其他内容。'
          },
          {
            role: 'user',
            content: `根据以下段落，提取状态变化，只输出 JSON：

段落内容：
${content}

输出格式（只输出变化的字段，没有变化的设为null）：
{
  "scene": "新场景或null",
  "mood": "新氛围或null", 
  "clothes": "新穿着描述或null",
  "newEvent": "新发生的关键事件或null",
  "lastAction": "本段最后一句话（必填）"
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      },
      {
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    
    const text = response.data.choices[0].message.content;
    // 尝试解析 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { lastAction: content.slice(-50) };
  } catch (error) {
    console.error('[StoryService] State extraction failed:', error.message);
    // 降级：只提取最后一句话
    return { lastAction: content.slice(-50) };
  }
}

/**
 * 开始新故事
 */
async function startStory(userId, agentId) {
  // 获取角色信息
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('角色不存在');
  }
  
  // 检查是否已有活跃的故事
  let session = await StorySession.findOne({
    userId,
    agentId,
    status: 'active'
  });
  
  if (session) {
    // 返回现有故事
    return {
      sessionId: session._id,
      opening: session.paragraphs[0]?.content || agent.storyConfig?.opening || agent.defaultGreeting,
      progress: session.progress,
      state: session.state,
      paragraphs: session.paragraphs,
      isExisting: true,
    };
  }
  
  // 创建新故事
  const opening = agent.storyConfig?.opening || agent.defaultGreeting || `${agent.name}的故事即将开始...`;
  
  session = new StorySession({
    userId,
    agentId,
    progress: 0,
    state: {
      scene: '初始场景',
      time: '傍晚',
      mood: '平静',
      clothes: '',
      lastAction: opening.slice(-100),
    },
    events: [],
    paragraphs: [{
      content: opening,
      source: 'ai',
      createdAt: new Date(),
    }],
    totalParagraphs: 1,
  });
  
  await session.save();
  
  console.log(`[StoryService] New story started: userId=${userId}, agentId=${agentId}, sessionId=${session._id}`);
  
  return {
    sessionId: session._id,
    opening,
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
  
  // 调用 AI
  const content = await generateContent(systemPrompt, userPrompt, agent.modelName);
  
  // 提取状态更新
  const stateUpdate = await extractStateUpdate(content);
  
  // 更新 Session
  session.addParagraph(content, 'ai');
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) {
    session.addEvent(stateUpdate.newEvent);
  }
  session.advanceProgress(3 + Math.random() * 2); // 每次推进 3-5%
  
  await session.save();
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%`);
  
  return {
    content,
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
  
  // 调用 AI
  const content = await generateContent(systemPrompt, userPrompt, agent.modelName);
  
  // 提取状态更新
  const stateUpdate = await extractStateUpdate(content);
  
  // 更新 Session
  session.addParagraph(content, 'user_input', userInput);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) {
    session.addEvent(stateUpdate.newEvent);
  }
  session.advanceProgress(2 + Math.random() * 3); // 用户输入推进 2-5%
  
  await session.save();
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, userInput="${userInput.slice(0, 20)}...", progress=${session.progress}%`);
  
  return {
    content,
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
  // 将现有故事标记为废弃
  await StorySession.updateMany(
    { userId, agentId, status: 'active' },
    { status: 'abandoned' }
  );
  
  // 开始新故事
  return startStory(userId, agentId);
}

module.exports = {
  startStory,
  continueStory,
  inputStory,
  getStoryState,
  restartStory,
};
