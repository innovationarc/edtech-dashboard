// src/pages/ContentLibrary.tsx
import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  Play, FileText, Zap, ClipboardList,
  Search, ArrowLeft, Loader2, AlertCircle,
  GraduationCap, X, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';
import Card from '../components/ui/Card';
import {
  contentLibraryService,
  LibraryCourse,
  ContentNode,
  LibraryContent,
} from '../services/contentLibraryService';

// ─── Sidebar theme helpers (mirrors Navigation.tsx & ComingSoon.tsx exactly) ──
const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

const THEME_BG: Record<string, string> = {
  dark:'#0d1117', light:'#ebe8e1', slate:'#0f172a',
  ocean:'#0c1a2e', forest:'#0a1f14', purple:'#1e1b4b',
  pink:'#831843', sunset:'#1c0a00',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ContentType = 'lesson' | 'note' | 'trick' | 'exam';
interface Crumb { label: string; nodes: ContentNode[]; }

// ─── Route builder ────────────────────────────────────────────────────────────
function getContentRoute(content: LibraryContent, courseId: string): string {
  switch (content.type) {
    case 'lesson':
    case 'trick':  return `/content-library/lesson/${courseId}/${content.id}`;
    case 'note':   return `/content-library/note/${courseId}/${content.id}`;
    case 'exam':   return `/content-library/exam/${courseId}/${content.id}`;
    default:       return `/content-library/lesson/${courseId}/${content.id}`;
  }
}

// ─── Content type meta ────────────────────────────────────────────────────────
const TYPE_META: Record<ContentType, {
  label: string;
  icon: React.ReactNode;
  pill: string;
  iconWrap: string;
}> = {
  lesson: {
    label: 'Lesson',
    icon: <Play size={14} strokeWidth={2.5} className="ml-0.5" />,
    pill: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
    iconWrap: 'bg-violet-500/15 text-violet-300',
  },
  trick: {
    label: 'Trick',
    icon: <Zap size={14} strokeWidth={2.5} />,
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    iconWrap: 'bg-amber-500/15 text-amber-300',
  },
  note: {
    label: 'Note',
    icon: <FileText size={14} strokeWidth={2.5} />,
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    iconWrap: 'bg-emerald-500/15 text-emerald-300',
  },
  exam: {
    label: 'Exam',
    icon: <ClipboardList size={14} strokeWidth={2.5} />,
    pill: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
    iconWrap: 'bg-rose-500/15 text-rose-300',
  },
};

// Folder accent colors cycling
const FOLDER_ACCENTS = [
  { bg: 'bg-indigo-500/8',  border: 'border-indigo-500/15', hover: 'hover:border-indigo-400/35', dot: 'bg-indigo-400' },
  { bg: 'bg-sky-500/8',     border: 'border-sky-500/15',    hover: 'hover:border-sky-400/35',    dot: 'bg-sky-400' },
  { bg: 'bg-violet-500/8',  border: 'border-violet-500/15', hover: 'hover:border-violet-400/35', dot: 'bg-violet-400' },
  { bg: 'bg-emerald-500/8', border: 'border-emerald-500/15',hover: 'hover:border-emerald-400/35',dot: 'bg-emerald-400' },
  { bg: 'bg-rose-500/8',    border: 'border-rose-500/15',   hover: 'hover:border-rose-400/35',   dot: 'bg-rose-400' },
  { bg: 'bg-amber-500/8',   border: 'border-amber-500/15',  hover: 'hover:border-amber-400/35',  dot: 'bg-amber-400' },
];

// ─── Course Card ──────────────────────────────────────────────────────────────
const CourseCard: React.FC<{ course: LibraryCourse; onClick: () => void; index: number }> = ({ course, onClick, index }) => {
  const thumb = course.thumbnailUrl || course.thumbnail;
  const [hovered, setHovered] = useState(false);
  const { theme } = useDashboard();
  const isLight = theme === 'light';

  return (
    <Card
      clickable
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: 'both' }}
      className="animate-fadeSlideUp group relative overflow-hidden transition-all duration-500 ease-out hover:shadow-2xl hover:-translate-y-1.5"
    >
      {/* Thumbnail */}
      <div className={`relative h-48 overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-gray-900/50'}`}>
        {thumb ? (
          <img
            src={thumb}
            alt={course.title}
            className="w-full h-full object-cover transition-all duration-700 ease-out"
            style={{ transform: hovered ? 'scale(1.06)' : 'scale(1)', opacity: hovered ? 0.9 : 0.7 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GraduationCap size={44} className={isLight ? 'text-gray-300' : 'text-white/10'} />
          </div>
        )}
        {/* Bottom fade */}
        <div className={`absolute inset-0 ${isLight ? 'bg-gradient-to-t from-white via-transparent to-transparent' : 'bg-gradient-to-t from-gray-950 via-transparent to-transparent'}`} />
      </div>

      {/* Course name */}
      <div className="px-4 py-4">
        <p className={`text-[15px] font-semibold leading-snug line-clamp-2 transition-colors duration-300 ${isLight ? 'text-gray-800 group-hover:text-gray-900' : 'text-white/90 group-hover:text-white'}`}>
          {course.title}
        </p>
      </div>

      {/* Hover arrow */}
      <div
        className="absolute bottom-4 right-4 transition-all duration-300"
        style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(-6px)' }}
      >
        <ChevronRight size={16} className={isLight ? 'text-gray-400' : 'text-white/40'} />
      </div>
    </Card>
  );
};

// ─── Folder Card ──────────────────────────────────────────────────────────────
const FolderCard: React.FC<{ node: ContentNode; index: number; onClick: () => void }> = ({ node, index, onClick }) => {
  const acc = FOLDER_ACCENTS[index % FOLDER_ACCENTS.length];
  const [hovered, setHovered] = useState(false);
  const { theme } = useDashboard();
  const isLight = theme === 'light';

  return (
    <Card
      clickable
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 55}ms`, animationFillMode: 'both' }}
      className={`animate-fadeSlideUp group relative ${acc.bg} ${acc.border} ${acc.hover} transition-all duration-400 ease-out hover:shadow-xl hover:-translate-y-1`}
    >
      <div className="relative flex items-center gap-4 px-5 py-5">
        {/* Dot accent */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${acc.dot} transition-transform duration-300 ${hovered ? 'scale-125' : 'scale-100'}`} />

        {/* Name */}
        <span className={`flex-1 text-[15px] font-medium leading-snug transition-colors duration-300 ${isLight ? 'text-gray-700 group-hover:text-gray-900' : 'text-white/80 group-hover:text-white'}`}>
          {node.name}
        </span>

        {/* Arrow */}
        <ChevronRight
          size={16}
          className={`flex-shrink-0 transition-all duration-300 ${isLight ? 'text-gray-400' : 'text-white/20'}`}
          style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', opacity: hovered ? 0.7 : 0.25 }}
        />
      </div>
    </Card>
  );
};

