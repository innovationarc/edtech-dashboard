// src/components/dashboard/ClockWidget.tsx
import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

const ClockWidget = () => {
  const [time, setTime] = useState(new Date());
  const { theme } = useDashboard();
  const isLight = theme === 'light';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const is24h = false;

  const displayHours = is24h ? hours : hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = dayNames[time.getDay()];
  const monthName = monthNames[time.getMonth()];
  const dateNum = time.getDate();

  // Analog clock hands
  const secDeg = seconds * 6;
  const minDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="h-full rounded-2xl overflow-hidden relative flex flex-col items-center justify-center p-4"
      style={{
        background: isLight
          ? 'linear-gradient(145deg, #f8f7f4 0%, #eeecea 60%, #f0eeeb 100%)'
          : 'linear-gradient(145deg, #0a0a0f 0%, #111827 60%, #0d1117 100%)',
        minHeight: '200px',
      }}
    >
      {/* Glow ring bg */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
      </div>

      {/* Analog clock face */}
      <div className="relative mb-3" style={{ width: 90, height: 90 }}>
        {/* Clock face */}
        <svg width="90" height="90" viewBox="0 0 90 90" className="absolute inset-0">
          {/* Outer ring */}
          <circle cx="45" cy="45" r="43" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="1.5" />
          <circle cx="45" cy="45" r="38" fill={isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)'} stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'} strokeWidth="1" />
          
          {/* Hour ticks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30) * Math.PI / 180;
            const x1 = 45 + 33 * Math.sin(angle);
            const y1 = 45 - 33 * Math.cos(angle);
            const x2 = 45 + 38 * Math.sin(angle);
            const y2 = 45 - 38 * Math.cos(angle);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" strokeLinecap="round" />;
          })}

          {/* Hour hand */}
          <line
            x1="45" y1="45"
            x2={45 + 20 * Math.sin(hourDeg * Math.PI / 180)}
            y2={45 - 20 * Math.cos(hourDeg * Math.PI / 180)}
            stroke={isLight ? '#1f2937' : 'white'} strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: 'all 0.3s ease', transformOrigin: '45px 45px' }}
          />
          {/* Minute hand */}
          <line
            x1="45" y1="45"
            x2={45 + 28 * Math.sin(minDeg * Math.PI / 180)}
            y2={45 - 28 * Math.cos(minDeg * Math.PI / 180)}
            stroke={isLight ? 'rgba(31,41,55,0.75)' : 'rgba(255,255,255,0.85)'} strokeWidth="1.8" strokeLinecap="round"
            style={{ transition: 'all 0.3s ease', transformOrigin: '45px 45px' }}
          />
          {/* Second hand */}
          <line
            x1="45" y1="45"
            x2={45 + 32 * Math.sin(secDeg * Math.PI / 180)}
            y2={45 - 32 * Math.cos(secDeg * Math.PI / 180)}
            stroke="#6366f1" strokeWidth="1" strokeLinecap="round"
          />
          {/* Tail */}
          <line
            x1="45" y1="45"
            x2={45 - 8 * Math.sin(secDeg * Math.PI / 180)}
            y2={45 + 8 * Math.cos(secDeg * Math.PI / 180)}
            stroke="#6366f1" strokeWidth="1" strokeLinecap="round"
          />
          {/* Center dot */}
          <circle cx="45" cy="45" r="3" fill="#6366f1" />
          <circle cx="45" cy="45" r="1.5" fill={isLight ? '#fff' : 'white'} />
        </svg>
      </div>

      {/* Digital time */}
      <div className="text-center relative z-10">
        <div className="flex items-end justify-center gap-1">
          <span className="font-bold leading-none" style={{
            fontSize: '2.2rem',
            fontFamily: '"SF Pro Display", -apple-system, sans-serif',
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
            color: isLight ? '#111827' : 'white',
          }}>
            {pad(displayHours)}:{pad(minutes)}
          </span>
          <div className="flex flex-col items-start mb-1 ml-1">
            <span className="text-xs font-bold text-primary-400 leading-none">{ampm}</span>
            <span className="text-[10px] leading-none mt-0.5" style={{ color: isLight ? '#9ca3af' : '#6b7280' }}>{pad(seconds)}</span>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="h-px w-6" style={{ background: isLight ? 'linear-gradient(to right, transparent, rgba(0,0,0,0.12))' : 'linear-gradient(to right, transparent, rgba(255,255,255,0.20))' }} />
          <p className="text-xs font-medium tracking-wide" style={{ color: isLight ? '#6b7280' : '#9ca3af' }}>
            {dayName}, {monthName} {dateNum}
          </p>
          <div className="h-px w-6" style={{ background: isLight ? 'linear-gradient(to left, transparent, rgba(0,0,0,0.12))' : 'linear-gradient(to left, transparent, rgba(255,255,255,0.20))' }} />
        </div>
      </div>
    </div>
  );
};

export default ClockWidget;
          {/* Minute hand */}
          <line
            x1="45" y1="45"
            x2={45 + 28 * Math.sin(minDeg * Math.PI / 180)}
            y2={45 - 28 * Math.cos(minDeg * Math.PI / 180)}
            stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round"
            style={{ transition: 'all 0.3s ease', transformOrigin: '45px 45px' }}
          />
          {/* Second hand */}
          <line
            x1="45" y1="45"
            x2={45 + 32 * Math.sin(secDeg * Math.PI / 180)}
            y2={45 - 32 * Math.cos(secDeg * Math.PI / 180)}
            stroke="#6366f1" strokeWidth="1" strokeLinecap="round"
          />
          {/* Tail */}
          <line
            x1="45" y1="45"
            x2={45 - 8 * Math.sin(secDeg * Math.PI / 180)}
            y2={45 + 8 * Math.cos(secDeg * Math.PI / 180)}
            stroke="#6366f1" strokeWidth="1" strokeLinecap="round"
          />
          {/* Center dot */}
          <circle cx="45" cy="45" r="3" fill="#6366f1" />
          <circle cx="45" cy="45" r="1.5" fill="white" />
        </svg>
      </div>

      {/* Digital time */}
      <div className="text-center relative z-10">
        <div className="flex items-end justify-center gap-1">
          <span className="font-bold text-white leading-none" style={{
            fontSize: '2.2rem',
            fontFamily: '"SF Pro Display", -apple-system, sans-serif',
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {pad(displayHours)}:{pad(minutes)}
          </span>
          <div className="flex flex-col items-start mb-1 ml-1">
            <span className="text-xs font-bold text-primary-400 leading-none">{ampm}</span>
            <span className="text-[10px] text-gray-500 leading-none mt-0.5">{pad(seconds)}</span>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="h-px w-6 bg-gradient-to-r from-transparent to-white/20" />
          <p className="text-xs text-gray-400 font-medium tracking-wide">
            {dayName}, {monthName} {dateNum}
          </p>
          <div className="h-px w-6 bg-gradient-to-l from-transparent to-white/20" />
        </div>
      </div>
    </div>
  );
};

export default ClockWidget;
