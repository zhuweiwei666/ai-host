const express = require('express');
const router = express.Router();
const videoGenerationService = require('../services/videoGenerationService');
const walletService = require('../services/walletService');
const relationshipService = require('../services/relationshipService');
const Agent = require('../models/Agent');
const UsageLog = require('../models/UsageLog');
const costCalculator = require('../utils/costCalculator');
const { requireAuth } = require('../middleware/auth');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

// Apply authentication middleware to all routes
router.use(requireAuth);

const videoFeatureEnabled = process.env.ENABLE_VIDEO_FEATURE === 'true';

if (!videoFeatureEnabled) {
  router.post('/', (req, res) => {
    return errors.serviceUnavailable(res, 'Video generation is temporarily disabled');
  });
  module.exports = router;
  return;
}

// POST /api/generate-video
router.post('/', async (req, res) => {
  const { prompt, imageUrl, agentId, userId, fastMode } = req.body;

  if (!prompt && !imageUrl) {
    return errors.badRequest(res, 'Prompt or Image URL required');
  }

  // Get userId from authenticated user or request body
  let safeUserId = userId;
  if (!safeUserId) {
    if (!req.user || !req.user.id) {
      return errors.unauthorized(res);
    }
    safeUserId = req.user.id;
  } 

  try {
    // 1. Check & Deduct Balance
    const COST_COINS = fastMode ? 20 : 50;
    await walletService.consume(safeUserId, COST_COINS, 'ai_video', agentId);

    // 2. Resolve Image Source based on Intimacy
    let sourceImageUrl = imageUrl;
    const agent = await Agent.findById(agentId);
    
    if (!sourceImageUrl && agent) {
        const intimacy = await relationshipService.getIntimacy(safeUserId, agentId);
        const threshold = agent.stage2Threshold || 60;
        
        // Stage 3 (Intimacy > Threshold) & Has Private Photo -> Use Private
        if (intimacy > threshold && agent.privatePhotoUrl && agent.privatePhotoUrl.startsWith('http')) {
            console.log('[VideoGen] Using Private/NSFW Photo for video reference');
            sourceImageUrl = agent.privatePhotoUrl;
        } else if (agent.avatarUrl) {
            console.log('[VideoGen] Using Public Avatar for video reference');
            sourceImageUrl = agent.avatarUrl;
        }
    }

    // 3. Strict Validation: We MUST have a source image for Image-to-Video
    if (!sourceImageUrl) {
        console.warn('[VideoGen] No avatar URL found for agent:', agent.name);
        return errors.badRequest(res, 'Aborted: Character avatar is required for motion generation. (No Text-to-Video allowed)');
    }

    // 4. Generate Video
    let model = 'fal-ai/hunyuan-video';
    if (fastMode) {
        model = 'fal-ai/minimax-video';
    }

    console.log(`[VideoGen] Request: FastMode=${fastMode}, Model=${model}, Source=${sourceImageUrl}`);

    const videoUrl = await videoGenerationService.generate(prompt, {
      imageUrl: sourceImageUrl,
      model: model
    });

    // 4. Log Usage & Increase Intimacy
    try {
        // Bonus Intimacy for paid Video Gen (+10)
        await relationshipService.updateIntimacy(safeUserId, agentId, 10);

        const costUSD = costCalculator.calculateVideo(model, 1); 
        await UsageLog.create({
            agentId: agentId || null, // Optional
            userId: safeUserId,
            type: 'video',
            provider: 'fal',
            model: model,
            inputUnits: 0,
            outputUnits: 1,
            cost: costUSD
        });
    } catch (logErr) {
        console.error('Video Log Error:', logErr);
    }

    sendSuccess(res, HTTP_STATUS.OK, { 
      url: videoUrl, 
      balance: await walletService.getBalance(safeUserId),
      intimacy: await relationshipService.getIntimacy(safeUserId, agentId)
    });

  } catch (error) {
    console.error('Video Gen Error:', error.message);
    
    if (error.message === 'INSUFFICIENT_FUNDS') {
        return errors.insufficientFunds(res);
    }
    errors.videoGenError(res, 'Video generation failed', { error: error.message });
  }
});

module.exports = router;
