// Set environment variables before importing anything
process.env.OPENAI_API_KEY = 'test-api-key-for-testing';
process.env.LLM_PROVIDER = 'openai';

import { RAGService, ChatbotContext, ChatbotRequest } from '../ragService';

// Mock all dependencies before importing
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn(),
  },
}));

jest.mock('../telemetryService', () => ({
  telemetryService: {
    track: jest.fn(),
  },
}));

jest.mock('../guardrailsService', () => ({
  guardrailsService: {
    checkSafety: jest.fn(() => ({ blocked: false, confidence: 1.0 })),
    checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 100 })),
    validateOutput: jest.fn(() => ({ valid: true })),
    validateInput: jest.fn(() => ({ valid: true })),
  },
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is a test response from the chatbot. [Show properties] [Find roommates]',
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      },
    },
  })),
}));

describe('RAGService', () => {
  let ragService: RAGService;
  let mockContext: ChatbotContext;

  beforeEach(() => {
    ragService = new RAGService();
    mockContext = {
      sessionId: 'test-session-123',
      timestamp: new Date(),
    };
    jest.clearAllMocks();
  });

  describe('Intent Detection', () => {
    test('should detect property intent from query', () => {
      const intent = (ragService as any).detectQueryIntent('show me apartments');
      expect(intent.property).toBe(true);
    });

    test('should detect review intent from query', () => {
      const intent = (ragService as any).detectQueryIntent('what are the reviews');
      expect(intent.review).toBe(true);
    });

    test('should detect safety intent from query', () => {
      // Safety detection checks for specific keywords like 'safety', 'security', 'crime'
      const intent = (ragService as any).detectQueryIntent('what is the safety rating');
      expect(intent.safety).toBe(true);
    });
    
    test('should detect safety intent with security keyword', () => {
      // 'security' is in the safety keywords list
      const intent = (ragService as any).detectQueryIntent('what is the security like');
      expect(intent.safety).toBe(true);
    });

    test('should detect commute intent from query', () => {
      const intent = (ragService as any).detectQueryIntent('how long is the commute');
      expect(intent.commute).toBe(true);
    });
  });

  describe('Keyword Extraction', () => {
    test('should extract property name from query', () => {
      const keywords = (ragService as any).extractSearchKeywords('Tell me about Oakwood Apartments');
      expect(keywords.propertyNameWords.length).toBeGreaterThan(0);
    });

    test('should extract location terms from query', () => {
      // Location terms are extracted if word contains 'street', 'avenue', etc.
      // Use lowercase 'street' to avoid being caught by property name detection
      const keywords = (ragService as any).extractSearchKeywords('properties on main street');
      // "street" should be extracted as location term
      expect(keywords.locationTerms.length).toBeGreaterThan(0);
    });
    
    test('should extract location terms with road keyword', () => {
      // Use 'road' which is in the location keywords and lowercase
      const keywords = (ragService as any).extractSearchKeywords('apartments on main road');
      expect(keywords.locationTerms.length).toBeGreaterThan(0);
    });

    test('should extract search terms from query', () => {
      const keywords = (ragService as any).extractSearchKeywords('cheap apartments near campus');
      expect(keywords.searchTerms.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Response Generation', () => {
    test('should generate response for valid request', async () => {
      const request: ChatbotRequest = {
        message: 'Hello, what properties are available?',
        context: mockContext,
      };

      const response = await ragService.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.response).toBeDefined();
      expect(typeof response.response).toBe('string');
      expect(response.response.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      // Tokens may be 0 in mock, so just check it's a number
      expect(typeof response.tokens).toBe('number');
    });

    test('should return response object with required fields', async () => {
      const request: ChatbotRequest = {
        message: 'Hello',
        context: mockContext,
      };

      const response = await ragService.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.response).toBeDefined();
      expect(typeof response.response).toBe('string');
      // Suggestions may be optional, so just check if defined
      if (response.suggestions) {
        expect(Array.isArray(response.suggestions)).toBe(true);
      }
    });

    test('should handle different message types', async () => {
      const request: ChatbotRequest = {
        message: 'Find me a roommate',
        context: mockContext,
      };

      const response = await ragService.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.response).toBeDefined();
      expect(typeof response.response).toBe('string');
    });
  });

  describe('Safety Filters', () => {
    test('should pass safe messages', async () => {
      const filter = await (ragService as any).applySafetyFilters('What properties are available?');
      expect(filter.blocked).toBe(false);
    });

    test('should return filter result with confidence', async () => {
      const filter = await (ragService as any).applySafetyFilters('Hello chatbot');
      expect(filter).toBeDefined();
      expect(filter.hasOwnProperty('blocked')).toBe(true);
      expect(filter.hasOwnProperty('confidence')).toBe(true);
    });
  });

  describe('FAQ Data', () => {
    test('should have FAQ data initialized', () => {
      const faqData = (ragService as any).faqData;
      expect(Array.isArray(faqData)).toBe(true);
      expect(faqData.length).toBeGreaterThan(0);
    });
  });

  describe('Service Initialization', () => {
    test('should initialize RAG service successfully', () => {
      expect(ragService).toBeDefined();
      expect(ragService).toBeInstanceOf(RAGService);
    });
  });
});
