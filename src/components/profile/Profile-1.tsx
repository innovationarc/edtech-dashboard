// src/pages/Profile-1.tsx - Admin Profile Page
import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { User, Mail, Phone, MapPin, Calendar, Users, Droplet, Shield, FileText, Award, Edit, Lock, Printer, CreditCard, Loader } from 'lucide-react';
import ProfileEditModal1 from '../../components/profile/ProfileEditModal-1';
import ChangePasswordModal from '../../components/profile/ChangePasswordModal';
import IdCardModal1 from '../../components/profile/IdCardModal-1';

const Profile1 = () => {
  const { user } = useDashboard();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);

  useEffect(() => {
    // Calculate profile completion percentage
    if (user) {
      const fields = [
        user.surname,
        user.fullName,
        user.email,
        user.phoneNumber,
        user.address,
        user.dob,
        user.gender,
        user.bloodGroup,
        user.religion,
        user.profilePictureUrl,
        (user as any).birthCertificateNumber,
        (user as any).nid
      ];

      const filledFields = fields.filter(field => field && field.toString().trim() !== '').length;
      const percentage = Math.round((filledFields / fields.length) * 100);
      setProfileCompletion(percentage);
    }
  }, [user]);

  const handlePrintProfile = () => {
    window.print();
  };

  const getRoleBadgeColors = (role: string) => {
    const colors: { [key: string]: string } = {
      'admin': 'bg-red-600',
      'manager': 'bg-purple-600',
      'coordinator': 'bg-blue-600',
      'student_manager': 'bg-cyan-600',
      'course_manager': 'bg-teal-600',
      'teacher': 'bg-green-600',
      'parent': 'bg-orange-600',
      'student': 'bg-indigo-600'
    };
    return colors[role] || 'bg-gray-600';
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => {
    if (!value || value.trim() === '') return null;
    
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
        <div className="flex-shrink-0 mt-0.5">
          <Icon size={16} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {label}
          </p>
          <p className="text-sm text-gray-900 font-bold break-words" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            {value}
          </p>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader size={48} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Print Styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-content, .print-content * {
              visibility: visible;
            }
            .print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .bg-gradient-to-br {
              background: white !important;
            }
          }
        `}</style>

        {/* Page Header - No Print */}
        <div className="no-print mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2">
            Admin Profile
          </h1>
          <p className="text-gray-400 text-lg">
            View and manage your administrator profile
          </p>
        </div>

        {/* Print Content */}
        <div className="print-content bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 px-8 py-12">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Profile Picture */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                  {user.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt={`${user.surname} ${user.name}`}
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
                <div className="absolute -bottom-2 -right-2 bg-yellow-400 rounded-full p-2 shadow-lg ring-4 ring-white">
                  <Award size={20} className="text-yellow-900" />
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                  <h1 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {user.surname} {user.fullName || user.name}
                  </h1>
                  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold ${getRoleBadgeColors(user.role)} text-white shadow-md capitalize`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    👑 Administrator
                  </span>
                </div>
                <p className="text-white/90 text-sm mb-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  ID: <span className="font-mono font-bold">{user.userId}</span>
                </p>
                <div className="inline-flex items-center px-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse mr-2.5"></div>
                  <span className="text-sm text-white font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Active Account</span>
                </div>
              </div>

              {/* Profile Completion - No Print */}
              <div className="no-print bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 min-w-[180px]">
                <p className="text-white/80 text-xs font-semibold mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Profile Completion
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/20 rounded-full h-2.5">
                    <div 
                      className="bg-green-400 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                  <span className="text-white font-bold text-lg" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {profileCompletion}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - No Print */}
          <div className="no-print flex flex-wrap justify-center gap-3 px-8 py-6 border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <Edit size={18} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={handlePrintProfile}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <Printer size={18} />
              <span>Print Profile</span>
            </button>
            <button
              onClick={() => setShowIdCardModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <CreditCard size={18} />
              <span>ID Card</span>
            </button>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-semibold text-sm border-2 border-gray-200"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              <Lock size={18} />
              <span>Change Password</span>
            </button>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8">
            {/* Basic Information */}
            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User size={18} className="text-indigo-600" />
                </div>
                Basic Information
              </h3>
              <div className="space-y-1">
                <InfoRow icon={User} label="Surname" value={user.surname} />
                <InfoRow icon={User} label="Full Name" value={user.fullName} />
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow 
                  icon={Calendar} 
                  label="Date of Birth" 
                  value={user.dob ? new Date(user.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined} 
                />
                <InfoRow 
                  icon={Users} 
                  label="Gender" 
                  value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : undefined} 
                />
                <InfoRow icon={Droplet} label="Blood Group" value={user.bloodGroup} />
                <InfoRow icon={Shield} label="Religion" value={user.religion} />
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
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
                <InfoRow icon={MapPin} label="Address" value={user.address} />
              </div>
            </div>

            {/* Official Documents */}
            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileText size={18} className="text-green-600" />
                </div>
                Official Documents
              </h3>
              <div className="space-y-1">
                <InfoRow 
                  icon={FileText} 
                  label="Birth Certificate" 
                  value={(user as any).birthCertificateNumber} 
                />
                <InfoRow 
                  icon={FileText} 
                  label="National ID (NID)" 
                  value={(user as any).nid} 
                />
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
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
                    <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Account Type</p>
                    <p className="text-sm text-gray-900 font-bold capitalize" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Administrator</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Status</p>
                    <p className="text-sm text-green-700 font-bold capitalize" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{user.status}</p>
                  </div>
                </div>
                {user.createdAt && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Calendar size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Joining Date</p>
                      <p className="text-sm text-gray-900 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {new Date(user.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                )}
                {(user as any).designation && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Award size={18} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Designation</p>
                      <p className="text-sm text-gray-900 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {(user as any).designation}
                      </p>
                    </div>
                  </div>
                )}
                {(user as any).validTill && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Calendar size={18} className="text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-600 mb-0.5" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Valid Till</p>
                      <p className="text-sm text-gray-900 font-bold capitalize" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {(user as any).validTill}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showEditModal && (
          <ProfileEditModal1
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              setShowEditModal(false);
            }}
          />
        )}

        {showPasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowPasswordModal(false)}
            onSuccess={() => {
              setShowPasswordModal(false);
            }}
          />
        )}

        {showIdCardModal && (
          <IdCardModal1
            onClose={() => setShowIdCardModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Profile1;
