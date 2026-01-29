// src/components/profile/ProfileEditModal.tsx
import { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, GraduationCap, Building, Hash, Camera, Loader, AlertCircle, CheckCircle, Mail, Calendar, Users, Droplet, Shield, FileText, CreditCard, Award, Printer } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { userService } from '../../services/userService';
import { uploadService } from '../../services/uploadService';
import QRCode from 'qrcode';

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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [profileCompletion, setProfileCompletion] = useState(0);
  
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

  useEffect(() => {
    if (user) {
      // Generate QR Code
      const generateQRCode = async () => {
        try {
          const verificationUrl = `${window.location.origin}/verify-profile?uid=${user.uid}`;
          const qrUrl = await QRCode.toDataURL(verificationUrl, {
            width: 200,
            margin: 1,
            color: {
              dark: '#1a1a1a',
              light: '#ffffff'
            }
          });
          setQrCodeUrl(qrUrl);
        } catch (error) {
          console.error('Error generating QR code:', error);
        }
      };

      generateQRCode();

      // Calculate profile completion
      const calculateCompletion = () => {
        const fields = [
          user.name,
          user.surname,
          user.email,
          user.phoneNumber,
          user.address,
          user.dob,
          user.gender,
          user.bloodGroup,
          user.religion,
          user.profilePictureUrl,
          user.class,
          user.school,
          user.college,
          user.mobileNumber,
          user.guardianPhone,
          user.classGrade
        ];

        const filledFields = fields.filter(field => field && field.toString().trim() !== '').length;
        const percentage = Math.round((filledFields / fields.length) * 100);
        setProfileCompletion(percentage);
      };

      calculateCompletion();
    }
  }, [user]);

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

  const handlePrintProfile = () => {
    window.print();
  };

  const handlePrintIDCard = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow || !user) return;

    const idCardHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${user.surname} ${user.name}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f0f0f0;
            padding: 20px;
          }
          
          .id-card {
            width: 85.6mm;
            height: 53.98mm;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            position: relative;
          }
          
          .id-card-inner {
            padding: 16px;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .id-header {
            text-align: center;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.3);
          }
          
          .org-name {
            font-size: 13px;
            font-weight: 700;
            color: white;
            margin-bottom: 2px;
            letter-spacing: 0.5px;
          }
          
          .card-title {
            font-size: 8px;
            color: rgba(255,255,255,0.9);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .id-content {
            display: flex;
            gap: 12px;
            flex: 1;
          }
          
          .photo-section {
            width: 72px;
            flex-shrink: 0;
          }
          
          .photo-container {
            width: 72px;
            height: 90px;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid white;
            background: white;
            margin-bottom: 6px;
          }
          
          .photo-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .photo-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: 700;
            color: #667eea;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          }
          
          .qr-code {
            width: 72px;
            height: 72px;
            background: white;
            border-radius: 6px;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .qr-code img {
            width: 100%;
            height: 100%;
          }
          
          .details-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          
          .user-name {
            font-size: 15px;
            font-weight: 700;
            color: white;
            margin-bottom: 8px;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .detail-row {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            font-size: 9px;
          }
          
          .detail-label {
            color: rgba(255,255,255,0.8);
            font-weight: 600;
            min-width: 60px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          
          .detail-value {
            color: white;
            font-weight: 600;
            font-size: 10px;
          }
          
          .id-footer {
            text-align: center;
            margin-top: auto;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.3);
          }
          
          .validity {
            font-size: 7px;
            color: rgba(255,255,255,0.8);
            font-weight: 500;
          }
          
          .pattern-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
              repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 20px);
            pointer-events: none;
          }
          
          @media print {
            body {
              background: white;
            }
            
            .id-card {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="id-card">
          <div class="pattern-overlay"></div>
          <div class="id-card-inner">
            <div class="id-header">
              <div class="org-name">LEARNING MANAGEMENT PORTAL</div>
              <div class="card-title">Official Student ID Card</div>
            </div>
            
            <div class="id-content">
              <div class="photo-section">
                <div class="photo-container">
                  ${user.profilePictureUrl ? 
                    `<img src="${user.profilePictureUrl}" alt="Profile" />` :
                    `<div class="photo-placeholder">${user.name?.charAt(0) || user.surname?.charAt(0)}</div>`
                  }
                </div>
                <div class="qr-code">
                  <img src="${qrCodeUrl}" alt="QR Code" />
                </div>
              </div>
              
              <div class="details-section">
                <div class="user-name">${user.surname} ${user.name}</div>
                
                <div class="detail-row">
                  <div class="detail-label">ID:</div>
                  <div class="detail-value">${user.userId}</div>
                </div>
                
                ${user.phoneNumber ? `
                <div class="detail-row">
                  <div class="detail-label">Mobile:</div>
                  <div class="detail-value">+880${user.phoneNumber}</div>
                </div>
                ` : ''}
                
                ${user.bloodGroup ? `
                <div class="detail-row">
                  <div class="detail-label">Blood:</div>
                  <div class="detail-value">${user.bloodGroup}</div>
                </div>
                ` : ''}
                
                ${user.role === 'student' && user.classGrade ? `
                <div class="detail-row">
                  <div class="detail-label">Class:</div>
                  <div class="detail-value">${user.classGrade.replace('class', 'Class ').toUpperCase()}</div>
                </div>
                ` : ''}
              </div>
            </div>
            
            <div class="id-footer">
              <div class="validity">Valid Until: ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(idCardHTML);
    printWindow.document.close();
  };

  const getRoleBadgeColors = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-red-600 to-red-700';
      case 'manager':
        return 'bg-gradient-to-r from-blue-600 to-blue-700';
      case 'coordinator':
        return 'bg-gradient-to-r from-yellow-600 to-yellow-700';
      case 'teacher':
        return 'bg-gradient-to-r from-green-600 to-green-700';
      case 'parent':
        return 'bg-gradient-to-r from-purple-600 to-purple-700';
      case 'student':
        return 'bg-gradient-to-r from-cyan-600 to-cyan-700';
      default:
        return 'bg-gradient-to-r from-gray-600 to-gray-700';
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => {
    if (!value) return null;
    
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
          <p className="text-sm text-gray-900 font-semibold break-words">{value}</p>
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
        <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4 shadow-lg">
                <CheckCircle size={64} className="text-green-600" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Profile Updated!
            </h2>
            
            <div className="bg-green-50 text-green-800 px-6 py-4 rounded-xl border border-green-200">
              <p className="font-medium">Your profile has been updated successfully. The changes will be reflected across the platform.</p>
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
        <div className="bg-white rounded-3xl w-full max-w-5xl my-4 relative shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90 hover:scale-110 z-10 bg-white rounded-full p-2 shadow-lg"
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
                padding: 20px;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="p-6 sm:p-8 relative" id="printable-profile">
            {/* Professional Header */}
            <div className="relative h-48 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 overflow-hidden rounded-2xl mb-8">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}></div>
              
              {/* Profile Completion Badge */}
              <div className="no-print absolute top-4 right-4">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14">
                      <svg className="transform -rotate-90" width="56" height="56">
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke="#e5e7eb"
                          strokeWidth="4"
                          fill="none"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          stroke={profileCompletion >= 80 ? '#10b981' : profileCompletion >= 60 ? '#3b82f6' : profileCompletion >= 40 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 24}`}
                          strokeDashoffset={`${2 * Math.PI * 24 * (1 - profileCompletion / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-900">{profileCompletion}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Profile</p>
                      <p className="text-xs font-bold text-gray-900">Completion</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Picture and Name */}
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-24 mb-8">
              <div className="relative group">
                <div className="h-32 w-32 rounded-2xl overflow-hidden bg-white shadow-xl ring-4 ring-white">
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <span className="text-5xl text-white font-bold">
                        {user.name?.charAt(0) || user.surname?.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg ring-4 ring-white">
                  <Award size={16} className="text-white" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                    {user.surname} {user.name}
                  </h1>
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold ${getRoleBadgeColors(user.role)} text-white shadow-md capitalize`}>
                    {user.role}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-1 font-medium">ID: <span className="text-gray-900 font-mono font-semibold">{user.userId}</span></p>
                <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                  <span className="text-xs text-green-700 font-semibold">Active Account</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="no-print flex flex-wrap justify-center gap-3 mb-8 pb-8 border-b border-gray-200">
              <button
                onClick={handlePrintProfile}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm"
              >
                <FileText size={18} />
                <span>Print Profile</span>
              </button>
              <button
                onClick={handlePrintIDCard}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm"
              >
                <CreditCard size={18} />
                <span>Print ID Card</span>
              </button>
              <button
                onClick={() => setMode('edit')}
                className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-900 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm border-2 border-gray-200"
              >
                <Edit size={18} />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <User size={18} className="text-indigo-600" />
                  </div>
                  Basic Information
                </h3>
                <div className="space-y-1">
                  <InfoRow icon={User} label="Full Name" value={user.name} />
                  <InfoRow icon={User} label="Surname" value={user.surname} />
                  <InfoRow icon={Mail} label="Email" value={user.email} />
                  <InfoRow icon={Calendar} label="Date of Birth" value={user.dob ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined} />
                  <InfoRow icon={Users} label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : undefined} />
                  <InfoRow icon={Droplet} label="Blood Group" value={user.bloodGroup} />
                  <InfoRow icon={Shield} label="Religion" value={user.religion} />
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Phone size={18} className="text-purple-600" />
                  </div>
                  Contact Information
                </h3>
                <div className="space-y-1">
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
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <GraduationCap size={18} className="text-green-600" />
                  </div>
                  Educational Information
                </h3>
                <div className="space-y-1">
                  <InfoRow icon={GraduationCap} label="Class/Grade" value={user.classGrade} />
                  <InfoRow icon={GraduationCap} label="Current Class" value={user.class} />
                  <InfoRow icon={Building} label="School" value={user.school} />
                  <InfoRow icon={GraduationCap} label="College/University" value={user.college} />
                </div>
              </div>

              {/* Account Information */}
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Shield size={18} className="text-blue-600" />
                  </div>
                  Account Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-sm ${getRoleBadgeColors(user.role)}`}>
                      <Shield size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600 mb-0.5">Account Type</p>
                      <p className="text-sm text-gray-900 font-bold capitalize">{user.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-600 mb-0.5">Status</p>
                      <p className="text-sm text-green-700 font-bold capitalize">{user.status}</p>
                    </div>
                  </div>
                  {user.createdAt && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Calendar size={18} className="text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-600 mb-0.5">Member Since</p>
                        <p className="text-sm text-gray-900 font-bold">
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
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl my-4 relative shadow-2xl">
        <button
          onClick={() => setMode('view')}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90 hover:scale-110 z-10 bg-white rounded-full p-2 shadow-lg"
        >
          <X size={24} />
        </button>

        <div className="p-6 sm:p-8 relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
                <User size={32} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Edit Profile
              </h2>
              <p className="text-gray-600 text-sm mt-1 font-medium">Update your personal information</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <label className="block text-sm font-bold text-gray-900 mb-4">
                Profile Picture
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="h-28 w-28 rounded-2xl overflow-hidden bg-white shadow-lg border-2 border-gray-200">
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
                        <span className="text-4xl text-white font-bold">
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
                  <p className="text-gray-900 font-bold mb-1">Upload new picture</p>
                  <p className="text-sm text-gray-600 mb-2">JPG, PNG or GIF (max 5MB)</p>
                  {profilePictureFile && (
                    <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-xs inline-block font-medium">
                      ✓ New image selected: {profilePictureFile.name}
                    </div>
                  )}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 font-medium">Uploading... {uploadProgress}%</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User size={18} className="text-indigo-600" />
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Surname - Non-editable */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Surname
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.surname || ''}
                      className="w-full bg-gray-200 text-gray-600 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-gray-300 font-medium"
                      disabled
                      readOnly
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-gray-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Cannot be changed</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter your full name"
                      disabled={loading}
                      required
                    />
                    <User size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter your email"
                      disabled={loading}
                    />
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      disabled={loading}
                    />
                    <Calendar size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full bg-white text-gray-900 rounded-xl py-3 pl-4 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium cursor-pointer"
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Blood Group
                  </label>
                  <div className="relative">
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium cursor-pointer"
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Religion
                  </label>
                  <input
                    type="text"
                    value={formData.religion}
                    onChange={(e) => handleInputChange('religion', e.target.value)}
                    className="w-full bg-white text-gray-900 rounded-xl py-3 pl-4 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                    placeholder="Your religion"
                    disabled={loading}
                  />
                </div>

                {/* User ID - Non-editable */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    User ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={user?.userId || ''}
                      className="w-full bg-gray-200 text-gray-600 rounded-xl py-3 pl-11 pr-4 cursor-not-allowed border border-gray-300 font-mono font-semibold"
                      disabled
                      readOnly
                    />
                    <Hash size={18} className="absolute left-3.5 top-3.5 text-gray-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Cannot be changed</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Phone size={18} className="text-purple-600" />
                </div>
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                      <Phone size={18} className="text-gray-400" />
                      <span className="text-gray-900 font-bold">+880</span>
                    </div>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.phoneNumber)}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-[7rem] pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="1623737505"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter mobile number"
                      disabled={loading}
                    />
                    <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* Guardian Phone */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Guardian Phone
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                      <Users size={18} className="text-gray-400" />
                      <span className="text-gray-900 font-bold">+880</span>
                    </div>
                    <input
                      type="tel"
                      value={formatPhoneNumber(formData.guardianPhone)}
                      onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-[7rem] pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="1623737505"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <MapPin size={18} className="text-blue-600" />
                </div>
                Address
              </h3>
              <div className="relative">
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 resize-none font-medium"
                  placeholder="Enter your complete address"
                  rows={3}
                  disabled={loading}
                />
                <MapPin size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              </div>
            </div>

            {/* Educational Information */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <GraduationCap size={18} className="text-green-600" />
                </div>
                Educational Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Class/Grade */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Class/Grade
                  </label>
                  <div className="relative">
                    <select
                      value={formData.classGrade}
                      onChange={(e) => handleInputChange('classGrade', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium cursor-pointer"
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
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Current Class */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Class
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.class}
                      onChange={(e) => handleInputChange('class', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter your class"
                      disabled={loading}
                    />
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    School
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => handleInputChange('school', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter your school name"
                      disabled={loading}
                    />
                    <Building size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>

                {/* College/University */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    College/University
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.college}
                      onChange={(e) => handleInputChange('college', e.target.value)}
                      className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-4 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-medium"
                      placeholder="Enter your college/university name"
                      disabled={loading}
                    />
                    <GraduationCap size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-gray-200">
              <button
                type="button"
                onClick={() => setMode('view')}
                disabled={loading}
                className="px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900 rounded-xl transition-all duration-200 border-2 border-gray-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-bold shadow-lg hover:shadow-xl"
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
