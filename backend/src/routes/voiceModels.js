const express = require('express');
const VoiceModel = require('../models/VoiceModel');
const FishAudioApi = require('../services/fishAudioApi');
const { fetchVoiceTemplateMetadata } = require('../services/voiceTemplateScraper');
const fishAudioService = require('../services/fishAudioService'); // For generating audio

const router = express.Router();

const mapRemoteModel = (model) => ({
  remoteId: model._id,
  title: model.title,
  description: model.description,
  coverImage: model.cover_image,
  type: model.type,
  trainMode: model.train_mode,
  languages: model.languages || [],
  tags: model.tags || [],
  visibility: model.visibility,
  state: model.state,
  likeCount: model.like_count || 0,
  markCount: model.mark_count || 0,
  sharedCount: model.shared_count || 0,
  taskCount: model.task_count || 0,
  author: model.author
    ? {
        id: model.author._id,
        nickname: model.author.nickname,
        avatar: model.author.avatar,
      }
    : undefined,
});

router.post('/sync', async (req, res) => {
  try {
    const fishApi = new FishAudioApi();
    const limitFromQuery = parseInt(req.query.limit, 10);
    const defaultLimit = parseInt(process.env.FISH_AUDIO_SYNC_LIMIT || '200', 10);
    const limit = Number.isNaN(limitFromQuery) ? defaultLimit : limitFromQuery;
    const safeLimit = Math.min(Math.max(limit || 200, 50), 1000); // between 50 and 1000

    const { items, fetched, remoteTotal, truncated } = await fishApi.fetchAllModels({
      pageSize: parseInt(req.query.pageSize, 10) || 100,
      limit: safeLimit,
      sortBy: req.query.sortBy,
    });

    if (!items.length) {
      return res.json({ fetched: 0, upserted: 0, remoteTotal: remoteTotal || 0, truncated });
    }

    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { remoteId: item._id },
        update: {
          $set: mapRemoteModel(item),
          $setOnInsert: { isFavorite: false },
        },
        upsert: true,
      },
    }));

    const result = await VoiceModel.bulkWrite(bulkOps);
    const upserted = result.upsertedCount || 0;
    res.json({
      fetched,
      remoteTotal: remoteTotal ?? fetched,
      upserted,
      modified: result.modifiedCount || 0,
      truncated,
      limit: safeLimit,
    });
  } catch (error) {
    console.error('Sync voice models failed:', error.message);
    res.status(500).json({ message: error.message || '同步模型失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { favoriteOnly } = req.query;
    const filter = favoriteOnly === 'true' ? { isFavorite: true } : {};
    const models = await VoiceModel.find(filter).sort({ isFavorite: -1, updatedAt: -1 });
    res.json(models);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/extract', async (req, res) => {
  const { sourceUrl } = req.body;
  if (!sourceUrl) return res.status(400).json({ message: 'URL required' });
  
  try {
    const metadata = await fetchVoiceTemplateMetadata(sourceUrl);
    res.json(metadata);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/create', async (req, res) => { // Distinct from sync-create
    const { remoteId, title, coverImage, description, tags, gender } = req.body;
    
    if (!remoteId || !title) {
        return res.status(400).json({ message: 'ID and Title are required' });
    }

    try {
        const existing = await VoiceModel.findOne({ remoteId });
        if (existing) {
            // Update existing? Or just return?
            // If user manually adds, maybe update title/image?
            existing.title = title;
            if (coverImage) existing.coverImage = coverImage;
            if (description) existing.description = description;
            if (tags) existing.tags = tags;
            if (gender) existing.gender = gender;
            existing.isFavorite = true;
            await existing.save();
            return res.json(existing);
        }

        const newModel = await VoiceModel.create({
            remoteId,
            title,
            description,
            coverImage,
            tags: tags || ['imported'],
            gender: gender || '',
            isFavorite: true
        });
        res.status(201).json(newModel);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/:id/preview', async (req, res) => {
  try {
    const model = await VoiceModel.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ message: '语音模型不存在' });
    }

    if (model.previewAudioUrl) {
      return res.json({ url: model.previewAudioUrl, cached: true });
    }

    // Generate preview audio
    const previewText = 'Hello, this is a preview of my voice.';
    const audioUrl = await fishAudioService.generateAudio(previewText, model.remoteId);
    
    if (audioUrl) {
      model.previewAudioUrl = audioUrl;
      await model.save();
      res.json({ url: audioUrl, cached: false });
    } else {
      res.status(500).json({ message: 'Failed to generate preview audio' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs array required' });
    }
    
    const result = await VoiceModel.deleteMany({ _id: { $in: ids } });
    res.json({ message: `Deleted ${result.deletedCount} models` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const model = await VoiceModel.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ message: '语音模型不存在' });
    }
    await model.deleteOne();
    res.json({ message: '语音模型已删除' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/favorite', async (req, res) => {
  const { isFavorite } = req.body;
  if (typeof isFavorite !== 'boolean') {
    return res.status(400).json({ message: 'isFavorite 必须是布尔值' });
  }

  try {
    const model = await VoiceModel.findByIdAndUpdate(
      req.params.id,
      { isFavorite },
      { new: true }
    );
    if (!model) {
      return res.status(404).json({ message: '语音模型不存在' });
    }
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const model = await VoiceModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!model) {
      return res.status(404).json({ message: '语音模型不存在' });
    }
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
