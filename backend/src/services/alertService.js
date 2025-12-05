/**
 * 告警检测服务 - AI自进化系统 Phase 4
 * 检测各类异常并生成告警
 */
const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');
const UserProfile = require('../models/UserProfile');
const UserEvent = require('../models/UserEvent');
const ConversationAnalysis = require('../models/ConversationAnalysis');
const ContentPerformance = require('../models/ContentPerformance');
const GiftLog = require('../models/GiftLog');
const Agent = require('../models/Agent');

class AlertService {
  
  // ==================== 主检测入口 ====================
  
  /**
   * 运行所有告警检测
   */
  async runAllChecks() {
    console.log('[AlertService] 开始告警检测...');
    
    const results = {
      checks: [],
      alertsCreated: 0,
      alertsUpdated: 0,
    };
    
    try {
      // 1. 高价值用户流失检测
      const churnResult = await this.checkHighValueChurn();
      results.checks.push({ name: 'high_value_churn', ...churnResult });
      
      // 2. 对话质量检测
      const qualityResult = await this.checkConversationQuality();
      results.checks.push({ name: 'conversation_quality', ...qualityResult });
      
      // 3. 内容表现检测
      const contentResult = await this.checkContentPerformance();
      results.checks.push({ name: 'content_performance', ...contentResult });
      
      // 4. 收入变化检测
      const revenueResult = await this.checkRevenueChange();
      results.checks.push({ name: 'revenue', ...revenueResult });
      
      // 5. 活跃度检测
      const engagementResult = await this.checkEngagementChange();
      results.checks.push({ name: 'engagement', ...engagementResult });
      
      // 统计结果
      for (const check of results.checks) {
        results.alertsCreated += check.created || 0;
        results.alertsUpdated += check.updated || 0;
      }
      
      console.log(`[AlertService] 检测完成: 新增 ${results.alertsCreated}, 更新 ${results.alertsUpdated}`);
      
    } catch (err) {
      console.error('[AlertService] 检测失败:', err.message);
      
      // 记录系统错误告警
      await this.createSystemAlert('alert_check_failure', err.message);
    }
    
    return results;
  }
  
  // ==================== 具体检测 ====================
  
  /**
   * 检测高价值用户流失风险
   */
  async checkHighValueChurn() {
    const rules = await AlertRule.getEnabledRules('high_value_churn');
    let created = 0, updated = 0;
    
    for (const rule of rules) {
      const threshold = rule.conditions.threshold;
      
      // 查找高价值但即将流失的用户
      const atRiskUsers = await UserProfile.find({
        'aiAnalysis.spending.ltvTier': { $in: ['whale', 'dolphin'] },
        'aiAnalysis.behavior.daysSinceLastActive': { $gte: threshold },
        'aiAnalysis.behavior.churnRisk': { $in: ['medium', 'high'] },
      }).populate('agentId', 'name').lean();
      
      for (const user of atRiskUsers) {
        const alertData = {
          type: 'high_value_churn',
          severity: rule.severity,
          title: `高价值用户流失预警`,
          message: `用户 ${user.userId} (LTV: ${user.aiAnalysis?.spending?.ltvTier}) 已 ${user.aiAnalysis?.behavior?.daysSinceLastActive} 天未活跃`,
          agentId: user.agentId?._id,
          userId: user.userId,
          data: {
            metric: 'days_inactive',
            currentValue: user.aiAnalysis?.behavior?.daysSinceLastActive,
            threshold,
            details: {
              ltvTier: user.aiAnalysis?.spending?.ltvTier,
              ltv: user.aiAnalysis?.spending?.ltv,
              intimacy: user.intimacy,
              totalMessages: user.totalMessages,
              agentName: user.agentId?.name,
            }
          }
        };
        
        const result = await Alert.createOrUpdate(alertData);
        if (result.isNew) created++;
        else updated++;
      }
    }
    
    return { created, updated };
  }
  
