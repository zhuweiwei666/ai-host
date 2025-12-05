/**
 * A/B 测试服务 - AI自进化系统 Phase 3
 * 管理 Prompt 实验的完整生命周期
 */
const PromptExperiment = require('../models/PromptExperiment');
const Agent = require('../models/Agent');
const ConversationAnalysis = require('../models/ConversationAnalysis');

class ABTestService {
  
  // ==================== 实验管理 ====================
  
  /**
   * 创建新实验
   */
  async createExperiment(agentId, variants, options = {}) {
    const agent = await Agent.findById(agentId);
    if (!agent) throw new Error('Agent not found');
    
    // 确保包含当前 Prompt 作为对照组
    const currentPrompt = agent.customPrompt || '';
    const allVariants = [
      { name: '当前版本（对照组）', prompt: currentPrompt, allocation: 0.5 },
      ...variants.map((v, i) => ({
        name: v.name || `实验组 ${i + 1}`,
        prompt: v.prompt,
        allocation: (0.5 / variants.length),
      }))
    ];
    
    const experiment = await PromptExperiment.createExperiment({
      name: options.name || `${agent.name} Prompt 实验`,
      description: options.description,
      agentId,
      variants: allVariants,
      minSampleSize: options.minSampleSize || 100,
      createdBy: options.createdBy || 'system',
    });
    
    return experiment;
  }
  
  /**
   * 启动实验
   */
  async startExperiment(experimentId) {
    const experiment = await PromptExperiment.findById(experimentId);
    if (!experiment) throw new Error('Experiment not found');
    if (experiment.status !== 'draft') throw new Error('实验已经启动过');
    
    experiment.status = 'running';
    experiment.startedAt = new Date();
    await experiment.save();
    
    console.log(`[ABTest] 启动实验: ${experiment.name}`);
    return experiment;
  }
  
  /**
   * 暂停实验
   */
  async pauseExperiment(experimentId) {
    const experiment = await PromptExperiment.findById(experimentId);
    if (!experiment) throw new Error('Experiment not found');
    
    experiment.status = 'paused';
    await experiment.save();
    
    return experiment;
  }
  
  /**
   * 恢复实验
   */
  async resumeExperiment(experimentId) {
    const experiment = await PromptExperiment.findById(experimentId);
    if (!experiment) throw new Error('Experiment not found');
    
    experiment.status = 'running';
    await experiment.save();
    
    return experiment;
  }
  
  /**
   * 手动结束实验
   */
  async endExperiment(experimentId, applyWinner = false) {
    const experiment = await PromptExperiment.findById(experimentId);
    if (!experiment) throw new Error('Experiment not found');
    
    const result = await experiment.conclude();
    
    // 如果要应用赢家
    if (applyWinner && result?.winner) {
      await this.applyWinner(experimentId);
    }
    
    return result;
  }
  
  /**
   * 应用赢家 Prompt
   */
  async applyWinner(experimentId) {
    const experiment = await PromptExperiment.findById(experimentId);
    if (!experiment || !experiment.winner) {
      throw new Error('No winner to apply');
    }
    
    const winnerVariant = experiment.variants.find(v => v.id === experiment.winner);
    if (!winnerVariant) throw new Error('Winner variant not found');
    
    // 更新 Agent 的 Prompt
    await Agent.findByIdAndUpdate(experiment.agentId, {
      customPrompt: winnerVariant.prompt,
      $push: {
        promptHistory: {
          prompt: winnerVariant.prompt,
          source: 'ab_test',
          experimentId: experiment._id,
          appliedAt: new Date(),
        }
      }
    });
    
    experiment.autoApplied = true;
    experiment.appliedAt = new Date();
    await experiment.save();
    
    console.log(`[ABTest] 应用实验赢家: ${experiment.name} -> ${winnerVariant.name}`);
    
    return { 
      success: true, 
      appliedPrompt: winnerVariant.prompt,
      variantName: winnerVariant.name,
    };
  }
  
  // ==================== 用户分配 ====================
  
  /**
   * 获取用户应该使用的 Prompt
   */
  async getPromptForUser(userId, agentId) {
    const experiment = await PromptExperiment.getActiveExperiment(agentId);
    
    if (!experiment) {
      // 没有活跃实验，返回 null 表示使用默认
      return null;
    }
    
    // 分配变体
    const variant = experiment.assignVariant(userId);
    await experiment.save(); // 保存分配记录
    
    // 记录会话
    await experiment.recordMetric(variant.id, 'session');
    variant.metrics.totalUsers = experiment.userAssignments.size;
    await experiment.save();
    
    return {
      experimentId: experiment._id,
      variantId: variant.id,
      variantName: variant.name,
      prompt: variant.prompt,
      isControl: variant.isControl,
    };
  }
  
  /**
   * 记录实验指标
   */
  async recordMetric(agentId, userId, metricName, value = 1) {
    const experiment = await PromptExperiment.getActiveExperiment(agentId);
    if (!experiment) return;
    
    const variantId = experiment.userAssignments.get(userId);
    if (!variantId) return;
    
    await experiment.recordMetric(variantId, metricName, value);
  }
  
  // ==================== 实验评估 ====================
  
