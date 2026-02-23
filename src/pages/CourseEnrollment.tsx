// src/pages/CourseEnrollment.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Clock, Play, BookOpen, Award, Eye,
  CheckCircle, Calendar, Video, FileText, Bookmark, X,
  Grid3X3, List, Loader, Tag, TrendingUp, Download, ShoppingCart,
  AlertCircle, Percent, DollarSign, Check, AlertTriangle, ChevronDown,
  ExternalLink, Ticket, Info, Sparkles, Plus,
  Zap, Users, GraduationCap, Shield, ArrowRight, CalendarCheck, Filter, SlidersHorizontal
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

// ==================== CUSTOM SELECT COMPONENT ====================
// FIX #4 & #5: Professional styled dropdown, no emojis

interface SelectOption { value: string; label: string; }
interface CustomSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || 'Select';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="ce-custom-sel" aria-label={ariaLabel}>
      <button
        type="button"
        className={`ce-custom-sel-trigger${open ? ' ce-custom-sel-trigger--open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="ce-custom-sel-val">{selectedLabel}</span>
        <ChevronDown size={14} className={`ce-custom-sel-chevron${open ? ' ce-custom-sel-chevron--up' : ''}`} />
      </button>
      {open && (
        <div className="ce-custom-sel-dropdown" role="listbox">
          {options.map(opt => (
            <button
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              className={`ce-custom-sel-opt${value === opt.value ? ' ce-custom-sel-opt--on' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              type="button"
            >
              {value === opt.value && <Check size={13} className="ce-custom-sel-check" />}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  // FIX #8: Mobile filter panel toggle
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

  // ── Filter options ref ────────────────────────────────────────────────────
  const filterOptsRef = useRef({
    searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
  });
  useEffect(() => {
    filterOptsRef.current = {
      searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
    };
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy]);

  // ── Cached favourite IDs ref ──────────────────────────────────────────────
  const savedFavIdsRef = useRef<Set<string>>(new Set());

  // ==================== CORE DATA LOADER ====================

  const loadCourses = useCallback(async (
    opts?: { targetTab?: 'available' | 'enrolled'; guaranteedEnrolledCourseId?: string; }
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

      // For enrolled tab: include enrolled courses even if they're expired/hidden
      // We need to fetch enrolled course details that might not be in published list
      const publishedIds = new Set(publishedCourses.map(c => c.id));
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

      // For enrolled courses that are no longer in published list (expired/unpublished),
      // still show them in the enrolled tab so users can access what they paid for.
      // We mark them specially but include them in enrolled view.
      // (Course details would need a separate fetch — skipping here for performance,
      //  the service level already handles this by not filtering enrolled courses.)

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

  // ==================== PAYMENT RETURN HANDLER ====================

  useEffect(() => {
    if (!user?.uid) return;
    if (paymentHandledRef.current) return;

    const params = new URLSearchParams(location.search);
    const tranId =
      params.get('tran_id') || params.get('tranId') ||
      params.get('transaction_id') || params.get('transactionId');
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

  useEffect(() => {
    if (!user?.uid) return;
    loadFavouriteIdsFromFirebase(user.uid).then(ids => {
      savedFavIdsRef.current = ids;
      loadCourses();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ==================== FILTER EFFECT ====================

  useEffect(() => {
    if (allCourses.length === 0) return;
    const opts = filterOptsRef.current;
    setAvailableCourses(buildFilteredCourses(allCourses, 'available', opts));
    setEnrolledCourses(buildFilteredCourses(allCourses, 'enrolled', opts));
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy, allCourses]);

  // ==================== COUPON HELPERS ====================

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

  // ==================== EVENT HANDLERS ====================

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

  // FIREBASE: toggleFavorite persists to Firestore
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

  // ==================== HELPERS ====================

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
      default:             return { cls: 'ce-badge-slate', label: level || 'All Levels' };
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isDateExpired = (dateString: string) => {
    const d = new Date(dateString);
    return !isNaN(d.getTime()) && d < new Date();
  };

  const clearMessages = () => { setError(''); setSuccess(''); setWarning(''); };

  const closeEnrollmentModal = () => {
    setShowEnrollmentModal(false);
    setEnrollmentData(null);
    resetCouponInput();
    clearMessages();
  };

  const favouriteCount = allCourses.filter(c => !c.isEnrolled && c.isFavorite).length;

  // ==================== FILTER SELECT OPTIONS ====================

  const categoryOptions: SelectOption[] = [
    { value: 'all', label: 'All Categories' },
    { value: '__favorites__', label: `Saved Courses${favouriteCount > 0 ? ` (${favouriteCount})` : ''}` },
    ...categories.map(c => ({ value: c, label: c })),
  ];
  const classOptions: SelectOption[] = [
    { value: 'all', label: 'All Classes' },
    ...classes.map(c => ({ value: c, label: c })),
  ];
  const levelOptions: SelectOption[] = [
    { value: 'all', label: 'All Levels' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];
  const priceOptions: SelectOption[] = [
    { value: 'all', label: 'Any Price' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
    { value: 'under1000', label: 'Under ৳1,000' },
    { value: 'under5000', label: 'Under ৳5,000' },
  ];
  const sortOptions: SelectOption[] = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'newest', label: 'Newest First' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
  ];

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

  // ==================== LOADING STATE ====================

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

    // FIX #10: Only show extra discount info if NOT expired
    const hasValidExtraDiscount = course.extraDiscount && course.extraDiscount > 0 &&
      course.extraDiscountValidUntil && !isDateExpired(course.extraDiscountValidUntil);
    const effectivePrice = hasValidExtraDiscount
      ? Math.max(0, course.price - (course.extraDiscount || 0))
      : course.price;

    return (
      <article className={`ce-card${viewMode === 'list' ? ' ce-card--list' : ''}`}>
        {/* Thumbnail */}
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

          {/* FIX #7: Bookmark icon instead of Heart; FIX #1: no SALE badge when discount active */}
          {!isEnrolled && (
            <button
              className={`ce-fav${course.isFavorite ? ' ce-fav--on' : ''}`}
              onClick={e => { e.stopPropagation(); toggleFavorite(course.id); }}
              aria-label={course.isFavorite ? 'Remove from saved' : 'Save course'}
              title={course.isFavorite ? 'Remove from saved' : 'Save course'}
            >
              <Bookmark size={14} fill={course.isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}

          <span className={`ce-tbadge ce-tbadge-bl ce-level ${lvl.cls}`}>{lvl.label}</span>
        </div>

        {/* Body */}
        <div className="ce-card-body">
          {/* FIX #2: Removed rating row — only show student count */}
          <div className="ce-meta-row">
            <span className="ce-dim ce-students"><Users size={12} />{course.studentCount.toLocaleString()} students</span>
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

          {/* FIX #1: no SALE badge, just show discount price cleanly; FIX #10: only if not expired */}
          {!isEnrolled && (
            <div className="ce-price-row">
              {hasValidExtraDiscount ? (
                <div className="ce-price-group">
                  <span className="ce-price-original">৳{course.price.toLocaleString()}</span>
                  <span className="ce-price">৳{effectivePrice.toLocaleString()}</span>
                </div>
              ) : (
                <p className="ce-price">{course.price === 0 ? 'Free' : `৳${course.price.toLocaleString()}`}</p>
              )}
            </div>
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
  // ce-overlay--top ensures modal never clips behind fixed app header

  const CourseOverviewModal = () => {
    if (!selectedCourse) return null;
    const isEnrolled = selectedCourse.isEnrolled;
    const routineFilesByCategory = selectedCourse.routineFiles?.reduce((acc, file) => {
      if (!acc[file.category]) acc[file.category] = [];
      acc[file.category].push(file);
      return acc;
    }, {} as Record<string, typeof selectedCourse.routineFiles>);

    const closeModal = () => { setShowCourseModal(false); setSelectedCourse(null); };

    // FIX #10: only show extra discount section if NOT expired
    const hasValidExtraDiscount = selectedCourse.extraDiscount && selectedCourse.extraDiscount > 0 &&
      selectedCourse.extraDiscountValidUntil && !isDateExpired(selectedCourse.extraDiscountValidUntil);

    return (
      <div className="ce-overlay ce-overlay--top" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        {/* FIX #9: modal uses flex column with proper overflow to avoid cutoff */}
        <div className="ce-modal ce-modal--wide" role="dialog" aria-modal="true" aria-labelledby="overview-title">
          {/* Header */}
          <div className="ce-modal-head">
            <div style={{ minWidth: 0 }}>
              <p className="ce-eyebrow">Course Overview</p>
              <h2 className="ce-modal-h" id="overview-title">{selectedCourse.title}</h2>
            </div>
            <button className="ce-modal-x" onClick={closeModal} aria-label="Close"><X size={20} /></button>
          </div>

          {/* Body — FIX #9: overflow-y:auto with flex:1 and min-height:0 */}
          <div className="ce-modal-body">
            {/* Hero image */}
            {selectedCourse.thumbnail && (
              <div className="ce-modal-hero">
                <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="ce-modal-hero-img" />
              </div>
            )}

            {/* Description */}
            {selectedCourse.description && (
              <p className="ce-modal-desc">{selectedCourse.description}</p>
            )}

            {/* Info grid — FIX #12: removed duration cell */}
            <div className="ce-ov-grid">
              {selectedCourse.class && (
                <div className="ce-ov-cell">
                  <p className="ce-ov-label">Class</p>
                  <p className="ce-ov-val">{selectedCourse.class}</p>
                </div>
              )}
              {selectedCourse.category && (
                <div className="ce-ov-cell">
                  <p className="ce-ov-label">Category</p>
                  <p className="ce-ov-val">{selectedCourse.category}</p>
                </div>
              )}
              {selectedCourse.level && selectedCourse.level !== 'unspecified' && (
                <div className="ce-ov-cell">
                  <p className="ce-ov-label">Level</p>
                  <span className={`ce-level ${getLevelStyle(selectedCourse.level).cls}`} style={{ display: 'inline-flex', marginTop: '4px' }}>
                    {getLevelStyle(selectedCourse.level).label}
                  </span>
                </div>
              )}
              {/* FIX #12: Duration cell REMOVED */}
              {selectedCourse.studentCount > 0 && (
                <div className="ce-ov-cell">
                  <p className="ce-ov-label">Students</p>
                  <p className="ce-ov-val" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Users size={14} style={{ color: '#818cf8' }} />{selectedCourse.studentCount.toLocaleString()}
                  </p>
                </div>
              )}
              {/* FIX #2: Rating cell REMOVED from overview */}
            </div>

            {/* Special features */}
            {(selectedCourse.hasAiQnA || selectedCourse.hasHumanQnA || selectedCourse.hasStudyPlanner) && (
              <div className="ce-ov-cell" style={{ background: 'var(--ce-s2)', padding: '1rem', borderRadius: 'var(--ce-r)' }}>
                <p className="ce-ov-label" style={{ marginBottom: '0.625rem' }}>Special Features</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedCourse.hasAiQnA && (
                    <span className="ce-feature-badge ce-feature-badge--blue"><Sparkles size={12} />AI Q&A Support</span>
                  )}
                  {selectedCourse.hasHumanQnA && (
                    <span className="ce-feature-badge ce-feature-badge--purple"><Users size={12} />Human Q&A Support</span>
                  )}
                  {selectedCourse.hasStudyPlanner && (
                    <span className="ce-feature-badge ce-feature-badge--teal"><CalendarCheck size={12} />Study Planner</span>
                  )}
                </div>
              </div>
            )}

            {/* Pricing — FIX #10: extra discount only shown if NOT expired */}
            <div className="ce-ov-price-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--ce-tx2)', fontSize: '0.875rem' }}>Course Price</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--ce-tx)', lineHeight: 1 }}>
                  {selectedCourse.price === 0 ? (
                    <span style={{ color: '#34d399' }}>Free</span>
                  ) : `৳${selectedCourse.price.toLocaleString()}`}
                </span>
              </div>

              {/* Previous student discount */}
              {selectedCourse.previousStudentDiscount && selectedCourse.previousStudentDiscount > 0 && (
                <div className="ce-ov-discount-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span className="ce-ov-disc-icon ce-ov-disc-icon--green">
                      <CheckCircle size={11} />
                    </span>
                    <span style={{ color: 'var(--ce-tx2)', fontSize: '0.84rem' }}>Previous Student Discount</span>
                    <span className="ce-ov-disc-label ce-ov-disc-label--green">Eligible users only</span>
                  </div>
                  <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.9rem' }}>
                    -৳{selectedCourse.previousStudentDiscount.toLocaleString()}
                  </span>
                </div>
              )}

              {/* FIX #10: Extra discount — ONLY show if NOT expired */}
              {hasValidExtraDiscount && selectedCourse.extraDiscount && (
                <div className="ce-ov-discount-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <span className="ce-ov-disc-icon ce-ov-disc-icon--amber">
                      <Tag size={11} />
                    </span>
                    <span style={{ color: 'var(--ce-tx2)', fontSize: '0.84rem' }}>Limited Time Discount</span>
                    {selectedCourse.extraDiscountValidUntil && (
                      <span className="ce-ov-disc-label ce-ov-disc-label--amber">
                        Valid until {formatDate(selectedCourse.extraDiscountValidUntil)}
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.9rem' }}>
                    -৳{selectedCourse.extraDiscount.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Effective price after active discount */}
              {hasValidExtraDiscount && selectedCourse.extraDiscount && (
                <div style={{ paddingTop: '0.625rem', borderTop: '1px solid var(--ce-bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--ce-tx2)', fontSize: '0.84rem' }}>After Discount</span>
                  <span style={{ color: '#34d399', fontWeight: 700, fontSize: '1.1rem' }}>
                    ৳{Math.max(0, selectedCourse.price - selectedCourse.extraDiscount).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Course validity */}
            {selectedCourse.validity && (
              <div className="ce-ov-cell" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <CalendarCheck size={16} style={{ color: '#818cf8', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p className="ce-ov-label">Course Available Until</p>
                  <p className="ce-ov-val" style={{ marginTop: '2px' }}>{formatDate(selectedCourse.validity)}</p>
                  {isDateExpired(selectedCourse.validity) && (
                    <p style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '3px' }}>This course's enrollment period has ended.</p>
                  )}
                </div>
              </div>
            )}

            {/* Subjects / Tags */}
            {selectedCourse.subjects && selectedCourse.subjects.length > 0 && (
              <div className="ce-ov-cell">
                <p className="ce-ov-label" style={{ marginBottom: '0.5rem' }}>Subjects</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {selectedCourse.subjects.map((s, i) => (
                    <span key={i} className="ce-chip">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedCourse.tags && selectedCourse.tags.length > 0 && (
              <div className="ce-ov-cell">
                <p className="ce-ov-label" style={{ marginBottom: '0.5rem' }}>Tags</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {selectedCourse.tags.map((t, i) => (
                    <span key={i} className="ce-tag-badge">
                      <Tag size={10} />{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Requirements */}
            {selectedCourse.requirements && selectedCourse.requirements.length > 0 && (
              <div className="ce-ov-cell">
                <p className="ce-ov-label" style={{ marginBottom: '0.625rem' }}>Requirements</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedCourse.requirements.filter(r => r.trim()).map((req, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--ce-tx2)', fontSize: '0.875rem' }}>
                      <CheckCircle size={15} style={{ color: '#818cf8', marginTop: '2px', flexShrink: 0 }} />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What you'll learn */}
            {selectedCourse.whatYouWillLearn && selectedCourse.whatYouWillLearn.length > 0 && (
              <div className="ce-ov-cell">
                <p className="ce-ov-label" style={{ marginBottom: '0.625rem' }}>What You Will Learn</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedCourse.whatYouWillLearn.filter(w => w.trim()).map((item, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--ce-tx2)', fontSize: '0.875rem' }}>
                      <Award size={15} style={{ color: '#34d399', marginTop: '2px', flexShrink: 0 }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Downloadable files */}
            {routineFilesByCategory && Object.keys(routineFilesByCategory).length > 0 && (
              <div className="ce-ov-cell">
                <p className="ce-ov-label" style={{ marginBottom: '0.75rem' }}>Downloadable Files</p>
                {Object.entries(routineFilesByCategory).map(([category, files]) => (
                  <div key={category} style={{ marginBottom: '0.875rem' }}>
                    <p style={{ color: 'var(--ce-tx)', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.375rem', textTransform: 'capitalize' }}>{category}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {files?.map(file => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ce-file-link"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={15} style={{ color: '#818cf8' }} />
                            <span>{file.fileName}</span>
                          </div>
                          <Download size={15} style={{ color: 'var(--ce-tx3)' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="ce-modal-foot">
            {isEnrolled ? (
              <button
                className="ce-cta-btn ce-cta-btn--primary"
                onClick={() => { closeModal(); handleContinueLearning(selectedCourse.id); }}
              >
                <Play size={18} /><span>Continue Learning</span>
              </button>
            ) : (
              <button
                className="ce-cta-btn ce-cta-btn--enroll"
                onClick={() => { closeModal(); handleEnrollClick(selectedCourse); }}
                disabled={calculatingPrice}
              >
                {calculatingPrice
                  ? <><Loader size={18} className="animate-spin" /><span>Calculating price…</span></>
                  : <><ShoppingCart size={18} /><span>Enroll Now{selectedCourse.price > 0 ? ` — ৳${selectedCourse.price.toLocaleString()}` : ' — Free'}</span></>
                }
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
      <div className="ce-overlay" onClick={e => { if (e.target === e.currentTarget && !enrolling) closeEnrollmentModal(); }}>
        <div className="ce-modal ce-modal--narrow" role="dialog" aria-modal="true">
          <div className="ce-modal-head">
            <div>
              <p className="ce-eyebrow">Complete Enrollment</p>
              <h2 className="ce-modal-h-sm">{course.title}</h2>
              {course.class && <p style={{ color: 'var(--ce-tx2)', fontSize: '0.82rem', marginTop: '3px' }}>{course.class}</p>}
            </div>
            <button className="ce-modal-x" onClick={closeEnrollmentModal} disabled={enrolling} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="ce-modal-body">
            {/* Price breakdown */}
            <div className="ce-price-breakdown">
              <div className="ce-pb-row">
                <span className="ce-pb-label">Base Price</span>
                <span className="ce-pb-val">৳{calculation.basePrice.toLocaleString()}</span>
              </div>

              {calculation.previousStudentDiscount > 0 && (
                <div className="ce-pb-row">
                  <span className="ce-pb-label">
                    <Percent size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Previous Student
                  </span>
                  <span className="ce-pb-discount">-৳{calculation.previousStudentDiscount.toLocaleString()}</span>
                </div>
              )}

              {/* FIX #10: Only show extra discount in breakdown if it is valid (not expired) */}
              {calculation.extraDiscount > 0 && calculation.isExtraDiscountValid && (
                <div className="ce-pb-row">
                  <span className="ce-pb-label">
                    <Tag size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Limited Time
                  </span>
                  <span className="ce-pb-discount">-৳{calculation.extraDiscount.toLocaleString()}</span>
                </div>
              )}

              {appliedCoupons.map(ac => (
                <div key={ac.couponCode} className="ce-pb-row">
                  <span className="ce-pb-label">
                    <Ticket size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                    Coupon
                    <code className="ce-coupon-code">{ac.couponCode}</code>
                  </span>
                  <span className="ce-pb-discount">-৳{ac.discount.toLocaleString()}</span>
                </div>
              ))}

              {calculation.totalDiscount > 0 && (
                <div className="ce-pb-row ce-pb-row--savings">
                  <span>Total Savings</span>
                  <span className="ce-pb-savings">৳{calculation.totalDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="ce-pb-row ce-pb-row--final">
                <span>Final Price</span>
                <span className="ce-pb-final">
                  {calculation.finalPrice === 0 ? 'Free' : `৳${calculation.finalPrice.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* Previous student discount info */}
            {calculation.hasPreviousEnrollments && calculation.previousStudentDiscount > 0 && (
              <div className="ce-discount-badge-box">
                <CheckCircle size={15} style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#4ade80', fontWeight: 600 }}>Previous Student Discount Applied!</p>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(134,239,172,0.75)', marginTop: '2px' }}>
                    Saving ৳{calculation.previousStudentDiscount.toLocaleString()} as a returning student.
                  </p>
                </div>
              </div>
            )}

            {/* Coupon section */}
            <div className="ce-coupon-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Ticket size={15} style={{ color: 'var(--ce-tx2)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ce-tx)' }}>
                  Coupon Codes
                  {appliedCoupons.length > 0 && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 400, color: '#818cf8' }}>{appliedCoupons.length} applied</span>
                  )}
                </span>
              </div>

              {/* Applied coupons list */}
              {appliedCoupons.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.5rem' }}>
                  {appliedCoupons.map(ac => (
                    <div key={ac.couponCode} className="ce-applied-coupon">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                        <CheckCircle size={14} style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '0.875rem', color: '#4ade80', fontWeight: 600 }}>
                            <code style={{ fontFamily: 'monospace' }}>{ac.couponCode}</code>
                            <span style={{ fontWeight: 400, color: 'rgba(134,239,172,0.75)', marginLeft: '0.5rem' }}>
                              — saving ৳{ac.discount.toLocaleString()}
                            </span>
                          </p>
                          {ac.successMessage && (
                            <p style={{ fontSize: '0.72rem', color: 'rgba(134,239,172,0.65)', marginTop: '2px', overflowWrap: 'break-word' }}>{ac.successMessage}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCoupon(ac.couponCode, enrollmentData)}
                        disabled={enrolling || couponInput.fieldState === 'checking'}
                        className="ce-coupon-remove"
                        title={`Remove ${ac.couponCode}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Coupon input row */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={localCode}
                    onChange={e => {
                      const val = e.target.value.toUpperCase().replace(/\s/g, '');
                      setLocalCode(val);
                      if (couponInput.fieldState === 'error') setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' }));
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={appliedCoupons.length > 0 ? 'Add another coupon' : 'Enter coupon code'}
                    maxLength={30}
                    disabled={couponInput.fieldState === 'checking' || enrolling}
                    className="ce-coupon-input"
                    style={{ borderColor: couponInput.fieldState === 'error' ? 'rgba(239,68,68,0.6)' : undefined }}
                  />
                  {localCode && couponInput.fieldState !== 'checking' && (
                    <button
                      onClick={() => { setLocalCode(''); setCouponInput(prev => ({ ...prev, fieldState: 'idle', errorMessage: '' })); inputRef.current?.focus(); }}
                      className="ce-coupon-input-clear"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleAddCoupon}
                  disabled={!localCode.trim() || couponInput.fieldState === 'checking' || enrolling}
                  className="ce-btn ce-btn--enroll ce-coupon-apply"
                  style={{ flex: 'none', padding: '0 1rem', gap: '0.375rem', minWidth: '80px' }}
                >
                  {couponInput.fieldState === 'checking'
                    ? <><Loader size={14} className="animate-spin" />Checking</>
                    : <><Plus size={14} />Apply</>
                  }
                </button>
              </div>

              {couponInput.fieldState === 'error' && couponInput.errorMessage && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', color: '#f87171', marginTop: '0.375rem' }}>
                  <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.75rem' }}>{couponInput.errorMessage}</p>
                </div>
              )}

              {couponInput.fieldState === 'idle' && !localCode && (
                <p style={{ fontSize: '0.73rem', color: 'var(--ce-tx3)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.375rem' }}>
                  <Info size={11} />
                  {appliedCoupons.length > 0
                    ? 'You can stack multiple coupon codes — each validated separately.'
                    : 'Have a promotional or discount code? Enter it above.'}
                </p>
              )}
            </div>

            {/* Error / warning notices */}
            {error && (
              <div className="ce-notice ce-notice-red ce-notice--row" style={{ borderRadius: 'var(--ce-r)' }}>
                <AlertCircle size={15} className="ce-shrink0" /><span style={{ fontSize: '0.85rem' }}>{error}</span>
              </div>
            )}
            {warning && (
              <div className="ce-notice ce-notice-amber ce-notice--row" style={{ borderRadius: 'var(--ce-r)' }}>
                <AlertTriangle size={15} className="ce-shrink0" /><span style={{ fontSize: '0.85rem' }}>{warning}</span>
              </div>
            )}
          </div>

          {/* Footer — always visible, never scrolls away */}
          <div className="ce-modal-foot">
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={closeEnrollmentModal}
                disabled={enrolling}
                className="ce-btn ce-btn--ghost"
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToPayment}
                disabled={enrolling || couponInput.fieldState === 'checking'}
                className="ce-btn ce-btn--enroll"
                style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem' }}
              >
                {enrolling ? (
                  <><Loader size={18} className="animate-spin" /><span>Processing…</span></>
                ) : calculation.finalPrice === 0 ? (
                  <><Check size={18} /><span>Enroll Free</span></>
                ) : (
                  <><ShoppingCart size={18} /><span>Pay ৳{calculation.finalPrice.toLocaleString()}</span></>
                )}
              </button>
            </div>

            {calculation.finalPrice > 0 && !enrolling && (
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--ce-tx3)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Shield size={11} /> Secure payment via SSLCOMMERZ
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  const displayCourses = activeTab === 'available' ? availableCourses : enrolledCourses;

  const hasActiveFilters = selectedCategory !== 'all' || selectedClass !== 'all' || selectedLevel !== 'all' || priceFilter !== 'all' || sortBy !== 'popular';

  return (
    <>
      <CEStyles />
      <div className="ce-page">

        {/* Page header */}
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
                title="Toggle saved courses filter"
              >
                <Bookmark size={13} fill={selectedCategory === '__favorites__' ? 'currentColor' : 'none'} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <AlertCircle size={16} className="ce-shrink0" /><span style={{ fontSize: '0.875rem' }}>{error}</span>
              </div>
              <button className="ce-notice-close" onClick={clearMessages}><X size={14} /></button>
            </div>
          )}
          {success && (
            <div className="ce-notice ce-notice-green ce-notice--row ce-notice--dismissible">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <CheckCircle size={16} className="ce-shrink0" /><span style={{ fontSize: '0.875rem' }}>{success}</span>
              </div>
              <button className="ce-notice-close" onClick={clearMessages}><X size={14} /></button>
            </div>
          )}
          {warning && (
            <div className="ce-notice ce-notice-amber ce-notice--row ce-notice--dismissible">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <AlertTriangle size={16} className="ce-shrink0" /><span style={{ fontSize: '0.875rem' }}>{warning}</span>
              </div>
              <button className="ce-notice-close" onClick={clearMessages}><X size={14} /></button>
            </div>
          )}
        </div>

        {/* Tab bar + view toggle */}
        <div className="ce-tab-bar">
          <nav className="ce-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'available'}
              className={`ce-tab${activeTab === 'available' ? ' ce-tab--on' : ''}`}
              onClick={() => setActiveTab('available')}
            >
              <BookOpen size={13} />Available<span className="ce-tab-ct">{availableCourses.length}</span>
            </button>
            {/* FIX #3: Saved tab now same size/padding as the others */}
            <button
              role="tab"
              aria-selected={false}
              className={`ce-tab${selectedCategory === '__favorites__' ? ' ce-tab--on' : ''}`}
              onClick={() => setSelectedCategory(v => v === '__favorites__' ? 'all' : '__favorites__')}
            >
              <Bookmark size={13} />Saved{favouriteCount > 0 && <span className="ce-tab-ct">{favouriteCount}</span>}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'enrolled'}
              className={`ce-tab${activeTab === 'enrolled' ? ' ce-tab--on' : ''}`}
              onClick={() => setActiveTab('enrolled')}
            >
              <GraduationCap size={13} />Enrolled<span className="ce-tab-ct">{enrolledCourses.length}</span>
            </button>
          </nav>
          {/* View toggle — hidden on mobile (fix 3) */}
          <div className="ce-view-toggle ce-view-toggle--desktop" role="group" aria-label="View mode">
            <button
              aria-label="Grid view" aria-pressed={viewMode === 'grid'}
              className={`ce-view-btn${viewMode === 'grid' ? ' ce-view-btn--on' : ''}`}
              onClick={() => setViewMode('grid')}
            ><Grid3X3 size={14} /></button>
            <button
              aria-label="List view" aria-pressed={viewMode === 'list'}
              className={`ce-view-btn${viewMode === 'list' ? ' ce-view-btn--on' : ''}`}
              onClick={() => setViewMode('list')}
            ><List size={14} /></button>
          </div>
        </div>

        {/* FIX #8: Filters — always visible on desktop, togglable on mobile */}
        <div className={`ce-filters${mobileFiltersOpen ? ' ce-filters--open' : ''}`}>
          {/* Search row — filter icon is INSIDE this row on mobile (fix 4) */}
          <div className="ce-search-row">
            <div className="ce-search-wrap">
              <Search size={14} className="ce-search-icon" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search courses"
                placeholder="Search courses, instructors, topics…"
                className="ce-search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="ce-search-x" onClick={() => setSearchTerm('')} aria-label="Clear search"><X size={12} /></button>
              )}
            </div>
            {/* FIX #4: Filter icon right of search bar, only visible on mobile */}
            <button
              className={`ce-filter-toggle${mobileFiltersOpen ? ' ce-filter-toggle--on' : ''}${hasActiveFilters ? ' ce-filter-toggle--active' : ''}`}
              onClick={() => setMobileFiltersOpen(v => !v)}
              aria-label="Toggle filters"
              title="Filters"
            >
              <SlidersHorizontal size={14} />
              {hasActiveFilters && <span className="ce-filter-dot" />}
            </button>
          </div>

          {/* Filter dropdowns — hidden on mobile until filter btn clicked */}
          <div className="ce-filter-dropdowns">
            {/* FIX #4 & #5: Custom professional dropdowns, no emojis */}
            <CustomSelect
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categoryOptions}
              ariaLabel="Filter by category"
            />
            <CustomSelect
              value={selectedClass}
              onChange={setSelectedClass}
              options={classOptions}
              ariaLabel="Filter by class"
            />
            <CustomSelect
              value={selectedLevel}
              onChange={setSelectedLevel}
              options={levelOptions}
              ariaLabel="Filter by level"
            />
            <CustomSelect
              value={priceFilter}
              onChange={setPriceFilter}
              options={priceOptions}
              ariaLabel="Filter by price"
            />
            <CustomSelect
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
              ariaLabel="Sort courses"
            />
          </div>
        </div>

        {/* Active favourite filter strip */}
        {selectedCategory === '__favorites__' && (
          <div className="ce-fav-strip">
            <Bookmark size={13} fill="currentColor" />
            <span>Showing saved courses only</span>
            <button className="ce-fav-strip-clear" onClick={() => setSelectedCategory('all')}><X size={11} />Clear</button>
          </div>
        )}

        {/* Course grid / list */}
        {loading ? (
          <div className="ce-iloader">
            <Loader size={22} className="animate-spin" style={{ color: 'var(--ce-blue)' }} />
            <span>Refreshing…</span>
          </div>
        ) : displayCourses.length === 0 ? (
          <div className="ce-empty" role="status">
            <div className="ce-empty-icon">
              {selectedCategory === '__favorites__' ? <Bookmark size={30} />
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
                ? 'Tap the bookmark on any course card to save it here.'
                : activeTab === 'available'
                  ? 'Try adjusting your search or filters.'
                  : 'Explore available courses and start your learning journey!'}
            </p>
            {activeTab === 'enrolled' && (
              <button className="ce-btn ce-btn--primary" style={{ marginTop: '1.25rem' }} onClick={() => setActiveTab('available')}>
                <BookOpen size={14} />Browse Courses
              </button>
            )}
          </div>
        ) : (
          // FIX #6: list view uses proper flex-column always, list item is row only on >=560px via CSS
          <div className={viewMode === 'grid' ? 'ce-grid' : 'ce-list'} role="list">
            {displayCourses.map(course => (
              <div role="listitem" key={course.id}><CourseCard course={course} /></div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
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

    /* ── Page layout ──────────────────────────────────────────────── */
    .ce-page{display:flex;flex-direction:column;gap:1.125rem;padding-bottom:3rem;min-width:0}

    /* ── Page header ──────────────────────────────────────────────── */
    .ce-header{display:flex;align-items:flex-start;justify-content:space-between;gap:.875rem;flex-wrap:wrap}
    .ce-page-h{font-size:clamp(1.3rem,4vw,1.65rem);font-weight:700;color:var(--ce-tx);letter-spacing:-.02em;line-height:1.2;margin:0}
    .ce-page-sub{font-size:.82rem;color:var(--ce-tx2);margin-top:4px}

    /* ── Header pills ─────────────────────────────────────────────── */
    .ce-header-pills{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
    .ce-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:var(--ce-s2);border:1px solid var(--ce-bd);border-radius:40px;font-size:.78rem;color:var(--ce-tx2);white-space:nowrap;cursor:default;user-select:none}
    .ce-pill strong{color:var(--ce-tx);font-weight:600;margin-right:1px}
    .ce-pill--blue{border-color:var(--ce-blue-bd);color:#60a5fa}
    .ce-pill--blue strong{color:#60a5fa}
    .ce-pill--fav{cursor:pointer;border-color:var(--ce-rose-bd);color:#fb7185;background:transparent;transition:all .18s;font-family:inherit;border:1px solid}
    .ce-pill--fav:hover{background:var(--ce-rose-bg);transform:scale(1.03)}
    .ce-pill--fav strong{color:#fb7185}
    .ce-pill--fav-on{background:var(--ce-rose-bg);border-color:var(--ce-rose);color:var(--ce-rose)}
    .ce-pill--fav-on strong{color:var(--ce-rose)}

    /* ── Favourite strip ─────────────────────────────────────────── */
    .ce-fav-strip{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--ce-rose-bg);border:1px solid var(--ce-rose-bd);border-radius:var(--ce-r);font-size:.82rem;color:#fb7185;animation:ce-fadein .2s ease}
    @keyframes ce-fadein{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    .ce-fav-strip-clear{display:inline-flex;align-items:center;gap:4px;margin-left:auto;background:transparent;border:1px solid var(--ce-rose-bd);color:#fb7185;border-radius:6px;padding:3px 9px;font-size:.75rem;cursor:pointer;font-family:inherit;transition:background .15s}
    .ce-fav-strip-clear:hover{background:rgba(244,63,94,.18)}

    /* ── Notices ─────────────────────────────────────────────────── */
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

    /* ── Tab bar ─────────────────────────────────────────────────── */
    .ce-tab-bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border-bottom:1px solid var(--ce-bd);flex-wrap:wrap;padding-bottom:0}
    .ce-tabs{display:flex;flex:1;min-width:0}
    /* FIX #3: all tabs identical sizing, no flex difference */
    .ce-tab{display:inline-flex;align-items:center;gap:6px;padding:.75rem 1.1rem;font-size:.855rem;font-weight:500;color:var(--ce-tx2);border:none;border-bottom:2px solid transparent;margin-bottom:-1px;background:transparent;cursor:pointer;transition:color .18s,border-color .18s;white-space:nowrap;line-height:1;font-family:inherit}
    .ce-tab:hover{color:var(--ce-tx)}
    .ce-tab--on{color:var(--ce-blue);border-bottom-color:var(--ce-blue)}
    .ce-tab-ct{background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx2);border-radius:40px;padding:2px 8px;font-size:.68rem;font-weight:600;line-height:1.4}
    .ce-tab--on .ce-tab-ct{background:var(--ce-blue-bg);border-color:var(--ce-blue-bd);color:var(--ce-blue)}

    /* ── Filter toggle button (mobile only — lives inside search row) ── */
    .ce-filter-toggle{
      display:none;
      align-items:center;justify-content:center;
      width:38px;height:38px;border-radius:9px;
      background:var(--ce-s2);border:1px solid var(--ce-bd);
      color:var(--ce-tx2);cursor:pointer;
      transition:all .18s;font-family:inherit;
      position:relative;flex-shrink:0
    }
    .ce-filter-toggle:hover{border-color:var(--ce-bd2);color:var(--ce-tx);background:var(--ce-s3)}
    .ce-filter-toggle--on{background:var(--ce-blue-bg);border-color:var(--ce-blue-bd);color:var(--ce-blue)}
    .ce-filter-dot{
      position:absolute;top:6px;right:6px;
      width:7px;height:7px;border-radius:50%;
      background:var(--ce-blue);border:2px solid var(--ce-s2)
    }
    .ce-filter-toggle--active:not(.ce-filter-toggle--on){border-color:var(--ce-blue-bd);color:var(--ce-blue)}
    /* Show filter icon only on mobile, hidden on desktop (desktop always shows dropdowns) */
    @media(max-width:767px){.ce-filter-toggle{display:flex}}

    /* ── View toggle — hidden on mobile (fix 3) ─────────────────── */
    .ce-view-toggle{display:flex;gap:3px;padding:3px;background:var(--ce-s2);border:1px solid var(--ce-bd);border-radius:var(--ce-r)}
    /* Hide on mobile */
    .ce-view-toggle--desktop{display:none}
    @media(min-width:768px){.ce-view-toggle--desktop{display:flex}}
    .ce-view-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:7px;border:none;background:transparent;color:var(--ce-tx3);cursor:pointer;transition:all .18s;font-family:inherit}
    .ce-view-btn:hover{color:var(--ce-tx2);background:var(--ce-s3)}
    .ce-view-btn--on{background:var(--ce-blue);color:#fff}
    .ce-view-btn--on:hover{background:var(--ce-blue-h)}

    /* ── Filters panel ─────────────────────────────────────────── */
    .ce-filters{
      display:flex;flex-direction:column;gap:.6rem;
      background:var(--ce-s1);border:1px solid var(--ce-bd);border-radius:var(--ce-rl);padding:.9rem
    }
    .ce-search-row{display:flex;gap:.5rem;align-items:center}
    .ce-search-wrap{position:relative;flex:1}
    .ce-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ce-tx3);pointer-events:none}
    .ce-search{width:100%;box-sizing:border-box;background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx);border-radius:var(--ce-r);padding:9px 32px 9px 34px;font-size:.85rem;outline:none;transition:border-color .18s,box-shadow .18s;font-family:inherit}
    .ce-search::placeholder{color:var(--ce-tx3)}
    .ce-search:focus{border-color:var(--ce-blue);box-shadow:0 0 0 3px var(--ce-blue-bg)}
    .ce-search-x{position:absolute;right:9px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--ce-tx3);cursor:pointer;padding:3px;font-family:inherit;transition:color .15s}
    .ce-search-x:hover{color:var(--ce-tx2)}

    /* Filter dropdowns grid */
    .ce-filter-dropdowns{display:grid;gap:.5rem;grid-template-columns:1fr 1fr}
    @media(min-width:640px){.ce-filter-dropdowns{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:1024px){.ce-filter-dropdowns{grid-template-columns:repeat(5,1fr)}}

    /* FIX #8: on mobile, hide filter dropdowns unless open */
    @media(max-width:767px){
      .ce-filter-dropdowns{display:none}
      .ce-filters--open .ce-filter-dropdowns{display:grid}
    }

    /* ── Custom select ──────────────────────────────────────────── */
    .ce-custom-sel{position:relative;min-width:0}
    .ce-custom-sel-trigger{
      width:100%;display:flex;align-items:center;justify-content:space-between;gap:.5rem;
      background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx);
      border-radius:var(--ce-r);padding:9px 10px;font-size:.84rem;
      outline:none;cursor:pointer;font-family:inherit;
      transition:border-color .18s,box-shadow .18s
    }
    .ce-custom-sel-trigger:hover{border-color:var(--ce-bd2)}
    .ce-custom-sel-trigger--open{border-color:var(--ce-blue);box-shadow:0 0 0 3px var(--ce-blue-bg)}
    .ce-custom-sel-val{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ce-custom-sel-chevron{color:var(--ce-tx3);flex-shrink:0;transition:transform .18s}
    .ce-custom-sel-chevron--up{transform:rotate(180deg)}
    .ce-custom-sel-dropdown{
      position:absolute;top:calc(100% + 5px);left:0;right:0;
      background:var(--ce-s2);border:1px solid var(--ce-bd2);
      border-radius:var(--ce-r);
      z-index:200;
      overflow:hidden;
      box-shadow:0 8px 28px rgba(0,0,0,.45);
      animation:ce-fadein .12s ease
    }
    .ce-custom-sel-opt{
      width:100%;display:flex;align-items:center;gap:.5rem;
      padding:.625rem .875rem;font-size:.84rem;color:var(--ce-tx2);
      background:transparent;border:none;cursor:pointer;text-align:left;font-family:inherit;
      transition:background .12s,color .12s
    }
    .ce-custom-sel-opt:hover{background:var(--ce-s3);color:var(--ce-tx)}
    .ce-custom-sel-opt--on{color:var(--ce-blue);background:var(--ce-blue-bg);font-weight:500}
    .ce-custom-sel-check{flex-shrink:0;color:var(--ce-blue)}

    /* ── Grid & List ─────────────────────────────────────────────── */
    .ce-grid{display:grid;grid-template-columns:1fr;gap:1.125rem}
    @media(min-width:560px){.ce-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:1024px){.ce-grid{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:1400px){.ce-grid{grid-template-columns:repeat(4,1fr)}}

    /* FIX #6: List view works on mobile — always column, row only on ≥560px */
    .ce-list{display:flex;flex-direction:column;gap:.75rem}
    .ce-card--list{flex-direction:column}
    @media(min-width:560px){
      .ce-card--list{flex-direction:row}
      .ce-card--list .ce-card-thumb{width:210px;min-width:210px;height:auto;min-height:140px;flex-shrink:0}
      .ce-card--list .ce-card-body{flex:1;min-width:0}
    }

    /* ── Card ─────────────────────────────────────────────────────── */
    .ce-card{display:flex;flex-direction:column;background:var(--ce-s1);border:1px solid var(--ce-bd);border-radius:var(--ce-rl);overflow:hidden;transition:transform .25s,border-color .25s,box-shadow .25s;box-shadow:var(--ce-sh)}
    .ce-card:hover{transform:translateY(-3px);border-color:var(--ce-bd2);box-shadow:0 12px 36px rgba(0,0,0,.42)}

    /* ── Thumbnail ───────────────────────────────────────────────── */
    .ce-card-thumb{position:relative;overflow:hidden;height:192px;flex-shrink:0}
    .ce-card-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
    .ce-card:hover .ce-card-img{transform:scale(1.04)}
    .ce-card-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#181f2e,#0e1319);color:var(--ce-tx3)}
    .ce-card-shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.52) 0%,transparent 55%);pointer-events:none}

    /* ── Thumb badges ─────────────────────────────────────────────── */
    .ce-tbadge{position:absolute;display:inline-flex;align-items:center;gap:4px;font-size:.63rem;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:.02em}
    .ce-tbadge-tl{top:9px;left:9px}
    .ce-tbadge-bl{bottom:9px;left:9px}
    .ce-badge-enrolled{background:rgba(16,185,129,.82);color:#fff;backdrop-filter:blur(4px)}
    .ce-badge-free{background:var(--ce-blue);color:#fff;backdrop-filter:blur(4px)}

    /* FIX #7: Bookmark/save button instead of heart */
    .ce-fav{
      position:absolute;top:9px;right:9px;
      width:32px;height:32px;border-radius:8px;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.55);
      border:1px solid rgba(255,255,255,.16);
      color:rgba(255,255,255,.85);
      cursor:pointer;
      backdrop-filter:blur(6px);
      transition:all .22s cubic-bezier(.34,1.56,.64,1);
      font-family:inherit;
      box-shadow:0 2px 8px rgba(0,0,0,.3)
    }
    .ce-fav:hover{
      background:var(--ce-blue);
      border-color:var(--ce-blue);
      color:#fff;
      transform:scale(1.1)
    }
    .ce-fav--on{
      background:var(--ce-blue);
      border-color:var(--ce-blue);
      color:#fff;
      box-shadow:0 0 14px rgba(37,99,235,.45)
    }
    .ce-fav--on:hover{transform:scale(1.1);background:var(--ce-blue-h)}

    /* ── Level badge ──────────────────────────────────────────────── */
    .ce-level{display:inline-flex;align-items:center;font-size:.62rem;font-weight:700;padding:3px 9px;border-radius:20px;text-transform:capitalize;letter-spacing:.02em}
    .ce-badge-green{background:rgba(16,185,129,.14);color:#34d399;border:1px solid rgba(16,185,129,.3)}
    .ce-badge-amber{background:rgba(245,158,11,.14);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
    .ce-badge-rose{background:rgba(239,68,68,.14);color:#f87171;border:1px solid rgba(239,68,68,.3)}
    .ce-badge-slate{background:var(--ce-s3);color:var(--ce-tx2);border:1px solid var(--ce-bd)}

    /* ── Card body ────────────────────────────────────────────────── */
    .ce-card-body{display:flex;flex-direction:column;gap:.45rem;padding:.9rem;flex:1;min-width:0}
    .ce-meta-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    /* FIX #2: removed rating styles — only students */
    .ce-students{display:inline-flex;align-items:center;gap:3px;font-size:.76rem;color:var(--ce-tx2)}
    .ce-sep{color:var(--ce-tx3);font-size:.6rem}
    .ce-card-title{font-size:.9rem;font-weight:600;color:var(--ce-tx);line-height:1.45;cursor:pointer;transition:color .18s;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0}
    .ce-card-title:hover{color:var(--ce-blue)}
    .ce-card-sub{font-size:.76rem;color:var(--ce-tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    /* ── Feature chips ────────────────────────────────────────────── */
    .ce-chips{display:flex;flex-wrap:wrap;gap:4px}
    .ce-chip{display:inline-flex;align-items:center;gap:4px;font-size:.62rem;font-weight:600;color:var(--ce-blue);background:var(--ce-blue-bg);border:1px solid var(--ce-blue-bd);border-radius:20px;padding:2px 8px;white-space:nowrap}

    /* ── Tag badges ───────────────────────────────────────────────── */
    .ce-tag-badge{display:inline-flex;align-items:center;gap:4px;font-size:.62rem;font-weight:500;color:var(--ce-tx2);background:var(--ce-s3);border:1px solid var(--ce-bd);border-radius:20px;padding:2px 8px;white-space:nowrap}

    /* ── Progress bar ─────────────────────────────────────────────── */
    .ce-progress{display:flex;flex-direction:column;gap:4px}
    .ce-progress-labels{display:flex;justify-content:space-between;font-size:.73rem;color:var(--ce-tx2)}
    .ce-progress-labels strong{color:var(--ce-tx);font-weight:600}
    .ce-progress-track{height:5px;border-radius:3px;background:var(--ce-s3);overflow:hidden}
    .ce-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--ce-blue),#60a5fa);transition:width .5s}

    /* ── Price display ────────────────────────────────────────────── */
    .ce-price{font-size:1.15rem;font-weight:700;color:var(--ce-tx);margin-top:auto}
    .ce-price-row{margin-top:auto}
    .ce-price-group{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap}
    .ce-price-original{font-size:.85rem;color:var(--ce-tx3);text-decoration:line-through}
    /* FIX #1: removed .ce-discount-badge (SALE badge) entirely */

    /* ── Card actions ─────────────────────────────────────────────── */
    .ce-card-actions{display:flex;gap:.45rem;margin-top:auto}

    /* ── Buttons ──────────────────────────────────────────────────── */
    .ce-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .2s;padding:8px 13px;line-height:1;white-space:nowrap;font-family:inherit}
    .ce-btn:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
    .ce-btn--ghost{flex:1;background:var(--ce-s2);border:1px solid var(--ce-bd);color:var(--ce-tx2)}
    .ce-btn--ghost:hover:not(:disabled){border-color:var(--ce-bd2);color:var(--ce-tx);background:var(--ce-s3)}
    .ce-btn--primary{flex:1;background:var(--ce-blue);color:#fff;box-shadow:0 2px 10px rgba(37,99,235,.28)}
    .ce-btn--primary:hover:not(:disabled){background:var(--ce-blue-h);transform:translateY(-1px)}
    .ce-btn--enroll{flex:1;background:var(--ce-teal);color:#fff;box-shadow:0 2px 10px rgba(13,148,136,.28)}
    .ce-btn--enroll:hover:not(:disabled){background:var(--ce-teal-h);transform:translateY(-1px)}

    /* ── Empty state ──────────────────────────────────────────────── */
    .ce-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 1.5rem;text-align:center}
    .ce-empty-icon{width:72px;height:72px;border-radius:50%;background:var(--ce-s2);border:1px solid var(--ce-bd);display:flex;align-items:center;justify-content:center;color:var(--ce-tx3);margin-bottom:1.125rem}
    .ce-empty-h{font-size:1.05rem;font-weight:600;color:var(--ce-tx);margin-bottom:.4rem}
    .ce-empty-p{font-size:.85rem;color:var(--ce-tx2);max-width:340px;line-height:1.65}

    /* ── Inline loader ────────────────────────────────────────────── */
    .ce-iloader{display:flex;align-items:center;justify-content:center;gap:10px;padding:3.5rem;color:var(--ce-tx2);font-size:.85rem}

    /* ── Full-screen loader ───────────────────────────────────────── */
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

    /* ── Modals ───────────────────────────────────────────────────── */
    /* ce-overlay--top: pads top by header height so modal never hides behind
       the fixed app navigation header (~64px on desktop, 56px on mobile) */
    .ce-overlay{
      position:fixed;inset:0;
      background:rgba(0,0,0,.72);
      backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;
      /* z-index:9999 so modal always renders ABOVE the fixed app header */
      z-index:9999;padding:1rem;
      overflow:hidden
    }
    .ce-overlay--top{
      align-items:flex-start;
      /* 16px top padding — modal sits just inside the viewport top edge, above everything */
      padding-top:16px
    }
    /* FIX #9: modal must not cut off — proper flex layout with overflow */
    .ce-modal{
      background:#131921;
      border:1px solid var(--ce-bd2);
      border-radius:var(--ce-rxl);
      width:100%;
      box-shadow:var(--ce-sh-lg);
      display:flex;flex-direction:column;
      /* 16px top + 16px bottom padding on overlay = 32px, leave 32px total */
      max-height:calc(100vh - 32px);
      animation:ce-modal-in .22s ease
    }
    .ce-modal--wide{max-width:800px}
    .ce-modal--narrow{max-width:460px;overflow-x:hidden}
    @keyframes ce-modal-in{from{opacity:0;transform:scale(.97) translateY(12px)}to{opacity:1;transform:none}}

    .ce-modal-head{
      display:flex;align-items:flex-start;justify-content:space-between;gap:.875rem;
      padding:1.25rem 1.5rem;
      border-bottom:1px solid var(--ce-bd);
      background:#131921;
      border-radius:var(--ce-rxl) var(--ce-rxl) 0 0;
      position:sticky;top:0;z-index:10;flex-shrink:0
    }
    .ce-eyebrow{font-size:.65rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--ce-blue);margin-bottom:4px}
    .ce-modal-h{font-size:1.25rem;font-weight:700;color:var(--ce-tx);line-height:1.25;word-break:break-word;margin:0}
    .ce-modal-h-sm{font-size:1rem;font-weight:600;color:var(--ce-tx);line-height:1.35;word-break:break-word;margin:0}
    .ce-modal-x{
      width:36px;height:36px;flex-shrink:0;
      border-radius:9px;
      background:var(--ce-s2);border:1px solid var(--ce-bd);
      color:var(--ce-tx2);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;
      transition:all .18s;font-family:inherit
    }
    .ce-modal-x:hover:not(:disabled){background:var(--ce-red-bg);border-color:var(--ce-red-bd);color:#fca5a5}
    .ce-modal-x:disabled{opacity:.4;cursor:not-allowed}
    /* FIX #9: body must flex:1 with overflow-y:auto and min-height:0 */
    .ce-modal-body{
      padding:1.25rem 1.5rem;
      overflow-y:auto;
      flex:1;
      min-height:0;
      display:flex;flex-direction:column;gap:.875rem
    }
    .ce-modal-foot{padding:1rem 1.5rem;border-top:1px solid var(--ce-bd);background:#131921;border-radius:0 0 var(--ce-rxl) var(--ce-rxl);flex-shrink:0}
    .ce-modal-hero{border-radius:var(--ce-r);overflow:hidden;height:200px;flex-shrink:0}
    .ce-modal-hero-img{width:100%;height:100%;object-fit:cover;display:block}
    .ce-modal-desc{font-size:.875rem;color:var(--ce-tx2);line-height:1.75;margin:0}

    /* ── Overview modal cells ──────────────────────────────────────── */
    .ce-ov-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem}
    @media(min-width:600px){.ce-ov-grid{grid-template-columns:repeat(3,1fr)}}
    .ce-ov-cell{background:var(--ce-s2);padding:.875rem 1rem;border-radius:var(--ce-r);border:1px solid var(--ce-bd)}
    .ce-ov-label{font-size:.75rem;color:var(--ce-tx3);font-weight:500;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
    .ce-ov-val{color:var(--ce-tx);font-weight:500;font-size:.9rem;margin:0}

    /* ── Overview price box ───────────────────────────────────────── */
    .ce-ov-price-box{background:var(--ce-s2);border:1px solid var(--ce-bd);border-radius:var(--ce-r);padding:1rem;display:flex;flex-direction:column;gap:.625rem}
    .ce-ov-discount-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;padding-top:.5rem;border-top:1px solid var(--ce-bd)}
    .ce-ov-disc-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;flex-shrink:0}
    .ce-ov-disc-icon--green{background:rgba(16,185,129,.15);color:#34d399}
    .ce-ov-disc-icon--amber{background:rgba(245,158,11,.15);color:#fbbf24}
    .ce-ov-disc-icon--gray{background:var(--ce-s3);color:var(--ce-tx3)}
    .ce-ov-disc-label{font-size:.67rem;font-weight:600;padding:2px 7px;border-radius:20px;white-space:nowrap}
    .ce-ov-disc-label--green{background:rgba(16,185,129,.1);color:#34d399;border:1px solid rgba(16,185,129,.25)}
    .ce-ov-disc-label--amber{background:rgba(245,158,11,.1);color:#fbbf24;border:1px solid rgba(245,158,11,.25)}
    .ce-ov-disc-label--red{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.25)}

    /* ── Feature badges (overview) ───────────────────────────────── */
    .ce-feature-badge{display:inline-flex;align-items:center;gap:5px;font-size:.72rem;font-weight:600;padding:4px 10px;border-radius:20px}
    .ce-feature-badge--blue{background:var(--ce-blue-bg);color:#93c5fd;border:1px solid var(--ce-blue-bd)}
    .ce-feature-badge--purple{background:rgba(124,58,237,.12);color:#c4b5fd;border:1px solid rgba(124,58,237,.28)}
    .ce-feature-badge--teal{background:rgba(13,148,136,.12);color:#5eead4;border:1px solid rgba(13,148,136,.28)}

    /* ── File link (overview downloads) ─────────────────────────── */
    .ce-file-link{
      display:flex;align-items:center;justify-content:space-between;
      padding:.5rem .625rem;
      background:var(--ce-s3);
      border:1px solid var(--ce-bd);
      border-radius:7px;
      text-decoration:none;
      color:var(--ce-tx2);
      font-size:.84rem;
      transition:all .15s
    }
    .ce-file-link:hover{background:var(--ce-bd);color:var(--ce-tx);border-color:var(--ce-bd2)}

    /* ── CTA buttons (modal footer) ─────────────────────────────── */
    .ce-cta-btn{
      width:100%;
      display:flex;align-items:center;justify-content:center;gap:.5rem;
      padding:.75rem 1.25rem;
      border:none;border-radius:10px;
      font-size:.95rem;font-weight:600;
      cursor:pointer;transition:all .2s;font-family:inherit;
      line-height:1
    }
    .ce-cta-btn:disabled{opacity:.5;cursor:not-allowed}
    .ce-cta-btn--primary{background:var(--ce-blue);color:#fff;box-shadow:0 3px 14px rgba(37,99,235,.35)}
    .ce-cta-btn--primary:hover:not(:disabled){background:var(--ce-blue-h);transform:translateY(-1px)}
    .ce-cta-btn--enroll{background:var(--ce-teal);color:#fff;box-shadow:0 3px 14px rgba(13,148,136,.35)}
    .ce-cta-btn--enroll:hover:not(:disabled){background:var(--ce-teal-h);transform:translateY(-1px)}

    /* ── Price breakdown (enrollment modal) ─────────────────────── */
    .ce-price-breakdown{background:var(--ce-s2);border:1px solid var(--ce-bd);border-radius:var(--ce-r);padding:1rem;display:flex;flex-direction:column;gap:.6rem}
    .ce-pb-row{display:flex;align-items:center;justify-content:space-between;font-size:.875rem}
    .ce-pb-label{color:var(--ce-tx2);display:flex;align-items:center}
    .ce-pb-val{color:var(--ce-tx);font-weight:500}
    .ce-pb-discount{color:#4ade80;font-weight:500}
    .ce-pb-row--savings{padding-top:.5rem;border-top:1px solid var(--ce-bd);font-size:.8rem;color:var(--ce-tx2)}
    .ce-pb-savings{color:#4ade80;font-weight:600}
    .ce-pb-row--final{padding-top:.5rem;border-top:1px solid var(--ce-bd)}
    .ce-pb-final{font-size:1.45rem;font-weight:700;color:#818cf8}

    /* ── Coupon code inline tag ─────────────────────────────────── */
    .ce-coupon-code{font-family:monospace;font-size:.73rem;background:rgba(49,46,129,.3);color:#a5b4fc;padding:1px 6px;border-radius:4px;margin-left:.375rem}

    /* ── Discount badge box (enrollment modal) ───────────────────── */
    .ce-discount-badge-box{display:flex;align-items:flex-start;gap:.5rem;background:rgba(20,83,45,.2);border:1px solid rgba(34,197,94,.3);border-radius:var(--ce-r);padding:.75rem}

    /* ── Coupon section ─────────────────────────────────────────── */
    .ce-coupon-section{display:flex;flex-direction:column}

    /* ── Applied coupon row ─────────────────────────────────────── */
    .ce-applied-coupon{
      display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
      background:rgba(20,83,45,.2);border:1px solid rgba(34,197,94,.4);
      border-radius:8px;padding:.5rem .75rem
    }
    .ce-coupon-remove{
      flex-shrink:0;padding:3px;
      color:var(--ce-tx3);background:transparent;border:none;
      cursor:pointer;transition:color .15s;font-family:inherit
    }
    .ce-coupon-remove:hover:not(:disabled){color:#f87171}
    .ce-coupon-remove:disabled{opacity:.4;cursor:not-allowed}

    /* ── Coupon input ───────────────────────────────────────────── */
    .ce-coupon-input{
      width:100%;box-sizing:border-box;
      background:var(--ce-s3);color:var(--ce-tx);
      border:1px solid var(--ce-bd);
      border-radius:8px;
      padding:.5rem 2rem .5rem .75rem;
      font-family:monospace;font-size:.875rem;
      outline:none;transition:border-color .18s
    }
    .ce-coupon-input:focus{border-color:var(--ce-blue);box-shadow:0 0 0 2px var(--ce-blue-bg)}
    .ce-coupon-input::placeholder{color:var(--ce-tx3);font-family:inherit}
    .ce-coupon-input:disabled{opacity:.5}
    .ce-coupon-input-clear{
      position:absolute;right:8px;top:50%;transform:translateY(-50%);
      color:var(--ce-tx3);background:transparent;border:none;
      cursor:pointer;padding:2px;font-family:inherit;transition:color .15s
    }
    .ce-coupon-input-clear:hover{color:var(--ce-tx2)}

    /* ── Responsive ─────────────────────────────────────────────── */
    @media(max-width:479px){
      .ce-header{flex-direction:column;gap:.625rem}
      .ce-tab-bar{flex-direction:column;align-items:flex-start;border-bottom:none}
      .ce-tabs{border-bottom:1px solid var(--ce-bd);width:100%}
      .ce-modal-head,.ce-modal-body,.ce-modal-foot{padding:.9rem 1rem}
      .ce-modal--wide,.ce-modal--narrow{max-height:calc(100vh - 32px);border-radius:var(--ce-rl)}
      .ce-overlay--top{padding-top:16px}
      .ce-card-actions{flex-direction:column}
      .ce-btn--ghost,.ce-btn--primary,.ce-btn--enroll{flex:initial;width:100%}
      .ce-coupon-apply{flex:none!important;width:auto!important}
      .ce-ov-grid{grid-template-columns:1fr 1fr}
    }
    @media(max-width:360px){
      .ce-tab{padding:.55rem .7rem;font-size:.78rem}
      .ce-page-h{font-size:1.2rem}
    }
  `}</style>
);

export default CourseEnrollment;
