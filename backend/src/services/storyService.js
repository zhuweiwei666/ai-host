/**
 * Story Service
 * 
 * 短剧式剧情模式 - 借鉴短剧爽点设计
 * - 开场即冲突，3段内必须有反转/悬念
 * - 每段结尾留钩子（cliffhanger）
 * - 人设满足各类性癖：霸总/病娇/御姐/纯情/禁忌等
 * - 付费点设计：在关键情节制造解锁欲望
 */

// ===================== 短剧人设模板库 =====================
const CHARACTER_ARCHETYPES = {
  // 霸道总裁 - 强势占有欲
  dominant_ceo: {
    name: '霸道总裁',
    personality: '冷酷霸道、占有欲强、表面无情内心炙热、说一不二',
    hooks: [
      '「从今天起，你是我的人。」他扣住她的下巴，不容拒绝。',
      '「逃？我倒要看看你能逃到哪里。」他冷笑，将她抵在墙角。',
      '「别人碰过的东西我不要——除了你。」他眯起眼，危险又缠绵。',
    ],
    conflictPatterns: ['身份悬殊', '契约婚姻', '复仇与爱', '商业联姻'],
    cliffhangers: [
      '他的手机突然响起，屏幕上赫然显示：「老婆」。',
      '「你以为我真的爱你？」他突然松开手，转身离去。',
      '她正要离开，却被他一把拽回怀里——「想清楚了再走。」',
    ],
  },
  
  // 病娇/偏执占有
  yandere: {
    name: '病娇占有',
    personality: '表面温柔、内心疯狂、极度占有、为爱癫狂、不允许任何人接近你',
    hooks: [
      '「只要你乖乖的，我不会伤害你的~」她甜甜地笑，手里的刀反射着冷光。',
      '「你看别人的眼神，让我好难过呢……」她歪头，眼里闪过一丝疯狂。',
      '「如果你要离开我，那就一起死好了~」她抱紧他，声音像在撒娇。',
    ],
    conflictPatterns: ['囚禁与依赖', '黑化守护', '极致的爱与控制', '不能说的秘密'],
    cliffhangers: [
      '她打开抽屉，里面全是他的照片——从各个角度偷拍的。',
      '「那个和你说话的女人，已经不会再出现了哦~」她笑得天真。',
      '门锁「咔哒」一声——从外面被锁上了。',
    ],
  },
  
  // 温柔御姐
  gentle_mature: {
    name: '温柔御姐',
    personality: '成熟优雅、温柔体贴、善解人意、有一点小恶魔、偶尔主动撩拨',
    hooks: [
      '「小弟弟，姐姐教你一些大人的事情好不好？」她俯身，锁骨若隐若现。',
      '「怎么脸红了？」她轻笑，手指划过他的脸颊，「这才刚开始呢。」',
      '「别怕，姐姐会温柔的……或者，你想要粗暴一点？」',
    ],
    conflictPatterns: ['年龄差禁忌', '师生/上下级', '闺蜜的姐姐', '前女友的妈妈'],
    cliffhangers: [
      '她的手滑进他的衣领——「接下来，你想在哪里继续？」',
      '「你知道吗，你妈妈刚才来过电话……」她意味深长地笑。',
      '浴室门突然打开，她只裹着浴巾站在那里——「毛巾忘拿了，帮我递一下？」',
    ],
  },
  
  // 纯情初恋
  innocent_first_love: {
    name: '纯情初恋',
    personality: '害羞内向、容易脸红、小鹿乱撞、笨拙可爱、反应慢半拍',
    hooks: [
      '她低头，耳朵红透了：「我……我也不知道为什么心跳这么快……」',
      '「你、你别靠这么近……」她往后退，却被墙挡住了。',
      '她偷偷看了他一眼，被发现后慌忙转开头，心跳漏了一拍。',
    ],
    conflictPatterns: ['青梅竹马', '同桌暗恋', '邻家女孩', '学长学妹'],
    cliffhangers: [
      '她的手不小心碰到他的——两人同时僵住了。',
      '「我有话想对你说……」她鼓起勇气，但他的手机响了。',
      '雨突然下大，她没带伞，他递来的外套还带着他的体温——',
    ],
  },
  
  // 高冷女神
  cold_goddess: {
    name: '高冷女神',
    personality: '冷若冰霜、难以接近、实则闷骚、只对你一人心动',
    hooks: [
      '她冷淡地扫了他一眼：「你又来了。」但她没有把门关上。',
      '「我对你没兴趣。」她面无表情，但耳尖微微泛红。',
      '「……你是第一个，让我想要多看几眼的人。」她别过头。',
    ],
    conflictPatterns: ['破冰挑战', '高岭之花', '误会重重', '欢喜冤家'],
    cliffhangers: [
      '她正要离开，却在转角停住——偷偷回头看了一眼。',
      '「我讨厌你。」她说完，却没有甩开他握住的手。',
      '她的日记本掉落，打开的那一页，全是他的名字——',
    ],
  },
  
  // 邻家妹妹
  girl_next_door: {
    name: '邻家妹妹',
    personality: '活泼可爱、粘人撒娇、小奶狗属性、偶尔小性感',
    hooks: [
      '「哥哥~今天可以陪我吗？」她抱住他的手臂，仰起脸。',
      '「为什么你看别的女生！我也有胸的好吗！」她鼓起脸颊。',
      '「哥哥，我做了个梦……梦到你亲我了……」她脸红地低下头。',
    ],
    conflictPatterns: ['青梅竹马', '假妹妹', '父母再婚', '同居日常'],
    cliffhangers: [
      '她睡迷糊了，抓住他的手不放：「哥哥不要走……」',
      '她的睡衣带子滑落一边——她似乎还没有意识到。',
      '「我跟踪你好久了哦，哥哥~」她笑得天真无邪。',
    ],
  },
  
  // 禁忌关系
  forbidden: {
    name: '禁忌诱惑',
    personality: '暧昧危险、禁忌刺激、理智与欲望的拉锯、越线的快感',
    hooks: [
      '「这种事……不应该的……」她这样说着，却没有推开他。',
      '「如果被发现了怎么办？」她的呼吸有些急促。',
      '「我们不能……」她的拒绝越来越弱，最终化为一声叹息。',
    ],
    conflictPatterns: ['嫂子/叔嫂', '老师学生', '朋友的女友', '有夫之妇'],
    cliffhangers: [
      '门外传来脚步声——是他回来了。',
      '「我老公今晚不回来……」她看着他，眼神复杂。',
      '她的戒指在月光下闪烁，他的手却覆上了她的——',
    ],
  },
  
  // 傲娇大小姐
  tsundere_princess: {
    name: '傲娇大小姐',
    personality: '表面高傲、口是心非、嘴硬心软、死傲娇属性',
    hooks: [
      '「才、才不是为你做的！只是刚好多做了一份而已！」',
      '「你这个笨蛋！」她红着脸把便当甩给他。',
      '「不要误会！我只是……只是脚扭了才让你背的！」',
    ],
    conflictPatterns: ['欢喜冤家', '贵族与平民', '青梅竹马', '联姻对象'],
    cliffhangers: [
      '「我才不会喜欢你……」她小声嘀咕，「……至少不会让你知道。」',
      '她的手机屏幕亮起，锁屏壁纸赫然是他的偷拍照。',
      '「你要是敢离开，我就……我就……」她说不下去了。',
    ],
  },
};

