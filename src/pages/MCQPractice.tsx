import { useState, useEffect } from 'react';
import { 
  Brain, 
  Clock, 
  Trophy, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Play, 
  BookOpen,
  Star,
  Target,
  Award,
  TrendingUp,
  Filter,
  Search,
  Loader
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { mcqService, MCQQuestion, QuizSession } from '../services/mcqService';

interface LocalQuizSession {
  id: string;
  subject: string;
  questions: MCQQuestion[];
  currentQuestionIndex: number;
  answers: (number | null)[];
  score: number;
  timeRemaining: number;
  isCompleted: boolean;
  startTime: Date;
}

interface LeaderboardEntry {
  id: string;
  studentName: string;
  subject: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
  timeSpent: number;
  date: Date;
}

const MCQPractice = () => {
  const { user } = useDashboard();
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [currentSession, setCurrentSession] = useState<LocalQuizSession | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allQuestions, setAllQuestions] = useState<MCQQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuestions();
    loadLeaderboard();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('Loading MCQ questions...');
      
      const questions = await mcqService.getAllMCQQuestions();
      console.log('Loaded questions:', questions.length);
      
      setAllQuestions(questions);
      
      if (questions.length === 0) {
        console.log('No questions found in database, using sample data');
        // Use sample questions as fallback
        const sampleQuestions: MCQQuestion[] = [
          {
            id: 'sample-1',
            question: 'What is the derivative of x²?',
            choices: [
              { id: 1, text: 'x' },
              { id: 2, text: '2x' },
              { id: 3, text: 'x²' },
              { id: 4, text: '2x²' }
            ],
            correctAnswer: 2,
            subject: 'Mathematics',
            difficulty: 'easy',
            explanation: 'The derivative of x² is 2x using the power rule.',
            points: 10,
            course: 'Mathematics 101',
            tags: ['calculus', 'derivatives'],
            createdBy: 'system',
            createdAt: new Date()
          },
          {
            id: 'sample-2',
            question: 'What is the chemical formula for water?',
            choices: [
              { id: 1, text: 'H₂O' },
              { id: 2, text: 'CO₂' },
              { id: 3, text: 'NaCl' },
              { id: 4, text: 'CH₄' }
            ],
            correctAnswer: 1,
            subject: 'Chemistry',
            difficulty: 'easy',
            explanation: 'Water consists of two hydrogen atoms and one oxygen atom.',
            points: 10,
            course: 'Chemistry Basics',
            tags: ['molecules', 'basic'],
            createdBy: 'system',
            createdAt: new Date()
          }
        ];
        setAllQuestions(sampleQuestions);
      }
    } catch (error: any) {
      console.error('Error loading questions:', error);
      setError('Failed to load questions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const sessions = await mcqService.getLeaderboard(50);
      const leaderboardEntries: LeaderboardEntry[] = sessions.map(session => ({
        id: session.id,
        studentName: session.studentName,
        subject: session.subject,
        score: session.score,
        totalQuestions: session.totalQuestions,
        accuracy: session.accuracy,
        timeSpent: session.timeSpent,
        date: session.completedAt
      }));
      setLeaderboard(leaderboardEntries);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      // Use sample leaderboard data
      const sampleLeaderboard: LeaderboardEntry[] = [
        {
          id: '1',
          studentName: 'Alice Johnson',
          subject: 'Mathematics',
          score: 95,
          totalQuestions: 10,
          accuracy: 95,
          timeSpent: 8,
          date: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          id: '2',
          studentName: 'Bob Smith',
          subject: 'Physics',
          score: 88,
          totalQuestions: 8,
          accuracy: 87.5,
          timeSpent: 12,
          date: new Date(Date.now() - 4 * 60 * 60 * 1000)
        }
      ];
      setLeaderboard(sampleLeaderboard);
    }
  };

  // Timer effect for quiz session
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentSession && !currentSession.isCompleted && currentSession.timeRemaining > 0) {
      interval = setInterval(() => {
        setCurrentSession(prev => {
          if (!prev) return null;
          const newTimeRemaining = prev.timeRemaining - 1;
          
          if (newTimeRemaining <= 0) {
            // Auto-submit when time runs out
            return { ...prev, timeRemaining: 0, isCompleted: true };
          }
          
          return { ...prev, timeRemaining: newTimeRemaining };
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [currentSession]);

  const subjects = Array.from(new Set(allQuestions.map(q => q.subject)));

  const getQuestionsForSubject = (subject: string, difficulty: string = 'all') => {
    return allQuestions.filter(q => {
      const matchesSubject = q.subject === subject;
      const matchesDifficulty = difficulty === 'all' || q.difficulty === difficulty;
      return matchesSubject && matchesDifficulty;
    });
  };

  const startQuiz = (subject: string) => {
    const questions = getQuestionsForSubject(subject, selectedDifficulty);
    if (questions.length === 0) {
      alert('No questions available for this subject and difficulty level.');
      return;
    }

    const session: LocalQuizSession = {
      id: Date.now().toString(),
      subject,
      questions: questions.slice(0, 10), // Limit to 10 questions
      currentQuestionIndex: 0,
      answers: new Array(Math.min(questions.length, 10)).fill(null),
      score: 0,
      timeRemaining: 600, // 10 minutes
      isCompleted: false,
      startTime: new Date()
    };

    setCurrentSession(session);
    setShowResults(false);
  };

  const selectAnswer = (answerIndex: number) => {
    if (!currentSession || currentSession.isCompleted) return;

    setCurrentSession(prev => {
      if (!prev) return null;
      const newAnswers = [...prev.answers];
      newAnswers[prev.currentQuestionIndex] = answerIndex;
      return { ...prev, answers: newAnswers };
    });
  };

  const nextQuestion = () => {
    if (!currentSession) return;

    if (currentSession.currentQuestionIndex < currentSession.questions.length - 1) {
      setCurrentSession(prev => {
        if (!prev) return null;
        return { ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 };
      });
    } else {
      finishQuiz();
    }
  };

  const previousQuestion = () => {
    if (!currentSession) return;

    if (currentSession.currentQuestionIndex > 0) {
      setCurrentSession(prev => {
        if (!prev) return null;
        return { ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 };
      });
    }
  };

  const finishQuiz = async () => {
    if (!currentSession || !user) return;

    let totalScore = 0;
    let correctAnswers = 0;

    currentSession.questions.forEach((question, index) => {
      const userAnswer = currentSession.answers[index];
      if (userAnswer === question.correctAnswer) {
        totalScore += question.points;
        correctAnswers++;
      }
    });

    const accuracy = (correctAnswers / currentSession.questions.length) * 100;
    const timeSpent = Math.floor((Date.now() - currentSession.startTime.getTime()) / 1000 / 60);

    // Save quiz session to database
    try {
      const quizSession: Omit<QuizSession, 'id' | 'completedAt'> = {
        studentId: user.uid,
        studentName: user.name,
        subject: currentSession.subject,
        questions: currentSession.questions.map(q => q.id),
        answers: currentSession.answers,
        score: totalScore,
        totalQuestions: currentSession.questions.length,
        accuracy,
        timeSpent
      };

      await mcqService.createQuizSession(quizSession);
      
      // Reload leaderboard to show updated rankings
      await loadLeaderboard();
    } catch (error) {
      console.error('Error saving quiz session:', error);
    }

    // Add to local leaderboard for immediate feedback
    const newEntry: LeaderboardEntry = {
      id: Date.now().toString(),
      studentName: user.name,
      subject: currentSession.subject,
      score: totalScore,
      totalQuestions: currentSession.questions.length,
      accuracy,
      timeSpent,
      date: new Date()
    };

    setLeaderboard(prev => [newEntry, ...prev].sort((a, b) => b.score - a.score));

    setCurrentSession(prev => {
      if (!prev) return null;
      return { ...prev, score: totalScore, isCompleted: true };
    });

    setShowResults(true);
  };

  const resetQuiz = () => {
    setCurrentSession(null);
    setShowResults(false);
    setSelectedSubject('');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-success-DEFAULT';
      case 'medium': return 'text-warning-DEFAULT';
      case 'hard': return 'text-error-DEFAULT';
      default: return 'text-gray-400';
    }
  };

  const filteredLeaderboard = leaderboard.filter(entry =>
    entry.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading MCQ questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircle size={48} className="mx-auto text-error-DEFAULT mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Error Loading Questions</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadQuestions}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Quiz interface
  if (currentSession && !showResults) {
    const currentQuestion = currentSession.questions[currentSession.currentQuestionIndex];
    const progress = ((currentSession.currentQuestionIndex + 1) / currentSession.questions.length) * 100;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">MCQ Practice - {currentSession.subject}</h1>
            <p className="text-gray-400">Question {currentSession.currentQuestionIndex + 1} of {currentSession.questions.length}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-background-800 px-3 py-2 rounded-lg">
              <Clock size={16} className="text-warning-DEFAULT" />
              <span className="text-white font-mono">{formatTime(currentSession.timeRemaining)}</span>
            </div>
            <button
              onClick={resetQuiz}
              className="flex items-center gap-2 bg-error-DEFAULT hover:bg-error-dark text-white px-3 py-2 rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              <span>Exit Quiz</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-background-800 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-primary-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <Card className="p-8">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${getDifficultyColor(currentQuestion.difficulty)}`}>
                    {currentQuestion.difficulty}
                  </span>
                  <span className="text-sm text-gray-400">{currentQuestion.points} points</span>
                </div>
                <h2 className="text-xl font-medium text-white mb-6">{currentQuestion.question}</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => selectAnswer(choice.id)}
                  className={`p-4 text-left rounded-lg border-2 transition-all ${
                    currentSession.answers[currentSession.currentQuestionIndex] === choice.id
                      ? 'border-primary-500 bg-primary-900/20 text-white'
                      : 'border-background-600 bg-background-800 text-gray-300 hover:border-primary-400 hover:bg-background-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      currentSession.answers[currentSession.currentQuestionIndex] === choice.id
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-400'
                    }`}>
                      {currentSession.answers[currentSession.currentQuestionIndex] === choice.id && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span>{choice.text}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-6">
              <button
                onClick={previousQuestion}
                disabled={currentSession.currentQuestionIndex === 0}
                className="px-6 py-2 bg-background-700 hover:bg-background-600 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                Previous
              </button>
              
              <button
                onClick={nextQuestion}
                disabled={currentSession.answers[currentSession.currentQuestionIndex] === null}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                {currentSession.currentQuestionIndex === currentSession.questions.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Results interface
  if (showResults && currentSession) {
    const correctAnswers = currentSession.questions.filter((q, index) => 
      currentSession.answers[index] === q.correctAnswer
    ).length;
    const accuracy = (correctAnswers / currentSession.questions.length) * 100;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Quiz Completed! 🎉</h1>
          <p className="text-gray-400">Here are your results for {currentSession.subject}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <Trophy size={32} className="mx-auto text-warning-DEFAULT mb-3" />
            <h3 className="text-2xl font-bold text-white">{currentSession.score}</h3>
            <p className="text-gray-400">Total Score</p>
          </Card>

          <Card className="p-6 text-center">
            <Target size={32} className="mx-auto text-success-DEFAULT mb-3" />
            <h3 className="text-2xl font-bold text-white">{accuracy.toFixed(1)}%</h3>
            <p className="text-gray-400">Accuracy</p>
          </Card>

          <Card className="p-6 text-center">
            <Clock size={32} className="mx-auto text-primary-400 mb-3" />
            <h3 className="text-2xl font-bold text-white">{correctAnswers}/{currentSession.questions.length}</h3>
            <p className="text-gray-400">Correct Answers</p>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-white mb-4">Question Review</h3>
          <div className="space-y-4">
            {currentSession.questions.map((question, index) => {
              const userAnswer = currentSession.answers[index];
              const isCorrect = userAnswer === question.correctAnswer;
              const correctChoice = question.choices.find(c => c.id === question.correctAnswer);
              const userChoice = question.choices.find(c => c.id === userAnswer);

              return (
                <div key={question.id} className="p-4 bg-background-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle size={20} className="text-success-DEFAULT mt-1 flex-shrink-0" />
                    ) : (
                      <XCircle size={20} className="text-error-DEFAULT mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-white font-medium mb-2">{question.question}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-400">
                          Your answer: <span className={isCorrect ? 'text-success-DEFAULT' : 'text-error-DEFAULT'}>
                            {userChoice?.text || 'No answer'}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-gray-400">
                            Correct answer: <span className="text-success-DEFAULT">{correctChoice?.text}</span>
                          </p>
                        )}
                        {question.explanation && (
                          <p className="text-gray-300 mt-2 italic">{question.explanation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex justify-center gap-4">
          <button
            onClick={resetQuiz}
            className="px-6 py-2 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors"
          >
            Back to Subjects
          </button>
          <button
            onClick={() => startQuiz(currentSession.subject)}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Practice Again
          </button>
        </div>
      </div>
    );
  }

  // Main interface
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">MCQ Practice Arena</h1>
          <p className="text-gray-400 mt-1">Test your knowledge and climb the leaderboard!</p>
        </div>
        <div className="flex items-center gap-2">
          <Brain size={24} className="text-primary-400" />
          <span className="text-white font-medium">Practice Mode</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Selection */}
        <div className="lg:col-span-2">
          <Card title="Choose Your Subject" icon={<BookOpen size={20} className="text-primary-400" />}>
            <div className="space-y-4">
              <div className="flex gap-4">
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                
                <button
                  onClick={loadQuestions}
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <RotateCcw size={16} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subjects.map((subject) => {
                  const questions = getQuestionsForSubject(subject, selectedDifficulty);
                  const difficulties = Array.from(new Set(questions.map(q => q.difficulty)));
                  
                  return (
                    <div key={subject} className="p-4 bg-background-800 rounded-lg hover:bg-background-700 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-medium">{subject}</h3>
                        <div className="flex gap-1">
                          {difficulties.map(diff => (
                            <span key={diff} className={`px-2 py-1 rounded text-xs ${getDifficultyColor(diff)}`}>
                              {diff}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm mb-4">{questions.length} questions available</p>
                      <button
                        onClick={() => startQuiz(subject)}
                        disabled={questions.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-background-600 disabled:text-gray-500 text-white py-2 rounded-lg transition-colors"
                      >
                        <Play size={16} />
                        <span>Start Practice</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {subjects.length === 0 && (
                <div className="text-center py-8">
                  <Brain size={48} className="mx-auto text-gray-500 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Questions Available</h3>
                  <p className="text-gray-400 mb-4">
                    Teachers haven't uploaded any MCQ questions yet.
                  </p>
                  <button
                    onClick={loadQuestions}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Check Again
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          <Card title="Your Stats" icon={<TrendingUp size={20} className="text-accent-400" />}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Attempts</span>
                <span className="text-white font-medium">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Best Score</span>
                <span className="text-white font-medium">95%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Avg. Accuracy</span>
                <span className="text-white font-medium">87%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Rank</span>
                <div className="flex items-center gap-1">
                  <Award size={16} className="text-warning-DEFAULT" />
                  <span className="text-white font-medium">#3</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Achievement Badges" icon={<Star size={20} className="text-warning-DEFAULT" />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-background-800 rounded-lg">
                <Trophy size={24} className="mx-auto text-warning-DEFAULT mb-2" />
                <p className="text-xs text-gray-400">First Place</p>
              </div>
              <div className="text-center p-3 bg-background-800 rounded-lg">
                <Target size={24} className="mx-auto text-success-DEFAULT mb-2" />
                <p className="text-xs text-gray-400">Perfect Score</p>
              </div>
              <div className="text-center p-3 bg-background-800 rounded-lg opacity-50">
                <Brain size={24} className="mx-auto text-gray-500 mb-2" />
                <p className="text-xs text-gray-500">Quiz Master</p>
              </div>
              <div className="text-center p-3 bg-background-800 rounded-lg opacity-50">
                <Clock size={24} className="mx-auto text-gray-500 mb-2" />
                <p className="text-xs text-gray-500">Speed Demon</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Leaderboard */}
      <Card title="Leaderboard" subtitle="Top performers across all subjects">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search students or subjects..."
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-background-800">
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Rank</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Student</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Subject</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Score</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Accuracy</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Time</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.slice(0, 10).map((entry, index) => (
                  <tr key={entry.id} className="border-b border-background-800 hover:bg-background-800/50">
                    <td className="p-3">
                      <div className="flex items-center">
                        {index < 3 ? (
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 'bg-amber-700'
                          }`}>
                            <Trophy size={12} className="text-white" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-background-700 flex items-center justify-center">
                            <span className="text-xs text-white">{index + 1}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary-700 flex items-center justify-center">
                          <span className="text-white text-sm font-medium">{entry.studentName.charAt(0)}</span>
                        </div>
                        <span className="text-white">{entry.studentName}</span>
                        {entry.studentName === user?.name && (
                          <span className="text-xs bg-primary-900 text-primary-300 px-2 py-0.5 rounded">You</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-xs bg-background-700 px-2 py-1 rounded text-gray-300">
                        {entry.subject}
                      </span>
                    </td>
                    <td className="p-3 text-white font-medium">{entry.score}</td>
                    <td className="p-3">
                      <span className={`${
                        entry.accuracy >= 90 ? 'text-success-DEFAULT' :
                        entry.accuracy >= 70 ? 'text-warning-DEFAULT' : 'text-error-DEFAULT'
                      }`}>
                        {entry.accuracy.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-gray-300">{entry.timeSpent}m</td>
                    <td className="p-3 text-gray-400 text-sm">
                      {entry.date.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLeaderboard.length === 0 && (
            <div className="py-8 text-center text-gray-400">
              No leaderboard entries found.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MCQPractice;