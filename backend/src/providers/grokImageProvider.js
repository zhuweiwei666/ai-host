/**
 * Grok Image Generation Provider
 * 
 * 使用 xAI 的图片生成 API
 * 端点: https://api.x.ai/v1/images/generations
 * 模型: grok-2-image (xAI 官方图片生成模型)
 */

const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

class GrokImageProvider {
  constructor() {
    this.apiKey = process.env.GROK_API_KEY || process.env.GORK_API_KEY || process.env.XAI_API_KEY;
    this.apiUrl = 'https://api.x.ai/v1/images/generations';
    this.model = 'grok-2-image'; // xAI 官方图片生成模型
  }

  /**
   * 生成图片
   * @param {string} prompt - 图片描述
   * @param {object} options - 选项
   * @param {number} options.n - 生成数量 (1-10, 默认 1)
   * @param {string} options.responseFormat - 响应格式 ('url' | 'b64_json', 默认 'url')
   * @returns {Promise<Array<{url: string}>>} - 生成的图片 URL 数组
   */
  async generate(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY is not set (also supports GORK_API_KEY/XAI_API_KEY)');
    }

    const { n = 1, responseFormat = 'url' } = options;

    console.log(`[GrokImage] 开始生成图片`, {
      prompt: prompt.substring(0, 50) + '...',
      n,
      model: this.model
    });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const payload = {
      model: this.model,
      prompt,
      n: Math.min(n, 10), // 最多 10 张
      response_format: responseFormat,
    };

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers,
        timeout: 60000, // 60 秒超时
      });

      const images = response.data?.data || [];
      
      if (images.length === 0) {
        throw new Error('Grok 图片生成返回空结果');
      }

      console.log(`[GrokImage] 生成成功: ${images.length} 张图片`);

      // 上传到 OSS 持久化存储
      const results = await Promise.all(images.map(async (img) => {
        const imageUrl = img.url || img.b64_json;
        
        if (!imageUrl) {
          console.warn('[GrokImage] 图片数据为空，跳过');
          return null;
        }

        try {
          // 如果是 base64，需要先解码再上传
          if (img.b64_json) {
            // TODO: 处理 base64 格式，目前只处理 URL
            console.warn('[GrokImage] base64 格式暂不支持 OSS 上传');
            return { url: `data:image/png;base64,${img.b64_json}` };
          }

          // 上传到 OSS
          const storageUrl = await downloadAndUploadToOSS(
            imageUrl,
            `grok-${crypto.randomUUID()}.png`,
            'image/png'
          );
          
          return { url: storageUrl, remoteUrl: imageUrl };
        } catch (uploadErr) {
          console.error('[GrokImage] OSS 上传失败，使用原始 URL:', uploadErr.message);
          return { url: imageUrl, remoteUrl: imageUrl };
        }
      }));

      return results.filter(r => r !== null);

    } catch (error) {
      const errorData = error.response?.data || {};
      const errorMessage = errorData.error?.message || error.message || 'Unknown error';
      const errorCode = error.response?.status || errorData.error?.code;

      console.error('[GrokImage] API 错误:', {
        status: error.response?.status,
        code: errorCode,
        message: errorMessage,
        data: errorData
      });

      // 详细的错误信息
      if (errorCode === 401) {
        throw new Error(`Grok Image API 认证失败: ${errorMessage}`);
      } else if (errorCode === 429) {
        throw new Error('Grok Image API 频率限制，请稍后重试');
      } else if (errorCode === 402) {
        throw new Error('Grok Image API 余额不足');
      } else if (errorCode === 400) {
        throw new Error(`Grok Image API 请求无效: ${errorMessage}`);
      } else {
        throw new Error(`Grok Image API 错误 (${errorCode || 'unknown'}): ${errorMessage}`);
      }
    }
  }
}

// 导出单例
module.exports = new GrokImageProvider();
