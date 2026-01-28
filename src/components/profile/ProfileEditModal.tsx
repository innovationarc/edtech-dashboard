import { useState } from 'react';
import { X, User, Phone, MapPin, GraduationCap, Building, Hash, Camera, Loader, AlertCircle, CheckCircle, Mail, Calendar, Users, Droplet, Shield } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { userService } from '../../services/userService';
import { uploadService } from '../../services/uploadService';

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
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: user?.address || '',
    class: user?.class || '',
    school: user?.school || '',
    college: user?.college || '',
    mobileNumber: user?.mobileNumber || '',
    registrationNumber: user?.registrationNumber || '',
    phoneNumber: user?.phoneNumber || '',
    guardianPhone: user?.guardianPhone || '',
    bloodGroup: user?.bloodGroup || '',
    gender: user?.gender || '',
    religion: user?.religion || '',
    dob: user?.dob || '',
    classGrade: user?.classGrade || ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
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

  const formatPhoneNumber = (phoneNumber: string): string => {
    if (!phoneNumber) return '';
    
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove country code if present
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    // Remove leading zero if present
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

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let profilePictureUrl = user.profilePictureUrl;
      
      // Upload profile picture to Supabase if a new one was selected
      if (profilePictureFile) {
        setUploadProgress(0);
        const uploadResult = await uploadService.uploadToSupabase(
          profilePictureFile,
          'profile_pictures',
          (progress) => {
            setUploadProgress(progress.percentage);
          },
          'public' // Use public bucket for profile pictures
        );
        profilePictureUrl = uploadResult.url;
      }

      // Update user profile
      const updateData: any = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        class: formData.class.trim() || undefined,
        school: formData.school.trim() || undefined,
        college: formData.college.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim() || undefined,
        guardianPhone: formData.guardianPhone.trim() || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        gender: formData.gender || undefined,
        religion: formData.religion.trim() || undefined,
        dob: formData.dob || undefined,
        classGrade: formData.classGrade || undefined,
        profilePictureUrl
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await userService.updateUser(user.uid, updateData);
      
      setSuccess(true);
      
      // Refresh user profile in context
      if ((window as any).refreshUserProfile) {
        await (window as any).refreshUserProfile();
      }
      
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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
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
              Profile Updated!
            </h2>
            
            <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-200 px-6 py-4 rounded-xl border border-green-700/50 backdrop-blur-sm">
              <p>Your profile has been updated successfully. The changes will be reflected across the platform.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-4xl my-4 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 sm:p-8 relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-primary-500/50">
                <User size={32} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500">
                Edit Profile
              </h2>
              <p className="text-gray-400 text-sm mt-1">Update your personal information</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <label className="block text-sm font-semibold text-gray-300 mb-4">
                Profile Picture
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="h-28 w-28 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border-2 border-gray-700/50 shadow-xl">
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
                      <span className="text-4xl text-white font-bold">
                        {user?.name?.charAt(0) || user?.surname?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 h-10 w-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-all duration-200 shadow-lg group-hover:shadow-primary-500/50">
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
                  <p className="text-white font-semibold mb-1">Upload new picture</p>
                  <p className="text-sm text-gray-400 mb-2">JPG, PNG or GIF (max 5MB)</p>
                  {profilePictureFile && (
                    <div className="bg-green-900/30 border border-green-700/30 text-green-300 px-3 py-2 rounded-lg text-xs inline-block">
                      ✓ New image selected: {profilePictureFile.name}
                    </div>
                  )}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-500 to-purple-600 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Uploading... {uploadProgress}%</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User size={20} className="text-primary-400" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Surname - Non-editable */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Surname
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.surname || ''}
                      className="w-full bg-gray-700/50 text-gray-400 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-gray-600/30"
                      disabled
                      readOnly
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-gray-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
                </div>

                {/* Full Name */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter your full name"
                      disabled={loading}
                      required
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                {/* Email */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter your email"
                      disabled={loading}
                    />
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      disabled={loading}
                    />
                    <Calendar size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                {/* Gender */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Blood Group */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Blood Group
                  </label>
                  <div className="relative">
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
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
                    <Droplet size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  </div>
                </div>

                {/* Religion */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Religion
                  </label>
                  <input
                    type="text"
                    value={formData.religion}
                    onChange={(e) => handleInputChange('religion', e.target.value)}
                    className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Your religion"
                    disabled={loading}
                  />
                </div>

                {/* User ID - Non-editable */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    User ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.userId || ''}
                      className="w-full bg-gray-700/50 text-gray-400 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-gray-600/30 font-mono"
                      disabled
                      readOnly
                    />
                    <Hash size={18} className="absolute left-3.5 top-3.5 text-gray-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Cannot be changed</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Phone size={20} className="text-primary-400" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone Number */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                      <Phone size={18} className="text-gray-400 group-hover:text-primary-400 transition-colors" />
                      <span className="text-white font-medium">+880</span>
                    </div>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.phoneNumber)}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-[7rem] pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="1623737505"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter mobile number"
                      disabled={loading}
                    />
                    <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                {/* Guardian Phone */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Guardian Phone
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                      <Users size={18} className="text-gray-400 group-hover:text-primary-400 transition-colors" />
                      <span className="text-white font-medium">+880</span>
                    </div>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.guardianPhone)}
                      onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-[7rem] pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="1623737505"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Registration Number */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Registration Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter registration number"
                      disabled={loading}
                    />
                    <Hash size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin size={20} className="text-primary-400" />
                Address
              </h3>
              <div className="group">
                <div className="relative">
                  <textarea
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 resize-none"
                    placeholder="Enter your complete address"
                    rows={3}
                    disabled={loading}
                  />
                  <MapPin size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            </div>

            {/* Educational Information */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <GraduationCap size={20} className="text-primary-400" />
                Educational Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Class/Grade */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Class/Grade
                  </label>
                  <div className="relative">
                    <select
                      value={formData.classGrade}
                      onChange={(e) => handleInputChange('classGrade', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                      disabled={loading}
                    >
                      <option value="">Select class/grade</option>
                      <option value="class6">Class 6</option>
                      <option value="class7">Class 7</option>
                      <option value="class8">Class 8</option>
                      <option value="class9">Class 9</option>
                      <option value="class10">Class 10</option>
                      <option value="ssc">SSC</option>
                      <option value="class11">Class 11</option>
                      <option value="class12">Class 12</option>
                      <option value="hsc">HSC</option>
                      <option value="diploma">Diploma</option>
                      <option value="undergraduate">Undergraduate</option>
                      <option value="graduated">Graduated</option>
                    </select>
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  </div>
                </div>

                {/* Current Class (Alternative) */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Current Class
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.class}
                      onChange={(e) => handleInputChange('class', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter your class"
                      disabled={loading}
                    />
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                {/* School */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    School
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => handleInputChange('school', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter your school name"
                      disabled={loading}
                    />
                    <Building size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                {/* College/University */}
                <div className="group">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    College/University
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.college}
                      onChange={(e) => handleInputChange('college', e.target.value)}
                      className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="Enter your college/university name"
                      disabled={loading}
                    />
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield size={20} className="text-primary-400" />
                Account Information
              </h3>
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${
                  user?.role === 'student' ? 'bg-gradient-to-br from-accent-600 to-accent-700' : 
                  user?.role === 'teacher' ? 'bg-gradient-to-br from-secondary-600 to-secondary-700' : 
                  'bg-gradient-to-br from-primary-600 to-primary-700'
                }`}>
                  <User size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm">Account Type</p>
                  <p className={`text-lg font-bold capitalize ${
                    user?.role === 'student' ? 'text-accent-400' : 
                    user?.role === 'teacher' ? 'text-secondary-400' : 
                    'text-primary-400'
                  }`}>
                    {user?.role}
                  </p>
                </div>
                <div className="bg-gray-700/50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-gray-400">Status</p>
                  <p className="text-sm font-semibold text-green-400 capitalize">{user?.status}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Role and account type cannot be changed
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-700/50">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-gray-800/60 hover:bg-gray-700/60 disabled:bg-gray-800/30 disabled:text-gray-500 text-white rounded-xl transition-all duration-200 border border-gray-700/50 hover:border-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-6 py-3 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-primary-500/50"
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

export default ProfileEditModal;
