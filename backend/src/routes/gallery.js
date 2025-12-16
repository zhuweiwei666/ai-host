/**
 * 用户画廊 API 路由
 * 
 * - GET /api/gallery - 获取当前用户画廊
 * - GET /api/gallery/popular - 获取热门图片
 * - GET /api/gallery/agent/:agentId - 获取角色相关图片
 * - POST /api/gallery/:id/like - 点赞/取消点赞
 * - POST /api/gallery/:id/favorite - 收藏/取消收藏
 * - POST /api/gallery/:id/share - 记录转发
 * - GET /api/gallery/stats - 获取画廊统计
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const UserGallery = require('../models/UserGallery');

/**
 * GET /api/gallery
 * 获取当前用户的画廊
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, mediaType, source } = req.query;
    
    const query = { userId, isActive: true };
    
    if (mediaType) {
      query.mediaType = mediaType;
    }
    if (source) {
      query.source = source;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, total] = await Promise.all([
      UserGallery.find(query)
        .populate('agentId', 'name avatarUrls')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserGallery.countDocuments(query)
    ]);
    
    // 添加用户是否已点赞/收藏的标记
    const userIdStr = userId.toString();
    const itemsWithUserState = items.map(item => ({
      ...item,
      isLiked: item.likedByUsers?.some(id => id.toString() === userIdStr) || false,
      isFavorited: item.favoritedByUsers?.some(id => id.toString() === userIdStr) || false,
      likedByUsers: undefined,  // 不返回完整列表
      favoritedByUsers: undefined,
    }));
    
    sendSuccess(res, HTTP_STATUS.OK, {
      items: itemsWithUserState,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[Gallery API] Get error:', err);
    errors.internalError(res, '获取画廊失败');
  }
});

/**
 * GET /api/gallery/popular
 * 获取热门图片（公开的）
 */
router.get('/popular', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const items = await UserGallery.find({ 
      isPublic: true, 
      isActive: true,
      'stats.likes': { $gt: 0 }
    })
      .populate('agentId', 'name avatarUrls')
      .sort({ 'stats.likes': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const userIdStr = userId.toString();
    const itemsWithUserState = items.map(item => ({
      ...item,
      isLiked: item.likedByUsers?.some(id => id.toString() === userIdStr) || false,
      isFavorited: item.favoritedByUsers?.some(id => id.toString() === userIdStr) || false,
      likedByUsers: undefined,
      favoritedByUsers: undefined,
    }));
    
    sendSuccess(res, HTTP_STATUS.OK, { items: itemsWithUserState });
  } catch (err) {
    console.error('[Gallery API] Popular error:', err);
    errors.internalError(res, '获取热门图片失败');
  }
});

/**
 * GET /api/gallery/agent/:agentId
 * 获取角色相关的公开图片
 */
router.get('/agent/:agentId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { agentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return errors.badRequest(res, '无效的角色 ID');
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const items = await UserGallery.find({ 
      agentId,
      isPublic: true, 
      isActive: true 
    })
      .populate('agentId', 'name avatarUrls')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const userIdStr = userId.toString();
    const itemsWithUserState = items.map(item => ({
      ...item,
      isLiked: item.likedByUsers?.some(id => id.toString() === userIdStr) || false,
      isFavorited: item.favoritedByUsers?.some(id => id.toString() === userIdStr) || false,
      likedByUsers: undefined,
      favoritedByUsers: undefined,
    }));
    
    sendSuccess(res, HTTP_STATUS.OK, { items: itemsWithUserState });
  } catch (err) {
    console.error('[Gallery API] Agent gallery error:', err);
    errors.internalError(res, '获取角色图片失败');
  }
});

/**
 * POST /api/gallery/:id/like
 * 点赞/取消点赞
 */
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errors.badRequest(res, '无效的图片 ID');
    }
    
    const result = await UserGallery.toggleLike(id, userId);
    
    console.log(`[Gallery API] Like: id=${id}, userId=${userId}, liked=${result.liked}`);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('[Gallery API] Like error:', err);
    errors.badRequest(res, err.message || '操作失败');
  }
});

