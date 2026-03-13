import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ClientProvider } from "./contexts/ClientContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBoundary, PageErrorFallback } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ProposalBuilder = lazy(() => import("./pages/ProposalBuilder"));
const ProposalView = lazy(() => import("./pages/ProposalView"));
const ProposalsDashboard = lazy(() => import("./pages/ProposalsDashboard"));
const PortfolioManager = lazy(() => import("./pages/PortfolioManager"));
const SeoWriter = lazy(() => import("./pages/SeoWriter"));
const CreativeStudio = lazy(() => import("./pages/CreativeStudio"));
const QABot = lazy(() => import("./pages/QABot"));
const EmailWriter = lazy(() => import("./pages/EmailWriter"));
const ClientUpdate = lazy(() => import("./pages/ClientUpdate"));
const ClientHealth = lazy(() => import("./pages/ClientHealth"));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder"));
const DecksDashboard = lazy(() => import("./pages/DecksDashboard"));
const DeckView = lazy(() => import("./pages/DeckView"));
const DeckEditor = lazy(() => import("./pages/DeckEditor"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdReview = lazy(() => import("./pages/AdReview"));
const SeoBot = lazy(() => import("./pages/SeoBot"));
const PpcOptimizer = lazy(() => import("./pages/PpcOptimizer"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const ClientSettings = lazy(() => import("./pages/ClientSettings"));
const SuperAgentSettings = lazy(() => import("./pages/SuperAgentSettings"));
const SuperAgentDashboard = lazy(() => import("./pages/SuperAgentDashboard"));
const MeetingQueen = lazy(() => import("./pages/MeetingQueen"));
const SocialMedia = lazy(() => import("./pages/SocialMedia"));
const CronJobs = lazy(() => import("./pages/CronJobs"));
const DailyReports = lazy(() => import("./pages/DailyReports"));
const WebsiteBuilder = lazy(() => import("./pages/WebsiteBuilder"));
const WebsitesDashboard = lazy(() => import("./pages/WebsitesDashboard"));
const SavedArticles = lazy(() => import("./pages/SavedArticles"));
const OnboardingBot = lazy(() => import("./pages/OnboardingBot"));
const VideoGenerator = lazy(() => import("./pages/VideoGenerator"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const SafePage = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ClientProvider>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<SafePage><Login /></SafePage>} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><Index /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><AdminDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/proposal-builder"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><ProposalBuilder /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/proposals"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><ProposalsDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/portfolio-manager"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><PortfolioManager /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seo-writer"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><SeoWriter /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/saved-articles"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><SavedArticles /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/creative-studio"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><CreativeStudio /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route path="/ad-generator" element={<Navigate to="/creative-studio?tab=ad" replace />} />
                <Route
                  path="/ad-review"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><AdReview /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/qa-bot"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><QABot /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email-writer"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><EmailWriter /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/video-generator"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><VideoGenerator /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-update"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><ClientUpdate /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-health"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><ClientHealth /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/decks"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><DecksDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/deck-builder"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><DeckBuilder /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seo-bot"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><SeoBot /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route path="/image-generator" element={<Navigate to="/creative-studio?tab=image" replace />} />
                <Route
                  path="/ppc-optimizer"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><PpcOptimizer /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-dashboard"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><ClientDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-agent-settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><SuperAgentSettings /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-agent-dashboard"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><SuperAgentDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meeting-queen"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><MeetingQueen /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/onboarding-bot"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><OnboardingBot /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/social-media"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><SocialMedia /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cron-jobs"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><CronJobs /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/daily-reports"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><DailyReports /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><ClientSettings /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user"
                  element={
                    <ProtectedRoute>
                      <SafePage><UserDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/websites"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><WebsitesDashboard /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/website-builder"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><WebsiteBuilder /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/website-builder/:slug"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SafePage><WebsiteBuilder /></SafePage>
                    </ProtectedRoute>
                  }
                />
                <Route path="/proposal/:slug" element={<SafePage><ProposalView /></SafePage>} />
                <Route path="/deck/:slug/present" element={<SafePage><DeckView /></SafePage>} />
                <Route path="/deck/:slug" element={<SafePage><DeckView /></SafePage>} />
                <Route path="/deck/:slug/editor" element={<SafePage><DeckEditor /></SafePage>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <MobileBottomNav />
          </ClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
