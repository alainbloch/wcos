/**
 * Error Handling Middleware
 */
import config from '../config/index.js';

export function errorHandler(error, request, reply) {
  request.log.error(error);

  const statusCode = error.statusCode || error.status || 500;
  const message = config.nodeEnv === 'production'
    ? 'Internal Server Error'
    : error.message;

  reply.code(statusCode).send({
    error: {
      message,
      statusCode,
      ...(config.nodeEnv !== 'production' && { stack: error.stack }),
    },
  });
}

export function notFoundHandler(request, reply) {
  reply.code(404).send({
    error: {
      message: 'Route not found',
      statusCode: 404,
    },
  });
}

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}