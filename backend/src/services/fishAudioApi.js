const axios = require('axios');

class FishAudioApi {
  constructor() {
    this.baseURL = process.env.FISH_AUDIO_API_BASE_URL || 'https://api.fish.audio';
    this.apiToken = process.env.FISH_AUDIO_API_TOKEN;
  }

  get client() {
    if (!this.apiToken) {
      throw new Error('FISH_AUDIO_API_TOKEN 未配置，无法调用 Fish Audio API');
    }

    if (!this._client) {
      this._client = axios.create({
        baseURL: this.baseURL,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });
    }
    return this._client;
  }

  async listModels(params = {}) {
    const response = await this.client.get('/model', { params });
    return response.data;
  }

  async fetchAllModels(options = {}) {
    const pageSize = options.pageSize || 100;
    const limit = options.limit || 200;
    const maxPages = options.maxPages || Math.ceil(limit / pageSize);

    let page = 1;
    let totalFetched = 0;
    let remoteTotal = null;
    const allItems = [];

    while (page <= maxPages) {
      const data = await this.listModels({ page_size: pageSize, page_number: page, sort_by: options.sortBy || 'score' });
      if (remoteTotal === null && typeof data.total === 'number') {
        remoteTotal = data.total;
      }

      const items = data.items || [];
      allItems.push(...items);
      totalFetched += items.length;

      if (items.length === 0 || totalFetched >= limit) {
        break;
      }

      page += 1;
    }

    return {
      items: allItems,
      fetched: totalFetched,
      remoteTotal,
      truncated: remoteTotal ? totalFetched < remoteTotal : false,
    };
  }
}

module.exports = FishAudioApi;


