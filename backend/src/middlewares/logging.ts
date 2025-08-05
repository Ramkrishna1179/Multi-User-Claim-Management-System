import { Request, Response, NextFunction } from 'express';
import { apiLogger } from '../config/logger';

interface LoggedRequest extends Request {
  startTime?: number;
  user?: any;
}

export const apiLoggingMiddleware = (req: LoggedRequest, res: Response, next: NextFunction) => {
  // Capture start time
  req.startTime = Date.now();

  // Log request
  apiLogger.info('API Request', {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    userRole: req.user?.role,
    body: req.method !== 'GET' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    headers: {
      'content-type': req.get('Content-Type'),
      authorization: req.get('Authorization') ? 'Bearer ***' : undefined
    }
  });

  // Capture original send method
  const originalSend = res.send;

  // Override send method to log response
  res.send = function(data) {
    const responseTime = Date.now() - (req.startTime || 0);
    
    apiLogger.info('API Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId: req.user?._id,
      userRole: req.user?.role,
      responseSize: data ? JSON.stringify(data).length : 0
    });

    // Call original send method
    return originalSend.call(this, data);
  };

  next();
};

export const errorLoggingMiddleware = (error: any, req: LoggedRequest, res: Response, next: NextFunction) => {
  const responseTime = Date.now() - (req.startTime || 0);
  
  apiLogger.error('API Error', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode || 500,
    responseTime: `${responseTime}ms`,
    userId: req.user?._id,
    userRole: req.user?.role,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });

  next(error);
}; 