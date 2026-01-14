import { useState } from 'react';
import { X, Megaphone, AlertCircle, Bell, BookOpen, Loader } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { announcementService } from '../../services/announcementService';

interface CreateAnnouncementModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateAnnouncementModal = ({ onClose, onSuccess }: CreateAnnouncementModalProps) => {
  const { user } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    subject: '',
    type: 'announcement' as 'assignment' | 'announcement' | 'reminder' | 'urgent',
    priority: 'medium' as 'low' | 'medium' | 'high',
    targetAudience: 'all' as 'all' | 'course' | 'specific',
    expiresAt: '',
    targetCourses: [] as string[],
    targetStudents: [] as string[]
  });

  const subjects = [
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
    'General'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create announcements');
      return;
    }

    // Validation
    if (!formData.title.trim()) {
      setError('Please enter a title for the announcement');
      return;
    }

    if (!formData.message.trim()) {
      setError('Please enter a message for the announcement');
      return;
    }

    if (!formData.subject.trim()) {
      setError('Please select a subject');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const announcementData = {
        title: formData.title.trim(),
        message: formData.message.trim(),
        teacherId: user.uid,
        teacherName: user.name,
        subject: formData.subject,
        type: formData.type,
        priority: formData.priority,
        targetAudience: formData.targetAudience,
        targetCourses: formData.targetCourses,
        targetStudents: formData.targetStudents,
        isActive: true,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined
      };

      console.log('Creating announcement:', announcementData);
      
      const announcementId = await announcementService.createAnnouncement(announcementData);
      
      console.log('Announcement created successfully with ID:', announcementId);
      
      // Add success notification
      if ((window as any).addNotification) {
        (window as any).addNotification(
          `Announcement "${formData.title}" published successfully!`,
          'success'
        );
      }
      
      setSuccess(true);
      
      // Show success message briefly, then close
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error creating announcement:', error);
      setError(error.message || 'Failed to create announcement. Please try again.');
      
      // Add error notification
      if ((window as any).addNotification) {
        (window as any).addNotification(
          'Failed to publish announcement. Please try again.',
          'error'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <BookOpen size={16} className="text-primary-400" />;
      case 'reminder': return <Bell size={16} className="text-warning-DEFAULT" />;
      case 'urgent': return <AlertCircle size={16} className="text-error-DEFAULT" />;
      case 'announcement': return <Megaphone size={16} className="text-secondary-400" />;
      default: return <Megaphone size={16} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-error-DEFAULT bg-error-dark/10';
      case 'medium': return 'border-warning-DEFAULT bg-warning-dark/10';
      case 'low': return 'border-success-DEFAULT bg-success-dark/10';
      default: return 'border-background-600 bg-background-800';
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-success-DEFAULT flex items-center justify-center">
                <Megaphone size={32} className="text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">Announcement Created!</h2>
            
            <div className="bg-success-dark/20 border border-success-DEFAULT/30 rounded-lg p-4 mb-6">
              <p className="text-success-light font-medium mb-2">Successfully Published</p>
              <p className="text-sm text-gray-300">
                Your announcement "{formData.title}" has been published and will now appear on student dashboards.
              </p>
            </div>
            
            <div className="text-sm text-gray-400">
              <p>Students will be notified about:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Subject: {formData.subject}</li>
                <li>Type: {formData.type}</li>
                <li>Priority: {formData.priority}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-lg bg-secondary-600 flex items-center justify-center">
              <Megaphone size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Announcement</h2>
              <p className="text-gray-400">Share important information with your students</p>
            </div>
          </div>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Announcement Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                placeholder="Enter announcement title..."
                disabled={loading}
                maxLength={100}
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.title.length}/100 characters
              </div>
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'announcement', label: 'General' },
                    { value: 'assignment', label: 'Assignment' },
                    { value: 'reminder', label: 'Reminder' },
                    { value: 'urgent', label: 'Urgent' }
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleInputChange('type', type.value)}
                      disabled={loading}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                        formData.type === type.value
                          ? 'border-primary-500 bg-primary-900/20 text-primary-300'
                          : 'border-background-600 bg-background-800 text-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {getTypeIcon(type.value)}
                      <span className="text-sm">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Priority
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'low', label: 'Low Priority', color: 'success' },
                    { value: 'medium', label: 'Medium Priority', color: 'warning' },
                    { value: 'high', label: 'High Priority', color: 'error' }
                  ].map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => handleInputChange('priority', priority.value)}
                      disabled={loading}
                      className={`w-full p-2 rounded-lg border-l-4 transition-all text-left ${
                        formData.priority === priority.value
                          ? getPriorityColor(priority.value)
                          : 'border-l-background-600 bg-background-800 text-gray-300 hover:bg-background-700'
                      }`}
                    >
                      <span className="text-sm">{priority.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Subject *
              </label>
              <select
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="">Select a subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                placeholder="Enter your announcement message..."
                rows={6}
                disabled={loading}
                maxLength={1000}
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.message.length}/1000 characters
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Target Audience
              </label>
              <select
                value={formData.targetAudience}
                onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="all">All Students</option>
                <option value="course">Specific Course</option>
                <option value="specific">Specific Students</option>
              </select>
            </div>

            {/* Expiration Date */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Expiration Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => handleInputChange('expiresAt', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className="text-xs text-gray-500 mt-1">
                Leave empty for permanent announcement
              </div>
            </div>

            {/* Preview */}
            <div className="bg-background-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Preview</h4>
              <div className={`p-4 rounded-lg border-l-4 ${getPriorityColor(formData.priority)}`}>
                <div className="flex items-start gap-2 mb-2">
                  {getTypeIcon(formData.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-white truncate">
                        {formData.title || 'Announcement Title'}
                      </h4>
                      {formData.priority === 'high' && (
                        <span className="px-1.5 py-0.5 bg-error-DEFAULT text-white text-xs rounded-full">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {user?.name} • {formData.subject || 'Subject'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">Just now</span>
                </div>
                <p className="text-xs text-gray-300 line-clamp-2">
                  {formData.message || 'Your announcement message will appear here...'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-background-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 bg-background-800 hover:bg-background-700 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title.trim() || !formData.message.trim() || !formData.subject}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {loading && <Loader size={16} className="animate-spin" />}
                <Megaphone size={16} />
                <span>{loading ? 'Publishing...' : 'Publish Announcement'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateAnnouncementModal;