import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, Search, Loader, CheckCircle, XCircle, Clock, UserCheck, Shield, RefreshCw, Filter } from 'lucide-react';
import Card from '../components/ui/Card';
import { userService, User } from '../services/userService';
import { authService } from '../services/authService';
import { useDashboard } from '../contexts/DashboardContext';

const ManageUsers = () => {
  const { user: currentUser } = useDashboard();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentUser_edit, setCurrentUser_edit] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setError('Access denied. Only administrators can manage users.');
      setLoading(false);
      return;
    }
    loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading all users...');
      
      // Get all users regardless of status
      const usersData = await userService.getAllUsers();
      
      console.log('All users loaded:', usersData.length);
      console.log('Users by status:', {
        active: usersData.filter(u => u.status === 'active').length,
        pending: usersData.filter(u => u.status === 'pending').length,
        inactive: usersData.filter(u => u.status === 'inactive').length
      });
      
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

  const handleAddUser = () => {
    if (!isAdmin) {
      setError('Only administrators can add users.');
      return;
    }
    setCurrentUser_edit(null);
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    if (!isAdmin) {
      setError('Only administrators can edit users.');
      return;
    }
    setCurrentUser_edit(user);
    setShowModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) {
      setError('Only administrators can delete users.');
      return;
    }
    
    if (userId === currentUser?.uid) {
      setError('You cannot delete your own account.');
      return;
    }
    
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await userService.deleteUser(userId);
        setAllUsers(allUsers.filter(user => user.uid !== userId));
      } catch (error: any) {
        setError(error.message);
      }
    }
  };

  const handleApproveUser = async (userId: string) => {
    if (!isAdmin) {
      setError('Only administrators can approve users.');
      return;
    }
    
    try {
      if (!currentUser) {
        setError('You must be logged in to approve users');
        return;
      }
      
      console.log('Approving user:', userId);
      
      await authService.approveUser(userId, currentUser.uid);
      
      // Update user status in the list
      setAllUsers(prevUsers => 
        prevUsers.map(user => 
          user.uid === userId 
            ? { 
                ...user, 
                status: 'active' as const,
                approvedBy: currentUser.uid,
                approvedAt: new Date()
              }
            : user
        )
      );
      
      console.log('User approved and status updated');
    } catch (error: any) {
      console.error('Error approving user:', error);
      setError(error.message);
    }
  };

  const handleRejectUser = async (userId: string) => {
    if (!isAdmin) {
      setError('Only administrators can reject users.');
      return;
    }
    
    if (confirm('Are you sure you want to reject this user? This will deactivate their account.')) {
      try {
        console.log('Rejecting user:', userId);
        
        await authService.rejectUser(userId);
        
        // Update user status in the list
        setAllUsers(prevUsers => 
          prevUsers.map(user => 
            user.uid === userId 
              ? { ...user, status: 'inactive' as const }
              : user
          )
        );
        
        console.log('User rejected and status updated');
      } catch (error: any) {
        console.error('Error rejecting user:', error);
        setError(error.message);
      }
    }
  };

  const handleSaveUser = async (userData: any) => {
    if (!isAdmin) {
      setError('Only administrators can save user data.');
      return;
    }
    
    try {
      if (currentUser_edit) {
        // Update existing user
        await userService.updateUser(currentUser_edit.uid, userData);
        setAllUsers(allUsers.map(user => 
          user.uid === currentUser_edit.uid ? { ...user, ...userData } : user
        ));
      } else {
        // Create new user (admin-created users are automatically active)
        const newUser = await authService.createUser(
          userData.email, 
          userData.password || 'defaultPassword123',
          userData.name,
          userData.role,
          false // Don't require approval for admin-created users
        );
        setAllUsers([{ ...newUser, status: 'active' }, ...allUsers]);
      }
      setShowModal(false);
    } catch (error: any) {
      setError(error.message);
    }
  };

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Shield size={64} className="text-error-DEFAULT" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400 text-center max-w-md">
          Only administrators can access the user management section. Please contact an admin if you need access.
        </p>
      </div>
    );
  }

  // Filter users based on search term, status, and role
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Users</h1>
          <p className="text-sm text-gray-400 mt-1">
            Administrator access required • Total: {allUsers.length} users
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {statusCounts.pending > 0 && (
            <div className="flex items-center gap-2 bg-warning-dark text-warning-light px-3 py-2 rounded-lg">
              <Clock size={16} />
              <span className="text-sm font-medium">
                {statusCounts.pending} user{statusCounts.pending !== 1 ? 's' : ''} pending approval
              </span>
            </div>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-background-800 hover:bg-background-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-error-dark text-error-light px-4 py-2 rounded">
          {error}
        </div>
      )}
      
      <Card>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          {/* Status Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'All Users', count: statusCounts.all, color: 'bg-background-800' },
              { key: 'active', label: 'Active', count: statusCounts.active, color: 'bg-success-dark' },
              { key: 'pending', label: 'Pending', count: statusCounts.pending, color: 'bg-warning-DEFAULT' },
              { key: 'inactive', label: 'Inactive', count: statusCounts.inactive, color: 'bg-error-DEFAULT' }
            ].map((status) => (
              <button
                key={status.key}
                onClick={() => setStatusFilter(status.key as any)}
                className={`px-4 py-2 rounded-lg transition-colors relative ${
                  statusFilter === status.key
                    ? status.color + ' text-white'
                    : 'bg-background-800 text-gray-400 hover:text-white'
                }`}
              >
                {status.label} ({status.count})
                {status.key === 'pending' && status.count > 0 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
                )}
              </button>
            ))}
          </div>
          
          {/* Search and Filters */}
          <div className="flex gap-4 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <input
                type="text"
                placeholder="Search users..."
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
              <Filter size={18} className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" />
            </div>
            
            <button
              onClick={handleAddUser}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition-colors whitespace-nowrap"
            >
              <UserPlus size={18} />
              <span>Add User</span>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-background-800">
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">User</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">Email</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">Role</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">Status</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">Join Date</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">Last Login</th>
                <th className="p-4 text-xs uppercase text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="border-b border-background-800 last:border-0 hover:bg-background-800/50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        user.role === 'admin' ? 'bg-secondary-700' :
                        user.role === 'teacher' ? 'bg-accent-700' : 'bg-primary-700'
                      }`}>
                        <span className="text-white font-medium">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white">{user.name}</span>
                          {user.uid === currentUser?.uid && (
                            <span className="text-xs bg-primary-900 text-primary-300 px-2 py-0.5 rounded">You</span>
                          )}
                        </div>
                        {user.approvedBy && user.approvedAt && (
                          <p className="text-xs text-gray-500">
                            Approved {user.approvedAt.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300">{user.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' 
                        ? 'bg-secondary-900 text-secondary-300' 
                        : user.role === 'teacher'
                        ? 'bg-accent-900 text-accent-300'
                        : 'bg-primary-900 text-primary-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 w-fit ${
                      user.status === 'active' 
                        ? 'bg-success-dark text-success-light' 
                        : user.status === 'pending'
                        ? 'bg-warning-dark text-warning-light'
                        : 'bg-error-dark text-error-light'
                    }`}>
                      {user.status === 'active' && <CheckCircle size={12} />}
                      {user.status === 'pending' && <Clock size={12} />}
                      {user.status === 'inactive' && <XCircle size={12} />}
                      {user.status === 'active' ? 'Active' : user.status === 'pending' ? 'Pending' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">
                    {user.createdAt.toLocaleDateString()}
                  </td>
                  <td className="p-4 text-gray-300">
                    {user.lastLogin ? user.lastLogin.toLocaleDateString() : 'Never'}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {/* Approval actions for pending users */}
                      {user.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveUser(user.uid)}
                            className="flex items-center gap-1 px-2 py-1 bg-success-DEFAULT hover:bg-success-dark text-white rounded text-xs transition-colors"
                            title="Approve user"
                          >
                            <UserCheck size={12} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleRejectUser(user.uid)}
                            className="flex items-center gap-1 px-2 py-1 bg-error-DEFAULT hover:bg-error-dark text-white rounded text-xs transition-colors"
                            title="Reject user"
                          >
                            <XCircle size={12} />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      
                      {/* Standard edit/delete actions */}
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded transition-colors"
                        disabled={user.uid === currentUser?.uid}
                        title={user.uid === currentUser?.uid ? "Cannot edit your own account" : "Edit user"}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.uid)}
                        className="p-1.5 bg-background-700 hover:bg-error-DEFAULT text-gray-400 hover:text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="py-8 text-center text-gray-400">
            {searchTerm || statusFilter !== 'all' || roleFilter !== 'all' 
              ? 'No users found matching your search criteria.' 
              : 'No users found.'
            }
          </div>
        )}
        
        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-background-800 flex justify-between items-center text-sm text-gray-400">
          <div>
            Showing {filteredUsers.length} of {allUsers.length} users
            {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
              <span className="ml-2">
                (filtered by: {[
                  searchTerm && `search: "${searchTerm}"`,
                  statusFilter !== 'all' && `status: ${statusFilter}`,
                  roleFilter !== 'all' && `role: ${roleFilter}`
                ].filter(Boolean).join(', ')})
              </span>
            )}
          </div>
          <div>Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
      </Card>
      
      {showModal && (
        <UserModal
          user={currentUser_edit}
          onClose={() => setShowModal(false)}
          onSave={handleSaveUser}
        />
      )}
    </div>
  );
};

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (userData: any) => void;
}

const UserModal = ({ user, onClose, onSave }: UserModalProps) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'student',
    status: user?.status || 'active',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (!user && !formData.password) {
      alert('Password is required for new users');
      return;
    }
    
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-card w-full max-w-md rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-background-800">
          <h3 className="text-white font-medium">
            {user ? 'Edit User' : 'Add New User'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {user ? 'Update user information' : 'Create a new user account'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          
          {!user && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password *</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required={!user}
                minLength={6}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          
          {!user && (
            <div className="bg-primary-900/20 border border-primary-500/30 rounded-lg p-3">
              <p className="text-sm text-primary-300 font-medium">Admin Created Account</p>
              <p className="text-xs text-gray-400 mt-1">
                Accounts created by administrators are automatically approved and do not require email verification.
              </p>
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background-800 hover:bg-background-700 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
            >
              {user ? 'Update User' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManageUsers;