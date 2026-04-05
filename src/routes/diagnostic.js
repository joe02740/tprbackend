/**
 * Diagnostic Routes - Debug AI agent initialization issues
 */

const express = require('express');
const router = express.Router();

// Test AI agent initialization with detailed error reporting
router.get('/agents', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'SET' : 'MISSING',
      VERTEX_AI_LOCATION: process.env.VERTEX_AI_LOCATION || 'NOT SET',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
    },
    agents: {}
  };

  // Test Claude Agent
  try {
    const { AnthropicVertex } = require('@anthropic-ai/vertex-sdk');
    const client = new AnthropicVertex({
      region: process.env.VERTEX_AI_LOCATION || 'us-east5',
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    });
    diagnostics.agents.claude = {
      status: 'INITIALIZED',
      sdk: '@anthropic-ai/vertex-sdk',
      version: require('@anthropic-ai/vertex-sdk/package.json').version
    };
  } catch (error) {
    diagnostics.agents.claude = {
      status: 'FAILED',
      error: error.message,
      stack: error.stack
    };
  }

  // Test Gemini Agent
  try {
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.VERTEX_AI_LOCATION || 'us-east5',
    });
    diagnostics.agents.gemini = {
      status: 'INITIALIZED',
      sdk: '@google-cloud/vertexai',
      version: require('@google-cloud/vertexai/package.json').version
    };
  } catch (error) {
    diagnostics.agents.gemini = {
      status: 'FAILED',
      error: error.message,
      stack: error.stack
    };
  }

  // Test GPT Agent
  try {
    const { OpenAI } = require('openai');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    diagnostics.agents.gpt = {
      status: 'INITIALIZED',
      sdk: 'openai',
      version: require('openai/package.json').version
    };
  } catch (error) {
    diagnostics.agents.gpt = {
      status: 'FAILED',
      error: error.message,
      stack: error.stack
    };
  }

  // Summary
  const failedAgents = Object.keys(diagnostics.agents).filter(
    name => diagnostics.agents[name].status === 'FAILED'
  );
  
  diagnostics.summary = {
    totalAgents: Object.keys(diagnostics.agents).length,
    initialized: Object.keys(diagnostics.agents).length - failedAgents.length,
    failed: failedAgents.length,
    failedAgentNames: failedAgents
  };

  res.json({
    success: failedAgents.length === 0,
    data: diagnostics
  });
});

module.exports = router;
