import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Upload, 
  Save, 
  Image,
  Trash2,
  Loader,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course } from '../services/courseService';
import { useNavigate, useParams } from 'react-router-dom';

interface CourseFormData {
  title: string;
  description: string;
  price: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  requirements: string[];
  whatYouWillLearn: string[];
  thumbnailFile?: File;
  existingThumbnail?: string;
  hasQnA: boolean;
  hasStudyPlanner: boolean;
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
    level: 'beginner',
    category: '',
    tags: [],
    requirements: [''],
    whatYouWillLearn: [''],
    hasQnA: false,
    hasStudyPlanner: false,
    isPublished: false
  });
  
  const [currentTag, setCurrentTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');

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
    'Marketing',
    'Engineering',
    'Physics',
    'Chemistry',
    'Biology',
    'History',
    'Geography',
    'Literature',
    'Philosophy'
  ];

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

      if (user?.role !== 'admin' && course.instructorId !== user?.uid) {
        setError('You do not have permission to edit this course');
        return;
      }

      setFormData({
        title: course.title,
        description: course.description,
        price: course.price,
        level: course.level,
        category: course.category,
        tags: course.tags,
        requirements: course.requirements.length > 0 ? course.requirements : [''],
        whatYouWillLearn: course.whatYouWillLearn.length > 0 ? course.whatYouWillLearn : [''],
        existingThumbnail: course.thumbnail,
        hasQnA: course.hasQnA || false,
        hasStudyPlanner: course.hasStudyPlanner || false,
        isPublished: course.isPublished
      });

      if (course.thumbnail) {
        setThumbnailPreview(course.thumbnail);
      }

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
    if (formData[field].length === 1) return;
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, thumbnailFile: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setFormData(prev => ({ 
      ...prev, 
      thumbnailFile: undefined,
      existingThumbnail: undefined 
    }));
    setThumbnailPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create/edit a course');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let thumbnailUrl = formData.existingThumbnail || '';
      
      // Upload thumbnail if new file provided
      if (formData.thumbnailFile) {
        const thumbnailResult = await courseService.uploadFile(
          formData.thumbnailFile, 
          'course_thumbnails'
        );
        thumbnailUrl = thumbnailResult.url;
      }

      // Create course data without lessons
      const courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title || 'Untitled Course',
        description: formData.description || '',
        instructor: user.name,
        instructorId: user.uid,
        price: formData.price || 0,
        rating: 0,
        reviewCount: 0,
        studentCount: 0,
        duration: '0 hours', // Will be calculated when lessons are added
        level: formData.level,
        category: formData.category || 'General',
        tags: formData.tags,
        thumbnail: thumbnailUrl,
        lessons: [], // Empty lessons array
        requirements: formData.requirements.filter(req => req.trim()),
        whatYouWillLearn: formData.whatYouWillLearn.filter(item => item.trim()),
        hasQnA: formData.hasQnA,
        hasStudyPlanner: formData.hasStudyPlanner,
        isPublished: formData.isPublished
      };

      let newCourseId = courseId;

      if (isEditMode && courseId) {
        await courseService.updateCourse(courseId, courseData);
        
        if ((window as any).addNotification) {
          (window as any).addNotification(
            `Course "${formData.title}" updated successfully!`,
            'success'
          );
        }
      } else {
        newCourseId = await courseService.createCourse(courseData);
        
        if ((window as any).addNotification) {
          (window as any).addNotification(
            `Course "${formData.title}" created successfully! Course ID: ${newCourseId}`,
            'success'
          );
        }
      }
      
      setSuccess(true);
      
      // Show success message with course ID and redirect
      setTimeout(() => {
        if (isEditMode) {
          navigate('/content');
        } else {
          navigate('/content', { state: { newCourseId } });
        }
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
            {isEditMode 
              ? 'Your course has been updated successfully.'
              : 'Your course has been created. You can now add lessons to this course from the Content Upload page.'}
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
              {isEditMode 
                ? 'Update your course information' 
                : 'Create a new course. Add lessons later from Content Upload page'}
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
                  Course Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter course title..."
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
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
                Short Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe your course..."
                rows={4}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Price (BDT)
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
          </div>
        </Card>

        {/* Course Thumbnail */}
        <Card title="Course Thumbnail">
          <div className="space-y-4">
            {thumbnailPreview && (
              <div className="relative inline-block">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-48 h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removeThumbnail}
                  className="absolute -top-2 -right-2 p-1 bg-error-DEFAULT text-white rounded-full hover:bg-error-dark transition-colors"
                  disabled={loading}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Upload Thumbnail Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Recommended size: 1280x720 pixels</p>
            </div>
          </div>
        </Card>

        {/* Additional Features */}
        <Card title="Additional Features">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasQnA}
                  onChange={(e) => handleInputChange('hasQnA', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
                  disabled={loading}
                />
                <BookOpen size={16} className="text-primary-400" />
                <span>Enable Q&A (Questions and Answers)</span>
              </label>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasStudyPlanner}
                  onChange={(e) => handleInputChange('hasStudyPlanner', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
                  disabled={loading}
                />
                <BookOpen size={16} className="text-secondary-400" />
                <span>Enable Study Planner</span>
              </label>
            </div>

            <div className="bg-background-800 p-4 rounded-lg">
              <p className="text-sm text-gray-400">
                <strong className="text-white">Note:</strong> These features can be enabled or disabled at any time. 
                Q&A allows students to ask questions about course content, while Study Planner helps students organize their learning schedule.
              </p>
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

        {/* Publish Settings */}
        {isEditMode && (
          <Card title="Publish Settings">
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
          </Card>
        )}

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
