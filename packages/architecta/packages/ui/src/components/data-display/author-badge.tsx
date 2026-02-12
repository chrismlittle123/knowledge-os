import * as React from "react";
import { cn } from "../../primitives";
import { Avatar, AvatarFallback } from "./avatar";

export interface AuthorInfo {
  id: string;
  name: string;
  email?: string;
}

export interface AuthorBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  author: AuthorInfo;
  timestamp?: string | Date;
  size?: "sm" | "md";
  showTimestamp?: boolean;
}

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const AuthorBadge = React.forwardRef<HTMLDivElement, AuthorBadgeProps>(
  (
    { author, timestamp, size = "sm", showTimestamp = true, className, ...props },
    ref
  ) => {
    const displayName = author.name || author.email || "Unknown User";
    const initials = getInitials(displayName);

    const sizeClasses = {
      sm: "h-6 w-6 text-xs",
      md: "h-8 w-8 text-sm",
    };

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-2", className)}
        {...props}
      >
        <Avatar className={sizeClasses[size]}>
          <AvatarFallback className={sizeClasses[size]}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{displayName}</span>
          {showTimestamp && timestamp && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{formatTimeAgo(timestamp)}</span>
            </>
          )}
        </div>
      </div>
    );
  }
);
AuthorBadge.displayName = "AuthorBadge";

export { AuthorBadge };
