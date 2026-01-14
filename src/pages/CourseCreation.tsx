import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Upload, 
  Save, 
  Video, 
  FileText, 
  Image,
  Trash2,
  Eye,
  Loader,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course, CourseLesson } from '../services/courseService';
import { useNavigate, useParams } from 'react-router-dom';

interface LessonFormData {
  id?: string; // Add ID for existing lessons
  title: string;
  duration: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  isPreview: boolean;
  videoFile?: File;
  pdfFile?: File;
  content?: string;
  order: number;
  videoUrl?: string; // For existing video URLs
  pdfUrl?: string; // For existing PDF URLs
  existingVideoFileName?: string; // Track existing file names
  existingPdfFileName?: string;
  videoInputType?: 'upload' | 'url'; // Type of video input
  pdfInputType?: 'upload' | 'url'; // Type of PDF input
  externalVideoUrl?: string; // External video URL
  externalPdfUrl?: string; // External PDF URL
}

interface CourseFormData {
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  requirements: string[];
  whatYouWillLearn: string[];
  thumbnailFile?: File;
  existingThumbnail?: string; // For existing thumbnail URL
  lessons: LessonFormData[];
  isPublished: boolean;
}

const CourseCreation = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const isEditMode = Boolean(courseId);
  
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    price: 0,
    duration: '',
    level: 'beginner',
    category: '',
    tags: [],
    requirements: [''],
    whatYouWillLearn: [''],
    lessons: [],
    isPublished: false
  });
  
  const [currentTag, setCurrentTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const categories = [
    'Programming',
    'Mathematics',
    'Science',
    'Business',
    'Data Science',
    'Design',
    'Language',
    'Music',
    'Art',
    'Health & Fitness',
    'Personal Development',
    'Marketing'
  ];

  // Load existing course data if in edit mode
  useEffect(() => {
    if (isEditMode && courseId) {
      loadCourseData(courseId);
    }
  }, [isEditMode, courseId]);

  const loadCourseData = async (id: string) => {
    try {
      setInitialLoading(true);
      setError('');
      
      const course = await courseService.getCourseById(id);
      if (!course) {
        setError('Course not found');
        return;
      }

      // Check if user has permission to edit this course
      if (user?.role !== 'admin' && course.instructorId !== user?.uid) {
        setError('You do not have permission to edit this course');
        return;
      }

      // Convert course data to form data
      const lessonsFormData: LessonFormData[] = course.lessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        duration: lesson.duration,
        type: lesson.type,
        isPreview: lesson.isPreview,
        order: lesson.order,
        videoUrl: lesson.videoUrl,
        pdfUrl: lesson.pdfUrl,
        existingVideoFileName: lesson.videoUrl ? `existing_${lesson.id}_video` : undefined,
        existingPdfFileName: lesson.pdfUrl ? `existing_${lesson.id}_pdf` : undefined,
        videoInputType: lesson.videoUrl ? 'url' : undefined,
        pdfInputType: lesson.pdfUrl ? 'url' : undefined,
        externalVideoUrl: lesson.videoUrl,
        externalPdfUrl: lesson.pdfUrl,
        // Extract content without PDF URL
        content: lesson.content ? lesson.content.replace(/\[PDF\]:\s*https?:\/\/[^\s\n]+\s*/g, '').trim() : undefined
      }));

      setFormData({
        title: course.title,
        description: course.description,
        price: course.price,
        originalPrice: course.originalPrice,
        duration: course.duration,
        level: course.level,
        category: course.category,
        tags: course.tags,
        requirements: course.requirements.length > 0 ? course.requirements : [''],
        whatYouWillLearn: course.whatYouWillLearn.length > 0 ? course.whatYouWillLearn : [''],
        existingThumbnail: course.thumbnail,
        lessons: lessonsFormData,
        isPublished: course.isPublished
      });

    } catch (error: any) {
      console.error('Error loading course:', error);
      setError('Failed to load course data: ' + error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleInputChange = (field: keyof CourseFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleArrayFieldChange = (field: 'requirements' | 'whatYouWillLearn', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field: 'requirements' | 'whatYouWillLearn') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field: 'requirements' | 'whatYouWillLearn', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
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

  const addLesson = () => {
    const newLesson: LessonFormData = {
      title: '',
      duration: '',
      type: 'video',
      isPreview: false,
      order: formData.lessons.length + 1,
      videoInputType: 'upload',
      pdfInputType: 'upload'
    };
    setFormData(prev => ({
      ...prev,
      lessons: [...prev.lessons, newLesson]
    }));
  };

  const updateLesson = (index: number, updates: Partial<LessonFormData>) => {
    setFormData(prev => ({
      ...prev,
      lessons: prev.lessons.map((lesson, i) => 
        i === index ? { ...lesson, ...updates } : lesson
      )
    }));
  };

  const removeLesson = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lessons: prev.lessons.filter((_, i) => i !== index).map((lesson, i) => ({
        ...lesson,
        order: i + 1
      }))
    }));
  };

  const handleFileChange = (field: 'thumbnailFile', file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file || undefined
    }));
  };

  const handleLessonFileChange = (lessonIndex: number, field: 'videoFile' | 'pdfFile', file: File | null) => {
    updateLesson(lessonIndex, { [field]: file || undefined });
  };

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleExternalUrlChange = (lessonIndex: number, field: 'externalVideoUrl' | 'externalPdfUrl', value: string) => {
    updateLesson(lessonIndex, { [field]: value });
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError('Course title is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Course description is required');
      return false;
    }
    if (!formData.category) {
      setError('Course category is required');
      return false;
    }
    if (formData.price < 0) {
      setError('Price cannot be negative');
      return false;
    }
    if (formData.lessons.length === 0) {
      setError('At least one lesson is required');
      return false;
    }
    
    for (let i = 0; i < formData.lessons.length; i++) {
      const lesson = formData.lessons[i];
      if (!lesson.title.trim()) {
        setError(`Lesson ${i + 1} title is required`);
        return false;
      }
      if (!lesson.duration.trim()) {
        setError(`Lesson ${i + 1} duration is required`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create/edit a course');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setUploadProgress({});

    try {
      // Upload thumbnail if new file provided
      let thumbnailUrl = formData.existingThumbnail || '';
      if (formData.thumbnailFile) {
        setUploadProgress(prev => ({ ...prev, thumbnail: 0 }));
        const thumbnailResult = await courseService.uploadFile(
          formData.thumbnailFile, 
          'course_thumbnails'
        );
        thumbnailUrl = thumbnailResult.url;
        setUploadProgress(prev => ({ ...prev, thumbnail: 100 }));
      }

      // Process lessons and upload files
      const processedLessons: CourseLesson[] = [];
      
      for (let i = 0; i < formData.lessons.length; i++) {
        const lesson = formData.lessons[i];
        const lessonId = lesson.id || `lesson_${i + 1}_${Date.now()}`;
        
        let videoUrl = lesson.videoUrl || '';
        let pdfUrl = lesson.pdfUrl || '';

        // Handle video content based on input type
        if (lesson.videoInputType === 'url' && lesson.externalVideoUrl) {
          if (!validateUrl(lesson.externalVideoUrl)) {
            throw new Error(`Invalid video URL in lesson ${i + 1}`);
          }
          videoUrl = lesson.externalVideoUrl;
        } else if (lesson.videoFile) {
          // Upload video file if new file provided
          setUploadProgress(prev => ({ ...prev, [`lesson_${i}_video`]: 0 }));
          const videoResult = await courseService.uploadFile(
            lesson.videoFile,
            `course_lessons/videos`
          );
          videoUrl = videoResult.url;
          setUploadProgress(prev => ({ ...prev, [`lesson_${i}_video`]: 100 }));
        }

        // Handle PDF content based on input type
        if (lesson.pdfInputType === 'url' && lesson.externalPdfUrl) {
          if (!validateUrl(lesson.externalPdfUrl)) {
            throw new Error(`Invalid PDF URL in lesson ${i + 1}`);
          }
          pdfUrl = lesson.externalPdfUrl;
        } else if (lesson.pdfFile) {
          // Upload PDF file if new file provided
          setUploadProgress(prev => ({ ...prev, [`lesson_${i}_pdf`]: 0 }));
          const pdfResult = await courseService.uploadFile(
            lesson.pdfFile,
            `course_lessons/pdfs`
          );
          pdfUrl = pdfResult.url;
          setUploadProgress(prev => ({ ...prev, [`lesson_${i}_pdf`]: 100 }));
        }


        const processedLesson: CourseLesson = {
          id: lessonId,
          title: lesson.title,
          duration: lesson.duration,
          type: lesson.type,
          isPreview: lesson.isPreview,
          order: lesson.order,
          videoUrl: videoUrl || undefined,
          content: lesson.content || undefined,
          pdfUrl: pdfUrl || undefined
        };


        processedLessons.push(processedLesson);
      }

      // Create course data
      const courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title,
        description: formData.description,
        instructor: user.name,
        instructorId: user.uid,
        price: formData.price,
        originalPrice: formData.originalPrice,
        rating: 0, // Will be preserved if editing
        reviewCount: 0, // Will be preserved if editing
        studentCount: 0, // Will be preserved if editing
        duration: formData.duration,
        level: formData.level,
        category: formData.category,
        tags: formData.tags,
        thumbnail: thumbnailUrl,
        lessons: processedLessons,
        requirements: formData.requirements.filter(req => req.trim()),
        whatYouWillLearn: formData.whatYouWillLearn.filter(item => item.trim()),
        isPublished: formData.isPublished
      };

      if (isEditMode && courseId) {
        // Update existing course
        await courseService.updateCourse(courseId, courseData);
        
        if ((window as any).addNotification) {
          (window as any).addNotification(
            `Course "${formData.title}" updated successfully!`,
            'success'
          );
        }
      } else {
        // Create new course
        await courseService.createCourse(courseData);
        
        if ((window as any).addNotification) {
          (window as any).addNotification(
            `Course "${formData.title}" created successfully!`,
            'success'
          );
        }
      }
      
      setSuccess(true);
      
      // Show success message and redirect after delay
      setTimeout(() => {
        navigate('/content');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error saving course:', error);
      setError(error.message || `Failed to ${isEditMode ? 'update' : 'create'} course. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading course data...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle size={64} className="mx-auto text-success-DEFAULT mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Course {isEditMode ? 'Updated' : 'Created'} Successfully!
          </h2>
          <p className="text-gray-400 mb-4">
            Your course has been {isEditMode ? 'updated' : 'created'} and saved{isEditMode ? '' : ' as a draft'}. 
            {!isEditMode && ' You can publish it when ready.'}
          </p>
          <div className="text-sm text-gray-500">
            Redirecting to content management...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/content')}
            className="p-2 rounded-lg bg-background-800 hover:bg-background-700 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isEditMode ? 'Edit Course' : 'Create New Course'}
            </h1>
            <p className="text-gray-400 mt-1">
              {isEditMode ? 'Update your course content and settings' : 'Build and publish your educational content'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Course Information */}
        <Card title="Course Information">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Course Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter course title..."
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe your course..."
                rows={4}
                disabled={loading}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Price ($)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Original Price ($)
                </label>
                <input
                  type="number"
                  value={formData.originalPrice || ''}
                  onChange={(e) => handleInputChange('originalPrice', parseFloat(e.target.value) || undefined)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Level
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => handleInputChange('level', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Total Duration
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., 10 hours, 5 weeks"
                disabled={loading}
              />
            </div>

            {isEditMode && (
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e) => handleInputChange('isPublished', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
                    disabled={loading}
                  />
                  <span>Published (visible to students)</span>
                </label>
              </div>
            )}
          </div>
        </Card>

        {/* Course Thumbnail */}
        <Card title="Course Thumbnail">
          <div className="space-y-4">
            {formData.existingThumbnail && !formData.thumbnailFile && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Current Thumbnail
                </label>
                <img
                  src={formData.existingThumbnail}
                  alt="Current thumbnail"
                  className="w-32 h-24 object-cover rounded-lg"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                {formData.existingThumbnail ? 'Replace Thumbnail Image' : 'Upload Thumbnail Image'}
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange('thumbnailFile', e.target.files?.[0] || null)}
                    className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    disabled={loading}
                  />
                </div>
                {formData.thumbnailFile && (
                  <div className="flex items-center gap-2 text-sm text-success-DEFAULT">
                    <Image size={16} />
                    <span>{formData.thumbnailFile.name}</span>
                  </div>
                )}
              </div>
              {uploadProgress.thumbnail !== undefined && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Uploading thumbnail...</span>
                    <span className="text-white">{uploadProgress.thumbnail}%</span>
                  </div>
                  <div className="w-full bg-background-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary-500 transition-all duration-300"
                      style={{ width: `${uploadProgress.thumbnail}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tags */}
        <Card title="Tags">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Add a tag..."
                disabled={loading}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                disabled={loading}
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
                      disabled={loading}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Requirements */}
        <Card title="Requirements">
          <div className="space-y-3">
            {formData.requirements.map((requirement, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={requirement}
                  onChange={(e) => handleArrayFieldChange('requirements', index, e.target.value)}
                  className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter a requirement..."
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => removeArrayField('requirements', index)}
                  className="p-2 text-gray-400 hover:text-error-DEFAULT transition-colors"
                  disabled={loading || formData.requirements.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayField('requirements')}
              className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
              disabled={loading}
            >
              <Plus size={16} />
              <span>Add requirement</span>
            </button>
          </div>
        </Card>

        {/* What You'll Learn */}
        <Card title="What You'll Learn">
          <div className="space-y-3">
            {formData.whatYouWillLearn.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleArrayFieldChange('whatYouWillLearn', index, e.target.value)}
                  className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="What will students learn..."
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => removeArrayField('whatYouWillLearn', index)}
                  className="p-2 text-gray-400 hover:text-error-DEFAULT transition-colors"
                  disabled={loading || formData.whatYouWillLearn.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayField('whatYouWillLearn')}
              className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
              disabled={loading}
            >
              <Plus size={16} />
              <span>Add learning outcome</span>
            </button>
          </div>
        </Card>

        {/* Lessons */}
        <Card title="Course Lessons">
          <div className="space-y-6">
            {formData.lessons.map((lesson, index) => (
              <div key={index} className="p-4 bg-background-800 rounded-lg border border-background-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">
                    Lesson {index + 1}
                    {lesson.id && isEditMode && (
                      <span className="text-xs text-gray-400 ml-2">(ID: {lesson.id})</span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeLesson(index)}
                    className="p-1 text-gray-400 hover:text-error-DEFAULT transition-colors"
                    disabled={loading}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Lesson Title *
                    </label>
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(e) => updateLesson(index, { title: e.target.value })}
                      className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Enter lesson title..."
                      disabled={loading}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Duration *
                    </label>
                    <input
                      type="text"
                      value={lesson.duration}
                      onChange={(e) => updateLesson(index, { duration: e.target.value })}
                      className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., 15 min"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Type
                    </label>
                    <select
                      value={lesson.type}
                      onChange={(e) => updateLesson(index, { type: e.target.value as any })}
                      className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={loading}
                    >
                      <option value="video">Video</option>
                      <option value="text">Text</option>
                      <option value="quiz">Quiz</option>
                      <option value="assignment">Assignment</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lesson.isPreview}
                        onChange={(e) => updateLesson(index, { isPreview: e.target.checked })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
                        disabled={loading}
                      />
                      <span>Free preview</span>
                    </label>
                  </div>
                </div>

                {/* File Uploads */}
                <div className="space-y-4">
                  {/* Video Section */}
                  <div className="p-4 bg-background-700 rounded-lg border border-background-600">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-300">
                        Video Content
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateLesson(index, { videoInputType: 'upload', externalVideoUrl: '' })}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            lesson.videoInputType === 'upload'
                              ? 'bg-primary-600 text-white'
                              : 'bg-background-600 text-gray-400 hover:text-white'
                          }`}
                          disabled={loading}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLesson(index, { videoInputType: 'url', videoFile: undefined })}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            lesson.videoInputType === 'url'
                              ? 'bg-primary-600 text-white'
                              : 'bg-background-600 text-gray-400 hover:text-white'
                          }`}
                          disabled={loading}
                        >
                          External URL
                        </button>
                      </div>
                    </div>

                    {lesson.videoInputType === 'upload' ? (
                      <>
                        {lesson.videoUrl && !lesson.videoFile && (
                          <div className="mb-2 text-xs text-success-DEFAULT">Current video uploaded</div>
                        )}
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleLessonFileChange(index, 'videoFile', e.target.files?.[0] || null)}
                            className="flex-1 bg-background-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer text-sm"
                            disabled={loading}
                          />
                          {lesson.videoFile && (
                            <div className="flex items-center gap-2 text-sm text-success-DEFAULT">
                              <Video size={16} />
                              <span>{lesson.videoFile.name}</span>
                            </div>
                          )}
                        </div>
                        {uploadProgress[`lesson_${index}_video`] !== undefined && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Uploading video...</span>
                              <span className="text-white">{uploadProgress[`lesson_${index}_video`]}%</span>
                            </div>
                            <div className="w-full bg-background-600 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-primary-500 transition-all duration-300"
                                style={{ width: `${uploadProgress[`lesson_${index}_video`]}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <input
                          type="url"
                          value={lesson.externalVideoUrl || ''}
                          onChange={(e) => handleExternalUrlChange(index, 'externalVideoUrl', e.target.value)}
                          className="w-full bg-background-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="https://youtube.com/watch?v=... or any video URL"
                          disabled={loading}
                        />
                        {lesson.externalVideoUrl && !validateUrl(lesson.externalVideoUrl) && (
                          <p className="text-xs text-error-DEFAULT mt-1">Please enter a valid URL starting with http:// or https://</p>
                        )}
                        {lesson.externalVideoUrl && validateUrl(lesson.externalVideoUrl) && (
                          <p className="text-xs text-success-DEFAULT mt-1 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Valid URL
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PDF Section */}
                  <div className="p-4 bg-background-700 rounded-lg border border-background-600">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-300">
                        PDF Document
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateLesson(index, { pdfInputType: 'upload', externalPdfUrl: '' })}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            lesson.pdfInputType === 'upload'
                              ? 'bg-primary-600 text-white'
                              : 'bg-background-600 text-gray-400 hover:text-white'
                          }`}
                          disabled={loading}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLesson(index, { pdfInputType: 'url', pdfFile: undefined })}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            lesson.pdfInputType === 'url'
                              ? 'bg-primary-600 text-white'
                              : 'bg-background-600 text-gray-400 hover:text-white'
                          }`}
                          disabled={loading}
                        >
                          External URL
                        </button>
                      </div>
                    </div>

                    {lesson.pdfInputType === 'upload' ? (
                      <>
                        {lesson.pdfUrl && !lesson.pdfFile && (
                          <div className="mb-2 text-xs text-success-DEFAULT">Current PDF uploaded</div>
                        )}
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleLessonFileChange(index, 'pdfFile', e.target.files?.[0] || null)}
                            className="flex-1 bg-background-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer text-sm"
                            disabled={loading}
                          />
                          {lesson.pdfFile && (
                            <div className="flex items-center gap-2 text-sm text-success-DEFAULT">
                              <FileText size={16} />
                              <span>{lesson.pdfFile.name}</span>
                            </div>
                          )}
                        </div>
                        {uploadProgress[`lesson_${index}_pdf`] !== undefined && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Uploading PDF...</span>
                              <span className="text-white">{uploadProgress[`lesson_${index}_pdf`]}%</span>
                            </div>
                            <div className="w-full bg-background-600 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-primary-500 transition-all duration-300"
                                style={{ width: `${uploadProgress[`lesson_${index}_pdf`]}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <input
                          type="url"
                          value={lesson.externalPdfUrl || ''}
                          onChange={(e) => handleExternalUrlChange(index, 'externalPdfUrl', e.target.value)}
                          className="w-full bg-background-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="https://drive.google.com/... or any PDF URL"
                          disabled={loading}
                        />
                        {lesson.externalPdfUrl && !validateUrl(lesson.externalPdfUrl) && (
                          <p className="text-xs text-error-DEFAULT mt-1">Please enter a valid URL starting with http:// or https://</p>
                        )}
                        {lesson.externalPdfUrl && validateUrl(lesson.externalPdfUrl) && (
                          <p className="text-xs text-success-DEFAULT mt-1 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Valid URL
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Text Content */}
                  {lesson.type === 'text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Text Content
                      </label>
                      <textarea
                        value={lesson.content || ''}
                        onChange={(e) => updateLesson(index, { content: e.target.value })}
                        className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Enter lesson content..."
                        rows={4}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addLesson}
              className="w-full p-4 border-2 border-dashed border-background-600 rounded-lg text-gray-400 hover:text-white hover:border-primary-500 transition-colors flex items-center justify-center gap-2"
              disabled={loading}
            >
              <Plus size={20} />
              <span>Add Lesson</span>
            </button>
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/content')}
            className="px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            <Save size={16} />
            <span>{loading ? `${isEditMode ? 'Updating' : 'Creating'} Course...` : `${isEditMode ? 'Update' : 'Create'} Course`}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default CourseCreation;