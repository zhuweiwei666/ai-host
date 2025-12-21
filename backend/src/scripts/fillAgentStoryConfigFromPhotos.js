/**
 * Fill Agent.storyConfig (appearance/personality/backstory/skeleton/opening/tagline/synopsis)
 * from each agent's avatar photo using a vision-capable chat model.
 *
 * Usage (inside backend container / server):
 *   node src/scripts/fillAgentStoryConfigFromPhotos.js
 *   node src/scripts/fillAgentStoryConfigFromPhotos.js --force
 *   node src/scripts/fillAgentStoryConfigFromPhotos.js --limit=50
 *   node src/scripts/fillAgentStoryConfigFromPhotos.js --dry-run
 *
 * Env:
 * - MONGO_URI
 * - AIHUBMIX_API_KEY or OPENAI_API_KEY
 * - AIHUBMIX_BASE_URL (optional, proxy)
 */
require('dotenv').config();

const connectDB = require('../config/db');
const Agent = require('../models/Agent');
const OpenAIProvider = require('../providers/openaiProvider');

function parseArgs(argv) {
  const args = { force: false, dryRun: false, limit: 0, model: 'gpt-4o-mini', onlyMissing: true };
  for (const a of argv.slice(2)) {
    if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--all') args.onlyMissing = false;
    else if (a.startsWith('--limit=')) args.limit = Number(a.split('=')[1] || 0) || 0;
    else if (a.startsWith('--model=')) args.model = String(a.split('=')[1] || '').trim() || args.model;
  }
  return args;
}

function pickBestPhotoUrl(agent) {
  const list = []
    .concat(Array.isArray(agent?.avatarUrls) ? agent.avatarUrls : [])
    .concat(agent?.avatarUrl ? [agent.avatarUrl] : [])
    .concat(Array.isArray(agent?.privatePhotoUrls) ? agent.privatePhotoUrls : [])
    .filter(Boolean);
  return list[0] || '';
}

function extractJson(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  // Remove ```json fences if any
  const noFence = t.replace(/```json\s*/i, '').replace(/```/g, '').trim();
  // Try direct parse
  try {
    return JSON.parse(noFence);
  } catch {}
  // Fallback: first {...} block
  const m = noFence.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function buildSystemPrompt() {
  return [
    '你是资深“短剧式互动剧情”设定编辑与编剧总监。',
    '目标：基于“角色照片”，为互动故事生成可运营的角色设定与剧情骨架。',
    '',
    '强约束：',
    '- 只输出严格 JSON（不要 markdown、不要解释、不要多余字段）。',
    '- 内容要“前期强吸引力/强钩子”，但必须遵守 R18_soft：只写暧昧、挑逗、心理拉扯、贴近与越界边缘；不得出现露骨性行为/性器官细节/明确性描写。',
    '- 叙事：第三人称用角色名做动作描写；用户统一用“你”。',
    '- 设定要与照片风格一致（现实/二次元、服装、场景气质）。',
    '',
    '输出 JSON schema（顶层字段）：',
    '{',
    '  "storyConfig": {',
    '    "tagline": string,',
    '    "synopsis": string,',
    '    "opening": string,',
    '    "appearance": string,',
    '    "personality": string,',
    '    "backstory": string,',
    '    "skeleton": {',
    '      "version": "v1",',
    '      "canonFacts": string[],',
    '      "arcs": [',
    '        {',
    '          "arcId": "A1",',
    '          "title": string,',
    '          "objective": { "title": string, "detail": string },',
    '          "beats": ["hook","escalation","reveal","crisis","passion","payoff"],',
    '          "eventTypeSchedule": { "window": 6, "minDistinct": 3 },',
    '          "milestones": [',
    '            { "id": "M1", "type": string, "title": string, "requiredKeywords": string[], "paywall": { "enabled": false, "cost": 0, "reason": "" } },',
    '            { "id": "M2", "type": string, "title": string, "requiredKeywords": string[], "paywall": { "enabled": true, "cost": number, "reason": string } },',
    '            { "id": "M3", "type": string, "title": string, "requiredKeywords": string[], "paywall": { "enabled": true, "cost": number, "reason": string } },',
    '            { "id": "M4", "type": string, "title": string, "requiredKeywords": string[], "paywall": { "enabled": false, "cost": 0, "reason": "" } }',
    '          ]',
    '        }',
    '      ]',
    '    }',
    '  }',
    '}',
  ].join('\n');
}

function buildUserPrompt(agentName, agentStyle, agentGender) {
  return [
    `角色名：${agentName || '未命名'}`,
    `风格：${agentStyle || 'realistic'}（realistic=真人写实 / anime=二次元）`,
    `性别：${agentGender || 'female'}`,
    '',
    '请基于照片推断：外观特征、气质、适合的身份/场景，并生成“短剧式开场 + 骨架”。',
    '要求：opening 120~180字，第一句必须是强钩子（冲突/意外/被抓包/危险靠近/身份揭露），结尾要留悬念。',
    'tagline 10~18字，synopsis 40~70字。',
    'milestones 里必须包含：',
    '- 一个“秘密/真相”类（paywall 开启）',
    '- 一个“越界前一秒/强张力”类（paywall 开启）',
    '- requiredKeywords 给 3~6 个中文关键词，便于命中与校验。',
  ].join('\n');
}

async function generateConfigFromPhoto(provider, { model, agent, photoUrl }) {
  const system = buildSystemPrompt();
  const userText = buildUserPrompt(agent?.name, agent?.style, agent?.gender);

  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: photoUrl } },
      ],
    },
  ];

  const r = await provider.chat(model, messages, 0.6, { maxTokens: 1200 });
  const parsed = extractJson(r?.content);
  if (parsed) return parsed;

  // Retry once with stricter instruction
  const retryMessages = [
    { role: 'system', content: system + '\n\n再次强调：只输出严格 JSON，不要代码块围栏。' },
    { role: 'user', content: messages[1].content },
  ];
  const r2 = await provider.chat(model, retryMessages, 0.2, { maxTokens: 1200 });
  const parsed2 = extractJson(r2?.content);
  if (!parsed2) throw new Error('LLM output is not valid JSON');
  return parsed2;
}

