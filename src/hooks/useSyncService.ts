/**
 * pie Academy — useSyncService hook
 *
 * Initializes and tears down the syncService tied to Firebase auth state.
 * Place this once in App.tsx or your AuthProvider.
 *
 * Usage:
 *   // In App.tsx or AuthProvider
 *   useSyncService();
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import syncService from '../lib/syncService';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'unauthenticated';

export function useSyncService() {
  const [status, setStatus] = useState<SyncStatus>('unauthenticated');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      if (user) {
        setStatus('syncing');
        await syncService.init(user.uid);

        // Subscribe to sync status changes
        const unsubStatus = syncService.onStatusChange((s) => {
          if (mounted) setStatus(s as SyncStatus);
        });

        // Poll pending write count every 5s
        const interval = setInterval(async () => {
          const count = await syncService.pendingWrites;
          if (mounted) setPendingCount(count);
        }, 5000);

        return () => {
          unsubStatus();
          clearInterval(interval);
        };
      } else {
        syncService.destroy();
        setStatus('unauthenticated');
        setPendingCount(0);
      }
    });

    return () => {
      mounted = false;
      unsubAuth();
      syncService.destroy();
    };
  }, []);

  return { status, pendingCount, isOnline: syncService.online };
}

export default useSyncService;
