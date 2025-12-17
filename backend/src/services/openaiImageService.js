const axios = require('axios');
const crypto = require('crypto');
const { downloadAndUploadToOSS } = require('../utils/ossUpload');

/**
 * OpenAI GPT Image 1.5 图片生成服务
 * 
 * 使用 API易 代理，支持支付宝支付
 * 模型：gpt-image-1.5 - 最新最强图片生成模型
 * 
 * 特点：
 * - 角色一致性更好
 * - 更好的 prompt 遵循
 * - 光照/构图更一致
 */
class OpenAIImageService {
  constructor() {
    this.apiKey = process.env.OPENAI_IMAGE_API_KEY;
    this.baseUrl = process.env.OPENAI_IMAGE_BASE_URL || 'https://api.openai.com/v1';
  }

  /**
   * 根据角色和场景生成情境图
   * @param {Object} agent - 角色信息
   * @param {Object} sceneData - 场景数据
   * @param {Object} options - 选项
   */
  async generateSceneImage(agent, sceneData, options = {}) {
    const { 
      quality = 'medium',  // low/medium/high
      size = '1024x1536'   // 竖版海报比例
    } = options;

    if (!this.apiKey) {
      throw new Error('OPENAI_IMAGE_API_KEY is not configured');
    }

    const prompt = this.buildPrompt(agent, sceneData);
    
    console.log(`[OpenAI Image] 开始生成`, {
      agent: agent.name,
      scene: sceneData.background?.substring(0, 30) + '...',
      quality,
      size
    });

    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseUrl}/images/generations`,
        {
          model: 'gpt-image-1.5',
          prompt,
          size,
          quality,
          n: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000  // 2分钟超时（复杂图片可能较慢）
        }
      );

      const elapsed = Date.now() - startTime;
      console.log(`[OpenAI Image] 生成完成 ${elapsed}ms`);

      // 获取图片 URL 或 base64
      const imageData = response.data.data[0];
      let imageUrl;

      if (imageData.b64_json) {
        // 如果返回 base64，直接上传到 OSS
        console.log('[OpenAI Image] 收到 base64 图片，上传到 OSS...');
        imageUrl = await this.uploadBase64ToOSS(imageData.b64_json);
        console.log(`[OpenAI Image] Base64 上传成功: ${imageUrl}`);
        return imageUrl;
      } else if (imageData.url) {
        imageUrl = imageData.url;
        // 上传到 R2/OSS 持久化
        try {
          const storageUrl = await downloadAndUploadToOSS(
            imageUrl,
            `story-${crypto.randomUUID()}.png`,
            'image/png'
          );
          console.log(`[OpenAI Image] 已上传到 OSS`);
          return storageUrl;
        } catch (uploadErr) {
          console.error('[OpenAI Image] OSS 上传失败，使用原始 URL:', uploadErr.message);
          return imageUrl;
        }
      }
      
      throw new Error('API 返回格式异常：没有 url 或 b64_json');

    } catch (error) {
      console.error('[OpenAI Image] 生成失败:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 构建图片生成 prompt
   */
  buildPrompt(agent, sceneData) {
    // 角色视觉锚点
    const visualAnchor = agent.visualAnchor || {};
    const appearance = visualAnchor.description || agent.description || '';
    const signature = visualAnchor.signature || '';
    const style = visualAnchor.style || '';

    // 场景数据
    const {
      clothing = '',
      pose = '',
      expression = '',
      background = '',
      lighting = '',
      mood = ''
    } = sceneData;

    // 构建结构化 prompt
    const prompt = `
Portrait photograph of a character:

CHARACTER IDENTITY (MUST maintain exactly):
- Name: ${agent.name}
- Appearance: ${appearance}
- Signature look: ${signature}
- Style: ${style}

CURRENT SCENE:
- Clothing: ${clothing}
- Pose: ${pose}
- Expression: ${expression}
- Background: ${background}
- Lighting: ${lighting}
- Mood/Atmosphere: ${mood}

STYLE REQUIREMENTS:
- Photorealistic, cinematic quality
- High detail, 8K resolution
- Professional photography lighting
- Shallow depth of field for portrait focus

CRITICAL: The character's face, body type, and distinctive features MUST remain exactly consistent with the character identity description above. Only change clothing, pose, expression, and background as specified.
`.trim();

    return prompt;
  }

  /**
   * 上传 base64 图片到 R2/OSS
   */
  async uploadBase64ToOSS(base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `story/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.png`;
    
    try {
      // 直接使用 R2 客户端上传 buffer
      const { uploadBufferToR2 } = require('./r2Client');
      const result = await uploadBufferToR2(buffer, filename, 'image/png');
      console.log('[OpenAI Image] R2 上传成功:', result.url);
      return result.url;
    } catch (r2Err) {
      console.error('[OpenAI Image] R2 上传失败:', r2Err.message);
      throw new Error('图片上传失败: ' + r2Err.message);
    }
  }

  /**
   * 快速测试 API 连通性
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        timeout: 10000
      });
      return { success: true, models: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OpenAIImageService();
