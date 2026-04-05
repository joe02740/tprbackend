const express = require('express');
const { healthCheck } = require('../config/database');

const router = express.Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    let dbHealth;
    try {
      dbHealth = await healthCheck();
    } catch (error) {
      dbHealth = {
        status: 'disconnected',
        message: 'Database connection failed',
        error: error.message
      };
    }

    const health = {
      status: 'healthy', // Service is healthy even if DB is down
      timestamp: new Date().toISOString(),
      service: 'thinkpack-solo-backend',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      database: dbHealth,
      environment: process.env.NODE_ENV || 'development',
    };

    // Return 200 even if database is down (service itself is healthy)
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'thinkpack-solo-backend',
      error: error.message,
    });
  }
});

// Detailed health check for monitoring
router.get('/detailed', async (req, res) => {
  try {
    const dbHealth = await healthCheck();

    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'thinkpack-solo-backend',
      version: '1.0.0',
      checks: {
        database: dbHealth,
        memory: {
          status: process.memoryUsage().heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning',
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss,
        },
        uptime: {
          status: 'healthy',
          seconds: process.uptime(),
          readable: formatUptime(process.uptime()),
        },
        environment: {
          status: 'healthy',
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          env: process.env.NODE_ENV || 'development',
        }
      }
    };

    // Check if any component is unhealthy
    const unhealthyChecks = Object.values(detailedHealth.checks)
      .filter(check => check.status === 'unhealthy');

    if (unhealthyChecks.length > 0) {
      detailedHealth.status = 'unhealthy';
      return res.status(503).json(detailedHealth);
    }

    res.json(detailedHealth);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'thinkpack-solo-backend',
      error: error.message,
    });
  }
});

// Ready check for Kubernetes/Cloud Run
router.get('/ready', async (req, res) => {
  try {
    const dbHealth = await healthCheck();

    if (dbHealth.status === 'healthy') {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not healthy',
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Live check for Kubernetes/Cloud Run
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = router;