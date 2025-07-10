const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = require('../middleware/upload');
const validation = require('../middleware/validation');
const excelParser = require('../services/excelParser');
const aiService = require('../services/aiService');
const zuperService = require('../services/zuperService');
// Make sure you have this import at the top of routes/checklist.js
const { validateExtractRequest, validateSubmitRequest } = require('../middleware/validation');

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

/**
 * POST /api/extract-checklist
 * Extract checklist from uploaded Excel file using AI
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
    console.log('📄 Processing checklist extraction request');
    
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

    // Step 1: Parse Excel file
    console.log('🔍 Parsing Excel file...');
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

    // Step 2: Extract checklist using AI service
    console.log('🤖 Processing with AI...');
    const extractedChecklist = await aiService.extractChecklist(excelText);

    // Step 3: Validate extracted checklist
    const validation = aiService.validateChecklist(extractedChecklist);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Extracted checklist contains errors',
        code: 'VALIDATION_FAILED',
        details: { 
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
    }

    if (extractedChecklist.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid checklist items could be extracted from the file',
        code: 'NO_ITEMS_EXTRACTED',
        details: { 
          message: 'Please check that your Excel file follows the correct format: question|type|option|required',
          excelPreview: excelText.substring(0, 200) + '...',
          warnings: validation.warnings
        }
      });
    }

    console.log(`✅ Successfully extracted ${extractedChecklist.length} checklist items`);

    // Cleanup uploaded file
    await excelParser.cleanupFile(file.path);

    res.status(200).json({
      success: true,
      message: `Successfully extracted ${extractedChecklist.length} checklist items`,
      checklist: extractedChecklist,
      validation: {
        warnings: validation.warnings,
        itemCount: extractedChecklist.length
      },
      metadata: {
        fileName: file.originalname,
        fileSize: file.size,
        itemCount: extractedChecklist.length,
        aiProvider: aiService.getStatus().provider,
        processedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in extract-checklist:', error);
    next(error);
  }
});

// /**
//  * POST /api/submit-checklist
//  * Submit checklist to Zuper FSM API
//  */
// router.post('/submit-checklist', validation.validateSubmitRequest, async (req, res, next) => {
//   try {
//     console.log('🚀 Processing checklist submission to Zuper');
    
//     const { checklist, config } = req.body;
//     const { categoryUid, statusUid, apiKey, region } = config;

//     console.log(`📋 Submitting ${checklist.length} items to region: ${region}`);

//     // Step 1: Generate Zuper payload
//     const zuperPayload = zuperService.generateZuperPayload(checklist, config);
    
//     console.log('📦 Generated Zuper payload');

//     // Step 2: Submit to Zuper API
//     const result = await zuperService.submitToZuper(zuperPayload, apiKey, region);

//     console.log('✅ Successfully submitted to Zuper');

//     res.status(200).json({
//       success: true,
//       message: 'Checklist submitted successfully to Zuper',
//       result: result,
//       metadata: {
//         itemCount: checklist.length,
//         region: region,
//         submittedAt: new Date().toISOString()
//       }
//     });

//   } catch (error) {
//     console.error('❌ Error in submit-checklist:', error);
//     next(error);
//   }
// });


/**
 * POST /api/submit-checklist
 * Submit checklist to Zuper FSM API
 */
router.post('/submit-checklist', validation.validateSubmitRequest, async (req, res, next) => {
  try {
    console.log('🚀 Processing checklist submission to Zuper');
    
    const { checklist, config } = req.body;
    const { categoryUid, statusUid, apiKey, region } = config;

    // ADD: Debug logs to see what we're receiving
    console.log('📋 Complete request body:');
    console.dir(req.body, { depth: null });
    
    console.log('📋 Checklist received from frontend:');
    console.dir(checklist, { depth: null });
    
    console.log('📋 Config received from frontend:');
    console.dir(config, { depth: null });

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
        submittedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in submit-checklist:', error);
    next(error);
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
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error in preview-payload:', error);
    next(error);
  }
});

/**
 * GET /api/zuper/categories
 * Fetch job categories from Zuper
 */
// router.get('/zuper/categories', async (req, res) => {
//   try {
//     const { apiKey, region } = req.query;

//     if (!apiKey || !region) {
//       return res.status(400).json({
//         success: false,
//         error: 'Missing apiKey or region in query params',
//         code: 'MISSING_PARAMS'
//       });
//     }

//     const categories = await zuperService.getZuperCategories(apiKey, region);

//     res.status(200).json({
//       success: true,
//       message: 'Fetched job categories successfully',
//       data: categories
//     });
//   } catch (error) {
//     console.error('❌ Error fetching Zuper categories:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message || 'Failed to fetch categories',
//       code: 'FETCH_CATEGORIES_ERROR'
//     });
//   }
// });


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
          // 👇 Log the result to your backend console
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
 * GET /api/zuper/statuses
 * Fetch job statuses from Zuper
 */
// router.get('/zuper/statuses', async (req, res) => {
//   try {
//     const { apiKey, region, categoryUid } = req.query;

//     if (!apiKey || !region || !categoryUid) {
//       return res.status(400).json({
//         success: false,
//         error: 'Missing apiKey, region, or categoryUid in query params',
//         code: 'MISSING_PARAMS'
//       });
//     }

//     const statuses = await zuperService.getZuperStatuses(apiKey, region, categoryUid);

//     res.status(200).json({
//       success: true,
//       message: 'Fetched job statuses successfully',
//       data: statuses
//     });
//   } catch (error) {
//     console.error('❌ Error fetching Zuper statuses:', error);
//     res.status(500).json({
//       success: false,
//       error: error.message || 'Failed to fetch statuses',
//       code: 'FETCH_STATUSES_ERROR'
//     });
//   }
// });


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