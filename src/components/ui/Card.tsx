import { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  hover?: boolean;
}

const Card = ({ 
  children, 
  className, 
  title, 
  subtitle, 
  icon, 
  footer, 
  onClick,
  hover = false 
}: CardProps) => {
  const baseClasses = "bg-card rounded-xl shadow-card overflow-hidden";
  const interactiveClasses = onClick ? "cursor-pointer" : "";
  const hoverClasses = hover || onClick ? "hover:shadow-card-hover transition-all duration-300" : "";

  return (
    <div 
      className={clsx(baseClasses, interactiveClasses, hoverClasses, className)}
      onClick={onClick}
    >
      {(title || subtitle || icon) && (
        <div className="p-4 lg:p-5 border-b border-background-800 flex justify-between items-center">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-white font-medium truncate">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-400 truncate mt-1">{subtitle}</p>}
          </div>
          {icon && <div className="ml-3 flex-shrink-0">{icon}</div>}
        </div>
      )}
      
      <div className="p-4 lg:p-5">{children}</div>
      
      {footer && (
        <div className="px-4 lg:px-5 py-3 border-t border-background-800 bg-card-dark">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;