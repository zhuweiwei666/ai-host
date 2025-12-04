const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

/**
 * 简化版图片生成服务
 * 逻辑：封面图 (referenceImage) + 用户文案 (prompt) → 生成新图
 */
class ImageGenerationService {
  constructor() {
    this.apiKey = process.env.IMAGE_GEN_API_KEY;
    this.provider = process.env.IMAGE_GEN_PROVIDER || 'fal';
  }

  /**
   * 生成图片
   * @param {string} prompt - 用户文案
   * @param {object} options - 选项
   * @param {string} options.referenceImage - 封面图 URL（必需）
   * @param {number} options.count - 生成数量，默认 1
   * @param {number} options.width - 宽度，默认 768
   * @param {number} options.height - 高度，默认 1152
   * @param {number} options.strength - Img2Img 强度，0-1，默认 0.85（让文案更有效果）
   * @param {string} options.style - 风格：realistic 或 anime
   */
  async generate(prompt, options = {}) {
    const { 
      referenceImage,
      count = 1, 
      width = 768, 
      height = 1152,
      strength = 0.85,  // 提高到 0.85，让用户文案有更大影响
      style = 'realistic'
    } = options;

    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    if (!referenceImage) {
      throw new Error('封面图 (referenceImage) 是必需的');
    }

    console.log(`[ImageGen] 开始生成图片`, {
      prompt: prompt.substring(0, 50) + '...',
      referenceImage: referenceImage.substring(0, 50) + '...',
      style,
      strength,
      size: `${width}x${height}`,
      count
    });

    // 构建最终 prompt，加入风格关键词
    let finalPrompt = prompt;
    if (style === 'anime') {
      finalPrompt = `anime style, illustration, ${prompt}, vibrant colors, masterpiece, best quality`;
    } else {
      finalPrompt = `photorealistic, RAW PHOTO, ${prompt}, 8k uhd, soft lighting, detailed`;
    }

    // 使用 Fal.ai Flux Img2Img
    const imageUrls = await this.generateWithFluxImg2Img(finalPrompt, {
      imageUrl: referenceImage,
      count,
      width,
      height,
      strength
    });

    // 上传到 R2/OSS
    const results = await Promise.all(imageUrls.map(async (remoteUrl) => {
      try {
        const storageUrl = await downloadAndUploadToOSS(
          remoteUrl, 
          `gen-${crypto.randomUUID()}.png`, 
          'image/png'
        );
        return { url: storageUrl, remoteUrl };
      } catch (uploadError) {
        console.error('[ImageGen] 上传失败，返回原始 URL:', uploadError.message);
        return { url: remoteUrl, remoteUrl };
      }
    }));

    console.log(`[ImageGen] 生成完成，共 ${results.length} 张图片`);
    return results;
  }

  /**
   * 使用 Flux Img2Img 生成图片
   */
  async generateWithFluxImg2Img(prompt, { imageUrl, count, width, height, strength }) {
    const endpoint = 'https://fal.run/fal-ai/flux/dev/image-to-image';

    console.log(`[ImageGen] 调用 Fal.ai Flux Img2Img:`, { 
      endpoint, 
      strength,
      size: `${width}x${height}` 
    });

    const makeRequest = async () => {
      const payload = {
        prompt,
        image_url: imageUrl,
        strength: strength,
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
          timeout: 120000 // 2 分钟超时
        });

        if (response.data.images && response.data.images.length > 0) {
          return response.data.images[0].url;
        }

        // 如果是队列请求，轮询结果
        if (response.data.request_id) {
          console.log(`[ImageGen] 请求已入队: ${response.data.request_id}`);
          return await this.pollResult(response.data.request_id);
        }

        throw new Error('Fal.ai 返回格式异常');
      } catch (error) {
        console.error('[ImageGen] Fal.ai 错误:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    };

    // 并行生成多张
    const requests = Array(count).fill(null).map(() => makeRequest());
    return Promise.all(requests);
  }

  /**
   * 轮询 Fal.ai 队列结果
   */
  async pollResult(requestId, maxAttempts = 60) {
    const statusUrl = `https://queue.fal.run/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/requests/${requestId}`;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000)); // 每 2 秒检查一次

      try {
        const statusRes = await axios.get(statusUrl, {
          headers: { 'Authorization': `Key ${this.apiKey}` }
        });

        if (statusRes.data.status === 'COMPLETED') {
          const result = await axios.get(resultUrl, {
            headers: { 'Authorization': `Key ${this.apiKey}` }
          });
          return result.data.images[0].url;
        }

        if (statusRes.data.status === 'FAILED') {
          throw new Error('Fal.ai 生成失败: ' + (statusRes.data.error || 'Unknown error'));
        }

        console.log(`[ImageGen] 等待中... (${i + 1}/${maxAttempts})`);
      } catch (pollError) {
        if (i === maxAttempts - 1) throw pollError;
      }
    }

    throw new Error('Fal.ai 生成超时');
  }
}

module.exports = new ImageGenerationService();
