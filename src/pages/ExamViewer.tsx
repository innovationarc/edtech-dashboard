// src/pages/ExamViewer.tsx
// Placeholder — Full exam/quiz engine will be built here.
// Handles content type: 'exam' (mcq | written | mixed)
// Route: /content-library/exam/:courseId/:contentId

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Construction } from 'lucide-react';

const ExamViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0c0e16] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 70% 40% at 50% -5%,rgba(244,63,94,0.09) 0%,transparent 65%)',
      }} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors
                     px-3 py-1.5 rounded-lg hover:bg-white/6 border border-transparent hover:border-white/10
                     focus:outline-none mb-8"
        >
          <ArrowLeft size={15} />
          Back to Library
        </button>

        {/* Card */}
        <div className="rounded-3xl border border-white/8 bg-[#131620] overflow-hidden">

          {/* Exam area placeholder */}
          <div className="relative h-64 sm:h-80 bg-gradient-to-br from-rose-900/25 to-[#0c0e16] flex items-center justify-center border-b border-white/6">
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div className="w-20 h-20 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
                <ClipboardList size={36} className="text-rose-400" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-slate-300 font-medium text-lg mb-1">Exam Engine</p>
                <p className="text-slate-500 text-sm max-w-xs">
                  The full MCQ / Written exam engine is coming soon. Exams will run here with a timer.
                </p>
              </div>
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full
                            bg-rose-500/15 border border-rose-500/20 text-rose-300 text-xs font-medium">
              <Construction size={12} />
              Under Construction
            </div>
          </div>

          {/* Info */}
          <div className="p-6 sm:p-8 space-y-6">

            <div className="flex items-center gap-2 flex-wrap">
              {['MCQ', 'Written', 'Mixed'].map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15
                                         border border-rose-400/25 text-rose-300 text-xs font-medium">
                  <ClipboardList size={11} strokeWidth={2.5} /> {t}
                </span>
              ))}
              <span className="ml-1 text-xs text-slate-600">— all exam types open this viewer</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Course ID"  value={courseId  ?? '—'} />
              <InfoRow label="Content ID" value={contentId ?? '—'} />
            </div>

            <div className="rounded-2xl bg-white/3 border border-white/6 p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-300">What this page will include:</p>
              <ul className="space-y-2">
                {[
                  'Countdown timer (MCQ / Written split)',
                  'Question navigator with status indicators',
                  'MCQ with single / multiple correct options',
                  'Written answer text areas with image upload',
                  'Negative marking & skip mark handling',
                  'Auto-submit on timer expiry',
                  'Instant MCQ result with explanations',
                  'Written answer review by teacher',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 flex-shrink-0" />
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

export default ExamViewer;
