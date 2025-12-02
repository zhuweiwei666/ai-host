const OpenAIProvider = require('./openaiProvider');
const GroqProvider = require('./groqProvider');
const DeepSeekProvider = require('./deepseekProvider');
const OpenRouterProvider = require('./openRouterProvider');
const GorkProvider = require('./gorkProvider');

class ProviderFactory {
  static getProvider(modelName) {
    if (modelName.startsWith('gpt-')) {
      return new OpenAIProvider();
    } else if (modelName.includes('llama') || modelName.includes('mixtral') || modelName.includes('gemma')) {
      // Groq often hosts open models like llama3
      return new GroqProvider();
    } else if (modelName.includes('deepseek')) {
      return new DeepSeekProvider();
    } else if (modelName.includes('sao10k')) {
      // sao10k models now use Gork API instead of OpenRouter
      return new GorkProvider();
    } else if (
      modelName.includes('openrouter') ||
      (modelName.includes('/') && !modelName.includes('sao10k'))
    ) {
      // Other OpenRouter models (not sao10k)
      return new OpenRouterProvider();
    } else if (modelName.includes('claude')) {
       // Placeholder for Anthropic, using OpenAI interface as fallback or error if not implemented
       throw new Error('Anthropic provider not implemented yet');
    } else if (modelName.includes('moonshot')) {
       // Placeholder for Moonshot
       throw new Error('Moonshot provider not implemented yet');
    }
    
    // Default fallback logic or error
    // For the purpose of this demo, if unrecognized, try OpenAI (e.g. for testing)
    // or throw error.
    throw new Error(`No provider found for model: ${modelName}`);
  }
}

module.exports = ProviderFactory;

