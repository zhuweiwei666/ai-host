/**
 * 数据库迁移脚本：为 Message 集合添加 userId 字段
 * 
 * 背景：修复聊天记录数据隔离问题，所有消息必须关联用户ID
 * 
 * 用法：
 *   cd backend
 *   node scripts/migrate_add_userId_to_messages.js
 * 
 * 注意：
 *   - 此脚本会为所有缺少 userId 的消息添加 "legacy_user" 作为默认值
 *   - 这些历史消息不会显示给任何真实用户（因为没有用户的 userId 是 "legacy_user"）
 *   - 如果需要保留某些用户的历史记录，请在运行前手动更新
 */

require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB 连接
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-host';

async function migrate() {
  console.log('========================================');
  console.log('Message 数据迁移脚本 - 添加 userId 字段');
  console.log('========================================\n');

  try {
    // 连接数据库
    console.log(`连接数据库: ${MONGO_URI.replace(/\/\/.*:.*@/, '//***:***@')}`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ 数据库连接成功\n');

    const db = mongoose.connection.db;
    const messagesCollection = db.collection('messages');

    // 统计需要迁移的消息数量
    const totalMessages = await messagesCollection.countDocuments();
    const messagesWithoutUserId = await messagesCollection.countDocuments({ 
      userId: { $exists: false } 
    });
    const messagesWithNullUserId = await messagesCollection.countDocuments({ 
      userId: null 
    });

    console.log('📊 迁移前统计:');
    console.log(`   - 总消息数: ${totalMessages}`);
    console.log(`   - 缺少 userId 的消息: ${messagesWithoutUserId}`);
    console.log(`   - userId 为 null 的消息: ${messagesWithNullUserId}`);
    console.log('');

    const needsMigration = messagesWithoutUserId + messagesWithNullUserId;

    if (needsMigration === 0) {
      console.log('✅ 所有消息都已有 userId，无需迁移！');
      await mongoose.disconnect();
      return;
    }

    console.log(`🔄 开始迁移 ${needsMigration} 条消息...\n`);

    // 为缺少 userId 的消息添加默认值
    const result1 = await messagesCollection.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: 'legacy_user' } }
    );

    // 为 userId 为 null 的消息添加默认值
    const result2 = await messagesCollection.updateMany(
      { userId: null },
      { $set: { userId: 'legacy_user' } }
    );

    const totalUpdated = result1.modifiedCount + result2.modifiedCount;

    console.log('📝 迁移结果:');
    console.log(`   - 更新 userId 不存在的消息: ${result1.modifiedCount} 条`);
    console.log(`   - 更新 userId 为 null 的消息: ${result2.modifiedCount} 条`);
    console.log(`   - 总计更新: ${totalUpdated} 条\n`);

    // 验证迁移结果
    const remainingWithoutUserId = await messagesCollection.countDocuments({ 
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });

    if (remainingWithoutUserId === 0) {
      console.log('✅ 迁移成功！所有消息现在都有 userId 字段。\n');
    } else {
      console.log(`⚠️  警告：仍有 ${remainingWithoutUserId} 条消息缺少 userId\n`);
    }

    // 显示迁移后的统计
    const legacyCount = await messagesCollection.countDocuments({ userId: 'legacy_user' });
    console.log('📊 迁移后统计:');
    console.log(`   - 标记为 legacy_user 的历史消息: ${legacyCount} 条`);
    console.log('   - 这些消息不会显示给任何真实用户\n');

    console.log('========================================');
    console.log('提示：新用户的聊天记录将正确隔离');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n数据库连接已关闭');
  }
}

// 运行迁移
migrate();
