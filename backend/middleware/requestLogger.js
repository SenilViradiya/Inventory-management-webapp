const fs = require('fs');
const path = require('path');

/**
 * Request/Response Logging Middleware
 * Configurable via environment variables for debugging API requests and responses
 */

class RequestLogger {
    constructor() {
        // Configuration from environment variables
        this.config = {
            enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
            enableResponseLogging: process.env.ENABLE_RESPONSE_LOGGING === 'true',
            enablePayloadLogging: process.env.ENABLE_PAYLOAD_LOGGING === 'true',
            logRequestHeaders: process.env.LOG_REQUEST_HEADERS === 'true',
            logResponseHeaders: process.env.LOG_RESPONSE_HEADERS === 'true',
            logSensitiveData: process.env.LOG_SENSITIVE_DATA === 'true',
            maxLogSize: parseInt(process.env.MAX_LOG_SIZE) || 10000,
            excludeRoutes: (process.env.EXCLUDE_ROUTES || '').split(',').map(route => route.trim()),
            nodeEnv: process.env.NODE_ENV || 'development'
        };

        // Create logs directory if it doesn't exist
        this.logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        // Sensitive fields to mask when logSensitiveData is false
        this.sensitiveFields = [
            'password', 'token', 'authorization', 'jwt', 'secret', 'key',
            'auth', 'credential', 'pass', 'pwd', 'email', 'phone'
        ];
    }

    /**
     * Check if route should be excluded from logging
     */
    shouldExclude(url) {
        return this.config.excludeRoutes.some(route => 
            route && url.includes(route)
        );
    }

    /**
     * Sanitize sensitive data
     */
    sanitizeData(data, depth = 0) {
        if (depth > 5) return '[Max Depth Reached]'; // Prevent infinite recursion
        
        if (!this.config.logSensitiveData && data && typeof data === 'object') {
            const sanitized = Array.isArray(data) ? [] : {};
            
            for (const [key, value] of Object.entries(data)) {
                const keyLower = key.toLowerCase();
                const isSensitive = this.sensitiveFields.some(field => 
                    keyLower.includes(field)
                );
                
                if (isSensitive) {
                    sanitized[key] = '[MASKED]';
                } else if (value && typeof value === 'object') {
                    sanitized[key] = this.sanitizeData(value, depth + 1);
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        
        return data;
    }

    /**
     * Truncate data if it exceeds max log size
     */
    truncateData(data) {
        const dataStr = JSON.stringify(data);
        if (dataStr.length > this.config.maxLogSize) {
            return {
                truncated: true,
                size: dataStr.length,
                data: dataStr.substring(0, this.config.maxLogSize) + '...[TRUNCATED]'
            };
        }
        return data;
    }

    /**
     * Format log entry
     */
    formatLogEntry(type, req, res, data = {}) {
        const timestamp = new Date().toISOString();
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        
        const logEntry = {
            timestamp,
            type,
            method: req.method,
            url: req.originalUrl,
            ip,
            userAgent,
            ...data
        };

        return logEntry;
    }

    /**
     * Write log to file
     */
    writeLog(logEntry) {
        if (this.config.nodeEnv === 'production') {
            // In production, you might want to use a proper logging service
            const logFile = path.join(this.logsDir, `api-${new Date().toISOString().split('T')[0]}.log`);
            const logLine = JSON.stringify(logEntry) + '\n';
            
            fs.appendFile(logFile, logLine, (err) => {
                if (err) console.error('Error writing to log file:', err);
            });
        } else {
            // In development, log to console with better formatting
            console.log('\n' + '='.repeat(80));
            console.log(`[${logEntry.type}] ${logEntry.method} ${logEntry.url}`);
            console.log('Time:', logEntry.timestamp);
            console.log('IP:', logEntry.ip);
            
            if (logEntry.requestHeaders) {
                console.log('Request Headers:', JSON.stringify(logEntry.requestHeaders, null, 2));
            }
            
            if (logEntry.requestBody) {
                console.log('Request Body:', JSON.stringify(logEntry.requestBody, null, 2));
            }
            
            if (logEntry.queryParams) {
                console.log('Query Params:', JSON.stringify(logEntry.queryParams, null, 2));
            }
            
            if (logEntry.responseHeaders) {
                console.log('Response Headers:', JSON.stringify(logEntry.responseHeaders, null, 2));
            }
            
            if (logEntry.responseBody) {
                console.log('Response Body:', JSON.stringify(logEntry.responseBody, null, 2));
            }
            
            if (logEntry.statusCode) {
                console.log('Status Code:', logEntry.statusCode);
            }
            
            if (logEntry.responseTime) {
                console.log('Response Time:', `${logEntry.responseTime}ms`);
            }
            
            console.log('='.repeat(80) + '\n');
        }
    }

    /**
     * Main middleware function
     */
    middleware() {
        return (req, res, next) => {
            // Skip if logging is disabled or route is excluded
            if (!this.config.enableRequestLogging && !this.config.enableResponseLogging) {
                return next();
            }

            if (this.shouldExclude(req.originalUrl)) {
                return next();
            }

            const startTime = Date.now();

            // Log incoming request
            if (this.config.enableRequestLogging) {
                const requestData = {};

                if (this.config.logRequestHeaders) {
                    requestData.requestHeaders = this.sanitizeData(req.headers);
                }

                if (this.config.enablePayloadLogging) {
                    if (req.body && Object.keys(req.body).length > 0) {
                        requestData.requestBody = this.truncateData(this.sanitizeData(req.body));
                    }

                    if (req.query && Object.keys(req.query).length > 0) {
                        requestData.queryParams = this.sanitizeData(req.query);
                    }

                    if (req.params && Object.keys(req.params).length > 0) {
                        requestData.routeParams = req.params;
                    }
                }

                const requestLog = this.formatLogEntry('REQUEST', req, res, requestData);
                this.writeLog(requestLog);
            }

            // Capture response
            if (this.config.enableResponseLogging) {
                const originalJson = res.json;
                const originalSend = res.send;
                let responseBody = null;

                // Override res.json to capture response
                res.json = function(obj) {
                    responseBody = obj;
                    return originalJson.call(this, obj);
                };

                // Override res.send to capture response
                res.send = function(body) {
                    if (!responseBody) {
                        try {
                            responseBody = typeof body === 'string' ? JSON.parse(body) : body;
                        } catch (e) {
                            responseBody = body;
                        }
                    }
                    return originalSend.call(this, body);
                };

                // Log response when finished
                res.on('finish', () => {
                    const endTime = Date.now();
                    const responseTime = endTime - startTime;

                    const responseData = {
                        statusCode: res.statusCode,
                        responseTime
                    };

                    if (this.config.logResponseHeaders) {
                        responseData.responseHeaders = res.getHeaders();
                    }

                    if (this.config.enablePayloadLogging && responseBody) {
                        responseData.responseBody = this.truncateData(this.sanitizeData(responseBody));
                    }

                    const responseLog = this.formatLogEntry('RESPONSE', req, res, responseData);
                    this.writeLog(responseLog);
                });
            }

            next();
        };
    }
}

// Export singleton instance
const requestLogger = new RequestLogger();
module.exports = requestLogger.middleware();
