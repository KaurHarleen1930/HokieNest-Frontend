// Chatbot service for handling intelligent responses and integrations
export interface ChatbotResponse {
  text: string;
  suggestions?: string[];
  actions?: ChatbotAction[];
  type: 'text' | 'suggestion' | 'action' | 'redirect';
}

export interface ChatbotAction {
  label: string;
  action: () => void;
  type: 'navigate' | 'api' | 'function';
}

export interface UserContext {
  isAuthenticated: boolean;
  hasCompletedProfile: boolean;
  hasHousingPreferences: boolean;
  hasRoommatePreferences: boolean;
  currentPage?: string;
}

export class ChatbotService {
  private userContext: UserContext;

  constructor(userContext: UserContext) {
    this.userContext = userContext;
  }

  async generateResponse(userInput: string): Promise<ChatbotResponse> {
    const input = userInput.toLowerCase().trim();
    
    // Analyze user intent
    const intent = this.analyzeIntent(input);
    
    // Generate contextual response
    return this.generateContextualResponse(intent, input);
  }

  private analyzeIntent(input: string): string {
    // Housing-related intents
    if (this.containsAny(input, ['housing', 'apartment', 'rent', 'property', 'home', 'place to live'])) {
      return 'housing_search';
    }
    
    if (this.containsAny(input, ['budget', 'price', 'cost', 'afford', 'expensive', 'cheap'])) {
      return 'budget_help';
    }
    
    if (this.containsAny(input, ['location', 'area', 'neighborhood', 'distance', 'commute', 'close to campus'])) {
      return 'location_help';
    }
    
    if (this.containsAny(input, ['safety', 'security', 'crime', 'safe', 'dangerous'])) {
      return 'safety_help';
    }
    
    // Roommate-related intents
    if (this.containsAny(input, ['roommate', 'roommate matching', 'compatible', 'find roommate', 'share'])) {
      return 'roommate_matching';
    }
    
    if (this.containsAny(input, ['questionnaire', 'form', 'preferences', 'lifestyle', 'compatibility'])) {
      return 'questionnaire_help';
    }
    
    // Priority-related intents
    if (this.containsAny(input, ['priority', 'preference', 'weight', 'importance', 'ranking'])) {
      return 'priority_help';
    }
    
    if (this.containsAny(input, ['dashboard', 'analytics', 'insights', 'recommendations'])) {
      return 'dashboard_help';
    }
    
    // Navigation intents
    if (this.containsAny(input, ['navigate', 'go to', 'show me', 'take me to', 'where is'])) {
      return 'navigation';
    }
    
    // Help intents
    if (this.containsAny(input, ['help', 'tutorial', 'guide', 'how to', 'what is', 'explain'])) {
      return 'help';
    }
    
    // Greeting intents
    if (this.containsAny(input, ['hello', 'hi', 'hey', 'start', 'begin', 'welcome'])) {
      return 'greeting';
    }
    
    return 'general';
  }

  private containsAny(input: string, keywords: string[]): boolean {
    return keywords.some(keyword => input.includes(keyword));
  }

  private generateContextualResponse(intent: string, input: string): ChatbotResponse {
    switch (intent) {
      case 'housing_search':
        return this.getHousingSearchResponse();
      
      case 'budget_help':
        return this.getBudgetHelpResponse();
      
      case 'location_help':
        return this.getLocationHelpResponse();
      
      case 'safety_help':
        return this.getSafetyHelpResponse();
      
      case 'roommate_matching':
        return this.getRoommateMatchingResponse();
      
      case 'questionnaire_help':
        return this.getQuestionnaireHelpResponse();
      
      case 'priority_help':
        return this.getPriorityHelpResponse();
      
      case 'dashboard_help':
        return this.getDashboardHelpResponse();
      
      case 'navigation':
        return this.getNavigationResponse(input);
      
      case 'help':
        return this.getHelpResponse();
      
      case 'greeting':
        return this.getGreetingResponse();
      
      default:
        return this.getGeneralResponse();
    }
  }

