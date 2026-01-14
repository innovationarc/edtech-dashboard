import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Clock, 
  Calendar, 
  Star, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  CheckCircle, 
  Circle,
  Megaphone,
  TrendingUp,
  Award,
  BookOpen,
  Zap,
  Users,
  Bell,
  X,
  Loader,
  AlertCircle
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { getRandomQuote } from '../utils/quotes';
import { announcementService, Announcement } from '../services/announcementService';
import { courseService } from '../services/courseService';
import { gamificationService } from '../services/gamificationService'; // Import gamificationService
import { qaService } from '../services/qaService'; // Import qaService for real-time Q&A notifications
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService'; // Import studyPlanService
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';

interface Objective {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}


interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  category: string;
  deadline: Date;
}

interface TopicStar {
  id: string;
  name: string;
  mastered: boolean;
  progress: number;
  position: { x: number; y: number };
}

interface SubjectConstellation {
  id: string;
  name: string;
  color: string;
  stars: TopicStar[];
  overallProgress: number;
}

const StudentDashboard = () => {
  const { user } = useDashboard();
  
  // Quote state
  const [dailyQuote, setDailyQuote] = useState(() => getRandomQuote());
  
  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState('');
  
  // Calendar events state
  const [studentCalendarEvents, setStudentCalendarEvents] = useState<StudyPlanEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState('');
  
  // Modal states
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showStudentEventModal, setShowStudentEventModal] = useState(false);
  const [selectedDateForEvent, setSelectedDateForEvent] = useState(new Date());
  
  // Timer state
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');

  // Today's objectives
  const [objectives, setObjectives] = useState<Objective[]>([
    { id: '1', title: 'Complete Algebra homework', completed: false, priority: 'high' },
    { id: '2', title: 'Review Biology chapter 5', completed: true, priority: 'medium' },
    { id: '3', title: 'Practice Physics problems', completed: false, priority: 'medium' },
    { id: '4', title: 'Read History assignment', completed: false, priority: 'low' },
  ]);



  // Mission goals
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      title: 'Achieve an A in Biology',
      description: 'Maintain high grades in all biology assessments',
      progress: 75,
      target: 100,
      category: 'Academic',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    {
      id: '2',
      title: 'Complete Final Project Early',
      description: 'Finish the computer science project a week before deadline',
      progress: 40,
      target: 100,
      category: 'Project',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    },
    {
      id: '3',
      title: 'Master Calculus Fundamentals',
      description: 'Complete all calculus practice problems with 90% accuracy',
      progress: 60,
      target: 100,
      category: 'Skill',
      deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    }
  ]);

  // Subject constellations
  const [constellations] = useState<SubjectConstellation[]>([
    {
      id: '1',
      name: 'Mathematics',
      color: '#6366f1',
      overallProgress: 75,
      stars: [
        { id: '1', name: 'Algebra', mastered: true, progress: 100, position: { x: 20, y: 30 } },
        { id: '2', name: 'Geometry', mastered: true, progress: 100, position: { x: 60, y: 20 } },
        { id: '3', name: 'Calculus', mastered: false, progress: 60, position: { x: 40, y: 60 } },
        { id: '4', name: 'Statistics', mastered: false, progress: 30, position: { x: 80, y: 50 } },
        { id: '5', name: 'Trigonometry', mastered: false, progress: 45, position: { x: 30, y: 80 } },
      ]
    },
    {
      id: '2',
      name: 'Physics',
      color: '#8b5cf6',
      overallProgress: 60,
      stars: [
        { id: '6', name: 'Mechanics', mastered: true, progress: 100, position: { x: 25, y: 25 } },
        { id: '7', name: 'Thermodynamics', mastered: false, progress: 70, position: { x: 70, y: 30 } },
        { id: '8', name: 'Electromagnetism', mastered: false, progress: 40, position: { x: 50, y: 70 } },
        { id: '9', name: 'Optics', mastered: false, progress: 20, position: { x: 80, y: 60 } },
      ]
    },
    {
      id: '3',
      name: 'Biology',
      color: '#10b981',
      overallProgress: 85,
      stars: [
        { id: '10', name: 'Cell Biology', mastered: true, progress: 100, position: { x: 30, y: 20 } },
        { id: '11', name: 'Genetics', mastered: true, progress: 100, position: { x: 70, y: 25 } },
        { id: '12', name: 'Evolution', mastered: true, progress: 100, position: { x: 50, y: 50 } },
        { id: '13', name: 'Ecology', mastered: false, progress: 80, position: { x: 25, y: 75 } },
        { id: '14', name: 'Anatomy', mastered: false, progress: 65, position: { x: 75, y: 70 } },
      ]
    }
  ]);

  useEffect(() => {
    // Set a new random quote when component mounts
    setDailyQuote(getRandomQuote());
    
    // Load announcements when component mounts or user changes
    if (user) {
      loadAnnouncements();
      loadStudentCalendarEvents();
      
      // Set up periodic refresh for announcements (every 30 seconds)
      const interval = setInterval(() => {
        loadAnnouncements();
        loadStudentCalendarEvents();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Effect for real-time Q&A notifications for students
  useEffect(() => {
    if (user && user.role === 'student') {
      let unsubscribe: (() => void)[] = [];
      const fetchAndSubscribeToQuestions = async () => {
        try {
          const studentQuestions = await qaService.getQuestions(undefined, 'all'); // Get all questions by this student
          const questionsByStudent = studentQuestions.filter(q => q.studentId === user.uid);

          questionsByStudent.forEach(question => {
            const unsub = qaService.onAnswerToQuestion(question.id, (answers) => {
              // Check if there's a new answer that wasn't there before
              // This is a simplified check; a more robust solution might track last seen answer count
              if (answers.length > 0 && question.status === 'pending') { // Only notify if question was pending
                if ((window as any).addNotification) {
                  (window as any).addNotification(
                    `Your question "${question.questionText}" has been answered!`,
                    'success'
                  );
                }
                // Optionally, update the question status locally or refetch questions
              }
            });
            unsubscribe.push(unsub);
          });
        } catch (err) {
          console.error('Error setting up Q&A listener for student:', err);
        }
      };

      fetchAndSubscribeToQuestions();

      return () => {
        unsubscribe.forEach(unsub => unsub());
      };
    }
  }, [user]); // Re-run if user changes

  const loadAnnouncements = async () => {
    if (!user) return;
    
    try {
      setAnnouncementsLoading(true);
      setAnnouncementsError('');
      
      console.log('Loading announcements for user:', user.uid, 'role:', user.role);
      
      // Get user's enrolled courses
      let enrolledCourseIds: string[] = [];
      try {
        const enrollments = await courseService.getStudentEnrollments(user.uid);
        enrolledCourseIds = enrollments.map(enrollment => enrollment.courseId);
        console.log('User enrolled courses:', enrolledCourseIds);
      } catch (error) {
        console.warn('Could not fetch enrollments:', error);
        // Continue with empty array - user will see general announcements only
      }
      
      // Fetch announcements
      const fetchedAnnouncements = await announcementService.getAnnouncementsForUser(
        user.uid,
        user.role,
        enrolledCourseIds
      );
      
      console.log('Fetched announcements:', fetchedAnnouncements.length);
      
      setAnnouncements(fetchedAnnouncements);
    } catch (error: any) {
      console.error('Error loading announcements:', error);
      setAnnouncementsError('Failed to load announcements');
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const loadStudentCalendarEvents = async () => {
    if (!user) return;
    
    try {
      setCalendarLoading(true);
      setCalendarError('');
      
      console.log('Loading calendar events for student:', user.uid);
      
      // Fetch study plan events for the student
      const events = await studyPlanService.getEventsForStudent(user.uid);
      console.log('Fetched calendar events:', events.length);
      
      // Filter events to show only upcoming events (today + next 7 days)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const upcomingEvents = events.filter(event => {
        const eventDate = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate());
        return eventDate >= today && eventDate <= nextWeek;
      }).sort((a, b) => {
        // Sort by date, then by start time
        const dateA = a.date.getTime();
        const dateB = b.date.getTime();
        if (dateA !== dateB) return dateA - dateB;
        
        const timeA = parseInt(a.startTime.replace(':', ''));
        const timeB = parseInt(b.startTime.replace(':', ''));
        return timeA - timeB;
      });
      
      console.log('Filtered upcoming events:', upcomingEvents.length);
      
      setStudentCalendarEvents(upcomingEvents);
    } catch (error: any) {
      console.error('Error loading calendar events:', error);
      setCalendarError('Failed to load calendar events');
      // Set empty array as fallback
      setStudentCalendarEvents([]);
    } finally {
      setCalendarLoading(false);
    }
  };
  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTimerRunning) {
      interval = setInterval(() => {
        if (timerSeconds > 0) {
          setTimerSeconds(timerSeconds - 1);
        } else if (timerMinutes > 0) {
          setTimerMinutes(timerMinutes - 1);
          setTimerSeconds(59);
        } else {
          // Timer finished
          setIsTimerRunning(false);
          if (timerMode === 'focus') {
            // Record study session activity
            if (user) {
              gamificationService.recordActivity(user.uid, 'study_session', { duration: 25 }); // Assuming 25 min focus
            }
            setTimerMode('break');
            setTimerMinutes(5);
          } else {
            setTimerMode('focus');
            setTimerMinutes(25);
          }
          setTimerSeconds(0);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTimerRunning, timerMinutes, timerSeconds, timerMode, user]); // Add user to dependency array

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(obj => 
      obj.id === id ? { ...obj, completed: !obj.completed } : obj
    ));
  };

  const addObjective = (title: string, priority: 'high' | 'medium' | 'low') => {
    const newObjective: Objective = {
      id: Date.now().toString(),
      title,
      completed: false,
      priority
    };
    setObjectives([...objectives, newObjective]);
    setShowObjectiveModal(false);
  };

  const addGoal = (title: string, description: string, category: string, deadline: Date) => {
    const newGoal: Goal = {
      id: Date.now().toString(),
      title,
      description,
      progress: 0,
      target: 100,
      category,
      deadline
    };
    setGoals([...goals, newGoal]);
    setShowGoalModal(false);
  };

  const startTimer = () => setIsTimerRunning(true);
  const pauseTimer = () => setIsTimerRunning(false);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerMinutes(timerMode === 'focus' ? 25 : 5);
    setTimerSeconds(0);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error-DEFAULT';
      case 'medium': return 'text-warning-DEFAULT';
      case 'low': return 'text-success-DEFAULT';
      default: return 'text-gray-400';
    }
  };

  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <BookOpen size={16} className="text-primary-400" />;
      case 'reminder': return <Bell size={16} className="text-warning-DEFAULT" />;
      case 'announcement': return <Megaphone size={16} className="text-secondary-400" />;
      case 'urgent': return <AlertCircle size={16} className="text-error-DEFAULT" />;
      default: return <Bell size={16} className="text-gray-400" />;
    }
  };

  const getAnnouncementPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-error-DEFAULT bg-error-dark/10';
      case 'medium': return 'border-l-warning-DEFAULT bg-warning-dark/10';
      case 'low': return 'border-l-success-DEFAULT bg-success-dark/10';
      default: return 'border-l-background-600 bg-background-800';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  const getEventTypeColor = (event: StudyPlanEvent) => {
    // Determine event type based on title or description
    const title = event.title.toLowerCase();
    const description = event.description.toLowerCase();
    
    if (title.includes('assignment') || title.includes('homework') || title.includes('due') ||
        description.includes('assignment') || description.includes('homework') || description.includes('due')) {
      return 'bg-warning-DEFAULT';
    } else if (title.includes('class') || title.includes('lecture') || title.includes('lesson') ||
               description.includes('class') || description.includes('lecture') || description.includes('lesson')) {
      return 'bg-primary-500';
    } else if (title.includes('exam') || title.includes('test') || title.includes('quiz') ||
               description.includes('exam') || description.includes('test') || description.includes('quiz')) {
      return 'bg-error-DEFAULT';
    } else {
      return 'bg-accent-500';
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name || 'Student'}! 🌟
          </h1>
          <p className="text-gray-400 mt-1">Ready to conquer your learning goals today?</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Today</div>
          <div className="text-lg font-semibold text-white">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>

      {/* Top Row - Objectives, Timer, Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Today's Objectives */}
        <Card title="Today's Objectives" icon={<Target size={20} className="text-primary-400" />}>
          <div className="space-y-3">
            {objectives.map(objective => (
              <div key={objective.id} className="flex items-center gap-3 p-2 rounded hover:bg-background-800 transition-colors">
                <button
                  onClick={() => toggleObjective(objective.id)}
                  className="flex-shrink-0"
                >
                  {objective.completed ? (
                    <CheckCircle size={20} className="text-success-DEFAULT" />
                  ) : (
                    <Circle size={20} className="text-gray-400 hover:text-primary-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${objective.completed ? 'line-through text-gray-400' : 'text-white'}`}>
                    {objective.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-1 w-1 rounded-full ${getPriorityColor(objective.priority)}`}></div>
                    <span className={`text-xs ${getPriorityColor(objective.priority)}`}>
                      {objective.priority} priority
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => setShowObjectiveModal(true)}
              className="w-full mt-4 p-2 border-2 border-dashed border-background-600 rounded-lg text-gray-400 hover:text-white hover:border-primary-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>Add objective</span>
            </button>
          </div>
        </Card>

        {/* Focus Timer */}
        <Card title="Focus Timer" icon={<Clock size={20} className="text-accent-400" />}>
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#374151"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={timerMode === 'focus' ? '#10b981' : '#f59e0b'}
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - (timerMinutes * 60 + timerSeconds) / (timerMode === 'focus' ? 25 * 60 : 5 * 60))}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-white">
                  {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400 capitalize">{timerMode}</div>
              </div>
            </div>
            
            <div className="flex justify-center gap-2">
              <button
                onClick={isTimerRunning ? pauseTimer : startTimer}
                className={`p-2 rounded-lg transition-colors ${
                  isTimerRunning 
                    ? 'bg-warning-DEFAULT hover:bg-warning-dark text-white' 
                    : 'bg-success-DEFAULT hover:bg-success-dark text-white'
                }`}
              >
                {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                onClick={resetTimer}
                className="p-2 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            
            <div className="mt-4 text-xs text-gray-400">
              {timerMode === 'focus' ? 'Focus time! Stay concentrated.' : 'Break time! Relax and recharge.'}
            </div>
          </div>
        </Card>

        {/* Upcoming Transmissions */}
        <Card title="Latest Transmissions" icon={<Megaphone size={20} className="text-secondary-400" />}>
          {announcementsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-primary-500" />
              <span className="ml-2 text-gray-400">Loading announcements...</span>
            </div>
          ) : announcementsError ? (
            <div className="text-center py-8">
              <AlertCircle size={32} className="mx-auto text-error-DEFAULT mb-2" />
              <p className="text-error-DEFAULT text-sm">{announcementsError}</p>
              <button
                onClick={loadAnnouncements}
                className="mt-2 text-xs text-primary-400 hover:text-primary-300"
              >
                Try again
              </button>
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone size={32} className="mx-auto text-gray-500 mb-2" />
              <p className="text-gray-400 text-sm">No announcements yet</p>
              <p className="text-gray-500 text-xs mt-1">Check back later for updates from your teachers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 3).map(announcement => (
                <div 
                  key={announcement.id} 
                  className={`p-3 rounded-lg border-l-4 ${getAnnouncementPriorityColor(announcement.priority)}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {getAnnouncementIcon(announcement.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-white truncate">{announcement.title}</h4>
                        {announcement.priority === 'high' && (
                          <span className="px-1.5 py-0.5 bg-error-DEFAULT text-white text-xs rounded-full">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {announcement.teacherName} • {announcement.subject}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(announcement.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-2">{announcement.message}</p>
                </div>
              ))}
              
              {announcements.length > 3 && (
                <button className="w-full text-center text-sm text-primary-400 hover:text-primary-300 transition-colors">
                  View all {announcements.length} announcements
                </button>
              )}
            </div>
          )}
        </Card>

        {/* Daily Inspiration */}
        <Card title="Daily Inspiration" icon={<Star size={20} className="text-warning-DEFAULT" />}>
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl mb-3">💡</div>
              <blockquote className="text-sm text-gray-300 italic leading-relaxed mb-3">
                "{dailyQuote.text}"
              </blockquote>
              <cite className="text-xs text-primary-400 font-medium">
                — {dailyQuote.author}
              </cite>
            </div>
            
            <div className="mt-4 pt-4 border-t border-background-700">
              <button
                onClick={() => setDailyQuote(getRandomQuote())}
                className="text-xs bg-background-700 hover:bg-background-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 mx-auto"
              >
                <RotateCcw size={12} />
                New Quote
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Middle Row - Weekly Trajectory and Mission Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trajectory */}
        <Card title="Weekly Trajectory" icon={<Calendar size={20} className="text-primary-400" />}>
          <div className="space-y-4">
            {/* Mini Calendar */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-xs text-gray-400 p-1">{day}</div>
              ))}
              {Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - date.getDay() + i);
                const isToday = date.toDateString() === new Date().toDateString();
                const hasEvent = studentCalendarEvents.some(event => 
                  event.date.toDateString() === date.toDateString()
                );
                
                return (
                  <div
                    key={i}
                    className={`p-2 text-xs rounded relative ${
                      isToday 
                        ? 'bg-primary-600 text-white' 
                        : hasEvent 
                        ? 'bg-background-700 text-white' 
                        : 'text-gray-400'
                    }`}
                  >
                    {date.getDate()}
                    {hasEvent && !isToday && (
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-accent-500 rounded-full"></div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Upcoming Events */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white">Upcoming Events</h4>
              {calendarLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader size={16} className="animate-spin text-primary-500" />
                  <span className="ml-2 text-gray-400 text-xs">Loading events...</span>
                </div>
              ) : calendarError ? (
                <div className="text-center py-4">
                  <AlertCircle size={16} className="mx-auto text-error-DEFAULT mb-1" />
                  <p className="text-error-DEFAULT text-xs">{calendarError}</p>
                </div>
              ) : studentCalendarEvents.length === 0 ? (
                <div className="text-center py-4">
                  <Calendar size={24} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-gray-400 text-xs">No upcoming events</p>
                </div>
              ) : (
                studentCalendarEvents.slice(0, 4).map(event => (
                  <div key={event.id} className="flex items-center gap-3 p-2 bg-background-800 rounded">
                    <div className={`h-2 w-2 rounded-full ${getEventTypeColor(event)}`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {event.date.toLocaleDateString()} • {event.startTime} - {event.endTime}
                      </p>
                      {event.description && (
                        <p className="text-xs text-gray-500 truncate">{event.description}</p>
                      )}
                    </div>
                    <span className="text-xs bg-background-700 px-2 py-1 rounded text-gray-300">
                      {event.course}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Mission Goals */}
        <Card title="Mission Goals" icon={<Award size={20} className="text-warning-DEFAULT" />}>
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal.id} className="p-3 bg-background-800 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{goal.title}</h4>
                    <p className="text-xs text-gray-400 line-clamp-2">{goal.description}</p>
                  </div>
                  <span className="text-xs bg-background-700 px-2 py-1 rounded text-gray-300 ml-2">
                    {goal.category}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white">{goal.progress}%</span>
                  </div>
                  <div className="w-full bg-background-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-accent-500"
                      style={{ width: `${goal.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Due: {goal.deadline.toLocaleDateString()}</span>
                    <span>{goal.target - goal.progress}% remaining</span>
                  </div>
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => setShowGoalModal(true)}
              className="w-full p-2 border-2 border-dashed border-background-600 rounded-lg text-gray-400 hover:text-white hover:border-primary-500 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>Add new goal</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Bottom Row - Subject Constellations */}
      <Card title="Subject Constellations" subtitle="Your knowledge map across different subjects">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {constellations.map(constellation => (
            <div key={constellation.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">{constellation.name}</h3>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-400">{constellation.overallProgress}%</div>
                  <div className="w-16 bg-background-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{ 
                        width: `${constellation.overallProgress}%`,
                        backgroundColor: constellation.color 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <>
                {/* Constellation Map */}
                <div className="relative h-48 bg-gradient-to-br from-background-900 to-background-800 rounded-lg overflow-hidden">
                  {/* Background stars effect */}
                  <div className="absolute inset-0">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-0.5 h-0.5 bg-gray-600 rounded-full opacity-30"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                      ></div>
                    ))}
                  </div>
                  
                  {/* Topic Stars */}
                  {constellation.stars.map((star, index) => (
                    <div key={star.id}>
                      {/* Connection lines to previous stars */}
                      {index > 0 && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          <line
                            x1={`${constellation.stars[index - 1].position.x}%`}
                            y1={`${constellation.stars[index - 1].position.y}%`}
                            x2={`${star.position.x}%`}
                            y2={`${star.position.y}%`}
                            stroke={constellation.color}
                            strokeWidth="1"
                            opacity={star.mastered && constellation.stars[index - 1].mastered ? "0.6" : "0.2"}
                          />
                        </svg>
                      )}
                      
                      {/* Star */}
                      <div
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                        style={{
                          left: `${star.position.x}%`,
                          top: `${star.position.y}%`,
                        }}
                      >
                        <div className="relative">
                          <Star
                            size={star.mastered ? 24 : 20}
                            className={`transition-all duration-300 ${
                              star.mastered
                                ? `text-yellow-400 fill-yellow-400 drop-shadow-lg`
                                : star.progress > 50
                                ? `text-yellow-600 fill-yellow-600/50`
                                : 'text-gray-500'
                            } group-hover:scale-110`}
                            style={{
                              filter: star.mastered ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))' : 'none'
                            }}
                          />
                          
                          {/* Progress ring for non-mastered stars */}
                          {!star.mastered && star.progress > 0 && (
                            <svg className="absolute inset-0 w-full h-full">
                              <circle
                                cx="50%"
                                cy="50%"
                                r="12"
                                fill="none"
                                stroke={constellation.color}
                                strokeWidth="2"
                                strokeDasharray={`${2 * Math.PI * 12 * star.progress / 100} ${2 * Math.PI * 12}`}
                                strokeLinecap="round"
                                opacity="0.8"
                              />
                            </svg>
                          )}
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {star.name} ({star.progress}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Star Legend */}
                <div className="space-y-1">
                  {constellation.stars.map(star => (
                    <div key={star.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Star
                          size={12}
                          className={star.mastered ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}
                        />
                        <span className={star.mastered ? 'text-white' : 'text-gray-400'}>
                          {star.name}
                        </span>
                      </div>
                      <span className={star.mastered ? 'text-success-DEFAULT' : 'text-gray-400'}>
                        {star.progress}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Objective Modal */}
      {showObjectiveModal && (
        <ObjectiveModal
          onClose={() => setShowObjectiveModal(false)}
          onAdd={addObjective}
        />
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <GoalModal
          onClose={() => setShowGoalModal(false)}
          onAdd={addGoal}
        />
      )}

      {/* Student Event Modal */}
      {showStudentEventModal && (
        <StudyPlanEventModal
          selectedDate={selectedDateForEvent}
          currentUser={user}
          isPersonalEvent={true}
          onClose={() => setShowStudentEventModal(false)}
          onSave={handleSavePersonalEvent}
        />
      )}
    </div>
  );
};

// Objective Modal Component
interface ObjectiveModalProps {
  onClose: () => void;
  onAdd: (title: string, priority: 'high' | 'medium' | 'low') => void;
}

const ObjectiveModal = ({ onClose, onAdd }: ObjectiveModalProps) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), priority);
      setTitle('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-4">Add New Objective</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Objective Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter your objective..."
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Add Objective
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Goal Modal Component
interface GoalModalProps {
  onClose: () => void;
  onAdd: (title: string, description: string, category: string, deadline: Date) => void;
}

const GoalModal = ({ onClose, onAdd }: GoalModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Academic');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && description.trim() && deadline) {
      onAdd(title.trim(), description.trim(), category, new Date(deadline));
      setTitle('');
      setDescription('');
      setDeadline('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-4">Add New Goal</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Goal Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter your goal..."
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Describe your goal..."
              rows={3}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="Academic">Academic</option>
              <option value="Project">Project</option>
              <option value="Skill">Skill</option>
              <option value="Personal">Personal</option>
              <option value="Career">Career</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Add Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentDashboard;