/**
 * AI Orchestrator - Manages multi-agent collaboration with fractal patterns
 * Port of the Python conversation orchestration logic
 */

const ClaudeAgent = require('./claudeAgent');
const GeminiAgent = require('./geminiAgent');
const GPTAgent = require('./gptAgent');
const logger = require('../../utils/logger');

// Length prompts for response control
const LENGTH_PROMPTS = {
  short: `
RESPONSE LENGTH: SHORT MODE (150 tokens max)
Your response must be 1-2 sentences maximum. Think of this as delivering your most essential insight in tweet-like brevity. Every word counts. Stop at your main point - no elaboration, examples, or follow-up questions. Be impactful and complete in minimal words.
`,
  standard: `
RESPONSE LENGTH: STANDARD MODE (600 tokens max)
Provide a thoughtful response of 2-4 sentences or one solid paragraph. You have room for your main insight plus brief supporting context or one example. Aim for substance without being verbose. This is conversational length - engaged but not overwhelming.
`,
  detailed: `
RESPONSE LENGTH: DETAILED MODE (1200 tokens max)
You may provide a comprehensive response with examples, deeper explanation, or multiple points. Feel free to elaborate on your insights, provide context, ask follow-up questions, or share related thoughts. This is your space for fuller expression while staying focused.
`
};

class AIOrchestrator {
  constructor() {
    this.agents = new Map();
    this.activeAgents = [];
    this.collaborationMode = 'solo';
    this.fractalPattern = 'spiral';
    this.isGenerating = false;

    this.initializeAgents();
  }

