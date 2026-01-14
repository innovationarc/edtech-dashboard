import { useState } from 'react';
import { X, User, Phone, MapPin, GraduationCap, Building, Hash, Camera, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { userService } from '../../services/userService';

interface ProfileEditModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ProfileEditModal = ({ onClose, onSuccess }: ProfileEditModalProps) => {
  const { user } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    address: user?.address || '',
    class: user?.class || '',
    school: user?.school || '',
    college: user?.college || '',
    mobileNumber: user?.mobileNumber || '',
    registrationNumber: user?.registrationNumber || ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user starts typing
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Profile picture must be less than 5MB');
        return;
      }
      
      setProfilePictureFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('User not found');
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let profilePictureUrl = user.profilePictureUrl;
      
      // Upload profile picture if a new one was selected
      if (profilePictureFile) {
        profilePictureUrl = await userService.uploadProfilePicture(profilePictureFile, user.uid);
      }

      // Update user profile
      const updateData = {
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        class: formData.class.trim() || undefined,
        school: formData.school.trim() || undefined,
        college: formData.college.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim() || undefined,
        registrationNumber: formData.registrationNumber.trim() || undefined,
        profilePictureUrl
      };

      await userService.updateUser(user.uid, updateData);
      
      setSuccess(true);
      
      // Show success message briefly, then close
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={64} className="text-success-DEFAULT" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">Profile Updated!</h2>
            
            <div className="bg-success-dark text-success-light px-4 py-3 rounded-lg">
              <p>Your profile has been updated successfully. The changes will be reflected across the platform.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-lg bg-primary-600 flex items-center justify-center">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
              <p className="text-gray-400">Update your personal information</p>
            </div>
          </div>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full overflow-hidden bg-background-800 flex items-center justify-center">
                    {profilePicturePreview ? (
                      <img
                        src={profilePicturePreview}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                      />
                    ) : user?.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt="Current profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-white font-medium">
                        {user?.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 h-6 w-6 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors">
                    <Camera size={12} className="text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Upload new picture</p>
                  <p className="text-xs text-gray-400">JPG, PNG or GIF (max 5MB)</p>
                  {profilePictureFile && (
                    <p className="text-xs text-success-DEFAULT mt-1">
                      New image selected: {profilePictureFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    placeholder="Enter your full name"
                    disabled={loading}
                    required
                  />
                  <User size={16} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full bg-background-700 text-gray-400 rounded-lg py-3 pl-10 pr-4 cursor-not-allowed"
                    disabled
                    readOnly
                  />
                  <User size={16} className="absolute left-3 top-3.5 text-gray-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed for security reasons
                </p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                    className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    placeholder="Enter your mobile number"
                    disabled={loading}
                  />
                  <Phone size={16} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Registration Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.registrationNumber}
                    className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    disabled
                    readOnly
                  />
                  <Hash size={16} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Address
              </label>
              <div className="relative">
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                  placeholder="Enter your address"
                  rows={3}
                  disabled={loading}
                />
                <MapPin size={16} className="absolute left-3 top-3.5 text-gray-400" />
              </div>
            </div>

            {/* Educational Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user?.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Class/Grade
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.class}
                      onChange={(e) => handleInputChange('class', e.target.value)}
                      className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                      placeholder="Enter your class/grade"
                      disabled={loading}
                    />
                    <GraduationCap size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  School
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) => handleInputChange('school', e.target.value)}
                    className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    placeholder="Enter your school name"
                    disabled={loading}
                  />
                  <Building size={16} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>

              <div className={user?.role === 'student' ? '' : 'md:col-span-2'}>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  College/University
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.college}
                    onChange={(e) => handleInputChange('college', e.target.value)}
                    className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                    placeholder="Enter your college/university name"
                    disabled={loading}
                  />
                  <GraduationCap size={16} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Role Information */}
            <div className="bg-background-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  user?.role === 'student' ? 'bg-accent-700' : 
                  user?.role === 'teacher' ? 'bg-secondary-700' : 
                  'bg-primary-700'
                }`}>
                  <User size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Account Type</p>
                  <p className={`text-sm capitalize ${
                    user?.role === 'student' ? 'text-accent-400' : 
                    user?.role === 'teacher' ? 'text-secondary-400' : 
                    'text-primary-400'
                  }`}>
                    {user?.role}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-background-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-2 bg-background-800 hover:bg-background-700 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {loading && <Loader size={16} className="animate-spin" />}
                <User size={16} />
                <span>{loading ? 'Updating...' : 'Update Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal;