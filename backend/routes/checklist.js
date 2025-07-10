const express = require('express');
const router = express.Router();
const multer = require('multer');

const progressStreams = new Map();

const upload = require('../middleware/upload');
const validation = require('../middleware/validation');
const excelParser = require('../services/excelParser');
const aiService = require('../services/aiService');
const zuperService = require('../services/zuperService');

// Multer error handler middleware
const handleUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let code = 'UPLOAD_ERROR';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size allowed is ${(process.env.MAX_FILE_SIZE || 20971520) / 1024 / 1024}MB`;
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Only one file is allowed';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name. Use "file" as the field name';
        code = 'UNEXPECTED_FIELD';
        break;
      default:
        message = error.message;
    }
    
    return res.status(400).json({
      success: false,
      error: message,
      code: code,
      details: { 
        multerCode: error.code,
        field: error.field || 'file'
      }
    });
  } else if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: error.code,
      details: { 
        allowedTypes: ['.xlsx', '.xls'],
        receivedType: req.file ? require('path').extname(req.file.originalname) : 'unknown'
      }
    });
  }
  
  next(error);
};

/**
 * GET /api/ai-status
 * Get AI service status and configuration
 */
router.get('/ai-status', (req, res) => {
  try {
    const status = aiService.getStatus();
    
    res.status(200).json({
      success: true,
      message: 'AI service status retrieved',
      status: status
    });
  } catch (error) {
    console.error('❌ Error getting AI status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI service status',
      code: 'AI_STATUS_ERROR'
    });
  }
});

// Progress streaming endpoint
router.get('/progress-stream', (req, res) => {
  console.log('📡 New progress stream client connecting...');
  
  // Set up Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Generate unique client ID
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📡 Progress stream client connected: ${clientId}`);

  // Store client connection
  progressStreams.set(clientId, res);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    clientId: clientId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`📡 Progress stream client disconnected: ${clientId}`);
    progressStreams.delete(clientId);
  });

  req.on('aborted', () => {
    console.log(`📡 Progress stream client aborted: ${clientId}`);
    progressStreams.delete(clientId);
  });
});

// Helper function: Broadcast progress to all connected clients
function broadcastProgress(progressData) {
  if (progressStreams.size === 0) {
    console.log('📊 No clients connected for progress updates');
    return;
  }

  const message = `data: ${JSON.stringify({
    ...progressData,
    timestamp: new Date().toISOString()
  })}\n\n`;

  console.log(`📊 Broadcasting progress to ${progressStreams.size} clients:`, progressData);

  // Send to all connected clients
  for (const [clientId, res] of progressStreams) {
    try {
      res.write(message);
    } catch (error) {
      console.error(`❌ Failed to send progress to client ${clientId}:`, error.message);
      progressStreams.delete(clientId);
    }
  }
}

// Helper function: Create progress callback for AI service
function createProgressCallback() {
  return (progressData) => {
    // Log to console (existing behavior)
    console.log(`📊 Progress: Chunk ${progressData.chunkIndex + 1}/${progressData.totalChunks} - ${progressData.status}`);
    
    // Broadcast to connected clients
    broadcastProgress({
      currentChunk: progressData.chunkIndex + 1,
      totalChunks: progressData.totalChunks,
      currentAttempt: progressData.attempt,
      maxAttempts: progressData.maxAttempts,
      status: progressData.status,
      percentage: Math.round(((progressData.chunkIndex + 1) / progressData.totalChunks) * 100)
    });
  };
}

/**
 * POST /api/extract-checklist
 * Extract checklist from uploaded Excel file using AI with real-time progress
 */
