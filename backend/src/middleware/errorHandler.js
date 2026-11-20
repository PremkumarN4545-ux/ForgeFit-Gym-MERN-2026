import { env } from '../config/env.js';

const DUPLICATE_MESSAGES = {
  email: 'A member with this email already exists',
  name: 'A plan with this name already exists',
  transactionRef: 'A payment with this transaction reference already exists',
};

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Validation failed';
    errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = field === 'email' && req.originalUrl.startsWith('/api/auth/member/register')
      ? 'An account with this email is already registered'
      : DUPLICATE_MESSAGES[field] || `Duplicate value for ${field}`;
    errors = { [field]: message };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  } else if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
    status = 503;
    message = 'Database is unavailable';
  }

  if (status >= 500) {
    console.error(err);
    if (env.nodeEnv === 'production') message = 'Internal server error';
  }

  res.status(status).json({ message, ...(errors ? { errors } : {}) });
}
