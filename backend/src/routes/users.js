const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const walletService = require('../services/walletService');
const appleAuthService = require('../services/appleAuthService');
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

// POST /api/users/apple-login - Login with Apple Sign In (iOS required)
router.post('/apple-login', async (req, res) => {
  try {
    const { identityToken, authorizationCode, user: appleUser, email, fullName } = req.body;

    // 1. Check required parameters
    if (!identityToken) {
      return errors.badRequest(res, 'Missing identityToken', { code: 'MISSING_IDENTITY_TOKEN' });
    }

    // 2. Verify the identity token with Apple
    let applePayload;
    try {
      applePayload = await appleAuthService.verifyIdentityToken(
        identityToken,
        process.env.APPLE_BUNDLE_ID // Optional: validate against your bundle ID
      );
    } catch (verifyError) {
      console.error('Apple token verification failed:', verifyError);
      return errors.unauthorized(res, 'Invalid Apple identity token', { 
        code: 'INVALID_TOKEN',
        error: verifyError.message 
      });
    }

    const appleId = applePayload.sub; // Apple's unique user ID
    const appleEmail = applePayload.email || email; // Email might only come on first login

    // 3. Find user by apple_id or email
    let user = await User.findOne({
      $or: [
        { apple_id: appleId },
        ...(appleEmail ? [{ email: appleEmail }] : [])
      ]
    });

    let isNewUser = false;

    if (user) {
      // 4. User exists: Link Apple ID if not linked
      if (!user.apple_id) {
        user.apple_id = appleId;
      }
      // Update last login
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      // 5. User does not exist: Auto-register
      isNewUser = true;
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      
      // Build username from fullName or email
      let username = 'apple_user';
      if (fullName) {
        const givenName = fullName.givenName || '';
        const familyName = fullName.familyName || '';
        if (givenName || familyName) {
          username = `${givenName}${familyName}`.trim() || 'apple_user';
        }
      } else if (appleEmail) {
        username = appleEmail.split('@')[0];
      }
      
      // Ensure username is unique
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        username = `${username}_${Math.floor(Math.random() * 10000)}`;
      }

      user = await User.create({
        username: username,
        email: appleEmail || null,
        password: await bcrypt.hash(randomPassword, 10),
        apple_id: appleId,
        avatar: '', // Apple doesn't provide avatar
        role: 'user',
        userType: 'channel',
        platform: 'ios',
        isActive: true,
        lastLoginAt: new Date()
      });

      // Initialize wallet with welcome bonus
      await walletService.getBalance(user._id.toString());
      // Give new users 100 coins as welcome bonus
      await walletService.reward(user._id.toString(), 100, 'welcome_bonus');
    }

    // 6. Generate Token
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
    sendSuccess(res, isNewUser ? HTTP_STATUS.CREATED : HTTP_STATUS.OK, {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        balance: balance,
        isVip: false
      },
      isNew: isNewUser
    });

  } catch (err) {
    console.error('Apple Login Error:', err);
    errors.internalError(res, 'Server error during Apple login', { error: err.message });
  }
});

// POST /api/users/device-token - Register device token for push notifications
router.post('/device-token', optionalAuth, async (req, res) => {
  try {
    const { deviceToken, platform } = req.body;

    // Validation
    if (!deviceToken) {
      return errors.badRequest(res, 'deviceToken is required', { code: 'MISSING_DEVICE_TOKEN' });
    }

    if (!platform || !['ios', 'android'].includes(platform)) {
      return errors.badRequest(res, 'platform must be "ios" or "android"', { code: 'INVALID_PLATFORM' });
    }

    // If user is authenticated, save to their profile
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id);
      
      if (user) {
        // Check if token already exists
        const existingTokenIndex = user.deviceTokens?.findIndex(
          dt => dt.token === deviceToken && dt.platform === platform
        );

        if (existingTokenIndex === -1 || existingTokenIndex === undefined) {
          // Add new token
          if (!user.deviceTokens) {
            user.deviceTokens = [];
          }
          user.deviceTokens.push({
            token: deviceToken,
            platform: platform,
            createdAt: new Date()
          });
          
          // Keep only last 5 tokens per platform
          const platformTokens = user.deviceTokens.filter(dt => dt.platform === platform);
          if (platformTokens.length > 5) {
            // Remove oldest tokens
            const tokensToRemove = platformTokens
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              .slice(0, platformTokens.length - 5);
            
            user.deviceTokens = user.deviceTokens.filter(
              dt => !tokensToRemove.some(tr => tr.token === dt.token)
            );
          }
          
          await user.save();
        }

        return sendSuccess(res, HTTP_STATUS.OK, { 
          registered: true,
          userId: user._id
        });
      }
    }

    // If not authenticated, just acknowledge receipt
    // The token can be linked later when user logs in
    sendSuccess(res, HTTP_STATUS.OK, { 
      registered: true,
      note: 'Token received but not linked to a user. Login to link the token.'
    });

  } catch (err) {
    console.error('Device token registration error:', err);
    errors.internalError(res, 'Failed to register device token', { error: err.message });
  }
});

