const Joi = require('joi');

// Validation schemas
const conversationSchema = Joi.object({
  id: Joi.string(),
  title: Joi.string().required().min(1).max(200),
  messages: Joi.array().items(
    Joi.object({
      id: Joi.string(),
      content: Joi.string().required(),
      role: Joi.string().valid('user', 'assistant').required(),
      timestamp: Joi.date(),
      agentType: Joi.string().valid('openai', 'claude', 'gemini'),
      context: Joi.string(),
      metadata: Joi.object()
    })
  ).default([]),
  activeAgents: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().valid('openai', 'claude', 'gemini').required(),
      isEnabled: Joi.boolean().default(true)
    })
  ).default([]),
  characterName: Joi.string().allow(null),
  fractalDepth: Joi.number().integer().min(0).max(10).default(0),
  createdAt: Joi.date(),
  updatedAt: Joi.date(),
  metadata: Joi.object().default({})
});

const documentSchema = Joi.object({
  id: Joi.string(),
  title: Joi.string().required().min(1).max(200),
  content: Joi.string().required(),
  filePath: Joi.string().required(),
  fileType: Joi.string().required().max(10),
  dateAdded: Joi.date(),
  totalPages: Joi.number().integer().min(1).required(),
  currentPage: Joi.number().integer().min(0).default(0),
  pages: Joi.array().items(Joi.string()).required(),
  bookmarks: Joi.array().items(Joi.number().integer()).default([]),
  highlights: Joi.array().items(
    Joi.object({
      pageNumber: Joi.number().integer().required(),
      startIndex: Joi.number().integer().required(),
      endIndex: Joi.number().integer().required(),
      text: Joi.string().required(),
      color: Joi.string().default('yellow'),
      timestamp: Joi.date().default(() => new Date())
    })
  ).default([]),
  notes: Joi.array().items(
    Joi.object({
      pageNumber: Joi.number().integer().required(),
      content: Joi.string().required(),
      timestamp: Joi.date().default(() => new Date())
    })
  ).default([]),
  metadata: Joi.object().default({})
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'title', 'dateAdded').default('updatedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Validation middleware functions
const validateConversation = (req, res, next) => {
  const { error, value } = conversationSchema.validate(req.body, {
    allowUnknown: false,
    stripUnknown: true
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  req.body = value;
  next();
};

const validateDocument = (req, res, next) => {
  const { error, value } = documentSchema.validate(req.body, {
    allowUnknown: false,
    stripUnknown: true
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  req.body = value;
  next();
};

const validatePagination = (req, res, next) => {
  const { error, value } = paginationSchema.validate(req.query, {
    allowUnknown: true,
    stripUnknown: false
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid pagination parameters',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Update query with validated values
  Object.assign(req.query, value);
  next();
};

// Custom validation for specific fields
const validateObjectId = (id) => {
  const ObjectId = require('mongodb').ObjectId;
  return ObjectId.isValid(id);
};

const validateFileType = (fileType) => {
  const allowedTypes = [
    'txt', 'md', 'markdown', 'json', 'log', 'csv', 'epub',
    'html', 'htm', 'xml', 'rtf', 'py', 'js', 'dart', 'java',
    'cpp', 'c', 'h', 'css', 'scss', 'yml', 'yaml', 'toml', 'ini'
  ];
  return allowedTypes.includes(fileType.toLowerCase());
};

const validateMessageRole = (role) => {
  return ['user', 'assistant'].includes(role);
};

const validateAgentType = (type) => {
  return ['openai', 'claude', 'gemini'].includes(type);
};

// Sanitization helpers
const sanitizeHtml = (text) => {
  // Basic HTML sanitization - remove script tags and dangerous content
  return text
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

const sanitizeText = (text) => {
  // Remove potential XSS and normalize whitespace
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

module.exports = {
  validateConversation,
  validateDocument,
  validatePagination,
  validateObjectId,
  validateFileType,
  validateMessageRole,
  validateAgentType,
  sanitizeHtml,
  sanitizeText,
  schemas: {
    conversationSchema,
    documentSchema,
    paginationSchema
  }
};