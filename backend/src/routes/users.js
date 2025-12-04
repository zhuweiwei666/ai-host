const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const walletService = require('../services/walletService');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

// Public routes (no auth required)

// POST /api/users/sync - Sync external user (for Android/iOS integration)
// This endpoint is called by external products to sync their users
// It will create a new user if not exists, or return existing user
router.post('/sync', async (req, res) => {
  try {
    const { externalUserId, platform, externalAppId, email, phone, username } = req.body;
    
    // Validation
    if (!externalUserId) {
      return errors.badRequest(res, 'externalUserId is required', { code: 'MISSING_EXTERNAL_USER_ID' });
    }
    
    if (!platform || !['android', 'ios'].includes(platform)) {
      return errors.badRequest(res, 'platform must be "android" or "ios"', { code: 'INVALID_PLATFORM' });
    }
    
    // Build query to find existing user by externalUserId
    const query = { 
      externalUserId,
      platform,
      userType: 'channel'
    };
    
    // If externalAppId is provided, include it in the query
    if (externalAppId) {
      query.externalAppId = externalAppId;
    }
    
    // Try to find existing user
    let user = await User.findOne(query);
    
    if (user) {
      // User exists, update last login and return
      user.lastLoginAt = new Date();
      await user.save();
      
      // Get balance
      const balance = await walletService.getBalance(user._id.toString());
      
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
      
      return sendSuccess(res, HTTP_STATUS.OK, {
        user: {
          _id: user._id, // 内部用户ID
          externalUserId: user.externalUserId, // 外部用户ID
          username: user.username,
          email: user.email,
          phone: user.phone,
          platform: user.platform,
          userType: user.userType,
          role: user.role
        },
        token,
        balance,
        isNew: false
      });
    }
    
    // User doesn't exist, create new one
    // Generate internal username if not provided
    const internalUsername = username || `user_${externalUserId}_${platform}_${Date.now()}`;
    
    // Create channel user with externalUserId
    user = await User.create({
      username: internalUsername,
      email,
      phone,
      externalUserId,
      externalAppId,
      platform,
      userType: 'channel',
      role: 'user',
      isActive: true,
      lastLoginAt: new Date()
    });
    
    // Initialize wallet
    const balance = await walletService.getBalance(user._id.toString());
    
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
    
    sendSuccess(res, HTTP_STATUS.CREATED, {
      user: {
        _id: user._id, // 内部用户ID
        externalUserId: user.externalUserId, // 外部用户ID
        username: user.username,
        email: user.email,
        phone: user.phone,
        platform: user.platform,
        userType: user.userType,
        role: user.role
      },
      token,
      balance,
      isNew: true
    });
  } catch (err) {
    console.error('Sync user error:', err);
    errors.internalError(res, err.message || 'Failed to sync user', { error: err.message });
  }
});

