// src/pages/ContentLibrary.tsx
// Content Library — Students browse & open enrolled course content
// Routes to specific content viewer pages (lesson/exam/note views — built separately)

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  FileText,
  Zap,
  ClipboardList,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Clock,
  BarChart2,
  Play,
  ArrowLeft,
  Loader,
  AlertCircle,
  BookMarked,
  GraduationCap,
  SlidersHorizontal,
  X,
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
type ViewState = 'courses' | 'course-detail';

// ==================== HELPERS ====================

function getContentIcon(type: ContentType) {
  switch (type) {
    case 'lesson': return <Play size={14} className="text-indigo-400" />;
    case 'trick':  return <Zap  size={14} className="text-amber-400" />;
    case 'note':   return <FileText size={14} className="text-emerald-400" />;
    case 'exam':   return <ClipboardList size={14} className="text-rose-400" />;
    default:       return <BookOpen size={14} className="text-slate-400" />;
  }
}

function getContentBadgeClass(type: ContentType): string {
  switch (type) {
    case 'lesson': return 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30';
    case 'trick':  return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    case 'note':   return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
    case 'exam':   return 'bg-rose-500/15 text-rose-300 border border-rose-500/30';
    default:       return 'bg-slate-500/15 text-slate-300 border border-slate-500/30';
  }
}

function getContentTypeLabel(type: ContentType): string {
  switch (type) {
    case 'lesson': return 'Lesson';
    case 'trick':  return 'Trick';
    case 'note':   return 'Note';
    case 'exam':   return 'Exam';
    default:       return type;
  }
}

/**
 * Returns the route path for a given content type.
 * Lesson & Trick share the same viewer page.
 * Note and Exam each have their own page.
 * (Actual route definitions to be created separately.)
 */
function getContentRoute(content: LibraryContent, courseId: string): string {
  switch (content.type) {
    case 'lesson':
    case 'trick':
      return `/library/lesson/${courseId}/${content.id}`;
    case 'note':
      return `/library/note/${courseId}/${content.id}`;
    case 'exam':
      return `/library/exam/${courseId}/${content.id}`;
    default:
      return `/library/lesson/${courseId}/${content.id}`;
  }
}

function countContentsInNodes(nodes: ContentNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'content') count++;
    if (node.children?.length) count += countContentsInNodes(node.children);
  }
  return count;
}

// ==================== CONTENT NODE ITEM ====================

interface ContentNodeItemProps {
  node: ContentNode;
  courseId: string;
  depth: number;
  onContentClick: (content: LibraryContent, courseId: string) => void;
}

