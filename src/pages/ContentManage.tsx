// src/pages/ContentManage.tsx
import { useState } from 'react';
import { Plus, BookOpen, FileText, PenTool, BrainCircuit, Search, Filter, X } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import ContentUpload from './ContentUpload';

const ContentManage = () => {
  const { user } = useDashboard();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'note' | 'trick' | 'exam'>('all');

  const handleCloseModal = () => {
    setShowUploadModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Management</h1>
          <p className="text-gray-400 mt-1">Manage your educational content</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-lg"
        >
          <Plus size={20} />
          <span>Create Content</span>
        </button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search content by title, subject, or tags..."
                className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="relative">
              <Filter size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
              >
                <option value="all">All Content Types</option>
                <option value="lesson">Lessons</option>
                <option value="note">Notes</option>
                <option value="trick">Tricks & Hacks</option>
                <option value="exam">Exams</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-900/20 rounded-lg">
              <BookOpen size={24} className="text-blue-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Lessons</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-900/20 rounded-lg">
              <FileText size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Notes</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-900/20 rounded-lg">
              <PenTool size={24} className="text-purple-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Tricks</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-900/20 rounded-lg">
              <BrainCircuit size={24} className="text-orange-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Exams</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Your Content">
        <div className="text-center py-12">
          <div className="mb-4">
            <BookOpen size={64} className="mx-auto text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No Content Yet</h3>
          <p className="text-gray-400 mb-6">Get started by creating your first educational content</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus size={20} />
            <span>Create Your First Content</span>
          </button>
        </div>
      </Card>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-background-900 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
            <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Create New Content</h2>
                <p className="text-gray-400 text-sm mt-1">Upload educational materials for your students</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <ContentUpload onClose={handleCloseModal} isModal={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentManage;
