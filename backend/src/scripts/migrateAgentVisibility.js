/**
 * 数据库迁移脚本：为现有角色添加可见性相关字段默认值
 * 
 * 用法：
 * node backend/src/scripts/migrateAgentVisibility.js
 * 
 * 或在服务器上：
 * docker compose exec backend node src/scripts/migrateAgentVisibility.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-host';

async function migrate() {
  console.log('🔄 Starting migration: Agent visibility fields...');
  console.log(`📦 Connecting to: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@')}`);
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const Agent = require('../models/Agent');
    
    // 统计现有数据
    const totalAgents = await Agent.countDocuments();
    const agentsWithoutCreatorType = await Agent.countDocuments({ creatorType: { $exists: false } });
    const agentsWithoutVisibility = await Agent.countDocuments({ visibility: { $exists: false } });
    
    console.log(`\n📊 Current state:`);
    console.log(`   Total agents: ${totalAgents}`);
    console.log(`   Without creatorType: ${agentsWithoutCreatorType}`);
    console.log(`   Without visibility: ${agentsWithoutVisibility}`);
    
    if (agentsWithoutCreatorType === 0 && agentsWithoutVisibility === 0) {
      console.log('\n✅ All agents already have visibility fields. No migration needed.');
      await mongoose.disconnect();
      return;
    }
    
    // 迁移：为没有 creatorType 的角色设置为 official
    const result1 = await Agent.updateMany(
      { creatorType: { $exists: false } },
      { 
        $set: { 
          creatorType: 'official',
          creatorId: null
        } 
      }
    );
    console.log(`\n✅ Set creatorType='official' for ${result1.modifiedCount} agents`);
    
    // 迁移：为没有 visibility 的角色设置为 public
    const result2 = await Agent.updateMany(
      { visibility: { $exists: false } },
      { 
        $set: { 
          visibility: 'public'
        } 
      }
    );
    console.log(`✅ Set visibility='public' for ${result2.modifiedCount} agents`);
    
    // 初始化 stats 字段
    const result3 = await Agent.updateMany(
      { stats: { $exists: false } },
      { 
        $set: { 
          stats: {
            totalChats: 0,
            uniqueUsers: 0,
            avgRating: 0,
            totalRatings: 0
          }
        } 
      }
    );
    console.log(`✅ Initialized stats for ${result3.modifiedCount} agents`);
    
    // 验证迁移结果
    console.log('\n📊 Post-migration verification:');
    const afterMigration = await Agent.aggregate([
      {
        $group: {
          _id: { creatorType: '$creatorType', visibility: '$visibility' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.creatorType': 1, '_id.visibility': 1 } }
    ]);
    
    afterMigration.forEach(item => {
      console.log(`   ${item._id.creatorType || 'null'} / ${item._id.visibility || 'null'}: ${item.count}`);
    });
    
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
