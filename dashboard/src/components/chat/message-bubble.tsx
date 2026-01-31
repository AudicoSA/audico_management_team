"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [formattedTime, setFormattedTime] = useState<string>("");

  // Format time only on client to avoid hydration mismatch
  useEffect(() => {
    setFormattedTime(
      message.timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [message.timestamp]);

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-accent" : "bg-background-elevated border border-border"
        )}
      >
        {isUser ? (
          <User size={16} className="text-background" />
        ) : (
          <Bot size={16} className="text-accent" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-accent text-background rounded-br-md"
            : "bg-background-card border border-border text-foreground rounded-bl-md"
        )}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content.split("\n").map((line, i) => (
            <span key={i}>
              {/* Parse bold text */}
              {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={j} className={isUser ? "" : "text-accent"}>
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return part;
              })}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
        {formattedTime && (
          <p
            className={cn(
              "text-xs mt-2 opacity-60",
              isUser ? "text-background" : "text-foreground-muted"
            )}
          >
            {formattedTime}
          </p>
        )}
      </div>
    </div>
  );
}
