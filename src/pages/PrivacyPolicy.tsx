// src/pages/PrivacyPolicy.tsx
import { ArrowLeft, Shield, Eye, Lock, Database, UserCheck, Mail, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-xl border-b border-gray-700/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Go Back</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-600 to-primary-500 mb-6 shadow-2xl shadow-primary-500/50">
            <Shield size={40} className="text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-400">Last Updated: January 27, 2026</p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Introduction */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Introduction</h2>
                <p className="text-gray-300 leading-relaxed">
                  Welcome to our Learning Management System. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
                </p>
              </div>
            </div>
          </section>

          {/* Information We Collect */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Database size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Information We Collect</h2>
                <div className="space-y-4 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Personal Information</h3>
                    <p className="leading-relaxed mb-2">When you register for an account, we collect:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Full name and surname</li>
                      <li>Date of birth</li>
                      <li>Phone number and guardian phone number</li>
                      <li>Email address (optional)</li>
                      <li>Blood group (optional)</li>
                      <li>Gender and religion (optional)</li>
                      <li>Class/Grade information</li>
                      <li>Student ID (generated automatically)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Academic Information</h3>
                    <p className="leading-relaxed mb-2">We collect information related to your learning activities:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Course enrollments and progress</li>
                      <li>Quiz and assignment scores</li>
                      <li>Study materials accessed</li>
                      <li>Learning achievements and milestones</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Technical Information</h3>
                    <p className="leading-relaxed mb-2">We automatically collect certain technical data:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>IP address and device information</li>
                      <li>Browser type and version</li>
                      <li>Usage patterns and preferences</li>
                      <li>Login timestamps and session data</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                <Eye size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">How We Use Your Information</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">We use the collected information for the following purposes:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>To provide and maintain our educational services</li>
                    <li>To personalize your learning experience</li>
                    <li>To communicate with you about your account and courses</li>
                    <li>To send important notifications via SMS and email</li>
                    <li>To track your academic progress and achievements</li>
                    <li>To improve our platform and develop new features</li>
                    <li>To ensure platform security and prevent fraud</li>
                    <li>To comply with legal obligations</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Information Sharing */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                <UserCheck size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Information Sharing and Disclosure</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">We do not sell your personal information. We may share your information only in the following circumstances:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong className="text-white">With Teachers and Administrators:</strong> Your academic information is shared with authorized teachers and administrators to support your learning</li>
                    <li><strong className="text-white">With Guardians:</strong> If you provide a guardian phone number, we may share academic progress information with them</li>
                    <li><strong className="text-white">Service Providers:</strong> We may share data with trusted third-party service providers who help us operate our platform (e.g., SMS gateway, cloud hosting)</li>
                    <li><strong className="text-white">Legal Requirements:</strong> We may disclose information if required by law or to protect our legal rights</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Lock size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Data Security</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    We implement industry-standard security measures to protect your personal information:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Encrypted data transmission using HTTPS/SSL</li>
                    <li>Secure password storage with bcrypt hashing</li>
                    <li>Two-factor authentication via OTP</li>
                    <li>Regular security audits and monitoring</li>
                    <li>Access controls and role-based permissions</li>
                    <li>Secure cloud infrastructure with Firebase</li>
                  </ul>
                  <p className="leading-relaxed mt-4">
                    However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Shield size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Your Privacy Rights</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">You have the following rights regarding your personal information:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong className="text-white">Access:</strong> You can request a copy of your personal data</li>
                    <li><strong className="text-white">Correction:</strong> You can update or correct your information through your account settings</li>
                    <li><strong className="text-white">Deletion:</strong> You can request deletion of your account and associated data</li>
                    <li><strong className="text-white">Opt-out:</strong> You can opt out of non-essential communications</li>
                    <li><strong className="text-white">Data Portability:</strong> You can request your data in a portable format</li>
                  </ul>
                  <p className="leading-relaxed mt-4">
                    To exercise these rights, please contact us at{' '}
                    <a href="mailto:privacy@example.com" className="text-primary-400 hover:text-primary-300 underline">
                      privacy@example.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Children's Privacy */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center flex-shrink-0">
                <UserCheck size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Children's Privacy</h2>
                <p className="text-gray-300 leading-relaxed">
                  Our platform is designed for students of various ages. We are committed to protecting the privacy of minors. We encourage parents and guardians to monitor their children's online activities. If you believe we have collected information from a child without proper consent, please contact us immediately.
                </p>
              </div>
            </div>
          </section>

          {/* Cookies and Tracking */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Eye size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Cookies and Tracking Technologies</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    We use cookies and similar tracking technologies to enhance your experience:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong className="text-white">Essential Cookies:</strong> Required for authentication and security</li>
                    <li><strong className="text-white">Preference Cookies:</strong> Remember your settings and preferences</li>
                    <li><strong className="text-white">Analytics Cookies:</strong> Help us understand how you use our platform</li>
                  </ul>
                  <p className="leading-relaxed mt-4">
                    You can control cookies through your browser settings, but some features may not function properly if you disable them.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Changes to Privacy Policy */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Changes to This Privacy Policy</h2>
                <p className="text-gray-300 leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically for any changes.
                </p>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-gradient-to-r from-primary-900/40 to-purple-900/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-primary-700/50">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Mail size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:
                  </p>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <Mail size={16} className="text-primary-400" />
                      <a href="mailto:privacy@example.com" className="text-primary-400 hover:text-primary-300 underline">
                        privacy@example.com
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <Shield size={16} className="text-primary-400" />
                      Data Protection Officer: dpo@example.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white px-6 py-3 rounded-xl transition-all duration-300 active:scale-95 font-semibold shadow-2xl hover:shadow-primary-500/50"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
