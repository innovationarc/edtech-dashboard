// src/pages/StudentQA.tsx - Part 1
import { useState, useEffect } from 'react';
import { Plus, Search, Loader, AlertCircle, BookOpen, User, MessageSquare, X, Brain, Bell, FileText, Filter } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { qaService, Question } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { useNavigate } from 'react-router-dom';

const StudentQA = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskQuestionModal, setShowAskQuestionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'answered'>('all');
  const [questionFilter, setQuestionFilter] = useState<'my' | 'others' | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [enrolledCoursesWithQnA, setEnrolledCoursesWithQnA] = useState<Course[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  // Help & Support default subjects
  const helpSupportSubjects = [
    'System related problems',
    'Course related problems',
    'Others'
  ];

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
  }, []);

  useEffect(() => {
    loadQuestions();
    loadNotifications();
    
    const unsubscribe = qaService.onNewNotifications(user?.uid || '', (notifications) => {
      setUnreadCount(notifications.length);
      if (notifications.length > 0 && (window as any).addNotification) {
        (window as any).addNotification(notifications[0].message, 'info');
      }
    });

    return () => unsubscribe();
  }, [selectedSubject, selectedCourse, selectedStatus, questionFilter]);

  useEffect(() => {
    // Update available subjects when course changes
    updateAvailableSubjects();
  }, [selectedCourse, enrolledCoursesWithQnA]);

  const loadEnrolledCoursesWithQnA = async () => {
    try {
      // Get student's enrollments
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      
      // Get full course details for each enrollment
      const enrolledCourses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const course = await courseService.getCourseById(enrollment.courseId);
          return course;
        })
      );
      
      // Filter out null courses and only keep those with Q&A enabled
      const coursesWithQnA = enrolledCourses.filter(
        (course): course is Course => course !== null && course.hasQnA === true
      );
      
      setEnrolledCoursesWithQnA(coursesWithQnA);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const updateAvailableSubjects = () => {
    if (selectedCourse === 'all') {
      // Show all subjects from all enrolled courses
      const allSubjects = new Set<string>();
      enrolledCoursesWithQnA.forEach(course => {
        course.subjects.forEach(subject => allSubjects.add(subject));
      });
      // Add help & support subjects
      helpSupportSubjects.forEach(subject => allSubjects.add(subject));
      setAvailableSubjects(Array.from(allSubjects));
    } else if (selectedCourse === 'help-support') {
      // Only show help & support subjects
      setAvailableSubjects(helpSupportSubjects);
    } else {
      // Show subjects for selected course
      const selectedCourseData = enrolledCoursesWithQnA.find(c => c.id === selectedCourse);
      if (selectedCourseData) {
        setAvailableSubjects(selectedCourseData.subjects);
      } else {
        setAvailableSubjects([]);
      }
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      let fetchedQuestions = await qaService.getQuestions(selectedSubject, selectedStatus);
      
      // Filter by course if selected
      if (selectedCourse !== 'all') {
        if (selectedCourse === 'help-support') {
          fetchedQuestions = fetchedQuestions.filter(q => q.courseId === 'help-support');
        } else {
          fetchedQuestions = fetchedQuestions.filter(q => q.courseId === selectedCourse);
        }
      }
      
      setQuestions(fetchedQuestions);
    } catch (err: any) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifications = await qaService.getNotifications(user?.uid || '');
      const unread = notifications.filter(n => !n.read);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleAskQuestionSuccess = () => {
    loadQuestions();
    setShowAskQuestionModal(false);
    if ((window as any).addNotification) {
      (window as any).addNotification('Your question has been submitted!', 'success');
    }
  };

  const handleQuestionClick = async (question: Question) => {
    if (question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent) {
      await qaService.markQuestionAsViewed(question.id);
      
      const notifications = await qaService.getNotifications(user?.uid || '');
      const relatedNotif = notifications.find(n => n.questionId === question.id && !n.read);
      if (relatedNotif) {
        await qaService.markNotificationAsRead(relatedNotif.id);
        loadNotifications();
      }
    }
    navigate(`/question/${question.id}`);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      questionFilter === 'all' ? true :
      questionFilter === 'my' ? q.studentId === user?.uid :
      q.studentId !== user?.uid;
    
    return matchesSearch && matchesFilter;
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
          <h1 className="text-2xl font-bold text-white">Ask a Question</h1>
          <p className="text-gray-400 mt-1">Get help from teachers, AI, and peers</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="relative">
              <Bell size={20} className="text-primary-400" />
              <span className="absolute -top-1 -right-1 bg-error-light text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowAskQuestionModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            <span>Ask New Question</span>
          </button>
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
              placeholder="Search questions..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex gap-3 flex-wrap">
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value as 'my' | 'others' | 'all')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Questions</option>
              <option value="my">My Questions</option>
              <option value="others">Others' Questions</option>
            </select>

            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Courses</option>
              <option value="help-support">🆘 Help & Support</option>
              {enrolledCoursesWithQnA.length === 0 ? (
                <option disabled>You don't have any courses with Q&A enabled</option>
              ) : (
                enrolledCoursesWithQnA.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))
              )}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'answered')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4" />
              <p>No questions found. Be the first to ask!</p>
            </div>
          ) : (
            filteredQuestions.map(question => (
              <div
                key={question.id}
                className={`bg-background-800 rounded-lg p-4 cursor-pointer hover:bg-background-700 transition-colors ${
                  question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent 
                    ? 'ring-2 ring-primary-500' 
                    : ''
                }`}
                onClick={() => handleQuestionClick(question)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-white">{question.subject}</span>
                    {question.studentId === user?.uid && (
                      <span className="text-xs text-primary-400 bg-primary-900 px-2 py-0.5 rounded">You</span>
                    )}
                    {question.isFollowUp && (
                      <span className="text-xs text-orange-400 bg-orange-900 px-2 py-0.5 rounded">Follow-up</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {question.status === 'answered' && question.answeredBy && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        question.answeredBy === 'ai' 
                          ? 'bg-purple-900 text-purple-300' 
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {question.answeredBy === 'ai' ? '🤖 AI' : '👨‍🏫 Teacher'}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      question.status === 'pending' 
                        ? 'bg-warning-dark text-warning-light' 
                        : 'bg-success-dark text-success-light'
                    }`}>
                      {question.status === 'pending' ? 'Pending' : 'Answered'}
                    </span>
                    {question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>
                {question.imageUrl && (
                  <img src={question.imageUrl} alt="Question attachment" className="max-h-40 object-contain rounded-lg mb-2" />
                )}
                {question.fileName && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <FileText size={14} />
                    <span>{question.fileName}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{question.studentName}</span>
                  </div>
                  <span>•</span>
                  <span>{question.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {showAskQuestionModal && (
        <AskQuestionModal
          onClose={() => setShowAskQuestionModal(false)}
          onSuccess={handleAskQuestionSuccess}
          studentId={user?.uid || ''}
          studentName={user?.name || 'Student'}
          enrolledCoursesWithQnA={enrolledCoursesWithQnA}
          helpSupportSubjects={helpSupportSubjects}
        />
      )}
    </div>
  );
};

export default StudentQA;
