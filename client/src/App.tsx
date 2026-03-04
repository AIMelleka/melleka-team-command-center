import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ClientProvider } from "./contexts/ClientContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ProposalBuilder = lazy(() => import("./pages/ProposalBuilder"));
const ProposalView = lazy(() => import("./pages/ProposalView"));
const ProposalsDashboard = lazy(() => import("./pages/ProposalsDashboard"));
const ProposalQA = lazy(() => import("./pages/ProposalQA"));
const PortfolioManager = lazy(() => import("./pages/PortfolioManager"));
const SeoWriter = lazy(() => import("./pages/SeoWriter"));
const AdGenerator = lazy(() => import("./pages/AdGenerator"));
const QABot = lazy(() => import("./pages/QABot"));
const EmailWriter = lazy(() => import("./pages/EmailWriter"));
const VideoGenerator = lazy(() => import("./pages/VideoGenerator"));
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
const ImageGenerator = lazy(() => import("./pages/ImageGenerator"));
const PpcOptimizer = lazy(() => import("./pages/PpcOptimizer"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const StrategistSettings = lazy(() => import("./pages/StrategistSettings"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
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
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/proposal-builder"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ProposalBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/proposals"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ProposalsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/proposal-qa"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ProposalQA />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/portfolio-manager"
                  element={
                    <ProtectedRoute requireAdmin>
                      <PortfolioManager />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seo-writer"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SeoWriter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ad-generator"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ad-review"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdReview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/qa-bot"
                  element={
                    <ProtectedRoute requireAdmin>
                      <QABot />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email-writer"
                  element={
                    <ProtectedRoute requireAdmin>
                      <EmailWriter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/video-generator"
                  element={
                    <ProtectedRoute requireAdmin>
                      <VideoGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-update"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ClientUpdate />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-health"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ClientHealth />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/decks"
                  element={
                    <ProtectedRoute requireAdmin>
                      <DecksDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/deck-builder"
                  element={
                    <ProtectedRoute requireAdmin>
                      <DeckBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/seo-bot"
                  element={
                    <ProtectedRoute requireAdmin>
                      <SeoBot />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/image-generator"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ImageGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ppc-optimizer"
                  element={
                    <ProtectedRoute requireAdmin>
                      <PpcOptimizer />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client-dashboard"
                  element={
                    <ProtectedRoute requireAdmin>
                      <ClientDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/strategist-settings"
                  element={
                    <ProtectedRoute requireAdmin>
                      <StrategistSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user"
                  element={
                    <ProtectedRoute>
                      <UserDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/proposal/:slug" element={<ProposalView />} />
                <Route path="/deck/:slug/present" element={<DeckView />} />
                <Route path="/deck/:slug" element={<DeckView />} />
                <Route path="/deck/:slug/editor" element={<DeckEditor />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          </ClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
