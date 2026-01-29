// src/components/profile/ProfileEditModal.tsx
import { useState } from 'react';
import { X, User, Phone, MapPin, GraduationCap, Building, Hash, Camera, Loader, AlertCircle, CheckCircle, Mail, Calendar, Users, Droplet, Shield, Printer, Edit } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { userService } from '../../services/userService';
import { uploadService } from '../../services/uploadService';

interface ProfileEditModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ProfileEditModal = ({ onClose, onSuccess }: ProfileEditModalProps) => {
  const { user } = useDashboard();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
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

  const handlePrint = () => {
    window.print();
  };

  const getRoleBadgeColors = (role: string) => {
    switch (role) {
      case 'admin':
        return 'from-red-600 to-red-700 shadow-red-500/50';
      case 'manager':
        return 'from-blue-600 to-blue-700 shadow-blue-500/50';
      case 'coordinator':
        return 'from-yellow-600 to-yellow-700 shadow-yellow-500/50';
      case 'teacher':
        return 'from-green-600 to-green-700 shadow-green-500/50';
      case 'parent':
        return 'from-purple-600 to-purple-700 shadow-purple-500/50';
      case 'student':
        return 'from-cyan-600 to-cyan-700 shadow-cyan-500/50';
      default:
        return 'from-gray-600 to-gray-700 shadow-gray-500/50';
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => {
    if (!value) return null;
    
    return (
      <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-all duration-200">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">{label}</p>
          <p className="text-sm text-white font-medium break-words">{value}</p>
        </div>
      </div>
    );
  };

  if (!user) {
    return null;
  }

  // Success State
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

  // View Mode
  if (mode === 'view') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-5xl my-4 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          {/* Print Styles */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-profile,
              #printable-profile * {
                visibility: visible;
              }
              #printable-profile {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                padding: 40px;
              }
              .no-print {
                display: none !important;
              }
              .print-id-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 400px;
                margin: 0 auto;
              }
              .print-header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid rgba(255,255,255,0.3);
                padding-bottom: 20px;
              }
              .print-logo {
                width: 80px;
                height: 80px;
                margin: 0 auto 15px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
                font-weight: bold;
                color: #667eea;
              }
              .print-profile-pic {
                width: 120px;
                height: 120px;
                margin: 0 auto 20px;
                border-radius: 50%;
                border: 4px solid white;
                overflow: hidden;
                background: white;
              }
              .print-name {
                font-size: 24px;
                font-weight: bold;
                color: white;
                margin-bottom: 5px;
              }
              .print-role {
                display: inline-block;
                padding: 8px 20px;
                background: rgba(255,255,255,0.2);
                border-radius: 20px;
                font-size: 14px;
                color: white;
                font-weight: 600;
                text-transform: uppercase;
              }
              .print-details {
                background: rgba(255,255,255,0.95);
                border-radius: 15px;
                padding: 20px;
                color: #333;
              }
              .print-detail-row {
                display: flex;
                padding: 12px 0;
                border-bottom: 1px solid #e0e0e0;
              }
              .print-detail-row:last-child {
                border-bottom: none;
              }
              .print-detail-label {
                font-weight: 600;
                color: #667eea;
                min-width: 140px;
                font-size: 13px;
              }
              .print-detail-value {
                color: #333;
                font-size: 13px;
                flex: 1;
              }
              .print-footer {
                text-align: center;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 2px solid rgba(255,255,255,0.3);
                color: white;
                font-size: 11px;
              }
            }
          `}</style>

          <div className="p-6 sm:p-8 relative" id="printable-profile">
            {/* Header Banner */}
            <div className="no-print relative h-32 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 overflow-hidden rounded-2xl mb-8">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
            </div>

            {/* Profile Picture and Name */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-24 mb-8">
              <div className="relative group">
                <div className="no-print absolute inset-0 bg-primary-500/30 blur-2xl"></div>
                <div className="relative h-32 w-32 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border-4 border-gray-900 shadow-2xl">
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl text-white font-bold">
                      {user.name?.charAt(0) || user.surname?.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500">
                    {user.surname} {user.name}
                  </h1>
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r ${getRoleBadgeColors(user.role)} text-white shadow-lg capitalize`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-1">User ID: <span className="text-white font-mono">{user.userId}</span></p>
                <div className="inline-flex items-center px-3 py-1 rounded-lg bg-green-900/30 border border-green-700/30">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse mr-2"></div>
                  <span className="text-xs text-green-300 font-medium">Active Account</span>
                </div>
              </div>
            </div>

            {/* Print Button */}
            <div className="no-print flex justify-end mb-6">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-primary-500/50"
              >
                <Printer size={18} />
                <span className="font-medium">Print ID Card</span>
              </button>
            </div>

            {/* Print Version */}
            <div className="print-id-card hidden">
              <div className="print-header">
                <div className="print-logo">
                  {user.name?.charAt(0) || 'L'}
                </div>
                <h2 style={{ fontSize: '20px', color: 'white', fontWeight: 'bold', marginBottom: '5px' }}>
                  Learning Management Portal
                </h2>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Official Student ID Card</p>
              </div>

              <div className="print-profile-pic">
                {user.profilePictureUrl ? (
                  <img src={user.profilePictureUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 'bold', color: '#667eea' }}>
                    {user.name?.charAt(0) || user.surname?.charAt(0)}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div className="print-name">{user.surname} {user.name}</div>
                <div className="print-role">{user.role}</div>
              </div>

              <div className="print-details">
                {user.userId && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">User ID:</div>
                    <div className="print-detail-value">{user.userId}</div>
                  </div>
                )}
                {user.email && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">Email:</div>
                    <div className="print-detail-value">{user.email}</div>
                  </div>
                )}
                {user.phoneNumber && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">Phone:</div>
                    <div className="print-detail-value">+880{user.phoneNumber}</div>
                  </div>
                )}
                {user.dob && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">Date of Birth:</div>
                    <div className="print-detail-value">{new Date(user.dob).toLocaleDateString()}</div>
                  </div>
                )}
                {user.bloodGroup && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">Blood Group:</div>
                    <div className="print-detail-value">{user.bloodGroup}</div>
                  </div>
                )}
                {user.class && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">Class:</div>
                    <div className="print-detail-value">{user.class}</div>
                  </div>
                )}
                {user.school && (
                  <div className="print-detail-row">
                    <div className="print-detail-label">School:</div>
                    <div className="print-detail-value">{user.school}</div>
                  </div>
                )}
              </div>

              <div className="print-footer">
                <p>This is an official identification card. If found, please contact the institution.</p>
                <p style={{ marginTop: '5px', fontSize: '10px' }}>
                  Issued: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Basic Information */}
              <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User size={20} className="text-primary-400" />
                  Basic Information
                </h3>
                <div className="space-y-3">
                  <InfoRow icon={User} label="Full Name" value={user.name} />
                  <InfoRow icon={User} label="Surname" value={user.surname} />
                  <InfoRow icon={Mail} label="Email" value={user.email} />
                  <InfoRow icon={Calendar} label="Date of Birth" value={user.dob ? new Date(user.dob).toLocaleDateString() : undefined} />
                  <InfoRow icon={Users} label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : undefined} />
                  <InfoRow icon={Droplet} label="Blood Group" value={user.bloodGroup} />
                  <InfoRow icon={Shield} label="Religion" value={user.religion} />
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Phone size={20} className="text-primary-400" />
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <InfoRow 
                    icon={Phone} 
                    label="Phone Number" 
                    value={user.phoneNumber ? `+880${user.phoneNumber}` : undefined} 
                  />
                  <InfoRow icon={Phone} label="Mobile Number" value={user.mobileNumber} />
                  <InfoRow 
                    icon={Users} 
                    label="Guardian Phone" 
                    value={user.guardianPhone ? `+880${user.guardianPhone}` : undefined} 
                  />
                  <InfoRow icon={MapPin} label="Address" value={user.address} />
                </div>
              </div>

              {/* Educational Information */}
              <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <GraduationCap size={20} className="text-primary-400" />
                  Educational Information
                </h3>
                <div className="space-y-3">
                  <InfoRow icon={GraduationCap} label="Class/Grade" value={user.classGrade} />
                  <InfoRow icon={GraduationCap} label="Current Class" value={user.class} />
                  <InfoRow icon={Building} label="School" value={user.school} />
                  <InfoRow icon={GraduationCap} label="College/University" value={user.college} />
                </div>
              </div>

              {/* Account Information */}
              <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-primary-400" />
                  Account Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-lg bg-gradient-to-br ${getRoleBadgeColors(user.role)}`}>
                      <Shield size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-0.5">Account Type</p>
                      <p className="text-sm text-white font-medium capitalize">{user.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl">
                    <div className="h-10 w-10 rounded-lg bg-green-900/30 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-0.5">Status</p>
                      <p className="text-sm text-green-400 font-medium capitalize">{user.status}</p>
                    </div>
                  </div>
                  {user.createdAt && (
                    <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
                        <Calendar size={18} className="text-primary-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-0.5">Member Since</p>
                        <p className="text-sm text-white font-medium">
                          {new Date(user.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="no-print flex flex-col sm:flex-row justify-center gap-4 pt-8 border-t border-gray-700/50">
              <button
                onClick={() => setMode('edit')}
                className="px-6 py-3 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-primary-500/50"
              >
                <Edit size={18} />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-4xl my-4 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={() => setMode('view')}
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

                {/* Current Class */}
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
                onClick={() => setMode('view')}
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
