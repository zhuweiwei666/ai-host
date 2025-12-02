const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class VideoGenerationService {
  constructor() {
    this.apiKey = process.env.IMAGE_GEN_API_KEY; // Reuse Fal.ai key
    this.uploadDir = path.join(__dirname, '../../uploads');
  }

  /**
   * Generate video from text or image
   * @param {string} prompt - Text description
   * @param {object} options - { imageUrl, seconds, resolution, model }
   */
  async generate(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }

    const model = options.model || 'fal-ai/hunyuan-video';
    const endpoint = `https://fal.run/${model}`;

    console.log(`[VideoGen] Generating video with model: ${model}`);

    // Resolve Image URL (Upload local file to Fal Storage if needed)
    let finalImageUrl = options.imageUrl;
    
    // Check if it's a local path OR a localhost URL
    const isLocal = finalImageUrl && (
        !finalImageUrl.startsWith('http') || 
        finalImageUrl.includes('localhost') || 
        finalImageUrl.includes('127.0.0.1')
    );

    if (isLocal) {
        console.log(`[VideoGen] Local image detected: ${finalImageUrl}. Uploading to Fal Storage...`);
        const localPath = this.findLocalFile(finalImageUrl);
        
        if (localPath) {
            try {
                finalImageUrl = await this.uploadLocalFileToFal(localPath);
                console.log(`[VideoGen] Upload successful: ${finalImageUrl}`);
            } catch (uploadErr) {
                console.error('[VideoGen] Upload failed:', uploadErr.message);
                throw new Error(`Failed to upload source image to Fal: ${uploadErr.message}`);
            }
        } else {
            console.error(`[VideoGen] Local file NOT FOUND on server: ${finalImageUrl}`);
            throw new Error(`Server cannot find avatar file for animation: ${finalImageUrl}`);
        }
    }

    // STRICT VALIDATION: Ensure we have a valid remote URL now
    if (!finalImageUrl || (!finalImageUrl.startsWith('http') && !finalImageUrl.startsWith('data:'))) {
         // Data URI is technically possible if we added fallback, but we are enforcing upload now.
         // Just checking truthiness is safer.
         throw new Error(`Invalid image source for video generation: ${finalImageUrl}`);
    }

    // Payload construction
    let payload = {};
    
    if (model === 'fal-ai/fast-svd') {
        payload = {
            image_url: finalImageUrl,
            motion_bucket_id: 127,
            cond_aug: 0.02
        };
    } else if (model === 'fal-ai/minimax-video') {
        // Force Image-to-Video Mode
        payload = {
            prompt: prompt,
            image_url: finalImageUrl, 
        };
    } else {
        // Hunyuan / Kling Payload
        payload = {
          prompt: prompt,
          num_frames: options.num_frames || 85,
          resolution: options.resolution || "720p",
          aspect_ratio: options.aspect_ratio || "9:16",
          safety_tolerance: "6" 
        };

        if (finalImageUrl) {
            payload.image_url = finalImageUrl;
        } else {
             // If Hunyuan is used without image, that's T2V. 
             // But user specifically requested NO T2V fallback for character consistency.
             // We'll log a warning but allow it for now IF checking Hunyuan specific logic, 
             // but user mostly uses Minimax (Fast Mode).
        }
    }

    try {
      const response = await axios.post(
        endpoint,
        payload,
        {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          maxBodyLength: Infinity, 
          maxContentLength: Infinity
        }
      );

      if (response.data.request_id) {
        console.log(`[VideoGen] Queued: ${response.data.request_id}`);
        return await this.pollResult(response.data.request_id);
      }
      
      if (response.data.video && response.data.video.url) {
        return await this.downloadAndSave(response.data.video.url);
      }

      throw new Error('Unexpected video response format');
    } catch (error) {
      console.error('Video Generation Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Helper to find local file across likely paths
  findLocalFile(urlOrPath) {
    // Extract filename if it looks like /uploads/xxx or http://.../uploads/xxx
    let filename = urlOrPath;
    if (urlOrPath.includes('/uploads/')) {
        filename = urlOrPath.split('/uploads/')[1];
    }
    filename = path.basename(filename); // Security: prevent dir traversal

    const candidates = [
        path.join(this.uploadDir, filename),
        path.join(process.cwd(), 'uploads', filename),
        path.join(process.cwd(), '../uploads', filename)
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
  }

  async uploadLocalFileToFal(filePath) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    let contentType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    if (ext === 'webp') contentType = 'image/webp';

    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    // 1. Initiate Upload
    const initRes = await axios.post(
        'https://rest.fal.ai/storage/upload/initiate',
        { content_type: contentType, file_name: fileName },
        { headers: { 'Authorization': `Key ${this.apiKey}` } }
    );

    const { upload_url, file_url } = initRes.data;

    // 2. Upload Content
    await axios.put(upload_url, fileBuffer, {
        headers: { 'Content-Type': contentType }
    });

    return file_url;
  }

  async pollResult(requestId, maxAttempts = 180) {
    const statusUrl = `https://queue.fal.run/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/requests/${requestId}`;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000)); 

      try {
        const check = await axios.get(statusUrl, {
            headers: { 'Authorization': `Key ${this.apiKey}` }
        });

        if (check.data.status === 'COMPLETED') {
            const result = await axios.get(resultUrl, {
                headers: { 'Authorization': `Key ${this.apiKey}` }
            });
            
            if (result.data.video && result.data.video.url) {
                return await this.downloadAndSave(result.data.video.url);
            }
            throw new Error('Completed but no video URL found');
        }
        if (check.data.status === 'FAILED') {
            throw new Error('Video Gen Failed: ' + (check.data.error || 'Unknown error'));
        }
      } catch (err) {
        if (i === maxAttempts - 1) throw err;
      }
    }
    throw new Error('Video Generation Timeout');
  }

  async downloadAndSave(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const fileName = `vid-${uuidv4()}.mp4`;
    
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    const filePath = path.join(this.uploadDir, fileName);
    fs.writeFileSync(filePath, response.data);

    return `/uploads/${fileName}`;
  }
}

module.exports = new VideoGenerationService();
