// src/components/dashboard/SubjectBreakdown.tsx
import { BookOpen, Calculator, Microscope, PenTool, Globe, Monitor, Palette } from 'lucide-react';

interface SubjectBreakdownProps {
  subjectsData: { name: string; lessons: number; notes: number; mcqs: number; total: number }[];
}

const SubjectBreakdown = ({ subjectsData }: SubjectBreakdownProps) => {
  const getSubjectIcon = (subjectName: string) => {
    switch (subjectName) {
      case 'Mathematics': return <Calculator size={16} className="text-white" />;
      case 'Physics': return <Microscope size={16} className="text-white" />;
      case 'Language Arts': return <PenTool size={16} className="text-white" />;
      case 'History': return <Globe size={16} className="text-white" />;
      case 'Computer Science': return <Monitor size={16} className="text-white" />;
      case 'Art & Music': return <Palette size={16} className="text-white" />;
      default: return <BookOpen size={16} className="text-white" />;
    }
  };

  const getSubjectColor = (subjectName: string) => {
    switch (subjectName) {
      case 'Mathematics': return 'bg-blue-500';
      case 'Physics': return 'bg-green-500';
      case 'Language Arts': return 'bg-purple-500';
      case 'History': return 'bg-orange-500';
      case 'Computer Science': return 'bg-indigo-500';
      case 'Art & Music': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const totalContentItems = subjectsData.reduce((sum, subject) => sum + subject.total, 0);
  const maxContent = subjectsData.length > 0 ? Math.max(...subjectsData.map(s => s.total)) : 1; // For progress bar scaling

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Subject Content Breakdown</h3>
        <p className="text-sm text-gray-400">Content distribution by subject</p>
      </div>
      
      <div className="p-5">
        <div className="space-y-4">
          {subjectsData.map((subject) => (
            <div key={subject.name} className="bg-background-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${getSubjectColor(subject.name)} flex items-center justify-center`}>
                    {getSubjectIcon(subject.name)}
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{subject.name}</h4>
                    <p className="text-sm text-gray-400">{subject.total} total items</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-success-DEFAULT text-sm font-medium">+X%</span>
                  <p className="text-xs text-gray-400">this month</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-white font-medium">{subject.lessons}</p>
                  <p className="text-xs text-gray-400">Lessons</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{subject.notes}</p>
                  <p className="text-xs text-gray-400">Notes</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{subject.mcqs}</p>
                  <p className="text-xs text-gray-400">MCQs</p>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="w-full bg-background-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getSubjectColor(subject.name)}`}
                    style={{ width: `${(subject.total / maxContent) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-5 border-t border-background-800">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Total Content Items</span>
          <span className="text-white font-medium">{totalContentItems} items</span>
        </div>
      </div>
    </div>
  );
};

export default SubjectBreakdown;