router.post('/extract-checklist', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      return handleUploadErrors(error, req, res, next);
    }
    next();
  });
}, validation.validateExtractRequest, async (req, res, next) => {
  try {
    console.log('📄 Processing checklist extraction request with real-time progress');
    
    const { categoryUid, statusUid, apiKey, region } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE',
        details: { message: 'Please upload an Excel file (.xlsx or .xls)' }
      });
    }

    console.log(`📊 Processing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // CREATE PROGRESS CALLBACK
    const progressCallback = createProgressCallback();

    // SEND INITIAL PROGRESS UPDATE
    broadcastProgress({
      currentChunk: 0,
      totalChunks: 0,
      currentAttempt: 1,
      maxAttempts: 1,
      status: 'Analyzing Excel file...',
      percentage: 0
    });

    // Step 1: Analyze Excel file for optimal processing strategy
    console.log('🔍 Analyzing Excel file...');
    const fileAnalysis = await excelParser.analyzeExcelForChunking(file.path);
    
    if (fileAnalysis.error) {
      console.warn('⚠️ File analysis failed, proceeding with basic parsing');
    } else {
      console.log(`📊 File analysis: ${fileAnalysis.fileStats.totalRows} rows, chunking needed: ${fileAnalysis.chunkingRecommendation.needsChunking}`);
    }

    // Update progress
    broadcastProgress({
      currentChunk: 0,
      totalChunks: 0,
      currentAttempt: 1,
      maxAttempts: 1,
      status: 'Extracting Excel content...',
      percentage: 10
    });

    // Step 2: Extract Excel text for AI processing
    console.log('📝 Extracting Excel content...');
    const excelText = await excelParser.extractExcelText(file.path);
    
    if (!excelText || excelText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Excel file appears to be empty or unreadable',
        code: 'EMPTY_FILE',
        details: { message: 'Please ensure the Excel file contains data in the correct format' }
      });
    }

    console.log(`📝 Extracted text (${excelText.length} characters)`);

    // Update progress
    broadcastProgress({
      currentChunk: 0,
      totalChunks: 0,
      currentAttempt: 1,
      maxAttempts: 1,
      status: 'Preparing AI processing...',
      percentage: 20
    });

    // Step 3: Enhanced extraction with chunking and progress tracking
    console.log('🤖 Processing with AI (chunking enabled)...');
    
    let processingMetadata = {
      originalFileSize: file.size,
      extractedTextLength: excelText.length,
      analysisResult: fileAnalysis.error ? null : fileAnalysis,
      aiProvider: aiService.getStatus().provider,
      chunkingUsed: false,
      processingStats: null
    };

    // Progress tracking for chunked processing
    const progressData = {
      totalChunks: 0,
      processedChunks: 0,
      failedChunks: 0,
      startTime: Date.now(),
      chunkResults: []
    };

    // Extract checklist with chunking support and real-time progress
    const extractedChecklist = await aiService.extractChecklist(excelText, progressCallback);

    // Update processing stats
    const endTime = Date.now();
    processingMetadata.processingStats = {
      totalChunks: progressData.totalChunks,
      processedChunks: progressData.processedChunks,
      failedChunks: progressData.failedChunks,
      processingTimeMs: endTime - progressData.startTime,
      processingTimeSeconds: Math.round((endTime - progressData.startTime) / 1000),
      averageTimePerChunk: progressData.totalChunks > 0 ? Math.round((endTime - progressData.startTime) / progressData.totalChunks) : 0
    };

    console.log(`⏱️ Processing completed in ${processingMetadata.processingStats.processingTimeSeconds}s`);

    // SEND COMPLETION UPDATE
    broadcastProgress({
      currentChunk: 1,
      totalChunks: 1,
      currentAttempt: 1,
      maxAttempts: 1,
      status: 'Processing complete!',
      percentage: 100
    });

    // Step 4: Validate extracted checklist
    const validation = aiService.validateChecklist(extractedChecklist);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Extracted checklist contains errors',
        code: 'VALIDATION_FAILED',
        details: { 
          errors: validation.errors,
          warnings: validation.warnings,
          processingMetadata
        }
      });
    }

    if (extractedChecklist.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid checklist items could be extracted from the file',
        code: 'NO_ITEMS_EXTRACTED',
        details: { 
          message: 'Please check that your Excel file follows the correct format: question|type|option|required|isDependent|dependentOn|dependentOptions',
          excelPreview: excelText.substring(0, 200) + '...',
          warnings: validation.warnings,
          processingMetadata
        }
      });
    }

    console.log(`✅ Successfully extracted ${extractedChecklist.length} checklist items using ${processingMetadata.chunkingUsed ? 'chunked' : 'single'} processing`);

    // Cleanup uploaded file
    await excelParser.cleanupFile(file.path);

    // Prepare response with enhanced metadata
    const response = {
      success: true,
      message: `Successfully extracted ${extractedChecklist.length} checklist items`,
      checklist: extractedChecklist,
      validation: {
        warnings: validation.warnings,
        itemCount: extractedChecklist.length,
        isValid: validation.isValid
      },
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        itemCount: extractedChecklist.length,
        processedAt: new Date().toISOString(),
        ...processingMetadata
      }
    };

    // Add performance insights for large files
    if (processingMetadata.chunkingUsed) {
      response.performance = {
        chunkingEnabled: true,
        totalChunks: processingMetadata.processingStats.totalChunks,
        processingTime: `${processingMetadata.processingStats.processingTimeSeconds}s`,
        averageChunkTime: `${Math.round(processingMetadata.processingStats.averageTimePerChunk / 1000)}s`,
        recommendation: processingMetadata.processingStats.totalChunks > 5 
          ? 'Consider breaking very large files into smaller ones for faster processing'
          : 'File processed efficiently with chunking'
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error in extract-checklist:', error);
    
    // SEND ERROR UPDATE
    broadcastProgress({
      currentChunk: 0,
      totalChunks: 0,
      currentAttempt: 1,
      maxAttempts: 1,
      status: `Error: ${error.message}`,
      percentage: 0,
      error: true
    });

    // Enhanced error reporting with context
    const errorResponse = {
      success: false,
      error: error.message || 'Failed to extract checklist',
      code: error.code || 'EXTRACTION_ERROR',
      timestamp: new Date().toISOString()
    };

    // Add specific error context based on error type
    if (error.message.includes('chunk')) {
      errorResponse.details = {
        type: 'CHUNKING_ERROR',
        message: 'Error occurred during chunked processing',
        suggestion: 'Try with a smaller file or contact support if the issue persists'
      };
    } else if (error.message.includes('AI') || error.message.includes('Claude') || error.message.includes('OpenAI')) {
      errorResponse.details = {
        type: 'AI_PROCESSING_ERROR',
        message: 'AI service encountered an error',
        suggestion: 'Please try again. If the issue persists, the AI service may be temporarily unavailable'
      };
    } else if (error.message.includes('Excel') || error.message.includes('parse')) {
      errorResponse.details = {
        type: 'FILE_PARSING_ERROR',
        message: 'Unable to parse the Excel file',
        suggestion: 'Please ensure the file is a valid Excel file and follows the expected format'
      };
    }

    // Cleanup file on error
    if (req.file) {
      try {
        await excelParser.cleanupFile(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }

    res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/submit-checklist
 * Submit checklist to Zuper FSM API
 */
router.post('/submit-checklist', validation.validateSubmitRequest, async (req, res, next) => {
  try {
    console.log('🚀 Processing checklist submission to Zuper');
    
    const { checklist, config } = req.body;
    const { categoryUid, statusUid, apiKey, region } = config;

    console.log(`📋 Submitting ${checklist.length} items to region: ${region}`);

    // Step 1: Generate Zuper payload
    const zuperPayload = zuperService.generateZuperPayload(checklist, config);
    
    console.log('📦 Generated Zuper payload');

    // Step 2: Submit to Zuper API
    const result = await zuperService.submitToZuper(zuperPayload, apiKey, region);

    console.log('✅ Successfully submitted to Zuper');

    res.status(200).json({
      success: true,
      message: 'Checklist submitted successfully to Zuper',
      result: result,
      metadata: {
        itemCount: checklist.length,
        region: region,
        submittedAt: new Date().toISOString(),
        payloadSize: JSON.stringify(zuperPayload).length
      }
    });

  } catch (error) {
    console.error('❌ Error in submit-checklist:', error);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Failed to submit checklist',
      code: error.code || 'SUBMISSION_ERROR',
      timestamp: new Date().toISOString()
    };

    // Add Zuper-specific error context
    if (error.code === 'ZUPER_API_ERROR') {
      errorResponse.details = {
        type: 'ZUPER_API_ERROR',
        statusCode: error.statusCode,
        suggestion: error.statusCode === 401 
          ? 'Please check your API key'
          : error.statusCode === 400
            ? 'Please verify your category UID and status UID'
            : 'Please try again later'
      };
    }

    const statusCode = error.statusCode || 500;
    res.status(statusCode).json(errorResponse);
  }
});

/**
 * POST /api/preview-payload
 * Generate Zuper payload preview without submitting
 */
router.post('/preview-payload', validation.validateSubmitRequest, async (req, res, next) => {
  try {
    console.log('👁️ Generating payload preview');
    
    const { checklist, config } = req.body;

    // Generate Zuper payload
    const zuperPayload = zuperService.generateZuperPayload(checklist, config);
    
    res.status(200).json({
      success: true,
      message: 'Payload generated successfully',
      payload: zuperPayload,
      metadata: {
        itemCount: checklist.length,
        payloadSize: JSON.stringify(zuperPayload).length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in preview-payload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate payload preview',
      code: 'PREVIEW_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/file-analysis
 * Analyze uploaded file before processing (optional pre-flight check)
 */
router.post('/file-analysis', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      return handleUploadErrors(error, req, res, next);
    }
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    console.log(`🔍 Analyzing file: ${file.originalname}`);

    // Analyze file for chunking optimization
    const analysis = await excelParser.analyzeExcelForChunking(file.path);
    const metadata = await excelParser.getExcelMetadata(file.path);

    // Cleanup file after analysis
    await excelParser.cleanupFile(file.path);

    res.status(200).json({
      success: true,
      message: 'File analysis completed',
      analysis: analysis,
      metadata: metadata,
      recommendations: {
        processingStrategy: analysis.chunkingRecommendation?.needsChunking ? 'chunked' : 'single',
        estimatedProcessingTime: excelParser.estimateProcessingTime(analysis),
        optimizationTips: analysis.chunkingRecommendation?.riskFactors || []
      }
    });

  } catch (error) {
    console.error('❌ Error in file-analysis:', error);
    
    // Cleanup file on error
    if (req.file) {
      try {
        await excelParser.cleanupFile(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze file',
      code: 'ANALYSIS_ERROR'
    });
  }
});

/**
 * GET /api/chunking-status
 * Get current chunking configuration and AI service status
 */
router.get('/chunking-status', (req, res) => {
  try {
    const aiStatus = aiService.getStatus();
    
    res.status(200).json({
      success: true,
      message: 'Chunking status retrieved',
      status: {
        chunkingEnabled: true,
        aiService: aiStatus,
        supportedFileTypes: ['.xlsx', '.xls'],
        maxFileSize: '20MB',
        processingCapabilities: {
          singleFile: 'Up to 3000 characters per chunk',
          chunkedProcessing: 'Unlimited file size with automatic chunking',
          progressTracking: true,
          retryLogic: true,
          fallbackProviders: aiStatus.available.claude && aiStatus.available.openai
        }
      }
    });
  } catch (error) {
    console.error('❌ Error getting chunking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chunking status',
      code: 'STATUS_ERROR'
    });
  }
});

/**
 * GET /api/checklist/zuper/categories
 * Fetch job categories from Zuper
 */
router.get('/checklist/zuper/categories', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const region = req.headers['x-region'];

    if (!apiKey || !region) {
      return res.status(400).json({
        success: false,
        error: 'Missing x-api-key or x-region in headers'
      });
    }

    const categories = await zuperService.getZuperCategories(apiKey, region);
    console.log('📦 Categories fetched from Zuper API:', categories);
    
    res.status(200).json({
      success: true,
      message: 'Categories fetched successfully',
      categories
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      details: error.message
    });
  }
});

/**
 * GET /api/checklist/zuper/statuses
 * Fetch job statuses from Zuper
 */
router.get('/checklist/zuper/statuses', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const region = req.headers['x-region'];
    const categoryUid = req.query.category_uid;

    if (!apiKey || !region || !categoryUid) {
      return res.status(400).json({
        success: false,
        error: 'Missing x-api-key, x-region, or categoryUid'
      });
    }

    const statuses = await zuperService.getZuperStatuses(apiKey, region, categoryUid);

    res.status(200).json({
      success: true,
      message: 'Statuses fetched successfully',
      statuses
    });
  } catch (error) {
    console.error('❌ Error fetching statuses:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statuses',
      details: error.message
    });
  }
});

module.exports = router;