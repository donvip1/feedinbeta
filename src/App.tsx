import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
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
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Subscription from "./pages/Subscription";
import Credits from "./pages/Credits";
import SavedPosts from "./pages/SavedPosts";
import Moderation from "./pages/Moderation";
import Settings from "./pages/Settings";
import AccountSettings from "./pages/AccountSettings";
import PrivacySettings from "./pages/PrivacySettings";
import NotificationSettings from "./pages/NotificationSettings";
import BlockedUsers from "./pages/BlockedUsers";
import P2PMarketplace from "./pages/P2PMarketplace";
import InitializeGroups from "./pages/InitializeGroups";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App: React.FC = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/saved" element={<SavedPosts />} />
          <Route path="/moderation" element={<Moderation />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/account" element={<AccountSettings />} />
          <Route path="/settings/privacy" element={<PrivacySettings />} />
          <Route path="/settings/notifications" element={<NotificationSettings />} />
          <Route path="/settings/blocked" element={<BlockedUsers />} />
          <Route path="/p2p-marketplace" element={<P2PMarketplace />} />
          <Route path="/initialize-groups" element={<InitializeGroups />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
