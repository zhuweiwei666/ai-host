/**
 * Centralized Cost Estimation for AI Services
 * Prices are estimates in USD
 */
class CostCalculator {
    constructor() {
      this.rates = {
        llm: {
          // Gork (xAI) pricing (per 1M tokens)
          // Default fallback
          'default': { input: 0.5, output: 1.5 },
          
          // Gork Models (xAI) - Official pricing from xAI
          'grok-4-1-fast-reasoning': { input: 0.20, output: 0.50 },
          'grok-4-1-fast-non-reasoning': { input: 0.20, output: 0.50 },
          'grok-code-fast-1': { input: 0.20, output: 1.50 },
          'grok-4-fast-reasoning': { input: 0.20, output: 0.50 },
          'grok-4-fast-non-reasoning': { input: 0.20, output: 0.50 },
          'grok-4-0709': { input: 3.00, output: 15.00 },
          'grok-3-mini': { input: 0.30, output: 0.50 },
          'grok-3': { input: 3.00, output: 15.00 },
          'grok-2-vision-1212': { input: 2.00, output: 10.00 },
          'grok-2-1212': { input: 2.00, output: 10.00 },
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
  
