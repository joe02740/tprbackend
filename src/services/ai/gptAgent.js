/**
 * GPTAgent - Node.js port with Azure OpenAI GPT-5 support
 * Matches the Python implementation with Azure OpenAI and legacy fallback
 */

const logger = require('../../utils/logger');

class GPTAgent {
  constructor(apiKey = null, model = 'gpt-4') {
    this.model = model;
    this.lastTokenUsage = 0;
    this.useAzure = process.env.USE_AZURE_OPENAI?.toLowerCase() === 'true';
    this.client = null;
    this.deploymentName = null;

    this.initialize(apiKey);
  }

  async initialize(apiKey) {
    try {
      if (this.useAzure) {
        // Azure OpenAI configuration with timeout
        const { OpenAI } = await import('openai');

        this.client = new OpenAI({
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || this.model}`,
          defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview' },
          defaultHeaders: {
            'api-key': process.env.AZURE_OPENAI_API_KEY,
          },
          timeout: parseFloat(process.env.GPT5_TIMEOUT || '180') * 1000 // Convert to milliseconds
        });

        this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || this.model;
        logger.info(`🔥 Initialized Azure OpenAI client with model: ${this.model} (deployment: ${this.deploymentName}) - timeout: 180s`);

      } else {
        // Legacy OpenAI client
        const { OpenAI } = await import('openai');

        this.client = new OpenAI({
          apiKey: apiKey || process.env.OPENAI_API_KEY,
          timeout: 60000 // 60 seconds
        });

        this.deploymentName = this.model;
        logger.info(`📦 Initialized OpenAI client with model: ${this.model}`);
      }

    } catch (error) {
      logger.error(`Error initializing GPT client: ${error.message}`);
      throw error;
    }
  }

  async generateResponse(messages, options = {}) {
    const {
      systemPrompt = null,
      temperature = 0.7,
      maxTokens = 1500,
      enableWebSearch = false,
      webSearchConfig = null,
      reasoningEffort = null,
      verbosity = null,
      ...kwargs
    } = options;

    try {
      const enhancedSystemPrompt = systemPrompt || '';
      const openaiMessages = [];

      // Add system prompt if provided
      if (enhancedSystemPrompt) {
        openaiMessages.push({ role: 'system', content: enhancedSystemPrompt });
      }

      // Process conversation messages
      for (const message of messages) {
        const { role: origRole, content } = message;

        // Skip empty messages and system messages (already handled above)
        if (!content || origRole === 'system') {
          continue;
        }

        // Map roles for OpenAI API
        let apiRole;
        let messageContent = content;

        if (origRole === 'user') {
          apiRole = 'user';
        } else if (origRole === 'gpt') {
          apiRole = 'assistant';
        } else {
          // Other AI agents (claude, gemini) become user messages with identity
          apiRole = 'user';
          messageContent = `${origRole.toUpperCase()}: ${content}`;
        }

        openaiMessages.push({ role: apiRole, content: messageContent });
      }

      logger.debug(`Sending request to GPT with ${openaiMessages.length} messages, system prompt: ${systemPrompt ? systemPrompt.substring(0, 50) : 'None'}`);

      let response;

      // Send request to OpenAI API (Azure or standard)
      if (this.useAzure && this.deploymentName.includes('gpt-5')) {
        // GPT-5-chat (reasoning parameters not yet supported in Node.js SDK)
        const timeout = parseFloat(process.env.GPT5_TIMEOUT || '180');

        const apiParams = {
          model: this.deploymentName, // deployment name like "gpt-5-chat-2"
          messages: openaiMessages,
          temperature: temperature,
          max_tokens: maxTokens,
          top_p: 1.0 // Add top_p like Azure sample
        };

        logger.info(`🧠 GPT-5-chat request: timeout=${timeout}s`);
        response = await this.client.chat.completions.create(apiParams);

      } else if (this.useAzure) {
        // Standard Azure OpenAI
        response = await this.client.chat.completions.create({
          model: this.deploymentName,
          messages: openaiMessages,
          temperature: temperature,
          max_tokens: maxTokens,
          top_p: 1.0
        });

      } else {
        // Legacy OpenAI
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: openaiMessages,
          temperature: temperature,
          max_tokens: maxTokens
        });
      }

      // Extract token usage
      if (response.usage) {
        this.lastTokenUsage = response.usage.total_tokens;
        logger.debug(`GPT token usage: ${this.lastTokenUsage}`);
      } else {
        this.lastTokenUsage = 0;
      }

      const content = response.choices[0].message.content;

      return {
        content: content,
        tokenUsage: this.lastTokenUsage,
        model: this.useAzure ? this.deploymentName : this.model,
        agentType: 'gpt'
      };

    } catch (error) {
      logger.error(`Error generating GPT response: ${error.message}`);
      return {
        content: `GPT Error: ${error.message}`,
        tokenUsage: 0,
        model: this.useAzure ? this.deploymentName : this.model,
        agentType: 'gpt',
        error: true
      };
    }
  }

  getTokenUsage() {
    return this.lastTokenUsage;
  }

  supportsWebSearch() {
    return false; // GPT doesn't have built-in web search (unless using plugins)
  }

  getModelInfo() {
    return {
      modelName: this.useAzure ? this.deploymentName : this.model,
      provider: this.useAzure ? 'azure_openai' : 'openai',
      useAzure: this.useAzure
    };
  }

  getCostEstimate(inputTokens, outputTokens) {
    try {
      // GPT-5 pricing (approximate - adjust based on actual pricing)
      let inputCostPer1k, outputCostPer1k;

      if (this.model.includes('gpt-5')) {
        inputCostPer1k = 0.01;   // $0.01 per 1K input tokens (estimated)
        outputCostPer1k = 0.03;  // $0.03 per 1K output tokens (estimated)
      } else if (this.model.includes('gpt-4')) {
        inputCostPer1k = 0.03;   // GPT-4 pricing
        outputCostPer1k = 0.06;
      } else {
        inputCostPer1k = 0.002;  // GPT-3.5 pricing
        outputCostPer1k = 0.002;
      }

      const inputCost = (inputTokens / 1000) * inputCostPer1k;
      const outputCost = (outputTokens / 1000) * outputCostPer1k;

      return inputCost + outputCost;
    } catch (error) {
      logger.error(`Error calculating cost estimate: ${error.message}`);
      return 0.0;
    }
  }
}

module.exports = GPTAgent;