
// src/pages/Progress.tsx
// Student Performance Hub — full-page detail drill-down, rich analytics
// Only 1-time limited exams (maxAttempts === 1) count toward rankings.
import PageSkeleton from '../components/ui/PageSkeleton';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy, Medal, Award, Search, BookOpen, Clock, Target,
  TrendingUp, RefreshCw, X, BarChart2, User, ArrowLeft,
  Loader, Star, Zap, ChevronRight, Activity, Hash,
  TrendingDown, Minus, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  leaderboardService,
  invalidateCache,
  CourseLeaderboardData,
  CourseLeaderboardEntry,
  ExamLeaderboardData,
} from '../services/leaderboardService';
import { Enrollment } from '../services/courseEnrollmentService';
import { Course } from '../services/courseService';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CourseSummary {
  enrollment: Enrollment;
  course: Course;
  courseLeaderboard: CourseLeaderboardData;
  myRank: number | null;
  myPercentage: number | null;
  top3: CourseLeaderboardEntry[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const GOLD = '#FFD700';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';
const RANK_COLORS = [GOLD, SILVER, BRONZE];
const ACCENT = '#6366f1';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function rankColor(rank: number | null) {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  return ACCENT;
}

function getGrade(pct: number): { letter: string; color: string } {
  if (pct >= 90) return { letter: 'A+', color: '#10b981' };
  if (pct >= 80) return { letter: 'A',  color: '#34d399' };
  if (pct >= 70) return { letter: 'B+', color: '#60a5fa' };
  if (pct >= 60) return { letter: 'B',  color: '#93c5fd' };
  if (pct >= 50) return { letter: 'C',  color: '#fbbf24' };
  if (pct >= 40) return { letter: 'D',  color: '#f97316' };
  return { letter: 'F', color: '#ef4444' };
}

function percentileText(rank: number, total: number): string {
  if (total <= 1) return 'Top Student';
  const pct = ((total - rank) / (total - 1)) * 100;
  if (pct >= 99) return 'Top 1%';
  if (pct >= 95) return 'Top 5%';
  if (pct >= 90) return 'Top 10%';
  if (pct >= 75) return 'Top 25%';
  if (pct >= 50) return 'Top 50%';
  return `Bottom ${(100 - pct).toFixed(0)}%`;
}

// ─── Micro Components ──────────────────────────────────────────────────────────
function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444'];
  const color = palette[name.charCodeAt(0) % palette.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}22`, border: `2px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.33, color, flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif",
    }}>{initials || '?'}</div>
  );
}

function PercentBar({ value, color = ACCENT, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(value, 100)}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          borderRadius: 99, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)'
        }} />
      </div>
      <span style={{ fontSize: 11, color: '#888', minWidth: 40, textAlign: 'right' }}>{value.toFixed(1)}%</span>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: `${color}12`, border: `1px solid ${color}30`,
      borderRadius: 10, padding: '10px 14px', textAlign: 'center', flex: 1, minWidth: 80,
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ─── Trend indicator ──────────────────────────────────────────────────────────
function TrendIcon({ current, total }: { current: number; total: number }) {
  if (total <= 0) return null;
  const pct = (current / total) * 100;
  if (pct <= 25) return <TrendingUp size={13} color="#10b981" />;
  if (pct >= 75) return <TrendingDown size={13} color="#ef4444" />;
  return <Minus size={13} color="#888" />;
}

// ─── Radar-style Skill Bar (CSS only) ─────────────────────────────────────────
function SkillBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: '#666', width: 110, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 99, transition: 'width 1s ease',
        }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, width: 60, textAlign: 'right' }}>{value}/{max}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE DETAIL PAGE — full-screen, slides over the list
