// src/pages/CourseEnrollment.tsx
// ============================================================
// WORLD-CLASS REDESIGN — all original logic 100% preserved
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Star, Clock, Play, BookOpen, Award, Eye,
  CheckCircle, Calendar, Video, FileText, Heart, X,
  Grid3X3, List, Loader, Tag, TrendingUp, Download, ShoppingCart,
  AlertCircle, Percent, DollarSign, Check, AlertTriangle, ChevronDown,
  ExternalLink, Ticket, Info, Sparkles, Plus, Zap, Users, Trophy,
  GraduationCap, Rocket, Shield, Globe
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import courseEnrollmentService, {
  Course,
  EnrollmentCalculation,
  AppliedCoupon
} from '../services/courseEnrollmentService';

// ==================== INTERFACES (unchanged) ====================

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

type CouponInputFieldState = 'idle' | 'checking' | 'error';

interface CouponInputState {
  code: string;
  fieldState: CouponInputFieldState;
  errorMessage: string;
}

type PaymentReturnStatus = 'processing' | 'success' | 'failed' | 'cancelled';

interface PaymentReturnState {
  active: boolean;
  status: PaymentReturnStatus;
  message: string;
  courseTitle: string;
}

// ==================== COURSE FILTERING HELPER (unchanged) ====================

function buildFilteredCourses(
  courses: EnrichedCourse[],
  tab: 'available' | 'enrolled',
  opts: {
    searchTerm: string;
    selectedCategory: string;
    selectedClass: string;
    selectedLevel: string;
    priceFilter: string;
    sortBy: string;
  }
): EnrichedCourse[] {
  let filtered = tab === 'available'
    ? courses.filter(c => !c.isEnrolled)
    : courses.filter(c => c.isEnrolled);

  const { searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy } = opts;

  if (searchTerm) {
    const lower = searchTerm.toLowerCase();
    filtered = filtered.filter(c =>
      c.title.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower) ||
      c.instructor.toLowerCase().includes(lower) ||
      c.tags?.some(t => t.toLowerCase().includes(lower)) ||
      c.subjects?.some(s => s.toLowerCase().includes(lower))
    );
  }

  if (selectedCategory !== 'all') filtered = filtered.filter(c => c.category === selectedCategory);
  if (selectedClass !== 'all') filtered = filtered.filter(c => c.class === selectedClass);
  if (selectedLevel !== 'all') filtered = filtered.filter(c => c.level === selectedLevel);

  if (priceFilter === 'free') filtered = filtered.filter(c => c.price === 0);
  else if (priceFilter === 'paid') filtered = filtered.filter(c => c.price > 0);
  else if (priceFilter === 'under1000') filtered = filtered.filter(c => c.price < 1000);
  else if (priceFilter === 'under5000') filtered = filtered.filter(c => c.price < 5000);

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'popular': return b.studentCount - a.studentCount;
      case 'rating': return b.rating - a.rating;
      case 'newest': return b.createdAt.getTime() - a.createdAt.getTime();
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      default: return 0;
    }
  });
}

// ==================== ANIMATED BACKGROUND ====================

const AnimatedBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="ce-orb ce-orb-1" />
    <div className="ce-orb ce-orb-2" />
    <div className="ce-orb ce-orb-3" />
    <div className="ce-grid-overlay" />
  </div>
);

// ==================== STAT TICKER ====================

const StatTicker = ({ available, enrolled }: { available: number; enrolled: number }) => (
  <div className="ce-stat-ticker">
    <div className="ce-stat-ticker-inner">
      {[
        { icon: <Users size={14} />, label: `${(available + enrolled).toLocaleString()} Courses` },
        { icon: <GraduationCap size={14} />, label: 'Expert Instructors' },
        { icon: <Trophy size={14} />, label: 'Certified Learning' },
        { icon: <Globe size={14} />, label: 'Learn Anywhere' },
        { icon: <Zap size={14} />, label: 'AI-Powered Q&A' },
        { icon: <Shield size={14} />, label: 'Secure Payments' },
      ].map((item, i) => (
        <span key={i} className="ce-ticker-item">
          {item.icon} {item.label}
          <span className="ce-ticker-dot">◆</span>
        </span>
      ))}
    </div>
  </div>
);

// ==================== MAIN COMPONENT ====================

