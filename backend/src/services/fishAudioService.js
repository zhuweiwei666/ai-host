const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { uploadToOSS } = require('../utils/ossUpload');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

class FishAudioService {
  constructor() {
    this.apiKey = process.env.FISH_AUDIO_API_KEY;
    this.apiUrl = 'https://api.fish.audio/v1/tts';
  }

  async generateAudio(text, voiceId) {
    if (!this.apiKey) {
      console.warn('Fish Audio API Key is missing');
      return null;
    }

    // 默认引用ID (Fish Audio 需要 reference_id 来指定音色)
    // 如果没有指定 voiceId，使用官方推荐的一个通用女声 ID (示例)
    const referenceId = voiceId || '7f92f8afb8ec43bf81429cc1c9199cb1'; 

    try {
      // 使用低延迟模式，优先速度而非质量
      const response = await axios.post(
        this.apiUrl,
        {
          text: text,
          reference_id: referenceId,
          format: "mp3",
          mp3_bitrate: 128, // 128 是 Fish Audio 支持的标准比特率
          normalize: true,
          latency: "low" // 使用低延迟模式（从normal改为low）
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 15000, // 15秒超时，避免长时间等待
        }
      );

      // Upload audio to OSS (异步上传，不阻塞响应)
      const fileName = `tts-${crypto.randomUUID()}.mp3`;
      const buffer = Buffer.from(response.data);
      
      try {
        // Upload to OSS with timeout
        const ossUrl = await Promise.race([
          uploadToOSS(buffer, fileName, 'audio/mpeg'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OSS upload timeout')), 10000)
          )
        ]);
        return ossUrl;
      } catch (ossError) {
        console.error('[FishAudio] OSS upload failed, falling back to local storage:', ossError.message);
        // Fallback to local storage if OSS fails
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${fileName}`;
      }

    } catch (error) {
      console.error('Fish Audio TTS Request Failed!');
      if (error.response) {
        // Log detailed API error response
        console.error('Status:', error.response.status);
        // Try to parse buffer to string if possible
        const errorData = Buffer.isBuffer(error.response.data) 
          ? error.response.data.toString() 
          : JSON.stringify(error.response.data);
        console.error('Data:', errorData);
      } else {
        console.error('Error:', error.message);
      }
      return null;
    }
  }
}

module.exports = new FishAudioService();

