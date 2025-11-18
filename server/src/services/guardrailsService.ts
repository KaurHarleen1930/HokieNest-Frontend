// server/src/services/guardrailsService.ts
// Simplified guardrails service for chatbot

export interface GuardrailResult {
  passed: boolean;
  blocked: boolean;
  reason?: string;
}

export class GuardrailsService {
  /**
   * Simple input validation
   */
  validateInput(message: string): { valid: boolean; sanitized: string; reason?: string } {
    const sanitized = message.trim();

    // Empty check
    if (sanitized.length === 0) {
      return { valid: false, sanitized: '', reason: 'Message is empty' };
    }

    // Length check
    if (sanitized.length > 1000) {
      return { valid: false, sanitized: sanitized.substring(0, 1000), reason: 'Message too long' };
    }

    return { valid: true, sanitized };
  }

  /**
   * Simple safety check
   */
  checkSafety(message: string): GuardrailResult {
    const messageLower = message.toLowerCase();

    // Basic blocked patterns
    const blockedPatterns = [
      /password|passwd|pwd/i,
      /credit card|creditcard/i,
      /social security|ssn/i,
      /bank account/i,
      /hack|exploit|vulnerability/i,
      /ignore previous instructions/i,
      /system prompt/i,
      /jailbreak/i,
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(message)) {
        return {
          passed: false,
          blocked: true,
          reason: 'Message contains potentially unsafe content',
        };
      }
    }

    return { passed: true, blocked: false };
  }

  /**
   * Simple output validation
   */
  validateOutput(response: string): { valid: boolean; sanitized?: string } {
    // Length check
    if (response.length > 2000) {
      return { valid: false, sanitized: response.substring(0, 2000) };
    }

    // Basic dangerous pattern check
    if (/<script|javascript:|onerror=/i.test(response)) {
      return { valid: false, sanitized: response.replace(/<script|javascript:|onerror=/gi, '') };
    }

    return { valid: true };
  }

  /**
   * Check rate limit
   */
  checkRateLimit(currentCount: number, limit: number = 10): GuardrailResult {
    if (currentCount >= limit) {
      return {
        passed: false,
        blocked: true,
        reason: `Rate limit exceeded (${limit} requests per minute)`,
      };
    }

    return { passed: true, blocked: false };
  }
}

// Export singleton instance
export const guardrailsService = new GuardrailsService();
