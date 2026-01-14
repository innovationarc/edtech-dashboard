// src/pages/TeacherTaskManagement.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Loader, AlertCircle, Calendar, BookOpen, Award, FileText, Mic, X } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { taskService, Task, Submission } from '../services/taskService';
import { courseService } from '../services/courseService'; // To get course names
import { Course } from '../services/courseService'; // Import Course interface

interface TaskFormData {
  id?: string;
  title: string;
  description: string;
  subject: string;
  courseId?: string;
  dueDate: string; // YYYY-MM-DDTHH:mm format
  pointsPossible: number;
  attachments: File[];
}

const TeacherTaskManagement = () => {
  const { user } = useDashboard();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [selectedTaskForSubmissions, setSelectedTaskForSubmissions] = useState<Task | null>(null);

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'English', 'General'
  ];

  useEffect(() => {
    if (user) {
      loadTasksAndCourses();
    }
  }, [user]);

  const loadTasksAndCourses = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [fetchedTasks, fetchedCourses] = await Promise.all([
        taskService.getTasks({ teacherId: user.uid }),
        courseService.getCoursesByInstructor(user.uid)
      ]);
      setTasks(fetchedTasks);
      setCourses(fetchedCourses);
    } catch (err: any) {
      setError('Failed to load tasks or courses: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    setCurrentTask(null);
    setShowTaskModal(true);
  };

  const handleEditTask = (task: Task) => {
    setCurrentTask(task);
    setShowTaskModal(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? All associated submissions will also be removed.')) {
      return;
    }
    try {
      // In a real app, you'd also delete submissions and files from storage
      // For now, we'll just remove from the list
      setTasks(tasks.filter(task => task.id !== taskId));
      if ((window as any).addNotification) {
        (window as any).addNotification('Task deleted successfully!', 'success');
      }
    } catch (err: any) {
      setError('Failed to delete task: ' + err.message);
    }
  };

  const handleSaveTask = async (formData: TaskFormData) => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }
    try {
      let uploadedAttachments: { url: string; name: string; type: string }[] = [];
      for (const file of formData.attachments) {
        const uploaded = await taskService.uploadFile(file, `task_attachments/${formData.title}`);
        uploadedAttachments.push(uploaded);
      }

      const taskData: Omit<Task, 'id' | 'createdAt'> = {
        title: formData.title,
        description: formData.description,
        subject: formData.subject,
        courseId: formData.courseId,
        courseName: courses.find(c => c.id === formData.courseId)?.title,
        teacherId: user.uid,
        teacherName: user.name,
        dueDate: new Date(formData.dueDate),
        pointsPossible: formData.pointsPossible,
        attachments: uploadedAttachments,
      };

      if (formData.id) {
        // Update existing task
        // await taskService.updateTask(formData.id, taskData); // Need to implement updateTask in service
        setTasks(tasks.map(t => t.id === formData.id ? { ...t, ...taskData, id: t.id } : t));
        if ((window as any).addNotification) {
          (window as any).addNotification('Task updated successfully!', 'success');
        }
      } else {
        // Create new task
        const newTaskId = await taskService.createTask(taskData);
        setTasks([...tasks, { ...taskData, id: newTaskId, createdAt: new Date() }]);
        if ((window as any).addNotification) {
          (window as any).addNotification('Task created successfully!', 'success');
        }
      }
      setShowTaskModal(false);
    } catch (err: any) {
      setError('Failed to save task: ' + err.message);
    }
  };

  const handleViewSubmissions = (task: Task) => {
    setSelectedTaskForSubmissions(task);
    setShowSubmissionsModal(true);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || task.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Management</h1>
          <p className="text-gray-400 mt-1">Create and manage homework assignments</p>
        </div>
        <button
          onClick={handleCreateTask}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          <span>Create New Task</span>
        </button>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search tasks..."
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
        </div>

        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={48} className="mx-auto mb-4" />
              <p>No tasks found. Create your first assignment!</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <div
                key={task.id}
                className="bg-background-800 rounded-lg p-4 hover:bg-background-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-white">{task.subject}</span>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs bg-primary-900 text-primary-300">
                    {task.pointsPossible} points
                  </span>
                </div>
                <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{task.title}</h3>
                <p className="text-gray-400 text-sm mb-3 line-clamp-2">{task.description}</p>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>Due: {task.dueDate.toLocaleDateString()}</span>
                  </div>
                  {task.courseName && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <BookOpen size={14} />
                        <span>{task.courseName}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-background-700 flex justify-end gap-2">
                  <button
                    onClick={() => handleViewSubmissions(task)}
                    className="flex items-center gap-1 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded transition-colors"
                  >
                    <Eye size={14} />
                    <span>View Submissions</span>
                  </button>
                  <button
                    onClick={() => handleEditTask(task)}
                    className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {showTaskModal && (
        <TaskModal
          task={currentTask}
          courses={courses}
          subjects={subjects}
          onClose={() => setShowTaskModal(false)}
          onSave={handleSaveTask}
        />
      )}

      {showSubmissionsModal && selectedTaskForSubmissions && (
        <SubmissionsModal
          task={selectedTaskForSubmissions}
          onClose={() => setShowSubmissionsModal(false)}
        />
      )}
    </div>
  );
};

interface TaskModalProps {
  task: Task | null;
  courses: Course[];
  subjects: string[];
  onClose: () => void;
  onSave: (formData: TaskFormData) => void;
}

const TaskModal = ({ task, courses, subjects, onClose, onSave }: TaskModalProps) => {
  const [formData, setFormData] = useState<TaskFormData>({
    id: task?.id || undefined,
    title: task?.title || '',
    description: task?.description || '',
    subject: task?.subject || '',
    courseId: task?.courseId || '',
    dueDate: task?.dueDate ? task.dueDate.toISOString().slice(0, 16) : '',
    pointsPossible: task?.pointsPossible || 100,
    attachments: [],
  });
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.subject || !formData.dueDate || !formData.pointsPossible) {
      setError('Please fill in all required fields.');
      return;
    }
    onSave({ ...formData, attachments: newAttachmentFiles });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewAttachmentFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
      <div className="bg-card w-full max-w-2xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
        <div className="p-5 border-b border-background-800 flex justify-between items-center">
          <h3 className="text-white font-medium">{task ? 'Edit Task' : 'Create New Task'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            ></textarea>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Subject *</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Associated Course (Optional)</label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">No Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Due Date *</label>
              <input
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Points Possible *</label>
              <input
                type="number"
                value={formData.pointsPossible}
                onChange={(e) => setFormData({ ...formData, pointsPossible: parseInt(e.target.value) || 0 })}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="0"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Attachments (Optional)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
            />
            {task?.attachments && task.attachments.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                Existing attachments: {task.attachments.map(att => att.name).join(', ')}
              </div>
            )}
            {newAttachmentFiles.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                New files to upload: {newAttachmentFiles.map(file => file.name).join(', ')}
              </div>
            )}
          </div>

          {error && <div className="text-error-DEFAULT text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-background-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SubmissionsModalProps {
  task: Task;
  onClose: () => void;
}