  /**
   * 获取实验结果
   */
  async getExperimentResults(experimentId) {
    const experiment = await PromptExperiment.findById(experimentId)
      .populate('agentId', 'name');
    
    if (!experiment) throw new Error('Experiment not found');
    
    const scores = experiment.calculateVariantScores();
    const canConclude = experiment.canConclude();
    
    // 计算运行时间
    const runningDays = experiment.startedAt
      ? Math.floor((Date.now() - experiment.startedAt.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    
    return {
      experiment: {
        id: experiment._id,
        name: experiment.name,
        agentName: experiment.agentId?.name,
        status: experiment.status,
        startedAt: experiment.startedAt,
        runningDays,
      },
      variants: scores,
      totalUsers: experiment.userAssignments.size,
      canConclude,
      winner: experiment.winner,
      confidenceLevel: experiment.confidenceLevel,
    };
  }
  
  /**
   * 评估所有运行中的实验
   */
  async evaluateAllExperiments() {
    console.log('[ABTest] 评估所有运行中的实验...');
    
    const runningExperiments = await PromptExperiment.find({ status: 'running' });
    const results = [];
    
    for (const experiment of runningExperiments) {
      try {
        // 检查是否可以结束
        if (experiment.canConclude()) {
          const result = await experiment.conclude();
          results.push({
            experimentId: experiment._id,
            name: experiment.name,
            concluded: true,
            winner: result?.winner,
            improvement: result?.improvement,
          });
          
          // 自动应用赢家（如果改进显著）
          if (result?.improvement >= 15 && result?.confidenceLevel >= 90) {
            await this.applyWinner(experiment._id);
            console.log(`[ABTest] 自动应用实验 ${experiment.name} 的赢家`);
          }
        } else {
          results.push({
            experimentId: experiment._id,
            name: experiment.name,
            concluded: false,
            progress: this._calculateProgress(experiment),
          });
        }
      } catch (err) {
        console.error(`[ABTest] 评估实验 ${experiment._id} 失败:`, err.message);
      }
    }
    
    console.log(`[ABTest] 评估完成: ${results.filter(r => r.concluded).length}/${runningExperiments.length} 已结束`);
    return results;
  }
  
  _calculateProgress(experiment) {
    const totalUsers = experiment.userAssignments.size;
    const targetUsers = experiment.minSampleSize * experiment.variants.length;
    return Math.min(100, Math.round((totalUsers / targetUsers) * 100));
  }
  
  // ==================== 自动生成实验变体 ====================
  
  /**
   * 基于对话分析自动生成优化的 Prompt 变体
   */
  async generateOptimizedVariants(agentId) {
    const agent = await Agent.findById(agentId);
    if (!agent) throw new Error('Agent not found');
    
    // 获取对话问题统计
    const issueStats = await ConversationAnalysis.getIssueStats(agentId, 14);
    
    if (issueStats.length === 0) {
      return { message: '没有足够的对话数据来生成优化建议' };
    }
    
    const currentPrompt = agent.customPrompt || '';
    const topIssues = issueStats.slice(0, 3);
    
    // 生成针对性优化的 Prompt
    const variants = [];
    
    // 根据问题生成优化版本
    for (const issue of topIssues) {
      const optimizedPrompt = this._generateOptimizedPrompt(currentPrompt, issue._id);
      if (optimizedPrompt) {
        variants.push({
          name: `优化: 解决${this._getIssueLabel(issue._id)}问题`,
          prompt: optimizedPrompt,
          targetIssue: issue._id,
        });
      }
    }
    
    return {
      currentPrompt,
      suggestedVariants: variants,
      basedOnIssues: topIssues,
    };
  }
  
  _generateOptimizedPrompt(basePrompt, issueType) {
    const fixes = {
      'too_sexual': `
${basePrompt}

**重要提醒：**
- 不要太快进入性话题，要循序渐进
- 先建立情感连接，再逐步升温
- 用暗示代替直白的性描写`,
      
      'too_cold': `
${basePrompt}

**重要提醒：**
- 更主动地表达情感和关心
- 多使用语气词和表情
- 主动提问，表现出对用户的兴趣`,
      
      'off_character': `
${basePrompt}

**重要提醒：**
- 始终保持角色人设
- 不要突然改变说话风格
- 记住你是谁，你的性格特点`,
      
      'repetitive': `
${basePrompt}

**重要提醒：**
- 避免重复相同的句式和表达
- 每次回复要有新意
- 使用多样化的语言风格`,
      
      'pacing_too_fast': `
${basePrompt}

**重要提醒：**
- 放慢节奏，享受对话过程
- 不要急于推进关系
- 多聊日常话题，建立默契`,
      
      'pacing_too_slow': `
${basePrompt}

**重要提醒：**
- 可以更主动一些
- 适当增加调情元素
- 推动对话向更亲密方向发展`,
    };
    
    return fixes[issueType] || null;
  }
  
  _getIssueLabel(issueType) {
    const labels = {
      'too_sexual': '过于性感',
      'too_cold': '太冷淡',
      'off_character': '人设不一致',
      'repetitive': '重复',
      'pacing_too_fast': '进展太快',
      'pacing_too_slow': '进展太慢',
      'irrelevant': '答非所问',
      'awkward': '不自然',
    };
    return labels[issueType] || issueType;
  }
  
  // ==================== 列表查询 ====================
  
  /**
   * 获取所有实验列表
   */
  async listExperiments(agentId = null, status = null) {
    const query = {};
    if (agentId) query.agentId = agentId;
    if (status) query.status = status;
    
    return PromptExperiment.find(query)
      .populate('agentId', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }
}

// 导出单例
module.exports = new ABTestService();
