import React from "react";
import { Toaster } from "@/components/ui/toaster";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
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
import Moderation from "./pages/Moderation";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/AccountSettings";
import PrivacySettings from "./pages/PrivacySettings";
import NotificationSettings from "./pages/NotificationSettings";
import CacheSettingsPage from "./pages/CacheSettingsPage";
import BlockedUsers from "./pages/BlockedUsers";
import P2PMarketplace from "./pages/P2PMarketplace";
import InitializeGroups from "./pages/InitializeGroups";
import Trending from "./pages/Trending";
import Wallet from "./pages/Wallet";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/call" element={<Call />} />
            <Route path="/call-history" element={<CallHistory />} />
            <Route path="/live" element={<Live />} />
            <Route path="/ai-copilot" element={<AICopilot />} />
            <Route path="/thesis-writer" element={<ThesisWriter />} />
            <Route path="/video-creation" element={<VideoCreation />} />
            <Route path="/educational-qa" element={<EducationalQA />} />
            <Route path="/project-writing" element={<ProjectWriting />} />
            <Route path="/image-generation" element={<ImageGeneration />} />
            <Route path="/image-enhancement" element={<ImageEnhancement />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:groupId" element={<GroupDetail />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/saved" element={<SavedPosts />} />
            <Route path="/promote/:postId" element={<Promote />} />
            <Route path="/moderation" element={<Moderation />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/account" element={<AccountSettings />} />
            <Route path="/settings/privacy" element={<PrivacySettings />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/settings/cache" element={<CacheSettingsPage />} />
            <Route path="/settings/blocked" element={<BlockedUsers />} />
            <Route path="/p2p-marketplace" element={<P2PMarketplace />} />
            <Route path="/initialize-groups" element={<InitializeGroups />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/wallet" element={<Wallet />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
