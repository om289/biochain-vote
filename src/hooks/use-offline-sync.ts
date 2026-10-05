/**
 * useOfflineSync — React hook for real-time offline/sync state
 *
 * Exposes:
 *  - isOnline: browser connectivity status
 *  - pendingCount: number of mutations waiting to be synced
 *  - syncStatus: 'idle' | 'syncing' | 'error'
 *  - lastSyncedAt: timestamp of the last successful flush
 *  - triggerSync(): manually kick off a flush
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineSyncQueue } from '../services/dbService';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  triggerSync: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const isSyncingRef = useRef(false);

  // Poll the queue size every 3 seconds
  useEffect(() => {
    const refreshCount = async () => {
      try {
        const count = await offlineSyncQueue.count();
        setPendingCount(count);
      } catch {
        // non-fatal
      }
    };
    refreshCount();
    const interval = setInterval(refreshCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-flush when we come back online
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const flushed = await offlineSyncQueue.flush();
      if (flushed > 0) {
        setLastSyncedAt(new Date());
      }
      setSyncStatus('idle');
    } catch (err) {
      console.error('[useOfflineSync] flush error:', err);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
      // Refresh count after sync
      try {
        const count = await offlineSyncQueue.count();
        setPendingCount(count);
      } catch {}
    }
  }, []);

  return { isOnline, pendingCount, syncStatus, lastSyncedAt, triggerSync };
}
