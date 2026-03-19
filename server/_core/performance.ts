import { Request, Response, NextFunction } from 'express';

/**
 * Performance optimization middleware
 */

// Cache headers configuration
const CACHE_CONFIG = {
  // Static assets: 1 year
  static: 'public, max-age=31536000, immutable',
  // API responses: 5 minutes
  api: 'public, max-age=300',
  // User data: no cache
  user: 'private, no-cache, no-store, must-revalidate',
  // Leaderboard: 30 seconds
  leaderboard: 'public, max-age=30',
};

/**
 * Set appropriate cache headers based on route
 */
export function cacheHeaders(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  if (path.startsWith('/api/trpc')) {
    // API routes - short cache
    if (path.includes('leaderboard')) {
      res.set('Cache-Control', CACHE_CONFIG.leaderboard);
    } else if (path.includes('stats') || path.includes('user')) {
      res.set('Cache-Control', CACHE_CONFIG.user);
    } else {
      res.set('Cache-Control', CACHE_CONFIG.api);
    }
  } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    // Static assets
    res.set('Cache-Control', CACHE_CONFIG.static);
  }

  // Security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');

  next();
}

/**
 * Compression middleware (gzip)
 */
export function compressionConfig() {
  return {
    level: 6, // Balance between compression ratio and speed
    threshold: 1024, // Only compress responses > 1KB
    filter: (req: Request, res: Response) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      return true;
    },
  };
}

/**
 * Response time tracking
 */
export function responseTimeTracker(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.path;
    const method = req.method;
    const status = res.statusCode;

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`[SLOW] ${method} ${path} - ${status} - ${duration}ms`);
    }

    // Add response time header
    res.set('X-Response-Time', `${duration}ms`);
  });

  next();
}

/**
 * Database query optimization hints
 */
export const DB_QUERY_HINTS = {
  // Indexes to create for better performance
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC)',
    'CREATE INDEX IF NOT EXISTS idx_players_accuracy ON players(accuracy DESC)',
    'CREATE INDEX IF NOT EXISTS idx_online_sessions_user ON online_sessions(userId)',
    'CREATE INDEX IF NOT EXISTS idx_online_sessions_created ON online_sessions(createdAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user ON puzzle_attempts(userId)',
    'CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_created ON puzzle_attempts(createdAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_cycle_history_user ON cycle_history(userId)',
    'CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles(rating)',
  ],
};

/**
 * Connection pool optimization
 */
export const DB_POOL_CONFIG = {
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
};

/**
 * API rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Health check endpoint
 */
export async function healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(server: any) {
  const shutdown = async () => {
    console.log('🛑 Graceful shutdown initiated...');
    
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('❌ Forced shutdown');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
