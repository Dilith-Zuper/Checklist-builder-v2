const Joi = require('joi');

// Validation schemas
const extractRequestSchema = Joi.object({
  categoryUid: Joi.string().required().min(1).max(255).messages({
    'string.empty': 'Category UID is required',
    'any.required': 'Category UID is required'
  }),
  statusUid: Joi.string().required().min(1).max(255).messages({
    'string.empty': 'Status UID is required',
    'any.required': 'Status UID is required'
  }),
  apiKey: Joi.string().required().min(1).messages({
    'string.empty': 'API Key is required',
    'any.required': 'API Key is required'
  }),
  region: Joi.string().required().min(1).max(50).messages({
    'string.empty': 'Region is required',
    'any.required': 'Region is required'
  })
});

const checklistItemSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  question: Joi.string().required().min(1).max(500).messages({
    'string.empty': 'Question text is required',
    'any.required': 'Question text is required'
  }),
  type: Joi.string().required().valid(
    'textArea', 'textField', 'date', 'time', 'dateTime',
    'dropdown', 'checkbox', 'radio', 'multiImage', 'signature','header'
  ).messages({
    'any.only': 'Invalid question type. Must be one of: textArea, textField, date, time, dateTime, dropdown, checkbox, radio, multiImage, signature,header'
  }),
  options: Joi.string().allow('').default(''),
  required: Joi.boolean().required(),
  
  // ADD THESE DEPENDENCY FIELDS:
  isDependent: Joi.boolean().optional().default(false),
  dependentOn: Joi.string().optional().allow('').default(''),
  dependentOptions: Joi.string().optional().allow('').default('')
});

const submitRequestSchema = Joi.object({
  checklist: Joi.array().items(checklistItemSchema).min(1).required().messages({
    'array.min': 'At least one checklist item is required'
  }),
  config: Joi.object({
    categoryUid: Joi.string().required().min(1).max(255),
    statusUid: Joi.string().required().min(1).max(255),
    apiKey: Joi.string().required().min(1),
    region: Joi.string().required().min(1).max(50)
  }).required()
});

// Validation middleware functions
const validateExtractRequest = (req, res, next) => {
  try {
    const { error, value } = extractRequestSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          message: 'Please check the required fields',
          errors: validationErrors
        }
      });
    }

    req.body = value;
    next();
  } catch (error) {
    console.error('❌ Validation error:', error);
    next(error);
  }
};

const validateSubmitRequest = (req, res, next) => {
  try {
    const { error, value } = submitRequestSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          message: 'Please check the checklist data and configuration',
          errors: validationErrors
        }
      });
    }

    // Additional validation for checklist items
    const duplicateIds = findDuplicateIds(value.checklist);
    if (duplicateIds.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate checklist item IDs found',
        code: 'DUPLICATE_IDS',
        details: {
          message: 'Each checklist item must have a unique ID',
          duplicateIds: duplicateIds
        }
      });
    }

    req.body = value;
    next();
  } catch (error) {
    console.error('❌ Validation error:', error);
    next(error);
  }
};

// Helper function to find duplicate IDs
const findDuplicateIds = (checklist) => {
  const ids = checklist.map(item => item.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  return [...new Set(duplicates)];
};

// Validation helper for individual fields
const validateField = (value, schema, fieldName) => {
  const { error } = schema.validate(value);
  if (error) {
    throw new Error(`Invalid ${fieldName}: ${error.details[0].message}`);
  }
  return true;
};

// Export validation schemas for reuse
const schemas = {
  extractRequest: extractRequestSchema,
  submitRequest: submitRequestSchema,
  checklistItem: checklistItemSchema
};

module.exports = {
  validateExtractRequest,
  validateSubmitRequest,
  validateField,
  schemas
};