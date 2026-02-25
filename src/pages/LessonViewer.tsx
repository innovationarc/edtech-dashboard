// src/pages/LessonViewer.tsx
// Placeholder — Full lesson/trick viewer will be built here.
// Handles content type: 'lesson' | 'trick'
// Route: /content-library/lesson/:courseId/:contentId

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Zap, Construction, Clock, BookOpen } from 'lucide-react';

const LessonViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0c0e16] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 40% at 50% -5%,rgba(139,92,246,0.1) 0%,transparent 65%)',
      }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors
                     px-3 py-1.5 rounded-lg hover:bg-white/6 border border-transparent hover:border-white/10
                     focus:outline-none mb-8"
        >
          <ArrowLeft size={15} />
          Back to Library
        </button>

        {/* Placeholder card */}
        <div className="rounded-3xl border border-white/8 bg-[#131620] overflow-hidden">

          {/* Video area placeholder */}
          <div className="relative h-64 sm:h-96 bg-gradient-to-br from-violet-900/30 to-[#0c0e16] flex items-center justify-center border-b border-white/6">
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                <Play size={36} className="text-violet-400 ml-1" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-slate-300 font-medium text-lg mb-1">Lesson / Trick Viewer</p>
                <p className="text-slate-500 text-sm max-w-xs">
                  The full video lesson viewer is coming soon. Content will play here.
                </p>
              </div>
            </div>

            {/* Corner badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            bg-violet-500/15 border border-violet-500/20 text-violet-300 text-xs font-medium">
              <Construction size={12} />
              Under Construction
            </div>
          </div>

          {/* Info panel */}
          <div className="p-6 sm:p-8 space-y-6">

            {/* Type badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15
                               border border-violet-400/25 text-violet-300 text-xs font-medium">
                <Play size={11} strokeWidth={2.5} /> Lesson
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15
                               border border-amber-400/25 text-amber-300 text-xs font-medium">
                <Zap size={11} strokeWidth={2.5} /> Trick
              </span>
              <span className="ml-1 text-xs text-slate-600">— both types open this viewer</span>
            </div>

            {/* IDs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Course ID"   value={courseId  ?? '—'} />
              <InfoRow label="Content ID"  value={contentId ?? '—'} />
            </div>

            {/* What will be here */}
            <div className="rounded-2xl bg-white/3 border border-white/6 p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-300">What this page will include:</p>
              <ul className="space-y-2">
                {[
                  'Secure video player (Platform B streaming)',
                  'Lesson title, description & subject tag',
                  'Progress tracking (mark as watched)',
                  'Note-taking sidebar',
                  'Next / Previous content navigation',
                  'Download PDF notes (if attached)',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] uppercase tracking-widest text-slate-600 font-semibold">{label}</span>
    <span className="text-sm text-slate-300 font-mono bg-white/4 border border-white/6 rounded-lg px-3 py-2 truncate">
      {value}
    </span>
  </div>
);

export default LessonViewer;
