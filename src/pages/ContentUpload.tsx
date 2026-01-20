// src/pages/ContentUpload.tsx - PART 1/3
// NOTE: This file exports the ContentManage component (naming is intentional)

import { useState, useEffect } from 'react';
import { Plus, BookOpen, FileText, PenTool, BrainCircuit, Search, Filter, X, Grid, List, Eye, Edit, Trash2, BarChart3, Loader, Download, Calendar, Users, Award } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content } from '../services/contentService';
import ContentUpload from './ContentManage';

const ContentManage = () => {
  const { user } = useDashboard();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'note' | 'trick' | 'exam'>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<Content[]>([]);
  const [filteredContents, setFilteredContents] = useState<Content[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('month');
  const [analyticsCourseFilter, setAnalyticsCourseFilter] = useState<string>('all');
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    lessons: 0,
    notes: 0,
    tricks: 0,
    exams: 0
  });

  useEffect(() => {
    if (user?.uid) {
      loadContents();
      loadSubjects();
    }
  }, [user]);

  useEffect(() => {
    filterContents();
  }, [searchTerm, filterType, filterSubject, contents]);

  const loadContents = async () => {
    try {
      setLoading(true);
      const data = await contentService.getContentByUser(user?.uid || '');
      console.log('Loaded contents:', data);
      setContents(data);
      
      // Calculate stats
      const newStats = {
        total: data.length,
        lessons: data.filter(c => c.type === 'lesson').length,
        notes: data.filter(c => c.type === 'note').length,
        tricks: data.filter(c => c.type === 'trick').length,
        exams: data.filter(c => c.type === 'exam').length
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error loading contents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const allSubjects = await contentService.getAllSubjects();
      setSubjects(allSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const filterContents = () => {
    let filtered = contents;

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(content =>
        content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.customId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(content => content.type === filterType);
    }

    // Apply subject filter
    if (filterSubject !== 'all') {
      filtered = filtered.filter(content => content.subject === filterSubject);
    }

    setFilteredContents(filtered);
  };

  const handleCloseModal = () => {
    setShowUploadModal(false);
    setShowEditModal(false);
    setSelectedContent(null);
    loadContents(); // Reload after creating/editing content
  };

  const handleViewOverview = (content: Content) => {
    setSelectedContent(content);
    setShowOverview(true);
  };

  const handleEdit = (content: Content) => {
    setSelectedContent(content);
    setShowEditModal(true);
  };

  const handleDelete = async (content: Content) => {
    if (!window.confirm(`Are you sure you want to delete "${content.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await contentService.deleteContent(content.id);
      await loadContents();
      setShowOverview(false);
      alert('Content deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting content:', error);
      alert(error.message || 'Failed to delete content');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAnalytics = async (content: Content) => {
    setSelectedContent(content);
    setShowAnalytics(true);
    await loadAnalytics(content.id);
  };

  const loadAnalytics = async (contentId: string) => {
    try {
      setLoadingAnalytics(true);
      const courseFilter = analyticsCourseFilter === 'all' ? undefined : analyticsCourseFilter;
      const data = await contentService.getContentAnalytics(contentId, analyticsTimeRange, courseFilter);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (showAnalytics && selectedContent) {
      loadAnalytics(selectedContent.id);
    }
  }, [analyticsTimeRange, analyticsCourseFilter]);

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'lesson': return <BookOpen size={20} className="text-blue-400" />;
      case 'note': return <FileText size={20} className="text-green-400" />;
      case 'trick': return <PenTool size={20} className="text-purple-400" />;
      case 'exam': return <BrainCircuit size={20} className="text-orange-400" />;
      default: return <FileText size={20} />;
    }
  };

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'lesson': return 'bg-blue-900/20 text-blue-400 border-blue-500/30';
      case 'note': return 'bg-green-900/20 text-green-400 border-green-500/30';
      case 'trick': return 'bg-purple-900/20 text-purple-400 border-purple-500/30';
      case 'exam': return 'bg-orange-900/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-900/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const renderContentCard = (content: Content) => {
    if (viewMode === 'grid') {
      return (
        <Card key={content.id} className="hover:border-primary-500/50 transition-all cursor-pointer group">
          <div onClick={() => handleViewOverview(content)}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getContentTypeIcon(content.type)}
                <span className={`text-xs px-2 py-1 rounded border ${getContentTypeColor(content.type)}`}>
                  {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
                </span>
              </div>
              <span className="text-xs text-gray-500">ID: {content.customId}</span>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors line-clamp-2">
              {content.title}
            </h3>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="font-medium">Subject:</span>
                <span>{content.subject}</span>
              </div>
              {content.category && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="font-medium">Category:</span>
                  <span>{content.category}</span>
                </div>
              )}
              {content.duration > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar size={14} />
                  <span>{content.type === 'exam' ? content.durationFormatted : formatDuration(content.duration)}</span>
                </div>
              )}
            </div>

            {content.tags && content.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {content.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 bg-background-700 text-gray-400 rounded">
                    {tag}
                  </span>
                ))}
                {content.tags.length > 3 && (
                  <span className="text-xs px-2 py-1 bg-background-700 text-gray-400 rounded">
                    +{content.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-background-700">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Eye size={12} />
                  <span>{content.viewCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span>{content.uniqueViewers || 0}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewOverview(content);
                }}
                className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-1"
              >
                <Eye size={14} />
                Overview
              </button>
            </div>
          </div>
        </Card>
      );
    } else {
      // List view
      return (
        <Card key={content.id} className="hover:border-primary-500/50 transition-all cursor-pointer">
          <div onClick={() => handleViewOverview(content)} className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                {getContentTypeIcon(content.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-white truncate">{content.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded border ${getContentTypeColor(content.type)} whitespace-nowrap`}>
                    {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>ID: {content.customId}</span>
                  <span>•</span>
                  <span>{content.subject}</span>
                  {content.category && (
                    <>
                      <span>•</span>
                      <span>{content.category}</span>
                    </>
                  )}
                  {content.duration > 0 && (
                    <>
                      <span>•</span>
                      <span>{content.type === 'exam' ? content.durationFormatted : formatDuration(content.duration)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Eye size={12} />
                  <span>{content.viewCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span>{content.uniqueViewers || 0}</span>
                </div>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewOverview(content);
                }}
                className="text-primary-400 hover:text-primary-300 text-sm font-medium flex items-center gap-1 whitespace-nowrap"
              >
                <Eye size={14} />
                Overview
              </button>
            </div>
          </div>
        </Card>
      );
    }
  };
// src/pages/ContentUpload.tsx - PART 2/3
// CONTINUATION - Modal render functions for overview and analytics

  const renderOverviewModal = () => {
    if (!selectedContent) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
          <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedContent.title}</h2>
              <p className="text-gray-400 text-sm mt-1">Content Overview</p>
            </div>
            <button
              onClick={() => setShowOverview(false)}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-400">Content ID</label>
                <p className="text-white mt-1">{selectedContent.customId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Type</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded border ${getContentTypeColor(selectedContent.type)}`}>
                    {getContentTypeIcon(selectedContent.type)}
                    {selectedContent.type.charAt(0).toUpperCase() + selectedContent.type.slice(1)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Subject</label>
                <p className="text-white mt-1">{selectedContent.subject}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Category</label>
                <p className="text-white mt-1">{selectedContent.category || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Difficulty</label>
                <p className="text-white mt-1 capitalize">{selectedContent.difficulty.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Language</label>
                <p className="text-white mt-1">{selectedContent.language || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Version</label>
                <p className="text-white mt-1">{selectedContent.version || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Duration</label>
                <p className="text-white mt-1">
                  {selectedContent.type === 'exam' 
                    ? selectedContent.durationFormatted 
                    : formatDuration(selectedContent.duration)}
                </p>
              </div>
            </div>

            {/* Description */}
            {selectedContent.description && (
              <div>
                <label className="text-sm font-medium text-gray-400">Description</label>
                <p className="text-white mt-1">{selectedContent.description}</p>
              </div>
            )}

            {/* Tags */}
            {selectedContent.tags && selectedContent.tags.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {selectedContent.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-primary-900 text-primary-300 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            <div className="grid grid-cols-2 gap-4">
              {selectedContent.videoUrl && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Video File</label>
                  <a
                    href={selectedContent.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-background-800 hover:bg-background-700 text-primary-400 rounded-lg transition-colors"
                  >
                    <Download size={16} />
                    {selectedContent.videoFileName || 'Download Video'}
                  </a>
                </div>
              )}
              {selectedContent.noteUrl && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Note File</label>
                  <a
                    href={selectedContent.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-background-800 hover:bg-background-700 text-primary-400 rounded-lg transition-colors"
                  >
                    <Download size={16} />
                    {selectedContent.noteFileName || 'Download Note'}
                  </a>
                </div>
              )}
            </div>

            {/* Exam Details */}
            {selectedContent.type === 'exam' && (
              <div className="border-t border-background-700 pt-6 space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Exam Details</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Exam Type</label>
                    <p className="text-xl font-bold text-white mt-1 capitalize">{selectedContent.examType}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Total Questions</label>
                    <p className="text-xl font-bold text-primary-400 mt-1">{selectedContent.totalQuestions}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Questions to Show</label>
                    <p className="text-xl font-bold text-blue-400 mt-1">{selectedContent.questionsToShow}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Total Marks</label>
                    <p className="text-xl font-bold text-yellow-400 mt-1">{selectedContent.totalMarks}</p>
                  </div>
                </div>

                {/* MCQ Section */}
                {selectedContent.mcqQuestions && selectedContent.mcqQuestions.length > 0 && (
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-blue-400 mb-3">
                      MCQ Section ({selectedContent.mcqQuestions.length} questions)
                    </h4>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <label className="text-sm text-gray-400">Duration</label>
                        <p className="text-white mt-1">{selectedContent.mcqDuration ? `${selectedContent.mcqDuration.toFixed(1)} min` : 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Questions to Show</label>
                        <p className="text-white mt-1">{selectedContent.mcqQuestionsToShow || selectedContent.mcqQuestions.length}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Total Marks</label>
                        <p className="text-white mt-1">
                          {selectedContent.mcqQuestions.reduce((sum, q) => sum + q.correctMarks, 0)}
                        </p>
                      </div>
                    </div>
                    {selectedContent.mcqDirection && (
                      <div>
                        <label className="text-sm text-gray-400">Instructions</label>
                        <p className="text-white mt-1 text-sm">{selectedContent.mcqDirection}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Written Section */}
                {selectedContent.writtenQuestions && selectedContent.writtenQuestions.length > 0 && (
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-green-400 mb-3">
                      Written Section ({selectedContent.writtenQuestions.length} questions)
                    </h4>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <label className="text-sm text-gray-400">Duration</label>
                        <p className="text-white mt-1">{selectedContent.writtenDuration ? `${selectedContent.writtenDuration.toFixed(1)} min` : 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Questions to Show</label>
                        <p className="text-white mt-1">{selectedContent.writtenQuestionsToShow || selectedContent.writtenQuestions.length}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Total Marks</label>
                        <p className="text-white mt-1">
                          {selectedContent.writtenQuestions.reduce((sum, q) => sum + q.marks, 0)}
                        </p>
                      </div>
                    </div>
                    {selectedContent.writtenDirection && (
                      <div>
                        <label className="text-sm text-gray-400">Instructions</label>
                        <p className="text-white mt-1 text-sm">{selectedContent.writtenDirection}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Analytics Summary */}
            <div className="border-t border-background-700 pt-6">
              <h3 className="text-xl font-semibold text-white mb-4">Analytics Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background-800 p-4 rounded-lg">
                  <label className="text-sm text-gray-400">Total Views</label>
                  <p className="text-2xl font-bold text-primary-400 mt-1">{selectedContent.viewCount || 0}</p>
                </div>
                <div className="bg-background-800 p-4 rounded-lg">
                  <label className="text-sm text-gray-400">Unique Viewers</label>
                  <p className="text-2xl font-bold text-blue-400 mt-1">{selectedContent.uniqueViewers || 0}</p>
                </div>
                <div className="bg-background-800 p-4 rounded-lg">
                  <label className="text-sm text-gray-400">Courses Using</label>
                  <p className="text-2xl font-bold text-green-400 mt-1">{selectedContent.coursesUsing?.length || 0}</p>
                </div>
                <div className="bg-background-800 p-4 rounded-lg">
                  <label className="text-sm text-gray-400">Created</label>
                  <p className="text-sm text-white mt-1">
                    {selectedContent.createdAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-background-700">
              <button
                onClick={() => {
                  setShowOverview(false);
                  handleEdit(selectedContent);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <Edit size={20} />
                Edit
              </button>
              <button
                onClick={() => {
                  setShowOverview(false);
                  handleViewAnalytics(selectedContent);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <BarChart3 size={20} />
                Analytics
              </button>
              <button
                onClick={() => handleDelete(selectedContent)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-error-600 hover:bg-error-700 text-white rounded-lg transition-colors font-medium"
              >
                <Trash2 size={20} />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticsModal = () => {
    if (!selectedContent || !showAnalytics) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
          <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
                <p className="text-gray-400 text-sm mt-1">{selectedContent.title}</p>
              </div>
              <button
                onClick={() => setShowAnalytics(false)}
                className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
              <select
                value={analyticsTimeRange}
                onChange={(e) => setAnalyticsTimeRange(e.target.value)}
                className="bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>

              {analytics?.coursesUsing && analytics.coursesUsing.length > 0 && (
                <select
                  value={analyticsCourseFilter}
                  onChange={(e) => setAnalyticsCourseFilter(e.target.value)}
                  className="bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Courses</option>
                  {analytics.coursesUsing.map((course: any) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.courseName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-primary-400" size={48} />
              </div>
            ) : analytics ? (
              <>
                {/* Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <Eye size={16} />
                      <label className="text-sm">Total Views</label>
                    </div>
                    <p className="text-3xl font-bold text-primary-400">{analytics.totalViews}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <Users size={16} />
                      <label className="text-sm">Unique Viewers</label>
                    </div>
                    <p className="text-3xl font-bold text-blue-400">{analytics.uniqueViewers}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                      <BookOpen size={16} />
                      <label className="text-sm">Courses Using</label>
                    </div>
                    <p className="text-3xl font-bold text-green-400">{analytics.coursesUsing.length}</p>
                  </div>
                  {analytics.examStats && (
                    <div className="bg-background-800 p-4 rounded-lg">
                      <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Award size={16} />
                        <label className="text-sm">Avg Score</label>
                      </div>
                      <p className="text-3xl font-bold text-yellow-400">
                        {analytics.examStats.averagePercentage.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Views Chart */}
                {analytics.viewsByDate && analytics.viewsByDate.length > 0 && (
                  <div className="bg-background-800 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Views Over Time</h3>
                    <div className="h-64 flex items-end gap-2">
                      {analytics.viewsByDate.map((item: any, index: number) => {
                        const maxViews = Math.max(...analytics.viewsByDate.map((d: any) => d.count));
                        const height = maxViews > 0 ? (item.count / maxViews) * 100 : 0;
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-primary-500 rounded-t hover:bg-primary-400 transition-colors cursor-pointer"
                              style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                              title={`${item.date}: ${item.count} views`}
                            />
                            <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                              {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Courses Using This Content */}
                {analytics.coursesUsing && analytics.coursesUsing.length > 0 && (
                  <div className="bg-background-800 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Courses Using This Content</h3>
                    <div className="space-y-3">
                      {analytics.coursesUsing.map((course: any) => (
                        <div key={course.courseId} className="flex items-center justify-between p-3 bg-background-700 rounded-lg">
                          <span className="text-white">{course.courseName}</span>
                          <span className="text-primary-400 font-medium">{course.viewCount} views</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exam Statistics */}
                {analytics.examStats && (
                  <div className="space-y-6">
                    <div className="bg-background-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold text-white mb-4">Exam Performance</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm text-gray-400">Total Attempts</label>
                          <p className="text-2xl font-bold text-primary-400 mt-1">
                            {analytics.examStats.totalAttempts}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Average Score</label>
                          <p className="text-2xl font-bold text-blue-400 mt-1">
                            {analytics.examStats.averageScore.toFixed(1)} / {selectedContent.totalMarks}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Average Percentage</label>
                          <p className="text-2xl font-bold text-green-400 mt-1">
                            {analytics.examStats.averagePercentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* MCQ Statistics */}
                    {analytics.examStats.mcqStats && analytics.examStats.mcqStats.length > 0 && (
                      <div className="bg-background-800 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-white mb-4">MCQ Question Performance</h3>
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {analytics.examStats.mcqStats.map((stat: any, index: number) => (
                            <div key={stat.questionId} className="p-4 bg-background-700 rounded-lg">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="text-white font-medium mb-1">Question #{index + 1}</h4>
                                  <p className="text-sm text-gray-400 line-clamp-2">{stat.question}</p>
                                </div>
                                <div className="ml-4">
                                  <span className={`text-lg font-bold ${
                                    stat.correctRate >= 70 ? 'text-green-400' : 
                                    stat.correctRate >= 40 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {stat.correctRate.toFixed(1)}%
                                  </span>
                                  <p className="text-xs text-gray-500">correct rate</p>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2">
                                {stat.optionStats.map((opt: any) => (
                                  <div key={opt.option} className="flex items-center justify-between p-2 bg-background-800 rounded">
                                    <span className="text-sm text-gray-300">Option {String.fromCharCode(65 + opt.option)}</span>
                                    <span className="text-sm font-medium text-primary-400">{opt.percentage.toFixed(1)}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                No analytics data available yet
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
// src/pages/ContentUpload.tsx - PART 3/3
// FINAL PART - Main JSX return and component export

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Management</h1>
          <p className="text-gray-400 mt-1">Manage your educational content</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-lg"
        >
          <Plus size={20} />
          <span>Create Content</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900/20 rounded-lg">
              <BookOpen size={24} className="text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Lessons</p>
              <p className="text-2xl font-bold text-white">{stats.lessons}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-900/20 rounded-lg">
              <FileText size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Notes</p>
              <p className="text-2xl font-bold text-white">{stats.notes}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-900/20 rounded-lg">
              <PenTool size={24} className="text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Tricks</p>
              <p className="text-2xl font-bold text-white">{stats.tricks}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-900/20 rounded-lg">
              <BrainCircuit size={24} className="text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Exams</p>
              <p className="text-2xl font-bold text-white">{stats.exams}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, ID, subject, or tags..."
                className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-primary-600 text-white'
                    : 'bg-background-800 text-gray-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-background-800 text-gray-400 hover:text-white'
                }`}
                title="List View"
              >
                <List size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Filter size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
              >
                <option value="all">All Content Types</option>
                <option value="lesson">Lessons</option>
                <option value="note">Notes</option>
                <option value="trick">Tricks & Hacks</option>
                <option value="exam">Exams</option>
              </select>
            </div>

            <div className="relative">
              <Filter size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
              >
                <option value="all">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
          </div>

          {(searchTerm || filterType !== 'all' || filterSubject !== 'all') && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Showing {filteredContents.length} of {contents.length} content{contents.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                  setFilterSubject('all');
                }}
                className="text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <X size={14} />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Content List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-primary-400" size={48} />
        </div>
      ) : filteredContents.length > 0 ? (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-4'
        }>
          {filteredContents.map(content => renderContentCard(content))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <div className="mb-4">
              <BookOpen size={64} className="mx-auto text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              {contents.length === 0 ? 'No Content Yet' : 'No Matching Content'}
            </h3>
            <p className="text-gray-400 mb-6">
              {contents.length === 0
                ? 'Get started by creating your first educational content'
                : 'Try adjusting your search or filters'}
            </p>
            {contents.length === 0 && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
              >
                <Plus size={20} />
                <span>Create Your First Content</span>
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Create Content Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background-900 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
            <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Create New Content</h2>
                <p className="text-gray-400 text-sm mt-1">Upload educational materials for your students</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <ContentUpload onClose={handleCloseModal} isModal={true} />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedContent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background-900 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
            <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Edit Content</h2>
                <p className="text-gray-400 text-sm mt-1">{selectedContent.title}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <ContentUpload
                onClose={handleCloseModal}
                isModal={true}
                editContent={selectedContent}
              />
            </div>
          </div>
        </div>
      )}

      {/* Overview Modal */}
      {showOverview && renderOverviewModal()}

      {/* Analytics Modal */}
      {showAnalytics && renderAnalyticsModal()}
    </div>
  );
};

export default ContentManage;
