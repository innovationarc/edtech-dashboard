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
  const baseClasses = "bg-card rounded-2xl overflow-hidden";
  const interactiveClasses = onClick ? "cursor-pointer" : "";
  const hoverClasses = hover || onClick ? "hover:shadow-card-hover transition-all duration-300" : "";

  return (
    <div 
      className={clsx(baseClasses, interactiveClasses, hoverClasses, className)}
      style={{ fontFamily: "'Outfit', sans-serif", border: '1px solid rgba(255,255,255,0.05)' }}
      onClick={onClick}
    >
      {(title || subtitle || icon) && (
        <div className="px-4 py-3 lg:px-5 lg:py-4 border-b border-background-800 flex justify-between items-center">
          <div className="min-w-0 flex-1">
            {title && <h3 style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1rem)', fontWeight: 600, color: 'white' }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: 'clamp(0.7rem, 1.1vw, 0.8rem)', color: 'rgba(156,163,175,1)', marginTop: '2px' }}>{subtitle}</p>}
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
