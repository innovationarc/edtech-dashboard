// src/pages/ManageTeacher.tsx - PART 1 OF 4
import { useState, useEffect } from 'react';
import { 
  GraduationCap, Search, Loader, CheckCircle, XCircle, Clock, RefreshCw, 
  Info, Edit, AlertTriangle, X, User as UserIcon, Plus, Phone, Mail,
  Calendar, MapPin, FileText, CreditCard, Users, ArrowLeft, Upload, 
  Image as ImageIcon, Key, History, Eye, EyeOff, ScrollText
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { teacherService, Teacher, SecurityLog } from '../services/teacherService';
import { useDashboard } from '../contexts/DashboardContext';
import { uploadService, UploadProgress } from '../services/uploadService';

const ManageTeacher = () => {
  const { user: currentUser } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [showSecurityLogsModal, setShowSecurityLogsModal] = useState(false);
  const [showAllTeacherLogsModal, setShowAllTeacherLogsModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [teacherToResetPassword, setTeacherToResetPassword] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

  // Get highlightUserId from navigation state
  const highlightUserId = location.state?.highlightUserId;

  // Check if current user has access to Teacher Management (Admin & Manager only)
  const hasAccess = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Redirect unauthorized users to /manage/users automatically
  useEffect(() => {
    if (currentUser && !hasAccess) {
      navigate('/manage/users', { replace: true });
    }
  }, [currentUser, hasAccess, navigate]);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    loadTeachers();
  }, [hasAccess]);

  // Auto-hide success and error messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Remove highlight after 3 seconds
  useEffect(() => {
    if (highlightUserId) {
      const timer = setTimeout(() => {
        // Clear the highlight by replacing the state
        navigate(location.pathname, { replace: true, state: {} });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightUserId, navigate, location.pathname]);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const teachersData = await teacherService.getAllTeachers();
      setAllTeachers(teachersData);
      
    } catch (error: any) {
      console.error('Error loading teachers:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTeachers();
    setRefreshing(false);
    setSuccessMessage('Teacher list refreshed successfully');
  };

  const handleDeleteTeacher = async (teacher: Teacher) => {
    if (!hasAccess) {
      setError('Only authorized administrators and managers can delete accounts.');
      return;
    }
    
    if (teacher.uid === currentUser?.uid) {
      setError('You cannot delete your own account.');
      return;
    }
    
    setTeacherToDelete(teacher);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!teacherToDelete) return;

    try {
      setDeleting(teacherToDelete.uid);
      setError('');
      
      // Pass currentUser so security log is recorded
      await teacherService.deleteTeacher(
        teacherToDelete.uid, 
        teacherToDelete.email, 
        currentUser as any
      );
      
      setAllTeachers(allTeachers.filter(t => t.uid !== teacherToDelete.uid));
      
      setSuccessMessage(`Teacher "${teacherToDelete.surname}" has been permanently deleted.`);
      setShowDeleteConfirm(false);
      setTeacherToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message || 'Failed to delete teacher. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleShowInfo = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowInfoModal(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowEditModal(true);
  };

  const handleResetPassword = (teacher: Teacher) => {
    setTeacherToResetPassword(teacher);
    setShowPasswordResetModal(true);
  };

  const handleShowSecurityLogs = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setShowSecurityLogsModal(true);
  };

  const handleShowAllTeacherLogs = () => {
    setShowAllTeacherLogsModal(true);
  };

  // If not authorized, render nothing (useEffect will redirect)
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={48} className="animate-spin text-primary-500" />
      </div>
    );
  }

  // Filter teachers based on search term and status
  const filteredTeachers = allTeachers.filter(teacher => {
    const matchesSearch = 
      (teacher.userId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (teacher.surname?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (teacher.fullName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (teacher.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || teacher.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get counts for different statuses
  const statusCounts = {
    all: allTeachers.length,
    active: allTeachers.filter(t => t.status === 'active').length,
    inactive: allTeachers.filter(t => t.status === 'inactive').length,
    pending: allTeachers.filter(t => t.status === 'pending').length,
  };

  // Format date to DD/MM/YYYY
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Not available';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: 'active' | 'inactive' | 'pending' }) => {
    const statusConfig = {
      active: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/40', label: 'Active' },
      inactive: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/40', label: 'Inactive' },
      pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/40', label: 'Pending' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded ${config.bg} ${config.color} text-xs font-semibold`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manage/users')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              <GraduationCap size={28} className="text-primary-400" />
              Teacher Management
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage teacher accounts, permissions, and security
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShowAllTeacherLogs}
            className="flex items-center gap-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 px-4 py-2 rounded-lg transition-all duration-200 border border-cyan-600/30"
          >
            <ScrollText size={18} />
            <span className="hidden sm:inline">All Logs</span>
          </button>
          <button
            onClick={() => setShowAddTeacherModal(true)}
            className="flex items-center gap-2 bg-primary-600/90 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-all duration-200 font-semibold"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Add Teacher</span>
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-900/30 border border-green-700/50 rounded-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
          <p className="text-green-300 text-sm">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage('')}
            className="ml-auto text-green-400 hover:text-green-300"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-background-800/50 backdrop-blur-sm p-4 rounded-xl border border-background-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Users size={18} className="text-primary-400" />
            <p className="text-gray-400 text-sm">Total Teachers</p>
          </div>
          <p className="text-2xl font-bold text-white">{statusCounts.all}</p>
        </div>
        <div className="bg-background-800/50 backdrop-blur-sm p-4 rounded-xl border border-background-700/50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-400" />
            <p className="text-gray-400 text-sm">Active</p>
          </div>
          <p className="text-2xl font-bold text-white">{statusCounts.active}</p>
        </div>
        <div className="bg-background-800/50 backdrop-blur-sm p-4 rounded-xl border border-background-700/50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-red-400" />
            <p className="text-gray-400 text-sm">Inactive</p>
          </div>
          <p className="text-2xl font-bold text-white">{statusCounts.inactive}</p>
        </div>
        <div className="bg-background-800/50 backdrop-blur-sm p-4 rounded-xl border border-background-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-yellow-400" />
            <p className="text-gray-400 text-sm">Pending</p>
          </div>
          <p className="text-2xl font-bold text-white">{statusCounts.pending}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-background-800/50 backdrop-blur-sm p-4 rounded-xl border border-background-700/50 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name, ID, or phone..."
              className="w-full bg-background-900/60 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-background-700/50 focus:border-primary-500/50 transition-all duration-200 placeholder:text-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-background-900/60 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-background-700/50 focus:border-primary-500/50 transition-all duration-200"
          >
            <option value="all">All Status ({statusCounts.all})</option>
            <option value="active">Active ({statusCounts.active})</option>
            <option value="inactive">Inactive ({statusCounts.inactive})</option>
            <option value="pending">Pending ({statusCounts.pending})</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-background-900/60 hover:bg-background-900 text-white px-4 py-2 rounded-lg transition-all duration-200 border border-background-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader size={48} className="animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading teachers...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="text-center py-12 bg-background-800/30 backdrop-blur-sm rounded-xl border border-background-700/30">
          <div className="inline-flex p-4 rounded-full bg-background-700/40 mb-4">
            <GraduationCap size={48} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Teachers Found</h3>
          <p className="text-gray-400 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'No teachers match your current filters.' 
              : 'Get started by adding your first teacher.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setShowAddTeacherModal(true)}
              className="inline-flex items-center gap-2 bg-primary-600/90 hover:bg-primary-600 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold"
            >
              <Plus size={20} />
              Add First Teacher
            </button>
          )}
        </div>
      ) : (
// src/pages/ManageTeacher.tsx - PART 2 OF 4
// Continuation from Part 1
        <div className="bg-background-800/50 backdrop-blur-sm rounded-xl border border-background-700/50 overflow-hidden">
          <table className="w-full">
            <thead className="bg-background-900/60 border-b border-background-700/50">
              <tr>
                <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Teacher</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Name</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Status</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">Last Login</th>
                <th className="p-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden 2xl:table-cell">Created</th>
                <th className="p-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-background-700/30">
              {filteredTeachers.map((teacher) => {
                const isHighlighted = teacher.userId === highlightUserId;
                
                return (
                <tr 
                  key={teacher.uid}
                  className={`transition-all duration-300 ${
                    isHighlighted 
                      ? 'bg-primary-900/30 animate-pulse' 
                      : 'hover:bg-background-700/30'
                  }`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {teacher.profilePictureUrl ? (
                        <img 
                          src={teacher.profilePictureUrl} 
                          alt={teacher.surname} 
                          className="h-10 w-10 rounded-lg object-cover border border-background-700/50"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">{teacher.surname?.charAt(0) || 'T'}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-white font-semibold text-sm">{teacher.userId || 'N/A'}</p>
                        <p className="text-gray-400 text-xs">{teacher.phoneNumber || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-medium text-sm hidden sm:table-cell">{teacher.surname || 'N/A'}</td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      teacher.status === 'active' 
                        ? 'bg-green-800/60 text-green-300' 
                        : teacher.status === 'pending'
                        ? 'bg-yellow-800/60 text-yellow-300'
                        : 'bg-red-800/60 text-red-300'
                    }`}>
                      {teacher.status === 'active' 
                        ? <CheckCircle size={11} /> 
                        : teacher.status === 'pending'
                        ? <Clock size={11} />
                        : <XCircle size={11} />
                      }
                      <span className="capitalize">{teacher.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm hidden xl:table-cell">
                    {teacher.lastLogin ? formatDate(teacher.lastLogin) : 'Never'}
                  </td>
                  <td className="p-4 text-gray-400 text-sm hidden 2xl:table-cell">{formatDate(teacher.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        onClick={() => handleShowInfo(teacher)}
                        className="p-2 bg-blue-700/60 hover:bg-blue-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="View teacher info"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        onClick={() => handleEdit(teacher)}
                        className="p-2 bg-green-700/60 hover:bg-green-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="Edit teacher"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleResetPassword(teacher)}
                        className="p-2 bg-purple-700/60 hover:bg-purple-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={teacher.uid === currentUser?.uid}
                        title={teacher.uid === currentUser?.uid ? "Cannot reset your own password" : "Reset password"}
                      >
                        <Key size={14} />
                      </button>
                      <button
                        onClick={() => handleShowSecurityLogs(teacher)}
                        className="p-2 bg-cyan-700/60 hover:bg-cyan-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="View security logs"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(teacher)}
                        className="p-2 bg-red-700/60 hover:bg-red-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={teacher.uid === currentUser?.uid || deleting === teacher.uid}
                        title={teacher.uid === currentUser?.uid ? "Cannot delete your own account" : "Delete teacher"}
                      >
                        {deleting === teacher.uid ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        
        
        {filteredTeachers.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-flex p-5 rounded-full bg-background-700/40 mb-5">
              <GraduationCap size={48} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Teachers Found</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'No teachers match your current filters.' 
                : 'No teacher accounts have been created yet.'
              }
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="mt-5 px-5 py-2.5 bg-primary-600/90 hover:bg-primary-600 text-white rounded-lg transition-all duration-200 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
        
        {/* Summary Footer */}
        {filteredTeachers.length > 0 && (
          <div className="bg-background-900/30 px-5 py-3.5 border-t border-background-700/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span>Showing</span>
              <span className="px-2.5 py-1 bg-primary-900/30 text-primary-300 rounded-md font-semibold">
                {filteredTeachers.length}
              </span>
              <span>of</span>
              <span className="px-2.5 py-1 bg-background-700/50 text-white rounded-md font-semibold">
                {allTeachers.length}
              </span>
              <span>teachers</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={13} />
              <span>Updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && teacherToDelete && (
        <DeleteConfirmModal
          teacher={teacherToDelete}
          deleting={deleting}
          onClose={() => {
            setShowDeleteConfirm(false);
            setTeacherToDelete(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
      
      {/* Info Modal */}
      {showInfoModal && selectedTeacher && (
        <TeacherInfoModal
          teacher={selectedTeacher}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedTeacher(null);
          }}
          formatDate={formatDate}
        />
      )}
      
      {/* Edit Modal */}
      {showEditModal && selectedTeacher && (
        <EditTeacherModal
          teacher={selectedTeacher}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTeacher(null);
          }}
          onSave={async (updates) => {
            try {
              // Pass currentUser so security log is recorded
              await teacherService.updateTeacher(selectedTeacher.uid, updates, currentUser as any);
              setAllTeachers(allTeachers.map(t => 
                t.uid === selectedTeacher.uid ? { ...t, ...updates } : t
              ));
              setSuccessMessage(`Teacher "${selectedTeacher.surname}" updated successfully`);
              setShowEditModal(false);
              setSelectedTeacher(null);
            } catch (error: any) {
              setError(error.message);
            }
          }}
        />
      )}

      {/* Add Teacher Modal */}
      {showAddTeacherModal && (
        <AddTeacherModal
          onClose={() => setShowAddTeacherModal(false)}
          onSuccess={(newTeacher) => {
            setAllTeachers([newTeacher, ...allTeachers]);
            setShowAddTeacherModal(false);
            setSuccessMessage(`Teacher account created successfully! User ID: ${newTeacher.userId}`);
          }}
          currentUser={currentUser as any}
        />
      )}

      {/* Password Reset Modal */}
      {showPasswordResetModal && teacherToResetPassword && currentUser && (
        <PasswordResetModal
          teacher={teacherToResetPassword}
          currentUser={currentUser as any}
          onClose={() => {
            setShowPasswordResetModal(false);
            setTeacherToResetPassword(null);
          }}
          onSuccess={(message) => {
            setShowPasswordResetModal(false);
            setTeacherToResetPassword(null);
            setSuccessMessage(message);
          }}
        />
      )}

      {/* Security Logs Modal */}
      {showSecurityLogsModal && selectedTeacher && (
        <SecurityLogsModal
          teacher={selectedTeacher}
          onClose={() => {
            setShowSecurityLogsModal(false);
            setSelectedTeacher(null);
          }}
        />
      )}

      {/* All Teacher Logs Modal */}
      {showAllTeacherLogsModal && (
        <AllTeacherLogsModal
          onClose={() => setShowAllTeacherLogsModal(false)}
        />
      )}
    </div>
  );
};

// Delete Confirmation Modal Component
interface DeleteConfirmModalProps {
  teacher: Teacher;
  deleting: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal = ({ teacher, deleting, onClose, onConfirm }: DeleteConfirmModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-md rounded-2xl overflow-hidden border border-background-700/50">
      <div className="p-5 border-b border-background-700/50 bg-background-900/50">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-red-900/40 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Confirm Deletion</h3>
            <p className="text-gray-400 text-sm">This action cannot be undone</p>
          </div>
        </div>
      </div>
      
      <div className="p-5 space-y-4">
        <p className="text-gray-300">
          Are you sure you want to permanently delete <strong className="text-white">{teacher.surname}</strong> (ID: {teacher.userId})?
        </p>
        
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
          <p className="text-red-300 text-sm font-semibold mb-2">This will delete:</p>
          <ul className="text-red-300 text-sm space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Teacher account and authentication</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>All personal information and data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Profile picture and documents</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span><strong>Cannot be undone</strong></span>
            </li>
          </ul>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={deleting !== null}
            className="flex-1 px-5 py-2.5 bg-background-700/60 hover:bg-background-600/60 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting !== null}
            className="flex-1 px-5 py-2.5 bg-red-700/80 hover:bg-red-600/80 text-white rounded-lg transition-all duration-200 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <X size={16} />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Teacher Info Modal Component
interface TeacherInfoModalProps {
  teacher: Teacher;
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const TeacherInfoModal = ({ teacher, onClose, formatDate }: TeacherInfoModalProps) => {
  const infoFields = [
    { label: 'User ID', value: teacher.userId || 'N/A' },
    { label: 'Surname', value: teacher.surname || 'N/A' },
    { label: 'Full Name', value: teacher.fullName || 'N/A' },
    { label: 'Email', value: teacher.email || 'N/A' },
    { label: 'Phone Number', value: teacher.phoneNumber || 'N/A' },
    { label: 'Date of Birth', value: teacher.dob || 'N/A' },
    { label: 'Gender', value: teacher.gender || 'N/A' },
    { label: 'Blood Group', value: teacher.bloodGroup || 'N/A' },
    { label: 'Religion', value: teacher.religion || 'N/A' },
    { label: 'Address', value: teacher.address || 'N/A' },
    { label: 'Birth Certificate No.', value: teacher.birthCertificateNumber || 'N/A' },
    { label: 'NID', value: teacher.nid || 'N/A' },
    { label: 'Status', value: teacher.status || 'N/A' },
    { label: 'Created At', value: formatDate(teacher.createdAt) },
    { label: 'Created By', value: teacher.createdBy || 'N/A' },
    { label: 'Last Login', value: formatDate(teacher.lastLogin) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-4xl rounded-2xl overflow-hidden border border-background-700/50">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {teacher.profilePictureUrl ? (
                <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-background-700/50 shadow-lg">
                  <img 
                    src={teacher.profilePictureUrl} 
                    alt={teacher.surname || 'Teacher'} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">{teacher.surname?.charAt(0) || 'T'}</span>
                </div>
              )}
              <div>
                <h3 className="text-white font-bold text-xl mb-1">Teacher Information</h3>
                <p className="text-gray-400">{teacher.surname || 'Unknown Teacher'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {infoFields.map((field, index) => (
              <div key={index} className="bg-background-900/40 rounded-xl p-3.5 border border-background-700/30">
                <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">{field.label}</p>
                <p className="text-white font-medium break-words">{field.value}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-5 border-t border-background-700/50 bg-background-900/30">
          <button
            onClick={onClose}
            className="w-full bg-primary-600/90 hover:bg-primary-600 text-white py-3 rounded-xl transition-all duration-200 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
// src/pages/ManageTeacher.tsx - PART 3 OF 4
// Edit Teacher Modal Component
// Edit Teacher Modal Component
interface EditTeacherModalProps {
  teacher: Teacher;
  onClose: () => void;
  onSave: (updates: Partial<Teacher>) => Promise<void>;
}

const EditTeacherModal = ({ teacher, onClose, onSave }: EditTeacherModalProps) => {
  const [formData, setFormData] = useState({
    surname: teacher.surname || '',
    fullName: teacher.fullName || '',
    email: teacher.email || '',
    phoneNumber: teacher.phoneNumber || '',
    dob: teacher.dob || '',
    gender: teacher.gender || '' as '' | 'male' | 'female' | 'other',
    bloodGroup: teacher.bloodGroup || '' as '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-',
    religion: teacher.religion || '',
    address: teacher.address || '',
    birthCertificateNumber: teacher.birthCertificateNumber || '',
    nid: teacher.nid || '',
    status: teacher.status || 'active' as 'active' | 'inactive' | 'pending',
    profilePictureUrl: teacher.profilePictureUrl || ''
  });

  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    try {
      setUploadingProfilePic(true);
      setUploadProgress(0);

      const { url } = await uploadService.uploadToSupabase(
        file,
        'profile-pictures',
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        },
        'public'
      );

      setFormData({ ...formData, profilePictureUrl: url });
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      alert(`Failed to upload profile picture: ${error.message}`);
    } finally {
      setUploadingProfilePic(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (saving) return;
    
    try {
      setSaving(true);
      await onSave(formData);
    } catch (error) {
      console.error('Error saving teacher:', error);
      // Error is handled in parent component
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-3xl rounded-2xl overflow-hidden border border-background-700/50 my-8">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xl mb-1">Edit Teacher</h3>
              <p className="text-gray-400">{teacher.userId} - {teacher.surname}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Profile Picture</label>
            <div className="flex items-center gap-4">
              {formData.profilePictureUrl ? (
                <div className="h-20 w-20 rounded-xl overflow-hidden border-2 border-background-700/50">
                  <img src={formData.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                  <ImageIcon size={32} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  disabled={uploadingProfilePic}
                  className="hidden"
                  id="profile-picture-edit"
                />
                <label
                  htmlFor="profile-picture-edit"
                  className={`inline-flex items-center gap-2 px-4 py-2 bg-background-700/60 hover:bg-background-600/60 text-white rounded-lg transition-all duration-200 cursor-pointer ${
                    uploadingProfilePic ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploadingProfilePic ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      <span>Uploading... {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>Upload Photo</span>
                    </>
                  )}
                </label>
                {formData.profilePictureUrl && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, profilePictureUrl: '' })}
                    className="ml-2 px-4 py-2 bg-red-700/60 hover:bg-red-600/60 text-white rounded-lg transition-all duration-200"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3.5">
            <p className="text-xs text-blue-300 font-semibold mb-1.5 uppercase">User ID (Non-editable)</p>
            <p className="text-white font-semibold">{teacher.userId}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Surname *</label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter surname"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Phone Number *</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter phone number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Date of Birth</label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-all duration-200"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Blood Group</label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value as any })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-all duration-200"
              >
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Religion</label>
              <input
                type="text"
                value={formData.religion}
                onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter religion"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter address"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Birth Certificate Number</label>
              <input
                type="text"
                value={formData.birthCertificateNumber}
                onChange={(e) => setFormData({ ...formData, birthCertificateNumber: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter birth certificate number"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">NID</label>
              <input
                type="text"
                value={formData.nid}
                onChange={(e) => setFormData({ ...formData, nid: e.target.value })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
                placeholder="Enter NID"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-all duration-200"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 bg-background-700/60 hover:bg-background-600/60 text-white rounded-lg transition-all duration-200 font-medium"
            >
              Cancel
            </button>
          <button
              type="submit"
              disabled={uploadingProfilePic || saving}
              className="flex-1 px-5 py-2.5 bg-green-700/80 hover:bg-green-600/80 text-white rounded-lg transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface AddTeacherModalProps {
  onClose: () => void;
  onSuccess: (teacher: Teacher) => void;
  currentUser: Teacher;
}

const AddTeacherModal = ({ onClose, onSuccess, currentUser }: AddTeacherModalProps) => {
  const [formData, setFormData] = useState({
    surname: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    dob: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    bloodGroup: '' as '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-',
    religion: '',
    address: '',
    birthCertificateNumber: '',
    nid: '',
    profilePictureUrl: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState('');
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    try {
      setUploadingProfilePic(true);
      setUploadProgress(0);
      setError('');

      const { url } = await uploadService.uploadToSupabase(
        file,
        'profile-pictures',
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage);
        },
        'public'
      );

      setFormData({ ...formData, profilePictureUrl: url });
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      setError(`Failed to upload profile picture: ${error.message}`);
    } finally {
      setUploadingProfilePic(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.surname || !formData.phoneNumber) {
        setError('Surname and Phone Number are required');
        setLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      // No email or phone uniqueness check — directly create teacher
      // createTeacher signature: (phoneNumber, email, password, surname, fullName, dob, phone, bloodGroup, gender, religion, address, birthCertificateNumber, nid, createdByTeacherId, createdByTeacherUid, createdByTeacherSurname, profilePictureUrl?)
      const newTeacher = await teacherService.createTeacher(
        formData.phoneNumber,          // phoneNumber (for SMS)
        formData.email,                // email
        formData.password,             // password
        formData.surname,              // surname
        formData.fullName,             // fullName
        formData.dob,                  // dob
        formData.phoneNumber,          // phone (stored in profile)
        formData.bloodGroup,           // bloodGroup
        formData.gender,               // gender
        formData.religion,             // religion
        formData.address,              // address
        formData.birthCertificateNumber, // birthCertificateNumber
        formData.nid,                  // nid
        currentUser.userId || '',    // createdByTeacherId
        currentUser.uid,              // createdByTeacherUid
        currentUser.surname || '',    // createdByTeacherSurname
        formData.profilePictureUrl || undefined // profilePictureUrl
      );

      setGeneratedUserId(newTeacher.userId || '');
      setShowSuccessModal(true);
      
      setTimeout(() => {
        onSuccess(newTeacher);
      }, 3000);

    } catch (error: any) {
      console.error('Create teacher error:', error);
      setError(error.message || 'Failed to create teacher account');
    } finally {
      setLoading(false);
    }
  };

  if (showSuccessModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-500/10 rounded-3xl"></div>
          
          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={64} className="text-white" />
                </div>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 mb-6">
              Teacher Created!
            </h2>
            
            <div className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-gray-700/50 shadow-inner">
              <p className="text-gray-300 text-sm mb-3 font-medium">Teacher User ID</p>
              <div className="bg-gradient-to-r from-gray-600 via-gray-700 to-gray-600 rounded-xl p-5 shadow-2xl">
                <p className="text-3xl font-mono font-bold text-white tracking-wider drop-shadow-lg">{generatedUserId}</p>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-2">
                <Shield size={14} />
                Save this ID for login
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-200 px-6 py-4 rounded-xl border border-green-700/50 backdrop-blur-sm mb-6">
              <p className="text-sm font-semibold mb-2 flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                Account Created & SMS Sent!
              </p>
              <p className="text-sm">The teacher has been notified via SMS with login instructions.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-3xl p-6 my-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-500/5 to-gray-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          disabled={loading}
        >
          <X size={24} />
        </button>

        <div className="relative">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400 mb-2">
            Add New Teacher
          </h2>
          <p className="text-gray-400 text-sm mb-6">Create a new teacheristrator account</p>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
              <p className="text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Profile Picture</label>
              <div className="flex items-center gap-4">
                {formData.profilePictureUrl ? (
                  <div className="h-20 w-20 rounded-xl overflow-hidden border-2 border-background-700/50">
                    <img src={formData.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <ImageIcon size={32} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    disabled={uploadingProfilePic || loading}
                    className="hidden"
                    id="profile-picture-upload"
                  />
                  <label
                    htmlFor="profile-picture-upload"
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-background-700/60 hover:bg-background-600/60 text-white rounded-lg transition-all duration-200 cursor-pointer ${
                      uploadingProfilePic || loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {uploadingProfilePic ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        <span>Uploading... {uploadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Upload Photo</span>
                      </>
                    )}
                  </label>
                  {formData.profilePictureUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, profilePictureUrl: '' })}
                      disabled={loading}
                      className="ml-2 px-4 py-2 bg-red-700/60 hover:bg-red-600/60 text-white rounded-lg transition-all duration-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Surname *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter surname"
                    disabled={loading}
                    required
                  />
                  <UserIcon size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter full name"
                    disabled={loading}
                  />
                  <Users size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number *</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter phone number"
                    disabled={loading}
                    required
                  />
                  <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter email"
                    disabled={loading}
                  />
                  <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              {/* Password with Eye icon */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password with Eye icon */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Re-enter password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    disabled={loading}
                  />
                  <Calendar size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 cursor-pointer"
                  disabled={loading}
               >
// src/pages/ManageTeacher.tsx - PART 3 OF 3
// Continue from Part 2
                  <option value="">Select gender</option>

// END OF PART 2
// CONTINUE WITH PART 3
// src/pages/ManageTeacher.tsx - PART 3 of 3
// PASTE THIS IMMEDIATELY AFTER PART 2
// src/pages/ManageTeacher.tsx - PART 4 OF 4
// Continuing Add Teacher Modal + Password Reset + Security Logs

                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Blood Group</label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value as any }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 cursor-pointer"
                  disabled={loading}
                >
                  <option value="">Select blood group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Religion</label>
                <input
                  type="text"
                  value={formData.religion}
                  onChange={(e) => setFormData(prev => ({ ...prev, religion: e.target.value }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                  placeholder="Enter religion"
                  disabled={loading}
                />
              </div>

              <div className="md:col-span-2 group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter address"
                    disabled={loading}
                  />
                  <MapPin size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Birth Certificate Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.birthCertificateNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, birthCertificateNumber: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter birth certificate number"
                    disabled={loading}
                  />
                  <FileText size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">NID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.nid}
                    onChange={(e) => setFormData(prev => ({ ...prev, nid: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                    placeholder="Enter NID"
                    disabled={loading}
                  />
                  <CreditCard size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || uploadingProfilePic}
                className="flex-1 px-5 py-3 bg-background-700/60 hover:bg-background-600/60 text-white rounded-xl transition-all duration-200 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploadingProfilePic}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-200 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    <span>Create Teacher</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Password Reset Modal Component
interface PasswordResetModalProps {
  teacher: Teacher;
  currentUser: Teacher;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const PasswordResetModal = ({ teacher, currentUser, onClose, onSuccess, onError }: PasswordResetModalProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      onError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      onError('Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      // resetTeacherPassword(targetTeacherUid, newPassword, resetByTeacher: Teacher, reason?)
      await teacherService.resetTeacherPassword(teacher.uid, newPassword, reason, currentUser);
      onSuccess();
    } catch (error: any) {
      onError(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-md rounded-2xl overflow-hidden border border-purple-700/30">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <Key size={20} className="text-purple-400" />
                Reset Password
              </h3>
              <p className="text-gray-400 text-sm">{teacher.surname} ({teacher.userId})</p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-4">
            <p className="text-purple-300 text-sm font-medium flex items-center gap-2 mb-2">
              <AlertTriangle size={14} />
              Security Notice
            </p>
            <p className="text-purple-200 text-sm">
              This action will be logged in security logs with your teacher ID and timestamp for auditing purposes.
            </p>
          </div>

          {/* New Password with Eye icon */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 pl-4 pr-11 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200"
                placeholder="Enter new password"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password with Eye icon */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 pl-4 pr-11 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200"
                placeholder="Re-enter password"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-2.5 text-gray-400 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Reason (Optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 resize-none"
              placeholder="Enter reason for password reset..."
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-5 py-2.5 bg-background-700/60 hover:bg-background-600/60 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-5 py-2.5 bg-purple-700/80 hover:bg-purple-600/80 text-white rounded-lg transition-all duration-200 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <Key size={16} />
                  <span>Reset Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Security Logs Modal Component — shows ALL action types
interface SecurityLogsModalProps {
  teacher: Teacher;
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const SecurityLogsModal = ({ teacher, onClose, formatDate }: SecurityLogsModalProps) => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        // getSecurityLogs returns ALL log types for this teacher (password_reset, teacher_created, teacher_edited, teacher_deleted)
        const logsData = await teacherService.getSecurityLogs(teacher.uid);
        setLogs(logsData);
      } catch (error) {
        console.error('Error loading security logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [teacher.uid]);

  // Helper to get icon, label, and colors per action type
  const getActionConfig = (action: SecurityLog['action']) => {
    switch (action) {
      case 'teacher_created':
        return {
          icon: Plus,
          label: 'Teacher Created',
          bgColor: 'bg-green-700/60',
          textColor: 'text-green-300',
          badgeBg: 'bg-green-900/40',
          badgeText: 'text-green-300',
          borderColor: 'border-green-700/30',
        };
      case 'teacher_edited':
        return {
          icon: Edit,
          label: 'Details Edited',
          bgColor: 'bg-blue-700/60',
          textColor: 'text-blue-300',
          badgeBg: 'bg-blue-900/40',
          badgeText: 'text-blue-300',
          borderColor: 'border-blue-700/30',
        };
      case 'password_reset':
        return {
          icon: Key,
          label: 'Password Reset',
          bgColor: 'bg-cyan-700/60',
          textColor: 'text-cyan-300',
          badgeBg: 'bg-cyan-900/40',
          badgeText: 'text-cyan-300',
          borderColor: 'border-cyan-700/30',
        };
      case 'teacher_deleted':
        return {
          icon: X,
          label: 'Teacher Deleted',
          bgColor: 'bg-red-700/60',
          textColor: 'text-red-300',
          badgeBg: 'bg-red-900/40',
          badgeText: 'text-red-300',
          borderColor: 'border-red-700/30',
        };
      default:
        return {
          icon: GraduationCap,
          label: 'Unknown Action',
          bgColor: 'bg-gray-700/60',
          textColor: 'text-gray-300',
          badgeBg: 'bg-gray-900/40',
          badgeText: 'text-gray-300',
          borderColor: 'border-gray-700/30',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-3xl rounded-2xl overflow-hidden border border-background-700/50">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <History size={20} className="text-cyan-400" />
                Security Logs
              </h3>
              <p className="text-gray-400 text-sm">{teacher.surname} ({teacher.userId})</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <Loader size={40} className="animate-spin text-primary-500 mx-auto mb-4" />
              <p className="text-gray-400">Loading security logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 rounded-full bg-background-700/40 mb-4">
                <History size={40} className="text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Security Logs</h3>
              <p className="text-gray-400">No security actions have been recorded for this teacher.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log, index) => {
                const config = getActionConfig(log.action);
                const ActionIcon = config.icon;

                return (
                  <div key={log.id || index} className={`bg-background-900/40 rounded-xl p-4 border ${config.borderColor}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                          <ActionIcon size={20} className={config.textColor} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold">{config.label}</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config.badgeBg} ${config.badgeText}`}>
                              {log.action}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">{formatDate(log.timestamp)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm ml-13">
                      {/* Who performed the action */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Performed By:</span>
                        <span className="text-white font-medium">
                          {log.performedBySurname || 'N/A'} ({log.performedByUserId || 'N/A'})
                        </span>
                      </div>

                      {/* Details if available */}
                      {log.details && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Details:</span>
                          <span className="text-white font-medium text-right max-w-[60%] truncate">{log.details}</span>
                        </div>
                      )}

                      {/* Reason (mainly for password resets) */}
                      {log.reason && (
                        <div className="mt-2 pt-2 border-t border-background-700/30">
                          <p className="text-gray-400 text-xs mb-1">Reason:</p>
                          <p className="text-white text-sm">{log.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-background-700/50 bg-background-900/30">
          <button
            onClick={onClose}
            className="w-full bg-primary-600/90 hover:bg-primary-600 text-white py-3 rounded-xl transition-all duration-200 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// All Teacher Logs Modal Component
interface AllTeacherLogsModalProps {
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const AllTeacherLogsModal = ({ onClose, formatDate }: AllTeacherLogsModalProps) => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | SecurityLog['action']>('all');

  useEffect(() => {
    loadAllLogs();
  }, []);

  const loadAllLogs = async () => {
    try {
      setLoading(true);
      const allLogs = await teacherService.getAllSecurityLogs();
      setLogs(allLogs);
    } catch (error) {
      console.error('Error loading security logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.targetTeacherSurname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetTeacherUserId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performedBySurname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performedByUserId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const getActionConfig = (action: SecurityLog['action']) => {
    switch (action) {
      case 'login':
        return {
          icon: CheckCircle,
          label: 'Login',
          bgColor: 'bg-green-700/60',
          textColor: 'text-green-300',
          badgeBg: 'bg-green-900/40',
          badgeText: 'text-green-300',
          borderColor: 'border-green-700/30',
        };
      case 'logout':
        return {
          icon: XCircle,
          label: 'Logout',
          bgColor: 'bg-gray-700/60',
          textColor: 'text-gray-300',
          badgeBg: 'bg-gray-900/40',
          badgeText: 'text-gray-300',
          borderColor: 'border-gray-700/30',
        };
      case 'teacher_created':
        return {
          icon: Plus,
          label: 'Teacher Created',
          bgColor: 'bg-blue-700/60',
          textColor: 'text-blue-300',
          badgeBg: 'bg-blue-900/40',
          badgeText: 'text-blue-300',
          borderColor: 'border-blue-700/30',
        };
      case 'teacher_edited':
        return {
          icon: Edit,
          label: 'Teacher Edited',
          bgColor: 'bg-purple-700/60',
          textColor: 'text-purple-300',
          badgeBg: 'bg-purple-900/40',
          badgeText: 'text-purple-300',
          borderColor: 'border-purple-700/30',
        };
      case 'password_reset':
        return {
          icon: Key,
          label: 'Password Reset',
          bgColor: 'bg-cyan-700/60',
          textColor: 'text-cyan-300',
          badgeBg: 'bg-cyan-900/40',
          badgeText: 'text-cyan-300',
          borderColor: 'border-cyan-700/30',
        };
      case 'teacher_deleted':
        return {
          icon: X,
          label: 'Teacher Deleted',
          bgColor: 'bg-red-700/60',
          textColor: 'text-red-300',
          badgeBg: 'bg-red-900/40',
          badgeText: 'text-red-300',
          borderColor: 'border-red-700/30',
        };
      default:
        return {
          icon: GraduationCap,
          label: 'Unknown Action',
          bgColor: 'bg-gray-700/60',
          textColor: 'text-gray-300',
          badgeBg: 'bg-gray-900/40',
          badgeText: 'text-gray-300',
          borderColor: 'border-gray-700/30',
        };
    }
  };

  const actionCounts = {
    all: logs.length,
    login: logs.filter(l => l.action === 'login').length,
    logout: logs.filter(l => l.action === 'logout').length,
    teacher_created: logs.filter(l => l.action === 'teacher_created').length,
    teacher_edited: logs.filter(l => l.action === 'teacher_edited').length,
    password_reset: logs.filter(l => l.action === 'password_reset').length,
    teacher_deleted: logs.filter(l => l.action === 'teacher_deleted').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden border border-background-700/50 flex flex-col">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <ScrollText size={20} className="text-cyan-400" />
                All Teacher Security Logs
              </h3>
              <p className="text-gray-400 text-sm">Complete security audit trail for all teacheristrators</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={24} />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by teacher name or ID..."
                className="w-full bg-background-900/60 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-background-700/50 focus:border-primary-500/50 transition-all duration-200 placeholder:text-gray-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as any)}
              className="bg-background-900/60 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-background-700/50 focus:border-primary-500/50 transition-all duration-200 text-sm"
            >
              <option value="all">All Actions ({actionCounts.all})</option>
              <option value="teacher_created">Created ({actionCounts.teacher_created})</option>
              <option value="teacher_edited">Edited ({actionCounts.teacher_edited})</option>
              <option value="password_reset">Password Reset ({actionCounts.password_reset})</option>
              <option value="teacher_deleted">Deleted ({actionCounts.teacher_deleted})</option>
            </select>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12">
              <Loader size={40} className="animate-spin text-primary-500 mx-auto mb-4" />
              <p className="text-gray-400">Loading all security logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 rounded-full bg-background-700/40 mb-4">
                <History size={40} className="text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Security Logs Found</h3>
              <p className="text-gray-400">
                {searchTerm || actionFilter !== 'all' 
                  ? 'No logs match your current filters.' 
                  : 'No security actions have been recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log, index) => {
                const config = getActionConfig(log.action);
                const ActionIcon = config.icon;

                return (
                  <div key={log.id || index} className={`bg-background-900/40 rounded-xl p-4 border ${config.borderColor}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <ActionIcon size={20} className={config.textColor} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold">{config.label}</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config.badgeBg} ${config.badgeText}`}>
                              {log.action}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400">{formatDate(log.timestamp)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm ml-0 sm:ml-13">
                      {/* Target Teacher */}
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs mb-1">Target Teacher:</span>
                        <span className="text-white font-medium">
                          {log.targetTeacherSurname || 'N/A'} ({log.targetTeacherUserId || 'N/A'})
                        </span>
                      </div>

                      {/* Performed By */}
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs mb-1">Performed By:</span>
                        <span className="text-white font-medium">
                          {log.performedBySurname || 'N/A'} ({log.performedByUserId || 'N/A'})
                        </span>
                      </div>

                      {/* Details if available */}
                      {log.details && (
                        <div className="flex flex-col sm:col-span-2">
                          <span className="text-gray-400 text-xs mb-1">Details:</span>
                          <span className="text-white">{log.details}</span>
                        </div>
                      )}

                      {/* Reason (mainly for password resets) */}
                      {log.reason && (
                        <div className="flex flex-col sm:col-span-2 pt-2 border-t border-background-700/30">
                          <span className="text-gray-400 text-xs mb-1">Reason:</span>
                          <span className="text-white">{log.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-background-700/50 bg-background-900/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-400">
              Showing <span className="text-white font-semibold">{filteredLogs.length}</span> of <span className="text-white font-semibold">{logs.length}</span> logs
            </div>
            <button
              onClick={onClose}
              className="bg-primary-600/90 hover:bg-primary-600 text-white px-6 py-2 rounded-xl transition-all duration-200 font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


export default ManageTeacher;

// THIS IS THE COMPLETE FILE