// ─── Content Card ─────────────────────────────────────────────────────────────
const ContentCard: React.FC<{ node: ContentNode; onClick: () => void; index: number }> = ({ node, onClick, index }) => {
  const content = node.contentData;
  const [hovered, setHovered] = useState(false);
  const { theme } = useDashboard();
  const isLight = theme === 'light';

  // Fallback if content data is missing
  if (!content) {
    return (
      <Card
        style={{ animationDelay: `${index * 45}ms`, animationFillMode: 'both' }}
        className={`animate-fadeSlideUp flex items-center gap-3 px-5 py-4 italic ${isLight ? 'text-gray-400' : 'text-white/25'}`}
      >
        {node.name || 'Content unavailable'}
      </Card>
    );
  }

  const meta = TYPE_META[content.type as ContentType] || TYPE_META.lesson;

  return (
    <Card
      clickable
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 45}ms`, animationFillMode: 'both' }}
      className="animate-fadeSlideUp group relative transition-all duration-300 ease-out hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-4 px-4 py-3.5">
        {/* Icon */}
        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${meta.iconWrap} flex items-center justify-center transition-transform duration-300 ${hovered ? 'scale-110' : 'scale-100'}`}>
          {meta.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium leading-snug mb-0.5 truncate transition-colors duration-200 ${isLight ? 'text-gray-800 group-hover:text-gray-900' : 'text-white/85 group-hover:text-white'}`}>
            {content.title}
          </div>
          {content.description && (
            <div className={`text-xs leading-snug line-clamp-1 ${isLight ? 'text-gray-500' : 'text-white/40'}`}>
              {content.description}
            </div>
          )}
        </div>

        {/* Type badge */}
        <div className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[11px] font-medium tracking-wide ${meta.pill} transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-80'}`}>
          {meta.label}
        </div>

        {/* Arrow */}
        <ChevronRight
          size={14}
          className={`flex-shrink-0 transition-all duration-300 ${isLight ? 'text-gray-400' : 'text-white/20'}`}
          style={{ transform: hovered ? 'translateX(2px)' : 'translateX(0)', opacity: hovered ? 0.6 : 0.2 }}
        />
      </div>
    </Card>
  );
};

