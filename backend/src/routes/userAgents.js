/**
 * 用户创建角色 API
 * 
 * 允许普通用户创建、编辑、管理自己的 AI 角色
 * 
 * - POST /api/user-agents/create - 创建角色
 * - GET /api/user-agents/my-agents - 获取我的角色列表
 * - GET /api/user-agents/:id - 获取我的角色详情
 * - PUT /api/user-agents/:id - 编辑我的角色
 * - DELETE /api/user-agents/:id - 删除我的角色
 * - POST /api/user-agents/:id/submit-review - 提交审核
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Agent = require('../models/Agent');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');

// 用户创建角色时允许设置的字段
const USER_ALLOWED_FIELDS = [
  'name',
  'gender', 
  'style',
  'description',
  'avatarUrls',
  'systemPrompt',
  'voiceId',
  'defaultGreeting'
];

// 用户每人最多创建的角色数量
const MAX_AGENTS_PER_USER = 10;

/**
 * POST /api/user-agents/create
 * 用户创建角色
 */
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 检查用户创建数量限制
    const existingCount = await Agent.countDocuments({ creatorId: userId });
    if (existingCount >= MAX_AGENTS_PER_USER) {
      return errors.badRequest(res, `每个用户最多创建 ${MAX_AGENTS_PER_USER} 个角色`);
    }
    
    // 只允许设置特定字段
    const agentData = {};
    USER_ALLOWED_FIELDS.forEach(field => {
      if (req.body[field] !== undefined) {
        agentData[field] = req.body[field];
      }
    });
    
    // 验证必填字段
    if (!agentData.name || agentData.name.trim() === '') {
      return errors.badRequest(res, '角色名称不能为空');
    }
    
    // 设置用户创建标识
    agentData.creatorId = userId;
    agentData.creatorType = 'user';
    agentData.visibility = 'private'; // 默认私有
    agentData.status = 'online';
    
    // 设置默认值
    agentData.modelName = 'grok-4-1-fast-reasoning'; // 使用默认模型
    agentData.temperature = 0.7;
    
    const agent = new Agent(agentData);
    await agent.save();
    
    console.log(`[UserAgents] User ${userId} created agent: ${agent._id} (${agent.name})`);
    
    sendSuccess(res, HTTP_STATUS.CREATED, agent);
  } catch (err) {
    console.error('[UserAgents] Create error:', err);
    errors.badRequest(res, err.message || '创建角色失败');
  }
});

/**
 * GET /api/user-agents/my-agents
 * 获取我的角色列表
 */
router.get('/my-agents', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const agents = await Agent.find({ creatorId: userId })
      .select('name gender style description avatarUrls visibility status stats createdAt updatedAt reviewStatus')
      .sort({ createdAt: -1 });
    
    sendSuccess(res, HTTP_STATUS.OK, agents);
  } catch (err) {
    console.error('[UserAgents] Get my agents error:', err);
    errors.internalError(res, '获取角色列表失败');
  }
});

