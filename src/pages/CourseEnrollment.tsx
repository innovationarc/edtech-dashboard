// src/pages/CourseEnrollment.tsx
// Course Enrollment — Real coupon validation + full statistics recording
// BUG FIX: Handles SSLCommerz payment return URL and creates enrollment on success

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, Star, Clock, Play, BookOpen, Award, Eye,
  CheckCircle, Calendar, Video, FileText, Heart, X,
  Grid3X3, List, Loader, Tag, TrendingUp, Download, ShoppingCart,
  AlertCircle, Percent, DollarSign, Check, AlertTriangle, ChevronDown,
  ExternalLink, Ticket, Info, Sparkles, Plus
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course, EnrollmentCalculation, AppliedCoupon } from '../services/courseService';

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
}

// ==================== COUPON FIELD STATE ====================

// State for the "add coupon" input row only.
// The list of applied coupons lives in calculation.appliedCoupons (sourced from the service).
type CouponInputFieldState = 'idle' | 'checking' | 'error';

interface CouponInputState {
  code: string;
  fieldState: CouponInputFieldState;
  errorMessage: string;
}

// ==================== PAYMENT RETURN STATE ====================

type PaymentReturnStatus = 'processing' | 'success' | 'failed' | 'cancelled';

interface PaymentReturnState {
  isHandling: boolean;
  status: PaymentReturnStatus;
  message: string;
  courseTitle?: string;
}

// ==================== MAIN COMPONENT ====================

