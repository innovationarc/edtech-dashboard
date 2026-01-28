import { useState, useEffect } from 'react';
import { Trash2, Search, Loader, CheckCircle, XCircle, Clock, RefreshCw, Filter, Info, Edit, Users, GraduationCap, UserCog, Shield, Briefcase, UsersRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { userService, User } from '../services/userService';
import { useDashboard } from '../contexts/DashboardContext';

const ManageUsers = () => {
  const { user: currentUser } = useDashboard();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'coordinator' | 'teacher' | 'parent' | 'student'>('all');

  // Check if current user has access to User Management
  const hasAccess = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'coordinator';

  // Check permissions for management cards
  const canViewStudentManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'coordinator';
  const canViewParentManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'coordinator';
  const canViewTeacherManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canViewCoordinatorManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canViewManagerManagement = currentUser?.role === 'admin';
  const canViewAdminManagement = currentUser?.role === 'admin';

  useEffect(() => {
    if (!hasAccess) {
      setError('Access denied. Only administrators, managers, and coordinators can manage users.');
      setLoading(false);
      return;
    }
    loadUsers();
  }, [hasAccess]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const usersData = await userService.getAllUsers();
      setAllUsers(usersData);
      
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleDeleteUser = async (userId: string, userEmail?: string) => {
    if (!hasAccess) {
      setError('Only authorized users can delete accounts.');
      return;
    }
    
    if (userId === currentUser?.uid) {
      setError('You cannot delete your own account.');
      return;
    }
    
    if (confirm('Are you sure you want to delete this user? This will permanently delete their account from both Firestore and Firebase Authentication.')) {
      try {
        // Delete from Firestore and Firebase Auth
        await userService.deleteUser(userId, userEmail);
        setAllUsers(allUsers.filter(user => user.uid !== userId));
      } catch (error: any) {
        setError(error.message);
      }
    }
  };

  const handleShowInfo = (user: User) => {
    setSelectedUser(user);
    setShowInfoModal(true);
  };

  const handleQuickEdit = (user: User) => {
    setSelectedUser(user);
    setShowQuickEditModal(true);
  };

  const handleManageUser = (user: User) => {
    // Navigate to role-specific management page
    const roleRoutes: Record<string, string> = {
      student: '/manage/students',
      parent: '/manage/parents',
      teacher: '/manage/teachers',
      coordinator: '/manage/coordinators',
      manager: '/manage/managers',
      admin: '/manage/admins'
    };
    
    const route = roleRoutes[user.role];
    if (route) {
      navigate(route, { state: { userId: user.uid } });
    }
  };

  // If not authorized, show access denied
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Shield size={64} className="text-error-DEFAULT" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400 text-center max-w-md">
          Only administrators, managers, and coordinators can access the user management section.
        </p>
      </div>
    );
  }

  // Filter users based on search term, status, and role
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = 
      (user.userId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.surname?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Get counts for different statuses
  const statusCounts = {
    all: allUsers.length,
    active: allUsers.filter(u => u.status === 'active').length,
    pending: allUsers.filter(u => u.status === 'pending').length,
    inactive: allUsers.filter(u => u.status === 'inactive').length
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

  // Management cards configuration
  const managementCards = [
    {
      title: 'Student Management',
      icon: GraduationCap,
      route: '/manage/students',
      visible: canViewStudentManagement,
      gradient: 'from-blue-500 to-blue-600',
      count: allUsers.filter(u => u.role === 'student').length
    },
    {
      title: 'Parent Management',
      icon: Users,
      route: '/manage/parents',
      visible: canViewParentManagement,
      gradient: 'from-purple-500 to-purple-600',
      count: allUsers.filter(u => u.role === 'parent').length
    },
    {
      title: 'Teacher Management',
      icon: UsersRound,
      route: '/manage/teachers',
      visible: canViewTeacherManagement,
      gradient: 'from-green-500 to-green-600',
      count: allUsers.filter(u => u.role === 'teacher').length
    },
    {
      title: 'Coordinator Management',
      icon: UserCog,
      route: '/manage/coordinators',
      visible: canViewCoordinatorManagement,
      gradient: 'from-orange-500 to-orange-600',
      count: allUsers.filter(u => u.role === 'coordinator').length
    },
    {
      title: 'Manager Management',
      icon: Briefcase,
      route: '/manage/managers',
      visible: canViewManagerManagement,
      gradient: 'from-red-500 to-red-600',
      count: allUsers.filter(u => u.role === 'manager').length
    },
    {
      title: 'Admin Management',
      icon: Shield,
      route: '/manage/admins',
      visible: canViewAdminManagement,
      gradient: 'from-gray-600 to-gray-700',
      count: allUsers.filter(u => u.role === 'admin').length
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage all users across the platform • Total: {allUsers.length} users
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {statusCounts.pending > 0 && (
            <div className="flex items-center gap-2 bg-warning-dark text-warning-light px-4 py-2 rounded-xl border border-warning-DEFAULT/30">
              <Clock size={16} />
              <span className="text-sm font-medium">
                {statusCounts.pending} pending
              </span>
            </div>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white px-4 py-2 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-primary-500/50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {managementCards.filter(card => card.visible).map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.route}
              onClick={() => navigate(card.route)}
              className="group relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-2xl text-left"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${card.gradient} mb-4 shadow-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
                
                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all duration-300">
                  {card.title}
                </h3>
                
                <p className="text-2xl font-bold text-white mb-1">{card.count}</p>
                <p className="text-xs text-gray-400">Total users</p>
              </div>
            </button>
          );
        })}
      </div>
      
      {error && (
        <div className="bg-error-dark/50 border border-error-DEFAULT/50 text-error-light px-4 py-3 rounded-xl backdrop-blur-sm">
          {error}
        </div>
      )}
      
      {/* User List Card */}
      <Card>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          {/* Status Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'All Users', count: statusCounts.all, color: 'bg-gradient-to-r from-gray-700 to-gray-800' },
              { key: 'active', label: 'Active', count: statusCounts.active, color: 'bg-gradient-to-r from-green-600 to-green-700' },
              { key: 'pending', label: 'Pending', count: statusCounts.pending, color: 'bg-gradient-to-r from-yellow-600 to-yellow-700' },
              { key: 'inactive', label: 'Inactive', count: statusCounts.inactive, color: 'bg-gradient-to-r from-red-600 to-red-700' }
            ].map((status) => (
              <button
                key={status.key}
                onClick={() => setStatusFilter(status.key as any)}
                className={`px-4 py-2 rounded-xl transition-all duration-200 relative font-medium ${
                  statusFilter === status.key
                    ? status.color + ' text-white shadow-lg'
                    : 'bg-background-800 text-gray-400 hover:text-white hover:bg-background-700'
                }`}
              >
                {status.label} ({status.count})
                {status.key === 'pending' && status.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </button>
            ))}
          </div>
          
          {/* Search and Filters */}
          <div className="flex gap-4 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <input
                type="text"
                placeholder="Search by ID, name, phone..."
                className="w-full bg-background-800 text-white rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-700/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-background-800 text-white rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none border border-gray-700/50 cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="coordinator">Coordinator</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
              </select>
              <Filter size={18} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-background-800">
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">User ID</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">Surname</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">Role</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">Status</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">Joining Date</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">Last Login</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="border-b border-background-800 last:border-0 hover:bg-gradient-to-r hover:from-background-800/30 hover:to-background-800/10 transition-all duration-200">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-gradient-to-br ${
                        user.role === 'admin' ? 'from-gray-600 to-gray-700' :
                        user.role === 'manager' ? 'from-red-500 to-red-600' :
                        user.role === 'coordinator' ? 'from-orange-500 to-orange-600' :
                        user.role === 'teacher' ? 'from-green-500 to-green-600' :
                        user.role === 'parent' ? 'from-purple-500 to-purple-600' :
                        'from-blue-500 to-blue-600'
                      } shadow-lg`}>
                        <span className="text-white font-bold text-sm">{user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{user.userId || 'N/A'}</span>
                          {user.uid === currentUser?.uid && (
                            <span className="text-xs bg-primary-900 text-primary-300 px-2 py-0.5 rounded-full">You</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{user.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-medium">{user.surname || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' 
                        ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200' 
                        : user.role === 'manager'
                        ? 'bg-gradient-to-r from-red-700 to-red-800 text-red-200'
                        : user.role === 'coordinator'
                        ? 'bg-gradient-to-r from-orange-700 to-orange-800 text-orange-200'
                        : user.role === 'teacher'
                        ? 'bg-gradient-to-r from-green-700 to-green-800 text-green-200'
                        : user.role === 'parent'
                        ? 'bg-gradient-to-r from-purple-700 to-purple-800 text-purple-200'
                        : 'bg-gradient-to-r from-blue-700 to-blue-800 text-blue-200'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 w-fit font-semibold ${
                      user.status === 'active' 
                        ? 'bg-gradient-to-r from-green-700 to-green-800 text-green-200' 
                        : user.status === 'pending'
                        ? 'bg-gradient-to-r from-yellow-700 to-yellow-800 text-yellow-200'
                        : 'bg-gradient-to-r from-red-700 to-red-800 text-red-200'
                    }`}>
                      {user.status === 'active' && <CheckCircle size={12} />}
                      {user.status === 'pending' && <Clock size={12} />}
                      {user.status === 'inactive' && <XCircle size={12} />}
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="p-4 text-gray-300">
                    {formatDate(user.lastLogin)}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShowInfo(user)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 hover:scale-110 shadow-md hover:shadow-blue-500/50"
                        title="View user info"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        onClick={() => handleQuickEdit(user)}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 hover:scale-110 shadow-md hover:shadow-green-500/50"
                        title="Quick edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.uid, user.email)}
                        className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-red-500/50"
                        disabled={user.uid === currentUser?.uid}
                        title={user.uid === currentUser?.uid ? "Cannot delete your own account" : "Delete user"}
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
        
        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' 
                ? 'No users found matching your criteria.' 
                : 'No users found.'
              }
            </p>
          </div>
        )}
        
        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-background-800 flex justify-between items-center text-sm text-gray-400">
          <div>
            Showing <span className="text-white font-semibold">{filteredUsers.length}</span> of <span className="text-white font-semibold">{allUsers.length}</span> users
            {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
              <span className="ml-2 text-gray-500">
                (filtered)
              </span>
            )}
          </div>
          <div>Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
      </Card>
      
      {/* Info Modal */}
      {showInfoModal && selectedUser && (
        <UserInfoModal
          user={selectedUser}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedUser(null);
          }}
          formatDate={formatDate}
        />
      )}
      
      {/* Quick Edit Modal */}
      {showQuickEditModal && selectedUser && (
        <QuickEditModal
          user={selectedUser}
          onClose={() => {
            setShowQuickEditModal(false);
            setSelectedUser(null);
          }}
          onSave={async (updates) => {
            try {
              await userService.updateUser(selectedUser.uid, updates);
              setAllUsers(allUsers.map(u => 
                u.uid === selectedUser.uid ? { ...u, ...updates } : u
              ));
              setShowQuickEditModal(false);
              setSelectedUser(null);
            } catch (error: any) {
              setError(error.message);
            }
          }}
          onManage={handleManageUser}
        />
      )}
    </div>
  );
};