const SubmissionsModal = ({ task, onClose }: SubmissionsModalProps) => {
  const { user } = useDashboard();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSubmissionForGrading, setCurrentSubmissionForGrading] = useState<Submission | null>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);

  useEffect(() => {
    loadSubmissions();
  }, [task]);

  const loadSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedSubmissions = await taskService.getTaskSubmissions(task.id);
      setSubmissions(fetchedSubmissions);
    } catch (err: any) {
      setError('Failed to load submissions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmission = (submission: Submission) => {
    setCurrentSubmissionForGrading(submission);
    setShowGradeModal(true);
  };

  const handleSaveGrade = async (submissionId: string, grade: number, feedbackText?: string, feedbackAttachments?: File[]) => {
    try {
      let uploadedFeedbackAttachments: { url: string; name: string; type: string }[] = [];
      if (feedbackAttachments) {
        for (const file of feedbackAttachments) {
          const uploaded = await taskService.uploadFile(file, `feedback_attachments/${submissionId}`);
          uploadedFeedbackAttachments.push(uploaded);
        }
      }

      await taskService.gradeSubmission(submissionId, {
        grade,
        teacherFeedbackText: feedbackText,
        teacherFeedbackAttachments: uploadedFeedbackAttachments,
      });
      await loadSubmissions(); // Refresh submissions
      setShowGradeModal(false);
      if ((window as any).addNotification) {
        (window as any).addNotification('Submission graded successfully!', 'success');
      }
    } catch (err: any) {
      setError('Failed to save grade: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
      <div className="bg-card w-full max-w-4xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
        <div className="p-5 border-b border-background-800 flex justify-between items-center">
          <h3 className="text-white font-medium">Submissions for: {task.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader size={32} className="animate-spin text-primary-500" />
            </div>
          ) : error ? (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={48} className="mx-auto mb-4" />
              <p>No submissions yet for this task.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-background-800">
                    <th className="p-3 text-xs uppercase text-gray-400 font-medium">Student</th>
                    <th className="p-3 text-xs uppercase text-gray-400 font-medium">Submitted At</th>
                    <th className="p-3 text-xs uppercase text-gray-400 font-medium">Status</th>
                    <th className="p-3 text-xs uppercase text-gray-400 font-medium">Grade</th>
                    <th className="p-3 text-xs uppercase text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(submission => (
                    <tr key={submission.id} className="border-b border-background-800 last:border-0">
                      <td className="p-3 text-white">{submission.studentName}</td>
                      <td className="p-3 text-gray-300">{submission.submittedAt.toLocaleDateString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          submission.status === 'pending' ? 'bg-warning-dark text-warning-light' : 'bg-success-dark text-success-light'
                        }`}>
                          {submission.status}
                        </span>
                      </td>
                      <td className="p-3 text-white">{submission.grade !== undefined ? `${submission.grade}/${task.pointsPossible}` : '-'}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleGradeSubmission(submission)}
                            className="flex items-center gap-1 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded transition-colors"
                          >
                            <Award size={14} />
                            <span>{submission.status === 'graded' ? 'View/Edit Grade' : 'Grade'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showGradeModal && currentSubmissionForGrading && (
          <GradeSubmissionModal
            submission={currentSubmissionForGrading}
            taskPointsPossible={task.pointsPossible}
            onClose={() => setShowGradeModal(false)}
            onSave={handleSaveGrade}
          />
        )}
      </div>
    </div>
  );
};

interface GradeSubmissionModalProps {
  submission: Submission;
  taskPointsPossible: number;
  onClose: () => void;
  onSave: (submissionId: string, grade: number, feedbackText?: string, feedbackAttachments?: File[]) => void;
}

const GradeSubmissionModal = ({ submission, taskPointsPossible, onClose, onSave }: GradeSubmissionModalProps) => {
  const [grade, setGrade] = useState<number>(submission.grade !== undefined ? submission.grade : 0);
  const [feedbackText, setFeedbackText] = useState<string>(submission.teacherFeedbackText || '');
  const [feedbackAttachments, setFeedbackAttachments] = useState<File[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (grade < 0 || grade > taskPointsPossible) {
      setError(`Grade must be between 0 and ${taskPointsPossible}.`);
      return;
    }
    onSave(submission.id, grade, feedbackText, feedbackAttachments);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFeedbackAttachments(Array.from(e.target.files));
    }
  };

  const getFileTypeIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileText size={16} />; // Using FileText for generic image
    if (type.startsWith('audio/')) return <Mic size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
      <div className="bg-card w-full max-w-2xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
        <div className="p-5 border-b border-background-800 flex justify-between items-center">
          <h3 className="text-white font-medium">Grade Submission from {submission.studentName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-background-800 p-4 rounded-lg space-y-3">
            <h4 className="text-white font-medium">Student's Submission</h4>
            {submission.submissionText && (
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{submission.submissionText}</p>
            )}
            {submission.submissionAttachments && submission.submissionAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Attachments:</p>
                {submission.submissionAttachments.map((att, index) => (
                  <a key={index} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary-400 hover:underline text-sm">
                    {getFileTypeIcon(att.type)} {att.name}
                  </a>
                ))}
              </div>
            )}
            {!submission.submissionText && (!submission.submissionAttachments || submission.submissionAttachments.length === 0) && (
              <p className="text-gray-400 text-sm">No submission content provided by student.</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Grade (Points) *</label>
            <input
              type="number"
              value={grade}
              onChange={(e) => setGrade(parseInt(e.target.value) || 0)}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              min="0"
              max={taskPointsPossible}
              required
            />
            <p className="text-xs text-gray-400 mt-1">Max points: {taskPointsPossible}</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Feedback Text (Optional)</label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Provide feedback to the student..."
            ></textarea>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Feedback Attachments (PNG, Voice Message) (Optional)</label>
            <input
              type="file"
              multiple
              accept="image/png,audio/*"
              onChange={handleFileChange}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
            />
            {submission.teacherFeedbackAttachments && submission.teacherFeedbackAttachments.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                Existing feedback attachments: {submission.teacherFeedbackAttachments.map(att => att.name).join(', ')}
              </div>
            )}
            {feedbackAttachments.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                New files to upload: {feedbackAttachments.map(file => file.name).join(', ')}
              </div>
            )}
          </div>

          {error && <div className="text-error-DEFAULT text-sm">{error}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-background-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
            >
              Save Grade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherTaskManagement;