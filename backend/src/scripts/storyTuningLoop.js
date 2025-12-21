/**
 * Story tuning loop (self-play)
 *
 * Purpose:
 * - Run multiple rounds of "Director -> Writer -> Validate -> Critic -> Rewrite"
 * - Print failure reasons distribution to help tune thresholds/prompts
 *
 * Usage:
 *   node backend/src/scripts/storyTuningLoop.js
 *
 * Env:
 *   STORY_MODEL=grok-2
 *   STORY_CRITIC_MODEL=deepseek-v3-fast (or grok-2)
 */
const crypto = require('crypto');
const ProviderFactory = require('../providers/providerFactory');

// Lightweight copies of key helpers from storyService (kept here to avoid DB usage)
function safeJsonParseFromText(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const fenced = s.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : s;
  const brace = candidate.match(/\{[\s\S]*\}/);
  if (!brace) return null;
  try {
    return JSON.parse(brace[0]);
  } catch {
    return null;
  }
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
  '决定', '答应', '拒绝', '同意', '条件', '交易', '威胁', '报警',
  '钥匙', '日记', '信', '信封', '抽屉', '文件', 'U盘', '硬盘', '录像', '对讲机',
  '报警器', '警报', '摄像头', '监控室', '密码', '锁', '撬', '破门', '闯入', '追', '抓', '躲',
  '检查', '通知', '消息', '纸条', '检查员',
  'door', 'knock', 'footstep', 'phone', 'call', 'message', 'key', 'diary', 'evidence', 'security', 'police', 'alarm', 'camera', 'recording',
];

