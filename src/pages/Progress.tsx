import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Award, Edit2 } from 'lucide-react';
import Card from '../components/ui/Card';

interface Student {
  id: number;
  name: string;
  email: string;
  score: number;
  progress: number;
  avatar: string;
  course?: string;
  notes?: string;
}

const Progress = () => {
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [sortField, setSortField] = useState<'rank' | 'name' | 'score' | 'progress'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([
    { id: 1, name: 'John Smith', email: 'john@example.com', score: 92, progress: 85, avatar: 'JS', course: 'Mathematics 101' },
    { id: 2, name: 'Emily Johnson', email: 'emily@example.com', score: 88, progress: 78, avatar: 'EJ', course: 'Advanced Physics' },
    { id: 3, name: 'Michael Brown', email: 'michael@example.com', score: 95, progress: 90, avatar: 'MB', course: 'Mathematics 101' },
    { id: 4, name: 'Sophia Williams', email: 'sophia@example.com', score: 84, progress: 72, avatar: 'SW', course: 'Introduction to Biology' },
    { id: 5, name: 'Daniel Jones', email: 'daniel@example.com', score: 91, progress: 88, avatar: 'DJ', course: 'Computer Science Fundamentals' },
    { id: 6, name: 'Olivia Davis', email: 'olivia@example.com', score: 87, progress: 76, avatar: 'OD', course: 'Advanced Physics' },
    { id: 7, name: 'Alexander Miller', email: 'alexander@example.com', score: 90, progress: 82, avatar: 'AM', course: 'Mathematics 101' },
    { id: 8, name: 'Emma Wilson', email: 'emma@example.com', score: 89, progress: 79, avatar: 'EW', course: 'Introduction to Biology' },
    { id: 9, name: 'James Taylor', email: 'james@example.com', score: 93, progress: 87, avatar: 'JT', course: 'Computer Science Fundamentals' },
    { id: 10, name: 'Ava Martinez', email: 'ava@example.com', score: 86, progress: 75, avatar: 'AM', course: 'Advanced Physics' },
  ]);
  
  const courses = [
    { id: 'all', name: 'All Courses' },
    { id: 'math101', name: 'Mathematics 101' },
    { id: 'physics', name: 'Advanced Physics' },
    { id: 'biology', name: 'Introduction to Biology' },
    { id: 'cs', name: 'Computer Science Fundamentals' },
  ];
  
  const handleSort = (field: 'rank' | 'name' | 'score' | 'progress') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const getSortIcon = (field: 'rank' | 'name' | 'score' | 'progress') => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };
  
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || 
                         (student.course && student.course.toLowerCase().includes(courses.find(c => c.id === selectedCourse)?.name.toLowerCase() || ''));
    return matchesSearch && matchesCourse;
  });
  
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortField === 'rank') {
      return sortDirection === 'asc' ? a.score - b.score : b.score - a.score;
    } else if (sortField === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    } else if (sortField === 'score') {
      return sortDirection === 'asc' ? a.score - b.score : b.score - a.score;
    } else { // progress
      return sortDirection === 'asc' ? a.progress - b.progress : b.progress - a.progress;
    }
  });
  
  const handleUpdateProgress = (student: Student) => {
    setCurrentStudent(student);
    setShowModal(true);
  };

  const handleSaveProgress = (updatedData: Partial<Student>) => {
    if (currentStudent) {
      setStudents(prevStudents => 
        prevStudents.map(student => 
          student.id === currentStudent.id 
            ? { ...student, ...updatedData }
            : student
        )
      );
      setShowModal(false);
      setCurrentStudent(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Progress & Leaderboard</h1>
      
      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search students..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
          
          <div className="w-full md:w-auto">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-3 pr-9 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-card-light rounded-lg overflow-hidden mb-6">
          <div className="p-5 flex items-center justify-between">
            <h3 className="text-white font-medium">Course Leaderboard</h3>
            <div className="text-sm text-gray-400">
              {selectedCourse !== 'all' ? 
                `Showing results for ${courses.find(c => c.id === selectedCourse)?.name}` : 
                'Showing results for all courses'}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-background-800">
                  <th 
                    className="p-4 text-xs uppercase text-gray-400 font-medium cursor-pointer"
                    onClick={() => handleSort('rank')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Rank</span>
                      {getSortIcon('rank')}
                    </div>
                  </th>
                  <th 
                    className="p-4 text-xs uppercase text-gray-400 font-medium cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Student</span>
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="p-4 text-xs uppercase text-gray-400 font-medium cursor-pointer"
                    onClick={() => handleSort('score')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Score</span>
                      {getSortIcon('score')}
                    </div>
                  </th>
                  <th 
                    className="p-4 text-xs uppercase text-gray-400 font-medium cursor-pointer"
                    onClick={() => handleSort('progress')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Progress</span>
                      {getSortIcon('progress')}
                    </div>
                  </th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Course</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, index) => (
                  <tr key={student.id} className="border-b border-background-800 last:border-0">
                    <td className="p-4">
                      <div className="flex items-center">
                        {index < 3 ? (
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${
                            index === 0 ? 'bg-yellow-500' : 
                            index === 1 ? 'bg-gray-400' : 'bg-amber-700'
                          }`}>
                            <Award size={16} className="text-white" />
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-background-700 flex items-center justify-center">
                            <span className="text-xs text-white">{index + 1}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary-700 flex items-center justify-center">
                          <span className="text-white font-medium">{student.avatar}</span>
                        </div>
                        <div>
                          <p className="text-white">{student.name}</p>
                          <p className="text-xs text-gray-400">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-primary-500 flex items-center justify-center">
                          <span className="text-xs text-white">{index < 3 ? index + 1 : ''}</span>
                        </div>
                        <span className="text-white font-medium">{student.score}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-full max-w-[120px] bg-background-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-accent-500"
                            style={{ width: `${student.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-white">{student.progress}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs bg-background-700 px-2 py-1 rounded text-primary-300">
                        {student.course || 'Not assigned'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleUpdateProgress(student)}
                        className="flex items-center gap-1 text-sm bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded transition-colors"
                      >
                        <Edit2 size={14} />
                        <span>Update</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {sortedStudents.length === 0 && (
            <div className="py-8 text-center text-gray-400">
              No students found matching your search criteria.
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center text-sm text-gray-400">
          <div>Showing {sortedStudents.length} of {students.length} students</div>
          <div>Last updated: {new Date().toLocaleDateString()}</div>
        </div>
      </Card>
      
      {showModal && currentStudent && (
        <ProgressUpdateModal
          student={currentStudent}
          courses={courses}
          onClose={() => {
            setShowModal(false);
            setCurrentStudent(null);
          }}
          onSave={handleSaveProgress}
        />
      )}
    </div>
  );
};

interface ProgressUpdateModalProps {
  student: Student;
  courses: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: Partial<Student>) => void;
}

const ProgressUpdateModal = ({ student, courses, onClose, onSave }: ProgressUpdateModalProps) => {
  const [formData, setFormData] = useState({
    score: student.score,
    progress: student.progress,
    course: student.course || '',
    notes: student.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setFormData(prev => ({ ...prev, progress: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card w-full max-w-md rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-background-800">
          <h3 className="text-white font-medium">Update Student Progress</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-full bg-primary-700 flex items-center justify-center">
              <span className="text-white font-medium">{student.avatar}</span>
            </div>
            <div>
              <p className="text-white font-medium">{student.name}</p>
              <p className="text-sm text-gray-400">{student.email}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.score}
                onChange={(e) => setFormData(prev => ({ ...prev, score: parseInt(e.target.value) || 0 }))}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Progress ({formData.progress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progress}
                onChange={handleProgressChange}
                className="w-full h-2 bg-background-800 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Course</label>
              <select
                value={formData.course}
                onChange={(e) => setFormData(prev => ({ ...prev, course: e.target.value }))}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a course</option>
                {courses.filter(course => course.id !== 'all').map((course) => (
                  <option key={course.id} value={course.name}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Notes</label>
              <textarea
                placeholder="Add any notes about the student's progress..."
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              ></textarea>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
            >
              Update Progress
            </button>
          </div>
        </form>
      </div>
      
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-primary, #6366f1);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: var(--color-primary, #6366f1);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: #374151;
        }
        
        .slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: #374151;
        }
      `}</style>
    </div>
  );
};

export default Progress;