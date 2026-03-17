import { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  User,
  BookOpen,
  Bell,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader,
  RefreshCw,
  X
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { announcementService, Announcement } from '../services/announcementService';
import CreateAnnouncementModal from '../components/announcements/CreateAnnouncementModal';
import EditAnnouncementModal from '../components/announcements/EditAnnouncementModal';

const AllAnnouncements = () => {
  const { user } = useDashboard();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'assignment' | 'announcement' | 'reminder' | 'urgent'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [announcementToEdit, setAnnouncementToEdit] = useState<Announcement | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading all announcements for admin...');
      
      const fetchedAnnouncements = await announcementService.getAllAnnouncements();
      console.log('Fetched announcements:', fetchedAnnouncements.length);
      
      setAnnouncements(fetchedAnnouncements);
    } catch (error: any) {
      console.error('Error loading announcements:', error);
      setError('Failed to load announcements: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnnouncements();
    setRefreshing(false);
  };

  const handleCreateSuccess = (announcement: { id: string; title: string; message: string; type: string; priority: string; subject: string; targetAudience: string; targetStudents: string[] }) => {
    loadAnnouncements();

    if ((window as any).addNotification) {
      (window as any).addNotification(
        'Announcement created successfully!',
        'success'
      );
    }
  };

  const handleViewAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setShowViewModal(true);
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setAnnouncementToEdit(announcement);
    setShowEditModal(true);
  };

  const handleDeleteAnnouncement = async (announcement: Announcement) => {
    if (!confirm(`Are you sure you want to delete the announcement "${announcement.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await announcementService.deleteAnnouncement(announcement.id);
      setAnnouncements(prev => prev.filter(a => a.id !== announcement.id));
      
      if ((window as any).addNotification) {
        (window as any).addNotification(
          'Announcement deleted successfully!',
          'success'
        );
      }
    } catch (error: any) {
      console.error('Error deleting announcement:', error);
      if ((window as any).addNotification) {
        (window as any).addNotification(
          'Failed to delete announcement: ' + error.message,
          'error'
        );
      }
    }
  };

  const handleToggleStatus = async (announcement: Announcement) => {
    try {
      const newStatus = !announcement.isActive;
      await announcementService.updateAnnouncement(announcement.id, { isActive: newStatus });
      
      setAnnouncements(prev => 
        prev.map(a => 
          a.id === announcement.id 
            ? { ...a, isActive: newStatus }
            : a
        )
      );
      
      if ((window as any).addNotification) {
        (window as any).addNotification(
          `Announcement ${newStatus ? 'activated' : 'deactivated'} successfully!`,
          'success'
        );
      }
    } catch (error: any) {
      console.error('Error updating announcement status:', error);
      if ((window as any).addNotification) {
        (window as any).addNotification(
          'Failed to update announcement status: ' + error.message,
          'error'
        );
      }
    }
  };

  const handleEditSuccess = () => {
    loadAnnouncements(); // Refresh the list
    setShowEditModal(false);
    setAnnouncementToEdit(null);
  };

  // Filter announcements
  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch = announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         announcement.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || announcement.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || announcement.priority === priorityFilter;
    
    const now = new Date();
    const isExpired = announcement.expiresAt && announcement.expiresAt < now;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && announcement.isActive && !isExpired) ||
                         (statusFilter === 'expired' && (isExpired || !announcement.isActive));
    
    return matchesSearch && matchesType && matchesPriority && matchesStatus;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <BookOpen size={16} className="text-primary-400" />;
      case 'reminder': return <Bell size={16} className="text-warning-DEFAULT" />;
      case 'urgent': return <AlertCircle size={16} className="text-error-DEFAULT" />;
      case 'announcement': return <Megaphone size={16} className="text-secondary-400" />;
      default: return <Megaphone size={16} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-error-DEFAULT bg-error-dark/20';
      case 'medium': return 'text-warning-DEFAULT bg-warning-dark/20';
      case 'low': return 'text-success-DEFAULT bg-success-dark/20';
      default: return 'text-gray-400 bg-background-700';
    }
  };

  const getStatusColor = (announcement: Announcement) => {
    const now = new Date();
    const isExpired = announcement.expiresAt && announcement.expiresAt < now;
    
    if (!announcement.isActive) return 'text-gray-400 bg-background-700';
    if (isExpired) return 'text-warning-DEFAULT bg-warning-dark/20';
    return 'text-success-DEFAULT bg-success-dark/20';
  };

  const getStatusText = (announcement: Announcement) => {
    const now = new Date();
    const isExpired = announcement.expiresAt && announcement.expiresAt < now;
    
    if (!announcement.isActive) return 'Inactive';
    if (isExpired) return 'Expired';
    return 'Active';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Announcements</h1>
          <p className="text-gray-400 mt-1">
            View and manage all announcements across the platform
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-background-800 hover:bg-background-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            <span>Create Announcement</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search announcements..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Types</option>
            <option value="announcement">General</option>
            <option value="assignment">Assignment</option>
            <option value="reminder">Reminder</option>
            <option value="urgent">Urgent</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired/Inactive</option>
          </select>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <span className="text-sm text-gray-400">
              {filteredAnnouncements.length} of {announcements.length}
            </span>
          </div>
        </div>
      </Card>

      {/* Announcements List */}
      <Card>
        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {announcements.length === 0 ? 'No announcements yet' : 'No announcements match your filters'}
            </h3>
            <p className="text-gray-400 mb-4">
              {announcements.length === 0 
                ? 'Create your first announcement to get started.'
                : 'Try adjusting your search criteria or filters.'
              }
            </p>
            {announcements.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Create First Announcement
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-background-800">
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Announcement</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Type</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Priority</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Teacher</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Subject</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Status</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Created</th>
                  <th className="p-4 text-xs uppercase text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map((announcement) => (
                  <tr key={announcement.id} className="border-b border-background-800 hover:bg-background-800/50">
                    <td className="p-4">
                      <div className="min-w-0">
                        <h4 className="text-white font-medium truncate mb-1">{announcement.title}</h4>
                        <p className="text-sm text-gray-400 line-clamp-2">{announcement.message}</p>
                        {announcement.expiresAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Expires: {announcement.expiresAt.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(announcement.type)}
                        <span className="text-sm text-gray-300 capitalize">{announcement.type}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(announcement.priority)}`}>
                        {announcement.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary-700 flex items-center justify-center">
                          <span className="text-xs text-white">{announcement.teacherName.charAt(0)}</span>
                        </div>
                        <span className="text-sm text-white">{announcement.teacherName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm bg-background-700 px-2 py-1 rounded text-gray-300">
                        {announcement.subject}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(announcement)}`}>
                        {getStatusText(announcement)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-400">
                        <div>{formatTimeAgo(announcement.createdAt)}</div>
                        <div className="text-xs">{announcement.createdAt.toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewAnnouncement(announcement)}
                          className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleEditAnnouncement(announcement)}
                          className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                          title="Edit announcement"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(announcement)}
                          className={`p-1.5 rounded transition-colors ${
                            announcement.isActive
                              ? 'bg-warning-DEFAULT hover:bg-warning-dark text-white'
                              : 'bg-success-DEFAULT hover:bg-success-dark text-white'
                          }`}
                          title={announcement.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {announcement.isActive ? <Clock size={14} /> : <CheckCircle size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(announcement)}
                          className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors"
                          title="Delete announcement"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center">
              <Megaphone size={20} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{announcements.length}</div>
              <div className="text-sm text-gray-400">Total Announcements</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success-DEFAULT flex items-center justify-center">
              <CheckCircle size={20} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {announcements.filter(a => a.isActive && (!a.expiresAt || a.expiresAt > new Date())).length}
              </div>
              <div className="text-sm text-gray-400">Active</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-error-DEFAULT flex items-center justify-center">
              <AlertCircle size={20} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {announcements.filter(a => a.priority === 'high').length}
              </div>
              <div className="text-sm text-gray-400">High Priority</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning-DEFAULT flex items-center justify-center">
              <Clock size={20} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {announcements.filter(a => a.expiresAt && a.expiresAt < new Date()).length}
              </div>
              <div className="text-sm text-gray-400">Expired</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <CreateAnnouncementModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Edit Announcement Modal */}
      {showEditModal && announcementToEdit && (
        <EditAnnouncementModal
          announcement={announcementToEdit}
          onClose={() => {
            setShowEditModal(false);
            setAnnouncementToEdit(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* View Announcement Modal */}
      {showViewModal && selectedAnnouncement && (
        <AnnouncementViewModal
          announcement={selectedAnnouncement}
          onClose={() => {
            setShowViewModal(false);
            setSelectedAnnouncement(null);
          }}
        />
      )}
    </div>
  );
};

// Announcement View Modal Component
interface AnnouncementViewModalProps {
  announcement: Announcement;
  onClose: () => void;
}

const AnnouncementViewModal = ({ announcement, onClose }: AnnouncementViewModalProps) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment': return <BookOpen size={20} className="text-primary-400" />;
      case 'reminder': return <Bell size={20} className="text-warning-DEFAULT" />;
      case 'urgent': return <AlertCircle size={20} className="text-error-DEFAULT" />;
      case 'announcement': return <Megaphone size={20} className="text-secondary-400" />;
      default: return <Megaphone size={20} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-error-DEFAULT bg-error-dark/10';
      case 'medium': return 'border-l-warning-DEFAULT bg-warning-dark/10';
      case 'low': return 'border-l-success-DEFAULT bg-success-dark/10';
      default: return 'border-l-background-600 bg-background-800';
    }
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
            <div className="h-12 w-12 rounded-lg bg-secondary-600 flex items-center justify-center">
              {getTypeIcon(announcement.type)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Announcement Details</h2>
              <p className="text-gray-400">Created by {announcement.teacherName}</p>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-l-4 mb-6 ${getPriorityColor(announcement.priority)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getTypeIcon(announcement.type)}
                <div>
                  <h3 className="text-lg font-medium text-white">{announcement.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {announcement.teacherName}
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen size={14} />
                      {announcement.subject}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {announcement.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  announcement.priority === 'high' ? 'bg-error-DEFAULT text-white' :
                  announcement.priority === 'medium' ? 'bg-warning-DEFAULT text-white' :
                  'bg-success-DEFAULT text-white'
                }`}>
                  {announcement.priority} priority
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  announcement.isActive ? 'bg-success-dark text-success-light' : 'bg-background-700 text-gray-300'
                }`}>
                  {announcement.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 whitespace-pre-wrap">{announcement.message}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-background-800 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Announcement Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white capitalize">{announcement.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Priority:</span>
                  <span className="text-white capitalize">{announcement.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target:</span>
                  <span className="text-white capitalize">{announcement.targetAudience}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={announcement.isActive ? 'text-success-DEFAULT' : 'text-gray-400'}>
                    {announcement.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-background-800 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2">Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white">{announcement.createdAt.toLocaleString()}</span>
                </div>
                {announcement.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Updated:</span>
                    <span className="text-white">{announcement.updatedAt.toLocaleString()}</span>
                  </div>
                )}
                {announcement.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Expires:</span>
                    <span className={announcement.expiresAt < new Date() ? 'text-error-DEFAULT' : 'text-white'}>
                      {announcement.expiresAt.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-background-800">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllAnnouncements;
