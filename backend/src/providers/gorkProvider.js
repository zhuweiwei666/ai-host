const axios = require('axios');

class GorkProvider {
  constructor() {
    // Backward/typo compatible:
    // - historical env used in this repo: GORK_API_KEY (typo)
    // - expected name: GROK_API_KEY
    // - some deployments use XAI_API_KEY
    this.apiKey = process.env.GROK_API_KEY || process.env.GORK_API_KEY || process.env.XAI_API_KEY;
    // Using xAI API endpoint (key format xai-* suggests xAI API)
    this.apiUrl = process.env.GROK_API_URL || process.env.GORK_API_URL || 'https://api.x.ai/v1/chat/completions';
  }

  async chat(modelName, messages, temperature, options = {}) {
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY is not set (also supports GORK_API_KEY/XAI_API_KEY)');
    }

    // Model name mapping: if GORK_MODEL_MAP is set in env, use it for custom mappings
    // Otherwise, use the model name directly (frontend now uses grok-* model names)
    const modelMap = process.env.GORK_MODEL_MAP ? JSON.parse(process.env.GORK_MODEL_MAP) : {};
    const actualModelName = modelMap[modelName] || modelName;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const payload = {
      model: actualModelName,
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
      const errorData = error.response?.data || {};
      const errorMessage = errorData.error?.message || error.message || 'Unknown error';
      const errorCode = error.response?.status || errorData.error?.code;
      
      console.error('Gork API Error:', {
        status: error.response?.status,
        code: errorCode,
        message: errorMessage,
        data: errorData
      });
      
      // Provide more specific error messages
      if (errorCode === 401 || errorMessage.includes('Invalid API key') || errorMessage.includes('Unauthorized')) {
        throw new Error(`Grok API authentication failed. Please check GROK_API_KEY (or GORK_API_KEY/XAI_API_KEY). Error: ${errorMessage}`);
      } else if (errorCode === 429) {
        throw new Error('Gork API rate limit exceeded. Please try again later.');
      } else if (errorCode === 402) {
        throw new Error('Gork API payment required. Please check your account balance.');
      } else {
        throw new Error(`Gork API error (${errorCode || 'unknown'}): ${errorMessage}`);
      }
    }
  }
}

module.exports = GorkProvider;

