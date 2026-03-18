// src/pages/AllAnnouncements.tsx
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
  X,
  Star,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { announcementService, Announcement } from '../services/announcementService';
import CreateAnnouncementModal from '../components/announcements/CreateAnnouncementModal';
import EditAnnouncementModal from '../components/announcements/EditAnnouncementModal';
import DailyInspirationManager from '../components/announcements/DailyInspirationManager';

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'announcements' | 'inspirations';

const AllAnnouncements = () => {
  const { user } = useDashboard();

  const [activeTab, setActiveTab]                         = useState<Tab>('announcements');
  const [announcements, setAnnouncements]                 = useState<Announcement[]>([]);
  const [loading, setLoading]                             = useState(true);
  const [refreshing, setRefreshing]                       = useState(false);
  const [error, setError]                                 = useState('');
  const [searchTerm, setSearchTerm]                       = useState('');
  const [typeFilter, setTypeFilter]                       = useState<'all' | 'assignment' | 'announcement' | 'reminder' | 'urgent'>('all');
  const [priorityFilter, setPriorityFilter]               = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [statusFilter, setStatusFilter]                   = useState<'all' | 'active' | 'expired'>('all');
  const [showCreateModal, setShowCreateModal]             = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement]   = useState<Announcement | null>(null);
  const [showViewModal, setShowViewModal]                 = useState(false);
  const [showEditModal, setShowEditModal]                 = useState(false);
  const [announcementToEdit, setAnnouncementToEdit]       = useState<Announcement | null>(null);

  useEffect(() => { loadAnnouncements(); }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError('');
      const fetched = await announcementService.getAllAnnouncements();
      setAnnouncements(fetched);
    } catch (err: any) {
      setError('Failed to load announcements: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnnouncements();
    setRefreshing(false);
  };

  const handleCreateSuccess = () => { loadAnnouncements(); };

  const handleViewAnnouncement = (a: Announcement) => {
    setSelectedAnnouncement(a);
    setShowViewModal(true);
  };

  const handleEditAnnouncement = (a: Announcement) => {
    setAnnouncementToEdit(a);
    setShowEditModal(true);
  };

  const handleDeleteAnnouncement = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
    try {
      await announcementService.deleteAnnouncement(a.id);
      setAnnouncements(prev => prev.filter(x => x.id !== a.id));
      if ((window as any).addNotification)
        (window as any).addNotification('Announcement deleted.', 'success');
    } catch (err: any) {
      if ((window as any).addNotification)
        (window as any).addNotification('Failed to delete: ' + err.message, 'error');
    }
  };

  const handleToggleStatus = async (a: Announcement) => {
    try {
      const next = !a.isActive;
      await announcementService.updateAnnouncement(a.id, { isActive: next });
      setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, isActive: next } : x));
      if ((window as any).addNotification)
        (window as any).addNotification(`Announcement ${next ? 'activated' : 'deactivated'}.`, 'success');
    } catch (err: any) {
      if ((window as any).addNotification)
        (window as any).addNotification('Failed to update status: ' + err.message, 'error');
    }
  };

  const handleEditSuccess = () => {
    loadAnnouncements();
    setShowEditModal(false);
    setAnnouncementToEdit(null);
  };

  const filteredAnnouncements = announcements.filter(a => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType     = typeFilter === 'all' || a.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || a.priority === priorityFilter;
    const now = new Date();
    const isExpired = a.expiresAt && a.expiresAt < now;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && a.isActive && !isExpired) ||
      (statusFilter === 'expired' && (isExpired || !a.isActive));
    return matchesSearch && matchesType && matchesPriority && matchesStatus;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment':   return <BookOpen   size={16} className="text-primary-400" />;
      case 'reminder':     return <Bell       size={16} className="text-warning-DEFAULT" />;
      case 'urgent':       return <AlertCircle size={16} className="text-error-DEFAULT" />;
      case 'announcement': return <Megaphone  size={16} className="text-secondary-400" />;
      default:             return <Megaphone  size={16} className="text-gray-400" />;
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high':   return 'text-error-DEFAULT bg-error-dark/20';
      case 'medium': return 'text-warning-DEFAULT bg-warning-dark/20';
      case 'low':    return 'text-success-DEFAULT bg-success-dark/20';
      default:       return 'text-gray-400 bg-background-700';
    }
  };

  const getStatusColor = (a: Announcement) => {
    const isExpired = a.expiresAt && a.expiresAt < new Date();
    if (!a.isActive) return 'text-gray-400 bg-background-700';
    if (isExpired)   return 'text-warning-DEFAULT bg-warning-dark/20';
    return 'text-success-DEFAULT bg-success-dark/20';
  };

  const getStatusText = (a: Announcement) => {
    const isExpired = a.expiresAt && a.expiresAt < new Date();
    if (!a.isActive) return 'Inactive';
    if (isExpired)   return 'Expired';
    return 'Active';
  };

  const formatTimeAgo = (date: Date) => {
    const diffH = Math.floor((Date.now() - date.getTime()) / 3600000);
    if (diffH < 1)  return 'Just now';
    if (diffH === 1) return '1 hour ago';
    if (diffH < 24) return `${diffH} hours ago`;
    const diffD = Math.floor(diffH / 24);
    return diffD === 1 ? '1 day ago' : `${diffD} days ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading announcements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Announcements</h1>
          <p className="text-gray-400 mt-1">View and manage all announcements across the platform</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-background-800 hover:bg-background-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {activeTab === 'announcements' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg text-sm font-semibold"
            >
              <Plus size={18} />
              Create Announcement
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-background-800 p-1 rounded-xl w-fit">
        {([
          { key: 'announcements', label: 'Announcements', icon: <Megaphone size={15} /> },
          { key: 'inspirations',  label: 'Daily Inspirations', icon: <Star size={15} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Inspirations tab ── */}
      {activeTab === 'inspirations' && (
        <Card>
          <DailyInspirationManager />
        </Card>
      )}

      {/* ── Announcements tab ── */}
      {activeTab === 'announcements' && (
        <>
          {error && (
            <div className="flex items-center gap-2 bg-error-dark text-error-light px-4 py-3 rounded-lg text-sm">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Filters */}
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search announcements…"
                  className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="all">All Types</option>
                <option value="announcement">General</option>
                <option value="assignment">Assignment</option>
                <option value="reminder">Reminder</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value as any)}
                className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired / Inactive</option>
              </select>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm text-gray-400">
                  {filteredAnnouncements.length} of {announcements.length}
                </span>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card>
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-12">
                <Megaphone size={44} className="mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {announcements.length === 0 ? 'No announcements yet' : 'No results match your filters'}
                </h3>
                <p className="text-gray-400 mb-4 text-sm">
                  {announcements.length === 0
                    ? 'Create your first announcement to get started.'
                    : 'Try adjusting your search or filters.'}
                </p>
                {announcements.length === 0 && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
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
                      {['Announcement','Type','Priority','Teacher','Subject','Status','Created','Actions'].map(h => (
                        <th key={h} className="p-4 text-xs uppercase text-gray-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnnouncements.map(a => (
                      <tr key={a.id} className="border-b border-background-800 hover:bg-background-800/50">
                        <td className="p-4">
                          <h4 className="text-white font-medium truncate mb-1 max-w-xs">{a.title}</h4>
                          <p className="text-sm text-gray-400 line-clamp-2">{a.message}</p>
                          {a.expiresAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Expires: {a.expiresAt.toLocaleDateString()}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(a.type)}
                            <span className="text-sm text-gray-300 capitalize">{a.type}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(a.priority)}`}>
                            {a.priority}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary-700 flex items-center justify-center shrink-0">
                              <span className="text-xs text-white">{a.teacherName.charAt(0)}</span>
                            </div>
                            <span className="text-sm text-white">{a.teacherName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm bg-background-700 px-2 py-1 rounded text-gray-300">
                            {a.subject}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(a)}`}>
                            {getStatusText(a)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-gray-400">
                            <div>{formatTimeAgo(a.createdAt)}</div>
                            <div className="text-xs">{a.createdAt.toLocaleDateString()}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewAnnouncement(a)}
                              className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                              title="View"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => handleEditAnnouncement(a)}
                              className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                              title="Edit"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(a)}
                              className={`p-1.5 rounded transition-colors ${
                                a.isActive
                                  ? 'bg-warning-DEFAULT hover:bg-warning-dark text-white'
                                  : 'bg-success-DEFAULT hover:bg-success-dark text-white'
                              }`}
                              title={a.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {a.isActive ? <Clock size={13} /> : <CheckCircle size={13} />}
                            </button>
                            <button
                              onClick={() => handleDeleteAnnouncement(a)}
                              className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
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

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total',        value: announcements.length,                                                                          color: 'bg-primary-600',        icon: <Megaphone size={20} className="text-white" /> },
              { label: 'Active',       value: announcements.filter(a => a.isActive && (!a.expiresAt || a.expiresAt > new Date())).length,    color: 'bg-success-DEFAULT',    icon: <CheckCircle size={20} className="text-white" /> },
              { label: 'High Priority',value: announcements.filter(a => a.priority === 'high').length,                                       color: 'bg-error-DEFAULT',      icon: <AlertCircle size={20} className="text-white" /> },
              { label: 'Expired',      value: announcements.filter(a => a.expiresAt && a.expiresAt < new Date()).length,                     color: 'bg-warning-DEFAULT',    icon: <Clock size={20} className="text-white" /> },
            ].map(s => (
              <Card key={s.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${s.color} flex items-center justify-center`}>
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{s.value}</div>
                    <div className="text-sm text-gray-400">{s.label}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showCreateModal && (
        <CreateAnnouncementModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
      {showEditModal && announcementToEdit && (
        <EditAnnouncementModal
          announcement={announcementToEdit}
          onClose={() => { setShowEditModal(false); setAnnouncementToEdit(null); }}
          onSuccess={handleEditSuccess}
        />
      )}
      {showViewModal && selectedAnnouncement && (
        <AnnouncementViewModal
          announcement={selectedAnnouncement}
          onClose={() => { setShowViewModal(false); setSelectedAnnouncement(null); }}
        />
      )}
    </div>
  );
};

