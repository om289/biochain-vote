/**
 * OfflineSyncMonitor — Live network status + pending sync badge
 *
 * Shows:
 *  - Green dot + "Online" when connected
 *  - Amber dot + "Offline" when disconnected
 *  - Animated spinner + "Syncing…" while flushing
 *  - Badge with pending count
 *  - Manual sync button (visible when online + items pending)
 */

import { RefreshCw, WifiOff, Wifi, Cloud } from 'lucide-react';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { cn } from '@/lib/utils';

interface OfflineSyncMonitorProps {
  /** compact = sidebar widget; full = page-level banner */
  variant?: 'compact' | 'full';
}

export function OfflineSyncMonitor({ variant = 'compact' }: OfflineSyncMonitorProps) {
  const { isOnline, pendingCount, syncStatus, lastSyncedAt, triggerSync } = useOfflineSync();

  const statusColor = isOnline
    ? syncStatus === 'error' ? 'bg-biochain-danger' : 'bg-biochain-success'
    : 'bg-biochain-warning';

  const statusLabel = !isOnline
    ? 'Offline'
    : syncStatus === 'syncing' ? 'Syncing…'
    : syncStatus === 'error' ? 'Sync Error'
    : 'Online';

  const NetworkIcon = isOnline ? (pendingCount > 0 ? Cloud : Wifi) : WifiOff;

  if (variant === 'full') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3 border text-sm font-medium transition-all',
          isOnline
            ? 'bg-biochain-success/10 border-biochain-success/30 text-biochain-success'
            : 'bg-biochain-warning/10 border-biochain-warning/30 text-biochain-warning'
        )}
        role="status"
        aria-live="polite"
        aria-label={`Network status: ${statusLabel}${pendingCount > 0 ? `, ${pendingCount} pending` : ''}`}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className={cn('w-2.5 h-2.5 rounded-full', statusColor, isOnline ? 'animate-pulse' : '')} />
          <NetworkIcon className="w-4 h-4" />
          <span>{statusLabel}</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-biochain-warning/20 text-biochain-warning text-xs font-bold border border-biochain-warning/30">
              {pendingCount} pending
            </span>
          )}
        </div>

        {isOnline && pendingCount > 0 && syncStatus !== 'syncing' && (
          <button
            onClick={triggerSync}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-biochain-success/20 hover:bg-biochain-success/30 text-biochain-success text-xs font-semibold transition-all"
            aria-label="Sync pending mutations"
          >
            <RefreshCw className="w-3 h-3" />
            Sync now
          </button>
        )}

        {syncStatus === 'syncing' && (
          <RefreshCw className="w-4 h-4 animate-spin text-biochain-success" aria-hidden="true" />
        )}

        {lastSyncedAt && pendingCount === 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            Last sync {lastSyncedAt.toLocaleTimeString()}
          </span>
        )}
      </div>
    );
  }

  // compact sidebar widget
  return (
    <div className="glass rounded-lg p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">Network</p>
        {pendingCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-biochain-warning/20 text-biochain-warning font-bold border border-biochain-warning/30">
            {pendingCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor, isOnline && syncStatus !== 'syncing' ? 'animate-pulse' : '')} />
        {syncStatus === 'syncing'
          ? <RefreshCw className="w-3 h-3 animate-spin text-biochain-success flex-shrink-0" />
          : <NetworkIcon className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
        }
        <span className="text-xs text-foreground">{statusLabel}</span>
        {isOnline && pendingCount > 0 && syncStatus !== 'syncing' && (
          <button
            onClick={triggerSync}
            className="ml-auto"
            title="Sync pending items"
            aria-label="Sync now"
          >
            <RefreshCw className="w-3 h-3 text-biochain-warning hover:text-biochain-success transition-colors" />
          </button>
        )}
      </div>
      {!isOnline && pendingCount > 0 && (
        <p className="text-[10px] text-biochain-warning mt-1.5">
          {pendingCount} op{pendingCount !== 1 ? 's' : ''} queued — will sync on reconnect
        </p>
      )}
      {lastSyncedAt && isOnline && pendingCount === 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Synced {lastSyncedAt.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
