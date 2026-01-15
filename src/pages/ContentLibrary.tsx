import { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Edit, Trash2, BookOpen, FileText, PenTool, BrainCircuit, Calendar, User, Tag, CheckCircle, Play, Clock, Video } from 'lucide-react';
import Card from '../components/ui/Card';
import { contentService, Content } from '../services/contentService';
import { mcqService, MCQQuestion } from '../services/mcqService';
import { courseService } from '../services/courseService';
import { useDashboard } from '../contexts/DashboardContext';

const ContentLibrary = () => {
  const { user } = useDashboard();
  const [contents, setContents] = useState<Content[]>([]);
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [enrolledCourseContent, setEnrolledCourseContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [error, setError] = useState('');

  const subjects = ['Mathematics', 'Physics', 'Biology', 'Computer Science', 'History', 'Chemistry', 'English', 'Geography', 'Programming', 'Data Science', 'Business', 'Design'];

  useEffect(() => {
    loadContent();
  }, [user]);

  const loadContent = async () => {
    try {
      setLoading(true);
      
      // Load regular content and MCQs
      const [contentData, mcqData] = await Promise.all([
        contentService.getAllContent(),
        mcqService.getAllMCQQuestions()
      ]);
      
      setContents(contentData);
      setMcqs(mcqData);
      
      // Load enrolled course content if user is logged in
      if (user) {
        await loadEnrolledCourseContent();
      }
    } catch (error: any) {
      console.error('Failed to load content:', error);
      setError('Failed to load content: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrolledCourseContent = async () => {
    if (!user) return;
    
    try {
      const studentContent = await courseService.getStudentCourseContent(user.uid);
      console.log('Loaded student course content:', studentContent.length);
      setEnrolledCourseContent(studentContent);
    } catch (error: any) {
      console.error('Failed to load enrolled course content:', error);
    }
  };

  const filteredContents = [...contents, ...mcqs, ...enrolledCourseContent].filter(item => {
    const matchesSearch = (item.title?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) || 
                          (item.description?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) || 
                          (item.question?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
                          item.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSubject = selectedSubject === 'all' || 
                          item.category === selectedSubject || 
                          item.subject === selectedSubject;
    
    const matchesType = selectedType === 'all' || item.type === selectedType;
    const matchesDifficulty = selectedDifficulty === 'all' || item.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesSubject && matchesType && matchesDifficulty;
  });

  const handleDownload = (item: Content | MCQQuestion | any) => {
    if ('fileUrl' in item && item.fileUrl) {
      window.open(item.fileUrl, '_blank');
    } else if ('pdfUrl' in item && item.pdfUrl) {
      window.open(item.pdfUrl, '_blank');
    } else if ('videoUrl' in item && item.videoUrl) {
      window.open(item.videoUrl, '_blank');
    } else {
      alert('No downloadable file available for this content.');
    }
  };

  const handleView = (item: Content | MCQQuestion | any) => {
    if (item.isFromCourse) {
      if (item.videoUrl) {
        window.open(item.videoUrl, '_blank');
      } else if (item.pdfUrl) {
        window.open(item.pdfUrl, '_blank');
      } else if (item.content) {
        alert(`Text Content for ${item.title}:\n\n${item.content}`);
      } else if (item.type === 'course') {
        const message = `Course: ${item.title}\n\nTotal Lessons: ${item.totalLessons || 0}\nDuration: ${item.duration || 'N/A'}\nInstructor: ${item.instructor || 'N/A'}${item.hasQnA ? '\n✓ Q&A Available' : ''}${item.hasStudyPlanner ? '\n✓ Study Planner Available' : ''}`;
        alert(message);
      } else {
        alert(`No direct preview available for: ${item.title}`);
      }
    } else if ('fileUrl' in item && item.fileUrl) {
      window.open(item.fileUrl, '_blank');
    } else if (item.type === 'mcq') {
      const correctChoice = item.choices?.find((c: any) => c.id === item.correctAnswer);
      alert(`MCQ Question: ${item.question}\n\nCorrect Answer: ${correctChoice?.text || 'N/A'}\n\nSubject: ${item.category || item.subject}`);
    } else {
      alert(`Viewing details for: ${item.title}`);
    }
  };

  const handleEdit = (content: Content | MCQQuestion | any) => {
    if (content.isFromCourse) {
      alert('Course content cannot be edited from the library. Please edit from the original course.');
      return;
    }
    console.log('Editing content:', content.title);
    alert('Edit functionality coming soon!');
  };

  const contentBySubject = subjects.reduce((acc, subject) => {
    acc[subject] = filteredContents.filter(item => 
      item.category === subject || item.subject === subject
    );
    return acc;
  }, {} as Record<string, any[]>);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lesson': return <BookOpen size={16} className="text-primary-400" />;
      case 'note': return <FileText size={16} className="text-secondary-400" />;
      case 'trick': return <PenTool size={16} className="text-accent-400" />;
      case 'mcq': return <BrainCircuit size={16} className="text-warning-DEFAULT" />;
      case 'course': return <BookOpen size={16} className="text-success-DEFAULT" />;
      case 'video': return <Video size={16} className="text-primary-400" />;
      case 'text': return <FileText size={16} className="text-secondary-400" />;
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': 
      case 'beginner': 
        return 'bg-success-dark text-success-light';
      case 'medium': 
      case 'intermediate': 
        return 'bg-warning-dark text-warning-light';
      case 'hard': 
      case 'advanced': 
        return 'bg-error-dark text-error-light';
      default: 
        return 'bg-background-700 text-gray-300';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Library</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse and manage your educational content organized by subject
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400'}`}
          >
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="bg-current rounded-sm"></div>
              <div className="bg-current rounded-sm"></div>
              <div className="bg-current rounded-sm"></div>
              <div className="bg-current rounded-sm"></div>
            </div>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400'}`}
          >
            <div className="space-y-1 w-4 h-4">
              <div className="bg-current h-0.5 rounded"></div>
              <div className="bg-current h-0.5 rounded"></div>
              <div className="bg-current h-0.5 rounded"></div>
              <div className="bg-current h-0.5 rounded"></div>
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-2 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search content..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            <option value="lesson">Lessons</option>
            <option value="note">Notes</option>
            <option value="trick">Tricks & Hacks</option>
            <option value="mcq">MCQ Questions</option>
            <option value="course">Enrolled Courses</option>
            <option value="video">Videos</option>
            <option value="text">Text Content</option>
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy / Beginner</option>
            <option value="medium">Medium / Intermediate</option>
            <option value="hard">Hard / Advanced</option>
          </select>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <span className="text-sm text-gray-400">
              {filteredContents.length} items
            </span>
          </div>
        </div>
      </Card>

      {/* Content by Subject */}
      <div className="space-y-8">
        {subjects.map(subject => {
          const subjectContent = contentBySubject[subject];
          if (!subjectContent || subjectContent.length === 0) return null;

          return (
            <div key={subject} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                    <BookOpen size={16} className="text-white" />
                  </div>
                  {subject}
                  <span className="text-sm text-gray-400 font-normal">
                    ({subjectContent.length} items)
                  </span>
                </h2>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {subjectContent.map(content => (
                    <ContentCard
                      key={content.id}
                      content={content}
                      onDownload={handleDownload}
                      onView={handleView}
                      onEdit={handleEdit}
                      getTypeIcon={getTypeIcon}
                      getDifficultyColor={getDifficultyColor}
                      formatFileSize={formatFileSize}
                      canEdit={(user?.role === 'admin' || user?.role === 'teacher') && !('isFromCourse' in content && content.isFromCourse)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {subjectContent.map(content => (
                    <ContentListItem
                      key={content.id}
                      content={content}
                      onDownload={handleDownload}
                      onView={handleView}
                      onEdit={handleEdit}
                      getTypeIcon={getTypeIcon}
                      getDifficultyColor={getDifficultyColor}
                      formatFileSize={formatFileSize}
                      canEdit={(user?.role === 'admin' || user?.role === 'teacher') && !('isFromCourse' in content && content.isFromCourse)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredContents.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No content found</h3>
          <p className="text-gray-400">
            {searchTerm || selectedSubject !== 'all' || selectedType !== 'all' || selectedDifficulty !== 'all'
              ? 'Try adjusting your search criteria or filters.'
              : user 
                ? 'Enroll in courses to see content here, or upload standalone content.'
                : 'Login to access your enrolled course content.'}
          </p>
        </div>
      )}
    </div>
  );
};

interface ContentCardProps {
  content: any;
  onDownload: (content: any) => void;
  onView: (content: any) => void;
  onEdit: (content: any) => void;
  getTypeIcon: (type: string) => JSX.Element;
  getDifficultyColor: (difficulty?: string) => string;
  formatFileSize: (bytes?: number) => string;
  canEdit: boolean;
}

const ContentCard = ({
  content,
  onDownload,
  onView,
  onEdit,
  getTypeIcon,
  getDifficultyColor,
  formatFileSize,
  canEdit
}: ContentCardProps) => {
  const isFromCourse = 'isFromCourse' in content && content.isFromCourse;
  const courseId = 'courseId' in content ? content.courseId : null;
  
  return (
    <Card className="p-0 hover:shadow-card-hover transition-all duration-300 group">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getTypeIcon(content.type)}
            <span className="text-xs uppercase text-gray-400 font-medium">
              {content.type}
            </span>
            {isFromCourse && (
              <span className="text-xs bg-primary-900 text-primary-300 px-2 py-1 rounded">
                Course
              </span>
            )}
          </div>
          {content.difficulty && (
            <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyColor(content.difficulty)}`}>
              {content.difficulty}
            </span>
          )}
        </div>

        <h3 className="text-white font-medium mb-2 line-clamp-2 group-hover:text-primary-300 transition-colors">
          {content.title}
        </h3>
        
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
          {content.description}
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <BookOpen size={12} />
            <span>{content.course || 'No course assigned'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar size={12} />
            <span>{content.createdAt?.toLocaleDateString() || 'N/A'}</span>
          </div>

          {isFromCourse && 'instructor' in content && content.instructor && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <User size={12} />
              <span>Instructor: {content.instructor}</span>
            </div>
          )}

          {'duration' in content && content.duration && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock size={12} />
              <span>Duration: {content.duration}</span>
            </div>
          )}

          {'fileSize' in content && content.fileSize && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <FileText size={12} />
              <span>{formatFileSize(content.fileSize)}</span>
            </div>
          )}

          {content.type === 'course' && content.totalLessons && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <BookOpen size={12} />
              <span>{content.totalLessons} lessons</span>
            </div>
          )}

          {/* Course Features */}
          {content.hasQnA && (
            <div className="flex items-center gap-2 text-xs text-primary-400">
              <CheckCircle size={12} />
              <span>Q&A Available</span>
            </div>
          )}
          {content.hasStudyPlanner && (
            <div className="flex items-center gap-2 text-xs text-secondary-400">
              <CheckCircle size={12} />
              <span>Study Planner</span>
            </div>
          )}
        </div>

        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {content.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="px-2 py-1 bg-background-800 text-xs text-gray-300 rounded">
                {tag}
              </span>
            ))}
            {content.tags.length > 3 && (
              <span className="px-2 py-1 bg-background-800 text-xs text-gray-300 rounded">
                +{content.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Topics */}
        {content.topics && content.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {content.topics.slice(0, 2).map((topic: string) => (
              <span key={topic} className="px-2 py-1 bg-secondary-900 text-secondary-300 text-xs rounded">
                {topic}
              </span>
            ))}
            {content.topics.length > 2 && (
              <span className="px-2 py-1 bg-secondary-900 text-secondary-300 text-xs rounded">
                +{content.topics.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-background-800 bg-card-dark">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onView(content)}
              className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
              title={isFromCourse ? "Open course content" : "View content"}
            >
              {isFromCourse ? <Play size={14} /> : <Eye size={14} />}
            </button>
            
            {(content.fileUrl || content.videoUrl || content.pdfUrl) && (
              <button
                onClick={() => onDownload(content)}
                className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                title="Download content"
              >
                <Download size={14} />
              </button>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(content)}
                className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                title="Edit content"
                disabled={isFromCourse}
              >
                <Edit size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

interface ContentListItemProps extends ContentCardProps {}

const ContentListItem = ({
  content,
  onDownload,
  onView,
  onEdit,
  getTypeIcon,
  getDifficultyColor,
  formatFileSize,
  canEdit
}: ContentListItemProps) => {
  const isFromCourse = 'isFromCourse' in content && content.isFromCourse;
  
  return (
    <Card className="p-4 hover:bg-background-800/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            {getTypeIcon(content.type)}
            {isFromCourse && (
              <span className="text-xs bg-primary-900 text-primary-300 px-2 py-1 rounded">
                Course
              </span>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-white font-medium truncate">{content.title}</h3>
              {content.difficulty && (
                <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyColor(content.difficulty)}`}>
                  {content.difficulty}
                </span>
              )}
              {content.hasQnA && (
                <span className="text-xs text-primary-400">Q&A</span>
              )}
              {content.hasStudyPlanner && (
                <span className="text-xs text-secondary-400">Planner</span>
              )}
            </div>
            <p className="text-gray-400 text-sm truncate mb-1">{content.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>{content.course || 'No course assigned'}</span>
              <span>{content.createdAt?.toLocaleDateString() || 'N/A'}</span>
              {isFromCourse && content.instructor && (
                <span>Instructor: {content.instructor}</span>
              )}
              {'duration' in content && content.duration && (
                <span>Duration: {content.duration}</span>
              )}
              {'fileSize' in content && content.fileSize && (
                <span>{formatFileSize(content.fileSize)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onView(content)}
            className="p-2 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
            title={isFromCourse ? "Open course content" : "View content"}
          >
            {isFromCourse ? <Play size={16} /> : <Eye size={16} />}
          </button>
          
          {(content.fileUrl || content.videoUrl || content.pdfUrl) && (
            <button
              onClick={() => onDownload(content)}
              className="p-2 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
              title="Download content"
            >
              <Download size={16} />
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => onEdit(content)}
              className="p-2 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
              title="Edit content"
              disabled={isFromCourse}
            >
              <Edit size={16} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ContentLibrary;
