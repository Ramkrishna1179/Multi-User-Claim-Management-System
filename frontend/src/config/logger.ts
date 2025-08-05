// Browser-compatible logger for frontend
interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  data?: any;
}

class BrowserLogger {
  private maxLogs: number;
  private logKey: string;
  private retentionMinutes: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxLogs: number = 1000, retentionMinutes: number = 1) { // 10080 minutes = 7 days
    this.maxLogs = maxLogs;
    this.retentionMinutes = retentionMinutes;
    this.logKey = 'app_logs';
    
    // Start periodic cleanup every minute
    this.startPeriodicCleanup();
  }

  private startPeriodicCleanup() {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldLogs();
    }, 60000); // 60 seconds = 1 minute
  }

  private cleanupOldLogs() {
    try {
      const logs = this.getLogs();
      const cutoffTime = new Date(Date.now() - (this.retentionMinutes * 60 * 1000));
      const filteredLogs = logs.filter(log => new Date(log.timestamp) > cutoffTime);
      
      if (filteredLogs.length !== logs.length) {
        console.log(`🧹 Cleaned up ${logs.length - filteredLogs.length} old log entries`);
        localStorage.setItem(this.logKey, JSON.stringify(filteredLogs));
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  private addLog(level: LogEntry['level'], message: string, data?: any) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    try {
      const existingLogs = this.getLogs();
      existingLogs.push(logEntry);
      
      // Clean old logs based on retention time
      const cutoffTime = new Date(Date.now() - (this.retentionMinutes * 60 * 1000));
      const filteredLogs = existingLogs.filter(log => new Date(log.timestamp) > cutoffTime);
      
      // Keep only the latest logs (maxLogs limit)
      if (filteredLogs.length > this.maxLogs) {
        filteredLogs.splice(0, filteredLogs.length - this.maxLogs);
      }
      
      localStorage.setItem(this.logKey, JSON.stringify(filteredLogs));
    } catch (error) {
      console.error('Failed to save log to localStorage:', error);
    }

    // Also log to console
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warn' ? 'warn' : 
                         level === 'debug' ? 'debug' : 'log';
    
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, data || '');
  }

  private getLogs(): LogEntry[] {
    try {
      const logs = localStorage.getItem(this.logKey);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to read logs from localStorage:', error);
      return [];
    }
  }

  error(message: string, data?: any) {
    this.addLog('error', message, data);
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
  }

  debug(message: string, data?: any) {
    this.addLog('debug', message, data);
  }

  // Method to get logs for debugging
  getLogsForLevel(level?: LogEntry['level']): LogEntry[] {
    const logs = this.getLogs();
    return level ? logs.filter(log => log.level === level) : logs;
  }

  // Method to clear logs
  clearLogs() {
    try {
      localStorage.removeItem(this.logKey);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  // Method to export logs
  exportLogs(): string {
    return JSON.stringify(this.getLogs(), null, 2);
  }

  // Method to manually trigger cleanup
  cleanup() {
    this.cleanupOldLogs();
  }

  // Method to create test logs with old timestamps (for testing cleanup)
  createTestLogs() {
    const now = new Date();
    const oldTime = new Date(now.getTime() - (2 * 60 * 1000)); // 2 minutes ago
    const newTime = new Date(now.getTime() - (30 * 1000)); // 30 seconds ago
    
    const testLogs: LogEntry[] = [
      {
        timestamp: oldTime.toISOString(),
        level: 'info',
        message: 'This is an old log entry (2 minutes ago)',
        data: { test: true, age: 'old' }
      },
      {
        timestamp: newTime.toISOString(),
        level: 'info', 
        message: 'This is a recent log entry (30 seconds ago)',
        data: { test: true, age: 'recent' }
      },
      {
        timestamp: now.toISOString(),
        level: 'info',
        message: 'This is a current log entry',
        data: { test: true, age: 'current' }
      }
    ];

    try {
      const existingLogs = this.getLogs();
      const allLogs = [...existingLogs, ...testLogs];
      localStorage.setItem(this.logKey, JSON.stringify(allLogs));
      console.log('✅ Test logs created. Run cleanup() to remove old ones.');
    } catch (error) {
      console.error('Failed to create test logs:', error);
    }
  }

  // Method to stop the logger and cleanup interval
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Get retention minutes from environment (default: 7 days = 10080 minutes)
const retentionMinutes = parseInt(process.env.REACT_APP_LOG_RETENTION_MINUTES || '10080');

// Create logger instances
const logger = new BrowserLogger(1000, retentionMinutes);
const apiLogger = new BrowserLogger(1000, retentionMinutes);
const socketLogger = new BrowserLogger(1000, retentionMinutes);
const userActionLogger = new BrowserLogger(1000, retentionMinutes);

export { logger, apiLogger, socketLogger, userActionLogger };
export default logger; 