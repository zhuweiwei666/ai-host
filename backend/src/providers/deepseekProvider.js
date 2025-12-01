const axios = require('axios');

class DeepSeekProvider {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.apiUrl = 'https://api.deepseek.com/chat/completions';
  }

  async chat(modelName, messages, temperature, options = {}) {
    if (!this.apiKey) throw new Error('DeepSeek API Key not set');
    
    // modelName should be 'deepseek-chat' or 'deepseek-coder'
    
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: modelName === 'chat' ? 'deepseek-chat' : modelName, 
          messages: messages,
          temperature: temperature,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
      return {
        content: response.data.choices[0].message.content,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('DeepSeek API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch response from DeepSeek');
    }
  }
}

module.exports = DeepSeekProvider;

