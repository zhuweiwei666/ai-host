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
const PromptExperiment = require('../models/PromptExperiment');
const ProviderFactory = require('../providers/providerFactory');
const crypto = require('crypto');
const imageGenerationService = require('./imageGenerationService');
const openaiImageService = require('./openaiImageService');
const walletService = require('./walletService');
let StoryAttribution;

try {
  StoryAttribution = require('../models/StoryAttribution');
} catch {
  StoryAttribution = null;
}

// ===================== 短剧节拍系统（R18_soft：强撩可，不露骨）=====================
// 前期就要有足够的性张力和暧昧钩子
const DRAMA_BEATS = [
  { range: [0, 5], beat: 'hook', name: '钩子', goal: '开场就要有身体接触或暧昧场景！她贴上来/你们靠得很近/意外触碰。制造心跳加速的瞬间。' },
  { range: [5, 15], beat: 'tension', name: '撩拨', goal: '她主动撩你：靠近、低语、若有若无的触碰。你的视线不由自主地落在她身上。欲拒还迎。' },
  { range: [15, 25], beat: 'escalate', name: '升级', goal: '更大胆的试探：她的手/唇/身体更接近。危险的距离。呼吸交缠。随时可能越界。' },
  { range: [25, 35], beat: 'tension_break', name: '中断', goal: '关键时刻被打断！有人来了/电话响了/她突然推开。留下巨大的遗憾和渴望。' },
  { range: [35, 45], beat: 'chase', name: '追逐', goal: '她若即若离地撩拨。你追她跑，或者她追你跑。猫鼠游戏。每次接近都心跳加速。' },
  { range: [45, 55], beat: 'intimacy', name: '亲密', goal: '终于独处！暧昧升级到极致。肢体接触更大胆。她的反应让你想要更多……' },
  { range: [55, 65], beat: 'confession', name: '表白', goal: '情感爆发。直接表白或用行动表达。关系确定。但新的考验即将来临。' },
  { range: [65, 75], beat: 'passion', name: '热恋', goal: '大胆的亲密互动。她变得更主动。暗示更多可能发生的事……尺度拉满但不越界。' },
  { range: [75, 85], beat: 'test', name: '考验', goal: '外部阻力或误会。虐心但虐中带甜。分开又重逢。渴望更加强烈。' },
  { range: [85, 100], beat: 'climax', name: '高潮', goal: '极致的情感释放。暗示一切水到渠成……留给想象的空间。' },
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
 * 清理会话状态，移除内部字段并处理 iOS 解析不兼容的对象
 */
function sanitizeSessionState(state) {
  if (!state) return state;
  const s = state.toObject ? state.toObject() : JSON.parse(JSON.stringify(state));

  // 1. 处理 pay.pending: 如果是空对象，设为 null（iOS Decodable 友好）
  if (s.pay && s.pay.pending && Object.keys(s.pay.pending).length === 0) {
    s.pay.pending = null;
  }

  // 1.1 处理 objective: 如果没有 title，设为 null
  if (s.objective && !s.objective.title) {
    s.objective = null;
  }

  // 2. 清理 locationHistory: 移除 _id
  if (Array.isArray(s.locationHistory)) {
    s.locationHistory = s.locationHistory.map((h) => {
      const { _id, ...rest } = h;
      return rest;
    });
  }

  // 3. 移除其它对客户端无用的海量上下文内部字段，保持 state 精简
  // 这些字段主要用于后端生成，返回给客户端可能会撑爆 JSON 或导致解析失败
  const internalFields = ['conflict', 'stakes', 'secrets', 'openLoops', 'canonFacts', 'summary', 'eventTypeHistory'];
  for (const f of internalFields) {
    delete s[f];
  }

  return s;
}

/**
 * 清理段落数据
 */
function sanitizeParagraphs(paragraphs) {
  if (!Array.isArray(paragraphs)) return paragraphs;
  return paragraphs.map((p) => {
    const obj = p.toObject ? p.toObject() : p;
    const { _id, ...rest } = obj;
    if (Array.isArray(rest.choices)) {
      rest.choices = rest.choices.map((c) => {
        const { _id: cid, ...crest } = c;
        return cid ? crest : c;
      });
    }
    return rest;
  });
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
  
  // R18_soft 尺度：根据好感度递进
  const intimacyGuide = affection.level >= 60 
    ? '大胆亲密：可以有亲吻、拥抱、贴身、暗示更多；她变得主动；呼吸加重、脸红、轻咬嘴唇' 
    : affection.level >= 40 
    ? '暧昧撩拨：身体贴近、若有若无的触碰、低声说话、眼神勾人、欲拒还迎' 
    : affection.level >= 20 
    ? '初步试探：不经意的肢体接触、靠近、目光交汇、心跳加速、脸红' 
    : '挑逗开场：她主动靠近/意外触碰/暧昧场景/心跳瞬间——从第一秒就要有吸引力';

  // 获取上一段内容，避免重复
  const lastParagraph = session.paragraphs?.slice(-1)[0]?.content?.substring(0, 50) || '';
  
  // 沉浸版 prompt - 剧情推进 + 感官化场景
  return `你是${agent.name}，${config.personality || archetype.personality}
【语言】只用中文输出
【风格设定】语言风格：${config.languageStyle || '文艺'}；描写偏好：${config.descriptionPreference || '注重感官与心理描写'}

【核心指令】每一段必须遵循以下高质量结构：
1. [环境描写]：环境、气息、触觉的细腻渲染
2. (内心独白)：括号内展现角色当前的真实心理或渴望
3. 自然对白：带有张力的台词
4. [悬念钩子]：以一个新的动作或悬念结尾

【最重要】每段必须推进剧情！不能原地打转！
必须包含以下至少1项：
- 新事件：有人敲门/电话响/意外发生/被发现
- 新信息：揭示秘密/说出真相/暴露身份
- 新行动：关系升级/做出决定/跨越界限
- 新冲突：阻碍出现/误会产生/第三者介入

【写作风格】事件驱动 + 极致沉浸
1. 先写发生了什么事（新事件/新行动）
2. 再用感官细节渲染
3. 结尾必须是悬念/转折

【禁止】
- 禁止重复上一段的场景和动作
- 禁止用相似的开头

上一段：「${lastParagraph}」

【尺度】${intimacyGuide}
场景：${session.state.scene}，好感${affection.level}%

【输出】150-250字
新事件 + 感官渲染 + 内心戏 + 悬念结尾`;
}

/**
 * 构建带场景数据的 System Prompt（写真模式用）
 */
function buildSystemPromptWithScene(agent, session) {
  const config = agent.storyConfig || {};
  const archetype = detectArchetype(agent);
  const dramaBeat = getDramaBeat(session.progress);
  const affection = session.affection || { level: 0, stage: '陌生' };
  
  // R18_soft 尺度递进
  const intimacyGuide = affection.level >= 60 
    ? '大胆亲密：亲吻、拥抱、贴身暧昧；她主动；暗示更多' 
    : affection.level >= 40 
    ? '暧昧撩拨：身体贴近、触碰、低语、眼神勾人' 
    : affection.level >= 20 
    ? '初步试探：肢体接触、靠近、心跳加速' 
    : '挑逗开场：她靠近/触碰/暧昧场景';

  const lastParagraph = session.paragraphs?.slice(-1)[0]?.content?.substring(0, 50) || '';
  
  return `你是${agent.name}，${config.personality || archetype.personality}
外貌：${config.appearance || agent.description || ''}
【语言】只用中文输出
【风格设定】语言风格：${config.languageStyle || '文艺'}；描写偏好：${config.descriptionPreference || '注重感官与心理描写'}

【核心指令】每一段必须遵循以下四段式结构：
1. [环境/感官]：细腻描写环境细节（气息/心跳/触感）
2. (内心独白)：括号内展现角色真实的心理活动或渴望
3. 自然对白：带有张力的台词
4. [悬念钩子]：最后一句必须是一个悬念或转折点

【最重要】每段必须推进剧情！
必须有：新事件/新信息/新行动/新冲突（四选一）
禁止：原地暧昧打转、重复上一段内容

【写作风格】事件驱动 + 感官渲染
1. 先写新事件（发生了什么）
2. 用感官细节渲染
3. 结尾必须是转折/悬念

【尺度】${intimacyGuide}

上一段：「${lastParagraph}」（禁止相似！）

场景：${session.state.scene}，好感${affection.level}%

输出：
---STORY---
新事件 + 感官渲染 + 内心戏 + 悬念（150-250字）
[好感+X][心情:X]
---SCENE---
clothing:服装
pose:姿势
expression:表情
background:场景
mood:氛围
---END---`;
}

// 随机剧情方向（R18_soft：制造暧昧紧张感）
const PLOT_DIRECTIONS = [
  '她突然靠近，距离危险地接近',
  '你们意外独处，气氛暧昧',
  '她的手"不小心"碰到你',
  '关键时刻有人敲门',
  '她低声说了一句让你心跳加速的话',
  '灯突然灭了，只剩下彼此的呼吸声',
  '她的衣带/纽扣"意外"松开',
  '你们被困在狭小的空间里',
  '她喝了点酒，变得大胆起来',
  '她说"今晚...就我们两个"',
];

function getRecentStoryContext(session, count = 2, maxChars = 520) {
  const paras = Array.isArray(session?.paragraphs) ? session.paragraphs : [];
  const recent = paras.slice(-count).map((p) => (p?.content || '').trim()).filter(Boolean);
  const joined = recent.join('\n\n---\n\n');
  if (!joined) return '';
  // 截断到最大长度，保留尾部更有用
  return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}

function buildContextBundle(session, opts = {}) {
  const count = Number.isFinite(opts.count) ? opts.count : 2;
  const maxChars = Number.isFinite(opts.maxChars) ? opts.maxChars : 900;
  const memoryK = Number.isFinite(opts.memoryK) ? opts.memoryK : 4;

  const recentText = getRecentStoryContext(session, count, Math.min(700, maxChars));
  const summary = (session?.state?.summary || '').trim();
  const objectiveTitle = (session?.state?.objective?.title || '').trim();
  const arcId = (session?.state?.arcId || '').trim();
  const beatIndex = Number.isFinite(Number(session?.state?.beatIndex)) ? Number(session.state.beatIndex) : 0;
  const skeletonVersion = (session?.state?.skeletonVersion || '').trim();
  const canonFacts = Array.isArray(session?.state?.canonFacts) ? session.state.canonFacts.slice(-6) : [];
  const openLoops = Array.isArray(session?.state?.openLoops) ? session.state.openLoops.slice(-6) : [];
  const memoryEvents = Array.isArray(session?.memoryEvents) ? session.memoryEvents.slice(-memoryK) : [];

  // 轻量裁剪：让整体上下文不超过 maxChars
  let packed =
    `【摘要】${summary || '(无)'}\n` +
    `【目标】${objectiveTitle || '(无)'}\n` +
    `【骨架】arcId=${arcId || '(无)'} beatIndex=${beatIndex} skeleton=${skeletonVersion || '(无)'}\n` +
    `【事实】${canonFacts.length ? canonFacts.join('；') : '(无)'}\n` +
    `【伏笔】${openLoops.length ? openLoops.join('；') : '(无)'}\n` +
    `【最近】\n${recentText || '(无)'}\n` +
    `【记忆】\n${memoryEvents.length ? memoryEvents.map((m) => `- ${[m.place, m.stakes, m.secret].filter(Boolean).join(' / ')}`).join('\n') : '(无)'}\n`;

  if (packed.length > maxChars) packed = packed.slice(-maxChars);
  return { packed, recentText, summary, objectiveTitle, arcId, beatIndex, skeletonVersion, canonFacts, openLoops, memoryEvents };
}

function getAgentSkeleton(agent) {
  const sk = agent?.storyConfig?.skeleton;
  if (!sk || typeof sk !== 'object') return null;
  if (!Array.isArray(sk.arcs) || !sk.arcs.length) return null;
  return sk;
}

function getSkeletonArc(skeleton, arcId) {
  if (!skeleton) return null;
  const arcs = Array.isArray(skeleton.arcs) ? skeleton.arcs : [];
  if (!arcs.length) return null;
  const byId = arcId ? arcs.find((a) => String(a.arcId) === String(arcId)) : null;
  return byId || arcs[0];
}

function getBeatName(arc, beatIndex) {
  const beats = Array.isArray(arc?.beats) ? arc.beats : [];
  if (!beats.length) return '';
  const idx = Math.max(0, Math.min(beats.length - 1, Number(beatIndex) || 0));
  return String(beats[idx] || '');
}

function getNextMilestone(arc, milestonesHit = []) {
  const ms = Array.isArray(arc?.milestones) ? arc.milestones : [];
  const hit = new Set((Array.isArray(milestonesHit) ? milestonesHit : []).map(String));
  return ms.find((m) => m?.id && !hit.has(String(m.id))) || null;
}

function syncNextMilestoneHint(session, agent) {
  const skeleton = getAgentSkeleton(agent);
  if (!skeleton) {
    session.state.nextMilestoneId = '';
    session.state.nextMilestoneTitle = '';
    return null;
  }
  const arc = getSkeletonArc(skeleton, session?.state?.arcId);
  if (!arc) return null;
  const ms = getNextMilestone(arc, session?.state?.milestonesHit || []);
  session.state.nextMilestoneId = ms?.id ? String(ms.id) : '';
  session.state.nextMilestoneTitle = ms?.title ? String(ms.title).slice(0, 24) : '';
  return ms;
}

async function pickPromptVariant(agentId, userId) {
  if (!agentId || !userId) return null;
  const exp = await PromptExperiment.getActiveExperiment(agentId);
  if (!exp) return null;
  const v = exp.assignVariant(String(userId));
  await exp.save(); // persist assignment
  return { experimentId: exp._id, variantId: v?.id, prompt: v?.prompt || '' };
}

function addUniqueLimited(arr, item, max = 7) {
  if (!item) return arr;
  const v = String(item).trim();
  if (!v) return arr;
  const exists = arr.some((x) => String(x).trim() === v);
  if (!exists) arr.push(v);
  while (arr.length > max) arr.shift();
  return arr;
}

function updateRollingSummary(prev, newContent, maxLen = 420) {
  const clean = String(newContent || '').replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return (prev || '').slice(-maxLen);
  const merged = `${(prev || '').trim()} ${clean}`.trim();
  return merged.length > maxLen ? merged.slice(-maxLen) : merged;
}

function guessOpenLoop(content) {
  const t = String(content || '').trim();
  if (!t) return null;
  // 取结尾的悬念句/半句
  const m =
    t.match(/(门.*?被.*?打开.*?$)/) ||
    t.match(/(手机.*?响.*?$)/) ||
    t.match(/(脚步声.*?$)/) ||
    t.match(/(你.*?[？\?].*$)/) ||
    t.match(/(——.*?$)/) ||
    t.match(/(\.\.\..*$)/);
  const s = (m ? m[1] : t.slice(-24)).replace(/\s+/g, ' ').trim();
  return s.length > 36 ? s.slice(-36) : s;
}

function extractPlaceFromText(content) {
  const patterns = [
    /在(.{2,8})(里|中|上)/,
    /走进了?(.{2,10})/,
    /来到了?(.{2,10})/,
    /进入了?(.{2,10})/,
  ];
  for (const p of patterns) {
    const m = String(content || '').match(p);
    if (m) return m[1];
  }
  return '';
}

function buildMemoryEventFromParagraph(content) {
  const text = String(content || '');
  const tags = [];
  const addTag = (k, tag) => { if (text.includes(k)) tags.push(tag); };
  addTag('电话', 'call');
  addTag('手机', 'call');
  addTag('门', 'intrusion');
  addTag('未婚', 'identity');
  addTag('秘密', 'secret');
  addTag('证据', 'evidence');
  addTag('交易', 'deal');
  addTag('钱', 'deal');
  addTag('警', 'risk');
  addTag('危险', 'risk');

  const place = extractPlaceFromText(text);
  const stakes =
    (text.includes('否则') || text.includes('不然') || text.includes('代价') || text.includes('威胁'))
      ? '有代价/风险'
      : '';
  const secret =
    (text.includes('其实') || text.includes('原来') || text.includes('我知道') || text.includes('真相'))
      ? '出现新线索'
      : '';

  let intensity = 0;
  if (/(掐|摁|压|逼近|咬|吻|贴近)/.test(text)) intensity = 6;
  if (/(威胁|报警|死|完了|崩|危险)/.test(text)) intensity = Math.max(intensity, 7);

  return {
    tags: Array.from(new Set(tags)).slice(0, 6),
    people: [],
    place,
    stakes,
    secret,
    intensity,
  };
}

function applyV2LightStateUpdates(session, paragraphIndex, content) {
  if (!session?.state) return;
  // 滚动摘要
  session.state.summary = updateRollingSummary(session.state.summary, content, 420);

  // 伏笔（取悬念尾句）
  if (!Array.isArray(session.state.openLoops)) session.state.openLoops = [];
  addUniqueLimited(session.state.openLoops, guessOpenLoop(content), 7);

  // 记忆事件（轻量）
  if (!Array.isArray(session.memoryEvents)) session.memoryEvents = [];
  const mem = buildMemoryEventFromParagraph(content);
  session.memoryEvents.push({ ...mem, paragraphIndex, createdAt: new Date() });
  while (session.memoryEvents.length > 50) session.memoryEvents.shift();
}

function pickWorkflowVersion(session, options = {}) {
  const forced = options.workflowVersion || options.workflow;
  if (forced === 'v1' || forced === 'v2') return forced;

  const fromState = session?.state?.workflow;
  if (fromState === 'v1' || fromState === 'v2') return fromState;

  // Switch: STORY_WORKFLOW=v1|v2 (v2 默认灰度 10%)
  const mode = (process.env.STORY_WORKFLOW || 'v2').toLowerCase();
  if (mode === 'v1') return 'v1';

  const percent = Number.isFinite(Number(process.env.STORY_WORKFLOW_V2_PERCENT))
    ? Math.max(0, Math.min(100, Number(process.env.STORY_WORKFLOW_V2_PERCENT)))
    : 100;

  const id = String(session?._id || '');
  const h = crypto.createHash('md5').update(id).digest('hex');
  const bucket = parseInt(h.slice(0, 2), 16); // 0-255
  const threshold = Math.floor((percent / 100) * 256);
  return bucket < threshold ? 'v2' : 'v1';
}

function safeJsonParseFromText(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  // 先找 ```json ``` 块
  const fenced = s.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : s;
  // 再找第一个 { ... } 大括号块
  const brace = candidate.match(/\{[\s\S]*\}/);
  if (!brace) return null;
  try {
    return JSON.parse(brace[0]);
  } catch {
    return null;
  }
}

function validateDirectorPlan(plan) {
  const p = plan && typeof plan === 'object' ? plan : {};
  const event = typeof p.event === 'string' ? p.event.trim() : '';
  const hook = typeof p.hook === 'string' ? p.hook.trim() : '';
  const stakes = typeof p.stakes === 'string' ? p.stakes.trim() : '';
  const twist = typeof p.twist === 'string' ? p.twist.trim() : '';
  const eventType = typeof p.eventType === 'string' ? p.eventType.trim() : '';
  const sensoryAnchor = typeof p.sensoryAnchor === 'string' ? p.sensoryAnchor.trim() : '';
  const objective = typeof p.objective === 'string' ? p.objective.trim() : '';
  const objectiveAdvance = typeof p.objectiveAdvance === 'string' ? p.objectiveAdvance.trim() : '';
  const arcId = typeof p.arcId === 'string' ? p.arcId.trim() : '';
  const beat = typeof p.beat === 'string' ? p.beat.trim() : '';
  const milestoneTarget = typeof p.milestoneTarget === 'string' ? p.milestoneTarget.trim() : '';
  const milestoneHit = typeof p.milestoneHit === 'string' ? p.milestoneHit.trim() : '';
  const choices = Array.isArray(p.choices) ? p.choices.filter(Boolean).slice(0, 3) : [];
  const ok = !!event && !!eventType && !!objectiveAdvance && !!sensoryAnchor;
  return {
    ok,
    plan: { event, hook, stakes, twist, eventType, sensoryAnchor, objective, objectiveAdvance, arcId, beat, milestoneTarget, milestoneHit, choices },
    reasons: ok ? [] : ['missing_required_fields'],
  };
}

function buildDirectorSystemPrompt(agent, session) {
  const config = agent.storyConfig || {};
  const persona = config.personality || '';
  const progress = session?.progress || 0;
  
  // 根据进度调整暧昧强度
  let intensityGuide = '极致暧昧，暗示水到戚成';
  if (progress < 15) intensityGuide = '制造心动：她靠近/触碰/暧昧对话';
  else if (progress < 30) intensityGuide = '升级撩拨：肢体接触、低语、眼神';
  else if (progress < 50) intensityGuide = '更大胆试探：危险的距离、呼吸交缠';
  else if (progress < 70) intensityGuide = '亲密升级：暧昧到极致';
  
  return `你是短剧导演（只用中文），规划下一段要发生什么事件，并提供感官锚点。\n` +
    `要求：只输出 JSON。\n` +
    `【合同】event 必填，且 writer 必须把 event 写进正文第一句。\n` +
    `eventType 必填，只能从：intrusion(闯入/敲门/被发现)/evidence(证据)/reveal(揭示)/decision(决定/交易)/relocate(换地点)/conflict(冲突/对峙)/escape(逃离)\n` +
    `sensoryAnchor 必填：指定编剧必须重点描写的感官细节（如：指尖的颤抖、耳边的热气、避开的视线）。\n` +
    `objective 可选：如果当前【目标】为空或已明显跑偏，给一个新的“本章目标”(<=12字)。\n` +
    `objectiveAdvance 必填：advance(推进)/blocked(受阻)/cost(付出代价)。\n` +
    `角色：${agent.name}。人设：${persona}\n` +
    `边界：R18_soft。进度暗示：${intensityGuide}\n` +
    `JSON 字段：arcId(optional), beat(optional), milestoneTarget(optional), milestoneHit(optional), eventType(必填), sensoryAnchor(必填), objectiveAdvance(必填), event(必填, 1句短句, 含2-4个关键词), objective(optional), twist, hook, stakes, choices(array 2-3 strings).`;
}

function buildDirectorUserPrompt(session, intent) {
  const bundle = buildContextBundle(session, { count: 2, maxChars: 900, memoryK: 4 });
  const last = Array.isArray(session?.paragraphs) ? (session.paragraphs.slice(-1)[0]?.content || '') : '';
  const lastStart = last.trim().slice(0, 24);
  const recentTypes = Array.isArray(session?.state?.eventTypeHistory) ? session.state.eventTypeHistory.slice(-3).filter(Boolean) : [];
  // 下一里程碑提示（若角色未配置 skeleton，则为空）
  const nextMsId = (session?.state?.nextMilestoneId || '').trim();
  const nextMsTitle = (session?.state?.nextMilestoneTitle || '').trim();
  return `${bundle.packed}\n【意图】${intent}\n` +
    (recentTypes.length ? `【最近事件类型】${recentTypes.join(' -> ')}（避免连续重复同一类型）\n` : '') +
    (bundle.arcId ? `【当前骨架】arcId=${bundle.arcId} beatIndex=${bundle.beatIndex}\n` : '') +
    `要求：开头禁止与上一段开头相似：「${lastStart}」。\n` +
    (nextMsId ? `【下一里程碑】${nextMsId}${nextMsTitle ? `(${nextMsTitle})` : ''}\n` : '') +
    `如果存在【下一里程碑】，请用 milestoneTarget 指向它；若该里程碑带 paywall，则这一段要在临界点收尾，等待解锁。\n` +
    `输出 JSON。`;
}

function buildWriterSystemPrompt(agent, session, directorPlan, generateImage) {
  const config = agent.storyConfig || {};
  const persona = config.personality || '';
  const appearance = config.appearance || agent.description || '';
  const beat = directorPlan?.beat || session?.state?.beat || '';
  const event = directorPlan?.event || '';
  const sensoryAnchor = directorPlan?.sensoryAnchor || '';
  const languageStyle = config.languageStyle || '文艺';
  const descriptionPreference = config.descriptionPreference || '注重感官与心理描写';

  const base =
    `你是短剧编剧（只用中文），写事件驱动的沉浸式短剧。\n` +
    `角色用「${agent.name}」的名字（不要用"我"）。用户用"你"。\n` +
    `【风格设定】语言风格：${languageStyle}；描写偏好：${descriptionPreference}\n` +
    `【核心指令】每一段必须严格遵循以下四段式结构：\n` +
    `1. [环境/感官]：基于导演给出的 sensoryAnchor 描写环境细节（气息/心跳/触感）。如：*空气中凝结着暧昧的水汽，他的指尖不经意地擦过我的手背*\n` +
    `2. (内心独白)：在括号内描写角色的真实心理博弈或渴望。如：(他会发现我心跳得这么快吗？好想让他再靠近一点...)\n` +
    `3. 自然对话：角色当前的台词，要带有潜台词和情感张力。\n` +
    `4. [悬念/钩子]：最后一句必须是一个待解决的动作或悬念（有人敲门/手机响/眼神对视）。\n\n` +
    `【合同】第一句必须写出这个 event（照抄或同义改写）：${event}\n` +
    `【感官锚点】重点描写：${sensoryAnchor}\n` +
    `【禁止】不要输出小标题或括号标注（除内心独白外），只写正文。\n` +
    `【最重要】每段必须有新事件，不能原地打转。\n` +
    `长度：150-250字。边界：R18_soft。\n` +
    `人设：${persona}\n` +
    `节拍：${beat}\n`;

  if (!generateImage) return base;

  return base +
    `外貌：${appearance}\n` +
    `附加场景块：\n` +
    `---SCENE---\nclothing:性感服装\npose:暧昧姿势\nexpression:撩人表情\nbackground:私密场景\nmood:暧昧氛围\n---END---`;
}

function buildWriterUserPrompt(session, directorPlan, userInput) {
  const bundle = buildContextBundle(session, { count: 2, maxChars: 900, memoryK: 4 });
  const intent = userInput ? `回应玩家输入：「${userInput}」并推进剧情` : '续写推进剧情';
  return `${bundle.packed}\n【导演指令(JSON)】\n${JSON.stringify(directorPlan || {}, null, 0)}\n` +
    `【任务】${intent}\n` +
    `再次强调：第一句必须落实 event；最后一句必须落实 hook（悬念）。\n` +
    `输出正文 + [好感+X][心情:X]（可不写表情/动作标签）。`;
}

function normalizeFirstLine(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const first = t.split('\n').find(Boolean) || t;
  return first.replace(/[「」"“”]/g, '').slice(0, 24);
}

function charNgrams(text, n = 3) {
  const s = String(text || '').replace(/\s+/g, '');
  if (s.length < n) return [];
  const out = [];
  for (let i = 0; i <= s.length - n; i += 1) out.push(s.slice(i, i + n));
  return out;
}

function overlapRatio(aNgrams, bNgrams) {
  if (!aNgrams.length || !bNgrams.length) return 0;
  const a = new Set(aNgrams);
  const b = new Set(bNgrams);
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / Math.max(1, Math.min(a.size, b.size));
}

const EVENT_TRIGGERS = [
  '门', '敲门', '推开', '脚步', '来人', '电话', '响起', '短信', '监控',
  '被发现', '撞见', '露馅', '秘密', '证据', '录音', '照片', '账本',
  '决定', '答应', '拒绝', '分手', '同意', '条件', '交易', '威胁', '报警',
  '老师', '校长', '保安', '同学', '家长', '第三者', '前任',
  // 扩展：证据/逃离/闯入/工具
  '钥匙', '日记', '信', '信封', '抽屉', '文件', 'U盘', '硬盘', '录像', '对讲机',
  '报警器', '警报', '摄像头', '监控室', '密码', '锁', '撬', '破门', '闯入', '追', '抓', '躲',
  '检查', '通知', '消息', '纸条', '检查员',
  // English (防止模型偶尔英文导致误判)
  'door', 'knock', 'footstep', 'phone', 'call', 'message', 'key', 'diary', 'evidence', 'security', 'police', 'alarm', 'camera', 'recording',
];

const SCENE_ACTION_TOKENS = [
  '教室', '走廊', '办公室', '宿舍', '酒店', '电梯', '车里', '门口',
  '壁咚', '贴近', '低语', '耳边', '呼吸', '心跳', '拉住', '按住', '拥抱', '亲吻',
];

function extractEventKeywords(eventText) {
  const s = String(eventText || '').trim();
  if (!s) return [];
  // 粗分割：空格/标点；保留长度>=2的片段做弱匹配
  return s
    .split(/[\s，。！？、:：；;,.!?()\[\]{}"“”'‘’\-—]+/g)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .slice(0, 6);
}

function validateParagraph({ text, recentParas, directorPlan, sessionState }) {
  const out = String(text || '').trim();
  const recent = Array.isArray(recentParas) ? recentParas.filter(Boolean) : [];
  const last = recent.length ? String(recent[recent.length - 1]) : '';

  // 1) 开头重复（强失败）
  const curStart = normalizeFirstLine(out);
  const lastStart = normalizeFirstLine(last);
  if (curStart && lastStart && curStart === lastStart) {
    return { ok: false, reasons: ['opening_repeat'], metrics: { openingRepeat: true } };
  }

  // 2) n-gram 去重复（近2-3段）
  const cur3 = charNgrams(out, 3);
  let maxOverlap = 0;
  for (const r of recent.slice(-3)) {
    maxOverlap = Math.max(maxOverlap, overlapRatio(cur3, charNgrams(String(r), 3)));
  }
  if (maxOverlap >= 0.38) {
    return { ok: false, reasons: ['high_ngram_overlap'], metrics: { maxOverlap } };
  }

  // 3) 氛围感/三位一体结构检测（绝对对标版）
  // 检查是否包含内心独白 (括号)
  const hasInnerMonologue = /\(.*\)/.test(out);
  // 检查是否包含感官描写 (星号动作)
  const hasAction = /\*.*\*/.test(out);
  if (!hasInnerMonologue || !hasAction) {
    return { ok: false, reasons: ['missing_immersion_structure'], metrics: { hasInnerMonologue, hasAction } };
  }

  // 4) 氛围密度检测（检查是否有足够的描写性词汇）
  const descriptionWords = ['气息', '心跳', '温度', '光影', '颤抖', '热气', '视线', '模糊', '紧致', '柔软'];
  const descHit = descriptionWords.filter(w => out.includes(w)).length;
  if (descHit < 1) {
    return { ok: false, reasons: ['low_atmosphere_density'], metrics: { descHit } };
  }

  // 5) 场景/动作模板词重复（软失败）
  const tokensHit = SCENE_ACTION_TOKENS.filter((t) => out.includes(t));
  const lastTokensHit = SCENE_ACTION_TOKENS.filter((t) => last.includes(t));
  const tokenOverlap = tokensHit.filter((t) => lastTokensHit.includes(t)).length;
  if (tokenOverlap >= 5) {
    return { ok: false, reasons: ['scene_action_template_repeat'], metrics: { tokenOverlap } };
  }

  // 4/5) 事件推进：触发词命中 OR Director event 落地（二选一）
  const event = directorPlan?.event;
  let eventHit = 0;
  let eventNeed = 0;
  let eventKeywords = [];
  if (event) {
    eventKeywords = extractEventKeywords(event);
    eventHit = eventKeywords.filter((k) => out.includes(k)).length;
    eventNeed = eventKeywords.length ? Math.max(1, Math.ceil(eventKeywords.length * 0.2)) : 0;
    if (eventKeywords.length && eventHit < eventNeed) {
      // 允许更强的语义改写：用 2-gram 重叠做兜底（避免过度严格）
      const first = (out.split('\n').find(Boolean) || out).slice(0, 120);
      const sim = overlapRatio(charNgrams(event, 2), charNgrams(first, 2));
      if (sim < 0.22) {
        return { ok: false, reasons: ['director_event_not_realized'], metrics: { eventKeywords, sim } };
      }
    }
  }

  const hasEventTrigger = EVENT_TRIGGERS.some((w) => out.toLowerCase().includes(String(w).toLowerCase()));
  const hasEventByPlan = eventKeywords.length ? eventHit >= Math.max(1, eventNeed) : false;
  if (!hasEventTrigger && !hasEventByPlan) {
    return { ok: false, reasons: ['no_event_trigger'], metrics: { hasEventTrigger: false } };
  }

  // 5.1) eventType 多样性：避免连续重复同一类事件（软失败）
  const t = directorPlan?.eventType;
  if (t) {
    const hist = Array.isArray(sessionState?.eventTypeHistory) ? sessionState.eventTypeHistory.slice(-2) : [];
    if (hist.length >= 2 && hist.every((x) => String(x) === String(t))) {
      return { ok: false, reasons: ['event_type_repeat'], metrics: { eventType: t, hist } };
    }
  }

  // 6) 主线推进：避免长期停留同一场景（轻量提示：不算失败，仅打分）
  const scene = sessionState?.scene || '';
  const stuck = scene && recent.length >= 3 && recent.slice(-3).every((p) => String(p).includes(scene));
  return { ok: true, reasons: [], metrics: { maxOverlap, tokenOverlap, stuck } };
}

function buildCriticSystemPrompt() {
  return (
    `你是“挑刺审核官”(Critic)，专门找短剧段落的问题并给出可执行的改写约束。\n` +
    `目标：解决“重复/打转/无推进/事件不落地/缺乏沉浸感”。\n` +
    `重点检查：1. 是否包含 [环境/感官] 描写；2. 是否有 (内心独白)；3. 剧情是否真正推进；4. 结尾是否有钩子。\n` +
    `要求：只输出 JSON（不要解释）。\n` +
    `边界：R18_soft（允许暧昧撩拨，但禁止露骨细节）；禁止未成年。\n` +
    `JSON 字段：issues(array), diagnosis(string), mustInclude(array strings), avoidStarts(array strings), avoidPhrases(array strings), rewriteHint(string), forceTemplate(boolean).\n`
  );
}

function buildCriticUserPrompt({ recentParas, lastText, draftText, directorPlan, validateInfo, sessionState }) {
  const recent = Array.isArray(recentParas) ? recentParas.slice(-3) : [];
  const event = directorPlan?.event ? String(directorPlan.event).slice(0, 80) : '';
  const reasons = (validateInfo?.reasons || []).join(',');
  const scene = sessionState?.scene ? String(sessionState.scene) : '';
  const objective = sessionState?.objective?.title ? String(sessionState.objective.title) : '';
  return (
    `【最近三段】\n${recent.map((t, i) => `(${i + 1}) ${String(t).slice(0, 220)}`).join('\n') || '(无)'}\n\n` +
    `【上一段】\n${String(lastText || '').slice(0, 240)}\n\n` +
    `【本次草稿】\n${String(draftText || '').slice(0, 260)}\n\n` +
    `【导演event】${event || '(无)'}\n` +
    `【校验失败原因】${reasons || '(无)'}\n` +
    `【当前场景】${scene || '(无)'}\n` +
    `【当前目标】${objective || '(无)'}\n` +
    `输出 JSON：给出最少 3 条 mustInclude（必须落地的“新事件/新信息/新行动/新冲突”），并给出 rewriteHint（可直接贴进提示词）。`
  );
}

function sanitizeCriticPlan(plan) {
  const p = plan && typeof plan === 'object' ? plan : {};
  const issues = Array.isArray(p.issues) ? p.issues.filter(Boolean).slice(0, 6) : [];
  const mustInclude = Array.isArray(p.mustInclude) ? p.mustInclude.filter(Boolean).slice(0, 6) : [];
  const avoidStarts = Array.isArray(p.avoidStarts) ? p.avoidStarts.filter(Boolean).slice(0, 6) : [];
  const avoidPhrases = Array.isArray(p.avoidPhrases) ? p.avoidPhrases.filter(Boolean).slice(0, 10) : [];
  const rewriteHint = typeof p.rewriteHint === 'string' ? p.rewriteHint.trim().slice(0, 400) : '';
  const diagnosis = typeof p.diagnosis === 'string' ? p.diagnosis.trim().slice(0, 200) : '';
  const forceTemplate = !!p.forceTemplate;
  return { issues, mustInclude, avoidStarts, avoidPhrases, rewriteHint, diagnosis, forceTemplate };
}

async function runCritic({ modelName, recentParas, lastText, draftText, directorPlan, validateInfo, sessionState }) {
  const criticModel = process.env.STORY_CRITIC_MODEL || modelName || 'grok-2';
  const sys = buildCriticSystemPrompt();
  const user = buildCriticUserPrompt({ recentParas, lastText, draftText, directorPlan, validateInfo, sessionState });
  const raw = await generateContent(sys, user, criticModel, { maxTokens: 220, temperature: 0.2 });
  const parsed = safeJsonParseFromText(raw) || {};
  return sanitizeCriticPlan(parsed);
}

function ensureShortDramaFormat(content, lastParagraph) {
  let out = String(content || '').trim();
  if (!out) return out;
  
  // 如果过长，智能截断到最后一个完整句子（不要粗暴截断）
  if (out.length > 280) {
    // 找最后一个句号/感叹号/问号/破折号的位置
    const lastPunct = Math.max(
      out.lastIndexOf('。', 250),
      out.lastIndexOf('！', 250),
      out.lastIndexOf('？', 250),
      out.lastIndexOf('——', 250),
      out.lastIndexOf('"', 250),
      out.lastIndexOf('」', 250)
    );
    if (lastPunct > 100) {
      out = out.slice(0, lastPunct + 1).trim();
    } else {
      // 实在找不到就截断，但保留更多
      out = out.slice(0, 250).trim() + '——';
    }
  }

  // 如果开头与上一段过像，强制换一个更直接的开头（本地兜底）
  const lastStart = normalizeFirstLine(lastParagraph);
  const curStart = normalizeFirstLine(out);
  if (lastStart && curStart && lastStart === curStart) {
    out = `「别装。」\n` + out;
  }
  return out;
}

function pickChapterPayReason(session) {
  // 简短但强钩子，驱动“解锁下一章”
  const reasons = [
    '下一章将揭露关键身份',
    '下一章出现决定性证据',
    '下一章关系将越过临界点',
    '下一章危机爆发，必须做选择',
  ];
  // 根据节拍/好感做轻微偏置
  const beat = session?.state?.beat || '';
  if (beat === 'reveal') return '下一章揭露真相';
  if (beat === 'crisis') return '下一章危机爆发';
  return reasons[Math.floor(Math.random() * reasons.length)];
}

function updateChapterPaywall(session) {
  // 章节大小：20段一章（约15-20分钟阅读量），比5段更合理
  const size = session?.state?.chapter?.size || 20;
  const total = session?.totalParagraphs || session?.paragraphs?.length || 0;
  const currentChapterIndex = Math.max(0, Math.floor(Math.max(0, total - 1) / size));
  session.state.chapter = session.state.chapter || { index: 0, size };
  session.state.chapter.index = currentChapterIndex;
  session.state.chapter.size = size;

  // 在章末设置“下一章解锁”付费点（pending），下一次继续时会被 routes 侧拦截
  if (total > 0 && total % size === 0) {
    const nextChapterIndex = currentChapterIndex + 1;
    session.state.pay = session.state.pay || { unlockedChapterIndex: 0 };
    session.state.pay.pending = {
      type: 'chapter_unlock',
      chapterIndex: nextChapterIndex,
      reason: pickChapterPayReason(session),
      createdAt: new Date(),
      paragraphIndex: Math.max(0, total - 1),
    };
    return { ...session.state.pay.pending };
  }
  return null;
}

function isMilestoneUnlocked(session, arcId, milestoneId) {
  const unlocked = Array.isArray(session?.state?.pay?.unlockedMilestones) ? session.state.pay.unlockedMilestones : [];
  return unlocked.some((x) => String(x.arcId) === String(arcId) && String(x.milestoneId) === String(milestoneId));
}

function updateMilestonePaywall(session, agent, directorPlan) {
  const skeleton = getAgentSkeleton(agent);
  if (!skeleton) return null;
  const arc = getSkeletonArc(skeleton, session?.state?.arcId);
  if (!arc) return null;
  const arcId = String(arc.arcId || '');

  const milestoneId = directorPlan?.milestoneTarget || '';
  if (!milestoneId) return null;

  const ms = Array.isArray(arc.milestones) ? arc.milestones.find((m) => String(m.id) === String(milestoneId)) : null;
  if (!ms || !ms.paywall?.enabled) return null;
  if (isMilestoneUnlocked(session, arcId, milestoneId)) return null;

  session.state.pay = session.state.pay || { unlockedChapterIndex: 0 };
  session.state.pay.pending = {
    type: 'milestone_unlock',
    arcId,
    milestoneId,
    reason: ms.paywall.reason || '解锁关键情节',
    cost: Number(ms.paywall.cost || 0) || 0,
    createdAt: new Date(),
    paragraphIndex: Math.max(0, (session?.totalParagraphs || session?.paragraphs?.length || 1) - 1),
  };
  return { ...session.state.pay.pending };
}

function buildContinuePrompt(session) {
  const direction = PLOT_DIRECTIONS[Math.floor(Math.random() * PLOT_DIRECTIONS.length)];
  const progress = session.progress || 0;
  const bundle = buildContextBundle(session, { count: 2, maxChars: 900, memoryK: 4 });
  const last = Array.isArray(session?.paragraphs) ? (session.paragraphs.slice(-1)[0]?.content || '') : '';
  const lastStart = last.trim().slice(0, 24);

  // R18_soft 分阶段引导：前期就要有性张力
  // 分阶段引导：强调事件推进
  let stageGuide = '极致亲密：关系确定/重大决定/结局走向';
  if (progress < 15) stageGuide = '开场事件：意外相遇/身份揭示/危险靠近';
  else if (progress < 30) stageGuide = `升级事件：${direction}`;
  else if (progress < 50) stageGuide = `冲突爆发：${direction}`;
  else if (progress < 70) stageGuide = `关系转折：${direction}`;
  else if (progress < 85) stageGuide = `高潮事件：${direction}`;

  return `${bundle.packed}\n\n【任务】${stageGuide}\n\n【必须】这一段要发生新事件！\n- 新事件：门被推开/有人来了/电话响了/秘密暴露/意外发生\n- 不能只是暧昧描写，必须有事情发生\n- 换个开头（禁止与「${lastStart}」相似）\n- 结尾是悬念/转折\n- 120-180字，用"你"称呼用户\n输出正文 + [好感+X][心情:X]`;
}

function buildUserInputPrompt(session, userInput) {
  const bundle = buildContextBundle(session, { count: 2, maxChars: 900, memoryK: 4 });
  const last = Array.isArray(session?.paragraphs) ? (session.paragraphs.slice(-1)[0]?.content || '') : '';
  const lastStart = last.trim().slice(0, 24);
  return `${bundle.packed}\n\n【玩家说】${userInput}\n\n【任务】回应他，并推进剧情！\n- 必须发生新事件：有人闯入/被发现/意外转折/秘密揭露\n- 不能只是暧昧回应，要有事情发生\n- 换个开头（禁止与「${lastStart}」相似）\n- 结尾是悬念/转折\n- 120-180字，用"你"称呼用户\n输出正文 + [好感+X][心情:X]`;
}

async function generateContent(systemPrompt, userPrompt, model = 'grok-2', opts = {}) {
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
  // 提取场景数据（新格式：---SCENE--- ... ---END---）
  let sceneData = null;
  let storyContent = response;
  
  const sceneMatch = response.match(/---SCENE---\s*([\s\S]*?)\s*---END---/i);
  if (sceneMatch) {
    const sceneText = sceneMatch[1];
    sceneData = {};
    
    // 解析 key: value 格式
    const lines = sceneText.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*[:：]\s*(.+)$/);
      if (match) {
        sceneData[match[1].toLowerCase()] = match[2].trim();
      }
    }
    
    // 移除场景块
    storyContent = response.replace(/---SCENE---[\s\S]*?---END---/i, '');
  }
  
  // 移除 ---STORY--- 标记
  storyContent = storyContent.replace(/---STORY---/gi, '');
  
  // 提取图片描述（旧格式兼容）
  const imgMatch = storyContent.match(/\[IMG:\s*([^\]]+)\]/i);
  let imagePrompt = imgMatch ? imgMatch[1].trim() : null;
  
  // 提取好感度变化
  const affectionMatch = storyContent.match(/\[好感([+-])(\d+)\]/);
  let affectionChange = 0;
  if (affectionMatch) {
    affectionChange = parseInt(affectionMatch[2]) * (affectionMatch[1] === '+' ? 1 : -1);
  }
  
  // 提取状态变化
  const stateChanges = {};
  const expressionMatch = storyContent.match(/\[表情[:：]([^\]]+)\]/);
  const actionMatch = storyContent.match(/\[动作[:：]([^\]]+)\]/);
  const moodMatch = storyContent.match(/\[心情[:：]([^\]]+)\]/);
  
  if (expressionMatch) stateChanges.expression = expressionMatch[1].trim();
  if (actionMatch) stateChanges.action = actionMatch[1].trim();
  if (moodMatch) stateChanges.mood = moodMatch[1].trim();
  
  // 清理内容：移除所有标签
  let content = storyContent
    .replace(/\[IMG:\s*[^\]]+\]/gi, '')
    .replace(/\[好感[+-]\d+\]/g, '')
    .replace(/\[表情[:：][^\]]+\]/g, '')
    .replace(/\[动作[:：][^\]]+\]/g, '')
    .replace(/\[心情[:：][^\]]+\]/g, '')
    .trim();
  
  // 保留格式化的换行
  content = content.replace(/\n{3,}/g, '\n\n');
  
  return { content, imagePrompt, affectionChange, stateChanges, sceneData };
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
      state: sanitizeSessionState(session.state),
      affection: session.affection || { level: 0, stage: '陌生', lastChange: 0 },
      paragraphs: sanitizeParagraphs(session.paragraphs),
      isExisting: true,
    };
  }
  
  // 生成暧昧开场（从第一秒就抓住注意力）
  const archetype = detectArchetype(agent);
  const hookExample = archetype.hooks?.[Math.floor(Math.random() * archetype.hooks.length)];
  const sexyOpenings = [
    `她靠近你，呼吸喷洒在你耳边：「你...来得好慢。」\n\n她的手指滑过你的衣领——`,
    `「别动。」她按住你的肩膀，眼神危险地扫过你的脸，「让我好好看看...」`,
    `她的身体贴上来，柔软的触感让你僵住。「怎么，害怕了？」她轻笑——`,
    `灯光昏暗，她的脸凑近，唇几乎贴上你的：「我等你...很久了。」`,
    `「你来了。」她转身，睡袍滑落一边肩膀，「正好...帮我拉一下拉链？」`,
  ];
  const defaultOpening = hookExample || sexyOpenings[Math.floor(Math.random() * sexyOpenings.length)];
  const openingText = agent.storyConfig?.opening || agent.defaultGreeting || defaultOpening;
  const openingImagePrompt = `seductive first meeting, intimate distance, bedroom eyes, soft lighting, romantic tension`;

  // 初始化骨架状态（如果该角色有骨架）
  const skeleton = getAgentSkeleton(agent);
  const arc = getSkeletonArc(skeleton, null);
  const skeletonVersion = skeleton?.version ? String(skeleton.version) : '';
  const arcId = arc?.arcId ? String(arc.arcId) : '';
  const beatIndex = 0;
  const objectiveTitle = arc?.objective?.title ? String(arc.objective.title).slice(0, 24) : '';
  
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

      // skeleton
      arcId,
      beatIndex,
      skeletonVersion,
      milestonesHit: [],
      objective: {
        title: objectiveTitle,
        detail: arc?.objective?.detail ? String(arc.objective.detail).slice(0, 80) : '',
        updatedAt: new Date(),
        progress: 0,
      },
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
    state: sanitizeSessionState(session.state),
    affection: session.affection,
    paragraphs: sanitizeParagraphs(session.paragraphs),
    isExisting: false,
  };
}