  private getHousingSearchResponse(): ChatbotResponse {
    const suggestions = [
      "Show me properties",
      "Set my budget",
      "Filter by location",
      "View safety data"
    ];

    return {
      text: "🏠 **Finding Your Perfect Home**\n\nI can help you discover housing options that match your needs! Here's what you can do:\n\n**Browse Properties:**\n• View all available housing\n• Filter by price, location, and amenities\n• See detailed property information\n• Check safety scores and neighborhood data\n\n**Personalized Search:**\n• Set your housing priorities for better matches\n• Get recommendations based on your preferences\n• Save favorite properties\n• Set up alerts for new listings\n\nWhat type of housing are you looking for?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getBudgetHelpResponse(): ChatbotResponse {
    const suggestions = [
      "Under $800/month",
      "$800-1200/month", 
      "$1200-1600/month",
      "Over $1600/month"
    ];

    return {
      text: "💰 **Budget Planning Made Easy**\n\nLet me help you find housing that fits your budget! Here's what to consider:\n\n**Monthly Costs:**\n• Rent (primary expense)\n• Utilities (electricity, water, internet)\n• Parking fees\n• Renter's insurance\n• Groceries and living expenses\n\n**Budget Guidelines:**\n• Aim for 30% of income on housing\n• Factor in all living costs, not just rent\n• Consider roommate cost-sharing\n• Look for utilities-included options\n\n**Smart Tips:**\n• Set a realistic budget range\n• Consider transportation costs\n• Plan for unexpected expenses\n• Use our budget calculator\n\nWhat's your monthly budget range?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getLocationHelpResponse(): ChatbotResponse {
    const suggestions = [
      "Near campus",
      "Downtown area",
      "Quiet neighborhood",
      "Public transport access"
    ];

    return {
      text: "📍 **Location, Location, Location!**\n\nFinding the right area is crucial for your housing search. Here's what to consider:\n\n**Distance Factors:**\n• Walking distance to campus\n• Public transportation access\n• Commute time to work/classes\n• Proximity to amenities\n\n**Neighborhood Features:**\n• Safety and security\n• Local restaurants and shops\n• Grocery stores and services\n• Parks and recreation\n\n**Transportation Options:**\n• Bus routes and schedules\n• Bike-friendly areas\n• Parking availability\n• Ride-sharing accessibility\n\nWhat's most important to you in a location?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getSafetyHelpResponse(): ChatbotResponse {
    const suggestions = [
      "Show safety data",
      "Safe neighborhoods",
      "Campus proximity",
      "Security features"
    ];

    return {
      text: "🛡️ **Your Safety is Our Priority**\n\nSafety is a top concern when choosing housing. Here's how we help:\n\n**Safety Features:**\n• Crime statistics and safety scores\n• Neighborhood safety ratings\n• Well-lit areas and security measures\n• Proximity to campus security\n• Safe transportation options\n\n**Safety Tips:**\n• Visit neighborhoods at different times\n• Check local crime statistics\n• Ask about building security\n• Consider proximity to campus\n• Look for well-lit areas\n\n**Our Safety Tools:**\n• Real-time crime data\n• Safety score ratings\n• Neighborhood comparisons\n• Security feature listings\n\nWould you like to see safety data for specific areas?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getRoommateMatchingResponse(): ChatbotResponse {
    const suggestions = [
      "Start questionnaire",
      "View my matches",
      "Update preferences",
      "How does matching work?"
    ];

    return {
      text: "🤝 **Find Your Perfect Roommate**\n\nOur roommate matching system helps you find compatible living partners! Here's how it works:\n\n**The Matching Process:**\n1. **Complete Questionnaire:** Share your lifestyle preferences\n2. **Set Priorities:** Define what matters most to you\n3. **Algorithm Matching:** We find compatible roommates\n4. **Review Matches:** See compatibility scores and profiles\n5. **Connect:** Start conversations with potential roommates\n\n**What We Match On:**\n• Lifestyle compatibility (cleanliness, sleep schedule)\n• Housing preferences (budget, location)\n• Social preferences (guests, parties)\n• Work/study habits\n• Pet preferences\n\n**Compatibility Scoring:**\n• 90-100%: Excellent match\n• 80-89%: Very good match\n• 70-79%: Good match\n• 60-69%: Fair match\n\nReady to find your ideal roommate?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getQuestionnaireHelpResponse(): ChatbotResponse {
    const suggestions = [
      "Start questionnaire",
      "View my answers",
      "Update preferences",
      "Skip for now"
    ];

    return {
      text: "📝 **Roommate Questionnaire Guide**\n\nThe questionnaire helps us find your perfect roommate match! Here's what to expect:\n\n**Question Categories:**\n• **Lifestyle:** Cleanliness, sleep schedule, social habits\n• **Housing:** Budget, location preferences, amenities\n• **Work/Study:** Schedule, work-from-home needs\n• **Social:** Guest preferences, party habits\n• **Pets:** Pet ownership and comfort levels\n\n**Tips for Best Results:**\n• Be honest about your preferences\n• Consider your ideal living situation\n• Think about deal-breakers\n• Consider compromise areas\n\n**Why It Matters:**\n• Better compatibility matches\n• Reduced roommate conflicts\n• More successful living arrangements\n• Higher satisfaction rates\n\nReady to start the questionnaire?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getPriorityHelpResponse(): ChatbotResponse {
    const suggestions = [
      "Set my priorities",
      "View priority dashboard",
      "How to optimize",
      "See examples"
    ];

    return {
      text: "🎯 **Housing Priorities Explained**\n\nPriorities help us find housing that truly matches your needs! Here's how it works:\n\n**The 4 Key Priorities:**\n• **Budget (25-40%):** Your financial comfort zone\n• **Commute (20-35%):** Distance from campus/work\n• **Safety (15-30%):** Neighborhood security\n• **Roommates (10-25%):** Compatibility with potential roommates\n\n**How Priority Scoring Works:**\n1. Set your priority percentages (must total 100%)\n2. We score properties based on your priorities\n3. Get personalized recommendations\n4. Find roommates with similar priorities\n\n**Priority Examples:**\n• **Budget-Focused:** 40% budget, 25% commute, 20% safety, 15% roommates\n• **Location-Focused:** 25% budget, 35% commute, 25% safety, 15% roommates\n• **Safety-Focused:** 30% budget, 20% commute, 35% safety, 15% roommates\n\n**Benefits:**\n• More relevant property recommendations\n• Better roommate compatibility\n• Saves time in your search\n• Higher satisfaction with choices\n\nReady to set your priorities?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getDashboardHelpResponse(): ChatbotResponse {
    const suggestions = [
      "View my dashboard",
      "Update priorities",
      "See recommendations",
      "Analytics insights"
    ];

    return {
      text: "📊 **Your Priority Dashboard**\n\nThe dashboard is your command center for managing housing preferences! Here's what you'll find:\n\n**Dashboard Features:**\n• **Current Priorities:** View and adjust your settings\n• **Recommendations:** Personalized property suggestions\n• **Analytics:** Insights into your preferences\n• **Optimization Tips:** Ways to improve your matches\n\n**What You Can Do:**\n• Adjust priority weights in real-time\n• See how changes affect recommendations\n• View detailed score breakdowns\n• Track your preference evolution\n• Get optimization suggestions\n\n**Analytics Insights:**\n• Priority distribution charts\n• Recommendation quality scores\n• Match success rates\n• Preference trends over time\n\n**Quick Actions:**\n• Save favorite properties\n• Share preferences with roommates\n• Export your settings\n• Reset to defaults\n\nReady to explore your dashboard?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getNavigationResponse(input: string): ChatbotResponse {
    const suggestions = [
      "Go to Properties",
      "Open Profile",
      "View Dashboard",
      "Roommate Matching"
    ];

    return {
      text: "🧭 **Navigation Help**\n\nI can help you get to where you need to go! Here are the main sections:\n\n**Key Pages:**\n• **Properties:** Browse and search housing\n• **Profile:** Manage your preferences and settings\n• **Dashboard:** View your priority dashboard\n• **Roommate Matching:** Find compatible roommates\n• **Dashboard:** Your personalized overview\n\n**Quick Navigation:**\n• Use the top navigation menu\n• Check the sidebar for quick access\n• Use keyboard shortcuts (Ctrl+K for search)\n• Bookmark your favorite pages\n\nWhere would you like to go?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getHelpResponse(): ChatbotResponse {
    const suggestions = [
      "Complete my profile",
      "Browse properties",
      "Find roommates",
      "Set priorities"
    ];

    return {
      text: "📚 **HokieNest Help Center**\n\nI'm here to guide you through everything! Here's your quick start guide:\n\n**Getting Started:**\n1️⃣ **Complete Your Profile**\n   • Set housing preferences\n   • Fill out roommate questionnaire\n   • Configure housing priorities\n\n2️⃣ **Find Housing**\n   • Browse properties\n   • Use filters and search\n   • Set up alerts\n\n3️⃣ **Find Roommates**\n   • Complete matching questionnaire\n   • View compatibility scores\n   • Connect with matches\n\n4️⃣ **Manage Priorities**\n   • Adjust housing priorities\n   • View recommendations\n   • Track your preferences\n\n**Need Specific Help?**\n• Ask me about any feature\n• Use the suggestions below\n• Check the help documentation\n• Contact support if needed\n\nWhat would you like to start with?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getGreetingResponse(): ChatbotResponse {
    const suggestions = [
      "I'm looking for housing",
      "I need a roommate",
      "I'm new to this",
      "Show me around"
    ];

    return {
      text: "👋 **Welcome to HokieNest!**\n\nI'm your personal assistant for finding the perfect housing and roommates! Whether you're a first-time renter or looking for your next place, I'm here to help.\n\n**What I Can Help With:**\n• 🏠 Finding housing that fits your budget and needs\n• 🤝 Matching you with compatible roommates\n• 🎯 Setting up your housing priorities\n• 🧭 Navigating the platform\n• ❓ Answering questions about the process\n\n**Quick Start Options:**\n• Browse available properties\n• Complete your roommate questionnaire\n• Set up your housing priorities\n• Explore the platform features\n\nWhat brings you to HokieNest today?",
      suggestions,
      type: 'suggestion'
    };
  }

  private getGeneralResponse(): ChatbotResponse {
    const suggestions = [
      "Find housing",
      "Find roommates",
      "Set priorities",
      "General help"
    ];

    return {
      text: "🤔 **I'm Here to Help!**\n\nI understand you're looking for assistance! I can help you with:\n\n**Housing Search:**\n• Finding properties that match your needs\n• Budget planning and cost analysis\n• Location and safety information\n• Property comparisons and reviews\n\n**Roommate Matching:**\n• Connecting with compatible roommates\n• Lifestyle compatibility assessment\n• Questionnaire guidance\n• Match quality explanations\n\n**Priority Management:**\n• Setting up your housing priorities\n• Understanding the scoring system\n• Optimizing your preferences\n• Dashboard navigation\n\n**Platform Navigation:**\n• Using all the features effectively\n• Finding specific information\n• Troubleshooting issues\n• Getting the most out of HokieNest\n\nCould you tell me more specifically what you'd like help with?",
      suggestions,
      type: 'suggestion'
    };
  }
}

// Export a default instance
export const createChatbotService = (userContext: UserContext) => new ChatbotService(userContext);


