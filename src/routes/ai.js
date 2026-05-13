/**
 * AI Routes - Handles AI agent interactions and orchestration
 */

const express = require('express');
const AIOrchestrator = require('../services/ai/aiOrchestrator');
const GrokImageService = require('../services/ai/grokImageService');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

function serializeGrokImageError(error) {
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode || error.response?.status,
    statusText: error.statusText || error.response?.statusText,
    requestId: error.requestId || null,
    responseData: error.responseData || error.response?.data,
    context: error.context,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };
}

// Initialize AI orchestrator (singleton)
let aiOrchestrator = null;
const grokImageService = new GrokImageService();

const getOrchestrator = async () => {
  if (!aiOrchestrator) {
    aiOrchestrator = new AIOrchestrator();
    await aiOrchestrator.initializeAgents();
  }
  return aiOrchestrator;
};

const applyRequestedOrDefaultAgents = (orchestrator, activeAgents = []) => {
  const requestedAgents = Array.isArray(activeAgents) ? activeAgents : [];

  if (requestedAgents.length > 0) {
    orchestrator.updateActiveAgents(requestedAgents);
    return 'request';
  }

  const defaultAgents = orchestrator.getDefaultActiveAgents();
  if (defaultAgents.length > 0) {
    orchestrator.updateActiveAgents(defaultAgents);
    logger.info(`🤖 No active agents provided, using backend default agent: ${defaultAgents[0].type}`);
    return 'default';
  }

  logger.warn('⚠️ No active agents provided and no default backend agent is available');
  return 'none';
};

// Get AI agent status
router.get('/status', async (req, res) => {
  try {
    const orchestrator = await getOrchestrator();
    const status = orchestrator.getAgentStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Error getting AI status: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI status'
    });
  }
});