function shouldFill(agent, args) {
  const sc = agent?.storyConfig || {};
  if (!args.onlyMissing) return true;
  const missingSkeleton = !sc.skeleton || !sc.skeleton?.arcs?.length;
  const missingAppearance = !sc.appearance || String(sc.appearance).trim().length < 10;
  const missingOpening = !sc.opening || String(sc.opening).trim().length < 30;
  const missingMeta = !sc.tagline || !sc.synopsis;
  return missingSkeleton || missingAppearance || missingOpening || missingMeta;
}

function mergeStoryConfig(existing, incoming, force) {
  const ex = existing || {};
  const inc = incoming || {};
  const out = { ...ex };

  const setIf = (k) => {
    if (force || !ex[k] || String(ex[k]).trim() === '') out[k] = inc[k];
  };

  setIf('tagline');
  setIf('synopsis');
  setIf('opening');
  setIf('appearance');
  setIf('personality');
  setIf('backstory');
  if (force || !ex.skeleton) out.skeleton = inc.skeleton;

  // Ensure required nested objects exist (old docs may not have defaults materialized)
  if (typeof out.enabled !== 'boolean') out.enabled = true;
  if (!out.contentRating || typeof out.contentRating !== 'string') out.contentRating = 'moderate';
  if (!out.paragraphLength || typeof out.paragraphLength !== 'object') {
    out.paragraphLength = { min: 200, max: 500 };
  } else {
    const min = Number(out.paragraphLength.min);
    const max = Number(out.paragraphLength.max);
    out.paragraphLength = {
      min: Number.isFinite(min) ? min : 200,
      max: Number.isFinite(max) ? max : 500,
    };
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  await connectDB();

  const provider = new OpenAIProvider();

  const query = {}; // 全量处理（包含 user 创建角色）
  const cursor = Agent.find(query).sort({ updatedAt: -1 });
  const agents = await cursor.exec();

  console.log(`[FillAgentStoryConfig] agents=${agents.length} force=${args.force} onlyMissing=${args.onlyMissing} dryRun=${args.dryRun} model=${args.model}`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const agent of agents) {
    if (args.limit > 0 && processed >= args.limit) break;
    processed += 1;

    if (!shouldFill(agent, args)) {
      skipped += 1;
      continue;
    }

    const photoUrl = pickBestPhotoUrl(agent);
    if (!photoUrl) {
      console.warn(`[FillAgentStoryConfig] skip(no photo): agent=${agent._id} name=${agent.name}`);
      skipped += 1;
      continue;
    }

    try {
      const gen = await generateConfigFromPhoto(provider, { model: args.model, agent, photoUrl });
      const incoming = gen?.storyConfig || {};
      if (!incoming?.skeleton?.arcs?.length) throw new Error('missing skeleton in generated result');

      agent.storyConfig = mergeStoryConfig(agent.storyConfig, incoming, args.force);
      // Ensure schema defaults
      agent.storyConfig.enabled = true;

      if (!args.dryRun) await agent.save();
      updated += 1;
      console.log(`[FillAgentStoryConfig] updated: agent=${agent._id} name=${agent.name} photo=${photoUrl}`);
    } catch (e) {
      failed += 1;
      console.warn(`[FillAgentStoryConfig] failed: agent=${agent._id} name=${agent.name} err=${e?.message || e}`);
    }
  }

  console.log(`[FillAgentStoryConfig] done processed=${processed} updated=${updated} skipped=${skipped} failed=${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[FillAgentStoryConfig] fatal:', e);
  process.exit(1);
});

