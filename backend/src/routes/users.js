const express = require('express');
const router = express.Router();
const User = require('../models/User');
const walletService = require('../services/walletService');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/users - List all users (Admin only)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin (either real admin or mock admin)
    const isAdmin = req.user && req.user.role === 'admin';
    
    if (!isAdmin) {
      // If no users exist, allow access to initialize first admin
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        return res.json([]);
      }
      
      return res.status(403).json({ 
        message: 'Admin access required',
        code: 'FORBIDDEN'
      });
    }
    
    const users = await User.find().sort({ createdAt: -1 });
    // Enhance with balance info
    const usersWithBalance = await Promise.all(users.map(async (u) => {
      const balance = await walletService.getBalance(u._id.toString());
      return { ...u.toObject(), balance };
    }));
    res.json(usersWithBalance);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users - Create a new user (Admin only)
router.post('/', requireAdmin, async (req, res) => {
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

// POST /api/users/:id/recharge - Recharge user wallet (Admin only, or self-recharge)
router.post('/:id/recharge', async (req, res) => {
  try {
    const { amount } = req.body;
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Permission check: Only admin can recharge others, users can only recharge themselves
    if (!isAdmin && targetUserId !== currentUserId) {
      return res.status(403).json({ 
        message: 'You can only recharge your own wallet',
        code: 'FORBIDDEN'
      });
    }
    
    // Amount validation
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ 
        message: 'Amount must be a positive number',
        code: 'INVALID_AMOUNT'
      });
    }
    
    // Maximum amount limit (prevent abuse)
    const MAX_RECHARGE_AMOUNT = 1000000;
    if (amountNum > MAX_RECHARGE_AMOUNT) {
      return res.status(400).json({ 
        message: `Amount cannot exceed ${MAX_RECHARGE_AMOUNT}`,
        code: 'AMOUNT_TOO_LARGE'
      });
    }

    const newBalance = await walletService.reward(targetUserId, amountNum, 'admin_recharge');
    res.json({ success: true, balance: newBalance });
  } catch (err) {
    console.error('Recharge error:', err);
    res.status(500).json({ message: err.message || 'Failed to recharge wallet' });
  }
});

// POST /api/users/init-admin - Helper to ensure admin user exists
// Allow creating first admin if no users exist, otherwise require admin role
router.post('/init-admin', async (req, res) => {
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;
    
    // If not first user, require admin role
    if (!isFirstUser) {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          message: 'Admin access required',
          code: 'FORBIDDEN'
        });
      }
    }
    
    let admin = await User.findOne({ username: 'admin' });
    if (!admin) {
      admin = await User.create({ 
        username: 'admin', 
        email: 'admin@ai-host.com', 
        role: 'admin',
      });
      // Initialize wallet for admin
      await walletService.getBalance(admin._id.toString());
    }
    res.json(admin);
  } catch (err) {
    console.error('Init admin error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

