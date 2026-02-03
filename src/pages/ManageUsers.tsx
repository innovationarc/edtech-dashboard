// src/pages/ManageUsers.tsx
import { useState, useEffect } from 'react';
import { Search, Loader, CheckCircle, XCircle, Clock, RefreshCw, Filter, Info, Edit, Users, GraduationCap, UserCog, Shield, Briefcase, UsersRound, X, User as UserIcon, BookOpen, UserCheck } from 'lucide-react';
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

  // Function to check if current user can edit a specific user based on their role
  const canEditUser = (userRole: string): boolean => {
    if (!currentUser) return false;
    
    switch (currentUser.role) {
      case 'admin':
        // Admin can edit ALL roles
        return true;
      
      case 'manager':
        // Manager can edit all EXCEPT Admin and Manager
        return userRole !== 'admin' && userRole !== 'manager';
      
      case 'coordinator':
        // Coordinator can edit ONLY Student and Parent
        return userRole === 'student' || userRole === 'parent';
      
      case 'student_manager':
        // Student Manager can edit ONLY Student and Parent
        return userRole === 'student' || userRole === 'parent';
      
      case 'course_manager':
        // Course Manager can edit ONLY Teacher, Student, and Parent
        return userRole === 'teacher' || userRole === 'student' || userRole === 'parent';
      
      default:
        // Teacher, Student, Parent cannot edit anyone
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

  const handleQuickEdit = (user: User) => {
    // Check if current user has permission to edit this user
    if (!canEditUser(user.role)) {
      setError('You do not have permission to edit this user.');
      return;
    }
    setSelectedUser(user);
    setShowQuickEditModal(true);
  };

  const handleManageUser = (user: User) => {
    // Check if current user has permission to manage this user
    if (!canEditUser(user.role)) {
      setError('You do not have permission to manage this user.');
      return;
    }
    
    // Navigate to role-specific management page
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
      navigate(route, { state: { userId: user.uid } });
    }
  };

  const handleSaveQuickEdit = async (updates: Partial<User>) => {
    if (!selectedUser) return;
    
    try {
      setError('');
      await userService.updateUser(selectedUser.uid, updates);
      
      // Update local state
      setAllUsers(allUsers.map(u => 
        u.uid === selectedUser.uid ? { ...u, ...updates } : u
      ));
      
      setSuccessMessage('User updated successfully');
      setShowQuickEditModal(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Update error:', error);
      setError(error.message || 'Failed to update user');
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

  const formatRoleName = (role: string): string => {
    const roleNames: Record<string, string> = {
      admin: 'Admin',
      manager: 'Manager',
      course_manager: 'Course Manager',
      student_manager: 'Student Manager',
      coordinator: 'Coordinator',
      teacher: 'Teacher',
      parent: 'Parent',
      student: 'Student'
    };
    return roleNames[role] || role;
  };

  const getRoleIcon = (role: string) => {
    const roleIcons: Record<string, any> = {
      admin: Shield,
      manager: Briefcase,
      course_manager: BookOpen,
      student_manager: UserCheck,
      coordinator: UserCog,
      teacher: GraduationCap,
      parent: UsersRound,
      student: UserIcon
    };
    return roleIcons[role] || UserIcon;
  };

  const getRoleGradient = (role: string): string => {
    const roleGradients: Record<string, string> = {
      admin: 'from-red-600 to-red-700',
      manager: 'from-purple-600 to-purple-700',
      course_manager: 'from-indigo-600 to-indigo-700',
      student_manager: 'from-teal-600 to-teal-700',
      coordinator: 'from-blue-600 to-blue-700',
      teacher: 'from-green-600 to-green-700',
      parent: 'from-orange-600 to-orange-700',
      student: 'from-cyan-600 to-cyan-700'
    };
    return roleGradients[role] || 'from-gray-600 to-gray-700';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700/30', label: 'Active' },
      inactive: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700/30', label: 'Inactive' },
      pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700/30', label: 'Pending' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  // Calculate statistics for role cards - exclude Admins from non-Admin users
  const visibleUsers = currentUser?.role === 'admin' 
    ? allUsers 
    : allUsers.filter(u => u.role !== 'admin');
    
  const stats = {
    total: visibleUsers.length,
    active: visibleUsers.filter(u => u.status === 'active').length,
    pending: visibleUsers.filter(u => u.status === 'pending').length,
    inactive: visibleUsers.filter(u => u.status === 'inactive').length,
    byRole: {
      admin: allUsers.filter(u => u.role === 'admin').length,
      manager: allUsers.filter(u => u.role === 'manager').length,
      course_manager: allUsers.filter(u => u.role === 'course_manager').length,
      student_manager: allUsers.filter(u => u.role === 'student_manager').length,
      coordinator: allUsers.filter(u => u.role === 'coordinator').length,
      teacher: allUsers.filter(u => u.role === 'teacher').length,
      parent: allUsers.filter(u => u.role === 'parent').length,
      student: allUsers.filter(u => u.role === 'student').length,
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-gray-400">Manage and monitor all users across the platform</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600/90 hover:bg-primary-600 text-white rounded-xl transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-green-300 font-medium">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-green-400 hover:text-green-300 transition-colors">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <XCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-red-300 font-medium">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 transition-colors">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Total Users</p>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
            </div>
            <Users className="text-blue-400" size={40} />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-700/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Active</p>
              <p className="text-3xl font-bold text-white">{stats.active}</p>
            </div>
            <CheckCircle className="text-green-400" size={40} />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 border-yellow-700/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Pending</p>
              <p className="text-3xl font-bold text-white">{stats.pending}</p>
            </div>
            <Clock className="text-yellow-400" size={40} />
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-700/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Inactive</p>
              <p className="text-3xl font-bold text-white">{stats.inactive}</p>
            </div>
            <XCircle className="text-red-400" size={40} />
          </div>
        </Card>
      </div>

      {/* Role Management Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canViewAdminManagement && (
          <Card 
            className="bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/admins')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Admins</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.admin}</p>
              </div>
              <Shield className="text-red-400" size={40} />
            </div>
          </Card>
        )}

        {canViewManagerManagement && (
          <Card 
            className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/managers')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Managers</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.manager}</p>
              </div>
              <Briefcase className="text-purple-400" size={40} />
            </div>
          </Card>
        )}

        {canViewCourseManagerManagement && (
          <Card 
            className="bg-gradient-to-br from-indigo-900/20 to-indigo-800/10 border-indigo-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/course-managers')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Course Managers</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.course_manager}</p>
              </div>
              <BookOpen className="text-indigo-400" size={40} />
            </div>
          </Card>
        )}

        {canViewStudentManagerManagement && (
          <Card 
            className="bg-gradient-to-br from-teal-900/20 to-teal-800/10 border-teal-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/student-managers')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Student Managers</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.student_manager}</p>
              </div>
              <UserCheck className="text-teal-400" size={40} />
            </div>
          </Card>
        )}

        {canViewCoordinatorManagement && (
          <Card 
            className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/coordinators')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Coordinators</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.coordinator}</p>
              </div>
              <UserCog className="text-blue-400" size={40} />
            </div>
          </Card>
        )}

        {canViewTeacherManagement && (
          <Card 
            className="bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/teachers')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Teachers</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.teacher}</p>
              </div>
              <GraduationCap className="text-green-400" size={40} />
            </div>
          </Card>
        )}

        {canViewParentManagement && (
          <Card 
            className="bg-gradient-to-br from-orange-900/20 to-orange-800/10 border-orange-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/parents')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Parents</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.parent}</p>
              </div>
              <UsersRound className="text-orange-400" size={40} />
            </div>
          </Card>
        )}

        {canViewStudentManagement && (
          <Card 
            className="bg-gradient-to-br from-cyan-900/20 to-cyan-800/10 border-cyan-700/20 cursor-pointer hover:scale-105 transition-transform duration-200"
            onClick={() => navigate('/manage/students')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Students</p>
                <p className="text-3xl font-bold text-white">{stats.byRole.student}</p>
              </div>
              <UserIcon className="text-cyan-400" size={40} />
            </div>
          </Card>
        )}
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, phone, or user ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background-900/60 text-white rounded-lg py-2.5 pl-10 pr-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-all duration-200 font-medium"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={20} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-all duration-200 font-medium"
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
      </Card>

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader className="animate-spin text-primary-500 mb-4" size={40} />
            <p className="text-gray-400">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Users className="text-gray-600 mb-4" size={60} />
            <p className="text-gray-400 text-lg">No users found</p>
            <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or search term</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-background-700/50">
                  <th className="text-left py-4 px-4 text-gray-400 font-semibold text-sm">User</th>
                  <th className="text-left py-4 px-4 text-gray-400 font-semibold text-sm">Role</th>
                  <th className="text-left py-4 px-4 text-gray-400 font-semibold text-sm">Contact</th>
                  <th className="text-left py-4 px-4 text-gray-400 font-semibold text-sm">Status</th>
                  <th className="text-left py-4 px-4 text-gray-400 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);
                  const canEdit = canEditUser(user.role);
                  
                  return (
                    <tr key={user.uid} className="border-b border-background-700/30 hover:bg-background-700/20 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          {user.profilePictureUrl ? (
                            <div className="h-10 w-10 rounded-xl overflow-hidden border-2 border-background-700/50">
                              <img 
                                src={user.profilePictureUrl} 
                                alt={user.name || 'User'} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${getRoleGradient(user.role)} flex items-center justify-center`}>
                              <span className="text-white font-bold text-sm">{user.surname?.charAt(0) || user.name?.charAt(0) || 'U'}</span>
                            </div>
                          )}
                          <div>
                            <p className="text-white font-semibold">{user.name || 'Unknown'}</p>
                            <p className="text-gray-400 text-sm">{user.userId || user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <RoleIcon size={16} className="text-gray-400" />
                          <span className="text-white font-medium capitalize">{formatRoleName(user.role)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-white text-sm">{user.phoneNumber || 'N/A'}</p>
                          <p className="text-gray-400 text-xs">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleShowInfo(user)}
                            className="p-2 bg-blue-700/30 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all duration-200"
                            title="View Info"
                          >
                            <Info size={16} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleQuickEdit(user)}
                              className="p-2 bg-green-700/30 hover:bg-green-600/40 text-green-300 rounded-lg transition-all duration-200"
                              title="Quick Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Info Modal */}
      {showInfoModal && selectedUser && (
        <InfoModal
          user={selectedUser}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedUser(null);
          }}
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
          onSave={handleSaveQuickEdit}
          onManage={handleManageUser}
          formatRoleName={formatRoleName}
          getRoleIcon={getRoleIcon}
        />
      )}
    </div>
  );
};

// Info Modal Component - Shows ONLY specified fields
interface InfoModalProps {
  user: User;
  onClose: () => void;
}

const InfoModal = ({ user, onClose }: InfoModalProps) => {
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
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-2xl rounded-2xl overflow-hidden border border-background-700/50">
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
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

// Quick Edit Modal Component
interface QuickEditModalProps {
  user: User;
  onClose: () => void;
  onSave: (updates: Partial<User>) => void;
  onManage: (user: User) => void;
  formatRoleName: (role: string) => string;
  getRoleIcon: (role: string) => any;
}

const QuickEditModal = ({ user, onClose, onSave, onManage, formatRoleName, getRoleIcon }: QuickEditModalProps) => {
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

  const RoleIcon = getRoleIcon(user.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-800/95 backdrop-blur-xl w-full max-w-md rounded-2xl overflow-hidden border border-background-700/50">
        <div className="p-5 border-b border-background-700/50 bg-background-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-xl mb-1">Quick Edit</h3>
              <p className="text-gray-400">{user.name || 'Unknown User'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 p-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3.5">
            <p className="text-xs text-blue-300 font-semibold mb-1.5 uppercase">Role (Non-editable)</p>
            <p className="text-white font-semibold capitalize flex items-center gap-2">
              <RoleIcon size={16} />
              <span>{formatRoleName(user.role)}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Surname</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
              placeholder="Enter surname"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
              placeholder="Enter phone number"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all duration-200"
              placeholder="Enter email address"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full bg-background-900/60 text-white rounded-lg py-2.5 px-4 border border-background-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer transition-all duration-200 font-medium"
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
              className="flex-1 px-5 py-2.5 bg-background-700/60 hover:bg-background-600/60 text-white rounded-lg transition-all duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-2.5 bg-green-700/80 hover:bg-green-600/80 text-white rounded-lg transition-all duration-200 font-semibold"
            >
              Save
            </button>
          </div>

          <button
            type="button"
            onClick={() => onManage(user)}
            className="w-full px-5 py-2.5 bg-blue-700/80 hover:bg-blue-600/80 text-white rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2"
          >
            <UserCog size={16} />
            <span>Advanced Management</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManageUsers;
