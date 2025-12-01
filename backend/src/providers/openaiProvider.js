const axios = require('axios');

class OpenAIProvider {
  constructor() {
    // 优先读取 AIHUBMIX 的配置，如果没有则回退到官方配置
    this.apiKey = process.env.AIHUBMIX_API_KEY || process.env.OPENAI_API_KEY;
    
    // Base URL 处理：
    // 1. 如果有 AIHUBMIX_BASE_URL，就用它（注意去掉末尾斜杠）
    // 2. 否则用官方地址
    const baseUrl = process.env.AIHUBMIX_BASE_URL || 'https://api.openai.com/v1';
    this.apiUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  async chat(modelName, messages, temperature, options = {}) {
    if (!this.apiKey) throw new Error('API Key not set (AIHUBMIX_API_KEY or OPENAI_API_KEY)');
    
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          // 如果是中转商，通常兼容 gpt-4o-mini 等模型名
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
        usage: response.data.usage // { prompt_tokens, completion_tokens, total_tokens }
      };
    } catch (error) {
      console.error('LLM API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch response from LLM provider');
    }
  }
}

module.exports = OpenAIProvider;

