import { memo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Home,
  FileText,
  Search,
  Bot,
  Mail,
  Users,
  Activity,
  Presentation,
  Settings,
  FolderOpen,
  LogOut,
  Menu,
  CheckCircle,
  Palette,
  Brain,
  Building2,
  ListTodo,
} from 'lucide-react';
import teamPitLogo from '@/assets/team-pit-logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

const navItems: { path: string; label: string; icon: typeof Home }[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/tasks', label: 'Tasks', icon: ListTodo },
  { path: '/client-health', label: 'Command Center', icon: Activity },
  { path: '/proposals', label: 'Proposals', icon: FolderOpen },
  { path: '/proposal-builder', label: 'Proposal Builder', icon: FileText },
  { path: '/deck-builder', label: 'Deck Builder', icon: Presentation },
  { path: '/seo-writer', label: 'SEO Writer', icon: Search },
  { path: '/creative-studio', label: 'Creative Studio', icon: Palette },
  { path: '/qa-bot', label: 'QA Bot', icon: Bot },
  { path: '/proposal-qa', label: 'Proposal QA', icon: CheckCircle },
  { path: '/email-writer', label: 'Email Writer', icon: Mail },
  { path: '/client-update', label: 'Client Update', icon: Users },
  { path: '/client-settings', label: 'Clients', icon: Building2 },
  { path: '/strategist-settings', label: 'Strategist', icon: Brain },
  { path: '/admin', label: 'Admin Settings', icon: Settings },
  { path: '/', label: 'Super Agent', icon: Bot },
];

const AdminHeader = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  const handleNav = useCallback((path: string) => {
    navigate(path);
    setSheetOpen(false);
  }, [navigate]);

  if (!isAdmin) return null;

  const currentPage = navItems.find(item => item.path === location.pathname);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 sm:h-14 items-center px-3 sm:px-4 gap-2 sm:gap-4">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
        >
          <img src={teamPitLogo} alt="The Team Pit" className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="font-display font-semibold text-sm hidden sm:inline text-foreground">
            The Team Pit
          </span>
        </button>

        {/* Current page indicator */}
        {currentPage && (
          <span className="text-xs font-medium text-foreground truncate flex-1">
            {currentPage.label}
          </span>
        )}

        {/* Right Side */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* Mobile: Full-screen Sheet nav */}
          {isMobile ? (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0">
                <SheetHeader className="p-4 border-b border-border">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <img src={teamPitLogo} alt="The Team Pit" className="w-6 h-6" />
                    The Team Pit
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto p-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}

                      </button>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            /* Desktop: Dropdown for extra tools */
            <>
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3">
                    <Menu className="h-4 w-4 mr-2" />
                    Tools
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[320px] p-0">
                  <SheetHeader className="p-4 border-b border-border">
                    <SheetTitle>All Tools</SheetTitle>
                  </SheetHeader>
                  <nav className="overflow-y-auto p-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNav(item.path)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
  
                        </button>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}

          {/* User Info - desktop only */}
          <span className="text-xs text-muted-foreground hidden md:inline truncate max-w-[150px]">
            {user?.email}
          </span>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Sign Out - desktop only */}
          {!isMobile && (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 w-8 p-0">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
});

AdminHeader.displayName = 'AdminHeader';

export default AdminHeader;
