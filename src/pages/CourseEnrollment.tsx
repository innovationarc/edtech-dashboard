// src/pages/CourseEnrollment.tsx - PART 1 OF 2
// Course Enrollment with Complete Error Handling and User Feedback

import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Star, Clock, Users, Play, BookOpen, Award, Eye,
  CheckCircle, Lock, Calendar, User, Video, FileText, Heart, X,
  Grid3X3, List, Loader, Tag, TrendingUp, Download, ShoppingCart,
  AlertCircle, Percent, DollarSign, Check, AlertTriangle
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course, EnrollmentCalculation } from '../services/courseService';

// ==================== INTERFACES ====================

interface EnrichedCourse extends Course {
  isEnrolled?: boolean;
  progress?: number;
  isFavorite?: boolean;
  enrollmentId?: string;
}

interface EnrollmentModalData {
  course: Course;
  calculation: EnrollmentCalculation;
  couponCode: string;
}

// ==================== MAIN COMPONENT ====================

const CourseEnrollment = () => {
  const { user } = useDashboard();

  // ==================== STATE MANAGEMENT ====================

  const [activeTab, setActiveTab] = useState<'available' | 'enrolled'>('available');

  // Course Data
  const [allCourses, setAllCourses] = useState<EnrichedCourse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<EnrichedCourse[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrichedCourse[]>([]);

  // Loading & Messages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<EnrichedCourse | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentModalData | null>(null);

  // Enrollment Process
  const [enrolling, setEnrolling] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  // Filter Options
  const [categories, setCategories] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  // ==================== INITIAL LOAD ====================

  useEffect(() => {
    if (user?.uid) {
      loadCourses();
    }
  }, [user]);

  useEffect(() => {
    filterCourses();
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy, allCourses, activeTab]);

  // ==================== DATA LOADING ====================

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Loading courses...');

      const publishedCourses = await courseService.getPublishedCourses();
      console.log('Published courses loaded:', publishedCourses.length);
      
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      console.log('User enrollments:', enrollments.length);
      
      const enrolledCourseIds = enrollments.map(e => e.courseId);
      
      const enrollmentMap = new Map();
      enrollments.forEach(enrollment => {
        enrollmentMap.set(enrollment.courseId, {
          progress: enrollment.progress || 0,
          enrollmentId: enrollment.id
        });
      });

      const enrichedCourses: EnrichedCourse[] = publishedCourses.map(course => {
        const isEnrolled = enrolledCourseIds.includes(course.id);
        const enrollmentInfo = enrollmentMap.get(course.id);

        return {
          ...course,
          isEnrolled,
          progress: enrollmentInfo?.progress || 0,
          enrollmentId: enrollmentInfo?.enrollmentId,
          isFavorite: false
        };
      });

      setAllCourses(enrichedCourses);

      const categorySet = new Set<string>();
      const classSet = new Set<string>();
      
      enrichedCourses.forEach(course => {
        if (course.category) categorySet.add(course.category);
        if (course.class) classSet.add(course.class);
      });
      
      setCategories(Array.from(categorySet).sort());
      setClasses(Array.from(classSet).sort());

      console.log('Courses loaded successfully');
    } catch (error: any) {
      console.error('Error loading courses:', error);
      setError('Failed to load courses. Please refresh the page or try again later.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== FILTERING & SORTING ====================

  const filterCourses = () => {
    let filtered = activeTab === 'available'
      ? allCourses.filter(course => !course.isEnrolled)
      : allCourses.filter(course => course.isEnrolled);

    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        course.subjects?.some(subject => subject.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(course => course.category === selectedCategory);
    }

    if (selectedClass !== 'all') {
      filtered = filtered.filter(course => course.class === selectedClass);
    }

    if (selectedLevel !== 'all') {
      filtered = filtered.filter(course => course.level === selectedLevel);
    }

    if (priceFilter !== 'all') {
      if (priceFilter === 'free') {
        filtered = filtered.filter(course => course.price === 0);
      } else if (priceFilter === 'paid') {
        filtered = filtered.filter(course => course.price > 0);
      } else if (priceFilter === 'under1000') {
        filtered = filtered.filter(course => course.price < 1000);
      } else if (priceFilter === 'under5000') {
        filtered = filtered.filter(course => course.price < 5000);
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.studentCount - a.studentCount;
        case 'rating':
          return b.rating - a.rating;
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        default:
          return 0;
      }
    });

    if (activeTab === 'available') {
      setAvailableCourses(sorted);
    } else {
      setEnrolledCourses(sorted);
    }
  };

  // ==================== EVENT HANDLERS ====================

  const handleCourseClick = (course: EnrichedCourse) => {
    setSelectedCourse(course);
    setShowCourseModal(true);
  };

  const handleEnrollClick = async (course: EnrichedCourse) => {
    if (!user) {
      setError('Please login to enroll in courses');
      return;
    }

    try {
      setCalculatingPrice(true);
      setError('');
      setWarning('');

      console.log('Calculating enrollment price...');

      const calculation = await courseService.calculateEnrollmentPrice(
        course.id,
        user.uid,
        couponCode || undefined
      );

      console.log('Price calculation:', calculation);

      setEnrollmentData({
        course,
        calculation,
        couponCode: ''
      });

      setShowEnrollmentModal(true);
    } catch (error: any) {
      console.error('Error calculating price:', error);
      setError('Failed to calculate price. Please try again.');
    } finally {
      setCalculatingPrice(false);
    }
  };

  const handleApplyCoupon = async (code: string) => {
    if (!enrollmentData) return;

    try {
      setCalculatingPrice(true);
      setError('');

      console.log('Applying coupon code:', code);

      const calculation = await courseService.calculateEnrollmentPrice(
        enrollmentData.course.id,
        user?.uid || '',
        code
      );

      setEnrollmentData({
        ...enrollmentData,
        calculation,
        couponCode: code
      });

      console.log('Coupon applied:', calculation);
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      setError('Failed to apply coupon code');
    } finally {
      setCalculatingPrice(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!enrollmentData || !user) return;

    try {
      setEnrolling(true);
      setError('');
      setWarning('');

      const { course, calculation } = enrollmentData;

      console.log('Processing enrollment...', {
        courseId: course.id,
        finalPrice: calculation.finalPrice
      });

      // Free course - direct enrollment
      if (calculation.finalPrice === 0) {
        await handleFreeEnrollment(course, calculation);
        return;
      }

      // Paid course - initiate payment
      console.log('Initiating payment...');

      const enrollmentResponse = await courseService.enrollStudent({
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        calculation
      });

      console.log('Enrollment response:', enrollmentResponse);

      if (enrollmentResponse.success && enrollmentResponse.gatewayUrl) {
        // Store pending enrollment
        sessionStorage.setItem('pendingEnrollment', JSON.stringify({
          courseId: course.id,
          transactionId: enrollmentResponse.transactionId,
          calculation
        }));

        console.log('Redirecting to payment gateway...');
        
        // Show redirect message
        setWarning('Redirecting to secure payment gateway...');
        
        // Redirect after short delay
        setTimeout(() => {
          window.location.href = enrollmentResponse.gatewayUrl!;
        }, 1000);
      } else {
        throw new Error(enrollmentResponse.error || 'Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Error proceeding to payment:', error);
      setError(error.message || 'Failed to process enrollment. Please try again.');
      setEnrolling(false);
    }
  };

  const handleFreeEnrollment = async (course: Course, calculation: EnrollmentCalculation) => {
    if (!user) return;

    try {
      console.log('Processing free enrollment...');

      const enrollmentResponse = await courseService.enrollStudent({
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        calculation
      });

      if (enrollmentResponse.success) {
        setSuccess(`Successfully enrolled in "${course.title}"! Check your Content Library.`);
        setShowEnrollmentModal(false);
        setEnrollmentData(null);
        
        await loadCourses();
        setActiveTab('enrolled');

        console.log('Free enrollment successful');
      } else {
        throw new Error(enrollmentResponse.error || 'Enrollment failed');
      }
    } catch (error: any) {
      console.error('Error enrolling in free course:', error);
      setError(error.message || 'Failed to enroll in course');
    } finally {
      setEnrolling(false);
    }
  };

  const toggleFavorite = (courseId: string) => {
    setAllCourses(prevCourses => 
      prevCourses.map(course => 
        course.id === courseId 
          ? { ...course, isFavorite: !course.isFavorite }
          : course
      )
    );
  };

  // ==================== PAYMENT CALLBACK HANDLING ====================

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const transactionId = urlParams.get('tran_id');

    if (status && transactionId) {
      handlePaymentCallback(status, transactionId);
    }
  }, []);

  const handlePaymentCallback = async (status: string, transactionId: string) => {
    try {
      setLoading(true);
      console.log('Payment callback:', { status, transactionId });

      if (status === 'success') {
        console.log('Validating payment...');
        
        const validation = await courseService.validatePayment(transactionId);
        
        console.log('Payment validation:', validation);
        
        if (validation.success && validation.validated) {
          setSuccess('🎉 Payment successful! Your enrollment is confirmed. Welcome to the course!');
          sessionStorage.removeItem('pendingEnrollment');
          await loadCourses();
          setActiveTab('enrolled');
        } else {
          setWarning('Payment validation is pending. Please contact support if you were charged.');
        }
      } else if (status === 'failed') {
        setError('❌ Payment failed. Please try again or contact support.');
        sessionStorage.removeItem('pendingEnrollment');
      } else if (status === 'cancel') {
        setWarning('Payment was cancelled. You can try enrolling again.');
        sessionStorage.removeItem('pendingEnrollment');
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error: any) {
      console.error('Error handling payment callback:', error);
      setError('Error processing payment. Please contact support if you were charged.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== HELPER FUNCTIONS ====================

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-success-dark text-success-light';
      case 'intermediate': return 'bg-warning-dark text-warning-light';
      case 'advanced': return 'bg-error-dark text-error-light';
      default: return 'bg-background-700 text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setWarning('');
  };

  // CONTINUE IN PART 2...
  // src/pages/CourseEnrollment.tsx - PART 2 OF 2
  // UI Components with Error Handling and User Feedback
  
  // PASTE THIS IMMEDIATELY AFTER PART 1

  // ==================== RENDER: LOADING STATE ====================

  if (loading && allCourses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading courses...</p>
        </div>
      </div>
    );
  }

  // ==================== COURSE CARD COMPONENT ====================

  const CourseCard = ({ course }: { course: EnrichedCourse }) => {
    const isEnrolled = course.isEnrolled;

    return (
      <Card className="p-0 hover:shadow-lg transition-all duration-300 group overflow-hidden">
        <div className="relative">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-r from-primary-600 to-secondary-600 flex items-center justify-center">
              <BookOpen size={48} className="text-white opacity-50" />
            </div>
          )}

          <div className="absolute top-3 right-3 flex gap-2">
            {!isEnrolled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(course.id);
                }}
                className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
                  course.isFavorite 
                    ? 'bg-red-500 text-white' 
                    : 'bg-black/50 text-white hover:bg-red-500'
                }`}
              >
                <Heart size={16} className={course.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          <div className="absolute bottom-3 left-3">
            <span className={`px-2 py-1 rounded-full text-xs ${getLevelColor(course.level)}`}>
              {course.level}
            </span>
          </div>

          {isEnrolled && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-success-DEFAULT text-white rounded-full text-xs flex items-center gap-1">
                <CheckCircle size={12} />
                Enrolled
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 text-sm">
            <div className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400 fill-current" />
              <span className="text-white">{course.rating.toFixed(1)}</span>
              <span className="text-gray-400">({course.reviewCount})</span>
            </div>
            <span className="text-gray-400">•</span>
            <span className="text-gray-400">{course.studentCount.toLocaleString()} students</span>
          </div>

          <h3 
            className="text-white font-medium mb-2 line-clamp-2 cursor-pointer hover:text-primary-300 transition-colors"
            onClick={() => handleCourseClick(course)}
          >
            {course.title}
          </h3>

          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="text-gray-400">{course.class}</span>
            {course.category && (
              <>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400">{course.category}</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold text-white">
              {course.price === 0 ? 'Free' : `৳${course.price}`}
            </span>
          </div>

          {isEnrolled && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Progress</span>
                <span className="text-white">{course.progress}%</span>
              </div>
              <div className="w-full bg-background-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-success-DEFAULT transition-all"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
          )}

          {isEnrolled ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleCourseClick(course)}
                className="flex-1 py-2 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                <span>Overview</span>
              </button>
              <button
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play size={16} />
                <span>Continue</span>
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleCourseClick(course)}
                className="flex-1 py-2 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                <span>Details</span>
              </button>
              <button
                onClick={() => handleEnrollClick(course)}
                disabled={enrolling || calculatingPrice}
                className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {calculatingPrice ? (
                  <Loader size={16} className="animate-spin" />
                ) : (
                  <>
                    <TrendingUp size={16} />
                    <span>Enroll</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  // ==================== ENROLLMENT MODAL ====================

  const EnrollmentModal = () => {
    if (!enrollmentData) return null;

    const { course, calculation, couponCode: currentCoupon } = enrollmentData;
    const [localCouponCode, setLocalCouponCode] = useState(currentCoupon);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-background-900 rounded-xl w-full max-w-md shadow-2xl border border-background-700">
          <div className="flex items-center justify-between p-6 border-b border-background-700">
            <h2 className="text-xl font-bold text-white">Complete Enrollment</h2>
            <button
              onClick={() => {
                setShowEnrollmentModal(false);
                setEnrollmentData(null);
                clearMessages();
              }}
              disabled={enrolling}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-medium text-white mb-1">{course.title}</h3>
              <p className="text-sm text-gray-400">{course.class}</p>
            </div>

            <div className="bg-background-800 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Base Price</span>
                <span className="text-white font-medium">৳{calculation.basePrice}</span>
              </div>

              {calculation.previousStudentDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Percent size={14} />
                    Previous Student
                  </span>
                  <span className="text-green-400">-৳{calculation.previousStudentDiscount}</span>
                </div>
              )}

              {calculation.extraDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Tag size={14} />
                    Limited Time
                  </span>
                  <span className="text-green-400">-৳{calculation.extraDiscount}</span>
                </div>
              )}

              {calculation.totalDiscount > 0 && (
                <div className="pt-2 border-t border-background-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Total Savings</span>
                    <span className="text-green-400 font-medium">৳{calculation.totalDiscount}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-background-700">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">Final Price</span>
                  <span className="text-2xl font-bold text-primary-400">
                    {calculation.finalPrice === 0 ? 'Free' : `৳${calculation.finalPrice}`}
                  </span>
                </div>
              </div>
            </div>

            {calculation.hasPreviousEnrollments && calculation.previousStudentDiscount > 0 && (
              <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-green-400 font-medium">Previous Student Discount!</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Saving ৳{calculation.previousStudentDiscount}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-error-dark text-error-light p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {warning && (
              <div className="bg-warning-dark text-warning-light p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{warning}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowEnrollmentModal(false);
                  setEnrollmentData(null);
                  clearMessages();
                }}
                disabled={enrolling}
                className="flex-1 py-3 bg-background-700 hover:bg-background-600 disabled:bg-background-800 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToPayment}
                disabled={enrolling}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {enrolling ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : calculation.finalPrice === 0 ? (
                  <>
                    <Check size={20} />
                    <span>Enroll Free</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={20} />
                    <span>Pay ৳{calculation.finalPrice}</span>
                  </>
                )}
              </button>
            </div>

            {calculation.finalPrice > 0 && !enrolling && (
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  🔒 Secure payment via SSLCOMMERZ
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Course Enrollment</h1>
          <p className="text-gray-400 mt-1 text-sm lg:text-base">
            Discover and enroll in courses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400'}`}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400'}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button onClick={clearMessages} className="text-error-light hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-success-dark text-success-light px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
          <button onClick={clearMessages} className="text-success-light hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {warning && (
        <div className="bg-warning-dark text-warning-light px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} />
            <span>{warning}</span>
          </div>
          <button onClick={clearMessages} className="text-warning-light hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex gap-4 border-b border-background-700">
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'available'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Available ({availableCourses.length})
        </button>
        <button
          onClick={() => setActiveTab('enrolled')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'enrolled'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Enrolled ({enrolledCourses.length})
        </button>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative lg:col-span-2">
            <input
              type="text"
              placeholder="Search courses..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Classes</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-primary-400" size={48} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeTab === 'available' ? availableCourses : enrolledCourses).map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {((activeTab === 'available' && availableCourses.length === 0) ||
            (activeTab === 'enrolled' && enrolledCourses.length === 0)) && (
            <div className="text-center py-12">
              <BookOpen size={48} className="mx-auto text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {activeTab === 'available' ? 'No courses found' : 'No enrolled courses'}
              </h3>
              <p className="text-gray-400">
                {activeTab === 'available' 
                  ? 'Try adjusting your filters'
                  : 'Enroll in a course to get started'}
              </p>
            </div>
          )}
        </>
      )}

      {showEnrollmentModal && <EnrollmentModal />}
    </div>
  );
};

export default CourseEnrollment;
