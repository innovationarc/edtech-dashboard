// src/components/profile/Profile-4.tsx — Student Profile (matches admin Profile-1 quality)
import { useState, useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  User, Mail, Phone, MapPin, Calendar, BookOpen, FileText,
  Edit, Lock, Printer, CreditCard, Loader, X, Clock, CheckCircle2,
  GraduationCap, Star, Shield
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

interface Profile4Props {
  onClose?: () => void;
}

const Profile4 = ({ onClose }: Profile4Props) => {
  const { user } = useDashboard();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Not specified';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const gradeLabel = (grade: string | undefined) => {
    const map: Record<string, string> = {
      class6: 'Class 6', class7: 'Class 7', class8: 'Class 8', class9: 'Class 9',
      class10: 'Class 10', ssc: 'SSC', class11: 'Class 11', class12: 'Class 12',
      hsc: 'HSC', diploma: 'Diploma', undergraduate: 'Undergraduate', graduated: 'Graduated'
    };
    return grade ? (map[grade] || grade) : undefined;
  };

  const DataField = ({ label, value, icon: Icon }: { label: string; value?: string; icon?: any }) => {
    if (!value || value.trim() === '') return null;
    return (
      <div className="flex items-start gap-2 sm:gap-3 py-2 sm:py-3 border-b border-slate-700/30">
        {Icon && (
          <div className="flex-shrink-0 mt-0.5">
            <Icon size={14} className="sm:w-4 sm:h-4 text-slate-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-0.5 sm:mb-1 uppercase tracking-wide"
            style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>
            {label}
          </p>
          <p className="text-xs sm:text-sm text-slate-200 font-medium break-words"
            style={{ fontFamily: "'Outfit', sans-serif" }}>
            {value}
          </p>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
        <Loader size={48} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />

        <div className="relative h-full w-full flex flex-col">
          <div className="flex-shrink-0 h-16 sm:h-[68px] lg:h-[72px]" />

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            onClick={e => e.stopPropagation()}
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 #1e293b' }}
          >
            <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
              <style>{`
                .student-profile-scroll::-webkit-scrollbar { width: 6px; }
                .student-profile-scroll::-webkit-scrollbar-track { background: #1e293b; }
                .student-profile-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
                @media print {
                  body * { visibility: hidden; }
                  .print-content, .print-content * { visibility: visible; }
                  .print-content { position: absolute; left: 0; top: 0; width: 100%; }
                  .no-print { display: none !important; }
                }
              `}</style>

              <div className="print-content space-y-3 sm:space-y-4 md:space-y-5 pb-6">

                {/* ── Identity Header ─────────────────────────────────────────── */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 lg:p-7 border border-slate-700/50">
                  <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-5">

                    {/* Avatar row — photo + mobile close */}
                    <div className="flex items-start justify-between w-full sm:w-auto sm:block">
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border-2 border-slate-700/50 shadow-xl bg-slate-800">
                          {user.profilePictureUrl ? (
                            <img src={user.profilePictureUrl} alt="Student" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-700 to-violet-800 flex items-center justify-center">
                              <span className="text-xl sm:text-2xl md:text-3xl text-white font-semibold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                                {user.surname?.charAt(0) || user.name?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Student badge */}
                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-lg p-1 sm:p-1.5 shadow-lg border-2 border-slate-900">
                          <GraduationCap size={11} className="sm:w-3.5 sm:h-3.5 text-white" />
                        </div>
                      </div>
                      {/* Mobile close */}
                      <button onClick={onClose}
                        className="no-print w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg transition-all border border-slate-700/50 sm:hidden">
                        <X size={16} />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 w-full sm:w-auto min-w-0">
                      <div className="hidden sm:flex justify-end mb-2">
                        <button onClick={onClose}
                          className="no-print w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg transition-all border border-slate-700/50">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="mb-3 sm:mb-4">
                        <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold text-slate-100 mb-1.5 break-words"
                          style={{ fontFamily: "'Outfit', sans-serif" }}>
                          {user.fullName || user.name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/40 text-xs font-semibold text-indigo-300"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            <GraduationCap size={11} />
                            Student
                          </span>
                          {gradeLabel(user.classGrade) && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs font-medium text-slate-300"
                              style={{ fontFamily: "'Outfit', sans-serif" }}>
                              {gradeLabel(user.classGrade)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/30 text-xs font-medium text-emerald-400"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3">
                        {user.userId && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-0.5 uppercase tracking-wide"
                              style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>Student ID</p>
                            <p className="text-xs sm:text-sm text-slate-200 font-mono font-medium break-all">
                              {user.userId}
                            </p>
                          </div>
                        )}
                        {user.registrationNumber && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-0.5 uppercase tracking-wide"
                              style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em' }}>Reg. Number</p>
                            <p className="text-xs sm:text-sm text-slate-200 font-mono font-medium break-all">
                              {user.registrationNumber}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-slate-700/30 no-print">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg transition-colors border border-indigo-500/30 text-xs sm:text-sm font-medium"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <Edit size={13} className="sm:w-4 sm:h-4" />
                        Edit Profile
                      </button>
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors border border-slate-700/50 text-xs sm:text-sm font-medium"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <Lock size={13} className="sm:w-4 sm:h-4" />
                        Password
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors border border-slate-700/50 text-xs sm:text-sm font-medium col-span-2 sm:col-span-1"
                        style={{ fontFamily: "'Outfit', sans-serif" }}>
                        <Printer size={13} className="sm:w-4 sm:h-4" />
                        Print
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Details Grid ─────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

                  {/* Personal Information */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 border border-slate-700/30">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2"
                      style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                        <User size={11} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                      Personal Information
                    </h3>
                    <div className="space-y-0">
                      <DataField icon={User} label="Surname" value={user.surname} />
                      <DataField icon={User} label="Full Name" value={user.fullName || user.name} />
                      <DataField icon={Mail} label="Email Address" value={user.email} />
                      <DataField icon={Calendar} label="Date of Birth"
                        value={(user as any).dob ? formatDate((user as any).dob) : undefined} />
                      <DataField icon={User} label="Gender"
                        value={(user as any).gender
                          ? (user as any).gender.charAt(0).toUpperCase() + (user as any).gender.slice(1)
                          : undefined} />
                      <DataField icon={User} label="Blood Group" value={(user as any).bloodGroup} />
                      <DataField icon={User} label="Religion" value={(user as any).religion} />
                    </div>
                  </div>

                  {/* Contact & Guardian */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 border border-slate-700/30">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2"
                      style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                        <Phone size={11} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                      Contact Information
                    </h3>
                    <div className="space-y-0">
                      <DataField icon={Phone} label="Phone Number" value={user.phoneNumber} />
                      <DataField icon={Phone} label="Guardian Phone" value={(user as any).guardianPhone} />
                      <DataField icon={MapPin} label="Address" value={user.address} />
                    </div>
                  </div>

                  {/* Academic Information */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 border border-slate-700/30">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2"
                      style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={11} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                      Academic Information
                    </h3>
                    <div className="space-y-0">
                      <DataField icon={GraduationCap} label="Class / Grade"
                        value={gradeLabel(user.classGrade)} />
                      <DataField icon={BookOpen} label="School" value={(user as any).school} />
                      <DataField icon={BookOpen} label="College" value={(user as any).college} />
                      <DataField icon={FileText} label="Registration Number"
                        value={user.registrationNumber} />
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 border border-slate-700/30">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2"
                      style={{ fontFamily: "'Outfit', sans-serif" }}>
                      <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                        <Shield size={11} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                      </div>
                      Account Information
                    </h3>
                    <div className="space-y-0">
                      <DataField icon={Shield} label="Account Type" value="Student" />
                      <DataField icon={CheckCircle2} label="Account Status"
                        value={user.status
                          ? user.status.charAt(0).toUpperCase() + user.status.slice(1)
                          : undefined} />
                      <DataField icon={Calendar} label="Account Created"
                        value={user.createdAt ? formatDate(user.createdAt) : undefined} />
                    </div>
                  </div>
                </div>

                {/* ── Activity Timeline ──────────────────────────────────────────── */}
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 border border-slate-700/30">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-3 sm:mb-4 flex items-center gap-2"
                    style={{ fontFamily: "'Outfit', sans-serif" }}>
                    <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-slate-800/60 flex items-center justify-center flex-shrink-0">
                      <Clock size={11} className="sm:w-3.5 sm:h-3.5 text-slate-400" />
                    </div>
                    Recent Activity
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {user.lastLogin && (
                      <div className="flex items-start gap-3 pb-2 sm:pb-3 border-b border-slate-700/30">
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-slate-300 font-medium mb-0.5"
                            style={{ fontFamily: "'Outfit', sans-serif" }}>Last Login</p>
                          <p className="text-xs text-slate-500 font-mono break-words">
                            {formatDate(user.lastLogin)} at {formatTime(user.lastLogin)}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-2 w-2 rounded-full bg-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-slate-300 font-medium mb-0.5"
                          style={{ fontFamily: "'Outfit', sans-serif" }}>Account Created</p>
                        <p className="text-xs text-slate-500 font-mono break-words">
                          {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => setShowPasswordModal(false)}
        />
      )}
    </>
  );
};

export default Profile4;