/**
 * POST /api/gallery/:id/favorite
 * 收藏/取消收藏
 */
router.post('/:id/favorite', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errors.badRequest(res, '无效的图片 ID');
    }
    
    const result = await UserGallery.toggleFavorite(id, userId);
    
    console.log(`[Gallery API] Favorite: id=${id}, userId=${userId}, favorited=${result.favorited}`);
    
    sendSuccess(res, HTTP_STATUS.OK, result);
  } catch (err) {
    console.error('[Gallery API] Favorite error:', err);
    errors.badRequest(res, err.message || '操作失败');
  }
});

/**
 * POST /api/gallery/:id/share
 * 记录转发
 */
router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errors.badRequest(res, '无效的图片 ID');
    }
    
    await UserGallery.incrementShare(id);
    
    const item = await UserGallery.findById(id).select('stats.shares').lean();
    
    console.log(`[Gallery API] Share: id=${id}`);
    
    sendSuccess(res, HTTP_STATUS.OK, { shares: item?.stats?.shares || 0 });
  } catch (err) {
    console.error('[Gallery API] Share error:', err);
    errors.badRequest(res, err.message || '操作失败');
  }
});

/**
 * POST /api/gallery/:id/view
 * 记录查看
 */
router.post('/:id/view', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errors.badRequest(res, '无效的图片 ID');
    }
    
    await UserGallery.incrementView(id);
    
    sendSuccess(res, HTTP_STATUS.OK, { success: true });
  } catch (err) {
    console.error('[Gallery API] View error:', err);
    errors.badRequest(res, err.message || '操作失败');
  }
});

/**
 * GET /api/gallery/stats
 * 获取用户画廊统计
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [totalImages, totalVideos, totalLikes, totalShares] = await Promise.all([
      UserGallery.countDocuments({ userId, mediaType: 'image', isActive: true }),
      UserGallery.countDocuments({ userId, mediaType: 'video', isActive: true }),
      UserGallery.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), isActive: true } },
        { $group: { _id: null, total: { $sum: '$stats.likes' } } }
      ]),
      UserGallery.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), isActive: true } },
        { $group: { _id: null, total: { $sum: '$stats.shares' } } }
      ])
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      totalImages,
      totalVideos,
      totalMedia: totalImages + totalVideos,
      totalLikes: totalLikes[0]?.total || 0,
      totalShares: totalShares[0]?.total || 0,
    });
  } catch (err) {
    console.error('[Gallery API] Stats error:', err);
    errors.internalError(res, '获取统计失败');
  }
});

/**
 * DELETE /api/gallery/:id
 * 删除画廊项目（软删除）
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errors.badRequest(res, '无效的图片 ID');
    }
    
    const item = await UserGallery.findOne({ _id: id, userId });
    if (!item) {
      return errors.notFound(res, '图片不存在或无权删除');
    }
    
    item.isActive = false;
    await item.save();
    
    sendSuccess(res, HTTP_STATUS.OK, { success: true });
  } catch (err) {
    console.error('[Gallery API] Delete error:', err);
    errors.badRequest(res, err.message || '删除失败');
  }
});

/**
 * PATCH /api/gallery/:id/visibility
 * 切换图片公开/私密状态
 */
router.patch('/:id/visibility', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { isPublic } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errors.badRequest(res, '无效的图片 ID');
    }
    
    const item = await UserGallery.findOne({ _id: id, userId });
    if (!item) {
      return errors.notFound(res, '图片不存在或无权修改');
    }
    
    item.isPublic = isPublic;
    await item.save();
    
    sendSuccess(res, HTTP_STATUS.OK, { isPublic: item.isPublic });
  } catch (err) {
    console.error('[Gallery API] Visibility error:', err);
    errors.badRequest(res, err.message || '修改失败');
  }
});

module.exports = router;