// Generate AI response
router.post('/generate', async (req, res) => {
  try {
    const {
      messages,
      systemPrompt,
      fractalDepth = 0,
      conversationId,
      activeAgents = [],
      temperature = 0.7,
      maxTokens = 1000,
      enableWebSearch = false,
      characterName = null,
      lengthMode = 'standard'
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required and cannot be empty'
      });
    }

    const orchestrator = await getOrchestrator();

    // DEBUG: Log what we received
    logger.info(`📨 Received activeAgents: ${JSON.stringify(activeAgents)}`);
    logger.info(`📨 activeAgents type: ${typeof activeAgents}, isArray: ${Array.isArray(activeAgents)}`);

    applyRequestedOrDefaultAgents(orchestrator, activeAgents);

    // Build character prompt if character is specified
    let enhancedSystemPrompt = systemPrompt;
    if (characterName) {
      const userName = req.user?.id || 'User';
      const characterPrompt = orchestrator.buildCharacterPrompt(
        'assistant',
        characterName,
        userName,
        lengthMode
      );
      enhancedSystemPrompt = enhancedSystemPrompt
        ? `${enhancedSystemPrompt}\n\n${characterPrompt}`
        : characterPrompt;
    }

    // Generate response
    const request = {
      messages,
      systemPrompt: enhancedSystemPrompt,
      fractalDepth,
      conversationId,
      temperature,
      maxTokens,
      enableWebSearch
    };

    const response = await orchestrator.generateFractalResponse(request);

    // Log the interaction
    logger.info(`AI response generated: ${response.agentType} (${response.tokenUsage} tokens)`);

    res.json({
      success: true,
      data: {
        content: response.content,
        agentType: response.agentType,
        tokenUsage: response.tokenUsage,
        model: response.model,
        fractalDepth: response.fractalDepth,
        collaborationMode: response.collaborationMode,
        metadata: response.metadata
      }
    });

  } catch (error) {
    logger.error(`Error generating AI response: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Text selection query endpoint (for e-reader integration)
router.post('/text-query', async (req, res) => {
  try {
    const {
      selectedText,
      context,
      queryType = 'explain',
      documentTitle,
      pageNumber,
      activeAgents = [],
      characterName = null,
      broaderContext,
      contextScope = 'passage',
      customQuestion,
      maxTokens,
    } = req.body;

    const parsedMaxTokens = Number.parseInt(maxTokens, 10);
    const requestedMaxTokens = Number.isFinite(parsedMaxTokens) && parsedMaxTokens > 0
      ? parsedMaxTokens
      : 1200;

    if (!selectedText) {
      return res.status(400).json({
        success: false,
        error: 'Selected text is required'
      });
    }

    const orchestrator = await getOrchestrator();

    applyRequestedOrDefaultAgents(orchestrator, activeAgents);

    // Build query prompt based on type
    const queryPrompts = {
      chat: customQuestion || 'Please help me think through this passage in a conversational way',
      explain: 'Please explain this text in detail',
      define: 'Please define or clarify the key terms in this text',
      historical_context: 'Please explain the historical, cultural, and period context behind this text',
      interpret: 'Please interpret what this text means and what the author is doing beneath the surface',
      visualize: 'Please describe how to visualize this text and provide an image-generation-ready prompt'
    };

    const action = queryPrompts[queryType] || 'Please help me understand this text';
    const documentInfo = documentTitle
      ? ` from "${documentTitle}"${pageNumber ? ` (page ${pageNumber})` : ''}`
      : '';

    const prompt = `${action}${documentInfo}:

"${selectedText}"

Context: ${context}

  Context scope: ${contextScope}

  ${broaderContext ? `Broader reading context:\n${broaderContext}\n\n` : ''}${customQuestion ? `Reader question: ${customQuestion}\n\n` : ''}

Please respond helpfully and concisely, finishing within your token budget.`;

    // Create message for AI
    const messages = [{
      role: 'user',
      content: prompt
    }];

    // Build system prompt for text analysis
    const systemPrompt = `You are a helpful AI reading companion that assists users while they read.
Your goal is to help users understand passages through explanation, definition, interpretation, historical context, and scene visualization.
You have a budget of approximately ${requestedMaxTokens} tokens. Write concisely and ALWAYS finish with a complete sentence — never cut off mid-thought.
Keep responses mobile-friendly: short paragraphs, no unnecessary headers or bullet points unless the content genuinely calls for it.
When the query type is "visualize", include a vivid scene description and a clean standalone prompt for image generation.`;

    // Route short queries to Haiku for faster responses
    const fastModel = process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5@20251001';
    const useHaiku = requestedMaxTokens <= 400 && orchestrator.agents.has('claude');
    const modelOverride = useHaiku ? fastModel : null;

    const request = {
      messages,
      systemPrompt,
      fractalDepth: 0, // depth 0 = concise, avoids "add depth" instructions
      conversationId: `text_selection_${Date.now()}`,
      temperature: 0.7,
      maxTokens: requestedMaxTokens,
      enableWebSearch: false,
      modelOverride,
    };

    const response = await orchestrator.generateFractalResponse(request);

    logger.info(`Text query processed: ${queryType} for "${selectedText.substring(0, 50)}..."`);

    res.json({
      success: true,
      data: {
        content: response.content,
        agentType: response.agentType,
        tokenUsage: response.tokenUsage,
        queryType,
        selectedText,
        documentTitle,
        pageNumber,
        metadata: response.metadata
      }
    });

  } catch (error) {
    logger.error(`Error processing text query: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to process text query',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update active agents
router.post('/agents', async (req, res) => {
  try {
    const { activeAgents } = req.body;

    if (!Array.isArray(activeAgents)) {
      return res.status(400).json({
        success: false,
        error: 'activeAgents must be an array'
      });
    }

    const orchestrator = await getOrchestrator();
    orchestrator.updateActiveAgents(activeAgents);

    res.json({
      success: true,
      data: {
        activeAgents: orchestrator.activeAgents,
        collaborationMode: orchestrator.collaborationMode
      }
    });

  } catch (error) {
    logger.error(`Error updating active agents: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to update active agents'
    });
  }
});

router.post('/image', async (req, res) => {
  try {
    const {
      prompt,
      selectedText,
      context,
      documentTitle,
      pageNumber,
      broaderContext,
      aspectRatio = '3:4',
      resolution = '2k'
    } = req.body;

    if (!grokImageService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Grok image generation is not configured'
      });
    }

    const imagePrompt = prompt || `Create a refined literary illustration${documentTitle ? ` for "${documentTitle}"` : ''}${pageNumber ? `, page ${pageNumber}` : ''}.

Selected passage:
"${selectedText || ''}"

Immediate context:
${context || ''}

${broaderContext ? `Broader reading context:
${broaderContext}

` : ''}Render this like a premium book illustration with period-appropriate details, readable composition, and atmospheric clarity. Avoid captions or text in the image.`;

    const image = await grokImageService.generateImage({
      prompt: imagePrompt,
      aspectRatio,
      resolution,
    });

    res.json({
      success: true,
      data: image,
    });
  } catch (error) {
    logger.error(`Error generating Grok image: ${JSON.stringify(serializeGrokImageError(error))}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get available characters
router.get('/characters', async (req, res) => {
  try {
    // This would load from your character system
    // For now, return basic characters
    const characters = [
      {
        id: 'fractal_architect',
        name: 'The Fractal Architect',
        description: 'A mathematical visionary who sees patterns in chaos and builds bridges between dimensions of thought',
        prompt: 'You are The Fractal Architect, a mathematical visionary who sees patterns in chaos and builds bridges between dimensions of thought. You speak with geometric precision and see the mathematical beauty underlying all conversations.'
      },
      {
        id: 'thoughtful_guide',
        name: 'Thoughtful Guide',
        description: 'A patient teacher who helps users understand complex concepts through clear explanation',
        prompt: 'You are a thoughtful guide who helps users understand complex concepts through clear, patient explanation. You break down complicated ideas into understandable parts.'
      },
      {
        id: 'creative_explorer',
        name: 'Creative Explorer',
        description: 'An imaginative assistant who approaches problems from unique angles',
        prompt: 'You are a creative explorer who approaches problems from unique, imaginative angles. You think outside the box and offer innovative perspectives.'
      }
    ];

    res.json({
      success: true,
      data: { characters }
    });

  } catch (error) {
    logger.error(`Error getting characters: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get characters'
    });
  }
});

module.exports = router;