// ═══════════════════════════════════════════════════════════════════════════════
function CourseDetailPage({
  summary, studentId, onBack,
}: {
  summary: CourseSummary;
  studentId: string;
  onBack: () => void;
}) {
  const { course, courseLeaderboard, myRank, myPercentage, top3 } = summary;
  const [tab, setTab] = useState<'analytics' | 'leaderboard' | 'exams'>('analytics');

  const myEntry = courseLeaderboard.entries.find(e => e.studentId === studentId);
  const totalStudents = courseLeaderboard.totalParticipants;
  const grade = myPercentage !== null ? getGrade(myPercentage) : null;
  const percentile = myRank !== null ? percentileText(myRank, totalStudents) : null;

  // Per-exam analytics for the student
  const examStats = useMemo(() => {
    const taken = courseLeaderboard.examBreakdowns.filter(e =>
      e.entries.some(x => x.studentId === studentId)
    );
    const notTaken = courseLeaderboard.examBreakdowns.filter(e =>
      !e.entries.some(x => x.studentId === studentId)
    );
    const top3Exams = taken.filter(e => {
      const me = e.entries.find(x => x.studentId === studentId);
      return me && me.rank <= 3;
    });
    const scores = taken.map(e => {
      const me = e.entries.find(x => x.studentId === studentId)!;
      return { exam: e, me, topEntry: e.entries.find(x => x.rank === 1) };
    });
    const avgScore = scores.length
      ? scores.reduce((a, s) => a + s.me.percentage, 0) / scores.length : 0;
    const bestScore = scores.length
      ? Math.max(...scores.map(s => s.me.percentage)) : 0;
    const worstScore = scores.length
      ? Math.min(...scores.map(s => s.me.percentage)) : 0;
    return { taken, notTaken, top3Exams, scores, avgScore, bestScore, worstScore };
  }, [courseLeaderboard, studentId]);

  const rc = rankColor(myRank);

  return (
    <div style={{
      position: 'relative', minHeight: '100vh',
      background: '#080810',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', 'Outfit', sans-serif",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,8,16,0.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '7px 12px', color: '#ccc', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {course.title}
          </h2>
          <p style={{ color: '#555', fontSize: 11, margin: 0 }}>{course.category}{course.class ? ` · Class ${course.class}` : ''}</p>
        </div>
        {grade && (
          <div style={{
            background: `${grade.color}18`, border: `1px solid ${grade.color}44`,
            borderRadius: 8, padding: '4px 10px',
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: grade.color }}>{grade.letter}</span>
          </div>
        )}
      </div>

      {/* ── Hero banner ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${rc}18 0%, #080810 60%)`,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '28px 20px 24px',
      }}>
        {/* Decorative ring */}
        <div style={{
          position: 'absolute', right: -40, top: -40,
          width: 200, height: 200, borderRadius: '50%',
          border: `1px solid ${rc}20`, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 140, height: 140, borderRadius: '50%',
          border: `1px solid ${rc}15`, pointerEvents: 'none',
        }} />

        {/* Rank + score display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${rc}18`, border: `2px solid ${rc}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {myRank === 1 ? <Trophy size={30} color={GOLD} /> :
             myRank === 2 ? <Medal size={30} color={SILVER} /> :
             myRank === 3 ? <Award size={30} color={BRONZE} /> :
             myRank !== null ? <Hash size={26} color={rc} /> :
             <BookOpen size={26} color="#555" />}
          </div>
          <div>
            {myRank !== null ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 42, fontWeight: 900, color: rc, lineHeight: 1 }}>#{myRank}</span>
                  <span style={{ fontSize: 14, color: '#555' }}>/ {totalStudents}</span>
                </div>
                <div style={{ display: 'flex', align: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {percentile && (
                    <span style={{
                      background: `${rc}18`, border: `1px solid ${rc}33`,
                      color: rc, fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99,
                    }}>{percentile}</span>
                  )}
                  {grade && (
                    <span style={{
                      background: `${grade.color}18`, border: `1px solid ${grade.color}33`,
                      color: grade.color, fontSize: 11, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99,
                    }}>Grade {grade.letter}</span>
                  )}
                </div>
              </>
            ) : (
              <div>
                <p style={{ color: '#555', fontSize: 14, margin: 0 }}>Not yet ranked</p>
                <p style={{ color: '#444', fontSize: 12, marginTop: 4 }}>Complete a 1-time exam to appear on the leaderboard</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatPill label="My Score" value={myPercentage !== null ? `${myPercentage.toFixed(1)}%` : '—'} color={rc} />
          <StatPill label="Exams Taken" value={`${examStats.taken.length}/${courseLeaderboard.totalExams}`} color="#10b981" />
          <StatPill label="Top 3 Wins" value={examStats.top3Exams.length} color={GOLD} />
          <StatPill label="Avg Score" value={examStats.avgScore > 0 ? `${examStats.avgScore.toFixed(0)}%` : '—'} color="#8b5cf6" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(0,0,0,0.4)', position: 'sticky', top: 57, zIndex: 9,
      }}>
        {([
          { key: 'analytics', label: '📈 Analytics' },
          { key: 'leaderboard', label: '🏆 Rankings' },
          { key: 'exams', label: '📋 Exams' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '12px 4px', border: 'none', background: 'none', cursor: 'pointer',
            color: tab === key ? '#fff' : '#555',
            borderBottom: `2px solid ${tab === key ? ACCENT : 'transparent'}`,
            fontWeight: tab === key ? 700 : 500, fontSize: 12,
            transition: 'all 0.2s',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, padding: '20px 16px 40px' }}>

        {/* ══ ANALYTICS TAB ══ */}
        {tab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 700, margin: '0 auto' }}>

            {/* Performance summary card */}
            {examStats.scores.length > 0 ? (
              <>
                {/* Score range */}
                <div style={{
                  background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px 18px',
                }}>
                  <p style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>SCORE RANGE</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '10px 0' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981' }}>{examStats.bestScore.toFixed(0)}%</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Best Score</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '10px 0', borderLeft: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: ACCENT }}>{examStats.avgScore.toFixed(0)}%</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Average</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 100, textAlign: 'center', padding: '10px 0' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{examStats.worstScore.toFixed(0)}%</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Lowest Score</div>
                    </div>
                  </div>
                </div>

                {/* Per-exam performance bars */}
                <div style={{
                  background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px 18px',
                }}>
                  <p style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>EXAM-BY-EXAM PERFORMANCE</p>
                  {examStats.scores.map(({ exam, me, topEntry }) => {
                    const myGrade = getGrade(me.percentage);
                    const gapToTop = topEntry ? topEntry.percentage - me.percentage : 0;
                    return (
                      <div key={exam.contentId} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: '#ccc', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {exam.examTitle}
                            </span>
                            <span style={{ fontSize: 10, color: '#555' }}>
                              Rank #{me.rank} of {exam.totalParticipants} · {me.totalMarks}/{me.maxMarks} marks
                            </span>
                          </div>
                          <div style={{ display: 'flex', align: 'center', gap: 6, marginLeft: 10, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: myGrade.color }}>{myGrade.letter}</span>
                            <TrendIcon current={me.rank} total={exam.totalParticipants} />
                          </div>
                        </div>
                        {/* My bar */}
                        <div style={{ marginBottom: 3 }}>
                          <PercentBar value={me.percentage} color={myGrade.color} height={8} />
                        </div>
                        {/* Top scorer bar (faint) */}
                        {topEntry && topEntry.studentId !== studentId && gapToTop > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(topEntry.percentage, 100)}%`, height: '100%', background: `${GOLD}44`, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#555', minWidth: 40, textAlign: 'right' }}>
                              Top: {topEntry.percentage.toFixed(0)}%
                            </span>
                          </div>
                        )}
                        {topEntry && topEntry.studentId !== studentId && gapToTop > 0.5 && (
                          <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>
                            ↑ {gapToTop.toFixed(1)}% gap to top scorer
                          </p>
                        )}
                        {topEntry && topEntry.studentId === studentId && (
                          <p style={{ fontSize: 10, color: '#10b981', marginTop: 3 }}>🏆 You're the top scorer!</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Subject skill breakdown */}
                <div style={{
                  background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px 18px',
                }}>
                  <p style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>MARKS BREAKDOWN</p>
                  {examStats.scores.map(({ exam, me }) => (
                    <SkillBar
                      key={exam.contentId}
                      label={exam.examTitle.length > 18 ? exam.examTitle.slice(0, 16) + '…' : exam.examTitle}
                      value={me.totalMarks}
                      max={me.maxMarks}
                      color={getGrade(me.percentage).color}
                    />
                  ))}
                </div>

                {/* Rank position visual */}
                {myRank !== null && totalStudents > 0 && (
                  <div style={{
                    background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, padding: '16px 18px',
                  }}>
                    <p style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>POSITION IN CLASS</p>
                    <div style={{ position: 'relative', height: 48, background: 'rgba(255,255,255,0.04)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                      {/* Full bar */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444' }}>
                          <span>#1</span><span>#{totalStudents}</span>
                        </div>
                      </div>
                      {/* My marker */}
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${Math.max(2, ((myRank - 1) / Math.max(totalStudents - 1, 1)) * 96 + 2)}%`,
                        width: 3, background: rc, borderRadius: 99,
                        transition: 'left 1s ease',
                        boxShadow: `0 0 8px ${rc}`,
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' }}>
                      <span>🥇 Best</span>
                      <span style={{ color: rc, fontWeight: 700 }}>You are #{myRank}</span>
                      <span>Last #{totalStudents}</span>
                    </div>
                  </div>
                )}

                {/* Unattempted exams */}
                {examStats.notTaken.length > 0 && (
                  <div style={{
                    background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 14, padding: '14px 18px',
                  }}>
                    <div style={{ display: 'flex', align: 'center', gap: 8, marginBottom: 10 }}>
                      <AlertCircle size={14} color="#ef4444" />
                      <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, margin: 0 }}>
                        {examStats.notTaken.length} Exam{examStats.notTaken.length > 1 ? 's' : ''} Not Attempted
                      </p>
                    </div>
                    {examStats.notTaken.map(e => (
                      <div key={e.contentId} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12,
                      }}>
                        <span style={{ color: '#888' }}>{e.examTitle}</span>
                        <span style={{ color: '#555' }}>Max {e.maxMarks} marks</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Activity size={40} color="#333" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: '#555', fontSize: 14 }}>No exam data yet</p>
                <p style={{ color: '#444', fontSize: 12, marginTop: 4 }}>Complete a 1-time exam to see your analytics</p>
              </div>
            )}
          </div>
        )}

        {/* ══ LEADERBOARD TAB ══ */}
        {tab === 'leaderboard' && (
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            {/* Top 3 podium */}
            {top3.length > 0 && (
              <div style={{
                background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: '20px 16px', marginBottom: 16,
              }}>
                <p style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>🥇 PODIUM</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  {[top3[1], top3[0], top3[2]].map((entry, idx) => {
                    if (!entry) return <div key={idx} style={{ flex: 1 }} />;
                    const podiumRank = idx === 1 ? 0 : idx === 0 ? 1 : 2;
                    const heights = [110, 150, 90];
                    const isMe = entry.studentId === studentId;
                    return (
                      <div key={entry.studentId} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        {isMe && <span style={{ fontSize: 9, color: ACCENT, fontWeight: 800, letterSpacing: '0.05em' }}>YOU</span>}
                        <Avatar name={entry.studentName} size={idx === 1 ? 52 : 38} />
                        <p style={{ fontSize: 10, color: '#ccc', fontWeight: 600, textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.studentName.split(' ')[0]}
                        </p>
                        <p style={{ fontSize: 10, color: '#888' }}>{entry.percentage.toFixed(1)}%</p>
                        <div style={{
                          width: '100%', height: heights[idx],
                          background: `${RANK_COLORS[podiumRank]}15`,
                          border: `1px solid ${RANK_COLORS[podiumRank]}35`,
                          borderRadius: '8px 8px 0 0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...(isMe ? { border: `2px solid ${ACCENT}`, background: `${ACCENT}20` } : {}),
                        }}>
                          <span style={{ fontSize: idx === 1 ? 28 : 20 }}>
                            {podiumRank === 0 ? '🥇' : podiumRank === 1 ? '🥈' : '🥉'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* My position highlight */}
            {myEntry && myRank !== null && myRank > 3 && (
              <div style={{
                background: `${ACCENT}12`, border: `1px solid ${ACCENT}30`,
                borderRadius: 12, padding: '12px 16px', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>#{myRank}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>Your Position</p>
                  <PercentBar value={myEntry.percentage} color={ACCENT} />
                </div>
                <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>{myEntry.percentage.toFixed(1)}%</span>
              </div>
            )}

            {/* Full rankings list */}
            {courseLeaderboard.entries.length > 0 ? (
              <div style={{
                background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', fontSize: 10, color: '#555', fontWeight: 700, gap: 8 }}>
                  <span style={{ width: 28 }}>#</span>
                  <span style={{ flex: 1 }}>STUDENT</span>
                  <span style={{ width: 60, textAlign: 'right' }}>EXAMS</span>
                  <span style={{ width: 60, textAlign: 'right' }}>SCORE</span>
                </div>
                {courseLeaderboard.entries.slice(0, 50).map((entry) => {
                  const isMe = entry.studentId === studentId;
                  const entryRc = rankColor(entry.rank);
                  return (
                    <div key={entry.studentId} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px',
                      background: isMe ? `${ACCENT}0f` : 'transparent',
                      borderLeft: isMe ? `3px solid ${ACCENT}` : '3px solid transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ width: 25, flexShrink: 0, textAlign: 'center' }}>
                        {entry.rank === 1 ? <span style={{ fontSize: 14 }}>🥇</span> :
                         entry.rank === 2 ? <span style={{ fontSize: 14 }}>🥈</span> :
                         entry.rank === 3 ? <span style={{ fontSize: 14 }}>🥉</span> :
                         <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>#{entry.rank}</span>}
                      </div>
                      <Avatar name={entry.studentName} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: isMe ? '#fff' : '#ccc', fontSize: 12, fontWeight: isMe ? 700 : 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.studentName} {isMe && <span style={{ color: ACCENT, fontSize: 10 }}>(You)</span>}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <div style={{ width: 60, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ width: `${entry.percentage}%`, height: '100%', background: entryRc, borderRadius: 99 }} />
                          </div>
                        </div>
                      </div>
                      <span style={{ width: 55, textAlign: 'right', fontSize: 11, color: '#555' }}>{entry.examsTaken} exams</span>
                      <span style={{ width: 55, textAlign: 'right', fontSize: 13, fontWeight: 700, color: isMe ? ACCENT : entryRc }}>{entry.percentage.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
                <Trophy size={32} color="#333" style={{ margin: '0 auto 10px' }} />
                <p>No rankings yet. Be the first to complete an exam!</p>
              </div>
            )}
          </div>
        )}

        {/* ══ EXAMS TAB ══ */}
        {tab === 'exams' && (
          <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {courseLeaderboard.examBreakdowns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
                <BarChart2 size={32} color="#333" style={{ margin: '0 auto 10px' }} />
                <p>No exams available yet.</p>
              </div>
            ) : courseLeaderboard.examBreakdowns.map((exam, idx) => {
              const me = exam.entries.find(e => e.studentId === studentId);
              const top = exam.entries.find(e => e.rank === 1);
              const attempted = !!me;
              const myGrade = me ? getGrade(me.percentage) : null;

              return (
                <div key={exam.contentId} style={{
                  background: '#111', border: `1px solid ${attempted ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.15)'}`,
                  borderRadius: 14, padding: '16px 18px', position: 'relative', overflow: 'hidden',
                }}>
                  {/* Serial number */}
                  <div style={{
                    position: 'absolute', top: 14, right: 16,
                    fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,0.04)',
                    lineHeight: 1, userSelect: 'none',
                  }}>{idx + 1}</div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 40 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {attempted
                          ? <CheckCircle2 size={13} color="#10b981" />
                          : <AlertCircle size={13} color="#ef4444" />}
                        <span style={{ fontSize: 10, color: attempted ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {attempted ? 'ATTEMPTED' : 'NOT ATTEMPTED'}
                        </span>
                      </div>
                      <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{exam.examTitle}</p>
                      <p style={{ fontSize: 11, color: '#555', margin: 0 }}>
                        {exam.totalParticipants} participants · Max {exam.maxMarks} marks
                      </p>
                    </div>
                    {me && myGrade && (
                      <div style={{
                        background: `${myGrade.color}15`, border: `1px solid ${myGrade.color}33`,
                        borderRadius: 8, padding: '6px 10px', textAlign: 'center', flexShrink: 0,
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: myGrade.color }}>{myGrade.letter}</div>
                        <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>GRADE</div>
                      </div>
                    )}
                  </div>

                  {me ? (
                    <>
                      {/* Stats grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: rankColor(me.rank) }}>#{me.rank}</div>
                          <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>MY RANK</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{me.totalMarks}<span style={{ fontSize: 11, color: '#555' }}>/{me.maxMarks}</span></div>
                          <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>MARKS</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#8b5cf6' }}>
                            {Math.floor(me.timeTakenSeconds / 60)}m
                          </div>
                          <div style={{ fontSize: 9, color: '#555', marginTop: 1 }}>TIME</div>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div style={{ marginBottom: 6 }}>
                        <PercentBar value={me.percentage} color={myGrade?.color ?? ACCENT} height={8} />
                      </div>

                      {/* Comparison to top */}
                      {top && top.studentId !== studentId && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginTop: 8 }}>
                          <span>🏆 Top: <strong style={{ color: GOLD }}>{top.totalMarks}/{top.maxMarks} ({top.percentage.toFixed(0)}%)</strong></span>
                          <span style={{ color: top.percentage > me.percentage ? '#f59e0b' : '#10b981' }}>
                            {top.percentage > me.percentage
                              ? `↑ ${(top.percentage - me.percentage).toFixed(1)}% to #1`
                              : '✓ Top scorer!'}
                          </span>
                        </div>
                      )}
                      {top && top.studentId === studentId && (
                        <p style={{ fontSize: 11, color: '#10b981', marginTop: 6 }}>🏆 You are the top scorer!</p>
                      )}
                    </>
                  ) : (
                    <div style={{
                      textAlign: 'center', padding: '12px 0',
                      fontSize: 12, color: '#555',
                    }}>
                      You haven't attempted this exam yet.
                      {top && <span style={{ color: '#666', display: 'block', marginTop: 4 }}>Top score: {top.totalMarks}/{top.maxMarks} ({top.percentage.toFixed(0)}%)</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE CARD — list view
// ═══════════════════════════════════════════════════════════════════════════════
function CourseCard({ summary, onOpen }: { summary: CourseSummary; onOpen: () => void }) {
  const { course, myRank, myPercentage, top3, courseLeaderboard } = summary;
  const rc = rankColor(myRank);
  const grade = myPercentage !== null ? getGrade(myPercentage) : null;

  return (
    <div
      onClick={onOpen}
      style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(.4,0,.2,1)',
        fontFamily: "'DM Sans', 'Outfit', sans-serif",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.4)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 30px rgba(99,102,241,0.15)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLDivElement).style.transform = 'none';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 120, background: '#0d0d18', overflow: 'hidden' }}>
        {(course.thumbnailUrl || course.thumbnail) ? (
          <img src={course.thumbnailUrl ?? course.thumbnail} alt={course.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, #0d0d18, ${ACCENT}18)` }}>
            <BookOpen size={36} color="#333" />
          </div>
        )}
        {course.class && (
          <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(99,102,241,0.88)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>
            Class {course.class}
          </span>
        )}
        {myRank !== null && myRank <= 3 && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: `${RANK_COLORS[myRank - 1]}22`, border: `1px solid ${RANK_COLORS[myRank - 1]}`, borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={11} color={RANK_COLORS[myRank - 1]} />
            <span style={{ color: RANK_COLORS[myRank - 1], fontSize: 10, fontWeight: 700 }}>
              {myRank === 1 ? '1st' : myRank === 2 ? '2nd' : '3rd'}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <h3 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {course.title}
        </h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 10, color: '#555', flexWrap: 'wrap' }}>
          <span>{course.category}</span>
          <span>·</span>
          <span>{courseLeaderboard.totalExams} exam{courseLeaderboard.totalExams !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{courseLeaderboard.totalParticipants} students</span>
        </div>

        {/* My rank badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          {myRank !== null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {myRank === 1 ? <Trophy size={14} color={GOLD} /> : myRank === 2 ? <Medal size={14} color={SILVER} /> : myRank === 3 ? <Award size={14} color={BRONZE} /> : <Hash size={13} color={rc} />}
              <span style={{ fontSize: 13, fontWeight: 800, color: rc }}>#{myRank}</span>
              <span style={{ fontSize: 10, color: '#555' }}>of {courseLeaderboard.totalParticipants}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#444' }}>Not ranked yet</span>
          )}
          {grade && (
            <span style={{ fontSize: 13, fontWeight: 800, color: grade.color }}>{grade.letter}</span>
          )}
        </div>

        {myPercentage !== null && <PercentBar value={myPercentage} color={rc} />}

        {/* Top 3 mini avatars */}
        {top3.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: '#444', fontWeight: 700 }}>TOP</span>
            {top3.slice(0, 3).map((e, i) => (
              <div key={e.studentId} style={{ position: 'relative' }}>
                <Avatar name={e.studentName} size={22} />
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 10, height: 10, borderRadius: '50%',
                  background: RANK_COLORS[i], fontSize: 6, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000',
                }}>{i + 1}</div>
              </div>
            ))}
            <span style={{ fontSize: 10, color: '#555', marginLeft: 2 }}>{top3[0].percentage.toFixed(0)}% best</span>
          </div>
        )}

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>View Analytics</span>
          <ChevronRight size={12} color={ACCENT} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const Progress = () => {
  const { user } = useDashboard();
  const [summaries, setSummaries] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<CourseSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!user?.uid) return;
    try {
      setLoading(true); setError(null);
      if (force) invalidateCache();
      const data = await leaderboardService.getStudentLeaderboardSummaries(user.uid);
      console.log('[Progress] Loaded summaries:', data.length, 'for uid:', user.uid);
      setSummaries(data);
    } catch (e: any) {
      console.error('[Progress] Load error:', e);
      setError(e.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => { setRefreshing(true); await load(true); };

  const classes = useMemo(() => [...new Set(summaries.map(s => s.course.class).filter(Boolean))].sort(), [summaries]);
  const categories = useMemo(() => [...new Set(summaries.map(s => s.course.category).filter(Boolean))].sort(), [summaries]);

  const filtered = useMemo(() => summaries.filter(s => {
    if (search && !s.course.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterClass && s.course.class !== filterClass) return false;
    if (filterCategory && s.course.category !== filterCategory) return false;
    return true;
  }), [summaries, search, filterClass, filterCategory]);

  const stats = useMemo(() => {
    const ranked = summaries.filter(s => s.myRank !== null);
    const top3Count = summaries.filter(s => s.myRank !== null && s.myRank <= 3).length;
    const avgPct = ranked.length ? ranked.reduce((a, s) => a + (s.myPercentage ?? 0), 0) / ranked.length : 0;
    const totalExams = summaries.reduce((a, s) => a + s.courseLeaderboard.totalExams, 0);
    const takenExams = summaries.reduce((a, s) => {
      return a + s.courseLeaderboard.examBreakdowns.filter(e =>
        e.entries.some(x => x.studentId === user?.uid)
      ).length;
    }, 0);
    return { totalCourses: summaries.length, ranked: ranked.length, top3Count, avgPct, totalExams, takenExams };
  }, [summaries, user?.uid]);

  // If detail page is open, show it full-screen
  if (selectedSummary) {
    return (
      <CourseDetailPage
        summary={selectedSummary}
        studentId={user!.uid}
        onBack={() => setSelectedSummary(null)}
      />
    );
  }

  if (loading) return <PageSkeleton variant="stats" />;

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: '#ef4444' }}>{error}</p>
      <button onClick={() => load()} style={{ background: ACCENT, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  return (
    <div style={{ color: '#fff', minHeight: '100vh', padding: '0 0 40px', fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>🏆 My Performance</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Track your rankings, scores and analytics across all courses</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#888', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12,
        }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      {summaries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { icon: BookOpen, label: 'Enrolled', value: stats.totalCourses, color: ACCENT },
            { icon: Trophy, label: 'Top 3 Wins', value: stats.top3Count, color: GOLD },
            { icon: CheckCircle2, label: 'Exams Done', value: `${stats.takenExams}/${stats.totalExams}`, color: '#10b981' },
            { icon: Target, label: 'Avg Score', value: `${stats.avgPct.toFixed(0)}%`, color: '#f59e0b' },
            { icon: Star, label: 'Ranked', value: stats.ranked, color: '#8b5cf6' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{
              background: '#111', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1, margin: 0 }}>{value}</p>
                <p style={{ fontSize: 10, color: '#555', margin: '2px 0 0' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
          <input placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} style={{
            width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '8px 10px 8px 30px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }} />
        </div>
        {classes.length > 0 && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: filterClass ? '#fff' : '#555', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
        )}
        {categories.length > 0 && (
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 12px', color: filterCategory ? '#fff' : '#555', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {(search || filterClass || filterCategory) && (
          <button onClick={() => { setSearch(''); setFilterClass(''); setFilterCategory(''); }}
            style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={12} />Clear
          </button>
        )}
      </div>

      {/* Course grid */}
      {summaries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <BookOpen size={40} color="#333" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: '#444' }}>No enrolled courses found</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Enroll in courses to see your performance here.</p>
          <button onClick={() => load(true)} style={{ marginTop: 14, background: ACCENT, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <Search size={36} color="#333" style={{ margin: '0 auto 10px' }} />
          <p>No courses match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filtered.map(summary => (
            <CourseCard key={summary.course.id} summary={summary} onOpen={() => setSelectedSummary(summary)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Progress;
