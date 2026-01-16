// src/pages/QuestionDetail.tsx - Part 1 (Final Complete)
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
  XCircle
} from 'lucide-react';
import Card from '../components/ui/Card';
import { qaService, Question, Answer } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { useDashboard } from '../contexts/DashboardContext';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuestionMenu, setShowQuestionMenu] = useState(true);

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
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

  const loadAllQuestions = async () => {
    try {
      const allQs = await qaService.getQuestions('all', 'all');
      
      // Filter: student's own questions (including closed) + answered questions from others (excluding closed)
      const filteredQuestions = allQs.filter(q => {
        if (q.studentId === user?.uid) {
          return true;
        } else {
          return q.status === 'answered' && q.status !== 'closed';
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
    if (selectedCourseFilter === 'all') return true;
    if (selectedCourseFilter === 'help-support') return q.courseId === 'help-support';
    return q.courseId === selectedCourseFilter;
  });

  const isStudentQuestion = question?.studentId === user?.uid;
  const isAnswered = question?.status === 'answered' && answers.length > 0;
  const isClosed = question?.status === 'closed';

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
                    <option value="help-support">🆘 Help & Support</option>
                    {enrolledCoursesWithQnA.map(course => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredQuestionMenu.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No questions found</p>
                  ) : (
                    filteredQuestionMenu.map(q => (
                      <div
                        key={q.id}
                        onClick={() => navigate(`/question/${q.id}`)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          q.id === questionId 
                            ? 'bg-primary-900 border border-primary-500' 
                            : 'bg-background-800 hover:bg-background-700'
                        }`}
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
// src/pages/QuestionDetail.tsx - Part 2 (Final Complete - Continuation)

        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-primary-400" />
                <span className="text-lg font-medium text-white">{question.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                {question.answeredBy && question.status !== 'closed' && (
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    question.answeredBy === 'ai' 
                      ? 'bg-purple-900 text-purple-300' 
                      : 'bg-blue-900 text-blue-300'
                  }`}>
                    {question.answeredBy === 'ai' ? '🤖 AI Answered' : '👨‍🏫 Teacher Answered'}
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
              <p className="text-gray-300 text-lg whitespace-pre-wrap">{question.questionText}</p>
            </div>

            {question.imageUrl && (
              <div>
                <img 
                  src={question.imageUrl} 
                  alt="Question attachment" 
                  className="max-h-96 object-contain rounded-lg border border-background-700" 
                />
              </div>
            )}

            {question.fileName && question.fileUrl && (
              <div className="bg-background-800 rounded-lg p-4 flex items-center gap-3">
                <FileText size={20} className="text-primary-400" />
                <div className="flex-1">
                  <p className="text-white font-medium">{question.fileName}</p>
                  <a 
                    href={question.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    View Document
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
          </div>
        </Card>

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
                    <Card key={answer.id}>
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
                                <span className="text-lg font-medium text-white">{answer.teacherName}</span>
                              </>
                            )}
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full ${
                            answer.type === 'ai' 
                              ? 'bg-purple-900 text-purple-300' 
                              : 'bg-blue-900 text-blue-300'
                          }`}>
                            {answer.type === 'ai' ? 'AI Response' : 'Teacher Response'}
                          </span>
                        </div>

                        {answer.answerText && (
                          <div className="pt-4 border-t border-background-700">
                            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{answer.answerText}</p>
                          </div>
                        )}

                        {answer.imageUrl && (
                          <div>
                            <img 
                              src={answer.imageUrl} 
                              alt="Answer attachment" 
                              className="max-h-96 object-contain rounded-lg border border-background-700" 
                            />
                          </div>
                        )}

                        {answer.audioUrl && (
                          <div className="bg-background-800 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <Volume2 size={20} className="text-primary-400" />
                              <span className="text-white font-medium">Voice Answer</span>
                            </div>
                            <audio controls className="w-full">
                              <source src={answer.audioUrl} type="audio/webm" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}

                        {answer.fileName && answer.fileUrl && (
                          <div className="bg-background-800 rounded-lg p-4 flex items-center gap-3">
                            <FileText size={20} className="text-primary-400" />
                            <div className="flex-1">
                              <p className="text-white font-medium">{answer.fileName}</p>
                              <a 
                                href={answer.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary-400 hover:text-primary-300 text-sm"
                              >
                                View Document
                              </a>
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
                      </div>
                    </Card>
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
                        <span>Marked as Satisfied ✓</span>
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
    </div>
  );
};

interface FollowUpQuestionCardProps {
  question: Question;
  isOwnQuestion: boolean;
}

const FollowUpQuestionCard = ({ question }: FollowUpQuestionCardProps) => {
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
          <p className="text-gray-300 whitespace-pre-wrap">{question.questionText}</p>
        </div>

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
              <div key={answer.id} className="bg-background-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {answer.type === 'ai' ? (
                    <>
                      <Brain size={16} className="text-purple-400" />
                      <span className="text-sm font-medium text-white">AI Solution</span>
                    </>
                  ) : (
                    <>
                      <User size={16} className="text-primary-400" />
                      <span className="text-sm font-medium text-white">{answer.teacherName}</span>
                    </>
                  )}
                </div>
                <p className="text-gray-300 whitespace-pre-wrap text-sm">{answer.answerText}</p>
                {answer.type === 'ai' && (
                  <div className="text-xs text-red-400 mt-2">
                    N.B.: AI answers may be inaccurate.
                  </div>
                )}
              </div>
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

interface FollowUpQuestionModalProps {
  parentQuestion: Question;
  onClose: () => void;
  onSuccess: () => void;
}

const FollowUpQuestionModal = ({ parentQuestion, onClose, onSuccess }: FollowUpQuestionModalProps) => {
  const [questionText, setQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.5-flash';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim()) {
      setError('Please enter your follow-up question.');
      return;
    }

    setLoading(true);

    try {
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
          <p className="text-white">{parentQuestion.questionText}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Follow-up Question *</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="What part are you still confused about?"
              rows={6}
              disabled={loading}
              required
            ></textarea>
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

export default QuestionDetail;
