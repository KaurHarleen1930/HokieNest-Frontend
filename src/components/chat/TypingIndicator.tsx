import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';

interface TypingIndicatorProps {
  users: string[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0]} is typing`;
    } else if (users.length === 2) {
      return `${users[0]} and ${users[1]} are typing`;
    } else {
      return `${users[0]} and ${users.length - 1} others are typing`;
    }
  };

  return (
    <div className={cn(
      "flex items-center space-x-2 p-3 bg-muted/50 rounded-lg",
      className
    )}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      
      <span className="text-sm text-muted-foreground">
        {getTypingText()}
        <span className="inline-block w-4">{dots}</span>
      </span>
    </div>
  );
}

interface TypingBubbleProps {
  className?: string;
}

export function TypingBubble({ className }: TypingBubbleProps) {
  return (
    <div className={cn(
      "flex items-center space-x-2 p-3 bg-muted rounded-2xl max-w-fit",
      className
    )}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
