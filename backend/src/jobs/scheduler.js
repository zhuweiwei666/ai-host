/**
 * 定时任务调度器 - AI自进化系统
 * 管理所有后台定时任务
 */
const cron = require('node-cron');
const contentAnalyzer = require('../services/contentAnalyzer');
const conversationEvaluator = require('../services/conversationEvaluator');

class JobScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }
  
  /**
   * 启动所有定时任务
   */
  start() {
    if (this.isRunning) {
      console.log('[Scheduler] 调度器已在运行中');
      return;
    }
    
    console.log('🕐 [Scheduler] 启动定时任务调度器...');
    
    // ========== 每小时任务 ==========
    
    // 每小时：评估待处理的对话
    this.jobs.push(cron.schedule('0 * * * *', async () => {
      console.log('⏰ [Scheduler] 执行每小时对话评估...');
      try {
        const result = await conversationEvaluator.evaluatePending(30);
        console.log(`✅ [Scheduler] 对话评估完成: ${result.evaluated} 成功, ${result.errors} 失败`);
      } catch (err) {
        console.error('❌ [Scheduler] 对话评估失败:', err.message);
      }
    }));
    
    // 每小时：更新最近活跃内容的分数
    this.jobs.push(cron.schedule('30 * * * *', async () => {
      console.log('⏰ [Scheduler] 更新最近内容分数...');
      try {
        const updated = await contentAnalyzer.updateRecentScores(24);
        console.log(`✅ [Scheduler] 更新了 ${updated} 个内容的分数`);
      } catch (err) {
        console.error('❌ [Scheduler] 内容分数更新失败:', err.message);
      }
    }));
    
    // ========== 每日任务 ==========
    
    // 每天凌晨2点：更新所有内容分数
    this.jobs.push(cron.schedule('0 2 * * *', async () => {
      console.log('⏰ [Scheduler] 执行每日内容分数全量更新...');
      try {
        const updated = await contentAnalyzer.updateAllScores();
        console.log(`✅ [Scheduler] 全量更新完成: ${updated} 个内容`);
      } catch (err) {
        console.error('❌ [Scheduler] 内容分数全量更新失败:', err.message);
      }
    }));
    
    // 每天凌晨3点：标记表现不佳的内容
    this.jobs.push(cron.schedule('0 3 * * *', async () => {
      console.log('⏰ [Scheduler] 标记表现不佳的内容...');
      try {
        const deprecated = await contentAnalyzer.deprecateUnderperforming(25, 100);
        console.log(`✅ [Scheduler] 标记了 ${deprecated} 个表现不佳的内容`);
      } catch (err) {
        console.error('❌ [Scheduler] 标记内容失败:', err.message);
      }
    }));
    
    // 每天早上8点：生成日报
    this.jobs.push(cron.schedule('0 8 * * *', async () => {
      console.log('⏰ [Scheduler] 生成每日报告...');
      try {
        const [contentReport, conversationReport] = await Promise.all([
          contentAnalyzer.generateDailyReport(),
          conversationEvaluator.generateDailyReport()
        ]);
        
        console.log('📊 [Scheduler] 每日报告摘要:');
        console.log(`  - 内容: ${contentReport.globalStats.activeContent} 活跃, ${contentReport.globalStats.underperformingContent} 表现不佳`);
        console.log(`  - 对话: ${conversationReport.globalStats.totalEvaluated} 已评估, ${conversationReport.globalStats.flaggedForReview} 需审核`);
        
        // TODO: 发送报告到运营群/邮件
        
      } catch (err) {
        console.error('❌ [Scheduler] 生成日报失败:', err.message);
      }
    }));
    
    // ========== 每周任务 ==========
    
    // 每周一凌晨4点：生成Prompt优化建议
    this.jobs.push(cron.schedule('0 4 * * 1', async () => {
      console.log('⏰ [Scheduler] 生成Prompt优化建议...');
      try {
        const Agent = require('../models/Agent');
        const agents = await Agent.find({ status: 'active' });
        
        for (const agent of agents) {
          const optimization = await conversationEvaluator.generatePromptOptimization(agent._id);
          if (optimization && !optimization.error && optimization.optimizedPrompt) {
            console.log(`📝 [Scheduler] ${agent.name}: 生成了优化建议`);
            // TODO: 保存建议到数据库，等待人工审核
          }
        }
        
        console.log('✅ [Scheduler] Prompt优化建议生成完成');
      } catch (err) {
        console.error('❌ [Scheduler] Prompt优化失败:', err.message);
      }
    }));
    
    this.isRunning = true;
    console.log('✅ [Scheduler] 定时任务调度器已启动');
    console.log('📅 已注册的任务:');
    console.log('  - 每小时: 对话评估、内容分数更新');
    console.log('  - 每日 02:00: 内容分数全量更新');
    console.log('  - 每日 03:00: 标记表现不佳内容');
    console.log('  - 每日 08:00: 生成日报');
    console.log('  - 每周一 04:00: Prompt优化建议');
  }
  
  /**
   * 停止所有定时任务
   */
  stop() {
    console.log('🛑 [Scheduler] 停止定时任务调度器...');
    
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;
    
    console.log('✅ [Scheduler] 定时任务调度器已停止');
  }
  
  /**
   * 手动触发任务（用于调试）
   */
  async runManually(taskName) {
    console.log(`🔧 [Scheduler] 手动执行任务: ${taskName}`);
    
    switch (taskName) {
      case 'evaluateConversations':
        return await conversationEvaluator.evaluatePending(50);
      
      case 'updateRecentScores':
        return await contentAnalyzer.updateRecentScores(24);
      
      case 'updateAllScores':
        return await contentAnalyzer.updateAllScores();
      
      case 'deprecateUnderperforming':
        return await contentAnalyzer.deprecateUnderperforming(25, 100);
      
      case 'generateContentReport':
        return await contentAnalyzer.generateDailyReport();
      
      case 'generateConversationReport':
        return await conversationEvaluator.generateDailyReport();
      
      default:
        throw new Error(`未知任务: ${taskName}`);
    }
  }
}

// 导出单例
module.exports = new JobScheduler();
