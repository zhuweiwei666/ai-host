/**
 * 初始化礼物数据
 * 
 * 用法：
 *   cd backend
 *   node scripts/seed_gifts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Gift = require('../src/models/Gift');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-host';

const gifts = [
  // 基础礼物
  {
    name: '玫瑰花',
    emoji: '🌹',
    description: '一朵红玫瑰，表达你的心意',
    price: 5,
    intimacyBonus: 2,
    category: 'flower',
    specialEffect: 'none',
    responseTemplates: [
      '哇！🌹 好美的玫瑰！谢谢{petName}~',
      '收到玫瑰了！{petName}对我真好~ 🥰',
      '🌹 玫瑰好香！{petName}是在撩我吗？',
    ],
    sortOrder: 1
  },
  {
    name: '棒棒糖',
    emoji: '🍭',
    description: '甜甜的棒棒糖',
    price: 10,
    intimacyBonus: 3,
    category: 'food',
    specialEffect: 'none',
    responseTemplates: [
      '🍭 好甜！就像{petName}一样甜~',
      '谢谢{petName}的糖！我要慢慢舔... 😋',
      '棒棒糖耶！{petName}是不是想看我吃糖的样子？',
    ],
    sortOrder: 2
  },
  {
    name: '奶茶',
    emoji: '🧋',
    description: '一杯香浓的奶茶',
    price: 20,
    intimacyBonus: 5,
    category: 'food',
    specialEffect: 'none',
    responseTemplates: [
      '🧋 奶茶！我最喜欢了！{petName}最懂我~',
      '谢谢{petName}请我喝奶茶！今天好幸福~',
      '咕嘟咕嘟~ 🧋 {petName}也想来一口吗？',
    ],
    sortOrder: 3
  },
  
  // 中档礼物
  {
    name: '香水',
    emoji: '💐',
    description: '迷人的香水，让她更想你',
    price: 50,
    intimacyBonus: 10,
    category: 'accessory',
    specialEffect: 'none',
    responseTemplates: [
      '💐 香水！{petName}是想让我变得更香吗？',
      '我喷上香水了... {petName}想不想闻闻？',
      '有了这香水，我整个人都在想{petName}了~',
    ],
    sortOrder: 4
  },
  {
    name: '口红',
    emoji: '💄',
    description: '性感的口红，让她更美丽',
    price: 66,
    intimacyBonus: 12,
    category: 'accessory',
    specialEffect: 'none',
    responseTemplates: [
      '💄 口红！{petName}想让我涂什么颜色？',
      '涂好口红了~ {petName}想不想让我亲一口？',
      '红唇配{petName}，是不是很搭？💋',
    ],
    sortOrder: 5
  },
  {
    name: '新裙子',
    emoji: '👗',
    description: '漂亮的裙子，解锁新造型',
    price: 100,
    intimacyBonus: 15,
    category: 'accessory',
    specialEffect: 'special_photo',
    responseTemplates: [
      '👗 新裙子！{petName}等等，我换给你看！',
      '好喜欢这条裙子！{petName}想看我穿吗？',
      '谢谢{petName}！我现在就去换上~ 等我哦！',
    ],
    sortOrder: 6
  },
  
  // 高档礼物
  {
    name: '包包',
    emoji: '👜',
    description: '精致的包包，女生最爱',
    price: 200,
    intimacyBonus: 25,
    category: 'luxury',
    specialEffect: 'voice_message',
    responseTemplates: [
      '👜 天哪！包包！{petName}对我太好了！',
      '我太喜欢这个包了！{petName}我想亲你一口！',
      '有了这个包，出门都要想着{petName}了~',
    ],
    sortOrder: 7
  },
  {
    name: '项链',
    emoji: '📿',
    description: '闪闪发光的项链，贴近她的心',
    price: 300,
    intimacyBonus: 35,
    category: 'luxury',
    specialEffect: 'special_photo',
    responseTemplates: [
      '📿 项链！{petName}，帮我戴上好不好？',
      '戴上项链了，贴着心口，就像{petName}在我身边~',
      '太美了！{petName}，这是定情信物吗？💕',
    ],
    sortOrder: 8
  },
  {
    name: '戒指',
    emoji: '💍',
    description: '求婚戒指，成为她唯一的他',
    price: 520,
    intimacyBonus: 50,
    category: 'special',
    specialEffect: 'unlock_outfit',
    responseTemplates: [
      '💍 戒指！{petName}...这是...求婚吗？',
      '我愿意！{petName}，从今以后你就是我的人了！',
      '戴上戒指的那一刻，我的心就完全属于{petName}了~ 💍',
    ],
    sortOrder: 9
  },
  
  // 土豪礼物
  {
    name: '跑车钥匙',
    emoji: '🔑',
    description: '兰博基尼钥匙，壕无人性',
    price: 1314,
    intimacyBonus: 80,
    category: 'special',
    specialEffect: 'unlock_outfit',
    responseTemplates: [
      '🔑 跑车！！{petName}你是王子吗？！',
      '我...我不知道说什么好了...{petName}你太疯狂了！',
      '{petName}！我要用跑车来接你！我们去兜风！',
    ],
    sortOrder: 10
  },
  {
    name: '别墅',
    emoji: '🏠',
    description: '送她一栋别墅，土豪专属',
    price: 9999,
    intimacyBonus: 200,
    category: 'special',
    specialEffect: 'unlock_outfit',
    responseTemplates: [
      '🏠 别...别墅？{petName}你是认真的吗？！',
      '我...我们以后就住在一起了吗？{petName}...呜呜呜太感动了！',
      '{petName}！我现在就想搬进去！你什么时候来？',
    ],
    sortOrder: 11
  }
];

async function seed() {
  console.log('========================================');
  console.log('初始化礼物数据');
  console.log('========================================\n');

  try {
    console.log(`连接数据库: ${MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ 数据库连接成功\n');

    // 清空现有礼物
    await Gift.deleteMany({});
    console.log('🗑️  清空现有礼物数据\n');

    // 插入新礼物
    const result = await Gift.insertMany(gifts);
    console.log(`✅ 成功插入 ${result.length} 个礼物\n`);

    // 显示礼物列表
    console.log('礼物列表:');
    console.log('─'.repeat(50));
    for (const gift of result) {
      console.log(`${gift.emoji} ${gift.name.padEnd(10)} | ${gift.price.toString().padStart(5)} 金币 | +${gift.intimacyBonus} 亲密度`);
    }
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n数据库连接已关闭');
  }
}

seed();
