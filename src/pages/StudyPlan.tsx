import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit, Trash2, Users, User, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService';
import { useDashboard } from '../contexts/DashboardContext';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
}

const StudyPlan: React.FC = () => {
  const { user } = useDashboard();
  const [events, setEvents] = useState<StudyPlanEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StudyPlanEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadEvents();
      loadStudentsAndCourses();
    }
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
      const [students, courses] = await Promise.all([
        studyPlanService.getAllStudents(),
        studyPlanService.getAllCourses()
      ]);
      setAllStudents(students);
      setAllCourses(courses);
    } catch (error) {
      console.error('Error loading students and courses:', error);
    }
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const handleEditEvent = (event: StudyPlanEvent) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await studyPlanService.deleteEvent(eventId);
        await loadEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
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

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment': return '📋';
      case 'exam': return '🎯';
      case 'class': return '🏫';
      case 'study': return '📚';
      case 'deadline': return '⏰';
      case 'personal': return '📝';
      default: return '📅';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Study Plan Management</h1>
          <p className="text-gray-600">Create and manage study plans for students</p>
        </div>
        <button
          onClick={handleCreateEvent}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Study Plan Events
          </h2>
          
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No study plan events created yet</p>
              <p className="text-sm">Create your first event to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg">{getEventTypeIcon(event.eventType)}</span>
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(event.priority)}`}>
                          {event.priority}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{event.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(event.date).toLocaleDateString()} at {event.time}
                        </span>
                        <span className="flex items-center gap-1">
                          {event.targetAudience === 'all' && <Users className="w-4 h-4" />}
                          {event.targetAudience === 'student' && <User className="w-4 h-4" />}
                          {event.targetAudience === 'course' && <BookOpen className="w-4 h-4" />}
                          {event.targetAudience === 'all' && 'All Students'}
                          {event.targetAudience === 'student' && 'Specific Student'}
                          {event.targetAudience === 'course' && 'Course Students'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
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
          event={editingEvent}
          selectedDate={selectedDate}
          currentUser={user}
          allStudents={allStudents}
          allCourses={allCourses}
          onSave={handleSaveEvent}
          onClose={() => {
            setShowModal(false);
            setEditingEvent(null);
          }}
          isPersonalEvent={false}
        />
      )}
    </div>
  );
};

export default StudyPlan;