  /**
   * 检测对话质量问题
   */
  async checkConversationQuality() {
    const rules = await AlertRule.getEnabledRules('conversation_quality');
    let created = 0, updated = 0;
    
    for (const rule of rules) {
      const agents = await Agent.find({ status: 'active' });
      
      for (const agent of agents) {
        // 获取最近24小时的平均分数
        const avgScores = await ConversationAnalysis.getAverageScores(
          agent._id, 
          rule.conditions.timeWindow / 24
        );
        
        if (avgScores.sampleCount < rule.conditions.minSampleSize) continue;
        
        if (avgScores.overall < rule.conditions.threshold) {
          const alertData = {
            type: 'conversation_quality',
            severity: rule.severity,
            title: `对话质量下降: ${agent.name}`,
            message: `${agent.name} 的对话质量评分降至 ${avgScores.overall.toFixed(1)}，低于阈值 ${rule.conditions.threshold}`,
            agentId: agent._id,
            data: {
              metric: 'avg_conversation_score',
              currentValue: avgScores.overall,
              threshold: rule.conditions.threshold,
              details: {
                ...avgScores,
                agentName: agent.name,
              }
            }
          };
          
          const result = await Alert.createOrUpdate(alertData);
          if (result.isNew) created++;
          else updated++;
        }
      }
    }
    
    return { created, updated };
  }
  
  /**
   * 检测内容表现问题
   */
  async checkContentPerformance() {
    const rules = await AlertRule.getEnabledRules('content_underperform');
    let created = 0, updated = 0;
    
    for (const rule of rules) {
      // 查找表现差的内容
      const underperforming = await ContentPerformance.getUnderperforming(
        rule.conditions.threshold,
        50
      );
      
      if (underperforming.length >= 10) {  // 如果有大量差内容
        const agents = [...new Set(underperforming.map(c => c.agentId?.toString()))];
        
        for (const agentId of agents) {
          const agentContent = underperforming.filter(c => c.agentId?.toString() === agentId);
          const agent = await Agent.findById(agentId);
          
          if (agentContent.length >= 5) {
            const alertData = {
              type: 'content_underperform',
              severity: rule.severity,
              title: `内容表现异常: ${agent?.name || 'Unknown'}`,
              message: `${agent?.name || 'Unknown'} 有 ${agentContent.length} 个内容表现不佳（评分<${rule.conditions.threshold}）`,
              agentId,
              data: {
                metric: 'underperforming_content_count',
                currentValue: agentContent.length,
                threshold: 5,
                details: {
                  contentIds: agentContent.slice(0, 10).map(c => c.contentId),
                  avgScore: agentContent.reduce((s, c) => s + (c.qualityScore?.overall || 0), 0) / agentContent.length,
                }
              }
            };
            
            const result = await Alert.createOrUpdate(alertData);
            if (result.isNew) created++;
            else updated++;
          }
        }
      }
    }
    
    return { created, updated };
  }
  
  /**
   * 检测收入变化
   */
  async checkRevenueChange() {
    const rules = await AlertRule.getEnabledRules('revenue_drop');
    let created = 0, updated = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dayBefore = new Date(today.getTime() - 48 * 60 * 60 * 1000);
    
    for (const rule of rules) {
      // 获取今日和昨日收入
      const [todayRevenue, yesterdayRevenue] = await Promise.all([
        GiftLog.aggregate([
          { $match: { createdAt: { $gte: yesterday, $lt: today } } },
          { $group: { _id: null, total: { $sum: '$coinCost' } } }
        ]),
        GiftLog.aggregate([
          { $match: { createdAt: { $gte: dayBefore, $lt: yesterday } } },
          { $group: { _id: null, total: { $sum: '$coinCost' } } }
        ])
      ]);
      
      const todayTotal = todayRevenue[0]?.total || 0;
      const yesterdayTotal = yesterdayRevenue[0]?.total || 0;
      
      if (yesterdayTotal > 0) {
        const changePercent = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
        
        if (changePercent < rule.conditions.threshold) {
          const alertData = {
            type: 'revenue_drop',
            severity: rule.severity,
            title: '日收入大幅下降',
            message: `今日收入 ${todayTotal} 金币，较昨日下降 ${Math.abs(changePercent).toFixed(1)}%`,
            data: {
              metric: 'daily_revenue_change',
              currentValue: todayTotal,
              threshold: rule.conditions.threshold,
              changePercent,
              details: {
                todayRevenue: todayTotal,
                yesterdayRevenue: yesterdayTotal,
              }
            }
          };
          
          const result = await Alert.createOrUpdate(alertData);
          if (result.isNew) created++;
          else updated++;
        }
      }
    }
    
    return { created, updated };
  }
  