// ─── Search Box ───────────────────────────────────────────────────────────────
const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => {
  const { theme } = useDashboard();
  const isLight = theme === 'light';

  return (
    <Card className="relative">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Search size={15} className={isLight ? 'text-gray-400' : 'text-white/30'} />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent text-sm outline-none placeholder:transition-colors ${isLight ? 'text-gray-900 placeholder:text-gray-400' : 'text-white placeholder:text-white/30'}`}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className={`transition-colors ${isLight ? 'text-gray-400 hover:text-gray-600' : 'text-white/30 hover:text-white/60'}`}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </Card>
  );
};

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
const Breadcrumb: React.FC<{ trail: Crumb[]; onNav: (idx: number) => void }> = ({ trail, onNav }) => {
  const { theme } = useDashboard();
  const isLight = theme === 'light';

  return (
    <div className="flex items-center gap-2 text-sm">
      {trail.map((crumb, i) => {
        const isLast = i === trail.length - 1;
        return (
          <div key={i} className="flex items-center gap-2">
            {isLast ? (
              <span className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>{crumb.label}</span>
            ) : (
              <>
                <button
                  onClick={() => onNav(i)}
                  className={`transition-colors hover:underline ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-white/50 hover:text-white/80'}`}
                >
                  {crumb.label}
                </button>
                <ChevronRight size={13} className={isLight ? 'text-gray-400' : 'text-white/20'} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Page transition wrapper ──────────────────────────────────────────────────
const PageSlide: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="animate-pageIn">{children}</div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const ContentLibrary: React.FC = () => {
  const { user, theme, primaryColor } = useDashboard();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);

  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCourse, setSelectedCourse] = useState<LibraryCourse | null>(null);
  const [currentNodes, setCurrentNodes] = useState<ContentNode[]>([]);
  const [trail, setTrail] = useState<Crumb[]>([]);

  const [courseSearch, setCourseSearch] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  // ── Load courses ──
  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      const data = await contentLibraryService.getStudentLibrary(user.uid);
      setCourses(data);
    } catch {
      setError('Failed to load library. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { load(); }, [load]);

  // ── Open course ──
  const openCourse = (course: LibraryCourse) => {
    setTransitioning(true);
    setTimeout(() => {
      setSelectedCourse(course);
      setCurrentNodes(course.content || []);
      setTrail([{ label: course.title, nodes: course.content || [] }]);
      setContentSearch('');
      setTransitioning(false);
    }, 120);
  };

  // ── Open folder ──
  const openFolder = (node: ContentNode) => {
    setTransitioning(true);
    setTimeout(() => {
      const children = node.children || [];
      setCurrentNodes(children);
      setTrail(prev => [...prev, { label: node.name, nodes: children }]);
      setContentSearch('');
      setTransitioning(false);
    }, 120);
  };

  // ── Open content ──
  const openContent = (node: ContentNode) => {
    if (!node.contentData || !selectedCourse) return;
    const route = getContentRoute(node.contentData, selectedCourse.courseId);
    navigate(route);
  };

  // ── Navigate breadcrumb ──
  const navTo = (idx: number) => {
    setTransitioning(true);
    setTimeout(() => {
      setTrail(trail.slice(0, idx + 1));
      setCurrentNodes(trail[idx].nodes);
      setContentSearch('');
      setTransitioning(false);
    }, 120);
  };

  // ── Go back to course list ──
  const goBack = () => {
    setTransitioning(true);
    setTimeout(() => {
      setSelectedCourse(null);
      setCurrentNodes([]);
      setTrail([]);
      setCourseSearch('');
      setTransitioning(false);
    }, 120);
  };

  // ── Filtering ──
  const filterNodes = (nodes: ContentNode[], term: string): ContentNode[] => {
    if (!term.trim()) return nodes;
    const t = term.toLowerCase();
    return nodes.reduce((acc: ContentNode[], n) => {
      if (n.type === 'content') {
        const title = (n.contentData?.title || n.name || '').toLowerCase();
        if (title.includes(t)) acc.push(n);
      } else if (n.type === 'folder') {
        const filtered = filterNodes(n.children || [], term);
        if (n.name.toLowerCase().includes(t) || filtered.length > 0)
          acc.push({ ...n, children: filtered });
      }
      return acc;
    }, []);
  };

  const filteredCourses = useMemo(
    () => courses.filter(c => !courseSearch.trim() || c.title.toLowerCase().includes(courseSearch.toLowerCase())),
    [courses, courseSearch]
  );

  const visibleNodes = useMemo(() => filterNodes(currentNodes, contentSearch), [currentNodes, contentSearch]);
  const folderNodes  = visibleNodes.filter(n => n.type === 'folder');
  const contentNodes = visibleNodes.filter(n => n.type === 'content');

  const isInsideCourse = !!selectedCourse;

  return (
    <>
      {/* ── Global keyframe styles injected once ── */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pageIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fadeSlideUp { animation: fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1); }
        .animate-pageIn      { animation: pageIn      0.3s cubic-bezier(0.22,1,0.36,1); }
        .animate-fadeIn      { animation: fadeIn      0.25s ease; }
      `}</style>

      <div
        className="min-h-screen"
        style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.12s ease' }}
      >
        {/* Subtle ambient gradient overlay */}
        <div className="fixed inset-0 pointer-events-none" style={{
          background: isLight
            ? 'radial-gradient(ellipse 60% 35% at 70% 0%, rgba(99,102,241,0.04) 0%, transparent 60%), radial-gradient(ellipse 40% 25% at 5% 90%, rgba(16,185,129,0.02) 0%, transparent 55%)'
            : 'radial-gradient(ellipse 60% 35% at 70% 0%, rgba(99,102,241,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 25% at 5% 90%, rgba(16,185,129,0.04) 0%, transparent 55%)',
        }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10">

          {/* ── HEADER ── */}
          <div className="mb-10">
            {isInsideCourse ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={goBack}
                  className={`flex items-center gap-2 text-sm transition-colors duration-200 focus:outline-none group ${isLight ? 'text-gray-500 hover:text-gray-800' : 'text-white/40 hover:text-white/80'}`}
                >
                  <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                  <span className="hidden sm:inline">Library</span>
                </button>
                <span className={`text-lg leading-none ${isLight ? 'text-gray-300' : 'text-white/10'}`}>|</span>
                <Breadcrumb trail={trail} onNav={navTo} />
              </div>
            ) : (
              <div className="animate-fadeIn">
                <h1 className={`text-2xl font-bold tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>My Library</h1>
                {!loading && (
                  <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-white/30'}`}>
                    {courses.length === 0
                      ? 'No courses enrolled yet'
                      : `${courses.length} course${courses.length !== 1 ? 's' : ''}`
                    }
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-32 gap-5 animate-fadeIn">
              <div className="relative">
                <Loader2 size={28} className="text-primary-400 animate-spin" />
                <div className="absolute inset-0 blur-xl bg-primary-500/20 rounded-full" />
              </div>
              <p className={`text-sm ${isLight ? 'text-gray-400' : 'text-white/25'}`}>Loading your library…</p>
            </div>
          )}

          {/* ── ERROR ── */}
          {!loading && error && (
            <Card className="flex items-center gap-3 p-4 bg-rose-500/8 border-rose-500/15 text-rose-300/80 text-sm animate-fadeIn">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={load} className="text-xs underline hover:no-underline opacity-70 hover:opacity-100 transition-opacity">
                Retry
              </button>
            </Card>
          )}

          {/* ── COURSE LIST ── */}
          {!loading && !error && !isInsideCourse && (
            <PageSlide>
              {/* Search */}
              {courses.length > 4 && (
                <div className="mb-8 max-w-xs">
                  <SearchBox value={courseSearch} onChange={setCourseSearch} placeholder="Search courses…" />
                </div>
              )}

              {/* Empty */}
              {filteredCourses.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center animate-fadeIn">
                  <Card className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-transparent">
                    <GraduationCap size={24} className={isLight ? 'text-gray-300' : 'text-white/20'} />
                  </Card>
                  <p className={`text-base font-medium mb-1 ${isLight ? 'text-gray-600' : 'text-white/40'}`}>
                    {courseSearch ? 'No results' : 'No courses yet'}
                  </p>
                  <p className={`text-sm max-w-xs ${isLight ? 'text-gray-400' : 'text-white/20'}`}>
                    {courseSearch ? 'Try a different keyword.' : 'Enroll in a course to get started.'}
                  </p>
                </div>
              )}

              {/* Grid */}
              {filteredCourses.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCourses.map((course, i) => (
                    <CourseCard key={course.courseId} course={course} index={i} onClick={() => openCourse(course)} />
                  ))}
                </div>
              )}
            </PageSlide>
          )}

          {/* ── INSIDE COURSE (folders + content) ── */}
          {!loading && !error && isInsideCourse && (
            <PageSlide>
              {/* Search — only show if there's content to search */}
              {currentNodes.length > 5 && (
                <div className="mb-8 max-w-xs">
                  <SearchBox value={contentSearch} onChange={setContentSearch} placeholder="Search…" />
                </div>
              )}

              {/* Empty */}
              {folderNodes.length === 0 && contentNodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center animate-fadeIn">
                  <Card className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-transparent">
                    <span className="text-2xl">✦</span>
                  </Card>
                  <p className={`text-base font-medium mb-1 ${isLight ? 'text-gray-600' : 'text-white/40'}`}>
                    {contentSearch ? 'Nothing found' : 'Nothing here yet'}
                  </p>
                  {contentSearch && (
                    <p className={`text-sm ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Try different keywords.</p>
                  )}
                </div>
              )}

              {/* ── Folders ── */}
              {folderNodes.length > 0 && (
                <div className="mb-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {folderNodes.map((node, i) => (
                      <FolderCard key={node.id} node={node} index={i} onClick={() => openFolder(node)} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Divider between folders and content ── */}
              {folderNodes.length > 0 && contentNodes.length > 0 && (
                <div className={`h-px mb-8 animate-fadeIn ${isLight ? 'bg-gray-200' : 'bg-white/5'}`} />
              )}

              {/* ── Content ── */}
              {contentNodes.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {contentNodes.map((node, i) => (
                    <ContentCard key={node.id} node={node} index={i} onClick={() => openContent(node)} />
                  ))}
                </div>
              )}
            </PageSlide>
          )}

        </div>
      </div>
    </>
  );
};

export default ContentLibrary;
