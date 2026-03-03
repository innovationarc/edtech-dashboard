interface ReferralCardProps { invitedCount: number; bonusValue: number; }

const ReferralCard = ({ invitedCount, bonusValue }: ReferralCardProps) => {
  const rate = invitedCount > 0 ? Math.round((bonusValue / invitedCount) * 100) : 0;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = circ * rate / 100;

  return (
    <div className="h-full rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--color-card, #1f2937)', minHeight: '200px' }}>
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-sm font-semibold text-white">User Activity</h3>
        <p className="text-xs text-gray-500 mt-0.5">Active vs total</p>
      </div>
      <div className="flex-1 flex items-center gap-4 px-5 pb-5">
        <div className="relative flex-shrink-0" style={{ width: 90, height: 90 }}>
          <svg width="90" height="90" viewBox="0 0 90 90" className="-rotate-90">
            <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9"/>
            <circle cx="45" cy="45" r={r} fill="none" stroke="url(#actGrad)" strokeWidth="9"
              strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"/>
            <defs>
              <linearGradient id="actGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{rate}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div>
            <p className="text-xs text-gray-500">Total Users</p>
            <p className="text-lg font-bold text-white">{invitedCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Active Now</p>
            <p className="text-lg font-bold text-emerald-400">{bonusValue}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralCard;
