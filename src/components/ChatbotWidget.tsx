import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react';
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
  
  // Drag and zoom state
  const [position, setPosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 560, height: 520 });
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  
  // Load saved position, size, and zoom from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('chatbot-position');
    const savedSize = localStorage.getItem('chatbot-size');
    const savedZoom = localStorage.getItem('chatbot-zoom');
    
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition);
        if (pos.x !== null && pos.y !== null) {
          setPosition(pos);
        }
      } catch (e) {
        // Invalid saved position, use default
      }
    }
    if (savedSize) {
      try {
        setSize(JSON.parse(savedSize));
      } catch (e) {
        // Invalid saved size, use default
      }
    }
    if (savedZoom) {
      const zoomValue = parseFloat(savedZoom);
      if (!isNaN(zoomValue) && zoomValue >= 0.7 && zoomValue <= 1.5) {
        setZoom(zoomValue);
      }
    }
  }, []);
  
  // Save position, size, and zoom to localStorage
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem('chatbot-position', JSON.stringify(position));
      localStorage.setItem('chatbot-size', JSON.stringify(size));
      localStorage.setItem('chatbot-zoom', zoom.toString());
    }
  }, [position, size, zoom, isOpen]);
  
  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (headerRef.current?.contains(e.target as Node)) {
      setIsDragging(true);
      const rect = chatWindowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && chatWindowRef.current) {
        const rect = chatWindowRef.current.getBoundingClientRect();
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Constrain to viewport
        const maxX = window.innerWidth - size.width * zoom;
        const maxY = window.innerHeight - size.height * zoom;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, size, zoom]);
  
  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 1.5)); // Max 150%
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.7)); // Min 70%
  };
  
  const handleResetZoom = () => {
    setZoom(1);
  };
  
  // Reset to default position, size, and zoom
  const handleReset = () => {
    setPosition({ x: null, y: null }); // Reset to default bottom-right position
    setSize({ width: 560, height: 520 }); // Default size
    setZoom(1); // Default zoom
    // Clear localStorage
    localStorage.removeItem('chatbot-position');
    localStorage.removeItem('chatbot-size');
    localStorage.removeItem('chatbot-zoom');
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const requestStartTime = performance.now();
    console.log(`\n🤖 [Chatbot Widget] Sending message: "${inputValue.substring(0, 50)}${inputValue.length > 50 ? '...' : ''}"`);
    console.log(`   - Session: ${sessionId}`);
    console.log(`   - Authenticated: ${isAuthenticated}`);
    console.log(`   - Page: ${window.location.pathname}`);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputValue;
    setInputValue('');
    setIsTyping(true);

    // Use RAG-powered chatbot API (authenticated or public endpoint)
    try {
      const response = isAuthenticated 
        ? await chatbotAPI.sendMessage(messageToSend, sessionId, window.location.pathname)
        : await chatbotAPI.sendPublicMessage(messageToSend, sessionId, window.location.pathname);
      
      const responseTime = performance.now() - requestStartTime;
      console.log(`✅ [Chatbot Widget] Response received:`);
      console.log(`   - Time: ${responseTime.toFixed(2)}ms`);
      console.log(`   - Response: "${response.data.response.substring(0, 50)}${response.data.response.length > 50 ? '...' : ''}"`);
      console.log(`   - Tokens: ${response.data.tokens}`);
      console.log(`   - Cost: $${response.data.cost.toFixed(6)}`);
      console.log(`   - Suggestions: ${response.data.suggestions?.length || 0}\n`);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.response,
        sender: 'bot',
        timestamp: new Date(),
        suggestions: response.data.suggestions
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error: any) {
      const responseTime = performance.now() - requestStartTime;
      console.error(`❌ [Chatbot Widget] API Error:`);
      console.error(`   - Time: ${responseTime.toFixed(2)}ms`);
      console.error(`   - Error: ${error.message || error.toString()}`);
      console.error(`   - Full error:`, error);
      
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
    <div className={`fixed bottom-4 right-4 z-[20000] ${className}`}>
      {/* Chat Panel */}
      {isOpen && (
        <Card
          ref={chatWindowRef}
          className={cn(
            "shadow-xl border bg-white/95 backdrop-blur-sm select-none z-[20000]",
            "border-blue-100/70 bg-gradient-to-br from-white to-blue-50/30",
            "dark:bg-surface/95 dark:border-border/60 dark:from-surface/95 dark:to-surface/95 dark:shadow-2xl",
            isDragging && "cursor-move"
          )}
          style={{
            width: `${size.width}px`,
            height: `${size.height}px`,
            ...(position.x !== null && position.y !== null
              ? {
                  position: 'fixed',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  bottom: 'auto',
                  right: 'auto',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }
              : {
                  position: 'fixed',
                  bottom: '1rem',
                  right: '1rem',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'bottom right',
                }),
            transition: isDragging ? 'none' : 'transform 0.1s ease-out, left 0.1s ease-out, top 0.1s ease-out'
          }}
        >
          <div className="flex flex-col h-full">
            {/* Header - Draggable */}
            <div
              ref={headerRef}
              onMouseDown={handleMouseDown}
              className={cn(
                "flex items-center justify-between p-4 border-b rounded-t-lg cursor-move",
                "border-blue-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white",
                "dark:border-border/60 dark:bg-surface-3 dark:text-foreground",
                "hover:bg-blue-700/90 transition-colors"
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <Move className="h-4 w-4 text-white/70" />
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  "bg-white/20",
                  "dark:bg-primary/20"
                )}>
                  <Bot className={cn("h-5 w-5", "text-white", "dark:text-primary-foreground")} />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-white dark:text-foreground">HokieNest Assistant</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-blue-100 dark:text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-white/10 rounded">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.7}
                    className={cn(
                      "h-6 w-6 p-0 text-white hover:bg-white/20",
                      "dark:text-foreground dark:hover:bg-surface-4/80"
                    )}
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-white/90 min-w-[2.5rem] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 1.5}
                    className={cn(
                      "h-6 w-6 p-0 text-white hover:bg-white/20",
                      "dark:text-foreground dark:hover:bg-surface-4/80"
                    )}
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {/* Reset Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className={cn(
                    "h-8 w-8 p-0 text-white hover:bg-white/20",
                    "dark:text-foreground dark:hover:bg-surface-4/80"
                  )}
                  title="Reset position and size"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "h-8 w-8 p-0 text-white hover:bg-white/20",
                    "dark:text-foreground dark:hover:bg-surface-4/80"
                  )}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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
                          "px-4 py-3 rounded-2xl text-sm shadow-sm max-w-[320px] transition-all",
                          message.sender === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md'
                            : 'bg-gradient-to-br from-white to-blue-50/50 border-2 border-blue-100/60 text-gray-800 dark:bg-gradient-to-br dark:from-surface-2 dark:to-surface-3 dark:border-primary/30 dark:text-foreground'
                        )}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                        <p className={cn(
                          "text-xs mt-2",
                          message.sender === 'user' ? 'opacity-80' : 'opacity-60'
                        )}>
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                    
                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className={cn(
                        "mt-2",
                        message.sender === 'user' ? 'mr-0 flex justify-end' : 'ml-11'
                      )}>
                        <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                          {message.suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                                "border shadow-sm hover:shadow active:scale-95 whitespace-nowrap",
                                "bg-gradient-to-br from-blue-50 to-blue-100/80",
                                "border-blue-300/60 text-blue-700",
                                "hover:from-blue-100 hover:to-blue-200 hover:border-blue-400",
                                "dark:from-surface-3 dark:to-surface-4 dark:border-primary/40",
                                "dark:text-primary dark:hover:from-surface-4 dark:hover:to-surface-5",
                                "dark:hover:border-primary/60"
                              )}
                            >
                              {suggestion}
                            </button>
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
