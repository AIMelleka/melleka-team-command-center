import React, { lazy, Suspense, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ClientProvider } from "./contexts/ClientContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { Loader2 } from "lucide-react";

// Eagerly loaded — main pages users hit most
import Index from "./pages/Index";
import Login from "./pages/Login";

// Lazy-loaded pages
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
// ClientHealth (Command Center) removed — focusing on Daily Reports
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
const CommercialMaker = lazy(() => import("./pages/CommercialMaker"));

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
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// --- Keep-alive route config ---
// These pages stay mounted (hidden) when you navigate away, so state is preserved
// and there's no loading spinner when you come back.
const KEEP_ALIVE_ROUTES: { path: string; element: React.ReactNode; requireAdmin?: boolean }[] = [
  { path: "/", element: <Index />, requireAdmin: true },
  { path: "/admin", element: <AdminDashboard />, requireAdmin: true },
  { path: "/seo-writer", element: <SeoWriter />, requireAdmin: true },
  { path: "/creative-studio", element: <CreativeStudio />, requireAdmin: true },
  { path: "/qa-bot", element: <QABot />, requireAdmin: true },
  { path: "/email-writer", element: <EmailWriter />, requireAdmin: true },
  { path: "/video-generator", element: <VideoGenerator />, requireAdmin: true },
  { path: "/client-update", element: <ClientUpdate />, requireAdmin: true },
  // Command Center removed — focusing on Daily Reports only
  { path: "/ad-review", element: <AdReview />, requireAdmin: true },
  { path: "/seo-bot", element: <SeoBot />, requireAdmin: true },
  { path: "/ppc-optimizer", element: <PpcOptimizer />, requireAdmin: true },
  { path: "/proposals", element: <ProposalsDashboard />, requireAdmin: true },
  { path: "/proposal-builder", element: <ProposalBuilder />, requireAdmin: true },
  { path: "/portfolio-manager", element: <PortfolioManager />, requireAdmin: true },
  { path: "/decks", element: <DecksDashboard />, requireAdmin: true },
  { path: "/deck-builder", element: <DeckBuilder />, requireAdmin: true },
  { path: "/client-dashboard", element: <ClientDashboard />, requireAdmin: true },
  { path: "/client-settings", element: <ClientSettings />, requireAdmin: true },
  { path: "/super-agent-settings", element: <SuperAgentSettings />, requireAdmin: true },
  { path: "/super-agent-dashboard", element: <SuperAgentDashboard />, requireAdmin: true },
  { path: "/meeting-queen", element: <MeetingQueen />, requireAdmin: true },
  { path: "/onboarding-bot", element: <OnboardingBot />, requireAdmin: true },
  { path: "/social-media", element: <SocialMedia />, requireAdmin: true },
  { path: "/cron-jobs", element: <CronJobs />, requireAdmin: true },
  { path: "/daily-reports", element: <DailyReports />, requireAdmin: true },
  { path: "/websites", element: <WebsitesDashboard />, requireAdmin: true },
  { path: "/website-builder", element: <WebsiteBuilder />, requireAdmin: true },
  { path: "/saved-articles", element: <SavedArticles />, requireAdmin: true },
  { path: "/commercial-maker", element: <CommercialMaker />, requireAdmin: true },
  { path: "/user", element: <UserDashboard />, requireAdmin: false },
  { path: "/login", element: <Login />, requireAdmin: false },
];

// Max pages kept alive at once (LRU eviction for the rest)
const MAX_ALIVE = 10;

// Redirects
const REDIRECTS: Record<string, string> = {
  "/ad-generator": "/creative-studio?tab=ad",
  "/image-generator": "/creative-studio?tab=image",
};

function KeepAliveRouter() {
  const location = useLocation();
  const pathname = location.pathname;

  // Check redirect
  const redirectTo = REDIRECTS[pathname];

  // Check if current path matches a keep-alive route
  const matchedKA = KEEP_ALIVE_ROUTES.find((r) => r.path === pathname);

  // LRU list in a ref — updated SYNCHRONOUSLY during render so the new page
  // is in the list on the SAME render cycle as the navigation. Using useState
  // + useEffect caused a blank-flash bug (one render with nothing visible).
  const lruRef = useRef<string[]>([]);

  if (matchedKA && lruRef.current[0] !== matchedKA.path) {
    lruRef.current = [
      matchedKA.path,
      ...lruRef.current.filter((p) => p !== matchedKA.path),
    ].slice(0, MAX_ALIVE);
  }

  const alivePages = lruRef.current;

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <>
      {/* Keep-alive pages: mount on first visit, hide when inactive, show when active */}
      {KEEP_ALIVE_ROUTES.map((route) => {
        if (!alivePages.includes(route.path)) return null;

        const isActive = route.path === pathname;

        // login page doesn't need ProtectedRoute
        const inner = (
          <SafePage>{route.element}</SafePage>
        );

        const wrapped = route.path === "/login" ? inner : (
          <ProtectedRoute
            requireAdmin={route.requireAdmin}
            routePath={route.path}
          >
            {inner}
          </ProtectedRoute>
        );

        return (
          <div
            key={route.path}
            style={{ display: isActive ? "contents" : "none" }}
          >
            <Suspense fallback={<PageLoader />}>
              {wrapped}
            </Suspense>
          </div>
        );
      })}

      {/* Parameterized routes + 404: normal mount/unmount (can't keep-alive with URL params) */}
      {!matchedKA && !redirectTo && (
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/website-builder/:slug" element={
              <ProtectedRoute requireAdmin><SafePage><WebsiteBuilder /></SafePage></ProtectedRoute>
            } />
            <Route path="/proposal/:slug" element={<SafePage><ProposalView /></SafePage>} />
            <Route path="/deck/:slug/present" element={<SafePage><DeckView /></SafePage>} />
            <Route path="/deck/:slug" element={<SafePage><DeckView /></SafePage>} />
            <Route path="/deck/:slug/editor" element={<SafePage><DeckEditor /></SafePage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}

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
            <KeepAliveRouter />
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
