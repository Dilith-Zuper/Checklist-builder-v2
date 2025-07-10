/**
 * Utility helper functions for the Zuper Checklist Backend
 */

/**
 * Generate a unique request ID
 * @returns {string} - Unique identifier
 */
const generateRequestId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${randomStr}`;
};

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size (e.g., "2.5 MB")
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Sanitize filename for safe storage
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  // Remove/replace unsafe characters
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Check if string is valid JSON
 * @param {string} str - String to check
 * @returns {boolean} - Whether string is valid JSON
 */
const isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after sleep
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} - Truncated string
 */
const truncateString = (str, length, suffix = '...') => {
  if (!str || str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
};

/**
 * Get current timestamp in ISO format
 * @returns {string} - ISO timestamp
 */
const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Convert camelCase to snake_case
 * @param {string} str - camelCase string
 * @returns {string} - snake_case string
 */
const camelToSnake = (str) => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

/**
 * Convert snake_case to camelCase
 * @param {string} str - snake_case string
 * @returns {string} - camelCase string
 */
const snakeToCamel = (str) => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether URL is valid
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Extract file extension from filename
 * @param {string} filename - Filename
 * @returns {string} - File extension (without dot)
 */
const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

/**
 * Check if file extension is allowed
 * @param {string} filename - Filename to check
 * @param {Array} allowedExtensions - Array of allowed extensions
 * @returns {boolean} - Whether extension is allowed
 */
const isAllowedFileExtension = (filename, allowedExtensions = ['xlsx', 'xls']) => {
  const extension = getFileExtension(filename);
  return allowedExtensions.includes(extension);
};

/**
 * Generate random string of specified length
 * @param {number} length - Length of string
 * @param {string} charset - Character set to use
 * @returns {string} - Random string
 */
const generateRandomString = (length = 8, charset = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
};

/**
 * Mask sensitive data in strings (for logging)
 * @param {string} str - String containing sensitive data
 * @param {Array} sensitiveKeys - Keys that should be masked
 * @returns {string} - String with masked sensitive data
 */
const maskSensitiveData = (str, sensitiveKeys = ['apikey', 'api_key', 'key', 'token', 'password']) => {
  let maskedStr = str;
  
  sensitiveKeys.forEach(key => {
    const regex = new RegExp(`(${key}['"\\s]*[:=]['"\\s]*)[^'"\\s,}]+`, 'gi');
    maskedStr = maskedStr.replace(regex, '$1***MASKED***');
  });
  
  return maskedStr;
};

/**
 * Parse and validate positive integer
 * @param {string|number} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} - Parsed positive integer
 */
const parsePositiveInt = (value, defaultValue = 0) => {
  const parsed = parseInt(value, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : defaultValue;
};

/**
 * Calculate processing time
 * @param {Date} startTime - Start time
 * @returns {string} - Processing time in human readable format
 */
const calculateProcessingTime = (startTime) => {
  const endTime = new Date();
  const diffMs = endTime - startTime;
  
  if (diffMs < 1000) {
    return `${diffMs}ms`;
  } else if (diffMs < 60000) {
    return `${(diffMs / 1000).toFixed(1)}s`;
  } else {
    return `${(diffMs / 60000).toFixed(1)}m`;
  }
};

/**
 * Clean up object by removing null/undefined values
 * @param {Object} obj - Object to clean
 * @returns {Object} - Cleaned object
 */
const cleanObject = (obj) => {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedNested = cleanObject(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  
  return cleaned;
};

/**
 * Convert string to boolean with multiple valid inputs
 * @param {string|boolean|number} value - Value to convert
 * @returns {boolean} - Boolean value
 */
const stringToBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    return ['true', 'yes', '1', 'on', 'enabled'].includes(lowerValue);
  }
  return false;
};

module.exports = {
  generateRequestId,
  formatFileSize,
  sanitizeFilename,
  isValidJSON,
  deepClone,
  sleep,
  truncateString,
  getCurrentTimestamp,
  camelToSnake,
  snakeToCamel,
  isValidEmail,
  isValidUrl,
  getFileExtension,
  isAllowedFileExtension,
  generateRandomString,
  maskSensitiveData,
  parsePositiveInt,
  calculateProcessingTime,
  cleanObject,
  stringToBoolean
};