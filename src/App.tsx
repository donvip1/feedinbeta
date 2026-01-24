import React, { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { RefreshProvider } from "@/context/RefreshContext";
import { NavigationProvider } from "@/context/NavigationContext";
import { CallProvider } from "@/context/CallContext";
import { SpaceProvider } from "@/context/SpaceContext";
import { ThemeProvider } from "next-themes";
import { IncomingCallListener } from "@/components/calls/IncomingCallListener";
import { FloatingCallWidget } from "@/components/calls/FloatingCallWidget";
import { FloatingSpacePlayer } from "@/components/live/FloatingSpacePlayer";
import { LiveInviteNotification } from "@/components/live/LiveInviteNotification";
import { SpaceInviteNotification } from "@/components/live/SpaceInviteNotification";
import { RealtimeProvider } from "@/components/shared/RealtimeProvider";
import { ActiveCallIndicator } from "@/components/calls/ActiveCallIndicator";
import { MobileInstallModal } from "@/components/pwa/MobileInstallModal";
import { UpdatePromptModal } from "@/components/pwa/UpdatePromptModal";
import { BrowserInstallBanner } from "@/components/pwa/BrowserInstallBanner";
import { ProfileCompletionModal } from "@/components/auth/ProfileCompletionModal";
import { appDataSync } from "@/lib/app-data-sync";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { nativeAppManager } from "@/lib/native-app-manager";

// Core pages - static imports
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Messages from "./pages/Messages";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import Call from "./pages/Call";
import Live from "./pages/Live";
import Wallet from "./pages/Wallet";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Lazy load less frequently used pages to reduce initial bundle size
const CallHistory = lazy(() => import("./pages/CallHistory"));
const AICopilot = lazy(() => import("./pages/AICopilot"));
const AIHub = lazy(() => import("./pages/AIHub"));
const CaptionGenerator = lazy(() => import("./pages/CaptionGenerator"));
const ContentIdeas = lazy(() => import("./pages/ContentIdeas"));
const ThesisWriter = lazy(() => import("./pages/ThesisWriter"));
const VideoCreation = lazy(() => import("./pages/VideoCreation"));
const EducationalQA = lazy(() => import("./pages/EducationalQA"));
const ProjectWriting = lazy(() => import("./pages/ProjectWriting"));
const ImageGeneration = lazy(() => import("./pages/ImageGeneration"));
const ImageEnhancement = lazy(() => import("./pages/ImageEnhancement"));
const Groups = lazy(() => import("./pages/Groups"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const GroupChat = lazy(() => import("./pages/GroupChat"));
const GroupJoin = lazy(() => import("./pages/GroupJoin"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Credits = lazy(() => import("./pages/Credits"));
const SavedPosts = lazy(() => import("./pages/SavedPosts"));
const Promote = lazy(() => import("./pages/Promote"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Moderation = lazy(() => import("./pages/Moderation"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const CacheSettingsPage = lazy(() => import("./pages/CacheSettingsPage"));
const BlockedUsers = lazy(() => import("./pages/BlockedUsers"));
const LanguageSettings = lazy(() => import("./pages/LanguageSettings"));
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const P2PMarketplace = lazy(() => import("./pages/P2PMarketplace"));
const P2PTransaction = lazy(() => import("./pages/P2PTransaction"));
const Trending = lazy(() => import("./pages/Trending"));
const LearnTech = lazy(() => import("./pages/LearnTech"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const CoursePlayer = lazy(() => import("./pages/CoursePlayer"));
const MyLearning = lazy(() => import("./pages/MyLearning"));
const MyCertificates = lazy(() => import("./pages/MyCertificates"));
const CertificateVerify = lazy(() => import("./pages/CertificateVerify"));
const CareerPaths = lazy(() => import("./pages/CareerPaths"));
const CareerPathDetail = lazy(() => import("./pages/CareerPathDetail"));
const AptitudeTests = lazy(() => import("./pages/AptitudeTests"));
const AptitudeTestPlayer = lazy(() => import("./pages/AptitudeTestPlayer"));
const ResumeBuilder = lazy(() => import("./pages/ResumeBuilder"));
const BecomeInstructor = lazy(() => import("./pages/BecomeInstructor"));
const InstructorDashboard = lazy(() => import("./pages/InstructorDashboard"));
const CreateCourse = lazy(() => import("./pages/CreateCourse"));
const ManageCourses = lazy(() => import("./pages/ManageCourses"));
const VideoDiscovery = lazy(() => import("./pages/VideoDiscovery"));
const LearningPaths = lazy(() => import("./pages/LearningPaths"));
const LearningPathDetail = lazy(() => import("./pages/LearningPathDetail"));
const CourseDiscussion = lazy(() => import("./pages/CourseDiscussion"));
const CategoryCourses = lazy(() => import("./pages/CategoryCourses"));
const EditCourse = lazy(() => import("./pages/EditCourse"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Search = lazy(() => import("./pages/Search"));
const HashtagSearch = lazy(() => import("./pages/HashtagSearch"));
const StoryDetail = lazy(() => import("./pages/StoryDetail"));
const LiveStreamDetail = lazy(() => import("./pages/LiveStreamDetail"));
const AdminWallet = lazy(() => import("./pages/AdminWallet"));
const SessionManagement = lazy(() => import("./pages/SessionManagement"));
const CreatorPayouts = lazy(() => import("./pages/CreatorPayouts"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Install = lazy(() => import("./pages/Install"));
const MusicDiscovery = lazy(() => import("./pages/MusicDiscovery"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const Investors = lazy(() => import("./pages/Investors"));
const InvestmentDocs = lazy(() => import("./pages/InvestmentDocs"));
const CreatorDashboard = lazy(() => import("./pages/CreatorDashboard"));
const SpaceDetail = lazy(() => import("./pages/SpaceDetail"));
const CallInvite = lazy(() => import("./pages/CallInvite"));
const AdminDeletedPosts = lazy(() => import("./pages/AdminDeletedPosts"));
const CurrencySettings = lazy(() => import("./pages/CurrencySettings"));
const P2PPaymentMethods = lazy(() => import("./pages/P2PPaymentMethods"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Referral = lazy(() => import("./pages/Referral"));
const NotificationHistory = lazy(() => import("./pages/NotificationHistory"));
const AIToolsHub = lazy(() => import("./pages/AIToolsHub"));
const AIAgent = lazy(() => import("./pages/AIAgent"));

// Lazy load ALL AI tools - reduces memory during build
const BackgroundRemover = lazy(() => import("./pages/tools/BackgroundRemover"));
const ImageUpscaler = lazy(() => import("./pages/tools/ImageUpscaler"));
const EssayWriter = lazy(() => import("./pages/tools/EssayWriter"));
const QRCodeGenerator = lazy(() => import("./pages/tools/QRCodeGenerator"));
const PDFMerge = lazy(() => import("./pages/tools/PDFMerge"));
const PDFSplit = lazy(() => import("./pages/tools/PDFSplit"));
const PDFCompress = lazy(() => import("./pages/tools/PDFCompress"));
const GrammarFixer = lazy(() => import("./pages/tools/GrammarFixer"));
const Translator = lazy(() => import("./pages/tools/Translator"));
const Paraphraser = lazy(() => import("./pages/tools/Paraphraser"));
const ImageCompressor = lazy(() => import("./pages/tools/ImageCompressor"));
const ImageToText = lazy(() => import("./pages/tools/ImageToText"));
const VideoTrimmer = lazy(() => import("./pages/tools/VideoTrimmer"));
const PDFToWord = lazy(() => import("./pages/tools/PDFToWord"));
const WordToPDF = lazy(() => import("./pages/tools/WordToPDF"));
const Summarizer = lazy(() => import("./pages/tools/Summarizer"));
const ImageColorizer = lazy(() => import("./pages/tools/ImageColorizer"));
const VideoCompressor = lazy(() => import("./pages/tools/VideoCompressor"));
const AudioExtractor = lazy(() => import("./pages/tools/AudioExtractor"));
const ExamPrep = lazy(() => import("./pages/tools/ExamPrep"));
const ResearchAssistant = lazy(() => import("./pages/tools/ResearchAssistant"));
const MathSolver = lazy(() => import("./pages/tools/MathSolver"));
const TextToSpeech = lazy(() => import("./pages/tools/TextToSpeech"));
const SpeechToText = lazy(() => import("./pages/tools/SpeechToText"));
const MemeGenerator = lazy(() => import("./pages/tools/MemeGenerator"));
const LogoMaker = lazy(() => import("./pages/tools/LogoMaker"));
const HealthInfo = lazy(() => import("./pages/tools/HealthInfo"));
const SymptomChecker = lazy(() => import("./pages/tools/SymptomChecker"));
const NutritionCalculator = lazy(() => import("./pages/tools/NutritionCalculator"));
const ImagesToPDF = lazy(() => import("./pages/tools/ImagesToPDF"));
const HumanizeAI = lazy(() => import("./pages/tools/HumanizeAI"));

// Custom event for update available - defined locally to avoid mixed import
const UPDATE_AVAILABLE_EVENT = 'feedin-update-available';

// Create QueryClient with aggressive refetch settings for mobile
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Shorter stale time for fresher data
      staleTime: 5 * 1000, // 5 seconds
      // Refetch on window focus (critical for mobile app switching)
      refetchOnWindowFocus: true,
      // Refetch when reconnecting
      refetchOnReconnect: true,
      // Retry failed requests
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// Initialize app data sync with the query client
appDataSync.initialize(queryClient);

// Lazy fallback component for code splitting
const LazyFallback = () => <LoadingScreen />;

const App = () => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Initialize offline manager, auto-updater, and native app manager
  useEffect(() => {
    // Initialize native app manager for SDK-like experience (must be inside React lifecycle)
    nativeAppManager.initialize({ queryClient });

    // Initialize offline manager
    import('@/lib/offline-manager').then(({ offlineManager: manager }) => {
      console.log('Offline manager ready');
    });

    // Initialize auto-updater for background updates (dynamic import only)
    let autoUpdaterRef: any = null;
    import('@/lib/auto-updater').then(({ getAutoUpdater, autoUpdater }) => {
      autoUpdaterRef = autoUpdater;
      getAutoUpdater();
      console.log('Auto-updater ready');
    });

    // Listen for update available event
    const handleUpdateAvailable = () => {
      setShowUpdateModal(true);
    };
    window.addEventListener(UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    
    // Request notification permission on app load
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }, 3000);
    }

    return () => {
      window.removeEventListener(UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    setShowUpdateModal(false);
    // Dynamic import for update action
    import('@/lib/auto-updater').then(({ autoUpdater }) => {
      autoUpdater.applyUpdate();
    });
  };

  const handleUpdateLater = () => {
    setShowUpdateModal(false);
    import('@/lib/auto-updater').then(({ autoUpdater }) => {
      autoUpdater.dismissUpdate();
    });
  };

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="feedin-theme">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <NavigationProvider>
              <RefreshProvider>
                <AuthProvider>
                  <CurrencyProvider>
                  <CallProvider>
                    <SpaceProvider>
                      <RealtimeProvider>
                    <Toaster />
                  <IncomingCallListener />
                  <FloatingCallWidget />
                  <FloatingSpacePlayer />
                  <ActiveCallIndicator />
                  <LiveInviteNotification />
                  <SpaceInviteNotification />
                  <MobileInstallModal />
                  <BrowserInstallBanner />
                  <ProfileCompletionModal />
                  <UpdatePromptModal 
                    open={showUpdateModal} 
                    onUpdate={handleUpdate} 
                    onLater={handleUpdateLater} 
                  />
                <Suspense fallback={<LazyFallback />}>
                <Routes>
            {/* Main */}
            <Route path="/" element={<Index />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/install" element={<Install />} />
            <Route path="/referral/:username" element={<Referral />} />
            <Route path="/ref/:username" element={<Referral />} />
            
            {/* Feed & Content */}
            <Route path="/feed" element={<Feed />} />
            <Route path="/feed/post/:postId" element={<PostDetail />} />
            <Route path="/feed/trending" element={<Trending />} />
            <Route path="/feed/search" element={<Search />} />
            <Route path="/feed/hashtag/:hashtag" element={<HashtagSearch />} />
            
            {/* Profile - supports both username and UUID */}
            <Route path="/profile/:identifier" element={<Profile />} />
            
            
            {/* Social */}
            <Route path="/messages" element={<Messages />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/call" element={<Call />} />
            <Route path="/call/join/:inviteCode" element={<CallInvite />} />
            <Route path="/call/history" element={<CallHistory />} />
            
            {/* Live & Stories */}
            <Route path="/live" element={<Live />} />
            <Route path="/live/stream/:streamId" element={<LiveStreamDetail />} />
            <Route path="/live/space/:spaceId" element={<SpaceDetail />} />
            <Route path="/space/:spaceId" element={<SpaceDetail />} />
            <Route path="/story/:storyId" element={<StoryDetail />} />
            
            {/* AI Features */}
            <Route path="/ai" element={<AIHub />} />
            <Route path="/ai/tools" element={<AIToolsHub />} />
            <Route path="/ai/agent" element={<AIAgent />} />
            <Route path="/ai/copilot" element={<AICopilot />} />
            <Route path="/ai/thesis" element={<ThesisWriter />} />
            <Route path="/ai/video" element={<VideoCreation />} />
            <Route path="/ai/education" element={<EducationalQA />} />
            <Route path="/ai/project" element={<ProjectWriting />} />
            <Route path="/ai/image-gen" element={<ImageGeneration />} />
            <Route path="/ai/enhance" element={<ImageEnhancement />} />
            <Route path="/ai/learn" element={<LearnTech />} />
            <Route path="/ai/learn/my-learning" element={<MyLearning />} />
            <Route path="/ai/learn/course/:slug" element={<CourseDetail />} />
            <Route path="/ai/learn/course/:slug/learn" element={<CoursePlayer />} />
            <Route path="/ai/learn/course/:slug/discussions" element={<CourseDiscussion />} />
            <Route path="/ai/learn/certificates" element={<MyCertificates />} />
            <Route path="/ai/learn/careers" element={<CareerPaths />} />
            <Route path="/ai/learn/careers/:slug" element={<CareerPathDetail />} />
            <Route path="/ai/learn/aptitude" element={<AptitudeTests />} />
            <Route path="/ai/learn/aptitude/:slug" element={<AptitudeTestPlayer />} />
            <Route path="/ai/learn/resume" element={<ResumeBuilder />} />
            <Route path="/ai/learn/teach" element={<BecomeInstructor />} />
            <Route path="/ai/learn/instructor/dashboard" element={<InstructorDashboard />} />
            <Route path="/ai/learn/instructor/courses" element={<ManageCourses />} />
            <Route path="/ai/learn/instructor/create" element={<CreateCourse />} />
            <Route path="/ai/learn/videos" element={<VideoDiscovery />} />
            <Route path="/ai/learn/videos/:category" element={<VideoDiscovery />} />
            <Route path="/ai/learn/category/:slug" element={<CategoryCourses />} />
            <Route path="/ai/learn/instructor/course/:id/edit" element={<EditCourse />} />
            <Route path="/ai/learn/paths" element={<LearningPaths />} />
            <Route path="/ai/learn/paths/:slug" element={<LearningPathDetail />} />
            <Route path="/ai/captions" element={<CaptionGenerator />} />
            <Route path="/ai/ideas" element={<ContentIdeas />} />
            {/* AI Tools */}
            <Route path="/ai/tools/bg-remover" element={<BackgroundRemover />} />
            <Route path="/ai/tools/upscaler" element={<ImageUpscaler />} />
            <Route path="/ai/tools/essay-writer" element={<EssayWriter />} />
            <Route path="/ai/tools/qr-gen" element={<QRCodeGenerator />} />
            <Route path="/ai/tools/pdf-merge" element={<PDFMerge />} />
            <Route path="/ai/tools/pdf-split" element={<PDFSplit />} />
            <Route path="/ai/tools/pdf-compress" element={<PDFCompress />} />
            <Route path="/ai/tools/grammar" element={<GrammarFixer />} />
            <Route path="/ai/tools/translator" element={<Translator />} />
            <Route path="/ai/tools/paraphrase" element={<Paraphraser />} />
            <Route path="/ai/tools/img-compress" element={<ImageCompressor />} />
            <Route path="/ai/tools/image-to-text" element={<ImageToText />} />
            <Route path="/ai/tools/video-trim" element={<VideoTrimmer />} />
            <Route path="/ai/tools/pdf-to-word" element={<PDFToWord />} />
            <Route path="/ai/tools/word-to-pdf" element={<WordToPDF />} />
            <Route path="/ai/tools/summarizer" element={<Summarizer />} />
            <Route path="/ai/tools/colorizer" element={<ImageColorizer />} />
            <Route path="/ai/tools/video-compress" element={<VideoCompressor />} />
            <Route path="/ai/tools/audio-extract" element={<AudioExtractor />} />
            <Route path="/ai/tools/exam-prep" element={<ExamPrep />} />
            <Route path="/ai/tools/research" element={<ResearchAssistant />} />
            <Route path="/ai/tools/math-solver" element={<MathSolver />} />
            <Route path="/ai/tools/text-to-speech" element={<TextToSpeech />} />
            <Route path="/ai/tools/speech-to-text" element={<SpeechToText />} />
            <Route path="/ai/tools/meme-gen" element={<MemeGenerator />} />
            <Route path="/ai/tools/logo-maker" element={<LogoMaker />} />
            <Route path="/ai/tools/health-info" element={<HealthInfo />} />
            <Route path="/ai/tools/symptom-checker" element={<SymptomChecker />} />
            <Route path="/ai/tools/nutrition" element={<NutritionCalculator />} />
            <Route path="/ai/tools/jpg-to-pdf" element={<ImagesToPDF />} />
            <Route path="/ai/tools/humanize" element={<HumanizeAI />} />
            
            {/* Groups */}
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/:groupId" element={<GroupDetail />} />
            <Route path="/groups/:groupId/chat" element={<GroupChat />} />
            <Route path="/groups/join/:inviteCode" element={<GroupJoin />} />
            
            {/* Wallet & Credits */}
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/credits" element={<Credits />} />
            <Route path="/wallet/subscription" element={<Subscription />} />
            <Route path="/wallet/p2p" element={<P2PMarketplace />} />
            <Route path="/wallet/p2p/:transactionId" element={<P2PTransaction />} />
            <Route path="/p2p/payment-methods" element={<P2PPaymentMethods />} />
            <Route path="/wallet/admin" element={<AdminWallet />} />
            <Route path="/wallet/creator-payouts" element={<CreatorPayouts />} />
            
            {/* Posts & Content Management */}
            <Route path="/saved" element={<SavedPosts />} />
            <Route path="/music" element={<MusicDiscovery />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/promote/:postId" element={<Promote />} />
            <Route path="/moderation" element={<Moderation />} />
            
            {/* Notifications */}
            <Route path="/notifications/history" element={<NotificationHistory />} />
            
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
            <Route path="/settings/investors" element={<Investors />} />
            <Route path="/settings/investment-docs" element={<InvestmentDocs />} />
            <Route path="/settings/currency" element={<CurrencySettings />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/deleted-posts" element={<AdminDeletedPosts />} />
            <Route path="/admin/panel" element={<AdminPanel />} />
            <Route path="/creator/dashboard" element={<CreatorDashboard />} />
            
              <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
                      </RealtimeProvider>
                    </SpaceProvider>
                  </CallProvider>
                  </CurrencyProvider>
              </AuthProvider>
            </RefreshProvider>
          </NavigationProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