// ── View Modal (unchanged from original) ──────────────────────────────────────
const AnnouncementViewModal = ({
  announcement,
  onClose,
}: {
  announcement: Announcement;
  onClose: () => void;
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'assignment':   return <BookOpen    size={20} className="text-primary-400" />;
      case 'reminder':     return <Bell        size={20} className="text-warning-DEFAULT" />;
      case 'urgent':       return <AlertCircle size={20} className="text-error-DEFAULT" />;
      case 'announcement': return <Megaphone   size={20} className="text-secondary-400" />;
      default:             return <Megaphone   size={20} className="text-gray-400" />;
    }
  };

  const getPriorityBorder = (p: string) => {
    switch (p) {
      case 'high':   return 'border-l-error-DEFAULT bg-error-dark/10';
      case 'medium': return 'border-l-warning-DEFAULT bg-warning-dark/10';
      case 'low':    return 'border-l-success-DEFAULT bg-success-dark/10';
      default:       return 'border-l-background-600 bg-background-800';
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
          <div className={`p-4 rounded-lg border-l-4 mb-6 ${getPriorityBorder(announcement.priority)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getTypeIcon(announcement.type)}
                <div>
                  <h3 className="text-lg font-medium text-white">{announcement.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><User size={13} />{announcement.teacherName}</span>
                    <span className="flex items-center gap-1"><BookOpen size={13} />{announcement.subject}</span>
                    <span className="flex items-center gap-1"><Calendar size={13} />{announcement.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  announcement.priority === 'high'   ? 'bg-error-DEFAULT text-white' :
                  announcement.priority === 'medium' ? 'bg-warning-DEFAULT text-white' :
                                                       'bg-success-DEFAULT text-white'
                }`}>
                  {announcement.priority} priority
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  announcement.isActive
                    ? 'bg-success-dark text-success-light'
                    : 'bg-background-700 text-gray-300'
                }`}>
                  {announcement.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap text-sm">{announcement.message}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-background-800 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2 text-sm">Details</h4>
              <div className="space-y-2 text-sm">
                {[
                  ['Type',     announcement.type],
                  ['Priority', announcement.priority],
                  ['Target',   announcement.targetAudience],
                  ['Status',   announcement.isActive ? 'Active' : 'Inactive'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}:</span>
                    <span className="text-white capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-background-800 p-4 rounded-lg">
              <h4 className="text-white font-medium mb-2 text-sm">Timeline</h4>
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
          <div className="flex justify-end pt-4 border-t border-background-800">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors text-sm"
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
