// src/pages/ContentManage.tsx - PART 1/4

import { useState } from 'react';
import { Upload, FileText, BookOpen, PenTool, BrainCircuit, Plus, X, Loader, Clock, Video, FileUp, Image as ImageIcon, Trash2, Eye, Lock, Unlock, ArrowLeft } from 'lucide-react';
import Card from '../components/ui/Card';
import { contentService } from '../services/contentService';
import { useDashboard } from '../contexts/DashboardContext';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface ContentUploadProps {
  onClose?: () => void;
  isModal?: boolean;
}

const ContentUpload = ({ onClose, isModal = false }: ContentUploadProps) => {
  const { user } = useDashboard();
  const [uploadType, setUploadType] = useState<'lesson' | 'note' | 'trick' | 'exam'>('lesson');
  const [examType, setExamType] = useState<'mcq' | 'written'>('mcq');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    subject: '',
    category: '',
    description: '',
    tags: [] as string[],
    difficulty: 'medium' as 'easy' | 'medium' | 'hard' | 'very_hard',
    language: '',
    version: '',
    duration: { hours: 0, minutes: 0, seconds: 0 },
    videoFile: null as File | null,
    noteFile: null as File | null,
    totalQuestions: 0,
    questionsToShow: 0
  });

  // MCQ Question State
  const [mcqQuestions, setMcqQuestions] = useState<Array<{
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
  }>>([]);

  // Written Question State
  const [writtenQuestions, setWrittenQuestions] = useState<Array<{
    id: string;
    question: string;
    questionImage?: File | null;
    solution: string;
    solutionImage?: File | null;
    isLocked: boolean;
    lockedPosition: 'first' | 'last' | null;
  }>>([]);

  const [currentTag, setCurrentTag] = useState('');
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<any>(null);

  // Current question being edited
  const [currentMcqQuestion, setCurrentMcqQuestion] = useState({
    question: '',
    questionImage: null as File | null,
    options: ['', ''],
    correctOptions: [] as number[],
    correctMarks: 1,
    wrongMarks: 0,
    skipMarks: 0,
    solution: '',
    solutionImage: null as File | null
  });

  const [currentWrittenQuestion, setCurrentWrittenQuestion] = useState({
    question: '',
    questionImage: null as File | null,
    solution: '',
    solutionImage: null as File | null
  });
