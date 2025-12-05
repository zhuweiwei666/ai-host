const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');
const sharp = require('sharp');

/**
 * 图片生成服务
 * 
 * 方案：Flux Dev Img2Img
 * - 使用主播图片作为参考，生成新图片
 * - 如果有多张图片，随机选择一张
 */
class ImageGenerationService {
  constructor() {
    this.apiKey = process.env.IMAGE_GEN_API_KEY;
  }

  /**
   * 生成图片
   * @param {string} prompt - 用户文案
   * @param {object} options - 选项
   * @param {string} options.referenceImage - 参考图 URL
   * @param {number} options.count - 生成数量
   * @param {number} options.width - 宽度
   * @param {number} options.height - 高度
   * @param {number} options.strength - 变化强度 0-1
   * @param {string} options.style - 风格
   */
  async generate(prompt, options = {}) {
    const { 
      referenceImage,
      count = 1, 
      width = 768, 
      height = 1152,
      strength = 0.75,
      style = 'realistic'
    } = options;

    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    if (!referenceImage) {
      throw new Error('参考图是必需的');
    }

    console.log(`[ImageGen] Flux Img2Img 开始`, {
      prompt: prompt.substring(0, 40) + '...',
      referenceImage: referenceImage.substring(0, 50) + '...',
      strength,
      size: `${width}x${height}`
    });

    // 构建 prompt
    let finalPrompt = prompt;
    if (style === 'anime') {
      finalPrompt = `anime style, ${prompt}, masterpiece, best quality`;
    } else {
      finalPrompt = `photorealistic, ${prompt}, 8k, detailed`;
    }

    const imageUrls = await this.generateWithImg2Img(finalPrompt, {
      imageUrl: referenceImage,
      count,
      width,
      height,
      strength
    });

    // 上传到 R2，并检测纯黑图片
    const results = await Promise.all(imageUrls.map(async (remoteUrl) => {
      try {
        // 先下载图片检测是否为纯黑
        const imageResponse = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const imageBuffer = Buffer.from(imageResponse.data);
        
        // 检测是否为纯黑图片
        const isBlackImage = await this.isBlackImage(imageBuffer);
        if (isBlackImage) {
          console.warn('[ImageGen] 检测到纯黑图片（内容可能被过滤），跳过');
          return null; // 返回 null 表示这张图片无效
        }
        
        const storageUrl = await downloadAndUploadToOSS(
          remoteUrl, 
          `gen-${crypto.randomUUID()}.png`, 
          'image/png'
        );
        return { url: storageUrl, remoteUrl };
      } catch (err) {
        console.error('[ImageGen] 上传失败:', err.message);
        return { url: remoteUrl, remoteUrl };
      }
    }));

    // 过滤掉纯黑图片
    const validResults = results.filter(r => r !== null);
    
    console.log(`[ImageGen] 完成，有效图片 ${validResults.length}/${results.length} 张`);
    
    if (validResults.length === 0) {
      console.warn('[ImageGen] 所有图片都被过滤了，可能是内容安全限制');
      throw new Error('图片生成失败：内容可能被安全检查过滤');
    }
    
    return validResults;
  }

  /**
   * 检测图片是否为纯黑（或接近纯黑）
   * @param {Buffer} imageBuffer - 图片数据
   * @returns {boolean} - 是否为纯黑图片
   */
  async isBlackImage(imageBuffer) {
    try {
      // 缩小图片到 10x10 进行快速检测
      const { data, info } = await sharp(imageBuffer)
        .resize(10, 10, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // 计算平均亮度
      let totalBrightness = 0;
      const pixelCount = info.width * info.height;
      const channels = info.channels;
      
      for (let i = 0; i < data.length; i += channels) {
        // RGB 平均值
        const r = data[i] || 0;
        const g = data[i + 1] || 0;
        const b = data[i + 2] || 0;
        totalBrightness += (r + g + b) / 3;
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      
      // 如果平均亮度小于 10（接近纯黑），认为是无效图片
      const isBlack = avgBrightness < 10;
      
      if (isBlack) {
        console.log(`[ImageGen] 图片亮度检测: ${avgBrightness.toFixed(2)} (纯黑阈值: 10)`);
      }
      
      return isBlack;
    } catch (err) {
      console.error('[ImageGen] 图片检测失败:', err.message);
      return false; // 检测失败时不过滤
    }
  }

  /**
   * Flux Pro Img2Img（最强模型）
   */
  async generateWithImg2Img(prompt, { imageUrl, count, width, height, strength }) {
    const endpoint = 'https://fal.run/fal-ai/flux-pro/v1.1/redux';

    console.log(`[ImageGen] 调用 Flux Pro v1.1 Redux (最强), strength=${strength}`);

    const makeRequest = async () => {
      const payload = {
        prompt,
        image_url: imageUrl,
        image_size: { width, height },
        num_inference_steps: 28,
        guidance_scale: 3.5,
        safety_tolerance: "6",
        enable_safety_checker: false
      };

      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000  // 60秒超时
        });

        if (response.data.images && response.data.images.length > 0) {
          return response.data.images[0].url;
        }

        if (response.data.request_id) {
          return await this.pollResult(response.data.request_id);
        }

        throw new Error('返回格式异常');
      } catch (error) {
        console.error('[ImageGen] 错误:', error.response?.data || error.message);
        throw error;
      }
    };

    const requests = Array(count).fill(null).map(() => makeRequest());
    return Promise.all(requests);
  }

  /**
   * 轮询结果
   */
  async pollResult(requestId, maxAttempts = 30) {
    const statusUrl = `https://queue.fal.run/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/requests/${requestId}`;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));

      try {
        const statusRes = await axios.get(statusUrl, {
          headers: { 'Authorization': `Key ${this.apiKey}` }
        });

        if (statusRes.data.status === 'COMPLETED') {
          const result = await axios.get(resultUrl, {
            headers: { 'Authorization': `Key ${this.apiKey}` }
          });
          if (result.data.images?.length > 0) {
            return result.data.images[0].url;
          }
        }

        if (statusRes.data.status === 'FAILED') {
          throw new Error('生成失败');
        }
      } catch (err) {
        if (i === maxAttempts - 1) throw err;
      }
    }

    throw new Error('超时');
  }
}

module.exports = new ImageGenerationService();