/**
 * GET /api/user-agents/:id
 * 获取我的角色详情
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agentId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findOne({ 
      _id: agentId, 
      creatorId: userId 
    });
    
    if (!agent) {
      return errors.notFound(res, '角色不存在或无权访问');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, agent);
  } catch (err) {
    console.error('[UserAgents] Get agent error:', err);
    errors.internalError(res, '获取角色详情失败');
  }
});

/**
 * PUT /api/user-agents/:id
 * 编辑我的角色
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agentId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findOne({ 
      _id: agentId, 
      creatorId: userId 
    });
    
    if (!agent) {
      return errors.notFound(res, '角色不存在或无权编辑');
    }
    
    // 如果正在审核中，不允许编辑
    if (agent.visibility === 'pending') {
      return errors.badRequest(res, '角色正在审核中，无法编辑。请等待审核完成或撤回审核申请。');
    }
    
    // 只允许编辑特定字段
    USER_ALLOWED_FIELDS.forEach(field => {
      if (req.body[field] !== undefined) {
        agent[field] = req.body[field];
      }
    });
    
    // 验证必填字段
    if (!agent.name || agent.name.trim() === '') {
      return errors.badRequest(res, '角色名称不能为空');
    }
    
    // 如果之前被拒绝，修改后重置为 private（可重新提交审核）
    if (agent.visibility === 'rejected') {
      agent.visibility = 'private';
    }
    
    await agent.save();
    
    console.log(`[UserAgents] User ${userId} updated agent: ${agent._id}`);
    
    sendSuccess(res, HTTP_STATUS.OK, agent);
  } catch (err) {
    console.error('[UserAgents] Update error:', err);
    errors.badRequest(res, err.message || '更新角色失败');
  }
});

/**
 * DELETE /api/user-agents/:id
 * 删除我的角色
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agentId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findOneAndDelete({ 
      _id: agentId, 
      creatorId: userId 
    });
    
    if (!agent) {
      return errors.notFound(res, '角色不存在或无权删除');
    }
    
    console.log(`[UserAgents] User ${userId} deleted agent: ${agentId}`);
    
    sendSuccess(res, HTTP_STATUS.OK, null, '角色已删除');
  } catch (err) {
    console.error('[UserAgents] Delete error:', err);
    errors.internalError(res, '删除角色失败');
  }
});

/**
 * POST /api/user-agents/:id/submit-review
 * 提交审核
 */
router.post('/:id/submit-review', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agentId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findOne({ 
      _id: agentId, 
      creatorId: userId 
    });
    
    if (!agent) {
      return errors.notFound(res, '角色不存在或无权操作');
    }
    
    // 只有 private 或 rejected 状态可以提交审核
    if (agent.visibility !== 'private' && agent.visibility !== 'rejected') {
      return errors.badRequest(res, '只有私有或被拒绝的角色可以提交审核');
    }
    
    // 检查必要信息是否完整
    if (!agent.name || agent.name.trim() === '') {
      return errors.badRequest(res, '请先完善角色名称');
    }
    if (!agent.avatarUrls || agent.avatarUrls.length === 0) {
      return errors.badRequest(res, '请先上传角色头像');
    }
    
    // 更新状态
    agent.visibility = 'pending';
    agent.reviewStatus = agent.reviewStatus || {};
    agent.reviewStatus.submittedAt = new Date();
    agent.reviewStatus.rejectReason = ''; // 清除之前的拒绝原因
    agent.reviewStatus.reviewHistory = agent.reviewStatus.reviewHistory || [];
    agent.reviewStatus.reviewHistory.push({
      action: 'submit',
      at: new Date(),
      by: userId
    });
    
    await agent.save();
    
    console.log(`[UserAgents] User ${userId} submitted agent ${agentId} for review`);
    
    // TODO: 发送通知给管理员
    
    sendSuccess(res, HTTP_STATUS.OK, agent, '已提交审核，请等待管理员审核');
  } catch (err) {
    console.error('[UserAgents] Submit review error:', err);
    errors.internalError(res, '提交审核失败');
  }
});

/**
 * POST /api/user-agents/:id/withdraw-review
 * 撤回审核申请
 */
router.post('/:id/withdraw-review', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const agentId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findOne({ 
      _id: agentId, 
      creatorId: userId 
    });
    
    if (!agent) {
      return errors.notFound(res, '角色不存在或无权操作');
    }
    
    // 只有 pending 状态可以撤回
    if (agent.visibility !== 'pending') {
      return errors.badRequest(res, '只有待审核的角色可以撤回');
    }
    
    agent.visibility = 'private';
    agent.reviewStatus.reviewHistory.push({
      action: 'withdraw',
      at: new Date(),
      by: userId
    });
    
    await agent.save();
    
    console.log(`[UserAgents] User ${userId} withdrew review for agent ${agentId}`);
    
    sendSuccess(res, HTTP_STATUS.OK, agent, '已撤回审核申请');
  } catch (err) {
    console.error('[UserAgents] Withdraw review error:', err);
    errors.internalError(res, '撤回审核失败');
  }
});

module.exports = router;
