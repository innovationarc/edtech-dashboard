// src/pages/QuestionDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, User, Loader, AlertCircle, FileText, Volume2, Image as ImageIcon, Brain, MessageSquare, ThumbsUp, HelpCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import { qaService, Question, Answer } from '../services/qaService';
import { useDashboard } from '../contexts/DashboardContext';

const QuestionDetail = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  useEffect(() => {
    if (questionId) {
      loadQuestionAndAnswers();
    }
  }, [questionId]);

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

      setQuestion(questionData);
      setAnswers(answersData);
    } catch (err: any) {
      setError('Failed to load question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSatisfactionChange = async (status: 'satisfied' | 'confused') => {
    if (!question || question.studentId !== user?.uid) return;

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

  const isStudentQuestion = question?.studentId === user?.uid;
  const isAnswered = question?.status === 'answered' && answers.length > 0;

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
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error || 'Question not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back to Questions</span>
      </button>

      {/* Question Card */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-primary-400" />
              <span className="text-lg font-medium text-white">{question.subject}</span>
            </div>
            <div className="flex items-center gap-2">
              {question.answeredBy && (
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
                  : 'bg-success-dark text-success-light'
              }`}>
                {question.status === 'pending' ? 'Pending' : 'Answered'}
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

      {/* Answers Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare size={24} />
          Answers ({answers.length})
        </h2>

        {answers.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
              <p>No answers yet. Waiting for teacher response...</p>
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

                  {/* Warning for AI answers */}
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

            {/* Satisfaction Status Section - Only for the student who asked */}
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
                </div>
              </Card>
            )}
          </>
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
            navigate('/student/qa');
          }}
        />
      )}
    </div>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim()) {
      setError('Please enter your follow-up question.');
      return;
    }

    setLoading(true);

    try {
      await qaService.askQuestion({
        studentId: parentQuestion.studentId,
        studentName: parentQuestion.studentName,
        subject: parentQuestion.subject,
        questionText: `[Follow-up to previous question]\n\nOriginal Question: ${parentQuestion.questionText}\n\nFollow-up: ${questionText.trim()}`,
        parentQuestionId: parentQuestion.id,
        isFollowUp: true,
      });

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