
// src/components/settings/MyQAActivity.tsx
import React, { useState, useEffect } from 'react';
import { BookOpen, User, MessageSquare, Loader, AlertCircle, CheckCircle, Clock, Send, Image as ImageIcon } from 'lucide-react';
import Card from '../ui/Card';
import { useDashboard } from '../../contexts/DashboardContext';
import { qaService, Question, Answer } from '../../services/qaService';
import { Link } from 'react-router-dom';

const MyQAActivity = () => {
  const { user } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]); // For teachers

  useEffect(() => {
    if (user) {
      loadQAActivity();
    }
  }, [user]);

  const loadQAActivity = async () => {
    setLoading(true);
    setError('');
    try {
      if (user?.role === 'student') {
        const studentQuestions = await qaService.getQuestions(undefined, 'all');
        setQuestions(studentQuestions.filter(q => q.studentId === user.uid));
      } else if (user?.role === 'teacher') {
        const teacherAnswers = await qaService.getAnswersForQuestion(user.uid); // Assuming getAnswersForQuestion can filter by teacherId
        setAnswers(teacherAnswers);

        // For teachers, also fetch questions they've answered or are pending for them
        const allQuestions = await qaService.getQuestions(undefined, 'all');
        const relevantQuestions = allQuestions.filter(q =>
          q.status === 'pending' || answers.some(a => a.questionId === q.id)
        );
        setQuestions(relevantQuestions);
      }
    } catch (err: any) {
      setError('Failed to load Q&A activity: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card title="My Q&A Activity">
        <div className="flex items-center justify-center h-32">
          <Loader size={32} className="animate-spin text-primary-500" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="My Q&A Activity">
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card title="My Q&A Activity" subtitle={user?.role === 'student' ? "Questions you've asked" : "Questions you've answered or are pending"}>
      {questions.length === 0 && answers.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-4" />
          <p>No Q&A activity found.</p>
          {user?.role === 'student' && (
            <Link to="/student-qa" className="mt-4 inline-flex items-center gap-1 text-primary-400 hover:text-primary-300">
              <Send size={16} /> Ask your first question!
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map(question => (
            <div key={question.id} className="bg-background-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-primary-400" />
                  <span className="text-sm font-medium text-white">{question.subject}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  question.status === 'pending' ? 'bg-warning-dark text-warning-light' : 'bg-success-dark text-success-light'
                }`}>
                  {question.status === 'pending' ? 'Pending' : 'Answered'}
                </span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>
              {question.imageUrl && (
                <img src={question.imageUrl} alt="Question attachment" className="max-h-40 object-contain rounded-lg mb-2" />
              )}
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <User size={14} />
                  <span>{question.studentName}</span>
                </div>
                <span>•</span>
                <span>{question.createdAt.toLocaleDateString()}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-background-700">
                <Link to={`/question/${question.id}`} className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
                  <MessageSquare size={14} /> View Details & Answers
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default MyQAActivity;
