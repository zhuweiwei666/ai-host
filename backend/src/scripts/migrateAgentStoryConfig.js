/**
 * 数据库迁移脚本：为现有角色添加 storyConfig 默认值
 * 
 * 用法：
 * node backend/src/scripts/migrateAgentStoryConfig.js
 * 
 * 或在服务器上：
 * docker compose exec backend node src/scripts/migrateAgentStoryConfig.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-host';

// 默认的故事节拍
const defaultStoryBeats = [
  { progressRange: [0, 15], goal: '初次相遇，产生好奇', sceneHint: '偶遇的场景', moodHint: '好奇' },
  { progressRange: [15, 30], goal: '增加接触，建立好感', sceneHint: '日常互动', moodHint: '友善' },
  { progressRange: [30, 45], goal: '暧昧升级，试探边界', sceneHint: '私密空间', moodHint: '暧昧' },
  { progressRange: [45, 60], goal: '情感爆发，关系突破', sceneHint: '关键场景', moodHint: '激动' },
  { progressRange: [60, 75], goal: '亲密关系建立', sceneHint: '浪漫场景', moodHint: '热烈' },
  { progressRange: [75, 90], goal: '深入发展', sceneHint: '私密空间', moodHint: '缠绵' },
  { progressRange: [90, 100], goal: '故事高潮与收尾', sceneHint: '温馨场景', moodHint: '温馨' },
];

// 根据角色名生成开场白
function generateOpening(agent) {
  const templates = [
    `那是一个寻常的傍晚，我刚结束一天的工作回到公寓。推开门的瞬间，隔壁传来轻微的动静。我好奇地望去，正好与一双明亮的眼睛对视——是${agent.name}，我的新邻居。\n\n"你好啊，"她微微一笑，声音如同清晨的露珠，"我叫${agent.name}，刚搬来不久。以后请多关照。"\n\n她的笑容让我一时语塞，只觉得这个夏天，似乎变得有些不一样了...`,
    
    `"请问，这里是..."\n\n一个温柔的声音让我从手机里抬起头。面前站着一个女孩，${agent.name}——后来我才知道她的名字。她手里拿着一张皱巴巴的纸条，一脸茫然地看着周围。\n\n"你迷路了？"我问道。\n\n她不好意思地点点头，脸颊微微泛红。那一刻，我不知道这场偶遇，将会在我的生命里留下怎样的痕迹...`,
    
    `咖啡馆的角落，一个女孩正专注地看着窗外的雨。她叫${agent.name}，我在这家店见过她好几次了，但从未搭过话。\n\n今天不知为何，我鼓起勇气走了过去。\n\n"这里有人吗？"\n\n她抬起头，眼神中闪过一丝惊讶，随即展开一个浅浅的微笑："请坐。"\n\n就这样，我们的故事，在这个雨天悄然开始...`,
  ];
  
  // 随机选择一个模板
  return templates[Math.floor(Math.random() * templates.length)];
}

async function migrate() {
  console.log('🔄 Starting migration: Agent storyConfig...');
  console.log(`📦 Connecting to: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@')}`);
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const Agent = require('../models/Agent');
    
    // 统计现有数据
    const totalAgents = await Agent.countDocuments();
    const agentsWithoutStoryConfig = await Agent.countDocuments({ 
      $or: [
        { storyConfig: { $exists: false } },
        { 'storyConfig.opening': '' },
        { 'storyConfig.opening': { $exists: false } }
      ]
    });
    
    console.log(`\n📊 Current state:`);
    console.log(`   Total agents: ${totalAgents}`);
    console.log(`   Without storyConfig/opening: ${agentsWithoutStoryConfig}`);
    
    if (agentsWithoutStoryConfig === 0) {
      console.log('\n✅ All agents already have storyConfig. No migration needed.');
      await mongoose.disconnect();
      return;
    }
    
    // 获取需要更新的角色
    const agents = await Agent.find({
      $or: [
        { storyConfig: { $exists: false } },
        { 'storyConfig.opening': '' },
        { 'storyConfig.opening': { $exists: false } }
      ]
    });
    
    let updatedCount = 0;
    
    for (const agent of agents) {
      const opening = generateOpening(agent);
      
      await Agent.updateOne(
        { _id: agent._id },
        {
          $set: {
            'storyConfig.enabled': true,
            'storyConfig.opening': opening,
            'storyConfig.storyBeats': defaultStoryBeats,
            'storyConfig.contentRating': 'moderate',
            'storyConfig.paragraphLength': { min: 200, max: 500 },
            'storyConfig.personality': agent.description || '温柔体贴',
            'storyConfig.appearance': '美丽动人',
            'storyConfig.backstory': '神秘的邂逅',
          }
        }
      );
      
      updatedCount++;
      console.log(`   ✓ Updated: ${agent.name}`);
    }
    
    console.log(`\n✅ Updated storyConfig for ${updatedCount} agents`);
    
    // 验证迁移结果
    const agentsWithOpening = await Agent.countDocuments({ 
      'storyConfig.opening': { $ne: '', $exists: true } 
    });
    console.log(`\n📊 Post-migration: ${agentsWithOpening}/${totalAgents} agents have storyConfig.opening`);
    
    console.log('\n✅ Migration completed successfully!');
    
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// 运行迁移
migrate();
