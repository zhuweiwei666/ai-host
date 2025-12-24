const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Application = require('../models/Application');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');

// 管理员权限保护
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/applications - 获取应用列表
 */
router.get('/', async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
    sendSuccess(res, HTTP_STATUS.OK, apps);
  } catch (err) {
    errors.internalError(res, err.message);
  }
});

/**
 * POST /api/applications - 创建应用
 */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return errors.badRequest(res, '应用名称必填');

    const appId = `app_${crypto.randomBytes(4).toString('hex')}`;
    const secretKey = crypto.randomBytes(16).toString('hex');

    const app = await Application.create({
      appId,
      name,
      secretKey,
      description
    });

    sendSuccess(res, HTTP_STATUS.CREATED, app);
  } catch (err) {
    errors.internalError(res, err.message);
  }
});

/**
 * POST /api/applications/:appId/channels - 添加渠道
 */
router.post('/:appId/channels', async (req, res) => {
  try {
    const { appId } = req.params;
    const { channelId, name } = req.body;

    if (!channelId || !name) return errors.badRequest(res, '渠道ID和名称必填');

    const app = await Application.findOne({ appId });
    if (!app) return errors.notFound(res, '应用不存在');

    if (app.channels.some(c => c.channelId === channelId)) {
      return errors.badRequest(res, '渠道ID已存在');
    }

    app.channels.push({ channelId, name });
    await app.save();

    sendSuccess(res, HTTP_STATUS.OK, app);
  } catch (err) {
    errors.internalError(res, err.message);
  }
});

module.exports = router;
