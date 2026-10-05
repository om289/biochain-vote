import { NavLink, useLocation } from 'react-router-dom';
import { Home, Vote, ShieldCheck, User, BarChart3, Users, Fingerprint, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAppStore } from '@/store/useAppStore';
import { OfflineSyncMonitor } from '@/components/ui/OfflineSyncMonitor';

const navItems = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/identity', label: 'Identity', icon: Fingerprint },
  { to: '/vote', label: 'Vote', icon: Vote },
  { to: '/verify', label: 'Verify', icon: ShieldCheck },
  { to: '/explorer', label: 'Explorer', icon: Network },
  { to: '/profile', label: 'Profile', icon: User },
];

const adminItems = [
  { to: '/admin', label: 'Admin', icon: Users },
  { to: '/audit', label: 'Audit', icon: BarChart3 },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { isAdmin } = useAppStore();

  const isActive = (path: string) => location.pathname === path;

  const mobileOfficerItems = [
    { to: '/admin', label: 'Admin', icon: Settings },
    { to: '/audit', label: 'Consensus', icon: FileCheck },
    { to: '/dashboard', label: 'Telemetry', icon: Home },
    { to: '/explorer', label: 'Ledger', icon: Layers },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Top Officer Status Bar */}
      {isMobile && (
        <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-display font-bold text-xs text-foreground tracking-wide">BioChain EVM</span>
              <span className="text-[10px] text-biochain-warning font-semibold ml-1.5 px-1.5 py-0.5 rounded bg-biochain-warning/10 border border-biochain-warning/30">
                Officer Mobile
              </span>
            </div>
          </div>
          <OfflineSyncMonitor variant="compact" />
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-sm">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">BioChain</h1>
                <p className="text-xs text-muted-foreground">Secure E-Voting</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-3">Navigation</p>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive(item.to)
                    ? 'bg-primary/15 text-primary glow-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                aria-current={isActive(item.to) ? 'page' : undefined}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}

          {isAdmin && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mt-6 mb-3">Administration</p>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive(item.to)
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  aria-current={isActive(item.to) ? 'page' : undefined}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

          <div className="p-4 border-t border-border">
            <OfflineSyncMonitor variant="compact" />
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-auto">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar — Dedicated to Officer / Admin Operations */}
      {isMobile && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/90 backdrop-blur-xl safe-bottom"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-around py-2 px-2 overflow-x-auto">
            {mobileOfficerItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[60px] flex-shrink-0',
                  isActive(item.to)
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-current={isActive(item.to) ? 'page' : undefined}
              >
                <item.icon className={cn('w-5 h-5', isActive(item.to) && 'drop-shadow-[0_0_6px_hsl(var(--primary))] text-primary')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