// src/pages/ContentUpload.tsx - PART 2/4

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

    const newQuestion = {
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

    setMcqQuestions(prev => [...prev, newQuestion]);
    
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

  const addWrittenQuestion = () => {
    if (!currentWrittenQuestion.question.trim()) {
      setError('Question text is required');
      return;
    }

    const newQuestion = {
      id: Date.now().toString(),
      question: currentWrittenQuestion.question,
      questionImage: currentWrittenQuestion.questionImage,
      solution: currentWrittenQuestion.solution,
      solutionImage: currentWrittenQuestion.solutionImage,
      isLocked: false,
      lockedPosition: null
    };

    setWrittenQuestions(prev => [...prev, newQuestion]);
    
    setCurrentWrittenQuestion({
      question: '',
      questionImage: null,
      solution: '',
      solutionImage: null
    });
    
    setShowQuestionDialog(false);
    setSuccess('Written question added successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const removeMcqQuestion = (id: string) => {
    setMcqQuestions(prev => prev.filter(q => q.id !== id));
  };

  const removeWrittenQuestion = (id: string) => {
    setWrittenQuestions(prev => prev.filter(q => q.id !== id));
  };

  const toggleMcqLock = (id: string, position: 'first' | 'last') => {
    setMcqQuestions(prev => prev.map(q => {
      if (q.id === id) {
        if (q.isLocked && q.lockedPosition === position) {
          return { ...q, isLocked: false, lockedPosition: null };
        } else {
          return { ...q, isLocked: true, lockedPosition: position };
        }
      }
      return q;
    }));
  };

  const toggleWrittenLock = (id: string, position: 'first' | 'last') => {
    setWrittenQuestions(prev => prev.map(q => {
      if (q.id === id) {
        if (q.isLocked && q.lockedPosition === position) {
          return { ...q, isLocked: false, lockedPosition: null };
        } else {
          return { ...q, isLocked: true, lockedPosition: position };
        }
      }
      return q;
    }));
  };

  const handlePreviewQuestion = (question: any, type: 'mcq' | 'written') => {
    setPreviewQuestion({ ...question, type });
    setShowPreviewDialog(true);
  };

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
      totalQuestions: 0,
      questionsToShow: 0
    });
    setCurrentTag('');
    setMcqQuestions([]);
    setWrittenQuestions([]);
    setExamType('mcq');
    
    const videoInput = document.getElementById('video-upload') as HTMLInputElement;
    const noteInput = document.getElementById('note-upload') as HTMLInputElement;
    if (videoInput) videoInput.value = '';
    if (noteInput) noteInput.value = '';
  };

  const getTotalDurationInMinutes = () => {
    const { hours, minutes, seconds } = formData.duration;
    return (hours * 60) + minutes + (seconds / 60);
  };

  const formatDuration = () => {
    const { hours, minutes, seconds } = formData.duration;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.length > 0 ? parts.join(' ') : '0m';
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
// src/pages/ContentManage.tsx - PART 3/4

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

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

      let videoUrl = '';
      let noteUrl = '';
      let videoFileName = '';
      let noteFileName = '';

      if (formData.videoFile) {
        const videoResult = await contentService.uploadFile(
          formData.videoFile,
          `content/${uploadType}/videos`
        );
        videoUrl = videoResult.url;
        videoFileName = videoResult.fileName;
      }

      if (formData.noteFile) {
        const noteResult = await contentService.uploadFile(
          formData.noteFile,
          `content/${uploadType}/notes`
        );
        noteUrl = noteResult.url;
        noteFileName = noteResult.fileName;
      }

      let processedMcqQuestions = [];
      let processedWrittenQuestions = [];

      if (uploadType === 'exam') {
        if (examType === 'mcq') {
          processedMcqQuestions = await Promise.all(
            mcqQuestions.map(async (q) => {
              let imageUrl = '';
              let solutionImageUrl = '';
              
              if (q.questionImage) {
                const imgResult = await contentService.uploadFile(
                  q.questionImage,
                  `content/exam/question-images`
                );
                imageUrl = imgResult.url;
              }
              
              if (q.solutionImage) {
                const solImgResult = await contentService.uploadFile(
                  q.solutionImage,
                  `content/exam/solution-images`
                );
                solutionImageUrl = solImgResult.url;
              }
              
              return {
                id: q.id,
                question: q.question,
                questionImage: imageUrl,
                options: q.options,
                correctOptions: q.correctOptions,
                correctMarks: q.correctMarks,
                wrongMarks: q.wrongMarks,
                skipMarks: q.skipMarks,
                solution: q.solution,
                solutionImage: solutionImageUrl,
                isLocked: q.isLocked,
                lockedPosition: q.lockedPosition
              };
            })
          );
        } else {
          processedWrittenQuestions = await Promise.all(
            writtenQuestions.map(async (q) => {
              let imageUrl = '';
              let solutionImageUrl = '';
              
              if (q.questionImage) {
                const imgResult = await contentService.uploadFile(
                  q.questionImage,
                  `content/exam/question-images`
                );
                imageUrl = imgResult.url;
              }
              
              if (q.solutionImage) {
                const solImgResult = await contentService.uploadFile(
                  q.solutionImage,
                  `content/exam/solution-images`
                );
                solutionImageUrl = solImgResult.url;
              }
              
              return {
                id: q.id,
                question: q.question,
                questionImage: imageUrl,
                solution: q.solution,
                solutionImage: solutionImageUrl,
                isLocked: q.isLocked,
                lockedPosition: q.lockedPosition
              };
            })
          );
        }

        if (examType === 'mcq' && processedMcqQuestions.length === 0) {
          throw new Error('Please add at least one MCQ question');
        }
        if (examType === 'written' && processedWrittenQuestions.length === 0) {
          throw new Error('Please add at least one written question');
        }

        const totalQuestions = examType === 'mcq' ? processedMcqQuestions.length : processedWrittenQuestions.length;
        if (formData.questionsToShow > totalQuestions) {
          throw new Error(`Questions to show cannot exceed total questions (${totalQuestions})`);
        }
      }

      const durationInMinutes = getTotalDurationInMinutes();

      const contentData = {
        customId: formData.id,
        title: formData.title,
        subject: formData.subject,
        category: formData.category,
        description: formData.description,
        tags: formData.tags,
        difficulty: formData.difficulty,
        language: formData.language,
        version: formData.version,
        duration: durationInMinutes,
        durationFormatted: formatDuration(),
        type: uploadType,
        videoUrl: videoUrl || undefined,
        videoFileName: videoFileName || undefined,
        noteUrl: noteUrl || undefined,
        noteFileName: noteFileName || undefined,
        createdBy: user?.uid || '',
        
        ...(uploadType === 'exam' && {
          examType: examType,
          totalQuestions: examType === 'mcq' ? processedMcqQuestions.length : processedWrittenQuestions.length,
          questionsToShow: formData.questionsToShow || (examType === 'mcq' ? processedMcqQuestions.length : processedWrittenQuestions.length),
          mcqQuestions: examType === 'mcq' ? processedMcqQuestions : undefined,
          writtenQuestions: examType === 'written' ? processedWrittenQuestions : undefined
        })
      };

      await contentService.createContent(contentData);
      
      setSuccess('Content Created Successfully!');
      resetForm();
      
      setTimeout(() => {
        setSuccess('');
        if (onClose) {
          onClose();
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Failed to create content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Back to Content Management"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">Content Upload</h1>
            <p className="text-gray-400 mt-1">Create and upload educational content</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Create New Content">
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
                      className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        uploadType === type
                          ? 'border-primary-500 bg-primary-900/20 text-primary-300'
                          : 'border-background-600 bg-background-800 text-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {icon}
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {uploadType === 'exam' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">Exam Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { type: 'mcq', label: 'MCQ Exam' },
                      { type: 'written', label: 'Written Exam' }
                    ].map(({ type, label }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setExamType(type as any);
                          setMcqQuestions([]);
                          setWrittenQuestions([]);
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          examType === type
                            ? 'border-primary-500 bg-primary-900/20 text-primary-300'
                            : 'border-background-600 bg-background-800 text-gray-300 hover:border-primary-400'
                        }`}
                      >
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    ID <span className="text-error-DEFAULT">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => handleInputChange('id', e.target.value)}
                    className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Duration {uploadType === 'exam' && '(Exam Duration)'}
                </label>
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
              
          // src/pages/ContentManage.tsx - PART 4/4

              {(uploadType === 'lesson' || uploadType === 'trick') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <Video size={16} className="inline mr-1" />
                      Video Upload (Optional)
                    </label>
                    <div className="border-2 border-dashed border-background-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
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
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      <FileText size={16} className="inline mr-1" />
                      Class Note Upload (Optional)
                    </label>
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
                    </div>
                  </div>
                </>
              )}

              {uploadType === 'note' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    <FileUp size={16} className="inline mr-1" />
                    Note Upload (Optional)
                  </label>
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
                  </div>
                </div>
              )}

              {uploadType === 'exam' && (
                <div className="border-t border-background-700 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">
                      {examType === 'mcq' ? 'MCQ Questions' : 'Written Questions'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowQuestionDialog(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                      <Plus size={16} />
                      Add Question
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Total Questions
                      </label>
                      <input
                        type="number"
                        value={examType === 'mcq' ? mcqQuestions.length : writtenQuestions.length}
                        readOnly
                        className="w-full bg-background-700 text-gray-400 rounded-lg py-2 px-3 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Questions to Show to Students
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={examType === 'mcq' ? mcqQuestions.length : writtenQuestions.length}
                        value={formData.questionsToShow}
                        onChange={(e) => handleInputChange('questionsToShow', parseInt(e.target.value) || 0)}
                        className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Leave 0 for all"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Students will see a random selection of {formData.questionsToShow || 'all'} questions (excluding locked questions)
                      </p>
                    </div>
                  </div>

                  {examType === 'mcq' && mcqQuestions.length > 0 && (
                    <div className="space-y-3">
                      {mcqQuestions.map((q, index) => (
                        <div key={q.id} className={`bg-background-800 p-4 rounded-lg ${q.isLocked ? 'border-2 border-yellow-500' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-medium">Question {index + 1}</h4>
                              {q.isLocked && (
                                <span className="text-xs px-2 py-1 rounded bg-yellow-900 text-yellow-300">
                                  Locked {q.lockedPosition}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => toggleMcqLock(q.id, 'first')}
                                className={`p-1 rounded transition-colors ${
                                  q.isLocked && q.lockedPosition === 'first'
                                    ? 'text-yellow-400 bg-yellow-900'
                                    : 'text-gray-400 hover:text-yellow-400'
                                }`}
                                title="Lock to first position"
                              >
                                {q.isLocked && q.lockedPosition === 'first' ? <Lock size={16} /> : <Unlock size={16} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleMcqLock(q.id, 'last')}
                                className={`p-1 rounded transition-colors ${
                                  q.isLocked && q.lockedPosition === 'last'
                                    ? 'text-yellow-400 bg-yellow-900'
                                    : 'text-gray-400 hover:text-yellow-400'
                                }`}
                                title="Lock to last position"
                              >
                                {q.isLocked && q.lockedPosition === 'last' ? <Lock size={16} /> : <Unlock size={16} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePreviewQuestion(q, 'mcq')}
                                className="p-1 text-primary-400 hover:text-primary-300"
                                title="Preview"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMcqQuestion(q.id)}
                                className="text-error-DEFAULT hover:text-error-light"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="text-gray-300 text-sm mb-2">{renderFormattedText(q.question)}</div>
                          {q.questionImage && (
                            <p className="text-xs text-gray-500 mb-2">📎 Has image attached</p>
                          )}
                          <div className="space-y-1 mb-2">
                            {q.options.map((opt, idx) => (
                              <div key={idx} className="text-xs">
                                <span className={q.correctOptions.includes(idx) ? 'text-success-DEFAULT font-medium' : 'text-gray-400'}>
                                  {String.fromCharCode(65 + idx)}. {renderFormattedText(opt)} {q.correctOptions.includes(idx) && '✓'}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500">
                            Marks: +{q.correctMarks} (correct), {q.wrongMarks} (wrong), {q.skipMarks} (skip)
                            {q.correctOptions.length === 0 && <span className="text-warning-light ml-2">(No correct answer selected)</span>}
                            {q.correctOptions.length > 1 && <span className="text-blue-400 ml-2">({q.correctOptions.length} correct answers)</span>}
                          </div>
                          {q.solution && (
                            <div className="mt-2 pt-2 border-t border-background-700">
                              <p className="text-xs text-gray-400">Solution: {renderFormattedText(q.solution)}</p>
                              {q.solutionImage && <p className="text-xs text-gray-500 mt-1">📎 Solution has image</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {examType === 'written' && writtenQuestions.length > 0 && (
                    <div className="space-y-3">
                      {writtenQuestions.map((q, index) => (
                        <div key={q.id} className={`bg-background-800 p-4 rounded-lg ${q.isLocked ? 'border-2 border-yellow-500' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-medium">Question {index + 1}</h4>
                              {q.isLocked && (
                                <span className="text-xs px-2 py-1 rounded bg-yellow-900 text-yellow-300">
                                  Locked {q.lockedPosition}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => toggleWrittenLock(q.id, 'first')}
                                className={`p-1 rounded transition-colors ${
                                  q.isLocked && q.lockedPosition === 'first'
                                    ? 'text-yellow-400 bg-yellow-900'
                                    : 'text-gray-400 hover:text-yellow-400'
                                }`}
                                title="Lock to first position"
                              >
                                {q.isLocked && q.lockedPosition === 'first' ? <Lock size={16} /> : <Unlock size={16} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleWrittenLock(q.id, 'last')}
                                className={`p-1 rounded transition-colors ${
                                  q.isLocked && q.lockedPosition === 'last'
                                    ? 'text-yellow-400 bg-yellow-900'
                                    : 'text-gray-400 hover:text-yellow-400'
                                }`}
                                title="Lock to last position"
                              >
                                {q.isLocked && q.lockedPosition === 'last' ? <Lock size={16} /> : <Unlock size={16} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePreviewQuestion(q, 'written')}
                                className="p-1 text-primary-400 hover:text-primary-300"
                                title="Preview"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeWrittenQuestion(q.id)}
                                className="text-error-DEFAULT hover:text-error-light"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="text-gray-300 text-sm mb-2">{renderFormattedText(q.question)}</div>
                          {q.questionImage && (
                            <p className="text-xs text-gray-500 mb-2">📎 Has image attached</p>
                          )}
                          {q.solution && (
                            <div className="mt-2 pt-2 border-t border-background-700">
                              <p className="text-xs text-gray-400">Solution: {renderFormattedText(q.solution)}</p>
                              {q.solutionImage && <p className="text-xs text-gray-500 mt-1">📎 Solution has image</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
                    <span>Creating Content...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>Create {uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}</span>
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
                    <li>• Upload video lectures</li>
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
                    <li>• Video demonstrations</li>
                    <li>• Supporting materials</li>
                    <li>• Time-saving techniques</li>
                  </ul>
                </div>
              )}

              {uploadType === 'exam' && (
                <div>
                  <h4 className="text-white font-medium mb-2">Exam Features</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• MCQ with auto-grading</li>
                    <li>• Dynamic options (2+ per MCQ)</li>
                    <li>• Multiple correct answers</li>
                    <li>• Written questions</li>
                    <li>• LaTeX support for math</li>
                    <li>• Lock questions to positions</li>
                    <li>• Randomized question sets</li>
                    <li>• Image support for Q&A</li>
                    <li>• Solution with attachments</li>
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

      {showQuestionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto my-8">
            <div className="p-6 border-b border-background-700 flex items-center justify-between sticky top-0 bg-background-900 z-10">
              <h3 className="text-xl font-bold text-white">
                {examType === 'mcq' ? 'Add MCQ Question' : 'Add Written Question'}
              </h3>
              <button
                onClick={() => setShowQuestionDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {examType === 'mcq' ? (
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
                      onClick={() => setShowQuestionDialog(false)}
                      className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addMcqQuestion}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors"
                    >
                      Add Question
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
                      onClick={() => setShowQuestionDialog(false)}
                      className="flex-1 bg-background-700 hover:bg-background-600 text-white py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addWrittenQuestion}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors"
                    >
                      Add Question
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showPreviewDialog && previewQuestion && (
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
      )}
    </div>
  );
};

export default ContentUpload;
