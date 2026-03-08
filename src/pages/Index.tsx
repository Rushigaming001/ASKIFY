import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ChatInput } from '@/components/ChatInput';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<'normal' | 'deepthink' | 'search' | 'reasoning'>('normal');

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin">
          <Zap className="h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  const handleSendMessage = (message: string, images?: string[]) => {
    // Navigate to chat with initial message
    navigate('/chat', { state: { initialMessage: message, initialImages: images } });
  };

  const handleModeChange = (newMode: 'normal' | 'deepthink' | 'search' | 'reasoning') => {
    setMode(newMode);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-background to-primary/5 px-4">
      {/* Header with Balance */}
      <div className="mb-8 flex w-full max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            9991/10000
          </div>
        </div>
        <div className="flex items-center gap-1 text-lg font-bold">
          <Zap className="h-5 w-5 text-primary" />
          <span>Core</span>
        </div>
      </div>

      {/* Center Content */}
      <div className="mb-12 max-w-2xl text-center">
        <p className="mb-3 text-muted-foreground">What can I help you with today?</p>
        <h1 className="text-4xl font-bold">Ready when you are.</h1>
      </div>

      {/* Chat Input - Centered */}
      <div className="w-full max-w-2xl">
        <ChatInput
          onSendMessage={handleSendMessage}
          onModeChange={handleModeChange}
          mode={mode}
          centered={true}
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="mt-12 flex w-full max-w-2xl flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" className="text-xs">
          Summarize
        </Button>
        <Button variant="outline" size="sm" className="text-xs">
          Analyze
        </Button>
        <Button variant="outline" size="sm" className="text-xs">
          Create
        </Button>
        <Button variant="outline" size="sm" className="text-xs">
          Explain
        </Button>
      </div>
    </div>
  );
};

export default Index;
