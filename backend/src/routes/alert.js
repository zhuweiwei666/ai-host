/**
 * 告警管理 API - AI自进化系统 Phase 4
 */
const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const AlertRule = require('../models/AlertRule');
const alertService = require('../services/alertService');
const notificationService = require('../services/notificationService');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');

// ==================== 告警列表和统计 ====================

// GET /api/alert/stats - 获取告警统计
router.get('/stats', async (req, res) => {
  try {
    const stats = await alertService.getStats();
    sendSuccess(res, HTTP_STATUS.OK, stats);
  } catch (err) {
    console.error('Alert Stats Error:', err);
    errors.internalError(res, 'Failed to get alert stats');
  }
});

// GET /api/alert/list - 获取告警列表
router.get('/list', async (req, res) => {
  const { limit = 50, status, severity, type, agentId } = req.query;
  
  try {
    const alerts = await alertService.getRecent(Number(limit), {
      status,
      severity,
      type,
      agentId,
    });
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      count: alerts.length,
      alerts 
    });
  } catch (err) {
    console.error('Alert List Error:', err);
    errors.internalError(res, 'Failed to get alerts');
  }
});

// GET /api/alert/:id - 获取告警详情
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const alert = await Alert.findById(id)
      .populate('agentId', 'name avatarUrl')
      .lean();
    
    if (!alert) {
      return errors.notFound(res, 'Alert not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, alert);
  } catch (err) {
    console.error('Alert Detail Error:', err);
    errors.internalError(res, 'Failed to get alert');
  }
});

// ==================== 告警操作 ====================

// POST /api/alert/:id/acknowledge - 确认告警
router.post('/:id/acknowledge', async (req, res) => {
  const { id } = req.params;
  const acknowledgedBy = req.user?.id || 'admin';
  
  try {
    const result = await alertService.acknowledge([id], acknowledgedBy);
    
    if (result.modifiedCount === 0) {
      return errors.notFound(res, 'Alert not found or already acknowledged');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, { success: true });
  } catch (err) {
    console.error('Acknowledge Error:', err);
    errors.internalError(res, 'Failed to acknowledge alert');
  }
});

// POST /api/alert/acknowledge-batch - 批量确认告警
router.post('/acknowledge-batch', async (req, res) => {
  const { alertIds } = req.body;
  const acknowledgedBy = req.user?.id || 'admin';
  
  if (!alertIds || !Array.isArray(alertIds)) {
    return errors.badRequest(res, 'alertIds is required');
  }
  
  try {
    const result = await alertService.acknowledge(alertIds, acknowledgedBy);
    sendSuccess(res, HTTP_STATUS.OK, { 
      acknowledged: result.modifiedCount 
    });
  } catch (err) {
    console.error('Batch Acknowledge Error:', err);
    errors.internalError(res, 'Failed to acknowledge alerts');
  }
});

