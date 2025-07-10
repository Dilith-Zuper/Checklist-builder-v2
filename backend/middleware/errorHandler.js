const fs = require('fs-extra');

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
  // Default error response
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: {
      message: 'Something went wrong on our end. Please try again later.',
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  };

  // Log error for debugging
  console.error('❌ Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorResponse = {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        message: error.message,
        errors: error.details || []
      }
    };
  } else if (error.code === 'OPENAI_ERROR') {
    statusCode = 502;
    errorResponse = {
      success: false,
      error: 'AI processing failed',
      code: 'OPENAI_ERROR',
      details: {
        message: 'Failed to process your request with AI. Please try again or check your Excel file format.',
        originalError: error.message
      }
    };
  } else if (error.code === 'ZUPER_API_ERROR') {
    statusCode = 502;
    errorResponse = {
      success: false,
      error: 'Zuper API error',
      code: 'ZUPER_API_ERROR',
      details: {
        message: 'Failed to submit to Zuper. Please check your API key and configuration.',
        originalError: error.message,
        statusCode: error.statusCode || 'unknown'
      }
    };
  } else if (error.code === 'EXCEL_PARSE_ERROR') {
    statusCode = 400;
    errorResponse = {
      success: false,
      error: 'Excel file parsing failed',
      code: 'EXCEL_PARSE_ERROR',
      details: {
        message: 'Unable to read the Excel file. Please ensure it\'s a valid .xlsx or .xls file with the correct format.',
        originalError: error.message
      }
    };
  } else if (error.code === 'FILE_NOT_FOUND') {
    statusCode = 404;
    errorResponse = {
      success: false,
      error: 'File not found',
      code: 'FILE_NOT_FOUND',
      details: {
        message: 'The uploaded file could not be found. Please try uploading again.',
        originalError: error.message
      }
    };
  } else if (error.code === 'TIMEOUT_ERROR') {
    statusCode = 408;
    errorResponse = {
      success: false,
      error: 'Request timeout',
      code: 'TIMEOUT_ERROR',
      details: {
        message: 'The request took too long to process. Please try again with a smaller file.',
        originalError: error.message
      }
    };
  } else if (error.code === 'RATE_LIMIT_ERROR') {
    statusCode = 429;
    errorResponse = {
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_ERROR',
      details: {
        message: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: error.retryAfter || '60 seconds'
      }
    };
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    statusCode = 400;
    errorResponse = {
      success: false,
      error: 'Invalid JSON format',
      code: 'INVALID_JSON',
      details: {
        message: 'The request contains invalid JSON data.',
        originalError: error.message
      }
    };
  } else if (error.code === 'ENOENT') {
    statusCode = 404;
    errorResponse = {
      success: false,
      error: 'File not found',
      code: 'FILE_NOT_FOUND',
      details: {
        message: 'The requested file does not exist.',
        originalError: error.message
      }
    };
  } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    statusCode = 503;
    errorResponse = {
      success: false,
      error: 'Server overloaded',
      code: 'SERVER_OVERLOADED',
      details: {
        message: 'Server is currently overloaded. Please try again later.',
        originalError: 'Too many open files'
      }
    };
  }

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details.stack = error.stack;
  }

  // Cleanup uploaded file if error occurred during processing
  if (req.file && req.file.path) {
    fs.remove(req.file.path).catch(cleanupError => {
      console.error('❌ Failed to cleanup uploaded file:', cleanupError);
    });
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch and forward errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom error with code
 */
const createError = (message, code, statusCode = 500) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  errorHandler,
  asyncHandler,
  createError
};