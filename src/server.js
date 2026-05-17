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
const { errorHandler, notFound } = require('./middleware/errorHandler');
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

// CORS configuration for Flutter app
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true, // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in prod
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check (no auth required)
app.use('/health', healthRoutes);

// Test routes (no auth required for debugging)
app.use('/test', testRoutes);

// Diagnostic routes (no auth required for debugging)
app.use('/api/diagnostic', diagnosticRoutes);

// API routes (no auth for single-user Android app)
app.use('/api/conversations', conversationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/book-intelligence', bookIntelligenceRoutes);

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