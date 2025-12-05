const AiUgcImage = require('../models/AiUgcImage');

/**
 * AI UGC 相册服务
 * 管理主播的 AI 生成图片相册，实现图片复用以降低 API 成本
 */
class UgcImageService {
  // 每个主播的相册上限（SFW 和 NSFW 各自独立计算）
  static MAX_IMAGES_PER_CATEGORY = 100;

  /**
   * 从相册获取可用图片
   * @param {string} agentId - 主播 ID
   * @param {string} userId - 当前用户 ID
   * @param {boolean} isNsfw - 是否请求 NSFW 图片
   * @returns {Object|null} 图片对象或 null（需要生成新图）
   */
  async getAvailableImage(agentId, userId, isNsfw = false) {
    // 查找条件：
    // 1. 属于该主播
    // 2. 是启用状态
    // 3. 尺度匹配（NSFW / SFW）
    // 4. 不是该用户生成的
    // 5. 还没发给过该用户
    const image = await AiUgcImage.findOne({
      agentId,
      isActive: true,
      isNsfw,
      generatedByUserId: { $ne: userId },
      sentToUserIds: { $nin: [userId] }
    }).sort({ usageCount: 1, createdAt: -1 }); // 优先使用次数少的，同使用次数取较新的

    return image;
  }

  /**
   * 标记图片已发送给某用户
   * @param {string} imageId - 图片 ID
   * @param {string} userId - 用户 ID
   */
  async markAsSent(imageId, userId) {
    await AiUgcImage.findByIdAndUpdate(imageId, {
      $addToSet: { sentToUserIds: userId },
      $inc: { usageCount: 1 }
    });
  }

  /**
   * 保存新生成的图片到相册
   * @param {Object} params - 参数
   * @param {string} params.agentId - 主播 ID
   * @param {string} params.imageUrl - 图片 URL
   * @param {string} params.prompt - 生成 prompt
   * @param {string} params.generatedByUserId - 生成者用户 ID
   * @param {boolean} params.isNsfw - 是否 NSFW
   * @returns {Object} 创建的图片记录
   */
  async saveGeneratedImage({ agentId, imageUrl, prompt, generatedByUserId, isNsfw }) {
    // 先检查是否需要淘汰旧图
    await this.enforceLimit(agentId, isNsfw);

    // 创建新记录
    const image = await AiUgcImage.create({
      agentId,
      imageUrl,
      prompt,
      generatedByUserId,
      isNsfw,
      sentToUserIds: [generatedByUserId], // 生成者已经看过了
      usageCount: 1
    });

    console.log(`[UGC] 新图片已存入相册: agentId=${agentId}, isNsfw=${isNsfw}, imageId=${image._id}`);
    return image;
  }

  /**
   * 强制执行相册上限，淘汰最旧的图片
   * @param {string} agentId - 主播 ID
   * @param {boolean} isNsfw - NSFW 类别
   */
  async enforceLimit(agentId, isNsfw) {
    const count = await AiUgcImage.countDocuments({ agentId, isNsfw, isActive: true });
    
    if (count >= UgcImageService.MAX_IMAGES_PER_CATEGORY) {
      // 找出最旧的、使用次数最多的图片删除（已经被充分利用）
      const toDelete = await AiUgcImage.find({ agentId, isNsfw, isActive: true })
        .sort({ usageCount: -1, createdAt: 1 }) // 使用最多且最旧的
        .limit(count - UgcImageService.MAX_IMAGES_PER_CATEGORY + 1);

      if (toDelete.length > 0) {
        const ids = toDelete.map(img => img._id);
        await AiUgcImage.deleteMany({ _id: { $in: ids } });
        console.log(`[UGC] 淘汰 ${ids.length} 张旧图片: agentId=${agentId}, isNsfw=${isNsfw}`);
      }
    }
  }

  // ==================== 运营管理 API ====================

  /**
   * 获取主播的相册列表
   * @param {string} agentId - 主播 ID
   * @param {Object} options - 查询选项
   * @returns {Array} 图片列表
   */
  async listImages(agentId, { isNsfw, isActive, page = 1, limit = 20 } = {}) {
    const query = { agentId };
    
    if (typeof isNsfw === 'boolean') query.isNsfw = isNsfw;
    if (typeof isActive === 'boolean') query.isActive = isActive;

    const skip = (page - 1) * limit;
    
    const [images, total] = await Promise.all([
      AiUgcImage.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AiUgcImage.countDocuments(query)
    ]);

    return {
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 获取相册统计信息
   * @param {string} agentId - 主播 ID
   */
  async getStats(agentId) {
    const mongoose = require('mongoose');
    const [sfwCount, nsfwCount, totalUsage] = await Promise.all([
      AiUgcImage.countDocuments({ agentId, isNsfw: false, isActive: true }),
      AiUgcImage.countDocuments({ agentId, isNsfw: true, isActive: true }),
      AiUgcImage.aggregate([
        { $match: { agentId: new mongoose.Types.ObjectId(agentId) } },
        { $group: { _id: null, total: { $sum: '$usageCount' } } }
      ])
    ]);

    return {
      sfwCount,
      nsfwCount,
      totalImages: sfwCount + nsfwCount,
      maxPerCategory: UgcImageService.MAX_IMAGES_PER_CATEGORY,
      totalUsage: totalUsage[0]?.total || 0
    };
  }

  /**
   * 手动添加图片到相册
   * @param {Object} params - 参数
   */
  async addImage({ agentId, imageUrl, prompt = '', isNsfw = false }) {
    await this.enforceLimit(agentId, isNsfw);

    return await AiUgcImage.create({
      agentId,
      imageUrl,
      prompt,
      generatedByUserId: null, // 运营手动添加，无生成者
      isNsfw,
      isActive: true
    });
  }

  /**
   * 删除图片
   * @param {string} imageId - 图片 ID
   */
  async deleteImage(imageId) {
    return await AiUgcImage.findByIdAndDelete(imageId);
  }

  /**
   * 启用/禁用图片
   * @param {string} imageId - 图片 ID
   * @param {boolean} isActive - 是否启用
   */
  async toggleActive(imageId, isActive) {
    return await AiUgcImage.findByIdAndUpdate(
      imageId, 
      { isActive }, 
      { new: true }
    );
  }

  /**
   * 批量删除图片
   * @param {Array<string>} imageIds - 图片 ID 数组
   */
  async batchDelete(imageIds) {
    const result = await AiUgcImage.deleteMany({ _id: { $in: imageIds } });
    return result.deletedCount;
  }
}

module.exports = new UgcImageService();
