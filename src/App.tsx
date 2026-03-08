import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import AIFeatures from "./pages/AIFeatures";
import Settings from "./pages/Settings";
import PublicChat from "./pages/PublicChat";
import AdminPanel from "./pages/AdminPanel";
import Game from "./pages/Game";
import Skribbl from "./pages/Skribbl";
import AQI from "./pages/AQI";
import DataAnalyzerPage from "./pages/DataAnalyzer";
import YouTube from "./pages/YouTube";
import LanguageLearning from "./pages/LanguageLearning";
import Pricing from "./pages/Pricing";
import FriendsChat from "./pages/FriendsChat";
import NotFound from "./pages/NotFound";
import Destination from "./pages/Destination";
import Chess from "./pages/Chess";
import Ludo from "./pages/Ludo";
import Games from "./pages/Games";
import Status from "./pages/Status";
import Install from "./pages/Install";
import Reels from "./pages/Reels";

const queryClient = new QueryClient(); // v2

const App = () => {
  // Only treat as AQI subdomain if hostname is exactly aqi.* pattern (not preview URLs)
  const hostname = window.location.hostname;
  const isAQISubdomain = hostname.startsWith('aqi.') && !hostname.includes('lovableproject.com') && !hostname.includes('localhost');
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          {isAQISubdomain ? (
            // AQI subdomain doesn't require authentication
            <>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="*" element={<AQI />} />
              </Routes>
            </>
          ) : (
            // Main app with authentication
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
                  <Route path="/admin" element={<AdminPanel />} />
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
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
