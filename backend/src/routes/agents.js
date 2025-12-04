const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Agent = require('../models/Agent');
const { spawn } = require('child_process');
const path = require('path');
const { optionalAuth } = require('../middleware/auth');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { errors, sendSuccess, HTTP_STATUS } = require('../utils/errorHandler');

// Helper function to check MongoDB connection
const checkDBConnection = () => {
  const state = mongoose.connection.readyState;
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  if (state !== 1) {
    const stateName = stateMap[state] || 'unknown';
    throw new Error(`MongoDB not connected. Current state: ${state} (${stateName}). Please check MONGO_URI and ensure MongoDB service is running.`);
  }
};

// GET /api/agents - Public access (no auth required)
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Check MongoDB connection before query
    checkDBConnection();
    
    const { status, style } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }
    if (style && style !== 'all') {
      // Handle default value: if style is 'realistic', also include records with undefined/null style
      // (since Mongoose default is 'realistic' but doesn't apply to existing documents)
      if (style === 'realistic') {
        query.$or = [
          { style: 'realistic' },
          { style: { $exists: false } },
          { style: null }
        ];
      } else {
      query.style = style;
      }
    }
    const agents = await Agent.find(query).sort({ createdAt: -1 });
    const { sendSuccess } = require('../utils/errorHandler');
    sendSuccess(res, 200, agents);
  } catch (err) {
    console.error('[GET /agents] Error:', err);
    console.error('[GET /agents] Error stack:', err.stack);
    
    // Return more detailed error in development, simpler message in production
    const isDev = process.env.NODE_ENV === 'development';
    errors.internalError(res, err.message || 'Failed to fetch agents', { 
      error: err.message,
      code: err.code || 'INTERNAL_ERROR',
      stack: isDev ? err.stack : undefined,
      connectionState: isDev ? mongoose.connection.readyState : undefined
    });
  }
});

// POST /api/agents/scrape - Scrape agents (Admin only) - Must be before /:id route
router.post('/scrape', requireAuth, requireAdmin, async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '../services/candyScraper.js');
    console.log('Spawning scraper:', scriptPath);
    
    const scraper = spawn('node', [scriptPath]);

    scraper.stdout.on('data', (data) => {
      console.log(`[Scraper]: ${data}`);
    });

    scraper.stderr.on('data', (data) => {
      console.error(`[Scraper Error]: ${data}`);
    });

    scraper.on('close', (code) => {
      console.log(`[Scraper] Process exited with code ${code}`);
    });

    sendSuccess(res, HTTP_STATUS.OK, { message: 'Scraping started in background. Check logs or refresh agent list in a few minutes.' });

  } catch (err) {
    console.error('Scrape API Error:', err);
    errors.internalError(res, 'Failed to start scraper', { error: err.message });
  }
});

// POST /api/agents - Create agent (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Debug: 打印接收到的数组数据
    console.log('[POST /agents] Received arrays:', {
      avatarUrls: req.body.avatarUrls,
      coverVideoUrls: req.body.coverVideoUrls,
      privatePhotoUrls: req.body.privatePhotoUrls,
      avatarUrlsLength: req.body.avatarUrls?.length,
      coverVideoUrlsLength: req.body.coverVideoUrls?.length,
    });

    const agent = new Agent(req.body);
    const newAgent = await agent.save();
    
    // Debug: 打印保存后的数组数据
    console.log('[POST /agents] Saved arrays:', {
      avatarUrls: newAgent.avatarUrls,
      coverVideoUrls: newAgent.coverVideoUrls,
      avatarUrlsLength: newAgent.avatarUrls?.length,
      coverVideoUrlsLength: newAgent.coverVideoUrls?.length,
    });
    
    sendSuccess(res, HTTP_STATUS.CREATED, newAgent);
  } catch (err) {
    console.error('[POST /agents] Error:', err);
    errors.badRequest(res, err.message);
  }
});

