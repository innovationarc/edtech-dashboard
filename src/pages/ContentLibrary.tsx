// src/pages/ContentLibrary.tsx
// Content Library — Card-based drill-down: Courses → Folders → Content
// Clicking content navigates to the correct viewer page inside DashboardLayout

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play, FileText, Zap, ClipboardList, BookOpen,
  Search, Clock, ChevronRight, ArrowLeft,
  Loader2, AlertCircle, GraduationCap, X,
  Hash, Layers, BarChart3, CalendarDays,
  Sparkles, CheckCircle2, Home,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';
import {
  contentLibraryService,
  LibraryCourse,
  ContentNode,
  LibraryContent,
} from '../services/contentLibraryService';

// ==================== TYPES ====================
type ContentType = 'lesson' | 'note' | 'trick' | 'exam';

interface BreadcrumbEntry {
  label: string;
  nodes: ContentNode[];
}

// ==================== ROUTE HELPERS ====================
// Routes MUST match paths inside DashboardLayout (no leading /library/)
// Matching what we register: content-library/lesson/:courseId/:contentId etc.
function getContentRoute(content: LibraryContent, courseId: string): string {
  switch (content.type) {
    case 'lesson':
    case 'trick':
      return `/content-library/lesson/${courseId}/${content.id}`;
    case 'note':
      return `/content-library/note/${courseId}/${content.id}`;
    case 'exam':
      return `/content-library/exam/${courseId}/${content.id}`;
    default:
      return `/content-library/lesson/${courseId}/${content.id}`;
  }
}

// ==================== COUNTING ====================
function countContents(nodes: ContentNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === 'content') n++;
    if (node.children?.length) n += countContents(node.children);
  }
  return n;
}
function countFolders(nodes: ContentNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === 'folder') {
      n++;
      if (node.children?.length) n += countFolders(node.children);
    }
  }
  return n;
}

// ==================== CONTENT CONFIG ====================
type ContentConfig = {
  label: string; icon: React.ReactNode; iconLg: React.ReactNode;
  accent: string; border: string; badge: string; bar: string;
};
function getContentConfig(type: ContentType): ContentConfig {
  switch (type) {
    case 'lesson': return {
      label: 'Lesson', icon: <Play size={13} strokeWidth={2.5} />, iconLg: <Play size={17} strokeWidth={2.5} />,
      accent: 'bg-violet-500/20 text-violet-300', border: 'border-violet-500/25 hover:border-violet-400/50',
      badge: 'bg-violet-500/15 text-violet-300 border border-violet-400/25', bar: 'bg-violet-500',
    };
    case 'trick': return {
      label: 'Trick', icon: <Zap size={13} strokeWidth={2.5} />, iconLg: <Zap size={17} strokeWidth={2.5} />,
      accent: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500/25 hover:border-amber-400/50',
      badge: 'bg-amber-500/15 text-amber-300 border border-amber-400/25', bar: 'bg-amber-400',
    };
    case 'note': return {
      label: 'Note', icon: <FileText size={13} strokeWidth={2.5} />, iconLg: <FileText size={17} strokeWidth={2.5} />,
      accent: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/25 hover:border-emerald-400/50',
      badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25', bar: 'bg-emerald-400',
    };
    case 'exam': return {
      label: 'Exam', icon: <ClipboardList size={13} strokeWidth={2.5} />, iconLg: <ClipboardList size={17} strokeWidth={2.5} />,
      accent: 'bg-rose-500/20 text-rose-300', border: 'border-rose-500/25 hover:border-rose-400/50',
      badge: 'bg-rose-500/15 text-rose-300 border border-rose-400/25', bar: 'bg-rose-400',
    };
    default: return {
      label: 'Content', icon: <BookOpen size={13} />, iconLg: <BookOpen size={17} />,
      accent: 'bg-slate-500/20 text-slate-300', border: 'border-slate-500/25 hover:border-slate-400/50',
      badge: 'bg-slate-500/15 text-slate-300 border border-slate-400/25', bar: 'bg-slate-400',
    };
  }
}

