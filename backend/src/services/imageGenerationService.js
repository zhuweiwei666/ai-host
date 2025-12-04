const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

/**
 * 图片生成服务 v4
 * 
 * 策略：使用 PuLID（专门保持人物一致性）+ Flux Pro 回退
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
   * @param {string} options.characterDescription - 角色描述
   * @param {number} options.count - 生成数量
   * @param {number} options.width - 宽度
   * @param {number} options.height - 高度
   * @param {string} options.style - 风格
   */
  async generate(prompt, options = {}) {
    const { 
      referenceImage,
      characterDescription = '',
      count = 1, 
      width = 768, 
      height = 1152,
      style = 'realistic'
    } = options;

    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    console.log(`[ImageGen] 开始生成图片`, {
      prompt: prompt.substring(0, 50) + '...',
      hasReferenceImage: !!referenceImage,
      style,
      size: `${width}x${height}`,
      count
    });

    // 构建 prompt
    let finalPrompt = '';
    if (style === 'anime') {
      finalPrompt = `masterpiece, best quality, anime illustration, ${characterDescription}, ${prompt}, detailed, vibrant colors`;
    } else {
      finalPrompt = `photorealistic, RAW PHOTO, ${characterDescription}, ${prompt}, 8k uhd, detailed`;
    }

    let imageUrls;

    // 如果有参考图，使用 PuLID 保持人物一致性
    if (referenceImage && referenceImage.startsWith('http')) {
      try {
        imageUrls = await this.generateWithPuLID(finalPrompt, {
          referenceImage,
          count,
          width,
          height
        });
      } catch (pulidError) {
        console.error('[ImageGen] PuLID 失败，回退到 Flux Pro:', pulidError.message);
        imageUrls = await this.generateWithFluxPro(finalPrompt, { count, width, height });
      }
    } else {
      // 没有参考图，直接用 Flux Pro
      imageUrls = await this.generateWithFluxPro(finalPrompt, { count, width, height });
    }

    // 上传到 R2
    const results = await Promise.all(imageUrls.map(async (remoteUrl) => {
      try {
        const storageUrl = await downloadAndUploadToOSS(
          remoteUrl, 
          `gen-${crypto.randomUUID()}.png`, 
          'image/png'
        );
        return { url: storageUrl, remoteUrl };
      } catch (uploadError) {
        console.error('[ImageGen] 上传失败:', uploadError.message);
        return { url: remoteUrl, remoteUrl };
      }
    }));

    console.log(`[ImageGen] 生成完成，共 ${results.length} 张图片`);
    return results;
  }

  /**
   * 使用 PuLID 生成（保持人物一致性）
   * https://fal.ai/models/fal-ai/pulid
   */
  async generateWithPuLID(prompt, { referenceImage, count, width, height }) {
    const endpoint = 'https://fal.run/fal-ai/pulid';

    console.log(`[ImageGen] 调用 PuLID:`, { endpoint, size: `${width}x${height}` });

    const makeRequest = async () => {
      const payload = {
        prompt: prompt,
        reference_images: [referenceImage],
        negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy",
        image_size: { width, height },
        num_inference_steps: 30,
        guidance_scale: 7,
        id_weight: 1.0,  // 人物一致性权重
        enable_safety_checker: false
      };

      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000
        });

        if (response.data.images && response.data.images.length > 0) {
          return response.data.images[0].url;
        }
        if (response.data.image) {
          return response.data.image.url;
        }

        if (response.data.request_id) {
          return await this.pollResult(response.data.request_id);
        }

        throw new Error('PuLID 返回格式异常');
      } catch (error) {
        console.error('[ImageGen] PuLID 错误:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    };

    const requests = Array(count).fill(null).map(() => makeRequest());
    return Promise.all(requests);
  }

  /**
   * 使用 Flux Pro v1.1
   */
  async generateWithFluxPro(prompt, { count, width, height }) {
    const endpoint = 'https://fal.run/fal-ai/flux-pro/v1.1';

    console.log(`[ImageGen] 调用 Flux Pro v1.1`);

    const makeRequest = async () => {
      const payload = {
        prompt: prompt,
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
          timeout: 120000
        });

        if (response.data.images && response.data.images.length > 0) {
          return response.data.images[0].url;
        }

        if (response.data.request_id) {
          return await this.pollResult(response.data.request_id);
        }

        throw new Error('Flux Pro 返回格式异常');
      } catch (error) {
        console.error('[ImageGen] Flux Pro 错误:', error.message);
        throw error;
      }
    };

    const requests = Array(count).fill(null).map(() => makeRequest());
    return Promise.all(requests);
  }

  /**
   * 轮询结果
   */
  async pollResult(requestId, maxAttempts = 60) {
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
          
          if (result.data.images && result.data.images.length > 0) {
            return result.data.images[0].url;
          }
          if (result.data.image) {
            return result.data.image.url;
          }
          throw new Error('No image in result');
        }

        if (statusRes.data.status === 'FAILED') {
          throw new Error('生成失败: ' + (statusRes.data.error || 'Unknown'));
        }
      } catch (pollError) {
        if (i === maxAttempts - 1) throw pollError;
      }
    }

    throw new Error('生成超时');
  }
}

module.exports = new ImageGenerationService();