// POST /api/agents/:id/duplicate - Duplicate agent (Admin only) - Must be before /:id route
router.post('/:id/duplicate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return errors.notFound(res, 'Agent not found');

    // Create a copy of the agent
    const agentData = agent.toObject();
    delete agentData._id;
    delete agentData.createdAt;
    delete agentData.updatedAt;
    
    // Add " (副本)" suffix to the name
    agentData.name = `${agentData.name} (副本)`;

    const duplicatedAgent = new Agent(agentData);
    const newAgent = await duplicatedAgent.save();
    sendSuccess(res, HTTP_STATUS.CREATED, newAgent);
  } catch (err) {
    console.error('[POST /agents/:id/duplicate] Error:', err);
    errors.internalError(res, err.message || 'Failed to duplicate agent', { error: err.message });
  }
});

// PUT /api/agents/:id - Update agent (Admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return errors.notFound(res, 'Agent not found');

    const { updateGlobalCore, ...updateData } = req.body;

    // Debug: 打印接收到的数组数据
    console.log('[PUT /agents/:id] Received arrays:', {
      avatarUrls: updateData.avatarUrls,
      coverVideoUrls: updateData.coverVideoUrls,
      privatePhotoUrls: updateData.privatePhotoUrls,
      avatarUrlsLength: updateData.avatarUrls?.length,
      coverVideoUrlsLength: updateData.coverVideoUrls?.length,
    });

    // Handle global update for corePrompt
    if (updateGlobalCore && updateData.corePrompt && agent.modelName) {
      await Agent.updateMany(
        { modelName: agent.modelName },
        { $set: { 
            corePrompt: updateData.corePrompt,
            stage1Prompt: updateData.stage1Prompt,
            stage2Prompt: updateData.stage2Prompt,
            stage3Prompt: updateData.stage3Prompt
          } 
        }
      );
    }

    // 确保数组字段正确更新，并使用 markModified 通知 Mongoose
    if (updateData.avatarUrls !== undefined) {
      agent.avatarUrls = updateData.avatarUrls;
      agent.markModified('avatarUrls');
    }
    if (updateData.coverVideoUrls !== undefined) {
      agent.coverVideoUrls = updateData.coverVideoUrls;
      agent.markModified('coverVideoUrls');
    }
    if (updateData.privatePhotoUrls !== undefined) {
      agent.privatePhotoUrls = updateData.privatePhotoUrls;
      agent.markModified('privatePhotoUrls');
    }

    // 更新其他字段（排除数组字段避免覆盖）
    const { avatarUrls, coverVideoUrls, privatePhotoUrls, ...otherData } = updateData;
    Object.assign(agent, otherData);
    
    const updatedAgent = await agent.save();
    
    // Debug: 打印保存后的数组数据
    console.log('[PUT /agents/:id] Saved arrays:', {
      avatarUrls: updatedAgent.avatarUrls,
      coverVideoUrls: updatedAgent.coverVideoUrls,
      avatarUrlsLength: updatedAgent.avatarUrls?.length,
      coverVideoUrlsLength: updatedAgent.coverVideoUrls?.length,
    });
    
    sendSuccess(res, HTTP_STATUS.OK, updatedAgent);
  } catch (err) {
    console.error('[PUT /agents/:id] Error:', err);
    errors.badRequest(res, err.message);
  }
});

// DELETE /api/agents/:id - Delete agent (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return errors.notFound(res, 'Agent not found');

    await agent.deleteOne();
    sendSuccess(res, 200, null, 'Agent deleted');
  } catch (err) {
    errors.internalError(res, err.message || 'Operation failed', { error: err.message });
  }
});

// GET /api/agents/:id - Public access (no auth required) - Must be after /scrape route
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // Check MongoDB connection before query
    checkDBConnection();
    
    const agent = await Agent.findById(req.params.id);
    if (!agent) return errors.notFound(res, 'Agent not found');
    
    // Debug: 打印从数据库读取的数组数据
    console.log('[GET /agents/:id] Retrieved arrays:', {
      avatarUrls: agent.avatarUrls,
      coverVideoUrls: agent.coverVideoUrls,
      avatarUrlsLength: agent.avatarUrls?.length,
      coverVideoUrlsLength: agent.coverVideoUrls?.length,
    });
    
    sendSuccess(res, HTTP_STATUS.OK, agent);
  } catch (err) {
    console.error('[GET /agents/:id] Error:', err);
    const isDev = process.env.NODE_ENV === 'development';
    errors.internalError(res, err.message || 'Failed to fetch agent', { 
      error: err.message,
      stack: isDev ? err.stack : undefined
    });
  }
});

module.exports = router;
