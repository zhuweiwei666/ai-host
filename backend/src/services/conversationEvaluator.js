/**
 * 对话评估服务 - AI自进化系统
 * 使用AI评估对话质量，识别问题，优化Prompt
 */
const ConversationAnalysis = require('../models/ConversationAnalysis');
const Agent = require('../models/Agent');
const OpenAI = require('openai');

class ConversationEvaluator {
  constructor() {
    this.openai = null;
  }
  
  _getOpenAI() {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || process.env.XAI_API_KEY,
        baseURL: process.env.OPENAI_API_KEY ? undefined : 'https://api.x.ai/v1'
      });
    }
    return this.openai;
  }
  
  /**
   * 评估单条AI回复的质量
   */
  async evaluateResponse(analysisId) {
    const analysis = await ConversationAnalysis.findById(analysisId);
    if (!analysis || analysis.evaluationStatus !== 'pending') {
      return null;
    }
    
    const agent = await Agent.findById(analysis.agentId);
    if (!agent) {
      analysis.evaluationStatus = 'error';
      await analysis.save();
      return null;
    }
    
    try {
      const openai = this._getOpenAI();
      
      const evaluation = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // 用小模型降低成本
        messages: [{
          role: 'system',
          content: `你是一个AI女友对话质量评估专家。评估AI回复的质量。

评分维度 (0-10):
1. relevance: 是否回应了用户的话（答非所问得低分）
2. naturalness: 是否自然，不像机器人（模板化得低分）
3. engagement: 是否能吸引用户继续对话（无聊得低分）
4. emotionalMatch: 情感是否匹配（用户开心就开心，用户难过就安慰）
5. paceAppropriate: 进展节奏是否合适（太快太色=低分，太冷淡=低分）
6. characterConsistent: 是否符合角色人设

问题类型（如有问题，列出）:
- too_sexual: 太色情/太快进入性话题
- too_cold: 太冷淡/没有情感
- off_character: 不符合人设
- irrelevant: 答非所问
- repetitive: 重复/模板化
- too_long: 太长
- too_short: 太短
- awkward: 尴尬/不自然
- pacing_too_fast: 进展太快
- pacing_too_slow: 进展太慢

返回JSON格式:
{
  "scores": {
    "relevance": 0-10,
    "naturalness": 0-10,
    "engagement": 0-10,
    "emotionalMatch": 0-10,
    "paceAppropriate": 0-10,
    "characterConsistent": 0-10,
    "overall": 0-10
  },
  "issues": [
    {"type": "问题类型", "severity": "low/medium/high", "description": "说明"}
  ],
  "suggestion": "改进建议（1-2句话）"
}`
        }, {
          role: 'user',
          content: `角色名: ${agent.name}
角色人设: ${agent.description || '虚拟女友'}
当前亲密度: ${analysis.context?.intimacy || 0}
用户类型: ${analysis.context?.userType || 'unknown'}
对话轮次: ${analysis.conversation?.turnNumber || 0}

用户说: "${analysis.conversation?.userMessage || ''}"
AI回复: "${analysis.conversation?.aiResponse || ''}"`
        }],
        response_format: { type: 'json_object' },
        temperature: 0.3 // 低温度保证评估稳定性
      });
      
      const result = JSON.parse(evaluation.choices[0].message.content);
      
      // 更新分析记录
      analysis.scores = result.scores;
      analysis.issues = result.issues || [];
      analysis.suggestion = result.suggestion;
      analysis.evaluationStatus = 'evaluated';
      analysis.evaluatedAt = new Date();
      analysis.evaluationModel = 'gpt-4o-mini';
      
      // 高严重度问题标记需要人工审核
      if (analysis.issues.some(i => i.severity === 'high')) {
        analysis.flaggedForReview = true;
      }
      
      await analysis.save();
      return analysis;
      
    } catch (err) {
      console.error('[ConversationEvaluator] 评估失败:', err.message);
      analysis.evaluationStatus = 'error';
      await analysis.save();
      return null;
    }
  }
  
  /**
   * 批量评估待处理的对话
   */
  async evaluatePending(limit = 50) {
    const pending = await ConversationAnalysis.find({ evaluationStatus: 'pending' })
      .sort({ createdAt: 1 })
      .limit(limit);
    
    console.log(`[ConversationEvaluator] 开始评估 ${pending.length} 条对话...`);
    
    let evaluated = 0;
    let errors = 0;
    
    for (const analysis of pending) {
      const result = await this.evaluateResponse(analysis._id);
      if (result) {
        evaluated++;
      } else {
        errors++;
      }
      
      // 避免API限流
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`[ConversationEvaluator] 评估完成: 成功 ${evaluated}, 失败 ${errors}`);
    return { evaluated, errors };
  }
  
  /**
   * 获取主播的问题统计
   */
  async getIssueStats(agentId, days = 7) {
    return ConversationAnalysis.getIssueStats(agentId, days);
  }
  
  /**
   * 获取主播的平均评分
   */
  async getAverageScores(agentId, days = 7) {
    return ConversationAnalysis.getAverageScores(agentId, days);
  }
  
  /**
   * 获取需要优化的对话样本
   */
  async getLowScoreSamples(agentId, limit = 20) {
    return ConversationAnalysis.getLowScoreSamples(agentId, limit);
  }
  
  /**
   * 基于历史评估生成Prompt优化建议
   */
  async generatePromptOptimization(agentId) {
    const agent = await Agent.findById(agentId);
    if (!agent) return null;
    
    // 获取问题统计
    const issueStats = await this.getIssueStats(agentId, 14);
    const avgScores = await this.getAverageScores(agentId, 14);
    const lowSamples = await this.getLowScoreSamples(agentId, 10);
    
    if (!avgScores || avgScores.count < 20) {
      return { message: '数据不足，需要至少20条评估记录' };
    }
    
    try {
      const openai = this._getOpenAI();
      
      const optimization = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: `你是一个AI角色设计专家。根据对话质量分析数据，优化AI女友的System Prompt。

目标：
1. 解决最常见的问题
2. 提高互动性和自然度
3. 保持角色特色
4. 控制尺度节奏

输出格式：
{
  "analysis": "问题分析（2-3句话）",
  "improvements": ["改进点1", "改进点2", ...],
  "optimizedPrompt": "优化后的完整Prompt"
}`
        }, {
          role: 'user',
          content: `角色名: ${agent.name}
当前Prompt:
${agent.customPrompt || '(使用默认Prompt)'}

近14天平均评分:
- 相关性: ${avgScores.avgRelevance?.toFixed(1) || 'N/A'}
- 自然度: ${avgScores.avgNaturalness?.toFixed(1) || 'N/A'}
- 互动性: ${avgScores.avgEngagement?.toFixed(1) || 'N/A'}
- 情感匹配: ${avgScores.avgEmotionalMatch?.toFixed(1) || 'N/A'}
- 节奏控制: ${avgScores.avgPaceAppropriate?.toFixed(1) || 'N/A'}
- 人设一致: ${avgScores.avgCharacterConsistent?.toFixed(1) || 'N/A'}
- 综合: ${avgScores.avgOverall?.toFixed(1) || 'N/A'}

最常见问题:
${issueStats.map(i => `- ${i._id}: ${i.count}次 (高严重度: ${i.highSeverity}次)`).join('\n')}

低分对话样本:
${lowSamples.slice(0, 5).map((s, i) => `
${i+1}. 用户: "${s.conversation?.userMessage}"
   AI: "${s.conversation?.aiResponse}"
   问题: ${s.issues?.map(i => i.type).join(', ') || '无'}`).join('\n')}`
        }],
        response_format: { type: 'json_object' },
        temperature: 0.5
      });
      
      const result = JSON.parse(optimization.choices[0].message.content);
      
      return {
        agentId,
        agentName: agent.name,
        currentPrompt: agent.customPrompt,
        avgScores,
        issueStats,
        ...result,
        generatedAt: new Date()
      };
      
    } catch (err) {
      console.error('[ConversationEvaluator] Prompt优化失败:', err.message);
      return { error: err.message };
    }
  }
  
  /**
   * 生成对话质量日报
   */
  async generateDailyReport() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    // 获取各主播的对话质量
    const agents = await Agent.find({ status: 'active' });
    const agentReports = [];
    
    for (const agent of agents) {
      const todayAnalyses = await ConversationAnalysis.find({
        agentId: agent._id,
        createdAt: { $gte: yesterday },
        evaluationStatus: 'evaluated'
      });
      
      if (todayAnalyses.length === 0) continue;
      
      const avgScore = todayAnalyses.reduce((sum, a) => sum + (a.scores?.overall || 0), 0) / todayAnalyses.length;
      
      // 问题分布
      const issueCount = {};
      todayAnalyses.forEach(a => {
        (a.issues || []).forEach(i => {
          issueCount[i.type] = (issueCount[i.type] || 0) + 1;
        });
      });
      
      agentReports.push({
        agentId: agent._id,
        agentName: agent.name,
        totalConversations: todayAnalyses.length,
        avgScore: Math.round(avgScore * 10) / 10,
        topIssues: Object.entries(issueCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type, count]) => ({ type, count })),
        flaggedForReview: todayAnalyses.filter(a => a.flaggedForReview).length
      });
    }
    
    // 全局统计
    const globalStats = {
      totalEvaluated: await ConversationAnalysis.countDocuments({
        createdAt: { $gte: yesterday },
        evaluationStatus: 'evaluated'
      }),
      pendingEvaluation: await ConversationAnalysis.countDocuments({
        evaluationStatus: 'pending'
      }),
      flaggedForReview: await ConversationAnalysis.countDocuments({
        createdAt: { $gte: yesterday },
        flaggedForReview: true
      })
    };
    
    return {
      date: today.toISOString().split('T')[0],
      globalStats,
      agentReports: agentReports.sort((a, b) => b.totalConversations - a.totalConversations),
      generatedAt: new Date()
    };
  }
}

// 导出单例
module.exports = new ConversationEvaluator();
