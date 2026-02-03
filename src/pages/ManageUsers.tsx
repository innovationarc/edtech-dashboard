// src/pages/ManageUsers.tsx
import { useState, useEffect } from 'react';
import { Search, Loader, CheckCircle, XCircle, Clock, RefreshCw, Filter, Info, Users, GraduationCap, UserCog, Shield, Briefcase, UsersRound, AlertTriangle, X, User as UserIcon, BookOpen, UserCheck, Settings } from 'lucide-react';
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'course_manager' | 'student_manager' | 'coordinator' | 'teacher' | 'parent' | 'student'>('all');

  // Check if current user has access to User Management
  // Teacher, Student, Parent MUST NOT have access
  const hasAccess = currentUser?.role === 'admin' || 
                    currentUser?.role === 'manager' || 
                    currentUser?.role === 'coordinator' ||
                    currentUser?.role === 'student_manager' ||
                    currentUser?.role === 'course_manager';

  // Check permissions for management cards
  const canViewStudentManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'coordinator' || currentUser?.role === 'student_manager' || currentUser?.role === 'course_manager';
  const canViewParentManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'coordinator' || currentUser?.role === 'student_manager' || currentUser?.role === 'course_manager';
  const canViewTeacherManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'course_manager';
  const canViewCoordinatorManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canViewCourseManagerManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canViewStudentManagerManagement = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const canViewManagerManagement = currentUser?.role === 'admin';
  const canViewAdminManagement = currentUser?.role === 'admin';

  // Function to check if current user can manage a specific user based on their role
  // This determines if the Manage button should be visible AND enabled
  const canManageUser = (userRole: string): boolean => {
    if (!currentUser) return false;
    
    switch (currentUser.role) {
      case 'admin':
        // Admin can manage ALL roles
        return true;
      
      case 'manager':
        // Manager can manage all EXCEPT Admin and Manager
        return userRole !== 'admin' && userRole !== 'manager';
      
      case 'coordinator':
        // Coordinator can manage ONLY Student and Parent
        return userRole === 'student' || userRole === 'parent';
      
      case 'student_manager':
        // Student Manager can manage ONLY Student and Parent
        return userRole === 'student' || userRole === 'parent';
      
      case 'course_manager':
        // Course Manager can manage ONLY Teacher, Student, and Parent
        return userRole === 'teacher' || userRole === 'student' || userRole === 'parent';
      
      default:
        // Teacher, Student, Parent cannot manage anyone
        return false;
    }
  };

  useEffect(() => {
    if (!hasAccess) {
      setError('Access denied. Only authorized users can manage users.');
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

  const handleShowInfo = (user: User) => {
    setSelectedUser(user);
    setShowInfoModal(true);
  };

  const handleManageUser = (user: User) => {
    // Check if current user has permission to manage this user
    if (!canManageUser(user.role)) {
      setError('You do not have permission to manage this user.');
      return;
    }
    
    // Navigate to role-specific management page with userId in state
    // This allows the management page to highlight the user automatically
    const roleRoutes: Record<string, string> = {
      student: '/manage/students',
      parent: '/manage/parents',
      teacher: '/manage/teachers',
      coordinator: '/manage/coordinators',
      course_manager: '/manage/course-managers',
      student_manager: '/manage/student-managers',
      manager: '/manage/managers',
      admin: '/manage/admins'
    };
    
    const route = roleRoutes[user.role];
    if (route) {
      // Pass userId in state for automatic highlighting on the target page
      navigate(route, { state: { highlightUserId: user.uid } });
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
                You do not have permission to access the user management section.
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
  // Hide Admin users from non-Admin users
  const filteredUsers = allUsers.filter(user => {
    // Hide Admin accounts from non-Admin users
    if (user.role === 'admin' && currentUser?.role !== 'admin') {
      return false;
    }
    
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

  // Get counts for different statuses - exclude Admins from non-Admin users
  const visibleUsers = currentUser?.role === 'admin' 
    ? allUsers 
    : allUsers.filter(u => u.role !== 'admin');

  const statusCounts = {
    all: visibleUsers.length,
    active: visibleUsers.filter(u => u.status === 'active').length,
    pending: visibleUsers.filter(u => u.status === 'pending').length,
    inactive: visibleUsers.filter(u => u.status === 'inactive').length
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
      gradient: 'from-blue-600/80 via-blue-700/80 to-indigo-700/80',
      hoverGradient: 'hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700',
      count: allUsers.filter(u => u.role === 'student').length
    },
    {
      title: 'Parent Management',
      icon: Users,
      route: '/manage/parents',
      visible: canViewParentManagement,
      gradient: 'from-purple-600/80 via-purple-700/80 to-pink-700/80',
      hoverGradient: 'hover:from-purple-600 hover:via-purple-700 hover:to-pink-700',
      count: allUsers.filter(u => u.role === 'parent').length
    },
    {
      title: 'Teacher Management',
      icon: UsersRound,
      route: '/manage/teachers',
      visible: canViewTeacherManagement,
      gradient: 'from-green-600/80 via-green-700/80 to-emerald-700/80',
      hoverGradient: 'hover:from-green-600 hover:via-green-700 hover:to-emerald-700',
      count: allUsers.filter(u => u.role === 'teacher').length
    },
    {
      title: 'Coordinator Management',
      icon: UserCog,
      route: '/manage/coordinators',
      visible: canViewCoordinatorManagement,
      gradient: 'from-orange-600/80 via-orange-700/80 to-red-700/80',
      hoverGradient: 'hover:from-orange-600 hover:via-orange-700 hover:to-red-700',
      count: allUsers.filter(u => u.role === 'coordinator').length
    },
    {
      title: 'Course Manager Management',
      icon: BookOpen,
      route: '/manage/course-managers',
      visible: canViewCourseManagerManagement,
      gradient: 'from-cyan-600/80 via-cyan-700/80 to-blue-700/80',
      hoverGradient: 'hover:from-cyan-600 hover:via-cyan-700 hover:to-blue-700',
      count: allUsers.filter(u => u.role === 'course_manager').length
    },
    {
      title: 'Student Manager Management',
      icon: UserCheck,
      route: '/manage/student-managers',
      visible: canViewStudentManagerManagement,
      gradient: 'from-teal-600/80 via-teal-700/80 to-green-700/80',
      hoverGradient: 'hover:from-teal-600 hover:via-teal-700 hover:to-green-700',
      count: allUsers.filter(u => u.role === 'student_manager').length
    },
    {
      title: 'Manager Management',
      icon: Briefcase,
      route: '/manage/managers',
      visible: canViewManagerManagement,
      gradient: 'from-red-600/80 via-red-700/80 to-rose-700/80',
      hoverGradient: 'hover:from-red-600 hover:via-red-700 hover:to-rose-700',
      count: allUsers.filter(u => u.role === 'manager').length
    },
    {
      title: 'Admin Management',
      icon: Shield,
      route: '/manage/admins',
      visible: canViewAdminManagement,
      gradient: 'from-gray-700/80 via-gray-800/80 to-slate-800/80',
      hoverGradient: 'hover:from-gray-700 hover:via-gray-800 hover:to-slate-800',
      count: allUsers.filter(u => u.role === 'admin').length
    }
  ];

  // Helper function to get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gray-800/60 text-gray-300';
      case 'manager':
        return 'bg-red-800/60 text-red-300';
      case 'course_manager':
        return 'bg-cyan-800/60 text-cyan-300';
      case 'student_manager':
        return 'bg-teal-800/60 text-teal-300';
      case 'coordinator':
        return 'bg-orange-800/60 text-orange-300';
      case 'teacher':
        return 'bg-green-800/60 text-green-300';
      case 'parent':
        return 'bg-purple-800/60 text-purple-300';
      case 'student':
        return 'bg-blue-800/60 text-blue-300';
      default:
        return 'bg-gray-800/60 text-gray-300';
    }
  };

  // Helper function to get role gradient
  const getRoleGradient = (role: string) => {
    switch (role) {
      case 'admin':
        return 'from-gray-700 to-gray-800';
      case 'manager':
        return 'from-red-600 to-rose-700';
      case 'course_manager':
        return 'from-cyan-600 to-blue-700';
      case 'student_manager':
        return 'from-teal-600 to-green-700';
      case 'coordinator':
        return 'from-orange-600 to-red-700';
      case 'teacher':
        return 'from-green-600 to-emerald-700';
      case 'parent':
        return 'from-purple-600 to-pink-700';
      case 'student':
        return 'from-blue-600 to-indigo-700';
      default:
        return 'from-gray-700 to-gray-800';
    }
  };

  // Helper function to get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return Shield;
      case 'manager':
        return Briefcase;
      case 'course_manager':
        return BookOpen;
      case 'student_manager':
        return UserCheck;
      case 'coordinator':
        return UserCog;
      case 'teacher':
        return UsersRound;
      case 'parent':
        return Users;
      case 'student':
        return GraduationCap;
      default:
        return UserIcon;
    }
  };

  // Helper function to format role name for display
  const formatRoleName = (role: string) => {
    if (role === 'course_manager') return 'Course Manager';
    if (role === 'student_manager') return 'Student Manager';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

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
      {/* Header Section - Clean Style */}
      <div className="bg-background-800/50 backdrop-blur-sm rounded-2xl p-6 border border-background-700/50">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
              User Management
            </h1>
            <p className="text-gray-400">
              Comprehensive user oversight • <span className="text-primary-400 font-semibold">{visibleUsers.length}</span> total users registered
            </p>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {statusCounts.pending > 0 && (
              <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 px-4 py-2.5 rounded-xl backdrop-blur-sm">
                <Clock size={16} />
                <span className="text-sm font-medium">
                  {statusCounts.pending} pending
                </span>
              </div>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 bg-primary-600/90 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 font-medium"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
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

      {/* Management Cards Grid - Semi-transparent Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {managementCards.filter(card => card.visible).map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              key={card.route}
              onClick={() => navigate(card.route)}
              className="group relative overflow-hidden bg-background-800/40 backdrop-blur-sm rounded-xl p-5 border border-background-700/50 hover:border-background-600/50 transition-all duration-300 hover:scale-105 text-left"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Subtle gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
              
              <div className="relative z-10">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${card.gradient} mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={24} className="text-white" />
                </div>
                
                <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
                  {card.title}
                </h3>
                
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-white">{card.count}</p>
                  <span className="text-xs text-gray-400 font-medium">users</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* User List Card - Semi-transparent Style */}
      <div className="bg-background-800/40 backdrop-blur-sm rounded-xl border border-background-700/50 overflow-hidden">
        <div className="bg-background-800/60 p-5 border-b border-background-700/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
            {/* Status Filter Tabs - Muted Colors */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All', count: statusCounts.all, bg: 'bg-gray-700/60', hoverBg: 'hover:bg-gray-600/60', activeBg: 'bg-gray-600', icon: Users },
                { key: 'active', label: 'Active', count: statusCounts.active, bg: 'bg-green-700/60', hoverBg: 'hover:bg-green-600/60', activeBg: 'bg-green-600', icon: CheckCircle },
                { key: 'pending', label: 'Pending', count: statusCounts.pending, bg: 'bg-yellow-700/60', hoverBg: 'hover:bg-yellow-600/60', activeBg: 'bg-yellow-600', icon: Clock },
                { key: 'inactive', label: 'Inactive', count: statusCounts.inactive, bg: 'bg-red-700/60', hoverBg: 'hover:bg-red-600/60', activeBg: 'bg-red-600', icon: XCircle }
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
            
            {/* Search and Filters */}
            <div className="flex gap-3 w-full lg:w-auto flex-wrap lg:flex-nowrap">
              <div className="relative flex-1 lg:flex-none lg:w-80">
                <input
                  type="text"
                  placeholder="Search users..."
                  className="w-full bg-background-900/60 text-white rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500/50 border border-background-700/50 focus:border-primary-500/50 transition-all duration-200 placeholder:text-gray-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              </div>
              
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-background-900/60 text-white rounded-lg py-2.5 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none border border-background-700/50 focus:border-primary-500/50 cursor-pointer transition-all duration-200 font-medium"
              >
                <option value="all">All Roles</option>
                {currentUser?.role === 'admin' && <option value="admin">Admin</option>}
                <option value="manager">Manager</option>
                <option value="course_manager">Course Manager</option>
                <option value="student_manager">Student Manager</option>
                <option value="coordinator">Coordinator</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
              </select>
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
                    <Users size={12} />
                    <span>User Details</span>
                  </div>
                </th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden sm:table-cell">Surname</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden md:table-cell">Role</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden lg:table-cell">Status</th>
                <th className="p-4 text-left text-xs uppercase text-gray-400 font-bold tracking-wider hidden xl:table-cell">Joined</th>
                <th className="p-4 text-right text-xs uppercase text-gray-400 font-bold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => {
                const RoleIcon = getRoleIcon(user.role);
                const canManage = canManageUser(user.role);
                
                return (
                  <tr 
                    key={user.uid} 
                    className="border-b border-background-800/30 last:border-0 hover:bg-background-700/20 transition-all duration-200 group"
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {user.profilePictureUrl ? (
                            <div className="h-11 w-11 rounded-xl overflow-hidden border-2 border-background-700/50 shadow-lg group-hover:scale-110 transition-transform duration-200">
                              <img 
                                src={user.profilePictureUrl} 
                                alt={user.name || 'User'} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`h-11 w-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${getRoleGradient(user.role)} shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                              <span className="text-white font-bold text-base">
                                {user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          )}
                          {user.status === 'active' && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-background-800"></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white font-semibold truncate text-sm">{user.userId || 'N/A'}</span>
                            {user.uid === currentUser?.uid && (
                              <span className="text-xs bg-primary-900/60 text-primary-300 px-1.5 py-0.5 rounded font-medium">You</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 truncate">{user.name}</p>
                          <div className="flex items-center gap-2 mt-1 md:hidden">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getRoleColor(user.role)}`}>
                              {formatRoleName(user.role)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300 font-medium hidden sm:table-cell text-sm">{user.surname || 'N/A'}</td>
                    <td className="p-4 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${getRoleColor(user.role)}`}>
                        <RoleIcon size={11} />
                        <span>{formatRoleName(user.role)}</span>
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        user.status === 'active' ? 'bg-green-800/60 text-green-300' :
                        user.status === 'pending' ? 'bg-yellow-800/60 text-yellow-300' :
                        'bg-red-800/60 text-red-300'
                      }`}>
                        {user.status === 'active' && <CheckCircle size={11} />}
                        {user.status === 'pending' && <Clock size={11} />}
                        {user.status === 'inactive' && <XCircle size={11} />}
                        <span className="capitalize">{user.status}</span>
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-sm hidden xl:table-cell">{formatDate(user.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleShowInfo(user)}
                          className="p-2 bg-blue-700/60 hover:bg-blue-600/60 text-white rounded-lg transition-all duration-200 hover:scale-110"
                          title="View user info"
                        >
                          <Info size={14} />
                        </button>
                        <button
                          onClick={() => handleManageUser(user)}
                          disabled={!canManage}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            canManage
                              ? 'bg-purple-700/60 hover:bg-purple-600/60 text-white hover:scale-110 cursor-pointer'
                              : 'bg-gray-700/40 text-gray-500 cursor-not-allowed opacity-50'
                          }`}
                          title={canManage ? "Manage user" : "No permission to manage this user"}
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div className="py-16 text-center">
            <div className="inline-flex p-5 rounded-full bg-background-700/40 mb-5">
              <Users size={48} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Users Found</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' 
                ? 'No users match your current filters.' 
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
                className="mt-5 px-5 py-2.5 bg-primary-600/90 hover:bg-primary-600 text-white rounded-lg transition-all duration-200 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
        
        {/* Summary Footer */}
        {filteredUsers.length > 0 && (
          <div className="bg-background-900/30 px-5 py-3.5 border-t border-background-700/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
              <span>Showing</span>
              <span className="px-2.5 py-1 bg-primary-900/30 text-primary-300 rounded-md font-semibold">
                {filteredUsers.length}
              </span>
              <span>of</span>
              <span className="px-2.5 py-1 bg-background-700/50 text-white rounded-md font-semibold">
                {visibleUsers.length}
              </span>
              <span>users</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={13} />
              <span>Updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && selectedUser && (
        <UserInfoModal
          user={selectedUser}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedUser(null);
          }}
          getRoleGradient={getRoleGradient}
        />
      )}
    </div>
  );
};

// User Info Modal Component - ONLY shows specified fields
interface UserInfoModalProps {
  user: User;
  onClose: () => void;
  getRoleGradient: (role: string) => string;
}

const UserInfoModal = ({ user, onClose, getRoleGradient }: UserInfoModalProps) => {
  // ONLY show these fields as per requirements
  const infoFields = [
    { label: 'Surname', value: user.surname || 'N/A' },
    { label: 'Full Name', value: user.name || user.fullName || 'N/A' },
    { label: 'Primary Mobile', value: user.phoneNumber || 'N/A' },
    { label: 'Secondary Mobile', value: user.mobileNumber || 'N/A' },
    { label: 'Emergency Contact', value: user.emergencyContact || 'N/A' },
    { label: 'Blood Group', value: user.bloodGroup || 'N/A' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-4xl rounded-2xl overflow-hidden border border-background-700/50">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {user.profilePictureUrl ? (
                <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-background-700/50 shadow-lg">
                  <img 
                    src={user.profilePictureUrl} 
                    alt={user.name || 'User'} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${getRoleGradient(user.role)} flex items-center justify-center shadow-lg`}>
                  <span className="text-white font-bold text-2xl">{user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}</span>
                </div>
              )}
              <div>
                <h3 className="text-white font-bold text-xl mb-1">User Information</h3>
                <p className="text-gray-400">{user.name || 'Unknown User'}</p>
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

export default ManageUsers;
