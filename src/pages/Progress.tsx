// src/pages/Progress.tsx
// Student Leaderboard — production grade
// Shows enrolled courses; clicking reveals Top-3, student's rank, per-exam breakdown.
// Only 1-time limited exams count.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trophy, Medal, Award, ChevronDown, ChevronUp, Search,
  BookOpen, Clock, Target, TrendingUp, RefreshCw, X,
  Star, BarChart2, User, Filter, Loader
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  leaderboardService,
  CourseLeaderboardData,
  CourseLeaderboardEntry,
  ExamLeaderboardData,
} from '../services/leaderboardService';
import { Enrollment } from '../services/courseEnrollmentService';
import { Course } from '../services/courseService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CourseSummary {
  enrollment: Enrollment;
  course: Course;
  courseLeaderboard: CourseLeaderboardData;
  myRank: number | null;
  myPercentage: number | null;
  top3: CourseLeaderboardEntry[];
}

// ─── Medal helpers ────────────────────────────────────────────────────────────
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_LABELS = ['1st', '2nd', '3rd'];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={16} color="#FFD700" />;
  if (rank === 2) return <Medal size={16} color="#C0C0C0" />;
  if (rank === 3) return <Award size={16} color="#CD7F32" />;
  return <span style={{ color: '#888', fontWeight: 700, fontSize: 13 }}>#{rank}</span>;
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}33`, border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.35, color, flexShrink: 0,
    }}>
      {initials || '?'}
    </div>
  );
}

function PercentBar({ value, color = '#6366f1' }: { value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 6, background: '#ffffff12', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 12, color: '#aaa', minWidth: 42, textAlign: 'right' }}>{value.toFixed(1)}%</span>
    </div>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({ summary, onOpen }: { summary: CourseSummary; onOpen: () => void }) {
  const { course, myRank, myPercentage, top3, courseLeaderboard } = summary;

  const rankColor = myRank === 1 ? '#FFD700' : myRank === 2 ? '#C0C0C0' : myRank === 3 ? '#CD7F32' : '#6366f1';

  return (
    <div
      onClick={onOpen}
      style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.4)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 130, background: '#1a1a2e', overflow: 'hidden' }}>
        {(course.thumbnailUrl || course.thumbnail) ? (
          <img
            src={course.thumbnailUrl ?? course.thumbnail}
            alt={course.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={40} color="#333" />
          </div>
        )}
        {course.class && (
          <span style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(99,102,241,0.85)', color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
          }}>
            Class {course.class}
          </span>
        )}
        {myRank !== null && myRank <= 3 && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: RANK_COLORS[myRank - 1] + '22',
            border: `1px solid ${RANK_COLORS[myRank - 1]}`,
            borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Trophy size={12} color={RANK_COLORS[myRank - 1]} />
            <span style={{ color: RANK_COLORS[myRank - 1], fontSize: 11, fontWeight: 700 }}>{RANK_LABELS[myRank - 1]}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px' }}>
        <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4, lineHeight: 1.4 }}>{course.title}</h3>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#666' }}>{course.category}</span>
          <span style={{ fontSize: 11, color: '#444' }}>·</span>
          <span style={{ fontSize: 11, color: '#555' }}>{courseLeaderboard.totalExams} exam{courseLeaderboard.totalExams !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, color: '#444' }}>·</span>
          <span style={{ fontSize: 11, color: '#555' }}>{courseLeaderboard.totalParticipants} students</span>
        </div>

        {/* Top 3 mini */}
        {top3.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: '#555', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>TOP 3</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {top3.map((entry, i) => (
                <div key={entry.studentId} style={{
                  flex: 1, background: '#ffffff08', borderRadius: 8, padding: '6px 8px',
                  border: `1px solid ${RANK_COLORS[i]}22`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                  <span style={{ fontSize: 9, color: RANK_COLORS[i], fontWeight: 700 }}>{RANK_LABELS[i]}</span>
                  <Avatar name={entry.studentName} size={28} />
                  <span style={{ fontSize: 9, color: '#ccc', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.studentName.split(' ')[0]}
                  </span>
                  <span style={{ fontSize: 9, color: '#888' }}>{entry.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My rank */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#ffffff06', borderRadius: 8, padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {myRank !== null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RankBadge rank={myRank} />
                <span style={{ fontSize: 12, color: rankColor, fontWeight: 700 }}>
                  Rank #{myRank}
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#aaa' }}>{myPercentage?.toFixed(1)}%</span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#555' }}>Not yet ranked — take an exam!</span>
          )}
        </div>

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>View Details →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function CourseDetailModal({
  summary, studentId, onClose,
}: {
  summary: CourseSummary;
  studentId: string;
  onClose: () => void;
}) {
  const { course, courseLeaderboard, myRank, myPercentage, top3 } = summary;
  const [tab, setTab] = useState<'overview' | 'exams'>('overview');

  const myEntry = courseLeaderboard.entries.find(e => e.studentId === studentId);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BookOpen size={18} color="#6366f1" />
          <div style={{ flex: 1 }}>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{course.title}</h2>
            <p style={{ color: '#555', fontSize: 11, marginTop: 1 }}>{course.category}{course.class ? ` · Class ${course.class}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { icon: Trophy, label: 'My Rank', value: myRank !== null ? `#${myRank}` : '—', color: myRank && myRank <= 3 ? RANK_COLORS[myRank - 1] : '#6366f1' },
            { icon: Target, label: 'My Score', value: myPercentage !== null ? `${myPercentage.toFixed(1)}%` : '—', color: '#10b981' },
            { icon: BarChart2, label: 'Total Exams', value: courseLeaderboard.totalExams, color: '#f59e0b' },
            { icon: User, label: 'Participants', value: courseLeaderboard.totalParticipants, color: '#8b5cf6' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{ flex: 1, padding: '12px 8px', textAlign: 'center', background: '#111' }}>
              <Icon size={14} color={color} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#555' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {(['overview', 'exams'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', border: 'none', background: 'none', cursor: 'pointer',
                color: tab === t ? '#6366f1' : '#555',
                borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                fontWeight: 600, fontSize: 12, textTransform: 'capitalize',
              }}
            >
              {t === 'overview' ? '🏆 Course Leaderboard' : '📊 Exam Breakdown'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {tab === 'overview' && (
            <div>
              {/* Top 3 podium */}
              {top3.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 12, letterSpacing: '0.05em' }}>🥇 TOP 3 STUDENTS</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    {/* Reorder: 2nd, 1st, 3rd for podium effect */}
                    {[top3[1], top3[0], top3[2]].map((entry, idx) => {
                      if (!entry) return <div key={idx} style={{ flex: 1 }} />;
                      const podiumRank = idx === 1 ? 0 : idx === 0 ? 1 : 2;
                      const heights = [100, 130, 85];
                      return (
                        <div key={entry.studentId} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <Avatar name={entry.studentName} size={idx === 1 ? 48 : 36} />
                          <p style={{ fontSize: 11, color: '#ccc', fontWeight: 600, textAlign: 'center', maxWidth: '100%' }}>
                            {entry.studentName.split(' ').slice(0, 2).join(' ')}
                          </p>
                          <p style={{ fontSize: 11, color: '#888' }}>{entry.percentage.toFixed(1)}%</p>
                          <div style={{
                            width: '100%', height: heights[idx],
                            background: `${RANK_COLORS[podiumRank]}18`,
                            border: `1px solid ${RANK_COLORS[podiumRank]}44`,
                            borderRadius: '8px 8px 0 0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 22 }}>
                              {podiumRank === 0 ? '🥇' : podiumRank === 1 ? '🥈' : '🥉'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* My position */}
              {myEntry && (
                <div style={{
                  background: '#6366f115', border: '1px solid #6366f133',
                  borderRadius: 12, padding: '14px 16px', marginBottom: 16,
                }}>
                  <p style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 8 }}>YOUR POSITION</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={myEntry.studentName} size={40} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{myEntry.studentName}</p>
                      <PercentBar value={myEntry.percentage} color="#6366f1" />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>#{myEntry.rank}</p>
                      <p style={{ fontSize: 10, color: '#555' }}>of {courseLeaderboard.totalParticipants}</p>
                    </div>
                  </div>
                </div>
              )}

              {courseLeaderboard.totalExams === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
                  <Trophy size={32} color="#333" style={{ margin: '0 auto 10px' }} />
                  <p>No leaderboard data yet.</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>Complete a 1-time exam to appear here.</p>
                </div>
              )}
            </div>
          )}

          {tab === 'exams' && (
            <ExamBreakdownTab
              breakdowns={courseLeaderboard.examBreakdowns}
              studentId={studentId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ExamBreakdownTab({
  breakdowns, studentId,
}: {
  breakdowns: ExamLeaderboardData[];
  studentId: string;
}) {
  if (!breakdowns.length) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
        <BarChart2 size={32} color="#333" style={{ margin: '0 auto 10px' }} />
        <p>No exam data available.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {breakdowns.map(exam => {
        const myEntry = exam.entries.find(e => e.studentId === studentId);
        const topEntry = exam.entries.find(e => e.rank === 1);
        const rankColor = myEntry
          ? (myEntry.rank === 1 ? '#FFD700' : myEntry.rank === 2 ? '#C0C0C0' : myEntry.rank === 3 ? '#CD7F32' : '#6366f1')
          : '#555';

        return (
          <div key={exam.contentId} style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{exam.examTitle}</p>
                <p style={{ fontSize: 11, color: '#555' }}>{exam.totalParticipants} participants · Max {exam.maxMarks} marks</p>
              </div>
              {myEntry ? (
                <div style={{ textAlign: 'right', marginLeft: 12 }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: rankColor }}>#{myEntry.rank}</p>
                  <p style={{ fontSize: 10, color: '#555' }}>my rank</p>
                </div>
              ) : (
                <span style={{ fontSize: 11, color: '#444', marginLeft: 12 }}>Not attempted</span>
              )}
            </div>

            {myEntry && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 2 }}>
                  <span>Your score: <strong style={{ color: '#ccc' }}>{myEntry.totalMarks}/{myEntry.maxMarks}</strong></span>
                  {topEntry && topEntry.studentId !== studentId && (
                    <span>Top score: <strong style={{ color: '#FFD700' }}>{topEntry.totalMarks}/{topEntry.maxMarks}</strong></span>
                  )}
                </div>
                <PercentBar value={myEntry.percentage} color={rankColor} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
      if (force) leaderboardService.invalidateCache?.();
      const data = await leaderboardService.getStudentLeaderboardSummaries(user.uid);
      setSummaries(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const classes = useMemo(() => {
    const s = new Set(summaries.map(s => s.course.class).filter(Boolean));
    return [...s].sort();
  }, [summaries]);

  const categories = useMemo(() => {
    const s = new Set(summaries.map(s => s.course.category).filter(Boolean));
    return [...s].sort();
  }, [summaries]);

  const filtered = useMemo(() => {
    return summaries.filter(s => {
      if (search && !s.course.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterClass && s.course.class !== filterClass) return false;
      if (filterCategory && s.course.category !== filterCategory) return false;
      return true;
    });
  }, [summaries, search, filterClass, filterCategory]);

  const stats = useMemo(() => {
    const ranked = summaries.filter(s => s.myRank !== null);
    const top3Count = summaries.filter(s => s.myRank !== null && s.myRank <= 3).length;
    const avgPct = ranked.length
      ? ranked.reduce((acc, s) => acc + (s.myPercentage ?? 0), 0) / ranked.length
      : 0;
    return { totalCourses: summaries.length, ranked: ranked.length, top3Count, avgPct };
  }, [summaries]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 12 }}>
      <Loader size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#555' }}>Loading your leaderboard...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <p style={{ color: '#ef4444' }}>{error}</p>
      <button onClick={() => load()} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ color: '#fff', minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🏆 My Leaderboard</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Track your performance across all enrolled courses</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff0a',
            border: '1px solid rgba(255,255,255,0.1)', color: '#aaa',
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12,
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {summaries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { icon: BookOpen, label: 'Enrolled Courses', value: stats.totalCourses, color: '#6366f1' },
            { icon: TrendingUp, label: 'Courses Ranked', value: stats.ranked, color: '#10b981' },
            { icon: Trophy, label: 'Top 3 Finishes', value: stats.top3Count, color: '#FFD700' },
            { icon: Target, label: 'Avg. Score', value: `${stats.avgPct.toFixed(1)}%`, color: '#f59e0b' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} style={{
              background: '#111', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={17} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '8px 10px 8px 32px', color: '#fff', fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
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
            style={{ background: 'none', border: '1px solid #ef444433', color: '#ef4444', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>
            <X size={12} style={{ marginRight: 4 }} />Clear
          </button>
        )}
      </div>

      {/* Course Grid */}
      {summaries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <BookOpen size={40} color="#333" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#444' }}>No enrolled courses</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Enroll in courses to see your leaderboard rankings.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <Search size={40} color="#333" style={{ margin: '0 auto 12px' }} />
          <p>No courses match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(summary => (
            <CourseCard
              key={summary.course.id}
              summary={summary}
              onOpen={() => setSelectedSummary(summary)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSummary && (
        <CourseDetailModal
          summary={selectedSummary}
          studentId={user!.uid}
          onClose={() => setSelectedSummary(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Progress;