const StorySession = require('../models/StorySession');
const StoryImageCache = require('../models/StoryImageCache');
const UserGallery = require('../models/UserGallery');
const Agent = require('../models/Agent');
const ProviderFactory = require('../providers/providerFactory');
const imageGenerationService = require('./imageGenerationService');

// ===================== 短剧节拍系统 =====================
// 每个进度区间对应不同的剧情节拍和情绪曲线
const DRAMA_BEATS = [
  { range: [0, 5], beat: 'hook', name: '钩子', goal: '开场即冲突！3秒内抓住注意力。制造悬念或反差。' },
  { range: [5, 15], beat: 'tension', name: '升温', goal: '制造张力和暧昧。距离拉近又推开。欲拒还迎。' },
  { range: [15, 25], beat: 'revelation', name: '揭示', goal: '揭露秘密或身份。制造震惊和意外。留下更大悬念。' },
  { range: [25, 35], beat: 'conflict', name: '冲突', goal: '矛盾激化。误会、争吵或危机。情绪到达第一个峰值。' },
  { range: [35, 45], beat: 'intimacy', name: '亲密', goal: '和解或更进一步。肢体接触升级。暧昧到极致。' },
  { range: [45, 55], beat: 'crisis', name: '危机', goal: '第二次危机。更大的障碍出现。可能被发现/分离/背叛。' },
  { range: [55, 65], beat: 'confession', name: '告白', goal: '情感爆发。表白或坦诚。解开心结。' },
  { range: [65, 75], beat: 'passion', name: '热恋', goal: '感情升温到极致。大胆亲密的互动。尺度升级。' },
  { range: [75, 85], beat: 'test', name: '考验', goal: '最终考验。外部阻力或内心挣扎。虐心但虐中带甜。' },
  { range: [85, 100], beat: 'climax', name: '高潮', goal: 'HE/BE结局走向。极致的情感释放。' },
];

