// src/pages/ContentUpload.tsx - PART 1/6
// MERGED: ContentUpload + ContentManage into single component
// This file contains ALL functionality from both original files
// UPDATED: Added Platform B secure video streaming integration

import { useState, useEffect } from 'react';
import { 
  Upload, FileText, BookOpen, PenTool, BrainCircuit, Plus, X, Loader, Clock, 
  Video, FileUp, Image as ImageIcon, Trash2, Eye, Lock, Unlock, ArrowLeft, Edit,
  Search, Filter, Grid, List, BarChart3, Download, Calendar, Users, Award,
  Shield, Link, ExternalLink
} from 'lucide-react';
import Card from '../components/ui/Card';
import { contentService, Content, parseGDriveLink } from '../services/contentService';
import { videoStreamService, VideoSourcePlatform } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// ── Bunny.net local video upload flag ──
// Set VITE_BUNNY_ENABLED=true in .env once you have Bunny.net credentials.
// When false, the "Local Upload" tab is shown but disabled with a clear message.
const BUNNY_LOCAL_UPLOAD_ENABLED = import.meta.env.VITE_BUNNY_ENABLED === 'true';

// ==================== INTERFACES ====================

interface UploadProgress {
  fileName: string;
  percentage: number;
  speed?: number;
  stage: string;
}

interface MCQQuestion {
  id: string;
  question: string;
  questionImage?: File | null;
  options: string[];
  correctOptions: number[];
  correctMarks: number;
  wrongMarks: number;
  skipMarks: number;
  solution: string;
  solutionImage?: File | null;
  isLocked: boolean;
  lockedPosition: 'first' | 'last' | null;
}

interface WrittenQuestion {
  id: string;
  question: string;
  questionImage?: File | null;
  solution: string;
  solutionImage?: File | null;
  marks: number;
  isLocked: boolean;
  lockedPosition: 'first' | 'last' | null;
}

interface FormData {
  id: string;
  title: string;
  subject: string;
  category: string;
  description: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  language: string;
  version: string;
  duration: { hours: number; minutes: number; seconds: number };
  videoFile: File | null;
  noteFile: File | null;
  noteInputMethod: 'local' | 'gdrive';
  gDriveLinkInput: string;
  noteGDrivePreviewUrl: string;
  noteGDriveDownloadUrl: string;
  totalQuestions: number;
  questionsToShow: number;
  mcqDuration: { hours: number; minutes: number; seconds: number };
  writtenDuration: { hours: number; minutes: number; seconds: number };
  mcqQuestionsToShow: number;
  writtenQuestionsToShow: number;
  mcqDirection: string;
  writtenDirection: string;
  maxAttempts: number | 'unlimited';
  examTimelineType: 'anytime' | 'scheduled';
  examStartDateTime: string;
  examEndDateTime: string;
  resultPublishType: 'immediate' | 'scheduled';
  resultPublishDateTime: string;
}

interface ExamVersion {
  id: string;
  versionName: string;
  mcqQuestions: MCQQuestion[];
  writtenQuestions: WrittenQuestion[];
  mcqDuration: { hours: number; minutes: number; seconds: number };
  writtenDuration: { hours: number; minutes: number; seconds: number };
  mcqQuestionsToShow: number;
  writtenQuestionsToShow: number;
  mcqDirection: string;
  writtenDirection: string;
}

interface CurrentMcqQuestion {
  question: string;
  questionImage: File | null;
  options: string[];
  correctOptions: number[];
  correctMarks: number;
  wrongMarks: number;
  skipMarks: number;
  solution: string;
  solutionImage: File | null;
}

interface CurrentWrittenQuestion {
  question: string;
  questionImage: File | null;
  solution: string;
  solutionImage: File | null;
  marks: number;
}

// ==================== NEW: Platform B video method type ====================
type VideoInputMethod = 'local' | 'secured';

// ==================== MAIN COMPONENT ====================

