import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader, AlertCircle, Edit, Trash2, Clock, Target } from 'lucide-react';
import Calendar from 'react-calendar';
import Card from '../components/ui/Card';
import { format } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

const StudentStudyPlan = () => {
  const { user } = useDashboard();
  const [date, setDate] = useState<Value>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [events, setEvents] = useState<StudyPlanEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<StudyPlanEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user]);

  const loadEvents = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const fetchedEvents = await studyPlanService.getEventsForStudent(user.uid);
      setEvents(fetchedEvents);
    } catch (err: any) {
      setError('Failed to load study plan events: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = () => {
    setCurrentEvent(null);
    setShowModal(true);
  };

  const handleEditEvent = (event: StudyPlanEvent) => {
    // Only allow editing personal events
    if (event.isPersonal && event.studentId === user?.uid) {
      setCurrentEvent(event);
      setShowModal(true);
    }
  };

  const handleSaveEvent = async (eventData: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) {
      setError('User not logged in.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (currentEvent) {
        await studyPlanService.updateEvent(currentEvent.id, eventData);
      } else {
        await studyPlanService.createEvent(eventData);
      }
      await loadEvents(); // Refresh events
      setShowModal(false);
      setCurrentEvent(null);
      
      if ((window as any).addNotification) {
        (window as any).addNotification(
          currentEvent ? 'Event updated successfully!' : 'Event added successfully!',
          'success'
        );
      }
    } catch (err: any) {
      setError('Failed to save event: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await studyPlanService.deleteEvent(id);
      await loadEvents(); // Refresh events
      
      if ((window as any).addNotification) {
        (window as any).addNotification('Event deleted successfully!', 'success');
      }
    } catch (err: any) {
      setError('Failed to delete event: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedDate = date instanceof Date ? date : new Date();

  const eventsForSelectedDate = events.filter(event =>
    event.date.getDate() === selectedDate.getDate() &&
    event.date.getMonth() === selectedDate.getMonth() &&
    event.date.getFullYear() === selectedDate.getFullYear()
  );

  const getEventTypeColor = (event: StudyPlanEvent) => {
    if (event.isPersonal) return 'border-accent-500';
    
    switch (event.eventType) {
      case 'assignment': return 'border-warning-DEFAULT';
      case 'exam': return 'border-error-DEFAULT';
      case 'class': return 'border-primary-500';
      case 'study_session': return 'border-secondary-500';
      case 'deadline': return 'border-pink-500';
      default: return 'border-accent-500';
    }
  };

  const getEventTypeIcon = (event: StudyPlanEvent) => {
    switch (event.eventType) {
      case 'assignment': return '📋';
      case 'exam': return '🎯';
      case 'class': return '🏫';
      case 'study_session': return '📚';
      case 'deadline': return '⏰';
      case 'personal': return '📝';
      default: return '📅';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error-DEFAULT';
      case 'medium': return 'text-warning-DEFAULT';
      case 'low': return 'text-success-DEFAULT';
      default: return 'text-gray-400';
    }
  };

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
          <h1 className="text-2xl font-bold text-white">My Study Plan</h1>
          <p className="text-gray-400 mt-1">Manage your personal study schedule and view assigned events</p>
        </div>
        <button
          onClick={handleAddEvent}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          <span>Add Personal Event</span>
        </button>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Calendar</h2>
              <div className="text-sm text-gray-400">
                {events.filter(e => e.isPersonal).length} personal events
              </div>
            </div>

            <div className="custom-calendar">
              <Calendar
                onChange={setDate}
                value={date}
                className="bg-card text-white rounded-lg w-full"
                tileClassName={({ date, view }) => {
                  if (view === 'month') {
                    const hasEvent = events.some(
                      event =>
                        event.date.getDate() === date.getDate() &&
                        event.date.getMonth() === date.getMonth() &&
                        event.date.getFullYear() === date.getFullYear()
                    );
                    return hasEvent ? 'has-event' : null;
                  }
                  return null;
                }}
                prevLabel={<ChevronLeft size={16} />}
                nextLabel={<ChevronRight size={16} />}
                navigationLabel={({ date }) => (
                  <span className="text-white font-medium">
                    {format(date, 'MMMM yyyy')}
                  </span>
                )}
              />
            </div>

            <div className="mt-4 space-y-2">
              <h3 className="text-sm text-gray-400 mb-2">Legend</h3>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary-500"></div>
                  <span className="text-sm text-gray-300">Teacher/Admin events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent-500"></div>
                  <span className="text-sm text-gray-300">Personal events</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">
                Events for {format(selectedDate, 'MMMM d, yyyy')}
              </h2>
              <button
                onClick={handleAddEvent}
                className="flex items-center gap-1 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded transition-colors"
              >
                <Plus size={14} />
                <span>Add Event</span>
              </button>
            </div>

            {eventsForSelectedDate.length > 0 ? (
              <div className="space-y-4">
                {eventsForSelectedDate.map((event) => (
                  <div
                    key={event.id}
                    className={`bg-background-800 rounded-lg p-4 border-l-4 ${getEventTypeColor(event)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getEventTypeIcon(event)}</span>
                          <h3 className="text-white font-medium">{event.title}</h3>
                          {event.isPersonal && (
                            <span className="text-xs bg-accent-900 text-accent-300 px-2 py-1 rounded">
                              Personal
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(event.priority)}`}>
                            {event.priority}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-2">{event.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock size={14} className="text-gray-400" />
                            <span className="text-gray-300">
                              {event.startTime} - {event.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target size={14} className="text-gray-400" />
                            <span className="text-gray-300">{event.course}</span>
                          </div>
                          {!event.isPersonal && (
                            <div className="text-xs text-gray-400">
                              by {event.instructorName}
                            </div>
                          )}
                        </div>
                      </div>

                      {event.isPersonal && event.studentId === user?.uid && (
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                            title="Edit personal event"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors"
                            title="Delete personal event"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-gray-400">
                <CalendarIcon size={40} className="mx-auto mb-4 text-gray-500" />
                <p>No events scheduled for this date.</p>
                <button
                  onClick={handleAddEvent}
                  className="mt-4 inline-flex items-center gap-1 text-primary-400 hover:text-primary-300"
                >
                  <Plus size={16} />
                  <span>Add Personal Event</span>
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {showModal && (
        <StudyPlanEventModal
          selectedDate={selectedDate}
          currentUser={user}
          allStudents={[]}
          allCourses={[]}
          onClose={() => setShowModal(false)}
          onSave={handleSaveEvent}
          isPersonalEvent={true}
        />
      )}
    </div>
  );
};

export default StudentStudyPlan;