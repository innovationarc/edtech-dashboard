// src/components/profile/ProfileEditModal-1.tsx - Admin Profile Edit Modal
import { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, Mail, Calendar, Users, Droplet, Shield, Camera, Loader, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { profileService1, AdminProfile } from '../../services/profile/profileService-1';
import { uploadService } from '../../services/uploadService';

interface ProfileEditModal1Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const ProfileEditModal1 = ({ onClose, onSuccess }: ProfileEditModal1Props) => {
  const { user } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    surname: user?.surname || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    dob: user?.dob || '',
    gender: user?.gender || '',
    bloodGroup: user?.bloodGroup || '',
    religion: user?.religion || '',
    address: user?.address || '',
    birthCertificateNumber: (user as any)?.birthCertificateNumber || '',
    nid: (user as any)?.nid || ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Profile picture must be less than 5MB');
        return;
      }
      
      setProfilePictureFile(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const formatPhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) return '';
    
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('User not found');
      return;
    }

    if (!formData.surname.trim()) {
      setError('Surname is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let profilePictureUrl = user.profilePictureUrl;
      
      if (profilePictureFile) {
        setUploadProgress(0);
        const uploadResult = await uploadService.uploadToSupabase(
          profilePictureFile,
          'profile_pictures',
          (progress) => {
            setUploadProgress(progress.percentage);
          },
          'public'
        );
        profilePictureUrl = uploadResult.url;
      }

      const updateData: any = {
        surname: formData.surname.trim(),
        fullName: formData.fullName.trim() || undefined,
        email: formData.email.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        dob: formData.dob || undefined,
        gender: formData.gender || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        religion: formData.religion.trim() || undefined,
        address: formData.address.trim() || undefined,
        birthCertificateNumber: formData.birthCertificateNumber.trim() || undefined,
        nid: formData.nid.trim() || undefined,
        profilePictureUrl
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await profileService1.updateAdminProfile(user.uid, updateData);
      
      setSuccess(true);
      
      if ((window as any).refreshUserProfile) {
        await (window as any).refreshUserProfile();
      }
      
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

  if (!user) {
    return null;
  }

  // Success State
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4 shadow-lg">
                <CheckCircle size={64} className="text-green-600" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Profile Updated!
            </h2>
            
            <p className="text-gray-600 text-lg mb-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Your profile has been successfully updated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-8 pt-8 pb-4 border-b-2 border-gray-200 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-6 right-6 p-2 hover:bg-gray-100 disabled:hover:bg-transparent disabled:opacity-50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-gray-600" />
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center shadow-md">
              <User size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Edit Profile
              </h2>
            </div>
          </div>
          <p className="text-gray-600" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Update your personal information
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  {error}
                </p>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-800 text-sm font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Uploading profile picture...
                  </p>
                  <span className="text-blue-600 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Profile Picture */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Camera size={18} className="text-indigo-600" />
                </div>
                Profile Picture
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                    {profilePicturePreview || user.profilePictureUrl ? (
                      <img
                        src={profilePicturePreview || user.profilePictureUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-5xl text-white font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                          {user.surname?.charAt(0) || user.name?.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <label
                    htmlFor="profile-picture-upload"
                    className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full cursor-pointer shadow-lg transition-all duration-200 group-hover:scale-110"
                  >
                    <Camera size={18} />
                    <input
                      id="profile-picture-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm text-gray-600 font-semibold mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Upload a new profile picture
                  </p>
                  <p className="text-xs text-gray-500" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    JPG, PNG or GIF. Max size 5MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <User size={18} className="text-purple-600" />
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Surname */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Surname <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.surname}
                      onChange={(e) => handleInputChange('surname', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter surname"
                      disabled={loading}
                      required
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter full name"
                      disabled={loading}
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter email"
                      disabled={loading}
                    />
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                      <Phone size={18} className="text-gray-400" />
                      <span className="text-gray-900 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>+880</span>
                    </div>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.phoneNumber)}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-[7rem] pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="1623737505"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Date of Birth
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      disabled={loading}
                    />
                    <Calendar size={18} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      disabled={loading}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <Users size={18} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Blood Group
                  </label>
                  <div className="relative">
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
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
                    <Droplet size={18} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Religion */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Religion
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.religion}
                      onChange={(e) => handleInputChange('religion', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter religion"
                      disabled={loading}
                    />
                    <Shield size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileText size={18} className="text-green-600" />
                </div>
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Birth Certificate Number */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Birth Certificate Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.birthCertificateNumber}
                      onChange={(e) => handleInputChange('birthCertificateNumber', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter birth certificate number"
                      disabled={loading}
                    />
                    <FileText size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* NID */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    National ID (NID)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.nid}
                      onChange={(e) => handleInputChange('nid', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter NID number"
                      disabled={loading}
                    />
                    <FileText size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <MapPin size={18} className="text-blue-600" />
                </div>
                Address
              </h3>
              <div className="relative">
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 resize-none font-semibold"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  placeholder="Enter your complete address"
                  rows={3}
                  disabled={loading}
                />
                <MapPin size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900 rounded-xl transition-all duration-200 border-2 border-gray-300 font-bold"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.surname.trim()}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-bold shadow-lg hover:shadow-xl"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {loading && <Loader size={18} className="animate-spin" />}
                <CheckCircle size={18} />
                <span>{loading ? 'Updating...' : 'Update Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditModal1;
