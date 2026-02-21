// src/pages/CourseEnrollment.tsx
// ─────────────────────────────────────────────────────────────
// All previous features intact + 4 targeted fixes:
//   1. Persistent favourites (localStorage per user)
//   2. Favourites category filter option
//   3. Course overview modal no longer clips behind app header
//   4. List-view layout works correctly on mobile
//   5. Restored animated loading screen (ring + icon + dots)
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Star, Clock, Play, BookOpen, Award, Eye,
  CheckCircle, Calendar, Video, FileText, Heart, X,
  Grid3X3, List, Loader, Tag, TrendingUp, Download, ShoppingCart,
  AlertCircle, Percent, DollarSign, Check, AlertTriangle, ChevronDown,
  ExternalLink, Ticket, Info, Sparkles, Plus, Zap, Users, Trophy,
  GraduationCap, Rocket, Shield, Globe, ArrowRight
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

// ==================== FAVOURITES STORAGE HELPERS ====================
// Per-user localStorage key so favourites are isolated per account.

const FAV_KEY = (uid: string) => `ce_favourites_${uid}`;

function loadFavouriteIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY(uid));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function saveFavouriteIds(uid: string, ids: Set<string>): void {
  try {
    localStorage.setItem(FAV_KEY(uid), JSON.stringify(Array.from(ids)));
  } catch { /* quota exceeded – silently ignore */ }
}

// ==================== COURSE FILTERING HELPER ====================
// Extended: supports selectedCategory === '__favorites__'

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

  // Special sentinel value for favourites filter
  if (selectedCategory === '__favorites__') {
    filtered = filtered.filter(c => c.isFavorite);
  } else if (selectedCategory !== 'all') {
    filtered = filtered.filter(c => c.category === selectedCategory);
  }

  if (selectedClass !== 'all') filtered = filtered.filter(c => c.class === selectedClass);
  if (selectedLevel !== 'all') filtered = filtered.filter(c => c.level === selectedLevel);

  if (priceFilter === 'free')       filtered = filtered.filter(c => c.price === 0);
  else if (priceFilter === 'paid')  filtered = filtered.filter(c => c.price > 0);
  else if (priceFilter === 'under1000') filtered = filtered.filter(c => c.price < 1000);
  else if (priceFilter === 'under5000') filtered = filtered.filter(c => c.price < 5000);

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'popular':    return b.studentCount - a.studentCount;
      case 'rating':     return b.rating - a.rating;
      case 'newest':     return b.createdAt.getTime() - a.createdAt.getTime();
      case 'price-low':  return a.price - b.price;
      case 'price-high': return b.price - a.price;
      default:           return 0;
    }
  });
}

// ==================== MAIN COMPONENT ====================