const ContentNodeItem: React.FC<ContentNodeItemProps> = ({
  node,
  courseId,
  depth,
  onContentClick,
}) => {
  const [expanded, setExpanded] = useState(true);

  const paddingLeft = depth * 20;

  if (node.type === 'folder') {
    const childCount = countContentsInNodes(node.children);
    return (
      <div>
        {/* Folder Row */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          <span className="text-slate-400 group-hover:text-slate-200 transition-colors">
            {expanded ? <FolderOpen size={16} /> : <Folder size={16} />}
          </span>
          <span className="flex-1 text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
            {node.name}
          </span>
          <span className="text-xs text-slate-500 mr-2">{childCount} items</span>
          <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>

        {/* Children */}
        {expanded && node.children?.length > 0 && (
          <div className="border-l border-white/5 ml-6" style={{ marginLeft: `${paddingLeft + 26}px` }}>
            {node.children.map(child => (
              <ContentNodeItem
                key={child.id}
                node={child}
                courseId={courseId}
                depth={depth + 1}
                onContentClick={onContentClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Content Item
  const content = node.contentData;
  if (!content) {
    // Fallback if content data wasn't hydrated
    return (
      <div
        className="flex items-center gap-2 py-2.5 px-3 text-sm text-slate-500 italic"
        style={{ paddingLeft: `${paddingLeft + 12}px` }}
      >
        <BookOpen size={14} />
        <span>{node.name || 'Unknown content'}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onContentClick(content, courseId)}
      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 active:bg-white/10 transition-all text-left group"
      style={{ paddingLeft: `${paddingLeft + 12}px` }}
    >
      {/* Type icon */}
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-white/5">
        {getContentIcon(content.type)}
      </span>

      {/* Title */}
      <span className="flex-1 text-sm text-slate-300 group-hover:text-white transition-colors truncate">
        {content.title}
      </span>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {content.durationFormatted && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock size={11} />
            {content.durationFormatted}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getContentBadgeClass(content.type)}`}>
          {getContentTypeLabel(content.type)}
        </span>
        <ChevronRight
          size={14}
          className="text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all"
        />
      </div>
    </button>
  );
};

// ==================== COURSE CARD ====================

interface CourseCardProps {
  course: LibraryCourse;
  onClick: (course: LibraryCourse) => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, onClick }) => {
  const totalContent = countContentsInNodes(course.contentStructure);
  const progressPct = Math.min(100, Math.round(course.progress));

  return (
    <button
      onClick={() => onClick(course)}
      className="group w-full text-left bg-white/4 hover:bg-white/7 border border-white/8 hover:border-white/15 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative h-40 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
        {course.thumbnailUrl || course.thumbnail ? (
          <img
            src={course.thumbnailUrl || course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <GraduationCap size={48} className="text-slate-600" />
          </div>
        )}
        {/* Progress overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-indigo-200 transition-colors">
          {course.title}
        </h3>

        {/* Subjects */}
        {course.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {course.subjects.slice(0, 3).map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/6 text-slate-400 border border-white/8">
                {s}
              </span>
            ))}
            {course.subjects.length > 3 && (
              <span className="text-xs text-slate-500">+{course.subjects.length - 3}</span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <BookMarked size={11} />
            {totalContent} items
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 size={11} />
            {progressPct}% complete
          </span>
        </div>
      </div>
    </button>
  );
};

// ==================== COURSE DETAIL VIEW ====================

interface CourseDetailViewProps {
  course: LibraryCourse;
  onBack: () => void;
  onContentClick: (content: LibraryContent, courseId: string) => void;
}

const CourseDetailView: React.FC<CourseDetailViewProps> = ({ course, onBack, onContentClick }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter content nodes by search term (flattened match)
  const filterNodes = (nodes: ContentNode[], term: string): ContentNode[] => {
    if (!term) return nodes;
    return nodes.reduce<ContentNode[]>((acc, node) => {
      if (node.type === 'content') {
        const title = node.contentData?.title || node.name || '';
        if (title.toLowerCase().includes(term.toLowerCase())) acc.push(node);
      } else if (node.type === 'folder') {
        const filteredChildren = filterNodes(node.children, term);
        if (filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  };

  const displayNodes = filterNodes(course.contentStructure, searchTerm);
  const totalContent = countContentsInNodes(course.contentStructure);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="text-slate-600">/</span>
        <span className="text-sm font-medium text-white truncate">{course.title}</span>
      </div>

      {/* Course header card */}
      <div className="flex gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 mb-6">
        {(course.thumbnailUrl || course.thumbnail) && (
          <img
            src={course.thumbnailUrl || course.thumbnail}
            alt={course.title}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-white mb-1 truncate">{course.title}</h2>
          <div className="flex flex-wrap gap-1 mb-2">
            {course.subjects?.map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-white/6 text-slate-400 border border-white/8">
                {s}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><BookMarked size={11} />{totalContent} items</span>
            <span className="flex items-center gap-1"><BarChart2 size={11} />{Math.round(course.progress)}% done</span>
            {course.validity && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                Valid till {new Date(course.validity).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search in this course..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/7 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content tree */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        {displayNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen size={32} className="text-slate-600 mb-3" />
            <p className="text-slate-500 text-sm">
              {searchTerm ? 'No content matches your search.' : 'No content in this course yet.'}
            </p>
          </div>
        ) : (
          displayNodes.map(node => (
            <ContentNodeItem
              key={node.id}
              node={node}
              courseId={course.courseId}
              depth={0}
              onContentClick={onContentClick}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ==================== MAIN PAGE ====================

const ContentLibrary: React.FC = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();

  const [viewState, setViewState] = useState<ViewState>('courses');
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<LibraryCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // ==================== LOAD DATA ====================

  useEffect(() => {
    if (user?.uid) {
      loadLibrary();
    }
  }, [user?.uid]);

  const loadLibrary = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await contentLibraryService.getStudentLibrary(user!.uid);
      setCourses(data);
    } catch (err: any) {
      console.error('Error loading content library:', err);
      setError('Failed to load your content library. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== HANDLERS ====================

  const handleCourseClick = useCallback((course: LibraryCourse) => {
    setSelectedCourse(course);
    setViewState('course-detail');
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCourse(null);
    setViewState('courses');
    setSearchTerm('');
  }, []);

  const handleContentClick = useCallback((content: LibraryContent, courseId: string) => {
    const route = getContentRoute(content, courseId);
    navigate(route);
  }, [navigate]);

  // ==================== FILTERED COURSES ====================

  const filteredCourses = courses.filter(c =>
    !searchTerm || c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-[#0d0f17] text-white">
      {/* Background texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 py-8">

        {/* ===== PAGE HEADER ===== */}
        {viewState === 'courses' && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <BookMarked size={16} className="text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Content Library</h1>
            </div>
            <p className="text-slate-500 text-sm ml-11">
              Browse and study content from your enrolled courses.
            </p>
          </div>
        )}

        {/* ===== LOADING ===== */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader size={28} className="text-indigo-400 animate-spin" />
            <p className="text-slate-500 text-sm">Loading your library…</p>
          </div>
        )}

        {/* ===== ERROR ===== */}
        {!loading && error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={loadLibrary}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ===== COURSES LIST VIEW ===== */}
        {!loading && !error && viewState === 'courses' && (
          <>
            {/* Search + Stats */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search courses…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
              <span className="text-xs text-slate-600 whitespace-nowrap">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Empty state */}
            {filteredCourses.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/4 flex items-center justify-center mb-4">
                  <GraduationCap size={28} className="text-slate-600" />
                </div>
                <h3 className="text-base font-medium text-slate-400 mb-1">
                  {searchTerm ? 'No courses found' : 'No enrolled courses yet'}
                </h3>
                <p className="text-sm text-slate-600 max-w-xs">
                  {searchTerm
                    ? 'Try a different search term.'
                    : 'Enroll in a course to access its content here.'}
                </p>
              </div>
            )}

            {/* Course grid */}
            {filteredCourses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map(course => (
                  <CourseCard key={course.courseId} course={course} onClick={handleCourseClick} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== COURSE DETAIL VIEW ===== */}
        {!loading && !error && viewState === 'course-detail' && selectedCourse && (
          <CourseDetailView
            course={selectedCourse}
            onBack={handleBack}
            onContentClick={handleContentClick}
          />
        )}
      </div>
    </div>
  );
};

export default ContentLibrary;
