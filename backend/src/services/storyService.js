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
const UserGallery = require('../models/UserGallery');
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

function getRecentImagePrompts(session, n = 3) {
  const out = [];
  const paras = session?.paragraphs || [];
  for (let i = paras.length - 1; i >= 0 && out.length < n; i--) {
    const p = paras[i]?.imagePrompt;
    if (p && typeof p === 'string' && p.trim()) out.push(p.trim());
  }
  return out;
}

function normalizePrompt(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。,\.!！\?？;；:：、\[\]\(\)（）"“”'‘’]/g, '');
}

function isPromptTooSimilar(prompt, recentPrompts) {
  const p = normalizePrompt(prompt);
  if (!p) return true;
  for (const r of recentPrompts || []) {
    const rr = normalizePrompt(r);
    if (!rr) continue;
    if (p === rr) return true;
    // 包含关系且长度接近，视为重复
    const minLen = Math.min(p.length, rr.length);
    const maxLen = Math.max(p.length, rr.length);
    if (minLen > 0 && maxLen > 0) {
      if ((p.includes(rr) || rr.includes(p)) && minLen / maxLen > 0.7) return true;
    }
  }
  return false;
}

function pickShot(paragraphIndex = 0, progress = 0) {
  // 用镜头变化减少“动作同质化”
  const shots = [
    '半身近景，微微俯拍',
    '正面特写，浅景深',
    '侧脸特写，光影对比',
    '全身中景，环境入镜',
    '肩上视角（从他肩后看她）',
    '手部特写（手势/动作细节）',
  ];
  const idx = Math.abs((paragraphIndex || 0) + Math.floor((progress || 0) / 10)) % shots.length;
  return shots[idx];
}

function buildHeuristicImagePrompt(content, baseState, stateUpdate, paragraphIndex, progress) {
  const scene = stateUpdate?.scene || baseState?.scene || '室内';
  const mood = stateUpdate?.mood || baseState?.mood || '';
  const clothes = stateUpdate?.clothes || baseState?.clothes || '';
  const expression = stateUpdate?.expression || baseState?.expression || '';
  const action = stateUpdate?.action || baseState?.action || '';

  // 从正文里捞一些动作/姿态关键词（非常轻量，不依赖模型）
  const text = String(content || '');
  const actionHints = [];
  const hintWords = ['靠近', '后退', '回眸', '低头', '抬眼', '咬唇', '撩发', '伸手', '抱臂', '俯身', '转身', '轻笑', '眨眼', '侧过头', '贴近'];
  for (const w of hintWords) {
    if (text.includes(w)) actionHints.push(w);
  }

  const shot = pickShot(paragraphIndex, progress);
  const parts = [
    `${scene}`,
    clothes ? `穿着：${clothes}` : null,
    expression ? `表情：${expression}` : null,
    mood ? `情绪：${mood}` : null,
    action ? `动作：${action}` : null,
    actionHints.length ? `细节：${Array.from(new Set(actionHints)).slice(0, 3).join('，')}` : null,
    `镜头：${shot}`,
    '画面要与本段剧情动作描写一致',
  ].filter(Boolean);

  return parts.join('，');
}