// POST /api/alert/:id/resolve - 解决告警
router.post('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;
  const resolvedBy = req.user?.id || 'admin';
  
  try {
    const alert = await alertService.resolve(id, resolvedBy, resolution);
    
    if (!alert) {
      return errors.notFound(res, 'Alert not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, alert);
  } catch (err) {
    console.error('Resolve Error:', err);
    errors.internalError(res, 'Failed to resolve alert');
  }
});

// POST /api/alert/:id/ignore - 忽略告警
router.post('/:id/ignore', async (req, res) => {
  const { id } = req.params;
  
  try {
    const alert = await Alert.findByIdAndUpdate(id, {
      status: 'ignored',
    }, { new: true });
    
    if (!alert) {
      return errors.notFound(res, 'Alert not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, alert);
  } catch (err) {
    console.error('Ignore Error:', err);
    errors.internalError(res, 'Failed to ignore alert');
  }
});

// ==================== 告警规则管理 ====================

// GET /api/alert/rules/list - 获取规则列表
router.get('/rules/list', async (req, res) => {
  try {
    const rules = await AlertRule.find().sort({ type: 1 }).lean();
    sendSuccess(res, HTTP_STATUS.OK, { rules });
  } catch (err) {
    console.error('List Rules Error:', err);
    errors.internalError(res, 'Failed to get rules');
  }
});

// GET /api/alert/rules/:id - 获取规则详情
router.get('/rules/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const rule = await AlertRule.findById(id).lean();
    
    if (!rule) {
      return errors.notFound(res, 'Rule not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, rule);
  } catch (err) {
    console.error('Get Rule Error:', err);
    errors.internalError(res, 'Failed to get rule');
  }
});

// POST /api/alert/rules - 创建规则
router.post('/rules', async (req, res) => {
  const { name, description, type, conditions, filters, severity, notifications } = req.body;
  
  if (!name || !type || !conditions) {
    return errors.badRequest(res, 'name, type, and conditions are required');
  }
  
  try {
    const rule = await AlertRule.create({
      name,
      description,
      type,
      conditions,
      filters,
      severity,
      notifications,
      createdBy: req.user?.id || 'admin',
    });
    
    sendSuccess(res, HTTP_STATUS.CREATED, rule);
  } catch (err) {
    console.error('Create Rule Error:', err);
    errors.internalError(res, 'Failed to create rule');
  }
});

// PUT /api/alert/rules/:id - 更新规则
router.put('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  try {
    const rule = await AlertRule.findByIdAndUpdate(id, updates, { new: true });
    
    if (!rule) {
      return errors.notFound(res, 'Rule not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, rule);
  } catch (err) {
    console.error('Update Rule Error:', err);
    errors.internalError(res, 'Failed to update rule');
  }
});

// POST /api/alert/rules/:id/toggle - 启用/禁用规则
router.post('/rules/:id/toggle', async (req, res) => {
  const { id } = req.params;
  
  try {
    const rule = await AlertRule.findById(id);
    
    if (!rule) {
      return errors.notFound(res, 'Rule not found');
    }
    
    rule.enabled = !rule.enabled;
    await rule.save();
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      enabled: rule.enabled,
      message: rule.enabled ? '规则已启用' : '规则已禁用'
    });
  } catch (err) {
    console.error('Toggle Rule Error:', err);
    errors.internalError(res, 'Failed to toggle rule');
  }
});

// DELETE /api/alert/rules/:id - 删除规则
router.delete('/rules/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const rule = await AlertRule.findByIdAndDelete(id);
    
    if (!rule) {
      return errors.notFound(res, 'Rule not found');
    }
    
    sendSuccess(res, HTTP_STATUS.OK, { success: true });
  } catch (err) {
    console.error('Delete Rule Error:', err);
    errors.internalError(res, 'Failed to delete rule');
  }
});

// POST /api/alert/rules/init-defaults - 初始化默认规则
router.post('/rules/init-defaults', async (req, res) => {
  try {
    await AlertRule.initializeDefaults();
    const rules = await AlertRule.find().lean();
    sendSuccess(res, HTTP_STATUS.OK, { 
      message: '默认规则已初始化',
      count: rules.length 
    });
  } catch (err) {
    console.error('Init Defaults Error:', err);
    errors.internalError(res, 'Failed to initialize defaults');
  }
});

// ==================== 通知测试 ====================

// POST /api/alert/test-notification - 测试通知
router.post('/test-notification', async (req, res) => {
  const { channel, target } = req.body;
  
  if (!channel) {
    return errors.badRequest(res, 'channel is required');
  }
  
  try {
    // 创建测试告警
    const testAlert = {
      _id: 'test',
      type: 'system_error',
      severity: 'info',
      title: '通知测试',
      message: '这是一条测试通知，如果您收到此消息，说明通知配置正确。',
      data: {
        metric: 'test',
        details: { test: true }
      },
      createdAt: new Date(),
      notifications: [],
      save: async () => {},  // mock save
    };
    
    const result = await notificationService.sendToChannel(channel, target, testAlert);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('Test Notification Error:', err);
    errors.internalError(res, 'Failed to send test notification');
  }
});

// POST /api/alert/run-check - 手动运行告警检测
router.post('/run-check', async (req, res) => {
  try {
    const result = await alertService.runAllChecks();
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('Run Check Error:', err);
    errors.internalError(res, 'Failed to run alert check');
  }
});

module.exports = router;
