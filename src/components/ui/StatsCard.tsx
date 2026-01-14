import { ReactNode } from 'react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: {
    value: string | number;
    positive?: boolean;
  };
  colorScheme?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  onClick?: () => void;
}

const StatsCard = ({ 
  title, 
  value, 
  icon, 
  change, 
  colorScheme = 'primary',
  onClick 
}: StatsCardProps) => {
  const getIconBgColor = () => {
    switch (colorScheme) {
      case 'primary': return 'bg-primary-500';
      case 'secondary': return 'bg-secondary-500';
      case 'accent': return 'bg-accent-500';
      case 'success': return 'bg-success-DEFAULT';
      case 'warning': return 'bg-warning-DEFAULT';
      case 'error': return 'bg-error-DEFAULT';
      default: return 'bg-primary-500';
    }
  };

  return (
    <div 
      className={clsx(
        "bg-card rounded-xl shadow-card p-4 lg:p-5 flex items-center justify-between transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-card-hover hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm text-gray-400 mb-1 truncate">{title}</h3>
        <p className="text-xl lg:text-2xl font-semibold text-white truncate">{value}</p>
        {change && (
          <div className="flex items-center mt-1">
            <span 
              className={clsx(
                "text-xs",
                change.positive ? "text-success-DEFAULT" : "text-error-DEFAULT"
              )}
            >
              {change.positive ? '+' : ''}{change.value}
            </span>
          </div>
        )}
      </div>
      <div className={clsx(
        "h-10 w-10 lg:h-12 lg:w-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-3",
        getIconBgColor()
      )}>
        {icon}
      </div>
    </div>
  );
};

export default StatsCard;