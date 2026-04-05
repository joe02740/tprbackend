const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');

// Simple authentication middleware for device-based auth
const authenticateUser = async (req, res, next) => {
  try {
    // Get user ID from header (device-based auth for mobile apps)
    const userId = req.headers['x-user-id'];
    const authToken = req.headers['authorization'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required in X-User-ID header'
      });
    }

    // For MVP, we'll use simple device ID based auth
    // In production, you'd want proper JWT tokens
    if (authToken) {
      try {
        const token = authToken.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

        if (decoded.userId !== userId) {
          return res.status(401).json({
            success: false,
            error: 'Token user ID mismatch'
          });
        }
      } catch (jwtError) {
        console.warn('JWT verification failed:', jwtError.message);
        // For now, continue with device ID auth
      }
    }

    // Get or create user record
    const db = getDatabase();
    let user = await db.collection('users').findOne({ deviceId: userId });

    if (!user) {
      // Create new user record
      user = {
        deviceId: userId,
        createdAt: new Date(),
        lastActive: new Date(),
        preferences: {
          theme: 'mandelbrot_deep_space',
          syncEnabled: true,
        },
        stats: {
          conversationsCreated: 0,
          documentsUploaded: 0,
          totalMessages: 0,
        }
      };

      const result = await db.collection('users').insertOne(user);
      user._id = result.insertedId;
    } else {
      // Update last active
      await db.collection('users').updateOne(
        { deviceId: userId },
        { $set: { lastActive: new Date() } }
      );
    }

    // Attach user to request
    req.user = {
      id: userId,
      _id: user._id,
      deviceId: userId,
      preferences: user.preferences || {},
      stats: user.stats || {}
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Generate JWT token for enhanced security (optional)
const generateToken = (userId) => {
  return jwt.sign(
    { userId, type: 'device' },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '30d' }
  );
};

// Middleware to check if user has elevated permissions (for admin features)
const requireElevated = (req, res, next) => {
  const elevatedUsers = (process.env.ELEVATED_USERS || '').split(',');

  if (!elevatedUsers.includes(req.user.id)) {
    return res.status(403).json({
      success: false,
      error: 'Elevated permissions required'
    });
  }

  next();
};

module.exports = {
  authenticateUser,
  generateToken,
  requireElevated,
};