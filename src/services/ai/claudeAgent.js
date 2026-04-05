  /**
 * ClaudeAgent - EXACT replica of working Python implementation
 * Uses main Anthropic SDK with Vertex AI configuration
 */

const logger = require('../../utils/logger');

class ClaudeAgent {
  constructor(projectId, location = 'us-east5', model = 'claude-sonnet-4@20250514') {
    this.projectId = projectId;
    this.location = location;
    this.model = model;
    this.lastTokenUsage = 0;
    this.client = null;

    this.initialize();
  }

  async initialize() {
    try {
      // Import Anthropic Vertex SDK - same as Python
      const { AnthropicVertex } = await import('@anthropic-ai/vertex-sdk');

      // Use default Cloud Run service account - don't try to load from file
      // Cloud Run automatically provides credentials via GOOGLE_APPLICATION_CREDENTIALS env var
      // pointing to the default service account

      this.client = new AnthropicVertex({
        region: this.location,
        projectId: this.projectId,
      });

      logger.info(`✅ Initialized Anthropic Vertex client with model: ${this.model}, region: ${this.location}`);
    } catch (error) {
      logger.error(`Error initializing Anthropic Vertex client: ${error.message}`);
      throw error;
    }
  }

  async generateResponse(messages, options = {}) {
    const {
      systemPrompt = null,
      temperature = 0.7,
      maxTokens = 1000,
      enableWebSearch = false,
      webSearchConfig = null,
      ...kwargs
    } = options;

    try {
      const enhancedSystemPrompt = systemPrompt || "You are Claude, a helpful AI assistant.";

      // Convert messages to Anthropic format
      const anthropicMessages = [];

      for (const message of messages) {
        const { role, content } = message;

        if (!content) continue;

        // Map roles to Anthropic format
        if (role === 'user') {
          anthropicMessages.push({
            role: 'user',
            content: content
          });
        } else if (role === 'claude') {
          anthropicMessages.push({
            role: 'assistant',
            content: content
          });
        } else if (['gpt', 'gemini'].includes(role)) {
          // Other AI agents become user messages with identity
          anthropicMessages.push({
            role: 'user',
            content: `[${role.toUpperCase()}]: ${content}`
          });
        }
      }

      logger.debug(`Sending request to Claude Sonnet 4 with ${anthropicMessages.length} messages`);

      // Create message using Anthropic API
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: enhancedSystemPrompt,
        messages: anthropicMessages
      });

      // Extract response text
      if (response && response.content) {
        let responseText = '';
        for (const contentBlock of response.content) {
          if (contentBlock.type === 'text') {
            responseText += contentBlock.text;
          }
        }

        // Extract token usage
        if (response.usage) {
          this.lastTokenUsage = response.usage.input_tokens + response.usage.output_tokens;
        } else {
          this.lastTokenUsage = Math.floor(responseText.length / 4); // Rough estimate
        }

        return {
          content: responseText.trim(),
          tokenUsage: this.lastTokenUsage,
          model: this.model,
          agentType: 'claude'
        };
      } else {
        throw new Error('No response generated');
      }

    } catch (error) {
      logger.error(`Error in Anthropic Vertex Claude call: ${error.message}`);
      return {
        content: `Claude Error: ${error.message}`,
        tokenUsage: 0,
        model: this.model,
        agentType: 'claude',
        error: true
      };
    }
  }

  getTokenUsage() {
    return this.lastTokenUsage;
  }

  getModelInfo() {
    return {
      modelName: this.model,
      projectId: this.projectId,
      location: this.location,
      provider: 'anthropic_vertex'
    };
  }

  supportsWebSearch() {
    return false; // Claude doesn't have built-in web search
  }

  getCostEstimate(inputTokens, outputTokens) {
    try {
      // Claude Sonnet 4 Vertex AI pricing (approximate)
      const inputCostPer1k = 0.015;   // $0.015 per 1K input tokens
      const outputCostPer1k = 0.075;  // $0.075 per 1K output tokens

      const inputCost = (inputTokens / 1000) * inputCostPer1k;
      const outputCost = (outputTokens / 1000) * outputCostPer1k;

      return inputCost + outputCost;
    } catch (error) {
      logger.error(`Error calculating cost estimate: ${error.message}`);
      return 0.0;
    }
  }
}

module.exports = ClaudeAgent;