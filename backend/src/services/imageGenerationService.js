const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ImageGenerationService {
  constructor() {
    this.apiKey = process.env.IMAGE_GEN_API_KEY;
    // Default to Fal.ai Flux model which is excellent for characters
    // Can be switched to Replicate or others easily
    this.provider = process.env.IMAGE_GEN_PROVIDER || 'fal'; 
    this.uploadDir = path.join(__dirname, '../../uploads');
  }

  async generate(prompt, options = {}) {
    // Check provider from options, fallback to default
    const provider = options.provider || this.provider;
    const { count = 1, width, height, faceImageUrl, useImg2Img = true } = options;
    let imageUrls = [];

    console.log(`[ImageGen] Generating with provider: ${provider}, count: ${count}, faceImage: ${!!faceImageUrl}, useImg2Img: ${useImg2Img}`);

    if (provider === 'fal') {
    if (!this.apiKey) {
        throw new Error('IMAGE_GEN_API_KEY (Fal.ai) is not configured');
    }
      
      // If faceImageUrl is provided, use Face Swap workflow
      if (faceImageUrl) {
         // Resolve faceImageUrl to Data URI if it's local, to ensure Fal.ai can access it
         const resolvedFaceUrl = await this.resolveToDataUri(faceImageUrl);

         // Step 1: Generate base images
         // Logic:
         // - If useImg2Img is TRUE (default): Use faceImageUrl as init_image to preserve body type.
         // - If useImg2Img is FALSE: Generate purely from text (e.g. Nude prompt), then swap face.
         
         let baseImages = [];
         if (useImg2Img) {
             console.log('[ImageGen] Face swap requested. Using Img2Img for base consistency...');
             // Lowered strength to 0.75 to allow "clothes removal" while keeping enough structure.
             // 0.95 was too high and hallucinated completely new images ("irrelevant").
             baseImages = await this.generateWithFal(prompt, { 
                 count, width, height, 
                 model: options.model,
                 imageUrl: resolvedFaceUrl, 
                 strength: 0.75 
             });
         } else {
             console.log('[ImageGen] Face swap requested. Using TEXT-TO-IMAGE for base (Ignoring init image)...');
             // Pure generation based on prompt (e.g. "Nude girl")
             baseImages = await this.generateWithFal(prompt, { 
                 count, width, height, 
                 model: options.model
             });
         }
         
         // Step 2: Swap faces (Refine the face details)
         console.log('[ImageGen] Swapping faces...');
         const swapPromises = baseImages.map(baseImg => this.swapFace(baseImg, resolvedFaceUrl));
         imageUrls = await Promise.all(swapPromises);
      } else {
         imageUrls = await this.generateWithFal(prompt, { count, width, height, model: options.model });
      }

    } else if (provider === 'volcengine') {
      imageUrls = await this.generateWithVolcengine(prompt, { count, width, height });
    } else {
      throw new Error(`Provider '${provider}' is not supported`);
    }

    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('Image generation failed to return any URLs');
    }

    // Download all images
    const results = await Promise.all(imageUrls.map(async (remoteUrl) => {
        const localUrl = await this.downloadAndSaveImage(remoteUrl);
        return { url: localUrl, remoteUrl };
    }));
    
    return results;
  }

  async swapFace(baseImageUrl, faceImageUrl) {
    // Using Fal.ai Face Swap (InsightFace based)
    // Endpoint: fal-ai/face-swap
    const endpoint = 'https://fal.run/fal-ai/face-swap';
    
    try {
        const response = await axios.post(
            endpoint,
            {
                base_image_url: baseImageUrl,
                swap_image_url: faceImageUrl
            },
            {
                headers: {
                    'Authorization': `Key ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        
        if (response.data.image) {
            return response.data.image.url;
  }
        throw new Error('Face swap response missing image url');
    } catch (error) {
        console.error('Face Swap Error:', error.message);
        // Fallback to base image if swap fails
        return baseImageUrl;
    }
  }

  async generateWithFal(prompt, { count = 1, width, height, model = 'flux/dev', imageUrl = null, strength = null }) {
    // Using Flux Pro, Dev or Schnell.
    // Changed default to 'flux/dev' for better quality and uncensored capability.
    // Cost optimization: Use 768x1152 to stay under 1MP (~$0.02/image).
    
    // Allow passing full model path or alias
    let modelName = model;
    // Normalize common aliases if they don't start with fal-ai/
    if (!modelName.startsWith('fal-ai/')) {
        if (modelName.includes('schnell')) modelName = 'fal-ai/flux/schnell';
        else if (modelName.includes('pro')) modelName = 'fal-ai/flux-pro/v1.1'; // Default Pro to v1.1
        else modelName = 'fal-ai/flux/dev';
    }

    const endpoint = `https://fal.run/${modelName}`;
    
    // Schnell needs fewer steps (4-8), Dev needs more (28+), Pro usually fixed or higher
    let inferenceSteps = 28;
    if (modelName.includes('schnell')) inferenceSteps = 4;
    if (modelName.includes('pro')) inferenceSteps = undefined; // Pro usually handles steps internally or defaults
    
    console.log(`[ImageGen] Calling Fal.ai endpoint: ${endpoint}, steps: ${inferenceSteps}, size: ${width}x${height}, img2img: ${!!imageUrl}`);

    // Determine image size
    let imageSize = "square_hd";
    if (width && height) {
      imageSize = { width: parseInt(width), height: parseInt(height) };
    }

    // DEBUG: Force Img2Img logging
    console.log('[ImageGen] Payload Img2Img check:', {
        hasImageUrl: !!imageUrl,
        imageUrlLength: imageUrl ? imageUrl.length : 0,
        strength: strength
    });

    const makeRequest = async () => {
    try {
      const payload = {
          prompt: prompt,
            image_size: imageSize,
          num_inference_steps: inferenceSteps,
          guidance_scale: 3.5,
          safety_tolerance: "6", 
            enable_safety_checker: false 
      };

      // Add Img2Img parameters if available
      if (imageUrl) {
          // CRITICAL: Ensure imageUrl is actually being sent
          payload.image_url = imageUrl;
          // Use provided strength or default to a balanced value (0.75) for Img2Img
          payload.strength = strength !== null ? strength : 0.75; 
      }

      const response = await axios.post(
        endpoint,
        payload,
        {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

        console.log('[ImageGen] Fal.ai response status:', response.status);
      
      if (response.data.images && response.data.images.length > 0) {
        return response.data.images[0].url;
      }
      
      if (response.data.request_id) {
           console.log(`[ImageGen] Request queued with ID: ${response.data.request_id}, polling...`);
        return await this.pollFalResult(response.data.request_id);
      }

      throw new Error('Unexpected response format from Fal.ai');
    } catch (error) {
        console.error('Fal AI Error Status:', error.response?.status);
        console.error('Fal AI Error Data:', JSON.stringify(error.response?.data));
        console.error('Fal AI Error Message:', error.message);
      throw error;
    }
    };

    // Run requests in parallel
    const requests = [];
    console.log(`[ImageGen] Looping ${count} times to create requests`);
    for (let i = 0; i < count; i++) {
      requests.push(makeRequest());
    }

    return await Promise.all(requests);
  }

  async generateWithVolcengine(prompt, { count = 1, width, height }) {
    // Placeholder implementation for Volcengine
    // Volcengine typically uses AccessKey/SecretKey with HMAC-SHA256 signing which is complex to implement without SDK.
    // We check for environment variables first.
    const ak = process.env.VOLCENGINE_ACCESS_KEY;
    const sk = process.env.VOLCENGINE_SECRET_KEY;
    
    if (!ak || !sk) {
      throw new Error('Volcengine configuration missing. Please set VOLCENGINE_ACCESS_KEY and VOLCENGINE_SECRET_KEY.');
    }

    console.log('[ImageGen] Volcengine requested. NOTE: This is a placeholder as full SDK implementation is required.');
    
    // Since we don't have the SDK or full signing logic here, and the user wants the "call structure" to be dynamic:
    // We will throw an error instructing to configure it or implement the signing.
    // If the user provides a specific HTTP endpoint that accepts a simple API Key, we could use that.
    // For now, we simulate a failure or return a placeholder if testing mode? No, better to be honest.

    throw new Error('Volcengine integration requires full SDK implementation for signature. Please install @volcengine/openapi or similar if available, or implement signing.');
  }

  async pollFalResult(requestId, maxAttempts = 30) {
    const statusUrl = `https://queue.fal.run/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/requests/${requestId}`;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 1000)); // wait 1s
      
      const check = await axios.get(statusUrl, {
        headers: { 'Authorization': `Key ${this.apiKey}` }
      });

      if (check.data.status === 'COMPLETED') {
        const result = await axios.get(resultUrl, {
            headers: { 'Authorization': `Key ${this.apiKey}` }
        });
        return result.data.images[0].url;
      }
      if (check.data.status === 'FAILED') {
        throw new Error('Fal AI Generation Failed: ' + check.data.error);
      }
    }
    throw new Error('Fal AI Generation Timeout');
  }

  async downloadAndSaveImage(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const fileName = `gen-${uuidv4()}.png`; // Flux usually returns png or jpg
    
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    const filePath = path.join(this.uploadDir, fileName);
    fs.writeFileSync(filePath, response.data);

    return `/uploads/${fileName}`;
  }

  async resolveToDataUri(urlOrPath) {
    let filePath = null;
    
    // Helper to find file in common locations
    const findFile = (filename) => {
        // Try 1: Calculated uploadDir (backend/uploads)
        let p = path.join(this.uploadDir, filename);
        if (fs.existsSync(p)) return p;
        
        // Try 2: Relative to process.cwd() (where node runs)
        p = path.join(process.cwd(), 'uploads', filename);
        if (fs.existsSync(p)) return p;

        // Try 3: ../uploads (if running in src)
        p = path.join(process.cwd(), '../uploads', filename);
        if (fs.existsSync(p)) return p;
        
        return null;
    };

    // If it's http/https
    if (urlOrPath.startsWith('http')) {
        // If it's localhost, we need to map to local file system because Fal can't see localhost
        if (urlOrPath.includes('localhost') || urlOrPath.includes('127.0.0.1')) {
            const filename = urlOrPath.split('/uploads/')[1];
            if (filename) {
                 filePath = findFile(filename);
            }
        } else {
            return urlOrPath; // Public URL, fine
        }
    }
    // If it's a relative path /uploads/xxx.png
    else if (urlOrPath.startsWith('/uploads/')) {
        const filename = urlOrPath.split('/uploads/')[1];
        filePath = findFile(filename);
    }

    if (filePath) {
         const ext = path.extname(filePath).toLowerCase().replace('.', '');
         // Map extension to mime type
         let mime = 'image/png';
         if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
         if (ext === 'webp') mime = 'image/webp';
         
         const buffer = fs.readFileSync(filePath);
         console.log(`[ImageGen] Resolved local file: ${filePath} (${buffer.length} bytes)`);
         return `data:${mime};base64,${buffer.toString('base64')}`;
    }

    console.warn(`[ImageGen] Could not resolve local file for: ${urlOrPath}`);
    return urlOrPath;
  }
}

module.exports = new ImageGenerationService();
