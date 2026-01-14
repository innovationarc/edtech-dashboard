interface ReferralCardProps {
  invitedCount: number;
  bonusValue: number;
}

const ReferralCard = ({ invitedCount, bonusValue }: ReferralCardProps) => {
  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">User Statistics</h3>
      </div>
      
      <div className="p-5">
        <div className="flex justify-between mb-6">
          <div>
            <h4 className="text-gray-400 text-sm">Total Users</h4>
            <p className="text-white font-medium">{invitedCount} people</p>
          </div>
          <div>
            <h4 className="text-gray-400 text-sm">Active Users</h4>
            <p className="text-white font-medium">{bonusValue}</p>
          </div>
        </div>
        
        <div className="flex justify-center">
          <div className="relative">
            <svg className="w-32 h-32" viewBox="0 0 100 100">
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke="#1f2937" 
                strokeWidth="10" 
              />
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="10" 
                strokeDasharray={`${2 * Math.PI * 40 * (invitedCount > 0 ? (bonusValue / invitedCount) * 100 : 0) / 100} ${2 * Math.PI * 40 * (100 - (invitedCount > 0 ? (bonusValue / invitedCount) * 100 : 0)) / 100}`}
                strokeDashoffset={2 * Math.PI * 40 * 0.25}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-white">
                {invitedCount > 0 ? Math.round((bonusValue / invitedCount) * 100) : 0}%
              </span>
              <span className="text-xs text-gray-400">Active Rate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralCard;