const axios = require('axios');

class GroqProvider {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async chat(modelName, messages, temperature, options = {}) {
    if (!this.apiKey) throw new Error('Groq API Key not set');
    
    // Map generic names if necessary, but assuming modelName is valid for Groq (e.g. llama-3-70b-8192)
    // Here we assume the frontend passes the correct ID or we map it.
    // For simplicity, passing modelName directly (user should select valid IDs like 'llama3-70b-8192')
    
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: modelName,
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
      console.error('Groq API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch response from Groq');
    }
  }
}

module.exports = GroqProvider;

