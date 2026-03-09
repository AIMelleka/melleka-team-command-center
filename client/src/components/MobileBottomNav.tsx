import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Bot, Activity, Building2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/super-agent-dashboard', icon: Bot, label: 'Agent' },
  { path: '/client-health', icon: Activity, label: 'Command' },
  { path: '/client-settings', icon: Building2, label: 'Clients' },
];

// Hide bottom nav on fullscreen pages where it would overlap content
const HIDDEN_PATHS = ['/', '/login'];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;
  if (HIDDEN_PATHS.includes(location.pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-background/95 backdrop-blur border-t border-border flex items-center justify-around px-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isActive
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
