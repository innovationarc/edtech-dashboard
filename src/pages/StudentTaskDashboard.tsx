// src/pages/StudentTaskDashboard.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Calendar, BookOpen, Award, Send, Loader, AlertCircle, CheckCircle, Clock, X, Mic, Play, Eye } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { taskService, Task, Submission } from '../services/taskService';

interface SubmissionFormData {
  taskId: string;
  submissionText: string;
  submissionAttachments: File[];
}

const StudentTaskDashboard = () => {
  const { user } = useDashboard();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'graded'>('all');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [currentTaskForSubmission, setCurrentTaskForSubmission] = useState<Task | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentSubmissionForFeedback, setCurrentSubmissionForFeedback] = useState<Submission | null>(null);

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'English', 'General'
  ];

  useEffect(() => {
    if (user) {
      loadTasksAndSubmissions();
    }
  }, [user, selectedStatus]);

  const loadTasksAndSubmissions = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [fetchedTasks, fetchedSubmissions] = await Promise.all([
        taskService.getTasks({ studentId: user.uid, status: selectedStatus }),
        taskService.getStudentSubmissions(user.uid)
      ]);
      setTasks(fetchedTasks);
      setSubmissions(fetchedSubmissions);
    } catch (err: any) {
      setError('Failed to load tasks or submissions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTaskStatus = (task: Task): 'pending' | 'submitted' | 'graded' => {
    const submission = submissions.find(s => s.taskId === task.id && s.studentId === user?.uid);
    if (!submission) return 'pending';
    return submission.status;
  };

  const handleOpenSubmitModal = (task: Task) => {
    setCurrentTaskForSubmission(task);
    setShowSubmitModal(true);
  };

  const handleSubmitTask = async (formData: SubmissionFormData) => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }
    try {
      let uploadedAttachments: { url: string; name: string; type: string }[] = [];
      for (const file of formData.submissionAttachments) {
        const uploaded = await taskService.uploadFile(file, `student_submissions/${user.uid}/${formData.taskId}`);
        uploadedAttachments.push(uploaded);
      }

      const submissionData: Omit<Submission, 'id' | 'submittedAt'> = {
        taskId: formData.taskId,
        studentId: user.uid,
        studentName: user.name,
        submissionText: formData.submissionText,
        submissionAttachments: uploadedAttachments,
        status: 'pending',
      };

      const newSubmissionId = await taskService.submitTask(submissionData);
      setSubmissions([...submissions, { ...submissionData, id: newSubmissionId, submittedAt: new Date() }]);
      setShowSubmitModal(false);
      if ((window as any).addNotification) {
        (window as any).addNotification('Task submitted successfully!', 'success');
      }
      await loadTasksAndSubmissions(); // Refresh tasks to update status
    } catch (err: any) {
      setError('Failed to submit task: ' + err.message);
    }
  };

  const handleViewFeedback = (submission: Submission) => {
    setCurrentSubmissionForFeedback(submission);
    setShowFeedbackModal(true);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
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
          <h1 className="text-2xl font-bold text-white">My Tasks & Homework</h1>
          <p className="text-gray-400 mt-1">View assigned tasks and submit your work</p>
        </div>
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
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'graded')}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Submission</option>
            <option value="graded">Graded</option>
          </select>
        </div>

        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={48} className="mx-auto mb-4" />
              <p>No tasks found matching your criteria.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const status = getTaskStatus(task);
              const studentSubmission = submissions.find(s => s.taskId === task.id && s.studentId === user?.uid);
              const isOverdue = new Date() > task.dueDate && status === 'pending';

              return (
                <div
                  key={task.id}
                  className="bg-background-800 rounded-lg p-4 hover:bg-background-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-primary-400" />
                      <span className="text-sm font-medium text-white">{task.subject}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      status === 'pending' && !isOverdue ? 'bg-warning-dark text-warning-light' :
                      status === 'graded' ? 'bg-success-dark text-success-light' :
                      'bg-gray-500 text-white'
                    }`}>
                      {status === 'pending' && isOverdue ? 'Overdue' : status}
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
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Award size={14} />
                      <span>{task.pointsPossible} points</span>
                    </div>
                  </div>
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="mt-2 text-sm text-gray-400">
                      Attachments: {task.attachments.map((att, idx) => (
                        <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline ml-1">
                          {att.name}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-background-700 flex justify-end gap-2">
                    {status === 'pending' ? (
                      <button
                        onClick={() => handleOpenSubmitModal(task)}
                        className="flex items-center gap-1 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        <Send size={14} />
                        <span>Submit Task</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => studentSubmission && handleViewFeedback(studentSubmission)}
                        className="flex items-center gap-1 text-sm bg-success-600 hover:bg-success-700 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        <Eye size={14} />
                        <span>View Feedback</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {showSubmitModal && currentTaskForSubmission && (
        <SubmitTaskModal
          task={currentTaskForSubmission}
          onClose={() => setShowSubmitModal(false)}
          onSave={handleSubmitTask}
        />
      )}

      {showFeedbackModal && currentSubmissionForFeedback && (
        <ViewFeedbackModal
          submission={currentSubmissionForFeedback}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
};

interface SubmitTaskModalProps {
  task: Task;
  onClose: () => void;
  onSave: (formData: SubmissionFormData) => void;
}

const SubmitTaskModal = ({ task, onClose, onSave }: SubmitTaskModalProps) => {
  const [submissionText, setSubmissionText] = useState('');
  const [submissionAttachments, setSubmissionAttachments] = useState<File[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionText.trim() && submissionAttachments.length === 0) {
      setError('Please provide text or attach a file for your submission.');
      return;
    }
    onSave({ taskId: task.id, submissionText, submissionAttachments });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSubmissionAttachments(Array.from(e.target.files));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
      <div className="bg-card w-full max-w-2xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
        <div className="p-5 border-b border-background-800 flex justify-between items-center">
          <h3 className="text-white font-medium">Submit Task: {task.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Submission Text (Optional)</label>
            <textarea
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              rows={6}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Type your answer or notes here..."
            ></textarea>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Attachments (Optional)</label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
            />
            {submissionAttachments.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                Files to upload: {submissionAttachments.map(file => file.name).join(', ')}
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
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors flex items-center gap-2"
            >
              <Send size={16} />
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ViewFeedbackModalProps {
  submission: Submission;
  onClose: () => void;
}

const ViewFeedbackModal = ({ submission, onClose }: ViewFeedbackModalProps) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadTask = async () => {
      setLoading(true);
      setError('');
      try {
        const fetchedTask = await taskService.getTaskById(submission.taskId);
        setTask(fetchedTask);
      } catch (err: any) {
        setError('Failed to load task details: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadTask();
  }, [submission.taskId]);

  const getFileTypeIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileText size={16} />;
    if (type.startsWith('audio/')) return <Mic size={16} />;
    return <FileText size={16} />;
  };

  const handlePlayAudio = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(e => console.error("Error playing audio:", e));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
        <div className="bg-card w-full max-w-2xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
          <div className="p-5">
            <Loader size={32} className="animate-spin text-primary-500 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
        <div className="bg-card w-full max-w-2xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
          <div className="p-5 border-b border-background-800 flex justify-between items-center">
            <h3 className="text-white font-medium">Error Loading Feedback</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="p-5 text-center text-error-DEFAULT">
            {error || "Task details could not be loaded."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 mobile-modal">
      <div className="bg-card w-full max-w-2xl rounded-xl overflow-hidden shadow-lg mobile-modal-content">
        <div className="p-5 border-b border-background-800 flex justify-between items-center">
          <h3 className="text-white font-medium">Feedback for: {task.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-background-800 p-4 rounded-lg space-y-3">
            <h4 className="text-white font-medium">Your Submission</h4>
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
              <p className="text-gray-400 text-sm">No submission content provided.</p>
            )}
          </div>

          <div className="bg-background-800 p-4 rounded-lg space-y-3">
            <h4 className="text-white font-medium">Teacher's Feedback</h4>
            <div className="flex items-center justify-between">
              <p className="text-gray-300 text-sm">Grade:</p>
              <span className="text-white font-bold text-lg">{submission.grade !== undefined ? `${submission.grade}/${task.pointsPossible}` : 'N/A'}</span>
            </div>
            {submission.teacherFeedbackText && (
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{submission.teacherFeedbackText}</p>
            )}
            {submission.teacherFeedbackAttachments && submission.teacherFeedbackAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">Attachments:</p>
                {submission.teacherFeedbackAttachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-2 text-primary-400 text-sm">
                    {getFileTypeIcon(att.type)} {att.name}
                    {att.type.startsWith('audio/') && (
                      <button type="button" onClick={() => handlePlayAudio(att.url)} className="ml-2 p-1 rounded-full bg-primary-600 hover:bg-primary-700 text-white">
                        <Play size={14} />
                      </button>
                    )}
                    {!att.type.startsWith('audio/') && (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="ml-2 p-1 rounded-full bg-primary-600 hover:bg-primary-700 text-white">
                        <Eye size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!submission.teacherFeedbackText && (!submission.teacherFeedbackAttachments || submission.teacherFeedbackAttachments.length === 0) && (
              <p className="text-gray-400 text-sm">No feedback provided yet.</p>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-background-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTaskDashboard;