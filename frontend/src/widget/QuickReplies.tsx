import React from 'react';

interface QuickRepliesProps {
  options: string[];
  onSelect: (option: string) => void;
  disabled?: boolean;
}

export const QuickReplies: React.FC<QuickRepliesProps> = ({ options, onSelect, disabled }) => {
  return (
    <div className="flex flex-wrap gap-2 mt-2 animate-slide-up">
      {options.map((option) => (
        <button
          key={option}
          id={`quick-reply-${option.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          className={`
            px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-150
            ${disabled
              ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
              : 'border-brand-400 text-brand-600 bg-brand-50 hover:bg-brand-500 hover:text-white hover:border-brand-500 active:scale-95 cursor-pointer'
            }
          `}
        >
          {option}
        </button>
      ))}
    </div>
  );
};
