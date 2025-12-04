const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

/**
 * 图片生成服务 v2
 * 
 * 新策略：使用 IP-Adapter 保持人物特征 + Flux Pro 生成高质量图片
 * 这样可以保持角色一致性，同时让动作随文案变化
 */
class ImageGenerationService {
  constructor() {
    this.apiKey = process.env.IMAGE_GEN_API_KEY;
  }

  /**
   * 生成图片（使用 IP-Adapter + Flux）
   * @param {string} prompt - 用户文案
   * @param {object} options - 选项
   * @param {string} options.referenceImage - 参考图 URL（用于保持人物特征）
   * @param {number} options.count - 生成数量，默认 1
   * @param {number} options.width - 宽度，默认 768
   * @param {number} options.height - 高度，默认 1152
   * @param {string} options.style - 风格：realistic 或 anime
   */
  async generate(prompt, options = {}) {
    const { 
      referenceImage,
      count = 1, 
      width = 768, 
      height = 1152,
      style = 'realistic'
    } = options;

    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    if (!referenceImage) {
      throw new Error('封面图 (referenceImage) 是必需的');
    }

    console.log(`[ImageGen] 开始生成图片 (IP-Adapter + Flux Pro)`, {
      prompt: prompt.substring(0, 50) + '...',
      referenceImage: referenceImage.substring(0, 50) + '...',
      style,
      size: `${width}x${height}`,
      count
    });

    // 构建最终 prompt，加入风格关键词
    let finalPrompt = prompt;
    if (style === 'anime') {
      finalPrompt = `anime style, 2d illustration, ${prompt}, vibrant colors, masterpiece, best quality, detailed`;
    } else {
      finalPrompt = `photorealistic portrait, ${prompt}, RAW PHOTO, 8k uhd, soft lighting, detailed skin, professional photography`;
    }

    // 使用 IP-Adapter Face ID 保持人物特征，同时允许动作变化
    const imageUrls = await this.generateWithIPAdapter(finalPrompt, {
      faceImageUrl: referenceImage,
      count,
      width,
      height
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
   * 使用 IP-Adapter Face ID 生成图片
   * 保持人脸特征一致，但允许姿势/动作随 prompt 变化
   */
  async generateWithIPAdapter(prompt, { faceImageUrl, count, width, height }) {
    // 使用 Fal.ai 的 IP-Adapter Face ID 模型
    // 文档: https://fal.ai/models/fal-ai/ip-adapter-face-id
    const endpoint = 'https://fal.run/fal-ai/ip-adapter-face-id';

    console.log(`[ImageGen] 调用 IP-Adapter Face ID:`, { 
      endpoint, 
      size: `${width}x${height}` 
    });

    const makeRequest = async () => {
      const payload = {
        prompt: prompt,
        face_image_url: faceImageUrl,
        negative_prompt: "blurry, low quality, distorted face, deformed, ugly, bad anatomy, wrong proportions",
        image_size: { width, height },
        num_inference_steps: 30,
        guidance_scale: 7.5,
        face_id_weight: 0.7,  // 人脸权重：0.7 保持特征但不过度限制
        enable_safety_checker: false
      };

      try {
        const response = await axios.post(endpoint, payload, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000 // 3 分钟超时
        });

        if (response.data.image) {
          return response.data.image.url;
        }
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
        console.error('[ImageGen] IP-Adapter 错误:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        // 如果 IP-Adapter 失败，回退到 Flux Pro 纯文本生成
        console.log('[ImageGen] 回退到 Flux Pro 纯文本生成...');
        return await this.generateWithFluxPro(prompt, { width, height });
      }
    };

    // 并行生成多张
    const requests = Array(count).fill(null).map(() => makeRequest());
    return Promise.all(requests);
  }

  /**
   * 使用 Flux Pro v1.1 生成（最强模型，纯文本生成）
   */
  async generateWithFluxPro(prompt, { width, height }) {
    const endpoint = 'https://fal.run/fal-ai/flux-pro/v1.1';

    console.log(`[ImageGen] 调用 Flux Pro v1.1:`, { endpoint });

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
  }

  /**
   * 轮询 Fal.ai 队列结果
   */
  async pollResult(requestId, maxAttempts = 90) {
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
          
          if (result.data.image) {
            return result.data.image.url;
          }
          if (result.data.images && result.data.images.length > 0) {
            return result.data.images[0].url;
          }
          throw new Error('No image in result');
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
