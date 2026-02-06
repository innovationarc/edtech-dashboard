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
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-md p-8 relative shadow-2xl animate-fadeIn">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-950/50 border border-emerald-800/30 rounded-full p-4 shadow-lg animate-scaleIn">
                <CheckCircle size={64} className="text-emerald-400" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-slate-100 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Profile Updated!
            </h2>
            
            <p className="text-slate-400 text-lg mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Your profile has been successfully updated.
            </p>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes scaleIn {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
          .animate-scaleIn {
            animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-4xl relative shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 rounded-t-2xl px-8 pt-8 pb-4 border-b border-slate-700/30 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-6 right-6 p-2 hover:bg-slate-800 disabled:hover:bg-transparent disabled:opacity-50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-slate-400 hover:text-slate-300" />
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center shadow-md">
              <User size={24} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-100" style={{ fontFamily: 'Inter, sans-serif' }}>
                Edit Profile
              </h2>
            </div>
          </div>
          <p className="text-slate-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            Update your personal information and profile details
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-950/50 border border-red-800/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="bg-blue-950/50 border border-blue-800/30 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Loader size={20} className="text-blue-400 animate-spin" />
                  <p className="text-blue-300 text-sm font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Uploading profile picture... {uploadProgress}%
                  </p>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Profile Picture Section */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                  <Camera size={18} className="text-slate-400" />
                </div>
                Profile Picture
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-md bg-slate-800">
                    {profilePicturePreview ? (
                      <img
                        src={profilePicturePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : user.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt="Current"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                        <User size={40} className="text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                      disabled={loading}
                    />
                    <div className="px-4 py-2 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg transition-all duration-200 inline-flex items-center gap-2 font-medium shadow-md">
                      <Camera size={18} />
                      <span>Choose New Picture</span>
                    </div>
                  </label>
                  <p className="text-sm text-slate-500 mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                  <User size={18} className="text-slate-400" />
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Surname */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Surname <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.surname}
                      onChange={(e) => handleInputChange('surname', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter surname"
                      required
                      disabled={loading}
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter full name"
                      disabled={loading}
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter email address"
                      disabled={loading}
                    />
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter phone number"
                      disabled={loading}
                    />
                    <Phone size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                  <Users size={18} className="text-slate-400" />
                </div>
                Personal Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Date of Birth
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      disabled={loading}
                    />
                    <Calendar size={18} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      disabled={loading}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <Users size={18} className="absolute left-3.5 top-3.5 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {/* Blood Group */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Blood Group
                  </label>
                  <div className="relative">
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold cursor-pointer"
                      style={{ fontFamily: 'Inter, sans-serif' }}
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
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Religion
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.religion}
                      onChange={(e) => handleInputChange('religion', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter religion"
                      disabled={loading}
                    />
                    <Shield size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                  <FileText size={18} className="text-slate-400" />
                </div>
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Birth Certificate Number */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Birth Certificate Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.birthCertificateNumber}
                      onChange={(e) => handleInputChange('birthCertificateNumber', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter birth certificate number"
                      disabled={loading}
                    />
                    <FileText size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>

                {/* NID */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    National ID (NID)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.nid}
                      onChange={(e) => handleInputChange('nid', e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      placeholder="Enter NID number"
                      disabled={loading}
                    />
                    <FileText size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
              <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                  <MapPin size={18} className="text-slate-400" />
                </div>
                Address
              </h3>
              <div className="relative">
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-4 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 resize-none font-semibold"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  placeholder="Enter your complete address"
                  rows={3}
                  disabled={loading}
                />
                <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-700/30">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-slate-800/60 hover:bg-slate-800 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 rounded-lg transition-all duration-200 border border-slate-700/50 font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.surname.trim()}
                className="px-6 py-3 bg-cyan-600/10 hover:bg-cyan-600/20 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-cyan-400 border border-cyan-500/30 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                style={{ fontFamily: 'Inter, sans-serif' }}
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
