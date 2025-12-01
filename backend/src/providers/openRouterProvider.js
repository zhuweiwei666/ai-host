const axios = require('axios');

class OpenRouterProvider {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    // Optional headers recommended by OpenRouter to show app info.
    this.referer = process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_DOMAIN || 'http://localhost:5173';
    this.appName = process.env.OPENROUTER_APP_NAME || 'AI Host Admin';
  }

  async chat(modelName, messages, temperature, options = {}) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.referer) {
      headers['HTTP-Referer'] = this.referer;
    }
    if (this.appName) {
      headers['X-Title'] = this.appName;
    }

    const payload = {
      model: modelName,
      messages,
      temperature,
    };

    if (options.maxTokens) {
      payload.max_tokens = options.maxTokens;
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        payload,
        { headers }
      );

      return {
        content: response.data.choices?.[0]?.message?.content || '',
        usage: response.data.usage
      };
    } catch (error) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch response from OpenRouter');
    }
  }
}

module.exports = OpenRouterProvider;