const ContentUpload = () => {
  const { user } = useDashboard();

  // ==================== VIEW MODE STATE ====================
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [showOverview, setShowOverview] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // ==================== CONTENT LIST STATE ====================
  const [contents, setContents] = useState<Content[]>([]);
  const [filteredContents, setFilteredContents] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<any>(null);
  
  // ==================== SEARCH & FILTER STATE ====================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'note' | 'trick' | 'exam'>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [subjects, setSubjects] = useState<string[]>([]);
  
  // ==================== STATS STATE ====================
  const [stats, setStats] = useState({
    total: 0,
    lessons: 0,
    notes: 0,
    tricks: 0,
    exams: 0
  });

  // ==================== LOADING & MESSAGES STATE ====================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ==================== ANALYTICS STATE ====================
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('month');
  const [analyticsCourseFilter, setAnalyticsCourseFilter] = useState<string>('all');

  // ==================== CREATION FORM STATE ====================
  const [uploadType, setUploadType] = useState<'lesson' | 'note' | 'trick' | 'exam'>('lesson');
  const [examType, setExamType] = useState<'mcq' | 'written' | 'mixed'>('mcq');
  const [currentTag, setCurrentTag] = useState('');
  const [currentQuestionType, setCurrentQuestionType] = useState<'mcq' | 'written'>('mcq');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // ==================== NEW: Platform B state ====================
  // Controls whether video input uses local file upload or Platform B secured URL
  const [videoInputMethod, setVideoInputMethod] = useState<VideoInputMethod>('local');
  // The source URL the user pastes (Dropbox, GDrive, YouTube, etc.)
  const [securedVideoSourceUrl, setSecuredVideoSourceUrl] = useState('');
  // Which platform the source URL belongs to
  const [securedVideoPlatform, setSecuredVideoPlatform] = useState<VideoSourcePlatform>('dropbox');
  // Loading state while calling the Platform B API
  const [securingVideo, setSecuringVideo] = useState(false);
  // After successful submission, the opaque proxy URL (secured://<id>)
  const [securedProxyUrl, setSecuredProxyUrl] = useState('');
  // Human-readable label shown after securing
  const [securedVideoLabel, setSecuredVideoLabel] = useState('');
  // Validation error for the source URL field
  const [securedVideoError, setSecuredVideoError] = useState('');

  // ==================== NEW: GDrive note state ====================
  const [gDriveLinkError, setGDriveLinkError] = useState('');

  // ==================== FORM DATA STATE ====================
  const [formData, setFormData] = useState<FormData>({
    id: '',
    title: '',
    subject: '',
    category: '',
    description: '',
    tags: [],
    difficulty: 'medium',
    language: '',
    version: '',
    duration: { hours: 0, minutes: 0, seconds: 0 },
    videoFile: null,
    noteFile: null,
    noteInputMethod: 'local',
    gDriveLinkInput: '',
    noteGDrivePreviewUrl: '',
    noteGDriveDownloadUrl: '',
    totalQuestions: 0,
    questionsToShow: 0,
    mcqDuration: { hours: 0, minutes: 0, seconds: 0 },
    writtenDuration: { hours: 0, minutes: 0, seconds: 0 },
    mcqQuestionsToShow: 0,
    writtenQuestionsToShow: 0,
    mcqDirection: '',
    writtenDirection: '',
    maxAttempts: 1,
    examTimelineType: 'anytime',
    examStartDateTime: '',
    examEndDateTime: '',
    resultPublishType: 'immediate',
    resultPublishDateTime: ''
  });

  // ==================== QUESTIONS STATE ====================
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [writtenQuestions, setWrittenQuestions] = useState<WrittenQuestion[]>([]);
  const [examVersions, setExamVersions] = useState<ExamVersion[]>([]);
  const [versionQuestionTarget, setVersionQuestionTarget] = useState<{ versionIdx: number; type: 'mcq' | 'written' } | null>(null);
  const [editingVersionIdx, setEditingVersionIdx] = useState<number | null>(null);
  
  const [currentMcqQuestion, setCurrentMcqQuestion] = useState<CurrentMcqQuestion>({
    question: '',
    questionImage: null,
    options: ['', ''],
    correctOptions: [],
    correctMarks: 1,
    wrongMarks: 0,
    skipMarks: 0,
    solution: '',
    solutionImage: null
  });

  const [currentWrittenQuestion, setCurrentWrittenQuestion] = useState<CurrentWrittenQuestion>({
    question: '',
    questionImage: null,
    solution: '',
    solutionImage: null,
    marks: 1
  });

  // ==================== INITIAL LOAD EFFECTS ====================
  
  useEffect(() => {
    if (user?.uid) {
      loadContents();
      loadSubjects();
    }
  }, [user]);

  useEffect(() => {
    filterContents();
  }, [searchTerm, filterType, filterSubject, contents]);

  useEffect(() => {
    if (showAnalytics && selectedContent) {
      loadAnalytics(selectedContent.id);
    }
  }, [analyticsTimeRange, analyticsCourseFilter]);

  // ==================== DATA LOADING FUNCTIONS ====================

  const loadContents = async () => {
    try {
      setLoading(true);
      const data = await contentService.getContentByUser(user?.uid || '');
      console.log('Loaded contents:', data);
      setContents(data);
      
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
      setError('Failed to load contents');
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

    if (searchTerm) {
      filtered = filtered.filter(content =>
        content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.customId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(content => content.type === filterType);
    }

    if (filterSubject !== 'all') {
      filtered = filtered.filter(content => content.subject === filterSubject);
    }

    setFilteredContents(filtered);
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

  // ==================== NAVIGATION FUNCTIONS ====================

  const openCreateForm = () => {
    resetForm();
    setEditingContent(null);
    setViewMode('create');
  };

  const openEditForm = (content: Content) => {
    setEditingContent(content);
    loadContentIntoForm(content);
    setViewMode('create');
    setShowOverview(false);
  };

  const closeCreateForm = () => {
    resetForm();
    setEditingContent(null);
    setViewMode('list');
    loadContents();
  };

  const handleViewOverview = (content: Content) => {
    setSelectedContent(content);
    setShowOverview(true);
  };

  const handleViewAnalytics = async (content: Content) => {
    setSelectedContent(content);
    setShowAnalytics(true);
    await loadAnalytics(content.id);
  };

  // ==================== CONTENT OPERATIONS ====================

  const handleDelete = async (content: Content) => {
    if (!window.confirm(`Are you sure you want to delete "${content.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await contentService.deleteContent(content.id);
      await loadContents();
      setShowOverview(false);
      setSuccess('Content deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error deleting content:', error);
      setError(error.message || 'Failed to delete content');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FORM POPULATION FOR EDIT ====================

  const loadContentIntoForm = (content: Content) => {
    const durationHours = Math.floor(content.duration / 60);
    const durationMinutes = Math.floor(content.duration % 60);
    const durationSeconds = Math.floor((content.duration % 1) * 60);

    setFormData({
      id: content.customId,
      title: content.title,
      subject: content.subject,
      category: content.category || '',
      description: content.description || '',
      tags: content.tags || [],
      difficulty: content.difficulty,
      language: content.language || '',
      version: content.version || '',
      duration: { 
        hours: durationHours, 
        minutes: durationMinutes, 
        seconds: durationSeconds 
      },
      videoFile: null,
      noteFile: null,
      noteInputMethod: (content.noteSource as 'local' | 'gdrive') || 'local',
      gDriveLinkInput: content.noteSource === 'gdrive' ? (content.noteGDrivePreviewUrl || '') : '',
      noteGDrivePreviewUrl: content.noteGDrivePreviewUrl || '',
      noteGDriveDownloadUrl: content.noteGDriveDownloadUrl || '',
      totalQuestions: content.totalQuestions || 0,
      questionsToShow: content.questionsToShow || 0,
      mcqDuration: { 
        hours: Math.floor((content.mcqDuration || 0) / 60),
        minutes: Math.floor((content.mcqDuration || 0) % 60),
        seconds: Math.floor(((content.mcqDuration || 0) % 1) * 60)
      },
      writtenDuration: { 
        hours: Math.floor((content.writtenDuration || 0) / 60),
        minutes: Math.floor((content.writtenDuration || 0) % 60),
        seconds: Math.floor(((content.writtenDuration || 0) % 1) * 60)
      },
      mcqQuestionsToShow: content.mcqQuestionsToShow || 0,
      writtenQuestionsToShow: content.writtenQuestionsToShow || 0,
      mcqDirection: content.mcqDirection || '',
      writtenDirection: content.writtenDirection || '',
      maxAttempts: content.maxAttempts ?? 1,
      examTimelineType: content.examTimelineType || 'anytime',
      examStartDateTime: content.examStartDateTime || '',
      examEndDateTime: content.examEndDateTime || '',
      resultPublishType: content.resultPublishType || 'immediate',
      resultPublishDateTime: content.resultPublishDateTime || ''
    });

    setUploadType(content.type);

    // ── NEW: If the existing content has a secured:// video URL, restore Platform B state ──
    if (content.videoUrl && content.videoUrl.startsWith('secured://')) {
      setVideoInputMethod('secured');
      setSecuredProxyUrl(content.videoUrl);
      setSecuredVideoLabel(content.videoFileName || 'Secured video (existing)');
    } else {
      setVideoInputMethod('local');
      setSecuredProxyUrl('');
      setSecuredVideoLabel('');
    }

    if (content.type === 'exam') {
      setExamType(content.examType || 'mcq');
      
      // Note: global mcqQuestions/writtenQuestions are no longer used for exam type.
      // Legacy data is migrated into a version below.
      if (content.examVersions && content.examVersions.length > 0) {
        setExamVersions(content.examVersions.map((v: any) => ({
          ...v,
          mcqQuestions: (v.mcqQuestions || []).map((q: any) => ({ ...q, questionImage: null, solutionImage: null })),
          writtenQuestions: (v.writtenQuestions || []).map((q: any) => ({ ...q, questionImage: null, solutionImage: null })),
          mcqDuration: v.mcqDuration
            ? { hours: Math.floor(v.mcqDuration / 60), minutes: Math.floor(v.mcqDuration % 60), seconds: Math.floor((v.mcqDuration % 1) * 60) }
            : { hours: 0, minutes: 0, seconds: 0 },
          writtenDuration: v.writtenDuration
            ? { hours: Math.floor(v.writtenDuration / 60), minutes: Math.floor(v.writtenDuration % 60), seconds: Math.floor((v.writtenDuration % 1) * 60) }
            : { hours: 0, minutes: 0, seconds: 0 },
          mcqQuestionsToShow: v.mcqQuestionsToShow || 0,
          writtenQuestionsToShow: v.writtenQuestionsToShow || 0,
          mcqDirection: v.mcqDirection || '',
          writtenDirection: v.writtenDirection || ''
        })));
      } else {
        // Migrate legacy global questions into a single version if no versions exist
        const legacyMcq = content.mcqQuestions ? content.mcqQuestions.map((q: any) => ({ ...q, questionImage: null, solutionImage: null })) : [];
        const legacyWritten = content.writtenQuestions ? content.writtenQuestions.map((q: any) => ({ ...q, questionImage: null, solutionImage: null })) : [];
        if (legacyMcq.length > 0 || legacyWritten.length > 0) {
          setExamVersions([{
            id: Date.now().toString(),
            versionName: 'Version 1',
            mcqQuestions: legacyMcq,
            writtenQuestions: legacyWritten,
            mcqDuration: {
              hours: Math.floor((content.mcqDuration || 0) / 60),
              minutes: Math.floor((content.mcqDuration || 0) % 60),
              seconds: Math.floor(((content.mcqDuration || 0) % 1) * 60)
            },
            writtenDuration: {
              hours: Math.floor((content.writtenDuration || 0) / 60),
              minutes: Math.floor((content.writtenDuration || 0) % 60),
              seconds: Math.floor(((content.writtenDuration || 0) % 1) * 60)
            },
            mcqQuestionsToShow: content.mcqQuestionsToShow || 0,
            writtenQuestionsToShow: content.writtenQuestionsToShow || 0,
            mcqDirection: content.mcqDirection || '',
            writtenDirection: content.writtenDirection || ''
          }]);
        }
      }
    }
  };
  // ==================== FORM RESET ====================

  const resetForm = () => {
    setFormData({
      id: '',
      title: '',
      subject: '',
      category: '',
      description: '',
      tags: [],
      difficulty: 'medium',
      language: '',
      version: '',
      duration: { hours: 0, minutes: 0, seconds: 0 },
      videoFile: null,
      noteFile: null,
      noteInputMethod: 'local',
      gDriveLinkInput: '',
      noteGDrivePreviewUrl: '',
      noteGDriveDownloadUrl: '',
      totalQuestions: 0,
      questionsToShow: 0,
      mcqDuration: { hours: 0, minutes: 0, seconds: 0 },
      writtenDuration: { hours: 0, minutes: 0, seconds: 0 },
      mcqQuestionsToShow: 0,
      writtenQuestionsToShow: 0,
      mcqDirection: '',
      writtenDirection: '',
      maxAttempts: 1,
      examTimelineType: 'anytime',
      examStartDateTime: '',
      examEndDateTime: '',
      resultPublishType: 'immediate',
      resultPublishDateTime: ''
    });
    setCurrentTag('');
    setMcqQuestions([]);
    setWrittenQuestions([]);
    setExamVersions([]);
    setVersionQuestionTarget(null);
    setEditingVersionIdx(null);
    setExamType('mcq');
    setUploadProgress(null);
    setError('');
    setSuccess('');
    
    // ── NEW: Reset Platform B state ──
    setVideoInputMethod('local');
    setSecuredVideoSourceUrl('');
    setSecuredVideoPlatform('dropbox');
    setSecuringVideo(false);
    setSecuredProxyUrl('');
    setSecuredVideoLabel('');
    setSecuredVideoError('');
    
    const videoInput = document.getElementById('video-upload') as HTMLInputElement;
    const noteInput = document.getElementById('note-upload') as HTMLInputElement;
    if (videoInput) videoInput.value = '';
    if (noteInput) noteInput.value = '';
  };

  // ==================== FORM INPUT HANDLERS ====================

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleDurationChange = (field: 'hours' | 'minutes' | 'seconds', value: number) => {
    setFormData(prev => ({
      ...prev,
      duration: {
        ...prev.duration,
        [field]: Math.max(0, value)
      }
    }));
  };

  const handleMcqDurationChange = (field: 'hours' | 'minutes' | 'seconds', value: number) => {
    setFormData(prev => ({
      ...prev,
      mcqDuration: {
        ...prev.mcqDuration,
        [field]: Math.max(0, value)
      }
    }));
  };

  const handleWrittenDurationChange = (field: 'hours' | 'minutes' | 'seconds', value: number) => {
    setFormData(prev => ({
      ...prev,
      writtenDuration: {
        ...prev.writtenDuration,
        [field]: Math.max(0, value)
      }
    }));
  };

  // ==================== TAG MANAGEMENT ====================

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // ==================== FILE VALIDATION ====================

  const validateFile = (file: File, type: 'video' | 'note'): boolean => {
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size exceeds 500MB limit`);
      return false;
    }

    let allowedExtensions: string[] = [];
    if (type === 'video') {
      allowedExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv'];
    } else {
      allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.mp3', '.wav'];
    }

    const fileName = file.name.toLowerCase();
    const isValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidExtension) {
      setError(`Invalid file type for ${type}. Allowed: ${allowedExtensions.join(', ')}`);
      return false;
    }

    return true;
  };

  // ==================== FILE HANDLERS ====================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'note') => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (validateFile(file, type)) {
        if (type === 'video') {
          setFormData(prev => ({ ...prev, videoFile: file }));
        } else {
          setFormData(prev => ({ ...prev, noteFile: file }));
        }
        setError('');
      } else {
        e.target.value = '';
      }
    }
  };

  // ==================== GDRIVE NOTE HANDLER ====================

  const handleGDriveLinkSave = () => {
    setGDriveLinkError('');
    const parsed = parseGDriveLink(formData.gDriveLinkInput.trim());
    if (!parsed) {
      setGDriveLinkError('Invalid Google Drive link. Please paste a valid share link (e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing)');
      return;
    }
    setFormData(prev => ({
      ...prev,
      noteGDrivePreviewUrl: parsed.previewUrl,
      noteGDriveDownloadUrl: parsed.downloadUrl,
      noteFileName: `gdrive_${parsed.fileId}`,
      noteFile: null,
    }));
  };

  const handleQuestionImageChange = (e: React.ChangeEvent<HTMLInputElement>, questionType: 'mcq' | 'written') => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid image type. Allowed: JPG, PNG, GIF, WEBP');
        e.target.value = '';
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Image size exceeds 10MB limit');
        e.target.value = '';
        return;
      }

      if (questionType === 'mcq') {
        setCurrentMcqQuestion(prev => ({ ...prev, questionImage: file }));
      } else {
        setCurrentWrittenQuestion(prev => ({ ...prev, questionImage: file }));
      }
      setError('');
    }
  };

  const handleSolutionImageChange = (e: React.ChangeEvent<HTMLInputElement>, questionType: 'mcq' | 'written') => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid image type. Allowed: JPG, PNG, GIF, WEBP');
        e.target.value = '';
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('Image size exceeds 10MB limit');
        e.target.value = '';
        return;
      }

      if (questionType === 'mcq') {
        setCurrentMcqQuestion(prev => ({ ...prev, solutionImage: file }));
      } else {
        setCurrentWrittenQuestion(prev => ({ ...prev, solutionImage: file }));
      }
      setError('');
    }
  };

  // ==================== NEW: Platform B — Secure Video Handler ====================

  /**
   * Called when the user clicks "Secure & Generate Proxy URL".
   * Validates the URL client-side, then POSTs to /api/videoStream to get
   * the secured proxy URL which is stored in place of the original source URL.
   */
  const handleSecureVideo = async () => {
    setSecuredVideoError('');
    setSecuredProxyUrl('');
    setSecuredVideoLabel('');

    // Client-side validation
    const validationError = videoStreamService.validateSourceUrl(securedVideoSourceUrl, securedVideoPlatform);
    if (validationError) {
      setSecuredVideoError(validationError);
      return;
    }

    try {
      setSecuringVideo(true);
      const result = await videoStreamService.submitVideo(
        securedVideoSourceUrl,
        securedVideoPlatform,
        formData.title || 'Untitled content',
        user?.uid || 'unknown'
      );

      setSecuredProxyUrl(result.proxyUrl);
      const platformLabel = videoStreamService.getPlatformLabel(result.platform as VideoSourcePlatform);
      const isEmbed = videoStreamService.isEmbedPlatform(result.platform as VideoSourcePlatform);
      setSecuredVideoLabel(
        `${videoStreamService.getPlatformIcon(result.platform as VideoSourcePlatform)} ${platformLabel} — ${isEmbed ? 'Embed' : 'Secure Stream'} (ID: ${result.videoId})`
      );
      setSecuredVideoError('');
    } catch (err: any) {
      setSecuredVideoError(err.message || 'Failed to secure video. Check the URL and try again.');
    } finally {
      setSecuringVideo(false);
    }
  };

  /** Clear the currently secured video so the user can change the URL */
  const clearSecuredVideo = () => {
    setSecuredProxyUrl('');
    setSecuredVideoLabel('');
    setSecuredVideoSourceUrl('');
    setSecuredVideoError('');
  };
  // ==================== MCQ QUESTION MANAGEMENT ====================

  const addMcqOption = () => {
    setCurrentMcqQuestion(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeMcqOption = (index: number) => {
    if (currentMcqQuestion.options.length <= 2) {
      setError('At least 2 options are required');
      return;
    }
    
    setCurrentMcqQuestion(prev => {
      const newOptions = prev.options.filter((_, i) => i !== index);
      const newCorrectOptions = prev.correctOptions
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i);
      
      return {
        ...prev,
        options: newOptions,
        correctOptions: newCorrectOptions
      };
    });
  };

  const toggleCorrectOption = (index: number) => {
    setCurrentMcqQuestion(prev => {
      const isCurrentlyCorrect = prev.correctOptions.includes(index);
      const newCorrectOptions = isCurrentlyCorrect
        ? prev.correctOptions.filter(i => i !== index)
        : [...prev.correctOptions, index].sort((a, b) => a - b);
      
      return {
        ...prev,
        correctOptions: newCorrectOptions
      };
    });
  };

  const addMcqQuestion = () => {
    if (!currentMcqQuestion.question.trim()) {
      setError('Question text is required');
      return;
    }

    if (currentMcqQuestion.options.length < 2) {
      setError('At least 2 options are required');
      return;
    }

    const emptyOptions = currentMcqQuestion.options.filter(opt => !opt.trim());
    if (emptyOptions.length > 0) {
      setError('All options must be filled');
      return;
    }

    const newQuestion: MCQQuestion = {
      id: Date.now().toString(),
      question: currentMcqQuestion.question,
      questionImage: currentMcqQuestion.questionImage,
      options: [...currentMcqQuestion.options],
      correctOptions: [...currentMcqQuestion.correctOptions],
      correctMarks: currentMcqQuestion.correctMarks,
      wrongMarks: currentMcqQuestion.wrongMarks,
      skipMarks: currentMcqQuestion.skipMarks,
      solution: currentMcqQuestion.solution,
      solutionImage: currentMcqQuestion.solutionImage,
      isLocked: false,
      lockedPosition: null
    };

    // For exam type: add to targeted version only; for non-exam types: use global state
    if (versionQuestionTarget && versionQuestionTarget.type === 'mcq') {
      const { versionIdx } = versionQuestionTarget;
      setExamVersions(prev => prev.map((v, i) => i === versionIdx ? { ...v, mcqQuestions: [...v.mcqQuestions, newQuestion] } : v));
      setVersionQuestionTarget(null);
    } else {
      setMcqQuestions(prev => [...prev, newQuestion]);
    }

    setCurrentMcqQuestion({
      question: '',
      questionImage: null,
      options: ['', ''],
      correctOptions: [],
      correctMarks: 1,
      wrongMarks: 0,
      skipMarks: 0,
      solution: '',
      solutionImage: null
    });
    
    setShowQuestionDialog(false);
    setSuccess('MCQ question added successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const editMcqQuestion = (id: string, versionIdx?: number) => {
    let question: MCQQuestion | undefined;
    if (versionIdx !== undefined) {
      question = examVersions[versionIdx]?.mcqQuestions.find(q => q.id === id);
      setEditingVersionIdx(versionIdx);
    } else {
      question = mcqQuestions.find(q => q.id === id);
      setEditingVersionIdx(null);
    }
    if (!question) return;

    setCurrentMcqQuestion({
      question: question.question,
      questionImage: question.questionImage || null,
      options: [...question.options],
      correctOptions: [...question.correctOptions],
      correctMarks: question.correctMarks,
      wrongMarks: question.wrongMarks,
      skipMarks: question.skipMarks,
      solution: question.solution,
      solutionImage: question.solutionImage || null
    });
    setEditingQuestionId(id);
    setCurrentQuestionType('mcq');
    setShowQuestionDialog(true);
  };

  const updateMcqQuestion = () => {
    if (!currentMcqQuestion.question.trim()) {
      setError('Question text is required');
      return;
    }

    if (currentMcqQuestion.options.length < 2) {
      setError('At least 2 options are required');
      return;
    }

    const emptyOptions = currentMcqQuestion.options.filter(opt => !opt.trim());
    if (emptyOptions.length > 0) {
      setError('All options must be filled');
      return;
    }

    if (editingVersionIdx !== null) {
      setExamVersions(prev => prev.map((v, vi) => {
        if (vi !== editingVersionIdx) return v;
        return {
          ...v,
          mcqQuestions: v.mcqQuestions.map(q => {
            if (q.id !== editingQuestionId) return q;
            return {
              ...q,
              question: currentMcqQuestion.question,
              questionImage: currentMcqQuestion.questionImage,
              options: [...currentMcqQuestion.options],
              correctOptions: [...currentMcqQuestion.correctOptions],
              correctMarks: currentMcqQuestion.correctMarks,
              wrongMarks: currentMcqQuestion.wrongMarks,
              skipMarks: currentMcqQuestion.skipMarks,
              solution: currentMcqQuestion.solution,
              solutionImage: currentMcqQuestion.solutionImage
            };
          })
        };
      }));
    } else {
      setMcqQuestions(prev => prev.map(q => {
        if (q.id === editingQuestionId) {
          return {
            ...q,
            question: currentMcqQuestion.question,
            questionImage: currentMcqQuestion.questionImage,
            options: [...currentMcqQuestion.options],
            correctOptions: [...currentMcqQuestion.correctOptions],
            correctMarks: currentMcqQuestion.correctMarks,
            wrongMarks: currentMcqQuestion.wrongMarks,
            skipMarks: currentMcqQuestion.skipMarks,
            solution: currentMcqQuestion.solution,
            solutionImage: currentMcqQuestion.solutionImage
          };
        }
        return q;
      }));
    }

    setCurrentMcqQuestion({
      question: '',
      questionImage: null,
      options: ['', ''],
      correctOptions: [],
      correctMarks: 1,
      wrongMarks: 0,
      skipMarks: 0,
      solution: '',
      solutionImage: null
    });
    
    setEditingQuestionId(null);
    setEditingVersionIdx(null);
    setShowQuestionDialog(false);
    setSuccess('MCQ question updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const removeMcqQuestion = (id: string, versionIdx?: number) => {
    if (versionIdx !== undefined) {
      setExamVersions(prev => prev.map((v, i) => i === versionIdx ? { ...v, mcqQuestions: v.mcqQuestions.filter(q => q.id !== id) } : v));
    } else {
      setMcqQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const toggleMcqLock = (id: string, position: 'first' | 'last', versionIdx?: number) => {
    const updater = (q: MCQQuestion) => {
      if (q.id !== id) return q;
      if (q.isLocked && q.lockedPosition === position) {
        return { ...q, isLocked: false, lockedPosition: null };
      }
      return { ...q, isLocked: true, lockedPosition: position };
    };
    if (versionIdx !== undefined) {
      setExamVersions(prev => prev.map((v, i) => i === versionIdx ? { ...v, mcqQuestions: v.mcqQuestions.map(updater) } : v));
    } else {
      setMcqQuestions(prev => prev.map(updater));
    }
  };

  // ==================== WRITTEN QUESTION MANAGEMENT ====================

  const addWrittenQuestion = () => {
    if (!currentWrittenQuestion.question.trim()) {
      setError('Question text is required');
      return;
    }

    if (currentWrittenQuestion.marks <= 0) {
      setError('Marks must be greater than 0');
      return;
    }

    const newQuestion: WrittenQuestion = {
      id: Date.now().toString(),
      question: currentWrittenQuestion.question,
      questionImage: currentWrittenQuestion.questionImage,
      solution: currentWrittenQuestion.solution,
      solutionImage: currentWrittenQuestion.solutionImage,
      marks: currentWrittenQuestion.marks,
      isLocked: false,
      lockedPosition: null
    };

    // For exam type: add to targeted version only; for non-exam types: use global state
    if (versionQuestionTarget && versionQuestionTarget.type === 'written') {
      const { versionIdx } = versionQuestionTarget;
      setExamVersions(prev => prev.map((v, i) => i === versionIdx ? { ...v, writtenQuestions: [...v.writtenQuestions, newQuestion] } : v));
      setVersionQuestionTarget(null);
    } else {
      setWrittenQuestions(prev => [...prev, newQuestion]);
    }
    
    setCurrentWrittenQuestion({
      question: '',
      questionImage: null,
      solution: '',
      solutionImage: null,
      marks: 1
    });
    
    setShowQuestionDialog(false);
    setSuccess('Written question added successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const editWrittenQuestion = (id: string, versionIdx?: number) => {
    let question: WrittenQuestion | undefined;
    if (versionIdx !== undefined) {
      question = examVersions[versionIdx]?.writtenQuestions.find(q => q.id === id);
      setEditingVersionIdx(versionIdx);
    } else {
      question = writtenQuestions.find(q => q.id === id);
      setEditingVersionIdx(null);
    }
    if (!question) return;

    setCurrentWrittenQuestion({
      question: question.question,
      questionImage: question.questionImage || null,
      solution: question.solution,
      solutionImage: question.solutionImage || null,
      marks: question.marks
    });
    setEditingQuestionId(id);
    setCurrentQuestionType('written');
    setShowQuestionDialog(true);
  };

  const updateWrittenQuestion = () => {
    if (!currentWrittenQuestion.question.trim()) {
      setError('Question text is required');
      return;
    }

    if (currentWrittenQuestion.marks <= 0) {
      setError('Marks must be greater than 0');
      return;
    }

    if (editingVersionIdx !== null) {
      setExamVersions(prev => prev.map((v, vi) => {
        if (vi !== editingVersionIdx) return v;
        return {
          ...v,
          writtenQuestions: v.writtenQuestions.map(q => {
            if (q.id !== editingQuestionId) return q;
            return {
              ...q,
              question: currentWrittenQuestion.question,
              questionImage: currentWrittenQuestion.questionImage,
              solution: currentWrittenQuestion.solution,
              solutionImage: currentWrittenQuestion.solutionImage,
              marks: currentWrittenQuestion.marks
            };
          })
        };
      }));
    } else {
      setWrittenQuestions(prev => prev.map(q => {
        if (q.id === editingQuestionId) {
          return {
            ...q,
            question: currentWrittenQuestion.question,
            questionImage: currentWrittenQuestion.questionImage,
            solution: currentWrittenQuestion.solution,
            solutionImage: currentWrittenQuestion.solutionImage,
            marks: currentWrittenQuestion.marks
          };
        }
        return q;
      }));
    }

    setCurrentWrittenQuestion({
      question: '',
      questionImage: null,
      solution: '',
      solutionImage: null,
      marks: 1
    });
    
    setEditingQuestionId(null);
    setEditingVersionIdx(null);
    setShowQuestionDialog(false);
    setSuccess('Written question updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const removeWrittenQuestion = (id: string, versionIdx?: number) => {
    if (versionIdx !== undefined) {
      setExamVersions(prev => prev.map((v, i) => i === versionIdx ? { ...v, writtenQuestions: v.writtenQuestions.filter(q => q.id !== id) } : v));
    } else {
      setWrittenQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const toggleWrittenLock = (id: string, position: 'first' | 'last', versionIdx?: number) => {
    const updater = (q: WrittenQuestion) => {
      if (q.id !== id) return q;
      if (q.isLocked && q.lockedPosition === position) {
        return { ...q, isLocked: false, lockedPosition: null };
      }
      return { ...q, isLocked: true, lockedPosition: position };
    };
    if (versionIdx !== undefined) {
      setExamVersions(prev => prev.map((v, i) => i === versionIdx ? { ...v, writtenQuestions: v.writtenQuestions.map(updater) } : v));
    } else {
      setWrittenQuestions(prev => prev.map(updater));
    }
  };

  const openQuestionDialog = (type: 'mcq' | 'written') => {
    setCurrentQuestionType(type);
    setEditingQuestionId(null);
    setShowQuestionDialog(true);
  };

  const handlePreviewQuestion = (question: any, type: 'mcq' | 'written') => {
    setPreviewQuestion({ ...question, type });
    setShowPreviewDialog(true);
  };
  // ==================== CALCULATION HELPERS ====================

  /**
   * Calculate total (full) marks based ONLY on questions actually shown to the student:
   *   - All locked questions (always shown)
   *   - N unlocked questions selected by the teacher (questionsToShow / mcqQuestionsToShow / writtenQuestionsToShow)
   *
   * Questions that exist in the question bank but are NOT shown do NOT contribute to full marks.
   */
  const calculateTotalMarks = () => {
    // Helper: compute marks for a set of MCQ + Written questions given show-counts
    const computeMarks = (
      mcqQs: MCQQuestion[],
      writtenQs: WrittenQuestion[],
      mcqToShow: number,
      writtenToShow: number
    ): number => {
      // MCQ section
      const lockedMcq = mcqQs.filter(q => q.isLocked);
      const unlockedMcq = mcqQs.filter(q => !q.isLocked);
      const lockedMcqMarks = lockedMcq.reduce((sum, q) => sum + q.correctMarks, 0);
      // How many unlocked MCQ slots remain after accounting for locked ones
      const unlockedMcqToShow = Math.max(0, mcqToShow - lockedMcq.length);
      // Take the first N unlocked questions (sorted as-is); marks are additive across any selection
      const unlockedMcqMarks = unlockedMcq
        .slice(0, unlockedMcqToShow)
        .reduce((sum, q) => sum + q.correctMarks, 0);

      // Written section
      const lockedWritten = writtenQs.filter(q => q.isLocked);
      const unlockedWritten = writtenQs.filter(q => !q.isLocked);
      const lockedWrittenMarks = lockedWritten.reduce((sum, q) => sum + q.marks, 0);
      const unlockedWrittenToShow = Math.max(0, writtenToShow - lockedWritten.length);
      const unlockedWrittenMarks = unlockedWritten
        .slice(0, unlockedWrittenToShow)
        .reduce((sum, q) => sum + q.marks, 0);

      return lockedMcqMarks + unlockedMcqMarks + lockedWrittenMarks + unlockedWrittenMarks;
    };

    if (uploadType === 'exam' && examVersions.length > 0) {
      // Use first version as representative
      const v = examVersions[0];
      const mcqToShow = v.mcqQuestionsToShow || v.mcqQuestions.length;
      const writtenToShow = v.writtenQuestionsToShow || v.writtenQuestions.length;
      return computeMarks(v.mcqQuestions, v.writtenQuestions, mcqToShow, writtenToShow);
    }

    const mcqToShow = formData.mcqQuestionsToShow || mcqQuestions.length;
    const writtenToShow = formData.writtenQuestionsToShow || writtenQuestions.length;
    return computeMarks(mcqQuestions, writtenQuestions, mcqToShow, writtenToShow);
  };

  const calculateTotalExamDuration = () => {
    if (uploadType === 'exam' && examVersions.length > 0) {
      const v = examVersions[0];
      const mcqMinutes = (v.mcqDuration.hours * 60) + v.mcqDuration.minutes + (v.mcqDuration.seconds / 60);
      const writtenMinutes = (v.writtenDuration.hours * 60) + v.writtenDuration.minutes + (v.writtenDuration.seconds / 60);
      return mcqMinutes + writtenMinutes;
    }
    const mcqMinutes = (formData.mcqDuration.hours * 60) + formData.mcqDuration.minutes + (formData.mcqDuration.seconds / 60);
    const writtenMinutes = (formData.writtenDuration.hours * 60) + formData.writtenDuration.minutes + (formData.writtenDuration.seconds / 60);
    return mcqMinutes + writtenMinutes;
  };

  const getTotalDurationInMinutes = () => {
    const { hours, minutes, seconds } = formData.duration;
    return (hours * 60) + minutes + (seconds / 60);
  };

  // ==================== FORMAT HELPERS ====================

  const formatDuration = () => {
    const { hours, minutes, seconds } = formData.duration;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.length > 0 ? parts.join(' ') : '0m';
  };

  const formatExamDuration = (duration: { hours: number; minutes: number; seconds: number }) => {
    const parts = [];
    if (duration.hours > 0) parts.push(`${duration.hours}h`);
    if (duration.minutes > 0) parts.push(`${duration.minutes}m`);
    if (duration.seconds > 0) parts.push(`${duration.seconds}s`);
    return parts.length > 0 ? parts.join(' ') : '0m';
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (!bytesPerSecond) return '0 KB/s';
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
    return Math.round(bytesPerSecond / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDurationMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // ==================== RENDER HELPERS ====================

  const renderFormattedText = (text: string) => {
    if (!text) return null;

    const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
    const parts = text.split(blockMathRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        try {
          return <BlockMath key={index} math={part} />;
        } catch (e) {
          return <span key={index} className="text-error-light">{part}</span>;
        }
      } else {
        const inlineMathRegex = /\$([^\$]+)\$/g;
        const inlineParts = part.split(inlineMathRegex);
        
        return inlineParts.map((inlinePart, inlineIndex) => {
          if (inlineIndex % 2 === 1) {
            try {
              return <InlineMath key={`${index}-${inlineIndex}`} math={inlinePart} />;
            } catch (e) {
              return <span key={`${index}-${inlineIndex}`} className="text-error-light">{inlinePart}</span>;
            }
          } else {
            return inlinePart.split('\n').map((line, lineIndex) => (
              <span key={`${index}-${inlineIndex}-${lineIndex}`}>
                {line}
                {lineIndex < inlinePart.split('\n').length - 1 && <br />}
              </span>
            ));
          }
        });
      }
    });
  };

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

  // ==================== FORM SUBMISSION ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(null);

    try {
      if (!formData.id.trim()) {
        throw new Error('ID is required');
      }
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.subject.trim()) {
        throw new Error('Subject is required');
      }

      // Check for duplicate ID only if creating new content
      if (!editingContent) {
        const existingContent = await contentService.getContentByCustomId(formData.id);
        if (existingContent) {
          throw new Error(`Content with ID "${formData.id}" already exists`);
        }
      }

      let videoUrl = editingContent?.videoUrl || '';
      let noteUrl = editingContent?.noteUrl || '';
      let videoFileName = editingContent?.videoFileName || '';
      let noteFileName = editingContent?.noteFileName || '';
      let noteSource: 'local' | 'gdrive' = (editingContent as any)?.noteSource || 'local';
      let noteGDrivePreviewUrl = (editingContent as any)?.noteGDrivePreviewUrl || '';
      let noteGDriveDownloadUrl = (editingContent as any)?.noteGDriveDownloadUrl || '';

      // ── NEW: If using Platform B secured video, use the proxy URL directly ──
      if ((uploadType === 'lesson' || uploadType === 'trick') && videoInputMethod === 'secured') {
        if (!securedProxyUrl) {
          throw new Error('Please secure a video URL before submitting, or switch to Local Upload');
        }
        videoUrl = securedProxyUrl;
        videoFileName = securedVideoLabel || 'Secured video';
      } else {
        // ── ORIGINAL: Upload video file with progress — now via Bunny.net ──
        if (formData.videoFile) {
          // Delete old video if editing (Bunny.net; secured:// is skipped inside deleteVideoFile)
          if (editingContent?.videoUrl && !editingContent.videoUrl.startsWith('secured://')) {
            await contentService.deleteVideoFile(editingContent.videoUrl);
          }

          setUploadProgress({
            fileName: formData.videoFile.name,
            percentage: 0,
            stage: 'Uploading video...'
          });

          const videoResult = await contentService.uploadVideoFile(
            formData.videoFile,
            `content/${uploadType}/videos`,
            (progress) => {
              setUploadProgress({
                fileName: formData.videoFile!.name,
                percentage: progress.percentage,
                speed: progress.speed,
                stage: 'Uploading video...'
              });
            }
          );
          videoUrl = videoResult.url;
          videoFileName = videoResult.fileName;
        }
      }

      // Upload note file with progress (fully intact — unchanged)
      if (formData.noteInputMethod === 'gdrive') {
        // GDrive: use pre-parsed URLs saved in formData
        if (formData.noteGDrivePreviewUrl) {
          noteSource = 'gdrive';
          noteGDrivePreviewUrl = formData.noteGDrivePreviewUrl;
          noteGDriveDownloadUrl = formData.noteGDriveDownloadUrl;
          noteUrl = formData.noteGDrivePreviewUrl;
          noteFileName = formData.gDriveLinkInput || 'gdrive_note';
        }
      } else if (formData.noteFile) {
        // Local upload — original logic unchanged
        if (editingContent?.noteUrl && noteSource !== 'gdrive') {
          await contentService.deleteFile(editingContent.noteUrl);
        }

        setUploadProgress({
          fileName: formData.noteFile.name,
          percentage: 0,
          stage: 'Uploading note...'
        });

        const noteResult = await contentService.uploadFile(
          formData.noteFile,
          `content/${uploadType}/notes`,
          (progress) => {
            setUploadProgress({
              fileName: formData.noteFile!.name,
              percentage: progress.percentage,
              speed: progress.speed,
              stage: 'Uploading note...'
            });
          }
        );
        noteUrl = noteResult.url;
        noteFileName = noteResult.fileName;
        noteSource = 'local';
        noteGDrivePreviewUrl = '';
        noteGDriveDownloadUrl = '';
      }

      let processedMcqQuestions: any[] = [];
      let processedWrittenQuestions: any[] = [];

      // Helper: upload images for a list of MCQ questions
      const processMcqList = async (questions: MCQQuestion[], label: string): Promise<any[]> => {
        if (questions.length === 0) return [];
        return Promise.all(
          questions.map(async (q, index) => {
            let imageUrl = '';
            let solutionImageUrl = '';
            if (q.questionImage && q.questionImage instanceof File) {
              setUploadProgress({ fileName: `${label} MCQ #${index + 1} Q-Image`, percentage: 0, stage: 'Uploading question image...' });
              const r = await contentService.uploadFile(q.questionImage, `content/exam/question-images`, (p) => {
                setUploadProgress({ fileName: `${label} MCQ #${index + 1} Q-Image`, percentage: p.percentage, speed: p.speed, stage: 'Uploading question image...' });
              });
              imageUrl = r.url;
            } else if (typeof q.questionImage === 'string') {
              imageUrl = q.questionImage;
            }
            if (q.solutionImage && q.solutionImage instanceof File) {
              setUploadProgress({ fileName: `${label} MCQ #${index + 1} Sol-Image`, percentage: 0, stage: 'Uploading solution image...' });
              const r = await contentService.uploadFile(q.solutionImage, `content/exam/solution-images`, (p) => {
                setUploadProgress({ fileName: `${label} MCQ #${index + 1} Sol-Image`, percentage: p.percentage, speed: p.speed, stage: 'Uploading solution image...' });
              });
              solutionImageUrl = r.url;
            } else if (typeof q.solutionImage === 'string') {
              solutionImageUrl = q.solutionImage;
            }
            return { id: q.id, question: q.question, questionImage: imageUrl || undefined, options: q.options, correctOptions: q.correctOptions, correctMarks: q.correctMarks, wrongMarks: q.wrongMarks, skipMarks: q.skipMarks, solution: q.solution, solutionImage: solutionImageUrl || undefined, isLocked: q.isLocked, lockedPosition: q.lockedPosition };
          })
        );
      };

      const processWrittenList = async (questions: WrittenQuestion[], label: string): Promise<any[]> => {
        if (questions.length === 0) return [];
        return Promise.all(
          questions.map(async (q, index) => {
            let imageUrl = '';
            let solutionImageUrl = '';
            if (q.questionImage && q.questionImage instanceof File) {
              setUploadProgress({ fileName: `${label} Written #${index + 1} Q-Image`, percentage: 0, stage: 'Uploading question image...' });
              const r = await contentService.uploadFile(q.questionImage, `content/exam/question-images`, (p) => {
                setUploadProgress({ fileName: `${label} Written #${index + 1} Q-Image`, percentage: p.percentage, speed: p.speed, stage: 'Uploading question image...' });
              });
              imageUrl = r.url;
            } else if (typeof q.questionImage === 'string') {
              imageUrl = q.questionImage;
            }
            if (q.solutionImage && q.solutionImage instanceof File) {
              setUploadProgress({ fileName: `${label} Written #${index + 1} Sol-Image`, percentage: 0, stage: 'Uploading solution image...' });
              const r = await contentService.uploadFile(q.solutionImage, `content/exam/solution-images`, (p) => {
                setUploadProgress({ fileName: `${label} Written #${index + 1} Sol-Image`, percentage: p.percentage, speed: p.speed, stage: 'Uploading solution image...' });
              });
              solutionImageUrl = r.url;
            } else if (typeof q.solutionImage === 'string') {
              solutionImageUrl = q.solutionImage;
            }
            return { id: q.id, question: q.question, questionImage: imageUrl || undefined, solution: q.solution, solutionImage: solutionImageUrl || undefined, marks: q.marks, isLocked: q.isLocked, lockedPosition: q.lockedPosition };
          })
        );
      };

      if (uploadType === 'exam') {
        // Require at least 1 version
        if (examVersions.length === 0) {
          throw new Error('Please add at least one version with questions');
        }

        // Validate each version has at least 1 question
        for (const v of examVersions) {
          if (v.mcqQuestions.length === 0 && v.writtenQuestions.length === 0) {
            throw new Error(`Version "${v.versionName}" has no questions. Add at least one question per version.`);
          }
          if (v.mcqQuestionsToShow > v.mcqQuestions.length) {
            throw new Error(`In "${v.versionName}": MCQ questions to show cannot exceed total MCQ questions (${v.mcqQuestions.length})`);
          }
          if (v.writtenQuestionsToShow > v.writtenQuestions.length) {
            throw new Error(`In "${v.versionName}": Written questions to show cannot exceed total written questions (${v.writtenQuestions.length})`);
          }
        }
      }

      const durationInMinutes = uploadType === 'exam' 
        ? calculateTotalExamDuration() 
        : getTotalDurationInMinutes();
      const totalMarks = calculateTotalMarks();

      // For formatted duration: use first version's durations if exam, else formData
      const fmtMcqDur = uploadType === 'exam' && examVersions.length > 0 ? examVersions[0].mcqDuration : formData.mcqDuration;
      const fmtWrittenDur = uploadType === 'exam' && examVersions.length > 0 ? examVersions[0].writtenDuration : formData.writtenDuration;

      const contentData: any = {
        customId: formData.id,
        title: formData.title,
        subject: formData.subject,
        category: formData.category || '',
        description: formData.description || '',
        tags: formData.tags || [],
        difficulty: formData.difficulty,
        language: formData.language || '',
        version: formData.version || '',
        duration: durationInMinutes,
        durationFormatted: uploadType === 'exam' 
          ? `MCQ: ${formatExamDuration(fmtMcqDur)}, Written: ${formatExamDuration(fmtWrittenDur)}` 
          : formatDuration(),
        type: uploadType,
        createdBy: user?.uid || ''
      };

      if (videoUrl) {
        contentData.videoUrl = videoUrl;
        contentData.videoFileName = videoFileName;
      }
      if (noteUrl) {
        contentData.noteUrl = noteUrl;
        contentData.noteFileName = noteFileName;
        contentData.noteSource = noteSource;
        if (noteSource === 'gdrive') {
          contentData.noteGDrivePreviewUrl = noteGDrivePreviewUrl;
          contentData.noteGDriveDownloadUrl = noteGDriveDownloadUrl;
        }
      }

      if (uploadType === 'exam') {
        // Process all versions: upload images for each version's questions
        setUploadProgress({ fileName: 'Exam Versions', percentage: 0, stage: 'Processing version questions...' });

        const processedVersions = await Promise.all(
          examVersions.map(async (v) => {
            const pMcq = await processMcqList(v.mcqQuestions, v.versionName);
            const pWritten = await processWrittenList(v.writtenQuestions, v.versionName);
            const mcqDurationMinutes = (v.mcqDuration.hours * 60) + v.mcqDuration.minutes + (v.mcqDuration.seconds / 60);
            const writtenDurationMinutes = (v.writtenDuration.hours * 60) + v.writtenDuration.minutes + (v.writtenDuration.seconds / 60);
            return {
              id: v.id,
              versionName: v.versionName,
              mcqQuestions: pMcq,
              writtenQuestions: pWritten,
              mcqDuration: mcqDurationMinutes,
              writtenDuration: writtenDurationMinutes,
              mcqQuestionsToShow: v.mcqQuestionsToShow || v.mcqQuestions.length,
              writtenQuestionsToShow: v.writtenQuestionsToShow || v.writtenQuestions.length,
              mcqDirection: v.mcqDirection || '',
              writtenDirection: v.writtenDirection || ''
            };
          })
        );

        // Derive summary stats from first version
        const firstV = processedVersions[0];
        const totalMcq = firstV.mcqQuestions.length;
        const totalWritten = firstV.writtenQuestions.length;
        contentData.examType = (totalMcq > 0 && totalWritten > 0) ? 'mixed' : (totalMcq > 0 ? 'mcq' : 'written');
        contentData.totalQuestions = totalMcq + totalWritten;
        contentData.questionsToShow = (firstV.mcqQuestionsToShow || totalMcq) + (firstV.writtenQuestionsToShow || totalWritten);
        contentData.totalMarks = totalMarks;
        if (totalMcq > 0) {
          contentData.mcqDuration = firstV.mcqDuration;
          contentData.mcqQuestionsToShow = firstV.mcqQuestionsToShow;
          if (firstV.mcqDirection) contentData.mcqDirection = firstV.mcqDirection;
        }
        if (totalWritten > 0) {
          contentData.writtenDuration = firstV.writtenDuration;
          contentData.writtenQuestionsToShow = firstV.writtenQuestionsToShow;
          if (firstV.writtenDirection) contentData.writtenDirection = firstV.writtenDirection;
        }

        contentData.examVersions = processedVersions;

        contentData.maxAttempts = formData.maxAttempts;
        contentData.examTimelineType = formData.examTimelineType;
        if (formData.examTimelineType === 'scheduled') {
          contentData.examStartDateTime = formData.examStartDateTime;
          contentData.examEndDateTime = formData.examEndDateTime;
        }
        contentData.resultPublishType = formData.resultPublishType;
        if (formData.resultPublishType === 'scheduled') {
          contentData.resultPublishDateTime = formData.resultPublishDateTime;
        }
      }

      setUploadProgress({
        fileName: 'Content',
        percentage: 90,
        stage: editingContent ? 'Updating in database...' : 'Saving to database...'
      });

      if (editingContent) {
        await contentService.updateContent(editingContent.id, contentData, (stage, progress) => {
          setUploadProgress({
            fileName: 'Content',
            percentage: 90 + (progress / 10),
            stage
          });
        });
        // FIX: Optimistically update the in-memory list so the UI shows fresh
        // data immediately, before the background loadContents() resolves.
        setContents(prev => prev.map(c =>
          c.id === editingContent.id
            ? { ...c, ...contentData, id: editingContent.id, updatedAt: new Date() }
            : c
        ));
        if (selectedContent?.id === editingContent.id) {
          setSelectedContent(prev => prev ? { ...prev, ...contentData, id: editingContent.id, updatedAt: new Date() } : prev);
        }
      } else {
        await contentService.createContent(contentData, (stage, progress) => {
          setUploadProgress({
            fileName: 'Content',
            percentage: 90 + (progress / 10),
            stage
          });
        });
      }
      
      setUploadProgress({
        fileName: 'Content',
        percentage: 100,
        stage: 'Complete!'
      });

      setSuccess(editingContent ? 'Content Updated Successfully!' : 'Content Created Successfully!');
      
      setTimeout(() => {
        setSuccess('');
        setUploadProgress(null);
        closeCreateForm();
      }, 2000);
      
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Failed to save content');
      setUploadProgress(null);
    } finally {
      setLoading(false);
    }
  };
  // ==================== CONTENT CARD RENDERING ====================

  const renderContentCard = (content: Content) => {
    if (displayMode === 'grid') {
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
                  <span>{content.type === 'exam' ? content.durationFormatted : formatDurationMinutes(content.duration)}</span>
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
                {/* NEW: Show shield icon if video is secured */}
                {content.videoUrl?.startsWith('secured://') && (
                  <div className="flex items-center gap-1 text-green-400" title="Secured video stream">
                    <Shield size={12} />
                    <span>Secured</span>
                  </div>
                )}
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
                  {/* NEW: Secured badge in list view */}
                  {content.videoUrl?.startsWith('secured://') && (
                    <span className="text-xs px-2 py-1 rounded border bg-green-900/20 text-green-400 border-green-500/30 whitespace-nowrap flex items-center gap-1">
                      <Shield size={10} />
                      Secured
                    </span>
                  )}
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
                      <span>{content.type === 'exam' ? content.durationFormatted : formatDurationMinutes(content.duration)}</span>
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

  // ==================== OVERVIEW MODAL ====================

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
                    : formatDurationMinutes(selectedContent.duration)}
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
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Video</label>
                  {/* NEW: Show secured badge if it's a Platform B proxy URL */}
                  {selectedContent.videoUrl.startsWith('secured://') ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-900/20 border border-green-500/30 text-green-400 rounded-lg">
                      <Shield size={16} />
                      <span className="text-sm font-medium">Secured Stream</span>
                      <span className="text-xs text-green-600 ml-1">(Protected)</span>
                    </div>
                  ) : (
                    <a
                      href={selectedContent.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-background-800 hover:bg-background-700 text-primary-400 rounded-lg transition-colors"
                    >
                      <Download size={16} />
                      {selectedContent.videoFileName || 'Download Video'}
                    </a>
                  )}
                </div>
              )}
              {selectedContent.noteUrl && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Note File</label>
                  {(selectedContent as any).noteSource === 'gdrive' ? (
                    <div className="space-y-2">
                      <a
                        href={(selectedContent as any).noteGDriveDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-background-800 hover:bg-background-700 text-green-400 rounded-lg transition-colors"
                      >
                        <Download size={16} />
                        Download Note (Google Drive)
                      </a>
                      <a
                        href={(selectedContent as any).noteGDrivePreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-background-800 hover:bg-background-700 text-primary-400 rounded-lg transition-colors"
                      >
                        <ExternalLink size={16} />
                        Preview Note (Google Drive)
                      </a>
                    </div>
                  ) : (
                    <a
                      href={selectedContent.noteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-background-800 hover:bg-background-700 text-primary-400 rounded-lg transition-colors"
                    >
                      <Download size={16} />
                      {selectedContent.noteFileName || 'Download Note'}
                    </a>
                  )}
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

                {/* Exam Versions */}
                {selectedContent.examVersions && selectedContent.examVersions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-medium text-purple-400">{selectedContent.examVersions.length} Version{selectedContent.examVersions.length > 1 ? 's' : ''}</h4>
                    {selectedContent.examVersions.map((v: any) => (
                      <div key={v.id} className="bg-background-800 rounded-lg p-4 space-y-3">
                        <h5 className="text-white font-semibold">{v.versionName}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-gray-400">MCQ: </span><span className="text-blue-400 font-medium">{v.mcqQuestions?.length || 0}</span></div>
                          <div><span className="text-gray-400">Written: </span><span className="text-green-400 font-medium">{v.writtenQuestions?.length || 0}</span></div>
                          <div><span className="text-gray-400">MCQ Duration: </span><span className="text-white">{v.mcqDuration ? `${v.mcqDuration.toFixed(1)} min` : 'N/A'}</span></div>
                          <div><span className="text-gray-400">Written Duration: </span><span className="text-white">{v.writtenDuration ? `${v.writtenDuration.toFixed(1)} min` : 'N/A'}</span></div>
                          <div><span className="text-gray-400">MCQ to Show: </span><span className="text-white">{v.mcqQuestionsToShow || (v.mcqQuestions?.length || 0)}</span></div>
                          <div><span className="text-gray-400">Written to Show: </span><span className="text-white">{v.writtenQuestionsToShow || (v.writtenQuestions?.length || 0)}</span></div>
                        </div>
                        {(v.mcqDirection || v.writtenDirection) && (
                          <div className="text-xs text-gray-400">
                            {v.mcqDirection && <p><span className="text-blue-400">MCQ Instructions:</span> {v.mcqDirection}</p>}
                            {v.writtenDirection && <p><span className="text-green-400">Written Instructions:</span> {v.writtenDirection}</p>}
                          </div>
                        )}
                      </div>
                    ))}
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
                  openEditForm(selectedContent);
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
  // ==================== ANALYTICS MODAL ====================

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
  // ==================== QUESTION PREVIEW DIALOG ====================

  const renderPreviewDialog = () => {
    if (!showPreviewDialog || !previewQuestion) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
          <div className="p-6 border-b border-background-700 flex items-center justify-between sticky top-0 bg-background-900 z-10">
            <h3 className="text-xl font-bold text-white">Question Preview</h3>
            <button
              onClick={() => setShowPreviewDialog(false)}
              className="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Question:</h4>
              <div className="text-white bg-background-800 p-4 rounded-lg">
                {renderFormattedText(previewQuestion.question)}
              </div>
            </div>

            {previewQuestion.type === 'mcq' && (
              <>
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Options:</h4>
                  <div className="space-y-2">
                    {previewQuestion.options.map((opt: string, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg ${
                          previewQuestion.correctOptions.includes(idx)
                            ? 'bg-success-dark text-success-light border border-success-DEFAULT' 
                            : 'bg-background-800 text-white'
                        }`}
                      >
                        <span className="font-medium">{String.fromCharCode(65 + idx)}.</span> {renderFormattedText(opt)}
                        {previewQuestion.correctOptions.includes(idx) && <span className="ml-2">✓</span>}
                      </div>
                    ))}
                  </div>
                  {previewQuestion.correctOptions.length === 0 && (
                    <p className="text-xs text-warning-light mt-2">No correct answer selected</p>
                  )}
                  {previewQuestion.correctOptions.length > 1 && (
                    <p className="text-xs text-blue-400 mt-2">Multiple correct answers: {previewQuestion.correctOptions.length}</p>
                  )}
                </div>
                <div className="bg-background-800 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">
                    Marks: <span className="text-success-DEFAULT">+{previewQuestion.correctMarks}</span> (correct), 
                    <span className="text-error-DEFAULT"> {previewQuestion.wrongMarks}</span> (wrong), 
                    <span className="text-gray-300"> {previewQuestion.skipMarks}</span> (skip)
                  </p>
                </div>
              </>
            )}

            {previewQuestion.type === 'written' && (
              <div className="bg-background-800 p-3 rounded-lg">
                <p className="text-sm text-gray-400">
                  Marks: <span className="text-yellow-400 font-bold">{previewQuestion.marks}</span>
                </p>
              </div>
            )}

            {previewQuestion.solution && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Solution:</h4>
                <div className="text-white bg-background-800 p-4 rounded-lg">
                  {renderFormattedText(previewQuestion.solution)}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowPreviewDialog(false)}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==================== QUESTION DIALOG (ADD/EDIT) ====================

  const renderQuestionDialog = () => {
    if (!showQuestionDialog) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
          <div className="p-6 border-b border-background-700 flex items-center justify-between sticky top-0 bg-background-900 z-10">
            <h3 className="text-xl font-bold text-white">
              {editingQuestionId ? 'Edit' : 'Add'} {currentQuestionType === 'mcq' ? 'MCQ Question' : 'Written Question'}
            </h3>
            <button
              onClick={() => {
                setShowQuestionDialog(false);
                setEditingQuestionId(null);
                if (currentQuestionType === 'mcq') {
                  setCurrentMcqQuestion({
                    question: '',
                    questionImage: null,
                    options: ['', ''],
                    correctOptions: [],
                    correctMarks: 1,
                    wrongMarks: 0,
                    skipMarks: 0,
                    solution: '',
                    solutionImage: null
                  });
                } else {
                  setCurrentWrittenQuestion({
                    question: '',
                    questionImage: null,
                    solution: '',
                    solutionImage: null,
                    marks: 1
                  });
                }
              }}
              className="text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {currentQuestionType === 'mcq' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Question <span className="text-error-DEFAULT">*</span>
                  </label>
                  <textarea
                    value={currentMcqQuestion.question}
                    onChange={(e) => setCurrentMcqQuestion(prev => ({ ...prev, question: e.target.value }))}
                    className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter question text (LaTeX supported: $x^2$ or $$\frac{a}{b}$$)..."
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Supports LaTeX: Use $...$ for inline or $$...$$ for block</p>
                  
                  {currentMcqQuestion.question && (
                    <div className="mt-2 p-3 bg-background-700 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <div className="text-white text-sm">{renderFormattedText(currentMcqQuestion.question)}</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Question Image (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => handleQuestionImageChange(e, 'mcq')}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    accept="image/*"
                  />
                  {currentMcqQuestion.questionImage && (
                    <p className="text-xs text-success-DEFAULT mt-1">✓ Image selected: {currentMcqQuestion.questionImage.name}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-400">
                      Answer Options <span className="text-error-DEFAULT">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addMcqOption}
                      className="flex items-center gap-1 px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                    >
                      <Plus size={14} />
                      Add Option
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {currentMcqQuestion.options.map((opt, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={currentMcqQuestion.correctOptions.includes(index)}
                            onChange={() => toggleCorrectOption(index)}
                            className="h-4 w-4 text-primary-600 rounded"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOptions = [...currentMcqQuestion.options];
                              newOptions[index] = e.target.value;
                              setCurrentMcqQuestion(prev => ({ ...prev, options: newOptions }));
                            }}
                            className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder={`Option ${String.fromCharCode(65 + index)} (LaTeX supported)...`}
                          />
                          {currentMcqQuestion.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeMcqOption(index)}
                              className="p-2 text-error-DEFAULT hover:text-error-light transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        {opt && (
                          <div className="ml-6 p-2 bg-background-700 rounded text-xs text-white">
                            Preview: {renderFormattedText(opt)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Check the boxes for correct answer(s). You can select multiple or none.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Correct Marks</label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentMcqQuestion.correctMarks}
                      onChange={(e) => setCurrentMcqQuestion(prev => ({ ...prev, correctMarks: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Wrong Marks</label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentMcqQuestion.wrongMarks}
                      onChange={(e) => setCurrentMcqQuestion(prev => ({ ...prev, wrongMarks: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Skip Marks</label>
                    <input
                      type="number"
                      step="0.5"
                      value={currentMcqQuestion.skipMarks}
                      onChange={(e) => setCurrentMcqQuestion(prev => ({ ...prev, skipMarks: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Solution (Optional)</label>
                  <textarea
                    value={currentMcqQuestion.solution}
                    onChange={(e) => setCurrentMcqQuestion(prev => ({ ...prev, solution: e.target.value }))}
                    className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Explain the correct answer (LaTeX supported)..."
                    rows={3}
                  />
                  {currentMcqQuestion.solution && (
                    <div className="mt-2 p-3 bg-background-700 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <div className="text-white text-sm">{renderFormattedText(currentMcqQuestion.solution)}</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Solution Image (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => handleSolutionImageChange(e, 'mcq')}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    accept="image/*"
                  />
                  {currentMcqQuestion.solutionImage && (
                    <p className="text-xs text-success-DEFAULT mt-1">✓ Solution image selected: {currentMcqQuestion.solutionImage.name}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-background-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuestionDialog(false);
                      setEditingQuestionId(null);
                      setCurrentMcqQuestion({
                        question: '',
                        questionImage: null,
                        options: ['', ''],
                        correctOptions: [],
                        correctMarks: 1,
                        wrongMarks: 0,
                        skipMarks: 0,
                        solution: '',
                        solutionImage: null
                      });
                    }}
                    className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={editingQuestionId ? updateMcqQuestion : addMcqQuestion}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors"
                  >
                    {editingQuestionId ? 'Update Question' : 'Add Question'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Question <span className="text-error-DEFAULT">*</span>
                  </label>
                  <textarea
                    value={currentWrittenQuestion.question}
                    onChange={(e) => setCurrentWrittenQuestion(prev => ({ ...prev, question: e.target.value }))}
                    className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter question text (LaTeX supported: $x^2$ or $$\frac{a}{b}$$)..."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Supports LaTeX: Use $...$ for inline or $$...$$ for block</p>
                  
                  {currentWrittenQuestion.question && (
                    <div className="mt-2 p-3 bg-background-700 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <div className="text-white text-sm">{renderFormattedText(currentWrittenQuestion.question)}</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Question Image (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => handleQuestionImageChange(e, 'written')}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    accept="image/*"
                  />
                  {currentWrittenQuestion.questionImage && (
                    <p className="text-xs text-success-DEFAULT mt-1">✓ Image selected: {currentWrittenQuestion.questionImage.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Marks <span className="text-error-DEFAULT">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={currentWrittenQuestion.marks}
                    onChange={(e) => setCurrentWrittenQuestion(prev => ({ ...prev, marks: parseFloat(e.target.value) || 1 }))}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter marks for this question..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Solution (Optional)</label>
                  <textarea
                    value={currentWrittenQuestion.solution}
                    onChange={(e) => setCurrentWrittenQuestion(prev => ({ ...prev, solution: e.target.value }))}
                    className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Provide the solution (LaTeX supported)..."
                    rows={4}
                  />
                  {currentWrittenQuestion.solution && (
                    <div className="mt-2 p-3 bg-background-700 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Preview:</p>
                      <div className="text-white text-sm">{renderFormattedText(currentWrittenQuestion.solution)}</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Solution Image (Optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => handleSolutionImageChange(e, 'written')}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    accept="image/*"
                  />
                  {currentWrittenQuestion.solutionImage && (
                    <p className="text-xs text-success-DEFAULT mt-1">✓ Solution image selected: {currentWrittenQuestion.solutionImage.name}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-background-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuestionDialog(false);
                      setEditingQuestionId(null);
                      setCurrentWrittenQuestion({
                        question: '',
                        questionImage: null,
                        solution: '',
                        solutionImage: null,
                        marks: 1
                      });
                    }}
                    className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={editingQuestionId ? updateWrittenQuestion : addWrittenQuestion}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors"
                  >
                    {editingQuestionId ? 'Update Question' : 'Add Question'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== NEW: Platform B — Secure Video Input Panel ====================
  /**
   * Renders the full Platform B video input UI.
   * This is injected BELOW the existing local upload option inside the video section.
   * The two panels (Local Upload / Secure Stream) are tab-switched via videoInputMethod.
   */
  const renderSecuredVideoPanel = () => (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-lg overflow-hidden border border-background-600">
        <button
          type="button"
          onClick={() => { setVideoInputMethod('local'); setSecuredVideoError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            videoInputMethod === 'local'
              ? 'bg-primary-600 text-white'
              : 'bg-background-800 text-gray-400 hover:text-white hover:bg-background-700'
          }`}
        >
          <Upload size={15} />
          Local Upload
        </button>
        <button
          type="button"
          onClick={() => { setVideoInputMethod('secured'); setError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            videoInputMethod === 'secured'
              ? 'bg-green-700 text-white'
              : 'bg-background-800 text-gray-400 hover:text-white hover:bg-background-700'
          }`}
        >
          <Shield size={15} />
          Secure Stream
        </button>
      </div>

      {videoInputMethod === 'secured' && (
        <div className="border border-green-500/30 bg-green-900/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-green-400" />
            <span className="text-sm font-semibold text-green-400">Secure Video Streaming</span>
            <span className="text-xs text-gray-500 ml-auto">Anti-piracy • Anti-IDM • Proxy protected</span>
          </div>

          {/* Platform selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Source Platform</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { p: 'dropbox', icon: '📦', label: 'Dropbox' },
                  { p: 'gdrive', icon: '📁', label: 'GDrive' },
                  { p: 'youtube', icon: '▶️', label: 'YouTube' },
                  { p: 'vimeo', icon: '🎬', label: 'Vimeo' },
                  { p: 'dailymotion', icon: '🎥', label: 'Daily' },
                ] as { p: VideoSourcePlatform; icon: string; label: string }[]
              ).map(({ p, icon, label }) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setSecuredVideoPlatform(p); setSecuredVideoError(''); }}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded border text-xs font-medium transition-all ${
                    securedVideoPlatform === p
                      ? 'border-green-500 bg-green-900/30 text-green-300'
                      : 'border-background-600 bg-background-800 text-gray-400 hover:border-green-500/50 hover:text-white'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Source URL input */}
          {!securedProxyUrl ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {videoStreamService.getPlatformLabel(securedVideoPlatform)} Video URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={securedVideoSourceUrl}
                    onChange={(e) => { setSecuredVideoSourceUrl(e.target.value); setSecuredVideoError(''); }}
                    className="flex-1 bg-background-800 text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 border border-background-600"
                    placeholder={
                      securedVideoPlatform === 'dropbox' ? 'https://www.dropbox.com/s/...' :
                      securedVideoPlatform === 'gdrive' ? 'https://drive.google.com/file/d/...' :
                      securedVideoPlatform === 'youtube' ? 'https://www.youtube.com/watch?v=...' :
                      securedVideoPlatform === 'vimeo' ? 'https://vimeo.com/...' :
                      'https://www.dailymotion.com/video/...'
                    }
                  />
                  <button
                    type="button"
                    onClick={handleSecureVideo}
                    disabled={securingVideo || !securedVideoSourceUrl.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    {securingVideo ? (
                      <>
                        <Loader size={14} className="animate-spin" />
                        Securing…
                      </>
                    ) : (
                      <>
                        <Shield size={14} />
                        Secure
                      </>
                    )}
                  </button>
                </div>
                {securedVideoError && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <X size={12} />
                    {securedVideoError}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {securedVideoPlatform === 'dropbox' && 'Share link — any Dropbox share link works'}
                  {securedVideoPlatform === 'gdrive' && 'Make sure the file is shared publicly or with anyone with the link'}
                  {securedVideoPlatform === 'youtube' && 'Any public YouTube video URL'}
                  {securedVideoPlatform === 'vimeo' && 'Any public Vimeo video URL'}
                  {securedVideoPlatform === 'dailymotion' && 'Any public Dailymotion video URL'}
                </p>
              </div>

              {/* How it works info box */}
              <div className="bg-background-800 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-gray-300">How it works:</p>
                <ul className="text-xs text-gray-500 space-y-0.5 list-none">
                  <li>• Your original URL is stored securely on the server — never sent to the browser</li>
                  <li>• Video is delivered in encrypted chunks with one-time tokens (anti-IDM)</li>
                  <li>• Playback uses MediaSource API — no downloadable URL exposed in DevTools</li>
                  {videoStreamService.isEmbedPlatform(securedVideoPlatform) && (
                    <li>• YouTube / Vimeo / Dailymotion: delivered as a proxied embed iframe</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            /* Secured success state */
            <div className="bg-green-900/20 border border-green-500/40 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-300">Video Secured Successfully</p>
                    <p className="text-xs text-gray-400 mt-0.5 break-all">{securedVideoLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSecuredVideo}
                  className="text-gray-500 hover:text-white flex-shrink-0 mt-0.5"
                  title="Change video"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                ✓ Proxy URL generated — original source URL is hidden from students
              </p>
            </div>
          )}

          {/* Show existing secured video info when editing */}
          {editingContent?.videoUrl?.startsWith('secured://') && !securedProxyUrl && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
              <p className="text-xs text-blue-400 font-medium">ℹ Existing secured video</p>
              <p className="text-xs text-gray-400 mt-0.5">{editingContent.videoFileName || 'Secured video (existing)'}</p>
              <p className="text-xs text-gray-500 mt-1">Leave blank to keep the existing secured video, or paste a new URL above to replace it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
  // ==================== MAIN COMPONENT RETURN ====================

  return (
    <div className="space-y-6">
      {viewMode === 'list' ? (
        <>
          {/* LIST VIEW */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Content Management</h1>
              <p className="text-gray-400 mt-1">Manage your educational content</p>
            </div>
            <button
              onClick={openCreateForm}
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
                    onClick={() => setDisplayMode('grid')}
                    className={`p-3 rounded-lg transition-colors ${
                      displayMode === 'grid'
                        ? 'bg-primary-600 text-white'
                        : 'bg-background-800 text-gray-400 hover:text-white'
                    }`}
                    title="Grid View"
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setDisplayMode('list')}
                    className={`p-3 rounded-lg transition-colors ${
                      displayMode === 'list'
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
              displayMode === 'grid'
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
                    onClick={openCreateForm}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <Plus size={20} />
                    <span>Create Your First Content</span>
                  </button>
                )}
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* CREATE/EDIT VIEW */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={closeCreateForm}
                className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Back to Content List"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {editingContent ? 'Edit Content' : 'Create New Content'}
                </h1>
                <p className="text-gray-400 mt-1">
                  {editingContent ? `Editing: ${editingContent.title}` : 'Upload educational materials for your students'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-error-light hover:text-white">
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div className="bg-success-dark text-success-light px-4 py-3 rounded-lg flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess('')} className="text-success-light hover:text-white">
                <X size={16} />
              </button>
            </div>
          )}

          {uploadProgress && (
            <div className="bg-background-800 border border-primary-500 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader size={20} className="animate-spin text-primary-400" />
                  <span className="text-white font-medium">{uploadProgress.stage}</span>
                </div>
                <span className="text-primary-400 font-bold">{uploadProgress.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-background-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-primary-500 to-primary-400 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-gray-400">{uploadProgress.fileName}</span>
                {uploadProgress.speed && (
                  <span className="text-gray-500">{formatSpeed(uploadProgress.speed)}</span>
                )}
              </div>
            </div>
          )}

          {/* CREATION FORM */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card title="Content Details">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Content Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { type: 'lesson', label: 'Lesson', icon: <BookOpen size={20} /> },
                        { type: 'note', label: 'Notes', icon: <FileText size={20} /> },
                        { type: 'trick', label: 'Tricks & Hacks', icon: <PenTool size={20} /> },
                        { type: 'exam', label: 'Exam', icon: <BrainCircuit size={20} /> }
                      ].map(({ type, label, icon }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setUploadType(type as any);
                            setError('');
                          }}
                          disabled={!!editingContent}
                          className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                            uploadType === type
                              ? 'border-primary-500 bg-primary-900/20 text-primary-300'
                              : 'border-background-600 bg-background-800 text-gray-300 hover:border-primary-400'
                          } ${editingContent ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {icon}
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        ID <span className="text-error-DEFAULT">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.id}
                        onChange={(e) => handleInputChange('id', e.target.value)}
                        disabled={!!editingContent}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Enter unique ID..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Title <span className="text-error-DEFAULT">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter content title..."
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Subject <span className="text-error-DEFAULT">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., Mathematics, Physics..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., Algebra, Mechanics..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Enter content description..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Tags</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Add a tag..."
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary-900 text-primary-300 rounded-full text-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Difficulty</label>
                      <select
                        value={formData.difficulty}
                        onChange={(e) => handleInputChange('difficulty', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                        <option value="very_hard">Very Hard</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Language</label>
                      <input
                        type="text"
                        value={formData.language}
                        onChange={(e) => handleInputChange('language', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., English, Bangla..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Version</label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => handleInputChange('version', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., v1.0, 2025..."
                      />
                    </div>
                  </div>

                  {uploadType !== 'exam' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Duration</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Hours</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.duration.hours}
                            onChange={(e) => handleDurationChange('hours', parseInt(e.target.value) || 0)}
                            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Minutes</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={formData.duration.minutes}
                            onChange={(e) => handleDurationChange('minutes', parseInt(e.target.value) || 0)}
                            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Seconds</label>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={formData.duration.seconds}
                            onChange={(e) => handleDurationChange('seconds', parseInt(e.target.value) || 0)}
                            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Total: {formatDuration()} {getTotalDurationInMinutes() > 0 && `(${getTotalDurationInMinutes().toFixed(1)} minutes)`}
                      </p>
                    </div>
                  )}

                  {(uploadType === 'lesson' || uploadType === 'trick') && (
                    <>
                      {/* ── VIDEO SECTION: Local Upload + Platform B Secure Stream ── */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          <Video size={16} className="inline mr-1" />
                          Video {editingContent && editingContent.videoUrl && '(Optional - leave empty to keep existing)'}
                        </label>

                        {/* NEW: Platform B switcher + panel */}
                        {renderSecuredVideoPanel()}

      {/* Original local upload — shown only when local mode is active */}
                        {videoInputMethod === 'local' && (
                          BUNNY_LOCAL_UPLOAD_ENABLED ? (
                            /* Bunny.net is active → normal file picker */
                            <div className="border-2 border-dashed border-background-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors mt-3">
                              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                              <input
                                type="file"
                                onChange={(e) => handleFileChange(e, 'video')}
                                className="hidden"
                                id="video-upload"
                                accept=".mp4,.avi,.mov,.webm,.mkv"
                              />
                              <label
                                htmlFor="video-upload"
                                className="cursor-pointer text-primary-400 hover:text-primary-300 font-medium"
                              >
                                Click to upload video
                              </label>
                              <p className="text-sm text-gray-500 mt-2">
                                MP4, AVI, MOV, WEBM, MKV (Max 500MB)
                              </p>
                              {formData.videoFile && (
                                <div className="mt-3 p-2 bg-success-dark/20 border border-success-DEFAULT rounded">
                                  <p className="text-sm text-success-DEFAULT font-medium">
                                    ✓ Selected: {formData.videoFile.name}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {formatFileSize(formData.videoFile.size)}
                                  </p>
                                </div>
                              )}
                              {editingContent?.videoUrl && !formData.videoFile && !editingContent.videoUrl.startsWith('secured://') && (
                                <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                                  <p className="text-sm text-blue-400 font-medium">
                                    ℹ Current: {editingContent.videoFileName || 'Existing video'}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Bunny.net not yet configured → disabled state */
                            <div className="border-2 border-dashed border-background-600 rounded-lg p-6 text-center mt-3 opacity-60 cursor-not-allowed">
                              <Upload size={48} className="mx-auto text-gray-600 mb-3" />
                              <p className="text-sm font-medium text-gray-400">Local Video Upload — Not Available</p>
                              <p className="text-xs text-gray-500 mt-2 max-w-xs mx-auto">
                                Bunny.net is not configured yet. Set <code className="bg-background-700 px-1 rounded">VITE_BUNNY_ENABLED=true</code> and add your Bunny credentials to <code className="bg-background-700 px-1 rounded">.env</code> to enable direct video uploads.
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                In the meantime, use <span className="text-green-400 font-medium">Secure Stream</span> to add videos via Dropbox, GDrive, YouTube, etc.
                              </p>
                            </div>
                          )
                        )}
                      </div>

                      {/* Class Note Upload — local + GDrive toggle */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          <FileText size={16} className="inline mr-1" />
                          Class Note Upload {editingContent && editingContent.noteUrl && '(Optional - leave empty to keep existing)'}
                        </label>

                        {/* Source toggle */}
                        <div className="flex gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, noteInputMethod: 'local', noteGDrivePreviewUrl: '', noteGDriveDownloadUrl: '', gDriveLinkInput: '' }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${formData.noteInputMethod === 'local' ? 'bg-primary-600 text-white border-primary-600' : 'bg-background-700 text-gray-400 border-background-600 hover:bg-background-600'}`}
                          >
                            Local Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFormData(prev => ({ ...prev, noteInputMethod: 'gdrive', noteFile: null })); setGDriveLinkError(''); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${formData.noteInputMethod === 'gdrive' ? 'bg-green-600 text-white border-green-600' : 'bg-background-700 text-gray-400 border-background-600 hover:bg-background-600'}`}
                          >
                            Google Drive Link
                          </button>
                        </div>

                        {formData.noteInputMethod === 'local' ? (
                          <div className="border-2 border-dashed border-background-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                            <input
                              type="file"
                              onChange={(e) => handleFileChange(e, 'note')}
                              className="hidden"
                              id="note-upload"
                              accept=".pdf"
                            />
                            <label
                              htmlFor="note-upload"
                              className="cursor-pointer text-primary-400 hover:text-primary-300 font-medium"
                            >
                              Click to upload PDF note
                            </label>
                            <p className="text-sm text-gray-500 mt-2">
                              PDF only (Max 500MB)
                            </p>
                            {formData.noteFile && (
                              <div className="mt-3 p-2 bg-success-dark/20 border border-success-DEFAULT rounded">
                                <p className="text-sm text-success-DEFAULT font-medium">
                                  ✓ Selected: {formData.noteFile.name}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatFileSize(formData.noteFile.size)}
                                </p>
                              </div>
                            )}
                            {editingContent?.noteUrl && !formData.noteFile && (
                              <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                                <p className="text-sm text-blue-400 font-medium">
                                  ℹ Current: {editingContent.noteFileName || 'Existing note'}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={formData.gDriveLinkInput}
                                onChange={e => { setFormData(prev => ({ ...prev, gDriveLinkInput: e.target.value })); setGDriveLinkError(''); }}
                                placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                                className="flex-1 px-3 py-2 bg-background-700 border border-background-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                              <button
                                type="button"
                                onClick={handleGDriveLinkSave}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
                              >
                                Save Link
                              </button>
                            </div>
                            {gDriveLinkError && <p className="text-red-400 text-xs">{gDriveLinkError}</p>}
                            {formData.noteGDrivePreviewUrl && (
                              <p className="text-green-400 text-xs">
                                ✓ Google Drive file linked successfully.{' '}
                                <a href={formData.noteGDriveDownloadUrl} target="_blank" rel="noreferrer" className="underline">Test download link</a>
                              </p>
                            )}
                            {editingContent?.noteUrl && !formData.noteGDrivePreviewUrl && (
                              <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                                <p className="text-sm text-blue-400 font-medium">
                                  ℹ Current: {editingContent.noteFileName || 'Existing note'}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {uploadType === 'note' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        <FileUp size={16} className="inline mr-1" />
                        Note Upload {editingContent && editingContent.noteUrl && '(Optional - leave empty to keep existing)'}
                      </label>

                      {/* Source toggle */}
                      <div className="flex gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, noteInputMethod: 'local', noteGDrivePreviewUrl: '', noteGDriveDownloadUrl: '', gDriveLinkInput: '' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${formData.noteInputMethod === 'local' ? 'bg-primary-600 text-white border-primary-600' : 'bg-background-700 text-gray-400 border-background-600 hover:bg-background-600'}`}
                        >
                          Local Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFormData(prev => ({ ...prev, noteInputMethod: 'gdrive', noteFile: null })); setGDriveLinkError(''); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${formData.noteInputMethod === 'gdrive' ? 'bg-green-600 text-white border-green-600' : 'bg-background-700 text-gray-400 border-background-600 hover:bg-background-600'}`}
                        >
                          Google Drive Link
                        </button>
                      </div>

                      {formData.noteInputMethod === 'local' ? (
                        <div className="border-2 border-dashed border-background-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                          <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                          <input
                            type="file"
                            onChange={(e) => handleFileChange(e, 'note')}
                            className="hidden"
                            id="note-upload"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp3,.wav"
                          />
                          <label
                            htmlFor="note-upload"
                            className="cursor-pointer text-primary-400 hover:text-primary-300 font-medium"
                          >
                            Click to upload note file
                          </label>
                          <p className="text-sm text-gray-500 mt-2">
                            PDF, DOC, DOCX, PPT, PPTX, EXCEL, AUDIO (Max 500MB)
                          </p>
                          {formData.noteFile && (
                            <div className="mt-3 p-2 bg-success-dark/20 border border-success-DEFAULT rounded">
                              <p className="text-sm text-success-DEFAULT font-medium">
                                ✓ Selected: {formData.noteFile.name}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatFileSize(formData.noteFile.size)}
                              </p>
                            </div>
                          )}
                          {editingContent?.noteUrl && !formData.noteFile && (
                            <div className="mt-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                              <p className="text-sm text-blue-400 font-medium">
                                ℹ Current: {editingContent.noteFileName || 'Existing note'}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={formData.gDriveLinkInput}
                              onChange={e => { setFormData(prev => ({ ...prev, gDriveLinkInput: e.target.value })); setGDriveLinkError(''); }}
                              placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
                              className="flex-1 px-3 py-2 bg-background-700 border border-background-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={handleGDriveLinkSave}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
                            >
                              Save Link
                            </button>
                          </div>
                          {gDriveLinkError && <p className="text-red-400 text-xs">{gDriveLinkError}</p>}
                          {formData.noteGDrivePreviewUrl && (
                            <p className="text-green-400 text-xs">
                              ✓ Google Drive file linked successfully.{' '}
                              <a href={formData.noteGDriveDownloadUrl} target="_blank" rel="noreferrer" className="underline">Test download link</a>
                            </p>
                          )}
                          {editingContent?.noteUrl && !formData.noteGDrivePreviewUrl && (
                            <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
                              <p className="text-sm text-blue-400 font-medium">
                                ℹ Current: {editingContent.noteFileName || 'Existing note'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {uploadType === 'exam' && (
                    <div className="border-t border-background-700 pt-6 space-y-4">
                      {/* ── Exam Settings ── */}
                      <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 space-y-4">
                        <h3 className="text-lg font-medium text-orange-400">Exam Settings</h3>

                        {/* Maximum Attempts */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">Maximum Attempts</label>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.maxAttempts === 'unlimited'}
                                onChange={(e) => handleInputChange('maxAttempts', e.target.checked ? 'unlimited' : 1)}
                                className="w-4 h-4 accent-orange-500"
                              />
                              <span className="text-sm text-gray-300">Unlimited</span>
                            </label>
                            {formData.maxAttempts !== 'unlimited' && (
                              <input
                                type="number"
                                min="1"
                                value={formData.maxAttempts as number}
                                onChange={(e) => handleInputChange('maxAttempts', parseInt(e.target.value) || 1)}
                                className="w-24 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            )}
                          </div>
                        </div>

                        {/* Exam Timeline */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">Exam Timeline</label>
                          <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="examTimelineType"
                                value="anytime"
                                checked={formData.examTimelineType === 'anytime'}
                                onChange={() => handleInputChange('examTimelineType', 'anytime')}
                                className="accent-orange-500"
                              />
                              <span className="text-sm text-gray-300">Anytime</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="examTimelineType"
                                value="scheduled"
                                checked={formData.examTimelineType === 'scheduled'}
                                onChange={() => handleInputChange('examTimelineType', 'scheduled')}
                                className="accent-orange-500"
                              />
                              <span className="text-sm text-gray-300">Scheduled</span>
                            </label>
                          </div>
                          {formData.examTimelineType === 'scheduled' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Start Date & Time</label>
                                <input
                                  type="datetime-local"
                                  value={formData.examStartDateTime}
                                  onChange={(e) => handleInputChange('examStartDateTime', e.target.value)}
                                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">End Date & Time</label>
                                <input
                                  type="datetime-local"
                                  value={formData.examEndDateTime}
                                  onChange={(e) => handleInputChange('examEndDateTime', e.target.value)}
                                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Result Publish Time */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">Result Publish Time</label>
                          <div className="flex gap-4 mb-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="resultPublishType"
                                value="immediate"
                                checked={formData.resultPublishType === 'immediate'}
                                onChange={() => handleInputChange('resultPublishType', 'immediate')}
                                className="accent-orange-500"
                              />
                              <span className="text-sm text-gray-300">Immediately After Exam</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="resultPublishType"
                                value="scheduled"
                                checked={formData.resultPublishType === 'scheduled'}
                                onChange={() => handleInputChange('resultPublishType', 'scheduled')}
                                className="accent-orange-500"
                              />
                              <span className="text-sm text-gray-300">Specific Date & Time</span>
                            </label>
                          </div>
                          {formData.resultPublishType === 'scheduled' && (
                            <input
                              type="datetime-local"
                              value={formData.resultPublishDateTime}
                              onChange={(e) => handleInputChange('resultPublishDateTime', e.target.value)}
                              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          )}
                        </div>
                      </div>

                      {/* ── Exam Versions ── */}
                      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-purple-400">Exam Versions</h3>
                          <button
                            type="button"
                            onClick={() => {
                              const versionName = `Version ${examVersions.length + 1}`;
                              setExamVersions(prev => [...prev, {
                                id: Date.now().toString(),
                                versionName,
                                mcqQuestions: [],
                                writtenQuestions: [],
                                mcqDuration: { hours: 0, minutes: 0, seconds: 0 },
                                writtenDuration: { hours: 0, minutes: 0, seconds: 0 },
                                mcqQuestionsToShow: 0,
                                writtenQuestionsToShow: 0,
                                mcqDirection: '',
                                writtenDirection: ''
                              }]);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
                          >
                            <Plus size={14} /> Add Version
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">Each version is a separate question set under this exam. Students will select their version on the exam page. At least one version with questions is required.</p>

                        {examVersions.length === 0 && (
                          <p className="text-sm text-orange-400 italic">⚠ No versions added yet. Please add at least one version with questions.</p>
                        )}

                        {examVersions.map((version, vIdx) => (
                          <div key={version.id} className="bg-background-800 rounded-lg p-4 space-y-4 border border-background-700">
                            {/* Version header */}
                            <div className="flex items-center justify-between gap-3">
                              <input
                                type="text"
                                value={version.versionName}
                                onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, versionName: e.target.value } : v))}
                                placeholder="Version name (e.g. Set A)"
                                className="flex-1 bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                              <button
                                type="button"
                                onClick={() => setExamVersions(prev => prev.filter((_, i) => i !== vIdx))}
                                className="text-error-DEFAULT hover:text-error-light"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Version question buttons & stats */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  MCQ: {version.mcqQuestions.length} &nbsp;|&nbsp; Written: {version.writtenQuestions.length}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingQuestionId(null);
                                      setCurrentQuestionType('mcq');
                                      setVersionQuestionTarget({ versionIdx: vIdx, type: 'mcq' });
                                      openQuestionDialog('mcq');
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                                  >
                                    <Plus size={12} /> MCQ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingQuestionId(null);
                                      setCurrentQuestionType('written');
                                      setVersionQuestionTarget({ versionIdx: vIdx, type: 'written' });
                                      openQuestionDialog('written');
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
                                  >
                                    <Plus size={12} /> Written
                                  </button>
                                </div>
                              </div>

                              {/* Stats for this version */}
                              <div className="grid grid-cols-4 gap-2 bg-background-700 p-2 rounded-lg text-center text-xs">
                                <div><span className="text-gray-400">MCQ</span><div className="text-blue-400 font-bold">{version.mcqQuestions.length}</div></div>
                                <div><span className="text-gray-400">Written</span><div className="text-green-400 font-bold">{version.writtenQuestions.length}</div></div>
                                <div><span className="text-gray-400">Total Q</span><div className="text-primary-400 font-bold">{version.mcqQuestions.length + version.writtenQuestions.length}</div></div>
                                <div><span className="text-gray-400">Marks</span><div className="text-yellow-400 font-bold">
                                  {(() => {
                                    // Full marks = locked questions + N shown unlocked questions only
                                    const mcqToShow = version.mcqQuestionsToShow || version.mcqQuestions.length;
                                    const writtenToShow = version.writtenQuestionsToShow || version.writtenQuestions.length;
                                    const lockedMcq = version.mcqQuestions.filter(q => q.isLocked);
                                    const unlockedMcq = version.mcqQuestions.filter(q => !q.isLocked);
                                    const mcqMarks = lockedMcq.reduce((s, q) => s + q.correctMarks, 0)
                                      + unlockedMcq.slice(0, Math.max(0, mcqToShow - lockedMcq.length)).reduce((s, q) => s + q.correctMarks, 0);
                                    const lockedWritten = version.writtenQuestions.filter(q => q.isLocked);
                                    const unlockedWritten = version.writtenQuestions.filter(q => !q.isLocked);
                                    const writtenMarks = lockedWritten.reduce((s, q) => s + q.marks, 0)
                                      + unlockedWritten.slice(0, Math.max(0, writtenToShow - lockedWritten.length)).reduce((s, q) => s + q.marks, 0);
                                    return mcqMarks + writtenMarks;
                                  })()}
                                </div></div>
                              </div>

                              {/* MCQ Questions list for this version */}
                              {version.mcqQuestions.length > 0 && (
                                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 space-y-2">
                                  <h5 className="text-sm font-medium text-blue-400">MCQ Section</h5>
                                  
                                  {/* MCQ Duration */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">MCQ Duration</label>
                                    <div className="grid grid-cols-3 gap-2">
                                      {(['hours', 'minutes', 'seconds'] as const).map(field => (
                                        <div key={field}>
                                          <label className="block text-xs text-gray-500 mb-1 capitalize">{field}</label>
                                          <input
                                            type="number"
                                            min="0"
                                            max={field !== 'hours' ? 59 : undefined}
                                            value={version.mcqDuration[field]}
                                            onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, mcqDuration: { ...v.mcqDuration, [field]: parseInt(e.target.value) || 0 } } : v))}
                                            className="w-full bg-background-800 text-white rounded py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Total: {formatExamDuration(version.mcqDuration)}</p>
                                  </div>

                                  {/* MCQ Questions to Show */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">MCQ Questions to Show to Students</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={version.mcqQuestions.length}
                                      value={version.mcqQuestionsToShow}
                                      onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, mcqQuestionsToShow: parseInt(e.target.value) || 0 } : v))}
                                      className="w-full bg-background-800 text-white rounded py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="0 = all"
                                    />
                                    <p className="text-xs text-gray-500 mt-0.5">0 = show all MCQ questions (including locked)</p>
                                  </div>

                                  {/* MCQ Direction */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">MCQ Section Instructions</label>
                                    <textarea
                                      value={version.mcqDirection}
                                      onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, mcqDirection: e.target.value } : v))}
                                      className="w-full bg-background-800 text-white rounded py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Enter instructions for MCQ section..."
                                      rows={2}
                                    />
                                  </div>

                                  {/* MCQ question list */}
                                  <div className="space-y-1 mt-1">
                                    {version.mcqQuestions.map((q, qIdx) => (
                                      <div key={q.id} className={`bg-background-700 rounded px-3 py-2 ${q.isLocked ? 'border border-yellow-500/50' : ''}`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-xs text-blue-300 shrink-0">MCQ {qIdx + 1}</span>
                                            {q.isLocked && <span className="text-xs px-1.5 py-0.5 bg-yellow-900 text-yellow-300 rounded shrink-0">Locked {q.lockedPosition}</span>}
                                            <span className="text-xs px-1.5 py-0.5 bg-blue-900 text-blue-300 rounded shrink-0">+{q.correctMarks}m</span>
                                            <span className="text-gray-300 text-xs truncate">{q.question.substring(0, 50)}{q.question.length > 50 ? '...' : ''}</span>
                                          </div>
                                          <div className="flex gap-1 shrink-0 ml-2">
                                            <button type="button" onClick={() => toggleMcqLock(q.id, 'first', vIdx)} className={`p-1 rounded ${q.isLocked && q.lockedPosition === 'first' ? 'text-yellow-400 bg-yellow-900' : 'text-gray-400 hover:text-yellow-400'}`} title="Lock first"><Lock size={12} /></button>
                                            <button type="button" onClick={() => toggleMcqLock(q.id, 'last', vIdx)} className={`p-1 rounded ${q.isLocked && q.lockedPosition === 'last' ? 'text-yellow-400 bg-yellow-900' : 'text-gray-400 hover:text-yellow-400'}`} title="Lock last"><Lock size={12} /></button>
                                            <button type="button" onClick={() => editMcqQuestion(q.id, vIdx)} className="p-1 text-blue-400 hover:text-blue-300" title="Edit"><Edit size={12} /></button>
                                            <button type="button" onClick={() => handlePreviewQuestion(q, 'mcq')} className="p-1 text-primary-400 hover:text-primary-300" title="Preview"><Eye size={12} /></button>
                                            <button type="button" onClick={() => removeMcqQuestion(q.id, vIdx)} className="p-1 text-error-DEFAULT hover:text-error-light"><Trash2 size={12} /></button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Written Questions section for this version */}
                              {version.writtenQuestions.length > 0 && (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 space-y-2">
                                  <h5 className="text-sm font-medium text-green-400">Written Section</h5>

                                  {/* Written Duration */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Written Duration</label>
                                    <div className="grid grid-cols-3 gap-2">
                                      {(['hours', 'minutes', 'seconds'] as const).map(field => (
                                        <div key={field}>
                                          <label className="block text-xs text-gray-500 mb-1 capitalize">{field}</label>
                                          <input
                                            type="number"
                                            min="0"
                                            max={field !== 'hours' ? 59 : undefined}
                                            value={version.writtenDuration[field]}
                                            onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, writtenDuration: { ...v.writtenDuration, [field]: parseInt(e.target.value) || 0 } } : v))}
                                            className="w-full bg-background-800 text-white rounded py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Total: {formatExamDuration(version.writtenDuration)}</p>
                                  </div>

                                  {/* Written Questions to Show */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Written Questions to Show to Students</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={version.writtenQuestions.length}
                                      value={version.writtenQuestionsToShow}
                                      onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, writtenQuestionsToShow: parseInt(e.target.value) || 0 } : v))}
                                      className="w-full bg-background-800 text-white rounded py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                      placeholder="0 = all"
                                    />
                                    <p className="text-xs text-gray-500 mt-0.5">0 = show all written questions (including locked)</p>
                                  </div>

                                  {/* Written Direction */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Written Section Instructions</label>
                                    <textarea
                                      value={version.writtenDirection}
                                      onChange={(e) => setExamVersions(prev => prev.map((v, i) => i === vIdx ? { ...v, writtenDirection: e.target.value } : v))}
                                      className="w-full bg-background-800 text-white rounded py-1.5 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                                      placeholder="Enter instructions for written section..."
                                      rows={2}
                                    />
                                  </div>

                                  {/* Written question list */}
                                  <div className="space-y-1 mt-1">
                                    {version.writtenQuestions.map((q, qIdx) => (
                                      <div key={q.id} className={`bg-background-700 rounded px-3 py-2 ${q.isLocked ? 'border border-yellow-500/50' : ''}`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-xs text-green-300 shrink-0">W {qIdx + 1}</span>
                                            {q.isLocked && <span className="text-xs px-1.5 py-0.5 bg-yellow-900 text-yellow-300 rounded shrink-0">Locked {q.lockedPosition}</span>}
                                            <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded shrink-0">{q.marks}m</span>
                                            <span className="text-gray-300 text-xs truncate">{q.question.substring(0, 50)}{q.question.length > 50 ? '...' : ''}</span>
                                          </div>
                                          <div className="flex gap-1 shrink-0 ml-2">
                                            <button type="button" onClick={() => toggleWrittenLock(q.id, 'first', vIdx)} className={`p-1 rounded ${q.isLocked && q.lockedPosition === 'first' ? 'text-yellow-400 bg-yellow-900' : 'text-gray-400 hover:text-yellow-400'}`} title="Lock first"><Lock size={12} /></button>
                                            <button type="button" onClick={() => toggleWrittenLock(q.id, 'last', vIdx)} className={`p-1 rounded ${q.isLocked && q.lockedPosition === 'last' ? 'text-yellow-400 bg-yellow-900' : 'text-gray-400 hover:text-yellow-400'}`} title="Lock last"><Lock size={12} /></button>
                                            <button type="button" onClick={() => editWrittenQuestion(q.id, vIdx)} className="p-1 text-green-400 hover:text-green-300" title="Edit"><Edit size={12} /></button>
                                            <button type="button" onClick={() => handlePreviewQuestion(q, 'written')} className="p-1 text-primary-400 hover:text-primary-300" title="Preview"><Eye size={12} /></button>
                                            <button type="button" onClick={() => removeWrittenQuestion(q.id, vIdx)} className="p-1 text-error-DEFAULT hover:text-error-light"><Trash2 size={12} /></button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    {loading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        <span>{editingContent ? 'Updating...' : 'Creating...'}</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>{editingContent ? 'Update' : 'Create'} {uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}</span>
                      </>
                    )}
                  </button>
                </form>
              </Card>
            </div>

            <div>
              <Card title="Upload Guidelines">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-medium mb-2">Required Fields</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>• ID (Unique identifier)</li>
                      <li>• Title</li>
                      <li>• Subject</li>
                    </ul>
                  </div>
                  
                  {uploadType === 'lesson' && (
                    <div>
                      <h4 className="text-white font-medium mb-2">Lesson Content</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• Upload video lectures (local)</li>
                        <li>• Or use Secure Stream for Dropbox / GDrive / YouTube / Vimeo / Dailymotion</li>
                        <li>• Add PDF class notes</li>
                        <li>• Set duration for tracking</li>
                        <li>• Tag for easy discovery</li>
                      </ul>
                    </div>
                  )}

                  {uploadType === 'note' && (
                    <div>
                      <h4 className="text-white font-medium mb-2">Note Formats</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• PDF, Word documents</li>
                        <li>• PowerPoint presentations</li>
                        <li>• Excel spreadsheets</li>
                        <li>• Audio recordings</li>
                      </ul>
                    </div>
                  )}

                  {uploadType === 'trick' && (
                    <div>
                      <h4 className="text-white font-medium mb-2">Tricks & Hacks</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• Quick tips and shortcuts</li>
                        <li>• Video demonstrations (local or secured)</li>
                        <li>• Supporting materials</li>
                        <li>• Time-saving techniques</li>
                      </ul>
                    </div>
                  )}

                  {uploadType === 'exam' && (
                    <div>
                      <h4 className="text-white font-medium mb-2">Exam Features</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• Mixed exams (MCQ + Written)</li>
                        <li>• MCQ with auto-grading</li>
                        <li>• Dynamic options (2+ per MCQ)</li>
                        <li>• Multiple correct answers</li>
                        <li>• Written questions with marks</li>
                        <li>• LaTeX support for math</li>
                        <li>• Lock questions to positions</li>
                        <li>• Separate durations for each section</li>
                        <li>• Separate question counts</li>
                        <li>• Exam direction/instructions</li>
                        <li>• Randomized question sets</li>
                        <li>• Image support for Q&A</li>
                        <li>• Solution with attachments</li>
                        <li>• Auto-calculated total marks</li>
                        <li>• Edit questions after adding</li>
                      </ul>
                    </div>
                  )}

                  {/* NEW: Secure Stream info box in guidelines */}
                  {(uploadType === 'lesson' || uploadType === 'trick') && (
                    <div className="bg-green-900/10 border border-green-500/20 rounded-lg p-3">
                      <h4 className="text-green-400 font-medium mb-2 flex items-center gap-1.5">
                        <Shield size={14} />
                        Secure Stream
                      </h4>
                      <ul className="text-xs text-gray-400 space-y-1">
                        <li>• Original URL never exposed to students</li>
                        <li>• Anti-IDM chunk token chain</li>
                        <li>• HMAC-signed time-limited tokens</li>
                        <li>• MediaSource API — no downloadable link</li>
                        <li>• Dropbox & GDrive: chunked proxy stream</li>
                        <li>• YouTube / Vimeo / Dailymotion: embed proxy</li>
                      </ul>
                    </div>
                  )}

                  <div>
                    <h4 className="text-white font-medium mb-2">Best Practices</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>• Use descriptive titles</li>
                      <li>• Add relevant tags</li>
                      <li>• Set appropriate difficulty</li>
                      <li>• Include clear descriptions</li>
                      <li>• Organize by subject/category</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showOverview && renderOverviewModal()}
      {showAnalytics && renderAnalyticsModal()}
      {showQuestionDialog && renderQuestionDialog()}
      {showPreviewDialog && renderPreviewDialog()}
    </div>
  );
};

export default ContentUpload;
