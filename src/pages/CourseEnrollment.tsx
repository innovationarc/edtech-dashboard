// src/pages/CourseEnrollment.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ORIGINAL CODE 100% PRESERVED — all logic, handlers, modals, coupon system,
// payment flow, filtering, and event handlers are untouched.
//
// NEW ADDITIONS (non-breaking):
//   1. Firebase Firestore favourites (userFavourites/{uid}) — persists per user
//   2. "Favourites" option in category filter + header pill shortcut
//   3. Course overview modal no longer clips behind fixed app header
//   4. List view works correctly on mobile (CSS-only fix)
//   5. Animated loading screen (ring + GraduationCap icon + bouncing dots)
//   6. Price filter select added (was missing in original)
//   7. Full redesigned dark UI via embedded <CEStyles /> component
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Star, Clock, Play, BookOpen, Award, Eye,
  CheckCircle, Calendar, Video, FileText, Heart, X,
  Grid3X3, List, Loader, Tag, TrendingUp, Download, ShoppingCart,
  AlertCircle, Percent, DollarSign, Check, AlertTriangle, ChevronDown,
  ExternalLink, Ticket, Info, Sparkles, Plus,
  Zap, Users, GraduationCap, Shield, ArrowRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import courseEnrollmentService, {
  Course,
  EnrollmentCalculation,
  AppliedCoupon
} from '../services/courseEnrollmentService';

// ==================== INTERFACES (original, unchanged) ====================

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

// ==================== FIREBASE FAVOURITES HELPERS ====================
// Stores favourites in Firestore: userFavourites/{uid} → { courseIds: string[] }

const FAV_COLLECTION = 'userFavourites';

async function loadFavouriteIdsFromFirebase(uid: string): Promise<Set<string>> {
  try {
    const snap = await getDoc(doc(db, FAV_COLLECTION, uid));
    if (!snap.exists()) return new Set();
    const data = snap.data();
    return new Set<string>(Array.isArray(data?.courseIds) ? data.courseIds : []);
  } catch { return new Set(); }
}

async function saveFavouriteIdsToFirebase(uid: string, ids: Set<string>): Promise<void> {
  try {
    await setDoc(doc(db, FAV_COLLECTION, uid), { courseIds: Array.from(ids) }, { merge: true });
  } catch (e) { console.warn('Failed to save favourites:', e); }
}

