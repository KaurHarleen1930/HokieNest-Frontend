// server/src/services/telemetryService.ts
// Simplified telemetry service for chatbot

export interface SimpleTelemetry {
  responseTime: number;
  error?: string;
  success: boolean;
  timestamp: Date;
  userId?: number;
  sessionId: string;
}

export class TelemetryService {
  private metrics: SimpleTelemetry[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 metrics

  /**
   * Track a simple telemetry event
   */
  track(responseTime: number, success: boolean, userId?: number, sessionId?: string, error?: string): void {
    const metric: SimpleTelemetry = {
      responseTime,
      success,
      error,
      timestamp: new Date(),
      userId,
      sessionId: sessionId || 'unknown',
    };

    this.metrics.push(metric);

    // Keep only last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log to console with enhanced formatting
    if (success) {
      console.log(`📊 [Telemetry] ✅ Success | Time: ${responseTime.toFixed(2)}ms | User: ${userId || 'anonymous'} | Session: ${sessionId?.substring(0, 20) || 'unknown'}`);
    } else {
      console.error(`📊 [Telemetry] ❌ Failed | Time: ${responseTime.toFixed(2)}ms | User: ${userId || 'anonymous'} | Error: ${error || 'Unknown error'}`);
    }
  }

  /**
   * Get simple statistics
   */
  getStats(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    errorRate: number;
  } {
    const total = this.metrics.length;
    const successful = this.metrics.filter(m => m.success).length;
    const failed = total - successful;
    const avgTime = total > 0
      ? this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / total
      : 0;
    const errorRate = total > 0 ? (failed / total) * 100 : 0;

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      averageResponseTime: avgTime,
      errorRate,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): SimpleTelemetry[] {
    return this.metrics
      .filter(m => !m.success)
      .slice(-limit)
      .reverse();
  }
}

// Export singleton instance
export const telemetryService = new TelemetryService();
