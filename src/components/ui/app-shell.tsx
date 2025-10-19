import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {children}
    </div>
  );
}

interface HeaderProps {
  children: ReactNode;
  className?: string;
}

export function Header({ children, className }: HeaderProps) {
  return (
    <header 
      className={cn(
        "sticky top-0 z-50 w-full border-b border-surface-3 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80",
        className
      )}
    >
      <div className="container flex h-16 items-center justify-between px-4">
        {children}
      </div>
    </header>
  );
}

interface MainContentProps {
  children: ReactNode;
  className?: string;
}

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main className={cn("flex-1", className)}>
      {children}
    </main>
  );
}