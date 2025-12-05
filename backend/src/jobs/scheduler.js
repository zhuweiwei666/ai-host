/**
 * 定时任务调度器 - AI自进化系统
 * 管理所有后台定时任务
 */
const cron = require('node-cron');
const contentAnalyzer = require('../services/contentAnalyzer');
const conversationEvaluator = require('../services/conversationEvaluator');
const userAnalyzer = require('../services/userAnalyzer');
const abTestService = require('../services/abTestService');
const paceController = require('../services/paceController');
const recallService = require('../services/recallService');
const alertService = require('../services/alertService');
const notificationService = require('../services/notificationService');
const proactiveMessageService = require('../services/proactiveMessageService');

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
    
    // 每天凌晨4点：更新用户画像
    this.jobs.push(cron.schedule('0 4 * * *', async () => {
      console.log('⏰ [Scheduler] 更新用户画像...');
      try {
        const result = await userAnalyzer.analyzeAllUsers(500);
        console.log(`✅ [Scheduler] 用户画像更新: ${result.analyzed} 成功`);
      } catch (err) {
        console.error('❌ [Scheduler] 用户画像更新失败:', err.message);
      }
    }));
    
    // 每天凌晨5点：更新流失风险
    this.jobs.push(cron.schedule('0 5 * * *', async () => {
      console.log('⏰ [Scheduler] 更新流失风险...');
      try {
        const updated = await userAnalyzer.updateChurnRisks();
        console.log(`✅ [Scheduler] 流失风险更新: ${updated} 用户`);
      } catch (err) {
        console.error('❌ [Scheduler] 流失风险更新失败:', err.message);
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
    
    // 每天凌晨6点：更新个性化阈值
    this.jobs.push(cron.schedule('0 6 * * *', async () => {
      console.log('⏰ [Scheduler] 更新个性化阈值...');
      try {
        const updated = await paceController.updateAllThresholds();
        console.log(`✅ [Scheduler] 个性化阈值更新: ${updated} 用户`);
      } catch (err) {
        console.error('❌ [Scheduler] 个性化阈值更新失败:', err.message);
      }
    }));
    
    // 每天早上10点：执行用户召回
    this.jobs.push(cron.schedule('0 10 * * *', async () => {
      console.log('⏰ [Scheduler] 执行用户召回...');
      try {
        const result = await recallService.executeBatchRecall(100);
        console.log(`✅ [Scheduler] 召回完成: 发送 ${result.sent}, 跳过 ${result.skipped}`);
      } catch (err) {
        console.error('❌ [Scheduler] 用户召回失败:', err.message);
      }
    }));
    
    // ========== AI 主动消息任务 ==========
    
    // 每天早上 7:30：生成早安消息
    this.jobs.push(cron.schedule('30 7 * * *', async () => {
      console.log('⏰ [Scheduler] 生成 AI 主动消息 (早安)...');
      try {
        const count = await proactiveMessageService.generateBatchMessages();
        console.log(`✅ [Scheduler] 主动消息生成: ${count} 条`);
      } catch (err) {
        console.error('❌ [Scheduler] 主动消息生成失败:', err.message);
      }
    }));
    
    // 每天中午 12:30：生成午间消息
    this.jobs.push(cron.schedule('30 12 * * *', async () => {
      console.log('⏰ [Scheduler] 生成 AI 主动消息 (午间)...');
      try {
        const count = await proactiveMessageService.generateBatchMessages();
        console.log(`✅ [Scheduler] 主动消息生成: ${count} 条`);
      } catch (err) {
        console.error('❌ [Scheduler] 主动消息生成失败:', err.message);
      }
    }));
    
    // 每天下午 15:30：生成下午消息
    this.jobs.push(cron.schedule('30 15 * * *', async () => {
      console.log('⏰ [Scheduler] 生成 AI 主动消息 (下午)...');
      try {
        const count = await proactiveMessageService.generateBatchMessages();
        console.log(`✅ [Scheduler] 主动消息生成: ${count} 条`);
      } catch (err) {
        console.error('❌ [Scheduler] 主动消息生成失败:', err.message);
      }
    }));
    
    // 每天晚上 19:30：生成晚间消息
    this.jobs.push(cron.schedule('30 19 * * *', async () => {
      console.log('⏰ [Scheduler] 生成 AI 主动消息 (晚间)...');
      try {
        const count = await proactiveMessageService.generateBatchMessages();
        console.log(`✅ [Scheduler] 主动消息生成: ${count} 条`);
      } catch (err) {
        console.error('❌ [Scheduler] 主动消息生成失败:', err.message);
      }
    }));
    
    // 每天晚上 22:30：生成晚安消息
    this.jobs.push(cron.schedule('30 22 * * *', async () => {
      console.log('⏰ [Scheduler] 生成 AI 主动消息 (晚安)...');
      try {
        const count = await proactiveMessageService.generateBatchMessages();
        console.log(`✅ [Scheduler] 主动消息生成: ${count} 条`);
      } catch (err) {
        console.error('❌ [Scheduler] 主动消息生成失败:', err.message);
      }
    }));
    
    // 每天凌晨 1 点：清理过期的主动消息
    this.jobs.push(cron.schedule('0 1 * * *', async () => {
      console.log('⏰ [Scheduler] 清理过期主动消息...');
      try {
        const cleaned = await proactiveMessageService.cleanup();
        console.log(`✅ [Scheduler] 清理了 ${cleaned} 条过期消息`);
      } catch (err) {
        console.error('❌ [Scheduler] 清理过期消息失败:', err.message);
      }
    }));
    
    // 每2小时：告警检测和通知
    this.jobs.push(cron.schedule('0 */2 * * *', async () => {
      console.log('⏰ [Scheduler] 运行告警检测...');
      try {
        const result = await alertService.runAllChecks();
        console.log(`✅ [Scheduler] 告警检测: 新增 ${result.alertsCreated}, 更新 ${result.alertsUpdated}`);
        
        // 发送待发送的通知
        const notifyResult = await notificationService.sendPendingNotifications();
        if (notifyResult.sent > 0) {
          console.log(`📢 [Scheduler] 发送通知: ${notifyResult.sent}/${notifyResult.total}`);
        }
      } catch (err) {
        console.error('❌ [Scheduler] 告警检测失败:', err.message);
      }
    }));
    
    // 每周一凌晨4点：评估A/B测试和生成Prompt优化建议
    this.jobs.push(cron.schedule('0 4 * * 1', async () => {
      console.log('⏰ [Scheduler] 评估A/B测试...');
      try {
        const abResults = await abTestService.evaluateAllExperiments();
        console.log(`✅ [Scheduler] A/B测试评估: ${abResults.filter(r => r.concluded).length} 个已结束`);
      } catch (err) {
        console.error('❌ [Scheduler] A/B测试评估失败:', err.message);
        await alertService.createTaskFailureAlert('evaluateABTests', err.message);
      }
      
      console.log('⏰ [Scheduler] 生成Prompt优化建议...');
      try {
        const Agent = require('../models/Agent');
        const agents = await Agent.find({ status: 'active' });
        
        for (const agent of agents) {
          const optimization = await conversationEvaluator.generatePromptOptimization(agent._id);
          if (optimization && !optimization.error && optimization.optimizedPrompt) {
            console.log(`📝 [Scheduler] ${agent.name}: 生成了优化建议`);
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
    console.log('  - 每2小时: 告警检测和通知');
    console.log('  - 每日 01:00: 清理过期主动消息');
    console.log('  - 每日 02:00: 内容分数全量更新');
    console.log('  - 每日 03:00: 标记表现不佳内容');
    console.log('  - 每日 04:00: 用户画像更新');
    console.log('  - 每日 05:00: 流失风险更新');
    console.log('  - 每日 06:00: 个性化阈值更新');
    console.log('  - 每日 07:30: AI主动消息(早安)');
    console.log('  - 每日 08:00: 生成日报');
    console.log('  - 每日 10:00: 用户召回');
    console.log('  - 每日 12:30: AI主动消息(午间)');
    console.log('  - 每日 15:30: AI主动消息(下午)');
    console.log('  - 每日 19:30: AI主动消息(晚间)');
    console.log('  - 每日 22:30: AI主动消息(晚安)');
    console.log('  - 每周一 04:00: A/B测试评估、Prompt优化');
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
      
      case 'analyzeUsers':
        return await userAnalyzer.analyzeAllUsers(500);
      
      case 'updateChurnRisks':
        return await userAnalyzer.updateChurnRisks();
      
      case 'updateThresholds':
        return await paceController.updateAllThresholds();
      
      case 'executeRecall':
        return await recallService.executeBatchRecall(100);
      
      case 'evaluateABTests':
        return await abTestService.evaluateAllExperiments();
      
      case 'recallEffectiveness':
        return await recallService.analyzeRecallEffectiveness(7);
      
      case 'runAlertChecks':
        return await alertService.runAllChecks();
      
      case 'sendNotifications':
        return await notificationService.sendPendingNotifications();
      
      case 'generateProactiveMessages':
        return await proactiveMessageService.generateBatchMessages();
      
      case 'cleanupProactiveMessages':
        return await proactiveMessageService.cleanup();
      
      default:
        throw new Error(`未知任务: ${taskName}`);
    }
  }
}

// 导出单例
module.exports = new JobScheduler();
