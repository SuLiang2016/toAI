'use client';

import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { Message } from '@/types/chat';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onCopyMessage: (message: Message) => void;
  onCopyCode: (code: string) => void;
  onRegenerate: () => void;
  onEditResend: (message: Message) => void;
}

export default function MessageList({
  messages,
  isLoading,
  onCopyMessage,
  onCopyCode,
  onRegenerate,
  onEditResend,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestAssistantId = [...messages].reverse().find(message => message.role === 'assistant')?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="mx-auto mb-4 h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg">Start a new conversation</p>
          <p className="mt-2 text-sm">Send a message to begin chatting with AI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
      {messages.map(message => (
        <MessageBubble
          key={message.id}
          message={message}
          canRegenerate={message.id === latestAssistantId && !isLoading}
          onCopyMessage={onCopyMessage}
          onCopyCode={onCopyCode}
          onRegenerate={onRegenerate}
          onEditResend={onEditResend}
        />
      ))}

      {isLoading && (
        <div className="flex animate-fade-in justify-start">
          <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
            <div className="flex space-x-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
