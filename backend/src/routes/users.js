const express = require('express');
const router = express.Router();
const User = require('../models/User');
const walletService = require('../services/walletService');

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    // Enhance with balance info
    const usersWithBalance = await Promise.all(users.map(async (u) => {
      const balance = await walletService.getBalance(u._id.toString());
      return { ...u.toObject(), balance };
    }));
    res.json(usersWithBalance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users - Create a new user
router.post('/', async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const user = await User.create({ username, email, role });
    // Init wallet
    await walletService.getBalance(user._id.toString());
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/users/:id/recharge - Recharge user wallet
router.post('/:id/recharge', async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.params.id;
    
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const newBalance = await walletService.reward(userId, Number(amount), 'admin_recharge');
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/init-admin - Helper to ensure admin user exists
router.post('/init-admin', async (req, res) => {
  try {
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = await User.create({ 
        username: 'admin', 
        email: 'admin@ai-host.com', 
        role: 'admin',
        // Force specific ID if we want to match the hardcoded "test_user_001" from before,
        // but better to just use the mongo ID. 
        // For compatibility with previous "test_user_001" hardcoding in ChatPage,
        // we might want to update ChatPage to use a real login system later.
        // For now, let's just create a standard user.
      });
    }
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

