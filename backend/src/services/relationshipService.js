const Relationship = require('../models/Relationship');

class RelationshipService {
  async updateIntimacy(userId, agentId, amount) {
    try {
      const rel = await Relationship.findOneAndUpdate(
        { userId, agentId },
        { $inc: { intimacy: amount }, $set: { lastInteraction: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return rel.intimacy;
    } catch (e) {
      console.error('Failed to update intimacy:', e);
      return 0;
    }
  }

  async getIntimacy(userId, agentId) {
    try {
      const rel = await Relationship.findOne({ userId, agentId });
      return rel ? rel.intimacy : 0;
    } catch (e) {
      console.error('Failed to get intimacy:', e);
      return 0;
    }
  }
}

module.exports = new RelationshipService();

