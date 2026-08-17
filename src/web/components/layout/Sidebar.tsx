import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  FileText,
  BarChart3,
  Search,
  AlertTriangle,
  Settings,
  Key,
  Server,
  Home,
  LayoutDashboard,
  Network,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProjectStore } from '../../stores/projectStore';

const navigation = [
  { name: 'Home', href: '/', icon: Home, exact: true },
  { name: 'Dashboards', href: '/dashboards', icon: LayoutDashboard },
  { name: 'Services', href: '/services', icon: Server, exact: true },
  { name: 'Service Map', href: '/services/map', icon: Network },
  { name: 'Requests', href: '/traces', icon: Activity },
  { name: 'Logs', href: '/logs', icon: FileText },
  { name: 'Metrics', href: '/metrics', icon: BarChart3 },
  { name: 'Errors', href: '/errors', icon: AlertTriangle },
  { name: 'Queries', href: '/queries', icon: Search },
];

const settingsNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'API Keys', href: '/settings/api-keys', icon: Key },
];

export function Sidebar() {
  const location = useLocation();
  const { currentProject } = useProjectStore();

  return (
    <div className="flex h-full w-16 flex-col bg-card border-r">
      <div className="flex h-14 items-center justify-center border-b">
        <img src="/assets/logo-icon.svg" alt="Lumina" className="h-8 w-8" />
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = 'exact' in item && item.exact
            ? location.pathname === item.href
            : location.pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md transition-colors mx-auto',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={item.name}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-2 py-4 space-y-1">
        {settingsNavigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md transition-colors mx-auto',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              title={item.name}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
