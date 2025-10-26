import React, { useState } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { chatbotAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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
        "Roommate matching", 
        "Set priorities",
        "Browse properties"
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
        <Card className="w-96 h-[500px] mb-4 shadow-xl border-0 bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-white">HokieNest Assistant</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-blue-100">Online</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0 hover:bg-white/20 text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-transparent to-blue-50/20">
              <div className="space-y-4">
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
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
                        message.sender === 'user' 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
                      }`}>
                        {message.sender === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm shadow-sm ${
                          message.sender === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-800'
                        }`}
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
                              className="text-xs h-7 px-3 border-blue-200 hover:bg-blue-50 hover:border-blue-300 bg-white/80 backdrop-blur-sm"
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
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                        <Bot className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl shadow-sm">
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
            <div className="p-4 border-t border-gray-100 bg-gradient-to-r from-white to-blue-50/30">
              <div className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about housing, roommates..."
                  className="flex-1 text-sm border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 bg-white/80 backdrop-blur-sm"
                  disabled={isTyping}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  size="default"
                  className="px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-sm"
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
        className="w-16 h-16 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
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