// POST /api/users/register - Register a new channel user (for web platform)
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, phone, platform = 'web' } = req.body;
    
    // Validation
    if (!username || !password) {
      return errors.badRequest(res, 'Username and password are required', { code: 'MISSING_FIELDS' });
    }
    
    if (password.length < 6) {
      return errors.badRequest(res, 'Password must be at least 6 characters', { code: 'WEAK_PASSWORD' });
    }
    
    // Web platform doesn't use externalUserId
    if (platform === 'android' || platform === 'ios') {
      return errors.badRequest(res, 'For Android/iOS platforms, please use /api/users/sync endpoint with externalUserId', { code: 'USE_SYNC_ENDPOINT' });
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
      return errors.conflict(res, 'User already exists', { code: 'USER_EXISTS' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create channel user
    const user = await User.create({
      username,
      password: hashedPassword,
      email,
      phone,
      platform: 'web',
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
    
    sendSuccess(res, HTTP_STATUS.CREATED, {
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
    errors.internalError(res, err.message || 'Registration failed', { error: err.message });
  }
});

// POST /api/users/login - Login for channel users (web platform only)
// For Android/iOS, use /api/users/sync instead
router.post('/login', async (req, res) => {
  try {
    const { username, password, externalUserId, platform } = req.body;
    
    // Support login by externalUserId for Android/iOS
    if (externalUserId && (platform === 'android' || platform === 'ios')) {
      // Redirect to sync endpoint logic
      const query = { 
        externalUserId,
        platform,
        userType: 'channel'
      };
      
      const user = await User.findOne(query);
      
      if (!user) {
        return errors.notFound(res, 'User not found. Please use /api/users/sync to create user first.', { code: 'USER_NOT_FOUND' });
      }
      
      if (!user.isActive) {
        return errors.forbidden(res, 'Account is disabled', { code: 'ACCOUNT_DISABLED' });
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
      
      return sendSuccess(res, HTTP_STATUS.OK, {
        user: {
          _id: user._id,
          externalUserId: user.externalUserId,
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
    }
    
    // Traditional username/password login (for web platform)
    if (!username || !password) {
      return errors.badRequest(res, 'Username and password are required', { code: 'MISSING_FIELDS' });
    }
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return errors.unauthorized(res, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return errors.forbidden(res, 'Account is disabled', { code: 'ACCOUNT_DISABLED' });
    }
    
    // Verify password
    if (!user.password) {
      return errors.unauthorized(res, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return errors.unauthorized(res, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
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
    
    sendSuccess(res, HTTP_STATUS.OK, {
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
    errors.internalError(res, err.message || 'Login failed', { error: err.message });
  }
});

// POST /api/users/google-login - Login with Google
router.post('/google-login', async (req, res) => {
  try {
    const { google_id, email, name, picture } = req.body;

    // 1. Check required parameters
    if (!google_id || !email) {
      return errors.badRequest(res, 'Missing google_id or email');
    }

    // 2. Find user by google_id or email
    let user = await User.findOne({
      $or: [
        { google_id: google_id },
        { email: email }
      ]
    });

    if (user) {
      // 3. User exists: Link Google ID if not linked
      if (!user.google_id) {
        user.google_id = google_id;
        await user.save();
      }
      // Update avatar if user has no avatar and picture is provided
      if (!user.avatar && picture) {
        user.avatar = picture;
        await user.save();
      }
    } else {
      // 4. User does not exist: Auto-register
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      
      // Use name or email prefix as username
      // Ensure username is unique by appending random string if necessary (simple handling here)
      let username = name || email.split('@')[0];
      
      // Check if username exists (unlikely for name but possible for email prefix)
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        username = `${username}_${Math.floor(Math.random() * 10000)}`;
      }

      user = await User.create({
        username: username,
        email: email,
        password: await bcrypt.hash(randomPassword, 10), // Hash the random password
        google_id: google_id,
        avatar: picture || '',
        role: 'user',
        userType: 'channel', // Default to channel user
        platform: 'web',
        isActive: true,
        lastLoginAt: new Date()
      });

      // Initialize wallet
      await walletService.getBalance(user._id.toString());
    }

    // 5. Generate Token
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

    // Return response
    sendSuccess(res, HTTP_STATUS.OK, {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        balance: balance,
        isVip: false // Placeholder, add logic if VIP system exists
      }
    });

  } catch (err) {
    console.error('Google Login Error:', err);
    errors.internalError(res, 'Server error during Google login', { error: err.message });
  }
});

// POST /api/users/init-admin - Helper to ensure admin user exists
// Allow creating first admin if no users exist, otherwise require admin role
// This must be before requireAuth to allow creating first admin without authentication
// Body: { username?, password? } - optional, defaults to admin/admin123
router.post('/init-admin', optionalAuth, async (req, res) => {
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    const isFirstUser = userCount === 0;
    
    // If not first user, require admin role (but allow without auth for first user)
    if (!isFirstUser) {
      const user = req.user;
      if (!user || user.role !== 'admin') {
        return errors.adminRequired(res);
      }
    }
    
    const { username = 'admin', password = 'admin123' } = req.body;
    
    let admin = await User.findOne({ username });
    let isNewAdmin = false;
    
    if (!admin) {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      admin = await User.create({ 
        username, 
        password: hashedPassword,
        email: `${username}@ai-host.com`, 
        role: 'admin',
        userType: 'operator',
        platform: 'admin'
      });
      isNewAdmin = true;
      
      // Initialize wallet for admin
      await walletService.getBalance(admin._id.toString());
    }
    
    // Don't send password
    const adminObj = admin.toObject();
    delete adminObj.password;
    
    sendSuccess(res, HTTP_STATUS.OK, {
      ...adminObj,
      isNew: isNewAdmin,
      message: isNewAdmin 
        ? `管理员账号已创建，用户名: ${username}，密码: ${password}` 
        : '管理员账号已存在'
    });
  } catch (err) {
    console.error('Init admin error:', err);
    errors.internalError(res, err.message || 'Operation failed', { error: err.message });
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
        return sendSuccess(res, HTTP_STATUS.OK, []);
      }
      
      return errors.adminRequired(res);
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
    
    sendSuccess(res, HTTP_STATUS.OK, usersWithBalance);
  } catch (err) {
    console.error('Get users error:', err);
    errors.internalError(res, err.message || 'Operation failed', { error: err.message });
  }
});

// POST /api/users - Create a new user (Admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, email, role, userType, platform, phone, password } = req.body;
    
    // Validate userType
    if (userType && !['operator', 'channel'].includes(userType)) {
      return errors.badRequest(res, 'Invalid userType. Must be "operator" or "channel"', { code: 'INVALID_USER_TYPE' });
    }
    
    // For channel users, password is required
    if (userType === 'channel' && !password) {
      return errors.badRequest(res, 'Password is required for channel users', { code: 'PASSWORD_REQUIRED' });
    }
    
    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      if (password.length < 6) {
        return errors.badRequest(res, 'Password must be at least 6 characters', { code: 'WEAK_PASSWORD' });
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
    
    sendSuccess(res, HTTP_STATUS.CREATED, userObj);
  } catch (err) {
    console.error('Create user error:', err);
    errors.badRequest(res, err.message);
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
      return errors.forbidden(res, 'You can only recharge your own wallet');
    }
    
    // Amount validation
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return errors.badRequest(res, 'Amount must be a positive number', { code: 'INVALID_AMOUNT' });
    }
    
    // Maximum amount limit (prevent abuse)
    const MAX_RECHARGE_AMOUNT = 1000000;
    if (amountNum > MAX_RECHARGE_AMOUNT) {
      return errors.badRequest(res, `Amount cannot exceed ${MAX_RECHARGE_AMOUNT}`, { code: 'AMOUNT_TOO_LARGE' });
    }

    const newBalance = await walletService.reward(targetUserId, amountNum, 'admin_recharge');
    sendSuccess(res, HTTP_STATUS.OK, { success: true, balance: newBalance });
  } catch (err) {
    console.error('Recharge error:', err);
    errors.internalError(res, err.message || 'Failed to recharge wallet', { error: err.message });
  }
});

module.exports = router;

