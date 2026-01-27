// src/pages/TermsOfService.tsx
import { ArrowLeft, FileText, Scale, AlertTriangle, CheckCircle, XCircle, Users, BookOpen, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsOfService = () => {
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
            <Scale size={40} className="text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-4">
            Terms of Service
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
                  Welcome to our Learning Management System. These Terms of Service ("Terms") govern your access to and use of our educational platform, services, and applications. By creating an account or using our services, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our platform.
                </p>
              </div>
            </div>
          </section>

          {/* Acceptance of Terms */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Acceptance of Terms</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    By registering for an account, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. You also represent that:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>You have the legal capacity to enter into this agreement</li>
                    <li>All information you provide is accurate and complete</li>
                    <li>You will maintain the accuracy of your account information</li>
                    <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* User Accounts */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">User Accounts and Registration</h2>
                <div className="space-y-4 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Account Creation</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>You must provide accurate and complete information during registration</li>
                      <li>You must verify your phone number via OTP before account activation</li>
                      <li>Student accounts are automatically approved upon successful verification</li>
                      <li>Teacher and Admin accounts require manual approval</li>
                      <li>Each user may only create one account</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Account Security</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>You are responsible for maintaining the security of your account credentials</li>
                      <li>You must not share your Student ID or password with others</li>
                      <li>You must notify us immediately of any unauthorized access</li>
                      <li>We are not liable for any loss resulting from unauthorized use of your account</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Account Termination</h3>
                    <p className="leading-relaxed">
                      We reserve the right to suspend or terminate your account if you violate these Terms, engage in fraudulent activities, or for any other reason at our discretion. You may also request account deletion at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* User Conduct */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Acceptable Use Policy</h2>
                <div className="space-y-4 text-gray-300">
                  <p className="leading-relaxed">You agree not to:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Use the platform for any illegal or unauthorized purpose</li>
                    <li>Violate any laws in your jurisdiction</li>
                    <li>Infringe upon or violate our intellectual property rights or the rights of others</li>
                    <li>Harass, abuse, insult, harm, defame, slander, or intimidate any person</li>
                    <li>Submit false or misleading information</li>
                    <li>Upload or transmit viruses, malware, or any malicious code</li>
                    <li>Interfere with the security or proper functioning of the platform</li>
                    <li>Attempt to gain unauthorized access to any portion of the platform</li>
                    <li>Copy, modify, or distribute content without permission</li>
                    <li>Use automated systems (bots, scrapers) to access the platform</li>
                    <li>Share your account credentials or Student ID with others</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Educational Services */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Educational Services</h2>
                <div className="space-y-4 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Course Access</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Access to courses is granted based on enrollment and payment status</li>
                      <li>Course content and schedules are subject to change</li>
                      <li>We do not guarantee specific learning outcomes or results</li>
                      <li>Course materials are for personal use only and may not be redistributed</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Academic Integrity</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>You must complete assignments and quizzes independently unless collaboration is explicitly permitted</li>
                      <li>Plagiarism, cheating, or academic dishonesty is strictly prohibited</li>
                      <li>Violations may result in account suspension or termination</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Certificates and Achievements</h3>
                    <p className="leading-relaxed">
                      Certificates and achievements earned through the platform are awarded based on completion criteria set by instructors. We reserve the right to revoke certificates if academic dishonesty is discovered.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Payment and Refunds */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <CreditCard size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Payment and Refunds</h2>
                <div className="space-y-4 text-gray-300">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Course Payments</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Course fees are clearly displayed before enrollment</li>
                      <li>All payments must be made through our secure payment gateway</li>
                      <li>Prices are subject to change without notice</li>
                      <li>Payment confirmation is sent via SMS and email</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Refund Policy</h3>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Refund requests must be submitted within 7 days of payment</li>
                      <li>Refunds are processed within 10-14 business days</li>
                      <li>Refunds may be denied if significant course content has been accessed</li>
                      <li>We reserve the right to deny refund requests at our discretion</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Intellectual Property */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Scale size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Intellectual Property Rights</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    All content on the platform, including but not limited to text, graphics, logos, images, videos, audio clips, software, and course materials, is the property of our company or our content suppliers and is protected by copyright, trademark, and other intellectual property laws.
                  </p>
                  <p className="leading-relaxed">
                    You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our platform without prior written consent.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Disclaimers */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                <XCircle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Disclaimers and Limitations of Liability</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
                  </p>
                  <p className="leading-relaxed">
                    TO THE FULLEST EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
                  </p>
                  <p className="leading-relaxed">
                    We are not responsible for any technical failures, internet outages, or other issues beyond our control that may affect your access to the platform.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Privacy and Data Protection */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Privacy and Data Protection</h2>
                <p className="text-gray-300 leading-relaxed">
                  Your use of the platform is also governed by our Privacy Policy, which explains how we collect, use, and protect your personal information. By using our services, you consent to the collection and use of your information as described in our{' '}
                  <a 
                    href="/privacy-policy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 underline"
                  >
                    Privacy Policy
                  </a>.
                </p>
              </div>
            </div>
          </section>

          {/* Modifications to Terms */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Modifications to Terms</h2>
                <p className="text-gray-300 leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the platform after such modifications constitutes your acceptance of the updated Terms. We encourage you to review these Terms periodically.
                </p>
              </div>
            </div>
          </section>

          {/* Governing Law */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <Scale size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Governing Law and Dispute Resolution</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    These Terms shall be governed by and construed in accordance with the laws of Bangladesh, without regard to its conflict of law provisions.
                  </p>
                  <p className="leading-relaxed">
                    Any disputes arising out of or relating to these Terms or the use of our platform shall be resolved through binding arbitration in accordance with the rules of the Bangladesh Arbitration Council, or through the courts of Bangladesh.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Severability */}
          <section className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-gray-700/50">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Severability</h2>
                <p className="text-gray-300 leading-relaxed">
                  If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue to be valid and enforceable to the fullest extent permitted by law.
                </p>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-gradient-to-r from-primary-900/40 to-purple-900/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-primary-700/50">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
                <div className="space-y-3 text-gray-300">
                  <p className="leading-relaxed">
                    If you have any questions about these Terms of Service, please contact us:
                  </p>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <FileText size={16} className="text-primary-400" />
                      Email:{' '}
                      <a href="mailto:legal@example.com" className="text-primary-400 hover:text-primary-300 underline">
                        legal@example.com
                      </a>
                    </p>
                    <p className="flex items-center gap-2">
                      <Scale size={16} className="text-primary-400" />
                      Legal Department: support@example.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-green-700/50">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-4">Acknowledgment</h2>
                <p className="text-gray-300 leading-relaxed">
                  BY USING OUR PLATFORM, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE AND AGREE TO BE BOUND BY THEM.
                </p>
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

export default TermsOfService;
