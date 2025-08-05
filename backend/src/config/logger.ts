import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Get log retention days from environment (default: 7 days)
const logRetentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '7');

// For testing: Use minute-based rotation instead of daily
// Change this to 'YYYY-MM-DD-HH-mm' for minute-based rotation
const datePattern = process.env.LOG_ROTATION_PATTERN || 'YYYY-MM-DD';
const maxFiles = process.env.LOG_ROTATION_PATTERN === 'YYYY-MM-DD-HH-mm' 
  ? `${logRetentionDays}m` 
  : `${logRetentionDays}d`;

// Create daily rotate file transport for combined logs
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: datePattern,
  maxSize: '20m',
  maxFiles: maxFiles,
  format: logFormat,
  level: 'info'
});

// Create daily rotate file transport for error logs
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: datePattern,
  maxSize: '20m',
  maxFiles: maxFiles,
  format: logFormat,
  level: 'error'
});

// Create daily rotate file transport for API logs
const apiFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'api-%DATE%.log'),
  datePattern: datePattern,
  maxSize: '20m',
  maxFiles: maxFiles,
  format: logFormat,
  level: 'info'
});

// Create daily rotate file transport for socket logs
const socketFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'socket-%DATE%.log'),
  datePattern: datePattern,
  maxSize: '20m',
  maxFiles: maxFiles,
  format: logFormat,
  level: 'info'
});

// Create daily rotate file transport for database logs
const dbFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'database-%DATE%.log'),
  datePattern: datePattern,
  maxSize: '20m',
  maxFiles: maxFiles,
  format: logFormat,
  level: 'info'
});

// Create the main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'claim-management-backend' },
  transports: [
    combinedFileTransport,
    errorFileTransport
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: datePattern,
      maxSize: '20m',
      maxFiles: maxFiles,
      format: logFormat
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: datePattern,
      maxSize: '20m',
      maxFiles: maxFiles,
      format: logFormat
    })
  ]
});

// Create specialized loggers
export const apiLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'api' },
  transports: [apiFileTransport]
});

export const socketLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'socket' },
  transports: [socketFileTransport]
});

export const dbLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'database' },
  transports: [dbFileTransport]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
  
  apiLogger.add(new winston.transports.Console({
    format: consoleFormat
  }));
  
  socketLogger.add(new winston.transports.Console({
    format: consoleFormat
  }));
  
  dbLogger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Log startup information
logger.info('Logger initialized', {
  logRetentionDays,
  datePattern,
  maxFiles,
  logsDirectory: logsDir,
  environment: process.env.NODE_ENV || 'development'
});

export default logger; 