const CourseEnrollment = () => {
  const { user } = useDashboard();
  const navigate  = useNavigate();
  const location  = useLocation();

  // ── Core data ────────────────────────────────────────────────
  const [allCourses,       setAllCourses]       = useState<EnrichedCourse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<EnrichedCourse[]>([]);
  const [enrolledCourses,  setEnrolledCourses]  = useState<EnrichedCourse[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [categories,       setCategories]       = useState<string[]>([]);
  const [classes,          setClasses]          = useState<string[]>([]);

  // ── UI ───────────────────────────────────────────────────────
  const [activeTab,        setActiveTab]        = useState<'available' | 'enrolled'>('available');
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState('');
  const [warning,          setWarning]          = useState('');
  const [searchTerm,       setSearchTerm]       = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedClass,    setSelectedClass]    = useState('all');
  const [selectedLevel,    setSelectedLevel]    = useState('all');
  const [priceFilter,      setPriceFilter]      = useState('all');
  const [sortBy,           setSortBy]           = useState('popular');
  const [viewMode,         setViewMode]         = useState<'grid' | 'list'>('grid');

  // ── Modals ───────────────────────────────────────────────────
  const [showCourseModal,     setShowCourseModal]     = useState(false);
  const [selectedCourse,      setSelectedCourse]      = useState<EnrichedCourse | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [enrollmentData,      setEnrollmentData]      = useState<EnrollmentModalData | null>(null);
  const [enrolling,           setEnrolling]           = useState(false);
  const [calculatingPrice,    setCalculatingPrice]    = useState(false);

  // ── Coupon ───────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState<CouponInputState>({
    code: '', fieldState: 'idle', errorMessage: '',
  });
  const couponAbortRef = useRef<AbortController | null>(null);

  // ── Payment return ───────────────────────────────────────────
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturnState>({
    active: false, status: 'processing', message: '', courseTitle: '',
  });
  const paymentHandledRef = useRef(false);

  // ── Filter opts ref ──────────────────────────────────────────
  const filterOptsRef = useRef({
    searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
  });
  useEffect(() => {
    filterOptsRef.current = {
      searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy,
    };
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy]);

  // ==================== DATA LOADER (unchanged logic + favourites injection) ====================

  const loadCourses = useCallback(async (
    opts?: { targetTab?: 'available' | 'enrolled'; guaranteedEnrolledCourseId?: string }
  ): Promise<EnrichedCourse[]> => {
    try {
      setLoading(true); setError('');
      const [publishedCourses, enrollments] = await Promise.all([
        courseEnrollmentService.getPublishedCourses(),
        courseEnrollmentService.getStudentEnrollments(user?.uid || ''),
      ]);
      const enrolledCourseIds = new Set(enrollments.map(e => e.courseId));
      const enrollmentMap = new Map<string, { progress: number; enrollmentId: string }>();
      enrollments.forEach(e => {
        enrollmentMap.set(e.courseId, { progress: e.progress || 0, enrollmentId: e.id });
      });
      const forcedId = opts?.guaranteedEnrolledCourseId;
      if (forcedId) {
        enrolledCourseIds.add(forcedId);
        if (!enrollmentMap.has(forcedId))
          enrollmentMap.set(forcedId, { progress: 0, enrollmentId: '__pending__' });
      }

      // Load persisted favourites for this user
      const savedFavIds = user?.uid ? loadFavouriteIds(user.uid) : new Set<string>();

      const enriched: EnrichedCourse[] = publishedCourses.map(c => {
        const info = enrollmentMap.get(c.id);
        return {
          ...c,
          isEnrolled: enrolledCourseIds.has(c.id),
          progress: info?.progress || 0,
          enrollmentId: info?.enrollmentId,
          // Restore persisted favourite state
          isFavorite: savedFavIds.has(c.id),
        };
      });

      const catSet = new Set<string>();
      const clsSet = new Set<string>();
      enriched.forEach(c => {
        if (c.category) catSet.add(c.category);
        if (c.class)    clsSet.add(c.class);
      });
      const currentOpts = filterOptsRef.current;
      setAllCourses(enriched);
      setCategories(Array.from(catSet).sort());
      setClasses(Array.from(clsSet).sort());
      setAvailableCourses(buildFilteredCourses(enriched, 'available', currentOpts));
      setEnrolledCourses(buildFilteredCourses(enriched, 'enrolled', currentOpts));
      if (opts?.targetTab) setActiveTab(opts.targetTab);
      return enriched;
    } catch (err: any) {
      console.error('Error loading courses:', err);
      setError('Failed to load courses. Please refresh the page or try again later.');
      return [];
    } finally { setLoading(false); }
  }, [user?.uid]);

  // ==================== PAYMENT RETURN HANDLER (unchanged logic) ====================

  useEffect(() => {
    if (!user?.uid || paymentHandledRef.current) return;
    const params      = new URLSearchParams(location.search);
    const tranId      = params.get('tran_id') || params.get('tranId') || params.get('transaction_id') || params.get('transactionId');
    const statusParam = params.get('status');
    const errorParam  = params.get('error');
    if (!tranId && !statusParam && !errorParam) return;
    paymentHandledRef.current = true;
    window.history.replaceState({}, '', window.location.pathname);

    const handleReturn = async () => {
      if (errorParam) { setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: 'Payment could not be completed. Please try again or contact support.' }); return; }
      if (statusParam === 'cancelled') { setPaymentReturn({ active: true, status: 'cancelled', courseTitle: '', message: 'Payment was cancelled. No charge was made.' }); return; }
      if (statusParam === 'failed' && !tranId) { setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: 'Payment failed. Please try again.' }); return; }
      if (statusParam === 'validating' && !tranId) { setPaymentReturn({ active: true, status: 'processing', courseTitle: '', message: 'Your payment is under review. You will be enrolled once approved.' }); return; }
      if (!tranId) { setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: 'Invalid payment reference. Please contact support.' }); return; }
      setPaymentReturn({ active: true, status: 'processing', courseTitle: '', message: statusParam === 'validation_error' ? 'Verifying your payment status...' : 'Verifying your payment...' });
      const result = await courseEnrollmentService.verifyPaymentAndGetEnrollment(tranId, user.uid);
      if (result.status === 'ownership_error') { setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: result.message }); return; }
      if (result.status === 'failed' || result.status === 'cancelled') { setPaymentReturn({ active: true, status: result.status as PaymentReturnStatus, courseTitle: result.courseTitle || '', message: result.message }); return; }
      if (result.status === 'validating') { setPaymentReturn({ active: true, status: 'processing', courseTitle: result.courseTitle || '', message: result.message }); return; }
      if (result.status === 'not_found') {
        setPaymentReturn({ active: true, status: 'failed', courseTitle: result.courseTitle || '',
          message: statusParam === 'validation_error' ? 'Payment verification could not be completed. If you were charged, please contact support with ref: ' + tranId : result.message });
        return;
      }
      const isPending = result.status === 'pending';
      setPaymentReturn(p => ({ ...p, status: 'processing', message: 'Activating your enrollment...', courseTitle: result.courseTitle || '' }));
      await loadCourses({ targetTab: 'enrolled', guaranteedEnrolledCourseId: result.courseId || '' });
      setPaymentReturn({ active: true, status: 'success', courseTitle: result.courseTitle || '',
        message: isPending ? `Payment confirmed for "${result.courseTitle || 'the course'}"! Your enrollment is being activated — it will appear momentarily.` : result.message });
    };

    handleReturn().catch(() => {
      setPaymentReturn({ active: true, status: 'failed', courseTitle: '', message: `An unexpected error occurred. Contact support with ref: ${tranId}` });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ==================== INITIAL LOAD & FILTER EFFECT ====================

  useEffect(() => { if (user?.uid) loadCourses(); }, [user?.uid, loadCourses]);

  useEffect(() => {
    if (allCourses.length === 0) return;
    const opts = filterOptsRef.current;
    setAvailableCourses(buildFilteredCourses(allCourses, 'available', opts));
    setEnrolledCourses(buildFilteredCourses(allCourses, 'enrolled', opts));
  }, [searchTerm, selectedCategory, selectedClass, selectedLevel, priceFilter, sortBy, allCourses]);

  // ==================== COUPON HELPERS (unchanged logic) ====================

  const resetCouponInput = useCallback(() => {
    couponAbortRef.current?.abort(); couponAbortRef.current = null;
    setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' });
  }, []);

  const addCoupon = useCallback(async (code: string, currentData: EnrollmentModalData): Promise<void> => {
    couponAbortRef.current?.abort();
    const abort = new AbortController(); couponAbortRef.current = abort;
    const upper = code.trim().toUpperCase(); if (!upper) return;
    const existingCodes = (currentData.calculation.appliedCoupons ?? []).map(c => c.couponCode);
    if (existingCodes.includes(upper)) { setCouponInput(p => ({ ...p, fieldState: 'error', errorMessage: 'This coupon is already applied.' })); return; }
    setCouponInput(p => ({ ...p, fieldState: 'checking', errorMessage: '' }));
    try {
      const newCalc = await courseEnrollmentService.calculateEnrollmentPrice(currentData.course.id, user?.uid || '', [...existingCodes, upper]);
      if (abort.signal.aborted) return;
      const wasAccepted = newCalc.appliedCoupons.some(c => c.couponCode === upper);
      if (wasAccepted) { setEnrollmentData({ ...currentData, calculation: newCalc }); setCouponInput({ code: '', fieldState: 'idle', errorMessage: '' }); }
      else {
        const probeCalc = await courseEnrollmentService.calculateEnrollmentPrice(currentData.course.id, user?.uid || '', [upper]);
        if (abort.signal.aborted) return;
        setCouponInput(p => ({ ...p, fieldState: 'error', errorMessage: probeCalc.couponError || 'This coupon cannot be applied.' }));
      }
    } catch { if (!abort.signal.aborted) setCouponInput(p => ({ ...p, fieldState: 'error', errorMessage: 'Unable to validate coupon. Please try again.' })); }
  }, [user]);

  const removeCoupon = useCallback(async (couponCode: string, currentData: EnrollmentModalData): Promise<void> => {
    const remaining = (currentData.calculation.appliedCoupons ?? []).filter(c => c.couponCode !== couponCode).map(c => c.couponCode);
    try {
      const newCalc = await courseEnrollmentService.calculateEnrollmentPrice(currentData.course.id, user?.uid || '', remaining);
      setEnrollmentData({ ...currentData, calculation: newCalc });
    } catch (err: any) { console.warn('Failed to recalculate after coupon removal:', err.message); }
  }, [user]);

  // ==================== EVENT HANDLERS ====================

  const handleCourseClick = (course: EnrichedCourse) => { setSelectedCourse(course); setShowCourseModal(true); };

  const handleEnrollClick = async (course: EnrichedCourse) => {
    if (!user) { setError('Please login to enroll in courses'); return; }
    try {
      setCalculatingPrice(true); setError(''); setWarning(''); resetCouponInput();
      const calculation = await courseEnrollmentService.calculateEnrollmentPrice(course.id, user.uid, []);
      setEnrollmentData({ course, calculation }); setShowEnrollmentModal(true);
    } catch { setError('Failed to calculate price. Please try again.'); }
    finally { setCalculatingPrice(false); }
  };

  const handleProceedToPayment = async () => {
    if (!enrollmentData || !user) return;
    try {
      setEnrolling(true); setError(''); setWarning('');
      const { course, calculation } = enrollmentData;
      if (calculation.finalPrice === 0) { await handleFreeEnrollment(course, calculation); return; }
      const res = await courseEnrollmentService.enrollStudent({
        courseId: course.id, studentId: user.uid, studentName: user.name, studentEmail: user.email,
        studentPhone: (user as any).phoneNumber || '', studentSurname: (user as any).surname || '',
        studentUserId: (user as any).userId || '', calculation,
      });
      if (res.success && res.gatewayUrl) { setShowEnrollmentModal(false); window.location.href = res.gatewayUrl; }
      else throw new Error(res.error || 'Failed to initiate payment');
    } catch (err: any) { setError(err.message || 'Failed to process enrollment. Please try again.'); setEnrolling(false); }
  };

  const handleFreeEnrollment = async (course: Course, calculation: EnrollmentCalculation) => {
    if (!user) return;
    try {
      const res = await courseEnrollmentService.enrollStudent({
        courseId: course.id, studentId: user.uid, studentName: user.name, studentEmail: user.email,
        studentPhone: (user as any).phoneNumber || '', studentSurname: (user as any).surname || '',
        studentUserId: (user as any).userId || '', calculation,
      });
      if (res.success) {
        setShowEnrollmentModal(false); setEnrollmentData(null); resetCouponInput();
        await loadCourses({ targetTab: 'enrolled', guaranteedEnrolledCourseId: course.id });
        setSuccess(`Successfully enrolled in "${course.title}"!`);
      } else throw new Error(res.error || 'Enrollment failed');
    } catch (err: any) { setError(err.message || 'Failed to enroll in course'); }
    finally { setEnrolling(false); }
  };

  // ── FIXED: toggleFavorite now persists to localStorage ──────
  const toggleFavorite = useCallback((courseId: string) => {
    if (!user?.uid) return;
    setAllCourses(prev => {
      const next = prev.map(c => c.id === courseId ? { ...c, isFavorite: !c.isFavorite } : c);
      // Persist updated set
      const favIds = new Set(next.filter(c => c.isFavorite).map(c => c.id));
      saveFavouriteIds(user.uid, favIds);
      return next;
    });
  }, [user?.uid]);

  const handleContinueLearning = (courseId: string) => navigate(`/content-library?courseId=${courseId}`);

  // ==================== HELPERS ====================

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'beginner':     return { cls: 'ep-badge-green', label: 'Beginner' };
      case 'intermediate': return { cls: 'ep-badge-amber', label: 'Intermediate' };
      case 'advanced':     return { cls: 'ep-badge-rose',  label: 'Advanced' };
      default:             return { cls: 'ep-badge-slate', label: level };
    }
  };

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const clearMessages = () => { setError(''); setSuccess(''); setWarning(''); };

  const closeEnrollmentModal = () => {
    setShowEnrollmentModal(false); setEnrollmentData(null); resetCouponInput(); clearMessages();
  };

  // Count favourites for the badge in the filter
  const favouriteCount = allCourses.filter(c => !c.isEnrolled && c.isFavorite).length;

  // ==================== PAYMENT RETURN BANNER ====================

  const PaymentReturnBanner = () => {
    if (!paymentReturn.active) return null;
    const cfg = {
      processing: { cls: 'ep-notice-blue',  icon: <Loader size={17} className="animate-spin ep-shrink0" /> },
      success:    { cls: 'ep-notice-green', icon: <CheckCircle size={17} className="ep-shrink0" /> },
      failed:     { cls: 'ep-notice-red',   icon: <AlertCircle size={17} className="ep-shrink0" /> },
      cancelled:  { cls: 'ep-notice-amber', icon: <AlertTriangle size={17} className="ep-shrink0" /> },
    }[paymentReturn.status];
    return (
      <div className={`ep-notice ep-notice--row ${cfg.cls}`}>
        {cfg.icon}
        <p className="ep-notice-text">{paymentReturn.message}</p>
        {paymentReturn.status !== 'processing' && (
          <button className="ep-notice-close" onClick={() => setPaymentReturn(p => ({ ...p, active: false }))} aria-label="Dismiss"><X size={15} /></button>
        )}
      </div>
    );
  };

  // ==================== LOADING SCREEN (restored animated version) ====================

  if (loading && allCourses.length === 0) {
    return (
      <>
        <CEStyles />
        <div className="ep-fullload">
          <div className="ep-fullload-wrap">
            <div className="ep-fullload-ring" />
            <GraduationCap size={26} className="ep-fullload-icon" />
          </div>
          <p className="ep-fullload-text">Loading your courses…</p>
          <div className="ep-fullload-dots">
            <span /><span /><span />
          </div>
        </div>
      </>
    );
  }

  // ==================== COURSE CARD ====================

  const CourseCard = ({ course }: { course: EnrichedCourse }) => {
    const enrolled = course.isEnrolled;
    const lvl      = getLevelStyle(course.level);
    const features: string[] = [];
    if (course.hasAiQnA)        features.push('AI Q&A');
    if (course.hasHumanQnA)     features.push('Human Q&A');
    if (course.hasStudyPlanner) features.push('Study Planner');

    return (
      <article className={`ep-card${viewMode === 'list' ? ' ep-card--list' : ''}`}>
        {/* ─ Thumbnail ─ */}
        <div className={`ep-card-thumb${viewMode === 'list' ? ' ep-card-thumb--list' : ''}`}>
          {course.thumbnail
            ? <img src={course.thumbnail} alt={course.title} className="ep-card-img" loading="lazy" />
            : <div className="ep-card-fallback"><BookOpen size={36} /></div>
          }
          <div className="ep-card-shade" />

          {/* badge top-left */}
          {enrolled
            ? <span className="ep-tbadge ep-tbadge-tl ep-badge-enrolled"><CheckCircle size={11} />Enrolled</span>
            : course.price === 0 && <span className="ep-tbadge ep-tbadge-tl ep-badge-free">FREE</span>
          }

          {/* fav top-right */}
          {!enrolled && (
            <button
              className={`ep-fav${course.isFavorite ? ' ep-fav--on' : ''}`}
              onClick={e => { e.stopPropagation(); toggleFavorite(course.id); }}
              aria-label={course.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
              title={course.isFavorite ? 'Remove from favourites' : 'Save to favourites'}
            >
              <Heart size={13} className={course.isFavorite ? 'ep-fill' : ''} />
            </button>
          )}

          {/* level bottom-left */}
          <span className={`ep-tbadge ep-tbadge-bl ep-level ${lvl.cls}`}>{lvl.label}</span>
        </div>

        {/* ─ Body ─ */}
        <div className="ep-card-body">
          <div className="ep-meta-row">
            <span className="ep-rating">
              <Star size={12} className="ep-star" />
              <strong>{course.rating.toFixed(1)}</strong>
              <span className="ep-dim">({course.reviewCount})</span>
            </span>
            <span className="ep-sep">·</span>
            <span className="ep-dim ep-students"><Users size={12} />{course.studentCount.toLocaleString()}</span>
          </div>

          <h3 className="ep-card-title" onClick={() => handleCourseClick(course)}>{course.title}</h3>
          <p className="ep-card-sub">{course.class}{course.category ? ` · ${course.category}` : ''}</p>

          {features.length > 0 && (
            <div className="ep-chips">
              {features.map((f, i) => <span key={i} className="ep-chip"><Sparkles size={10} />{f}</span>)}
            </div>
          )}

          {enrolled && (
            <div className="ep-progress">
              <div className="ep-progress-labels"><span>Progress</span><strong>{course.progress}%</strong></div>
              <div className="ep-progress-track"><div className="ep-progress-fill" style={{ width: `${course.progress}%` }} /></div>
            </div>
          )}

          {!enrolled && (
            <p className="ep-price">{course.price === 0 ? 'Free' : `৳${course.price.toLocaleString()}`}</p>
          )}

          <div className="ep-card-actions">
            <button className="ep-btn ep-btn--ghost" onClick={() => handleCourseClick(course)}>
              <Eye size={14} />Overview
            </button>
            {enrolled
              ? <button className="ep-btn ep-btn--primary" onClick={() => handleContinueLearning(course.id)}>
                  <Play size={14} />Continue
                </button>
              : <button className="ep-btn ep-btn--enroll" onClick={() => handleEnrollClick(course)} disabled={enrolling || calculatingPrice}>
                  {calculatingPrice ? <Loader size={14} className="animate-spin" /> : <><ArrowRight size={14} />Enroll</>}
                </button>
            }
          </div>
        </div>
      </article>
    );
  };

  // ==================== COURSE OVERVIEW MODAL ====================
  // FIX: overlay uses align-items:flex-start + paddingTop so it never clips
  // under a fixed app header. The modal itself scrolls internally.

  const CourseOverviewModal = () => {
    if (!selectedCourse) return null;
    const enrolled = selectedCourse.isEnrolled;
    const lvl      = getLevelStyle(selectedCourse.level);
    const routineFilesByCategory = selectedCourse.routineFiles?.reduce((acc, file) => {
      if (!acc[file.category]) acc[file.category] = [];
      acc[file.category].push(file);
      return acc;
    }, {} as Record<string, typeof selectedCourse.routineFiles>);

    const closeModal = () => { setShowCourseModal(false); setSelectedCourse(null); };

    return (
      <div className="ep-overlay ep-overlay--top" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="ep-modal ep-modal--wide" role="dialog" aria-modal="true" aria-label="Course overview">

          {/* Sticky header */}
          <div className="ep-modal-head">
            <div className="ep-modal-head-info">
              <p className="ep-eyebrow">Course Overview</p>
              <h2 className="ep-modal-h">{selectedCourse.title}</h2>
            </div>
            <button className="ep-modal-x" onClick={closeModal} aria-label="Close"><X size={18} /></button>
          </div>

          {/* Scrollable body */}
          <div className="ep-modal-body">
            {selectedCourse.thumbnail && (
              <div className="ep-modal-hero">
                <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="ep-modal-hero-img" />
              </div>
            )}

            {selectedCourse.description && <p className="ep-modal-desc">{selectedCourse.description}</p>}

            <div className="ep-tile-grid">
              {selectedCourse.class && (
                <div className="ep-tile"><BookOpen size={14} className="ep-tile-icon" /><div><p className="ep-tile-label">Class</p><p className="ep-tile-val">{selectedCourse.class}</p></div></div>
              )}
              {selectedCourse.category && (
                <div className="ep-tile"><Tag size={14} className="ep-tile-icon" /><div><p className="ep-tile-label">Category</p><p className="ep-tile-val">{selectedCourse.category}</p></div></div>
              )}
              {selectedCourse.level && selectedCourse.level !== 'unspecified' && (
                <div className="ep-tile"><TrendingUp size={14} className="ep-tile-icon" /><div><p className="ep-tile-label">Level</p><span className={`ep-level ${lvl.cls}`}>{lvl.label}</span></div></div>
              )}
              {enrolled && selectedCourse.duration && selectedCourse.duration !== '00:00' && (
                <div className="ep-tile"><Clock size={14} className="ep-tile-icon" /><div><p className="ep-tile-label">Duration</p><p className="ep-tile-val">{selectedCourse.duration}</p></div></div>
              )}
            </div>

            {(selectedCourse.hasAiQnA || selectedCourse.hasHumanQnA || selectedCourse.hasStudyPlanner) && (
              <div>
                <p className="ep-slabel">Special Features</p>
                <div className="ep-chips">
                  {selectedCourse.hasAiQnA      && <span className="ep-chip"><Zap size={10} />AI Q&A</span>}
                  {selectedCourse.hasHumanQnA    && <span className="ep-chip"><Users size={10} />Human Q&A</span>}
                  {selectedCourse.hasStudyPlanner && <span className="ep-chip"><Calendar size={10} />Study Planner</span>}
                </div>
              </div>
            )}

            <div className="ep-ppanel">
              <div className="ep-ppanel-mainrow">
                <span className="ep-dim ep-sm">Price</span>
                <span className="ep-price-hero">{selectedCourse.price === 0 ? 'Free' : `৳${selectedCourse.price.toLocaleString()}`}</span>
              </div>
              {selectedCourse.previousStudentDiscount && selectedCourse.previousStudentDiscount > 0 && (
                <div className="ep-ppanel-row">
                  <span className="ep-dim ep-sm">Previous Student Discount</span>
                  <span className="ep-green">-৳{selectedCourse.previousStudentDiscount.toLocaleString()}</span>
                </div>
              )}
              {selectedCourse.extraDiscount && selectedCourse.extraDiscount > 0 && selectedCourse.extraDiscountValidUntil && (
                <div className="ep-ppanel-row">
                  <div>
                    <span className="ep-dim ep-sm">Limited Time Discount</span>
                    <p className="ep-dim ep-xs" style={{marginTop:2}}>Valid until: {formatDate(selectedCourse.extraDiscountValidUntil)}</p>
                  </div>
                  <span className="ep-green">-৳{selectedCourse.extraDiscount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {selectedCourse.validity && (
              <div className="ep-tile">
                <Calendar size={14} className="ep-tile-icon" />
                <div><p className="ep-tile-label">Available Until</p><p className="ep-tile-val">{formatDate(selectedCourse.validity)}</p></div>
              </div>
            )}

            {selectedCourse.requirements && selectedCourse.requirements.length > 0 && (
              <div>
                <p className="ep-slabel">Requirements</p>
                <ul className="ep-list-items">
                  {selectedCourse.requirements.map((r, i) => (
                    <li key={i} className="ep-list-item"><CheckCircle size={14} className="ep-icon-green ep-shrink0" />{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedCourse.whatYouWillLearn && selectedCourse.whatYouWillLearn.length > 0 && (
              <div>
                <p className="ep-slabel">What You Will Learn</p>
                <ul className="ep-list-items">
                  {selectedCourse.whatYouWillLearn.map((it, i) => (
                    <li key={i} className="ep-list-item"><Award size={14} className="ep-icon-blue ep-shrink0" />{it}</li>
                  ))}
                </ul>
              </div>
            )}

            {routineFilesByCategory && Object.keys(routineFilesByCategory).length > 0 && (
              <div>
                <p className="ep-slabel">Downloadable Files</p>
                {Object.entries(routineFilesByCategory).map(([cat, files]) => (
                  <div key={cat} className="ep-file-grp">
                    <p className="ep-file-grp-label">{cat}</p>
                    {files?.map(file => (
                      <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="ep-file-row">
                        <span className="ep-file-left"><FileText size={14} className="ep-tile-icon" />{file.fileName}</span>
                        <Download size={14} className="ep-dl-icon" />
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="ep-modal-foot">
            {enrolled
              ? <button className="ep-btn ep-btn--primary ep-btn--full" onClick={() => handleContinueLearning(selectedCourse.id)}>
                  <Play size={16} />Continue Learning
                </button>
              : <button className="ep-btn ep-btn--enroll ep-btn--full" onClick={() => { closeModal(); handleEnrollClick(selectedCourse); }} disabled={calculatingPrice}>
                  {calculatingPrice ? <><Loader size={16} className="animate-spin" />Calculating…</> : <><ShoppingCart size={16} />Enroll Now</>}
                </button>
            }
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

    const doAdd = async () => {
      const code = localCode.trim().toUpperCase();
      if (!code || couponInput.fieldState === 'checking') return;
      await addCoupon(code, enrollmentData);
    };

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') doAdd();
      if (e.key === 'Escape') { setLocalCode(''); setCouponInput(p => ({ ...p, fieldState: 'idle', errorMessage: '' })); }
    };

    return (
      <div className="ep-overlay ep-overlay--top" onClick={e => { if (e.target === e.currentTarget && !enrolling) closeEnrollmentModal(); }}>
        <div className="ep-modal ep-modal--narrow" role="dialog" aria-modal="true" aria-label="Complete enrollment">

          <div className="ep-modal-head">
            <div className="ep-modal-head-info">
              <p className="ep-eyebrow">Complete Enrollment</p>
              <h2 className="ep-modal-h-sm">{course.title}</h2>
              <p className="ep-dim ep-xs" style={{marginTop:3}}>{course.class}</p>
            </div>
            <button className="ep-modal-x" onClick={closeEnrollmentModal} disabled={enrolling} aria-label="Close"><X size={18} /></button>
          </div>

          <div className="ep-modal-body">
            {/* Price breakdown */}
            <div className="ep-ppanel">
              <p className="ep-slabel">Price Breakdown</p>
              <div className="ep-breakdown">
                <div className="ep-brow"><span className="ep-dim ep-sm">Base Price</span><span className="ep-brow-val">৳{calculation.basePrice.toLocaleString()}</span></div>
                {calculation.previousStudentDiscount > 0 && (
                  <div className="ep-brow"><span className="ep-dim ep-sm ep-flex-gap"><Percent size={11} />Previous Student</span><span className="ep-green">-৳{calculation.previousStudentDiscount.toLocaleString()}</span></div>
                )}
                {calculation.extraDiscount > 0 && (
                  <div className="ep-brow"><span className="ep-dim ep-sm ep-flex-gap"><Tag size={11} />Limited Time</span><span className="ep-green">-৳{calculation.extraDiscount.toLocaleString()}</span></div>
                )}
                {appliedCoupons.map(ac => (
                  <div key={ac.couponCode} className="ep-brow">
                    <span className="ep-dim ep-sm ep-flex-gap"><Ticket size={11} />Coupon <code className="ep-code">{ac.couponCode}</code></span>
                    <span className="ep-green">-৳{ac.discount.toLocaleString()}</span>
                  </div>
                ))}
                {calculation.totalDiscount > 0 && (
                  <div className="ep-brow ep-brow--savings"><span className="ep-dim ep-sm">Total Savings</span><span className="ep-green ep-green-lg">৳{calculation.totalDiscount.toLocaleString()}</span></div>
                )}
              </div>
              <div className="ep-final-row">
                <span className="ep-final-label">Final Price</span>
                <span className="ep-final-val">{calculation.finalPrice === 0 ? 'Free' : `৳${calculation.finalPrice.toLocaleString()}`}</span>
              </div>
            </div>

            {calculation.hasPreviousEnrollments && calculation.previousStudentDiscount > 0 && (
              <div className="ep-notice ep-notice-green ep-notice--row">
                <CheckCircle size={15} className="ep-shrink0" />
                <div>
                  <p style={{fontWeight:600,fontSize:'0.85rem'}}>Previous Student Discount Applied!</p>
                  <p className="ep-dim ep-xs" style={{marginTop:2}}>Saving ৳{calculation.previousStudentDiscount.toLocaleString()} as a returning student.</p>
                </div>
              </div>
            )}

            {/* Coupon section */}
            <div>
              <div className="ep-cpn-header">
                <Ticket size={13} className="ep-tile-icon" />
                <span className="ep-slabel" style={{marginBottom:0}}>
                  Coupon Codes
                  {appliedCoupons.length > 0 && <span className="ep-applied-badge">{appliedCoupons.length} applied</span>}
                </span>
              </div>
              {appliedCoupons.length > 0 && (
                <div className="ep-applied-list">
                  {appliedCoupons.map(ac => (
                    <div key={ac.couponCode} className="ep-applied-row">
                      <div className="ep-applied-left">
                        <CheckCircle size={13} className="ep-icon-green ep-shrink0" />
                        <div>
                          <p style={{fontSize:'0.83rem',fontWeight:600,color:'#6ee7b7'}}>
                            <span style={{fontFamily:'monospace'}}>{ac.couponCode}</span>
                            <span style={{fontWeight:400,opacity:0.7,marginLeft:6}}>— saving ৳{ac.discount.toLocaleString()}</span>
                          </p>
                          {ac.successMessage && <p className="ep-dim ep-xs" style={{marginTop:2}}>{ac.successMessage}</p>}
                        </div>
                      </div>
                      <button className="ep-remove-btn" onClick={() => removeCoupon(ac.couponCode, enrollmentData)} disabled={enrolling || couponInput.fieldState === 'checking'} aria-label={`Remove ${ac.couponCode}`}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="ep-cpn-row">
                <div className="ep-cpn-input-wrap">
                  <input
                    ref={inputRef} type="text" value={localCode}
                    onChange={e => { const v = e.target.value.toUpperCase().replace(/\s/g, ''); setLocalCode(v); if (couponInput.fieldState === 'error') setCouponInput(p => ({ ...p, fieldState: 'idle', errorMessage: '' })); }}
                    onKeyDown={onKey}
                    placeholder={appliedCoupons.length > 0 ? 'Add another code' : 'Enter coupon code'}
                    maxLength={30} disabled={couponInput.fieldState === 'checking' || enrolling}
                    className={`ep-cpn-input${couponInput.fieldState === 'error' ? ' ep-cpn-input--err' : ''}`}
                  />
                  {localCode && couponInput.fieldState !== 'checking' && (
                    <button className="ep-cpn-clear" onClick={() => { setLocalCode(''); setCouponInput(p => ({ ...p, fieldState: 'idle', errorMessage: '' })); inputRef.current?.focus(); }} aria-label="Clear"><X size={12} /></button>
                  )}
                </div>
                <button onClick={doAdd} disabled={!localCode.trim() || couponInput.fieldState === 'checking' || enrolling} className="ep-btn ep-btn--apply">
                  {couponInput.fieldState === 'checking' ? <><Loader size={12} className="animate-spin" />Checking…</> : <><Plus size={12} />Apply</>}
                </button>
              </div>
              {couponInput.fieldState === 'error' && couponInput.errorMessage && (
                <p className="ep-cpn-error"><AlertCircle size={12} />{couponInput.errorMessage}</p>
              )}
              {couponInput.fieldState === 'idle' && !localCode && (
                <p className="ep-cpn-hint"><Info size={11} />{appliedCoupons.length > 0 ? 'Multiple codes can be stacked.' : 'Have a promo code? Enter it above.'}</p>
              )}
            </div>

            {error   && <div className="ep-notice ep-notice-red ep-notice--row"><AlertCircle size={15} className="ep-shrink0" /><span style={{fontSize:'0.85rem'}}>{error}</span></div>}
            {warning && <div className="ep-notice ep-notice-amber ep-notice--row"><AlertTriangle size={15} className="ep-shrink0" /><span style={{fontSize:'0.85rem'}}>{warning}</span></div>}

            <div className="ep-cta-row">
              <button onClick={closeEnrollmentModal} disabled={enrolling} className="ep-btn ep-btn--ghost ep-btn--cancel">Cancel</button>
              <button onClick={handleProceedToPayment} disabled={enrolling || couponInput.fieldState === 'checking'} className="ep-btn ep-btn--pay">
                {enrolling
                  ? <><Loader size={16} className="animate-spin" />Processing…</>
                  : calculation.finalPrice === 0
                    ? <><Check size={16} />Enroll Free</>
                    : <><ShoppingCart size={16} />Pay ৳{calculation.finalPrice.toLocaleString()}</>
                }
              </button>
            </div>

            {calculation.finalPrice > 0 && !enrolling && (
              <p className="ep-secure"><Shield size={12} />Secure payment via SSLCOMMERZ</p>
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
      <div className="ep-page">

        {/* Header */}
        <header className="ep-header">
          <div>
            <h1 className="ep-page-h">Course Enrollment</h1>
            <p className="ep-page-sub">Discover and enroll in expert-led courses</p>
          </div>
          <div className="ep-header-pills">
            <span className="ep-pill"><BookOpen size={13} /><strong>{availableCourses.length}</strong>Available</span>
            <span className="ep-pill ep-pill--blue"><GraduationCap size={13} /><strong>{enrolledCourses.length}</strong>Enrolled</span>
            {favouriteCount > 0 && (
              <button
                className={`ep-pill ep-pill--fav${selectedCategory === '__favorites__' ? ' ep-pill--fav-on' : ''}`}
                onClick={() => setSelectedCategory(v => v === '__favorites__' ? 'all' : '__favorites__')}
                title="Show saved courses"
              >
                <Heart size={13} className={selectedCategory === '__favorites__' ? 'ep-fill' : ''} />
                <strong>{favouriteCount}</strong>Saved
              </button>
            )}
          </div>
        </header>

        {/* Notices */}
        <div className="ep-notices">
          <PaymentReturnBanner />
          {error   && <div className="ep-notice ep-notice-red ep-notice--row ep-notice--dismissible"><div className="ep-flex-gap"><AlertCircle size={16} className="ep-shrink0" /><span style={{fontSize:'0.875rem'}}>{error}</span></div><button className="ep-notice-close" onClick={clearMessages}><X size={14} /></button></div>}
          {success && <div className="ep-notice ep-notice-green ep-notice--row ep-notice--dismissible"><div className="ep-flex-gap"><CheckCircle size={16} className="ep-shrink0" /><span style={{fontSize:'0.875rem'}}>{success}</span></div><button className="ep-notice-close" onClick={clearMessages}><X size={14} /></button></div>}
          {warning && <div className="ep-notice ep-notice-amber ep-notice--row ep-notice--dismissible"><div className="ep-flex-gap"><AlertTriangle size={16} className="ep-shrink0" /><span style={{fontSize:'0.875rem'}}>{warning}</span></div><button className="ep-notice-close" onClick={clearMessages}><X size={14} /></button></div>}
        </div>

        {/* Tab bar + view toggle */}
        <div className="ep-tab-bar">
          <nav className="ep-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'available'} className={`ep-tab${activeTab === 'available' ? ' ep-tab--on' : ''}`} onClick={() => setActiveTab('available')}>
              <BookOpen size={13} />Available<span className="ep-tab-ct">{availableCourses.length}</span>
            </button>
            <button role="tab" aria-selected={activeTab === 'enrolled'} className={`ep-tab${activeTab === 'enrolled' ? ' ep-tab--on' : ''}`} onClick={() => setActiveTab('enrolled')}>
              <GraduationCap size={13} />Enrolled<span className="ep-tab-ct">{enrolledCourses.length}</span>
            </button>
          </nav>
          <div className="ep-view-toggle" role="group" aria-label="View mode">
            <button aria-label="Grid view" aria-pressed={viewMode === 'grid'} className={`ep-view-btn${viewMode === 'grid' ? ' ep-view-btn--on' : ''}`} onClick={() => setViewMode('grid')}><Grid3X3 size={14} /></button>
            <button aria-label="List view" aria-pressed={viewMode === 'list'} className={`ep-view-btn${viewMode === 'list' ? ' ep-view-btn--on' : ''}`} onClick={() => setViewMode('list')}><List size={14} /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="ep-filters">
          <div className="ep-search-wrap">
            <Search size={14} className="ep-search-icon" aria-hidden="true" />
            <input type="search" aria-label="Search courses" placeholder="Search courses, instructors, topics…" className="ep-search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && <button className="ep-search-x" onClick={() => setSearchTerm('')} aria-label="Clear search"><X size={12} /></button>}
          </div>

          {/* ── FIXED: category filter now includes Favourites option ── */}
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="ep-sel" aria-label="Category">
            <option value="all">All Categories</option>
            <option value="__favorites__">❤ Saved Courses{favouriteCount > 0 ? ` (${favouriteCount})` : ''}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="ep-sel" aria-label="Class">
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)} className="ep-sel" aria-label="Level">
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <select value={priceFilter} onChange={e => setPriceFilter(e.target.value)} className="ep-sel" aria-label="Price">
            <option value="all">Any Price</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="under1000">Under ৳1,000</option>
            <option value="under5000">Under ৳5,000</option>
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="ep-sel" aria-label="Sort by">
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low → High</option>
            <option value="price-high">Price: High → Low</option>
          </select>
        </div>

        {/* Active favourites filter strip */}
        {selectedCategory === '__favorites__' && (
          <div className="ep-fav-strip">
            <Heart size={14} className="ep-fill" style={{color:'#f43f5e'}} />
            <span>Showing saved courses only</span>
            <button className="ep-fav-strip-clear" onClick={() => setSelectedCategory('all')}>
              <X size={12} /> Clear
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="ep-iloader" aria-live="polite"><Loader size={22} className="animate-spin ep-tile-icon" /><span>Refreshing…</span></div>
        ) : displayCourses.length === 0 ? (
          <div className="ep-empty" role="status">
            <div className="ep-empty-icon">
              {selectedCategory === '__favorites__' ? <Heart size={30} /> : activeTab === 'available' ? <Search size={30} /> : <GraduationCap size={30} />}
            </div>
            <h3 className="ep-empty-h">
              {selectedCategory === '__favorites__' ? 'No saved courses yet' : activeTab === 'available' ? 'No courses match your filters' : 'No enrolled courses yet'}
            </h3>
            <p className="ep-empty-p">
              {selectedCategory === '__favorites__'
                ? 'Tap the ❤ on any course card to save it here.'
                : activeTab === 'available'
                  ? 'Try adjusting your search or filters.'
                  : 'Explore available courses and start your learning journey!'}
            </p>
            {activeTab === 'enrolled' && selectedCategory !== '__favorites__' && (
              <button className="ep-btn ep-btn--primary" style={{marginTop:'1.25rem'}} onClick={() => setActiveTab('available')}>
                <BookOpen size={14} />Browse Courses
              </button>
            )}
          </div>
        ) : (
          // FIX: added data-view attribute so CSS can target it cleanly on all screens
          <div className={viewMode === 'grid' ? 'ep-grid' : 'ep-list'} data-view={viewMode} role="list">
            {displayCourses.map(course => (
              <div role="listitem" key={course.id}><CourseCard course={course} /></div>
            ))}
          </div>
        )}
      </div>

      {showCourseModal     && <CourseOverviewModal />}
      {showEnrollmentModal && <EnrollmentModal />}
    </>
  );
};

// ==================== EMBEDDED STYLES ====================

const CEStyles = () => (
  <style>{`
    /* ─── Design Tokens ─── */
    :root{
      --s0:#0c1018; --s1:#131921; --s2:#1a2232; --s3:#222d40;
      --bd:#28354a; --bd2:#35455e;
      --tx:#dce5f0; --tx2:#7f90a8; --tx3:#49596e;
      --blue:#2563eb; --blue-h:#1d4ed8; --blue-bg:rgba(37,99,235,.10); --blue-bd:rgba(37,99,235,.28);
      --teal:#0d9488; --teal-h:#0f766e; --teal-sh:rgba(13,148,136,.30);
      --violet:#5b45e8; --violet-h:#4c3bd1; --violet-sh:rgba(91,69,232,.30);
      --green:#10b981; --green-bg:rgba(16,185,129,.10); --green-bd:rgba(16,185,129,.28);
      --amber:#f59e0b; --amber-bg:rgba(245,158,11,.10); --amber-bd:rgba(245,158,11,.28);
      --red:#ef4444;   --red-bg:rgba(239,68,68,.10);    --red-bd:rgba(239,68,68,.28);
      --rose:#f43f5e;  --rose-bg:rgba(244,63,94,.10);   --rose-bd:rgba(244,63,94,.28);
      --r:10px; --rl:16px; --rxl:20px;
      --sh:0 2px 10px rgba(0,0,0,.35); --sh-lg:0 10px 48px rgba(0,0,0,.55);
    }

    /* ─── Utilities ─── */
    .ep-shrink0{flex-shrink:0}
    .ep-fill{fill:currentColor}
    .ep-flex-gap{display:inline-flex;align-items:center;gap:6px}
    .ep-sm{font-size:.82rem} .ep-xs{font-size:.72rem}
    .ep-dim{color:var(--tx2)} .ep-green{color:#34d399;font-weight:600} .ep-green-lg{font-size:1rem}
    .ep-icon-green{color:var(--green)} .ep-icon-blue{color:var(--blue)}
    .animate-spin{animation:ep-spin .75s linear infinite}
    @keyframes ep-spin{to{transform:rotate(360deg)}}

    /* ─── Page ─── */
    .ep-page{display:flex;flex-direction:column;gap:1.125rem;padding-bottom:3rem}

    /* ─── Header ─── */
    .ep-header{display:flex;align-items:flex-start;justify-content:space-between;gap:.875rem;flex-wrap:wrap}
    .ep-page-h{font-size:clamp(1.3rem,4vw,1.65rem);font-weight:700;color:var(--tx);letter-spacing:-.02em;line-height:1.2}
    .ep-page-sub{font-size:.82rem;color:var(--tx2);margin-top:4px}
    .ep-header-pills{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
    .ep-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;background:var(--s2);border:1px solid var(--bd);border-radius:40px;font-size:.78rem;color:var(--tx2);white-space:nowrap;cursor:default}
    .ep-pill strong{color:var(--tx);font-weight:600;margin-right:1px}
    .ep-pill--blue{border-color:var(--blue-bd);color:#60a5fa}
    .ep-pill--blue strong{color:#60a5fa}
    /* Favourites pill (clickable) */
    .ep-pill--fav{cursor:pointer;border-color:var(--rose-bd);color:#fb7185;transition:all .18s}
    .ep-pill--fav:hover{background:var(--rose-bg);border-color:#f43f5e}
    .ep-pill--fav strong{color:#fb7185}
    .ep-pill--fav-on{background:var(--rose-bg);border-color:#f43f5e;color:#f43f5e}
    .ep-pill--fav-on strong{color:#f43f5e}

    /* Favourites filter strip */
    .ep-fav-strip{display:flex;align-items:center;gap:8px;padding:8px 13px;background:var(--rose-bg);border:1px solid var(--rose-bd);border-radius:var(--r);font-size:.82rem;color:#fb7185}
    .ep-fav-strip-clear{display:inline-flex;align-items:center;gap:4px;margin-left:auto;background:transparent;border:1px solid var(--rose-bd);color:#fb7185;border-radius:6px;padding:3px 9px;font-size:.75rem;cursor:pointer;transition:all .18s}
    .ep-fav-strip-clear:hover{background:var(--rose-bg);border-color:#f43f5e}

    /* ─── Notices ─── */
    .ep-notices{display:flex;flex-direction:column;gap:.5rem}
    .ep-notice{display:flex;align-items:flex-start;padding:10px 13px;border-radius:var(--r);border:1px solid transparent;font-size:.875rem}
    .ep-notice--row{flex-direction:row;gap:9px;align-items:flex-start}
    .ep-notice--dismissible{justify-content:space-between}
    .ep-notice-text{flex:1;font-size:.85rem;line-height:1.5}
    .ep-notice-blue {background:var(--blue-bg); border-color:var(--blue-bd); color:#93c5fd}
    .ep-notice-green{background:var(--green-bg);border-color:var(--green-bd);color:#6ee7b7}
    .ep-notice-red  {background:var(--red-bg);  border-color:var(--red-bd);  color:#fca5a5}
    .ep-notice-amber{background:var(--amber-bg);border-color:var(--amber-bd);color:#fcd34d}
    .ep-notice-close{background:transparent;border:none;color:inherit;opacity:.55;cursor:pointer;padding:2px;flex-shrink:0;transition:opacity .15s}
    .ep-notice-close:hover{opacity:1}

    /* ─── Tab bar ─── */
    .ep-tab-bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border-bottom:1px solid var(--bd);flex-wrap:wrap}
    .ep-tabs{display:flex}
    .ep-tab{display:inline-flex;align-items:center;gap:6px;padding:.7rem 1rem;font-size:.855rem;font-weight:500;color:var(--tx2);border:none;border-bottom:2px solid transparent;background:transparent;cursor:pointer;transition:color .18s,border-color .18s;white-space:nowrap;line-height:1;font-family:inherit}
    .ep-tab:hover{color:var(--tx)}
    .ep-tab--on{color:var(--blue);border-bottom-color:var(--blue)}
    .ep-tab-ct{background:var(--s2);border:1px solid var(--bd);color:var(--tx2);border-radius:40px;padding:1px 7px;font-size:.68rem;font-weight:600}
    .ep-tab--on .ep-tab-ct{background:var(--blue-bg);border-color:var(--blue-bd);color:var(--blue)}

    /* ─── View toggle ─── */
    .ep-view-toggle{display:flex;gap:3px;padding:3px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--r)}
    .ep-view-btn{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:7px;border:none;background:transparent;color:var(--tx3);cursor:pointer;transition:all .18s;font-family:inherit}
    .ep-view-btn:hover{color:var(--tx2);background:var(--s3)}
    .ep-view-btn--on{background:var(--blue);color:#fff}
    .ep-view-btn--on:hover{background:var(--blue-h)}

    /* ─── Filters ─── */
    .ep-filters{display:grid;gap:.6rem;grid-template-columns:1fr;background:var(--s1);border:1px solid var(--bd);border-radius:var(--rl);padding:.875rem}
    @media(min-width:500px){.ep-filters{grid-template-columns:1fr 1fr}}
    @media(min-width:768px){.ep-filters{grid-template-columns:1fr 1fr 1fr}}
    @media(min-width:1100px){.ep-filters{grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr}}
    .ep-search-wrap{position:relative;grid-column:1/-1}
    @media(min-width:1100px){.ep-search-wrap{grid-column:span 2}}
    .ep-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--tx3);pointer-events:none}
    .ep-search{width:100%;box-sizing:border-box;background:var(--s2);border:1px solid var(--bd);color:var(--tx);border-radius:var(--r);padding:9px 32px 9px 34px;font-size:.85rem;outline:none;transition:border-color .18s,box-shadow .18s;font-family:inherit}
    .ep-search::placeholder{color:var(--tx3)}
    .ep-search:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-bg)}
    .ep-search-x{position:absolute;right:9px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--tx3);cursor:pointer;padding:3px}
    .ep-sel{width:100%;background:var(--s2);border:1px solid var(--bd);color:var(--tx);border-radius:var(--r);padding:9px 28px 9px 10px;font-size:.85rem;outline:none;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath fill='%236b7280' d='M5 7 0 0h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;transition:border-color .18s,box-shadow .18s;font-family:inherit}
    .ep-sel:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-bg)}
    .ep-sel option{background:var(--s2)}

    /* ─── Grid / List ─── */
    .ep-grid{display:grid;grid-template-columns:1fr;gap:1.125rem}
    @media(min-width:560px){.ep-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:1024px){.ep-grid{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:1400px){.ep-grid{grid-template-columns:repeat(4,1fr)}}

    /* LIST VIEW — explicit flex-row from 560px, stacked below */
    .ep-list{display:flex;flex-direction:column;gap:.75rem}
    .ep-list .ep-card{flex-direction:column}
    @media(min-width:560px){
      .ep-list .ep-card{flex-direction:row}
      .ep-list .ep-card-thumb{width:200px;height:auto;min-height:155px;flex-shrink:0}
    }

    /* ─── Course Card ─── */
    .ep-card{display:flex;flex-direction:column;background:var(--s1);border:1px solid var(--bd);border-radius:var(--rl);overflow:hidden;transition:transform .25s,border-color .25s,box-shadow .25s;box-shadow:var(--sh)}
    .ep-card:hover{transform:translateY(-4px);border-color:var(--bd2);box-shadow:0 14px 44px rgba(0,0,0,.48)}

    /* thumbnail */
    .ep-card-thumb{position:relative;overflow:hidden;height:192px;flex-shrink:0}
    .ep-card-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
    .ep-card:hover .ep-card-img{transform:scale(1.05)}
    .ep-card-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#181f2e,#0e1319);color:var(--tx3)}
    .ep-card-shade{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.52) 0%,transparent 50%);pointer-events:none}

    /* thumb badges */
    .ep-tbadge{position:absolute;display:inline-flex;align-items:center;gap:4px;font-size:.63rem;font-weight:700;padding:3px 8px;border-radius:20px}
    .ep-tbadge-tl{top:9px;left:9px}
    .ep-tbadge-bl{bottom:9px;left:9px}
    .ep-badge-enrolled{background:rgba(16,185,129,.82);color:#fff;backdrop-filter:blur(4px)}
    .ep-badge-free{background:var(--blue);color:#fff}

    /* fav */
    .ep-fav{position:absolute;top:9px;right:9px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.14);color:#fff;cursor:pointer;backdrop-filter:blur(4px);transition:all .2s;font-family:inherit}
    .ep-fav:hover{background:var(--rose);border-color:var(--rose)}
    .ep-fav--on{background:var(--rose);border-color:var(--rose)}

    /* level badge */
    .ep-level{display:inline-flex;align-items:center;font-size:.62rem;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:capitalize;letter-spacing:.02em}
    .ep-badge-green{background:rgba(16,185,129,.14);color:#34d399;border:1px solid rgba(16,185,129,.3)}
    .ep-badge-amber{background:rgba(245,158,11,.14);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
    .ep-badge-rose {background:rgba(239,68,68,.14); color:#f87171;border:1px solid rgba(239,68,68,.3)}
    .ep-badge-slate{background:var(--s3);color:var(--tx2);border:1px solid var(--bd)}

    /* card body */
    .ep-card-body{display:flex;flex-direction:column;gap:.45rem;padding:.9rem;flex:1}
    .ep-meta-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ep-rating{display:inline-flex;align-items:center;gap:4px;font-size:.78rem;color:var(--tx)}
    .ep-rating strong{font-weight:600}
    .ep-star{color:#fbbf24;fill:#fbbf24}
    .ep-sep{color:var(--tx3);font-size:.55rem}
    .ep-students{display:inline-flex;align-items:center;gap:3px;font-size:.76rem}
    .ep-card-title{font-size:.9rem;font-weight:600;color:var(--tx);line-height:1.45;cursor:pointer;transition:color .18s;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0}
    .ep-card-title:hover{color:var(--blue)}
    .ep-card-sub{font-size:.76rem;color:var(--tx2)}

    /* chips */
    .ep-chips{display:flex;flex-wrap:wrap;gap:5px}
    .ep-chip{display:inline-flex;align-items:center;gap:4px;font-size:.64rem;font-weight:600;color:var(--blue);background:var(--blue-bg);border:1px solid var(--blue-bd);border-radius:20px;padding:3px 8px;white-space:nowrap}

    /* progress */
    .ep-progress{display:flex;flex-direction:column;gap:4px}
    .ep-progress-labels{display:flex;justify-content:space-between;font-size:.73rem;color:var(--tx2)}
    .ep-progress-labels strong{color:var(--tx);font-weight:600}
    .ep-progress-track{height:5px;border-radius:3px;background:var(--s3);overflow:hidden}
    .ep-progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--blue),#60a5fa);transition:width .5s}

    /* price */
    .ep-price{font-size:1.15rem;font-weight:700;color:var(--tx);margin-top:auto}

    /* card actions */
    .ep-card-actions{display:flex;gap:.45rem;margin-top:auto}

    /* ─── Buttons ─── */
    .ep-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:none;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .2s;padding:8px 13px;line-height:1;white-space:nowrap;font-family:inherit}
    .ep-btn:disabled{opacity:.48;cursor:not-allowed;transform:none!important}
    .ep-btn--ghost{flex:1;background:var(--s2);border:1px solid var(--bd);color:var(--tx2)}
    .ep-btn--ghost:hover:not(:disabled){border-color:var(--bd2);color:var(--tx);background:var(--s3)}
    .ep-btn--primary{flex:1;background:var(--blue);color:#fff;box-shadow:0 2px 10px rgba(37,99,235,.28)}
    .ep-btn--primary:hover:not(:disabled){background:var(--blue-h);transform:translateY(-1px);box-shadow:0 4px 16px rgba(37,99,235,.38)}
    .ep-btn--enroll{flex:1;background:var(--teal);color:#fff;box-shadow:0 2px 10px var(--teal-sh)}
    .ep-btn--enroll:hover:not(:disabled){background:var(--teal-h);transform:translateY(-1px);box-shadow:0 4px 16px var(--teal-sh)}
    .ep-btn--pay{flex:2;background:var(--violet);color:#fff;border-radius:10px;padding:12px 18px;font-size:.88rem;box-shadow:0 2px 14px var(--violet-sh)}
    .ep-btn--pay:hover:not(:disabled){background:var(--violet-h);transform:translateY(-1px);box-shadow:0 5px 22px var(--violet-sh)}
    .ep-btn--apply{background:var(--s3);border:1px solid var(--bd2);color:var(--tx);border-radius:8px;padding:9px 13px;font-size:.78rem}
    .ep-btn--apply:hover:not(:disabled){border-color:var(--blue);color:var(--blue)}
    .ep-btn--cancel{flex:1;border-radius:10px;padding:12px}
    .ep-btn--full{width:100%;flex:initial;border-radius:10px;padding:12px 18px;font-size:.88rem}

    /* ─── Empty state ─── */
    .ep-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 1.5rem;text-align:center}
    .ep-empty-icon{width:68px;height:68px;border-radius:50%;background:var(--s2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--tx3);margin-bottom:1.125rem}
    .ep-empty-h{font-size:1.05rem;font-weight:600;color:var(--tx);margin-bottom:.4rem}
    .ep-empty-p{font-size:.85rem;color:var(--tx2);max-width:340px;line-height:1.6}

    /* ─── Inline loader ─── */
    .ep-iloader{display:flex;align-items:center;justify-content:center;gap:10px;padding:3.5rem;color:var(--tx2);font-size:.85rem}

    /* ─── Full-screen loader (restored animated version) ─── */
    .ep-fullload{position:fixed;inset:0;background:var(--s0);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;z-index:9999}
    .ep-fullload-wrap{position:relative;width:64px;height:64px;display:flex;align-items:center;justify-content:center}
    .ep-fullload-ring{position:absolute;inset:0;border:3px solid rgba(37,99,235,.18);border-top-color:var(--blue);border-radius:50%;animation:ep-spin .85s linear infinite}
    .ep-fullload-icon{color:var(--blue);position:relative;z-index:1}
    .ep-fullload-text{font-size:.82rem;color:var(--tx2);margin-top:.25rem}
    .ep-fullload-dots{display:flex;gap:6px}
    .ep-fullload-dots span{width:6px;height:6px;border-radius:50%;background:var(--blue);opacity:.25;animation:ep-dot 1.2s ease-in-out infinite}
    .ep-fullload-dots span:nth-child(2){animation-delay:.2s}
    .ep-fullload-dots span:nth-child(3){animation-delay:.4s}
    @keyframes ep-dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}

    /* ─── Modals ─── */
    /* FIX: ep-overlay--top uses align-items:flex-start + paddingTop to prevent
       the modal from being clipped behind a fixed app/dashboard header.
       The modal scrolls internally so long content is still accessible. */
    .ep-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:50;padding:1rem;overflow-y:auto}
    .ep-overlay--top{align-items:flex-start;padding-top:max(env(safe-area-inset-top,0px) + 64px, 80px)}

    .ep-modal{background:var(--s1);border:1px solid var(--bd2);border-radius:var(--rxl);width:100%;box-shadow:var(--sh-lg);display:flex;flex-direction:column;max-height:calc(100vh - 100px);animation:ep-modal-in .24s ease}
    .ep-modal--wide{max-width:800px}
    .ep-modal--narrow{max-width:450px}
    @keyframes ep-modal-in{from{opacity:0;transform:scale(.97) translateY(14px)}to{opacity:1;transform:none}}

    .ep-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:.875rem;padding:1.25rem 1.375rem;border-bottom:1px solid var(--bd);background:var(--s1);border-radius:var(--rxl) var(--rxl) 0 0;position:sticky;top:0;z-index:10}
    .ep-modal-head-info{min-width:0}
    .ep-eyebrow{font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:4px}
    .ep-modal-h{font-size:1.25rem;font-weight:700;color:var(--tx);line-height:1.25;word-break:break-word}
    .ep-modal-h-sm{font-size:1rem;font-weight:600;color:var(--tx);line-height:1.35;word-break:break-word}
    .ep-modal-x{width:32px;height:32px;flex-shrink:0;border-radius:8px;background:var(--s2);border:1px solid var(--bd);color:var(--tx2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .18s;font-family:inherit}
    .ep-modal-x:hover:not(:disabled){background:var(--red-bg);border-color:var(--red-bd);color:#fca5a5}
    .ep-modal-x:disabled{opacity:.4;cursor:not-allowed}
    .ep-modal-body{padding:1.25rem 1.375rem;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:1rem}
    .ep-modal-foot{padding:1rem 1.375rem;border-top:1px solid var(--bd);background:var(--s1);border-radius:0 0 var(--rxl) var(--rxl);flex-shrink:0}

    .ep-modal-hero{border-radius:var(--r);overflow:hidden;height:200px}
    .ep-modal-hero-img{width:100%;height:100%;object-fit:cover;display:block}
    .ep-modal-desc{font-size:.855rem;color:var(--tx2);line-height:1.7}

    .ep-slabel{font-size:.67rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--blue);margin-bottom:.55rem;display:block}

    .ep-tile-grid{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
    @media(min-width:520px){.ep-tile-grid{grid-template-columns:repeat(4,1fr)}}
    .ep-tile{display:flex;align-items:flex-start;gap:8px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);padding:.7rem}
    .ep-tile-icon{color:var(--blue);flex-shrink:0;margin-top:1px}
    .ep-tile-label{font-size:.64rem;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
    .ep-tile-val{font-size:.84rem;font-weight:500;color:var(--tx)}

    .ep-ppanel{background:var(--s2);border:1px solid var(--bd);border-radius:var(--rl);padding:.9rem}
    .ep-ppanel-mainrow{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:.6rem;padding-bottom:.6rem;border-bottom:1px solid var(--bd)}
    .ep-ppanel-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;font-size:.82rem;margin-top:.45rem}
    .ep-price-hero{font-size:1.55rem;font-weight:700;color:var(--tx)}

    .ep-breakdown{display:flex;flex-direction:column;gap:.42rem;padding:.55rem 0 .65rem;border-bottom:1px solid var(--bd)}
    .ep-brow{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;font-size:.82rem}
    .ep-brow-val{color:var(--tx);font-weight:500}
    .ep-brow--savings{padding-top:.42rem;border-top:1px solid rgba(52,211,153,.15)}
    .ep-final-row{display:flex;align-items:center;justify-content:space-between;padding-top:.65rem}
    .ep-final-label{font-size:.9rem;font-weight:600;color:var(--tx)}
    .ep-final-val{font-size:1.6rem;font-weight:700;color:var(--blue)}

    .ep-code{font-family:monospace;font-size:.78em;background:var(--blue-bg);color:var(--blue);padding:1px 5px;border-radius:4px}

    .ep-list-items{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.45rem}
    .ep-list-item{display:flex;align-items:flex-start;gap:7px;font-size:.855rem;color:var(--tx2);line-height:1.5}

    .ep-file-grp{margin-bottom:.75rem}
    .ep-file-grp-label{font-size:.78rem;font-weight:600;color:var(--tx);margin-bottom:.35rem}
    .ep-file-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 11px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);text-decoration:none;color:var(--tx2);font-size:.83rem;transition:all .18s;margin-bottom:5px}
    .ep-file-row:hover{border-color:var(--bd2);color:var(--tx)}
    .ep-file-left{display:flex;align-items:center;gap:7px;min-width:0}
    .ep-dl-icon{color:var(--tx3);flex-shrink:0;transition:color .18s}
    .ep-file-row:hover .ep-dl-icon{color:var(--blue)}

    .ep-cpn-header{display:flex;align-items:center;gap:7px;margin-bottom:.55rem}
    .ep-applied-badge{margin-left:7px;background:var(--blue-bg);border:1px solid var(--blue-bd);color:var(--blue);font-size:.65rem;font-weight:700;padding:1px 7px;border-radius:20px}
    .ep-applied-list{display:flex;flex-direction:column;gap:5px;margin-bottom:.5rem}
    .ep-applied-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;background:var(--green-bg);border:1px solid var(--green-bd);border-radius:var(--r);padding:8px 11px}
    .ep-applied-left{display:flex;align-items:flex-start;gap:7px;min-width:0}
    .ep-remove-btn{background:transparent;border:none;color:var(--tx3);cursor:pointer;padding:2px;border-radius:4px;flex-shrink:0;transition:color .15s;font-family:inherit}
    .ep-remove-btn:hover:not(:disabled){color:#f87171}
    .ep-remove-btn:disabled{opacity:.4;cursor:not-allowed}
    .ep-cpn-row{display:flex;gap:7px;align-items:stretch}
    .ep-cpn-input-wrap{position:relative;flex:1}
    .ep-cpn-input{width:100%;box-sizing:border-box;background:var(--s2);border:1px solid var(--bd);color:var(--tx);border-radius:8px;padding:9px 28px 9px 11px;font-family:monospace;font-size:.84rem;outline:none;transition:border-color .18s,box-shadow .18s}
    .ep-cpn-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-bg)}
    .ep-cpn-input--err{border-color:var(--red)}
    .ep-cpn-input--err:focus{box-shadow:0 0 0 3px var(--red-bg)}
    .ep-cpn-clear{position:absolute;right:7px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--tx3);cursor:pointer;padding:3px;font-family:inherit}
    .ep-cpn-error{display:flex;align-items:center;gap:5px;color:#f87171;font-size:.76rem;margin-top:5px}
    .ep-cpn-hint{display:flex;align-items:center;gap:5px;font-size:.73rem;color:var(--tx3);margin-top:4px}

    .ep-cta-row{display:flex;gap:.55rem}
    .ep-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:.7rem;color:var(--tx3);margin-top:.25rem}

    /* ─── Responsive ─── */
    @media(max-width:479px){
      .ep-header{flex-direction:column;gap:.625rem}
      .ep-tab-bar{flex-direction:column;align-items:flex-start;border-bottom:none}
      .ep-tabs{border-bottom:1px solid var(--bd);width:100%}
      .ep-view-toggle{align-self:flex-end}
      .ep-modal-head{padding:.9rem 1rem}
      .ep-modal-body{padding:.9rem 1rem}
      .ep-modal-foot{padding:.9rem 1rem}
      .ep-modal--wide,.ep-modal--narrow{max-height:calc(100vh - 90px);border-radius:var(--rl)}
      .ep-overlay--top{padding-top:60px}
      .ep-tile-grid{grid-template-columns:1fr 1fr}
      .ep-cta-row{flex-direction:column}
      .ep-btn--cancel,.ep-btn--pay{flex:initial;width:100%}
      .ep-card-actions{flex-direction:column}
      .ep-btn--ghost,.ep-btn--primary,.ep-btn--enroll{flex:initial;width:100%}
    }
    @media(max-width:360px){
      .ep-tab{padding:.55rem .7rem;font-size:.78rem}
      .ep-page-h{font-size:1.2rem}
    }
  `}</style>
);

export default CourseEnrollment;
