const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

/**
 * 图片生成服务 v3
 * 
 * 策略：使用 Flux Pro v1.1（最强模型）+ 角色描述
 * - 动作随用户文案变化
 * - 角色特征通过文字描述保持一致
 */
class ImageGenerationService {
  constructor() {
    this.apiKey = process.env.IMAGE_GEN_API_KEY;
  }

  /**
   * 生成图片
   * @param {string} prompt - 用户文案
   * @param {object} options - 选项
   * @param {string} options.characterDescription - 角色描述（发色、眼睛、特征等）
   * @param {number} options.count - 生成数量，默认 1
   * @param {number} options.width - 宽度，默认 768
   * @param {number} options.height - 高度，默认 1152
   * @param {string} options.style - 风格：realistic 或 anime
   * @param {string} options.model - 模型选择：pro, dev, schnell
   */
  async generate(prompt, options = {}) {
    const { 
      characterDescription = '',
      count = 1, 
      width = 768, 
      height = 1152,
      style = 'realistic',
      model = 'pro'  // 默认使用最强模型
    } = options;

    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    console.log(`[ImageGen] 开始生成图片 (Flux ${model})`, {
      prompt: prompt.substring(0, 50) + '...',
      characterDescription: characterDescription.substring(0, 30) + '...',
      style,
      model,
      size: `${width}x${height}`,
      count
    });

    // 构建最终 prompt
    let finalPrompt = '';
    
    if (style === 'anime') {
      // 动漫风格
      finalPrompt = `masterpiece, best quality, anime style, 2d illustration, ${characterDescription}, ${prompt}, vibrant colors, detailed, beautiful lighting`;
    } else {
      // 真人风格
      finalPrompt = `RAW PHOTO, photorealistic, 8k uhd, ${characterDescription}, ${prompt}, professional photography, soft lighting, detailed skin texture`;
    }

    // 选择模型端点
    let endpoint;
    let inferenceSteps;
    
    switch (model) {
      case 'pro':
        endpoint = 'https://fal.run/fal-ai/flux-pro/v1.1';
        inferenceSteps = 28;
        break;
      case 'schnell':
        endpoint = 'https://fal.run/fal-ai/flux/schnell';
        inferenceSteps = 4;
        break;
      case 'dev':
      default:
        endpoint = 'https://fal.run/fal-ai/flux/dev';
        inferenceSteps = 28;
        break;
    }

    const imageUrls = await this.generateWithFlux(finalPrompt, {
      endpoint,
      inferenceSteps,
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
   * 使用 Flux 模型生成图片
   */
  async generateWithFlux(prompt, { endpoint, inferenceSteps, count, width, height }) {
    console.log(`[ImageGen] 调用 Flux:`, { endpoint, inferenceSteps, size: `${width}x${height}` });

    const makeRequest = async () => {
      const payload = {
        prompt: prompt,
        image_size: { width, height },
        num_inference_steps: inferenceSteps,
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
          console.log(`[ImageGen] 请求已入队: ${response.data.request_id}`);
          return await this.pollResult(response.data.request_id);
        }

        throw new Error('Flux 返回格式异常');
      } catch (error) {
        console.error('[ImageGen] Flux 错误:', {
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
