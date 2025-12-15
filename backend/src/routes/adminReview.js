/**
 * 管理员审核 API
 * 
 * 管理员审核用户创建的角色
 * 
 * - GET /api/admin/review/pending - 获取待审核列表
 * - GET /api/admin/review/all - 获取所有用户创建的角色（可筛选）
 * - GET /api/admin/review/:id - 获取角色审核详情
 * - POST /api/admin/review/:id/approve - 审核通过
 * - POST /api/admin/review/:id/reject - 审核拒绝
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Agent = require('../models/Agent');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');

/**
 * GET /api/admin/review/pending
 * 获取待审核列表
 */
router.get('/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const agents = await Agent.find({ visibility: 'pending' })
      .populate('creatorId', 'username email avatar')
      .select('name gender style description avatarUrls visibility reviewStatus createdAt updatedAt')
      .sort({ 'reviewStatus.submittedAt': 1 }) // 先提交的优先
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Agent.countDocuments({ visibility: 'pending' });
    
    sendSuccess(res, HTTP_STATUS.OK, {
      agents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[AdminReview] Get pending error:', err);
    errors.internalError(res, '获取待审核列表失败');
  }
});

/**
 * GET /api/admin/review/all
 * 获取所有用户创建的角色（可筛选）
 */
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      visibility, 
      creatorId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const query = { creatorType: 'user' };
    if (visibility) {
      query.visibility = visibility;
    }
    if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) {
      query.creatorId = creatorId;
    }
    
    // 构建排序
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const agents = await Agent.find(query)
      .populate('creatorId', 'username email avatar')
      .select('name gender style description avatarUrls visibility reviewStatus stats createdAt updatedAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Agent.countDocuments(query);
    
    // 统计各状态数量
    const statusCounts = await Agent.aggregate([
      { $match: { creatorType: 'user' } },
      { $group: { _id: '$visibility', count: { $sum: 1 } } }
    ]);
    
    const stats = {
      private: 0,
      pending: 0,
      public: 0,
      rejected: 0
    };
    statusCounts.forEach(s => {
      stats[s._id] = s.count;
    });
    
    sendSuccess(res, HTTP_STATUS.OK, {
      agents,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[AdminReview] Get all error:', err);
    errors.internalError(res, '获取角色列表失败');
  }
});

/**
 * GET /api/admin/review/:id
 * 获取角色审核详情
 */
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findById(agentId)
      .populate('creatorId', 'username email avatar createdAt')
      .populate('reviewStatus.reviewerId', 'username')
      .populate('reviewStatus.reviewHistory.by', 'username');
    
    if (!agent) {
      return errors.notFound(res, '角色不存在');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, agent);
  } catch (err) {
    console.error('[AdminReview] Get detail error:', err);
    errors.internalError(res, '获取角色详情失败');
  }
});

/**
 * POST /api/admin/review/:id/approve
 * 审核通过
 */
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.id;
    const adminId = req.user.id;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const agent = await Agent.findById(agentId);
    
    if (!agent) {
      return errors.notFound(res, '角色不存在');
    }
    
    if (agent.visibility !== 'pending') {
      return errors.badRequest(res, '只能审核待审核状态的角色');
    }
    
    // 更新状态
    agent.visibility = 'public';
    agent.reviewStatus = agent.reviewStatus || {};
    agent.reviewStatus.reviewedAt = new Date();
    agent.reviewStatus.reviewerId = adminId;
    agent.reviewStatus.reviewHistory = agent.reviewStatus.reviewHistory || [];
    agent.reviewStatus.reviewHistory.push({
      action: 'approve',
      at: new Date(),
      by: adminId
    });
    
    await agent.save();
    
    console.log(`[AdminReview] Admin ${adminId} approved agent ${agentId}`);
    
    // TODO: 发送通知给创建者（审核通过）
    
    sendSuccess(res, HTTP_STATUS.OK, agent, '审核通过，角色已公开');
  } catch (err) {
    console.error('[AdminReview] Approve error:', err);
    errors.internalError(res, '审核操作失败');
  }
});

/**
 * POST /api/admin/review/:id/reject
 * 审核拒绝
 */
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.id;
    const adminId = req.user.id;
    const { reason } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    if (!reason || reason.trim() === '') {
      return errors.badRequest(res, '请填写拒绝原因');
    }
    
    const agent = await Agent.findById(agentId);
    
    if (!agent) {
      return errors.notFound(res, '角色不存在');
    }
    
    if (agent.visibility !== 'pending') {
      return errors.badRequest(res, '只能审核待审核状态的角色');
    }
    
    // 更新状态
    agent.visibility = 'rejected';
    agent.reviewStatus = agent.reviewStatus || {};
    agent.reviewStatus.reviewedAt = new Date();
    agent.reviewStatus.reviewerId = adminId;
    agent.reviewStatus.rejectReason = reason.trim();
    agent.reviewStatus.reviewHistory = agent.reviewStatus.reviewHistory || [];
    agent.reviewStatus.reviewHistory.push({
      action: 'reject',
      at: new Date(),
      by: adminId,
      reason: reason.trim()
    });
    
    await agent.save();
    
    console.log(`[AdminReview] Admin ${adminId} rejected agent ${agentId}: ${reason}`);
    
    // TODO: 发送通知给创建者（审核拒绝，包含原因）
    
    sendSuccess(res, HTTP_STATUS.OK, agent, '已拒绝该角色');
  } catch (err) {
    console.error('[AdminReview] Reject error:', err);
    errors.internalError(res, '审核操作失败');
  }
});

/**
 * POST /api/admin/review/:id/set-visibility
 * 直接设置可见性（管理员强制操作）
 */
router.post('/:id/set-visibility', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agentId = req.params.id;
    const adminId = req.user.id;
    const { visibility, reason } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    if (!['private', 'public', 'rejected'].includes(visibility)) {
      return errors.badRequest(res, '无效的可见性状态');
    }
    
    const agent = await Agent.findById(agentId);
    
    if (!agent) {
      return errors.notFound(res, '角色不存在');
    }
    
    const oldVisibility = agent.visibility;
    agent.visibility = visibility;
    
    if (visibility === 'rejected' && reason) {
      agent.reviewStatus = agent.reviewStatus || {};
      agent.reviewStatus.rejectReason = reason;
    }
    
    agent.reviewStatus = agent.reviewStatus || {};
    agent.reviewStatus.reviewHistory = agent.reviewStatus.reviewHistory || [];
    agent.reviewStatus.reviewHistory.push({
      action: `set_${visibility}`,
      at: new Date(),
      by: adminId,
      reason: reason || `Changed from ${oldVisibility} to ${visibility}`
    });
    
    await agent.save();
    
    console.log(`[AdminReview] Admin ${adminId} set agent ${agentId} visibility to ${visibility}`);
    
    sendSuccess(res, HTTP_STATUS.OK, agent, `已将角色设为 ${visibility}`);
  } catch (err) {
    console.error('[AdminReview] Set visibility error:', err);
    errors.internalError(res, '操作失败');
  }
});

module.exports = router;
