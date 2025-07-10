const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const checklistRoutes = require('./routes/checklist');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin:'https://checklistbuilder-zuper.netlify.app/',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization',  'X-API-Key','category_uid',
    'X-Region']
}));

// Request logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Zuper Checklist Backend is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api', checklistRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    details: {
      method: req.method,
      url: req.originalUrl,
      availableEndpoints: [
        'GET /health',
        'GET /api/ai-status',
        'POST /api/extract-checklist',
        'POST /api/submit-checklist',
        'POST /api/preview-payload',
        'GET /api/getZuperCategories',
        'GET /api/getZuperStatuses'
      ]
    }
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Zuper Checklist Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Validate required environment variables based on AI provider
  const aiProvider = process.env.AI_PROVIDER || 'claude';
  const requiredEnvVars = [];
  
  if (['claude', 'both'].includes(aiProvider.toLowerCase())) {
    requiredEnvVars.push('ANTHROPIC_API_KEY');
  }
  
  if (['openai', 'both'].includes(aiProvider.toLowerCase())) {
    requiredEnvVars.push('OPENAI_API_KEY');
  }
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables for AI provider "${aiProvider}":`, missingVars.join(', '));
    console.error('Please check your .env file');
  } else {
    console.log(`✅ All required environment variables are set for AI provider: ${aiProvider}`);
  }
  
  // Display AI service configuration
  console.log('🤖 AI Service Configuration:');
  console.log(`   Provider: ${aiProvider}`);
  if (['claude', 'both'].includes(aiProvider.toLowerCase())) {
    console.log(`   Claude Model: ${process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307'}`);
  }
  if (['openai', 'both'].includes(aiProvider.toLowerCase())) {
    console.log(`   OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-3.5-turbo'}`);
  }
});

module.exports = app;
