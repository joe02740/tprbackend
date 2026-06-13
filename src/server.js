const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectToDatabase } = require('./config/database');
const conversationRoutes = require('./routes/conversations');
const documentRoutes = require('./routes/documents');
const healthRoutes = require('./routes/health');
const testRoutes = require('./routes/test');
const aiRoutes = require('./routes/ai');
const bookIntelligenceRoutes = require('./routes/book-intelligence');
const diagnosticRoutes = require('./routes/diagnostic');
const feedbackRoutes = require('./routes/feedback');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requireAppToken } = require('./middleware/appToken');
// Authentication removed for single-user Android app - can add back later for multi-user

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for Cloud Run (fixes rate limiting errors)
app.set('trust proxy', 1); // Trust first proxy (Cloud Run)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS — native Android app does not send Origin/cookies, so allow only explicit
// browser origins via ALLOWED_ORIGINS env var. Default: no CORS access from browsers.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
}));

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Stricter rate limit for expensive AI endpoints (per-IP).
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'production' ? 30 : 300,
  message: {
    success: false,
    error: 'Too many AI requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check (no auth required)
app.use('/health', healthRoutes);

// Debug-only routes — must never run in production.
if (process.env.NODE_ENV !== 'production') {
  app.use('/test', testRoutes);
  app.use('/api/diagnostic', diagnosticRoutes);
}

// API routes — gated by the shared app token when THINKPACK_APP_TOKEN is set.
// (No per-user auth yet; the token stops drive-by abuse of paid AI endpoints.)
app.use('/api', requireAppToken);
app.use('/api/conversations', conversationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/book-intelligence', aiLimiter, bookIntelligenceRoutes);
app.use('/api/feedback', feedbackRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ThinkPack Solo Backend API',
    version: '1.0.0',
    status: 'operational',
    features: [
      'Fractal conversation storage',
      'Multi-agent AI orchestration',
      'Document management',
      'Real-time sync',
    ],
    endpoints: {
      health: '/health',
      conversations: '/api/conversations',
      documents: '/api/documents',
      ai: '/api/ai',
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Try to connect to database, but don't fail if it's not available
    if (process.env.MONGODB_URI) {
      try {
        await connectToDatabase();
        console.log(`✅ MongoDB connected`);
      } catch (dbError) {
        console.warn(`⚠️ MongoDB connection failed (will continue without DB): ${dbError.message}`);
      }
    } else {
      console.log(`📝 MongoDB URI not configured - running without database`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 ThinkPack Solo Backend running on port ${PORT}`);
      console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🧠 MongoDB: ${process.env.MONGODB_URI ? 'Configured' : 'Not configured'}`);
      console.log(`🔒 Auth: ${process.env.JWT_SECRET ? 'Enabled' : 'Basic'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;