/**
 * 继续故事 - 文字先返回，图片异步生成
 * 
 * 写真模式（generateImage=true）：
 * - 立即返回文字 + imageGenerating: true
 * - 后台异步生成图片
 * - 客户端轮询 /api/story/:sessionId/image/:index 获取图片
 */
async function continueStory(sessionId, options = {}) {
  const { generateImage = false, imageCharge = 0 } = options; // 默认不生成图片，需要用户开启写真模式
  const t0 = Date.now();
  
  const session = await StorySession.findById(sessionId);
  if (!session) throw new Error('故事不存在');
  // 故事永不结束，不检查 status

  const agent = await Agent.findById(session.agentId);
  if (!agent) throw new Error('角色不存在');

  // 在生成前同步“下一里程碑提示”
  syncNextMilestoneHint(session, agent);
  
  const workflowVersion = pickWorkflowVersion(session, options);
  session.state.workflow = workflowVersion;

  const modelName = agent.modelName || 'grok-2';
  const variant = await pickPromptVariant(session.agentId, session.userId);

  let rawResponse;
  let directorPlan = null;
  let llmMs = 0;
  let validateInfo = null;
  let criticPlan = null;
  let retryCount = 0;

  // 最多 2 次重试：第1次追加“你刚才重复/无推进，必须改写”；第2次强制模板
  const recentParas = session.paragraphs?.slice(-3).map((p) => p.content) || [];
  const lastParagraph = session.paragraphs?.slice(-1)[0]?.content || '';

  // continued 回填：用户继续时，上一段视为 continued=true
  if (StoryAttribution && session.paragraphs.length > 0) {
    try {
      await StoryAttribution.updateOne(
        { sessionId: session._id, paragraphIndex: session.paragraphs.length - 1 },
        { $set: { continued: true } },
        { upsert: false }
      );
    } catch {}
  }
  let parsed = null;
  let content = '';
  let affectionChange = 0;
  let stateChanges = {};
  let sceneData = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (workflowVersion === 'v2') {
      // Director step (short JSON) - 缺字段最多重跑 1 次
      const directorSystem = buildDirectorSystemPrompt(agent, session) + (variant?.prompt ? `\n【变体提示】\n${variant.prompt}\n` : '');
      const directorUser = buildDirectorUserPrompt(session, '继续推进下一段（短剧节奏）');
      const directorStart = Date.now();
      const directorRaw = await generateContent(directorSystem, directorUser, modelName, { maxTokens: 180, temperature: 0.4 });
      const directorMs = Date.now() - directorStart;
      llmMs += directorMs;

      const parsedDirector = safeJsonParseFromText(directorRaw) || {};
      const checked1 = validateDirectorPlan(parsedDirector);
      if (!checked1.ok) {
        const directorRaw2 = await generateContent(
          directorSystem,
          directorUser + '\n【修正】eventType+event 必填：event 必须1句短句(含2-4关键词)，可执行，且尽量不要与最近事件类型重复。',
          modelName,
          { maxTokens: 220, temperature: 0.4 }
        );
        directorPlan = (validateDirectorPlan(safeJsonParseFromText(directorRaw2) || {}).plan);
      } else {
        directorPlan = checked1.plan;
      }

      // Writer step
      const writerSystem = buildWriterSystemPrompt(agent, session, directorPlan, generateImage) + (variant?.prompt ? `\n【变体提示】\n${variant.prompt}\n` : '');
      let writerUser = buildWriterUserPrompt(session, directorPlan, null);
      if (attempt === 1) {
        writerUser += '\n【纠错】你刚才重复/无推进：必须换场景或引入新人物/新证据，并落实 event。';
        if (criticPlan) {
          writerUser += `\n【Critic诊断】${criticPlan.diagnosis || ''}\n` +
            `【必须包含】${(criticPlan.mustInclude || []).join('；')}\n` +
            `【避免短语】${(criticPlan.avoidPhrases || []).join('；')}\n` +
            (criticPlan.rewriteHint ? `【改写提示】${criticPlan.rewriteHint}\n` : '');
        }
      } else if (attempt >= 2) {
        writerUser += '\n【强制模板】第一句=事件；第二句=你和她的反应；第三句=做出决定/代价；最后一句=悬念(有人来/被发现/证据出现)。';
        if (criticPlan) {
          writerUser += `\n【必须包含】${(criticPlan.mustInclude || []).join('；')}\n`;
        }
      }
      const writerStart = Date.now();
      rawResponse = await generateContent(writerSystem, writerUser, modelName, { maxTokens: generateImage ? 480 : 400, temperature: 0.9 });
      const writerMs = Date.now() - writerStart;
      llmMs += writerMs;
    } else {
      // v1: 单次续写（追加约束重试）
      const systemPrompt = generateImage ? buildSystemPromptWithScene(agent, session) : buildSystemPrompt(agent, session);
      let userPrompt = buildContinuePrompt(session);
      if (attempt === 1) {
        userPrompt += '\n【纠错】你刚才重复/无推进：必须发生新事件(有人闯入/电话/证据/被发现)并推动到新决定。';
        if (criticPlan) {
          userPrompt += `\n【Critic诊断】${criticPlan.diagnosis || ''}\n` +
            `【必须包含】${(criticPlan.mustInclude || []).join('；')}\n` +
            `【避免短语】${(criticPlan.avoidPhrases || []).join('；')}\n` +
            (criticPlan.rewriteHint ? `【改写提示】${criticPlan.rewriteHint}\n` : '');
        }
      } else if (attempt >= 2) {
        userPrompt += '\n【强制模板】事件(第一句)→反应(感官)→推进(决定/代价)→悬念(最后一句)。';
        if (criticPlan) {
          userPrompt += `\n【必须包含】${(criticPlan.mustInclude || []).join('；')}\n`;
        }
      }
      const maxTokens = generateImage ? 450 : 380;
      const startTime = Date.now();
      rawResponse = await generateContent(systemPrompt, userPrompt, modelName, { maxTokens, temperature: 0.9 });
      const oneMs = Date.now() - startTime;
      llmMs += oneMs;
    }

    parsed = parseAIResponse(rawResponse);
    ({ affectionChange, stateChanges, sceneData } = parsed);
    content = ensureShortDramaFormat(parsed.content, lastParagraph);

    validateInfo = validateParagraph({
      text: content,
      recentParas,
      directorPlan,
      sessionState: session.state,
    });
    if (validateInfo.ok) break;

    // 失败：触发 Critic 生成可执行的纠错约束（仅一次，后续复用）
    if (!criticPlan) {
      try {
        criticPlan = await runCritic({
          modelName,
          recentParas,
          lastText: lastParagraph,
          draftText: content,
          directorPlan,
          validateInfo,
          sessionState: session.state,
        });
      } catch (e) {
        console.warn('[StoryService] Critic failed:', e?.message || e);
        criticPlan = null;
      }
    }
  }
  retryCount = validateInfo?.ok ? Math.max(0, (validateInfo?.reasons?.length ? 1 : 0)) : 2;
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;
  
  // v2 director state merge
  if (workflowVersion === 'v2' && directorPlan) {
    if (directorPlan.beat) stateUpdate.beat = directorPlan.beat;
    if (directorPlan.conflict) stateUpdate.conflict = directorPlan.conflict;
    if (directorPlan.stakes) stateUpdate.stakes = directorPlan.stakes;
    if (directorPlan.openLoop) {
      if (!Array.isArray(session.state.openLoops)) session.state.openLoops = [];
      addUniqueLimited(session.state.openLoops, directorPlan.openLoop, 7);
    }
    if (directorPlan.canonFactAdd) {
      if (!Array.isArray(session.state.canonFacts)) session.state.canonFacts = [];
      addUniqueLimited(session.state.canonFacts, directorPlan.canonFactAdd, 12);
    }
  }

  // milestoneHit: 导演可显式命中里程碑
  if (directorPlan?.milestoneHit) {
    if (!Array.isArray(session.state.milestonesHit)) session.state.milestonesHit = [];
    addUniqueLimited(session.state.milestonesHit, String(directorPlan.milestoneHit).slice(0, 64), 50);
  }

  if (directorPlan?.eventType) {
    if (!Array.isArray(session.state.eventTypeHistory)) session.state.eventTypeHistory = [];
    session.state.eventTypeHistory.push(String(directorPlan.eventType).slice(0, 24));
    while (session.state.eventTypeHistory.length > 10) session.state.eventTypeHistory.shift();
  }

  if (directorPlan?.objective) {
    const title = String(directorPlan.objective).trim().slice(0, 24);
    if (title && String(session.state?.objective?.title || '') !== title) {
      session.state.objective = session.state.objective || {};
      session.state.objective.title = title;
      session.state.objective.updatedAt = new Date();
    }
  }

  if (directorPlan?.arcId) session.state.arcId = String(directorPlan.arcId).slice(0, 48);
  if (directorPlan?.beat) session.state.beat = String(directorPlan.beat).slice(0, 24);
  if (directorPlan?.objectiveAdvance) {
    session.state.objective = session.state.objective || {};
    if (directorPlan.objectiveAdvance === 'advance') {
      session.state.objective.progress = Math.min(100, Number(session.state.objective.progress || 0) + 8);
      session.state.objective.lastAdvancedAt = new Date();
    } else if (directorPlan.objectiveAdvance === 'cost') {
      session.state.objective.progress = Math.min(100, Number(session.state.objective.progress || 0) + 4);
      session.state.objective.lastAdvancedAt = new Date();
    }
  }

  // 记录事件类型，防止模板化（只记录 v2 或有 eventType 的情况）
  if (directorPlan?.eventType) {
    if (!Array.isArray(session.state.eventTypeHistory)) session.state.eventTypeHistory = [];
    session.state.eventTypeHistory.push(String(directorPlan.eventType).slice(0, 24));
    while (session.state.eventTypeHistory.length > 10) session.state.eventTypeHistory.shift();
  }

  // 目标推进器：导演可更新本章目标（短）
  if (directorPlan?.objective) {
    const title = String(directorPlan.objective).trim().slice(0, 24);
    if (title && String(session.state?.objective?.title || '') !== title) {
      session.state.objective = session.state.objective || {};
      session.state.objective.title = title;
      session.state.objective.updatedAt = new Date();
    }
  }

  // 骨架定位
  if (directorPlan?.arcId) session.state.arcId = String(directorPlan.arcId).slice(0, 48);
  if (directorPlan?.beat) session.state.beat = String(directorPlan.beat).slice(0, 24);
  if (directorPlan?.objectiveAdvance) {
    session.state.objective = session.state.objective || {};
    if (directorPlan.objectiveAdvance === 'advance') {
      session.state.objective.progress = Math.min(100, Number(session.state.objective.progress || 0) + 8);
      session.state.objective.lastAdvancedAt = new Date();
    } else if (directorPlan.objectiveAdvance === 'cost') {
      session.state.objective.progress = Math.min(100, Number(session.state.objective.progress || 0) + 4);
      session.state.objective.lastAdvancedAt = new Date();
    }
  }
  
  // 保存段落（如果开启写真模式，标记为图片生成中）
  const paragraphIndex = session.paragraphs.length;
  const meta = {};
  if (workflowVersion === 'v2' && Array.isArray(directorPlan?.choices)) {
    meta.choices = directorPlan.choices
      .filter(Boolean)
      .slice(0, 3)
      .map((t) => ({ text: String(t).slice(0, 24), value: String(t).slice(0, 60), kind: 'choice' }));
  }
  if (generateImage && imageCharge) meta.imageCharge = Number(imageCharge) || 0;
  session.addParagraph(content, 'ai', null, null, null, meta);
  applyV2LightStateUpdates(session, paragraphIndex, content);
  
  // 标记图片生成状态
  if (generateImage && sceneData) {
    session.paragraphs[paragraphIndex].imageGenerating = true;
    session.paragraphs[paragraphIndex].sceneData = sceneData;
  }
  
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(3 + Math.random() * 2);

  // 更新 locationHistory（轻量防打转）
  if (!Array.isArray(session.state.locationHistory)) session.state.locationHistory = [];
  const currentScene = String(stateUpdate.scene || session.state.scene || '').trim();
  if (currentScene) {
    session.state.locationHistory.push({ scene: currentScene, at: new Date() });
    while (session.state.locationHistory.length > 12) session.state.locationHistory.shift();
  }
  
  // 更新好感度
  if (affectionChange) {
    session.updateAffection(affectionChange);
  }
  
  const payTrigger = updateMilestonePaywall(session, agent, directorPlan) || updateChapterPaywall(session);
  await session.save();

  // Attribution: 每段一条（异步失败不影响主流程）
  if (StoryAttribution) {
    try {
      const promptHash = crypto.createHash('sha256').update(String(directorPlan?.event || '') + '|' + (variant?.variantId || '')).digest('hex');
      const contextHash = crypto.createHash('sha256').update(String(buildContextBundle(session).packed || '')).digest('hex');
      await StoryAttribution.updateOne(
        { sessionId: session._id, paragraphIndex },
        {
          $setOnInsert: {
            sessionId: session._id,
            userId: session.userId,
            agentId: session.agentId,
            paragraphIndex,
          },
          $set: {
            workflowVersion,
            modelName,
            promptHash,
            contextHash,
            variantId: variant?.variantId || '',
            experimentId: variant?.experimentId,
            skeletonVersion: session.state.skeletonVersion || '',
            arcId: session.state.arcId || '',
            beat: session.state.beat || '',
            eventType: directorPlan?.eventType || '',
            validatePass: !!validateInfo?.ok,
            failReasons: validateInfo?.reasons || [],
            retryCount,
            criticUsed: !!criticPlan,
          }
        },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[StoryAttribution] write failed:', e?.message || e);
    }
  }
  
  // 更新角色累计互动次数
  await Agent.updateOne({ _id: session.agentId }, { $inc: { 'stats.totalInteractions': 1 } });
  
  console.log(`[StoryService] Story continued: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  // 如果开启写真模式，异步生成图片（不等待）
  if (generateImage && sceneData) {
    generateImageAsync(sessionId, paragraphIndex, agent, sceneData, session.affection?.level || 0);
  }

  // Metrics (logs)
  const totalMs = Date.now() - t0;
  const repeatedStart = normalizeFirstLine(content) === normalizeFirstLine(lastParagraph);
  console.log(
    `[StoryMetrics] action=continue session=${sessionId} idx=${paragraphIndex} workflow=${workflowVersion} model=${modelName} totalMs=${totalMs} llmMs=${llmMs} len=${content.length} repeatedStart=${repeatedStart} payTrigger=${payTrigger ? payTrigger.type : 'none'} valid=${validateInfo?.ok ? 1 : 0} reasons=${(validateInfo?.reasons || []).join(',')}`
  );
  
  return {
    content,
    paragraphIndex,
    paragraphs: sanitizeParagraphs(session.paragraphs), // 返回完整段落列表，确保 App 解析一致
    progress: session.progress,
    state: sanitizeSessionState(session.state),
    affection: session.affection,
    imageGenerating: generateImage && !!sceneData, // 告诉客户端是否在生成图片
    sceneData,
    workflowVersion,
    directorPlan,
    choices: session.paragraphs?.[paragraphIndex]?.choices || [],
    payTrigger,
  };
}

/**
 * 异步生成图片（后台运行，不阻塞主请求）
 */
async function generateImageAsync(sessionId, paragraphIndex, agent, sceneData, affectionLevel) {
  try {
    console.log(`[StoryService] Starting async image generation for session=${sessionId}, paragraph=${paragraphIndex}`);
    const imageStartTime = Date.now();
    
    const imageUrl = await generateSceneImageWithOpenAI(agent, sceneData, affectionLevel);
    
    console.log(`[StoryService] Async image generated in ${Date.now() - imageStartTime}ms`);
    
    // 更新段落的图片 URL
    if (imageUrl) {
      const session = await StorySession.findById(sessionId);
      if (session && session.paragraphs[paragraphIndex]) {
        session.paragraphs[paragraphIndex].imageUrl = imageUrl;
        session.paragraphs[paragraphIndex].imageGenerating = false;
        session.paragraphs[paragraphIndex].imageFailed = false;
        await session.save();
        console.log(`[StoryService] Image saved to paragraph ${paragraphIndex}`);
      }
    }
  } catch (error) {
    console.error('[StoryService] Async image generation failed:', error.message);
    // 标记图片生成失败
    try {
      const session = await StorySession.findById(sessionId);
      if (session && session.paragraphs[paragraphIndex]) {
        session.paragraphs[paragraphIndex].imageGenerating = false;
        session.paragraphs[paragraphIndex].imageFailed = true;

        // 失败补偿：退还写真额外扣费（如果有记录）
        const charge = Number(session.paragraphs[paragraphIndex].imageCharge || 0);
        const refunded = !!session.paragraphs[paragraphIndex].imageChargeRefunded;
        if (charge > 0 && !refunded) {
          try {
            await walletService.reward(
              String(session.userId),
              charge,
              'story_image_refund',
              `${sessionId}:${paragraphIndex}`,
              null,
              `refund:story_image:${sessionId}:${paragraphIndex}`
            );
            session.paragraphs[paragraphIndex].imageChargeRefunded = true;
            console.log(`[StoryService] Refunded image charge: +${charge} for session=${sessionId} paragraph=${paragraphIndex}`);
          } catch (refundErr) {
            console.warn('[StoryService] Refund failed:', refundErr.message);
          }
        }

        await session.save();
      }
    } catch (e) {
      console.error('[StoryService] Failed to update image status:', e.message);
    }
  }
}

/**
 * 使用 OpenAI GPT Image 1.5 生成情境图，如果被内容审核拦截则降级到 Fal.ai
 */
async function generateSceneImageWithOpenAI(agent, sceneData, affectionLevel = 0) {
  if (!sceneData) return null;
  
  // 构建角色视觉锚点
  const config = agent.storyConfig || {};
  const visualAnchor = {
    description: config.appearance || agent.description || '',
    signature: '',
    style: agent.style === 'anime' ? 'anime illustration style' : 'photorealistic'
  };
  
  // 创建一份安全的 sceneData 副本（移除可能触发审核的词汇）
  const safeSceneData = { ...sceneData };
  // OpenAI 不接受 sensual/intimate/alluring 等词，使用更温和的描述
  if (affectionLevel >= 60) {
    safeSceneData.mood = (safeSceneData.mood || '') + ', romantic, affectionate';
  } else if (affectionLevel >= 40) {
    safeSceneData.mood = (safeSceneData.mood || '') + ', charming, playful';
  }
  
  try {
    // 首先尝试 OpenAI GPT Image 1.5
    const imageUrl = await openaiImageService.generateSceneImage(
      { ...agent.toObject(), visualAnchor },
      safeSceneData,
      { quality: 'medium', size: '1024x1536' }
    );
    return imageUrl;
  } catch (error) {
    console.error('[StoryService] OpenAI image generation failed:', error.message);
    
    // 如果被内容审核拦截，降级到 Fal.ai
    if (error.message?.includes('moderation') || error.message?.includes('400')) {
      console.log('[StoryService] OpenAI blocked, falling back to Fal.ai...');
      return await generateSceneImageWithFal(agent, sceneData, affectionLevel);
    }
    
    return null;
  }
}

/**
 * 使用 Fal.ai Flux 生成情境图（降级方案，内容限制更宽松）
 */
async function generateSceneImageWithFal(agent, sceneData, affectionLevel = 0) {
  const config = agent.storyConfig || {};
  const appearance = config.appearance || agent.description || '';
  
  // 构建 Fal.ai 兼容的 prompt
  const style = agent.style === 'anime' 
    ? 'anime style, illustration, masterpiece, best quality, ' 
    : 'photorealistic, 8k uhd, dslr, soft lighting, high quality, beautiful woman, ';
  
  let prompt = `${style}${appearance}`;
  if (sceneData.clothing) prompt += `, wearing ${sceneData.clothing}`;
  if (sceneData.pose) prompt += `, ${sceneData.pose}`;
  if (sceneData.expression) prompt += `, ${sceneData.expression}`;
  if (sceneData.background) prompt += `, ${sceneData.background}`;
  if (sceneData.lighting) prompt += `, ${sceneData.lighting}`;
  
  // 好感度影响尺度
  if (affectionLevel >= 60) {
    prompt = `sensual, intimate, ${prompt}`;
  } else if (affectionLevel >= 40) {
    prompt = `flirty, alluring, ${prompt}`;
  }
  
  const referenceImage = agent.avatarUrls?.[0] || agent.avatarUrl;
  if (!referenceImage) {
    console.warn('[StoryService] No reference image for Fal.ai');
    return null;
  }
  
  try {
    console.log(`[StoryService] Generating with Fal.ai: ${prompt.substring(0, 80)}...`);
    const results = await imageGenerationService.generate(prompt, {
      referenceImage,
      count: 1,
      width: 768,
      height: 1024,
      strength: 0.7,
      style: agent.style || 'realistic'
    });
    
    if (results && results.length > 0 && results[0].url) {
      console.log('[StoryService] Fal.ai fallback succeeded');
      return results[0].url;
    }
    return null;
  } catch (falError) {
    console.error('[StoryService] Fal.ai fallback also failed:', falError.message);
    return null;
  }
}

/**
 * 用户输入推进故事 - 文字先返回，图片异步生成
 */
async function inputStory(sessionId, userInput, options = {}) {
  const { generateImage = false, imageCharge = 0 } = options; // 默认不生成图片，需要用户开启写真模式
  const t0 = Date.now();
  
  const session = await StorySession.findById(sessionId);
  if (!session) throw new Error('故事不存在');
  // 故事永不结束，不检查 status

  const agent = await Agent.findById(session.agentId);
  if (!agent) throw new Error('角色不存在');

  syncNextMilestoneHint(session, agent);
  
  const modelName = agent.modelName || 'grok-2';
  const variant = await pickPromptVariant(session.agentId, session.userId);
  const workflowVersion = pickWorkflowVersion(session, options);
  session.state.workflow = workflowVersion;

  let rawResponse;
  let directorPlan = null;
  let llmMs = 0;
  let validateInfo = null;
  let criticPlan = null;
  let retryCount = 0;

  const recentParas = session.paragraphs?.slice(-3).map((p) => p.content) || [];
  const lastParagraph = session.paragraphs?.slice(-1)[0]?.content || '';

  if (StoryAttribution && session.paragraphs.length > 0) {
    try {
      await StoryAttribution.updateOne(
        { sessionId: session._id, paragraphIndex: session.paragraphs.length - 1 },
        { $set: { continued: true } },
        { upsert: false }
      );
    } catch {}
  }
  let parsed = null;
  let content = '';
  let affectionChange = 0;
  let stateChanges = {};
  let sceneData = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (workflowVersion === 'v2') {
      const directorSystem = buildDirectorSystemPrompt(agent, session) + (variant?.prompt ? `\n【变体提示】\n${variant.prompt}\n` : '');
      const directorUser = buildDirectorUserPrompt(session, `回应玩家输入并推进：${userInput}`);
      const directorStart = Date.now();
      const directorRaw = await generateContent(directorSystem, directorUser, modelName, { maxTokens: 180, temperature: 0.4 });
      const directorMs = Date.now() - directorStart;
      llmMs += directorMs;

      const parsedDirector = safeJsonParseFromText(directorRaw) || {};
      const checked1 = validateDirectorPlan(parsedDirector);
      if (!checked1.ok) {
        const directorRaw2 = await generateContent(
          directorSystem,
          directorUser + '\n【修正】eventType+event 必填：event 必须1句短句(含2-4关键词)，可执行，且尽量不要与最近事件类型重复。',
          modelName,
          { maxTokens: 220, temperature: 0.4 }
        );
        directorPlan = (validateDirectorPlan(safeJsonParseFromText(directorRaw2) || {}).plan);
      } else {
        directorPlan = checked1.plan;
      }

      const writerSystem = buildWriterSystemPrompt(agent, session, directorPlan, generateImage) + (variant?.prompt ? `\n【变体提示】\n${variant.prompt}\n` : '');
      let writerUser = buildWriterUserPrompt(session, directorPlan, userInput);
      if (attempt === 1) {
        writerUser += '\n【纠错】你刚才重复/无推进：必须换场景或引入新人物/新证据，并落实 event。';
        if (criticPlan) {
          writerUser += `\n【Critic诊断】${criticPlan.diagnosis || ''}\n` +
            `【必须包含】${(criticPlan.mustInclude || []).join('；')}\n` +
            `【避免短语】${(criticPlan.avoidPhrases || []).join('；')}\n` +
            (criticPlan.rewriteHint ? `【改写提示】${criticPlan.rewriteHint}\n` : '');
        }
      } else if (attempt >= 2) {
        writerUser += '\n【强制模板】第一句=事件；第二句=反应；第三句=推进(决定/代价)；最后一句=悬念(被发现/证据出现)。';
        if (criticPlan) {
          writerUser += `\n【必须包含】${(criticPlan.mustInclude || []).join('；')}\n`;
        }
      }
      const writerStart = Date.now();
      rawResponse = await generateContent(writerSystem, writerUser, modelName, { maxTokens: generateImage ? 480 : 400, temperature: 0.9 });
      const writerMs = Date.now() - writerStart;
      llmMs += writerMs;
    } else {
      const systemPrompt = generateImage ? buildSystemPromptWithScene(agent, session) : buildSystemPrompt(agent, session);
      let userPrompt = buildUserInputPrompt(session, userInput);
      if (attempt === 1) {
        userPrompt += '\n【纠错】你刚才重复/无推进：必须发生新事件(有人闯入/电话/证据/被发现)并推动到新决定。';
        if (criticPlan) {
          userPrompt += `\n【Critic诊断】${criticPlan.diagnosis || ''}\n` +
            `【必须包含】${(criticPlan.mustInclude || []).join('；')}\n` +
            `【避免短语】${(criticPlan.avoidPhrases || []).join('；')}\n` +
            (criticPlan.rewriteHint ? `【改写提示】${criticPlan.rewriteHint}\n` : '');
        }
      } else if (attempt >= 2) {
        userPrompt += '\n【强制模板】事件(第一句)→反应(感官)→推进(决定/代价)→悬念(最后一句)。';
        if (criticPlan) {
          userPrompt += `\n【必须包含】${(criticPlan.mustInclude || []).join('；')}\n`;
        }
      }
      const maxTokens = generateImage ? 450 : 380;
      const startTime = Date.now();
      rawResponse = await generateContent(systemPrompt, userPrompt, modelName, { maxTokens, temperature: 0.9 });
      const oneMs = Date.now() - startTime;
      llmMs += oneMs;
    }

    parsed = parseAIResponse(rawResponse);
    ({ affectionChange, stateChanges, sceneData } = parsed);
    content = ensureShortDramaFormat(parsed.content, lastParagraph);

    validateInfo = validateParagraph({
      text: content,
      recentParas,
      directorPlan,
      sessionState: session.state,
    });
    if (validateInfo.ok) break;

    if (!criticPlan) {
      try {
        criticPlan = await runCritic({
          modelName,
          recentParas,
          lastText: lastParagraph,
          draftText: content,
          directorPlan,
          validateInfo,
          sessionState: session.state,
        });
      } catch (e) {
        console.warn('[StoryService] Critic failed:', e?.message || e);
        criticPlan = null;
      }
    }
  }
  retryCount = validateInfo?.ok ? Math.max(0, (validateInfo?.reasons?.length ? 1 : 0)) : 2;
  
  const stateUpdate = extractStateUpdate(content);
  // 合并 AI 返回的状态变化
  if (stateChanges.expression) stateUpdate.expression = stateChanges.expression;
  if (stateChanges.action) stateUpdate.action = stateChanges.action;
  if (stateChanges.mood) stateUpdate.mood = stateChanges.mood;
  
  if (workflowVersion === 'v2' && directorPlan) {
    if (directorPlan.beat) stateUpdate.beat = directorPlan.beat;
    if (directorPlan.conflict) stateUpdate.conflict = directorPlan.conflict;
    if (directorPlan.stakes) stateUpdate.stakes = directorPlan.stakes;
    if (directorPlan.openLoop) {
      if (!Array.isArray(session.state.openLoops)) session.state.openLoops = [];
      addUniqueLimited(session.state.openLoops, directorPlan.openLoop, 7);
    }
    if (directorPlan.canonFactAdd) {
      if (!Array.isArray(session.state.canonFacts)) session.state.canonFacts = [];
      addUniqueLimited(session.state.canonFacts, directorPlan.canonFactAdd, 12);
    }
  }

  if (directorPlan?.milestoneHit) {
    if (!Array.isArray(session.state.milestonesHit)) session.state.milestonesHit = [];
    addUniqueLimited(session.state.milestonesHit, String(directorPlan.milestoneHit).slice(0, 64), 50);
  }
  
  // 保存段落（如果开启写真模式，标记为图片生成中）
  const paragraphIndex = session.paragraphs.length;
  const meta = {};
  if (workflowVersion === 'v2' && Array.isArray(directorPlan?.choices)) {
    meta.choices = directorPlan.choices
      .filter(Boolean)
      .slice(0, 3)
      .map((t) => ({ text: String(t).slice(0, 24), value: String(t).slice(0, 60), kind: 'choice' }));
  }
  if (generateImage && imageCharge) meta.imageCharge = Number(imageCharge) || 0;
  session.addParagraph(content, 'user_input', userInput, null, null, meta);
  applyV2LightStateUpdates(session, paragraphIndex, content);
  
  // 标记图片生成状态
  if (generateImage && sceneData) {
    session.paragraphs[paragraphIndex].imageGenerating = true;
    session.paragraphs[paragraphIndex].sceneData = sceneData;
  }
  
  session.updateState(stateUpdate);
  if (stateUpdate.newEvent) session.addEvent(stateUpdate.newEvent);
  session.advanceProgress(2 + Math.random() * 3);

  // 更新 locationHistory（轻量防打转）
  if (!Array.isArray(session.state.locationHistory)) session.state.locationHistory = [];
  const currentScene = String(stateUpdate.scene || session.state.scene || '').trim();
  if (currentScene) {
    session.state.locationHistory.push({ scene: currentScene, at: new Date() });
    while (session.state.locationHistory.length > 12) session.state.locationHistory.shift();
  }
  
  // 用户输入通常会增加好感度（如果 AI 没返回变化则默认+2）
  const actualChange = affectionChange || 2;
  session.updateAffection(actualChange);
  
  const payTrigger = updateMilestonePaywall(session, agent, directorPlan) || updateChapterPaywall(session);
  await session.save();

  if (StoryAttribution) {
    try {
      const promptHash = crypto.createHash('sha256').update(String(directorPlan?.event || '') + '|' + (variant?.variantId || '')).digest('hex');
      const contextHash = crypto.createHash('sha256').update(String(buildContextBundle(session).packed || '')).digest('hex');
      await StoryAttribution.updateOne(
        { sessionId: session._id, paragraphIndex },
        {
          $setOnInsert: {
            sessionId: session._id,
            userId: session.userId,
            agentId: session.agentId,
            paragraphIndex,
          },
          $set: {
            workflowVersion,
            modelName,
            promptHash,
            contextHash,
            variantId: variant?.variantId || '',
            experimentId: variant?.experimentId,
            skeletonVersion: session.state.skeletonVersion || '',
            arcId: session.state.arcId || '',
            beat: session.state.beat || '',
            eventType: directorPlan?.eventType || '',
            validatePass: !!validateInfo?.ok,
            failReasons: validateInfo?.reasons || [],
            retryCount,
            criticUsed: !!criticPlan,
          }
        },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[StoryAttribution] write failed:', e?.message || e);
    }
  }
  
  // 更新角色累计互动次数
  await Agent.updateOne({ _id: session.agentId }, { $inc: { 'stats.totalInteractions': 1 } });
  
  console.log(`[StoryService] Story input: sessionId=${sessionId}, progress=${session.progress}%, affection=${session.affection.level}%`);
  
  // 如果开启写真模式，异步生成图片（不等待）
  if (generateImage && sceneData) {
    generateImageAsync(sessionId, paragraphIndex, agent, sceneData, session.affection?.level || 0);
  }

  const totalMs = Date.now() - t0;
  const repeatedStart = normalizeFirstLine(content) === normalizeFirstLine(lastParagraph);
  console.log(
    `[StoryMetrics] action=input session=${sessionId} idx=${paragraphIndex} workflow=${workflowVersion} model=${modelName} totalMs=${totalMs} llmMs=${llmMs} len=${content.length} repeatedStart=${repeatedStart} payTrigger=${payTrigger ? payTrigger.type : 'none'} valid=${validateInfo?.ok ? 1 : 0} reasons=${(validateInfo?.reasons || []).join(',')}`
  );
  
  return {
    content,
    paragraphIndex,
    paragraphs: sanitizeParagraphs(session.paragraphs), // 返回完整段落列表
    progress: session.progress,
    state: sanitizeSessionState(session.state),
    affection: session.affection,
    imageGenerating: generateImage && !!sceneData,
    sceneData,
    workflowVersion,
    directorPlan,
    choices: session.paragraphs?.[paragraphIndex]?.choices || [],
    payTrigger,
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
    state: sanitizeSessionState(session.state),
    paragraphs: sanitizeParagraphs(session.paragraphs),
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
 * 生成写真 - 使用 GPT Image 1.5 基于当前场景生成高质量角色写真
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
  
  // 根据好感度和当前状态构建场景数据
  let pose = '';
  let expression = '';
  let clothing = state.clothes || '日常装扮';
  let mood = '';
  
  // 根据好感度阶段决定写真风格
  if (affection.level >= 80) {
    pose = 'seductive pose, lying on bed, looking at viewer with love';
    expression = 'loving eyes, gentle smile, intimate look';
    mood = 'romantic, intimate, sensual';
  } else if (affection.level >= 60) {
    pose = 'sensual pose, leaning forward playfully';
    expression = 'flirty smile, bedroom eyes, teasing look';
    mood = 'flirty, alluring, playful';
  } else if (affection.level >= 40) {
    pose = 'cute pose, tilting head, hands near face';
    expression = 'shy smile, blushing, curious look';
    mood = 'cute, shy, sweet';
  } else if (affection.level >= 20) {
    pose = 'casual relaxed pose, standing naturally';
    expression = 'friendly warm smile, soft expression';
    mood = 'friendly, warm, approachable';
  } else {
    pose = 'formal elegant pose, standing gracefully';
    expression = 'polite smile, reserved but curious look';
    mood = 'formal, elegant, reserved';
  }
  
  // 添加当前状态信息
  if (state.expression) expression = state.expression + ', ' + expression;
  if (state.action) pose = state.action + ', ' + pose;
  if (state.mood) mood = state.mood + ', ' + mood;
  
  // 构建场景数据（给 GPT Image 1.5）
  const sceneData = {
    clothing,
    pose,
    expression,
    background: state.scene || '温馨室内环境',
    lighting: 'soft natural lighting, professional photography',
    mood
  };
  
  const isNsfw = affection.level >= 60;
  if (isNsfw) {
    sceneData.mood += ', sensual, intimate';
  }
  
  console.log(`[StoryService] 生成写真 (GPT Image 1.5):`, sceneData);
  
  try {
    // 使用 GPT Image 1.5 生成
    const imageUrl = await generateSceneImageWithOpenAI(agent, sceneData, affection.level);
    
    if (imageUrl) {
      console.log('[StoryService] 写真生成成功 (GPT Image 1.5)');
      
      // 保存到用户画廊
      try {
        await UserGallery.addToGallery({
          userId: session.userId,
          agentId: session.agentId,
          mediaType: 'image',
          mediaUrl: imageUrl,
          source: 'photo',
          storySessionId: session._id,
          prompt: JSON.stringify(sceneData),
          context: `好感度 ${affection.level}% - ${affection.stage}`,
          isNsfw: isNsfw,
        });
        console.log('[StoryService] 写真已保存到用户画廊');
      } catch (galleryErr) {
        console.warn('[StoryService] 写真保存到画廊失败:', galleryErr.message);
      }
      
      return {
        imageUrl,
        sceneData,
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
