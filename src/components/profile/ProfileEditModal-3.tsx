// src/components/profile/ProfileEditModal-3.tsx — Teacher Profile Edit Modal
import { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, GraduationCap, Hash, Camera, Loader, AlertCircle, CheckCircle, Mail, Calendar, Droplet, Shield } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { userService } from '../../services/userService';
import { uploadService } from '../../services/uploadService';

interface ProfileEditModal3Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const ProfileEditModal3 = ({ onClose, onSuccess }: ProfileEditModal3Props) => {
  const { user } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: user?.address || '',
    college: user?.college || '',
    mobileNumber: user?.mobileNumber || '',
    phoneNumber: user?.phoneNumber || '',
    bloodGroup: user?.bloodGroup || '',
    gender: user?.gender || '',
    religion: user?.religion || '',
    dob: user?.dob || ''
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

    if (!formData.name.trim()) {
      setError('Name is required');
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
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        college: formData.college.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        gender: formData.gender || undefined,
        religion: formData.religion.trim() || undefined,
        dob: formData.dob || undefined,
        profilePictureUrl
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await userService.updateUser(user.uid, updateData);
      
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
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-lg flex items-center justify-center z-[200] p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-500/15 rounded-full p-4 shadow-lg">
                <CheckCircle size={64} className="text-green-400" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-slate-100 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Profile Updated!
            </h2>
            
            <div className="bg-green-950/40 text-green-300 px-6 py-4 rounded-xl border border-green-800/30">
              <p className="font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Your profile has been updated successfully. The changes will be reflected across the platform.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-lg flex items-center justify-center z-[200] p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl w-full max-w-4xl relative shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="edit-profile-scroll overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 bg-slate-900 px-6 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-slate-700/50 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute right-4 top-4 sm:right-6 sm:top-6 text-slate-400 hover:text-slate-100 transition-all duration-200 hover:rotate-90 hover:scale-110 z-10 bg-slate-800 rounded-full p-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={24} />
          </button>

          <div className="flex items-center gap-4 pr-14">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
                <User size={32} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Edit Profile
              </h2>
              <p className="text-slate-400 text-sm mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Update your personal information</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 relative">
          {error && (
            <div className="bg-red-950/40 border border-red-800/30 text-red-300 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50">
              <label className="block text-sm font-bold text-slate-200 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Profile Picture
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="h-28 w-28 rounded-2xl overflow-hidden bg-slate-800 shadow-lg border-2 border-slate-700/60">
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
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-4xl text-white font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                          {user?.name?.charAt(0) || user?.surname?.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 h-10 w-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-all duration-200 shadow-lg">
                    <Camera size={18} className="text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-slate-100 font-bold mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Upload new picture</p>
                  <p className="text-sm text-slate-400 mb-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>JPG, PNG or GIF (max 5MB)</p>
                  {profilePictureFile && (
                    <div className="bg-green-950/40 border border-green-800/30 text-green-300 px-3 py-2 rounded-lg text-xs inline-block font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                      ✓ New image selected: {profilePictureFile.name}
                    </div>
                  )}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Uploading... {uploadProgress}%</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <User size={18} className="text-indigo-400" />
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Surname - Non-editable */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Surname
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.surname || ''}
                      className="w-full bg-slate-800/60 text-slate-400 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-slate-700/60 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      disabled
                      readOnly
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Cannot be changed</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter your full name"
                      disabled={loading}
                      required
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter your email"
                      disabled={loading}
                    />
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Date of Birth
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark' }}
                      disabled={loading}
                    />
                    <Calendar size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-4 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark' }}
                    disabled={loading}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Blood Group
                  </label>
                  <div className="relative">
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif', colorScheme: 'dark' }}
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
                    <Droplet size={18} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Religion */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Religion
                  </label>
                  <input
                    type="text"
                    value={formData.religion}
                    onChange={(e) => handleInputChange('religion', e.target.value)}
                    className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-4 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                    placeholder="Your religion"
                    disabled={loading}
                  />
                </div>

                {/* User ID - Non-editable */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    User ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.userId || ''}
                      className="w-full bg-slate-800/60 text-slate-400 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-slate-700/60 font-mono font-bold"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      disabled
                      readOnly
                    />
                    <Hash size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Cannot be changed</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <Phone size={18} className="text-purple-400" />
                </div>
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                      <Phone size={18} className="text-slate-500" />
                      <span className="text-slate-100 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>+880</span>
                    </div>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.phoneNumber)}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-[7rem] pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="1623737505"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Enter mobile number"
                      disabled={loading}
                    />
                    <Phone size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <MapPin size={18} className="text-blue-400" />
                </div>
                Address
              </h3>
              <div className="relative">
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 resize-none font-semibold"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  placeholder="Enter your complete address"
                  rows={3}
                  disabled={loading}
                />
                <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-slate-800/40 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <GraduationCap size={18} className="text-green-400" />
                </div>
                Professional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Institution */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Institution
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.college}
                      onChange={(e) => handleInputChange('college', e.target.value)}
                      className="w-full bg-slate-800/60 text-slate-100 rounded-xl py-3 pl-11 pr-4 border-2 border-slate-700/60 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                      placeholder="Where you teach"
                      disabled={loading}
                    />
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Registration Number - Non-editable */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    Registration Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.registrationNumber || ''}
                      className="w-full bg-slate-800/60 text-slate-400 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-slate-700/60 font-mono font-bold"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      disabled
                      readOnly
                    />
                    <Hash size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Cannot be changed</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-slate-700/50">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:text-slate-500 text-slate-100 rounded-xl transition-all duration-200 border-2 border-slate-700/60 font-bold"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
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

      <style>{`
        .edit-profile-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148,163,184,0.35) transparent;
        }
        .edit-profile-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .edit-profile-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .edit-profile-scroll::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.35);
          border-radius: 999px;
        }
        .edit-profile-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148,163,184,0.55);
        }
      `}</style>
    </div>
  );
};

export default ProfileEditModal3;
