// src/components/dashboard/WelcomeCard.tsx — iDraft-style dark info card
import { useState, useEffect } from 'react';
import { ArrowUpRight, TrendingUp, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

interface WelcomeCardProps {
  userName: string;
}

const GREETINGS = [
  { text: 'Good morning', sub: "Let's make today count!" },
  { text: 'Good afternoon', sub: "You're crushing it!" },
  { text: 'Good evening', sub: "Great work today!" },
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
    <div
      className="relative h-full rounded-2xl overflow-hidden dashboard-card"
      style={{
        /* Dark card — matches iDraft's "Overall Information" dark card */
        background: 'linear-gradient(145deg, #111827 0%, #0d1117 100%)',
        minHeight: '200px',
        padding: '24px',
      }}
    >
      {/* Subtle top-right accent — not glow, just a soft gradient bleed */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 70% 20%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex flex-col h-full" style={{ minHeight: '200px' }}>
        {/* Greeting line */}
        <div className="mb-1">
          <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.7)', marginBottom: 4 }}>
            {greeting.text}
          </p>
          <h2 style={{ fontSize: '32px', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 4 }}>
            Hi, {firstName}!
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(148,163,184,0.75)', lineHeight: 1.5 }}>
            {greeting.sub}
          </p>
        </div>

        {/* Rotating tip */}
        <div className="my-4 h-7 overflow-hidden flex-shrink-0">
          <div className="flex items-center gap-2"
            style={{
              opacity: tipVisible ? 1 : 0,
              transform: tipVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.3s, transform 0.3s',
            }}>
            <Zap size={12} className="flex-shrink-0" style={{ color: 'rgba(167,139,250,0.85)' }} />
            <p style={{ fontSize: '12px', color: 'rgba(148,163,184,0.7)' }}>{TIPS[tipIndex]}</p>
          </div>
        </div>

        <div className="mt-auto">
          <Link
            to="/analytics"
            className="group inline-flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.16)';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <TrendingUp size={14} />
            View Analytics
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;