// ==================== FOLDER PALETTE ====================
const FOLDER_PAL = [
  { grad: 'from-indigo-600/20 to-violet-700/5', iconBg: 'bg-indigo-500/25 text-indigo-300', glow: 'rgba(99,102,241,0.15)' },
  { grad: 'from-sky-600/20 to-cyan-700/5',      iconBg: 'bg-sky-500/25 text-sky-300',       glow: 'rgba(14,165,233,0.15)' },
  { grad: 'from-emerald-600/20 to-teal-700/5',  iconBg: 'bg-emerald-500/25 text-emerald-300',glow: 'rgba(16,185,129,0.15)' },
  { grad: 'from-amber-600/20 to-orange-700/5',  iconBg: 'bg-amber-500/25 text-amber-300',   glow: 'rgba(245,158,11,0.15)' },
  { grad: 'from-rose-600/20 to-pink-700/5',     iconBg: 'bg-rose-500/25 text-rose-300',     glow: 'rgba(244,63,94,0.15)'  },
  { grad: 'from-violet-600/20 to-purple-700/5', iconBg: 'bg-violet-500/25 text-violet-300', glow: 'rgba(139,92,246,0.15)' },
];

// ==================== SMALL COMPONENTS ====================

const Pip: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 leading-none">{icon}{label}</span>
);

const SectionHead: React.FC<{ icon: React.ReactNode; label: string; count: number }> = ({ icon, label, count }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-slate-500">{icon}</span>
    <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
    <span className="text-[11px] text-slate-700">({count})</span>
    <div className="flex-1 h-px bg-white/5 ml-1" />
  </div>
);

const EmptyMsg: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">{icon}</div>
    <h3 className="text-[15px] font-medium text-slate-400 mb-1">{title}</h3>
    <p className="text-sm text-slate-600 max-w-xs leading-relaxed">{sub}</p>
  </div>
);

// ── Search box ──
const SearchBox: React.FC<{
  value: string; onChange: (v: string) => void; placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <div className="relative max-w-sm">
    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full pl-9 pr-9 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200
                 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-white/7 transition-all"
    />
    {value && (
      <button onClick={() => onChange('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
        <X size={14} />
      </button>
    )}
  </div>
);

// ── Breadcrumb ──
const Breadcrumb: React.FC<{ trail: BreadcrumbEntry[]; onNav: (i: number) => void }> = ({ trail, onNav }) => (
  <nav className="flex items-center gap-1 flex-wrap min-w-0">
    {trail.map((entry, i) => {
      const isLast = i === trail.length - 1;
      return (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />}
          {isLast
            ? <span className="text-sm font-semibold text-white truncate max-w-[180px]">{entry.label}</span>
            : <button onClick={() => onNav(i)}
                className="text-sm text-slate-500 hover:text-indigo-300 transition-colors truncate max-w-[140px]">
                {entry.label}
              </button>
          }
        </React.Fragment>
      );
    })}
  </nav>
);

// ── Course Card ──
const CourseCard: React.FC<{ course: LibraryCourse; onClick: () => void }> = ({ course, onClick }) => {
  const total  = countContents(course.contentStructure);
  const folders = countFolders(course.contentStructure);
  const pct    = Math.min(100, Math.round(course.progress));
  const thumb  = course.thumbnailUrl || course.thumbnail;
  return (
    <button onClick={onClick}
      className="group relative w-full text-left rounded-2xl overflow-hidden border border-white/8
                 hover:border-white/20 bg-[#131620] hover:bg-[#161924] transition-all duration-300
                 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      {/* Thumbnail */}
      <div className="relative h-44 bg-gradient-to-br from-slate-800 to-[#0d0f17] overflow-hidden">
        {thumb
          ? <img src={thumb} alt={course.title}
              className="w-full h-full object-cover opacity-75 group-hover:opacity-90 group-hover:scale-[1.04] transition-all duration-500" />
          : <div className="w-full h-full flex items-center justify-center">
              <GraduationCap size={52} className="text-slate-700" />
            </div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-[#131620] via-[#131620]/20 to-transparent" />
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
            style={{ width: `${pct}%` }} />
        </div>
        {pct > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full
                          bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-medium text-white">
            {pct === 100
              ? <><CheckCircle2 size={11} className="text-emerald-400" />Done</>
              : <><BarChart3 size={11} className="text-indigo-400" />{pct}%</>
            }
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-white text-[15px] leading-snug line-clamp-2 group-hover:text-indigo-100 transition-colors">
          {course.title}
        </h3>
        {course.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {course.subjects.slice(0, 3).map(s => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-white/6 text-slate-400 border border-white/8">{s}</span>
            ))}
            {course.subjects.length > 3 && (
              <span className="text-[11px] text-slate-600 px-1">+{course.subjects.length - 3} more</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 pt-1 border-t border-white/6">
          <Pip icon={<Layers size={11} />}    label={`${folders} folder${folders !== 1 ? 's' : ''}`} />
          <Pip icon={<BookOpen size={11} />}  label={`${total} items`} />
          {course.validity && (
            <Pip icon={<CalendarDays size={11} />}
              label={`Until ${new Date(course.validity).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`} />
          )}
          <span className="ml-auto text-slate-600 group-hover:text-slate-300 transition-colors">
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </button>
  );
};

// ── Folder Card ──
const FolderCard: React.FC<{ node: ContentNode; index: number; onClick: () => void }> = ({ node, index, onClick }) => {
  const items  = countContents(node.children);
  const subs   = node.children.filter(c => c.type === 'folder').length;
  const pal    = FOLDER_PAL[index % FOLDER_PAL.length];
  return (
    <button onClick={onClick}
      className={`group relative w-full text-left rounded-2xl overflow-hidden border border-white/8
                  hover:border-white/22 bg-gradient-to-br ${pal.grad} transition-all duration-300
                  hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1 p-5
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}>
      <div className="absolute -top-5 -right-5 w-28 h-28 rounded-full blur-3xl opacity-70 pointer-events-none"
        style={{ background: pal.glow }} />
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${pal.iconBg}`}>
        <Layers size={20} strokeWidth={1.8} />
      </div>
      <h4 className="font-semibold text-[15px] text-white leading-snug mb-2.5 line-clamp-2 group-hover:text-white/90 transition-colors pr-7">
        {node.name}
      </h4>
      <div className="flex items-center gap-3 flex-wrap">
        {subs > 0 && <Pip icon={<Layers size={11} />} label={`${subs} sub-folder${subs !== 1 ? 's' : ''}`} />}
        <Pip icon={<BookOpen size={11} />} label={`${items} item${items !== 1 ? 's' : ''}`} />
      </div>
      <div className="absolute top-4 right-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all duration-200">
        <ChevronRight size={18} />
      </div>
    </button>
  );
};

// ── Content Item Card ──
const ContentCard: React.FC<{ node: ContentNode; onClick: () => void }> = ({ node, onClick }) => {
  const content = node.contentData;
  const type    = (content?.type ?? 'lesson') as ContentType;
  const cfg     = getContentConfig(type);

  if (!content) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/6 text-slate-500 text-sm italic">
        <BookOpen size={15} /><span>{node.name || 'Unavailable content'}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border bg-[#131620] hover:bg-[#16192a]
                  transition-all duration-200 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                  ${cfg.border} overflow-hidden cursor-pointer`}
    >
      {/* Accent line */}
      <div className={`h-[2px] w-full ${cfg.bar} opacity-50`} />
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${cfg.accent}`}>
          {cfg.iconLg}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <p className="text-[14px] font-medium text-slate-100 group-hover:text-white leading-snug line-clamp-1 transition-colors flex-1">
              {content.title}
            </p>
            <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {content.subject && (
              <Pip icon={<Hash size={10} />} label={content.subject} />
            )}
            {content.durationFormatted && (
              <Pip icon={<Clock size={10} />} label={content.durationFormatted} />
            )}
            {type === 'exam' && content.totalQuestions && (
              <Pip icon={<ClipboardList size={10} />} label={`${content.totalQuestions} Qs · ${content.totalMarks ?? ''} marks`} />
            )}
          </div>
        </div>
        {/* Arrow */}
        <ChevronRight size={16}
          className="flex-shrink-0 text-slate-600 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
    </button>
  );
};

// ==================== MAIN PAGE ====================
const ContentLibrary: React.FC = () => {
  const { user }  = useDashboard();
  const navigate  = useNavigate();

  const [courses, setCourses]   = useState<LibraryCourse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Drill-down state
  const [selectedCourse, setSelectedCourse]   = useState<LibraryCourse | null>(null);
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<BreadcrumbEntry[]>([]);

  // Search
  const [courseSearch,  setCourseSearch]  = useState('');
  const [contentSearch, setContentSearch] = useState('');

  // ── Load ──
  useEffect(() => { if (user?.uid) loadLibrary(); }, [user?.uid]);

  const loadLibrary = async () => {
    try {
      setLoading(true); setError('');
      const data = await contentLibraryService.getStudentLibrary(user!.uid);
      setCourses(data);
    } catch (err: any) {
      setError('Failed to load your content library. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ──
  const openCourse = useCallback((course: LibraryCourse) => {
    setSelectedCourse(course);
    setBreadcrumbTrail([{ label: course.title, nodes: course.contentStructure }]);
    setContentSearch('');
  }, []);

  const openFolder = useCallback((node: ContentNode) => {
    setBreadcrumbTrail(prev => [...prev, { label: node.name, nodes: node.children }]);
    setContentSearch('');
  }, []);

  const navToBreadcrumb = useCallback((index: number) => {
    setBreadcrumbTrail(prev => prev.slice(0, index + 1));
    setContentSearch('');
  }, []);

  const goBackToCourses = useCallback(() => {
    setSelectedCourse(null);
    setBreadcrumbTrail([]);
    setContentSearch('');
    setCourseSearch('');
  }, []);

  const openContent = useCallback((node: ContentNode) => {
    if (!selectedCourse || !node.contentData) return;
    const route = getContentRoute(node.contentData, selectedCourse.courseId);
    navigate(route);
  }, [selectedCourse, navigate]);

  // ── Derived ──
  const currentNodes: ContentNode[] = useMemo(() =>
    breadcrumbTrail.length ? breadcrumbTrail[breadcrumbTrail.length - 1].nodes : [],
    [breadcrumbTrail]
  );

  const filteredCourses = useMemo(() =>
    courses.filter(c => !courseSearch || c.title.toLowerCase().includes(courseSearch.toLowerCase())),
    [courses, courseSearch]
  );

  const { folderNodes, contentNodes } = useMemo(() => {
    const term = contentSearch.toLowerCase();
    const filterDeep = (nodes: ContentNode[]): ContentNode[] => {
      if (!contentSearch) return nodes;
      return nodes.reduce<ContentNode[]>((acc, n) => {
        if (n.type === 'content') {
          if ((n.contentData?.title || n.name || '').toLowerCase().includes(term)) acc.push(n);
        } else if (n.type === 'folder') {
          const filtered = filterDeep(n.children);
          if (n.name.toLowerCase().includes(term) || filtered.length > 0) acc.push({ ...n, children: filtered });
        }
        return acc;
      }, []);
    };
    const vis = filterDeep(currentNodes);
    return { folderNodes: vis.filter(n => n.type === 'folder'), contentNodes: vis.filter(n => n.type === 'content') };
  }, [currentNodes, contentSearch]);

  const courseStats = useMemo(() => !selectedCourse ? null : ({
    items:   countContents(selectedCourse.contentStructure),
    folders: countFolders(selectedCourse.contentStructure),
    pct:     Math.min(100, Math.round(selectedCourse.progress)),
  }), [selectedCourse]);

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-[#0c0e16] text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background:
          'radial-gradient(ellipse 70% 40% at 65% -5%,rgba(99,102,241,0.09) 0%,transparent 60%),' +
          'radial-gradient(ellipse 50% 30% at 10% 85%,rgba(16,185,129,0.05) 0%,transparent 55%)',
      }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── TOP BAR ── */}
        <div className="flex items-center gap-3 mb-8 min-h-[48px]">
          {selectedCourse ? (
            <>
              <button onClick={goBackToCourses}
                className="flex-shrink-0 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white
                           transition-colors px-3 py-1.5 rounded-lg hover:bg-white/6 border border-transparent
                           hover:border-white/10 focus:outline-none">
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Library</span>
              </button>
              <span className="text-white/10 select-none hidden sm:block text-lg leading-none">|</span>
              <div className="min-w-0 flex-1">
                <Breadcrumb trail={breadcrumbTrail} onNav={navToBreadcrumb} />
              </div>
            </>
          ) : (
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <BookOpen size={14} className="text-indigo-400" />
                </span>
                Content Library
              </h1>
              <p className="text-sm text-slate-500 mt-0.5 ml-9">
                {loading ? '—' : `${courses.length} enrolled course${courses.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          )}
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <Loader2 size={30} className="text-indigo-400 animate-spin" />
            <p className="text-slate-500 text-sm">Loading your library…</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {!loading && error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={loadLibrary} className="underline hover:no-underline text-xs flex-shrink-0">Retry</button>
          </div>
        )}

        {/* ── COURSE LIST ── */}
        {!loading && !error && !selectedCourse && (
          <>
            <div className="mb-7">
              <SearchBox value={courseSearch} onChange={setCourseSearch} placeholder="Search your courses…" />
            </div>
            {filteredCourses.length === 0
              ? <EmptyMsg
                  icon={<GraduationCap size={26} className="text-slate-600" />}
                  title={courseSearch ? 'No courses found' : 'No enrolled courses yet'}
                  sub={courseSearch ? 'Try a different search term.' : 'Enroll in a course to access its content here.'} />
              : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCourses.map(course => (
                    <CourseCard key={course.courseId} course={course} onClick={() => openCourse(course)} />
                  ))}
                </div>
            }
          </>
        )}

        {/* ── INSIDE COURSE ── */}
        {!loading && !error && selectedCourse && (
          <>
            {/* Course hero strip */}
            <div className="flex gap-4 items-center p-4 rounded-2xl bg-white/4 border border-white/8 mb-6">
              {(selectedCourse.thumbnailUrl || selectedCourse.thumbnail)
                ? <img src={selectedCourse.thumbnailUrl || selectedCourse.thumbnail} alt={selectedCourse.title}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/10" />
                : <div className="w-14 h-14 rounded-xl bg-white/6 flex items-center justify-center flex-shrink-0 border border-white/8">
                    <GraduationCap size={22} className="text-slate-500" />
                  </div>
              }
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-white text-[15px] leading-snug mb-1.5 line-clamp-1">
                  {selectedCourse.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {courseStats && (
                    <>
                      <Pip icon={<Layers size={11} />}    label={`${courseStats.folders} folders`} />
                      <Pip icon={<BookOpen size={11} />}   label={`${courseStats.items} items`} />
                      <Pip icon={<BarChart3 size={11} />}  label={`${courseStats.pct}% complete`} />
                    </>
                  )}
                  {selectedCourse.validity && (
                    <Pip icon={<CalendarDays size={11} />}
                      label={`Valid till ${new Date(selectedCourse.validity).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`} />
                  )}
                </div>
              </div>
              {/* Circular progress */}
              {courseStats && courseStats.pct > 0 && (
                <div className="flex-shrink-0 hidden sm:block">
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                      <circle cx="24" cy="24" r="20" fill="none"
                        stroke={courseStats.pct === 100 ? '#10b981' : '#6366f1'}
                        strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - courseStats.pct / 100)}`}
                        className="transition-all duration-700" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
                      {courseStats.pct}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="mb-7">
              <SearchBox value={contentSearch} onChange={setContentSearch} placeholder="Search in this course…" />
            </div>

            {/* Empty */}
            {folderNodes.length === 0 && contentNodes.length === 0 && (
              <EmptyMsg
                icon={<Sparkles size={22} className="text-slate-600" />}
                title={contentSearch ? 'Nothing matches your search' : 'This folder is empty'}
                sub={contentSearch ? 'Try different keywords.' : 'No content has been added here yet.'} />
            )}

            {/* Folders */}
            {folderNodes.length > 0 && (
              <section className="mb-8">
                <SectionHead icon={<Layers size={12} />} label="Folders" count={folderNodes.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {folderNodes.map((node, i) => (
                    <FolderCard key={node.id} node={node} index={i} onClick={() => openFolder(node)} />
                  ))}
                </div>
              </section>
            )}

            {/* Content items */}
            {contentNodes.length > 0 && (
              <section>
                <SectionHead icon={<BookOpen size={12} />} label="Content" count={contentNodes.length} />
                <div className="flex flex-col gap-2">
                  {contentNodes.map(node => (
                    <ContentCard key={node.id} node={node} onClick={() => openContent(node)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContentLibrary;
