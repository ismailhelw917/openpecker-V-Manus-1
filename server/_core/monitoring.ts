import { trackEvent } from './counter-api';

/**
 * Monitoring and uptime tracking
 */

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  responseTime: number;
  dbConnected: boolean;
  errorRate: number;
  requestsPerSecond: number;
}

class HealthMonitor {
  private metrics = {
    requests: 0,
    errors: 0,
    totalResponseTime: 0,
    lastCheck: Date.now(),
  };

  private dbConnected = true;

  recordRequest(responseTime: number, error: boolean = false) {
    this.metrics.requests++;
    this.metrics.totalResponseTime += responseTime;
    if (error) {
      this.metrics.errors++;
    }
  }

  setDbStatus(connected: boolean) {
    this.dbConnected = connected;
  }

  getMetrics(): HealthMetrics {
    const now = Date.now();
    const timeDiff = (now - this.metrics.lastCheck) / 1000; // seconds

    const avgResponseTime = this.metrics.requests > 0 
      ? this.metrics.totalResponseTime / this.metrics.requests 
      : 0;

    const errorRate = this.metrics.requests > 0 
      ? (this.metrics.errors / this.metrics.requests) * 100 
      : 0;

    const rps = timeDiff > 0 ? this.metrics.requests / timeDiff : 0;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!this.dbConnected || errorRate > 10) {
      status = 'unhealthy';
    } else if (errorRate > 5 || avgResponseTime > 2000) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: avgResponseTime,
      dbConnected: this.dbConnected,
      errorRate,
      requestsPerSecond: rps,
    };
  }

  reset() {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      lastCheck: Date.now(),
    };
  }
}

export const healthMonitor = new HealthMonitor();

/**
 * Track health metrics periodically
 */
export function startHealthTracking(interval: number = 60000) {
  setInterval(async () => {
    const metrics = healthMonitor.getMetrics();

    // Track via Counter API
    await trackEvent('health_check', {
      status: metrics.status,
      uptime: Math.floor(metrics.uptime).toString(),
      responseTime: Math.round(metrics.responseTime).toString(),
      errorRate: metrics.errorRate.toFixed(2),
      rps: metrics.requestsPerSecond.toFixed(2),
    });

    // Alert on unhealthy status
    if (metrics.status === 'unhealthy') {
      console.error('🚨 UNHEALTHY STATUS DETECTED', metrics);
      await trackEvent('health_alert_unhealthy', {
        details: JSON.stringify(metrics),
      });
    } else if (metrics.status === 'degraded') {
      console.warn('⚠️ DEGRADED STATUS', metrics);
      await trackEvent('health_alert_degraded', {
        details: JSON.stringify(metrics),
      });
    }

    // Reset counters for next interval
    healthMonitor.reset();
  }, interval);
}

/**
 * Uptime SLA tracking
 */
export class UptimeSLA {
  private startTime = Date.now();
  private downtime = 0;
  private lastHealthy = true;

  recordStatus(isHealthy: boolean) {
    if (!isHealthy && this.lastHealthy) {
      // Transition to unhealthy
      this.lastHealthy = false;
    } else if (isHealthy && !this.lastHealthy) {
      // Transition to healthy - record downtime
      this.lastHealthy = true;
    }
  }

  getUptimePercentage(): number {
    const totalTime = Date.now() - this.startTime;
    const uptime = totalTime - this.downtime;
    return (uptime / totalTime) * 100;
  }

  getReport() {
    const uptime = this.getUptimePercentage();
    return {
      uptimePercentage: uptime.toFixed(2),
      slaStatus: uptime >= 99.9 ? '✅ PASS (99.9%)' : '❌ FAIL (< 99.9%)',
      totalDowntimeMs: this.downtime,
    };
  }
}

export const uptimeSLA = new UptimeSLA();

/**
 * Circuit breaker for database connections
 */
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  recordSuccess() {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        console.log('✅ Circuit breaker CLOSED');
      }
    }
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.error('🔴 Circuit breaker OPEN');
      setTimeout(() => {
        this.state = 'half-open';
        this.failureCount = 0;
        console.warn('🟡 Circuit breaker HALF-OPEN');
      }, this.resetTimeout);
    }
  }

  isOpen(): boolean {
    return this.state === 'open';
  }

  getState() {
    return this.state;
  }
}

export const dbCircuitBreaker = new CircuitBreaker();
