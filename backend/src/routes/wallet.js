const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const { requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/wallet/balance
// Returns balance for authenticated user
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await walletService.getBalance(userId);
    res.json({ balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching balance' });
  }
});

// POST /api/wallet/reward/ad
// Reward for watching an ad (requires traceId to prevent duplicate rewards)
router.post('/reward/ad', async (req, res) => {
  try {
    const userId = req.user.id;
    const { traceId } = req.body;
    
    if (!traceId) {
      return res.status(400).json({ 
        message: 'traceId is required to prevent duplicate rewards',
        code: 'TRACE_ID_REQUIRED'
      });
    }

    // Fixed reward for watching ad: +50 Coins
    // traceId is passed as 5th parameter for duplicate prevention
    const newBalance = await walletService.reward(userId, 50, 'ad_reward', traceId, traceId);
    
    res.json({ success: true, balance: newBalance, message: 'Ad reward received! +50 Coins' });
  } catch (err) {
    console.error('Ad reward error:', err);
    if (err.message === 'DUPLICATE_REWARD') {
      return res.status(409).json({ 
        message: 'This ad reward has already been claimed',
        code: 'DUPLICATE_REWARD'
      });
    }
    res.status(500).json({ message: 'Error processing reward' });
  }
});

module.exports = router;