function extractEventKeywords(eventText) {
  const s = String(eventText || '').trim();
  if (!s) return [];
  return s
    .split(/[\s，。！？、:：；;,.!?()\[\]{}"“”'‘’\-—]+/g)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .slice(0, 6);
}

function validateParagraph({ text, recentParas, directorPlan }) {
  const out = String(text || '').trim();
  const recent = Array.isArray(recentParas) ? recentParas.filter(Boolean) : [];
  const last = recent.length ? String(recent[recent.length - 1]) : '';
  const curStart = normalizeFirstLine(out);
  const lastStart = normalizeFirstLine(last);
  if (curStart && lastStart && curStart === lastStart) {
    return { ok: false, reasons: ['opening_repeat'] };
  }
  // avoid meta headings
  if (/^\s*(事件|反应|推进|悬念)\s*[:：]/.test(out) || out.includes('反应：') || out.includes('推进：')) {
    return { ok: false, reasons: ['meta_headings'] };
  }
  const cur3 = charNgrams(out, 3);
  let maxOverlap = 0;
  for (const r of recent.slice(-3)) {
    maxOverlap = Math.max(maxOverlap, overlapRatio(cur3, charNgrams(String(r), 3)));
  }
  if (maxOverlap >= 0.38) return { ok: false, reasons: ['high_ngram_overlap'] };
  const hasEventTrigger = EVENT_TRIGGERS.some((w) => out.includes(w));
  if (!hasEventTrigger) return { ok: false, reasons: ['no_event_trigger'] };
  const event = directorPlan?.event;
  if (event) {
    const kws = extractEventKeywords(event);
    const hit = kws.filter((k) => out.includes(k)).length;
    const need = kws.length ? Math.max(1, Math.ceil(kws.length * 0.2)) : 0;
    if (kws.length && hit < need) {
      const first = (out.split('\n').find(Boolean) || out).slice(0, 120);
      const sim = overlapRatio(charNgrams(event, 2), charNgrams(first, 2));
      if (sim < 0.22) return { ok: false, reasons: ['director_event_not_realized'] };
    }
  }
  const t = directorPlan?.eventType;
  if (!t) return { ok: false, reasons: ['missing_eventType'] };
  return { ok: true, reasons: [] };
}

async function chat(model, messages, temperature, maxTokens) {
  const provider = ProviderFactory.getProvider(model);
  const res = await provider.chat(model, messages, temperature, { maxTokens });
  return res.content;
}

function buildDirectorSystem(agentName) {
  return (
    `你是短剧导演，只输出 JSON。\n` +
    `eventType 必填，只能从 intrusion/evidence/reveal/decision/relocate/conflict/escape。\n` +
    `event 必填，必须 1 句短句，含 2-4 个关键词（便于落地）。\n` +
    `JSON: eventType, event, twist, hook, stakes, choices(2-3).\n` +
    `角色：${agentName}；边界：R18_soft。\n`
  );
}

function buildWriterSystem(agentName, plan) {
  return (
    `你是短剧编剧（只用中文）。\n` +
    `角色用「${agentName}」名字表达，用户用“你”。\n` +
    `第一句必须落实 event：${plan.event}\n` +
    `禁止输出“事件/反应/推进/悬念”等小标题，只写正文。\n` +
    `结构：事件→反应→推进→悬念。\n` +
    `120-180字；边界：R18_soft。\n`
  );
}

function buildCriticSystem() {
  return (
    `你是挑刺审核官，只输出 JSON。\n` +
    `目标：修复重复/无推进/事件不落地。\n` +
    `JSON: mustInclude(>=3), avoidPhrases, rewriteHint, forceTemplate.\n`
  );
}

function buildCriticUser({ recent, draft, plan, failReasons }) {
  return (
    `最近：\n${recent.map((t, i) => `(${i + 1}) ${String(t).slice(0, 180)}`).join('\n')}\n\n` +
    `导演event：${plan.event}\n` +
    `草稿：${String(draft).slice(0, 220)}\n` +
    `失败原因：${failReasons.join(',')}\n`
  );
}

async function runRound({ round, model, criticModel }) {
  const agentName = 'Momose Sensei';
  const session = {
    id: crypto.randomUUID?.() || crypto.randomBytes(8).toString('hex'),
    paragraphs: [
      '夜里，空荡的教室只剩粉笔灰的味道。百濑老师把门反锁，低声说：“别紧张，只是补课。”门外却忽然传来脚步声——'
    ],
    eventTypes: [],
  };

  const failCounts = new Map();
  for (let step = 0; step < 6; step += 1) {
    const recent = session.paragraphs.slice(-3);
    const recentTypes = session.eventTypes.slice(-2);
    // Director
    const director = await chat(model, [
      { role: 'system', content: buildDirectorSystem(agentName) },
      { role: 'user', content: `续写下一段。避免重复事件类型：${recentTypes.join('->') || '(无)'}。\n最近：\n${recent.join('\n---\n')}` },
    ], 0.4, 180);
    const plan = safeJsonParseFromText(director) || { eventType: 'intrusion', event: '敲门声逼近，百濑老师拉你躲到讲台后' };
    // Writer
    let draft = await chat(model, [
      { role: 'system', content: buildWriterSystem(agentName, plan) },
      { role: 'user', content: `输出正文。` },
    ], 0.9, 420);
    let v = validateParagraph({ text: draft, recentParas: recent, directorPlan: plan });

    // Retry with Critic once if fail
    if (!v.ok) {
      for (const r of v.reasons) failCounts.set(r, (failCounts.get(r) || 0) + 1);
      const critic = await chat(criticModel, [
        { role: 'system', content: buildCriticSystem() },
        { role: 'user', content: buildCriticUser({ recent, draft, plan, failReasons: v.reasons }) },
      ], 0.2, 220);
      const c = safeJsonParseFromText(critic) || {};
      const mustInclude = Array.isArray(c.mustInclude) ? c.mustInclude.slice(0, 5).join('；') : '';
      const rewriteHint = typeof c.rewriteHint === 'string' ? c.rewriteHint : '';
      const forceTemplate = !!c.forceTemplate;
      const rewriteUser =
        `你刚才失败原因：${v.reasons.join(',')}。\n` +
        (mustInclude ? `必须包含：${mustInclude}\n` : '') +
        (rewriteHint ? `改写提示：${rewriteHint}\n` : '') +
        (forceTemplate ? `强制模板：事件→反应→推进→悬念。\n` : '');
      draft = await chat(model, [
        { role: 'system', content: buildWriterSystem(agentName, plan) },
        { role: 'user', content: rewriteUser },
      ], 0.8, 420);
      v = validateParagraph({ text: draft, recentParas: recent, directorPlan: plan });
      if (!v.ok) for (const r of v.reasons) failCounts.set(r, (failCounts.get(r) || 0) + 1);
    }

    session.paragraphs.push(String(draft).trim());
    if (plan.eventType) session.eventTypes.push(String(plan.eventType));
  }

  const sorted = [...failCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n=== Round ${round} done ===`);
  console.log('Top failure reasons:', sorted.slice(0, 6));
  console.log('Last paragraph sample:', session.paragraphs.at(-1)?.slice(0, 140));
}

async function main() {
  const model = process.env.STORY_MODEL || 'grok-2';
  const criticModel = process.env.STORY_CRITIC_MODEL || model;
  console.log(`Using model=${model}, criticModel=${criticModel}`);
  for (let r = 1; r <= 5; r += 1) {
    await runRound({ round: r, model, criticModel });
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

