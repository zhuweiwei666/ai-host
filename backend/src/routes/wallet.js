const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');

// GET /api/wallet/balance?userId=...
router.get('/balance', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    
    const balance = await walletService.getBalance(userId);
    res.json({ balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching balance' });
  }
});

// POST /api/wallet/reward/ad
// Mock watching an ad
router.post('/reward/ad', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId required' });

    // Fixed reward for watching ad: +50 Coins
    const newBalance = await walletService.reward(userId, 50, 'ad_reward');
    
    res.json({ success: true, balance: newBalance, message: 'Ad reward received! +50 Coins' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing reward' });
  }
});

module.exports = router;

