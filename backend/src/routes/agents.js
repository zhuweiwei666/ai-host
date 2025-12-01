const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const { spawn } = require('child_process');
const path = require('path');
const { optionalAuth } = require('../middleware/auth');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// GET /api/agents - Public access (no auth required)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { status, style } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }
    if (style && style !== 'all') {
      query.style = style;
    }
    const agents = await Agent.find(query).sort({ createdAt: -1 });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/agents/:id - Public access (no auth required)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/agents - Create agent (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const agent = new Agent(req.body);
  try {
    const newAgent = await agent.save();
    res.status(201).json(newAgent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/agents/:id - Update agent (Admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const { updateGlobalCore, ...updateData } = req.body;

    // Handle global update for corePrompt
    if (updateGlobalCore && updateData.corePrompt && agent.modelName) {
      // Update all agents with the same model name
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

    Object.assign(agent, updateData);
    const updatedAgent = await agent.save();
    res.json(updatedAgent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/agents/:id - Delete agent (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    await agent.deleteOne();
    res.json({ message: 'Agent deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/agents/scrape - Scrape agents (Admin only)
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

    res.json({ message: 'Scraping started in background. Check logs or refresh agent list in a few minutes.' });

  } catch (err) {
    console.error('Scrape API Error:', err);
    res.status(500).json({ message: 'Failed to start scraper' });
  }
});

module.exports = router;
