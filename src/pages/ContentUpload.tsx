// src/pages/ContentUpload.tsx - PART 1 OF 2 (FIXED)
// PASTE THIS FIRST, THEN IMMEDIATELY PASTE PART 2

import { useState, useEffect } from 'react';
import { Upload, FileText, BookOpen, PenTool, BrainCircuit, Plus, Edit, Trash2, Eye, Download, Search, Filter, Video, X, Loader } from 'lucide-react';
import Card from '../components/ui/Card';
import { contentService, Content } from '../services/contentService';
import { courseService } from '../services/courseService';
import { useDashboard } from '../contexts/DashboardContext';
import { mcqService, MCQQuestion } from '../services/mcqService';

const ContentUpload = () => {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState<'upload' | 'manage' | 'courses'>('upload');
  const [uploadType, setUploadType] = useState<'lesson' | 'note' | 'trick' | 'mcq'>('lesson');
  const [contents, setContents] = useState<Content[]>([]);
  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    course: '',
    courseId: '',
    category: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    tags: [] as string[],
    topics: [] as string[],
    file: null as File | null,
    duration: '',
    question: '',
    choices: [
      { id: 1, text: '' },
      { id: 2, text: '' },
      { id: 3, text: '' },
      { id: 4, text: '' }
    ],
    correctAnswer: 1,
    explanation: '',
    points: 10
  });

  const [currentTag, setCurrentTag] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');

  useEffect(() => {
    loadContent();
    loadCourses();
  }, []);

  const loadContent = async () => {
    try {
      setLoading(true);
      const [contentData, mcqData] = await Promise.all([
        contentService.getAllContent(),
        mcqService.getAllMCQQuestions()
      ]);
      setContents(contentData);
      setMcqs(mcqData);
    } catch (error: any) {
      console.error('Error loading content:', error);
      setError(error.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      let coursesData;
      if (user?.role === 'admin') {
        coursesData = await courseService.getAllCourses();
      } else {
        coursesData = await courseService.getCoursesByInstructor(user?.uid || '');
      }
      setCourses(coursesData);
    } catch (error: any) {
      console.error('Error loading courses:', error);
      setError(error.message || 'Failed to load courses');
    }
  };

  const categories = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computer Science',
    'History',
    'English',
    'Geography',
    'Art',
    'Music',
    'Physical Education',
    'Programming',
    'Data Science',
    'Business',
    'Design',
    'Language',
    'Engineering',
    'Literature',
    'Philosophy'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateFile = (file: File): boolean => {
    const maxSize = formData.courseId ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size exceeds ${formData.courseId ? '500MB' : '100MB'} limit`);
      return false;
    }

    const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.mp4', '.avi', '.mov', '.webm'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidExtension) {
      setError('Invalid file type. Please upload a supported file format.');
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (validateFile(file)) {
        setFormData(prev => ({ ...prev, file }));
        setError('');
      } else {
        e.target.value = '';
      }
    } else {
      setFormData(prev => ({ ...prev, file: null }));
    }
  };

  const handleCourseSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCourseId = e.target.value;
    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    
    setFormData(prev => ({
      ...prev,
      courseId: selectedCourseId,
      course: selectedCourse ? selectedCourse.title : '',
      category: selectedCourse ? selectedCourse.category : prev.category
    }));
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

  const addTopic = () => {
    if (currentTopic.trim() && !formData.topics.includes(currentTopic.trim())) {
      setFormData(prev => ({
        ...prev,
        topics: [...prev.topics, currentTopic.trim()]
      }));
      setCurrentTopic('');
    }
  };

  const removeTopic = (topicToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.filter(topic => topic !== topicToRemove)
    }));
  };

  const handleChoiceChange = (choiceId: number, text: string) => {
    setFormData(prev => ({
      ...prev,
      choices: prev.choices.map(choice =>
        choice.id === choiceId ? { ...choice, text } : choice
      )
    }));
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      course: '',
      courseId: '',
      category: '',
      difficulty: 'medium',
      tags: [],
      topics: [],
      file: null,
      duration: '',
      question: '',
      choices: [
        { id: 1, text: '' },
        { id: 2, text: '' },
        { id: 3, text: '' },
        { id: 4, text: '' }
      ],
      correctAnswer: 1,
      explanation: '',
      points: 10
    });
    setCurrentTag('');
    setCurrentTopic('');
    
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (uploadType === 'mcq') {
        // MCQ VALIDATION
        if (!formData.question.trim()) {
          throw new Error('Question is required');
        }

        const emptyChoices = formData.choices.filter(choice => !choice.text.trim());
        if (emptyChoices.length > 0) {
          throw new Error('All answer choices must be filled');
        }

        if (!formData.title.trim()) {
          throw new Error('Title is required');
        }

        if (!formData.category) {
          throw new Error('Category is required');
        }

        const mcqData: Omit<MCQQuestion, 'id' | 'createdAt'> = {
          question: formData.question,
          choices: formData.choices,
          correctAnswer: formData.correctAnswer,
          subject: formData.category,
          difficulty: formData.difficulty,
          explanation: formData.explanation,
          points: formData.points,
          course: formData.course,
          tags: formData.tags,
          createdBy: user?.uid || '',
          title: formData.title,
          description: formData.description,
          type: 'mcq'
        };

        await mcqService.createMCQQuestion(mcqData);
        setSuccess('MCQ question created successfully!');
      } else {
        // CONTENT UPLOAD (Lesson, Note, Trick)
        
        // Basic validation
        if (!formData.title.trim()) {
          throw new Error('Title is required');
        }

        if (formData.courseId) {
          // ========================================
          // ADDING LESSON TO COURSE
          // ========================================
          
          // File is REQUIRED for course lessons
          if (!formData.file) {
            throw new Error('File is required when adding lessons to courses');
          }

          if (!formData.duration.trim()) {
            throw new Error('Duration is required for course lessons');
          }

          // Upload file to storage
          const { url, fileName } = await contentService.uploadFile(
            formData.file,
            `courses/${formData.courseId}/lessons`
          );

          // Determine lesson type from file extension
          const fileExtension = formData.file.name.split('.').pop()?.toLowerCase();
          let lessonType: 'video' | 'text' | 'quiz' | 'assignment' = 'text';
          
          if (['mp4', 'avi', 'mov', 'webm'].includes(fileExtension || '')) {
            lessonType = 'video';
          } else if (['pdf', 'doc', 'docx', 'txt'].includes(fileExtension || '')) {
            lessonType = 'text';
          }

          // Add lesson to course
          const lessonData = {
            title: formData.title,
            duration: formData.duration,
            type: lessonType,
            isPreview: false,
            videoUrl: lessonType === 'video' ? url : undefined,
            pdfUrl: lessonType === 'text' ? url : undefined,
            content: formData.description,
            topics: formData.topics
          };

          await courseService.addLessonToCourse(formData.courseId, lessonData);
          setSuccess(`Lesson "${formData.title}" added to course successfully!`);
          
        } else {
          // ========================================
          // STANDALONE CONTENT UPLOAD
          // ========================================
          
          // Category is required for standalone content
          if (!formData.category) {
            throw new Error('Category is required for standalone content');
          }

          // File is OPTIONAL for standalone content
          let fileUrl = '';
          let fileName = '';
          let fileSize = 0;

          if (formData.file) {
            // Upload file if provided
            const uploadResult = await contentService.uploadFile(
              formData.file,
              `content/${uploadType}s`
            );
            fileUrl = uploadResult.url;
            fileName = uploadResult.fileName;
            fileSize = formData.file.size;
          }

          const contentData: Omit<Content, 'id' | 'createdAt'> = {
            title: formData.title,
            description: formData.description,
            type: uploadType,
            course: formData.course,
            category: formData.category,
            difficulty: formData.difficulty,
            tags: formData.tags,
            fileUrl: fileUrl || undefined,
            fileName: fileName || undefined,
            fileSize: fileSize || undefined,
            createdBy: user?.uid || ''
          };

          await contentService.createContent(contentData);
          setSuccess(`${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} ${formData.file ? 'uploaded' : 'created'} successfully!`);
        }
      }

      resetForm();
      await loadContent();
      await loadCourses();
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Failed to upload content');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: 'content' | 'mcq') => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      setLoading(true);
      if (type === 'content') {
        await contentService.deleteContent(id);
        setContents(contents.filter(c => c.id !== id));
      } else {
        await mcqService.deleteMCQQuestion(id);
        setMcqs(mcqs.filter(m => m.id !== id));
      }
      setSuccess('Item deleted successfully!');
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message || 'Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const filteredContents = contents.filter(content => {
    const matchesSearch = (content.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (content.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || content.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredMcqs = mcqs.filter(mcq => {
    const matchesSearch = (mcq.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (mcq.question || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || mcq.subject === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lesson': return <BookOpen size={16} className="text-primary-400" />;
      case 'note': return <FileText size={16} className="text-secondary-400" />;
      case 'trick': return <PenTool size={16} className="text-accent-400" />;
      case 'mcq': return <BrainCircuit size={16} className="text-warning-DEFAULT" />;
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success-dark text-success-light';
      case 'medium': return 'bg-warning-dark text-warning-light';
      case 'hard': return 'bg-error-dark text-error-light';
      default: return 'bg-background-700 text-gray-300';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

// DO NOT ADD ANYTHING HERE - CONTINUE WITH PART 2
// src/pages/ContentUpload.tsx - PART 2 OF 2 (FIXED)
// PASTE THIS IMMEDIATELY AFTER PART 1
// THIS PART CONTAINS: Return statement with all tabs and UI

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Management</h1>
          <p className="text-gray-400 mt-1">Upload and manage educational content</p>
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

      {/* Tab Navigation */}
      <div className="border-b border-background-800">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload size={18} />
              <span>Upload Content</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={18} />
              <span>Manage Content</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'courses'
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen size={18} />
              <span>My Courses</span>
            </div>
          </button>
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card title="Upload New Content">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Content Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">Content Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { type: 'lesson', label: 'Lesson', icon: <BookOpen size={20} /> },
                      { type: 'note', label: 'Notes', icon: <FileText size={20} /> },
                      { type: 'trick', label: 'Tricks & Hacks', icon: <PenTool size={20} /> },
                      { type: 'mcq', label: 'MCQ Questions', icon: <BrainCircuit size={20} /> }
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

                {/* Course Selection */}
                {uploadType !== 'mcq' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Add to Course (Optional)
                    </label>
                    <select
                      value={formData.courseId}
                      onChange={handleCourseSelect}
                      className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">No Course (Standalone Content)</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>
                          {course.title} ({course.lessons?.length || 0} lessons)
                        </option>
                      ))}
                    </select>
                    {formData.courseId && (
                      <p className="text-xs text-primary-400 mt-1">
                        This content will be added as a lesson to the selected course (file required)
                      </p>
                    )}
                  </div>
                )}

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Enter content title..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Category {!formData.courseId && '*'}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required={!formData.courseId}
                      disabled={!!formData.courseId}
                    >
                      <option value="">Select category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    {formData.courseId && (
                      <p className="text-xs text-gray-500 mt-1">Category inherited from course</p>
                    )}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uploadType !== 'mcq' && formData.courseId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Duration * <span className="text-xs text-gray-500">(e.g., 15 min, 1 hour 30 min)</span>
                      </label>
                      <input
                        type="text"
                        value={formData.duration}
                        onChange={(e) => handleInputChange('duration', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="e.g., 45 min"
                        required
                      />
                    </div>
                  )}

                  {!formData.courseId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Course Name (Optional)</label>
                      <input
                        type="text"
                        value={formData.course}
                        onChange={(e) => handleInputChange('course', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Associated course name..."
                      />
                    </div>
                  )}

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
                    </select>
                  </div>
                </div>

                {/* Topics */}
                {formData.courseId && uploadType !== 'mcq' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Topics Covered</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={currentTopic}
                        onChange={(e) => setCurrentTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                        className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Add a topic..."
                      />
                      <button
                        type="button"
                        onClick={addTopic}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {formData.topics.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.topics.map(topic => (
                          <span
                            key={topic}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-secondary-900 text-secondary-300 rounded-full text-sm"
                          >
                            {topic}
                            <button
                              type="button"
                              onClick={() => removeTopic(topic)}
                              className="hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
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

                {/* MCQ Specific Fields */}
                {uploadType === 'mcq' && (
                  <div className="space-y-4 border-t border-background-700 pt-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Question *</label>
                      <textarea
                        value={formData.question}
                        onChange={(e) => handleInputChange('question', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter the question..."
                        rows={3}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Answer Choices *</label>
                      <div className="space-y-3">
                        {formData.choices.map((choice, index) => (
                          <div key={choice.id} className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={formData.correctAnswer === choice.id}
                              onChange={() => handleInputChange('correctAnswer', choice.id)}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                            />
                            <input
                              type="text"
                              value={choice.text}
                              onChange={(e) => handleChoiceChange(choice.id, e.target.value)}
                              className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder={`Choice ${index + 1}...`}
                              required
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Select the radio button next to the correct answer</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Points</label>
                        <input
                          type="number"
                          value={formData.points}
                          onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 10)}
                          className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          min="1"
                          max="100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Explanation (Optional)</label>
                      <textarea
                        value={formData.explanation}
                        onChange={(e) => handleInputChange('explanation', e.target.value)}
                        className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Explain why this is the correct answer..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                {/* File Upload - UPDATED TO SHOW OPTIONAL/REQUIRED STATUS */}
                {uploadType !== 'mcq' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Upload File {formData.courseId ? '*' : '(Optional)'}
                    </label>
                    <div className="border-2 border-dashed border-background-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                      <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,.avi,.mov,.webm"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer text-primary-400 hover:text-primary-300 font-medium"
                      >
                        Click to upload or drag and drop
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        {formData.courseId 
                          ? 'PDF, DOC, PPT, TXT, MP4, WEBM (Max 500MB) - Required for course lessons' 
                          : 'PDF, DOC, PPT, TXT, MP4, AVI, MOV (Max 100MB) - Optional for standalone content'}
                      </p>
                      {formData.file && (
                        <div className="mt-3 p-2 bg-success-dark/20 border border-success-DEFAULT rounded">
                          <p className="text-sm text-success-DEFAULT font-medium">
                            ✓ Selected: {formData.file.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatFileSize(formData.file.size)}
                          </p>
                        </div>
                      )}
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
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>
                        {formData.courseId 
                          ? `Add Lesson to Course` 
                          : `${uploadType === 'mcq' ? 'Create MCQ' : `Upload ${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}`}`}
                      </span>
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
                  <h4 className="text-white font-medium mb-2">Supported Formats</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Documents: PDF, DOC, DOCX, TXT</li>
                    <li>• Presentations: PPT, PPTX</li>
                    <li>• Videos: MP4, AVI, MOV, WEBM</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-white font-medium mb-2">Best Practices</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Use descriptive titles</li>
                    <li>• Add relevant tags for searchability</li>
                    <li>• Choose appropriate difficulty level</li>
                    <li>• Provide clear descriptions</li>
                    <li>• Keep file sizes reasonable</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">Content Types</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• <strong>Lessons:</strong> Comprehensive teaching materials</li>
                    <li>• <strong>Notes:</strong> Quick reference materials</li>
                    <li>• <strong>Tricks & Hacks:</strong> Tips and shortcuts</li>
                    <li>• <strong>MCQ:</strong> Multiple choice questions</li>
                  </ul>
                </div>

                {formData.courseId ? (
                  <div className="bg-primary-900/20 border border-primary-700 p-3 rounded">
                    <h4 className="text-primary-300 font-medium mb-1">Course Lesson Mode</h4>
                    <p className="text-xs text-gray-400">
                      Adding lesson to course. File, duration, and topics are required.
                    </p>
                  </div>
                ) : (
                  <div className="bg-secondary-900/20 border border-secondary-700 p-3 rounded">
                    <h4 className="text-secondary-300 font-medium mb-1">Standalone Content Mode</h4>
                    <p className="text-xs text-gray-400">
                      File upload is optional. You can create content entries without uploading files.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search content..."
                  className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
              </div>

              <div className="flex gap-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Regular Content */}
              {filteredContents.map(content => (
                <div key={content.id} className="bg-background-800 rounded-lg p-4 hover:bg-background-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(content.type)}
                      <span className="text-xs uppercase text-gray-400 font-medium">{content.type}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyColor(content.difficulty || 'medium')}`}>
                      {content.difficulty || 'medium'}
                    </span>
                  </div>

                  <h3 className="text-white font-medium mb-2 line-clamp-2">{content.title}</h3>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{content.description}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Category: {content.category}</span>
                    </div>
                    {content.course && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Course: {content.course}</span>
                      </div>
                    )}
                    {content.fileSize && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Size: {formatFileSize(content.fileSize)}</span>
                      </div>
                    )}
                  </div>

                  {content.tags && content.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {content.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-background-700 text-xs text-gray-300 rounded">
                          {tag}
                        </span>
                      ))}
                      {content.tags.length > 3 && (
                        <span className="px-2 py-1 bg-background-700 text-xs text-gray-300 rounded">
                          +{content.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {content.createdAt.toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      {content.fileUrl && (
                        <>
                          <button 
                            onClick={() => window.open(content.fileUrl, '_blank')}
                            className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                            title="View"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => window.open(content.fileUrl, '_blank')}
                            className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                        </>
                      )}
                      <button 
                        className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(content.id, 'content')}
                        className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* MCQ Content */}
              {filteredMcqs.map(mcq => (
                <div key={mcq.id} className="bg-background-800 rounded-lg p-4 hover:bg-background-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon('mcq')}
                      <span className="text-xs uppercase text-gray-400 font-medium">MCQ</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyColor(mcq.difficulty)}`}>
                      {mcq.difficulty}
                    </span>
                  </div>

                  <h3 className="text-white font-medium mb-2 line-clamp-2">{mcq.title}</h3>
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{mcq.question}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Category: {mcq.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Points: {mcq.points}</span>
                    </div>
                  </div>

                  {mcq.tags && mcq.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {mcq.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-background-700 text-xs text-gray-300 rounded">
                          {tag}
                        </span>
                      ))}
                      {mcq.tags.length > 3 && (
                        <span className="px-2 py-1 bg-background-700 text-xs text-gray-300 rounded">
                          +{mcq.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {mcq.createdAt.toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const correctChoice = mcq.choices.find(c => c.id === mcq.correctAnswer);
                          alert(`Question: ${mcq.question}\n\nCorrect Answer: ${correctChoice?.text || 'N/A'}\n\nExplanation: ${mcq.explanation || 'No explanation provided'}`);
                        }}
                        className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                        title="View"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(mcq.id, 'mcq')}
                        className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredContents.length === 0 && filteredMcqs.length === 0 && (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No content found</h3>
                <p className="text-gray-400">
                  {searchTerm || selectedCategory !== 'all'
                    ? 'Try adjusting your search criteria.'
                    : 'Upload your first piece of content to get started.'}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white">My Courses</h3>
              <button
                onClick={() => window.location.href = '/course-creation'}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                <span>Create New Course</span>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader size={32} className="animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map(course => (
                  <div key={course.id} className="bg-background-800 rounded-lg overflow-hidden hover:bg-background-700 transition-colors">
                    {course.thumbnail ? (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="h-32 bg-gradient-to-r from-primary-600 to-secondary-600 flex items-center justify-center">
                        <BookOpen size={32} className="text-white" />
                      </div>
                    )}
                    
                    <div className="p-4">
                      <h4 className="text-white font-medium mb-2 line-clamp-2">{course.title}</h4>
                      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{course.description}</p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Students: {course.studentCount || 0}</span>
                          <span>Lessons: {course.lessons?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Duration: {course.duration || '0 hours'}</span>
                          <span>Price: ৳{course.price || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Status:</span>
                          <span className={`px-2 py-1 rounded-full ${
                            course.isPublished ? 'bg-success-dark text-success-light' : 'bg-warning-dark text-warning-light'
                          }`}>
                            {course.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => window.location.href = `/course-creation/${course.id}`}
                          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded text-sm transition-colors"
                        >
                          Edit Course
                        </button>
                        <button 
                          onClick={() => {
                            const lessonsList = course.lessons?.map((l: any, i: number) => 
                              `${i + 1}. ${l.title} (${l.duration})`
                            ).join('\n') || 'No lessons yet';
                            alert(`Course: ${course.title}\n\nLessons:\n${lessonsList}`);
                          }}
                          className="p-2 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && courses.length === 0 && (
              <div className="text-center py-12">
                <BookOpen size={48} className="mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No courses yet</h3>
                <p className="text-gray-400 mb-4">
                  Create your first course to start teaching students.
                </p>
                <button
                  onClick={() => window.location.href = '/course-creation'}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                >
                  <Plus size={20} />
                  <span>Create Your First Course</span>
                </button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default ContentUpload;

