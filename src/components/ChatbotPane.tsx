import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Minimize2, Maximize2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'action';
  suggestions?: string[];
  actions?: { label: string; action: () => void }[];
}

interface ChatbotPaneProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const ChatbotPane: React.FC<ChatbotPaneProps> = ({ 
  isOpen, 
  onClose, 
  className = '' 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Welcome to HokieNest Assistant! 🏠\n\nI'm here to help you with:\n• Finding the perfect housing\n• Matching with compatible roommates\n• Setting your housing priorities\n• Navigating the platform\n\nWhat can I help you with today?",
      sender: 'bot',
      timestamp: new Date(),
      type: 'text',
      suggestions: [
        "Help me find housing",
        "Set up roommate matching",
        "How do priorities work?",
        "Show me the tutorial"
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate bot response with delay
    setTimeout(() => {
      const botResponse = generateBotResponse(inputValue);
      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1500);
  };

  const generateBotResponse = (userInput: string): Message => {
    const input = userInput.toLowerCase();
    
    // Housing search responses
    if (input.includes('housing') || input.includes('apartment') || input.includes('rent') || input.includes('property')) {
      return {
        id: Date.now().toString(),
        text: "Great! I can help you find housing. Here's what you can do:\n\n🏠 **Browse Properties**: Visit the Properties page to see all available housing\n🎯 **Set Priorities**: Configure your housing preferences in your Profile\n💰 **Budget Planning**: Set your budget range and get personalized recommendations\n📍 **Location**: Filter by distance from campus or specific areas\n\nWould you like me to guide you through setting up your housing priorities?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "Show me properties",
          "Set my budget",
          "Help with priorities",
          "Filter by location"
        ]
      };
    }
    
    // Roommate matching responses
    if (input.includes('roommate') || input.includes('matching') || input.includes('compatible')) {
      return {
        id: Date.now().toString(),
        text: "Roommate matching is one of our best features! 🤝\n\nHere's how it works:\n• Complete the Roommate Questionnaire in your Profile\n• Set your lifestyle preferences (cleanliness, sleep schedule, etc.)\n• Our algorithm finds compatible matches based on:\n  - Lifestyle compatibility\n  - Housing preferences\n  - Budget alignment\n  - Location preferences\n\nReady to find your perfect roommate?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "Start questionnaire",
          "View my matches",
          "Update preferences",
          "How does matching work?"
        ]
      };
    }
    
    // Priority system responses
    if (input.includes('priority') || input.includes('preference') || input.includes('weight')) {
      return {
        id: Date.now().toString(),
        text: "Housing priorities help us find the perfect match for you! 🎯\n\n**The 4 Key Priorities:**\n• **Budget** (25-40%): Your financial comfort zone\n• **Commute** (20-35%): Distance from campus/work\n• **Safety** (15-30%): Neighborhood security\n• **Roommates** (10-25%): Compatibility with potential roommates\n\n**How it works:**\n1. Set your priority percentages (must total 100%)\n2. We score properties based on your priorities\n3. Get personalized recommendations\n4. Find roommates with similar priorities\n\nWould you like to set up your priorities now?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "Set my priorities",
          "View priority dashboard",
          "How to optimize priorities",
          "See examples"
        ]
      };
    }
    
    // Budget and financial responses
    if (input.includes('budget') || input.includes('price') || input.includes('cost') || input.includes('afford')) {
      return {
        id: Date.now().toString(),
        text: "Budget planning is crucial for finding the right housing! 💰\n\n**Consider these costs:**\n• Monthly rent\n• Utilities (electricity, water, internet)\n• Parking fees\n• Security deposits\n• Moving costs\n\n**Budget Tips:**\n• Aim for 30% of income on housing\n• Factor in all living expenses\n• Consider roommate cost-sharing\n• Look for utilities-included options\n\nWhat's your monthly budget range?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "Under $800/month",
          "$800-1200/month",
          "$1200-1600/month",
          "Over $1600/month"
        ]
      };
    }
    
    // Safety and location responses
    if (input.includes('safety') || input.includes('security') || input.includes('crime') || input.includes('neighborhood')) {
      return {
        id: Date.now().toString(),
        text: "Safety is a top priority! 🛡️\n\n**Safety Features:**\n• Crime statistics and safety scores\n• Neighborhood safety ratings\n• Well-lit areas and security measures\n• Proximity to campus security\n• Safe transportation options\n\n**Safety Tips:**\n• Visit neighborhoods at different times\n• Check local crime statistics\n• Ask about building security\n• Consider proximity to campus\n\nWould you like to see safety data for specific areas?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "Show safety data",
          "Safe neighborhoods",
          "Campus proximity",
          "Transportation safety"
        ]
      };
    }
    
    // Help and tutorial responses
    if (input.includes('help') || input.includes('tutorial') || input.includes('how to') || input.includes('guide')) {
      return {
        id: Date.now().toString(),
        text: "I'm here to help you navigate HokieNest! 📚\n\n**Quick Start Guide:**\n\n1️⃣ **Complete Your Profile**\n   • Set housing preferences\n   • Fill out roommate questionnaire\n   • Configure housing priorities\n\n2️⃣ **Find Housing**\n   • Browse properties\n   • Use filters and search\n   • Set up alerts\n\n3️⃣ **Find Roommates**\n   • Complete matching questionnaire\n   • View compatibility scores\n   • Connect with matches\n\n4️⃣ **Manage Priorities**\n   • Adjust housing priorities\n   • View recommendations\n   • Track your preferences\n\nWhat would you like to start with?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "Complete my profile",
          "Browse properties",
          "Find roommates",
          "Set priorities"
        ]
      };
    }
    
    // Greeting responses
    if (input.includes('hello') || input.includes('hi') || input.includes('hey') || input.includes('start')) {
      return {
        id: Date.now().toString(),
        text: "Hello! Welcome to HokieNest! 🎉\n\nI'm your personal assistant for finding the perfect housing and roommates. Whether you're a first-time renter or looking for your next place, I'm here to help!\n\n**What I can help with:**\n• Finding housing that fits your budget and needs\n• Matching you with compatible roommates\n• Setting up your housing priorities\n• Navigating the platform\n• Answering questions about the process\n\nWhat brings you to HokieNest today?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'suggestion',
        suggestions: [
          "I'm looking for housing",
          "I need a roommate",
          "I'm new to this",
          "Show me around"
        ]
      };
    }
    
    // Default response
    return {
      id: Date.now().toString(),
      text: "I understand you're looking for help! 🤔\n\nI can assist you with:\n• **Housing Search**: Finding properties that match your needs\n• **Roommate Matching**: Connecting with compatible roommates\n• **Priority Setup**: Configuring your housing preferences\n• **Platform Navigation**: Using all the features effectively\n\nCould you tell me more specifically what you'd like help with?",
      sender: 'bot',
      timestamp: new Date(),
      type: 'suggestion',
      suggestions: [
        "Find housing",
        "Find roommates",
        "Set priorities",
        "General help"
      ]
    };
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        id: '1',
        text: "Conversation cleared! How can I help you today?",
        sender: 'bot',
        timestamp: new Date(),
        type: 'text'
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-end ${className}`}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <Card className={`relative w-full max-w-md h-[600px] mr-4 mb-4 shadow-2xl border-2 border-blue-200 bg-white ${
        isMinimized ? 'h-16' : ''
      }`}>
        {isMinimized ? (
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-800">HokieNest Assistant</span>
              <Badge variant="secondary" className="text-xs">Online</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(false)}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-800">HokieNest Assistant</span>
                <Badge variant="secondary" className="text-xs">Online</Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearConversation}
                  className="h-6 w-6 p-0"
                  title="Clear conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-6 w-6 p-0"
                  title="Minimize"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id}>
                    <div
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex items-start gap-2 max-w-[85%] ${
                          message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                          message.sender === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                        }`}>
                          {message.sender === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm ${
                            message.sender === 'user'
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-gray-100 text-gray-800 rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                          <p className="text-xs opacity-70 mt-2">
                            {message.timestamp.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-2 ml-9">
                        <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="text-xs h-7 px-3 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />

            {/* Input */}
            <div className="p-3">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1"
                  disabled={isTyping}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  size="sm"
                  className="px-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatbotPane;


