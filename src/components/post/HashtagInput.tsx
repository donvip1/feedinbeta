import { useState, useCallback } from 'react';
import { Hash, X } from 'lucide-react';

interface HashtagInputProps {
  value: string;
  onChange: (value: string) => void;
  maxHashtags?: number;
  placeholder?: string;
  className?: string;
  showLabel?: boolean;
  showPreview?: boolean;
}

export const HashtagInput = ({
  value,
  onChange,
  maxHashtags = 5,
  placeholder = "Add hashtags...",
  className = "",
  showLabel = false,
  showPreview = true,
}: HashtagInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  // Parse hashtags from the input value
  const parseHashtags = useCallback((input: string): string[] => {
    return input
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#+/, '').trim().toLowerCase())
      .filter((tag) => tag.length > 0);
  }, []);

  const currentHashtags = parseHashtags(value);
  const isAtLimit = currentHashtags.length >= maxHashtags;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Check if the last character typed is a space
    const lastChar = newValue.slice(-1);
    const prevValue = value;
    
    // If user typed a space after some text (not after another space or at start)
    if (lastChar === ' ' && prevValue.length < newValue.length) {
      const trimmedNew = newValue.trimEnd();
      const words = trimmedNew.split(/[\s,]+/).filter(w => w.length > 0);
      
      // Check hashtag limit before adding space for new hashtag
      if (words.length >= maxHashtags) {
        // At limit - don't allow more hashtags
        onChange(trimmedNew);
        return;
      }
      
      // Add # after the space for the next word
      newValue = trimmedNew + ' #';
    }
    
    // If user is starting fresh or after clearing, auto-add #
    if (newValue.length === 1 && newValue !== '#' && newValue !== ' ') {
      newValue = '#' + newValue;
    }
    
    // Validate we're not exceeding max hashtags
    const newHashtags = parseHashtags(newValue);
    if (newHashtags.length > maxHashtags) {
      return; // Don't update if exceeding limit
    }
    
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If pressing space/comma and at limit, prevent
    if ((e.key === ' ' || e.key === ',') && isAtLimit) {
      e.preventDefault();
      return;
    }
    
    // If pressing Enter, prevent form submission and add space for new hashtag
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isAtLimit && value.trim().length > 0) {
        const trimmed = value.trimEnd();
        onChange(trimmed + ' #');
      }
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Auto-add # when focusing on empty input
    if (!value.trim()) {
      onChange('#');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Clean up trailing # or spaces
    const cleaned = value.replace(/[#\s]+$/, '').trim();
    if (cleaned !== value) {
      onChange(cleaned);
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    const tags = parseHashtags(value);
    const newTags = tags.filter(tag => tag !== tagToRemove);
    const newValue = newTags.map(t => `#${t}`).join(' ');
    onChange(newValue);
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Hashtags</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {currentHashtags.length}/{maxHashtags}
          </span>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        {!showLabel && <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground text-sm"
        />
        {!showLabel && currentHashtags.length > 0 && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {currentHashtags.length}/{maxHashtags}
          </span>
        )}
      </div>

      {showPreview && currentHashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {currentHashtags.map((tag, idx) => (
            <span 
              key={idx} 
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs group"
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeHashtag(tag)}
                className="w-3.5 h-3.5 rounded-full hover:bg-primary/20 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isAtLimit && isFocused && (
        <p className="text-xs text-amber-500 mt-1">
          Maximum {maxHashtags} hashtags reached
        </p>
      )}
    </div>
  );
};

export default HashtagInput;
