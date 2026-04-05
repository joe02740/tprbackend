const express = require('express');
const { MongoClient } = require('mongodb');

const router = express.Router();

// Generate test JWT token for testing AI endpoints
router.get('/generate-token', (req, res) => {
  const jwt = require('jsonwebtoken');
  const userId = req.query.userId || 'test-user-123';
  
  const token = jwt.sign(
    { userId, deviceId: 'test-device' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({
    success: true,
    token,
    userId,
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-User-ID': userId
    },
    testUrls: {
      status: '/api/ai/status',
      generate: '/api/ai/generate',
      orchestrate: '/api/ai/orchestrate'
    }
  });
});

// Test MongoDB connection directly
router.get('/mongodb-test', async (req, res) => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      return res.status(500).json({
        success: false,
        error: 'MONGODB_URI environment variable is not set',
        uri: 'Not configured'
      });
    }

    console.log('🧪 Testing MongoDB connection...');
    console.log('📋 URI configured:', uri ? 'Yes' : 'No');
    
    const client = new MongoClient(uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });

    await client.connect();
    console.log('✅ MongoDB connection test successful');
    
    // Test ping
    await client.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB ping successful');
    
    await client.close();
    
    res.json({
      success: true,
      message: 'MongoDB connection successful',
      timestamp: new Date().toISOString(),
      uri: uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') // Hide credentials
    });
    
  } catch (error) {
    console.error('❌ MongoDB test failed:', error.message);
    
    res.status(200).json({ // Changed to 200 so we can see the error
      success: false,
      error: error.message,
      code: error.code || 'Unknown',
      timestamp: new Date().toISOString(),
      uri: process.env.MONGODB_URI ? 'Configured' : 'Not configured',
      stack: error.stack
    });
  }
});

// Simple AI test endpoint without authentication
router.post('/ai-simple', async (req, res) => {
  try {
    console.log('🧪 Simple AI test endpoint called');
    console.log('📤 Request body:', JSON.stringify(req.body, null, 2));
    
    res.json({
      success: true,
      response: "Hello! This is a test response from the backend. The connection is working!",
      agent: req.body.agent || 'test',
      timestamp: new Date().toISOString(),
      message: 'Backend connection successful!'
    });
  } catch (error) {
    console.error('❌ Simple AI test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