// User Info Modal Component
interface UserInfoModalProps {
  user: User;
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const UserInfoModal = ({ user, onClose, formatDate }: UserInfoModalProps) => {
  const infoFields = [
    { label: 'User ID', value: user.userId || 'N/A' },
    { label: 'Name', value: user.name || 'N/A' },
    { label: 'Surname', value: user.surname || 'N/A' },
    { label: 'Full Name', value: user.fullName || 'N/A' },
    { label: 'Email', value: user.email || 'N/A' },
    { label: 'Phone Number', value: user.phoneNumber || 'N/A' },
    { label: 'Guardian Phone', value: user.guardianPhone || 'N/A' },
    { label: 'Date of Birth', value: user.dob || 'N/A' },
    { label: 'Gender', value: user.gender || 'N/A' },
    { label: 'Blood Group', value: user.bloodGroup || 'N/A' },
    { label: 'Religion', value: user.religion || 'N/A' },
    { label: 'Class/Grade', value: user.classGrade || 'N/A' },
    { label: 'Role', value: user.role || 'N/A' },
    { label: 'Status', value: user.status || 'N/A' },
    { label: 'Registration Number', value: user.registrationNumber || 'N/A' },
    { label: 'Joining Date', value: formatDate(user.createdAt) },
    { label: 'Last Login', value: formatDate(user.lastLogin) },
    { label: 'Approved By', value: user.approvedBy || 'N/A' },
    { label: 'Approved At', value: formatDate(user.approvedAt) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50">
        <div className="p-6 border-b border-background-800 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">{user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-xl">User Information</h3>
                <p className="text-sm text-gray-400 mt-1">{user.name || 'Unknown User'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90"
            >
              <XCircle size={24} />
            </button>
          </div>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {infoFields.map((field, index) => (
              <div key={index} className="bg-background-800/50 rounded-xl p-4 border border-gray-700/30">
                <p className="text-xs text-gray-400 mb-1 font-medium uppercase">{field.label}</p>
                <p className="text-white font-medium">{field.value}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t border-background-800 bg-background-800/30">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-3 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-primary-500/50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Quick Edit Modal Component
interface QuickEditModalProps {
  user: User;
  onClose: () => void;
  onSave: (updates: Partial<User>) => void;
  onManage: (user: User) => void;
}

const QuickEditModal = ({ user, onClose, onSave, onManage }: QuickEditModalProps) => {
  const [formData, setFormData] = useState({
    surname: user.surname || '',
    phoneNumber: user.phoneNumber || '',
    email: user.email || '',
    status: user.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50">
        <div className="p-6 border-b border-background-800 bg-gradient-to-r from-green-600/20 to-blue-600/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xl">Quick Edit</h3>
              <p className="text-sm text-gray-400 mt-1">{user.name || 'Unknown User'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90"
            >
              <XCircle size={24} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
            <p className="text-xs text-blue-300 font-semibold mb-1">Role (Non-editable)</p>
            <p className="text-white font-medium capitalize">{user.role}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Surname</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full bg-background-800 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full bg-background-800 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-background-800 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full bg-background-800 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-background-800 hover:bg-background-700 text-white rounded-xl transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-green-500/50"
            >
              Save Changes
            </button>
          </div>

          <button
            type="button"
            onClick={() => onManage(user)}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-blue-500/50 flex items-center justify-center gap-2"
          >
            <UserCog size={18} />
            Manage User
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManageUsers;
