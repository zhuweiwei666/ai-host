const OpenAIProvider = require('./openaiProvider');
const GroqProvider = require('./groqProvider');
const DeepSeekProvider = require('./deepseekProvider');
const OpenRouterProvider = require('./openRouterProvider');
const GorkProvider = require('./gorkProvider');

class ProviderFactory {
  static getProvider(modelName) {
    // Gork models (grok-*)
    if (modelName.startsWith('grok-') || modelName.includes('gork')) {
      return new GorkProvider();
    }
    // Legacy sao10k models also use Gork
    else if (modelName.includes('sao10k')) {
      return new GorkProvider();
    }
    // OpenAI models
    else if (modelName.startsWith('gpt-')) {
      return new OpenAIProvider();
    }
    // Groq models
    else if (modelName.includes('llama') || modelName.includes('mixtral') || modelName.includes('gemma')) {
      return new GroqProvider();
    }
    // DeepSeek models
    else if (modelName.includes('deepseek')) {
      return new DeepSeekProvider();
    }
    // OpenRouter models (fallback for other models)
    else if (modelName.includes('openrouter') || modelName.includes('/')) {
      return new OpenRouterProvider();
    }
    // Unsupported models
    else if (modelName.includes('claude')) {
       throw new Error('Anthropic provider not implemented yet');
    } else if (modelName.includes('moonshot')) {
       throw new Error('Moonshot provider not implemented yet');
    }
    
    // Default: throw error for unrecognized models
    throw new Error(`No provider found for model: ${modelName}`);
  }
}

module.exports = ProviderFactory;

