// src/components/profile/ProfileView.tsx
import { User, Mail, Phone, MapPin, GraduationCap, Building, Calendar, Users, Droplet, Shield, Printer, Edit, Lock, FileText, CreditCard, Award } from 'lucide-react';
import { UserProfile } from '../../services/authService';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface ProfileViewProps {
  user: UserProfile;
  onEdit: () => void;
  onChangePassword: () => void;
}

const ProfileView = ({ user, onEdit, onChangePassword }: ProfileViewProps) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [profileCompletion, setProfileCompletion] = useState(0);

  useEffect(() => {
    // Generate QR Code for profile verification
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
  }, [user.uid]);

  useEffect(() => {
    // Calculate profile completion percentage
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
  }, [user]);

  const handlePrintProfile = () => {
    window.print();
  };

  const handlePrintIDCard = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

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

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'from-green-500 to-emerald-600';
    if (percentage >= 60) return 'from-blue-500 to-indigo-600';
    if (percentage >= 40) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-pink-600';
  };

  return (
    <div className="space-y-6">
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
          .print-profile-card {
            background: white !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Profile Card */}
      <div id="printable-profile" className="print-profile-card bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200">
        {/* Professional Header */}
        <div className="relative h-48 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 overflow-hidden">
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
                      stroke="url(#gradient)"
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - profileCompletion / 100)}`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" className={`text-gradient-from`} stopColor={profileCompletion >= 80 ? '#10b981' : profileCompletion >= 60 ? '#3b82f6' : profileCompletion >= 40 ? '#f59e0b' : '#ef4444'} />
                        <stop offset="100%" className={`text-gradient-to`} stopColor={profileCompletion >= 80 ? '#059669' : profileCompletion >= 60 ? '#6366f1' : profileCompletion >= 40 ? '#ea580c' : '#dc2626'} />
                      </linearGradient>
                    </defs>
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

        {/* Profile Content */}
        <div className="relative px-6 sm:px-8 pb-8">
          {/* Profile Picture and Name */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-20 mb-6">
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
              onClick={onEdit}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-900 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm border-2 border-gray-200"
            >
              <Edit size={18} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={onChangePassword}
              className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-900 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm border-2 border-gray-200"
            >
              <Lock size={18} />
              <span>Change Password</span>
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
};

export default ProfileView;
