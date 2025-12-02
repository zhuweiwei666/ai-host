const axios = require('axios');

class GorkProvider {
  constructor() {
    this.apiKey = process.env.GORK_API_KEY;
    // Using xAI API endpoint (key format xai-* suggests xAI API)
    this.apiUrl = process.env.GORK_API_URL || 'https://api.x.ai/v1/chat/completions';
  }

  async chat(modelName, messages, temperature, options = {}) {
    if (!this.apiKey) {
      throw new Error('GORK_API_KEY is not set');
    }

    // Model name mapping: map sao10k models to xAI model names if needed
    // If GORK_MODEL_MAP is set in env, use it; otherwise try to map sao10k models
    const modelMap = process.env.GORK_MODEL_MAP ? JSON.parse(process.env.GORK_MODEL_MAP) : {
      'sao10k/l3.1-euryale-70b': 'grok-beta', // Default mapping, adjust as needed
    };
    
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
        throw new Error(`Gork API authentication failed. Please check GORK_API_KEY. Error: ${errorMessage}`);
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

