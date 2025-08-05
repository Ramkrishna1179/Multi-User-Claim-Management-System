import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';

import connectDB from './config/database';
import logger, { apiLogger, socketLogger, dbLogger } from './config/logger';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { apiLoggingMiddleware, errorLoggingMiddleware } from './middlewares/logging';
import ClaimSocket from './sockets/claimSocket';
import { setSocketIO } from './services/claimService';

// Import routes
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import claimRoutes from './routes/claims';
import adminRoutes from './routes/admin';
import { getCurrentSettings } from './controllers/adminController';
import { auth } from './middlewares/auth';

const app = express();
const server = createServer(app);

// Initialize Socket.IO
const claimSocket = new ClaimSocket(server);

// Set Socket.IO instance for ClaimService
setSocketIO(claimSocket.getIO());



// Connect to database
connectDB();

// Log application startup
logger.info('Starting Claim Management System Backend', {
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000
});

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
logger.info('CORS Configuration', { 
  corsOrigin, 
  nodeEnv: process.env.NODE_ENV,
  allEnvVars: Object.keys(process.env).filter(key => key.includes('CORS'))
});

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Rate limiting - Disabled for development to prevent 429 errors
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200'), // limit each IP to 200 requests per minute
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    skipFailedRequests: false
  });

  // Apply rate limiting to all API routes only in production
  app.use('/api/', limiter);

  // More lenient rate limiting for dashboard data
  const dashboardLimiter = rateLimit({
    windowMs: 60000, // 1 minute
    max: 50, // 50 requests per minute for dashboard
    message: 'Too many dashboard requests, please wait a moment.',
    skipSuccessfulRequests: true
  });

  // Apply to specific endpoints that might be called frequently
  app.use('/api/claims/stats', dashboardLimiter);
  app.use('/api/claims/user', dashboardLimiter);
  app.use('/api/claims', dashboardLimiter);
} else {
  logger.info('Rate limiting disabled in development mode');
}

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root endpoint
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-User Claim Management System API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 800px;
            width: 90%;
            text-align: center;
        }
        .logo {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 1.1rem;
            margin-bottom: 30px;
        }
        .status {
            background: #e8f5e8;
            color: #2d5a2d;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 500;
        }
        .endpoints {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .endpoint {
            margin: 10px 0;
            padding: 8px 12px;
            background: white;
            border-radius: 5px;
            border-left: 4px solid #667eea;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
        }
        .tech-stack {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .tech-item {
            background: #f0f4ff;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e0e7ff;
        }
        .tech-title {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .timestamp {
            color: #888;
            font-size: 0.9rem;
            margin-top: 20px;
        }
        .version {
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            display: inline-block;
            font-size: 0.8rem;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="version">v1.0.0</div>
        <h1 class="logo">🏢 Claim Management System</h1>
        <p class="subtitle">Multi-User Claim Management System API Backend</p>
        
        <div class="status">
            ✅ Server is running successfully
        </div>
        
        <div class="endpoints">
            <h3>📋 Available API Endpoints:</h3>
            <div class="endpoint">GET /health - Health check</div>
            <div class="endpoint">POST /api/auth/login - User authentication</div>
            <div class="endpoint">GET /api/auth/profile - Get user profile</div>
            <div class="endpoint">GET /api/claims - Get all claims</div>
            <div class="endpoint">POST /api/claims - Create new claim</div>
            <div class="endpoint">GET /api/posts - Get all posts</div>
            <div class="endpoint">POST /api/posts - Create new post</div>
            <div class="endpoint">GET /api/admin/settings - Admin settings</div>
        </div>
        
        <div class="tech-stack">
            <div class="tech-item">
                <div class="tech-title">Backend</div>
                <div>Node.js, Express.js, TypeScript</div>
            </div>
            <div class="tech-item">
                <div class="tech-title">Database</div>
                <div>MongoDB with Mongoose</div>
            </div>
            <div class="tech-item">
                <div class="tech-title">Authentication</div>
                <div>JWT, Role-based access</div>
            </div>
            <div class="tech-item">
                <div class="tech-title">Real-time</div>
                <div>Socket.IO for live updates</div>
            </div>
        </div>
        
        <div class="timestamp">
            Server started: ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('Health check requested', { ip: req.ip });
  res.json({ 
    status: 'Server is up and running', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API logging middleware (apply before routes)
app.use('/api', apiLoggingMiddleware);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/admin', adminRoutes);

// Public settings route (any authenticated user can access)
app.get('/api/settings/current', auth, getCurrentSettings);

// Error logging middleware (apply before error handlers)
app.use('/api', errorLoggingMiddleware);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Global error handler for unhandled promises
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', { error: err.message, stack: err.stack });
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

export default app; 