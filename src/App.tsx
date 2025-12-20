import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { RefreshProvider } from "@/context/RefreshContext";
import { IncomingCallListener } from "@/components/calls/IncomingCallListener";
import { MobileInstallModal } from "@/components/pwa/MobileInstallModal";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Messages from "./pages/Messages";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import Call from "./pages/Call";
import CallHistory from "./pages/CallHistory";
import Live from "./pages/Live";
import AICopilot from "./pages/AICopilot";
import ThesisWriter from "./pages/ThesisWriter";
import VideoCreation from "./pages/VideoCreation";
import EducationalQA from "./pages/EducationalQA";
import ProjectWriting from "./pages/ProjectWriting";
import ImageGeneration from "./pages/ImageGeneration";
import ImageEnhancement from "./pages/ImageEnhancement";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Subscription from "./pages/Subscription";
import Credits from "./pages/Credits";
import SavedPosts from "./pages/SavedPosts";
import Promote from "./pages/Promote";
import PostDetail from "./pages/PostDetail";
import Moderation from "./pages/Moderation";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/AccountSettings";
import PrivacySettings from "./pages/PrivacySettings";
import NotificationSettings from "./pages/NotificationSettings";
import CacheSettingsPage from "./pages/CacheSettingsPage";
import BlockedUsers from "./pages/BlockedUsers";
import LanguageSettings from "./pages/LanguageSettings";
import HelpSupport from "./pages/HelpSupport";
import P2PMarketplace from "./pages/P2PMarketplace";
import P2PTransaction from "./pages/P2PTransaction";
import InitializeGroups from "./pages/InitializeGroups";
import Trending from "./pages/Trending";
import Wallet from "./pages/Wallet";
import LearnTech from "./pages/LearnTech";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import ProfileEdit from "./pages/ProfileEdit";
import Search from "./pages/Search";
import HashtagSearch from "./pages/HashtagSearch";
import StoryDetail from "./pages/StoryDetail";
import LiveStreamDetail from "./pages/LiveStreamDetail";
import AdminWallet from "./pages/AdminWallet";
import SessionManagement from "./pages/SessionManagement";
import CreatorPayouts from "./pages/CreatorPayouts";
import Promotions from "./pages/Promotions";
import Install from "./pages/Install";

const queryClient = new QueryClient();

const App = () => {
  // Set dark mode by default and initialize offline manager + auto-updater
  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Initialize offline manager
    import('@/lib/offline-manager').then(({ offlineManager: manager }) => {
      // Manager auto-initializes as singleton
      console.log('Offline manager ready');
    });

    // Initialize auto-updater for background updates
    import('@/lib/auto-updater').then(({ autoUpdater }) => {
      console.log('Auto-updater ready');
    });
    
    // Request notification permission on app load
    if ('Notification' in window && Notification.permission === 'default') {
      // Request after a slight delay to not overwhelm on first load
      setTimeout(() => {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }, 3000);
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RefreshProvider>
            <AuthProvider>
              <Toaster />
              <IncomingCallListener />
              <MobileInstallModal />
            <Routes>
            {/* Main */}
            <Route path="/" element={<Index />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            
            {/* Feed & Content */}
            <Route path="/feed" element={<Feed />} />
            <Route path="/feed/post/:postId" element={<PostDetail />} />
            <Route path="/feed/trending" element={<Trending />} />
            <Route path="/feed/search" element={<Search />} />
            <Route path="/feed/hashtag/:hashtag" element={<HashtagSearch />} />
            
            {/* Profile - supports both username and UUID */}
            <Route path="/profile/:identifier" element={<Profile />} />
            <Route path="/profile/:identifier/edit" element={<ProfileEdit />} />
            
            {/* Social */}
            <Route path="/messages" element={<Messages />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/call" element={<Call />} />
            <Route path="/call/history" element={<CallHistory />} />
            
            {/* Live & Stories */}
            <Route path="/live" element={<Live />} />
            <Route path="/live/stream/:streamId" element={<LiveStreamDetail />} />
            <Route path="/story/:storyId" element={<StoryDetail />} />
            
            {/* AI Features */}
            <Route path="/ai/copilot" element={<AICopilot />} />
            <Route path="/ai/thesis" element={<ThesisWriter />} />
            <Route path="/ai/video" element={<VideoCreation />} />
            <Route path="/ai/education" element={<EducationalQA />} />
            <Route path="/ai/project" element={<ProjectWriting />} />
            <Route path="/ai/image-gen" element={<ImageGeneration />} />
            <Route path="/ai/enhance" element={<ImageEnhancement />} />
            <Route path="/ai/learn" element={<LearnTech />} />
            
            {/* Groups */}
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:groupId" element={<GroupDetail />} />
            
            {/* Wallet & Credits */}
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/credits" element={<Credits />} />
            <Route path="/wallet/subscription" element={<Subscription />} />
            <Route path="/wallet/p2p" element={<P2PMarketplace />} />
            <Route path="/wallet/p2p/:transactionId" element={<P2PTransaction />} />
            <Route path="/wallet/admin" element={<AdminWallet />} />
            <Route path="/wallet/creator-payouts" element={<CreatorPayouts />} />
            
            {/* Posts & Content Management */}
            <Route path="/saved" element={<SavedPosts />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/promote/:postId" element={<Promote />} />
            <Route path="/moderation" element={<Moderation />} />
            
            {/* Settings */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/account" element={<AccountSettings />} />
            <Route path="/settings/privacy" element={<PrivacySettings />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/settings/cache" element={<CacheSettingsPage />} />
            <Route path="/settings/blocked" element={<BlockedUsers />} />
            <Route path="/settings/language" element={<LanguageSettings />} />
            <Route path="/settings/help" element={<HelpSupport />} />
            <Route path="/settings/sessions" element={<SessionManagement />} />
            
            {/* Legacy routes for backwards compatibility */}
            <Route path="/post/:postId" element={<PostDetail />} />
            <Route path="/profile-edit" element={<ProfileEdit />} />
            <Route path="/call-history" element={<CallHistory />} />
            <Route path="/ai-copilot" element={<AICopilot />} />
            <Route path="/thesis-writer" element={<ThesisWriter />} />
            <Route path="/video-creation" element={<VideoCreation />} />
            <Route path="/educational-qa" element={<EducationalQA />} />
            <Route path="/project-writing" element={<ProjectWriting />} />
            <Route path="/image-generation" element={<ImageGeneration />} />
            <Route path="/image-enhancement" element={<ImageEnhancement />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/p2p-marketplace" element={<P2PMarketplace />} />
            <Route path="/p2p-transaction/:transactionId" element={<P2PTransaction />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/search" element={<Search />} />
            <Route path="/hashtag/:hashtag" element={<HashtagSearch />} />
            <Route path="/stream/:streamId" element={<LiveStreamDetail />} />
            <Route path="/admin-wallet" element={<AdminWallet />} />
            <Route path="/learn-tech" element={<LearnTech />} />
            <Route path="/initialize-groups" element={<InitializeGroups />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
          </RefreshProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
