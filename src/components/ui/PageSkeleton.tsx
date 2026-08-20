// PageSkeleton.tsx
// Universal skeleton that replaces all <Loader /> spinners during page data loading
// Stagger-animates into view so it feels like content is already arriving
import { useEffect, useRef } from 'react';

interface PageSkeletonProps {
  // Layout hint — different skeletons for different page types
  variant?: 'cards' | 'list' | 'stats' | 'table' | 'mixed';
  rows?: number;
}

// Single shimmering bone
const Bone = ({
  w = '100%', h = 16, r = 8, delay = 0, style = {}
}: {
  w?: string | number; h?: number; r?: number; delay?: number; style?: React.CSSProperties;
}) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: 'var(--sk-base)',
    backgroundImage: 'linear-gradient(90deg, var(--sk-base) 0%, var(--sk-shine) 40%, var(--sk-base) 80%)',
    backgroundSize: '600px 100%',
    animation: `skShimmer 1.6s ease-in-out infinite, skFadeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s both`,
    flexShrink: 0,
    ...style,
  }} />
);

const PageSkeleton = ({ variant = 'mixed', rows = 3 }: PageSkeletonProps) => {
  const ref = useRef<HTMLDivElement>(null);

  // Tell progress bar we are loading
  useEffect(() => {
    return () => {
      // When this unmounts, data has loaded — finish the progress bar
      (window as any).__progressFinish?.();
    };
  }, []);

  const shared: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6,
  };

  const StatsSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(140px,100%),1fr))', gap: 12, marginBottom: 20, minWidth: 0 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          padding: '14px 16px', borderRadius: 14,
          border: '1px solid var(--sk-border)',
          display: 'flex', flexDirection: 'column', gap: 8,
          animation: `skFadeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) ${i*0.06}s both`,
        }}>
          <Bone w="55%" h={10} r={5} delay={i*0.06} />
          <Bone w="70%" h={22} r={6} delay={i*0.06+0.04} />
        </div>
      ))}
    </div>
  );

  const CardsSkeleton = ({ count = 4, cols = 2 }: { count?: number; cols?: number }) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
      gap: 12,
      minWidth: 0,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          padding: '16px', borderRadius: 16,
          border: '1px solid var(--sk-border)',
          display: 'flex', flexDirection: 'column', gap: 10,
          animation: `skFadeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) ${i*0.07}s both`,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Bone w={36} h={36} r={10} delay={i*0.07} />
            <div style={shared}>
              <Bone w="60%" h={11} r={5} delay={i*0.07+0.04} />
              <Bone w="40%" h={9} r={4} delay={i*0.07+0.07} />
            </div>
          </div>
          <Bone w="100%" h={9} r={4} delay={i*0.07+0.06} />
          <Bone w="75%" h={9} r={4} delay={i*0.07+0.08} />
          <Bone w="50%" h={9} r={4} delay={i*0.07+0.1} />
        </div>
      ))}
    </div>
  );

  const ListSkeleton = ({ count = 5 }: { count?: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          padding: '14px 16px', borderRadius: 12,
          border: '1px solid var(--sk-border)',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: `skFadeIn 0.38s cubic-bezier(0.25,0.46,0.45,0.94) ${i*0.05}s both`,
        }}>
          <Bone w={38} h={38} r={50} delay={i*0.05} />
          <div style={{ flex: 1, ...shared }}>
            <Bone w="45%" h={11} r={5} delay={i*0.05+0.03} />
            <Bone w="65%" h={9} r={4} delay={i*0.05+0.06} />
          </div>
          <Bone w={60} h={24} r={8} delay={i*0.05+0.04} />
        </div>
      ))}
    </div>
  );

  const TableSkeleton = () => (
    <div style={{ borderRadius: 14, border: '1px solid var(--sk-border)', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gap: 12, borderBottom: '1px solid var(--sk-border)',
        background: 'var(--sk-header)',
      }}>
        {[0,1,2,3].map(i => <Bone key={i} h={10} r={4} delay={i*0.03} />)}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          padding: '12px 16px', display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 12,
          borderBottom: i < 4 ? '1px solid var(--sk-border)' : undefined,
          animation: `skFadeIn 0.38s cubic-bezier(0.25,0.46,0.45,0.94) ${i*0.05}s both`,
        }}>
          {[0,1,2,3].map(j => <Bone key={j} h={10} r={4} delay={i*0.05+j*0.02} />)}
        </div>
      ))}
    </div>
  );

  return (
    <div ref={ref} style={{
      '--sk-base': 'rgba(127,127,127,0.08)',
      '--sk-shine': 'rgba(127,127,127,0.18)',
      '--sk-border': 'rgba(127,127,127,0.1)',
      '--sk-header': 'rgba(127,127,127,0.04)',
    } as React.CSSProperties}>

      <style>{`
        @keyframes skShimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes skFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Bone w="32%" h={22} r={8} delay={0} />
        <Bone w="20%" h={12} r={5} delay={0.04} />
      </div>

      {variant === 'stats' && (
        <>
          <StatsSkeleton />
          <CardsSkeleton count={4} cols={2} />
        </>
      )}

      {variant === 'cards' && (
        <>
          <CardsSkeleton count={6} cols={3} />
        </>
      )}

      {variant === 'list' && (
        <>
          <StatsSkeleton />
          <ListSkeleton count={rows} />
        </>
      )}

      {variant === 'table' && (
        <>
          <StatsSkeleton />
          <TableSkeleton />
        </>
      )}

      {variant === 'mixed' && (
        <>
          <StatsSkeleton />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <CardsSkeleton count={2} cols={1} />
            <CardsSkeleton count={2} cols={1} />
          </div>
          <ListSkeleton count={3} />
        </>
      )}
    </div>
  );
};

export default PageSkeleton;