const CourseEnrollment = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<EnrichedCourse | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentModalData | null>(null);

  // Enrollment Process
  const [enrolling, setEnrolling] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Coupon input field state (lives at page level for stable reference from EnrollmentModal)
  const [couponInput, setCouponInput] = useState<CouponInputState>({
    code: '',
    fieldState: 'idle',
    errorMessage: '',
  });

  // Filter Options
  const [categories, setCategories] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  // Payment return handling state
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturnState>({
    isHandling: false,
    status: 'processing',
    message: '',
  });

  // Ref to cancel in-flight coupon validation if user changes input fast
  const couponAbortRef = useRef<AbortController | null>(null);
  // Guard to prevent double-processing of payment return
  const paymentHandledRef = useRef(false);

  // ==================== PAYMENT RETURN HANDLER ====================
  // SSLCommerz redirects back with query params: ?tran_id=xxx&status=VALID/FAILED/CANCELLED
  // We must detect these params, create the enrollment, then clean the URL.

  useEffect(() => {
    if (!user?.uid || paymentHandledRef.current) return;

    const searchParams = new URLSearchParams(location.search);
    const tranId = searchParams.get('tran_id') || searchParams.get('tranId') || searchParams.get('transaction_id');
    const status = searchParams.get('status') || searchParams.get('payment_status');

    // Also support custom params our paymentService might append
    const courseId = searchParams.get('courseId') || searchParams.get('course_id');
    const paymentStatus = searchParams.get('paymentStatus');

    // Only handle if there's a transaction ID (payment gateway return)
    if (!tranId) return;

    paymentHandledRef.current = true;

    const handlePaymentReturn = async () => {
      console.log('');
      console.log('💳 PAYMENT RETURN DETECTED');
      console.log('═'.repeat(80));
      console.log('Transaction ID:', tranId);
      console.log('Status:', status);
      console.log('Course ID:', courseId);
      console.log('Payment Status:', paymentStatus);
      console.log('═'.repeat(80));

      // Clean URL immediately to prevent re-processing on refresh
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);

      // Handle failed/cancelled payment
      const statusLower = (status || paymentStatus || '').toLowerCase();
      if (statusLower === 'failed' || statusLower === 'fail') {
        setPaymentReturn({
          isHandling: true,
          status: 'failed',
          message: 'Payment was not successful. Please try again.',
        });
        setTimeout(() => {
          setPaymentReturn(prev => ({ ...prev, isHandling: false }));
        }, 4000);
        return;
      }

      if (statusLower === 'cancelled' || statusLower === 'cancel') {
        setPaymentReturn({
          isHandling: true,
          status: 'cancelled',
          message: 'Payment was cancelled. You can try enrolling again.',
        });
        setTimeout(() => {
          setPaymentReturn(prev => ({ ...prev, isHandling: false }));
        }, 4000);
        return;
      }

      // Payment appears successful — validate and complete enrollment
      setPaymentReturn({
        isHandling: true,
        status: 'processing',
        message: 'Verifying payment and activating your enrollment...',
      });

      try {
        // Step 1: Validate payment with payment service
        const validation = await courseService.validatePayment(tranId);
        console.log('Payment validation result:', validation);

        if (!validation.success || !validation.validated) {
          setPaymentReturn({
            isHandling: true,
            status: 'failed',
            message: validation.message || 'Payment validation failed. Please contact support with transaction ID: ' + tranId,
          });
          setTimeout(() => {
            setPaymentReturn(prev => ({ ...prev, isHandling: false }));
          }, 8000);
          return;
        }

        // Step 2: Extract metadata from payment service
        // The paymentService.validatePayment should return metadata embedded in the payment record
        // We need to reconstruct enrollment params. Try to get them from the validation response,
        // or fall back to querying the payment record directly.
        let enrollCourseId = courseId;
        let enrollStudentId = user.uid;
        let enrollStudentName = user.name;
        let enrollStudentEmail = user.email;
        let amountPaid = 0;
        let appliedCouponsJson = '[]';
        let discounts = {
          previousStudentDiscount: 0,
          extraDiscount: 0,
          couponDiscount: 0,
        };

        // If validation response includes metadata, use it
        const meta = (validation as any).metadata || (validation as any).paymentData?.metadata;
        if (meta) {
          enrollCourseId = meta.courseId || enrollCourseId;
          enrollStudentId = meta.studentId || enrollStudentId;
          enrollStudentName = meta.studentName || enrollStudentName;
          enrollStudentEmail = meta.studentEmail || enrollStudentEmail;
          amountPaid = Number(meta.finalPrice || meta.amount || 0);
          appliedCouponsJson = meta.appliedCoupons || '[]';
          discounts = {
            previousStudentDiscount: Number(meta.previousStudentDiscount || 0),
            extraDiscount: Number(meta.extraDiscount || 0),
            couponDiscount: Number(meta.couponDiscount || 0),
          };
        } else if ((validation as any).amount) {
          amountPaid = Number((validation as any).amount);
        }

        if (!enrollCourseId) {
          throw new Error('Could not determine course ID from payment. Please contact support with transaction ID: ' + tranId);
        }

        // Step 3: Create the enrollment
        setPaymentReturn(prev => ({
          ...prev,
          message: 'Payment verified! Activating your course access...',
        }));

        const enrollResult = await courseService.completeEnrollmentAfterPayment({
          transactionId: tranId,
          studentId: enrollStudentId,
          studentName: enrollStudentName,
          studentEmail: enrollStudentEmail,
          courseId: enrollCourseId,
          amountPaid,
          appliedCouponsJson,
          discounts,
        });

        if (enrollResult.success) {
          // Fetch course title for success message
          let courseTitle = 'the course';
          try {
            const course = await courseService.getCourseById(enrollCourseId);
            if (course) courseTitle = course.title;
          } catch (_) {}

          setPaymentReturn({
            isHandling: true,
            status: 'success',
            message: enrollResult.alreadyEnrolled
              ? `You are already enrolled in "${courseTitle}".`
              : `🎉 Successfully enrolled in "${courseTitle}"! You now have full access.`,
            courseTitle,
          });

          // Reload course data so UI reflects new enrollment
          await loadCourses();
          setActiveTab('enrolled');

          // Dismiss the payment return banner after a delay
          setTimeout(() => {
            setPaymentReturn(prev => ({ ...prev, isHandling: false }));
          }, 6000);
        } else {
          throw new Error(enrollResult.error || 'Enrollment creation failed after payment');
        }
      } catch (err: any) {
        console.error('Payment return handling error:', err);
        setPaymentReturn({
          isHandling: true,
          status: 'failed',
          message: `Payment was received but enrollment setup failed. Please contact support. Transaction ID: ${tranId}. Error: ${err.message}`,
        });
        setTimeout(() => {
          setPaymentReturn(prev => ({ ...prev, isHandling: false }));
        }, 15000);
      }
    };

    handlePaymentReturn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, location.search]);

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

      const publishedCourses = await courseService.getPublishedCourses();
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      
      const enrolledCourseIds = enrollments.map(e => e.courseId);
      
      const enrollmentMap = new Map<string, { progress: number; enrollmentId: string }>();
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
      if (priceFilter === 'free') filtered = filtered.filter(c => c.price === 0);
      else if (priceFilter === 'paid') filtered = filtered.filter(c => c.price > 0);
      else if (priceFilter === 'under1000') filtered = filtered.filter(c => c.price < 1000);
      else if (priceFilter === 'under5000') filtered = filtered.filter(c => c.price < 5000);
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'popular': return b.studentCount - a.studentCount;
        case 'rating': return b.rating - a.rating;
        case 'newest': return b.createdAt.getTime() - a.createdAt.getTime();
        case 'price-low': return a.price - b.price;
        case 'price-high': return b.price - a.price;
        default: return 0;
      }
    });

    if (activeTab === 'available') {
      setAvailableCourses(sorted);
    } else {
      setEnrolledCourses(sorted);
    }
  };

  // ==================== COUPON HELPERS ====================

  const resetCouponInput = useCallback(() => {
    couponAbortRef.current?.abort();
    setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
  }, []);

  /**
   * Tries to add a new coupon on top of already-applied ones.
   * Validates via courseService (which calls couponService internally).
   * On success: updates enrollmentData with new calculation (appliedCoupons grows by 1).
   * On failure: shows the exact rejection reason in the input field.
   */
  const addCoupon = useCallback(async (
    code: string,
    currentData: EnrollmentModalData
  ): Promise<void> => {
    const upper = code.trim().toUpperCase();
    if (!upper) return;

    // Duplicate check (UI-level, before hitting the service)
    if (currentData.calculation.appliedCoupons?.some(c => c.couponCode === upper)) {
      setCouponInput(prev => ({
        ...prev,
        fieldState: 'error',
        errorMessage: `Coupon "${upper}" is already applied.`,
      }));
      return;
    }

    // Cancel any previous in-flight validation
    couponAbortRef.current?.abort();
    const abort = new AbortController();
    couponAbortRef.current = abort;

    setCouponInput(prev => ({ ...prev, fieldState: 'checking', errorMessage: '' }));

    try {
      // Re-calculate with ALL existing codes plus the new one
      const existingCodes = (currentData.calculation.appliedCoupons ?? []).map(c => c.couponCode);
      const newCodes = [...existingCodes, upper];

      const newCalc = await courseService.calculateEnrollmentPrice(
        currentData.course.id,
        user?.uid || '',
        newCodes
      );

      if (abort.signal.aborted) return;

      // Did the service actually accept the new code?
      const wasAccepted = newCalc.appliedCoupons.some(c => c.couponCode === upper);

      if (wasAccepted) {
        setEnrollmentData({ ...currentData, calculation: newCalc });
        setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
      } else {
        // Validate in isolation to get the precise rejection reason
        const probeCalc = await courseService.calculateEnrollmentPrice(
          currentData.course.id,
          user?.uid || '',
          [upper]
        );
        if (abort.signal.aborted) return;

        const reason = probeCalc.couponError || 'This coupon cannot be applied.';
        setCouponInput(prev => ({ ...prev, fieldState: 'error', errorMessage: reason }));
      }
    } catch (err: any) {
      if (abort.signal.aborted) return;
      setCouponInput(prev => ({
        ...prev,
        fieldState: 'error',
        errorMessage: 'Unable to validate coupon. Please try again.',
      }));
    }
  }, [user]);

  /**
   * Removes one coupon by code from the applied list and recalculates price.
   */
  const removeCoupon = useCallback(async (
    couponCode: string,
    currentData: EnrollmentModalData
  ): Promise<void> => {
    const remaining = (currentData.calculation.appliedCoupons ?? [])
      .filter(c => c.couponCode !== couponCode)
      .map(c => c.couponCode);

    try {
      const newCalc = await courseService.calculateEnrollmentPrice(
        currentData.course.id,
        user?.uid || '',
        remaining
      );
      setEnrollmentData({ ...currentData, calculation: newCalc });
    } catch (err: any) {
      console.warn('Failed to recalculate after coupon removal:', err.message);
    }
  }, [user]);

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
      resetCouponInput();

      const calculation = await courseService.calculateEnrollmentPrice(
        course.id,
        user.uid,
        []
      );

      setEnrollmentData({ course, calculation });
      setShowEnrollmentModal(true);
    } catch (error: any) {
      console.error('Error calculating price:', error);
      setError('Failed to calculate price. Please try again.');
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

      // Free course — direct enrollment
      if (calculation.finalPrice === 0) {
        await handleFreeEnrollment(course, calculation);
        return;
      }

      // Paid course — initiate payment gateway
      const enrollmentResponse = await courseService.enrollStudent({
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        calculation
      });

      if (enrollmentResponse.success && enrollmentResponse.gatewayUrl) {
        setShowEnrollmentModal(false);
        // Redirect to payment gateway — enrollment will be completed when SSLCommerz
        // redirects back to this page with ?tran_id=xxx&status=VALID
        window.location.href = enrollmentResponse.gatewayUrl;
      } else {
        throw new Error(enrollmentResponse.error || 'Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Enrollment error:', error);
      setError(error.message || 'Failed to process enrollment. Please try again.');
      setEnrolling(false);
    }
  };

  const handleFreeEnrollment = async (course: Course, calculation: EnrollmentCalculation) => {
    if (!user) return;

    try {
      const enrollmentResponse = await courseService.enrollStudent({
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        calculation
      });

      if (enrollmentResponse.success) {
        setSuccess(`✅ Successfully enrolled in "${course.title}"!`);
        setShowEnrollmentModal(false);
        setEnrollmentData(null);
        resetCouponInput();
        await loadCourses();
        setActiveTab('enrolled');
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
    setAllCourses(prev => prev.map(c => c.id === courseId ? { ...c, isFavorite: !c.isFavorite } : c));
  };

  const handleContinueLearning = (courseId: string) => {
    navigate(`/content-library?courseId=${courseId}`);
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
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setWarning('');
  };

  const closeEnrollmentModal = () => {
    setShowEnrollmentModal(false);
    setEnrollmentData(null);
    resetCouponInput();
    clearMessages();
  };

  // ==================== RENDER: PAYMENT RETURN BANNER ====================

  const PaymentReturnBanner = () => {
    if (!paymentReturn.isHandling) return null;

    const bgMap: Record<PaymentReturnStatus, string> = {
      processing: 'bg-blue-900/80 border-blue-500/50 text-blue-200',
      success: 'bg-success-dark border-green-500/50 text-success-light',
      failed: 'bg-error-dark border-red-500/50 text-error-light',
      cancelled: 'bg-warning-dark border-yellow-500/50 text-warning-light',
    };

    const iconMap: Record<PaymentReturnStatus, React.ReactNode> = {
      processing: <Loader size={20} className="animate-spin flex-shrink-0" />,
      success: <CheckCircle size={20} className="flex-shrink-0" />,
      failed: <AlertCircle size={20} className="flex-shrink-0" />,
      cancelled: <AlertTriangle size={20} className="flex-shrink-0" />,
    };

    return (
      <div className={`border rounded-lg px-4 py-3 flex items-center gap-3 ${bgMap[paymentReturn.status]}`}>
        {iconMap[paymentReturn.status]}
        <span className="text-sm">{paymentReturn.message}</span>
        {paymentReturn.status !== 'processing' && (
          <button
            onClick={() => setPaymentReturn(prev => ({ ...prev, isHandling: false }))}
            className="ml-auto opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  };

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

    const specialFeatures: string[] = [];
    if (course.hasAiQnA) specialFeatures.push('AI Q&A');
    if (course.hasHumanQnA) specialFeatures.push('Human Q&A');
    if (course.hasStudyPlanner) specialFeatures.push('Study Planner');

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
                onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
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

          {specialFeatures.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {specialFeatures.map((feature, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-primary-900/30 text-primary-300 rounded text-xs border border-primary-800"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold text-white">
              {course.price === 0 ? 'Free' : `৳${course.price.toLocaleString()}`}
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
                onClick={() => handleContinueLearning(course.id)}
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
                <span>Overview</span>
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

  // ==================== COURSE OVERVIEW MODAL ====================

  const CourseOverviewModal = () => {
    if (!selectedCourse) return null;

    const isEnrolled = selectedCourse.isEnrolled;

    const routineFilesByCategory = selectedCourse.routineFiles?.reduce((acc, file) => {
      if (!acc[file.category]) {
        acc[file.category] = [];
      }
      acc[file.category].push(file);
      return acc;
    }, {} as Record<string, typeof selectedCourse.routineFiles>);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-xl w-full max-w-4xl shadow-2xl border border-background-700 my-8">
          <div className="flex items-center justify-between p-6 border-b border-background-700 sticky top-0 bg-background-900 z-10">
            <h2 className="text-2xl font-bold text-white">Course Overview</h2>
            <button
              onClick={() => { setShowCourseModal(false); setSelectedCourse(null); }}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {selectedCourse.thumbnail && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={selectedCourse.thumbnail}
                  alt={selectedCourse.title}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{selectedCourse.title}</h3>
              {selectedCourse.description && (
                <p className="text-gray-300 leading-relaxed">{selectedCourse.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {selectedCourse.class && (
                <div className="bg-background-800 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Class</p>
                  <p className="text-white font-medium">{selectedCourse.class}</p>
                </div>
              )}
              {selectedCourse.category && (
                <div className="bg-background-800 p-4 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Category</p>
                  <p className="text-white font-medium">{selectedCourse.category}</p>
                </div>
              )}
            </div>

            {selectedCourse.level && selectedCourse.level !== 'unspecified' && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">Level</p>
                <span className={`px-3 py-1 rounded-full text-sm ${getLevelColor(selectedCourse.level)}`}>
                  {selectedCourse.level}
                </span>
              </div>
            )}

            {isEnrolled && selectedCourse.duration && selectedCourse.duration !== '00:00' && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Duration</p>
                <p className="text-white font-medium flex items-center gap-2">
                  <Clock size={16} className="text-primary-400" />
                  {selectedCourse.duration}
                </p>
              </div>
            )}

            {(selectedCourse.hasAiQnA || selectedCourse.hasHumanQnA || selectedCourse.hasStudyPlanner) && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-3">Special Features</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.hasAiQnA && (
                    <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm border border-primary-800">
                      AI Q&A Support
                    </span>
                  )}
                  {selectedCourse.hasHumanQnA && (
                    <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm border border-primary-800">
                      Human Q&A Support
                    </span>
                  )}
                  {selectedCourse.hasStudyPlanner && (
                    <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm border border-primary-800">
                      Study Planner
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-background-800 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Price</span>
                <span className="text-2xl font-bold text-white">
                  {selectedCourse.price === 0 ? 'Free' : `৳${selectedCourse.price.toLocaleString()}`}
                </span>
              </div>

              {selectedCourse.previousStudentDiscount && selectedCourse.previousStudentDiscount > 0 && (
                <div className="pt-2 border-t border-background-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Previous Student Discount</span>
                    <span className="text-green-400 font-medium">৳{selectedCourse.previousStudentDiscount}</span>
                  </div>
                </div>
              )}

              {selectedCourse.extraDiscount && selectedCourse.extraDiscount > 0 && selectedCourse.extraDiscountValidUntil && (
                <div className="pt-2 border-t border-background-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Limited Time Discount</span>
                    <span className="text-green-400 font-medium">৳{selectedCourse.extraDiscount}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Valid until: {formatDate(selectedCourse.extraDiscountValidUntil)}
                  </p>
                </div>
              )}
            </div>

            {selectedCourse.validity && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Course Available Until</p>
                <p className="text-white font-medium">{formatDate(selectedCourse.validity)}</p>
              </div>
            )}

            {selectedCourse.requirements && selectedCourse.requirements.length > 0 && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-3">Requirements</p>
                <ul className="space-y-2">
                  {selectedCourse.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-300">
                      <CheckCircle size={16} className="text-primary-400 mt-0.5 flex-shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedCourse.whatYouWillLearn && selectedCourse.whatYouWillLearn.length > 0 && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-3">What You Will Learn</p>
                <ul className="space-y-2">
                  {selectedCourse.whatYouWillLearn.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-300">
                      <Award size={16} className="text-primary-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {routineFilesByCategory && Object.keys(routineFilesByCategory).length > 0 && (
              <div className="bg-background-800 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-3">Downloadable Files</p>
                {Object.entries(routineFilesByCategory).map(([category, files]) => (
                  <div key={category} className="mb-4 last:mb-0">
                    <p className="text-white font-medium text-sm mb-2">{category}</p>
                    <div className="space-y-2">
                      {files?.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 bg-background-700 hover:bg-background-600 rounded transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-primary-400" />
                            <span className="text-gray-300 group-hover:text-white text-sm">{file.fileName}</span>
                          </div>
                          <Download size={16} className="text-gray-400 group-hover:text-primary-400" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-background-700 sticky bottom-0 bg-background-900">
            {isEnrolled ? (
              <button
                onClick={() => handleContinueLearning(selectedCourse.id)}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Play size={20} />
                <span>Continue Learning</span>
              </button>
            ) : (
              <button
                onClick={() => { setShowCourseModal(false); handleEnrollClick(selectedCourse); }}
                disabled={calculatingPrice}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {calculatingPrice ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart size={20} />
                    <span>Enroll Now</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== ENROLLMENT MODAL ====================

  const EnrollmentModal = () => {
    if (!enrollmentData) return null;

    const { course, calculation } = enrollmentData;
    const appliedCoupons = calculation.appliedCoupons ?? [];

    // Local mirror of the input field so the controlled input feels snappy
    const [localCode, setLocalCode] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Clear local input whenever the input state is reset to idle externally (after successful add)
    useEffect(() => {
      if (couponInput.fieldState === 'idle' && couponInput.code === '') {
        setLocalCode('');
      }
    }, [couponInput.fieldState, couponInput.code]);

    const handleAddCoupon = async () => {
      const code = localCode.trim().toUpperCase();
      if (!code || couponInput.fieldState === 'checking') return;
      await addCoupon(code, enrollmentData);
    };

    const handleRemoveCoupon = async (couponCode: string) => {
      await removeCoupon(couponCode, enrollmentData);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleAddCoupon();
      if (e.key === 'Escape') {
        setLocalCode('');
        setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' }));
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-background-900 rounded-xl w-full max-w-md shadow-2xl border border-background-700 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-background-700 sticky top-0 bg-background-900 z-10">
            <h2 className="text-xl font-bold text-white">Complete Enrollment</h2>
            <button
              onClick={closeEnrollmentModal}
              disabled={enrolling}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Course info */}
            <div>
              <h3 className="text-lg font-medium text-white mb-1">{course.title}</h3>
              <p className="text-sm text-gray-400">{course.class}</p>
            </div>

            {/* Price breakdown */}
            <div className="bg-background-800 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Base Price</span>
                <span className="text-white font-medium">৳{calculation.basePrice.toLocaleString()}</span>
              </div>

              {calculation.previousStudentDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Percent size={14} />
                    Previous Student
                  </span>
                  <span className="text-green-400">-৳{calculation.previousStudentDiscount.toLocaleString()}</span>
                </div>
              )}

              {calculation.extraDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Tag size={14} />
                    Limited Time
                  </span>
                  <span className="text-green-400">-৳{calculation.extraDiscount.toLocaleString()}</span>
                </div>
              )}

              {/* One breakdown row per applied coupon */}
              {appliedCoupons.map(ac => (
                <div key={ac.couponCode} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Ticket size={14} />
                    Coupon
                    <span className="font-mono text-xs text-primary-300 ml-1 bg-primary-900/30 px-1.5 py-0.5 rounded">
                      {ac.couponCode}
                    </span>
                  </span>
                  <span className="text-green-400">-৳{ac.discount.toLocaleString()}</span>
                </div>
              ))}

              {calculation.totalDiscount > 0 && (
                <div className="pt-2 border-t border-background-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Total Savings</span>
                    <span className="text-green-400 font-medium">৳{calculation.totalDiscount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-background-700">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">Final Price</span>
                  <span className="text-2xl font-bold text-primary-400">
                    {calculation.finalPrice === 0 ? 'Free' : `৳${calculation.finalPrice.toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>

            {/* ── COUPON CODE SECTION ── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Ticket size={15} className="text-gray-400" />
                <label className="text-sm font-medium text-gray-300">
                  Coupon Codes
                  {appliedCoupons.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-primary-400">
                      {appliedCoupons.length} applied
                    </span>
                  )}
                </label>
              </div>

              {/* Applied coupon chips — one per coupon, each with individual remove */}
              {appliedCoupons.length > 0 && (
                <div className="space-y-1.5">
                  {appliedCoupons.map(ac => (
                    <div
                      key={ac.couponCode}
                      className="flex items-start justify-between gap-3 bg-green-900/20 border border-green-500/40 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <CheckCircle size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm text-green-400 font-semibold">
                            <span className="font-mono">{ac.couponCode}</span>
                            <span className="font-sans font-normal text-green-300/80 ml-2">
                              — saving ৳{ac.discount.toLocaleString()}
                            </span>
                          </p>
                          {ac.successMessage && (
                            <p className="text-xs text-green-300/70 mt-0.5 break-words">{ac.successMessage}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCoupon(ac.couponCode)}
                        disabled={enrolling || couponInput.fieldState === 'checking'}
                        className="flex-shrink-0 p-0.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                        title={`Remove ${ac.couponCode}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add coupon input — always visible so users can keep adding */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={localCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/\s/g, '');
                        setLocalCode(val);
                        // Clear previous error when user edits
                        if (couponInput.fieldState === 'error') {
                          setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' }));
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={appliedCoupons.length > 0 ? 'Add another coupon code' : 'Enter coupon code'}
                      maxLength={30}
                      disabled={couponInput.fieldState === 'checking' || enrolling}
                      className={`w-full bg-background-700 text-white rounded-lg px-3 py-2 pr-8 font-mono text-sm
                        focus:outline-none focus:ring-2 transition-colors
                        ${couponInput.fieldState === 'error'
                          ? 'border border-red-500/60 focus:ring-red-500/40'
                          : 'border border-background-600 focus:ring-primary-500'
                        }
                        disabled:opacity-50`}
                    />
                    {localCode && couponInput.fieldState !== 'checking' && (
                      <button
                        onClick={() => {
                          setLocalCode('');
                          setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' }));
                          inputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleAddCoupon}
                    disabled={!localCode.trim() || couponInput.fieldState === 'checking' || enrolling}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-background-700
                      disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium
                      rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {couponInput.fieldState === 'checking' ? (
                      <><Loader size={14} className="animate-spin" />Checking...</>
                    ) : (
                      <><Plus size={14} />Apply</>
                    )}
                  </button>
                </div>

                {/* Error message */}
                {couponInput.fieldState === 'error' && couponInput.errorMessage && (
                  <div className="flex items-start gap-1.5 text-red-400">
                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                    <p className="text-xs">{couponInput.errorMessage}</p>
                  </div>
                )}

                {/* Hint text */}
                {couponInput.fieldState === 'idle' && !localCode && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Info size={11} />
                    {appliedCoupons.length > 0
                      ? 'You can stack multiple coupon codes — each is validated separately.'
                      : 'Have a promotional or discount code? Enter it above.'}
                  </p>
                )}
              </div>
            </div>
            {/* ── END COUPON SECTION ── */}

            {/* Previous student discount notice */}
            {calculation.hasPreviousEnrollments && calculation.previousStudentDiscount > 0 && (
              <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-green-400 font-medium">Previous Student Discount Applied!</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Saving ৳{calculation.previousStudentDiscount.toLocaleString()} as a returning student.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Page-level error */}
            {error && (
              <div className="bg-error-dark text-error-light p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Warning */}
            {warning && (
              <div className="bg-warning-dark text-warning-light p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{warning}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={closeEnrollmentModal}
                disabled={enrolling}
                className="flex-1 py-3 bg-background-700 hover:bg-background-600 disabled:bg-background-800 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToPayment}
                disabled={enrolling || couponInput.fieldState === 'checking'}
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
                    <span>Pay ৳{calculation.finalPrice.toLocaleString()}</span>
                  </>
                )}
              </button>
            </div>

            {/* Secure payment note */}
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

      {/* Payment return banner — shown when user returns from payment gateway */}
      <PaymentReturnBanner />

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
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Classes</option>
            {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
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
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
              : 'grid-cols-1'
          }`}>
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

      {showCourseModal && <CourseOverviewModal />}
      {showEnrollmentModal && <EnrollmentModal />}
    </div>
  );
};

export default CourseEnrollment;
