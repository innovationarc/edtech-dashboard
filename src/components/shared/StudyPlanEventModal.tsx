import React, { useState } from 'react';
import { X, Calendar, Clock, Target, AlertCircle, Users, BookOpen, Check } from 'lucide-react';

interface StudyPlanEventModalProps {
  selectedDate: Date;
  currentUser: any;
  allStudents?: { uid: string; name: string; email: string }[];
  allCourses?: { id: string; title: string; instructorName: string }[];
  onClose: () => void;
  onSave: (eventData: any) => void;
  isPersonalEvent: boolean;
  event?: any; // For editing existing events
}

const StudyPlanEventModal: React.FC<StudyPlanEventModalProps> = ({ 
  selectedDate, 
  currentUser, 
  allStudents = [],
  allCourses = [],
  onClose, 
  onSave, 
  isPersonalEvent,
  event 
}) => {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    date: event?.date ? event.date.toISOString().slice(0, 10) : selectedDate.toISOString().slice(0, 10),
    startTime: event?.startTime || '09:00',
    endTime: event?.endTime || '10:00',
    course: event?.course || '',
    eventType: event?.eventType || (isPersonalEvent ? 'personal' : 'class'),
    priority: event?.priority || 'medium',
    targetAudience: event?.targetAudience || (isPersonalEvent ? 'specific_student' : 'all'),
    targetStudentIds: event?.targetStudentIds || [],
    targetCourseIds: event?.targetCourseIds || []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      console.error('No current user available');
      return;
    }

    const eventData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      date: new Date(formData.date),
      startTime: formData.startTime,
      endTime: formData.endTime,
      course: formData.course.trim(),
      eventType: formData.eventType,
      priority: formData.priority,
      isPersonal: isPersonalEvent,
      // Set instructor/student details based on event type
      ...(isPersonalEvent ? {
        studentId: currentUser.uid,
        instructorId: currentUser.uid,
        instructorName: currentUser.name,
        targetAudience: 'specific_student',
        targetStudentIds: [currentUser.uid],
        targetCourseIds: []
      } : {
        instructorId: currentUser.uid,
        instructorName: currentUser.name,
        targetAudience: formData.targetAudience,
        targetStudentIds: formData.targetAudience === 'specific_student' ? formData.targetStudentIds : [],
        targetCourseIds: formData.targetAudience === 'course_students' ? formData.targetCourseIds : []
      })
    };

    onSave(eventData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center">
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {event ? 'Edit Event' : `Create ${isPersonalEvent ? 'Personal' : ''} Event`}
              </h2>
              <p className="text-gray-400">
                {isPersonalEvent ? 'Add a personal study event' : 'Create an event for students'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter event title..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter event description..."
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Start Time *</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">End Time *</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Course/Subject</label>
              <input
                type="text"
                value={formData.course}
                onChange={(e) => setFormData(prev => ({ ...prev, course: e.target.value }))}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter course or subject name..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Event Type</label>
                <select
                  value={formData.eventType}
                  onChange={(e) => setFormData(prev => ({ ...prev, eventType: e.target.value }))}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="class">Class</option>
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="study_session">Study Session</option>
                  <option value="deadline">Deadline</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {!isPersonalEvent && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Target Audience</label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    targetAudience: e.target.value,
                    targetStudentIds: [],
                    targetCourseIds: []
                  }))}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Students</option>
                  <option value="specific_student">Specific Students</option>
                  <option value="course_students">Students in Courses</option>
                </select>
              </div>
            )}

            {/* Specific Students Selection */}
            {!isPersonalEvent && formData.targetAudience === 'specific_student' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Students
                </label>
                <div className="bg-background-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {allStudents.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      <Users size={24} className="mx-auto mb-2" />
                      <p className="text-sm">No students available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allStudents.map((student) => (
                        <label key={student.uid} className="flex items-center gap-3 p-2 hover:bg-background-700 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.targetStudentIds.includes(student.uid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  targetStudentIds: [...prev.targetStudentIds, student.uid]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  targetStudentIds: prev.targetStudentIds.filter(id => id !== student.uid)
                                }));
                              }
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-700 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm">{student.name}</div>
                            <div className="text-gray-400 text-xs truncate">{student.email}</div>
                          </div>
                          {formData.targetStudentIds.includes(student.uid) && (
                            <Check size={16} className="text-success-DEFAULT" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {formData.targetStudentIds.length > 0 && (
                  <div className="mt-2 text-sm text-gray-400">
                    {formData.targetStudentIds.length} student{formData.targetStudentIds.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}

            {/* Course Students Selection */}
            {!isPersonalEvent && formData.targetAudience === 'course_students' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Select Courses
                </label>
                <div className="bg-background-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {allCourses.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      <BookOpen size={24} className="mx-auto mb-2" />
                      <p className="text-sm">No courses available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allCourses.map((course) => (
                        <label key={course.id} className="flex items-center gap-3 p-2 hover:bg-background-700 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.targetCourseIds.includes(course.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  targetCourseIds: [...prev.targetCourseIds, course.id]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  targetCourseIds: prev.targetCourseIds.filter(id => id !== course.id)
                                }));
                              }
                            }}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-700 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm">{course.title}</div>
                            <div className="text-gray-400 text-xs truncate">by {course.instructorName}</div>
                          </div>
                          {formData.targetCourseIds.includes(course.id) && (
                            <Check size={16} className="text-success-DEFAULT" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {formData.targetCourseIds.length > 0 && (
                  <div className="mt-2 text-sm text-gray-400">
                    {formData.targetCourseIds.length} course{formData.targetCourseIds.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-background-800">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                {event ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanEventModal;
