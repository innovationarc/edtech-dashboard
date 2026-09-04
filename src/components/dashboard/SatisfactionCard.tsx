interface SatisfactionCardProps { satisfactionRate: number; }

const SatisfactionCard = ({ satisfactionRate }: SatisfactionCardProps) => {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = circ * satisfactionRate / 100;

  return (
    <div className="h-full rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--color-card, #1f2937)', minHeight: '200px' }}>
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-sm font-semibold text-white">Satisfaction</h3>
        <p className="text-xs text-gray-500 mt-0.5">Course ratings</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-5">
        <div className="relative" style={{ width: 110, height: 110 }}>
          <svg width="110" height="110" viewBox="0 0 110 110" className="absolute inset-0 -rotate-90">
            <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"/>
            <circle cx="55" cy="55" r={r} fill="none" stroke="url(#satGrad)" strokeWidth="10"
              strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"/>
            <defs>
              <linearGradient id="satGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#a78bfa"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{satisfactionRate}%</span>
            <span className="text-[11px] text-gray-500">avg rating</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>Satisfied</span>
          <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2 h-2 rounded-full bg-background-700 inline-block"/>Neutral</span>
        </div>
      </div>
    </div>
  );
};

export default SatisfactionCard;
