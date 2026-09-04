import { useState } from 'react';
import { Megaphone, AlertCircle, Bell, BookOpen, Loader } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { announcementService } from '../../services/announcementService';
import { notificationService } from '../../services/notificationService';
import ModalShell, { useModalFieldStyles } from '../shared/ModalShell';

interface CreateAnnouncementModalProps {
  onClose: () => void;
  onSuccess?: (announcement: { id: string; title: string; message: string; type: string; priority: string; subject: string; targetAudience: string; targetStudents: string[] }) => void;
}

const CreateAnnouncementModal = ({ onClose, onSuccess }: CreateAnnouncementModalProps) => {
  const { user } = useDashboard();
  const { inputCls, inputStyle, labelStyle, primaryBtnStyle, secondaryBtnStyle } = useModalFieldStyles();
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

      // Fan out notifications to specifically targeted students immediately.
      // For 'all' and 'course' audiences, syncAnnouncementsAsNotifications handles
      // delivery on the student's next visit to the notifications page.
      if (formData.targetAudience === 'specific' && formData.targetStudents.length > 0) {
        formData.targetStudents.forEach(userId => {
          notificationService.createNotification({
            userId,
            title: formData.title.trim(),
            message: formData.message.trim(),
            type: formData.type as any,
            priority: formData.priority as any,
            isPermanent: true,
            relatedId: announcementId,
            relatedType: 'announcement',
            metadata: { subject: formData.subject },
          });
        });
      }
      
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
          onSuccess({
            id: announcementId,
            title: formData.title.trim(),
            message: formData.message.trim(),
            type: formData.type,
            priority: formData.priority,
            subject: formData.subject,
            targetAudience: formData.targetAudience,
            targetStudents: formData.targetStudents,
          });
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
      <ModalShell icon={<Megaphone size={15} />} title="Announcement Published" onClose={onClose} disableBackdropClose>
        <div className="text-center py-2">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-success-DEFAULT flex items-center justify-center">
              <Megaphone size={26} className="text-white" />
            </div>
          </div>
          <div className="bg-success-dark/20 border border-success-DEFAULT/30 rounded-lg p-4 mb-4 text-left">
            <p className="text-success-light font-medium mb-1 text-sm">Successfully Published</p>
            <p className="text-xs text-gray-300">
              Your announcement "{formData.title}" has been published and will now appear on student dashboards.
            </p>
          </div>
          <div className="text-xs text-gray-400 text-left">
            <p>Students will be notified about:</p>
            <ul className="list-disc list-inside mt-1.5 space-y-1">
              <li>Subject: {formData.subject}</li>
              <li>Type: {formData.type}</li>
              <li>Priority: {formData.priority}</li>
            </ul>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      icon={<Megaphone size={15} />}
      title="Create Announcement"
      subtitle="Share important information with your students"
      onClose={onClose}
      disableBackdropClose={loading}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} style={secondaryBtnStyle}>
            Cancel
          </button>
          <button
            form="create-announcement-form"
            type="submit"
            disabled={loading || !formData.title.trim() || !formData.message.trim() || !formData.subject}
            style={{ ...primaryBtnStyle, opacity: (loading || !formData.title.trim() || !formData.message.trim() || !formData.subject) ? 0.5 : 1, cursor: (loading || !formData.title.trim() || !formData.message.trim() || !formData.subject) ? 'not-allowed' : 'pointer' }}
          >
            {loading && <Loader size={14} className="animate-spin" />}
            <Megaphone size={14} />
            <span>{loading ? 'Publishing...' : 'Publish Announcement'}</span>
          </button>
        </>
      }
    >
      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form id="create-announcement-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label style={labelStyle}>Announcement Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={inputCls}
            style={inputStyle}
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
            <label style={labelStyle}>Type</label>
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
                  className={`p-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    formData.type === type.value
                      ? 'border-primary-500 bg-primary-900/20 text-primary-300'
                      : 'border-background-600 bg-background-800/60 text-gray-300 hover:border-primary-400'
                  }`}
                >
                  {getTypeIcon(type.value)}
                  <span className="text-xs">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Priority</label>
            <div className="space-y-1.5">
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
                      : 'border-l-background-600 bg-background-800/60 text-gray-300 hover:bg-background-700'
                  }`}
                >
                  <span className="text-xs">{priority.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label style={labelStyle}>Subject *</label>
          <select
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            className={inputCls}
            style={inputStyle}
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
          <label style={labelStyle}>Message *</label>
          <textarea
            value={formData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            className={inputCls + ' resize-none'}
            style={inputStyle}
            placeholder="Enter your announcement message..."
            rows={5}
            disabled={loading}
            maxLength={1000}
          />
          <div className="text-xs text-gray-500 mt-1">
            {formData.message.length}/1000 characters
          </div>
        </div>

        {/* Target Audience */}
        <div>
          <label style={labelStyle}>Target Audience</label>
          <select
            value={formData.targetAudience}
            onChange={(e) => handleInputChange('targetAudience', e.target.value)}
            className={inputCls}
            style={inputStyle}
            disabled={loading}
          >
            <option value="all">All Students</option>
            <option value="course">Specific Course</option>
            <option value="specific">Specific Students</option>
          </select>
        </div>

        {/* Expiration Date */}
        <div>
          <label style={labelStyle}>Expiration Date (Optional)</label>
          <input
            type="datetime-local"
            value={formData.expiresAt}
            onChange={(e) => handleInputChange('expiresAt', e.target.value)}
            className={inputCls}
            style={inputStyle}
            disabled={loading}
            min={new Date().toISOString().slice(0, 16)}
          />
          <div className="text-xs text-gray-500 mt-1">
            Leave empty for permanent announcement
          </div>
        </div>

        {/* Preview */}
        <div className="bg-background-800/60 rounded-lg p-3">
          <h4 className="text-xs font-medium text-gray-400 mb-2.5">Preview</h4>
          <div className={`p-3 rounded-lg border-l-4 ${getPriorityColor(formData.priority)}`}>
            <div className="flex items-start gap-2 mb-1.5">
              {getTypeIcon(formData.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-medium text-white truncate">
                    {formData.title || 'Announcement Title'}
                  </h4>
                  {formData.priority === 'high' && (
                    <span className="px-1.5 py-0.5 bg-error-DEFAULT text-white text-[11px] rounded-full">
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
      </form>
    </ModalShell>
  );
};

export default CreateAnnouncementModal;
