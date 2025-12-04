/**
 * 统一错误处理工具
 * 提供标准化的错误响应格式和状态码
 */

/**
 * HTTP状态码定义
 */
const HTTP_STATUS = {
  // 成功
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  
  // 客户端错误
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // 服务器错误
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * 错误代码定义
 */
const ERROR_CODES = {
  // 认证相关
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  AUTH_ERROR: 'AUTH_ERROR',
  
  // 授权相关
  FORBIDDEN: 'FORBIDDEN',
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  
  // 资源相关
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // 请求相关
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  
  // 业务逻辑相关
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  RESOURCE_LIMIT_EXCEEDED: 'RESOURCE_LIMIT_EXCEEDED',
  
  // 外部服务相关
  LLM_ERROR: 'LLM_ERROR',
  TTS_ERROR: 'TTS_ERROR',
  IMAGE_GEN_ERROR: 'IMAGE_GEN_ERROR',
  VIDEO_GEN_ERROR: 'VIDEO_GEN_ERROR',
  OSS_ERROR: 'OSS_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  
  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/**
 * 标准错误响应格式
 * @param {number} statusCode - HTTP状态码
 * @param {string} code - 错误代码
 * @param {string} message - 错误消息
 * @param {object} details - 额外错误详情（可选）
 * @returns {object} 标准错误响应对象
 */
const createErrorResponse = (statusCode, code, message, details = null) => {
  const response = {
    success: false,
    statusCode,
    code,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (details) {
    response.details = details;
  }
  
  // 开发环境下包含错误堆栈
  if (process.env.NODE_ENV === 'development' && details?.stack) {
    response.stack = details.stack;
  }
  
  return response;
};

/**
 * 成功响应格式
 * @param {number} statusCode - HTTP状态码
 * @param {any} data - 响应数据
 * @param {string} message - 成功消息（可选）
 * @returns {object} 标准成功响应对象
 */
const createSuccessResponse = (statusCode = HTTP_STATUS.OK, data = null, message = null) => {
  const response = {
    success: true,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (message) {
    response.message = message;
  }
  
  return response;
};

/**
 * 发送错误响应
 * @param {object} res - Express响应对象
 * @param {number} statusCode - HTTP状态码
 * @param {string} code - 错误代码
 * @param {string} message - 错误消息
 * @param {object} details - 额外错误详情（可选）
 */
const sendError = (res, statusCode, code, message, details = null) => {
  const errorResponse = createErrorResponse(statusCode, code, message, details);
  res.status(statusCode).json(errorResponse);
};

/**
 * 发送成功响应
 * @param {object} res - Express响应对象
 * @param {number} statusCode - HTTP状态码
 * @param {any} data - 响应数据
 * @param {string} message - 成功消息（可选）
 */
const sendSuccess = (res, statusCode = HTTP_STATUS.OK, data = null, message = null) => {
  const successResponse = createSuccessResponse(statusCode, data, message);
  res.status(statusCode).json(successResponse);
};

/**
 * 常用错误响应快捷方法
 */
const errors = {
  // 400 Bad Request
  badRequest: (res, message = 'Bad Request', details = null) => {
    sendError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST, message, details);
  },
  
  // 401 Unauthorized
  unauthorized: (res, message = 'Authentication required', details = null) => {
    sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, message, details);
  },
  
  invalidToken: (res, message = 'Invalid token', details = null) => {
    sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_TOKEN, message, details);
  },
  
  tokenExpired: (res, message = 'Token expired', details = null) => {
    sendError(res, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED, message, details);
  },
  
  // 402 Payment Required
  insufficientFunds: (res, message = 'Insufficient AI Coins', details = null) => {
    sendError(res, HTTP_STATUS.PAYMENT_REQUIRED, ERROR_CODES.INSUFFICIENT_FUNDS, message, details);
  },
  
  // 403 Forbidden
  forbidden: (res, message = 'Access denied', details = null) => {
    sendError(res, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, message, details);
  },
  
  adminRequired: (res, message = 'Admin access required', details = null) => {
    sendError(res, HTTP_STATUS.FORBIDDEN, ERROR_CODES.ADMIN_REQUIRED, message, details);
  },
  
  // 404 Not Found
  notFound: (res, message = 'Resource not found', details = null) => {
    sendError(res, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, message, details);
  },
  
  // 409 Conflict
  conflict: (res, message = 'Resource conflict', details = null) => {
    sendError(res, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT, message, details);
  },
  
  // 422 Unprocessable Entity
  validationError: (res, message = 'Validation failed', details = null) => {
    sendError(res, HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR, message, details);
  },
  
  // 429 Too Many Requests
  tooManyRequests: (res, message = 'Too many requests', details = null) => {
    sendError(res, HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RESOURCE_LIMIT_EXCEEDED, message, details);
  },
  
  // 500 Internal Server Error
  internalError: (res, message = 'Internal Server Error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, message, details);
  },
  
  // 502 Bad Gateway
  badGateway: (res, message = 'Bad Gateway', details = null) => {
    sendError(res, HTTP_STATUS.BAD_GATEWAY, ERROR_CODES.EXTERNAL_API_ERROR, message, details);
  },
  
  // 503 Service Unavailable
  serviceUnavailable: (res, message = 'Service Unavailable', details = null) => {
    sendError(res, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.SERVICE_UNAVAILABLE, message, details);
  },
  
  // 业务逻辑错误
  llmError: (res, message = 'LLM service error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.LLM_ERROR, message, details);
  },
  
  llmAuthError: (res, message = 'LLM API authentication failed', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.LLM_ERROR, message, details);
  },
  
  ttsError: (res, message = 'TTS service error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.TTS_ERROR, message, details);
  },
  
  imageGenError: (res, message = 'Image generation error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.IMAGE_GEN_ERROR, message, details);
  },
  
  videoGenError: (res, message = 'Video generation error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.VIDEO_GEN_ERROR, message, details);
  },
  
  ossError: (res, message = 'OSS service error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.OSS_ERROR, message, details);
  },
  
  databaseError: (res, message = 'Database error', details = null) => {
    sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_ERROR, message, details);
  },
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  sendError,
  sendSuccess,
  errors,
};

