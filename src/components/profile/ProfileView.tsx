import { User, Mail, Phone, MapPin, GraduationCap, Building, Calendar, Users, Droplet, Shield, Printer, Edit, Lock } from 'lucide-react';
import { UserProfile } from '../../services/authService';

interface ProfileViewProps {
  user: UserProfile;
  onEdit: () => void;
  onChangePassword: () => void;
}

const ProfileView = ({ user, onEdit, onChangePassword }: ProfileViewProps) => {
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

      {/* Profile Card - Screen View */}
      <div id="printable-profile" className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 pointer-events-none"></div>
        
        {/* Header Banner */}
        <div className="relative h-32 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 overflow-hidden">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        </div>

        {/* Profile Content */}
        <div className="relative px-6 sm:px-8 pb-8">
          {/* Profile Picture and Name */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
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

          {/* Print Button - Only visible on screen */}
          <div className="no-print flex justify-end mb-6">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-primary-500/50"
            >
              <Printer size={18} />
              <span className="font-medium">Print ID Card</span>
            </button>
          </div>

          {/* Print Version - Hidden on screen */}
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

          {/* Information Grid - Screen View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <div className="no-print flex flex-col sm:flex-row justify-center gap-4 mt-8 pt-8 border-t border-gray-700/50">
            <button
              onClick={onEdit}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-primary-500/50"
            >
              <Edit size={18} />
              <span>Edit Profile</span>
            </button>
            <button
              onClick={onChangePassword}
              className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-lg border border-gray-600"
            >
              <Lock size={18} />
              <span>Change Password</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
