// src/pages/ContentLibrary.tsx
// Production-grade Content Library
// Clean drill-down: Courses → Folders → Content
// Zero jargon. Pure UX.
// All existing features fully intact.

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
  { border: 'border-indigo-500/20',  hover: 'hover:border-indigo-400/40', dot: 'bg-indigo-400' },
  { border: 'border-sky-500/20',     hover: 'hover:border-sky-400/40',    dot: 'bg-sky-400'    },
  { border: 'border-violet-500/20',  hover: 'hover:border-violet-400/40', dot: 'bg-violet-400' },
  { border: 'border-emerald-500/20', hover: 'hover:border-emerald-400/40',dot: 'bg-emerald-400'},
  { border: 'border-rose-500/20',    hover: 'hover:border-rose-400/40',   dot: 'bg-rose-400'   },
  { border: 'border-amber-500/20',   hover: 'hover:border-amber-400/40',  dot: 'bg-amber-400'  },
];

// ─── Course Card ──────────────────────────────────────────────────────────────
const CourseCard: React.FC<{ course: LibraryCourse; onClick: () => void; index: number }> = ({ course, onClick, index }) => {
  const thumb = course.thumbnailUrl || course.thumbnail;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: 'both' }}
      className="animate-fadeSlideUp group relative w-full text-left rounded-2xl overflow-hidden
                 transition-all duration-500 ease-out hover:-translate-y-1.5
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 p-0"
    >
      <Card className="p-0 h-full transition-all duration-300 hover:shadow-card-hover overflow-hidden">
        {/* Thumbnail */}
        <div className="relative h-48 overflow-hidden bg-background-800">
          {thumb ? (
            <img
              src={thumb}
              alt={course.title}
              className="w-full h-full object-cover transition-all duration-700 ease-out"
              style={{ transform: hovered ? 'scale(1.06)' : 'scale(1)', opacity: hovered ? 0.9 : 0.7 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <GraduationCap size={44} className="text-white/10" />
            </div>
          )}
          {/* Bottom fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-background-900 via-transparent to-transparent" />
        </div>

        {/* Course name */}
        <div className="px-4 py-4">
          <p className="text-[15px] font-semibold text-white group-hover:text-white/90 leading-snug line-clamp-2 transition-colors duration-300">
            {course.title}
          </p>
        </div>

        {/* Hover arrow */}
        <div
          className="absolute bottom-4 right-4 transition-all duration-300"
          style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'translateX(0)' : 'translateX(-6px)' }}
        >
          <ChevronRight size={16} className="text-white/40" />
        </div>
      </Card>
    </button>
  );
};

// ─── Folder Card ──────────────────────────────────────────────────────────────
const FolderCard: React.FC<{ node: ContentNode; index: number; onClick: () => void }> = ({ node, index, onClick }) => {
  const acc = FOLDER_ACCENTS[index % FOLDER_ACCENTS.length];
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 55}ms`, animationFillMode: 'both' }}
      className="animate-fadeSlideUp w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <Card className={`p-0 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5 border ${acc.border} ${acc.hover}`}>
        <div className="flex items-center gap-4 px-5 py-5">
          {/* Dot accent */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${acc.dot} transition-transform duration-300 ${hovered ? 'scale-125' : 'scale-100'}`} />

          {/* Name */}
          <span className="flex-1 text-[15px] font-medium text-gray-300 group-hover:text-white transition-colors duration-300 leading-snug">
            {node.name}
          </span>

          {/* Arrow */}
          <ChevronRight
            size={16}
            className="flex-shrink-0 text-gray-500 transition-all duration-300"
            style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', opacity: hovered ? 0.7 : 0.4 }}
          />
        </div>
      </Card>
    </button>
  );
};

