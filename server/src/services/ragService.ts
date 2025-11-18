import { OpenAI } from 'openai';
import { supabase } from '../lib/supabase';
import { telemetryService } from './telemetryService';
import { guardrailsService } from './guardrailsService';
import { RoommateMatchingService } from './matching';
import { calculateDistance } from '../utils/distance';

// Support multiple LLM providers
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai'; // 'openai' or 'qwen'

// Initialize OpenAI client with environment variable
// Support both OpenAI and Qwen (DashScope)
if (LLM_PROVIDER === 'qwen') {
  if (!process.env.DASHSCOPE_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('DASHSCOPE_API_KEY or OPENAI_API_KEY environment variable is required for Qwen. Please set it in your .env file.');
  }
} else {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
  }
}

// Get the correct API key based on provider
const getApiKey = () => {
  if (LLM_PROVIDER === 'qwen') {
    return process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || '';
  }
  return process.env.OPENAI_API_KEY || '';
};

// Get base URL - use OpenAI official API by default, or override via OPENAI_BASE_URL
// If OPENAI_BASE_URL is not set, use OpenAI official API (undefined = default)
const getBaseURL = () => {
  if (LLM_PROVIDER === 'qwen') {
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }
  // Use OpenAI official API by default, or custom URL if specified
  const customURL = process.env.OPENAI_BASE_URL;
  
  // Validate URL if provided
  if (customURL) {
    // Fix common typo: ai.openai.com -> api.openai.com
    if (customURL.includes('ai.openai.com') && !customURL.includes('api.openai.com')) {
      console.warn(`⚠️  [Config] Detected incorrect URL: ${customURL}`);
      console.warn(`   Correcting to: https://api.openai.com/v1`);
      return undefined; // Use official API instead
    }
    return customURL;
  }
  
  return undefined; // undefined = OpenAI official API (https://api.openai.com/v1)
};

// Initialize OpenAI client
// For OpenAI: uses official API (https://api.openai.com/v1) by default
// For Qwen: uses DashScope compatible API
const openai = new OpenAI({
  apiKey: getApiKey(),
  baseURL: getBaseURL(), // undefined = OpenAI official API
  maxRetries: 3, // Allow retries for better reliability
  timeout: 60000, // 60 seconds timeout
});

export interface ChatbotContext {
  userId?: number;
  userEmail?: string;
  currentPage?: string;
  sessionId: string;
  timestamp: Date;
}

export interface ChatbotRequest {
  message: string;
  context: ChatbotContext;
}

export interface ChatbotResponse {
  response: string;
  sources?: string[];
  suggestions?: string[];
  confidence: number;
  cost: number;
  tokens: number;
}

export interface ChatbotLog {
  id: string;
  userId?: number;
  sessionId: string;
  message: string;
  response: string;
  sources?: string[];
  confidence: number;
  cost: number;
  tokens: number;
  timestamp: Date;
  currentPage?: string;
  safetyFilterPassed: boolean;
  rateLimitPassed: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  priority: number;
}

export interface SafetyFilter {
  blocked: boolean;
  reason?: string;
  confidence: number;
}

const DEFAULT_SUGGESTIONS = [
  'Find housing',
  'Browse properties',
  'Roommate matching',
  'Set priorities',
  'View safety insights',
  'Compare commute times',
  'Explore nearby attractions',
  'Show property reviews',
  'Update my profile',
  'See upcoming tours'
];

export class RAGService {
  private faqData: FAQItem[] = [];
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private costLogs: Array<{ timestamp: Date; cost: number; tokens: number; userId?: number }> = [];
  private chatLogs: ChatbotLog[] = [];
  private conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();
  // Cache for user context data (TTL: 5 minutes)
  private userContextCache: Map<number, { data: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Track all database tables (initialized once)
  private allDatabaseTables: string[] = [];
  private tablesInitialized: boolean = false;

  constructor() {
    this.initializeFAQData();
    // Initialize database tables list
    this.initializeDatabaseTables();
    // Clean up expired cache entries every 10 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 10 * 60 * 1000);
  }

  // Initialize database tables list - use hardcoded list based on schema
  private async initializeDatabaseTables(): Promise<void> {
    try {
      // Use hardcoded list based on provided schema
      this.allDatabaseTables = [
        'admin_activity_logs',
        'admin_permissions',
        'admin_user_permissions',
        'admin_users',
        'apartment_favorites',
        'apartment_properties_listings',
        'apartment_reference_locations',
        'apartment_units',
        'attractions',
        'campuses',
        'chat_conversations',
        'chat_messages',
        'chatbot_conversations',
        'community_posts',
        'conversation_participants',
        'housing_preferences',
        'housing_priorities',
        'incidents',
        'lifestyle_preferences',
        'listing_campuses',
        'listing_lats_longs',
        'matches',
        'message_read_receipts',
        'notification_preferences',
        'notifications',
        'permissions',
        'post_flags',
        'preference_importance',
        'property_amenities',
        'property_amenities_id',
        'property_attractions',
        'property_distances',
        'property_reviews',
        'property_transit_stations',
        'reports',
        'room_listings',
        'roommate_connections',
        'search_filters',
        'spatial_ref_sys',
        'transit_routes',
        'transit_stations',
        'typing_indicators',
        'user_online_status',
        'user_priority_weights',
        'users'
      ].sort();

      this.tablesInitialized = true;
      
      // Log all tables
      console.log(`\n📋 [Database] All Available Tables (${this.allDatabaseTables.length}):`);
      this.allDatabaseTables.forEach((table, index) => {
        console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${table}`);
      });
      console.log('');
    } catch (error: any) {
      console.error('❌ [Database] Failed to initialize table list:', error.message);
      this.tablesInitialized = false;
    }
  }

  private async initializeFAQData() {
    // Simplified initialization log
    const provider = LLM_PROVIDER === 'qwen' ? 'Qwen (DashScope)' : 'OpenAI (Official)';
    const model = LLM_PROVIDER === 'qwen' 
      ? (process.env.QWEN_MODEL || 'qwen-max')
      : (process.env.OPENAI_MODEL || 'gpt-3.5-turbo');
    const apiURL = getBaseURL() || 'https://api.openai.com/v1 (Official)';
    console.log(`🤖 Chatbot initialized | Provider: ${provider} | Model: ${model} | API: ${apiURL}`);
    // Seed FAQ data
    this.faqData = [
      {
        id: 'faq-001',
        question: 'How does housing priority scoring work?',
        answer: 'Housing priority scoring helps you find the perfect housing match by weighting four key factors: Budget (25-40%), Commute (20-35%), Safety (15-30%), and Roommates (10-25%). You set percentages that total 100%, and our algorithm scores properties based on these priorities.',
        category: 'priorities',
        tags: ['priorities', 'scoring', 'algorithm'],
        priority: 10
      },
      {
        id: 'faq-002',
        question: 'How do I find compatible roommates?',
        answer: 'Complete the Roommate Questionnaire in your Profile. Our algorithm matches you based on lifestyle compatibility, housing preferences, budget alignment, and location preferences. You\'ll see compatibility scores and can connect with potential matches.',
        category: 'roommates',
        tags: ['roommates', 'matching', 'compatibility'],
        priority: 10
      },
      {
        id: 'faq-003',
        question: 'What information do I need to provide for roommate matching?',
        answer: 'You\'ll need to complete lifestyle preferences (cleanliness, sleep schedule, social habits), housing preferences (budget, location, amenities), work/study schedule, pet preferences, and guest policies. The more detailed your answers, the better your matches.',
        category: 'roommates',
        tags: ['questionnaire', 'preferences', 'lifestyle'],
        priority: 9
      },
      {
        id: 'faq-004',
        question: 'How do I set my housing budget?',
        answer: 'Consider not just rent, but utilities, internet, parking, and other living costs. Aim for 30% of your income on housing. Use our budget calculator and set realistic ranges. Consider roommate cost-sharing options.',
        category: 'budget',
        tags: ['budget', 'costs', 'planning'],
        priority: 8
      },
      {
        id: 'faq-005',
        question: 'What safety information is available?',
        answer: 'We provide crime statistics, neighborhood safety ratings, proximity to campus security, well-lit areas, and safe transportation options. Safety scores are factored into our matching algorithm.',
        category: 'safety',
        tags: ['safety', 'security', 'neighborhood'],
        priority: 8
      },
      {
        id: 'faq-006',
        question: 'How do I browse properties?',
        answer: 'Visit the Properties page to see all available housing. Use filters for price, location, amenities, and safety. Set up alerts for new listings. View detailed property information and contact details.',
        category: 'properties',
        tags: ['properties', 'search', 'filters'],
        priority: 7
      },
      {
        id: 'faq-007',
        question: 'What is the Priority Dashboard?',
        answer: 'The Priority Dashboard shows your current housing priorities, personalized recommendations, analytics on your preferences, and optimization tips. You can adjust priorities in real-time and see how changes affect recommendations.',
        category: 'dashboard',
        tags: ['dashboard', 'analytics', 'recommendations'],
        priority: 7
      },
      {
        id: 'faq-008',
        question: 'How do I update my profile?',
        answer: 'Go to your Profile page to update personal information, housing preferences, lifestyle preferences, and housing priorities. Complete all sections for the best matching experience.',
        category: 'profile',
        tags: ['profile', 'settings', 'preferences'],
        priority: 6
      }
    ];
    console.log(`✅ Knowledge Base: ${this.faqData.length} FAQ items | Database: 10+ tables integrated`);
  }

  private async retrieveRelevantDocuments(query: string, limit: number = 5): Promise<FAQItem[]> {
    // Simple keyword-based matching for now
    const queryLower = query.toLowerCase();
    const relevantFAQs = this.faqData.filter(faq => {
      const questionMatch = faq.question.toLowerCase().includes(queryLower);
      const answerMatch = faq.answer.toLowerCase().includes(queryLower);
      const tagMatch = faq.tags.some(tag => tag.toLowerCase().includes(queryLower));
      return questionMatch || answerMatch || tagMatch;
    });

    // Sort by priority and return top results
    return relevantFAQs
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const userLimit = this.rateLimits.get(userId);

    if (!userLimit) {
      this.rateLimits.set(userId, { count: 1, resetTime: now + 60000 }); // 1 minute window
      return true;
    }

    if (now > userLimit.resetTime) {
      this.rateLimits.set(userId, { count: 1, resetTime: now + 60000 });
      return true;
    }

    if (userLimit.count >= 10) { // 10 requests per minute
      return false;
    }

    userLimit.count++;
    return true;
  }

  private async applySafetyFilters(message: string): Promise<SafetyFilter> {
    // Enhanced safety checks
    const blockedPatterns = [
      // Personal information
      /personal information/i,
      /password/i,
      /credit card/i,
      /social security/i,
      /bank account/i,
      /ssn/i,
      /phone number/i,
      /address/i,
      
      // Inappropriate content
      /inappropriate content/i,
      /harassment/i,
      /discrimination/i,
      /hate speech/i,
      
      // Off-topic requests
      /how to hack/i,
      /illegal activities/i,
      /drugs/i,
      /weapons/i,
      
      // System manipulation
      /ignore previous instructions/i,
      /system prompt/i,
      /jailbreak/i
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(message)) {
        return {
          blocked: true,
          reason: 'Message contains potentially sensitive, inappropriate, or off-topic content',
          confidence: 0.9
        };
      }
    }

    // Check message length (prevent spam)
    if (message.length > 1000) {
      return {
        blocked: true,
        reason: 'Message too long',
        confidence: 0.8
      };
    }

    // Check for excessive repetition
    const words = message.toLowerCase().split(/\s+/);
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxRepeats = Math.max(...Object.values(wordCounts));
    if (maxRepeats > 10) {
      return {
        blocked: true,
        reason: 'Message contains excessive repetition',
        confidence: 0.7
      };
    }

    return { blocked: false, confidence: 0.1 };
  }

  /**
   * Extract property name and keywords from query
   */
  private extractSearchKeywords(query: string): {
    propertyName?: string;
    propertyNameWords: string[];
    searchTerms: string[];
    locationTerms: string[];
  } {
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const propertyNameWords: string[] = [];
    const searchTerms: string[] = [];
    const locationTerms: string[] = [];
    
    // Extract potential property names (capitalized words, property-related terms)
    queryWords.forEach(word => {
      const wordLower = word.toLowerCase();
      if (
        /^[A-Z]/.test(word) || // Starts with capital letter
        wordLower.includes('apartments') ||
        wordLower.includes('complex') ||
        wordLower.includes('village') ||
        wordLower.includes('residence') ||
        wordLower.includes('place') ||
        wordLower.includes('tower') ||
        wordLower.includes('court') ||
        wordLower.includes('park') ||
        wordLower.includes('manor') ||
        wordLower.includes('heights')
      ) {
        propertyNameWords.push(word);
      } else if (
        wordLower.includes('street') ||
        wordLower.includes('avenue') ||
        wordLower.includes('road') ||
        wordLower.includes('drive') ||
        wordLower.includes('blvd') ||
        wordLower.includes('blvd') ||
        wordLower.includes('lane')
      ) {
        locationTerms.push(word);
      } else if (word.length > 3) {
        searchTerms.push(word);
      }
    });
    
    const propertyName = propertyNameWords.length > 0 
      ? (propertyNameWords.length === 1 ? propertyNameWords[0] : propertyNameWords.join(' '))
      : undefined;
    
    return {
      propertyName,
      propertyNameWords,
      searchTerms: searchTerms.length > 0 ? searchTerms : queryWords.filter(w => w.length > 3),
      locationTerms
    };
  }

  /**
   * Enhanced keyword matching with synonyms and context awareness
   */
  private detectQueryIntent(query: string): {
    safety: boolean;
    property: boolean;
    review: boolean;
    commute: boolean;
    attraction: boolean;
    roommate: boolean;
    favorite: boolean;
    notification: boolean;
    unit: boolean;
    price: boolean;
    availability: boolean;
    community: boolean;
    room: boolean;
    photo: boolean;
    setting: boolean;
    report: boolean;
    transitRoute: boolean;
    rentalEstimate: boolean;
  } {
    const queryLower = query.toLowerCase();
    
    // Safety-related synonyms
    const safetyKeywords = ['safety', 'incident', 'crime', 'security', 'unsafe', 'dangerous', 'violence', 'theft', 'robbery', 'police', 'emergency'];
    const safety = safetyKeywords.some(keyword => queryLower.includes(keyword));
    
    // Property-related synonyms (but not review-specific)
    // Also check for potential property names (capitalized words, property name patterns)
    const propertyKeywords = ['property', 'apartment', 'housing', 'listing', 'unit', 'residence', 'dwelling', 'place', 'home'];
    const hasPropertyKeyword = propertyKeywords.some(keyword => queryLower.includes(keyword));
    
    // Check for potential property names (capitalized words, common property name patterns)
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const hasPropertyNamePattern = queryWords.some(word => {
      const wordLower = word.toLowerCase();
      return (
        /^[A-Z]/.test(word) || // Starts with capital letter (likely a property name)
        (word.length > 3 && (
          wordLower.includes('apartments') ||
          wordLower.includes('complex') ||
          wordLower.includes('village') ||
          wordLower.includes('residence') ||
          wordLower.includes('place') ||
          wordLower.includes('tower') ||
          wordLower.includes('court') ||
          wordLower.includes('park') ||
          wordLower.includes('manor') ||
          wordLower.includes('heights') ||
          wordLower.includes('commons') ||
          wordLower.includes('gardens')
        ))
      );
    });
    
    // Also check if query contains capitalized words (likely property names)
    const hasCapitalizedWords = queryWords.some(word => /^[A-Z][a-z]+/.test(word) && word.length > 4);
    
    const property = (hasPropertyKeyword || hasPropertyNamePattern || hasCapitalizedWords) && 
                     !queryLower.includes('review') && !queryLower.includes('rating');
    
    // Review-specific (more precise)
    const reviewKeywords = ['review', 'rating', 'rate', 'feedback', 'comment', 'opinion', 'experience', 'reviewed', 'star', 'stars'];
    const review = reviewKeywords.some(keyword => queryLower.includes(keyword)) ||
                   (queryLower.includes('property') && (queryLower.includes('review') || queryLower.includes('rating'))) ||
                   (queryLower.includes('apartment') && (queryLower.includes('review') || queryLower.includes('rating')));
    
    // Commute/distance-related synonyms
    const commuteKeywords = ['distance', 'commute', 'walking', 'walk', 'travel', 'near', 'close', 'far', 'mile', 'miles', 'minutes', 'transit', 'metro', 'station'];
    const commute = commuteKeywords.some(keyword => queryLower.includes(keyword));
    
    // Attraction-related synonyms
    const attractionKeywords = ['attraction', 'restaurant', 'cafe', 'café', 'shop', 'store', 'grocery', 'market', 'nearby', 'amenity', 'amenities', 'place', 'places'];
    const attraction = attractionKeywords.some(keyword => queryLower.includes(keyword));
    
    // Roommate-related (more precise matching)
    const roommateKeywords = ['roommate', 'room mate', 'room-mate', 'match', 'matching', 'compatibility', 'score', 'partner'];
    const roommateSpecific = roommateKeywords.some(keyword => queryLower.includes(keyword));
    
    // Only trigger roommate if it's clearly about matching/roommates
    const roommate = roommateSpecific || 
                    (queryLower.includes('best') && (queryLower.includes('match') || queryLower.includes('roommate'))) ||
                    (queryLower.includes('who') && (queryLower.includes('match') || queryLower.includes('roommate'))) ||
                    (queryLower.includes('top') && (queryLower.includes('match') || queryLower.includes('roommate'))) ||
                    (queryLower.includes('score') && (queryLower.includes('match') || queryLower.includes('roommate')));
    
    // Favorite/saved properties
    const favoriteKeywords = ['favorite', 'favourite', 'saved', 'bookmark', 'bookmarked', 'save', 'like', 'liked', 'wishlist'];
    const favorite = favoriteKeywords.some(keyword => queryLower.includes(keyword));
    
    // Notifications/alerts
    const notificationKeywords = ['notification', 'notifications', 'alert', 'alerts', 'message', 'messages', 'update', 'updates', 'reminder'];
    const notification = notificationKeywords.some(keyword => queryLower.includes(keyword));
    
    // Unit-specific queries
    const unitKeywords = ['unit', 'units', 'room', 'rooms', 'bedroom', 'bedrooms', 'bathroom', 'bathrooms', 'bed', 'bath'];
    const unit = unitKeywords.some(keyword => queryLower.includes(keyword)) && 
                 (queryLower.includes('available') || queryLower.includes('rent') || queryLower.includes('price') || 
                  queryLower.includes('size') || queryLower.includes('square'));
    
    // Price/budget queries
    const priceKeywords = ['price', 'prices', 'cost', 'rent', 'rental', 'budget', 'affordable', 'cheap', 'expensive', 'dollar', 'dollars'];
    const price = priceKeywords.some(keyword => queryLower.includes(keyword));
    
    // Availability queries
    const availabilityKeywords = ['available', 'availability', 'vacant', 'vacancy', 'move in', 'move-in', 'lease', 'leasing', 'open'];
    const availability = availabilityKeywords.some(keyword => queryLower.includes(keyword));
    
    // Community-related queries
    const communityKeywords = ['community', 'post', 'posts', 'discussion', 'discussions', 'forum', 'forums', 'share', 'sharing', 'talk', 'chat', 'discuss'];
    const community = communityKeywords.some(keyword => queryLower.includes(keyword));
    
    // Room listing queries (different from unit - this is for room sharing)
    const roomKeywords = ['room listing', 'room listings', 'room share', 'room sharing', 'roommate wanted', 'room available', 'sublet', 'sublease'];
    const room = roomKeywords.some(keyword => queryLower.includes(keyword)) && 
                 !queryLower.includes('unit') && !queryLower.includes('apartment');
    
    // Photo/image queries
    const photoKeywords = ['photo', 'photos', 'picture', 'pictures', 'image', 'images', 'gallery', 'view', 'see', 'show me'];
    const photo = photoKeywords.some(keyword => queryLower.includes(keyword));
    
    // Settings queries
    const settingKeywords = ['setting', 'settings', 'preference', 'preferences', 'config', 'configuration', 'option', 'options', 'profile'];
    const setting = settingKeywords.some(keyword => queryLower.includes(keyword));
    
    // Report queries
    const reportKeywords = ['report', 'reports', 'flag', 'flags', 'complaint', 'complaints', 'issue', 'issues', 'problem', 'problems'];
    const report = reportKeywords.some(keyword => queryLower.includes(keyword));
    
    // Transit route queries
    const transitRouteKeywords = ['route', 'routes', 'line', 'lines', 'metro line', 'bus route', 'transit route', 'train line'];
    const transitRoute = transitRouteKeywords.some(keyword => queryLower.includes(keyword));
    
    // Rental estimate queries
    const rentalEstimateKeywords = ['estimate', 'estimates', 'estimated rent', 'rental estimate', 'price estimate', 'market rent', 'fair rent'];
    const rentalEstimate = rentalEstimateKeywords.some(keyword => queryLower.includes(keyword));
    
    return { 
      safety, property, review, commute, attraction, roommate, favorite, notification, 
      unit, price, availability, community, room, photo, setting, report, transitRoute, rentalEstimate 
    };
  }

  private async getDatabaseContext(userId?: number, query?: string): Promise<string> {
    const dbStartTime = performance.now();
    // Track which tables are queried in this request
    const queriedTables = new Set<string>();
    
    // Helper to track table usage
    const trackTable = (tableName: string) => {
      queriedTables.add(tableName);
    };
    
    // Helper to wrap Supabase queries with table tracking
    const trackedQuery = (tableName: string, queryBuilder: any) => {
      trackTable(tableName);
      return queryBuilder;
    };
    
    try {
      const contextParts: string[] = [];
      const queryLower = query?.toLowerCase() || '';
      const intent = this.detectQueryIntent(query || '');

      // Check cache for user context (only for user-specific data, not query-specific)
      if (userId) {
        const cached = this.userContextCache.get(userId);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
          const cacheTime = performance.now() - dbStartTime;
          // Cache hit - no logging needed
          contextParts.push(cached.data);
        } else {
          // Fetch only essential user data (not all tables)
          const userDataStartTime = performance.now();
        const [
          housingPrefs,
          lifestylePrefs,
          priorities,
          userProfiles,
            userWeights
        ] = await Promise.all([
          (() => { trackTable('housing_preferences'); return supabase.from('housing_preferences').select('*').eq('user_id', userId).single(); })(),
          (() => { trackTable('lifestyle_preferences'); return supabase.from('lifestyle_preferences').select('*').eq('user_id', userId).single(); })(),
          (() => { trackTable('housing_priorities'); return supabase.from('housing_priorities').select('*').eq('user_id', userId).single(); })(),
          (() => { trackTable('users'); return supabase.from('users').select('*').eq('id', userId).single(); })(),
          (() => { trackTable('user_priority_weights'); return supabase.from('user_priority_weights').select('*').eq('user_id', userId).single(); })()
          ]);
          const userDataTime = performance.now() - userDataStartTime;
          // User data fetched - no logging needed

          const userContextParts: string[] = [];

          // User Profile
        if (userProfiles.data) {
          const prof = userProfiles.data;
            userContextParts.push(`USER PROFILE: ${prof.first_name || ''} ${prof.last_name || ''}, Email: ${prof.email || 'Not provided'}, Age: ${prof.age || 'Not specified'}, Gender: ${prof.gender || 'Not specified'}, Major: ${prof.major || 'Not specified'}`);
        }

        // Housing Preferences
        if (housingPrefs.data) {
          const pref = housingPrefs.data;
            userContextParts.push(`HOUSING PREFERENCES: Budget $${pref.budget_min}-$${pref.budget_max}, Move-in: ${pref.move_in_date}, Location: ${pref.location_preference || 'Not specified'}, Amenities: ${pref.desired_amenities?.join(', ') || 'None specified'}`);
        }

        // Lifestyle Preferences
        if (lifestylePrefs.data) {
          const life = lifestylePrefs.data;
            userContextParts.push(`LIFESTYLE PREFERENCES: Cleanliness ${life.cleanliness_level}/5, Sleep schedule: ${life.sleep_schedule}, Social habits: ${life.social_level || 'Not specified'}, Pet preference: ${life.pets || 'Not specified'}`);
        }

          // Housing Priorities
        if (priorities.data) {
          const prior = priorities.data;
            userContextParts.push(`HOUSING PRIORITIES: Budget ${prior.preferences?.budget || 25}%, Commute ${prior.preferences?.commute || 25}%, Safety ${prior.preferences?.safety || 25}%, Roommates ${prior.preferences?.roommates || 25}%`);
        }

          // Custom Priority Weights
        if (userWeights.data && !Array.isArray(userWeights.data)) {
          const weights = userWeights.data as any;
            userContextParts.push(`CUSTOM WEIGHTS: Budget ${weights.budget_weight || 3}, Commute ${weights.commute_weight || 3}, Safety ${weights.safety_weight || 3}, Roommates ${weights.roommates_weight || 3}`);
          }

          const userContext = userContextParts.join('\n\n');
          contextParts.push(userContext);
          
          // Cache user context
          this.userContextCache.set(userId, {
            data: userContext,
            timestamp: Date.now()
          });
        }
      }

      // Query-specific data fetching (only fetch what's needed based on query intent)
      if (query) {
        const queryPromises: Array<Promise<any>> = [];
        const keywords = this.extractSearchKeywords(query || '');
        
        // Always check for property name in query, even if property intent not detected
        // This ensures we can find specific properties mentioned by name
        const hasPropertyNameInQuery = !!keywords.propertyName || keywords.propertyNameWords.length > 0;
        
        // If property name detected, query properties first to get IDs (needed for reviews/attractions/transit)
        // We'll execute this query first and use the results for other queries
        let propertyIdsPromise: Promise<string[]> | null = null;
        if (hasPropertyNameInQuery) {
          // Query properties matching the name first
          let propertyIdsQuery = supabase.from('apartment_properties_listings')
            .select('id')
            .eq('is_active', true);
          
          if (keywords.propertyName) {
            propertyIdsQuery = propertyIdsQuery.or(
              `name.ilike.%${keywords.propertyName}%,address.ilike.%${keywords.propertyName}%`
            );
          } else if (keywords.searchTerms.length > 0) {
            const searchConditions = [
              ...keywords.searchTerms.map(term => `name.ilike.%${term}%`),
              ...keywords.searchTerms.map(term => `address.ilike.%${term}%`)
            ].join(',');
            propertyIdsQuery = propertyIdsQuery.or(searchConditions);
          }
          
          // Create promise that returns property IDs array
          propertyIdsPromise = Promise.resolve(propertyIdsQuery.limit(50)).then((propertyIdsResult) => {
            const ids = propertyIdsResult.data?.map((p: any) => p.id) || [];
            
            if (process.env.DEBUG === 'true') {
              console.log(`🔍 Property Name Detected: Found ${ids.length} matching properties`);
            }
            
            return ids;
          });
        }

        // Safety-related queries - use keyword-based search
        if (intent.safety) {
          trackTable('incidents');
          let safetyQuery = supabase.from('incidents')
            .select('*');
          
          // Search by location if location terms found
          if (keywords.locationTerms.length > 0) {
            const locationConditions = keywords.locationTerms.map(term => `location.ilike.%${term}%`).join(',');
            safetyQuery = safetyQuery.or(locationConditions);
          } else if (keywords.searchTerms.length > 0) {
            // Search by description or location
            const searchConditions = [
              ...keywords.searchTerms.map(term => `description.ilike.%${term}%`),
              ...keywords.searchTerms.map(term => `location.ilike.%${term}%`),
              ...keywords.searchTerms.map(term => `type.ilike.%${term}%`)
            ].join(',');
            safetyQuery = safetyQuery.or(searchConditions);
          }
          
          queryPromises.push(
            Promise.resolve(
              safetyQuery.order('created_at', { ascending: false }).limit(20)
            )
          );
        }

        // Review queries - get reviews for properties (ensure proper matching)
        // Use keyword-based search to find relevant reviews
        if (intent.review) {
          // If property name found, use the property IDs promise
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('property_reviews')
                    .select('reviewer_name, rating, title, property_id, review_text')
                    .not('rating', 'is', null)
                    .in('property_id', propertyIds)
                    .order('created_at', { ascending: false })
                    .limit(30);
                }
                // Fallback if no properties found
                return supabase.from('property_reviews')
                  .select('reviewer_name, rating, title, property_id, review_text')
                  .not('rating', 'is', null)
                  .order('created_at', { ascending: false })
                  .limit(10);
              })
            );
          } else if (keywords.searchTerms.length > 0) {
            // Search by review text content
            queryPromises.push(
              Promise.resolve(
                supabase.from('property_reviews')
                  .select('reviewer_name, rating, title, property_id, review_text')
                  .not('rating', 'is', null)
                  .or(`title.ilike.%${keywords.searchTerms.join('%')}%,review_text.ilike.%${keywords.searchTerms.join('%')}%`)
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            );
          } else {
            // Fallback: get recent reviews
            queryPromises.push(
              Promise.resolve(
                supabase.from('property_reviews')
                  .select('reviewer_name, rating, title, property_id, review_text')
                  .not('rating', 'is', null)
                  .order('created_at', { ascending: false })
                  .limit(10)
              )
            );
          }
        }

        // Property queries - ALWAYS use keyword-based search
        // Note: apartment_properties_listings primary key is 'id', not 'property_id'
        if (intent.property || intent.review) {
          let propertyQuery = supabase.from('apartment_properties_listings')
            .select('id, name, address, city, state, zip_code, latitude, longitude, description, amenities')
            .eq('is_active', true)
            .not('name', 'is', null);
          
          // Build search conditions based on extracted keywords
          if (keywords.propertyName) {
            // Search by property name and address
            propertyQuery = propertyQuery.or(
              `name.ilike.%${keywords.propertyName}%,address.ilike.%${keywords.propertyName}%`
            );
          } else if (keywords.searchTerms.length > 0) {
            // Search by any search terms in name, address, or description
            const searchConditions = [
              ...keywords.searchTerms.map(term => `name.ilike.%${term}%`),
              ...keywords.searchTerms.map(term => `address.ilike.%${term}%`),
              ...keywords.searchTerms.map(term => `description.ilike.%${term}%`)
            ].join(',');
            propertyQuery = propertyQuery.or(searchConditions);
          }
          
          // Add location filters if location terms found
          if (keywords.locationTerms.length > 0) {
            const locationConditions = keywords.locationTerms.map(term => `address.ilike.%${term}%`).join(',');
            propertyQuery = propertyQuery.or(locationConditions);
          }
          
          queryPromises.push(
            Promise.resolve(propertyQuery.limit(50))
          );
        }

        // Distance/commute queries - use keyword-based search to find relevant properties
        if (intent.commute) {
          // Use property IDs promise if available
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            // Get distances for matching properties
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('property_distances')
                    .select(`
                      distance_miles, 
                      walking_time_minutes,
                      driving_time_minutes,
                      property_id,
                      apartment_reference_locations:location_id(
                        name, 
                        type, 
                        location_id,
                        address,
                        latitude,
                        longitude
                      )
                    `)
                    .in('property_id', propertyIds)
                    .not('distance_miles', 'is', null)
                    .gt('distance_miles', 0)
                    .order('distance_miles', { ascending: true })
                    .limit(20);
                }
                return supabase.from('property_distances')
                  .select(`
                    distance_miles, 
                    walking_time_minutes,
                    driving_time_minutes,
                    property_id,
                    apartment_reference_locations:location_id(
                      name, 
                      type, 
                      location_id,
                      address,
                      latitude,
                      longitude
                    )
                  `)
                  .not('distance_miles', 'is', null)
                  .gt('distance_miles', 0)
                  .order('distance_miles', { ascending: true })
                  .limit(10);
              })
            );
            
            // Get transit stations for matching properties
            // Note: property_amenities_summary doesn't exist, using property_transit_stations directly
            queryPromises.push(
              propertyIdsPromise.then(async (propertyIds) => {
                if (propertyIds.length > 0) {
                  // Get properties with coordinates
                  const propertiesResult = await supabase.from('apartment_properties_listings')
                    .select('id, name, latitude, longitude')
                    .in('id', propertyIds)
                    .eq('is_active', true)
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null);
                  
                  // Get all active transit stations with coordinates
                  const stationsResult = await supabase.from('transit_stations')
                    .select('id, wmata_station_code, name, address, latitude, longitude, station_type, lines, is_active')
                    .eq('is_active', true)
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null);
                  
                  // Calculate distances for each property to all transit stations
                  const propertyStations: any[] = [];
                  
                  if (propertiesResult.data && stationsResult.data) {
                    propertiesResult.data.forEach((property: any) => {
                      const distances = stationsResult.data
                        .map((station: any) => ({
                          property_id: property.id,
                          property_name: property.name,
                          transit_station_id: station.id,
                          transit_station: station,
                          distance_miles: calculateDistance(
                            property.latitude,
                            property.longitude,
                            station.latitude,
                            station.longitude
                          ),
                          // Estimate walking time (3 mph average)
                          walking_time_minutes: Math.round((calculateDistance(
                            property.latitude,
                            property.longitude,
                            station.latitude,
                            station.longitude
                          ) / 3) * 60)
                        }))
                        .sort((a, b) => a.distance_miles - b.distance_miles)
                        .slice(0, 5); // Get top 5 nearest
                      
                      propertyStations.push(...distances);
                    });
                  }
                  
                  // Return in format similar to property_transit_stations query
                  return {
                    data: propertyStations,
                    error: null
                  };
                }
                // Fallback: get all transit stations
                return supabase.from('transit_stations')
                  .select('id, wmata_station_code, name, address, latitude, longitude, station_type, lines, is_active')
                  .eq('is_active', true)
                  .not('latitude', 'is', null)
                  .not('longitude', 'is', null)
                  .limit(20);
              })
            );
          } else {
            // Fallback: get all distances and transit
            queryPromises.push(
              Promise.resolve(
          supabase.from('property_distances')
            .select(`
                    distance_miles, 
                    walking_time_minutes,
                    driving_time_minutes,
              property_id,
                    apartment_reference_locations:location_id(
                      name, 
                      type, 
                      location_id,
                      address,
                      latitude,
                      longitude
                    )
                  `)
                  .not('distance_miles', 'is', null)
                  .gt('distance_miles', 0)
                  .order('distance_miles', { ascending: true })
                  .limit(10)
              )
            );
            
            queryPromises.push(
              Promise.resolve(
                supabase.from('property_transit_stations')
                  .select(`
                    property_id,
                    transit_station_id,
              distance_miles,
              walking_time_minutes,
              driving_time_minutes,
                    transit_station:transit_stations(
                id,
                      wmata_station_code,
                name,
                      address,
                      latitude,
                      longitude,
                      station_type,
                      lines,
                      is_active
                    )
                  `)
                  .eq('transit_stations.is_active', true)
                  .not('distance_miles', 'is', null)
                  .gt('distance_miles', 0)
                  .order('distance_miles', { ascending: true })
                  .limit(20)
              )
            );
            
            // Also fetch properties separately to get property names (since there's no FK constraint)
            // We'll join them manually in the processing step
            queryPromises.push(
              Promise.resolve(
                supabase.from('apartment_properties_listings')
                  .select('id, name, address, city, state')
                  .eq('is_active', true)
                  .limit(100) // Get enough properties to match with property_transit_stations
              )
            );
          }
        }

        // Attraction queries - use keyword-based search to find relevant properties
        if (intent.attraction) {
          if (process.env.DEBUG === 'true') {
            console.log(`🔍 Detected attraction intent, querying with keywords:`, keywords);
          }
          
          // Use property IDs promise if available
          // Note: property_amenities_summary doesn't exist, using property_attractions directly
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            // Get all attractions with coordinates (we'll calculate distances in code)
            // Also get properties with coordinates
            queryPromises.push(
              propertyIdsPromise.then(async (propertyIds) => {
                if (propertyIds.length > 0) {
                  // Get properties with coordinates
                  const propertiesResult = await supabase.from('apartment_properties_listings')
                    .select('id, name, latitude, longitude')
                    .in('id', propertyIds)
                    .eq('is_active', true)
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null);
                  
                  // Get all active attractions with coordinates
                  const attractionsResult = await supabase.from('attractions')
                    .select('id, name, category, subcategory, rating, address, latitude, longitude, price_level, is_active, is_open_now')
                    .eq('is_active', true)
                    .not('latitude', 'is', null)
                    .not('longitude', 'is', null);
                  
                  // Calculate distances for each property to all attractions
                  const propertyAttractions: any[] = [];
                  
                  if (propertiesResult.data && attractionsResult.data) {
                    propertiesResult.data.forEach((property: any) => {
                      const distances = attractionsResult.data
                        .map((attraction: any) => ({
                          property_id: property.id,
                          property_name: property.name,
                          attraction_id: attraction.id,
                          attraction: attraction,
                          distance_miles: calculateDistance(
                            property.latitude,
                            property.longitude,
                            attraction.latitude,
                            attraction.longitude
                          )
                        }))
                        .sort((a, b) => a.distance_miles - b.distance_miles)
                        .slice(0, 5); // Get top 5 nearest
                      
                      propertyAttractions.push(...distances);
                    });
                  }
                  
                  // Return in format similar to property_attractions query
                  return {
                    data: propertyAttractions,
                    error: null
                  };
                }
                // Fallback: get all attractions
                return supabase.from('attractions')
                  .select('id, name, category, subcategory, rating, address, latitude, longitude, price_level, is_active, is_open_now')
                  .eq('is_active', true)
                  .not('latitude', 'is', null)
                  .not('longitude', 'is', null)
                  .limit(30);
              })
            );
          } else {
            // Fallback: get all attractions from property_attractions table
            // Note: property_attractions has foreign keys to both attractions and apartment_properties_listings
            queryPromises.push(
              Promise.resolve(
          supabase.from('property_attractions')
                  .select(`
                    property_id,
                    attraction_id,
                    distance_miles,
                    walking_time_minutes,
                    driving_time_minutes,
                    attraction:attractions(
                      id,
                      name,
                      category,
                      subcategory,
                      rating,
                      address,
                      latitude,
                      longitude,
                      price_level,
                      is_active,
                      is_open_now
                    )
                  `)
                  .not('distance_miles', 'is', null)
                  .gt('distance_miles', 0)
                  .order('distance_miles', { ascending: true })
                  .limit(30)
              )
            );
            
            // Also fetch properties separately to get property names (since there's no FK constraint)
            // We'll join them manually in the processing step
            queryPromises.push(
              Promise.resolve(
                supabase.from('apartment_properties_listings')
                  .select('id, name, address, city, state')
                  .eq('is_active', true)
                  .limit(100) // Get enough properties to match with property_attractions
              )
            );
          }
        }

        // Roommate queries - get actual match scores (only if user is logged in)
        if (intent.roommate && userId) {
          // Get roommate connections for this user (ensure proper user_id matching)
          queryPromises.push(
            Promise.resolve(
              supabase.from('roommate_connections')
                .select('*')
                .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
                .limit(5)
            )
          );
          
          // Get actual match scores by calling matching service
          queryPromises.push(
            Promise.resolve(this.getRoommateMatchScores(userId))
          );
        }

        // Favorite/saved properties queries
        // Note: apartment_favorites.property_id references apartment_properties_listings.id
        if (intent.favorite && userId) {
          queryPromises.push(
            Promise.resolve(
              supabase.from('apartment_favorites')
                .select(`
                  property_id,
                  created_at,
                  apartment_properties_listings!apartment_favorites_property_id_fkey(
                    id,
                    name,
                    address,
                    city,
                    state,
                    is_active
                  )
                `)
                .eq('user_id', userId)
                .eq('apartment_properties_listings.is_active', true)
            .order('created_at', { ascending: false })
                .limit(5)
            )
          );
        }

        // Notification queries
        if (intent.notification && userId) {
          queryPromises.push(
            Promise.resolve(
              supabase.from('notifications')
                .select('notification_type, title, message, is_read, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5)
            )
          );
        }

        // Unit/room availability queries - use keyword-based search
        // Note: apartment_units table uses: id (not unit_id), beds (not bedrooms), baths (not bathrooms), 
        // rent_min/rent_max (not rent_price), availability_status (not is_available), sq_ft (not square_feet)
        if (intent.unit || intent.availability) {
          // Use property IDs promise if available
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('apartment_units')
                    .select(`
                      id,
                      property_id,
                      unit_number,
                      beds,
                      baths,
                      sq_ft,
                      rent_min,
                      rent_max,
                      availability_status,
                      available_date,
                      apartment_properties_listings!apartment_units_property_id_fkey(
                        id,
                        name,
                        is_active
                      )
                    `)
                    .in('property_id', propertyIds)
                    .eq('apartment_properties_listings.is_active', true)
                    .eq('availability_status', 'available')
                    .not('rent_min', 'is', null)
                    .order('rent_min', { ascending: true })
                    .limit(20);
                }
                return supabase.from('apartment_units')
                  .select(`
                    id,
                    property_id,
                    unit_number,
                    beds,
                    baths,
                    sq_ft,
                    rent_min,
                    rent_max,
                    availability_status,
                    available_date,
                    apartment_properties_listings!apartment_units_property_id_fkey(
                      id,
                      name,
                      is_active
                    )
                  `)
                  .eq('apartment_properties_listings.is_active', true)
                  .eq('availability_status', 'available')
                  .not('rent_min', 'is', null)
                  .order('rent_min', { ascending: true })
                  .limit(10);
              })
            );
          } else {
            // Fallback: get all available units
            queryPromises.push(
              Promise.resolve(
                supabase.from('apartment_units')
                  .select(`
                    id,
                    property_id,
                    unit_number,
                    beds,
                    baths,
                    sq_ft,
                    rent_min,
                    rent_max,
                    availability_status,
                    available_date,
                    apartment_properties_listings!apartment_units_property_id_fkey(
                      id,
                      name,
                      is_active
                    )
                  `)
                  .eq('apartment_properties_listings.is_active', true)
                  .eq('availability_status', 'available')
                  .not('rent_min', 'is', null)
                  .order('rent_min', { ascending: true })
            .limit(10)
              )
            );
          }
        }

        // Price/budget queries - use keyword-based search
        if (intent.price && !intent.unit) {
          // Use property IDs promise if available
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('apartment_units')
                    .select(`
                      property_id,
                      rent_min,
                      rent_max,
                      beds,
                      baths,
                      apartment_properties_listings!apartment_units_property_id_fkey(
                        id,
                        name,
                        is_active
                      )
                    `)
                    .in('property_id', propertyIds)
                    .eq('apartment_properties_listings.is_active', true)
                    .eq('availability_status', 'available')
                    .not('rent_min', 'is', null)
                    .order('rent_min', { ascending: true })
                    .limit(30);
                }
                return supabase.from('apartment_units')
                  .select(`
                    property_id,
                    rent_min,
                    rent_max,
                    beds,
                    baths,
                    apartment_properties_listings!apartment_units_property_id_fkey(
                      id,
                      name,
                      is_active
                    )
                  `)
                  .eq('apartment_properties_listings.is_active', true)
                  .eq('availability_status', 'available')
                  .not('rent_min', 'is', null)
                  .order('rent_min', { ascending: true })
                  .limit(20);
              })
            );
          } else {
            // Fallback: get all pricing info
            queryPromises.push(
              Promise.resolve(
                supabase.from('apartment_units')
                  .select(`
                    property_id,
                    rent_min,
                    rent_max,
                    beds,
                    baths,
                    apartment_properties_listings!apartment_units_property_id_fkey(
                      id,
                      name,
                      is_active
                    )
                  `)
                  .eq('apartment_properties_listings.is_active', true)
                  .eq('availability_status', 'available')
                  .not('rent_min', 'is', null)
                  .order('rent_min', { ascending: true })
                  .limit(20)
              )
            );
          }
        }

        // Community posts queries - use keyword-based search
        // Note: property_community_posts table doesn't exist, using community_posts only
        if (intent.community) {
          if (keywords.searchTerms.length > 0) {
            // Search by content
            queryPromises.push(
              Promise.resolve(
                supabase.from('community_posts')
                  .select('id, title, content, created_at')
                  .or(`title.ilike.%${keywords.searchTerms.join('%')}%,content.ilike.%${keywords.searchTerms.join('%')}%`)
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            );
          } else {
            // Get recent community posts
            queryPromises.push(
              Promise.resolve(
                supabase.from('community_posts')
                  .select('id, title, content, created_at')
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            );
          }
        }

        // Room listings queries - use keyword-based search
        if (intent.room) {
          // Get property IDs if property name detected
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('room_listings')
                    .select(`
                      id,
                      property_id,
                      title,
                      description,
                      rent_amount,
                      available_date,
                      created_at,
                      apartment_properties_listings!room_listings_property_id_fkey(
                        id,
                        name,
                        address
                      )
                    `)
                    .in('property_id', propertyIds)
                    .order('created_at', { ascending: false })
                    .limit(20);
                }
                return supabase.from('room_listings')
                  .select(`
                    id,
                    property_id,
                    title,
                    description,
                    rent_amount,
                    available_date,
                    created_at,
                    apartment_properties_listings!room_listings_property_id_fkey(
                      id,
                      name,
                      address
                    )
                  `)
                  .order('created_at', { ascending: false })
                  .limit(20);
              })
            );
          } else if (keywords.searchTerms.length > 0) {
            queryPromises.push(
              Promise.resolve(
                supabase.from('room_listings')
                  .select(`
                    id,
                    property_id,
                    title,
                    description,
                    rent_amount,
                    available_date,
                    created_at,
                    apartment_properties_listings!room_listings_property_id_fkey(
                      id,
                      name,
                      address
                    )
                  `)
                  .or(`title.ilike.%${keywords.searchTerms.join('%')}%,description.ilike.%${keywords.searchTerms.join('%')}%`)
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            );
          } else {
            queryPromises.push(
              Promise.resolve(
                supabase.from('room_listings')
                  .select(`
                    id,
                    property_id,
                    title,
                    description,
                    rent_amount,
                    available_date,
                    created_at,
                    apartment_properties_listings!room_listings_property_id_fkey(
                      id,
                      name,
                      address
                    )
                  `)
                  .order('created_at', { ascending: false })
                  .limit(20)
              )
            );
          }
        }

        // Photo queries - use keyword-based search
        // Note: photos are stored in apartment_properties_listings.photos (jsonb) field
        if (intent.photo) {
          // Get property IDs if property name detected
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('apartment_properties_listings')
                    .select('id, name, photos, thumbnail_url')
                    .in('id', propertyIds)
                    .eq('is_active', true)
                    .not('photos', 'is', null)
                    .limit(30);
                }
                // Fallback: query all properties with photos
                return supabase.from('apartment_properties_listings')
                  .select('id, name, photos, thumbnail_url')
                  .eq('is_active', true)
                  .not('photos', 'is', null)
                  .limit(30);
              })
            );
          } else {
            queryPromises.push(
              Promise.resolve(
                supabase.from('apartment_properties_listings')
                  .select('id, name, photos, thumbnail_url')
                  .eq('is_active', true)
                  .not('photos', 'is', null)
                  .limit(30)
              )
            );
          }
        }

        // User settings queries - Note: user_settings table doesn't exist in schema
        // Using notification_preferences as alternative
        if (intent.setting && userId) {
          queryPromises.push(
            Promise.resolve(
              supabase.from('notification_preferences')
                .select('*')
                .eq('user_id', userId)
                .single()
            )
          );
        }

        // Report queries
        if (intent.report && userId) {
          queryPromises.push(
            Promise.resolve(
              supabase.from('reports')
                .select(`
                  id,
                  report_type,
                  description,
                  status,
                  created_at,
                  users!reports_user_id_fkey(
                    id,
                    first_name,
                    last_name
                  )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10)
            )
          );
        }

        // Transit route queries
        if (intent.transitRoute) {
          queryPromises.push(
            Promise.resolve(
              supabase.from('transit_routes')
                .select(`
                  id,
                  wmata_route_id,
                  route_name,
                  route_type,
                  line_color,
                  is_active
                `)
                .eq('is_active', true)
                .order('route_name', { ascending: true })
                .limit(50)
            )
          );
        }

        // Rental estimate queries - Note: rental_estimates table doesn't exist
        // Using apartment_units rent_min/rent_max as alternative
        if (intent.rentalEstimate) {
          // Get property IDs if property name detected
          if (hasPropertyNameInQuery && propertyIdsPromise) {
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('apartment_units')
                    .select(`
                      property_id,
                      rent_min,
                      rent_max,
                      apartment_properties_listings!apartment_units_property_id_fkey(
                        id,
                        name,
                        address
                      )
                    `)
                    .in('property_id', propertyIds)
                    .not('rent_min', 'is', null)
                    .order('rent_min', { ascending: true })
                    .limit(20);
                }
                return supabase.from('apartment_units')
                  .select(`
                    property_id,
                    rent_min,
                    rent_max,
                    apartment_properties_listings!apartment_units_property_id_fkey(
                      id,
                      name,
                      address
                    )
                  `)
                  .not('rent_min', 'is', null)
                  .order('rent_min', { ascending: true })
                  .limit(20);
              })
            );
          } else {
            queryPromises.push(
              Promise.resolve(
                supabase.from('apartment_units')
                  .select(`
                    property_id,
                    rent_min,
                    rent_max,
                    apartment_properties_listings!apartment_units_property_id_fkey(
                      id,
                      name,
                      address
                    )
                  `)
                  .not('rent_min', 'is', null)
                  .order('rent_min', { ascending: true })
                  .limit(20)
              )
            );
          }
        }

        // Fallback: If property name detected but no property intent, still query properties
        // This ensures we can find specific properties mentioned by name even without explicit property keywords
        // Also ensure propertyIdsPromise is executed if it exists but wasn't used by other queries
        if (hasPropertyNameInQuery && !intent.property && !intent.review && !intent.attraction && !intent.commute && !intent.unit && !intent.price && !intent.community && !intent.room && !intent.photo && !intent.rentalEstimate) {
          if (propertyIdsPromise) {
            // Use the property IDs promise to get full property data
            queryPromises.push(
              propertyIdsPromise.then((propertyIds) => {
                if (propertyIds.length > 0) {
                  return supabase.from('apartment_properties_listings')
                    .select('id, name, address, city, state, zip_code, latitude, longitude, description, amenities')
                    .eq('is_active', true)
                    .not('name', 'is', null)
                    .in('id', propertyIds)
                    .limit(50);
                }
                // Fallback if no IDs found
                return supabase.from('apartment_properties_listings')
                  .select('id, name, address, city, state, zip_code, latitude, longitude, description, amenities')
                  .eq('is_active', true)
                  .not('name', 'is', null)
                  .limit(50);
              })
            );
          } else {
            // Build query from keywords
            let propertyQuery = supabase.from('apartment_properties_listings')
              .select('id, name, address, city, state, zip_code, latitude, longitude, description, amenities')
              .eq('is_active', true)
              .not('name', 'is', null);
            
            if (keywords.propertyName) {
              propertyQuery = propertyQuery.or(
                `name.ilike.%${keywords.propertyName}%,address.ilike.%${keywords.propertyName}%`
              );
            } else if (keywords.searchTerms.length > 0) {
              const searchConditions = [
                ...keywords.searchTerms.map(term => `name.ilike.%${term}%`),
                ...keywords.searchTerms.map(term => `address.ilike.%${term}%`)
              ].join(',');
              propertyQuery = propertyQuery.or(searchConditions);
            }
            
            queryPromises.push(
              Promise.resolve(propertyQuery.limit(50))
            );
          }
        }

        // Execute query-specific fetches in parallel
        if (queryPromises.length > 0) {
          const querySpecificStartTime = performance.now();
          const results = await Promise.all(queryPromises);
          const querySpecificTime = performance.now() - querySpecificStartTime;
          // Query-specific data fetched - no logging needed
          let resultIndex = 0;

          // Process safety results - filter valid incidents
          if (intent.safety) {
            const incidents = results[resultIndex++];
            if (incidents.data && incidents.data.length > 0) {
              const validIncidents = incidents.data.filter((i: any) => i && (i.description || i.type || i.location));
              if (validIncidents.length > 0) {
                contextParts.push(`SAFETY DATA: ${validIncidents.length} recent safety incidents available`);
              }
            }
          }

          // Process review results - ensure reviews have rating and property_id
          if (intent.review) {
            const reviews = results[resultIndex++];
            if (reviews.data && reviews.data.length > 0) {
              const validReviews = reviews.data.filter((r: any) => r && r.rating != null && r.property_id);
              if (validReviews.length > 0) {
                const reviewSummary = validReviews.slice(0, 3)
                  .map((r: any) => `${r.reviewer_name || 'Reviewer'} rated ${r.rating}★${r.title ? ` - "${r.title}"` : ''}`)
            .join('; ');
          contextParts.push(`PROPERTY REVIEWS: ${reviewSummary}`);
              }
            }
          }

          // Process property results - ensure properties are active and have name
          // Note: apartment_properties_listings primary key is 'id', not 'property_id'
          if (intent.property || intent.review || hasPropertyNameInQuery) {
            const properties = results[resultIndex++];
            
            // Debug logging
            if (process.env.DEBUG === 'true') {
              console.log(`🔍 Property Query Debug:`);
              console.log(`   - Query: "${query}"`);
              console.log(`   - Intent: property=${intent.property}, review=${intent.review}, hasPropertyName=${hasPropertyNameInQuery}`);
              console.log(`   - Keywords:`, keywords);
              console.log(`   - Raw data count:`, properties.data?.length || 0);
              console.log(`   - Error:`, properties.error || 'none');
            }
            
            if (properties.data && properties.data.length > 0) {
              const validProperties = properties.data.filter((p: any) => p && p.id && p.name);
              
              if (process.env.DEBUG === 'true') {
                console.log(`   - Valid properties count:`, validProperties.length);
                console.log(`   - Sample property:`, validProperties[0] ? {
                  id: validProperties[0].id,
                  name: validProperties[0].name,
                  address: validProperties[0].address,
                  city: validProperties[0].city,
                  state: validProperties[0].state
                } : 'none');
              }
              
              if (validProperties.length > 0) {
                // Format property list with more details
                // Show up to 30 properties in detail
                const displayCount = Math.min(30, validProperties.length);
                const propertyList = validProperties.slice(0, displayCount).map((p: any) => {
                  const parts: string[] = [p.name];
                  if (p.address) parts.push(p.address);
                  if (p.city && p.state) parts.push(`${p.city}, ${p.state}`);
                  return parts.join(' - ');
                }).join(' | ');
                
                // If there are more properties, add a note
                const totalNote = validProperties.length > displayCount 
                  ? ` (showing ${displayCount} of ${validProperties.length} total active properties)`
                  : '';
                
                // Add note if keyword search was performed
                const searchNote = (keywords.propertyName || keywords.searchTerms.length > 0)
                  ? ` [KEYWORD SEARCH: Found ${validProperties.length} matching properties]`
                  : '';
                
                contextParts.push(`AVAILABLE PROPERTIES (${validProperties.length} active${totalNote}${searchNote}): ${propertyList}`);
                
                if (process.env.DEBUG === 'true') {
                  console.log(`✅ Added properties context: ${validProperties.length} properties (displaying ${displayCount})`);
                }
        } else {
                if (process.env.DEBUG === 'true') {
                  console.log(`⚠️  No valid properties found after filtering`);
                }
              }
            } else {
              if (process.env.DEBUG === 'true') {
                console.log(`⚠️  No properties data returned from query`);
                if (properties.error) {
                  console.log(`   Error details:`, properties.error);
                }
              }
            }
          }

          // Process distance/commute results - ensure valid distances and reference locations
          if (intent.commute) {
            const distances = results[resultIndex++];
            const transitStations = results[resultIndex++]; // Get detailed transit stations result
            // If fallback query, there's an additional property query result
            let propertiesForTransit: any = null;
            if (!hasPropertyNameInQuery) {
              propertiesForTransit = results[resultIndex++];
            }
            
            // Process reference location distances
            if (distances.data && distances.data.length > 0) {
              const distanceData = Array.isArray(distances.data) ? distances.data : [distances.data];
              
              const validDistances = distanceData.filter((d: any) => {
                if (!d || d.distance_miles == null || d.distance_miles <= 0) return false;
                
                const ref = Array.isArray(d.apartment_reference_locations) 
                  ? d.apartment_reference_locations[0] 
                  : d.apartment_reference_locations;
                
                return ref && ref.name;
              });
              
              if (validDistances.length > 0) {
                const summary = validDistances.slice(0, 5).map((d: any) => {
                  const ref = Array.isArray(d.apartment_reference_locations) 
                    ? d.apartment_reference_locations[0] 
                    : d.apartment_reference_locations;
                  const distance = typeof d.distance_miles === 'number' 
                    ? d.distance_miles.toFixed(2) 
                    : d.distance_miles;
                  const walkTime = d.walking_time_minutes ? ` (${d.walking_time_minutes} min walk)` : '';
                  return `${ref.name} ${distance} mi${walkTime}`;
                }).join('; ');
                contextParts.push(`COMMUTE INFO (Reference Locations): ${summary}`);
              }
            }
            
            // Process detailed transit station data
            if (transitStations.data && transitStations.data.length > 0) {
              const transitData = Array.isArray(transitStations.data) ? transitStations.data : [transitStations.data];
              
              // Create property name map from properties
              const propertyNameMap = new Map<string, string>();
              
              // If we have properties from fallback query, use them to build the map
              if (propertiesForTransit && propertiesForTransit.data) {
                const props = Array.isArray(propertiesForTransit.data) ? propertiesForTransit.data : [propertiesForTransit.data];
                props.forEach((p: any) => {
                  if (p && p.id && p.name) {
                    propertyNameMap.set(p.id, p.name);
                  }
                });
              }
              
              // Handle both calculated distances (from our code) and database distances
              const validTransit = transitData.filter((t: any) => {
                if (!t || t.distance_miles == null || t.distance_miles <= 0) return false;
                
                // If it's from our calculated results, it has property_name and transit_station directly
                if (t.property_name && t.transit_station) {
                  return t.transit_station.name && t.transit_station.is_active === true;
                }
                
                // Otherwise, it's from database (has property_id and nested transit_station)
                if (!t.property_id) return false;
                
                const station = Array.isArray(t.transit_station) ? t.transit_station[0] : t.transit_station;
                return station && station.name && station.is_active === true;
              });
              
              if (validTransit.length > 0) {
                // Group by property
                const byProperty = new Map<string, any[]>();
                
                validTransit.forEach((t: any) => {
                  // Handle both calculated and database formats
                  const propertyName = t.property_name || propertyNameMap.get(t.property_id) || 'Unknown Property';
                  
                  if (!byProperty.has(propertyName)) {
                    byProperty.set(propertyName, []);
                  }
                  byProperty.get(propertyName)!.push(t);
                });
                
                // Format: "PROPERTY NAME: station1 (type) - distance mi; station2..." (already top 5 per property)
                const propertySummaries = Array.from(byProperty.entries()).map(([propertyName, stations]) => {
                  const summary = stations.map((t: any) => {
                    // Handle both calculated and database formats
                    const station = t.transit_station || (Array.isArray(t.transit_station) ? t.transit_station[0] : null);
                    if (!station) return '';
                    
                    const distance = typeof t.distance_miles === 'number' 
                      ? t.distance_miles.toFixed(2) 
                      : t.distance_miles;
                    const stationType = station.station_type || 'station';
                    const walkTime = t.walking_time_minutes ? ` (${t.walking_time_minutes} min walk)` : '';
                    return `${station.name} (${stationType}) - ${distance} mi${walkTime}`;
                  }).filter(s => s).join('; ');
                  return `${propertyName}: ${summary}`;
                });
                
                contextParts.push(`DETAILED TRANSIT STATIONS BY PROPERTY (TOP 5 NEAREST): ${propertySummaries.join(' | ')}`);
              }
            }
          }

          // Process attraction results - using property_attractions directly
          if (intent.attraction) {
            const detailedAttractions = results[resultIndex++];
            // If fallback query, there's an additional property query result
            let propertiesForAttractions: any = null;
            if (!hasPropertyNameInQuery) {
              propertiesForAttractions = results[resultIndex++];
            }
            
            // Debug logging
            if (process.env.DEBUG === 'true') {
              console.log(`🔍 Attraction Query Debug:`);
              console.log(`   - Intent detected: ${intent.attraction}`);
              console.log(`   - Detailed attractions count:`, detailedAttractions.data?.length || 0);
              console.log(`   - Has property query: ${!!propertiesForAttractions}`);
            }
            
            // Process detailed attraction data
            if (detailedAttractions.data && detailedAttractions.data.length > 0) {
              const attractionData = Array.isArray(detailedAttractions.data) ? detailedAttractions.data : [detailedAttractions.data];
              
              // Create a map of property_id -> property names
              // For calculated results, property_name is already available
              // For database results, we need to extract from nested property or use property_id
              const propertyNameMap = new Map<string, string>();
              
              // If we have properties from fallback query, use them to build the map
              if (propertiesForAttractions && propertiesForAttractions.data) {
                const props = Array.isArray(propertiesForAttractions.data) ? propertiesForAttractions.data : [propertiesForAttractions.data];
                props.forEach((p: any) => {
                  if (p && p.id && p.name) {
                    propertyNameMap.set(p.id, p.name);
                  }
                });
              }
              
              const validAttractions = attractionData.filter((a: any) => {
                if (!a) return false;
                
                // Handle both calculated format (has property_name and attraction directly) 
                // and database format (has property_id and nested attraction)
                if (a.property_name && a.attraction) {
                  // Calculated format
                  const attr = a.attraction;
                  return attr.id && 
                         attr.name && 
                         (attr.is_active === true || attr.is_active === undefined) &&
                         a.distance_miles != null &&
                         a.distance_miles > 0;
                } else if (a.property_id) {
                  // Database format
                  const attr = a.attraction;
                  if (!attr) return false;
                  
                  const attractionObj = Array.isArray(attr) ? attr[0] : attr;
                  if (!attractionObj) return false;
                  
                  return attractionObj.id && 
                         attractionObj.name && 
                         (attractionObj.is_active === true || attractionObj.is_active === undefined) &&
                         a.distance_miles != null &&
                         a.distance_miles > 0;
                }
                
                return false;
              });
              
              if (validAttractions.length > 0) {
                // Group by property
                const byProperty = new Map<string, any[]>();
                
                validAttractions.forEach((a: any) => {
                  // Handle both calculated (has property_name) and database (has property_id) formats
                  let propertyName = a.property_name;
                  if (!propertyName && a.property_id) {
                    propertyName = propertyNameMap.get(a.property_id) || `Property ${a.property_id.substring(0, 8)}`;
                  }
                  if (!propertyName) {
                    propertyName = 'Unknown Property';
                  }
                  
                  if (!byProperty.has(propertyName)) {
                    byProperty.set(propertyName, []);
                  }
                  byProperty.get(propertyName)!.push(a);
                });
                
                // Format detailed attractions
                const propertySummaries = Array.from(byProperty.entries()).map(([propertyName, attrs]) => {
                  const summary = attrs.slice(0, 5).map((a: any) => {
                    // Handle both calculated and database formats
                    let attr = a.attraction;
                    if (Array.isArray(attr)) {
                      attr = attr[0];
                    }
                    if (!attr) return '';
                    
                    const distance = typeof a.distance_miles === 'number' 
                      ? a.distance_miles.toFixed(2) 
                      : a.distance_miles;
                    const category = attr.category || attr.subcategory || 'attraction';
                    const rating = attr.rating ? ` ${attr.rating}★` : '';
                    const priceLevel = attr.price_level ? ` $${'$'.repeat(attr.price_level)}` : '';
                    return `${attr.name} (${category})${rating}${priceLevel} - ${distance} mi`;
              }).filter(s => s).join('; ');
                  return `${propertyName}: ${summary}`;
                });
                
                contextParts.push(`DETAILED ATTRACTIONS BY PROPERTY: ${propertySummaries.join(' | ')}`);
                
                if (process.env.DEBUG === 'true') {
                  console.log(`✅ Added detailed attractions context`);
                }
              }
            }
          }

          // Process roommate results - ensure valid matches with scores
          if (intent.roommate && userId) {
            const connections = results[resultIndex++];
            
            // Get match scores (should be second result)
            let matchScores: any = null;
            try {
              matchScores = results[resultIndex++];
            } catch (e) {
              // Match scores might not be available
            }
            
            if (matchScores && matchScores.data && matchScores.data.length > 0) {
              // Filter valid matches (must have name and score)
              const validMatches = matchScores.data.filter((m: any) => 
                m && 
                (m.name || m.user?.name) && 
                (m.compatibilityScore != null || m.score != null || m.priorityScore != null)
              );
              
              if (validMatches.length > 0) {
                // Sort by score (highest first)
                const sortedMatches = [...validMatches].sort((a: any, b: any) => {
                  const scoreA = a.compatibilityScore || a.score || a.priorityScore || 0;
                  const scoreB = b.compatibilityScore || b.score || b.priorityScore || 0;
                  return scoreB - scoreA;
                });
                
                // Format match scores with actual data - CRITICAL: Use exact scores
                const scoreList = sortedMatches.map((m: any) => {
                  const name = m.name || m.user?.name || 'Unknown';
                  const score = m.compatibilityScore || m.score || m.priorityScore || 'N/A';
                  return `${name}: ${score}%`;
              }).join('; ');
                
                // Identify best match
                const bestMatch = sortedMatches[0];
                const bestName = bestMatch?.name || bestMatch?.user?.name || 'Unknown';
                const bestScore = bestMatch?.compatibilityScore || bestMatch?.score || bestMatch?.priorityScore || 'N/A';
                
                // Add to context with very clear formatting
                contextParts.push(`=== ROOMMATE MATCH SCORES (USE THESE EXACT NUMBERS) ===`);
                contextParts.push(`ALL MATCHES: ${scoreList}`);
                contextParts.push(`BEST MATCH: ${bestName} has the highest score of ${bestScore}%`);
                contextParts.push(`=== END MATCH SCORES ===`);
              }
            } else if (connections.data && connections.data.length > 0) {
              // Filter valid connections (must match user_id)
              const validConnections = connections.data.filter((c: any) => 
                c && 
                (c.requester_id === userId || c.recipient_id === userId)
              );
              if (validConnections.length > 0) {
                contextParts.push(`ROOMMATE CONNECTIONS: User has ${validConnections.length} connections`);
              }
            }
          }

          // Process favorite results
          // Note: apartment_favorites.property_id references apartment_properties_listings.id
          if (intent.favorite && userId) {
            const favorites = results[resultIndex++];
            if (favorites.data && favorites.data.length > 0) {
              const validFavorites = favorites.data.filter((f: any) => {
                if (!f || !f.property_id) return false;
                
                // Handle both single object and array responses
                const prop = Array.isArray(f.apartment_properties_listings) 
                  ? f.apartment_properties_listings[0] 
                  : f.apartment_properties_listings;
                
                return prop && prop.name && prop.is_active === true;
              });
              
              if (validFavorites.length > 0) {
                const favoriteList = validFavorites.map((f: any) => {
                  const prop = Array.isArray(f.apartment_properties_listings) 
                    ? f.apartment_properties_listings[0] 
                    : f.apartment_properties_listings;
                  return prop.name;
                }).join(', ');
                contextParts.push(`SAVED PROPERTIES: ${validFavorites.length} saved - ${favoriteList}`);
              }
            }
          }

          // Process notification results
          if (intent.notification && userId) {
            const notifications = results[resultIndex++];
            if (notifications.data && notifications.data.length > 0) {
              const unreadCount = notifications.data.filter((n: any) => !n.is_read).length;
              const recentTypes = [...new Set(notifications.data.slice(0, 3).map((n: any) => n.notification_type))].join(', ');
              contextParts.push(`NOTIFICATIONS: ${notifications.data.length} total, ${unreadCount} unread. Recent types: ${recentTypes}`);
            }
          }

          // Process unit/availability results
          // Note: Use correct field names: id, beds, baths, rent_min, rent_max, availability_status
          if (intent.unit || intent.availability) {
            const units = results[resultIndex++];
            if (units.data && units.data.length > 0) {
              const validUnits = units.data.filter((u: any) => {
                if (!u || !u.id || !u.property_id) return false;
                
                const prop = Array.isArray(u.apartment_properties_listings) 
                  ? u.apartment_properties_listings[0] 
                  : u.apartment_properties_listings;
                
                return u.availability_status === 'available' && 
                       u.rent_min != null &&
                       prop && prop.is_active === true;
              });
              
              if (validUnits.length > 0) {
                const unitSummary = validUnits.slice(0, 3).map((u: any) => {
                  const prop = Array.isArray(u.apartment_properties_listings) 
                    ? u.apartment_properties_listings[0] 
                    : u.apartment_properties_listings;
                  const rent = u.rent_max ? `$${u.rent_min}-$${u.rent_max}` : `$${u.rent_min}`;
                  return `${prop.name} - ${u.beds}br/${u.baths}ba - ${rent}/mo`;
              }).join('; ');
                contextParts.push(`AVAILABLE UNITS: ${validUnits.length} units available. Examples: ${unitSummary}`);
              }
            }
          }

          // Process community posts results
          if (intent.community) {
            const posts = results[resultIndex++];
            if (posts.data && posts.data.length > 0) {
              const validPosts = posts.data.filter((p: any) => p && (p.title || p.content));
              if (validPosts.length > 0) {
                const postList = validPosts.slice(0, 10).map((p: any) => {
                  const title = p.title || 'Untitled';
                  const preview = p.content ? (p.content.substring(0, 50) + (p.content.length > 50 ? '...' : '')) : '';
                  return `${title}${preview ? `: ${preview}` : ''}`;
                }).join(' | ');
                contextParts.push(`COMMUNITY POSTS (${validPosts.length} posts): ${postList}`);
              }
            }
          }

          // Process room listings results
          if (intent.room) {
            const rooms = results[resultIndex++];
            if (rooms.data && rooms.data.length > 0) {
              const validRooms = rooms.data.filter((r: any) => r && r.title);
              if (validRooms.length > 0) {
                const roomList = validRooms.slice(0, 15).map((r: any) => {
                  const property = r.apartment_properties_listings || (Array.isArray(r.apartment_properties_listings) ? r.apartment_properties_listings[0] : null);
                  const propertyName = property?.name ? `[${property.name}] ` : '';
                  const rent = r.rent_amount ? `$${r.rent_amount}/mo` : 'Price TBD';
                  const date = r.available_date ? ` (Available: ${r.available_date})` : '';
                  return `${propertyName}${r.title} - ${rent}${date}`;
                }).join(' | ');
                contextParts.push(`ROOM LISTINGS (${validRooms.length} listings): ${roomList}`);
              }
            }
          }

          // Process photo results
          if (intent.photo) {
            const photos = results[resultIndex++];
            if (photos.data && photos.data.length > 0) {
              const validPhotos = photos.data.filter((p: any) => p && (p.photos || p.thumbnail_url));
              if (validPhotos.length > 0) {
                const photoList = validPhotos.slice(0, 15).map((p: any) => {
                  const photoCount = Array.isArray(p.photos) ? p.photos.length : (p.photos ? 1 : 0);
                  const hasThumbnail = p.thumbnail_url ? ' (has thumbnail)' : '';
                  return `${p.name}: ${photoCount} photo(s)${hasThumbnail}`;
                }).join(' | ');
                contextParts.push(`PROPERTY PHOTOS: ${photoList}`);
              }
            }
          }

          // Process user settings results (notification preferences)
          if (intent.setting && userId) {
            const settings = results[resultIndex++];
            if (settings.data) {
              const setting = settings.data;
              const settingsList = Object.entries(setting)
                .filter(([key]) => !['user_id', 'created_at', 'updated_at'].includes(key))
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
              if (settingsList) {
                contextParts.push(`USER NOTIFICATION PREFERENCES: ${settingsList}`);
              }
            }
          }

          // Process report results
          if (intent.report && userId) {
            const reports = results[resultIndex++];
            if (reports.data && reports.data.length > 0) {
              const validReports = reports.data.filter((r: any) => r && r.report_type);
              if (validReports.length > 0) {
                const reportList = validReports.slice(0, 10).map((r: any) => {
                  const status = r.status || 'pending';
                  return `${r.report_type} (${status})`;
                }).join(' | ');
                contextParts.push(`USER REPORTS (${validReports.length} reports): ${reportList}`);
              }
            }
          }

          // Process transit route results
          if (intent.transitRoute) {
            const routes = results[resultIndex++];
            if (routes.data && routes.data.length > 0) {
              const validRoutes = routes.data.filter((r: any) => r && r.route_name && r.is_active);
              if (validRoutes.length > 0) {
                const routeList = validRoutes.slice(0, 30).map((r: any) => {
                  const color = r.line_color ? ` (${r.line_color} line)` : '';
                  return `${r.route_name}${color}`;
                }).join(' | ');
                contextParts.push(`TRANSIT ROUTES (${validRoutes.length} active routes): ${routeList}`);
              }
            }
          }

          // Process rental estimate results (using apartment_units data)
          if (intent.rentalEstimate) {
            const estimates = results[resultIndex++];
            if (estimates.data && estimates.data.length > 0) {
              const validEstimates = estimates.data.filter((e: any) => e && e.rent_min != null);
              if (validEstimates.length > 0) {
                // Group by property and calculate min/max
                const byProperty = new Map<string, { name: string; min: number; max: number }>();
                validEstimates.forEach((e: any) => {
                  const property = e.apartment_properties_listings || (Array.isArray(e.apartment_properties_listings) ? e.apartment_properties_listings[0] : null);
                  const propertyName = property?.name || 'Unknown Property';
                  const propertyId = e.property_id;
                  
                  if (!byProperty.has(propertyId)) {
                    byProperty.set(propertyId, { name: propertyName, min: Infinity, max: 0 });
                  }
                  const prop = byProperty.get(propertyId)!;
                  prop.min = Math.min(prop.min, e.rent_min || Infinity);
                  prop.max = Math.max(prop.max, e.rent_max || e.rent_min || 0);
                });
                
                const estimateList = Array.from(byProperty.values()).slice(0, 15).map((p: any) => {
                  const range = p.min && p.max && p.min !== p.max ? `$${p.min}-$${p.max}` : p.min ? `$${p.min}` : 'N/A';
                  return `${p.name}: ${range}/mo`;
                }).join(' | ');
                contextParts.push(`RENTAL RANGES (${byProperty.size} properties): ${estimateList}`);
              }
            }
          }

          // Process price results
          if (intent.price && !intent.unit) {
            const priceData = results[resultIndex++];
            if (priceData.data && priceData.data.length > 0) {
              const validPrices = priceData.data.filter((p: any) => {
                if (!p || p.rent_min == null) return false;
                
                const prop = Array.isArray(p.apartment_properties_listings) 
                  ? p.apartment_properties_listings[0] 
                  : p.apartment_properties_listings;
                
                return prop && prop.is_active === true;
              });
              
              if (validPrices.length > 0) {
                const prices = validPrices.map((p: any) => p.rent_min).filter((p: any) => p != null);
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...validPrices.map((p: any) => p.rent_max || p.rent_min).filter((p: any) => p != null));
                const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
                contextParts.push(`PRICING INFO: ${validPrices.length} properties. Price range: $${minPrice}-$${maxPrice}/mo, Average: $${Math.round(avgPrice)}/mo`);
              }
            }
          }
        }
      } else {
        // For general queries without specific keywords, provide comprehensive context
        contextParts.push('DATA SOURCES AVAILABLE: apartment_properties_listings, apartment_units, property_reviews, property_attractions, property_distances, property_transit_stations, apartment_reference_locations, transit_stations, transit_routes, attractions, incidents, community_posts, room_listings, roommate_connections, apartment_favorites, notifications, notification_preferences, reports.');
      }

      // For anonymous users, provide minimal public context
      if (!userId) {
        contextParts.push('PUBLIC DATA: Property listings, reviews, and safety data are available. Sign in for personalized recommendations.');
      }

      const dbTotalTime = performance.now() - dbStartTime;
      
      // Log queried tables
      const queriedTablesArray = Array.from(queriedTables).sort();
      if (queriedTablesArray.length > 0) {
        if (process.env.DEBUG === 'true') {
          console.log(`\n📊 [Database Query] Tables accessed in this request (${queriedTablesArray.length}):`);
          queriedTablesArray.forEach((table, index) => {
            const exists = this.allDatabaseTables.includes(table);
            const status = exists ? '✅' : '⚠️ ';
            console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${status} ${table}${exists ? '' : ' (not in table list)'}`);
          });
          console.log(`   Total database time: ${(dbTotalTime / 1000).toFixed(2)}s\n`);
        } else {
          console.log(`📊 [Database Query] Accessed ${queriedTablesArray.length} table(s): ${queriedTablesArray.join(', ')}`);
        }
      }
      
      return contextParts.join('\n\n');
    } catch (error) {
      const dbErrorTime = performance.now() - dbStartTime;
      console.error(`❌ DB Error: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  private async logCost(tokens: number, userId?: number): Promise<number> {
    // Estimate cost (rough calculation for gpt-3.5-turbo)
    const costPerToken = 0.000002; // Approximate cost per token
    const cost = tokens * costPerToken;

    this.costLogs.push({
      timestamp: new Date(),
      cost,
      tokens,
      userId
    });

    // Keep only last 1000 logs
    if (this.costLogs.length > 1000) {
      this.costLogs = this.costLogs.slice(-1000);
    }

    return cost;
  }

  async generateResponse(request: ChatbotRequest): Promise<ChatbotResponse> {
    const { message, context } = request;
    const userId = context.userId?.toString() || 'anonymous';
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestStartTime = performance.now();

    // 🔒 GUARDRAILS: Input Validation
    console.log(`\n🔒 [Guardrails] Input Validation - Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    const inputValidation = guardrailsService.validateInput(message);
    if (!inputValidation.valid) {
      const responseTime = performance.now() - requestStartTime;
      console.log(`❌ [Guardrails] Input Validation FAILED: ${inputValidation.reason}`);
      telemetryService.track(responseTime, false, context.userId, context.sessionId, inputValidation.reason);
      
      const response = {
        response: "I'm sorry, but I couldn't process your message. Please try rephrasing it.",
        confidence: 0.5,
        cost: 0,
        tokens: 0
      };
      
      this.logChatInteraction(logId, context, message, response.response, [], 0.5, 0, 0, false, true, true);
      return response;
    }
    console.log(`✅ [Guardrails] Input Validation PASSED`);

    // Use sanitized message
    const sanitizedMessage = inputValidation.sanitized || message;

    // 🔒 GUARDRAILS: Safety Check
    console.log(`🔒 [Guardrails] Safety Check - Checking for unsafe content...`);
    const safetyCheck = guardrailsService.checkSafety(sanitizedMessage);
    if (safetyCheck.blocked) {
      const responseTime = performance.now() - requestStartTime;
      console.log(`❌ [Guardrails] Safety Check FAILED: ${safetyCheck.reason}`);
      telemetryService.track(responseTime, false, context.userId, context.sessionId, safetyCheck.reason);

      const response = {
        response: "I can't help with that type of request. Please ask about housing, roommates, or platform features.",
        confidence: 0.8,
        cost: 0,
        tokens: 0
      };
      
      this.logChatInteraction(logId, context, sanitizedMessage, response.response, [], 0.8, 0, 0, false, false, true);
      return response;
    }
    console.log(`✅ [Guardrails] Safety Check PASSED`);

    // 🔒 GUARDRAILS: Rate Limit Check
    console.log(`🔒 [Guardrails] Rate Limit Check - User: ${userId || 'anonymous'}, Current count: ${this.rateLimits.get(userId)?.count || 0}`);
    const rateLimitPassed = await this.checkRateLimit(userId);
    const rateLimitCheck = guardrailsService.checkRateLimit(this.rateLimits.get(userId)?.count || 0);
    if (!rateLimitPassed || !rateLimitCheck.passed) {
      const responseTime = performance.now() - requestStartTime;
      console.log(`❌ [Guardrails] Rate Limit Check FAILED: ${rateLimitCheck.reason}`);
      telemetryService.track(responseTime, false, context.userId, context.sessionId, rateLimitCheck.reason);

      const response = {
        response: "I'm receiving too many requests. Please wait a moment before trying again.",
        confidence: 1.0,
        cost: 0,
        tokens: 0
      };
      
      this.logChatInteraction(logId, context, sanitizedMessage, response.response, [], 1.0, 0, 0, false, true, false);
      return response;
    }
    console.log(`✅ [Guardrails] Rate Limit Check PASSED`);

    try {
      
      // Run document retrieval and database context in parallel for better performance
      const contextStartTime = performance.now();
      const [relevantDocs, dbContext] = await Promise.all([
        this.retrieveRelevantDocuments(message, 3),
        this.getDatabaseContext(context.userId, message)
      ]);
      const contextTime = performance.now() - contextStartTime;
      // Context retrieval completed - no logging needed

      // Create context from retrieved documents
      const contextText = relevantDocs.map(doc => 
        `Q: ${doc.question}\nA: ${doc.answer}`
      ).join('\n\n');
      
      // Limit database context size to prevent huge prompts (max 2000 chars)
      const limitedDbContext = dbContext.length > 2000 
        ? dbContext.substring(0, 2000) + '... (truncated)'
        : dbContext;
      
      // Log context summary (only if debug mode)
      if (process.env.DEBUG === 'true') {
        console.log(`📊 Context: ${dbContext.length} chars → ${limitedDbContext.length} chars`);
        // Show actual context content in debug mode
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📋 DATABASE CONTEXT (first 500 chars):`);
        console.log(limitedDbContext.substring(0, 500) + (limitedDbContext.length > 500 ? '...' : ''));
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }
      
      // Create the prompt for OpenAI
      const systemPrompt = `You are HokieNest Assistant, a comprehensive AI for a student housing and roommate matching platform.

KNOWLEDGE BASE:
${contextText}

DATABASE CONTEXT:
${limitedDbContext}

AVAILABLE FEATURES:
- Property Search: Search and browse apartment listings with detailed information
- Reviews & Ratings: View and search property reviews from residents
- Attractions & Amenities: Find nearby restaurants, bars, cafes, and attractions
- Transit Information: Get transit stations, routes, and commute times
- Safety Data: Access safety incidents and crime information
- Roommate Matching: Find compatible roommates with match scores
- Community Posts: Browse and search community discussions
- Room Listings: Find room sharing and sublet opportunities
- Photos: View property photos and galleries
- Rental Estimates: Get market rent estimates for properties
- User Settings: Access and manage user preferences
- Reports: View user reports and issues
- Favorites: Manage saved properties
- Notifications: Check user notifications

INSTRUCTIONS:
1. SCOPE: Answer questions about HokieNest platform including:
   - Housing: properties, units, prices, availability, photos, reviews
   - Location: attractions, transit, commute, distances, safety
   - Roommates: matching, compatibility, connections, room listings
   - Community: posts, discussions, sharing
   - User: settings, preferences, favorites, notifications, reports
2. OFF-TOPIC POLICY: If question is NOT about HokieNest, politely decline: "I'm designed to help with HokieNest housing and roommate matching. Can I assist with finding a place or a roommate?"
3. LENGTH: Keep responses SHORT - maximum 2-3 sentences for simple queries, up to 4 sentences for complex queries
4. ⚠️ CRITICAL - DATA ACCURACY (MOST IMPORTANT): 
   - You MUST use ONLY the exact numbers from the DATABASE CONTEXT section below
   - DO NOT estimate, round, or make up any numbers
   - If the context says "chenwu: 73%", you MUST say 73%, NOT 78% or any other number
   - If the context says "BEST MATCH: chenwu with 73%", you MUST say chenwu has 73%
   - When asked "who has the best matching", look for the "BEST MATCH" line in the context
   - NEVER round numbers (e.g., 73% should NOT become 78% or 70%)
5. MATCH SCORES: 
   - Look for the "=== ROOMMATE MATCH SCORES ===" section in DATABASE CONTEXT
   - Use ONLY the exact scores listed there
   - If user corrects you (e.g., "the data I get is 73"), immediately acknowledge: "You're right, the match score is 73%"
6. TONE: Be friendly, helpful, and informative
7. PERSONALIZATION: Reference user preferences when relevant
8. SUGGESTIONS: End with 2-3 relevant suggestion buttons: [Suggestion1] [Suggestion2] [Suggestion3]
9. DATA AVAILABILITY: 
   - You have access to ALL data sources listed in DATABASE CONTEXT
   - Never say you lack access to data. If nothing relevant is found, suggest alternatives or explain what data is available
   - For reviews: If nothing found, say reviews haven't been recorded yet and suggest leaving one
   - For photos: If nothing found, mention that photos may be added soon
   - For community posts: If nothing found, suggest creating a post
10. COMPREHENSIVE ANSWERS:
    - When asked about a property, provide comprehensive info: reviews, attractions, transit, photos, prices, units
    - When asked about location, include attractions, transit, safety, and distances
    - When asked about roommates, include match scores, compatibility, and connection status
    - When asked about community, include recent posts and discussions

RESPONSE FORMAT:
- Answer directly in 1-3 sentences (up to 4 for complex queries)
- Include relevant context from DATABASE CONTEXT
- End with suggestion buttons in brackets
- Be specific and accurate with all numbers and data

Keep responses concise but comprehensive.`

      // Get conversation history for this session
      const conversationHistory = this.conversationHistory.get(context.sessionId) || [];
      const recentHistory = conversationHistory.slice(-6); // Keep last 3 exchanges (6 messages)

      // Call OpenAI API directly with conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...recentHistory as Array<{ role: 'user' | 'assistant'; content: string }>,
        { role: 'user', content: message }
      ];

      // Log request details
      const systemPromptSize = systemPrompt.length;
      const totalMessageSize = JSON.stringify(messages).length;
      const totalTokens = Math.ceil(totalMessageSize / 4); // Rough estimate
      const model = LLM_PROVIDER === 'qwen' 
        ? (process.env.QWEN_MODEL || 'qwen-max')
        : (process.env.OPENAI_MODEL || 'gpt-3.5-turbo');
      const providerName = LLM_PROVIDER === 'qwen' ? 'Qwen (DashScope)' : 'OpenAI (Official)';
      const apiURL = getBaseURL() || 'https://api.openai.com/v1';
      // Simplified logging
      if (process.env.DEBUG === 'true') {
        console.log(`🚀 [${providerName}] Request → Model: ${model} | API: ${apiURL} | Tokens: ~${totalTokens}`);
      }

      const apiStartTime = performance.now();
      let completion;
      let apiTime: number = 0;
      const maxRetries = 3;
      let lastError: any = null;
      
      // Retry logic for connection errors
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Get model from environment variable
          const model = LLM_PROVIDER === 'qwen' 
            ? (process.env.QWEN_MODEL || 'qwen-max')
            : (process.env.OPENAI_MODEL || 'gpt-3.5-turbo');
          
          const apiURL = getBaseURL() || 'https://api.openai.com/v1';
          if (attempt > 1) {
            console.log(`🔄 [${providerName}] Retry attempt ${attempt}/${maxRetries}...`);
          }
          
          completion = await openai.chat.completions.create({
            model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 200,
          }) as any;
          
          apiTime = performance.now() - apiStartTime;
          
          // Simplified logging - only show if slow or in debug mode
          if (apiTime > 10000 || process.env.DEBUG === 'true') {
            console.log(`✅ [${providerName}] Response: ${(apiTime / 1000).toFixed(2)}s`);
          }
          
          // Warn if very slow
          if (apiTime > 50000) {
            console.warn(`⚠️  Slow API response: ${(apiTime / 1000).toFixed(2)}s`);
          }
          
          // Success - break out of retry loop
          break;
        } catch (error: any) {
          lastError = error;
          apiTime = performance.now() - apiStartTime;
          const errorMsg = error.message || error.toString();
          const errorCode = error.code || error.status || 'UNKNOWN';
          
          // Check if it's a connection error that we should retry
          const isConnectionError = 
            errorMsg.includes('Connection error') ||
            errorMsg.includes('ECONNREFUSED') ||
            errorMsg.includes('ETIMEDOUT') ||
            errorMsg.includes('ENOTFOUND') ||
            errorMsg.includes('network') ||
            errorCode === 'ECONNREFUSED' ||
            errorCode === 'ETIMEDOUT';
          
          console.error(`❌ [${providerName}] API Error (Attempt ${attempt}/${maxRetries}): ${errorMsg.substring(0, 100)}`);
          
          // Always show detailed error info for connection errors
          const apiURL = getBaseURL() || 'https://api.openai.com/v1';
          const apiKey = getApiKey();
          const apiKeyPreview = apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET';
          
          console.error(`   - Time: ${(apiTime / 1000).toFixed(2)}s`);
          console.error(`   - URL: ${apiURL}`);
          console.error(`   - Error Code: ${errorCode}`);
          console.error(`   - Is Connection Error: ${isConnectionError}`);
          console.error(`   - API Key: ${apiKeyPreview}`);
          
          if (process.env.DEBUG === 'true' || isConnectionError) {
            if (error.response) {
              console.error(`   - Status: ${error.response.status}`);
              console.error(`   - Response Data:`, JSON.stringify(error.response.data || {}).substring(0, 200));
            }
            if (error.cause) {
              console.error(`   - Cause:`, error.cause);
            }
            if (error.stack) {
              console.error(`   - Stack (first 3 lines):`, error.stack.split('\n').slice(0, 3).join('\n'));
            }
          }
          
          // If it's a connection error and we have retries left, wait and retry
          if (isConnectionError && attempt < maxRetries) {
            const waitTime = attempt * 1000; // Exponential backoff: 1s, 2s, 3s
            console.log(`⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // If it's not a connection error, or we're out of retries, throw
          throw error;
        }
      }
      
      // If we exhausted all retries, throw the last error
      if (!completion && lastError) {
        throw lastError;
      }

      const response = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';
      
      // 🔒 GUARDRAILS: Output Validation
      console.log(`🔒 [Guardrails] Output Validation - Response length: ${response.length} chars`);
      const outputValidation = guardrailsService.validateOutput(response);
      if (!outputValidation.valid) {
        console.log(`⚠️  [Guardrails] Output Validation: Response sanitized (length: ${outputValidation.sanitized?.length || 0} chars)`);
      } else {
        console.log(`✅ [Guardrails] Output Validation PASSED`);
      }
      let finalResponseText = outputValidation.valid 
        ? this.cleanResponse(response)
        : (outputValidation.sanitized || this.cleanResponse(response));

      const sources = relevantDocs.map(doc => doc.id);
      
      // Extract suggestions from response
      const suggestions = this.extractSuggestionsFromResponse(finalResponseText);

      // Calculate tokens and cost
      const tokens = completion.usage?.total_tokens || Math.ceil(response.length / 4);
      const cost = await this.logCost(tokens, context.userId);

      const totalTime = performance.now() - requestStartTime;

      // 📊 TELEMETRY: Track successful request
      console.log(`\n📊 [Telemetry] Request Completed:`);
      console.log(`   - Response Time: ${totalTime.toFixed(2)}ms`);
      console.log(`   - User: ${context.userId || 'anonymous'}`);
      console.log(`   - Session: ${context.sessionId.substring(0, 20)}...`);
      console.log(`   - Tokens: ${tokens}`);
      console.log(`   - Cost: $${cost.toFixed(6)}`);
      console.log(`   - Success: ✅\n`);
      telemetryService.track(totalTime, true, context.userId, context.sessionId);

      const finalResponse = {
        response: finalResponseText,
        sources,
        suggestions,
        confidence: 0.8,
        cost,
        tokens
      };

      // Save to conversation history (in-memory)
      if (!this.conversationHistory.has(context.sessionId)) {
        this.conversationHistory.set(context.sessionId, []);
      }
      const sessionHistory = this.conversationHistory.get(context.sessionId)!;
      sessionHistory.push({ role: 'user', content: message });
      sessionHistory.push({ role: 'assistant', content: finalResponse.response });
      
      // Keep only last 10 exchanges to prevent memory growth
      if (sessionHistory.length > 20) {
        sessionHistory.splice(0, sessionHistory.length - 20);
      }

      // Save conversation to Supabase database (async, fire and forget)
      this.saveConversationToDatabase(context, sanitizedMessage, finalResponse.response).catch(err => {
        console.error('Error saving conversation (non-blocking):', err);
      });

      // Simplified performance summary
      if (process.env.DEBUG === 'true' || totalTime > 5000) {
        console.log(`⏱️  Total: ${(totalTime / 1000).toFixed(2)}s | DB: ${(contextTime / 1000).toFixed(2)}s | API: ${(apiTime / 1000).toFixed(2)}s | Tokens: ${tokens}`);
      }

      // Log successful interaction
      this.logChatInteraction(logId, context, sanitizedMessage, finalResponse.response, sources, 0.8, cost, tokens, true, true, true);
      
      return finalResponse;

    } catch (error: any) {
      const totalTime = performance.now() - requestStartTime;
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      
      // 📊 TELEMETRY: Track failed request
      console.log(`\n📊 [Telemetry] Request Failed:`);
      console.log(`   - Response Time: ${totalTime.toFixed(2)}ms`);
      console.log(`   - User: ${context.userId || 'anonymous'}`);
      console.log(`   - Session: ${context.sessionId.substring(0, 20)}...`);
      console.log(`   - Error: ${errorMessage.substring(0, 100)}`);
      console.log(`   - Success: ❌\n`);
      console.error(`❌ Request failed: ${errorMessage.substring(0, 100)} (${(totalTime / 1000).toFixed(2)}s)`);
      
      telemetryService.track(totalTime, false, context.userId, context.sessionId, errorMessage);
      
      // Check for specific error types
      const errorMsg = errorMessage.toLowerCase();
      const errorCode = error?.code || error?.status || '';
      
      // Check for quota error
      const isQuotaError = error?.code === 'insufficient_quota' || 
                          error?.type === 'insufficient_quota' || 
                          error?.isQuotaError ||
                          errorMsg.includes('quota') ||
                          errorMsg.includes('exceeded your current quota') ||
                          errorMsg.includes('billing') ||
                          error?.status === 429;
      
      // Check if it's an API authentication error
      const isAuthError = errorMsg.includes('api key') ||
                         errorMsg.includes('authentication') ||
                         errorMsg.includes('unauthorized') ||
                         error?.status === 401 ||
                         errorCode === '401';
      
      // Check if it's a connection/network error
      const isConnectionError = errorMsg.includes('connection error') ||
                               errorMsg.includes('econnrefused') ||
                               errorMsg.includes('etimedout') ||
                               errorMsg.includes('enotfound') ||
                               errorMsg.includes('network') ||
                               errorCode === 'ECONNREFUSED' ||
                               errorCode === 'ETIMEDOUT' ||
                               errorCode === 'ENOTFOUND';
      
      // Fallback response with more helpful message based on error type
      let fallbackResponse;
      if (isAuthError) {
        fallbackResponse = {
          response: "I'm unable to connect to the AI service due to authentication issues. Please check that your OpenAI API key is correctly configured in the server settings.",
          confidence: 0.3,
          cost: 0,
          tokens: 0
        };
      } else if (isQuotaError) {
        fallbackResponse = {
          response: "I'm currently unable to process requests due to API quota limits. Please check your OpenAI account billing and usage limits. You can visit https://platform.openai.com/account/billing to add credits or upgrade your plan.",
          confidence: 0.3,
          cost: 0,
          tokens: 0
        };
      } else if (isConnectionError) {
        fallbackResponse = {
          response: "I'm experiencing connection issues with the OpenAI API. This could be due to network problems or the API being temporarily unavailable. Please try again in a few moments.",
          confidence: 0.3,
          cost: 0,
          tokens: 0
        };
      } else {
        fallbackResponse = {
        response: "I'm having trouble processing your request right now. Please try again or contact support if the issue persists.",
        confidence: 0.3,
        cost: 0,
        tokens: 0
      };
      }
      
      // Log detailed error information for debugging
      const apiURL = getBaseURL() || 'https://api.openai.com/v1';
      const apiKey = getApiKey();
      const apiKeyPreview = apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET';
      
      console.error(`\n🔍 [Error Details]`);
      console.error(`   - Type: ${isAuthError ? 'Authentication' : isQuotaError ? 'Quota' : isConnectionError ? 'Connection' : 'Unknown'}`);
      console.error(`   - Code: ${errorCode || 'N/A'}`);
      console.error(`   - Status: ${error?.status || 'N/A'}`);
      console.error(`   - API URL: ${apiURL}`);
      console.error(`   - API Key: ${apiKeyPreview}`);
      console.error(`   - Message: ${errorMessage.substring(0, 200)}`);
      
      // Connection error troubleshooting tips
      if (isConnectionError) {
        console.error(`\n💡 [Troubleshooting Tips for Connection Error]`);
        console.error(`   1. Check if OPENAI_API_KEY is set correctly in server/.env`);
        console.error(`   2. Verify your OpenAI API key is valid at https://platform.openai.com/api-keys`);
        console.error(`   3. Check network connectivity: Can you reach ${apiURL}?`);
        console.error(`   4. If behind a proxy/firewall, ensure OpenAI API is accessible`);
        console.error(`   5. Try testing the API key directly: curl https://api.openai.com/v1/models -H "Authorization: Bearer YOUR_KEY"`);
      }
      
      // Log error
      this.logChatInteraction(logId, context, message, fallbackResponse.response, [], 0.3, 0, 0, false, true, true);
      
      return fallbackResponse;
    }
  }

  private extractSuggestionsFromResponse(response: string): string[] {
    // Extract suggestions from [Suggestion] format in response
    const suggestionRegex = /\[([^\]]+)\]/g;
    const matches = response.match(suggestionRegex);
    
    if (matches && matches.length > 0) {
      return matches.map(match => match.slice(1, -1)).slice(0, 6);
    }
    
    // Fallback to default suggestions
    return DEFAULT_SUGGESTIONS.slice(0, 6);
  }

  private cleanResponse(response: string): string {
    // Remove suggestion brackets from the main response
    return response.replace(/\[([^\]]+)\]/g, '').trim();
  }

  private generateSuggestions(question: string, response: string): string[] {
    const suggestions = new Set<string>();
    
    if (question.toLowerCase().includes('housing') || question.toLowerCase().includes('property')) {
      ['Show me properties', 'Set my budget', 'Filter by location', 'Compare commute times', 'View safety insights'].forEach(s => suggestions.add(s));
    } else if (question.toLowerCase().includes('roommate')) {
      ['Start questionnaire', 'View my matches', 'Update preferences', 'Share my roommate profile'].forEach(s => suggestions.add(s));
    } else if (question.toLowerCase().includes('priority')) {
      ['Set my priorities', 'View dashboard', 'How to optimize', 'Explain priority scoring'].forEach(s => suggestions.add(s));
    } else {
      DEFAULT_SUGGESTIONS.forEach(s => suggestions.add(s));
    }

    DEFAULT_SUGGESTIONS.forEach(s => suggestions.add(s));

    return Array.from(suggestions).slice(0, 6);
  }

  // Get FAQ items with optional filtering
  getFAQItems(category?: string, limit: number = 50): FAQItem[] {
    let items = this.faqData;
    
    if (category) {
      items = items.filter(item => item.category === category);
    }
    
    return items
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  // Save conversation to Supabase database (async, non-blocking)
  private async saveConversationToDatabase(context: ChatbotContext, message: string, response: string): Promise<void> {
    try {
      // Save to chatbot_conversations table
      const { data, error } = await supabase.from('chatbot_conversations').insert({
        session_id: context.sessionId,
        user_id: context.userId || null,
        user_message: message,
        bot_response: response,
        current_page: context.currentPage || null,
        created_at: new Date().toISOString()
      }).select();

      if (error) {
        console.error('❌ [Storage] Failed to save conversation to database:', error);
        console.error('   - Error code:', error.code);
        console.error('   - Error message:', error.message);
        console.error('   - Error details:', error.details);
        console.error('   - Error hint:', error.hint);
        console.error('   - Session ID:', context.sessionId);
        console.error('   - User ID:', context.userId || 'anonymous');
      } else {
        if (process.env.DEBUG === 'true') {
          console.log('✅ [Storage] Conversation saved successfully');
          console.log('   - Session ID:', context.sessionId);
          console.log('   - User ID:', context.userId || 'anonymous');
          console.log('   - Message length:', message.length, 'chars');
          console.log('   - Response length:', response.length, 'chars');
          if (data && data.length > 0) {
            console.log('   - Saved record ID:', data[0].id);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ [Storage] Exception saving conversation to database:', error);
      console.error('   - Error type:', error?.constructor?.name);
      console.error('   - Error message:', error?.message);
      console.error('   - Stack trace:', error?.stack);
      // Don't throw - continue even if database save fails
    }
  }

  // Logging methods
  private logChatInteraction(
    logId: string,
    context: ChatbotContext,
    message: string,
    response: string,
    sources: string[],
    confidence: number,
    cost: number,
    tokens: number,
    success: boolean,
    safetyFilterPassed: boolean,
    rateLimitPassed: boolean
  ) {
    const log: ChatbotLog = {
      id: logId,
      userId: context.userId,
      sessionId: context.sessionId,
      message,
      response,
      sources,
      confidence,
      cost,
      tokens,
      timestamp: new Date(),
      currentPage: context.currentPage,
      safetyFilterPassed,
      rateLimitPassed
    };
    
    this.chatLogs.push(log);
    
    // Keep only last 1000 logs to prevent memory issues
    if (this.chatLogs.length > 1000) {
      this.chatLogs = this.chatLogs.slice(-1000);
    }
    
    // Enhanced console logging
    // Simplified interaction log - only show in debug mode or on errors
    if (process.env.DEBUG === 'true' || !success || !safetyFilterPassed || !rateLimitPassed) {
      const userInfo = context.userId ? `User ${context.userId}` : 'anonymous';
      const status = success ? '✅' : '❌';
      console.log(`${status} Chatbot | ${userInfo} | "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}" | Tokens: ${tokens}`);
    }
  }

  // Admin methods for monitoring
  getCostLogs(limit: number = 100) {
    return this.costLogs.slice(-limit);
  }

  getTotalCost(): number {
    return this.costLogs.reduce((sum, log) => sum + log.cost, 0);
  }

  getChatLogs(limit: number = 100): ChatbotLog[] {
    return this.chatLogs.slice(-limit);
  }

  getChatStats(): {
    totalInteractions: number;
    totalCost: number;
    averageConfidence: number;
    blockedRequests: number;
    successfulRequests: number;
  } {
    const totalInteractions = this.chatLogs.length;
    const totalCost = this.chatLogs.reduce((sum, log) => sum + log.cost, 0);
    const averageConfidence = totalInteractions > 0 
      ? this.chatLogs.reduce((sum, log) => sum + log.confidence, 0) / totalInteractions 
      : 0;
    const blockedRequests = this.chatLogs.filter(log => !log.safetyFilterPassed || !log.rateLimitPassed).length;
    const successfulRequests = totalInteractions - blockedRequests;

    return {
      totalInteractions,
      totalCost,
      averageConfidence,
      blockedRequests,
      successfulRequests
    };
  }

  getRateLimitStatus(userId: string) {
    return this.rateLimits.get(userId);
  }

  resetRateLimit(userId: string) {
    this.rateLimits.delete(userId);
  }

  /**
   * Get roommate match scores for a user
   */
  private async getRoommateMatchScores(userId: number): Promise<{ data: any[] }> {
    try {
      const matchingService = new RoommateMatchingService();
      const matches = await matchingService.findMatches(userId.toString(), 10);
      
      // Format matches with scores - ensure all score fields are present
      const formattedMatches = matches.map(match => ({
        name: match.name,
        compatibilityScore: match.compatibilityScore,
        score: match.compatibilityScore,
        priorityScore: match.compatibilityScore,
        budget: match.preferences?.budgetRange || [],
        pets: match.preferences?.hasPets || [],
        // Include raw data for debugging
        _raw: {
          id: match.id,
          email: match.email,
          compatibilityScore: match.compatibilityScore,
        }
      }));
      
      return { data: formattedMatches };
    } catch (error) {
      console.error('❌ Match scores error:', error instanceof Error ? error.message : String(error));
      return { data: [] };
    }
  }

  /**
   * Detect query type for telemetry
   */
  private detectQueryType(message: string): string {
    const msg = message.toLowerCase();
    if (msg.includes('safety') || msg.includes('incident') || msg.includes('crime')) return 'safety';
    if (msg.includes('review') || msg.includes('rating') || msg.includes('property')) return 'property';
    if (msg.includes('distance') || msg.includes('commute') || msg.includes('walking')) return 'commute';
    if (msg.includes('attraction') || msg.includes('restaurant') || msg.includes('cafe')) return 'attraction';
    if (msg.includes('roommate') || msg.includes('match')) return 'roommate';
    if (msg.includes('preference') || msg.includes('priority')) return 'preference';
    return 'general';
  }

  // Add new FAQ items
  async addFAQItem(faq: Omit<FAQItem, 'id'>): Promise<string> {
    const id = `faq-${Date.now()}`;
    const newFAQ = { ...faq, id };
    
    this.faqData.push(newFAQ);
    
    return id;
  }

  // Update FAQ item
  async updateFAQItem(id: string, updates: Partial<FAQItem>): Promise<boolean> {
    const index = this.faqData.findIndex(faq => faq.id === id);
    if (index === -1) return false;
    
    this.faqData[index] = { ...this.faqData[index], ...updates };
    
    return true;
  }

  // Delete FAQ item
  async deleteFAQItem(id: string): Promise<boolean> {
    const index = this.faqData.findIndex(faq => faq.id === id);
    if (index === -1) return false;
    
    this.faqData.splice(index, 1);
    
    return true;
  }

  // Invalidate user context cache (call when user data changes)
  invalidateUserCache(userId?: number): void {
    if (userId) {
      this.userContextCache.delete(userId);
    } else {
      this.userContextCache.clear();
    }
  }

  // Clean up expired cache entries (call periodically)
  cleanupCache(): void {
    const now = Date.now();
    for (const [userId, cached] of this.userContextCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.userContextCache.delete(userId);
      }
    }
  }
}

// Export singleton instance
export const ragService = new RAGService();