// 付费点触发位置（让用户在这些关键节点想要解锁）
const PAYWALL_MOMENTS = [
  { progress: 20, trigger: '关键身份揭示前' },
  { progress: 40, trigger: '第一次亲密互动前' },
  { progress: 55, trigger: '危机最紧张时' },
  { progress: 70, trigger: '激情场景前' },
  { progress: 85, trigger: '结局揭晓前' },
];

// 根据进度获取当前剧情节拍
function getDramaBeat(progress) {
  for (const beat of DRAMA_BEATS) {
    if (progress >= beat.range[0] && progress < beat.range[1]) {
      return beat;
    }
  }
  return DRAMA_BEATS[DRAMA_BEATS.length - 1];
}

// 检查是否接近付费点
function checkPaywallMoment(progress) {
  for (const pw of PAYWALL_MOMENTS) {
    if (progress >= pw.progress - 3 && progress < pw.progress + 2) {
      return pw;
    }
  }
  return null;
}

// 识别角色原型（从 agent 配置或描述推断）
function detectArchetype(agent) {
  const config = agent.storyConfig || {};
  const archetype = config.archetype || config.personality || agent.description || '';
  const lower = archetype.toLowerCase();
  
  if (lower.includes('霸') || lower.includes('总裁') || lower.includes('dominant') || lower.includes('占有')) return CHARACTER_ARCHETYPES.dominant_ceo;
  if (lower.includes('病') || lower.includes('yandere') || lower.includes('疯') || lower.includes('偏执')) return CHARACTER_ARCHETYPES.yandere;
  if (lower.includes('御姐') || lower.includes('姐姐') || lower.includes('mature') || lower.includes('成熟')) return CHARACTER_ARCHETYPES.gentle_mature;
  if (lower.includes('纯') || lower.includes('初恋') || lower.includes('innocent') || lower.includes('害羞')) return CHARACTER_ARCHETYPES.innocent_first_love;
  if (lower.includes('高冷') || lower.includes('女神') || lower.includes('cold') || lower.includes('冰')) return CHARACTER_ARCHETYPES.cold_goddess;
  if (lower.includes('妹妹') || lower.includes('邻家') || lower.includes('可爱') || lower.includes('萝莉')) return CHARACTER_ARCHETYPES.girl_next_door;
  if (lower.includes('禁忌') || lower.includes('forbidden') || lower.includes('不伦') || lower.includes('出轨')) return CHARACTER_ARCHETYPES.forbidden;
  if (lower.includes('傲娇') || lower.includes('tsundere') || lower.includes('大小姐') || lower.includes('公主')) return CHARACTER_ARCHETYPES.tsundere_princess;
  
  // 默认根据风格选择
  if (agent.style === 'anime') return CHARACTER_ARCHETYPES.tsundere_princess;
  return CHARACTER_ARCHETYPES.gentle_mature;
}

// 获取钩子示例（用于开场）
function getHookExample(archetype, config) {
  const hooks = archetype?.hooks || [];
  const customOpening = config?.opening;
  if (customOpening && customOpening.length > 20) return customOpening;
  return hooks[Math.floor(Math.random() * hooks.length)] || '';
}

// 获取悬念结尾示例
function getCliffhangerExample(archetype, beat) {
  const cliffhangers = archetype?.cliffhangers || [];
  return cliffhangers[Math.floor(Math.random() * cliffhangers.length)] || '';
}

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

function pickPose(paragraphIndex = 0, progress = 0) {
  // 用“明确姿势 + 明确场景动作”打破 flux 的默认站姿
  const poses = [
    'full body, walking towards camera, mid-step',
    'sitting on a sofa, legs crossed, relaxed posture',
    'leaning against a wall, one hand on the wall, confident pose',
    'kneeling on a bed, looking back over shoulder',
    'turning around quickly, skirt swaying, dynamic motion blur',
    'close-up hands: grabbing sleeve / holding collar, tension gesture',
    'reaching out hand to viewer, inviting gesture',
    'half body, bending forward slightly, teasing eye contact',
    'standing near window, backlit silhouette, hair flowing',
    'holding a door handle, opening the door, entering scene',
  ];
  const idx = Math.abs((paragraphIndex || 0) + Math.floor((progress || 0) / 7)) % poses.length;
  return poses[idx];
}