// ─── Content Card ─────────────────────────────────────────────────────────────
const ContentCard: React.FC<{ node: ContentNode; onClick: () => void; index: number }> = ({ node, onClick, index }) => {
  const content = node.contentData;
  const type    = (content?.type ?? 'lesson') as ContentType;
  const meta    = TYPE_META[type];
  const [hovered, setHovered] = useState(false);

  if (!content) {
    return (
      <div
        style={{ animationDelay: `${index * 45}ms`, animationFillMode: 'both' }}
        className="animate-fadeSlideUp flex items-center gap-3 px-5 py-4 rounded-2xl border border-white/5 text-gray-500 text-sm italic"
      >
        {node.name || 'Content unavailable'}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ animationDelay: `${index * 45}ms`, animationFillMode: 'both' }}
      className="animate-fadeSlideUp w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <Card className="p-0 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5">
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Type icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.iconWrap} transition-transform duration-300 ${hovered ? 'scale-110' : 'scale-100'}`}>
            {meta.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white transition-colors duration-300 leading-snug mb-1 line-clamp-1">
              {content.title}
            </p>
            {content.description && (
              <p className="text-[12px] text-gray-400 transition-colors duration-300 line-clamp-1 leading-relaxed">
                {content.description}
              </p>
            )}
          </div>

          {/* Type pill */}
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${meta.pill} transition-all duration-300`}
            style={{ opacity: hovered ? 1 : 0.75 }}
          >
            {meta.icon}
            {meta.label}
          </span>

          {/* Arrow */}
          <ChevronRight
            size={15}
            className="flex-shrink-0 text-gray-500 transition-all duration-300"
            style={{ transform: hovered ? 'translateX(3px)' : 'translateX(0)', opacity: hovered ? 0.6 : 0.3 }}
          />
        </div>
      </Card>
    </button>
  );
};

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
const Breadcrumb: React.FC<{ trail: Crumb[]; onNav: (i: number) => void }> = ({ trail, onNav }) => (
  <nav className="flex items-center gap-1.5 flex-wrap min-w-0">
    {trail.map((c, i) => {
      const isLast = i === trail.length - 1;
      return (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />}
          {isLast
            ? <span className="text-sm font-semibold text-white truncate max-w-[200px]">{c.label}</span>
            : <button onClick={() => onNav(i)}
                className="text-sm text-gray-400 hover:text-white transition-colors duration-200 truncate max-w-[160px] focus:outline-none">
                {c.label}
              </button>
          }
        </React.Fragment>
      );
    })}
  </nav>
);

// ─── Search box ───────────────────────────────────────────────────────────────
const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full pl-9 pr-9 py-2.5 text-sm bg-background-800 border border-white/8 rounded-xl
                 text-white placeholder-gray-500
                 focus:outline-none focus:border-primary-500/40 focus:bg-background-700
                 transition-all duration-200"
    />
    {value && (
      <button onClick={() => onChange('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none">
        <X size={14} />
      </button>
    )}
  </div>
);

// ─── Page transition wrapper ──────────────────────────────────────────────────
const PageSlide: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="animate-pageIn">{children}</div>
);

