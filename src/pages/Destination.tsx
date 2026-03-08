import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Sparkles, Globe, BookOpen, Video, BarChart3, Gamepad2, Settings, Users, Activity, Wind, Clapperboard, Brain } from 'lucide-react';
import askifyLogoNew from '@/assets/askify-logo-new.png';

const destinations = [
  { title: 'Offline AI', description: 'AI that works offline', icon: Brain, path: '/offline-ai', gradient: 'from-amber-500 to-orange-600' },
  { title: 'AI Chat', description: 'Chat with advanced AI models', icon: MessageSquare, path: '/chat', gradient: 'from-blue-500 to-blue-600' },
  { title: 'AI Studio', description: 'Images, tests & more', icon: Sparkles, path: '/ai-features', gradient: 'from-violet-500 to-purple-600' },
  { title: 'Public Chat', description: 'Chat with the community', icon: Globe, path: '/public-chat', gradient: 'from-cyan-500 to-blue-500' },
  { title: 'Friends', description: 'Chat with friends', icon: Users, path: '/friends-chat', gradient: 'from-sky-400 to-blue-500' },
  { title: 'Learn', description: 'AI language learning', icon: BookOpen, path: '/learn', gradient: 'from-teal-500 to-emerald-500' },
  { title: 'Analytics', description: 'Data analysis tools', icon: BarChart3, path: '/data-analyzer', gradient: 'from-blue-600 to-indigo-600' },
  { title: 'YouTube', description: 'Browse & watch', icon: Video, path: '/youtube', gradient: 'from-red-500 to-rose-600' },
  { title: 'Games', description: 'Skribbl, Chess & more', icon: Gamepad2, path: '/games', gradient: 'from-violet-500 to-fuchsia-500' },
  { title: 'AQI', description: 'Air quality index', icon: Wind, path: '/aqi', gradient: 'from-emerald-500 to-green-600' },
  { title: 'Reels', description: 'Watch & share reels', icon: Clapperboard, path: '/reels', gradient: 'from-pink-500 to-rose-600' },
  { title: 'Status', description: 'System uptime', icon: Activity, path: '/status', gradient: 'from-green-500 to-teal-500' },
];

const Destination = () => {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session?.user) {
      navigate('/auth', { replace: true });
    }
  }, [isLoading, session?.user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-8 sm:py-12 min-h-screen flex flex-col">
        {/* Header */}
        <header className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center justify-center mb-5">
            <div className="relative">
              <div className="absolute -inset-2 bg-primary/10 rounded-2xl blur-xl" />
              <div className="relative p-3 rounded-2xl bg-card border border-border/50 shadow-lg">
                <img src={askifyLogoNew} alt="Askify" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground mb-2">
            Welcome to <span className="text-primary">ASKIFY</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg font-medium">Choose where you'd like to go</p>
        </header>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 max-w-6xl mx-auto w-full flex-1">
          {destinations.map((dest) => (
            <Card
              key={dest.path}
              className="group cursor-pointer bg-card hover:bg-accent/50 border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5 rounded-xl overflow-hidden"
              onClick={() => navigate(dest.path)}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col items-start">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${dest.gradient} flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                  <dest.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground mb-0.5 group-hover:text-primary transition-colors">{dest.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{dest.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <footer className="flex justify-center mt-8 sm:mt-10">
          <Button onClick={() => navigate('/settings')} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2 rounded-xl">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default Destination;
