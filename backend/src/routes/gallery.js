/**
 * UGC 内容广场 API 路由
 * 
 * 公共广场（所有用户的公开内容）:
 * - GET /api/gallery - 内容广场首页（推荐/最新）
 * - GET /api/gallery/hot - 热门内容
 * - GET /api/gallery/latest - 最新内容
 * - GET /api/gallery/agent/:agentId - 角色相关内容
 * 
 * 我的画廊:
 * - GET /api/gallery/mine - 我的图片
 * 
 * 互动:
 * - POST /api/gallery/:id/like - 点赞/取消点赞
 * - POST /api/gallery/:id/favorite - 收藏/取消收藏
 * - POST /api/gallery/:id/share - 记录转发
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess, errors, HTTP_STATUS } = require('../utils/errorHandler');
const UserGallery = require('../models/UserGallery');
const StorySession = require('../models/StorySession');

/**
 * 处理图片列表，添加用户状态
 */
function processItems(items, userId) {
  const userIdStr = userId?.toString();
  return items.map(item => {
    // 处理 populate 失败的情况，确保 userId 至少返回 _id
    if (item.userId) {
      if (typeof item.userId === 'object' && !item.userId.username) {
        item.userId = { _id: item.userId._id || item.userId };
      }
    }
    
    return {
      ...item,
      isLiked: userIdStr ? (item.likedByUsers?.some(id => id.toString() === userIdStr) || false) : false,
      isFavorited: userIdStr ? (item.favoritedByUsers?.some(id => id.toString() === userIdStr) || false) : false,
      likedByUsers: undefined,
      favoritedByUsers: undefined,
    };
  });
}

/**
 * GET /api/gallery
 * 内容广场首页 - 展示所有用户的公开内容（推荐算法）
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, mediaType, agentId, sort = 'mixed' } = req.query;
    
    // 基础查询：所有公开且有效的内容
    const query = { isPublic: true, isActive: true };
    
    if (mediaType) {
      query.mediaType = mediaType;
    }
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      query.agentId = agentId;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 排序策略
    let sortOption = {};
    if (sort === 'hot') {
      // 热门：按点赞数降序
      sortOption = { 'stats.likes': -1, createdAt: -1 };
    } else if (sort === 'latest') {
      // 最新：按时间降序
      sortOption = { createdAt: -1 };
    } else {
      // 混合：交替展示热门和最新（简单实现：按综合分数）
      // 综合分数 = 点赞数 * 10 + 24小时内额外加权
      sortOption = { createdAt: -1 };
    }
    
    const [items, total] = await Promise.all([
      UserGallery.find(query)
        .populate('agentId', 'name avatarUrls style')
        .populate('userId', 'username avatar')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserGallery.countDocuments(query)
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      items: processItems(items, userId),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[Gallery API] Feed error:', err);
    errors.internalError(res, '获取内容广场失败');
  }
});

/**
 * GET /api/gallery/hot
 * 热门内容
 */
router.get('/hot', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, agentId } = req.query;
    
    const query = { isPublic: true, isActive: true };
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      query.agentId = agentId;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, total] = await Promise.all([
      UserGallery.find(query)
        .populate('agentId', 'name avatarUrls style')
        .populate('userId', 'username avatar')
        .sort({ 'stats.likes': -1, 'stats.views': -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserGallery.countDocuments(query)
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      items: processItems(items, userId),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('[Gallery API] Hot error:', err);
    errors.internalError(res, '获取热门内容失败');
  }
});

/**
 * GET /api/gallery/latest
 * 最新内容
 */
router.get('/latest', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, agentId } = req.query;
    
    const query = { isPublic: true, isActive: true };
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      query.agentId = agentId;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, total] = await Promise.all([
      UserGallery.find(query)
        .populate('agentId', 'name avatarUrls style')
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserGallery.countDocuments(query)
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, {
      items: processItems(items, userId),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('[Gallery API] Latest error:', err);
    errors.internalError(res, '获取最新内容失败');
  }
});

/**
 * GET /api/gallery/mine
 * 我的画廊
 */
router.get('/mine', requireAuth, async (req, res) => {
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
    
    sendSuccess(res, HTTP_STATUS.OK, {
      items: processItems(items, userId),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[Gallery API] Mine error:', err);
    errors.internalError(res, '获取我的画廊失败');
  }
});

/**
 * GET /api/gallery/sync
 * 同步历史图片到画廊（一次性迁移）
 * 从 StorySession 中提取所有已生成的图片
 */
router.post('/sync', requireAuth, async (req, res) => {
  try {
    // 查找所有有图片的故事段落
    const sessions = await StorySession.find({
      'paragraphs.imageUrl': { $exists: true, $ne: null }
    }).lean();
    
    let synced = 0;
    
    for (const session of sessions) {
      for (const paragraph of session.paragraphs) {
        if (paragraph.imageUrl) {
          // 检查是否已存在
          const exists = await UserGallery.findOne({ mediaUrl: paragraph.imageUrl });
          if (!exists) {
            await UserGallery.create({
              userId: session.userId,
              agentId: session.agentId,
              mediaType: 'image',
              mediaUrl: paragraph.imageUrl,
              source: 'story',
              storySessionId: session._id,
              prompt: paragraph.imagePrompt || '',
              context: paragraph.content?.slice(0, 200) || '',
              isPublic: true,
              isNsfw: session.progress >= 60,
              createdAt: paragraph.timestamp || session.createdAt,
            });
            synced++;
          }
        }
      }
    }
    
    console.log(`[Gallery] 同步完成: ${synced} 张图片`);
    sendSuccess(res, HTTP_STATUS.OK, { synced });
  } catch (err) {
    console.error('[Gallery API] Sync error:', err);
    errors.internalError(res, '同步失败');
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
    
    const [items, total] = await Promise.all([
      UserGallery.find({ 
        agentId,
        isPublic: true, 
        isActive: true 
      })
        .populate('agentId', 'name avatarUrls style')
        .populate('userId', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserGallery.countDocuments({ agentId, isPublic: true, isActive: true })
    ]);
    
    sendSuccess(res, HTTP_STATUS.OK, { 
      items: processItems(items, userId),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
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
