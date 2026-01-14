interface SatisfactionCardProps {
  satisfactionRate: number;
}

const SatisfactionCard = ({ satisfactionRate }: SatisfactionCardProps) => {
  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Platform Satisfaction</h3>
        <p className="text-sm text-gray-400">Based on course ratings</p>
      </div>
      
      <div className="p-5 flex flex-col items-center justify-center">
        <div className="relative h-44 w-44">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="block text-3xl font-bold text-white">{satisfactionRate}%</span>
              <span className="text-sm text-gray-400">Average rating</span>
            </div>
          </div>
          
          <svg className="w-full h-full" viewBox="0 0 100 100">
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
              stroke="#6366f1" 
              strokeWidth="10" 
              strokeDasharray={`${2 * Math.PI * 40 * satisfactionRate / 100} ${2 * Math.PI * 40 * (100 - satisfactionRate) / 100}`}
              strokeDashoffset={2 * Math.PI * 40 * 0.25}
              strokeLinecap="round"
            />
          </svg>
        </div>
        
        <div className="w-full mt-4 flex justify-between text-xs">
          <span className="text-gray-400">0%</span>
          <span className="text-white">{satisfactionRate}%</span>
          <span className="text-gray-400">100%</span>
        </div>
      </div>
    </div>
  );
};

export default SatisfactionCard;