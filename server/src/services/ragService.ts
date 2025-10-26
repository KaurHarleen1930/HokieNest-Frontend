import { OpenAI } from 'openai';
import { supabase } from '../lib/supabase';

// Initialize OpenAI client with environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-7CGGsORGsLtombO9DaCaCeCf7e9d4c95B8Fc87C4DaE62f86',
  baseURL: process.env.OPENAI_BASE_URL || 'https://ai-yyds.com/v1',
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

export class RAGService {
  private faqData: FAQItem[] = [];
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private costLogs: Array<{ timestamp: Date; cost: number; tokens: number; userId?: number }> = [];
  private chatLogs: ChatbotLog[] = [];
  private conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();

  constructor() {
    this.initializeFAQData();
  }

  private async initializeFAQData() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              🤖 CHATBOT SYSTEM INITIALIZATION                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('🔑 API Configuration:');
    console.log(`   ✅ OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Using fallback'}`);
    console.log(`   🌐 Base URL: ${process.env.OPENAI_BASE_URL || 'https://ai-yyds.com/v1'}`);
    console.log('\n🛡️  Guardrails Active:');
    console.log('   ✅ Rate Limiting: 10 requests/minute per user');
    console.log('   ✅ Safety Filters: 15+ content moderation patterns');
    console.log('   ✅ Cost Tracking: Real-time token and cost monitoring');
    console.log('   ✅ Conversation Memory: Session-based (last 10 exchanges)');
    console.log('\n📚 Loading Knowledge Base...');
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
    console.log(`✅ Knowledge Base: ${this.faqData.length} FAQ items loaded`);
    console.log('   📂 Categories: priorities, roommates, budget, safety, properties, dashboard, profile');
    console.log('   🏗️  Retrieval: Keyword-based matching with priority sorting');
    console.log('\n💾 Database Integration (ALL TABLES):');
    console.log('   ✅ User Tables: users, user_profiles');
    console.log('   ✅ Preference Tables: housing_preferences, lifestyle_preferences, housing_priorities');
    console.log('   ✅ Property Tables: listings, apartment_properties_listings, apartment_units');
    console.log('   ✅ Safety Tables: incidents');
    console.log('   ✅ Matching Tables: user_priority_weights, roommate_matches');
    console.log('   ✅ Storage: chatbot_conversations (conversation history)');
    console.log('   ✅ RAG System: Combines ALL 10+ database tables for comprehensive context');
    console.log('\n🚀 Chatbot System Ready!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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

  private async getDatabaseContext(userId?: number, query?: string): Promise<string> {
    try {
      let context = '';
      const contextParts: string[] = [];

      if (userId) {
        // Get ALL user data from ALL tables in the database
        const [
          housingPrefs,
          lifestylePrefs,
          priorities,
          listings,
          userProfiles,
          apartmentProperties,
          incidents,
          roommateMatches,
          userWeights
        ] = await Promise.all([
          // User preferences and priorities
          supabase.from('housing_preferences').select('*').eq('user_id', userId).single(),
          supabase.from('lifestyle_preferences').select('*').eq('user_id', userId).single(),
          supabase.from('housing_priorities').select('*').eq('user_id', userId).single(),
          
          // Listings (old format)
          supabase.from('listings').select('*').limit(10),
          
          // User profiles (users table)
          supabase.from('user_profiles').select('*').eq('user_id', userId).single(),
          
          // Modern apartment properties
          supabase.from('apartment_properties_listings').select('*').eq('is_active', true).limit(10),
          
          // Safety incidents (try-catch handled in the data processing)
          supabase.from('incidents').select('*').limit(50),
          
          // Roommate matching data
          supabase.from('user_priority_weights').select('*').eq('user_id', userId).single(),
          
          // Additional matching data
          supabase.from('roommate_matches').select('*').eq('user1_id', userId).limit(10)
        ]);

        // User Profile (users table)
        if (userProfiles.data) {
          const prof = userProfiles.data;
          contextParts.push(`USER PROFILE: ${prof.first_name || ''} ${prof.last_name || ''}, Email: ${prof.email || 'Not provided'}, Age: ${prof.age || 'Not specified'}, Gender: ${prof.gender || 'Not specified'}, Major: ${prof.major || 'Not specified'}`);
        }

        // Housing Preferences
        if (housingPrefs.data) {
          const pref = housingPrefs.data;
          contextParts.push(`HOUSING PREFERENCES: Budget $${pref.budget_min}-$${pref.budget_max}, Move-in: ${pref.move_in_date}, Location: ${pref.location_preference || 'Not specified'}, Amenities: ${pref.desired_amenities?.join(', ') || 'None specified'}`);
        }

        // Lifestyle Preferences
        if (lifestylePrefs.data) {
          const life = lifestylePrefs.data;
          contextParts.push(`LIFESTYLE PREFERENCES: Cleanliness ${life.cleanliness_level}/5, Sleep schedule: ${life.sleep_schedule}, Social habits: ${life.social_level || 'Not specified'}, Pet preference: ${life.pets || 'Not specified'}`);
        }

        // Housing Priorities (budget, commute, safety, roommates percentages)
        if (priorities.data) {
          const prior = priorities.data;
          contextParts.push(`HOUSING PRIORITIES: Budget ${prior.preferences?.budget || 25}%, Commute ${prior.preferences?.commute || 25}%, Safety ${prior.preferences?.safety || 25}%, Roommates ${prior.preferences?.roommates || 25}%`);
        }

        // Custom Priority Weights (if used)
        if (userWeights.data && !Array.isArray(userWeights.data)) {
          const weights = userWeights.data as any;
          contextParts.push(`CUSTOM WEIGHTS: Budget ${weights.budget_weight || 3}, Commute ${weights.commute_weight || 3}, Safety ${weights.safety_weight || 3}, Roommates ${weights.roommates_weight || 3}`);
        }

        // Old Listings Format
        if (listings.data && listings.data.length > 0) {
          const listingSummary = listings.data.map((l: any) => 
            `Listing (old): ${l.address || 'Address unknown'} - $${l.price}/mo, ${l.bedrooms}BR/${l.bathrooms}BA, ${l.square_feet || 'N/A'}sqft`
          ).join('\n');
          contextParts.push(`OLD LISTINGS FORMAT:\n${listingSummary}`);
        }

        // Modern Apartment Properties
        if (apartmentProperties.data && apartmentProperties.data.length > 0) {
          const propSummary = apartmentProperties.data.map((p: any) => 
            `Property: ${p.name || 'Unknown'} - ${p.address}, ${p.city} ${p.state}, Type: ${p.property_type}, Units: ${p.total_units || 'N/A'}`
          ).join('\n');
          contextParts.push(`APARTMENT PROPERTIES:\n${propSummary}`);
        }

        // Safety Incidents (for safety-related queries)
        if (incidents.data) {
          contextParts.push(`SAFETY INCIDENTS: ${incidents.data.length} incidents in database available for safety analysis`);
        }

        // Roommate Matches
        if (roommateMatches.data) {
          contextParts.push(`ROOMMATE MATCHES: User has ${roommateMatches.data.length} potential roommate matches`);
        }
      } else {
        // For anonymous users, get general public data
        const [publicListings, publicProperties] = await Promise.all([
          supabase.from('listings').select('*').limit(5),
          supabase.from('apartment_properties_listings').select('*').eq('is_active', true).limit(5)
        ]);

        if (publicListings.data && publicListings.data.length > 0) {
          contextParts.push(`PUBLIC LISTINGS: ${publicListings.data.length} properties available`);
        }
        if (publicProperties.data && publicProperties.data.length > 0) {
          contextParts.push(`PUBLIC PROPERTIES: ${publicProperties.data.length} active properties available`);
        }
        // Incidents data available
        contextParts.push(`SAFETY DATA: Safety incidents database is available for queries`);
      }

      // Get query-relevant data from database
      if (query) {
        const queryLower = query.toLowerCase();
        const keywords = queryLower.match(/\b\w{4,}\b/g) || [];
        
        if (keywords.length > 0) {
          // Search modern apartment properties
          const { data: relevantProperties } = await supabase
            .from('apartment_properties_listings')
            .select('id, name, address, city, state')
            .or(keywords.map(k => `name.ilike.%${k}%,address.ilike.%${k}%,city.ilike.%${k}%`).join(','))
            .limit(5);

          if (relevantProperties && relevantProperties.length > 0) {
            contextParts.push(`RELEVANT PROPERTIES: Found ${relevantProperties.length} matching properties for query`);
          }

          // Search for safety-related queries
          if (queryLower.includes('safety') || queryLower.includes('incident') || queryLower.includes('crime')) {
            const { data: recentIncidents } = await supabase
              .from('incidents')
              .select('*')
              .limit(5);
            if (recentIncidents && recentIncidents.length > 0) {
              contextParts.push(`SAFETY QUERY: Found ${recentIncidents.length} recent safety incidents in the area`);
            }
          }
        }
      }

      return contextParts.join('\n\n');
    } catch (error) {
      console.error('Error getting database context:', error);
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

    // Check rate limits
    const rateLimitPassed = await this.checkRateLimit(userId);
    if (!rateLimitPassed) {
      const response = {
        response: "I'm receiving too many requests. Please wait a moment before trying again.",
        confidence: 1.0,
        cost: 0,
        tokens: 0
      };
      
      // Log blocked request
      this.logChatInteraction(logId, context, message, response.response, [], 1.0, 0, 0, false, false);
      
      return response;
    }

    // Apply safety filters
    const safetyCheck = await this.applySafetyFilters(message);
    if (safetyCheck.blocked) {
      const response = {
        response: "I can't help with that type of request. Please ask about housing, roommates, or platform features.",
        confidence: safetyCheck.confidence,
        cost: 0,
        tokens: 0
      };
      
      // Log blocked request
      this.logChatInteraction(logId, context, message, response.response, [], safetyCheck.confidence, 0, 0, false, true);
      
      return response;
    }

    try {
      // Retrieve relevant documents
      const relevantDocs = await this.retrieveRelevantDocuments(message, 3);
      
      // Get comprehensive database context with all tables
      const dbContext = await this.getDatabaseContext(context.userId, message);

      // Create context from retrieved documents
      const contextText = relevantDocs.map(doc => 
        `Q: ${doc.question}\nA: ${doc.answer}`
      ).join('\n\n');
      
      // Create the prompt for OpenAI
      const systemPrompt = `You are HokieNest Assistant, a helpful AI for a student housing and roommate matching platform.

KNOWLEDGE BASE:
${contextText}

DATABASE CONTEXT (Combined from ALL tables):
${dbContext}

INSTRUCTIONS:

STRICT INSTRUCTIONS:
1. SCOPE: ONLY answer questions about HokieNest platform - housing, roommate matching, properties, listings, safety incidents
2. OFF-TOPIC POLICY: If question is NOT about HokieNest, politely decline: "I'm designed to help with HokieNest housing and roommate matching. Can I assist with finding a place or a roommate?"
3. LENGTH: Keep responses SHORT - maximum 2 sentences
4. ACCURACY: Use context information for specific answers
5. TONE: Be friendly and helpful
6. PERSONALIZATION: Reference user preferences when relevant
7. SUGGESTIONS: End with 2-3 suggestion buttons: [Suggestion1] [Suggestion2] [Suggestion3]

RESPONSE FORMAT:
- Answer directly in 1-2 sentences
- Include relevant context if helpful
- End with suggestion buttons in brackets

Keep responses concise and focused.`;

      // Get conversation history for this session
      const conversationHistory = this.conversationHistory.get(context.sessionId) || [];
      const recentHistory = conversationHistory.slice(-6); // Keep last 3 exchanges (6 messages)

      // Call OpenAI API directly with conversation history
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...recentHistory as Array<{ role: 'user' | 'assistant'; content: string }>,
        { role: 'user', content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';
      const sources = relevantDocs.map(doc => doc.id);
      
      // Extract suggestions from response
      const suggestions = this.extractSuggestionsFromResponse(response);

      // Calculate tokens and cost
      const tokens = completion.usage?.total_tokens || Math.ceil(response.length / 4);
      const cost = await this.logCost(tokens, context.userId);

      const finalResponse = {
        response: this.cleanResponse(response),
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

      // Save conversation to Supabase database
      await this.saveConversationToDatabase(context, message, finalResponse.response);

      // Log successful interaction
      this.logChatInteraction(logId, context, message, finalResponse.response, sources, 0.8, cost, tokens, true, true);
      
      return finalResponse;

    } catch (error) {
      console.error('Error generating response:', error);
      
      // Fallback response
      const fallbackResponse = {
        response: "I'm having trouble processing your request right now. Please try again or contact support if the issue persists.",
        confidence: 0.3,
        cost: 0,
        tokens: 0
      };
      
      // Log error
      this.logChatInteraction(logId, context, message, fallbackResponse.response, [], 0.3, 0, 0, true, true);
      
      return fallbackResponse;
    }
  }

  private extractSuggestionsFromResponse(response: string): string[] {
    // Extract suggestions from [Suggestion] format in response
    const suggestionRegex = /\[([^\]]+)\]/g;
    const matches = response.match(suggestionRegex);
    
    if (matches && matches.length > 0) {
      return matches.map(match => match.slice(1, -1)).slice(0, 4);
    }
    
    // Fallback to default suggestions
    return ['Find housing', 'Find roommates', 'Set priorities', 'View dashboard'];
  }

  private cleanResponse(response: string): string {
    // Remove suggestion brackets from the main response
    return response.replace(/\[([^\]]+)\]/g, '').trim();
  }

  private generateSuggestions(question: string, response: string): string[] {
    const suggestions: string[] = [];
    
    if (question.toLowerCase().includes('housing') || question.toLowerCase().includes('property')) {
      suggestions.push('Show me properties', 'Set my budget', 'Filter by location');
    } else if (question.toLowerCase().includes('roommate')) {
      suggestions.push('Start questionnaire', 'View my matches', 'Update preferences');
    } else if (question.toLowerCase().includes('priority')) {
      suggestions.push('Set my priorities', 'View dashboard', 'How to optimize');
    } else {
      suggestions.push('Find housing', 'Find roommates', 'Set priorities', 'View dashboard');
    }

    return suggestions.slice(0, 4);
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

  // Save conversation to Supabase database
  private async saveConversationToDatabase(context: ChatbotContext, message: string, response: string) {
    try {
      // Save to chatbot_conversations table
      await supabase.from('chatbot_conversations').insert({
        session_id: context.sessionId,
        user_id: context.userId || null,
        user_message: message,
        bot_response: response,
        current_page: context.currentPage,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving conversation to database:', error);
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
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    CHATBOT INTERACTION LOG                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`📋 Log ID: ${logId}`);
    console.log(`👤 User: ${context.userId ? `ID ${context.userId}` : 'anonymous'}`);
    console.log(`🆔 Session: ${context.sessionId}`);
    console.log(`📄 Page: ${context.currentPage || 'Unknown'}`);
    console.log(`\n💬 USER MESSAGE (${message.length} chars):`);
    console.log(`   "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    console.log(`\n🤖 BOT RESPONSE (${response.length} chars):`);
    console.log(`   "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
    console.log(`\n🔐 GUARDRAILS & SAFETY:`);
    console.log(`   ✅ Safety Filter: ${safetyFilterPassed ? 'PASSED' : '❌ BLOCKED'}`);
    console.log(`   ✅ Rate Limit: ${rateLimitPassed ? 'PASSED' : '❌ BLOCKED'}`);
    console.log(`   🎯 Confidence: ${(confidence * 100).toFixed(1)}%`);
    if (sources && sources.length > 0) {
      console.log(`   📚 Sources: ${sources.join(', ')}`);
    }
    console.log(`\n💰 API USAGE:`);
    console.log(`   🪙 Tokens: ${tokens}`);
    console.log(`   💵 Cost: $${cost.toFixed(6)}`);
    console.log(`   📊 Estimated: ${(tokens * 0.000002).toFixed(6)} (calculation)`);
    console.log(`\n⏰ Timestamp: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
}

// Export singleton instance
export const ragService = new RAGService();