// ==================== MAIN PAGE ====================
const ContentLibrary: React.FC = () => {
  const { user, primaryColor, accentColor } = useDashboard();
  const navigate = useNavigate();

  const [courses, setCourses]   = useState<LibraryCourse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [selectedCourse, setSelectedCourse]   = useState<LibraryCourse | null>(null);
  const [trail, setTrail]       = useState<Crumb[]>([]);
  const [courseSearch, setCourseSearch]   = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  // Load
  useEffect(() => { if (user?.uid) load(); }, [user?.uid]);

  const load = async () => {
    try {
      setLoading(true); setError('');
      const data = await contentLibraryService.getStudentLibrary(user!.uid);
      setCourses(data);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Navigate with micro-transition
  const transition = (fn: () => void) => {
    setTransitioning(true);
    setTimeout(() => { fn(); setTransitioning(false); }, 120);
  };

  const openCourse = useCallback((course: LibraryCourse) => {
    transition(() => {
      setSelectedCourse(course);
      setTrail([{ label: course.title, nodes: course.contentStructure }]);
      setContentSearch('');
    });
  }, []);

  const openFolder = useCallback((node: ContentNode) => {
    transition(() => {
      setTrail(p => [...p, { label: node.name, nodes: node.children }]);
      setContentSearch('');
    });
  }, []);

  const navTo = useCallback((i: number) => {
    transition(() => {
      setTrail(p => p.slice(0, i + 1));
      setContentSearch('');
    });
  }, []);

  const goBack = useCallback(() => {
    transition(() => {
      setSelectedCourse(null);
      setTrail([]);
      setContentSearch('');
      setCourseSearch('');
    });
  }, []);

  const openContent = useCallback((node: ContentNode) => {
    if (!selectedCourse || !node.contentData) return;
    navigate(getContentRoute(node.contentData, selectedCourse.courseId), {
      state: { contentData: node.contentData },
    });
  }, [selectedCourse, navigate]);

  // Current level nodes
  const currentNodes = useMemo(() =>
    trail.length ? trail[trail.length - 1].nodes : [],
    [trail]
  );

  // Deep search filter
  const filterNodes = (nodes: ContentNode[], term: string): ContentNode[] => {
    if (!term) return nodes;
    const t = term.toLowerCase();
    return nodes.reduce<ContentNode[]>((acc, n) => {
      if (n.type === 'content') {
        const title = (n.contentData?.title || n.name || '').toLowerCase();
        if (title.includes(t)) acc.push(n);
      } else if (n.type === 'folder') {
        const filtered = filterNodes(n.children, term);
        if (n.name.toLowerCase().includes(t) || filtered.length > 0)
          acc.push({ ...n, children: filtered });
      }
      return acc;
    }, []);
  };

  const filteredCourses = useMemo(() =>
    courses.filter(c => !courseSearch || c.title.toLowerCase().includes(courseSearch.toLowerCase())),
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
        className="space-y-6"
        style={{ opacity: transitioning ? 0 : 1, transition: 'opacity 0.12s ease' }}
      >
        {/* ── HEADER ── */}
        <div>
          {isInsideCourse ? (
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white
                           transition-colors duration-200 focus:outline-none group"
              >
                <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                <span className="hidden sm:inline">Library</span>
              </button>
              <span className="text-gray-600 text-lg leading-none">|</span>
              <Breadcrumb trail={trail} onNav={navTo} />
            </div>
          ) : (
            <div className="animate-fadeIn">
              <h1 className="text-2xl font-bold text-white tracking-tight">My Library</h1>
              {!loading && (
                <p className="text-sm text-gray-400 mt-1">
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
            <Loader2 size={28} className="text-primary-400 animate-spin" />
            <p className="text-sm text-gray-400">Loading your library…</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {!loading && error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-error-DEFAULT/10 border border-error-DEFAULT/20 text-error-DEFAULT text-sm animate-fadeIn">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={load} className="text-xs underline hover:no-underline opacity-70 hover:opacity-100 transition-opacity">
              Retry
            </button>
          </div>
        )}

        {/* ── COURSE LIST ── */}
        {!loading && !error && !isInsideCourse && (
          <PageSlide>
            {/* Search */}
            {courses.length > 4 && (
              <div className="mb-6 max-w-xs">
                <SearchBox value={courseSearch} onChange={setCourseSearch} placeholder="Search courses…" />
              </div>
            )}

            {/* Empty */}
            {filteredCourses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center animate-fadeIn">
                <div className="w-16 h-16 rounded-2xl bg-background-800 border border-white/6 flex items-center justify-center mb-5">
                  <GraduationCap size={24} className="text-gray-500" />
                </div>
                <p className="text-base font-medium text-gray-400 mb-1">
                  {courseSearch ? 'No results' : 'No courses yet'}
                </p>
                <p className="text-sm text-gray-500 max-w-xs">
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
              <div className="mb-6 max-w-xs">
                <SearchBox value={contentSearch} onChange={setContentSearch} placeholder="Search…" />
              </div>
            )}

            {/* Empty */}
            {folderNodes.length === 0 && contentNodes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center animate-fadeIn">
                <div className="w-16 h-16 rounded-2xl bg-background-800 border border-white/6 flex items-center justify-center mb-5">
                  <span className="text-2xl">✦</span>
                </div>
                <p className="text-base font-medium text-gray-400 mb-1">
                  {contentSearch ? 'Nothing found' : 'Nothing here yet'}
                </p>
                {contentSearch && (
                  <p className="text-sm text-gray-500">Try different keywords.</p>
                )}
              </div>
            )}

            {/* ── Folders ── */}
            {folderNodes.length > 0 && (
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {folderNodes.map((node, i) => (
                    <FolderCard key={node.id} node={node} index={i} onClick={() => openFolder(node)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Divider between folders and content ── */}
            {folderNodes.length > 0 && contentNodes.length > 0 && (
              <div className="h-px bg-white/5 mb-6 animate-fadeIn" />
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
    </>
  );
};

export default ContentLibrary;