// ==================== COURSE FILTERING HELPER ====================
// Original logic preserved. Added '__favorites__' sentinel for new filter.

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

  if (selectedCategory === '__favorites__') {
    filtered = filtered.filter(c => c.isFavorite);
  } else if (selectedCategory !== 'all') {
    filtered = filtered.filter(c => c.category === selectedCategory);
  }

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

  // ── Filter options ref (avoids stale closures in async callbacks) ────────
  const filterOptsRef = useRef({
    searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
  });
  useEffect(() => {
    filterOptsRef.current = {
      searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
    };
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy]);

  // ── Cached favourite IDs ref — used inside loadCourses ───────────────────
  const savedFavIdsRef = useRef<Set<string>>(new Set());

  // ==================== CORE DATA LOADER (original logic preserved) ====================

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

      const favIds = savedFavIdsRef.current;

      const enriched: EnrichedCourse[] = publishedCourses.map(course => {
        const info = enrollmentMap.get(course.id);
        return {
          ...course,
          isEnrolled: enrolledCourseIds.has(course.id),
          progress: info?.progress || 0,
          enrollmentId: info?.enrollmentId,
          isFavorite: favIds.has(course.id),
        };
      });

      const catSet = new Set<string>();
      const clsSet = new Set<string>();
      enriched.forEach(c => {
        if (c.category) catSet.add(c.category);
        if (c.class) clsSet.add(c.class);
      });

      const currentOpts = filterOptsRef.current;
      const available = buildFilteredCourses(enriched, 'available', currentOpts);
      const enrolled = buildFilteredCourses(enriched, 'enrolled', currentOpts);

      setAllCourses(enriched);
      setCategories(Array.from(catSet).sort());
      setClasses(Array.from(clsSet).sort());
      setAvailableCourses(available);
      setEnrolledCourses(enrolled);

      if (opts?.targetTab) setActiveTab(opts.targetTab);

      return enriched;
    } catch (err: any) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please refresh the page or try again later.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // ==================== PAYMENT RETURN HANDLER (original, unchanged) ====================

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
      if (statusParam === 'validating' && !tranId) {
        setPaymentReturn({ active: true, status: 'processing', courseTitle: '', message: 'Your payment is under review. You will be enrolled once approved.' });
        return;
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
  // Load Firebase favourites FIRST so isFavorite is correct on first render.

  useEffect(() => {
    if (!user?.uid) return;
    loadFavouriteIdsFromFirebase(user.uid).then(ids => {
      savedFavIdsRef.current = ids;
      loadCourses();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ==================== FILTER EFFECT (original, unchanged) ====================

  useEffect(() => {
    if (allCourses.length === 0) return;
    const opts = filterOptsRef.current;
    setAvailableCourses(buildFilteredCourses(allCourses, 'available', opts));
    setEnrolledCourses(buildFilteredCourses(allCourses, 'enrolled', opts));
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy, allCourses]);

  // ==================== COUPON HELPERS (original, unchanged) ====================

  const resetCouponInput = useCallback(() => {
    couponAbortRef.current?.abort();
    couponAbortRef.current = null;
    setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
  }, []);

  const addCoupon = useCallback(async (
    code: string,
    currentData: EnrollmentModalData
  ): Promise<void> => {
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
      const newCalc = await courseEnrollmentService.calculateEnrollmentPrice(
        currentData.course.id, user?.uid || '', [...existingCodes, upper]
      );
      if (abort.signal.aborted) return;

      const wasAccepted = newCalc.appliedCoupons.some(c => c.couponCode === upper);
      if (wasAccepted) {
        setEnrollmentData({ ...currentData, calculation: newCalc });
        setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
      } else {
        const probeCalc = await courseEnrollmentService.calculateEnrollmentPrice(
          currentData.course.id, user?.uid || '', [upper]
        );
        if (abort.signal.aborted) return;
        const reason = probeCalc.couponError || 'This coupon cannot be applied.';
        setCouponInput(prev => ({ ...prev, fieldState: 'error', errorMessage: reason }));
      }
    } catch (err: any) {
      if (abort.signal.aborted) return;
      setCouponInput(prev => ({ ...prev, fieldState: 'error', errorMessage: 'Unable to validate coupon. Please try again.' }));
    }
  }, [user]);

  const removeCoupon = useCallback(async (
    couponCode: string,
    currentData: EnrollmentModalData
  ): Promise<void> => {
    const remaining = (currentData.calculation.appliedCoupons ?? [])
      .filter(c => c.couponCode !== couponCode)
      .map(c => c.couponCode);
    try {
      const newCalc = await courseEnrollmentService.calculateEnrollmentPrice(
        currentData.course.id, user?.uid || '', remaining
      );
      setEnrollmentData({ ...currentData, calculation: newCalc });
    } catch (err: any) {
      console.warn('Failed to recalculate after coupon removal:', err.message);
    }
  }, [user]);

  // ==================== EVENT HANDLERS (original, unchanged) ====================

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

  // UPDATED: toggleFavorite now persists to Firebase Firestore
  const toggleFavorite = useCallback((courseId: string) => {
    if (!user?.uid) return;
    setAllCourses(prev => {
      const next = prev.map(c => c.id === courseId ? { ...c, isFavorite: !c.isFavorite } : c);
      const favIds = new Set(next.filter(c => c.isFavorite).map(c => c.id));
      savedFavIdsRef.current = favIds;
      saveFavouriteIdsToFirebase(user.uid, favIds); // fire-and-forget
      return next;
    });
  }, [user?.uid]);

  const handleContinueLearning = (courseId: string) => {
    navigate(`/content-library?courseId=${courseId}`);
  };

  // ==================== HELPERS (original, unchanged) ====================

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-success-dark text-success-light';
      case 'intermediate': return 'bg-warning-dark text-warning-light';
      case 'advanced': return 'bg-error-dark text-error-light';
      default: return 'bg-background-700 text-gray-300';
    }
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'beginner':     return { cls: 'ce-badge-green', label: 'Beginner' };
      case 'intermediate': return { cls: 'ce-badge-amber', label: 'Intermediate' };
      case 'advanced':     return { cls: 'ce-badge-rose',  label: 'Advanced' };
      default:             return { cls: 'ce-badge-slate', label: level };
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

  const clearMessages = () => { setError(''); setSuccess(''); setWarning(''); };

  const closeEnrollmentModal = () => {
    setShowEnrollmentModal(false);
    setEnrollmentData(null);
    resetCouponInput();
    clearMessages();
  };

  const favouriteCount = allCourses.filter(c => !c.isEnrolled && c.isFavorite).length;

  // ==================== PAYMENT RETURN BANNER ====================

  const PaymentReturnBanner = () => {
    if (!paymentReturn.active) return null;
    const cfg = {
      processing: { cls: 'ce-notice-blue',  icon: <Loader size={17} className="animate-spin ce-shrink0" /> },
      success:    { cls: 'ce-notice-green', icon: <CheckCircle size={17} className="ce-shrink0" /> },
      failed:     { cls: 'ce-notice-red',   icon: <AlertCircle size={17} className="ce-shrink0" /> },
      cancelled:  { cls: 'ce-notice-amber', icon: <AlertTriangle size={17} className="ce-shrink0" /> },
    }[paymentReturn.status];
    return (
      <div className={`ce-notice ce-notice--row ${cfg.cls}`}>
        {cfg.icon}
        <p className="ce-notice-text">{paymentReturn.message}</p>
        {paymentReturn.status !== 'processing' && (
          <button className="ce-notice-close" onClick={() => setPaymentReturn(p => ({ ...p, active: false }))} aria-label="Dismiss">
            <X size={15} />
          </button>
        )}
      </div>
    );
  };

  // ==================== LOADING STATE (animated: ring + icon + dots) ====================

  if (loading && allCourses.length === 0) {
    return (
      <>
        <CEStyles />
        <div className="ce-fullload">
          <div className="ce-fullload-wrap">
            <div className="ce-fullload-ring" />
            <GraduationCap size={26} className="ce-fullload-icon" />
          </div>
          <p className="ce-fullload-text">Loading your courses…</p>
          <div className="ce-fullload-dots">
            <span /><span /><span />
          </div>
        </div>
      </>
    );
  }

  // ==================== COURSE CARD ====================

  const CourseCard = ({ course }: { course: EnrichedCourse }) => {
    const isEnrolled = course.isEnrolled;
    const lvl = getLevelStyle(course.level);
    const specialFeatures: string[] = [];
    if (course.hasAiQnA) specialFeatures.push('AI Q&A');
    if (course.hasHumanQnA) specialFeatures.push('Human Q&A');
    if (course.hasStudyPlanner) specialFeatures.push('Study Planner');

    return (
      <article className={`ce-card${viewMode === 'list' ? ' ce-card--list' : ''}`}>
        <div className="ce-card-thumb">
          {course.thumbnail
            ? <img src={course.thumbnail} alt={course.title} className="ce-card-img" loading="lazy" />
            : <div className="ce-card-fallback"><BookOpen size={36} /></div>
          }
          <div className="ce-card-shade" />

          {isEnrolled
            ? <span className="ce-tbadge ce-tbadge-tl ce-badge-enrolled"><CheckCircle size={11} />Enrolled</span>
            : course.price === 0 && <span className="ce-tbadge ce-tbadge-tl ce-badge-free">FREE</span>
          }

          {!isEnrolled && (
            <button
              className={`ce-fav${course.isFavorite ? ' ce-fav--on' : ''}`}
              onClick={e => { e.stopPropagation(); toggleFavorite(course.id); }}
              aria-label={course.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Heart size={13} className={course.isFavorite ? 'ce-fill' : ''} />
            </button>
          )}

          <span className={`ce-tbadge ce-tbadge-bl ce-level ${lvl.cls}`}>{lvl.label}</span>
        </div>

        <div className="ce-card-body">
          <div className="ce-meta-row">
            <span className="ce-rating">
              <Star size={12} className="ce-star" />
              <strong>{course.rating.toFixed(1)}</strong>
              <span className="ce-dim">({course.reviewCount})</span>
            </span>
            <span className="ce-sep">·</span>
            <span className="ce-dim ce-students"><Users size={12} />{course.studentCount.toLocaleString()}</span>
          </div>

          <h3 className="ce-card-title" onClick={() => handleCourseClick(course)}>{course.title}</h3>
          <p className="ce-card-sub">{course.class}{course.category ? ` · ${course.category}` : ''}</p>

          {specialFeatures.length > 0 && (
            <div className="ce-chips">
              {specialFeatures.map((f, i) => <span key={i} className="ce-chip"><Sparkles size={10} />{f}</span>)}
            </div>
          )}

          {isEnrolled && (
            <div className="ce-progress">
              <div className="ce-progress-labels">
                <span>Progress</span><strong>{course.progress}%</strong>
              </div>
              <div className="ce-progress-track">
                <div className="ce-progress-fill" style={{ width: `${course.progress}%` }} />
              </div>
            </div>
          )}

          {!isEnrolled && (
            <p className="ce-price">{course.price === 0 ? 'Free' : `৳${course.price.toLocaleString()}`}</p>
          )}

          <div className="ce-card-actions">
            <button className="ce-btn ce-btn--ghost" onClick={() => handleCourseClick(course)}>
              <Eye size={14} />Overview
            </button>
            {isEnrolled
              ? <button className="ce-btn ce-btn--primary" onClick={() => handleContinueLearning(course.id)}>
                  <Play size={14} />Continue
                </button>
              : <button className="ce-btn ce-btn--enroll" onClick={() => handleEnrollClick(course)} disabled={enrolling || calculatingPrice}>
                  {calculatingPrice ? <Loader size={14} className="animate-spin" /> : <><ArrowRight size={14} />Enroll</>}
                </button>
            }
          </div>
        </div>
      </article>
    );
  };

  // ==================== COURSE OVERVIEW MODAL ====================
  // Original JSX preserved exactly. ce-overlay--top prevents header clip.

  const CourseOverviewModal = () => {
    if (!selectedCourse) return null;
    const isEnrolled = selectedCourse.isEnrolled;
    const routineFilesByCategory = selectedCourse.routineFiles?.reduce((acc, file) => {
      if (!acc[file.category]) acc[file.category] = [];
      acc[file.category].push(file);
      return acc;
    }, {} as Record<string, typeof selectedCourse.routineFiles>);

    const closeModal = () => { setShowCourseModal(false); setSelectedCourse(null); };

    return (
      <div className="ce-overlay ce-overlay--top" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="ce-modal ce-modal--wide" role="dialog" aria-modal="true">
          <div className="ce-modal-head">
            <div>
              <p className="ce-eyebrow">Course Overview</p>
              <h2 className="ce-modal-h">{selectedCourse.title}</h2>
            </div>
            <button className="ce-modal-x" onClick={closeModal} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="ce-modal-body">
            {selectedCourse.thumbnail && (
              <div className="ce-modal-hero">
                <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="ce-modal-hero-img" />
              </div>
            )}

            {selectedCourse.description && (
              <p className="ce-modal-desc">{selectedCourse.description}</p>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              {selectedCourse.class && (
                <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                  <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.25rem'}}>Class</p>
                  <p style={{color:'#fff',fontWeight:500}}>{selectedCourse.class}</p>
                </div>
              )}
              {selectedCourse.category && (
                <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                  <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.25rem'}}>Category</p>
                  <p style={{color:'#fff',fontWeight:500}}>{selectedCourse.category}</p>
                </div>
              )}
            </div>

            {selectedCourse.level && selectedCourse.level !== 'unspecified' && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.5rem'}}>Level</p>
                <span className={`px-3 py-1 rounded-full text-sm ${getLevelColor(selectedCourse.level)}`}>
                  {selectedCourse.level}
                </span>
              </div>
            )}

            {isEnrolled && selectedCourse.duration && selectedCourse.duration !== '00:00' && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.25rem'}}>Duration</p>
                <p style={{color:'#fff',fontWeight:500,display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  <Clock size={16} style={{color:'#818cf8'}} />
                  {selectedCourse.duration}
                </p>
              </div>
            )}

            {(selectedCourse.hasAiQnA || selectedCourse.hasHumanQnA || selectedCourse.hasStudyPlanner) && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.75rem'}}>Special Features</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.5rem'}}>
                  {selectedCourse.hasAiQnA && <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm border border-primary-800">AI Q&A Support</span>}
                  {selectedCourse.hasHumanQnA && <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm border border-primary-800">Human Q&A Support</span>}
                  {selectedCourse.hasStudyPlanner && <span className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm border border-primary-800">Study Planner</span>}
                </div>
              </div>
            )}

            <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
                <span style={{color:'#9ca3af'}}>Price</span>
                <span style={{fontSize:'1.5rem',fontWeight:700,color:'#fff'}}>
                  {selectedCourse.price === 0 ? 'Free' : `৳${selectedCourse.price.toLocaleString()}`}
                </span>
              </div>
              {selectedCourse.previousStudentDiscount && selectedCourse.previousStudentDiscount > 0 && (
                <div style={{paddingTop:'0.5rem',borderTop:'1px solid #222d40'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
                    <span style={{color:'#9ca3af'}}>Previous Student Discount</span>
                    <span style={{color:'#4ade80',fontWeight:500}}>৳{selectedCourse.previousStudentDiscount}</span>
                  </div>
                </div>
              )}
              {selectedCourse.extraDiscount && selectedCourse.extraDiscount > 0 && selectedCourse.extraDiscountValidUntil && (
                <div style={{paddingTop:'0.5rem',borderTop:'1px solid #222d40'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
                    <span style={{color:'#9ca3af'}}>Limited Time Discount</span>
                    <span style={{color:'#4ade80',fontWeight:500}}>৳{selectedCourse.extraDiscount}</span>
                  </div>
                  <p style={{fontSize:'0.75rem',color:'#6b7280',marginTop:'0.25rem'}}>Valid until: {formatDate(selectedCourse.extraDiscountValidUntil)}</p>
                </div>
              )}
            </div>

            {selectedCourse.validity && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.25rem'}}>Course Available Until</p>
                <p style={{color:'#fff',fontWeight:500}}>{formatDate(selectedCourse.validity)}</p>
              </div>
            )}

            {selectedCourse.requirements && selectedCourse.requirements.length > 0 && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.75rem'}}>Requirements</p>
                <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  {selectedCourse.requirements.map((req, idx) => (
                    <li key={idx} style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',color:'#d1d5db'}}>
                      <CheckCircle size={16} style={{color:'#818cf8',marginTop:'2px',flexShrink:0}} />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedCourse.whatYouWillLearn && selectedCourse.whatYouWillLearn.length > 0 && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.75rem'}}>What You Will Learn</p>
                <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  {selectedCourse.whatYouWillLearn.map((item, idx) => (
                    <li key={idx} style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',color:'#d1d5db'}}>
                      <Award size={16} style={{color:'#818cf8',marginTop:'2px',flexShrink:0}} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {routineFilesByCategory && Object.keys(routineFilesByCategory).length > 0 && (
              <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem'}}>
                <p style={{color:'#9ca3af',fontSize:'0.875rem',marginBottom:'0.75rem'}}>Downloadable Files</p>
                {Object.entries(routineFilesByCategory).map(([category, files]) => (
                  <div key={category} style={{marginBottom:'1rem'}}>
                    <p style={{color:'#fff',fontWeight:500,fontSize:'0.875rem',marginBottom:'0.5rem'}}>{category}</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                      {files?.map((file) => (
                        <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                          style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem',background:'#222d40',borderRadius:'0.25rem',textDecoration:'none',color:'#d1d5db',fontSize:'0.875rem',transition:'background .15s'}}
                          onMouseOver={e => (e.currentTarget.style.background='#2a3650')}
                          onMouseOut={e => (e.currentTarget.style.background='#222d40')}
                        >
                          <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                            <FileText size={16} style={{color:'#818cf8'}} />
                            <span>{file.fileName}</span>
                          </div>
                          <Download size={16} style={{color:'#9ca3af'}} />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ce-modal-foot">
            {isEnrolled ? (
              <button
                onClick={() => handleContinueLearning(selectedCourse.id)}
                style={{width:'100%',padding:'0.75rem',background:'#4f46e5',color:'#fff',border:'none',borderRadius:'0.5rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',fontSize:'1rem',fontWeight:500}}
              >
                <Play size={20} /><span>Continue Learning</span>
              </button>
            ) : (
              <button
                onClick={() => { closeModal(); handleEnrollClick(selectedCourse); }}
                disabled={calculatingPrice}
                style={{width:'100%',padding:'0.75rem',background:calculatingPrice?'#3730a3':'#4f46e5',color:'#fff',border:'none',borderRadius:'0.5rem',cursor:calculatingPrice?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',fontSize:'1rem',fontWeight:500,opacity:calculatingPrice?0.7:1}}
              >
                {calculatingPrice
                  ? <><Loader size={20} className="animate-spin" /><span>Calculating...</span></>
                  : <><ShoppingCart size={20} /><span>Enroll Now</span></>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== ENROLLMENT MODAL (original JSX, unchanged) ====================

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
      <div className="ce-overlay ce-overlay--top" onClick={e => { if (e.target === e.currentTarget && !enrolling) closeEnrollmentModal(); }}>
        <div className="ce-modal ce-modal--narrow" role="dialog" aria-modal="true">
          <div className="ce-modal-head">
            <div>
              <p className="ce-eyebrow">Complete Enrollment</p>
              <h2 className="ce-modal-h-sm">{course.title}</h2>
              <p style={{color:'#9ca3af',fontSize:'0.875rem',marginTop:'0.25rem'}}>{course.class}</p>
            </div>
            <button className="ce-modal-x" onClick={closeEnrollmentModal} disabled={enrolling} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="ce-modal-body">
            {/* Price breakdown */}
            <div style={{background:'#1a2232',padding:'1rem',borderRadius:'0.5rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{color:'#9ca3af'}}>Base Price</span>
                <span style={{color:'#fff',fontWeight:500}}>৳{calculation.basePrice.toLocaleString()}</span>
              </div>
              {calculation.previousStudentDiscount > 0 && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
                  <span style={{color:'#9ca3af',display:'flex',alignItems:'center',gap:'0.25rem'}}><Percent size={14} />Previous Student</span>
                  <span style={{color:'#4ade80'}}>-৳{calculation.previousStudentDiscount.toLocaleString()}</span>
                </div>
              )}
              {calculation.extraDiscount > 0 && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
                  <span style={{color:'#9ca3af',display:'flex',alignItems:'center',gap:'0.25rem'}}><Tag size={14} />Limited Time</span>
                  <span style={{color:'#4ade80'}}>-৳{calculation.extraDiscount.toLocaleString()}</span>
                </div>
              )}
              {appliedCoupons.map(ac => (
                <div key={ac.couponCode} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
                  <span style={{color:'#9ca3af',display:'flex',alignItems:'center',gap:'0.25rem'}}>
                    <Ticket size={14} />Coupon
                    <span style={{fontFamily:'monospace',fontSize:'0.75rem',color:'#a5b4fc',marginLeft:'0.25rem',background:'rgba(49,46,129,0.3)',padding:'1px 6px',borderRadius:'4px'}}>{ac.couponCode}</span>
                  </span>
                  <span style={{color:'#4ade80'}}>-৳{ac.discount.toLocaleString()}</span>
                </div>
              ))}
              {calculation.totalDiscount > 0 && (
                <div style={{paddingTop:'0.5rem',borderTop:'1px solid #222d40'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'0.875rem'}}>
                    <span style={{color:'#9ca3af'}}>Total Savings</span>
                    <span style={{color:'#4ade80',fontWeight:500}}>৳{calculation.totalDiscount.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div style={{paddingTop:'0.5rem',borderTop:'1px solid #222d40'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{color:'#fff',fontWeight:500}}>Final Price</span>
                  <span style={{fontSize:'1.5rem',fontWeight:700,color:'#818cf8'}}>
                    {calculation.finalPrice === 0 ? 'Free' : `৳${calculation.finalPrice.toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Coupon section */}
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <Ticket size={15} style={{color:'#9ca3af'}} />
                <span style={{fontSize:'0.875rem',fontWeight:500,color:'#d1d5db'}}>
                  Coupon Codes
                  {appliedCoupons.length > 0 && (
                    <span style={{marginLeft:'0.5rem',fontSize:'0.75rem',fontWeight:400,color:'#818cf8'}}>{appliedCoupons.length} applied</span>
                  )}
                </span>
              </div>

              {appliedCoupons.length > 0 && (
                <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
                  {appliedCoupons.map(ac => (
                    <div key={ac.couponCode} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'0.75rem',background:'rgba(20,83,45,0.2)',border:'1px solid rgba(34,197,94,0.4)',borderRadius:'0.5rem',padding:'0.5rem 0.75rem'}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',minWidth:0}}>
                        <CheckCircle size={15} style={{color:'#4ade80',flexShrink:0,marginTop:'2px'}} />
                        <div style={{minWidth:0}}>
                          <p style={{fontSize:'0.875rem',color:'#4ade80',fontWeight:600}}>
                            <span style={{fontFamily:'monospace'}}>{ac.couponCode}</span>
                            <span style={{fontFamily:'inherit',fontWeight:400,color:'rgba(134,239,172,0.8)',marginLeft:'0.5rem'}}>— saving ৳{ac.discount.toLocaleString()}</span>
                          </p>
                          {ac.successMessage && <p style={{fontSize:'0.75rem',color:'rgba(134,239,172,0.7)',marginTop:'2px',overflowWrap:'break-word'}}>{ac.successMessage}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCoupon(ac.couponCode, enrollmentData)}
                        disabled={enrolling || couponInput.fieldState === 'checking'}
                        style={{flexShrink:0,padding:'2px',color:'#6b7280',background:'transparent',border:'none',cursor:'pointer',transition:'color .15s',opacity:enrolling||couponInput.fieldState==='checking'?0.4:1}}
                        title={`Remove ${ac.couponCode}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{display:'flex',flexDirection:'column',gap:'0.375rem'}}>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  <div style={{position:'relative',flex:1}}>
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
                      placeholder={appliedCoupons.length > 0 ? 'Add another coupon code' : 'Enter coupon code'}
                      maxLength={30}
                      disabled={couponInput.fieldState === 'checking' || enrolling}
                      style={{
                        width:'100%',boxSizing:'border-box',background:'#222d40',color:'#fff',
                        border:`1px solid ${couponInput.fieldState==='error'?'rgba(239,68,68,0.6)':'#2a3650'}`,
                        borderRadius:'0.5rem',padding:'0.5rem 2rem 0.5rem 0.75rem',
                        fontFamily:'monospace',fontSize:'0.875rem',outline:'none',
                        opacity:couponInput.fieldState==='checking'||enrolling?0.5:1
                      }}
                    />
                    {localCode && couponInput.fieldState !== 'checking' && (
                      <button
                        onClick={() => { setLocalCode(''); setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' })); inputRef.current?.focus(); }}
                        style={{position:'absolute',right:'0.5rem',top:'50%',transform:'translateY(-50%)',color:'#6b7280',background:'transparent',border:'none',cursor:'pointer'}}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleAddCoupon}
                    disabled={!localCode.trim() || couponInput.fieldState === 'checking' || enrolling}
                    style={{padding:'0.5rem 1rem',background:!localCode.trim()||couponInput.fieldState==='checking'||enrolling?'#222d40':'#4f46e5',color:'#fff',border:'none',borderRadius:'0.5rem',cursor:!localCode.trim()||couponInput.fieldState==='checking'||enrolling?'not-allowed':'pointer',fontSize:'0.875rem',fontWeight:500,display:'flex',alignItems:'center',gap:'0.375rem',whiteSpace:'nowrap',opacity:!localCode.trim()||couponInput.fieldState==='checking'||enrolling?0.5:1}}
                  >
                    {couponInput.fieldState === 'checking'
                      ? <><Loader size={14} className="animate-spin" />Checking...</>
                      : <><Plus size={14} />Apply</>
                    }
                  </button>
                </div>

                {couponInput.fieldState === 'error' && couponInput.errorMessage && (
                  <div style={{display:'flex',alignItems:'flex-start',gap:'0.375rem',color:'#f87171'}}>
                    <AlertCircle size={13} style={{flexShrink:0,marginTop:'2px'}} />
                    <p style={{fontSize:'0.75rem'}}>{couponInput.errorMessage}</p>
                  </div>
                )}

                {couponInput.fieldState === 'idle' && !localCode && (
                  <p style={{fontSize:'0.75rem',color:'#6b7280',display:'flex',alignItems:'center',gap:'0.25rem'}}>
                    <Info size={11} />
                    {appliedCoupons.length > 0
                      ? 'You can stack multiple coupon codes — each is validated separately.'
                      : 'Have a promotional or discount code? Enter it above.'}
                  </p>
                )}
              </div>
            </div>

            {calculation.hasPreviousEnrollments && calculation.previousStudentDiscount > 0 && (
              <div style={{background:'rgba(20,83,45,0.2)',border:'1px solid rgba(34,197,94,0.3)',padding:'0.75rem',borderRadius:'0.5rem'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:'0.5rem'}}>
                  <CheckCircle size={16} style={{color:'#4ade80',marginTop:'2px',flexShrink:0}} />
                  <div>
                    <p style={{fontSize:'0.875rem',color:'#4ade80',fontWeight:500}}>Previous Student Discount Applied!</p>
                    <p style={{fontSize:'0.75rem',color:'#9ca3af',marginTop:'0.25rem'}}>Saving ৳{calculation.previousStudentDiscount.toLocaleString()} as a returning student.</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{background:'rgba(127,29,29,0.3)',color:'#fca5a5',padding:'0.75rem',borderRadius:'0.5rem',fontSize:'0.875rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <AlertCircle size={16} style={{flexShrink:0}} /><span>{error}</span>
              </div>
            )}
            {warning && (
              <div style={{background:'rgba(120,53,15,0.3)',color:'#fcd34d',padding:'0.75rem',borderRadius:'0.5rem',fontSize:'0.875rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <AlertTriangle size={16} style={{flexShrink:0}} /><span>{warning}</span>
              </div>
            )}

            <div style={{display:'flex',gap:'0.75rem',paddingTop:'1rem'}}>
              <button
                onClick={closeEnrollmentModal}
                disabled={enrolling}
                style={{flex:1,padding:'0.75rem',background:'#222d40',color:'#fff',border:'none',borderRadius:'0.5rem',cursor:enrolling?'not-allowed':'pointer',opacity:enrolling?0.5:1}}
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToPayment}
                disabled={enrolling || couponInput.fieldState === 'checking'}
                style={{flex:1,padding:'0.75rem',background:enrolling||couponInput.fieldState==='checking'?'#3730a3':'#4f46e5',color:'#fff',border:'none',borderRadius:'0.5rem',cursor:enrolling||couponInput.fieldState==='checking'?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',opacity:enrolling||couponInput.fieldState==='checking'?0.5:1}}
              >
                {enrolling ? (
                  <><Loader size={20} className="animate-spin" /><span>Processing...</span></>
                ) : calculation.finalPrice === 0 ? (
                  <><Check size={20} /><span>Enroll Free</span></>
                ) : (
                  <><ShoppingCart size={20} /><span>Pay ৳{calculation.finalPrice.toLocaleString()}</span></>
                )}
              </button>
            </div>

            {calculation.finalPrice > 0 && !enrolling && (
              <p style={{textAlign:'center',fontSize:'0.75rem',color:'#6b7280'}}>🔒 Secure payment via SSLCOMMERZ</p>
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
      <div className="ce-page">

        {/* Header */}
        <header className="ce-header">
          <div>
            <h1 className="ce-page-h">Course Enrollment</h1>
            <p className="ce-page-sub">Discover and enroll in expert-led courses</p>
          </div>
          <div className="ce-header-pills">
            <span className="ce-pill"><BookOpen size={13} /><strong>{availableCourses.length}</strong>Available</span>
            <span className="ce-pill ce-pill--blue"><GraduationCap size={13} /><strong>{enrolledCourses.length}</strong>Enrolled</span>
            {favouriteCount > 0 && (
              <button
                className={`ce-pill ce-pill--fav${selectedCategory === '__favorites__' ? ' ce-pill--fav-on' : ''}`}
                onClick={() => setSelectedCategory(v => v === '__favorites__' ? 'all' : '__favorites__')}
                title="Filter by saved courses"
              >
                <Heart size={13} className={selectedCategory === '__favorites__' ? 'ce-fill' : ''} />
                <strong>{favouriteCount}</strong>Saved
              </button>
            )}
          </div>
        </header>

        {/* Notices */}
        <div className="ce-notices">
          <PaymentReturnBanner />
          {error && (
            <div className="ce-notice ce-notice-red ce-notice--row ce-notice--dismissible">
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flex:1}}>
                <AlertCircle size={16} className="ce-shrink0" /><span style={{fontSize:'0.875rem'}}>{error}</span>
              </div>
              <button className="ce-notice-close" onClick={clearMessages}><X size={14} /></button>
            </div>
          )}
          {success && (
            <div className="ce-notice ce-notice-green ce-notice--row ce-notice--dismissible">
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flex:1}}>
                <CheckCircle size={16} className="ce-shrink0" /><span style={{fontSize:'0.875rem'}}>{success}</span>
              </div>
              <button className="ce-notice-close" onClick={clearMessages}><X size={14} /></button>
            </div>
          )}
          {warning && (
            <div className="ce-notice ce-notice-amber ce-notice--row ce-notice--dismissible">
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flex:1}}>
                <AlertTriangle size={16} className="ce-shrink0" /><span style={{fontSize:'0.875rem'}}>{warning}</span>
              </div>
              <button className="ce-notice-close" onClick={clearMessages}><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Tab bar + view toggle */}
        <div className="ce-tab-bar">
          <nav className="ce-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'available'}
              className={`ce-tab${activeTab === 'available' ? ' ce-tab--on' : ''}`}
              onClick={() => setActiveTab('available')}>
              <BookOpen size={13} />Available<span className="ce-tab-ct">{availableCourses.length}</span>
            </button>
            <button role="tab" aria-selected={activeTab === 'enrolled'}
              className={`ce-tab${activeTab === 'enrolled' ? ' ce-tab--on' : ''}`}
              onClick={() => setActiveTab('enrolled')}>
              <GraduationCap size={13} />Enrolled<span className="ce-tab-ct">{enrolledCourses.length}</span>
            </button>
          </nav>
          <div className="ce-view-toggle" role="group" aria-label="View mode">
            <button aria-label="Grid view" aria-pressed={viewMode === 'grid'}
              className={`ce-view-btn${viewMode === 'grid' ? ' ce-view-btn--on' : ''}`}
              onClick={() => setViewMode('grid')}><Grid3X3 size={14} /></button>
            <button aria-label="List view" aria-pressed={viewMode === 'list'}
              className={`ce-view-btn${viewMode === 'list' ? ' ce-view-btn--on' : ''}`}
              onClick={() => setViewMode('list')}><List size={14} /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="ce-filters">
          <div className="ce-search-wrap">
            <Search size={14} className="ce-search-icon" aria-hidden="true" />
            <input type="search" aria-label="Search courses" placeholder="Search courses, instructors, topics…"
              className="ce-search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && <button className="ce-search-x" onClick={() => setSearchTerm('')} aria-label="Clear"><X size={12} /></button>}
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="ce-sel" aria-label="Category">
            <option value="all">All Categories</option>
            <option value="__favorites__">❤ Saved Courses{favouriteCount > 0 ? ` (${favouriteCount})` : ''}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="ce-sel" aria-label="Class">
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)} className="ce-sel" aria-label="Level">
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)} className="ce-sel" aria-label="Price">
            <option value="all">Any Price</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="under1000">Under ৳1,000</option>
            <option value="under5000">Under ৳5,000</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="ce-sel" aria-label="Sort by">
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low → High</option>
            <option value="price-high">Price: High → Low</option>
          </select>
        </div>

        {/* Favourites active filter strip */}
        {selectedCategory === '__favorites__' && (
          <div className="ce-fav-strip">
            <Heart size={13} className="ce-fill" style={{color:'#f43f5e'}} />
            <span>Showing saved courses only</span>
            <button className="ce-fav-strip-clear" onClick={() => setSelectedCategory('all')}><X size={11} />Clear</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="ce-iloader">
            <Loader size={22} className="animate-spin" style={{color:'#2563eb'}} />
            <span>Refreshing…</span>
          </div>
        ) : displayCourses.length === 0 ? (
          <div className="ce-empty" role="status">
            <div className="ce-empty-icon">
              {selectedCategory === '__favorites__' ? <Heart size={30} />
                : activeTab === 'available' ? <Search size={30} />
                : <GraduationCap size={30} />}
            </div>
            <h3 className="ce-empty-h">
              {selectedCategory === '__favorites__' ? 'No saved courses yet'
                : activeTab === 'available' ? 'No courses match your filters'
                : 'No enrolled courses yet'}
            </h3>
            <p className="ce-empty-p">
              {selectedCategory === '__favorites__'
                ? 'Tap the ❤ on any course card to save it here.'
                : activeTab === 'available'
                  ? 'Try adjusting your search or filters.'
                  : 'Explore available courses and start your learning journey!'}
            </p>
            {activeTab === 'enrolled' && (
              <button className="ce-btn ce-btn--primary" style={{marginTop:'1.25rem'}} onClick={() => setActiveTab('available')}>
                <BookOpen size={14} />Browse Courses
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'ce-grid' : 'ce-list'} role="list">
            {displayCourses.map(course => (
              <div role="listitem" key={course.id}><CourseCard course={course} /></div>
            ))}
          </div>
        )}
      </div>

      {showCourseModal && <CourseOverviewModal />}
      {showEnrollmentModal && <EnrollmentModal />}
    </>
  );
};

// ==================== EMBEDDED STYLES ====================

const CEStyles = () => (
  <style>{`
    :root {
      --ce-s0:#0c1018; --ce-s1:#131921; --ce-s2:#1a2232; --ce-s3:#222d40;
      --ce-bd:#28354a; --ce-bd2:#35455e;
      --ce-tx:#dce5f0; --ce-tx2:#7f90a8; --ce-tx3:#49596e;
      --ce-blue:#2563eb; --ce-blue-h:#1d4ed8;
      --ce-blue-bg:rgba(37,99,235,.10); --ce-blue-bd:rgba(37,99,235,.28);
      --ce-teal:#0d9488; --ce-teal-h:#0f766e;
      --ce-green-bg:rgba(16,185,129,.10); --ce-green-bd:rgba(16,185,129,.28);
      --ce-amber-bg:rgba(245,158,11,.10); --ce-amber-bd:rgba(245,158,11,.28);
      --ce-red-bg:rgba(239,68,68,.10); --ce-red-bd:rgba(239,68,68,.28);
      --ce-rose:#f43f5e; --ce-rose-bg:rgba(244,63,94,.10); --ce-rose-bd:rgba(244,63,94,.28);
      --ce-r:10px; --ce-rl:16px; --ce-rxl:20px;
      --ce-sh:0 2px 10px rgba(0,0,0,.35); --ce-sh-lg:0 10px 48px rgba(0,0,0,.55);
    }

    .ce-shrink0{flex-shrink:0}
    .ce-fill{fill:currentColor}
    .ce-dim{color:var(--ce-tx2)}

    .animate-spin{animation:ce-spin .75s linear infinite}
    @keyframes ce-spin{to{transform:rotate(360deg)}}

    /* Page */
    .ce-page{display:flex;flex-direction:column;gap:1.125rem;padding-bottom:3rem}

    /* Header */
    .ce-header{display:flex;align-items:flex-start;justify-content:space-between;gap:.875rem;flex-wrap:wrap}
    .ce-page-h{font-size:clamp(1.3rem,4vw,1.65rem);font-weight:700;color:var(--ce-tx);letter-spacing:-.02em;line-height:1.2}
    .ce-page-sub{font-size:.82rem;color:var(--ce-tx2);margin-top:4px}
    .ce-header-pills{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
    .ce-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;background:var(--ce-s2);border:1px solid var(--ce-bd);border-radius:40px;font-size:.78rem;color:var(--ce-tx2);white-space:nowrap;cursor:default}
    .ce-pill strong{color:var(--ce-tx);font-weight:600;margin-right:1px}
    .ce-pill--blue{border-color:var(--ce-blue-bd);color:#60a5fa}
    .ce-pill--blue strong{color:#60a5fa}
    .ce-pill--fav{cursor:pointer;border-color:var(--ce-rose-bd);color:#fb7185;background:transparent;transition:all .18s}
    .ce-pill--fav:hover{background:var(--ce-rose-bg)}
    .ce-pill--fav strong{color:#fb7185}
    .ce-pill--fav-on{background:var(--ce-rose-bg);border-color:var(--ce-rose);color:var(--ce-rose)}
    .ce-pill--fav-on strong{color:var(--ce-rose)}

    /* Fav strip */
    .ce-fav-strip{display:flex;align-items:center;gap:8px;padding:8px 13px;background:var(--ce-rose-bg);border:1px solid var(--ce-rose-bd);border-radius:var(--ce-r);font-size:.82rem;color:#fb7185}
    .ce-fav-strip-clear{display:inline-flex;align-items:center;gap:4px;margin-left:auto;background:transparent;border:1px solid var(--ce-rose-bd);color:#fb7185;border-radius:6px;padding:3px 9px;font-size:.75rem;cursor:pointer;font-family:inherit}
    .ce-fav-strip-clear:hover{background:var(--ce-rose-bg)}

    /* Notices */
    .ce-notices{display:flex;flex-direction:column;gap:.5rem}
    .ce-notice{display:flex;align-items:flex-start;padding:10px 13px;border-radius:var(--ce-r);border:1px solid transparent;font-size:.875rem}
    .ce-notice--row{flex-direction:row;gap:9px;align-items:center}
    .ce-notice--dismissible{justify-content:space-between}
    .ce-notice-text{flex:1;font-size:.85rem;line-height:1.5}
    .ce-notice-blue {background:var(--ce-blue-bg); border-color:var(--ce-blue-bd); color:#93c5fd}
    .ce-notice-green{background:var(--ce-green-bg);border-color:var(--ce-green-bd);color:#6ee7b7}
    .ce-notice-red  {background:var(--ce-red-bg);  border-color:var(--ce-red-bd);  color:#fca5a5}
    .ce-notice-amber{background:var(--ce-amber-bg);border-color:var(--ce-amber-bd);color:#fcd34d}
    .ce-notice-close{background:transparent;border:none;color:inherit;opacity:.55;cursor:pointer;padding:2px;flex-shrink:0;transition:opacity .15s;font-family:inherit}
    .ce-notice-close:hover{opacity:1}

    /* Tab bar */
    .ce-tab-bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border-bottom:1px solid var(--ce-bd);flex-wrap:wrap}
    .ce-tabs{display:flex}
    .ce-tab{display:inline-flex;align-items:center;gap:6px;padding:.7rem 1rem;font-size:.855rem;font-weight:500;color:var(--ce-tx2);border:none;border-bottom:2px solid transparent;background:transparent;cursor:pointer;transition:color .18s,border-color .18s;white-space:nowrap;line-height:1;font-family:inherit}
    .ce-tab:hover{color:var(--ce-tx)}
    .ce-tab--on{color:var(--ce-blue);border-bottom-color:var(--ce-blue)}
    .ce-tab-ct{background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx2);border-radius:40px;padding:1px 7px;font-size:.68rem;font-weight:600}
    .ce-tab--on .ce-tab-ct{background:var(--ce-blue-bg);border-color:var(--ce-blue-bd);color:var(--ce-blue)}

    /* View toggle */
    .ce-view-toggle{display:flex;gap:3px;padding:3px;background:var(--ce-s2);border:1px solid var(--ce-bd);border-radius:var(--ce-r)}
    .ce-view-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;border:none;background:transparent;color:var(--ce-tx3);cursor:pointer;transition:all .18s;font-family:inherit}
    .ce-view-btn:hover{color:var(--ce-tx2);background:var(--ce-s3)}
    .ce-view-btn--on{background:var(--ce-blue);color:#fff}
    .ce-view-btn--on:hover{background:var(--ce-blue-h)}

    /* Filters */
    .ce-filters{display:grid;gap:.6rem;grid-template-columns:1fr;background:var(--ce-s1);border:1px solid var(--ce-bd);border-radius:var(--ce-rl);padding:.875rem}
    @media(min-width:500px){.ce-filters{grid-template-columns:1fr 1fr}}
    @media(min-width:768px){.ce-filters{grid-template-columns:1fr 1fr 1fr}}
    @media(min-width:1100px){.ce-filters{grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr}}
    .ce-search-wrap{position:relative;grid-column:1/-1}
    @media(min-width:1100px){.ce-search-wrap{grid-column:span 2}}
    .ce-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ce-tx3);pointer-events:none}
    .ce-search{width:100%;box-sizing:border-box;background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx);border-radius:var(--ce-r);padding:9px 32px 9px 34px;font-size:.85rem;outline:none;transition:border-color .18s,box-shadow .18s;font-family:inherit}
    .ce-search::placeholder{color:var(--ce-tx3)}
    .ce-search:focus{border-color:var(--ce-blue);box-shadow:0 0 0 3px var(--ce-blue-bg)}
    .ce-search-x{position:absolute;right:9px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--ce-tx3);cursor:pointer;padding:3px;font-family:inherit}
    .ce-sel{width:100%;background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx);border-radius:var(--ce-r);padding:9px 28px 9px 10px;font-size:.85rem;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath fill='%236b7280' d='M5 7 0 0h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;transition:border-color .18s,box-shadow .18s;font-family:inherit}
    .ce-sel:focus{border-color:var(--ce-blue);box-shadow:0 0 0 3px var(--ce-blue-bg)}
    .ce-sel option{background:var(--ce-s2)}

    /* Grid */
    .ce-grid{display:grid;grid-template-columns:1fr;gap:1.125rem}
    @media(min-width:560px){.ce-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:1024px){.ce-grid{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:1400px){.ce-grid{grid-template-columns:repeat(4,1fr)}}

    /* List view — stacked on mobile, row on ≥560px */
    .ce-list{display:flex;flex-direction:column;gap:.75rem}
    .ce-list .ce-card{flex-direction:column}
    @media(min-width:560px){
      .ce-list .ce-card{flex-direction:row}
      .ce-list .ce-card .ce-card-thumb{width:200px;min-width:200px;height:auto;min-height:150px}
      .ce-list .ce-card .ce-card-body{flex:1}
    }

    /* Card */
    .ce-card{display:flex;flex-direction:column;background:var(--ce-s1);border:1px solid var(--ce-bd);border-radius:var(--ce-rl);overflow:hidden;transition:transform .25s,border-color .25s,box-shadow .25s;box-shadow:var(--ce-sh)}
    .ce-card:hover{transform:translateY(-4px);border-color:var(--ce-bd2);box-shadow:0 14px 44px rgba(0,0,0,.48)}

    /* Thumbnail */
    .ce-card-thumb{position:relative;overflow:hidden;height:192px;flex-shrink:0}
    .ce-card-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
    .ce-card:hover .ce-card-img{transform:scale(1.05)}
    .ce-card-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#181f2e,#0e1319);color:var(--ce-tx3)}
    .ce-card-shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.52) 0%,transparent 50%);pointer-events:none}

    /* Thumb badges */
    .ce-tbadge{position:absolute;display:inline-flex;align-items:center;gap:4px;font-size:.63rem;font-weight:700;padding:3px 8px;border-radius:20px}
    .ce-tbadge-tl{top:9px;left:9px}
    .ce-tbadge-bl{bottom:9px;left:9px}
    .ce-badge-enrolled{background:rgba(16,185,129,.82);color:#fff;backdrop-filter:blur(4px)}
    .ce-badge-free{background:var(--ce-blue);color:#fff}

    /* Favourite */
    .ce-fav{position:absolute;top:9px;right:9px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14);color:#fff;cursor:pointer;backdrop-filter:blur(4px);transition:all .2s;font-family:inherit}
    .ce-fav:hover,.ce-fav--on{background:var(--ce-rose);border-color:var(--ce-rose)}

    /* Level badge */
    .ce-level{display:inline-flex;align-items:center;font-size:.62rem;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:capitalize}
    .ce-badge-green{background:rgba(16,185,129,.14);color:#34d399;border:1px solid rgba(16,185,129,.3)}
    .ce-badge-amber{background:rgba(245,158,11,.14);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
    .ce-badge-rose{background:rgba(239,68,68,.14);color:#f87171;border:1px solid rgba(239,68,68,.3)}
    .ce-badge-slate{background:var(--ce-s3);color:var(--ce-tx2);border:1px solid var(--ce-bd)}

    /* Card body */
    .ce-card-body{display:flex;flex-direction:column;gap:.45rem;padding:.9rem;flex:1}
    .ce-meta-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ce-rating{display:inline-flex;align-items:center;gap:4px;font-size:.78rem;color:var(--ce-tx)}
    .ce-rating strong{font-weight:600}
    .ce-star{color:#fbbf24;fill:#fbbf24}
    .ce-sep{color:var(--ce-tx3);font-size:.55rem}
    .ce-students{display:inline-flex;align-items:center;gap:3px;font-size:.76rem;color:var(--ce-tx2)}
    .ce-card-title{font-size:.9rem;font-weight:600;color:var(--ce-tx);line-height:1.45;cursor:pointer;transition:color .18s;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0}
    .ce-card-title:hover{color:var(--ce-blue)}
    .ce-card-sub{font-size:.76rem;color:var(--ce-tx2)}
    .ce-chips{display:flex;flex-wrap:wrap;gap:5px}
    .ce-chip{display:inline-flex;align-items:center;gap:4px;font-size:.64rem;font-weight:600;color:var(--ce-blue);background:var(--ce-blue-bg);border:1px solid var(--ce-blue-bd);border-radius:20px;padding:3px 8px;white-space:nowrap}
    .ce-progress{display:flex;flex-direction:column;gap:4px}
    .ce-progress-labels{display:flex;justify-content:space-between;font-size:.73rem;color:var(--ce-tx2)}
    .ce-progress-labels strong{color:var(--ce-tx);font-weight:600}
    .ce-progress-track{height:5px;border-radius:3px;background:var(--ce-s3);overflow:hidden}
    .ce-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--ce-blue),#60a5fa);transition:width .5s}
    .ce-price{font-size:1.15rem;font-weight:700;color:var(--ce-tx);margin-top:auto}
    .ce-card-actions{display:flex;gap:.45rem;margin-top:auto}

    /* Buttons */
    .ce-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .2s;padding:8px 13px;line-height:1;white-space:nowrap;font-family:inherit}
    .ce-btn:disabled{opacity:.48;cursor:not-allowed;transform:none!important}
    .ce-btn--ghost{flex:1;background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx2)}
    .ce-btn--ghost:hover:not(:disabled){border-color:var(--ce-bd2);color:var(--ce-tx);background:var(--ce-s3)}
    .ce-btn--primary{flex:1;background:var(--ce-blue);color:#fff;box-shadow:0 2px 10px rgba(37,99,235,.28)}
    .ce-btn--primary:hover:not(:disabled){background:var(--ce-blue-h);transform:translateY(-1px)}
    .ce-btn--enroll{flex:1;background:var(--ce-teal);color:#fff;box-shadow:0 2px 10px rgba(13,148,136,.28)}
    .ce-btn--enroll:hover:not(:disabled){background:var(--ce-teal-h);transform:translateY(-1px)}

    /* Empty state */
    .ce-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 1.5rem;text-align:center}
    .ce-empty-icon{width:68px;height:68px;border-radius:50%;background:var(--ce-s2);border:1px solid var(--ce-bd);display:flex;align-items:center;justify-content:center;color:var(--ce-tx3);margin-bottom:1.125rem}
    .ce-empty-h{font-size:1.05rem;font-weight:600;color:var(--ce-tx);margin-bottom:.4rem}
    .ce-empty-p{font-size:.85rem;color:var(--ce-tx2);max-width:340px;line-height:1.6}

    /* Inline loader */
    .ce-iloader{display:flex;align-items:center;justify-content:center;gap:10px;padding:3.5rem;color:var(--ce-tx2);font-size:.85rem}

    /* Full-screen animated loader */
    .ce-fullload{position:fixed;inset:0;background:var(--ce-s0);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;z-index:9999}
    .ce-fullload-wrap{position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center}
    .ce-fullload-ring{position:absolute;inset:0;border:3px solid rgba(37,99,235,.18);border-top-color:var(--ce-blue);border-radius:50%;animation:ce-spin .85s linear infinite}
    .ce-fullload-icon{color:var(--ce-blue);position:relative;z-index:1}
    .ce-fullload-text{font-size:.82rem;color:var(--ce-tx2);margin-top:.25rem}
    .ce-fullload-dots{display:flex;gap:6px}
    .ce-fullload-dots span{width:6px;height:6px;border-radius:50%;background:var(--ce-blue);opacity:.25;animation:ce-dot 1.2s ease-in-out infinite}
    .ce-fullload-dots span:nth-child(2){animation-delay:.2s}
    .ce-fullload-dots span:nth-child(3){animation-delay:.4s}
    @keyframes ce-dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}

    /* Modals */
    /* ce-overlay--top: aligns to top with padding so modal never clips behind fixed app header */
    .ce-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;overflow-y:auto}
    .ce-overlay--top{align-items:flex-start;padding-top:max(env(safe-area-inset-top,0px) + 64px,80px)}
    .ce-modal{background:#131921;border:1px solid var(--ce-bd2);border-radius:var(--ce-rxl);width:100%;box-shadow:var(--ce-sh-lg);display:flex;flex-direction:column;max-height:calc(100vh - 100px);animation:ce-modal-in .24s ease}
    .ce-modal--wide{max-width:800px}
    .ce-modal--narrow{max-width:450px}
    @keyframes ce-modal-in{from{opacity:0;transform:scale(.97) translateY(14px)}to{opacity:1;transform:none}}

    .ce-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.875rem;padding:1.25rem 1.5rem;border-bottom:1px solid var(--ce-bd);background:#131921;border-radius:var(--ce-rxl) var(--ce-rxl) 0 0;position:sticky;top:0;z-index:10;flex-shrink:0}
    .ce-eyebrow{font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ce-blue);margin-bottom:4px}
    .ce-modal-h{font-size:1.25rem;font-weight:700;color:var(--ce-tx);line-height:1.25;word-break:break-word;margin:0}
    .ce-modal-h-sm{font-size:1rem;font-weight:600;color:var(--ce-tx);line-height:1.35;word-break:break-word;margin:0}
    .ce-modal-x{width:34px;height:34px;flex-shrink:0;border-radius:8px;background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s;font-family:inherit}
    .ce-modal-x:hover:not(:disabled){background:var(--ce-red-bg);border-color:var(--ce-red-bd);color:#fca5a5}
    .ce-modal-x:disabled{opacity:.4;cursor:not-allowed}
    .ce-modal-body{padding:1.25rem 1.5rem;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:1rem}
    .ce-modal-foot{padding:1rem 1.5rem;border-top:1px solid var(--ce-bd);background:#131921;border-radius:0 0 var(--ce-rxl) var(--ce-rxl);flex-shrink:0}
    .ce-modal-hero{border-radius:var(--ce-r);overflow:hidden;height:200px}
    .ce-modal-hero-img{width:100%;height:100%;object-fit:cover;display:block}
    .ce-modal-desc{font-size:.855rem;color:var(--ce-tx2);line-height:1.7;margin:0}

    /* Responsive */
    @media(max-width:479px){
      .ce-header{flex-direction:column;gap:.625rem}
      .ce-tab-bar{flex-direction:column;align-items:flex-start;border-bottom:none}
      .ce-tabs{border-bottom:1px solid var(--ce-bd);width:100%}
      .ce-view-toggle{align-self:flex-end}
      .ce-modal-head,.ce-modal-body,.ce-modal-foot{padding:.9rem 1rem}
      .ce-modal--wide,.ce-modal--narrow{max-height:calc(100vh - 80px);border-radius:var(--ce-rl)}
      .ce-overlay--top{padding-top:60px}
      .ce-card-actions{flex-direction:column}
      .ce-btn--ghost,.ce-btn--primary,.ce-btn--enroll{flex:initial;width:100%}
    }
    @media(max-width:360px){
      .ce-tab{padding:.55rem .7rem;font-size:.78rem}
      .ce-page-h{font-size:1.2rem}
    }

    /* Tailwind compat classes needed by legacy JSX inside modals */
    .px-3{padding-left:.75rem;padding-right:.75rem}
    .py-1{padding-top:.25rem;padding-bottom:.25rem}
    .rounded-full{border-radius:9999px}
    .text-sm{font-size:.875rem}
    .bg-primary-900\\/30{background:rgba(49,46,129,.3)}
    .text-primary-300{color:#a5b4fc}
    .border{border-width:1px;border-style:solid}
    .border-primary-800{border-color:#3730a3}
    .bg-success-dark{background:rgba(20,83,45,.5)}
    .text-success-light{color:#86efac}
    .bg-warning-dark{background:rgba(120,53,15,.5)}
    .text-warning-light{color:#fde68a}
    .bg-error-dark{background:rgba(127,29,29,.5)}
    .text-error-light{color:#fca5a5}
  `}</style>
);

export default CourseEnrollment;
