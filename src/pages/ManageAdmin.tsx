// src/pages/ManageAdmin.tsx - PART 1 OF 3
import { useState, useEffect } from 'react';
import { 
  Shield, Search, Loader, CheckCircle, XCircle, Clock, RefreshCw, 
  Info, Edit, AlertTriangle, X, User as UserIcon, Plus, Phone, Mail,
  Calendar, MapPin, FileText, CreditCard, Users, ArrowLeft, Upload, 
  Image as ImageIcon, Key, History, Eye, EyeOff, ScrollText
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { adminService, Admin, SecurityLog } from '../services/adminService';
import { useDashboard } from '../contexts/DashboardContext';
import { uploadService, UploadProgress } from '../services/uploadService';

const ManageAdmin = () => {
  const { user: currentUser } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const [allAdmins, setAllAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [showSecurityLogsModal, setShowSecurityLogsModal] = useState(false);
  const [showAllAdminLogsModal, setShowAllAdminLogsModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [adminToResetPassword, setAdminToResetPassword] = useState<Admin | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

  // Get highlightUserId from navigation state
  const highlightUserId = location.state?.highlightUserId;

  // Check if current user has access to Admin Management
  const hasAccess = currentUser?.role === 'admin';

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
    loadAdmins();
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

  const loadAdmins = async () => {
    try {
      setLoading(true);
      setError('');
      
      const adminsData = await adminService.getAllAdmins();
      setAllAdmins(adminsData);
      
    } catch (error: any) {
      console.error('Error loading admins:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAdmins();
    setRefreshing(false);
    setSuccessMessage('Admin list refreshed successfully');
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (!hasAccess) {
      setError('Only authorized administrators can delete accounts.');
      return;
    }
    
    if (admin.uid === currentUser?.uid) {
      setError('You cannot delete your own account.');
      return;
    }
    
    setAdminToDelete(admin);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!adminToDelete) return;

    try {
      setDeleting(adminToDelete.uid);
      setError('');
      
      // Pass currentUser as deletedByAdmin so security log is recorded
      await adminService.deleteAdmin(
        adminToDelete.uid, 
        adminToDelete.email, 
        currentUser as Admin
      );
      
      setAllAdmins(allAdmins.filter(a => a.uid !== adminToDelete.uid));
      
      setSuccessMessage(`Admin "${adminToDelete.surname}" has been permanently deleted.`);
      setShowDeleteConfirm(false);
      setAdminToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message || 'Failed to delete admin. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleShowInfo = (admin: Admin) => {
    setSelectedAdmin(admin);
    setShowInfoModal(true);
  };

  const handleEdit = (admin: Admin) => {
    setSelectedAdmin(admin);
    setShowEditModal(true);
  };

  const handleResetPassword = (admin: Admin) => {
    setAdminToResetPassword(admin);
    setShowPasswordResetModal(true);
  };

  const handleShowSecurityLogs = (admin: Admin) => {
    setSelectedAdmin(admin);
    setShowSecurityLogsModal(true);
  };

  const handleShowAllAdminLogs = () => {
    setShowAllAdminLogsModal(true);
  };

  // If not authorized, render nothing (useEffect will redirect)
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={48} className="animate-spin text-primary-500" />
      </div>
    );
  }

  // Filter admins based on search term and status
  const filteredAdmins = allAdmins.filter(admin => {
    const matchesSearch = 
      (admin.userId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.surname?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.fullName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (admin.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || admin.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get counts for different statuses
  const statusCounts = {
    all: allAdmins.length,
    active: allAdmins.filter(a => a.status === 'active').length,
    inactive: allAdmins.filter(a => a.status === 'inactive').length,
    pending: allAdmins.filter(a => a.status === 'pending').length,
  };

  // Format date to DD/MM/YYYY
  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading admins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section */}
      <div className="bg-background-800/50 backdrop-blur-sm rounded-2xl p-6 border border-background-700/50">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <button
              onClick={() => navigate('/users')}
              className="flex items-center justify-center p-2.5 bg-background-700/60 hover:bg-background-600/60 text-white rounded-xl transition-all duration-200"
              title="Back to User Management"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2 flex items-center gap-3">
                <Shield className="text-gray-400" size={36} />
                Admin Management
              </h1>
              <p className="text-gray-400">
                Manage administrator accounts • <span className="text-primary-400 font-semibold">{allAdmins.length}</span> total admins
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-gray-700/60 hover:bg-gray-600/60 text-white px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 font-medium flex-1 lg:flex-initial justify-center"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleShowAllAdminLogs}
              className="flex items-center gap-2 bg-cyan-700/60 hover:bg-cyan-600/60 text-white px-5 py-2.5 rounded-xl transition-all duration-200 font-medium flex-1 lg:flex-initial justify-center"
            >
              <ScrollText size={16} />
              <span>Admin Logs</span>
            </button>

            <button
              onClick={() => setShowAddAdminModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white px-5 py-2.5 rounded-xl transition-all duration-200 font-medium shadow-lg flex-1 lg:flex-initial justify-center"
            >
              <Plus size={16} />
              <span>Add Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/30 border border-green-700/40 text-green-300 px-5 py-3.5 rounded-xl backdrop-blur-sm flex items-center gap-3">
          <CheckCircle size={18} className="flex-shrink-0" />
          <p className="flex-1 font-medium">{successMessage}</p>
          <button onClick={() => setSuccessMessage('')} className="text-green-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 text-red-300 px-5 py-3.5 rounded-xl backdrop-blur-sm flex items-center gap-3">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <p className="flex-1 font-medium">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Admin List Card */}
      <div className="bg-background-800/40 backdrop-blur-sm rounded-xl border border-background-700/50 overflow-hidden">
        <div className="bg-background-800/60 p-5 border-b border-background-700/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
            {/* Status Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All', count: statusCounts.all, bg: 'bg-gray-700/60', hoverBg: 'hover:bg-gray-600/60', activeBg: 'bg-gray-600', icon: Shield },
                { key: 'active', label: 'Active', count: statusCounts.active, bg: 'bg-green-700/60', hoverBg: 'hover:bg-green-600/60', activeBg: 'bg-green-600', icon: CheckCircle },
                { key: 'inactive', label: 'Inactive', count: statusCounts.inactive, bg: 'bg-red-700/60', hoverBg: 'hover:bg-red-600/60', activeBg: 'bg-red-600', icon: XCircle },
                { key: 'pending', label: 'Pending', count: statusCounts.pending, bg: 'bg-yellow-700/60', hoverBg: 'hover:bg-yellow-600/60', activeBg: 'bg-yellow-600', icon: Clock }
              ].map((status) => {
                const StatusIcon = status.icon;
                return (
                  <button
                    key={status.key}
                    onClick={() => setStatusFilter(status.key as any)}
                    className={`px-4 py-2.5 rounded-lg transition-all duration-200 font-medium flex items-center gap-2 ${
                      statusFilter === status.key
                        ? `${status.activeBg} text-white`
                        : `${status.bg} ${status.hoverBg} text-gray-300 hover:text-white`
                    }`}
                  >
                    <StatusIcon size={14} />
                    <span>{status.label}</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                      statusFilter === status.key ? 'bg-white/20' : 'bg-gray-900/40'
                    }`}>
                      {status.count}
                    </span>
                  </button>
                );
              })}
            </div>
            
            {/* Search */}
            <div className="relative flex-1 lg:flex-none lg:w-80">
              <input
                type="text"
                placeholder="Search by ID, surname, name, or phone..."
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-background-700/50 focus:border-primary-500/50 transition-all duration-200 placeholder:text-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-background-700/50 bg-background-900/30">
                <th className="p-4 text-left">
                  <div className="flex items-center gap-2 text-xs uppercase text-gray-400 font-bold tracking-wider">
                    <Shield size={12} />
                    <span>Admin Details</span>
                  </div>
                </th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden sm:table-cell">Surname</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden lg:table-cell">Status</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden xl:table-cell">Last Login</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden 2xl:table-cell">Joining Date</th>
                <th className="p-4 text-right text-xs uppercase text-gray-400 font-bold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin, index) => (
                 
                  key={admin.uid} 
                const isHighlighted = admin.uid === highlightUserId;
                
                return (
                  <tr 
                    key={admin.uid} 
                    className={`border-b border-background-800/30 last:border-0 hover:bg-background-700/20 transition-all duration-200 group ${
                      isHighlighted ? 'bg-yellow-500/20 ring-2 ring-yellow-500 animate-pulse' : ''
                    }`}
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {admin.profilePictureUrl ? (
                          <div className="h-11 w-11 rounded-xl overflow-hidden border-2 border-background-700/50 shadow-lg group-hover:scale-110 transition-transform duration-200">
                            <img 
                              src={admin.profilePictureUrl} 
                              alt={admin.surname || 'Admin'} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 shadow-lg group-hover:scale-110 transition-transform duration-200">
                            <span className="text-white font-bold text-base">
                              {admin.surname?.charAt(0) || 'A'}
                            </span>
                          </div>
                        )}
                        {admin.status === 'active' && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background-800"></div>
                        )}
                        {admin.status === 'pending' && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-yellow-500 rounded-full border-2 border-background-800"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white font-semibold truncate text-sm">{admin.userId || 'N/A'}</span>
                          {admin.uid === currentUser?.uid && (
                            <span className="text-xs bg-primary-900/60 text-primary-300 px-1.5 py-0.5 rounded font-medium">You</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 truncate">{admin.fullName || 'N/A'}</p>
                        <div className="flex items-center gap-2 mt-1 lg:hidden">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            admin.status === 'active' 
                              ? 'bg-green-800/60 text-green-300' 
                              : admin.status === 'pending'
                              ? 'bg-yellow-800/60 text-yellow-300'
                              : 'bg-red-800/60 text-red-300'
                          }`}>
                            {admin.status === 'active' 
                              ? <CheckCircle size={10} className="inline mr-1" /> 
                              : admin.status === 'pending'
                              ? <Clock size={10} className="inline mr-1" />
                              : <XCircle size={10} className="inline mr-1" />
                            }
                            {admin.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-medium text-sm hidden sm:table-cell">{admin.surname || 'N/A'}</td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      admin.status === 'active' 
                        ? 'bg-green-800/60 text-green-300' 
                        : admin.status === 'pending'
                        ? 'bg-yellow-800/60 text-yellow-300'
                        : 'bg-red-800/60 text-red-300'
                    }`}>
                      {admin.status === 'active' 
                        ? <CheckCircle size={11} /> 
                        : admin.status === 'pending'
                        ? <Clock size={11} />
                        : <XCircle size={11} />
                      }
                      <span className="capitalize">{admin.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm hidden xl:table-cell">
                    {admin.lastLogin ? formatDate(admin.lastLogin) : 'Never'}
                  </td>
                  <td className="p-4 text-gray-400 text-sm hidden 2xl:table-cell">{formatDate(admin.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        onClick={() => handleShowInfo(admin)}
                        className="p-2 bg-blue-700/60 hover:bg-blue-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="View admin info"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        onClick={() => handleEdit(admin)}
                        className="p-2 bg-green-700/60 hover:bg-green-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="Edit admin"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleResetPassword(admin)}
                        className="p-2 bg-purple-700/60 hover:bg-purple-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={admin.uid === currentUser?.uid}
                        title={admin.uid === currentUser?.uid ? "Cannot reset your own password" : "Reset password"}
                      >
                        <Key size={14} />
                      </button>
                      <button
                        onClick={() => handleShowSecurityLogs(admin)}
                        className="p-2 bg-cyan-700/60 hover:bg-cyan-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                        title="View security logs"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteAdmin(admin)}
                        className="p-2 bg-red-700/60 hover:bg-red-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={admin.uid === currentUser?.uid || deleting === admin.uid}
                        title={admin.uid === currentUser?.uid ? "Cannot delete your own account" : "Delete admin"}
                      >
                        {deleting === admin.uid ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Empty State */}
        {filteredAdmins.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-flex p-5 rounded-full bg-background-700/40 mb-5">
              <Shield size={48} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Admins Found</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'No admins match your current filters.' 
                : 'No admin accounts have been created yet.'
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
        {filteredAdmins.length > 0 && (
          <div className="bg-background-900/30 px-5 py-3.5 border-t border-background-700/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span>Showing</span>
              <span className="px-2.5 py-1 bg-primary-900/30 text-primary-300 rounded-md font-semibold">
                {filteredAdmins.length}
              </span>
              <span>of</span>
              <span className="px-2.5 py-1 bg-background-700/50 text-white rounded-md font-semibold">
                {allAdmins.length}
              </span>
              <span>admins</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={13} />
              <span>Updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && adminToDelete && (
        <DeleteConfirmModal
          admin={adminToDelete}
          deleting={deleting}
          onClose={() => {
            setShowDeleteConfirm(false);
            setAdminToDelete(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
      
      {/* Info Modal */}
      {showInfoModal && selectedAdmin && (
        <AdminInfoModal
          admin={selectedAdmin}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedAdmin(null);
          }}
          formatDate={formatDate}
        />
      )}
      
      {/* Edit Modal */}
      {showEditModal && selectedAdmin && (
        <EditAdminModal
          admin={selectedAdmin}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAdmin(null);
          }}
          onSave={async (updates) => {
            try {
              // Pass currentUser as updatedByAdmin so security log is recorded
              await adminService.updateAdmin(selectedAdmin.uid, updates, currentUser as Admin);
              setAllAdmins(allAdmins.map(a => 
                a.uid === selectedAdmin.uid ? { ...a, ...updates } : a
              ));
              setSuccessMessage(`Admin "${selectedAdmin.surname}" updated successfully`);
              setShowEditModal(false);
              setSelectedAdmin(null);
            } catch (error: any) {
              setError(error.message);
            }
          }}
        />
      )}

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <AddAdminModal
          onClose={() => setShowAddAdminModal(false)}
          onSuccess={(newAdmin) => {
            setAllAdmins([newAdmin, ...allAdmins]);
            setShowAddAdminModal(false);
            setSuccessMessage(`Admin account created successfully! User ID: ${newAdmin.userId}`);
          }}
          currentAdmin={currentUser as Admin}
        />
      )}

      {/* Password Reset Modal */}
      {showPasswordResetModal && adminToResetPassword && currentUser && (
        <PasswordResetModal
          admin={adminToResetPassword}
          currentAdmin={currentUser as Admin}
          onClose={() => {
            setShowPasswordResetModal(false);
            setAdminToResetPassword(null);
          }}
          onSuccess={() => {
            setSuccessMessage(`Password reset successfully for ${adminToResetPassword.surname}`);
            setShowPasswordResetModal(false);
            setAdminToResetPassword(null);
          }}
          onError={(errorMsg) => {
            setError(errorMsg);
          }}
        />
      )}

      {/* Security Logs Modal */}
      {showSecurityLogsModal && selectedAdmin && (
        <SecurityLogsModal
          admin={selectedAdmin}
          onClose={() => {
            setShowSecurityLogsModal(false);
            setSelectedAdmin(null);
          }}
          formatDate={formatDate}
        />
      )}

      {/* All Admin Logs Modal */}
      {showAllAdminLogsModal && (
        <AllAdminLogsModal
          onClose={() => setShowAllAdminLogsModal(false)}
          formatDate={formatDate}
        />
      )}
    </div>
  );
};

// END OF PART 1
// CONTINUE WITH PART 2
// src/pages/ManageAdmin.tsx - PART 2 of 3
// PASTE THIS IMMEDIATELY AFTER PART 1

// Delete Confirmation Modal Component
interface DeleteConfirmModalProps {
  admin: Admin;
  deleting: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal = ({ admin, deleting, onClose, onConfirm }: DeleteConfirmModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-md rounded-2xl overflow-hidden border border-red-700/30">
      <div className="p-7 text-center">
        <div className="inline-flex p-4 rounded-full bg-red-900/30 mb-5">
          <AlertTriangle size={40} className="text-red-500" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">Delete Admin Account</h3>
        <p className="text-gray-300 mb-2">
          Are you sure you want to delete
        </p>
        <p className="text-primary-400 font-bold text-lg mb-4">
          {admin.surname} ({admin.userId})?
        </p>
        
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 mb-6 text-left">
          <p className="text-red-300 text-sm font-medium mb-2 flex items-center gap-2">
            <AlertTriangle size={14} />
            This action will:
          </p>
          <ul className="text-red-300 text-sm space-y-1.5 ml-5">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Permanently delete from Firestore</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Permanently delete from Firebase Auth via delete-user.ts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Delete profile picture from Supabase via delete-profile-picture.ts</span>
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

// Admin Info Modal Component
interface AdminInfoModalProps {
  admin: Admin;
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const AdminInfoModal = ({ admin, onClose, formatDate }: AdminInfoModalProps) => {
  const infoFields = [
    { label: 'User ID', value: admin.userId || 'N/A' },
    { label: 'Surname', value: admin.surname || 'N/A' },
    { label: 'Full Name', value: admin.fullName || 'N/A' },
    { label: 'Email', value: admin.email || 'N/A' },
    { label: 'Phone Number', value: admin.phoneNumber || 'N/A' },
    { label: 'Date of Birth', value: admin.dob || 'N/A' },
    { label: 'Gender', value: admin.gender || 'N/A' },
    { label: 'Blood Group', value: admin.bloodGroup || 'N/A' },
    { label: 'Religion', value: admin.religion || 'N/A' },
    { label: 'Address', value: admin.address || 'N/A' },
    { label: 'Birth Certificate No.', value: admin.birthCertificateNumber || 'N/A' },
    { label: 'NID', value: admin.nid || 'N/A' },
    { label: 'Status', value: admin.status || 'N/A' },
    { label: 'Created At', value: formatDate(admin.createdAt) },
    { label: 'Created By', value: admin.createdBy || 'N/A' },
    { label: 'Last Login', value: formatDate(admin.lastLogin) },
  ];
// src/pages/ManageAdmin.tsx - PART 2 OF 3
// Continue from Part 1
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-4xl rounded-2xl overflow-hidden border border-background-700/50">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {admin.profilePictureUrl ? (
                <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-background-700/50 shadow-lg">
                  <img 
                    src={admin.profilePictureUrl} 
                    alt={admin.surname || 'Admin'} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">{admin.surname?.charAt(0) || 'A'}</span>
                </div>
              )}
              <div>
                <h3 className="text-white font-bold text-xl mb-1">Admin Information</h3>
                <p className="text-gray-400">{admin.surname || 'Unknown Admin'}</p>
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

// Edit Admin Modal Component
interface EditAdminModalProps {
  admin: Admin;
  onClose: () => void;
  onSave: (updates: Partial<Admin>) => void;
}

const EditAdminModal = ({ admin, onClose, onSave }: EditAdminModalProps) => {
  const [formData, setFormData] = useState({
    surname: admin.surname || '',
    fullName: admin.fullName || '',
    email: admin.email || '',
    phoneNumber: admin.phoneNumber || '',
    dob: admin.dob || '',
    gender: admin.gender || '' as '' | 'male' | 'female' | 'other',
    bloodGroup: admin.bloodGroup || '' as '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-',
    religion: admin.religion || '',
    address: admin.address || '',
    birthCertificateNumber: admin.birthCertificateNumber || '',
    nid: admin.nid || '',
    status: admin.status || 'active' as 'active' | 'inactive' | 'pending',
    profilePictureUrl: admin.profilePictureUrl || ''
  });

  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-3xl rounded-2xl overflow-hidden border border-background-700/50 my-8">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xl mb-1">Edit Admin</h3>
              <p className="text-gray-400">{admin.userId} - {admin.surname}</p>
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
            <p className="text-white font-semibold">{admin.userId}</p>
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
              disabled={uploadingProfilePic}
              className="flex-1 px-5 py-2.5 bg-green-700/80 hover:bg-green-600/80 text-white rounded-lg transition-all duration-200 font-semibold disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface AddAdminModalProps {
  onClose: () => void;
  onSuccess: (admin: Admin) => void;
  currentAdmin: Admin;
}

const AddAdminModal = ({ onClose, onSuccess, currentAdmin }: AddAdminModalProps) => {
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

      // No email or phone uniqueness check — directly create admin
      // createAdmin signature: (phoneNumber, email, password, surname, fullName, dob, phone, bloodGroup, gender, religion, address, birthCertificateNumber, nid, createdByAdminId, createdByAdminUid, createdByAdminSurname, profilePictureUrl?)
      const newAdmin = await adminService.createAdmin(
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
        currentAdmin.userId || '',    // createdByAdminId
        currentAdmin.uid,              // createdByAdminUid
        currentAdmin.surname || '',    // createdByAdminSurname
        formData.profilePictureUrl || undefined // profilePictureUrl
      );

      setGeneratedUserId(newAdmin.userId || '');
      setShowSuccessModal(true);
      
      setTimeout(() => {
        onSuccess(newAdmin);
      }, 3000);

    } catch (error: any) {
      console.error('Create admin error:', error);
      setError(error.message || 'Failed to create admin account');
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
              Admin Created!
            </h2>
            
            <div className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-gray-700/50 shadow-inner">
              <p className="text-gray-300 text-sm mb-3 font-medium">Admin User ID</p>
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
              <p className="text-sm">The admin has been notified via SMS with login instructions.</p>
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
            Add New Admin
          </h2>
          <p className="text-gray-400 text-sm mb-6">Create a new administrator account</p>

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
                  disabled={loading}>
                  <option value="">Select gender</option>
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
                    <span>Create Admin</span>
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
  admin: Admin;
  currentAdmin: Admin;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const PasswordResetModal = ({ admin, currentAdmin, onClose, onSuccess, onError }: PasswordResetModalProps) => {
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
      // resetAdminPassword(targetAdminUid, newPassword, resetByAdmin: Admin, reason?)
      await adminService.resetAdminPassword(admin.uid, newPassword, currentAdmin, reason);
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
              <p className="text-gray-400 text-sm">{admin.surname} ({admin.userId})</p>
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
              This action will be logged in security logs with your admin ID and timestamp for auditing purposes.
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
  admin: Admin;
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const SecurityLogsModal = ({ admin, onClose, formatDate }: SecurityLogsModalProps) => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        // getSecurityLogs returns ALL log types for this admin (password_reset, admin_created, admin_edited, admin_deleted)
        const logsData = await adminService.getSecurityLogs(admin.uid);
        setLogs(logsData);
      } catch (error) {
        console.error('Error loading security logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [admin.uid]);

  // Helper to get icon, label, and colors per action type
  const getActionConfig = (action: SecurityLog['action']) => {
    switch (action) {
      case 'admin_created':
        return {
          icon: Plus,
          label: 'Admin Created',
          bgColor: 'bg-green-700/60',
          textColor: 'text-green-300',
          badgeBg: 'bg-green-900/40',
          badgeText: 'text-green-300',
          borderColor: 'border-green-700/30',
        };
      case 'admin_edited':
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
      case 'admin_deleted':
        return {
          icon: X,
          label: 'Admin Deleted',
          bgColor: 'bg-red-700/60',
          textColor: 'text-red-300',
          badgeBg: 'bg-red-900/40',
          badgeText: 'text-red-300',
          borderColor: 'border-red-700/30',
        };
      default:
        return {
          icon: Shield,
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
              <p className="text-gray-400 text-sm">{admin.surname} ({admin.userId})</p>
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
              <p className="text-gray-400">No security actions have been recorded for this admin.</p>
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

// All Admin Logs Modal Component
interface AllAdminLogsModalProps {
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const AllAdminLogsModal = ({ onClose, formatDate }: AllAdminLogsModalProps) => {
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
      const allLogs = await adminService.getAllSecurityLogs();
      setLogs(allLogs);
    } catch (error) {
      console.error('Error loading security logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.targetAdminSurname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetAdminUserId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      case 'admin_created':
        return {
          icon: Plus,
          label: 'Admin Created',
          bgColor: 'bg-blue-700/60',
          textColor: 'text-blue-300',
          badgeBg: 'bg-blue-900/40',
          badgeText: 'text-blue-300',
          borderColor: 'border-blue-700/30',
        };
      case 'admin_edited':
        return {
          icon: Edit,
          label: 'Admin Edited',
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
      case 'admin_deleted':
        return {
          icon: X,
          label: 'Admin Deleted',
          bgColor: 'bg-red-700/60',
          textColor: 'text-red-300',
          badgeBg: 'bg-red-900/40',
          badgeText: 'text-red-300',
          borderColor: 'border-red-700/30',
        };
      default:
        return {
          icon: Shield,
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
    admin_created: logs.filter(l => l.action === 'admin_created').length,
    admin_edited: logs.filter(l => l.action === 'admin_edited').length,
    password_reset: logs.filter(l => l.action === 'password_reset').length,
    admin_deleted: logs.filter(l => l.action === 'admin_deleted').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden border border-background-700/50 flex flex-col">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                <ScrollText size={20} className="text-cyan-400" />
                All Admin Security Logs
              </h3>
              <p className="text-gray-400 text-sm">Complete security audit trail for all administrators</p>
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
                placeholder="Search by admin name or ID..."
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
              <option value="login">Login ({actionCounts.login})</option>
              <option value="logout">Logout ({actionCounts.logout})</option>
              <option value="admin_created">Created ({actionCounts.admin_created})</option>
              <option value="admin_edited">Edited ({actionCounts.admin_edited})</option>
              <option value="password_reset">Password Reset ({actionCounts.password_reset})</option>
              <option value="admin_deleted">Deleted ({actionCounts.admin_deleted})</option>
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
                      {/* Target Admin */}
                      <div className="flex flex-col">
                        <span className="text-gray-400 text-xs mb-1">Target Admin:</span>
                        <span className="text-white font-medium">
                          {log.targetAdminSurname || 'N/A'} ({log.targetAdminUserId || 'N/A'})
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


export default ManageAdmin;

// THIS IS THE COMPLETE FILE
