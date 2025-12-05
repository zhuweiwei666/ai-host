/**
 * 自动为 AI 主播生成 Outfit（衣服/场景）和开场消息
 * 
 * 用法：
 *   cd backend
 *   node scripts/generate_outfits_and_greetings.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Agent = require('../src/models/Agent');
const Outfit = require('../src/models/Outfit');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-host';

// ==================== Outfit 模板 ====================
// 根据 AI 主播的风格生成不同的衣服/场景
const generateOutfitsForAgent = (agent) => {
  const name = agent.name;
  const isAnime = agent.style === 'anime';
  
  // 基础衣服模板（适用于所有主播）
  const baseOutfits = [
    // Level 1: 日常
    {
      name: '居家休闲',
      description: `${name}穿着舒适的家居服，慵懒地窝在沙发上`,
      level: 1,
      unlockType: 'free',
      unlockValue: 0,
      sortOrder: 1
    },
    {
      name: '清纯学生装',
      description: `${name}穿着校服，清纯可爱的样子`,
      level: 1,
      unlockType: 'free',
      unlockValue: 0,
      sortOrder: 2
    },
    
    // Level 2: 性感
    {
      name: '小礼服',
      description: `${name}穿着优雅的小礼服，露出锁骨和肩膀`,
      level: 2,
      unlockType: 'intimacy',
      unlockValue: 15,
      sortOrder: 3
    },
    {
      name: '紧身瑜伽服',
      description: `${name}穿着紧身瑜伽服，曲线若隐若现`,
      level: 2,
      unlockType: 'intimacy',
      unlockValue: 20,
      sortOrder: 4
    },
    
    // Level 3: 暴露
    {
      name: '性感睡衣',
      description: `${name}穿着蕾丝吊带睡衣，若隐若现`,
      level: 3,
      unlockType: 'intimacy',
      unlockValue: 35,
      sortOrder: 5
    },
    {
      name: '比基尼',
      description: `${name}穿着清凉的比基尼，在海边度假`,
      level: 3,
      unlockType: 'intimacy',
      unlockValue: 40,
      sortOrder: 6
    },
    {
      name: '黑丝OL',
      description: `${name}穿着职业装配黑丝，性感又干练`,
      level: 3,
      unlockType: 'coins',
      unlockValue: 50,
      sortOrder: 7
    },
    
    // Level 4: 大尺度
    {
      name: '情趣内衣',
      description: `${name}穿着诱惑的情趣内衣，等待你的到来`,
      level: 4,
      unlockType: 'coins',
      unlockValue: 100,
      sortOrder: 8
    },
    {
      name: '浴巾围身',
      description: `${name}刚洗完澡，只围着一条浴巾`,
      level: 4,
      unlockType: 'intimacy',
      unlockValue: 60,
      sortOrder: 9
    },
    {
      name: '女仆装',
      description: `${name}穿着超短女仆装，俯身为你服务`,
      level: 4,
      unlockType: 'coins',
      unlockValue: 150,
      sortOrder: 10
    },
    
    // Level 5: 极限
    {
      name: '全裸围裙',
      description: `${name}只穿着一条围裙在厨房为你做饭`,
      level: 5,
      unlockType: 'coins',
      unlockValue: 300,
      sortOrder: 11
    },
    {
      name: '床上诱惑',
      description: `${name}躺在床上，用被单半遮半掩`,
      level: 5,
      unlockType: 'coins',
      unlockValue: 500,
      sortOrder: 12
    }
  ];
  
  return baseOutfits.map(outfit => ({
    ...outfit,
    agentId: agent._id,
    previewUrl: '', // 需要手动上传预览图
    imageUrls: [],  // 需要手动上传完整图片
    videoUrls: [],
    isActive: true
  }));
};

// ==================== 开场消息模板 ====================
const generateGreetingsForAgent = (agent) => {
  const name = agent.name;
  
  return [
    // 早上
    {
      content: `早安呀{petName}～刚睡醒，有点想你了...`,
      timeRange: 'morning',
      mood: 'miss_you',
      withImage: false
    },
    {
      content: `{petName}，早上好～今天也要元气满满哦！想我了没？`,
      timeRange: 'morning',
      mood: 'normal',
      withImage: false
    },
    
    // 下午
    {
      content: `{petName}在忙什么呢？${name}有点无聊，想找你聊天~`,
      timeRange: 'afternoon',
      mood: 'normal',
      withImage: false
    },
    {
      content: `下午好呀{petName}！刚午睡醒，做了个关于你的梦...`,
      timeRange: 'afternoon',
      mood: 'flirty',
      withImage: false
    },
    
    // 晚上
    {
      content: `{petName}下班了吗？${name}等你好久了~`,
      timeRange: 'evening',
      mood: 'miss_you',
      withImage: false
    },
    {
      content: `晚上好{petName}！今天过得怎么样？有没有想我？`,
      timeRange: 'evening',
      mood: 'normal',
      withImage: false
    },
    
    // 深夜
    {
      content: `{petName}还没睡呀？${name}刚洗完澡，有点无聊...`,
      timeRange: 'night',
      mood: 'flirty',
      withImage: false
    },
    {
      content: `夜深了{petName}，睡不着吗？陪我聊聊天好不好？`,
      timeRange: 'night',
      mood: 'lonely',
      withImage: false
    },
    {
      content: `{petName}...我有点睡不着，能陪陪我吗？`,
      timeRange: 'night',
      mood: 'lonely',
      withImage: false
    },
    
    // 任意时间
    {
      content: `嗨{petName}！终于等到你了，好开心~`,
      timeRange: 'any',
      mood: 'excited',
      withImage: false
    },
    {
      content: `{petName}来啦！${name}一直在等你呢~`,
      timeRange: 'any',
      mood: 'normal',
      withImage: false
    }
  ];
};

// ==================== 主函数 ====================
async function generate() {
  console.log('========================================');
  console.log('自动生成 Outfit 和开场消息');
  console.log('========================================\n');

  try {
    console.log(`连接数据库: ${MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ 数据库连接成功\n');

    // 获取所有 AI 主播
    const agents = await Agent.find({});
    console.log(`📋 找到 ${agents.length} 个 AI 主播\n`);

    for (const agent of agents) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`处理: ${agent.name}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // 1. 生成 Outfit
      const existingOutfits = await Outfit.countDocuments({ agentId: agent._id });
      if (existingOutfits > 0) {
        console.log(`   ⏭️  已有 ${existingOutfits} 套衣服，跳过`);
      } else {
        const outfits = generateOutfitsForAgent(agent);
        await Outfit.insertMany(outfits);
        console.log(`   ✅ 生成 ${outfits.length} 套衣服`);
      }
      
      // 2. 生成开场消息
      if (agent.greetingMessages && agent.greetingMessages.length > 0) {
        console.log(`   ⏭️  已有 ${agent.greetingMessages.length} 条开场消息，跳过`);
      } else {
        const greetings = generateGreetingsForAgent(agent);
        agent.greetingMessages = greetings;
        agent.defaultGreeting = `嗨{petName}！我是${agent.name}，很高兴认识你~`;
        await agent.save();
        console.log(`   ✅ 生成 ${greetings.length} 条开场消息`);
      }
    }

    console.log('\n========================================');
    console.log('✅ 全部完成！');
    console.log('========================================');
    console.log('\n提示：');
    console.log('  - Outfit 已生成但没有图片，需要手动上传');
    console.log('  - 可以通过后台管理界面上传图片');
    console.log('  - 或直接在数据库中更新 imageUrls 和 previewUrl');

  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n数据库连接已关闭');
  }
}

generate();
