// src/pages/ManageUsers.tsx
import { useState, useEffect } from 'react';
import { Trash2, Search, Loader, CheckCircle, XCircle, Clock, RefreshCw, Filter, Info, Edit, Users, GraduationCap, UserCog, Shield, Briefcase, UsersRound, AlertTriangle, X, User as UserIcon } from 'lucide-react';
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
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
    setSuccessMessage('User list refreshed successfully');
  };

  const handleDeleteUser = async (user: User) => {
    if (!hasAccess) {
      setError('Only authorized users can delete accounts.');
      return;
    }
    
    if (user.uid === currentUser?.uid) {
      setError('You cannot delete your own account.');
      return;
    }
    
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(userToDelete.uid);
      setError('');
      
      // Delete from Firestore and Firebase Auth
      await userService.deleteUser(userToDelete.uid, userToDelete.email);
      
      // Remove from local state
      setAllUsers(allUsers.filter(u => u.uid !== userToDelete.uid));
      
      setSuccessMessage(`User "${userToDelete.name}" has been permanently deleted from both Firestore and Firebase Authentication.`);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message || 'Failed to delete user. Please try again.');
    } finally {
      setDeleting(null);
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-gradient-to-br from-red-900/20 via-gray-900 to-red-900/20 rounded-3xl p-8 border border-red-500/20 backdrop-blur-xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full"></div>
              <Shield size={80} className="text-red-500 relative z-10" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-gray-400 text-lg">
                Only administrators, managers, and coordinators can access the user management section.
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-200 font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
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
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      hoverGradient: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
      count: allUsers.filter(u => u.role === 'student').length
    },
    {
      title: 'Parent Management',
      icon: Users,
      route: '/manage/parents',
      visible: canViewParentManagement,
      gradient: 'from-purple-500 via-purple-600 to-pink-600',
      hoverGradient: 'hover:from-purple-600 hover:via-purple-700 hover:to-pink-700',
      count: allUsers.filter(u => u.role === 'parent').length
    },
    {
      title: 'Teacher Management',
      icon: UsersRound,
      route: '/manage/teachers',
      visible: canViewTeacherManagement,
      gradient: 'from-green-500 via-green-600 to-emerald-600',
      hoverGradient: 'hover:from-green-600 hover:via-green-700 hover:to-emerald-700',
      count: allUsers.filter(u => u.role === 'teacher').length
    },
    {
      title: 'Coordinator Management',
      icon: UserCog,
      route: '/manage/coordinators',
      visible: canViewCoordinatorManagement,
      gradient: 'from-orange-500 via-orange-600 to-red-600',
      hoverGradient: 'hover:from-orange-600 hover:via-orange-700 hover:to-red-700',
      count: allUsers.filter(u => u.role === 'coordinator').length
    },
    {
      title: 'Manager Management',
      icon: Briefcase,
      route: '/manage/managers',
      visible: canViewManagerManagement,
      gradient: 'from-red-500 via-red-600 to-rose-600',
      hoverGradient: 'hover:from-red-600 hover:via-red-700 hover:to-rose-700',
      count: allUsers.filter(u => u.role === 'manager').length
    },
    {
      title: 'Admin Management',
      icon: Shield,
      route: '/manage/admins',
      visible: canViewAdminManagement,
      gradient: 'from-gray-600 via-gray-700 to-slate-700',
      hoverGradient: 'hover:from-gray-700 hover:via-gray-800 hover:to-slate-800',
      count: allUsers.filter(u => u.role === 'admin').length
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section with Gradient Background */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-900/30 via-purple-900/20 to-background-900 rounded-3xl p-8 border border-primary-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-primary-200 to-purple-200 mb-3">
              User Management
            </h1>
            <p className="text-gray-300 text-lg">
              Comprehensive user oversight • <span className="text-primary-400 font-semibold">{allUsers.length}</span> total users registered
            </p>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            {statusCounts.pending > 0 && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border border-yellow-500/30 text-yellow-200 px-5 py-3 rounded-2xl backdrop-blur-xl shadow-lg">
                <Clock size={18} className="animate-pulse" />
                <span className="text-sm font-semibold">
                  {statusCounts.pending} user{statusCounts.pending !== 1 ? 's' : ''} pending
                </span>
              </div>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-gradient-to-r from-primary-600 via-primary-700 to-purple-700 hover:from-primary-700 hover:via-primary-800 hover:to-purple-800 text-white px-6 py-3 rounded-2xl transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-primary-500/50 hover:scale-105 disabled:hover:scale-100"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              <span className="font-medium">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 text-green-200 px-6 py-4 rounded-2xl backdrop-blur-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle size={20} className="flex-shrink-0" />
          <p className="flex-1 font-medium">{successMessage}</p>
          <button onClick={() => setSuccessMessage('')} className="text-green-300 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-gradient-to-r from-red-900/40 to-rose-900/40 border border-red-500/30 text-red-200 px-6 py-4 rounded-2xl backdrop-blur-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <p className="flex-1 font-medium">{error}</p>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Management Cards Grid - Enhanced with better animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {managementCards.filter(card => card.visible).map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              key={card.route}
              onClick={() => navigate(card.route)}
              className="group relative overflow-hidden bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-black/80 rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600 transition-all duration-300 hover:scale-105 hover:shadow-2xl text-left backdrop-blur-xl"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Animated gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
              
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </div>
              
              <div className="relative z-10">
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${card.gradient} mb-4 shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={28} className="text-white" />
                </div>
                
                <h3 className="text-white font-bold text-sm mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-200 transition-all duration-300 line-clamp-2">
                  {card.title}
                </h3>
                
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl font-bold text-white group-hover:scale-110 transition-transform duration-300">{card.count}</p>
                  <span className="text-xs text-gray-400 font-medium">users</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* User List Card - Production Grade UI */}
      <Card className="overflow-hidden border-gray-700/50 shadow-2xl">
        <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 p-6 border-b border-gray-700/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            {/* Status Filter Tabs - Enhanced */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All', count: statusCounts.all, gradient: 'from-gray-600 to-gray-700', icon: Users },
                { key: 'active', label: 'Active', count: statusCounts.active, gradient: 'from-green-600 to-emerald-700', icon: CheckCircle },
                { key: 'pending', label: 'Pending', count: statusCounts.pending, gradient: 'from-yellow-600 to-orange-700', icon: Clock },
                { key: 'inactive', label: 'Inactive', count: statusCounts.inactive, gradient: 'from-red-600 to-rose-700', icon: XCircle }
              ].map((status) => {
                const StatusIcon = status.icon;
                return (
                  <button
                    key={status.key}
                    onClick={() => setStatusFilter(status.key as any)}
                    className={`group relative px-5 py-3 rounded-xl transition-all duration-300 font-medium flex items-center gap-2 ${
                      statusFilter === status.key
                        ? `bg-gradient-to-r ${status.gradient} text-white shadow-lg scale-105`
                        : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 hover:scale-105'
                    }`}
                  >
                    <StatusIcon size={16} className={statusFilter === status.key ? 'animate-pulse' : ''} />
                    <span>{status.label}</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      statusFilter === status.key ? 'bg-white/20' : 'bg-gray-700/50'
                    }`}>
                      {status.count}
                    </span>
                    {status.key === 'pending' && status.count > 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-ping"></span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Search and Filters - Enhanced */}
            <div className="flex gap-3 w-full lg:w-auto flex-wrap lg:flex-nowrap">
              <div className="relative flex-1 lg:flex-none lg:w-80 group">
                <input
                  type="text"
                  placeholder="Search users by ID, name, email, phone..."
                  className="w-full bg-gray-800/50 text-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-700/50 focus:border-primary-500 transition-all duration-200 placeholder:text-gray-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-primary-400 transition-colors" />
              </div>
              
              <div className="relative group">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="bg-gray-800/50 text-white rounded-xl py-3 pl-11 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none border border-gray-700/50 focus:border-primary-500 cursor-pointer transition-all duration-200 font-medium"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                  <option value="student">Student</option>
                </select>
                <Filter size={18} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none group-focus-within:text-primary-400 transition-colors" />
                <div className="absolute right-3 top-3.5 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Enhanced Table with Better Responsive Design */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="p-4 text-left">
                  <div className="flex items-center gap-2 text-xs uppercase text-gray-400 font-bold tracking-wider">
                    <Users size={14} />
                    <span>User Details</span>
                  </div>
                </th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden sm:table-cell">Surname</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden md:table-cell">Role</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden lg:table-cell">Status</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden xl:table-cell">Joined</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden xl:table-cell">Last Login</th>
                <th className="p-4 text-right text-xs uppercase text-gray-400 font-bold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr 
                  key={user.uid} 
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gradient-to-r hover:from-primary-900/10 hover:to-purple-900/10 transition-all duration-200 group"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${
                          user.role === 'admin' ? 'from-gray-600 to-gray-800' :
                          user.role === 'manager' ? 'from-red-500 to-rose-700' :
                          user.role === 'coordinator' ? 'from-orange-500 to-red-600' :
                          user.role === 'teacher' ? 'from-green-500 to-emerald-700' :
                          user.role === 'parent' ? 'from-purple-500 to-pink-600' :
                          'from-blue-500 to-indigo-700'
                        } shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                          <span className="text-white font-bold text-lg">
                            {user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        {user.status === 'active' && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 rounded-full border-2 border-gray-900"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold truncate">{user.userId || 'N/A'}</span>
                          {user.uid === currentUser?.uid && (
                            <span className="text-xs bg-primary-900 text-primary-300 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">You</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 truncate">{user.name}</p>
                        <div className="flex items-center gap-2 mt-1 md:hidden">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            user.role === 'admin' ? 'bg-gray-700 text-gray-200' :
                            user.role === 'manager' ? 'bg-red-700 text-red-200' :
                            user.role === 'coordinator' ? 'bg-orange-700 text-orange-200' :
                            user.role === 'teacher' ? 'bg-green-700 text-green-200' :
                            user.role === 'parent' ? 'bg-purple-700 text-purple-200' :
                            'bg-blue-700 text-blue-200'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-medium hidden sm:table-cell">{user.surname || 'N/A'}</td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg ${
                      user.role === 'admin' ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100' :
                      user.role === 'manager' ? 'bg-gradient-to-r from-red-600 to-rose-700 text-red-100' :
                      user.role === 'coordinator' ? 'bg-gradient-to-r from-orange-600 to-red-700 text-orange-100' :
                      user.role === 'teacher' ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-green-100' :
                      user.role === 'parent' ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-purple-100' :
                      'bg-gradient-to-r from-blue-600 to-indigo-700 text-blue-100'
                    }`}>
                      {user.role === 'admin' && <Shield size={12} />}
                      {user.role === 'manager' && <Briefcase size={12} />}
                      {user.role === 'coordinator' && <UserCog size={12} />}
                      {user.role === 'teacher' && <UsersRound size={12} />}
                      {user.role === 'parent' && <Users size={12} />}
                      {user.role === 'student' && <GraduationCap size={12} />}
                      <span className="capitalize">{user.role}</span>
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg ${
                      user.status === 'active' ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-green-100' :
                      user.status === 'pending' ? 'bg-gradient-to-r from-yellow-600 to-orange-700 text-yellow-100' :
                      'bg-gradient-to-r from-red-600 to-rose-700 text-red-100'
                    }`}>
                      {user.status === 'active' && <CheckCircle size={12} />}
                      {user.status === 'pending' && <Clock size={12} className="animate-pulse" />}
                      {user.status === 'inactive' && <XCircle size={12} />}
                      <span className="capitalize">{user.status}</span>
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm hidden xl:table-cell">{formatDate(user.createdAt)}</td>
                  <td className="p-4 text-gray-400 text-sm hidden xl:table-cell">{formatDate(user.lastLogin)}</td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleShowInfo(user)}
                        className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-blue-500/50 group/btn"
                        title="View user info"
                      >
                        <Info size={16} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                      <button
                        onClick={() => handleQuickEdit(user)}
                        className="p-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all duration-200 hover:scale-110 shadow-lg hover:shadow-green-500/50 group/btn"
                        title="Quick edit"
                      >
                        <Edit size={16} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/50 group/btn disabled:hover:scale-100"
                        disabled={user.uid === currentUser?.uid || deleting === user.uid}
                        title={user.uid === currentUser?.uid ? "Cannot delete your own account" : "Delete user"}
                      >
                        {deleting === user.uid ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} className="group-hover/btn:scale-110 transition-transform" />
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
        {filteredUsers.length === 0 && (
          <div className="py-20 text-center">
            <div className="inline-flex p-6 rounded-full bg-gray-800/50 mb-6">
              <Users size={64} className="text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No Users Found</h3>
            <p className="text-gray-400 text-lg max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' 
                ? 'No users match your current filters. Try adjusting your search criteria.' 
                : 'No users have been registered yet.'
              }
            </p>
            {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setRoleFilter('all');
                }}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-primary-500/50"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
        
        {/* Enhanced Summary Footer */}
        {filteredUsers.length > 0 && (
          <div className="bg-gray-900/50 px-6 py-4 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span>Showing</span>
              <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-lg font-bold">
                {filteredUsers.length}
              </span>
              <span>of</span>
              <span className="px-3 py-1 bg-gray-800 text-white rounded-lg font-bold">
                {allUsers.length}
              </span>
              <span>users</span>
              {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
                <span className="ml-2 text-gray-500">(filtered)</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={14} />
              <span>Updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </Card>

      
      {/* Delete Confirmation Modal - Production Grade */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-red-500/30 animate-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="inline-flex p-4 rounded-full bg-red-500/20 mb-6">
                <AlertTriangle size={48} className="text-red-500" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-3">Delete User Account</h3>
              <p className="text-gray-300 mb-2">
                Are you absolutely sure you want to delete
              </p>
              <p className="text-primary-400 font-bold text-lg mb-4">
                {userToDelete.name} ({userToDelete.userId})?
              </p>
              
              <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4 mb-6 text-left">
                <p className="text-red-200 text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  This action will:
                </p>
                <ul className="text-red-300 text-sm space-y-1.5 ml-6">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Permanently delete from <strong>Firestore Database</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Permanently delete from <strong>Firebase Authentication</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>Remove all user data and profile pictures</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span><strong>Cannot be undone</strong></span>
                  </li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setUserToDelete(null);
                  }}
                  disabled={deleting !== null}
                  className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting !== null}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-red-500/50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
              setSuccessMessage(`User "${selectedUser.name}" updated successfully`);
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

// Enhanced User Info Modal Component
interface UserInfoModalProps {
  user: User;
  onClose: () => void;
  formatDate: (date: Date | undefined) => string;
}

const UserInfoModal = ({ user, onClose, formatDate }: UserInfoModalProps) => {
  const infoFields = [
    { label: 'User ID', value: user.userId || 'N/A', icon: Users },
    { label: 'Name', value: user.name || 'N/A', icon: UserIcon },
    { label: 'Surname', value: user.surname || 'N/A', icon: UserIcon },
    { label: 'Full Name', value: user.fullName || 'N/A', icon: UserIcon },
    { label: 'Email', value: user.email || 'N/A', icon: null },
    { label: 'Phone Number', value: user.phoneNumber || 'N/A', icon: null },
    { label: 'Guardian Phone', value: user.guardianPhone || 'N/A', icon: null },
    { label: 'Date of Birth', value: user.dob || 'N/A', icon: null },
    { label: 'Gender', value: user.gender || 'N/A', icon: null },
    { label: 'Blood Group', value: user.bloodGroup || 'N/A', icon: null },
    { label: 'Religion', value: user.religion || 'N/A', icon: null },
    { label: 'Class/Grade', value: user.classGrade || 'N/A', icon: GraduationCap },
    { label: 'Role', value: user.role || 'N/A', icon: Shield },
    { label: 'Status', value: user.status || 'N/A', icon: CheckCircle },
    { label: 'Registration Number', value: user.registrationNumber || 'N/A', icon: null },
    { label: 'Joining Date', value: formatDate(user.createdAt), icon: null },
    { label: 'Last Login', value: formatDate(user.lastLogin), icon: Clock },
    { label: 'Approved By', value: user.approvedBy || 'N/A', icon: null },
    { label: 'Approved At', value: formatDate(user.approvedAt), icon: null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50 animate-in zoom-in duration-200">
        <div className="p-6 border-b border-background-800 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-20 w-20 rounded-3xl bg-gradient-to-br ${
                user.role === 'admin' ? 'from-gray-600 to-gray-800' :
                user.role === 'manager' ? 'from-red-500 to-rose-700' :
                user.role === 'coordinator' ? 'from-orange-500 to-red-600' :
                user.role === 'teacher' ? 'from-green-500 to-emerald-700' :
                user.role === 'parent' ? 'from-purple-500 to-pink-600' :
                'from-blue-500 to-indigo-700'
              } flex items-center justify-center shadow-2xl`}>
                <span className="text-white font-bold text-3xl">{user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-2xl mb-1">User Information</h3>
                <p className="text-gray-400">{user.name || 'Unknown User'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={28} />
            </button>
          </div>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {infoFields.map((field, index) => (
              <div key={index} className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700/30 hover:border-gray-600/50 transition-all duration-200 hover:shadow-lg">
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">{field.label}</p>
                <p className="text-white font-medium text-lg break-words">{field.value}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t border-background-800 bg-gray-900/30">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-primary-600 via-primary-700 to-purple-700 hover:from-primary-700 hover:via-primary-800 hover:to-purple-800 text-white py-4 rounded-2xl transition-all duration-200 font-bold shadow-lg hover:shadow-primary-500/50 hover:scale-105"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Quick Edit Modal Component
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50 animate-in zoom-in duration-200">
        <div className="p-6 border-b border-background-800 bg-gradient-to-r from-green-600/20 via-blue-600/20 to-green-600/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-2xl mb-1">Quick Edit</h3>
              <p className="text-gray-400">{user.name || 'Unknown User'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-xs text-blue-300 font-bold mb-2 uppercase tracking-wide">Role (Non-editable)</p>
            <p className="text-white font-bold text-lg capitalize flex items-center gap-2">
              {user.role === 'admin' && <Shield size={20} />}
              {user.role === 'manager' && <Briefcase size={20} />}
              {user.role === 'coordinator' && <UserCog size={20} />}
              {user.role === 'teacher' && <UsersRound size={20} />}
              {user.role === 'parent' && <Users size={20} />}
              {user.role === 'student' && <GraduationCap size={20} />}
              <span>{user.role}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Surname</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full bg-gray-800/50 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              placeholder="Enter surname"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full bg-gray-800/50 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              placeholder="Enter phone number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-gray-800/50 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
              placeholder="Enter email address"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full bg-gray-800/50 text-white rounded-xl py-3 px-4 border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer transition-all duration-200 font-medium"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-green-500/50 hover:scale-105"
            >
              Save Changes
            </button>
          </div>

          <button
            type="button"
            onClick={() => onManage(user)}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-blue-500/50 hover:scale-105 flex items-center justify-center gap-2"
          >
            <UserCog size={20} />
            <span>Advanced Management</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManageUsers;
