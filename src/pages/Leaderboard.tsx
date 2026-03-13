// src/pages/Leaderboard.tsx
// Admin / Teacher / Manager Leaderboard — production grade
// - Admin/Manager/Student-Manager: all courses, full student list (name + surname + userId)
// - Teacher: only courses where teacher has 'exams' permission
// - Only 1-time limited exams count.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Trophy, Medal, Award, Search, RefreshCw, Download,
  ChevronDown, ChevronUp, Filter, X, BookOpen, User,
  BarChart2, Target, Users, Loader, AlertCircle,
  Star, TrendingUp, Eye, EyeOff, ChevronRight,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import {
  leaderboardService,
  CourseLeaderboardData,
  CourseLeaderboardEntry,
  ExamLeaderboardData,
  invalidateCache,
} from '../services/leaderboardService';
import { Course } from '../services/courseService';

// ─── Constants ────────────────────────────────────────────────────────────────
const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const ADMIN_ROLES = ['admin', 'manager', 'student_manager'];
const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function RankCell({ rank }: { rank: number }) {
  if (rank > 3) return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffffff08', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#666' }}>
      {rank}
    </div>
  );
  const icons = [
    <Trophy key={1} size={16} color="#FFD700" />,
    <Medal key={2} size={16} color="#C0C0C0" />,
    <Award key={3} size={16} color="#CD7F32" />,
  ];
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${RANK_COLORS[rank - 1]}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${RANK_COLORS[rank - 1]}33` }}>
      {icons[rank - 1]}
    </div>
  );
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: `${color}22`,
      border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: size * 0.32, color, flexShrink: 0,
    }}>
      {initials || '?'}
    </div>
  );
}

function PercentBar({ value, color = '#6366f1', width = 80 }: { value: number; color?: string; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width, height: 5, background: '#ffffff10', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color: '#aaa', minWidth: 40 }}>{value.toFixed(1)}%</span>
    </div>
  );
}

// CSV export
function exportCSV(course: Course, leaderboard: CourseLeaderboardData) {
  const headers = ['Rank', 'Name', 'Surname', 'Student ID', 'Exams Taken', 'Total Marks', 'Max Marks', 'Percentage'];
  const rows = leaderboard.entries.map(e => [
    e.rank, `"${e.studentName}"`, `"${e.surname ?? ''}"`, `"${e.userId ?? ''}"`,
    e.examsTaken, e.totalMarks, e.totalMaxMarks, e.percentage.toFixed(2),
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leaderboard_${course.title.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Exam Breakdown Row ───────────────────────────────────────────────────────
function ExamBreakdownPanel({ breakdowns, studentId }: { breakdowns: ExamLeaderboardData[]; studentId: string }) {
  const studentExams = breakdowns.map(ex => ({
    ...ex,
    myEntry: ex.entries.find(e => e.studentId === studentId),
    top1: ex.entries.find(e => e.rank === 1),
  }));

  return (
    <div style={{ padding: '12px 16px', background: '#0a0a0a', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>EXAM BREAKDOWN</p>
      {studentExams.map(ex => (
        <div key={ex.contentId} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
          background: '#ffffff05', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, color: '#ccc', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.examTitle}</p>
          </div>
          {ex.myEntry ? (
            <>
              <div style={{ textAlign: 'center', minWidth: 50 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: ex.myEntry.rank <= 3 ? RANK_COLORS[ex.myEntry.rank - 1] : '#888' }}>#{ex.myEntry.rank}</p>
                <p style={{ fontSize: 9, color: '#555' }}>rank</p>
              </div>
              <div style={{ textAlign: 'center', minWidth: 60 }}>
                <p style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{ex.myEntry.totalMarks}/{ex.myEntry.maxMarks}</p>
                <p style={{ fontSize: 9, color: '#555' }}>marks</p>
              </div>
              <PercentBar value={ex.myEntry.percentage} width={70} />
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#444' }}>Not attempted</span>
          )}
          {ex.top1 && ex.top1.studentId !== studentId && (
            <div style={{ textAlign: 'right', minWidth: 70 }}>
              <p style={{ fontSize: 10, color: '#555' }}>Best: <span style={{ color: '#FFD700' }}>{ex.top1.totalMarks}/{ex.top1.maxMarks}</span></p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Student Table Row ────────────────────────────────────────────────────────
function StudentRow({
  entry, breakdowns, showExpanded, onToggle, isStudent,
}: {
  entry: CourseLeaderboardEntry;
  breakdowns: ExamLeaderboardData[];
  showExpanded: boolean;
  onToggle: () => void;
  isStudent: boolean;
}) {
  const rankColor = entry.rank <= 3 ? RANK_COLORS[entry.rank - 1] : '#6366f1';

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#ffffff06')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <td style={{ padding: '10px 12px' }}>
          <RankCell rank={entry.rank} />
        </td>
        <td style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={entry.studentName} />
            <div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{entry.studentName}</p>
              {!isStudent && entry.surname && (
                <p style={{ color: '#555', fontSize: 11 }}>{entry.surname}</p>
              )}
            </div>
          </div>
        </td>
        {!isStudent && (
          <td style={{ padding: '10px 12px', color: '#666', fontSize: 12 }}>
            {entry.userId ?? '—'}
          </td>
        )}
        <td style={{ padding: '10px 12px' }}>
          <PercentBar value={entry.percentage} color={rankColor} width={90} />
        </td>
        <td style={{ padding: '10px 12px', color: '#ccc', fontSize: 12 }}>
          {entry.totalMarks} / {entry.totalMaxMarks}
        </td>
        <td style={{ padding: '10px 12px', color: '#555', fontSize: 12, textAlign: 'center' }}>
          {entry.examsTaken}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
          {showExpanded ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
        </td>
      </tr>
      {showExpanded && (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <td colSpan={isStudent ? 6 : 7} style={{ padding: 0 }}>
            <ExamBreakdownPanel breakdowns={breakdowns} studentId={entry.studentId} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Course Leaderboard Panel ─────────────────────────────────────────────────
function CourseLeaderboardPanel({
  course, leaderboard, isStudentRole, onExport,
}: {
  course: Course;
  leaderboard: CourseLeaderboardData;
  isStudentRole: boolean;
  onExport: () => void;
}) {
  const [search, setSearch] = useState('');
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [enriched, setEnriched] = useState<CourseLeaderboardEntry[]>(leaderboard.entries);

  useEffect(() => {
    if (!isStudentRole) {
      leaderboardService.enrichEntriesWithStudentInfo(course.id, leaderboard.entries)
        .then(setEnriched);
    } else {
      setEnriched(leaderboard.entries);
    }
  }, [course.id, leaderboard.entries, isStudentRole]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return enriched;
    return enriched.filter(e =>
      e.studentName.toLowerCase().includes(q) ||
      (e.userId ?? '').toLowerCase().includes(q) ||
      (e.surname ?? '').toLowerCase().includes(q)
    );
  }, [enriched, search]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const toggleExpand = (sid: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const top3 = leaderboard.entries.filter(e => e.rank <= 3).slice(0, 3);

  return (
    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
      {/* Course Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, overflow: 'hidden',
          background: '#1a1a2e', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {(course.thumbnailUrl || course.thumbnail)
            ? <img src={course.thumbnailUrl ?? course.thumbnail} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <BookOpen size={20} color="#333" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0 }}>{course.title}</h3>
          <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
            {course.class && <span style={{ fontSize: 10, color: '#6366f1', background: '#6366f115', padding: '1px 6px', borderRadius: 4 }}>Class {course.class}</span>}
            {course.category && <span style={{ fontSize: 10, color: '#555' }}>{course.category}</span>}
            <span style={{ fontSize: 10, color: '#555' }}>{leaderboard.totalExams} exams</span>
            <span style={{ fontSize: 10, color: '#555' }}>{leaderboard.totalParticipants} students</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isStudentRole && (
            <button onClick={onExport} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#ffffff0a', border: '1px solid rgba(255,255,255,0.1)',
              color: '#aaa', borderRadius: 7, padding: '6px 11px', cursor: 'pointer', fontSize: 11,
            }}>
              <Download size={12} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Top 3 highlight */}
      {top3.length > 0 && (
        <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 10 }}>
          {top3.map((entry, i) => (
            <div key={entry.studentId} style={{
              flex: 1, background: `${RANK_COLORS[i]}08`,
              border: `1px solid ${RANK_COLORS[i]}22`,
              borderRadius: 10, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ fontSize: 18 }}>{['🥇', '🥈', '🥉'][i]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.studentName.split(' ')[0]}
                </p>
                <p style={{ fontSize: 10, color: RANK_COLORS[i] }}>{entry.percentage.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
          <input
            placeholder="Search by name, surname, or student ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 7, padding: '7px 10px 7px 30px', color: '#fff', fontSize: 12,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table */}
      {leaderboard.totalParticipants === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#555' }}>
          <Trophy size={28} color="#333" style={{ margin: '0 auto 8px' }} />
          <p>No leaderboard data yet.</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Results appear after 1-time exam results are published.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Rank', 'Student', ...(isStudentRole ? [] : ['Student ID']), 'Score', 'Marks', 'Exams', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: h === '' || h === 'Exams' ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(entry => (
                <StudentRow
                  key={entry.studentId}
                  entry={entry}
                  breakdowns={leaderboard.examBreakdowns}
                  showExpanded={expandedStudents.has(entry.studentId)}
                  onToggle={() => toggleExpand(entry.studentId)}
                  isStudent={isStudentRole}
                />
              ))}
            </tbody>
          </table>

          {/* Load more */}
          {filtered.length > paginated.length && (
            <div style={{ padding: '12px', textAlign: 'center' }}>
              <button
                onClick={() => setPage(p => p + 1)}
                style={{ background: '#ffffff0a', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', borderRadius: 7, padding: '7px 18px', cursor: 'pointer', fontSize: 12 }}>
                Load more ({filtered.length - paginated.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const Leaderboard = () => {
  const { user } = useDashboard();
  const [courses, setCourses] = useState<{ course: Course; leaderboard: CourseLeaderboardData }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterHasData, setFilterHasData] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const isStudentRole = !ADMIN_ROLES.includes(user?.role ?? '') && user?.role !== 'teacher';

  const load = useCallback(async (force = false) => {
    if (!user?.uid || !user?.role) return;
    try {
      setLoading(true); setError(null);
      if (force) invalidateCache();
      const data = await leaderboardService.getAccessibleCourseLeaderboards(user.role, user.uid);
      setCourses(data);
      if (data.length > 0 && !expandedCourse) setExpandedCourse(data[0].course.id);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.uid, user?.role]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(true);
  };

  const classes = useMemo(() => {
    const s = new Set(courses.map(c => c.course.class).filter(Boolean));
    return [...s].sort();
  }, [courses]);

  const categories = useMemo(() => {
    const s = new Set(courses.map(c => c.course.category).filter(Boolean));
    return [...s].sort();
  }, [courses]);

  const filtered = useMemo(() => {
    return courses.filter(({ course, leaderboard }) => {
      if (search && !course.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterClass && course.class !== filterClass) return false;
      if (filterCategory && course.category !== filterCategory) return false;
      if (filterHasData && leaderboard.totalParticipants === 0) return false;
      return true;
    });
  }, [courses, search, filterClass, filterCategory, filterHasData]);

  const overallStats = useMemo(() => {
    const totalStudents = new Set(courses.flatMap(c => c.leaderboard.entries.map(e => e.studentId))).size;
    const totalExams = courses.reduce((acc, c) => acc + c.leaderboard.totalExams, 0);
    const activeCourses = courses.filter(c => c.leaderboard.totalParticipants > 0).length;
    return { totalStudents, totalExams, activeCourses, totalCourses: courses.length };
  }, [courses]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return '';
    if (user.role === 'admin') return 'Admin';
    if (user.role === 'manager') return 'Manager';
    if (user.role === 'student_manager') return 'Student Manager';
    if (user.role === 'teacher') return 'Teacher';
    return user.role;
  }, [user?.role]);


  if (loading) return <PageSkeleton variant="list" />;

  if (error) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
      <AlertCircle size={28} color="#ef4444" />
      <p style={{ color: '#ef4444' }}>{error}</p>
      <button onClick={() => load()} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ color: '#fff', minHeight: '100vh', padding: '0 0 40px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🏆 Course Leaderboards</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>
            {roleLabel} View · {courses.length} course{courses.length !== 1 ? 's' : ''} accessible
          </p>
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
      {courses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { icon: BookOpen, label: 'Total Courses', value: overallStats.totalCourses, color: '#6366f1' },
            { icon: BarChart2, label: 'Active Courses', value: overallStats.activeCourses, color: '#10b981' },
            { icon: Users, label: 'Total Students', value: overallStats.totalStudents, color: '#f59e0b' },
            { icon: Target, label: 'Total Exams', value: overallStats.totalExams, color: '#8b5cf6' },
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <button
          onClick={() => setFilterHasData(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, background: filterHasData ? '#6366f118' : '#ffffff0a',
            border: `1px solid ${filterHasData ? '#6366f133' : 'rgba(255,255,255,0.07)'}`,
            color: filterHasData ? '#6366f1' : '#555', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
          }}
        >
          {filterHasData ? <Eye size={12} /> : <EyeOff size={12} />}
          Has Data
        </button>
        {(search || filterClass || filterCategory || filterHasData) && (
          <button onClick={() => { setSearch(''); setFilterClass(''); setFilterCategory(''); setFilterHasData(false); }}
            style={{ background: 'none', border: '1px solid #ef444433', color: '#ef4444', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12 }}>
            <X size={12} /> Clear
          </button>
        )}
        <span style={{ fontSize: 11, color: '#555', marginLeft: 4 }}>{filtered.length} course{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Course Leaderboard Accordions */}
      {courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
          <BookOpen size={40} color="#333" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: '#444' }}>No courses found</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>
            {user?.role === 'teacher'
              ? 'You have no courses with exam access assigned.'
              : 'No courses available.'}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
          <Search size={32} color="#333" style={{ margin: '0 auto 10px' }} />
          <p>No courses match your filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(({ course, leaderboard }) => {
            const isExpanded = expandedCourse === course.id;
            return (
              <div key={course.id}>
                {/* Accordion Header (when collapsed) */}
                {!isExpanded ? (
                  <div
                    onClick={() => setExpandedCourse(course.id)}
                    style={{
                      background: '#111', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, padding: '14px 18px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(course.thumbnailUrl || course.thumbnail)
                        ? <img src={course.thumbnailUrl ?? course.thumbnail} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <BookOpen size={16} color="#333" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        {course.class && <span style={{ fontSize: 10, color: '#6366f1' }}>Class {course.class}</span>}
                        <span style={{ fontSize: 10, color: '#555' }}>{leaderboard.totalExams} exams · {leaderboard.totalParticipants} students</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {leaderboard.entries.slice(0, 3).map((e, i) => (
                        <span key={e.studentId} style={{ fontSize: 10, color: RANK_COLORS[i], fontWeight: 700 }}>
                          {['🥇', '🥈', '🥉'][i]} {e.studentName.split(' ')[0]}
                        </span>
                      ))}
                      <ChevronRight size={14} color="#555" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => setExpandedCourse(null)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        color: '#555', fontSize: 12, padding: '6px 10px', textAlign: 'right',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                      }}
                    >
                      <ChevronUp size={13} /> Collapse
                    </button>
                    <CourseLeaderboardPanel
                      course={course}
                      leaderboard={leaderboard}
                      isStudentRole={isStudentRole}
                      onExport={() => exportCSV(course, leaderboard)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