const CourseEnrollment = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();

  // ── Core data state ──────────────────────────────────────────────────────
  const [allCourses, setAllCourses] = useState<EnrichedCourse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<EnrichedCourse[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrichedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'available' | 'enrolled'>('available');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ── Modal state ──────────────────────────────────────────────────────────
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<EnrichedCourse | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentModalData | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // ── Coupon state ─────────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState<CouponInputState>({
    code: '', fieldState: 'idle', errorMessage: '',
  });
  const couponAbortRef = useRef<AbortController | null>(null);

  // ── Payment return state ─────────────────────────────────────────────────
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturnState>({
    active: false, status: 'processing', message: '', courseTitle: '',
  });

  const paymentHandledRef = useRef(false);

  const filterOptsRef = useRef({
    searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
  });
  useEffect(() => {
    filterOptsRef.current = {
      searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
    };
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy]);

  // ==================== CORE DATA LOADER (unchanged logic) ====================

  const loadCourses = useCallback(async (
    opts?: {
      targetTab?: 'available' | 'enrolled';
      guaranteedEnrolledCourseId?: string;
    }
  ): Promise<EnrichedCourse[]> => {
    try {
      setLoading(true);
      setError('');

      const [publishedCourses, enrollments] = await Promise.all([
        courseEnrollmentService.getPublishedCourses(),
        courseEnrollmentService.getStudentEnrollments(user?.uid || ''),
      ]);

      const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
      const enrollmentMap = new Map<string, { progress: number; enrollmentId: string }>();
      enrollments.forEach(e => {
        enrollmentMap.set(e.courseId, { progress: e.progress || 0, enrollmentId: e.id });
      });

      const forcedCourseId = opts?.guaranteedEnrolledCourseId;
      if (forcedCourseId) {
        enrolledCourseIds.add(forcedCourseId);
        if (!enrollmentMap.has(forcedCourseId)) {
          enrollmentMap.set(forcedCourseId, { progress: 0, enrollmentId: '__pending__' });
        }
      }

      const enriched: EnrichedCourse[] = publishedCourses.map(course => {
        const info = enrollmentMap.get(course.id);
        return {
          ...course,
          isEnrolled: enrolledCourseIds.has(course.id),
          progress: info?.progress || 0,
          enrollmentId: info?.enrollmentId,
          isFavorite: false,
        };
      });

      const catSet = new Set<string>();
      const clsSet = new Set<string>();
      enriched.forEach(c => {
        if (c.category) catSet.add(c.category);
        if (c.class) clsSet.add(c.class);
      });

      const currentOpts = filterOptsRef.current;
      const targetTab = opts?.targetTab;

      const available = buildFilteredCourses(enriched, 'available', currentOpts);
      const enrolled = buildFilteredCourses(enriched, 'enrolled', currentOpts);

      setAllCourses(enriched);
      setCategories(Array.from(catSet).sort());
      setClasses(Array.from(clsSet).sort());
      setAvailableCourses(available);
      setEnrolledCourses(enrolled);

      if (targetTab) setActiveTab(targetTab);

      return enriched;
    } catch (err: any) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please refresh the page or try again later.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // ==================== PAYMENT RETURN HANDLER (unchanged logic) ====================

  useEffect(() => {
    if (!user?.uid) return;
    if (paymentHandledRef.current) return;

    const params = new URLSearchParams(location.search);

    const tranId =
      params.get('tran_id') ||
      params.get('tranId') ||
      params.get('transaction_id') ||
      params.get('transactionId');

    const statusParam = params.get('status');
    const errorParam = params.get('error');

    if (!tranId && !statusParam && !errorParam) return;

    paymentHandledRef.current = true;
    window.history.replaceState({}, '', window.location.pathname);

    const handleReturn = async () => {
      if (errorParam) {
        setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: 'Payment could not be completed. Please try again or contact support.' });
        return;
      }
      if (statusParam === 'cancelled') {
        setPaymentReturn({ active: true, status: 'cancelled', courseTitle: '', message: 'Payment was cancelled. No charge was made.' });
        return;
      }
      if (statusParam === 'failed' && !tranId) {
        setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: 'Payment failed. Please try again.' });
        return;
      }
      if (statusParam === 'validating') {
        if (!tranId) {
          setPaymentReturn({ active: true, status: 'processing', courseTitle: '', message: 'Your payment is under review. You will be enrolled once approved.' });
          return;
        }
      }
      if (!tranId) {
        setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: 'Invalid payment reference. Please contact support.' });
        return;
      }

      setPaymentReturn({
        active: true, status: 'processing', courseTitle: '',
        message: statusParam === 'validation_error' ? 'Verifying your payment status...' : 'Verifying your payment...',
      });

      const result = await courseEnrollmentService.verifyPaymentAndGetEnrollment(tranId, user.uid);

      if (result.status === 'ownership_error') {
        setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: result.message });
        return;
      }
      if (result.status === 'failed' || result.status === 'cancelled') {
        setPaymentReturn({ active: true, status: result.status as PaymentReturnStatus, courseTitle: result.courseTitle || '', message: result.message });
        return;
      }
      if (result.status === 'validating') {
        setPaymentReturn({ active: true, status: 'processing', courseTitle: result.courseTitle || '', message: result.message });
        return;
      }
      if (result.status === 'not_found') {
        setPaymentReturn({
          active: true, status: 'failed', courseTitle: result.courseTitle || '',
          message: statusParam === 'validation_error'
            ? 'Payment verification could not be completed. If you were charged, please contact support with ref: ' + tranId
            : result.message,
        });
        return;
      }

      const isPendingEnrollment = result.status === 'pending';
      setPaymentReturn(p => ({ ...p, status: 'processing', message: 'Activating your enrollment...', courseTitle: result.courseTitle || '' }));

      await loadCourses({ targetTab: 'enrolled', guaranteedEnrolledCourseId: result.courseId || '' });

      setPaymentReturn({
        active: true, status: 'success', courseTitle: result.courseTitle || '',
        message: isPendingEnrollment
          ? `Payment confirmed for "${result.courseTitle || 'the course'}"! Your enrollment is being activated — it will appear momentarily.`
          : result.message,
      });
    };

    handleReturn().catch(err => {
      console.error('Payment return handler crashed:', err);
      setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: `An unexpected error occurred. Contact support with ref: ${tranId}` });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ==================== INITIAL LOAD ====================

  useEffect(() => {
    if (user?.uid) loadCourses();
  }, [user?.uid, loadCourses]);

  // ==================== FILTER EFFECT ====================

  useEffect(() => {
    if (allCourses.length === 0) return;
    const opts = filterOptsRef.current;
    setAvailableCourses(buildFilteredCourses(allCourses, 'available', opts));
    setEnrolledCourses(buildFilteredCourses(allCourses, 'enrolled', opts));
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy, allCourses]);

  // ==================== COUPON HELPERS (unchanged logic) ====================

  const resetCouponInput = useCallback(() => {
    couponAbortRef.current?.abort();
    couponAbortRef.current = null;
    setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
  }, []);

  const addCoupon = useCallback(async (code: string, currentData: EnrollmentModalData): Promise<void> => {
    couponAbortRef.current?.abort();
    const abort = new AbortController();
    couponAbortRef.current = abort;

    const upper = code.trim().toUpperCase();
    if (!upper) return;

    const existingCodes = (currentData.calculation.appliedCoupons ?? []).map(c => c.couponCode);
    if (existingCodes.includes(upper)) {
      setCouponInput(prev => ({ ...prev, fieldState: 'error', errorMessage: 'This coupon is already applied.' }));
      return;
    }

    setCouponInput(prev => ({ ...prev, fieldState: 'checking', errorMessage: '' }));

    try {
      const newCalc = await courseEnrollmentService.calculateEnrollmentPrice(currentData.course.id, user?.uid || '', [...existingCodes, upper]);
      if (abort.signal.aborted) return;

      const wasAccepted = newCalc.appliedCoupons.some(c => c.couponCode === upper);
      if (wasAccepted) {
        setEnrollmentData({ ...currentData, calculation: newCalc });
        setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
      } else {
        const probeCalc = await courseEnrollmentService.calculateEnrollmentPrice(currentData.course.id, user?.uid || '', [upper]);
        if (abort.signal.aborted) return;
        const reason = probeCalc.couponError || 'This coupon cannot be applied.';
        setCouponInput(prev => ({ ...prev, fieldState: 'error', errorMessage: reason }));
      }
    } catch (err: any) {
      if (abort.signal.aborted) return;
      setCouponInput(prev => ({ ...prev, fieldState: 'error', errorMessage: 'Unable to validate coupon. Please try again.' }));
    }
  }, [user]);

  const removeCoupon = useCallback(async (couponCode: string, currentData: EnrollmentModalData): Promise<void> => {
    const remaining = (currentData.calculation.appliedCoupons ?? []).filter(c => c.couponCode !== couponCode).map(c => c.couponCode);
    try {
      const newCalc = await courseEnrollmentService.calculateEnrollmentPrice(currentData.course.id, user?.uid || '', remaining);
      setEnrollmentData({ ...currentData, calculation: newCalc });
    } catch (err: any) {
      console.warn('Failed to recalculate after coupon removal:', err.message);
    }
  }, [user]);

  // ==================== EVENT HANDLERS (unchanged logic) ====================

  const handleCourseClick = (course: EnrichedCourse) => {
    setSelectedCourse(course);
    setShowCourseModal(true);
  };

  const handleEnrollClick = async (course: EnrichedCourse) => {
    if (!user) { setError('Please login to enroll in courses'); return; }
    try {
      setCalculatingPrice(true);
      setError(''); setWarning('');
      resetCouponInput();
      const calculation = await courseEnrollmentService.calculateEnrollmentPrice(course.id, user.uid, []);
      setEnrollmentData({ course, calculation });
      setShowEnrollmentModal(true);
    } catch (err: any) {
      setError('Failed to calculate price. Please try again.');
    } finally {
      setCalculatingPrice(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!enrollmentData || !user) return;
    try {
      setEnrolling(true);
      setError(''); setWarning('');
      const { course, calculation } = enrollmentData;

      if (calculation.finalPrice === 0) {
        await handleFreeEnrollment(course, calculation);
        return;
      }

      const enrollmentResponse = await courseEnrollmentService.enrollStudent({
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        studentPhone: (user as any).phoneNumber || '',
        studentSurname: (user as any).surname || '',
        studentUserId: (user as any).userId || '',
        calculation,
      });

      if (enrollmentResponse.success && enrollmentResponse.gatewayUrl) {
        setShowEnrollmentModal(false);
        window.location.href = enrollmentResponse.gatewayUrl;
      } else {
        throw new Error(enrollmentResponse.error || 'Failed to initiate payment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process enrollment. Please try again.');
      setEnrolling(false);
    }
  };

  const handleFreeEnrollment = async (course: Course, calculation: EnrollmentCalculation) => {
    if (!user) return;
    try {
      const enrollmentResponse = await courseEnrollmentService.enrollStudent({
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        studentPhone: (user as any).phoneNumber || '',
        studentSurname: (user as any).surname || '',
        studentUserId: (user as any).userId || '',
        calculation,
      });

      if (enrollmentResponse.success) {
        setShowEnrollmentModal(false);
        setEnrollmentData(null);
        resetCouponInput();
        await loadCourses({ targetTab: 'enrolled', guaranteedEnrolledCourseId: course.id });
        setSuccess(`Successfully enrolled in "${course.title}"!`);
      } else {
        throw new Error(enrollmentResponse.error || 'Enrollment failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enroll in course');
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

  // ==================== HELPERS (unchanged) ====================

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'ce-badge-beginner';
      case 'intermediate': return 'ce-badge-intermediate';
      case 'advanced': return 'ce-badge-advanced';
      default: return 'ce-badge-default';
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const clearMessages = () => { setError(''); setSuccess(''); setWarning(''); };

  const closeEnrollmentModal = () => {
    setShowEnrollmentModal(false);
    setEnrollmentData(null);
    resetCouponInput();
    clearMessages();
  };

  // ==================== PAYMENT RETURN BANNER ====================

  const PaymentReturnBanner = () => {
    if (!paymentReturn.active) return null;
    const cfg = {
      processing: { cls: 'ce-banner-processing', icon: <Loader size={20} className="animate-spin flex-shrink-0" /> },
      success:    { cls: 'ce-banner-success',    icon: <CheckCircle size={20} className="flex-shrink-0" /> },
      failed:     { cls: 'ce-banner-error',      icon: <AlertCircle size={20} className="flex-shrink-0" /> },
      cancelled:  { cls: 'ce-banner-warning',    icon: <AlertTriangle size={20} className="flex-shrink-0" /> },
    }[paymentReturn.status];

    return (
      <div className={`ce-banner ${cfg.cls}`}>
        {cfg.icon}
        <p className="text-sm flex-1">{paymentReturn.message}</p>
        {paymentReturn.status !== 'processing' && (
          <button onClick={() => setPaymentReturn(p => ({ ...p, active: false }))} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X size={16} />
          </button>
        )}
      </div>
    );
  };

  // ==================== LOADING STATE ====================

  if (loading && allCourses.length === 0) {
    return (
      <>
        <CEStyles />
        <div className="ce-loader-screen">
          <div className="ce-loader-content">
            <div className="ce-loader-ring" />
            <GraduationCap size={32} className="ce-loader-icon" />
            <p className="ce-loader-text">Loading your learning universe...</p>
            <div className="ce-loader-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ==================== COURSE CARD ====================

  const CourseCard = ({ course }: { course: EnrichedCourse }) => {
    const isEnrolled = course.isEnrolled;
    const specialFeatures: string[] = [];
    if (course.hasAiQnA) specialFeatures.push('AI Q&A');
    if (course.hasHumanQnA) specialFeatures.push('Human Q&A');
    if (course.hasStudyPlanner) specialFeatures.push('Study Planner');

    return (
      <div className={`ce-card ${viewMode === 'list' ? 'ce-card-list' : ''}`}>
        {/* Thumbnail */}
        <div className={`ce-card-thumb ${viewMode === 'list' ? 'ce-card-thumb-list' : ''}`}>
          {course.thumbnail ? (
            <img src={course.thumbnail} alt={course.title} className="ce-card-img" loading="lazy" />
          ) : (
            <div className="ce-card-thumb-placeholder">
              <BookOpen size={42} className="opacity-40" />
            </div>
          )}
          <div className="ce-card-thumb-overlay" />

          {/* badges */}
          <div className="ce-card-badges-top-right">
            {!isEnrolled && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
                className={`ce-fav-btn ${course.isFavorite ? 'ce-fav-active' : ''}`}
              >
                <Heart size={15} className={course.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>
          <div className="ce-card-badges-bottom-left">
            <span className={`ce-level-badge ${getLevelColor(course.level)}`}>{course.level}</span>
          </div>
          {isEnrolled && (
            <div className="ce-card-badges-top-left">
              <span className="ce-enrolled-badge">
                <CheckCircle size={11} /> Enrolled
              </span>
            </div>
          )}
          {course.price === 0 && !isEnrolled && (
            <div className="ce-card-free-ribbon">FREE</div>
          )}
        </div>

        {/* Body */}
        <div className="ce-card-body">
          {/* Rating row */}
          <div className="ce-card-meta-row">
            <div className="ce-rating">
              <Star size={13} className="ce-star" />
              <span className="ce-rating-val">{course.rating.toFixed(1)}</span>
              <span className="ce-rating-count">({course.reviewCount})</span>
            </div>
            <span className="ce-dot">•</span>
            <span className="ce-students"><Users size={12} /> {course.studentCount.toLocaleString()}</span>
          </div>

          {/* Title */}
          <h3 className="ce-card-title" onClick={() => handleCourseClick(course)}>
            {course.title}
          </h3>

          {/* Class / Category */}
          <div className="ce-card-sub-row">
            <span>{course.class}</span>
            {course.category && <><span className="ce-dot">•</span><span>{course.category}</span></>}
          </div>

          {/* Special features */}
          {specialFeatures.length > 0 && (
            <div className="ce-features-row">
              {specialFeatures.map((f, i) => (
                <span key={i} className="ce-feature-chip"><Sparkles size={10} /> {f}</span>
              ))}
            </div>
          )}

          {/* Progress bar (enrolled) */}
          {isEnrolled && (
            <div className="ce-progress-wrap">
              <div className="ce-progress-header">
                <span>Progress</span>
                <span className="ce-progress-pct">{course.progress}%</span>
              </div>
              <div className="ce-progress-track">
                <div className="ce-progress-fill" style={{ width: `${course.progress}%` }} />
              </div>
            </div>
          )}

          {/* Price */}
          {!isEnrolled && (
            <div className="ce-price-row">
              <span className="ce-price">{course.price === 0 ? 'Free' : `৳${course.price.toLocaleString()}`}</span>
            </div>
          )}

          {/* Actions */}
          <div className="ce-card-actions">
            <button className="ce-btn-secondary" onClick={() => handleCourseClick(course)}>
              <Eye size={15} /> Overview
            </button>
            {isEnrolled ? (
              <button className="ce-btn-primary" onClick={() => handleContinueLearning(course.id)}>
                <Play size={15} /> Continue
              </button>
            ) : (
              <button
                className="ce-btn-enroll"
                onClick={() => handleEnrollClick(course)}
                disabled={enrolling || calculatingPrice}
              >
                {calculatingPrice ? <Loader size={15} className="animate-spin" /> : <><Rocket size={15} /> Enroll</>}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== COURSE OVERVIEW MODAL ====================

  const CourseOverviewModal = () => {
    if (!selectedCourse) return null;
    const isEnrolled = selectedCourse.isEnrolled;
    const routineFilesByCategory = selectedCourse.routineFiles?.reduce((acc, file) => {
      if (!acc[file.category]) acc[file.category] = [];
      acc[file.category].push(file);
      return acc;
    }, {} as Record<string, typeof selectedCourse.routineFiles>);

    return (
      <div className="ce-modal-overlay">
        <div className="ce-modal ce-modal-wide">
          {/* Header */}
          <div className="ce-modal-header">
            <div>
              <p className="ce-modal-eyebrow">Course Overview</p>
              <h2 className="ce-modal-title">{selectedCourse.title}</h2>
            </div>
            <button className="ce-modal-close" onClick={() => { setShowCourseModal(false); setSelectedCourse(null); }}>
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="ce-modal-body">
            {selectedCourse.thumbnail && (
              <div className="ce-modal-hero">
                <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="ce-modal-hero-img" />
                <div className="ce-modal-hero-overlay" />
              </div>
            )}

            {selectedCourse.description && (
              <div className="ce-modal-section">
                <p className="ce-modal-desc">{selectedCourse.description}</p>
              </div>
            )}

            {/* Info grid */}
            <div className="ce-info-grid">
              {selectedCourse.class && (
                <div className="ce-info-card">
                  <BookOpen size={16} className="ce-info-icon" />
                  <div><p className="ce-info-label">Class</p><p className="ce-info-val">{selectedCourse.class}</p></div>
                </div>
              )}
              {selectedCourse.category && (
                <div className="ce-info-card">
                  <Tag size={16} className="ce-info-icon" />
                  <div><p className="ce-info-label">Category</p><p className="ce-info-val">{selectedCourse.category}</p></div>
                </div>
              )}
              {selectedCourse.level && selectedCourse.level !== 'unspecified' && (
                <div className="ce-info-card">
                  <TrendingUp size={16} className="ce-info-icon" />
                  <div><p className="ce-info-label">Level</p>
                    <span className={`ce-level-badge ${getLevelColor(selectedCourse.level)}`}>{selectedCourse.level}</span>
                  </div>
                </div>
              )}
              {isEnrolled && selectedCourse.duration && selectedCourse.duration !== '00:00' && (
                <div className="ce-info-card">
                  <Clock size={16} className="ce-info-icon" />
                  <div><p className="ce-info-label">Duration</p><p className="ce-info-val">{selectedCourse.duration}</p></div>
                </div>
              )}
            </div>

            {/* Special features */}
            {(selectedCourse.hasAiQnA || selectedCourse.hasHumanQnA || selectedCourse.hasStudyPlanner) && (
              <div className="ce-modal-section">
                <p className="ce-section-heading">Special Features</p>
                <div className="ce-features-row">
                  {selectedCourse.hasAiQnA && <span className="ce-feature-chip"><Zap size={11} /> AI Q&A Support</span>}
                  {selectedCourse.hasHumanQnA && <span className="ce-feature-chip"><Users size={11} /> Human Q&A Support</span>}
                  {selectedCourse.hasStudyPlanner && <span className="ce-feature-chip"><Calendar size={11} /> Study Planner</span>}
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="ce-pricing-card">
              <div className="ce-pricing-row">
                <span className="ce-pricing-label">Price</span>
                <span className="ce-pricing-val">
                  {selectedCourse.price === 0 ? '🎉 Free' : `৳${selectedCourse.price.toLocaleString()}`}
                </span>
              </div>
              {selectedCourse.previousStudentDiscount && selectedCourse.previousStudentDiscount > 0 && (
                <div className="ce-pricing-discount-row">
                  <span>Previous Student Discount</span>
                  <span className="ce-savings">-৳{selectedCourse.previousStudentDiscount.toLocaleString()}</span>
                </div>
              )}
              {selectedCourse.extraDiscount && selectedCourse.extraDiscount > 0 && selectedCourse.extraDiscountValidUntil && (
                <div className="ce-pricing-discount-row">
                  <div>
                    <span>Limited Time Discount</span>
                    <p className="ce-discount-expiry">Valid until: {formatDate(selectedCourse.extraDiscountValidUntil)}</p>
                  </div>
                  <span className="ce-savings">-৳{selectedCourse.extraDiscount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Validity */}
            {selectedCourse.validity && (
              <div className="ce-modal-section">
                <div className="ce-info-card">
                  <Calendar size={16} className="ce-info-icon" />
                  <div><p className="ce-info-label">Available Until</p><p className="ce-info-val">{formatDate(selectedCourse.validity)}</p></div>
                </div>
              </div>
            )}

            {/* Requirements */}
            {selectedCourse.requirements && selectedCourse.requirements.length > 0 && (
              <div className="ce-modal-section">
                <p className="ce-section-heading">Requirements</p>
                <ul className="ce-checklist">
                  {selectedCourse.requirements.map((req, i) => (
                    <li key={i} className="ce-checklist-item"><CheckCircle size={15} className="ce-check-icon" /><span>{req}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {/* What you'll learn */}
            {selectedCourse.whatYouWillLearn && selectedCourse.whatYouWillLearn.length > 0 && (
              <div className="ce-modal-section">
                <p className="ce-section-heading">What You Will Learn</p>
                <ul className="ce-checklist">
                  {selectedCourse.whatYouWillLearn.map((item, i) => (
                    <li key={i} className="ce-checklist-item"><Award size={15} className="ce-award-icon" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            )}

            {/* Downloadable files */}
            {routineFilesByCategory && Object.keys(routineFilesByCategory).length > 0 && (
              <div className="ce-modal-section">
                <p className="ce-section-heading">Downloadable Files</p>
                {Object.entries(routineFilesByCategory).map(([category, files]) => (
                  <div key={category} className="ce-files-group">
                    <p className="ce-files-category">{category}</p>
                    <div className="space-y-2">
                      {files?.map((file) => (
                        <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="ce-file-item">
                          <div className="flex items-center gap-2">
                            <FileText size={15} className="ce-info-icon" />
                            <span>{file.fileName}</span>
                          </div>
                          <Download size={15} className="ce-download-icon" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="ce-modal-footer">
            {isEnrolled ? (
              <button className="ce-btn-primary ce-btn-full" onClick={() => handleContinueLearning(selectedCourse.id)}>
                <Play size={18} /> Continue Learning
              </button>
            ) : (
              <button
                className="ce-btn-enroll ce-btn-full"
                onClick={() => { setShowCourseModal(false); handleEnrollClick(selectedCourse); }}
                disabled={calculatingPrice}
              >
                {calculatingPrice ? <><Loader size={18} className="animate-spin" /> Calculating...</> : <><ShoppingCart size={18} /> Enroll Now — It's Worth It!</>}
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
    const [localCode, setLocalCode] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (couponInput.fieldState === 'idle' && couponInput.code === '') setLocalCode('');
    }, [couponInput.fieldState, couponInput.code]);

    const handleAddCoupon = async () => {
      const code = localCode.trim().toUpperCase();
      if (!code || couponInput.fieldState === 'checking') return;
      await addCoupon(code, enrollmentData);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleAddCoupon();
      if (e.key === 'Escape') {
        setLocalCode('');
        setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' }));
      }
    };

    return (
      <div className="ce-modal-overlay">
        <div className="ce-modal ce-modal-narrow">
          {/* Header */}
          <div className="ce-modal-header">
            <div>
              <p className="ce-modal-eyebrow">🎓 Complete Enrollment</p>
              <h2 className="ce-modal-title-sm">{course.title}</h2>
              <p className="ce-modal-subtitle">{course.class}</p>
            </div>
            <button className="ce-modal-close" onClick={closeEnrollmentModal} disabled={enrolling}>
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="ce-modal-body">
            {/* Price breakdown */}
            <div className="ce-price-breakdown">
              <p className="ce-section-heading">Price Breakdown</p>
              <div className="ce-breakdown-rows">
                <div className="ce-breakdown-row">
                  <span>Base Price</span>
                  <span className="ce-breakdown-val">৳{calculation.basePrice.toLocaleString()}</span>
                </div>
                {calculation.previousStudentDiscount > 0 && (
                  <div className="ce-breakdown-row">
                    <span className="flex items-center gap-1.5"><Percent size={13} /> Previous Student</span>
                    <span className="ce-savings">-৳{calculation.previousStudentDiscount.toLocaleString()}</span>
                  </div>
                )}
                {calculation.extraDiscount > 0 && (
                  <div className="ce-breakdown-row">
                    <span className="flex items-center gap-1.5"><Tag size={13} /> Limited Time</span>
                    <span className="ce-savings">-৳{calculation.extraDiscount.toLocaleString()}</span>
                  </div>
                )}
                {appliedCoupons.map(ac => (
                  <div key={ac.couponCode} className="ce-breakdown-row">
                    <span className="flex items-center gap-1.5"><Ticket size={13} /> Coupon <span className="ce-coupon-code">{ac.couponCode}</span></span>
                    <span className="ce-savings">-৳{ac.discount.toLocaleString()}</span>
                  </div>
                ))}
                {calculation.totalDiscount > 0 && (
                  <div className="ce-breakdown-row ce-savings-total-row">
                    <span>Total Savings</span>
                    <span className="ce-savings ce-savings-total">৳{calculation.totalDiscount.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="ce-final-price-row">
                <span>Final Price</span>
                <span className="ce-final-price">
                  {calculation.finalPrice === 0 ? '🎉 Free!' : `৳${calculation.finalPrice.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Previous student banner */}
            {calculation.hasPreviousEnrollments && calculation.previousStudentDiscount > 0 && (
              <div className="ce-success-notice">
                <CheckCircle size={16} className="flex-shrink-0" />
                <div>
                  <p className="font-semibold">Previous Student Discount Applied!</p>
                  <p className="text-xs opacity-80 mt-0.5">Saving ৳{calculation.previousStudentDiscount.toLocaleString()} as a returning student.</p>
                </div>
              </div>
            )}

            {/* Coupon section */}
            <div className="ce-coupon-section">
              <div className="flex items-center gap-2 mb-3">
                <Ticket size={15} className="ce-info-icon" />
                <label className="ce-section-heading mb-0">
                  Coupon Codes
                  {appliedCoupons.length > 0 && <span className="ce-applied-count">{appliedCoupons.length} applied</span>}
                </label>
              </div>

              {appliedCoupons.length > 0 && (
                <div className="space-y-2 mb-3">
                  {appliedCoupons.map(ac => (
                    <div key={ac.couponCode} className="ce-applied-coupon">
                      <div className="flex items-start gap-2 min-w-0">
                        <CheckCircle size={14} className="flex-shrink-0 mt-0.5 text-emerald-400" />
                        <div className="min-w-0">
                          <p className="ce-coupon-applied-code">
                            <span className="font-mono">{ac.couponCode}</span>
                            <span className="ce-coupon-saving"> — saving ৳{ac.discount.toLocaleString()}</span>
                          </p>
                          {ac.successMessage && <p className="text-xs opacity-70 mt-0.5 break-words">{ac.successMessage}</p>}
                        </div>
                      </div>
                      <button onClick={() => removeCoupon(ac.couponCode, enrollmentData)} disabled={enrolling || couponInput.fieldState === 'checking'} className="ce-remove-coupon">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="ce-coupon-input-row">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={localCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/\s/g, '');
                      setLocalCode(val);
                      if (couponInput.fieldState === 'error') setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' }));
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={appliedCoupons.length > 0 ? 'Add another code' : 'Enter coupon code'}
                    maxLength={30}
                    disabled={couponInput.fieldState === 'checking' || enrolling}
                    className={`ce-coupon-input ${couponInput.fieldState === 'error' ? 'ce-coupon-input-error' : ''}`}
                  />
                  {localCode && couponInput.fieldState !== 'checking' && (
                    <button onClick={() => { setLocalCode(''); setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' })); inputRef.current?.focus(); }} className="ce-coupon-clear">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button onClick={handleAddCoupon} disabled={!localCode.trim() || couponInput.fieldState === 'checking' || enrolling} className="ce-btn-apply">
                  {couponInput.fieldState === 'checking' ? <><Loader size={13} className="animate-spin" /> Checking...</> : <><Plus size={13} /> Apply</>}
                </button>
              </div>

              {couponInput.fieldState === 'error' && couponInput.errorMessage && (
                <div className="ce-coupon-error"><AlertCircle size={12} /><span>{couponInput.errorMessage}</span></div>
              )}
              {couponInput.fieldState === 'idle' && !localCode && (
                <p className="ce-coupon-hint"><Info size={11} /> {appliedCoupons.length > 0 ? 'Stack multiple coupon codes — each validated separately.' : 'Have a promo code? Enter it above.'}</p>
              )}
            </div>

            {/* Error / Warning */}
            {error && (
              <div className="ce-alert ce-alert-error"><AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span></div>
            )}
            {warning && (
              <div className="ce-alert ce-alert-warning"><AlertTriangle size={15} className="flex-shrink-0" /><span>{warning}</span></div>
            )}

            {/* Actions */}
            <div className="ce-modal-action-row">
              <button onClick={closeEnrollmentModal} disabled={enrolling} className="ce-btn-cancel">Cancel</button>
              <button onClick={handleProceedToPayment} disabled={enrolling || couponInput.fieldState === 'checking'} className="ce-btn-pay">
                {enrolling ? (
                  <><Loader size={18} className="animate-spin" /> Processing...</>
                ) : calculation.finalPrice === 0 ? (
                  <><Check size={18} /> Enroll Free</>
                ) : (
                  <><ShoppingCart size={18} /> Pay ৳{calculation.finalPrice.toLocaleString()}</>
                )}
              </button>
            </div>

            {calculation.finalPrice > 0 && !enrolling && (
              <p className="ce-secure-notice">🔒 Secure payment via SSLCOMMERZ</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  const displayCourses = activeTab === 'available' ? availableCourses : enrolledCourses;

  return (
    <>
      <CEStyles />
      <AnimatedBackground />

      <div className="ce-page">
        {/* ── Hero Header ── */}
        <div className="ce-hero">
          <div className="ce-hero-content">
            <div className="ce-hero-left">
              <div className="ce-hero-badge">
                <Sparkles size={12} /> Learning Platform
              </div>
              <h1 className="ce-hero-title">
                Unlock Your <span className="ce-hero-accent">Potential</span>
              </h1>
              <p className="ce-hero-subtitle">
                Expert-crafted courses designed to transform your skills and accelerate your career.
              </p>
            </div>
            <div className="ce-hero-stats">
              <div className="ce-stat-card">
                <span className="ce-stat-num">{availableCourses.length}</span>
                <span className="ce-stat-lbl">Available</span>
              </div>
              <div className="ce-stat-divider" />
              <div className="ce-stat-card">
                <span className="ce-stat-num">{enrolledCourses.length}</span>
                <span className="ce-stat-lbl">Enrolled</span>
              </div>
            </div>
          </div>
          <StatTicker available={availableCourses.length} enrolled={enrolledCourses.length} />
        </div>

        {/* ── Banners ── */}
        <div className="ce-banners">
          <PaymentReturnBanner />
          {error && (
            <div className="ce-alert ce-alert-error ce-alert-dismissible">
              <div className="flex items-center gap-2"><AlertCircle size={18} /><span>{error}</span></div>
              <button onClick={clearMessages}><X size={15} /></button>
            </div>
          )}
          {success && (
            <div className="ce-alert ce-alert-success ce-alert-dismissible">
              <div className="flex items-center gap-2"><CheckCircle size={18} /><span>{success}</span></div>
              <button onClick={clearMessages}><X size={15} /></button>
            </div>
          )}
          {warning && (
            <div className="ce-alert ce-alert-warning ce-alert-dismissible">
              <div className="flex items-center gap-2"><AlertTriangle size={18} /><span>{warning}</span></div>
              <button onClick={clearMessages}><X size={15} /></button>
            </div>
          )}
        </div>

        {/* ── Tabs + View Toggle ── */}
        <div className="ce-tab-bar">
          <div className="ce-tabs">
            <button
              className={`ce-tab ${activeTab === 'available' ? 'ce-tab-active' : ''}`}
              onClick={() => setActiveTab('available')}
            >
              <BookOpen size={15} /> Available
              <span className="ce-tab-count">{availableCourses.length}</span>
            </button>
            <button
              className={`ce-tab ${activeTab === 'enrolled' ? 'ce-tab-active' : ''}`}
              onClick={() => setActiveTab('enrolled')}
            >
              <GraduationCap size={15} /> Enrolled
              <span className="ce-tab-count">{enrolledCourses.length}</span>
            </button>
          </div>
          <div className="ce-view-toggle">
            <button onClick={() => setViewMode('grid')} className={`ce-view-btn ${viewMode === 'grid' ? 'ce-view-active' : ''}`}>
              <Grid3X3 size={15} />
            </button>
            <button onClick={() => setViewMode('list')} className={`ce-view-btn ${viewMode === 'list' ? 'ce-view-active' : ''}`}>
              <List size={15} />
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="ce-filters">
          <div className="ce-search-wrap">
            <Search size={16} className="ce-search-icon" />
            <input
              type="text"
              placeholder="Search courses, instructors, topics..."
              className="ce-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="ce-search-clear"><X size={14} /></button>
            )}
          </div>

          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="ce-select">
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>

          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="ce-select">
            <option value="all">All Classes</option>
            {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
          </select>

          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="ce-select">
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} className="ce-select">
            <option value="all">Any Price</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="under1000">Under ৳1,000</option>
            <option value="under5000">Under ৳5,000</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="ce-select">
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        {/* ── Course Grid ── */}
        {loading ? (
          <div className="ce-inline-loader">
            <Loader className="animate-spin ce-info-icon" size={28} />
            <span>Refreshing courses...</span>
          </div>
        ) : displayCourses.length === 0 ? (
          <div className="ce-empty">
            <div className="ce-empty-icon">
              {activeTab === 'available' ? <Search size={40} /> : <GraduationCap size={40} />}
            </div>
            <h3 className="ce-empty-title">
              {activeTab === 'available' ? 'No courses match your filters' : 'No enrolled courses yet'}
            </h3>
            <p className="ce-empty-sub">
              {activeTab === 'available' ? 'Try adjusting your search or filter criteria.' : 'Explore available courses and start your learning journey!'}
            </p>
            {activeTab === 'enrolled' && (
              <button className="ce-btn-enroll mt-4" onClick={() => setActiveTab('available')}>
                <Rocket size={15} /> Browse Courses
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'ce-grid' : 'ce-list'}>
            {displayCourses.map(course => <CourseCard key={course.id} course={course} />)}
          </div>
        )}
      </div>

      {showCourseModal && <CourseOverviewModal />}
      {showEnrollmentModal && <EnrollmentModal />}
    </>
  );
};

// ==================== STYLES ====================

const CEStyles = () => (
  <style>{`
    /* ── Reset & Base ── */
    .ce-page { position: relative; z-index: 1; padding: 0 0 3rem; }

    /* ── Animated Background ── */
    .ce-orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.12; pointer-events: none; }
    .ce-orb-1 { width: 600px; height: 600px; background: radial-gradient(circle, #6366f1, #8b5cf6); top: -200px; left: -200px; animation: ceOrb1 18s ease-in-out infinite alternate; }
    .ce-orb-2 { width: 500px; height: 500px; background: radial-gradient(circle, #06b6d4, #3b82f6); bottom: -150px; right: -150px; animation: ceOrb2 22s ease-in-out infinite alternate; }
    .ce-orb-3 { width: 350px; height: 350px; background: radial-gradient(circle, #f59e0b, #ef4444); top: 40%; left: 50%; transform: translate(-50%,-50%); animation: ceOrb3 15s ease-in-out infinite alternate; }
    .ce-grid-overlay { position: fixed; inset: 0; background-image: linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px); background-size: 60px 60px; pointer-events: none; }
    @keyframes ceOrb1 { to { transform: translate(120px, 80px) scale(1.15); } }
    @keyframes ceOrb2 { to { transform: translate(-80px, -60px) scale(1.2); } }
    @keyframes ceOrb3 { to { transform: translate(-50%, -50%) scale(0.8) rotate(30deg); } }

    /* ── Hero ── */
    .ce-hero { background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 50%, rgba(6,182,212,0.08) 100%); border: 1px solid rgba(99,102,241,0.2); border-radius: 24px; margin: 1.5rem 0 1rem; padding: 2.5rem 2rem 0; backdrop-filter: blur(12px); overflow: hidden; box-shadow: 0 4px 40px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06); }
    .ce-hero-content { display: flex; align-items: flex-start; justify-content: space-between; gap: 2rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .ce-hero-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #a5b4fc; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); border-radius: 20px; padding: 4px 12px; margin-bottom: 1rem; }
    .ce-hero-title { font-family: 'Georgia', 'Times New Roman', serif; font-size: clamp(2rem, 5vw, 3rem); font-weight: 700; color: #f1f5f9; line-height: 1.15; margin-bottom: 0.75rem; letter-spacing: -0.02em; }
    .ce-hero-accent { background: linear-gradient(135deg, #818cf8, #c084fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .ce-hero-subtitle { color: #94a3b8; font-size: 1rem; max-width: 480px; line-height: 1.65; }
    .ce-hero-stats { display: flex; align-items: center; gap: 0; background: rgba(15,23,42,0.5); border: 1px solid rgba(99,102,241,0.25); border-radius: 20px; padding: 1.25rem 1.75rem; backdrop-filter: blur(8px); flex-shrink: 0; box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03); }
    .ce-stat-card { text-align: center; padding: 0 1.25rem; }
    .ce-stat-num { display: block; font-size: 2.2rem; font-weight: 700; color: #818cf8; font-variant-numeric: tabular-nums; line-height: 1; }
    .ce-stat-lbl { font-size: 0.72rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; margin-top: 4px; display: block; }
    .ce-stat-divider { width: 1px; height: 48px; background: rgba(99,102,241,0.25); }

    /* ── Stat Ticker ── */
    .ce-stat-ticker { overflow: hidden; border-top: 1px solid rgba(99,102,241,0.15); padding: 10px 0; margin: 0 -2rem; }
    .ce-stat-ticker-inner { display: flex; white-space: nowrap; animation: ceTicker 30s linear infinite; }
    .ce-ticker-item { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.03em; padding: 0 1.5rem; text-transform: uppercase; }
    .ce-ticker-dot { color: #4338ca; margin-left: 1.5rem; font-size: 0.5rem; }
    @keyframes ceTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

    /* ── Banners ── */
    .ce-banners { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
    .ce-banner { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-radius: 12px; font-size: 0.875rem; }
    .ce-banner-processing { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; }
    .ce-banner-success { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; }
    .ce-banner-error { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
    .ce-banner-warning { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #fcd34d; }

    /* ── Alerts ── */
    .ce-alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; font-size: 0.85rem; }
    .ce-alert-dismissible { justify-content: space-between; }
    .ce-alert-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; }
    .ce-alert-success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7; }
    .ce-alert-warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #fcd34d; }

    /* ── Tab Bar ── */
    .ce-tab-bar { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(99,102,241,0.15); padding-bottom: 0; margin-bottom: 1.25rem; }
    .ce-tabs { display: flex; gap: 0; }
    .ce-tab { display: flex; align-items: center; gap: 7px; padding: 0.875rem 1.25rem; font-size: 0.875rem; font-weight: 500; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; cursor: pointer; background: transparent; border-left: none; border-right: none; border-top: none; white-space: nowrap; }
    .ce-tab:hover { color: #c7d2fe; }
    .ce-tab-active { color: #818cf8; border-bottom-color: #818cf8; }
    .ce-tab-count { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.25); color: #a5b4fc; border-radius: 20px; padding: 1px 8px; font-size: 0.7rem; font-weight: 600; }
    .ce-tab-active .ce-tab-count { background: rgba(99,102,241,0.25); }

    /* ── View Toggle ── */
    .ce-view-toggle { display: flex; gap: 4px; padding: 4px; background: rgba(15,23,42,0.5); border: 1px solid rgba(99,102,241,0.15); border-radius: 10px; }
    .ce-view-btn { padding: 6px 10px; border-radius: 7px; color: #64748b; transition: all 0.2s; background: transparent; border: none; cursor: pointer; }
    .ce-view-btn:hover { color: #c7d2fe; }
    .ce-view-active { background: rgba(99,102,241,0.25); color: #818cf8; }

    /* ── Filters ── */
    .ce-filters { display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 1.5rem; background: rgba(15,23,42,0.5); border: 1px solid rgba(99,102,241,0.15); border-radius: 16px; padding: 1.25rem; backdrop-filter: blur(8px); }
    @media (min-width: 640px) { .ce-filters { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 1024px) { .ce-filters { grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; } }
    .ce-search-wrap { position: relative; grid-column: 1 / -1; }
    @media (min-width: 1024px) { .ce-search-wrap { grid-column: span 2; } }
    .ce-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #475569; pointer-events: none; }
    .ce-search { width: 100%; background: rgba(30,41,59,0.8); border: 1px solid rgba(99,102,241,0.2); color: #e2e8f0; border-radius: 10px; padding: 10px 36px; font-size: 0.875rem; transition: all 0.2s; outline: none; }
    .ce-search:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
    .ce-search::placeholder { color: #475569; }
    .ce-search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #475569; background: transparent; border: none; cursor: pointer; padding: 4px; }
    .ce-select { width: 100%; background: rgba(30,41,59,0.8); border: 1px solid rgba(99,102,241,0.2); color: #e2e8f0; border-radius: 10px; padding: 10px 12px; font-size: 0.875rem; transition: all 0.2s; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23818cf8' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
    .ce-select:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
    .ce-select option { background: #1e293b; }

    /* ── Grid / List layouts ── */
    .ce-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
    @media (min-width: 640px) { .ce-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1024px) { .ce-grid { grid-template-columns: repeat(3, 1fr); } }
    .ce-list { display: flex; flex-direction: column; gap: 1rem; }

    /* ── Course Card ── */
    .ce-card { background: rgba(15,23,42,0.7); border: 1px solid rgba(99,102,241,0.15); border-radius: 20px; overflow: hidden; transition: all 0.35s cubic-bezier(.4,0,.2,1); backdrop-filter: blur(8px); display: flex; flex-direction: column; box-shadow: 0 4px 24px rgba(0,0,0,0.2); position: relative; }
    .ce-card::before { content: ''; position: absolute; inset: 0; border-radius: 20px; background: linear-gradient(135deg, rgba(99,102,241,0.05) 0%, transparent 60%); pointer-events: none; z-index: 0; }
    .ce-card:hover { transform: translateY(-6px) scale(1.01); border-color: rgba(99,102,241,0.4); box-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.2), 0 0 40px rgba(99,102,241,0.08); }
    .ce-card-list { flex-direction: row; }
    .ce-card-thumb { position: relative; overflow: hidden; height: 200px; flex-shrink: 0; }
    .ce-card-thumb-list { width: 240px; height: auto; min-height: 160px; }
    @media (max-width: 640px) { .ce-card-list { flex-direction: column; } .ce-card-thumb-list { width: 100%; height: 180px; } }
    .ce-card-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s cubic-bezier(.4,0,.2,1); }
    .ce-card:hover .ce-card-img { transform: scale(1.07); }
    .ce-card-thumb-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #312e81 0%, #1e1b4b 50%, #0f172a 100%); display: flex; align-items: center; justify-content: center; color: #818cf8; }
    .ce-card-thumb-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%); pointer-events: none; }

    /* Card badges */
    .ce-card-badges-top-right { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 2; }
    .ce-card-badges-top-left { position: absolute; top: 10px; left: 10px; z-index: 2; }
    .ce-card-badges-bottom-left { position: absolute; bottom: 10px; left: 10px; z-index: 2; }
    .ce-fav-btn { width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; backdrop-filter: blur(4px); transition: all 0.2s; }
    .ce-fav-btn:hover, .ce-fav-active { background: #ef4444; border-color: #ef4444; }
    .ce-enrolled-badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(16,185,129,0.85); color: #fff; font-size: 0.65rem; font-weight: 600; padding: 3px 8px; border-radius: 20px; backdrop-filter: blur(4px); }
    .ce-card-free-ribbon { position: absolute; top: 14px; right: -1px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; padding: 4px 10px 4px 8px; clip-path: polygon(8px 0%, 100% 0%, 100% 100%, 8px 100%, 0% 50%); z-index: 2; }

    /* Level badges */
    .ce-level-badge { font-size: 0.65rem; font-weight: 600; padding: 3px 9px; border-radius: 20px; text-transform: capitalize; letter-spacing: 0.03em; }
    .ce-badge-beginner { background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); }
    .ce-badge-intermediate { background: rgba(245,158,11,0.2); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); }
    .ce-badge-advanced { background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
    .ce-badge-default { background: rgba(100,116,139,0.2); color: #94a3b8; border: 1px solid rgba(100,116,139,0.3); }

    /* Card body */
    .ce-card-body { padding: 1.125rem; display: flex; flex-direction: column; gap: 0.625rem; flex: 1; position: relative; z-index: 1; }
    .ce-card-meta-row { display: flex; align-items: center; gap: 8px; }
    .ce-rating { display: flex; align-items: center; gap: 4px; }
    .ce-star { color: #fbbf24; fill: #fbbf24; }
    .ce-rating-val { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; }
    .ce-rating-count { font-size: 0.75rem; color: #64748b; }
    .ce-dot { color: #334155; font-size: 0.6rem; }
    .ce-students { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #64748b; }
    .ce-card-title { font-size: 0.95rem; font-weight: 600; color: #e2e8f0; line-height: 1.45; cursor: pointer; transition: color 0.2s; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ce-card-title:hover { color: #818cf8; }
    .ce-card-sub-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.75rem; color: #64748b; }
    .ce-features-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .ce-feature-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 0.67rem; font-weight: 600; color: #a5b4fc; background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25); border-radius: 20px; padding: 3px 8px; }

    /* Progress */
    .ce-progress-wrap { display: flex; flex-direction: column; gap: 5px; }
    .ce-progress-header { display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; }
    .ce-progress-pct { color: #a5b4fc; font-weight: 600; }
    .ce-progress-track { height: 6px; border-radius: 3px; background: rgba(30,41,59,0.8); overflow: hidden; }
    .ce-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #818cf8, #c084fc); transition: width 0.6s ease; box-shadow: 0 0 8px rgba(129,140,248,0.5); }

    /* Price */
    .ce-price-row { display: flex; align-items: baseline; gap: 8px; }
    .ce-price { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; font-variant-numeric: tabular-nums; }

    /* Action buttons */
    .ce-card-actions { display: flex; gap: 8px; margin-top: auto; }
    .ce-btn-secondary { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; background: rgba(30,41,59,0.8); border: 1px solid rgba(99,102,241,0.2); color: #94a3b8; border-radius: 10px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .ce-btn-secondary:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.4); color: #c7d2fe; }
    .ce-btn-primary { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; border: none; border-radius: 10px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
    .ce-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.45); }
    .ce-btn-enroll { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; border: none; border-radius: 10px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(245,158,11,0.25); letter-spacing: 0.02em; }
    .ce-btn-enroll:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(245,158,11,0.4); }
    .ce-btn-enroll:disabled { opacity: 0.5; cursor: not-allowed; }
    .ce-btn-full { width: 100%; flex: initial; border-radius: 12px; padding: 13px 20px; font-size: 0.9rem; }

    /* ── Empty state ── */
    .ce-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; }
    .ce-empty-icon { width: 80px; height: 80px; border-radius: 50%; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); display: flex; align-items: center; justify-content: center; color: #818cf8; margin-bottom: 1.5rem; }
    .ce-empty-title { font-size: 1.25rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.5rem; }
    .ce-empty-sub { color: #64748b; font-size: 0.9rem; max-width: 380px; }

    /* ── Inline loader ── */
    .ce-inline-loader { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 4rem; color: #64748b; font-size: 0.9rem; }

    /* ── Full-page loader ── */
    .ce-loader-screen { position: fixed; inset: 0; background: #0a0f1e; display: flex; align-items: center; justify-content: center; z-index: 9999; }
    .ce-loader-content { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .ce-loader-ring { width: 64px; height: 64px; border: 3px solid rgba(99,102,241,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.8s linear infinite; position: relative; }
    .ce-loader-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #818cf8; margin-top: 0; }
    .ce-loader-text { color: #64748b; font-size: 0.875rem; margin-top: 0.5rem; }
    .ce-loader-dots { display: flex; gap: 6px; }
    .ce-loader-dots span { width: 6px; height: 6px; border-radius: 50%; background: #818cf8; animation: ceDot 1.2s ease-in-out infinite; }
    .ce-loader-dots span:nth-child(2) { animation-delay: 0.2s; }
    .ce-loader-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ceDot { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Modals ── */
    .ce-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; overflow-y: auto; }
    .ce-modal { background: #0d1526; border: 1px solid rgba(99,102,241,0.2); border-radius: 24px; width: 100%; box-shadow: 0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1); display: flex; flex-direction: column; max-height: 90vh; animation: ceModalIn 0.3s cubic-bezier(.4,0,.2,1); }
    .ce-modal-wide { max-width: 860px; }
    .ce-modal-narrow { max-width: 480px; }
    @keyframes ceModalIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: none; } }
    .ce-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.5rem 1.75rem; border-bottom: 1px solid rgba(99,102,241,0.15); position: sticky; top: 0; background: #0d1526; z-index: 10; border-radius: 24px 24px 0 0; }
    .ce-modal-eyebrow { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #818cf8; margin-bottom: 4px; }
    .ce-modal-title { font-family: 'Georgia', serif; font-size: 1.6rem; font-weight: 700; color: #f1f5f9; line-height: 1.2; }
    .ce-modal-title-sm { font-size: 1.15rem; font-weight: 600; color: #f1f5f9; line-height: 1.3; }
    .ce-modal-subtitle { font-size: 0.8rem; color: #64748b; margin-top: 3px; }
    .ce-modal-close { width: 36px; height: 36px; border-radius: 10px; background: rgba(30,41,59,0.8); border: 1px solid rgba(99,102,241,0.2); color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
    .ce-modal-close:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
    .ce-modal-body { padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem; }
    .ce-modal-footer { padding: 1.25rem 1.75rem; border-top: 1px solid rgba(99,102,241,0.15); position: sticky; bottom: 0; background: #0d1526; border-radius: 0 0 24px 24px; }

    /* Modal hero */
    .ce-modal-hero { border-radius: 16px; overflow: hidden; position: relative; height: 240px; }
    .ce-modal-hero-img { width: 100%; height: 100%; object-fit: cover; }
    .ce-modal-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(13,21,38,0.5), transparent); }

    /* Info grid */
    .ce-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    @media (min-width: 640px) { .ce-info-grid { grid-template-columns: repeat(4, 1fr); } }
    .ce-info-card { background: rgba(30,41,59,0.6); border: 1px solid rgba(99,102,241,0.12); border-radius: 12px; padding: 0.875rem; display: flex; align-items: flex-start; gap: 10px; }
    .ce-info-icon { color: #818cf8; flex-shrink: 0; }
    .ce-info-label { font-size: 0.68rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    .ce-info-val { font-size: 0.875rem; font-weight: 500; color: #e2e8f0; }
    .ce-section-heading { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #818cf8; margin-bottom: 0.75rem; }
    .ce-modal-section { display: flex; flex-direction: column; }
    .ce-modal-desc { color: #94a3b8; font-size: 0.9rem; line-height: 1.7; }

    /* Pricing card */
    .ce-pricing-card { background: rgba(30,41,59,0.6); border: 1px solid rgba(99,102,241,0.15); border-radius: 16px; padding: 1.125rem; }
    .ce-pricing-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .ce-pricing-label { color: #64748b; font-size: 0.85rem; }
    .ce-pricing-val { font-size: 1.6rem; font-weight: 700; color: #f1f5f9; }
    .ce-pricing-discount-row { display: flex; align-items: flex-start; justify-content: space-between; padding-top: 0.625rem; border-top: 1px solid rgba(99,102,241,0.1); font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem; }
    .ce-savings { color: #34d399; font-weight: 600; }
    .ce-discount-expiry { font-size: 0.7rem; color: #64748b; margin-top: 2px; }

    /* Checklist */
    .ce-checklist { display: flex; flex-direction: column; gap: 0.5rem; list-style: none; padding: 0; margin: 0; }
    .ce-checklist-item { display: flex; align-items: flex-start; gap: 8px; font-size: 0.875rem; color: #94a3b8; }
    .ce-check-icon { color: #34d399; flex-shrink: 0; margin-top: 1px; }
    .ce-award-icon { color: #818cf8; flex-shrink: 0; margin-top: 1px; }

    /* Files */
    .ce-files-group { margin-bottom: 1rem; }
    .ce-files-category { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.5rem; }
    .ce-file-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(30,41,59,0.6); border: 1px solid rgba(99,102,241,0.12); border-radius: 10px; color: #94a3b8; font-size: 0.85rem; text-decoration: none; transition: all 0.2s; gap: 8px; }
    .ce-file-item:hover { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); color: #e2e8f0; }
    .ce-download-icon { color: #64748b; flex-shrink: 0; transition: color 0.2s; }
    .ce-file-item:hover .ce-download-icon { color: #818cf8; }

    /* Price breakdown (enrollment modal) */
    .ce-price-breakdown { background: rgba(30,41,59,0.6); border: 1px solid rgba(99,102,241,0.15); border-radius: 16px; padding: 1.125rem; }
    .ce-breakdown-rows { display: flex; flex-direction: column; gap: 0.625rem; margin-bottom: 0.875rem; padding-bottom: 0.875rem; border-bottom: 1px solid rgba(99,102,241,0.12); }
    .ce-breakdown-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; color: #94a3b8; }
    .ce-breakdown-val { color: #e2e8f0; font-weight: 500; }
    .ce-savings-total-row { padding-top: 0.625rem; border-top: 1px solid rgba(16,185,129,0.2); }
    .ce-savings-total { font-size: 0.95rem; }
    .ce-final-price-row { display: flex; align-items: center; justify-content: space-between; }
    .ce-final-price { font-size: 1.75rem; font-weight: 700; color: #818cf8; }
    .ce-coupon-code { background: rgba(99,102,241,0.15); color: #a5b4fc; font-family: monospace; padding: 1px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 4px; }

    /* Success notice */
    .ce-success-notice { display: flex; align-items: flex-start; gap: 10px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); border-radius: 12px; padding: 0.875rem 1rem; color: #6ee7b7; font-size: 0.85rem; }

    /* Coupon section */
    .ce-coupon-section { display: flex; flex-direction: column; gap: 0; }
    .ce-applied-count { margin-left: 8px; font-size: 0.7rem; font-weight: 700; color: #818cf8; background: rgba(99,102,241,0.15); padding: 1px 7px; border-radius: 20px; }
    .ce-applied-coupon { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; padding: 10px 12px; }
    .ce-coupon-applied-code { font-size: 0.85rem; color: #6ee7b7; font-weight: 600; }
    .ce-coupon-saving { color: rgba(110,231,183,0.75); font-weight: 400; font-size: 0.8em; margin-left: 6px; font-family: inherit; }
    .ce-remove-coupon { padding: 2px; color: #64748b; background: transparent; border: none; cursor: pointer; transition: color 0.2s; flex-shrink: 0; }
    .ce-remove-coupon:hover:not(:disabled) { color: #f87171; }
    .ce-coupon-input-row { display: flex; gap: 8px; }
    .ce-coupon-input { width: 100%; background: rgba(30,41,59,0.8); border: 1px solid rgba(99,102,241,0.2); color: #e2e8f0; border-radius: 10px; padding: 10px 36px 10px 12px; font-family: monospace; font-size: 0.875rem; outline: none; transition: all 0.2s; }
    .ce-coupon-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
    .ce-coupon-input-error { border-color: rgba(239,68,68,0.5); }
    .ce-coupon-input-error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
    .ce-coupon-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #475569; background: transparent; border: none; cursor: pointer; }
    .ce-coupon-error { display: flex; align-items: center; gap: 6px; color: #f87171; font-size: 0.8rem; margin-top: 6px; }
    .ce-coupon-hint { font-size: 0.75rem; color: #475569; display: flex; align-items: center; gap: 5px; margin-top: 5px; }
    .ce-btn-apply { display: flex; align-items: center; gap: 5px; padding: 10px 14px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; border: none; border-radius: 10px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .ce-btn-apply:disabled { background: rgba(30,41,59,0.8); opacity: 0.5; cursor: not-allowed; }

    /* Modal actions */
    .ce-modal-action-row { display: flex; gap: 10px; padding-top: 0.5rem; }
    .ce-btn-cancel { flex: 1; padding: 13px; background: rgba(30,41,59,0.8); border: 1px solid rgba(99,102,241,0.2); color: #94a3b8; border-radius: 12px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .ce-btn-cancel:hover:not(:disabled) { background: rgba(99,102,241,0.08); color: #c7d2fe; }
    .ce-btn-pay { flex: 2; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 18px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; border: none; border-radius: 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 20px rgba(245,158,11,0.25); }
    .ce-btn-pay:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(245,158,11,0.4); }
    .ce-btn-pay:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .ce-secure-notice { text-align: center; font-size: 0.72rem; color: #475569; margin-top: 0.5rem; }

    /* ── Responsive tweaks ── */
    @media (max-width: 640px) {
      .ce-hero { padding: 1.5rem 1.25rem 0; border-radius: 16px; }
      .ce-hero-content { flex-direction: column; }
      .ce-hero-stats { align-self: stretch; justify-content: center; }
      .ce-tab-bar { flex-wrap: wrap; gap: 0.75rem; }
      .ce-modal { border-radius: 20px; }
      .ce-modal-header { padding: 1.25rem; }
      .ce-modal-body { padding: 1.25rem; }
      .ce-modal-footer { padding: 1.25rem; }
      .ce-info-grid { grid-template-columns: 1fr 1fr; }
    }
  `}</style>
);

export default CourseEnrollment;
