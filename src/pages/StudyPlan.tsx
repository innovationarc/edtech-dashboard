// src/pages/StudyPlan.tsx (TEACHER/ADMIN - Enhanced, fully backwards compatible)
import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, Edit, Trash2, Users, User, BookOpen, Clock, AlertCircle,
  Brain, Sparkles, Loader, TrendingUp, CheckCircle2, BarChart3, Zap, X
} from 'lucide-react';
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService';
import { aiStudyPlannerService } from '../services/aiStudyPlannerService';
import { useDashboard } from '../contexts/DashboardContext';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';

interface UserItem { id: string; name: string; email: string; }
interface Course { id: string; title: string; description: string; }

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const getPriorityStyle = (priority: string) => ({
  high: 'text-red-600 bg-red-50 border border-red-200',
  medium: 'text-yellow-600 bg-yellow-50 border border-yellow-200',
  low: 'text-green-600 bg-green-50 border border-green-200',
}[priority] || 'text-gray-600 bg-gray-50');

const getEventIcon = (type: string) =>
  ({ assignment: '📋', exam: '🎯', class: '🏫', study: '📚', deadline: '⏰', personal: '📝' }[type] || '📅');

const StudyPlan: React.FC = () => {
  const { user } = useDashboard();
  const [events, setEvents] = useState<StudyPlanEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StudyPlanEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [allStudents, setAllStudents] = useState<UserItem[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedDate] = useState(new Date());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTips, setAiTips] = useState<Record<string, string[]>>({});
  const [showTipsFor, setShowTipsFor] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'type'>('date');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) { loadEvents(); loadStudentsAndCourses(); }
  }, [user]);

  const loadEvents = async () => {
    if (!user) return;
    try {
      const eventsData = await studyPlanService.getEventsByTeacher(user.uid);
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentsAndCourses = async () => {
    try {
      const [students, courses] = await Promise.all([studyPlanService.getAllStudents(), studyPlanService.getAllCourses()]);
      setAllStudents(students as any);
      setAllCourses(courses as any);
    } catch (error) {
      console.error('Error loading students/courses:', error);
    }
  };

  const handleSaveEvent = async (eventData: Partial<StudyPlanEvent>) => {
    try {
      if (editingEvent) {
        await studyPlanService.updateEvent(editingEvent.id, eventData);
      } else {
        await studyPlanService.createEvent(eventData as Omit<StudyPlanEvent, 'id'>);
      }
      setShowModal(false);
      setEditingEvent(null);
      await loadEvents();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Delete this event?')) {
      try {
        await studyPlanService.deleteEvent(eventId);
        await loadEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const handleGetAITips = async (event: StudyPlanEvent) => {
    if (!GEMINI_KEY) return;
    if (aiTips[event.id]) { setShowTipsFor(showTipsFor === event.id ? null : event.id); return; }
    setAiLoading(true);
    try {
      const tips = await aiStudyPlannerService.generateStudyTips(event.course || event.title, event.eventType, GEMINI_KEY);
      setAiTips(prev => ({ ...prev, [event.id]: tips }));
      setShowTipsFor(event.id);
    } catch (err) {
      console.error('AI tips error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Filtering & sorting
  const filteredEvents = events
    .filter(e => filterType === 'all' || e.eventType === filterType)
    .filter(e => filterPriority === 'all' || e.priority === filterPriority)
    .filter(e => !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.course?.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date') return a.date.getTime() - b.date.getTime();
      if (sortBy === 'priority') return ['high', 'medium', 'low'].indexOf(a.priority) - ['high', 'medium', 'low'].indexOf(b.priority);
      return a.eventType.localeCompare(b.eventType);
    });

  // Stats
  const stats = {
    total: events.length,
    upcoming: events.filter(e => e.date >= new Date()).length,
    highPriority: events.filter(e => e.priority === 'high').length,
    studentsReached: [...new Set(events.flatMap(e => e.targetStudentIds || []))].length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Study Plan Management
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 rounded-full font-medium">
              <Sparkles className="w-3 h-3" /> AI Enhanced
            </span>
          </h1>
          <p className="text-gray-600 mt-1">Create intelligent study plans for students</p>
        </div>
        <button onClick={() => { setEditingEvent(null); setShowModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Create Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, icon: <Calendar className="w-5 h-5 text-indigo-500" />, color: 'bg-indigo-50 border-indigo-100' },
          { label: 'Upcoming', value: stats.upcoming, icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, color: 'bg-emerald-50 border-emerald-100' },
          { label: 'High Priority', value: stats.highPriority, icon: <Zap className="w-5 h-5 text-red-500" />, color: 'bg-red-50 border-red-100' },
          { label: 'Students Targeted', value: stats.studentsReached, icon: <Users className="w-5 h-5 text-purple-500" />, color: 'bg-purple-50 border-purple-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="flex items-center justify-between mb-2">{s.icon}<span className="text-2xl font-bold text-gray-900">{s.value}</span></div>
            <p className="text-sm text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search events..." className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 min-w-40" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Types</option>
            {['class', 'assignment', 'exam', 'study_session', 'deadline'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Priorities</option>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="type">Sort by Type</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" /> Study Plan Events
              <span className="text-sm text-gray-400 font-normal">({filteredEvents.length})</span>
            </h2>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">No events found</p>
              <p className="text-sm mt-1">Try adjusting filters or create your first event</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <div key={event.id} className="border rounded-xl p-4 hover:shadow-md transition-all bg-white">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-lg">{getEventIcon(event.eventType)}</span>
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityStyle(event.priority)}`}>
                          {event.priority}
                        </span>
                        {event.isAIGenerated && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                        {event.completed && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </span>
                        )}
                      </div>
                      {event.description && <p className="text-gray-600 text-sm mb-2 line-clamp-2">{event.description}</p>}
                      <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {event.startTime && ` · ${event.startTime}–${event.endTime}`}
                        </span>
                        <span className="flex items-center gap-1">
                          {event.targetAudience === 'all' && <><Users className="w-3.5 h-3.5" /> All Students</>}
                          {event.targetAudience === 'specific_student' && <><User className="w-3.5 h-3.5" /> {event.targetStudentIds?.length || 0} Student(s)</>}
                          {event.targetAudience === 'course_students' && <><BookOpen className="w-3.5 h-3.5" /> Course Students</>}
                        </span>
                        {event.course && <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{event.course}</span>}
                      </div>

                      {/* AI Tips */}
                      {showTipsFor === event.id && aiTips[event.id] && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-purple-700 flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> AI Study Tips</span>
                            <button onClick={() => setShowTipsFor(null)}><X className="w-3.5 h-3.5 text-purple-500" /></button>
                          </div>
                          <ul className="space-y-1">
                            {aiTips[event.id].map((tip, i) => (
                              <li key={i} className="text-xs text-purple-700 flex items-start gap-1.5"><span className="text-purple-400 mt-0.5">•</span>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {GEMINI_KEY && (
                        <button onClick={() => handleGetAITips(event)} disabled={aiLoading}
                          className="p-2 text-gray-400 hover:text-purple-600 transition-colors" title="Get AI study tips">
                          {aiLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => { setEditingEvent(event); setShowModal(true); }}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <StudyPlanEventModal
          event={editingEvent} selectedDate={selectedDate} currentUser={user}
          allStudents={allStudents} allCourses={allCourses}
          onSave={handleSaveEvent}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
          isPersonalEvent={false}
        />
      )}
    </div>
  );
};

export default StudyPlan;
