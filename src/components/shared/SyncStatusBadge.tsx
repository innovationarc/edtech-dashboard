/**
 * pie Academy — SyncStatusBadge
 *
 * Small badge to show in the app header or sidebar indicating sync status.
 * Shows: online (green), syncing (spinning), offline (red), pending writes count.
 *
 * Usage:
 *   <SyncStatusBadge status={status} pendingCount={pendingCount} />
 */

import React from 'react';

interface SyncStatusBadgeProps {
  status: 'idle' | 'syncing' | 'error' | 'offline' | 'unauthenticated';
  pendingCount?: number;
  className?: string;
}

const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  pendingCount = 0,
  className = '',
}) => {
  if (status === 'unauthenticated') return null;

  const config = {
    idle: {
      dot: 'bg-emerald-500',
      label: 'Synced',
      pulse: false,
    },
    syncing: {
      dot: 'bg-indigo-400 animate-pulse',
      label: 'Syncing…',
      pulse: true,
    },
    error: {
      dot: 'bg-amber-500',
      label: 'Sync error',
      pulse: false,
    },
    offline: {
      dot: 'bg-red-500 animate-pulse',
      label: pendingCount > 0 ? `${pendingCount} pending` : 'Offline',
      pulse: true,
    },
  }[status] ?? { dot: 'bg-gray-500', label: '', pulse: false };

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`}
      title={config.label}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
};

export default SyncStatusBadge;
