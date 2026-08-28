import { useNavigate, useLocation } from 'react-router-dom';
import { Settings, Bot, Zap, DollarSign, ListChecks, LayoutDashboard } from 'lucide-react';

const TABS = [
  { path: '/admin',                    label: 'Admin',           icon: Settings        },
  { path: '/super-agent-dashboard',    label: 'Agent Dashboard', icon: LayoutDashboard },
  { path: '/super-agent-settings',     label: 'Super Agent',     icon: Bot             },
  { path: '/admin/task-settings',   label: 'Tasks',        icon: ListChecks  },
  { path: '/admin/task-weights',    label: 'Task Weights', icon: Zap         },
  { path: '/admin/task-bonus',      label: 'Bonus Tracker', icon: DollarSign },
];

export default function SettingsTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="border-b border-border bg-background/80 sticky top-12 sm:top-14 z-40">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex overflow-x-auto gap-0 scrollbar-none">
          {TABS.map(({ path, label, icon: Icon }) => {
            const isActive = pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
