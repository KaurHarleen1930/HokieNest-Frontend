import React, { useState } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { chatbotAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  suggestions?: string[];
}

interface ChatbotWidgetProps {
  className?: string;
}

export const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ className = '' }) => {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your HokieNest assistant. I can help with housing and roommate questions. What do you need?",
      sender: 'bot',
      timestamp: new Date(),
      suggestions: [
        "Find housing",
        "Browse properties",
        "Roommate matching",
        "Set priorities",
        "View safety insights",
        "Compare commute times",
        "Explore nearby attractions",
        "Show property reviews"
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Use RAG-powered chatbot API (authenticated or public endpoint)
    try {
      const response = isAuthenticated 
        ? await chatbotAPI.sendMessage(inputValue, sessionId, window.location.pathname)
        : await chatbotAPI.sendPublicMessage(inputValue, sessionId, window.location.pathname);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.response,
        sender: 'bot',
        timestamp: new Date(),
        suggestions: response.data.suggestions
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot API error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error. Please try again.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
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

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Chat Panel */}
      {isOpen && (
        <Card
          className={cn(
            "w-[560px] h-[520px] mb-4 shadow-xl border bg-white/95 backdrop-blur-sm",
            "border-blue-100/70 bg-gradient-to-br from-white to-blue-50/30",
            "dark:bg-surface/95 dark:border-border/60 dark:from-surface/95 dark:to-surface/95 dark:shadow-2xl"
          )}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between p-4 border-b rounded-t-lg",
                "border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white",
                "dark:border-border/60 dark:bg-surface-3 dark:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  "bg-white/20",
                  "dark:bg-primary/20"
                )}>
                  <Bot className={cn("h-5 w-5", "text-white", "dark:text-primary-foreground")} />
                </div>
                <div>
                  <span className="font-semibold text-white dark:text-foreground">HokieNest Assistant</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-blue-100 dark:text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "h-8 w-8 p-0 text-white hover:bg-white/20",
                  "dark:text-foreground dark:hover:bg-surface-4/80"
                )}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-transparent to-blue-50/20 dark:bg-surface/90">
              <div className="space-y-4 pr-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start gap-3 max-w-[85%] ${
                        message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm",
                          message.sender === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 dark:from-surface-3 dark:to-surface-4 dark:text-foreground'
                        )}
                      >
                        {message.sender === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={cn(
                          "px-4 py-3 rounded-2xl text-sm shadow-sm max-w-[420px]",
                          message.sender === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-800 dark:bg-surface-2 dark:border-border/60 dark:text-foreground'
                        )}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                        <p className="text-xs opacity-60 mt-2">
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 ml-11">
                        <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              onClick={() => handleSuggestionClick(suggestion)}
                              className={cn(
                                "text-xs h-7 px-3 border-blue-200 hover:bg-blue-50 hover:border-blue-300 bg-white/80 backdrop-blur-sm",
                                "dark:border-border/60 dark:bg-surface-2/90 dark:text-foreground dark:hover:bg-surface-3"
                              )}
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
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm dark:from-surface-3 dark:to-surface-4">
                        <Bot className="h-4 w-4 text-gray-600 dark:text-foreground" />
                      </div>
                      <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl shadow-sm dark:bg-surface-2 dark:border-border/60 dark:text-foreground">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-gray-100 bg-gradient-to-r from-white to-blue-50/30 dark:bg-surface/90 dark:border-border/60">
              <div className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about housing, roommates..."
                  className={cn(
                    "flex-1 text-sm border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 bg-white/80 backdrop-blur-sm",
                    "dark:border-border/60 dark:bg-surface-2 dark:focus:border-primary dark:focus:ring-primary/20 dark:text-foreground"
                  )}
                  disabled={isTyping}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  size="default"
                  className="px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm dark:bg-primary dark:hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white dark:bg-primary dark:hover:bg-primary/90"
        size="lg"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
};

export default ChatbotWidget;