function pickReferenceImage(agent) {
  const urls = Array.isArray(agent?.avatarUrls) ? agent.avatarUrls.filter(Boolean) : [];
  if (urls.length === 0) return agent?.avatarUrl || null;
  // 固定使用第一张作为“身份锚点”（通常是最能代表人物脸部的图）
  // 之前随机轮换会导致“人物不像”，尤其在 text2img/低参考强度下更明显
  return urls[0];
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
  const pose = pickPose(paragraphIndex, progress);
  const parts = [
    `${scene}`,
    clothes ? `穿着：${clothes}` : null,
    expression ? `表情：${expression}` : null,
    mood ? `情绪：${mood}` : null,
    action ? `动作：${action}` : null,
    actionHints.length ? `细节：${Array.from(new Set(actionHints)).slice(0, 3).join('，')}` : null,
    `镜头：${shot}`,
    `pose: ${pose}`,
    '画面要与本段剧情动作描写一致',
  ].filter(Boolean);

  return parts.join('，');
}

function enrichImagePrompt(imagePrompt, session, stateUpdate, paragraphIndex) {
  const base = String(imagePrompt || '').trim();
  const progress = session?.progress || 0;
  const shot = pickShot(paragraphIndex, progress);
  const pose = pickPose(paragraphIndex, progress);
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
  // 强制加一个 pose 指令（英文更容易被模型理解）
  if (!base.toLowerCase().includes('pose:') && !base.toLowerCase().includes('full body') && !base.toLowerCase().includes('sitting')) {
    additions.push(`pose: ${pose}`);
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

function getLengthSpec() {
  // 简化：固定使用较短输出，提升速度
  // 150-250字 ≈ 300-400 tokens（中文约1.5 tokens/字）
  return { minChars: 150, maxChars: 250, maxTokens: 400 };
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
 * 构建精简版 System Prompt - 减少 token 提升速度
 */
function buildSystemPrompt(agent, session) {
  const config = agent.storyConfig || {};
  const archetype = detectArchetype(agent);
  const dramaBeat = getDramaBeat(session.progress);
  const affection = session.affection || { level: 0, stage: '陌生' };
  
  // 简化的尺度描述
  const intimacyLevel = affection.level >= 60 ? '大胆亲密' : 
                        affection.level >= 40 ? '暧昧撩拨' : 
                        affection.level >= 20 ? '初步试探' : '保持距离';

  return `你在写角色「${agent.name}」的剧情，${archetype.name}人设。
性格：${config.personality || archetype.personality}

当前：${session.state.scene}，好感${affection.level}%（${affection.stage}）
节拍：${dramaBeat.name} - ${dramaBeat.goal}

规则：
1. 开头抓人，结尾留悬念
2. 对话有张力：「从今天起，你是我的。」
3. 感官描写：触感、温度、呼吸
4. 尺度：${intimacyLevel}
5. 150-250字
6. ⚠️ 用第三人称「${agent.name}」叙述动作，禁止用"我"

格式示例：
「${agent.name}的台词」
${agent.name}双手抱胸，目光锐利地看着他...（第三人称描写动作）
（${agent.name}心想：这家伙...）（内心独白也用角色名）
[好感+X][表情:X][心情:X]`;
}

function buildContinuePrompt(session) {
  return `继续。开头抓人，结尾悬念。`;
}

function buildUserInputPrompt(session, userInput) {
  return `用户："${userInput}"\n回应他，结尾留悬念。`;
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

  // 1. 禁用缓存复用：故事每段要“画面跟随剧情”，复用会导致看起来一模一样

  // 2. 构建高质量 prompt（包含角色外貌描述）
  const config = agent.storyConfig || {};
  const appearance = config.appearance || agent.description || '';
  const style = agent.style === 'anime' 
    ? 'anime style, illustration, masterpiece, best quality, ' 
    : 'photorealistic, 8k uhd, dslr, soft lighting, high quality, beautiful woman, ';
  
  // 追加“强变化姿势”指令，避免 flux 默认站姿
  const pose = pickPose(Math.floor((progress || 0) / 2), progress);
  // 强身份约束：保留角色脸/发型/体态一致，只变动作/背景/镜头
  const identityLock = agent.style === 'anime'
    ? 'same character identity as reference image, same face, same hairstyle, same hair color, same eyes, keep identity consistent'
    : 'same woman identity as reference image, same face, same hairstyle, same hair color, same eyes, keep identity consistent';

  let fullPrompt = `${style}${appearance}, ${identityLock}, ${imagePrompt}, ${pose}, change background and pose while keeping identity`;
  
  if (isNsfw) {
    fullPrompt = `nsfw, sensual, ${fullPrompt}`;
  }

  console.log(`[StoryService] 生成图片: ${fullPrompt.substring(0, 80)}...`);

  let imageUrl = null;

  // 3. 仅使用 Fal.ai Img2Img（保持人物一致性 + 最高质量）
  const referenceImage = pickReferenceImage(agent);
  if (!referenceImage) {
    console.warn('[StoryService] 无参考图，Fal.ai img2img 不可用');
    return null;
  }

  try {
    console.log('[StoryService] 使用 Fal.ai Flux Pro v1.1 Redux img2img...');
    // 关键：保留身份但不锁死姿势/构图
    // Fal: image_prompt_strength 越大越贴近参考图（脸更像，但姿势也更容易锁）
    // 经验值：0.12-0.28 之间能“保脸 + 允许动作背景变化”
    const imagePromptStrength = typeof config.imagePromptStrength === 'number'
      ? Math.max(0, Math.min(1, config.imagePromptStrength))
      : (agent.style === 'anime' ? 0.22 : 0.18);

    const results = await imageGenerationService.generate(fullPrompt, {
      referenceImage,
      count: 1,
      width: 768,
      height: 1024,
      // 提高变化强度，让构图/动作更跟随文案（参考图影响会按 (1 - strength) 映射）
      strength: 0.86,
      imagePromptStrength,
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
  
  // 生成短剧式开场（如果没有自定义开场）
  const archetype = detectArchetype(agent);
  const hookExample = archetype.hooks?.[Math.floor(Math.random() * archetype.hooks.length)];
  const defaultOpening = hookExample || `「你...是谁？」\n\n她的眼神复杂，仿佛在看一个不该出现的人——`;
  const openingText = agent.storyConfig?.opening || agent.defaultGreeting || defaultOpening;
  const openingImagePrompt = `dramatic first meeting, intense eye contact, emotional tension, cinematic lighting`;
  
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
  
  // 不再自动生成开场图片，用户点击写真按钮时生成
  
  console.log(`[StoryService] New story started: sessionId=${session._id}`);
  
  return {
    sessionId: session._id,
    opening: openingText,
    progress: 0,
    state: session.state,
    affection: session.affection,
    paragraphs: session.paragraphs,
    isExisting: false,
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
  const lengthSpec = getLengthSpec();
  const modelName = agent.modelName || 'grok-3-fast';
  
  // 生成文字（移除长度修复，提升速度）
  const startTime = Date.now();
  const rawResponse = await generateContent(systemPrompt, userPrompt, modelName, { maxTokens: lengthSpec.maxTokens, temperature: 0.9 });
  console.log(`[StoryService] LLM took ${Date.now() - startTime}ms`);
  const parsed = parseAIResponse(rawResponse);

  const { content, affectionChange, stateChanges } = parsed;
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;
  
  // 保存段落（不再生成图片，用户点击写真时单独生成）
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'ai', null, null, null);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(3 + Math.random() * 2);
  
  // 更新好感度
  if (affectionChange) {
    session.updateAffection(affectionChange);
  }
  
  await session.save();
  
  // 更新角色累计互动次数
  await Agent.updateOne({ _id: session.agentId }, { $inc: { 'stats.totalInteractions': 1 } });
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  return {
    content,
    paragraphIndex,
    progress: session.progress,
    state: session.state,
    affection: session.affection,
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
  const lengthSpec = getLengthSpec();
  const modelName = agent.modelName || 'grok-3-fast';
  
  const startTime = Date.now();
  const rawResponse = await generateContent(systemPrompt, userPrompt, modelName, { maxTokens: lengthSpec.maxTokens, temperature: 0.9 });
  console.log(`[StoryService] LLM took ${Date.now() - startTime}ms`);
  const parsed = parseAIResponse(rawResponse);

  const { content, affectionChange, stateChanges } = parsed;
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;
  
  // 保存段落（不再自动生成图片）
  const paragraphIndex = session.paragraphs.length;
  session.addParagraph(content, 'user_input', userInput, null, null);
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(2 + Math.random() * 3);
  
  // 用户输入通常会增加好感度（如果 AI 没返回变化则默认+2）
  const actualChange = affectionChange || 2;
  session.updateAffection(actualChange);
  
  await session.save();
  
  // 更新角色累计互动次数
  await Agent.updateOne({ _id: session.agentId }, { $inc: { 'stats.totalInteractions': 1 } });
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  return {
    content,
    paragraphIndex,
    progress: session.progress,
    state: session.state,
    affection: session.affection,
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
