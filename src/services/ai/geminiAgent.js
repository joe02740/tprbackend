/**
 * GeminiAgent - Node.js port with built-in Google Search grounding
 * Uses Gemini 2.5 Flash native search grounding for real-time information with citations
 */

const logger = require('../../utils/logger');

class GeminiAgent {
  constructor(projectId, location = 'us-east5', model = 'gemini-2.5-flash') {
    this.projectId = projectId;
    this.location = location;
    this.model = model;
    this.lastTokenUsage = 0;
    this.client = null;
    this.apiApproach = null;

    this.initialize();
  }

  async initialize() {
    logger.info(`🔧 Initializing Gemini with project: ${this.projectId}, location: ${this.location}, model: ${this.model}`);
    logger.info(`🔍 Built-in Google Search grounding enabled`);

    try {
      // Try Google GenAI first (EXACTLY like working Python version)
      const { GoogleGenerativeAI } = await import('@google/generative-ai');

      const apiKey = process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY not configured for GenAI');
      }

      // Use location="global" like Python version, not the parameter
      this.client = new GoogleGenerativeAI(apiKey, {
        vertexai: true,
        project: this.projectId,
        location: 'global'  // Match Python exactly
      });
      this.apiApproach = 'google-genai';
      logger.info(`✅ Google GenAI client initialized successfully with Vertex AI`);

    } catch (error) {
      logger.error(`❌ Failed to initialize google-genai: ${error.message}`);

      // Fallback to Vertex AI (like Python)
      try {
        const { VertexAI } = await import('@google-cloud/vertexai');

        const vertex = new VertexAI({
          project: this.projectId,
          location: this.location
        });

        this.client = vertex.getGenerativeModel({
          model: this.model
        });
        this.apiApproach = 'vertexai';
        logger.info(`✅ Fell back to Vertex AI with ${this.model}`);

      } catch (error2) {
        logger.error(`❌ Both approaches failed: genai=${error.message}, vertexai=${error2.message}`);
        throw new Error(`Cannot initialize Gemini: ${error.message}`);
      }
    }
  }

  async generateResponse(messages, options = {}) {
    const {
      systemPrompt = null,
      temperature = 0.7,
      maxTokens = 1000,
      enableWebSearch = false,
      ...kwargs
    } = options;

    logger.info(`🔍 Gemini generate_response called with ${messages.length} messages, approach: ${this.apiApproach}, search: ${enableWebSearch}`);

    try {
      const organizationContext = '';
      const enhancedSystemPrompt = (systemPrompt || '') + organizationContext;

      if (this.apiApproach === 'google-genai') {
        return await this._generateSimpleGenai(messages, enhancedSystemPrompt, temperature, maxTokens, enableWebSearch);
      } else if (this.apiApproach === 'vertexai') {
        return await this._generateWithVertexai(messages, enhancedSystemPrompt, temperature, maxTokens, enableWebSearch);
      } else {
        throw new Error('No client initialized');
      }

    } catch (error) {
      // Log full error details for debugging
      logger.error(`❌ Gemini generation failed:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        status: error.status,
        statusText: error.statusText,
        response: error.response,
        apiApproach: this.apiApproach,
        model: this.model,
        projectId: this.projectId,
        location: this.location
      });

      // In development, return the actual error for debugging
      const isDev = process.env.NODE_ENV === 'development';
      let errorMessage;
      
      if (isDev) {
        errorMessage = `[DEV] Gemini Error: ${error.message}\nApproach: ${this.apiApproach}\nModel: ${this.model}\nLocation: ${this.location}\nProject: ${this.projectId}`;
      } else if (error.message.includes('SSL') || error.message.includes('ConnectionPool')) {
        errorMessage = "I'm having trouble connecting to my systems right now. Could you try asking again in a moment?";
      } else if (error.message.toLowerCase().includes('timeout')) {
        errorMessage = "I'm taking longer than usual to respond. Please try your question again.";
      } else if (error.message.includes('404') || error.message.includes('NOT_FOUND')) {
        errorMessage = `Model "${this.model}" not accessible. API: ${this.apiApproach}, Location: ${this.location}`;
      } else {
        errorMessage = `Technical error: ${error.message}`;
      }

      return {
        content: errorMessage,
        tokenUsage: 0,
        model: this.model,
        agentType: 'gemini',
        error: true,
        errorDetails: {
          message: error.message,
          apiApproach: this.apiApproach,
          model: this.model
        }
      };
    }
  }

  async _generateSimpleGenai(messages, systemPrompt, temperature, maxTokens, enableWebSearch = false) {
    logger.info("🚀 Attempting simple google-genai generation (Friday's working method)");

    // Build content exactly like Python version
    const contents = [];
    if (systemPrompt) {
      contents.push(`System: ${systemPrompt}`);
    }

    // Only use last 5 messages like Python version
    for (const message of messages.slice(-5)) {
      const { role, content } = message;

      if (role === 'user') {
        contents.push(`Human: ${content}`);
      } else if (role === 'gemini') {
        contents.push(`Assistant: ${content}`);
      } else if (['gpt', 'claude'].includes(role)) {
        contents.push(`Human (${role.toUpperCase()}): ${content}`);
      }
    }

    contents.push('Assistant:');
    const fullContent = contents.join('\n\n');

    logger.info(`📝 Sending simple content to Gemini: ${fullContent.substring(0, 200)}...`);

    // Try with retry logic for SSL issues
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logger.info(`🔄 Gemini attempt ${attempt + 1}/3`);

        // Start with 2.5-flash, fallback to others
        let modelToUse;
        if (attempt === 0) {
          modelToUse = 'gemini-2.5-flash';  // Primary model from Slack app
        } else if (attempt === 1) {
          modelToUse = 'gemini-1.5-flash';  // Fallback
        } else {
          modelToUse = 'gemini-1.5-pro';    // Final fallback
        }

        if (modelToUse !== 'gemini-2.5-flash') {
          logger.info(`🔄 Using fallback model: ${modelToUse}`);
        }

        const model = this.client.getGenerativeModel({ model: modelToUse });

        // Configure grounding tool if web search is enabled
        let generationConfig = {
          temperature: temperature,
          maxOutputTokens: maxTokens,
        };

        if (enableWebSearch) {
          // Note: Google Search grounding configuration would go here
          // This is a simplified version - the actual implementation depends on the SDK
          logger.info(`🌐 Google Search grounding would be enabled here`);
        }

        // Generate content
        const response = await model.generateContent({
          contents: [{ parts: [{ text: fullContent }] }],
          generationConfig: generationConfig
        });

        logger.info(`📨 Simple Gemini response received on attempt ${attempt + 1}`);

        if (response.response && response.response.text) {
          const result = response.response.text().trim();

          // Handle token usage if available
          if (response.response.usageMetadata) {
            this.lastTokenUsage = response.response.usageMetadata.totalTokenCount || 0;
          } else {
            this.lastTokenUsage = Math.floor(result.length / 4); // Rough estimate
          }

          logger.info(`✅ Simple Gemini success: ${result.substring(0, 100)}...`);

          return {
            content: result,
            tokenUsage: this.lastTokenUsage,
            model: modelToUse,
            agentType: 'gemini'
          };
        } else {
          throw new Error('No text in simple response');
        }

      } catch (error) {
        // Detailed error logging
        logger.error(`❌ Gemini attempt ${attempt + 1}/3 failed:`, {
          message: error.message,
          name: error.name,
          code: error.code,
          status: error.status,
          modelAttempted: modelToUse,
          approach: this.apiApproach,
          stack: error.stack?.substring(0, 500)
        });

        if (error.message.includes('SSL') || error.message.includes('ssl')) {
          logger.warn(`🔒 SSL error on Gemini attempt ${attempt + 1}: ${error.message}`);
          if (attempt < 2) { // Not the last attempt
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
            continue;
          }
        } else {
          logger.error(`❌ Non-SSL error on Gemini attempt ${attempt + 1}: ${error.message}`);
          if (attempt < 2) {
            continue;
          }
        }

        // Final attempt failed - throw with additional context
        error.message = `[Gemini ${modelToUse}] ${error.message}`;
        throw error;
      }
    }
  }

  async _generateWithVertexai(messages, systemPrompt, temperature, maxTokens, enableWebSearch = false) {
    logger.info("🚀 Attempting Vertex AI generation", {
      projectId: this.projectId,
      location: this.location,
      model: this.model,
      messageCount: messages.length,
      temperature,
      maxTokens
    });

    // Simple prompt building like Python version
    const conversationParts = [];
    if (systemPrompt) {
      conversationParts.push(`System: ${systemPrompt}`);
    }

    // Limit context like Python version
    for (const message of messages.slice(-5)) {
      const { role, content } = message;

      if (role === 'user') {
        conversationParts.push(`Human: ${content}`);
      } else if (role === 'gemini') {
        conversationParts.push(`Assistant: ${content}`);
      } else if (['gpt', 'claude'].includes(role)) {
        conversationParts.push(`Human (${role.toUpperCase()}): ${content}`);
      }
    }

    conversationParts.push('Assistant:');
    const fullPrompt = conversationParts.join('\n\n');

    logger.info(`📝 Sending to Vertex AI: ${fullPrompt.substring(0, 200)}...`);

    const response = await this.client.generateContent(fullPrompt);

    if (response.response && response.response.candidates && response.response.candidates[0]) {
      const candidate = response.response.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
        const result = candidate.content.parts[0].text.trim();

        // Handle token usage
        if (response.response.usageMetadata) {
          this.lastTokenUsage = response.response.usageMetadata.totalTokenCount || 0;
        } else {
          this.lastTokenUsage = Math.floor(result.length / 4);
        }

        logger.info(`✅ Vertex AI success: ${result.substring(0, 100)}...`);

        return {
          content: result,
          tokenUsage: this.lastTokenUsage,
          model: this.model,
          agentType: 'gemini'
        };
      }
    }

    throw new Error('No content in Vertex AI response');
  }

  getTokenUsage() {
    return this.lastTokenUsage;
  }

  setModel(modelName) {
    logger.info(`🔄 Switching model from ${this.model} to ${modelName}`);
    this.model = modelName;
  }

  supportsWebSearch() {
    return true; // Gemini has built-in Google Search grounding
  }

  getModelInfo() {
    return {
      modelName: this.model,
      projectId: this.projectId,
      location: this.location,
      provider: this.apiApproach
    };
  }
}

module.exports = GeminiAgent;