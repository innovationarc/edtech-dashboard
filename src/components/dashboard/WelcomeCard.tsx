// src/components/dashboard/WelcomeCard.tsx
import { useState, useEffect } from 'react';
import { ArrowUpRight, Sparkles, TrendingUp, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

interface WelcomeCardProps {
  userName: string;
}

const GREETINGS = [
  { text: 'Good morning', emoji: '☀️', sub: "Let's make today count!" },
  { text: 'Good afternoon', emoji: '⚡', sub: "You're crushing it!" },
  { text: 'Good evening', emoji: '🌙', sub: "Great work today!" },
];

const TIPS = [
  'Check Analytics for weekly growth',
  '3 students pending approval',
  'New course needs review',
  'Platform satisfaction is high',
];

const WelcomeCard = ({ userName }: WelcomeCardProps) => {
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting(GREETINGS[0]);
    else if (hour >= 12 && hour < 17) setGreeting(GREETINGS[1]);
    else setGreeting(GREETINGS[2]);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex(i => (i + 1) % TIPS.length);
        setTipVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const firstName = userName.split(' ')[0];

  return (
    <div className="relative h-full rounded-2xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      minHeight: '200px',
    }}>
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 blur-2xl"
        style={{ background: 'radial-gradient(circle, #a78bfa, #6366f1)', animation: 'pulse 3s infinite' }} />
      <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-15 blur-2xl"
        style={{ background: 'radial-gradient(circle, #10b981, #06b6d4)' }} />
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
        <Star size={11} className="text-yellow-300 fill-yellow-300" />
        <span className="text-xs font-semibold text-white/90">Admin</span>
      </div>
      <div className="relative p-5 h-full flex flex-col justify-between" style={{ minHeight: '200px' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{greeting.emoji}</span>
            <span className="text-xs font-medium text-white/60 uppercase tracking-widest">{greeting.text}</span>
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight mb-1">Hey, {firstName}!</h2>
          <p className="text-sm text-white/60">{greeting.sub}</p>
        </div>
        <div className="my-4 h-7 overflow-hidden">
          <div className="flex items-center gap-2" style={{ opacity: tipVisible ? 1 : 0, transform: tipVisible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.3s, transform 0.3s' }}>
            <Sparkles size={13} className="text-violet-300 flex-shrink-0" />
            <p className="text-xs text-white/70 truncate">{TIPS[tipIndex]}</p>
          </div>
        </div>
        <Link
          to="/analytics"
          className="group inline-flex items-center gap-2 bg-white text-gray-900 text-xs font-bold px-4 py-2.5 rounded-xl w-max hover:bg-white/90 transition-all duration-200 shadow-lg"
        >
          <TrendingUp size={14} />
          View Analytics
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
};

export default WelcomeCard;