  /**
   * 检测活跃度变化
   */
  async checkEngagementChange() {
    const rules = await AlertRule.getEnabledRules('engagement_drop');
    let created = 0, updated = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeekSameDay = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekNextDay = new Date(lastWeekSameDay.getTime() + 24 * 60 * 60 * 1000);
    
    for (const rule of rules) {
      // 获取今日和上周同期DAU
      const [todayDAU, lastWeekDAU] = await Promise.all([
        UserEvent.distinct('userId', { 
          serverTimestamp: { $gte: yesterday, $lt: today },
          eventType: 'message_sent'
        }),
        UserEvent.distinct('userId', { 
          serverTimestamp: { $gte: lastWeekSameDay, $lt: lastWeekNextDay },
          eventType: 'message_sent'
        })
      ]);
      
      if (lastWeekDAU.length > 0) {
        const changePercent = ((todayDAU.length - lastWeekDAU.length) / lastWeekDAU.length) * 100;
        
        if (changePercent < rule.conditions.threshold) {
          const alertData = {
            type: 'engagement_drop',
            severity: rule.severity,
            title: '用户活跃度下降',
            message: `今日活跃用户 ${todayDAU.length}，较上周同期下降 ${Math.abs(changePercent).toFixed(1)}%`,
            data: {
              metric: 'dau_change',
              currentValue: todayDAU.length,
              threshold: rule.conditions.threshold,
              changePercent,
              details: {
                todayDAU: todayDAU.length,
                lastWeekDAU: lastWeekDAU.length,
              }
            }
          };
          
          const result = await Alert.createOrUpdate(alertData);
          if (result.isNew) created++;
          else updated++;
        }
      }
    }
    
    return { created, updated };
  }
  
  // ==================== 系统告警 ====================
  
  /**
   * 创建系统告警
   */
  async createSystemAlert(errorType, errorMessage, details = {}) {
    const alertData = {
      type: 'system_error',
      severity: 'critical',
      title: `系统错误: ${errorType}`,
      message: errorMessage,
      data: {
        metric: 'system_error',
        details: {
          errorType,
          ...details,
          timestamp: new Date(),
        }
      }
    };
    
    return Alert.createOrUpdate(alertData);
  }
  
  /**
   * 创建任务失败告警
   */
  async createTaskFailureAlert(taskName, errorMessage) {
    const alertData = {
      type: 'task_failure',
      severity: 'warning',
      title: `定时任务失败: ${taskName}`,
      message: errorMessage,
      data: {
        metric: 'task_failure',
        details: {
          taskName,
          failedAt: new Date(),
        }
      }
    };
    
    return Alert.createOrUpdate(alertData);
  }
  
  /**
   * 创建A/B测试完成告警
   */
  async createABTestCompleteAlert(experiment, result) {
    const alertData = {
      type: 'ab_test_complete',
      severity: 'info',
      title: `A/B测试完成: ${experiment.name}`,
      message: result.winner 
        ? `实验已完成，赢家: ${result.winner}，提升 ${result.improvement}%`
        : '实验已完成，无显著差异',
      agentId: experiment.agentId,
      relatedId: experiment._id.toString(),
      data: {
        metric: 'ab_test',
        details: {
          experimentId: experiment._id,
          experimentName: experiment.name,
          winner: result.winner,
          improvement: result.improvement,
          confidenceLevel: result.confidenceLevel,
        }
      }
    };
    
    return Alert.createOrUpdate(alertData);
  }
  
  /**
   * 创建召回成功告警
   */
  async createRecallSuccessAlert(userId, agentId, agentName) {
    const alertData = {
      type: 'recall_success',
      severity: 'info',
      title: `用户召回成功`,
      message: `用户 ${userId} 在收到 ${agentName} 的召回消息后已回归`,
      agentId,
      userId,
      data: {
        metric: 'recall_success',
        details: {
          returnedAt: new Date(),
        }
      }
    };
    
    return Alert.createOrUpdate(alertData);
  }
  
  // ==================== 告警管理 ====================
  
  /**
   * 获取告警统计
   */
  async getStats() {
    return Alert.getActiveStats();
  }
  
  /**
   * 获取最近告警
   */
  async getRecent(limit = 50, filters = {}) {
    return Alert.getRecent(limit, filters);
  }
  
  /**
   * 确认告警
   */
  async acknowledge(alertIds, acknowledgedBy) {
    return Alert.acknowledgeMany(alertIds, acknowledgedBy);
  }
  
  /**
   * 解决告警
   */
  async resolve(alertId, resolvedBy, resolution) {
    return Alert.resolve(alertId, resolvedBy, resolution);
  }
}

// 导出单例
module.exports = new AlertService();
