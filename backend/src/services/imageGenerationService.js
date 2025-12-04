const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

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

    // 上传到 R2
    const results = await Promise.all(imageUrls.map(async (remoteUrl) => {
      try {
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

    console.log(`[ImageGen] 完成，共 ${results.length} 张`);
    return results;
  }

  /**
   * Flux Dev Img2Img
   */
  async generateWithImg2Img(prompt, { imageUrl, count, width, height, strength }) {
    const endpoint = 'https://fal.run/fal-ai/flux/dev/image-to-image';

    console.log(`[ImageGen] 调用 Flux Img2Img, strength=${strength}`);

    const makeRequest = async () => {
      const payload = {
        prompt,
        image_url: imageUrl,
        strength,
        image_size: { width, height },
        num_inference_steps: 28,
        guidance_scale: 3.5,
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
