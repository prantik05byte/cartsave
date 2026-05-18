import React from 'react';
import { ChatMessage } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={`flex items-end gap-2 animate-fade-in ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      {/* Assistant avatar */}
      {isAssistant && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          S
        </div>
      )}

      <div
        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isAssistant
            ? 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
            : 'bg-brand-500 text-white rounded-br-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
};

export const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-2 justify-start animate-fade-in">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
      S
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center h-4">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  </div>
);
