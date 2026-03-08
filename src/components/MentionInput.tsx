import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  profiles: Profile[];
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  profiles,
  className
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<(Profile | { id: 'everyone'; name: 'everyone' })[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);

    // Find if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      // Check if there's a space between @ and cursor (if so, not a mention)
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      if (!textAfterAt.includes(' ')) {
        const searchTerm = textAfterAt.toLowerCase();
        setMentionStart(atIndex);
        
        // Filter profiles + add @everyone option
        const everyoneOption = { id: 'everyone' as const, name: 'everyone' };
        const matchingProfiles = [
          everyoneOption,
          ...profiles.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.name.toLowerCase().replace(/\s+/g, '').includes(searchTerm)
          )
        ].filter(p => 
          p.name.toLowerCase().includes(searchTerm) || searchTerm === ''
        );
        
        setSuggestions(matchingProfiles.slice(0, 8));
        setShowSuggestions(matchingProfiles.length > 0);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
    setMentionStart(-1);
  };

  const insertMention = (profile: Profile | { id: 'everyone'; name: 'everyone' }) => {
    if (mentionStart === -1) return;
    
    const beforeMention = value.slice(0, mentionStart);
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);
    
    const mentionText = profile.id === 'everyone' 
      ? '@everyone ' 
      : `@${profile.name.replace(/\s+/g, '')} `;
    
    const newValue = beforeMention + mentionText + afterMention;
    onChange(newValue);
    setShowSuggestions(false);
    setMentionStart(-1);
    
    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = beforeMention.length + mentionText.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        return;
      }
    }
    
    // Submit on Enter when no suggestions shown
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as any);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50"
        >
          <ScrollArea className="max-h-48">
            <div className="p-1">
              {suggestions.map((profile, index) => (
                <button
                  key={profile.id}
                  type="button"
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                    index === selectedIndex 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => insertMention(profile)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {profile.id === 'everyone' ? (
                    <>
                      <div className="h-6 w-6 rounded-full bg-warning/20 flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-warning" />
                      </div>
                      <span className="font-medium">@everyone</span>
                      <span className={`text-xs ml-auto ${index === selectedIndex ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        Notify all users
                      </span>
                    </>
                  ) : (
                    <>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(profile.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">@{profile.name}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
