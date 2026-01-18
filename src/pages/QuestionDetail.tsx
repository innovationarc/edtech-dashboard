// src/pages/QuestionDetail.tsx - Part 1 of 3 (Enhanced with Rating Edit, Image/PDF Viewer, Voice Support, LaTeX, Full Edit Support)
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  BookOpen, 
  User, 
  Loader, 
  AlertCircle, 
  FileText, 
  Volume2, 
  Brain, 
  MessageSquare, 
  ThumbsUp, 
  HelpCircle,
  Trash2,
  X,
  Filter,
  XCircle,
  Star,
  Edit2,
  Bookmark,
  Download,
  Eye,
  Mic,
  Pause,
  Play
} from 'lucide-react';
import Card from '../components/ui/Card';
import { qaService, Question, Answer } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { useDashboard } from '../contexts/DashboardContext';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

const QuestionDetail = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [enrolledCoursesWithQnA, setEnrolledCoursesWithQnA] = useState<Course[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [savedFilter, setSavedFilter] = useState<'all' | 'saved'>('all');
  const [savedQuestions, setSavedQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuestionMenu, setShowQuestionMenu] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [currentDocUrl, setCurrentDocUrl] = useState('');
  const [currentDocName, setCurrentDocName] = useState('');
  const [currentDocType, setCurrentDocType] = useState<'pdf' | 'other'>('other');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
    loadSavedQuestions();
    loadAllQuestions();
  }, []);

  useEffect(() => {
    if (questionId) {
      loadQuestionAndAnswers();
    }
  }, [questionId]);

  const loadEnrolledCoursesWithQnA = async () => {
    try {
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      const enrolledCourses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const course = await courseService.getCourseById(enrollment.courseId);
          return course;
        })
      );
      const coursesWithQnA = enrolledCourses.filter(
        (course): course is Course => course !== null && course.hasQnA === true
      );
      setEnrolledCoursesWithQnA(coursesWithQnA);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const loadSavedQuestions = async () => {
    try {
      const saved = await qaService.getSavedQuestions(user?.uid || '');
      setSavedQuestions(saved);
    } catch (err) {
      console.error('Failed to load saved questions:', err);
    }
  };

  const loadAllQuestions = async () => {
    try {
      const allQs = await qaService.getQuestions('all', 'all');
      const enrolledCourseIds = enrolledCoursesWithQnA.map(c => c.id);
      
      const filteredQuestions = allQs.filter(q => {
        if (q.isFollowUp) return false;
        
        if (q.studentId === user?.uid) {
          return true;
        } else {
          const isEnrolled = q.courseId === 'help-support' || enrolledCourseIds.includes(q.courseId || '');
          return q.status === 'answered' && q.status !== 'closed' && isEnrolled;
        }
      });
      
      const rootQuestions = filteredQuestions.filter(q => !q.parentQuestionId);
      setAllQuestions(rootQuestions);
    } catch (err) {
      console.error('Failed to load all questions:', err);
    }
  };

  const loadQuestionAndAnswers = async () => {
    setLoading(true);
    setError('');
    try {
      const [questionData, answersData] = await Promise.all([
        qaService.getQuestionById(questionId!),
        qaService.getAnswersForQuestion(questionId!),
      ]);

      if (!questionData) {
        setError('Question not found');
        return;
      }

      if (questionData.status === 'closed' && questionData.studentId !== user?.uid) {
        setError('This question has been closed and is not accessible');
        return;
      }

      setQuestion(questionData);
      setAnswers(answersData);

      const allQs = await qaService.getQuestions('all', 'all');
      const followUps = allQs.filter(q => q.parentQuestionId === questionId);
      setFollowUpQuestions(followUps);

      if (questionData.studentId === user?.uid && questionData.status === 'answered' && !questionData.viewedByStudent) {
        await qaService.markQuestionAsViewed(questionData.id);
        
        const notifications = await qaService.getNotifications(user?.uid || '');
        const relatedNotif = notifications.find(n => n.questionId === questionData.id && !n.read);
        if (relatedNotif) {
          await qaService.markNotificationAsRead(relatedNotif.id);
        }
        
        loadAllQuestions();
      }

      for (const followUp of followUps) {
        if (followUp.studentId === user?.uid && followUp.status === 'answered' && !followUp.viewedByStudent) {
          await qaService.markQuestionAsViewed(followUp.id);
          
          const notifications = await qaService.getNotifications(user?.uid || '');
          const relatedNotif = notifications.find(n => n.questionId === followUp.id && !n.read);
          if (relatedNotif) {
            await qaService.markNotificationAsRead(relatedNotif.id);
          }
        }
      }
      
      loadAllQuestions();

    } catch (err: any) {
      setError('Failed to load question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSatisfactionChange = async (status: 'satisfied' | 'confused') => {
    if (!question || question.studentId !== user?.uid || question.status === 'closed') return;

    try {
      await qaService.updateSatisfactionStatus(question.id, status);
      setQuestion({ ...question, satisfactionStatus: status });
      
      if (status === 'confused') {
        setShowFollowUpModal(true);
      }
      
      if ((window as any).addNotification) {
        (window as any).addNotification(
          status === 'satisfied' 
            ? 'Marked as satisfied!' 
            : 'You can now ask a follow-up question',
          'success'
        );
      }
    } catch (err: any) {
      setError('Failed to update status: ' + err.message);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!question || question.studentId !== user?.uid) return;

    try {
      await qaService.deleteQuestionWithRelatedData(question.id);

      if ((window as any).addNotification) {
        (window as any).addNotification('Question deleted successfully', 'success');
      }

      navigate('/student-qa');
    } catch (err: any) {
      setError('Failed to delete question: ' + err.message);
      if ((window as any).addNotification) {
        (window as any).addNotification('Failed to delete question', 'error');
      }
    }
  };

  const handleSaveQuestion = async (qId: string) => {
    try {
      if (savedQuestions.includes(qId)) {
        await qaService.unsaveQuestion(user?.uid || '', qId);
        setSavedQuestions(prev => prev.filter(id => id !== qId));
        if ((window as any).addNotification) {
          (window as any).addNotification('Question removed from saved', 'info');
        }
      } else {
        await qaService.saveQuestion(user?.uid || '', qId);
        setSavedQuestions(prev => [...prev, qId]);
        if ((window as any).addNotification) {
          (window as any).addNotification('Question saved!', 'success');
        }
      }
    } catch (err: any) {
      setError('Failed to save question: ' + err.message);
    }
  };

  const handleViewDocument = (url: string, name: string, type: 'pdf' | 'other') => {
    setCurrentDocUrl(url);
    setCurrentDocName(name);
    setCurrentDocType(type);
    setShowDocViewer(true);
  };

  const handleViewImage = (url: string) => {
    setCurrentImageUrl(url);
    setShowImageViewer(true);
  };

  const handleBackToQuestions = () => {
    navigate('/student-qa');
  };

  const hasUnreadAnswer = (q: Question): boolean => {
    if (q.studentId !== user?.uid) return false;
    
    if (q.status === 'answered' && !q.viewedByStudent) return true;
    
    const hasUnreadFollowUp = allQuestions.some(aq => 
      aq.parentQuestionId === q.id && 
      aq.studentId === user?.uid && 
      aq.status === 'answered' && 
      !aq.viewedByStudent
    );
    
    return hasUnreadFollowUp;
  };

  const filteredQuestionMenu = allQuestions.filter(q => {
    const courseMatch = selectedCourseFilter === 'all' ? true :
                        selectedCourseFilter === 'help-support' ? q.courseId === 'help-support' :
                        q.courseId === selectedCourseFilter;
    
    const savedMatch = savedFilter === 'all' ? true : savedQuestions.includes(q.id);
    
    return courseMatch && savedMatch;
  });

  const isStudentQuestion = question?.studentId === user?.uid;
  const isAnswered = question?.status === 'answered' && answers.length > 0;
  const isClosed = question?.status === 'closed';
  const isPending = question?.status === 'pending';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleBackToQuestions}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Questions</span>
        </button>
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error || 'Question not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className={`${showQuestionMenu ? 'w-80' : 'w-12'} transition-all duration-300 flex-shrink-0`}>
        <div className="sticky top-6">
          <button
            onClick={() => setShowQuestionMenu(!showQuestionMenu)}
            className="mb-4 p-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors w-full flex items-center justify-center"
          >
            {showQuestionMenu ? <X size={20} /> : <Filter size={20} />}
          </button>

          {showQuestionMenu && (
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Questions</h3>
                  <button
                    onClick={handleBackToQuestions}
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    View All
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Filter by Course</label>
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="w-full bg-background-800 text-white text-sm rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">All Courses</option>
                    <option value="help-support">Help & Support</option>
                    {enrolledCoursesWithQnA.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-2">Filter by Saved</label>
                  <select
                    value={savedFilter}
                    onChange={(e) => setSavedFilter(e.target.value as 'all' | 'saved')}
                    className="w-full bg-background-800 text-white text-sm rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">All Questions</option>
                    <option value="saved">Saved Only</option>
                  </select>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredQuestionMenu.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No questions found</p>
                  ) : (
                    filteredQuestionMenu.map(q => (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg transition-colors relative ${
                          q.id === questionId 
                            ? 'bg-primary-900 border border-primary-500' 
                            : 'bg-background-800 hover:bg-background-700'
                        }`}
                      >
                        <div 
                          onClick={() => navigate(`/question/${q.id}`)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <BookOpen size={14} className="text-primary-400 flex-shrink-0" />
                              <span className="text-xs text-gray-400 truncate">{q.subject}</span>
                              {hasUnreadAnswer(q) && (
                                <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${
                              q.status === 'pending' 
                                ? 'bg-warning-dark text-warning-light' 
                                : q.status === 'closed'
                                ? 'bg-error-dark text-error-light'
                                : 'bg-success-dark text-success-light'
                            }`}>
                              {q.status === 'pending' ? 'Pending' : q.status === 'closed' ? 'Closed' : 'Answered'}
                            </span>
                          </div>
                          <p className="text-white text-sm line-clamp-2 mb-1">{q.questionText}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <User size={12} />
                            <span className="truncate">{q.studentName}</span>
                            {q.studentId === user?.uid && (
                              <span className="text-primary-400">(You)</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveQuestion(q.id);
                          }}
                          className="absolute top-2 right-2 p-1 hover:bg-background-700 rounded transition-colors"
                        >
                          <Bookmark 
                            size={14} 
                            className={savedQuestions.includes(q.id) ? 'fill-primary-400 text-primary-400' : 'text-gray-400'}
                          />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <button
          onClick={handleBackToQuestions}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Questions</span>
        </button>

        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-primary-400" />
                <span className="text-lg font-medium text-white">{question.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveQuestion(question.id)}
                  className="p-2 hover:bg-background-700 rounded-lg transition-colors"
                  title={savedQuestions.includes(question.id) ? 'Remove from saved' : 'Save question'}
                >
                  <Bookmark 
                    size={18} 
                    className={savedQuestions.includes(question.id) ? 'fill-primary-400 text-primary-400' : 'text-gray-400'}
                  />
                </button>
                {question.answeredBy && question.status !== 'closed' && (
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    question.answeredBy === 'ai' 
                      ? 'bg-purple-900 text-purple-300' 
                      : 'bg-blue-900 text-blue-300'
                  }`}>
                    {question.answeredBy === 'ai' ? 'AI Answered' : question.courseId === 'help-support' ? 'Admin Answered' : 'Teacher Answered'}
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs ${
                  question.status === 'pending' 
                    ? 'bg-warning-dark text-warning-light' 
                    : question.status === 'closed'
                    ? 'bg-error-dark text-error-light'
                    : 'bg-success-dark text-success-light'
                }`}>
                  {question.status === 'pending' ? 'Pending' : question.status === 'closed' ? 'Closed' : 'Answered'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-background-700">
              <h2 className="text-2xl font-bold text-white mb-4">Question</h2>
              <div className="text-gray-300 text-lg">{renderFormattedText(question.questionText)}</div>
            </div>

            {question.imageUrl && (
              <div>
                <img 
                  src={question.imageUrl} 
                  alt="Question attachment" 
                  className="max-h-96 object-contain rounded-lg border border-background-700 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => handleViewImage(question.imageUrl!)}
                />
              </div>
            )}

            {question.audioUrl && (
              <AudioPlayer audioUrl={question.audioUrl} label="Voice Question" />
            )}

            {question.fileName && question.fileUrl && (
              <div className="bg-background-800 rounded-lg p-4 flex items-center gap-3">
                <FileText size={20} className="text-primary-400" />
                <div className="flex-1">
                  <p className="text-white font-medium">{question.fileName}</p>
                </div>
                <div className="flex gap-2">
                  {question.fileName.toLowerCase().endsWith('.pdf') && (
                    <button
                      onClick={() => handleViewDocument(question.fileUrl!, question.fileName!, 'pdf')}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                    >
                      <Eye size={14} />
                      <span>View</span>
                    </button>
                  )}
                  <a
                    href={question.fileUrl}
                    download={question.fileName}
                    onClick={(e) => {
                      e.preventDefault();
                      fetch(question.fileUrl!)
                        .then(res => res.blob())
                        .then(blob => {
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = question.fileName!;
                          a.click();
                          window.URL.revokeObjectURL(url);
                        });
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-background-700 hover:bg-background-600 text-white rounded text-sm transition-colors"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm text-gray-400 pt-4 border-t border-background-700">
              <div className="flex items-center gap-2">
                <User size={16} />
                <span>Asked by {question.studentName}</span>
              </div>
              <span>•</span>
              <span>{question.createdAt.toLocaleDateString()} at {question.createdAt.toLocaleTimeString()}</span>
            </div>

            {isStudentQuestion && isPending && (
              <div className="flex gap-3 pt-4 border-t border-background-700">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Edit2 size={16} />
                  <span>Edit Question</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 flex items-center justify-center gap-2 bg-error-dark hover:bg-error-DEFAULT text-error-light px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  <span>Delete Question</span>
                </button>
              </div>
            )}
          </div>
        </Card>
// src/pages/QuestionDetail.tsx - Part 2 of 3 (Answer Cards and Follow-up Questions)

        {isClosed ? (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-error-light">
                <XCircle size={20} />
                <h3 className="text-lg font-semibold">Question Closed</h3>
              </div>
              
              {question.closedReason && (
                <div className="bg-background-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Admin Comment:</h4>
                  <p className="text-white whitespace-pre-wrap">{question.closedReason}</p>
                </div>
              )}
              
              <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={16} />
                <span>This question has been closed by admin.</span>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <MessageSquare size={24} />
                Answers ({answers.length})
              </h2>

              {answers.length === 0 ? (
                <Card>
                  <div className="text-center py-12 text-gray-400">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No answers yet. Waiting for response...</p>
                  </div>
                </Card>
              ) : (
                <>
                  {answers.map((answer) => (
                    <AnswerCard 
                      key={answer.id} 
                      answer={answer} 
                      questionId={question.id}
                      isStudentQuestion={isStudentQuestion}
                      courseId={question.courseId}
                      onViewDocument={handleViewDocument}
                      onViewImage={handleViewImage}
                      renderFormattedText={renderFormattedText}
                    />
                  ))}
                </>
              )}
            </div>

            {followUpQuestions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <MessageSquare size={24} />
                  Follow-up Questions ({followUpQuestions.length})
                </h2>

                {followUpQuestions.map((followUpQ) => (
                  <FollowUpQuestionCard 
                    key={followUpQ.id} 
                    question={followUpQ}
                    isOwnQuestion={followUpQ.studentId === user?.uid}
                    courseId={question.courseId}
                    onViewDocument={handleViewDocument}
                    onViewImage={handleViewImage}
                    renderFormattedText={renderFormattedText}
                  />
                ))}
              </div>
            )}

            {isStudentQuestion && isAnswered && (
              <Card>
                <div className="space-y-4">
                  <div className="text-xs text-red-400 mb-4">
                    N.B.: If you're still confused about an answer, press the "Still Confused" button to ask your doubt.
                  </div>

                  {question.satisfactionStatus === 'none' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSatisfactionChange('satisfied')}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                      >
                        <ThumbsUp size={18} />
                        <span>Satisfied</span>
                      </button>
                      <button
                        onClick={() => handleSatisfactionChange('confused')}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                      >
                        <HelpCircle size={18} />
                        <span>Still Confused</span>
                      </button>
                    </div>
                  )}

                  {question.satisfactionStatus === 'satisfied' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-400 text-lg font-medium">
                        <ThumbsUp size={20} />
                        <span>Marked as Satisfied</span>
                      </div>
                      <button
                        onClick={() => handleSatisfactionChange('confused')}
                        className="w-full flex items-center justify-center gap-2 bg-background-800 hover:bg-background-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                      >
                        <span>Change to Still Confused</span>
                      </button>
                    </div>
                  )}

                  {question.satisfactionStatus === 'confused' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-orange-400 text-lg font-medium">
                        <HelpCircle size={20} />
                        <span>Marked as Still Confused</span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowFollowUpModal(true)}
                          className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          <MessageSquare size={16} />
                          <span>Ask Follow-up Question</span>
                        </button>
                        <button
                          onClick={() => handleSatisfactionChange('satisfied')}
                          className="flex-1 flex items-center justify-center gap-2 bg-background-800 hover:bg-background-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                          <span>Mark as Satisfied</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-error-dark hover:bg-error-DEFAULT text-error-light px-4 py-2 rounded-lg transition-colors text-sm font-medium mt-4 border-t border-background-700 pt-4"
                  >
                    <Trash2 size={16} />
                    <span>Delete Question</span>
                  </button>
                </div>
              </Card>
            )}
          </>
        )}

        {isStudentQuestion && isClosed && (
          <Card>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 bg-error-dark hover:bg-error-DEFAULT text-error-light px-4 py-3 rounded-lg transition-colors font-medium"
            >
              <Trash2 size={18} />
              <span>Delete Question</span>
            </button>
          </Card>
        )}
      </div>

      {showEditModal && question && (
        <EditQuestionModal
          question={question}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadQuestionAndAnswers();
            if ((window as any).addNotification) {
              (window as any).addNotification('Question updated successfully', 'success');
            }
          }}
          renderFormattedText={renderFormattedText}
        />
      )}

      {showFollowUpModal && question && (
        <FollowUpQuestionModal
          parentQuestion={question}
          onClose={() => setShowFollowUpModal(false)}
          onSuccess={() => {
            setShowFollowUpModal(false);
            if ((window as any).addNotification) {
              (window as any).addNotification('Follow-up question submitted!', 'success');
            }
            loadQuestionAndAnswers();
          }}
          renderFormattedText={renderFormattedText}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-900 rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Delete Question?</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this question? This will also delete all answers and follow-up questions. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleDeleteQuestion();
                }}
                className="flex-1 px-4 py-2 bg-error-DEFAULT hover:bg-error-dark text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocViewer && (
        <DocumentViewer
          url={currentDocUrl}
          fileName={currentDocName}
          type={currentDocType}
          onClose={() => setShowDocViewer(false)}
        />
      )}

      {showImageViewer && (
        <ImageViewer
          url={currentImageUrl}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </div>
  );
};

interface AudioPlayerProps {
  audioUrl: string;
  label: string;
}

const AudioPlayer = ({ audioUrl, label }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioElement] = useState(new Audio(audioUrl));

  useEffect(() => {
    const audio = audioElement;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audioElement]);

  const togglePlayPause = () => {
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-r from-primary-900/30 to-purple-900/30 rounded-lg p-4 border border-primary-500/30">
      <div className="flex items-center gap-3 mb-3">
        <Volume2 size={20} className="text-primary-400" />
        <span className="text-white font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlayPause}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition-colors"
        >
          {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-background-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            style={{
              background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${(currentTime / duration) * 100}%, rgb(55, 65, 81) ${(currentTime / duration) * 100}%, rgb(55, 65, 81) 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AnswerCardProps {
  answer: Answer;
  questionId: string;
  isStudentQuestion: boolean;
  courseId?: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  onViewImage: (url: string) => void;
  renderFormattedText: (text: string) => React.ReactNode;
}

const AnswerCard = ({ answer, questionId, isStudentQuestion, courseId, onViewDocument, onViewImage, renderFormattedText }: AnswerCardProps) => {
  const { user } = useDashboard();
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isEditingRating, setIsEditingRating] = useState(false);

  useEffect(() => {
    loadRating();
  }, [answer.id]);

  const loadRating = async () => {
    try {
      const existingRating = await qaService.getRating(questionId, answer.id);
      if (existingRating) {
        setRating(existingRating);
      }
    } catch (err) {
      console.error('Failed to load rating:', err);
    }
  };

  const handleRating = async (stars: number) => {
    if (!isStudentQuestion) return;
    
    try {
      await qaService.rateAnswer(questionId, answer.id, answer.type, stars);
      setRating(stars);
      setIsEditingRating(false);
      if ((window as any).addNotification) {
        (window as any).addNotification('Rating submitted!', 'success');
      }
    } catch (err: any) {
      if ((window as any).addNotification) {
        (window as any).addNotification('Failed to submit rating', 'error');
      }
    }
  };

  const answerSource = answer.type === 'ai' ? 'AI' : (courseId === 'help-support' ? 'Admin' : 'Teacher');

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {answer.type === 'ai' ? (
              <>
                <Brain size={20} className="text-purple-400" />
                <span className="text-lg font-medium text-white">AI Solution</span>
              </>
            ) : (
              <>
                <User size={20} className="text-primary-400" />
                <span className="text-lg font-medium text-white">{answerSource}</span>
              </>
            )}
          </div>
          <span className={`text-xs px-3 py-1 rounded-full ${
            answer.type === 'ai' 
              ? 'bg-purple-900 text-purple-300' 
              : 'bg-blue-900 text-blue-300'
          }`}>
            {answer.type === 'ai' ? 'AI Response' : `${answerSource} Response`}
          </span>
        </div>

        {answer.answerText && (
          <div className="pt-4 border-t border-background-700">
            <div className="text-gray-300 leading-relaxed">{renderFormattedText(answer.answerText)}</div>
          </div>
        )}

        {answer.imageUrl && (
          <div>
            <img 
              src={answer.imageUrl} 
              alt="Answer attachment" 
              className="max-h-96 object-contain rounded-lg border border-background-700 cursor-pointer hover:opacity-90 transition-opacity" 
              onClick={() => onViewImage(answer.imageUrl!)}
            />
          </div>
        )}

        {answer.audioUrl && (
          <AudioPlayer audioUrl={answer.audioUrl} label="Voice Answer" />
        )}

        {answer.fileName && answer.fileUrl && (
          <div className="bg-background-800 rounded-lg p-4 flex items-center gap-3">
            <FileText size={20} className="text-primary-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{answer.fileName}</p>
            </div>
            <div className="flex gap-2">
              {answer.fileName.toLowerCase().endsWith('.pdf') && (
                <button
                  onClick={() => onViewDocument(answer.fileUrl!, answer.fileName!, 'pdf')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                >
                  <Eye size={14} />
                  <span>View</span>
                </button>
              )}
              <button
                onClick={() => {
                  fetch(answer.fileUrl!)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = answer.fileName!;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-background-700 hover:bg-background-600 text-white rounded text-sm transition-colors"
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            </div>
          </div>
        )}

        {answer.type === 'ai' && (
          <div className="text-xs text-red-400 pt-2">
            N.B.: AI Solve-mate answers may be inaccurate. Please use the Human Teacher option if you notice a flawed answer.
          </div>
        )}

        <div className="text-sm text-gray-400 pt-4 border-t border-background-700">
          Answered on {answer.createdAt.toLocaleDateString()} at {answer.createdAt.toLocaleTimeString()}
        </div>

        {isStudentQuestion && (
          <div className="pt-4 border-t border-background-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Rate this answer:</p>
              {rating > 0 && !isEditingRating && (
                <button
                  onClick={() => setIsEditingRating(true)}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  Edit Rating
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                  disabled={rating > 0 && !isEditingRating}
                >
                  <Star
                    size={24}
                    className={`${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-600'
                    } transition-colors ${rating > 0 && !isEditingRating ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-3 text-sm text-green-400">Rated {rating}/5</span>
              )}
            </div>
            {isEditingRating && (
              <button
                onClick={() => setIsEditingRating(false)}
                className="mt-2 text-xs text-gray-400 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

interface FollowUpQuestionCardProps {
  question: Question;
  isOwnQuestion: boolean;
  courseId?: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  onViewImage: (url: string) => void;
  renderFormattedText: (text: string) => React.ReactNode;
}

const FollowUpQuestionCard = ({ question, courseId, onViewDocument, onViewImage, renderFormattedText }: FollowUpQuestionCardProps) => {
  const { user } = useDashboard();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnswers();
  }, [question.id]);

  const loadAnswers = async () => {
    try {
      const answersData = await qaService.getAnswersForQuestion(question.id);
      setAnswers(answersData);
    } catch (err) {
      console.error('Failed to load follow-up answers:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-orange-400" />
            <span className="text-lg font-medium text-white">Follow-up Question</span>
            <span className="text-xs px-2 py-1 rounded bg-orange-900 text-orange-300">Follow-up</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs ${
            question.status === 'pending' 
              ? 'bg-warning-dark text-warning-light' 
              : 'bg-success-dark text-success-light'
          }`}>
            {question.status === 'pending' ? 'Pending' : 'Answered'}
          </span>
        </div>

        <div className="pt-4 border-t border-background-700">
          <div className="text-gray-300">{renderFormattedText(question.questionText)}</div>
        </div>

        {question.imageUrl && (
          <div>
            <img 
              src={question.imageUrl} 
              alt="Follow-up question attachment" 
              className="max-h-96 object-contain rounded-lg border border-background-700 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onViewImage(question.imageUrl!)}
            />
          </div>
        )}

        {question.audioUrl && (
          <AudioPlayer audioUrl={question.audioUrl} label="Voice Question" />
        )}

        {question.fileName && question.fileUrl && (
          <div className="bg-background-800 rounded-lg p-4 flex items-center gap-3">
            <FileText size={20} className="text-primary-400" />
            <div className="flex-1">
              <p className="text-white font-medium">{question.fileName}</p>
            </div>
            <div className="flex gap-2">
              {question.fileName.toLowerCase().endsWith('.pdf') && (
                <button
                  onClick={() => onViewDocument(question.fileUrl!, question.fileName!, 'pdf')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm transition-colors"
                >
                  <Eye size={14} />
                  <span>View</span>
                </button>
              )}
              <button
                onClick={() => {
                  fetch(question.fileUrl!)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = question.fileName!;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-background-700 hover:bg-background-600 text-white rounded text-sm transition-colors"
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-400">
          Asked on {question.createdAt.toLocaleDateString()} at {question.createdAt.toLocaleTimeString()}
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader size={24} className="animate-spin text-primary-500" />
          </div>
        ) : answers.length > 0 ? (
          <div className="space-y-3 pt-4 border-t border-background-700">
            <h4 className="text-sm font-medium text-gray-400">Answer:</h4>
            {answers.map((answer) => (
              <FollowUpAnswerCard 
                key={answer.id} 
                answer={answer} 
                questionId={question.id}
                isOwnQuestion={question.studentId === user?.uid}
                courseId={courseId}
                onViewDocument={onViewDocument}
                onViewImage={onViewImage}
                renderFormattedText={renderFormattedText}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-400 text-sm">
            No answer yet...
          </div>
        )}
      </div>
    </Card>
  );
};
// src/pages/QuestionDetail.tsx - Part 3A of 3 (Follow-up Answer Card and Edit Modal)

interface FollowUpAnswerCardProps {
  answer: Answer;
  questionId: string;
  isOwnQuestion: boolean;
  courseId?: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  onViewImage: (url: string) => void;
  renderFormattedText: (text: string) => React.ReactNode;
}

const FollowUpAnswerCard = ({ answer, questionId, isOwnQuestion, courseId, onViewDocument, onViewImage, renderFormattedText }: FollowUpAnswerCardProps) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [isEditingRating, setIsEditingRating] = useState(false);

  useEffect(() => {
    loadRating();
  }, [answer.id]);

  const loadRating = async () => {
    try {
      const existingRating = await qaService.getRating(questionId, answer.id);
      if (existingRating) {
        setRating(existingRating);
      }
    } catch (err) {
      console.error('Failed to load rating:', err);
    }
  };

  const handleRating = async (stars: number) => {
    if (!isOwnQuestion) return;
    
    try {
      await qaService.rateAnswer(questionId, answer.id, answer.type, stars);
      setRating(stars);
      setIsEditingRating(false);
      if ((window as any).addNotification) {
        (window as any).addNotification('Rating submitted!', 'success');
      }
    } catch (err: any) {
      if ((window as any).addNotification) {
        (window as any).addNotification('Failed to submit rating', 'error');
      }
    }
  };

  const answerSource = answer.type === 'ai' ? 'AI' : (courseId === 'help-support' ? 'Admin' : 'Teacher');

  return (
    <div className="bg-background-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        {answer.type === 'ai' ? (
          <>
            <Brain size={16} className="text-purple-400" />
            <span className="text-sm font-medium text-white">AI Solution</span>
          </>
        ) : (
          <>
            <User size={16} className="text-primary-400" />
            <span className="text-sm font-medium text-white">{answerSource}</span>
          </>
        )}
      </div>
      <div className="text-gray-300 text-sm">{renderFormattedText(answer.answerText)}</div>
      
      {answer.imageUrl && (
        <img 
          src={answer.imageUrl} 
          alt="Answer" 
          className="max-h-64 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity" 
          onClick={() => onViewImage(answer.imageUrl!)}
        />
      )}

      {answer.audioUrl && (
        <AudioPlayer audioUrl={answer.audioUrl} label="Voice Answer" />
      )}
      
      {answer.fileUrl && answer.fileName && (
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-primary-400" />
          <span className="text-sm text-gray-400">{answer.fileName}</span>
          {answer.fileName.toLowerCase().endsWith('.pdf') && (
            <button
              onClick={() => onViewDocument(answer.fileUrl!, answer.fileName!, 'pdf')}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              View
            </button>
          )}
          <button
            onClick={() => {
              fetch(answer.fileUrl!)
                .then(res => res.blob())
                .then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = answer.fileName!;
                  a.click();
                  window.URL.revokeObjectURL(url);
                });
            }}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            Download
          </button>
        </div>
      )}
      
      {answer.type === 'ai' && (
        <div className="text-xs text-red-400">
          N.B.: AI answers may be inaccurate.
        </div>
      )}

      {isOwnQuestion && (
        <div className="pt-3 border-t border-background-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">Rate this answer:</p>
            {rating > 0 && !isEditingRating && (
              <button
                onClick={() => setIsEditingRating(true)}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Edit Rating
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
                disabled={rating > 0 && !isEditingRating}
              >
                <Star
                  size={20}
                  className={`${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-600'
                  } transition-colors ${rating > 0 && !isEditingRating ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-xs text-green-400">Rated {rating}/5</span>
            )}
          </div>
          {isEditingRating && (
            <button
              onClick={() => setIsEditingRating(false)}
              className="mt-2 text-xs text-gray-400 hover:text-white"
            >
              Cancel Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface EditQuestionModalProps {
  question: Question;
  onClose: () => void;
  onSuccess: () => void;
  renderFormattedText: (text: string) => React.ReactNode;
}

const EditQuestionModal = ({ question, onClose, onSuccess, renderFormattedText }: EditQuestionModalProps) => {
  const [questionText, setQuestionText] = useState(question.questionText);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState(question.imageUrl);
  const [existingAudioUrl, setExistingAudioUrl] = useState(question.audioUrl);
  const [existingFileUrl, setExistingFileUrl] = useState(question.fileUrl);
  const [existingFileName, setExistingFileName] = useState(question.fileName);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/heic',
        'application/pdf', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/msword'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid file (JPG, JPEG, PNG, HEIC, PDF, or DOCX)');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setAttachedFile(file);
      setError('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFileObj = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(audioFileObj);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const getFileType = (file: File): 'image' | 'document' | 'audio' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleRemoveExistingImage = () => {
    setExistingImageUrl(undefined);
  };

  const handleRemoveExistingAudio = () => {
    setExistingAudioUrl(undefined);
  };

  const handleRemoveExistingFile = () => {
    setExistingFileUrl(undefined);
    setExistingFileName(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim()) {
      setError('Please enter your question.');
      return;
    }

    setLoading(true);

    try {
      const updates: any = {
        questionText: questionText.trim(),
      };

      if (attachedFile) {
        const fileType = getFileType(attachedFile);
        const uploadResult = await qaService.uploadToSupabase(
          attachedFile, 
          fileType === 'image' ? 'question_images' : 'question_documents'
        );
        
        if (fileType === 'image') {
          updates.imageUrl = uploadResult.url;
        } else {
          updates.fileUrl = uploadResult.url;
          updates.fileName = attachedFile.name;
        }
      } else {
        updates.imageUrl = existingImageUrl;
        updates.fileUrl = existingFileUrl;
        updates.fileName = existingFileName;
      }

      if (audioFile) {
        const uploadResult = await qaService.uploadToSupabase(audioFile, 'question_audio');
        updates.audioUrl = uploadResult.url;
      } else {
        updates.audioUrl = existingAudioUrl;
      }

      await qaService.updateQuestion(question.id, updates);

      onSuccess();
    } catch (err: any) {
      setError('Failed to update question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-3xl my-8 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Edit Question</h2>
        
        {error && (
          <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Question Text</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Edit your question... (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
              rows={6}
              disabled={loading}
              required
            ></textarea>
            {questionText && (
              <div className="mt-2 p-3 bg-background-700 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Preview:</p>
                <div className="text-white text-sm">{renderFormattedText(questionText)}</div>
              </div>
            )}
          </div>

          {existingImageUrl && !attachedFile ? (
            <div className="bg-background-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Current Image Attachment</label>
                <button
                  type="button"
                  onClick={handleRemoveExistingImage}
                  className="text-xs text-error-light hover:text-error-DEFAULT"
                >
                  Remove
                </button>
              </div>
              <img src={existingImageUrl} alt="Current attachment" className="max-h-40 object-contain rounded-lg" />
            </div>
          ) : (existingFileUrl && existingFileName && !attachedFile) ? (
            <div className="bg-background-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary-400" />
                  <span className="text-white text-sm">{existingFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveExistingFile}
                  className="text-xs text-error-light hover:text-error-DEFAULT"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {!existingImageUrl && !existingFileUrl && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Attach New File (Optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                disabled={loading}
              />
              {attachedFile && (
                <div className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                  <FileText size={14} />
                  <span>{attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)</span>
                </div>
              )}
            </div>
          )}

          {existingAudioUrl && !audioFile ? (
            <div className="bg-background-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Current Voice Message</label>
                <button
                  type="button"
                  onClick={handleRemoveExistingAudio}
                  className="text-xs text-error-light hover:text-error-DEFAULT"
                >
                  Remove
                </button>
              </div>
              <AudioPlayer audioUrl={existingAudioUrl} label="Current Voice" />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Voice Message (Optional - {existingAudioUrl ? 'Replace' : 'Add'})</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-error-dark text-error-light' 
                      : 'bg-background-800 text-white hover:bg-background-700'
                  }`}
                >
                  {isRecording ? <Volume2 size={16} className="animate-pulse" /> : <Mic size={16} />}
                  <span>{isRecording ? 'Stop Recording' : 'Record Voice'}</span>
                </button>
                {audioFile && (
                  <span className="text-sm text-gray-400 flex items-center">
                    Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="bg-background-800 rounded-lg p-3 text-sm text-gray-400">
            <p><strong>Course:</strong> {question.courseId === 'help-support' ? 'Help & Support' : 'Course-related'}</p>
            <p className="mt-1"><strong>Subject:</strong> {question.subject}</p>
            <p className="mt-2"><strong>Locked:</strong> Subject and Course cannot be changed.</p>
            <p className="mt-1"><strong>Editable:</strong> Question text, attachments (image/file), and voice message.</p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader size={16} className="animate-spin" />}
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// src/pages/QuestionDetail.tsx - Part 3B of 3 (Follow-up Question Modal and Document/Image Viewers)

interface FollowUpQuestionModalProps {
  parentQuestion: Question;
  onClose: () => void;
  onSuccess: () => void;
  renderFormattedText: (text: string) => React.ReactNode;
}

const FollowUpQuestionModal = ({ parentQuestion, onClose, onSuccess, renderFormattedText }: FollowUpQuestionModalProps) => {
  const [questionText, setQuestionText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.0-flash-exp';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/heic',
        'application/pdf', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/msword'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid file (JPG, JPEG, PNG, HEIC, PDF, or DOCX)');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setAttachedFile(file);
      setError('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFileObj = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(audioFileObj);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const getFileType = (file: File): 'image' | 'document' | 'audio' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim()) {
      setError('Please enter your follow-up question.');
      return;
    }

    setLoading(true);

    try {
      let imageUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let audioUrl: string | undefined;

      if (attachedFile) {
        const fileType = getFileType(attachedFile);
        const uploadResult = await qaService.uploadToSupabase(
          attachedFile, 
          fileType === 'image' ? 'question_images' : 'question_documents'
        );
        
        if (fileType === 'image') {
          imageUrl = uploadResult.url;
        } else {
          fileUrl = uploadResult.url;
          fileName = attachedFile.name;
        }
      }

      if (audioFile) {
        const uploadResult = await qaService.uploadToSupabase(audioFile, 'question_audio');
        audioUrl = uploadResult.url;
      }

      if (parentQuestion.answeredBy === 'ai') {
        const knowledgeList = await qaService.getKnowledgeBySubject(parentQuestion.subject);
        const knowledgeContext = knowledgeList.length > 0 
          ? `\n\nTeacher's Knowledge Base:\n${knowledgeList.map(k => `${k.title}: ${k.content}`).join('\n')}`
          : '';

        const aiPrompt = `You are an AI tutor. The student previously asked: "${parentQuestion.questionText}"

Now they have a follow-up question: "${questionText.trim()}"

Subject: ${parentQuestion.subject}
${knowledgeContext}

Provide a clear, step-by-step answer to their follow-up question.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: aiPrompt }] }]
            })
          }
        );

        if (!response.ok) throw new Error('AI request failed');

        const data = await response.json();
        const solution = data.candidates[0].content.parts[0].text;

        const followUpId = await qaService.askQuestion({
          studentId: parentQuestion.studentId,
          studentName: parentQuestion.studentName,
          subject: parentQuestion.subject,
          questionText: questionText.trim(),
          parentQuestionId: parentQuestion.id,
          isFollowUp: true,
          courseId: parentQuestion.courseId,
          imageUrl,
          audioUrl,
          fileUrl,
          fileName,
        });

        await qaService.answerQuestion({
          questionId: followUpId,
          answerText: solution,
          type: 'ai',
        });
      } else {
        await qaService.askQuestion({
          studentId: parentQuestion.studentId,
          studentName: parentQuestion.studentName,
          subject: parentQuestion.subject,
          questionText: questionText.trim(),
          parentQuestionId: parentQuestion.id,
          isFollowUp: true,
          courseId: parentQuestion.courseId,
          imageUrl,
          audioUrl,
          fileUrl,
          fileName,
        });
      }

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit follow-up question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Ask Follow-up Question</h2>
        
        {error && (
          <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-background-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400 mb-2">Original Question:</p>
          <div className="text-white">{renderFormattedText(parentQuestion.questionText)}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Follow-up Question</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="What part are you still confused about? (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
              rows={6}
              disabled={loading}
              required
            ></textarea>
            {questionText && (
              <div className="mt-2 p-3 bg-background-700 rounded-lg">
                <p className="text-xs text-gray-400 mb-2">Preview:</p>
                <div className="text-white text-sm">{renderFormattedText(questionText)}</div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Attach File (Optional)</label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
              disabled={loading}
            />
            {attachedFile && (
              <div className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                <FileText size={14} />
                <span>{attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Voice Message (Optional)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isRecording 
                    ? 'bg-error-dark text-error-light' 
                    : 'bg-background-800 text-white hover:bg-background-700'
                }`}
              >
                {isRecording ? <Volume2 size={16} className="animate-pulse" /> : <Mic size={16} />}
                <span>{isRecording ? 'Stop Recording' : 'Record Voice'}</span>
              </button>
              {audioFile && (
                <span className="text-sm text-gray-400 flex items-center">
                  Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader size={16} className="animate-spin" />}
              <span>{loading ? 'Submitting...' : 'Submit Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DocumentViewerProps {
  url: string;
  fileName: string;
  type: 'pdf' | 'other';
  onClose: () => void;
}

const DocumentViewer = ({ url, fileName, type, onClose }: DocumentViewerProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl border border-background-700">
        <div className="flex items-center justify-between p-4 border-b border-background-700 bg-background-800">
          <h2 className="text-xl font-bold text-white truncate flex-1 mr-4">{fileName}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetch(url)
                  .then(res => res.blob())
                  .then(blob => {
                    const blobUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    a.click();
                    window.URL.revokeObjectURL(blobUrl);
                  });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-background-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden bg-gray-100">
          {type === 'pdf' ? (
            <iframe
              src={url}
              className="w-full h-full border-0"
              title={fileName}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-background-800">
              <div className="text-center">
                <FileText size={64} className="mx-auto mb-4 text-gray-400" />
                <p className="text-white text-lg mb-2">Preview not available</p>
                <p className="text-gray-400 mb-4">Please download the file to view it</p>
                <button
                  onClick={() => {
                    fetch(url)
                      .then(res => res.blob())
                      .then(blob => {
                        const blobUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = fileName;
                        a.click();
                        window.URL.revokeObjectURL(blobUrl);
                      });
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors mx-auto"
                >
                  <Download size={18} />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ImageViewerProps {
  url: string;
  onClose: () => void;
}

const ImageViewer = ({ url, onClose }: ImageViewerProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-background-900 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white z-10"
        >
          <X size={24} />
        </button>
        <img 
          src={url} 
          alt="Full size" 
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};

export default QuestionDetail;
