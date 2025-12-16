const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');
// NOTE: sharp previously used for “black image” heuristic filtering (removed per product requirement).

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

  clamp01(x) {
    const n = Number(x);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
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
   * @param {number} options.imagePromptStrength - 参考图影响强度 0-1（Fal: image_prompt_strength）
   * @param {string} options.style - 风格
   */
  async generate(prompt, options = {}) {
    const { 
      referenceImage,
      count = 1, 
      width = 768, 
      height = 1152,
      strength = 0.75, // 我们内部语义：变化强度（越大越“不像参考图”）
      imagePromptStrength,
      style = 'realistic'
    } = options;

    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    const useReference = !!referenceImage;

    console.log(`[ImageGen] Flux Img2Img 开始`, {
      prompt: prompt.substring(0, 40) + '...',
      referenceImage: useReference ? referenceImage.substring(0, 50) + '...' : null,
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

    const imageUrls = useReference
      ? await this.generateWithImg2Img(finalPrompt, {
          imageUrl: referenceImage,
          count,
          width,
          height,
          strength,
          // Fal 参数：image_prompt_strength 越大，越“贴近参考图”（构图/动作更像）
          // 我们的 strength 越大，表示越“变化”。默认用 (1 - strength) 映射。
          imagePromptStrength: (typeof imagePromptStrength === 'number')
            ? this.clamp01(imagePromptStrength)
            : this.clamp01(1 - strength)
        })
      : await this.generateWithText2Img(finalPrompt, {
          count,
          width,
          height
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

    console.log(`[ImageGen] 完成 ${results.length} 张`);
    return results;
  }

  /**
   * Flux Pro Text2Img（用于“强变化”兜底）
   * Model: fal-ai/flux-pro/v1.1
   */
  async generateWithText2Img(prompt, { count, width, height }) {
    const endpoint = 'https://fal.run/fal-ai/flux-pro/v1.1';

    console.log(`[ImageGen] 调用 Flux Pro v1.1 Text2Img`, {
      size: `${width}x${height}`,
      count
    });

    const makeRequest = async () => {
      const seed = Math.floor(Math.random() * 2_000_000_000);
      const payload = {
        prompt,
        image_size: { width, height },
        seed,
        num_inference_steps: 34,
        guidance_scale: 4.5,
        output_format: 'png',
        safety_tolerance: "6",
        enable_safety_checker: false
      };

      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60_000
        });

        if (response.data.images && response.data.images.length > 0) {
          return response.data.images[0].url;
        }

        if (response.data.request_id) {
          // 复用轮询逻辑
          return await this.pollResult(response.data.request_id);
        }

        throw new Error('返回格式异常');
      } catch (error) {
        console.error('[ImageGen][Text2Img] 错误:', error.response?.data || error.message);
        throw error;
      }
    };

    const requests = Array(count).fill(null).map(() => makeRequest());
    return Promise.all(requests);
  }

  /**
   * Flux Pro Img2Img（最强模型）
   */
  async generateWithImg2Img(prompt, { imageUrl, count, width, height, strength, imagePromptStrength }) {
    const endpoint = 'https://fal.run/fal-ai/flux-pro/v1.1/redux';

    console.log(`[ImageGen] 调用 Flux Pro v1.1 Redux (最强)`, {
      strength,
      imagePromptStrength,
    });

    const makeRequest = async () => {
      // 随机 seed，避免服务端默认 seed 导致“看起来都一样”
      const seed = Math.floor(Math.random() * 2_000_000_000);
      const payload = {
        prompt,
        image_url: imageUrl,
        image_size: { width, height },
        // 关键：参考图影响强度（之前没传，导致始终用 Fal 默认值，画面容易“锁死”）
        image_prompt_strength: imagePromptStrength,
        seed,
        // 更高质量：增加步数与引导（成本/耗时更高）
        num_inference_steps: 36,
        guidance_scale: 4.0,
        // NSFW: 最大容忍度 + 关闭安全检查（由 Fal 端支持）
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
          // Fal 可能返回多张，这里仍取第一张
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
