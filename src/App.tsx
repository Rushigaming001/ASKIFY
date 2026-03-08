import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ProtectedAdminRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy-load all pages for faster initial load
const Auth = lazy(() => import("./pages/Auth"));
const Chat = lazy(() => import("./pages/Chat"));
const AIFeatures = lazy(() => import("./pages/AIFeatures"));
const Settings = lazy(() => import("./pages/Settings"));
const PublicChat = lazy(() => import("./pages/PublicChat"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Game = lazy(() => import("./pages/Game"));
const Skribbl = lazy(() => import("./pages/Skribbl"));
const AQI = lazy(() => import("./pages/AQI"));
const DataAnalyzerPage = lazy(() => import("./pages/DataAnalyzer"));
const YouTube = lazy(() => import("./pages/YouTube"));
const LanguageLearning = lazy(() => import("./pages/LanguageLearning"));
const Pricing = lazy(() => import("./pages/Pricing"));
const FriendsChat = lazy(() => import("./pages/FriendsChat"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Destination = lazy(() => import("./pages/Destination"));
const Chess = lazy(() => import("./pages/Chess"));
const Ludo = lazy(() => import("./pages/Ludo"));
const Games = lazy(() => import("./pages/Games"));
const Status = lazy(() => import("./pages/Status"));
const Install = lazy(() => import("./pages/Install"));
const Reels = lazy(() => import("./pages/Reels"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      gcTime: 1000 * 60 * 10,   // 10 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  const hostname = window.location.hostname;
  const isAQISubdomain = hostname.startsWith('aqi.') && !hostname.includes('lovableproject.com') && !hostname.includes('localhost');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            {isAQISubdomain ? (
              <>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="*" element={<AQI />} />
                </Routes>
              </>
            ) : (
              <AuthProvider>
                <ChatProvider>
                  <PushNotificationPrompt />
                  <Toaster />
                  <Sonner />
                  <Routes>
                    <Route path="/" element={<Destination />} />
                    <Route path="/chat" element={<Chat />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/ai-features" element={<AIFeatures />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/public-chat" element={<PublicChat />} />
                    <Route path="/friends-chat" element={<FriendsChat />} />
                    <Route path="/admin" element={<ProtectedAdminRoute><AdminPanel /></ProtectedAdminRoute>} />
                    <Route path="/game" element={<Game />} />
                    <Route path="/games" element={<Games />} />
                    <Route path="/chess" element={<Chess />} />
                    <Route path="/ludo" element={<Ludo />} />
                    <Route path="/skribbl" element={<Skribbl />} />
                    <Route path="/aqi" element={<AQI />} />
                    <Route path="/data-analyzer" element={<DataAnalyzerPage />} />
                    <Route path="/youtube" element={<YouTube />} />
                    <Route path="/learn" element={<LanguageLearning />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/status" element={<Status />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="/installation" element={<Install />} />
                    <Route path="/app" element={<Install />} />
                    <Route path="/reels" element={<Reels />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ChatProvider>
              </AuthProvider>
            )}
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