function enrichImagePrompt(imagePrompt, session, stateUpdate, paragraphIndex) {
  const base = String(imagePrompt || '').trim();
  const progress = session?.progress || 0;
  const shot = pickShot(paragraphIndex, progress);
  const scene = stateUpdate?.scene || session?.state?.scene;
  const mood = stateUpdate?.mood || session?.state?.mood;
  const clothes = stateUpdate?.clothes || session?.state?.clothes;
  const expression = stateUpdate?.expression || session?.state?.expression;
  const action = stateUpdate?.action || session?.state?.action;

  const additions = [];
  if (scene && !base.includes(scene)) additions.push(`场景：${scene}`);
  if (clothes && !base.includes(clothes)) additions.push(`穿着：${clothes}`);
  if (expression && !base.includes(expression)) additions.push(`表情：${expression}`);
  if (mood && !base.includes(mood)) additions.push(`情绪：${mood}`);
  if (action && !base.includes(action)) additions.push(`动作：${action}`);
  if (!base.includes('镜头') && !base.includes('特写') && !base.includes('全身') && !base.includes('近景')) {
    additions.push(`镜头：${shot}`);
  }
  additions.push('避免与上一张画面重复，换角度/构图/姿势');

  return [base, additions.join('，')].filter(Boolean).join('，');
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

function estimateMaxTokensFromChars(maxChars) {
  // 中文 + 标点通常接近 1-2 tokens/字符；这里取偏保守的系数，避免被 max_tokens 卡断
  const est = Math.ceil((maxChars || 400) * 1.8);
  return Math.max(200, Math.min(1200, est));
}

function getLengthSpec(agent, session) {
  const config = agent.storyConfig || {};
  const outputLength = config.outputLength || {};
  const ranges = Array.isArray(outputLength.ranges) ? outputLength.ranges : [];

  for (const r of ranges) {
    const [minP, maxP] = r.progressRange || [0, 101];
    if (session.progress >= minP && session.progress < maxP) {
      const minChars = Number(r.minChars) || 320;
      const maxChars = Number(r.maxChars) || 520;
      return {
        minChars,
        maxChars,
        maxTokens: Number(r.maxTokens) || estimateMaxTokensFromChars(maxChars),
      };
    }
  }

  // 默认：尽量贴近市面“单次生成一大段”的体验
  if (session.progress < 20) {
    return { minChars: 220, maxChars: 420, maxTokens: estimateMaxTokensFromChars(420) };
  }
  if (session.progress < 60) {
    return { minChars: 320, maxChars: 560, maxTokens: estimateMaxTokensFromChars(560) };
  }
  return { minChars: 420, maxChars: 700, maxTokens: estimateMaxTokensFromChars(700) };
}

function estimateContentLength(text) {
  if (!text) return 0;
  // 不把空白算进“字数”，更贴近用户体感
  return String(text).replace(/\s+/g, '').length;
}

function buildLengthRepairPrompt(rawResponse, lengthSpec) {
  return `把下面这段内容改写为 ${lengthSpec.minChars}-${lengthSpec.maxChars} 字（不含标签），保持剧情一致、保持输出格式完全不变。
不要解释，不要加标题，不要追加额外段落，只输出改写后的完整内容（仍需包含 [好感±X]、状态变化、[IMG: ...]）。

原文开始：
${rawResponse}
原文结束。`;
}

/**
 * 构建论坛帖子风格的 System Prompt
 */
function buildSystemPrompt(agent, session) {
  const config = agent.storyConfig || {};
  const currentBeat = getCurrentBeat(config.storyBeats, session.progress);
  const affection = session.affection || { level: 0, stage: '陌生' };
  const lengthSpec = getLengthSpec(agent, session);
  const recentImg = getRecentImagePrompts(session, 3);
  
  const ratingGuide = {
    mild: '暧昧暗示',
    moderate: '情色挑逗',
    explicit: '露骨描写'
  };
  
  return `你正在讲述一个互动故事。每次只输出一段内容（建议 ${lengthSpec.minChars}-${lengthSpec.maxChars} 字，不含标签）。

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
${currentBeat.sceneHint ? `- 场景提示：${currentBeat.sceneHint}` : ''}
${currentBeat.moodHint ? `- 情绪提示：${currentBeat.moodHint}` : ''}

## 输出格式【必须严格遵守】
每次回复必须包含以下部分，用换行分隔：

1. 角色对话：用「」包裹角色说的话
2. 动作描写：用普通文字描述角色动作和场景
3. 内心独白：用（）包裹角色心理活动
4. 好感变化：[好感+X] 或 [好感-X]，X是1-10的数字
5. 状态变化：[表情:XXX] [动作:XXX] [心情:XXX]
6. 图片标签：[IMG: 画面描述]

## 图片标签规则（非常重要）
- [IMG] 必须与本段“动作描写”严格一致，画面里要体现：场景/人物动作/表情/情绪/镜头
- 禁止每次都写同一个动作（如总是“歪头微笑/风吹发丝”），需要随剧情变化
- 最近 3 次图片标签（避免重复）：${recentImg.length ? recentImg.map((s, i) => `(${i + 1})${s}`).join(' ') : '无'}
- 如果你发现将要重复，请主动改变：镜头（特写/半身/全身/肩后视角/手部特写）、构图、姿势、环境元素

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
- 禁止少于${lengthSpec.minChars}字或超过${lengthSpec.maxChars}字（不含标签）
- 禁止使用"你"作为主语，用"他"指代用户`;
}

function buildContinuePrompt(session) {
  return `继续。进度 ${session.progress}%。直接输出内容+图片标签，不要解释。`;
}

function buildUserInputPrompt(session, userInput) {
  return `用户说/做了："${userInput}"
回应他。进度 ${session.progress}%。直接输出内容+图片标签。`;
}

async function generateContent(systemPrompt, userPrompt, model = 'grok-3-fast', opts = {}) {
  try {
    const provider = ProviderFactory.getProvider(model);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const temperature = typeof opts.temperature === 'number' ? opts.temperature : 0.9;
    const maxTokens = typeof opts.maxTokens === 'number' ? opts.maxTokens : 200;
    const result = await provider.chat(model, messages, temperature, { maxTokens });
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

  // 1. 尝试复用缓存的图片（降低复用概率，避免“同一动作/同一画面”）
  // 旧版本 30% 会导致连续段落频繁复用同一张
  if (Math.random() < 0.05) {
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
    // 用段落内容 + 当前状态补充图片 prompt，确保与文案情景一致且不重复
    const paragraph = session.paragraphs?.[paragraphIndex];
    const stateUpdate = session.state || {};
    const enrichedPrompt = buildHeuristicImagePrompt(paragraph?.content, session.state, stateUpdate, paragraphIndex, progress);
    const finalPrompt = imagePrompt ? `${imagePrompt}，${enrichedPrompt}` : enrichedPrompt;

    const imageUrl = await generateImageWithConsistency(finalPrompt, agent, progress);
    
    if (imageUrl && session.paragraphs[paragraphIndex]) {
      session.paragraphs[paragraphIndex].imageUrl = imageUrl;
      // 保存实际用于生图的 prompt（便于后续避免重复）
      session.paragraphs[paragraphIndex].imagePrompt = finalPrompt;
      await session.save();
      console.log(`[StoryService] 异步图片已更新: sessionId=${sessionId}, index=${paragraphIndex}`);
      
      // 保存到用户画廊
      try {
        const paragraph = session.paragraphs[paragraphIndex];
        await UserGallery.addToGallery({
          userId: session.userId,
          agentId: session.agentId,
          mediaType: 'image',
          mediaUrl: imageUrl,
          source: 'story',
          storySessionId: session._id,
          prompt: imagePrompt,
          context: paragraph.content?.slice(0, 200) || '',
          isNsfw: progress >= 60,
        });
        console.log(`[StoryService] 图片已保存到用户画廊`);
      } catch (galleryErr) {
        console.warn('[StoryService] 保存到画廊失败:', galleryErr.message);
      }
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
  const lengthSpec = getLengthSpec(agent, session);
  const modelName = agent.modelName || 'grok-3-fast';
  
  // 生成文字
  let rawResponse = await generateContent(systemPrompt, userPrompt, modelName, { maxTokens: lengthSpec.maxTokens, temperature: 0.9 });
  let parsed = parseAIResponse(rawResponse);

  // 如果字数偏离目标区间，做一次“改写对齐长度”的修复（最多一次，避免无限循环/过度扣费）
  const len = estimateContentLength(parsed.content);
  if (len < lengthSpec.minChars || len > lengthSpec.maxChars) {
    const repairPrompt = buildLengthRepairPrompt(rawResponse, lengthSpec);
    rawResponse = await generateContent(systemPrompt, repairPrompt, modelName, { maxTokens: lengthSpec.maxTokens, temperature: 0.7 });
    parsed = parseAIResponse(rawResponse);
  }

  const { content, imagePrompt, affectionChange, stateChanges } = parsed;
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;

  // 反重复 + 情景增强：如果 [IMG] 缺失或与最近几次相似，改用启发式 prompt
  const recentImg = getRecentImagePrompts(session, 3);
  let finalImagePrompt = imagePrompt ? enrichImagePrompt(imagePrompt, session, stateUpdate, session.paragraphs.length) : '';
  if (!finalImagePrompt || isPromptTooSimilar(finalImagePrompt, recentImg)) {
    finalImagePrompt = buildHeuristicImagePrompt(content, session.state, stateUpdate, session.paragraphs.length, session.progress);
  }
  
  // 先保存文字，imageUrl 为 null
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'ai', null, null, finalImagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(3 + Math.random() * 2);
  
  // 更新好感度
  if (affectionChange) {
    session.updateAffection(affectionChange);
  }
  
  await session.save();
  
  // 异步生成图片（不阻塞返回）
  if (finalImagePrompt) {
    generateImageAsync(session._id, paragraphIndex, finalImagePrompt, session.agentId);
  }
  
  // 更新角色累计互动次数
  await Agent.updateOne({ _id: session.agentId }, { $inc: { 'stats.totalInteractions': 1 } });
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  return {
    content,
    imageUrl: null, // 前端显示 loading
    imagePrompt: finalImagePrompt,
    paragraphIndex, // 用于轮询
    progress: session.progress,
    state: session.state,
    affection: session.affection, // 好感度数据
    isEnding: false, // 故事永不结束
    imageGenerating: !!finalImagePrompt, // 告诉前端是否有图片在生成
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
  const lengthSpec = getLengthSpec(agent, session);
  const modelName = agent.modelName || 'grok-3-fast';
  
  let rawResponse = await generateContent(systemPrompt, userPrompt, modelName, { maxTokens: lengthSpec.maxTokens, temperature: 0.9 });
  let parsed = parseAIResponse(rawResponse);
  const len = estimateContentLength(parsed.content);
  if (len < lengthSpec.minChars || len > lengthSpec.maxChars) {
    const repairPrompt = buildLengthRepairPrompt(rawResponse, lengthSpec);
    rawResponse = await generateContent(systemPrompt, repairPrompt, modelName, { maxTokens: lengthSpec.maxTokens, temperature: 0.7 });
    parsed = parseAIResponse(rawResponse);
  }

  const { content, imagePrompt, affectionChange, stateChanges } = parsed;
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;

  const recentImg = getRecentImagePrompts(session, 3);
  let finalImagePrompt = imagePrompt ? enrichImagePrompt(imagePrompt, session, stateUpdate, session.paragraphs.length) : '';
  if (!finalImagePrompt || isPromptTooSimilar(finalImagePrompt, recentImg)) {
    finalImagePrompt = buildHeuristicImagePrompt(content, session.state, stateUpdate, session.paragraphs.length, session.progress);
  }
  
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'user_input', userInput, null, finalImagePrompt);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(2 + Math.random() * 3);
  
  // 用户输入通常会增加好感度（如果 AI 没返回变化则默认+2）
  const actualChange = affectionChange || 2;
  session.updateAffection(actualChange);
  
  await session.save();
  
  // 异步生成图片
  if (finalImagePrompt) {
    generateImageAsync(session._id, paragraphIndex, finalImagePrompt, session.agentId);
  }
  
  // 更新角色累计互动次数
  await Agent.updateOne({ _id: session.agentId }, { $inc: { 'stats.totalInteractions': 1 } });
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  return {
    content,
    imageUrl: null,
    imagePrompt: finalImagePrompt,
    paragraphIndex,
    progress: session.progress,
    state: session.state,
    affection: session.affection, // 好感度数据
    isEnding: false, // 故事永不结束
    imageGenerating: !!finalImagePrompt,
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
      const imageUrl = results[0].url;
      console.log('[StoryService] 写真生成成功');
      
      // 保存到用户画廊
      try {
        await UserGallery.addToGallery({
          userId: session.userId,
          agentId: session.agentId,
          mediaType: 'image',
          mediaUrl: imageUrl,
          source: 'photo',
          storySessionId: session._id,
          prompt: photoPrompt,
          context: `好感度 ${affection.level}% - ${affection.stage}`,
          isNsfw: isNsfw,
        });
        console.log('[StoryService] 写真已保存到用户画廊');
      } catch (galleryErr) {
        console.warn('[StoryService] 写真保存到画廊失败:', galleryErr.message);
      }
      
      return {
        imageUrl,
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
