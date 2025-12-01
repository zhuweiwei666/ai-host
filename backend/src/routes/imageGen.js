const express = require('express');
const router = express.Router();
const imageGenerationService = require('../services/imageGenerationService');
const walletService = require('../services/walletService');
const relationshipService = require('../services/relationshipService');
const Agent = require('../models/Agent');
const UsageLog = require('../models/UsageLog');
const costCalculator = require('../utils/costCalculator');

// Debug middleware
router.use((req, res, next) => {
  console.log(`[ImageGen] ${req.method} ${req.originalUrl}`);
  next();
});

// POST /api/generate-image
router.post('/', async (req, res) => {
  const { description, count, width, height, provider, agentId, userId, useAvatar, skipBalanceCheck, useImg2Img } = req.body;

  if (!description) {
    return res.status(400).json({ message: 'Description is required' });
  }

  // Mock User ID if not provided
  const safeUserId = userId || 'test_user_001';

  try {
    let agent = null;
    if (agentId) {
      agent = await Agent.findById(agentId);
    }

    // 1. Deduct Balance (Cost: 10 Coins)
    // Skip if admin operation (skipBalanceCheck is true)
    if (!skipBalanceCheck) {
        const COST_COINS = 10;
        await walletService.consume(safeUserId, COST_COINS, 'ai_image', agentId);
    }

    // 2. Prepare Prompt & Options
    // Use agent details if available
    let finalPrompt = description;
    
    // If generating Nude (detected by keywords), ensure prompt is explicit for base generation
    const isNudeGen = description.toLowerCase().includes('nude') || description.toLowerCase().includes('naked');
    
    // Determine Style
    const isAnimeStyle = agent && agent.style === 'anime';
    const isRealisticStyle = !agent || agent.style === 'realistic'; // Default to realistic

    if (agent) {
        const realismKeywords = "RAW PHOTO, photorealistic, 8k uhd, dslr, soft lighting, film grain, Fujifilm XT3";
        const animeKeywords = "anime style, 2d, illustration, vibrant colors, studio ghibli style, makoto shinkai style, masterpiece, best quality";
        
        let styleKeywords = "";
        if (isAnimeStyle) {
             styleKeywords = animeKeywords;
        } else {
             styleKeywords = realismKeywords;
        }
        
        // If Nude, we prioritize body description.
        if (isNudeGen) {
             // CRITICAL FIX: DO NOT include agent.description here. 
             // The agent description likely contains clothing details (e.g. "wearing a dress") 
             // which contradicts the "naked" instruction and confuses the AI.
             // We only use the incoming 'description' (which comes from frontend's nudePrompt)
             // plus our forceful Nude keywords.
             finalPrompt = `${styleKeywords}, ${description}, completely naked, wearing nothing, no clothes, no lingerie, no bikini, full body shot, wide angle, head to toe visible, detailed skin texture, detailed genitalia, anatomically correct`;
        } else {
             finalPrompt = `${styleKeywords}, ${agent.description} (${agent.gender}), ${description}`;
        }
    } else {
        // No agent context
        const isAnimeInput = description.toLowerCase().match(/anime|manga|cartoon|illustration|2d|sketch|painting/);
        if (isAnimeInput) {
             finalPrompt = `${description}, detailed, 8k, masterpiece, anime style`;
        } else {
             finalPrompt = `A high quality photo of ${description}, detailed, 8k, realistic, raw photo`;
        }
    }

    const genOptions = { 
      count: count || 1, 
      width: width || 768, 
      height: height || 1152,
      provider: provider || 'fal',
      model: 'flux/dev'
    };

    // Face Swap / Consistency
    // Allow explicit faceImageUrl from body (for EditAgent preview) OR fallback to agent's saved avatar
    // Check Intimacy to decide which avatar to use as reference if not explicit
    let sourceFaceUrl = req.body.faceImageUrl;
    if (!sourceFaceUrl && useAvatar && agent) {
        const intimacy = await relationshipService.getIntimacy(safeUserId, agentId);
        const threshold = agent.stage2Threshold || 60;
        
        if (intimacy > threshold && agent.privatePhotoUrl && agent.privatePhotoUrl.startsWith('http')) {
             sourceFaceUrl = agent.privatePhotoUrl;
        } else {
             sourceFaceUrl = agent.avatarUrl;
        }
    }

    if (sourceFaceUrl && sourceFaceUrl.startsWith('http')) {
        genOptions.faceImageUrl = sourceFaceUrl;
        // If client explicitly requested useImg2Img (e.g. from EditAgent for Nude Gen), honor it.
        // Otherwise default to true for consistency.
        if (typeof useImg2Img !== 'undefined') {
             genOptions.useImg2Img = useImg2Img;
        } else {
             genOptions.useImg2Img = true;
        }
    }

    // 3. Generate
    const results = await imageGenerationService.generate(finalPrompt, genOptions);
    
    // 4. Log Usage & Increase Intimacy
    try {
        // Bonus Intimacy for paid Image Gen (+5)
        // Note: If skipBalanceCheck is true (admin), we might skip intimacy or keep it? 
        // Usually admin actions don't need intimacy tracking, but safe to just add it or ignore.
        // Let's add it for consistent testing experience.
        await relationshipService.updateIntimacy(safeUserId, agentId, 5);

        const costUSD = costCalculator.calculateImage('flux/dev', 1);
        await UsageLog.create({
            agentId: agentId || null,
            userId: safeUserId,
            type: 'image',
            provider: 'fal',
            model: 'flux/dev',
            inputUnits: 0,
            outputUnits: 1,
            cost: costUSD
        });
    } catch (logErr) {
        console.error('Image Log Error:', logErr);
    }

    
    const finalIntimacy = await relationshipService.getIntimacy(safeUserId, agentId);
    
    res.json({ 
      url: results[0].url, 
      remoteUrl: results[0].remoteUrl,
      urls: results.map(r => r.url),
      balance: await walletService.getBalance(safeUserId),
      intimacy: finalIntimacy
    });

  } catch (error) {
    console.error('Image Gen Error:', error.message);
    if (error.message === 'INSUFFICIENT_FUNDS') {
        return res.status(402).json({ message: 'Insufficient AI Coins', code: 'INSUFFICIENT_FUNDS' });
    }
    res.status(500).json({ message: error.message || 'Failed to generate image' });
  }
});

module.exports = router;