  async initializeAgents() {
    try {
      // Initialize Claude agent with WORKING Slack bot config
      if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
        const claudeModel = process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
        const claude = new ClaudeAgent(
          process.env.GOOGLE_CLOUD_PROJECT_ID,
          'us-east5',  // Same as working Slack bot
          claudeModel
        );
        await claude.initialize();
        this.agents.set('claude', claude);
        logger.info(`✅ Claude agent initialized with model: ${claudeModel}`);
      }

      // TEMPORARILY DISABLED - Testing Claude only
      // // Initialize Gemini agent
      // if (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_AI_API_KEY) {
      //   const gemini = new GeminiAgent(
      //     process.env.GOOGLE_CLOUD_PROJECT_ID,
      //     process.env.VERTEX_AI_LOCATION || 'us-east5'
      //   );
      //   await gemini.initialize();
      //   this.agents.set('gemini', gemini);
      //   logger.info('✅ Gemini agent initialized');
      // }

      // Initialize Gemini agent with EXACT same config as working Python
      if (process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_AI_API_KEY) {
        const gemini = new GeminiAgent(
          process.env.GOOGLE_CLOUD_PROJECT_ID,
          'us-east5',  // Same as working Python
          'gemini-2.5-flash'  // Same as working Python
        );
        await gemini.initialize();
        this.agents.set('gemini', gemini);
        logger.info('✅ Gemini agent initialized');
      }

      // Initialize GPT agent - THIS ONE WE KNOW WORKS
      if (process.env.OPENAI_API_KEY) {
        const gpt = new GPTAgent();
        await gpt.initialize();
        this.agents.set('gpt', gpt);
        logger.info('✅ GPT agent initialized');
      }

      logger.info(`🤖 AI Orchestrator initialized with ${this.agents.size} agents`);

    } catch (error) {
      logger.error(`Failed to initialize AI agents: ${error.message}`);
      throw error;
    }
  }

  updateActiveAgents(agentConfigs) {
    this.activeAgents = agentConfigs.filter(config =>
      config.isEnabled && this.agents.has(config.type)
    );

    this.collaborationMode = this._determineCollaborationMode(this.activeAgents.length);
    logger.info(`Updated active agents: ${this.activeAgents.map(a => a.type).join(', ')} (mode: ${this.collaborationMode})`);
  }

  getDefaultActiveAgents() {
    const preferredOrder = [
      process.env.DEFAULT_AI_AGENT || 'claude',
      'claude',
      'gemini',
      'gpt'
    ];

    const defaultType = preferredOrder.find(type => this.agents.has(type));
    if (!defaultType) {
      return [];
    }

    return [{ type: defaultType, isEnabled: true }];
  }

  setFractalPattern(pattern) {
    this.fractalPattern = pattern;
  }

  selectNextAgent(fractalPosition = {}) {
    const enabledAgents = this.activeAgents.filter(config =>
      config.isEnabled && this.agents.has(config.type)
    );

    if (enabledAgents.length === 0) return null;

    const { depth = 0, angle = 0, index = 0 } = fractalPosition;

    switch (this.collaborationMode) {
      case 'solo':
        return enabledAgents[0];
      case 'duo':
        return this._selectFromDuo(enabledAgents, { depth, angle, index });
      case 'trio':
        return this._selectFromTrio(enabledAgents, { depth, angle, index });
      case 'spiral':
        return this._selectFromSpiral(enabledAgents, { depth, angle, index });
      case 'mandala':
        return this._selectFromMandala(enabledAgents, { depth, angle, index });
      default:
        return enabledAgents[0];
    }
  }

  async generateFractalResponse(request) {
    logger.debug(`🌀 generateFractalResponse called with ${request.messages.length} messages`);

    const fractalPosition = {
      depth: request.fractalDepth || 0,
      angle: (request.fractalDepth || 0) * Math.PI / 3,
      index: request.messages.length
    };

    const selectedAgentConfig = this.selectNextAgent(fractalPosition);
    if (!selectedAgentConfig) {
      throw new Error('No active agents available');
    }

    const agent = this.agents.get(selectedAgentConfig.type);
    if (!agent) {
      throw new Error(`Agent ${selectedAgentConfig.type} not initialized`);
    }

    logger.debug(`🎯 Selected agent: ${selectedAgentConfig.type}`);

    // Enhance request with fractal context
    const enhancedRequest = this._enhanceFractalRequest(
      request,
      selectedAgentConfig,
      fractalPosition
    );

    logger.debug('🔧 Enhanced request, calling agent.generateResponse...');

    try {
      this.isGenerating = true;
      const response = await agent.generateResponse(enhancedRequest.messages, {
        systemPrompt: enhancedRequest.systemPrompt,
        temperature: enhancedRequest.temperature || 0.7,
        maxTokens: enhancedRequest.maxTokens || 1000,
        enableWebSearch: enhancedRequest.enableWebSearch || false
      });

      logger.debug(`💡 Agent response received: "${response.content.substring(0, Math.min(50, response.content.length))}..."`);

      return {
        content: response.content,
        agentType: selectedAgentConfig.type,
        tokenUsage: response.tokenUsage,
        model: response.model,
        fractalDepth: request.fractalDepth || 0,
        collaborationMode: this.collaborationMode,
        metadata: {
          fractalPosition,
          selectedAgent: selectedAgentConfig,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error(`💥 Agent response error: ${error.message}`);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  _determineCollaborationMode(agentCount) {
    switch (agentCount) {
      case 1: return 'solo';
      case 2: return 'duo';
      case 3: return 'trio';
      default: return 'spiral';
    }
  }

  _selectFromDuo(agents, { depth }) {
    // Binary fractal branching - alternate based on fractal depth
    return agents[depth % 2];
  }

  _selectFromTrio(agents, { depth }) {
    // Triangular fractal patterns
    return agents[depth % 3];
  }

  _selectFromSpiral(agents, { angle }) {
    // Spiral selection based on angle
    const spiralIndex = Math.floor((angle / (2 * Math.PI)) * agents.length);
    return agents[spiralIndex % agents.length];
  }

  _selectFromMandala(agents, { angle }) {
    // Complex mandala pattern selection
    const mandalaIndex = Math.floor(((Math.sin(angle) + 1) * 0.5) * agents.length);
    return agents[mandalaIndex % agents.length];
  }

  _enhanceFractalRequest(request, agentConfig, fractalPosition) {
    // Add fractal-specific context to the system prompt
    const fractalContext = this._generateFractalContext(
      agentConfig,
      fractalPosition,
      this.collaborationMode
    );

    const enhancedSystemPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${fractalContext}`
      : fractalContext;

    return {
      ...request,
      systemPrompt: enhancedSystemPrompt
    };
  }

  _generateFractalContext(agentConfig, fractalPosition, collaborationMode) {
    const { depth } = fractalPosition;

    const modeDescription = {
      solo: "You are the primary AI assistant.",
      duo: "You are collaborating with one other AI in binary fractal patterns.",
      trio: "You are part of a three-AI collaboration in triangular fractal patterns.",
      spiral: "You are part of a multi-AI spiral collaboration pattern.",
      mandala: "You are part of a complex multi-AI mandala collaboration pattern."
    }[collaborationMode] || "You are part of a collaborative AI system.";

    const depthGuidance = {
      0: "Surface level: Be concise and direct.",
      1: "First fractal level: Add some depth to your response.",
      2: "Second fractal level: Explore implications and nuances.",
      3: "Third fractal level: Dive deeper into complexity.",
      4: "Fourth fractal level: Embrace philosophical depth."
    }[depth] || `Fractal depth ${depth}: Adjust your response complexity accordingly.`;

    // Get active agent names for collaboration context
    const activeAgentNames = this.activeAgents.map(a => a.name || a.type).join(', ');
    const otherAgents = this.activeAgents
      .filter(a => a.type !== agentConfig.type)
      .map(a => a.name || a.type)
      .join(' and ');

    let collaborationText = '';
    if (this.activeAgents.length > 1) {
      collaborationText = `
COLLABORATION CONTEXT:
Active agents in this conversation: ${activeAgentNames}
${otherAgents ? `You are collaborating with ${otherAgents} in this conversation.` : ''}
${this._getCollaborationGuidance(collaborationMode, otherAgents)}`;
    }

    return `
FRACTAL COLLABORATION CONTEXT:
${modeDescription}

FRACTAL DEPTH GUIDANCE:
${depthGuidance}

FRACTAL POSITION:
- Depth: ${fractalPosition.depth}
- Angle: ${fractalPosition.angle.toFixed(2)} radians
- Index: ${fractalPosition.index}

${collaborationText}

Adjust your response style and depth based on this fractal context. Build on previous responses in the fractal pattern while maintaining your unique perspective.
`;
  }

  _getCollaborationGuidance(mode, otherAgents) {
    switch (mode) {
      case 'duo':
        return `
DUO MODE with ${otherAgents}:
- Read the room: simple questions get practical answers, complex topics invite collaborative exploration
- If ${otherAgents} has covered the basics, add depth or alternative perspectives
- Build on their insights: "Building on ${otherAgents}'s point..."
- Avoid redundancy - differentiate your contribution`;

      case 'trio':
        return `
TRIO MODE with ${otherAgents}:
- Read the room: simple questions get supportive answers, complex topics deserve the full collaborative treatment
- Each AI should bring unique perspectives - build, contrast, or explore new dimensions
- Reference others constructively when building on their ideas
- For complex topics, embrace the round-robin dynamic that makes multi-AI discussions valuable`;

      case 'spiral':
      case 'mandala':
        return `
MULTI-AI MODE with ${otherAgents}:
- Coordinate with multiple AI perspectives for rich, layered responses
- Build on previous insights while adding your unique angle
- Reference other agents when building on their contributions
- Embrace the complexity that comes with multiple AI collaboration`;

      default:
        return '';
    }
  }

  // Character and context management
  buildCharacterPrompt(agentName, characterName, userName, lengthMode = 'standard') {
    const lengthPrompt = LENGTH_PROMPTS[lengthMode] || LENGTH_PROMPTS.standard;

    let characterContext = '';
    if (characterName) {
      // Load character context - this would integrate with your character system
      characterContext = `\n\nYou are embodying the character: ${characterName}`;
    }

    return `${lengthPrompt}${characterContext}

USER CONTEXT:
You are responding to ${userName} in a ThinkPack Solo conversation.

Provide thoughtful, helpful responses that build on the conversation naturally.
${characterContext}`;
  }

  getAgentStatus() {
    const agentStatus = {};
    for (const [type, agent] of this.agents) {
      agentStatus[type] = {
        initialized: true,
        modelInfo: agent.getModelInfo(),
        supportsWebSearch: agent.supportsWebSearch(),
        lastTokenUsage: agent.getTokenUsage()
      };
    }

    return {
      totalAgents: this.agents.size,
      activeAgents: this.activeAgents.length,
      collaborationMode: this.collaborationMode,
      fractalPattern: this.fractalPattern,
      isGenerating: this.isGenerating,
      agents: agentStatus
    };
  }
}

module.exports = AIOrchestrator;