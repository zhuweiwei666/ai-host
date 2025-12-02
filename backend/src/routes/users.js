const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const walletService = require('../services/walletService');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// Public routes (no auth required)
// POST /api/users/register - Register a new channel user
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, phone, platform = 'web' } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [
        { username },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : [])
      ]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User already exists',
        code: 'USER_EXISTS'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create channel user
    const user = await User.create({
      username,
      password: hashedPassword,
      email,
      phone,
      platform: ['web', 'android', 'ios'].includes(platform) ? platform : 'web',
      userType: 'channel',
      role: 'user',
      isActive: true
    });
    
    // Initialize wallet
    await walletService.getBalance(user._id.toString());
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(), 
        username: user.username,
        role: user.role,
        userType: user.userType 
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        platform: user.platform,
        userType: user.userType,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

// POST /api/users/login - Login for channel users
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // Verify password
    if (!user.password) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id.toString(), 
        username: user.username,
        role: user.role,
        userType: user.userType 
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '30d' }
    );
    
    // Get balance
    const balance = await walletService.getBalance(user._id.toString());
    
    res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        platform: user.platform,
        userType: user.userType,
        role: user.role
      },
      token,
      balance
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message || 'Login failed' });
  }
});

// Protected routes (require auth)
router.use(requireAuth);

// GET /api/users - List all users (Admin only)
// Query params: userType (operator/channel), platform (web/android/ios)
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
    
    // Build query
    const query = {};
    if (req.query.userType) {
      query.userType = req.query.userType;
    }
    if (req.query.platform) {
      query.platform = req.query.platform;
    }
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }
    
    const users = await User.find(query).sort({ createdAt: -1 });
    
    // Enhance with balance info (exclude password)
    const usersWithBalance = await Promise.all(users.map(async (u) => {
      const balance = await walletService.getBalance(u._id.toString());
      const userObj = u.toObject();
      delete userObj.password; // Don't send password to frontend
      return { ...userObj, balance };
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
    const { username, email, role, userType, platform, phone, password } = req.body;
    
    // Validate userType
    if (userType && !['operator', 'channel'].includes(userType)) {
      return res.status(400).json({ 
        message: 'Invalid userType. Must be "operator" or "channel"',
        code: 'INVALID_USER_TYPE'
      });
    }
    
    // For channel users, password is required
    if (userType === 'channel' && !password) {
      return res.status(400).json({ 
        message: 'Password is required for channel users',
        code: 'PASSWORD_REQUIRED'
      });
    }
    
    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ 
          message: 'Password must be at least 6 characters',
          code: 'WEAK_PASSWORD'
        });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    const userData = {
      username,
      email,
      role: role || 'user',
      userType: userType || 'channel',
      platform: platform || (userType === 'operator' ? 'admin' : 'web'),
      phone,
      ...(hashedPassword && { password: hashedPassword })
    };
    
    const user = await User.create(userData);
    
    // Init wallet
    await walletService.getBalance(user._id.toString());
    
    // Don't send password to frontend
    const userObj = user.toObject();
    delete userObj.password;
    
    res.status(201).json(userObj);
  } catch (err) {
    console.error('Create user error:', err);
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
        userType: 'operator',
        platform: 'admin'
      });
      // Initialize wallet for admin
      await walletService.getBalance(admin._id.toString());
    }
    // Don't send password
    const adminObj = admin.toObject();
    delete adminObj.password;
    res.json(adminObj);
  } catch (err) {
    console.error('Init admin error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

