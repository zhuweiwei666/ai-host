/**
 * Centralized Cost Estimation for AI Services
 * Prices are estimates in USD
 */
class CostCalculator {
    constructor() {
      this.rates = {
        llm: {
          // OpenRouter / DeepSeek / Groq pricing (per 1M tokens)
          // Default fallback
          'default': { input: 0.5, output: 1.5 },
          
          // Specific Models
          'sao10k/l3.1-euryale-70b': { input: 0.7, output: 0.8 }, // Est. OpenRouter 70B
          'deepseek-chat': { input: 0.14, output: 0.28 }, // DeepSeek V3 is very cheap
          'deepseek-coder': { input: 0.14, output: 0.28 },
          'gpt-4o': { input: 2.5, output: 10.0 },
          'gpt-4o-mini': { input: 0.15, output: 0.6 },
          'llama3-70b-8192': { input: 0.59, output: 0.79 } // Groq ~
        },
        tts: {
          // Per 1M characters
          'fish-audio': 15.00, // Est. standard high-quality TTS
          'openai-tts': 15.00,
          'default': 15.00
        },
        image: {
          // Per Image
          'flux/schnell': 0.003, // Fal.ai Schnell is ~ $0.001-$0.005
          'flux/dev': 0.03,     // Fal.ai Dev is ~ $0.025-$0.05
          'dall-e-3': 0.04,
          'default': 0.04
        },
        video: {
          // Per Generation
          'kling': 0.10, // Est.
          'luma': 0.10,
          'default': 0.10
        }
      };
    }
  
    /**
     * Calculate cost for LLM
     * @param {string} model 
     * @param {number} inputTokens 
     * @param {number} outputTokens 
     */
    calculateLLM(model, inputTokens, outputTokens) {
      const rate = this.rates.llm[model] || this.rates.llm['default'];
      const inputCost = (inputTokens / 1000000) * rate.input;
      const outputCost = (outputTokens / 1000000) * rate.output;
      return inputCost + outputCost;
    }
  
    /**
     * Calculate cost for TTS
     * @param {string} model 
     * @param {number} charCount 
     */
    calculateTTS(model, charCount) {
      const ratePerMillion = this.rates.tts[model] || this.rates.tts['default'];
      return (charCount / 1000000) * ratePerMillion;
    }
  
    /**
     * Calculate cost for Image
     * @param {string} model 
     * @param {number} count 
     */
    calculateImage(model, count = 1) {
      const rate = this.rates.image[model] || this.rates.image['default'];
      return count * rate;
    }
  
    /**
     * Calculate cost for Video
     * @param {string} model 
     * @param {number} count 
     */
    calculateVideo(model, count = 1) {
      const rate = this.rates.video[model] || this.rates.video['default'];
      return count * rate;
    }
  }
  
  module.exports = new CostCalculator();
  