// DELETE /api/users/device-token - Remove device token
router.delete('/device-token', requireAuth, async (req, res) => {
  try {
    const { deviceToken } = req.body;
    const userId = req.user.id;

    if (!deviceToken) {
      return errors.badRequest(res, 'deviceToken is required');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errors.notFound(res, 'User not found');
    }

    if (user.deviceTokens) {
      user.deviceTokens = user.deviceTokens.filter(dt => dt.token !== deviceToken);
      await user.save();
    }

    sendSuccess(res, HTTP_STATUS.OK, { removed: true });
  } catch (err) {
    console.error('Device token removal error:', err);
    errors.internalError(res, 'Failed to remove device token', { error: err.message });
  }
});

// GET /api/users/app-version - Get minimum required app version
router.get('/app-version', async (req, res) => {
  try {
    const { platform } = req.query;

    // These can be stored in database or environment variables
    const versions = {
      ios: {
        minVersion: process.env.IOS_MIN_VERSION || '1.0.0',
        currentVersion: process.env.IOS_CURRENT_VERSION || '1.0.0',
        forceUpdate: process.env.IOS_FORCE_UPDATE === 'true',
        updateUrl: process.env.IOS_UPDATE_URL || 'https://apps.apple.com/app/idXXXXXXXXX',
        updateMessage: process.env.IOS_UPDATE_MESSAGE || '发现新版本，请更新以获得最佳体验',
      },
      android: {
        minVersion: process.env.ANDROID_MIN_VERSION || '1.0.0',
        currentVersion: process.env.ANDROID_CURRENT_VERSION || '1.0.0',
        forceUpdate: process.env.ANDROID_FORCE_UPDATE === 'true',
        updateUrl: process.env.ANDROID_UPDATE_URL || 'https://play.google.com/store/apps/details?id=com.clingai.app',
        updateMessage: process.env.ANDROID_UPDATE_MESSAGE || '发现新版本，请更新以获得最佳体验',
      }
    };

    if (platform && versions[platform]) {
      return sendSuccess(res, HTTP_STATUS.OK, versions[platform]);
    }

    // Return all platforms if no specific platform requested
    sendSuccess(res, HTTP_STATUS.OK, versions);
  } catch (err) {
    console.error('App version check error:', err);
    errors.internalError(res, 'Failed to get app version info', { error: err.message });
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

// POST /api/users/change-password - Change current user's password
router.post('/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Validation
    if (!oldPassword || !newPassword) {
      return errors.badRequest(res, '请输入旧密码和新密码', { code: 'MISSING_FIELDS' });
    }
    
    if (newPassword.length < 6) {
      return errors.badRequest(res, '新密码至少需要6个字符', { code: 'WEAK_PASSWORD' });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return errors.notFound(res, '用户不存在');
    }
    
    // Verify old password
    if (!user.password) {
      return errors.badRequest(res, '该账号没有设置密码', { code: 'NO_PASSWORD' });
    }
    
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      return errors.badRequest(res, '旧密码不正确', { code: 'INVALID_PASSWORD' });
    }
    
    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    sendSuccess(res, HTTP_STATUS.OK, { message: '密码修改成功' });
  } catch (err) {
    console.error('Change password error:', err);
    errors.internalError(res, err.message || '修改密码失败', { error: err.message });
  }
});

// POST /api/users/create-admin - Create a new admin user (Admin only)
router.post('/create-admin', requireAdmin, async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Validation
    if (!username || !password) {
      return errors.badRequest(res, '用户名和密码为必填项', { code: 'MISSING_FIELDS' });
    }
    
    if (password.length < 6) {
      return errors.badRequest(res, '密码至少需要6个字符', { code: 'WEAK_PASSWORD' });
    }
    
    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return errors.badRequest(res, '用户名已存在', { code: 'USERNAME_EXISTS' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create admin user
    const admin = await User.create({
      username,
      password: hashedPassword,
      email: email || `${username}@ai-host.com`,
      role: 'admin',
      userType: 'operator',
      platform: 'admin'
    });
    
    // Initialize wallet
    await walletService.getBalance(admin._id.toString());
    
    // Don't send password
    const adminObj = admin.toObject();
    delete adminObj.password;
    
    sendSuccess(res, HTTP_STATUS.CREATED, adminObj);
  } catch (err) {
    console.error('Create admin error:', err);
    errors.badRequest(res, err.message || '创建管理员失败');
  }
});

// GET /api/users/admins - List all admin users (Admin only)
router.get('/admins', requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password').sort({ createdAt: -1 });
    sendSuccess(res, HTTP_STATUS.OK, admins);
  } catch (err) {
    console.error('Get admins error:', err);
    errors.internalError(res, err.message || '获取管理员列表失败');
  }
});

// DELETE /api/users/admins/:id - Delete an admin user (Admin only, cannot delete self)
router.delete('/admins/:id', requireAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.user.id;
    
    // Cannot delete yourself
    if (targetId === currentUserId) {
      return errors.badRequest(res, '不能删除自己的账号', { code: 'CANNOT_DELETE_SELF' });
    }
    
    const admin = await User.findOne({ _id: targetId, role: 'admin' });
    if (!admin) {
      return errors.notFound(res, '管理员不存在');
    }
    
    await admin.deleteOne();
    sendSuccess(res, HTTP_STATUS.OK, { message: '管理员已删除' });
  } catch (err) {
    console.error('Delete admin error:', err);
    errors.internalError(res, err.message || '删除管理员失败');
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

