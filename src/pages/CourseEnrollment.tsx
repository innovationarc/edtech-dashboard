// src/pages/CourseEnrollment.tsx - PART 1 OF 2
// PASTE THIS FIRST, THEN IMMEDIATELY PASTE PART 2

import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Star, 
  Clock, 
  Users, 
  Play, 
  BookOpen, 
  Award, 
  Eye,
  CheckCircle,
  Lock,
  Calendar,
  User,
  Video,
  FileText,
  Heart,
  X,
  Grid3X3,
  List,
  Loader,
  Tag,
  TrendingUp
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course } from '../services/courseService';

const CourseEnrollment = () => {
  const { user } = useDashboard();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const publishedCourses = await courseService.getPublishedCourses();
      
      // If user is logged in, check enrollment status
      if (user) {
        const enrollments = await courseService.getStudentEnrollments(user.uid);
        const enrolledCourseIds = enrollments.map(e => e.courseId);
        
        const coursesWithEnrollment = publishedCourses.map(course => ({
          ...course,
          isEnrolled: enrolledCourseIds.includes(course.id),
          progress: enrollments.find(e => e.courseId === course.id)?.progress || 0
        }));
        
        setCourses(coursesWithEnrollment);
      } else {
        setCourses(publishedCourses);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(courses.map(course => course.category))).filter(Boolean);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    const matchesLevel = selectedLevel === 'all' || course.level === selectedLevel;
    
    const matchesPrice = priceFilter === 'all' || 
                        (priceFilter === 'free' && course.price === 0) ||
                        (priceFilter === 'paid' && course.price > 0) ||
                        (priceFilter === 'under1000' && course.price < 1000) ||
                        (priceFilter === 'under5000' && course.price < 5000);
    
    return matchesSearch && matchesCategory && matchesLevel && matchesPrice;
  });

  const sortedCourses = [...filteredCourses].sort((a, b) => {
    switch (sortBy) {
      case 'popular': return b.studentCount - a.studentCount;
      case 'rating': return b.rating - a.rating;
      case 'newest': return b.createdAt.getTime() - a.createdAt.getTime();
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      default: return 0;
    }
  });

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
    setShowCourseModal(true);
  };

  const handleEnrollClick = async (course: Course) => {
    if (!user) {
      alert('Please login to enroll in courses');
      return;
    }

    if (course.price === 0) {
      // Free course - enroll directly
      await handleEnrollment(course);
    } else {
      // Paid course - for now just enroll (payment integration later)
      if (window.confirm(`This course costs ৳${course.price}. Payment integration will be added later. Enroll for free now?`)) {
        await handleEnrollment(course);
      }
    }
  };

  const handleEnrollment = async (course: Course) => {
    if (!user) return;
    
    try {
      setEnrolling(true);
      console.log('Starting enrollment process for course:', course.title);
      
      const enrollmentData = {
        courseId: course.id,
        studentId: user.uid,
        studentName: user.name,
        progress: 0,
        completedLessons: [],
        lastAccessedAt: new Date()
      };
      
      console.log('Enrollment data:', enrollmentData);
      
      const enrollmentId = await courseService.enrollStudent(enrollmentData);
      console.log('Enrollment created with ID:', enrollmentId);
      
      // Update local state
      setCourses(prevCourses => 
        prevCourses.map(c => 
          c.id === course.id ? { ...c, isEnrolled: true, progress: 0 } : c
        )
      );
      
      setShowCourseModal(false);
      
      const message = course.price === 0 
        ? `Successfully enrolled in "${course.title}"! You can now access all course materials in your Content Library.`
        : `Successfully enrolled in "${course.title}"! All course materials have been added to your Content Library.`;
      
      alert(message);
      
      console.log('Enrollment process completed successfully');
    } catch (error: any) {
      console.error('Error enrolling in course:', error);
      alert(`Failed to enroll in course: ${error.message}. Please try again.`);
    } finally {
      setEnrolling(false);
    }
  };

  const toggleFavorite = (courseId: string) => {
    setCourses(prevCourses => 
      prevCourses.map(course => 
        course.id === courseId 
          ? { ...course, isFavorite: !course.isFavorite }
          : course
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Course Enrollment</h1>
          <p className="text-gray-400 mt-1 text-sm lg:text-base">Discover and enroll in courses to advance your learning</p>
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

      {/* Mobile Filters Toggle */}
      <div className="lg:hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between bg-background-800 text-white py-3 px-4 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} />
            <span>Filters & Search</span>
          </div>
          <span className="text-sm text-gray-400">
            {sortedCourses.length} courses
          </span>
        </button>
      </div>

      {/* Filters */}
      <Card className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-6 lg:gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search courses..."
              className="w-full bg-background-800 text-white rounded-lg py-3 lg:py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-3.5 lg:top-2.5 text-gray-400" />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-3 lg:py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-3 lg:py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-3 lg:py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Prices</option>
            <option value="free">Free</option>
            <option value="under1000">Under ৳1000</option>
            <option value="under5000">Under ৳5000</option>
            <option value="paid">Paid</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full bg-background-800 text-white rounded-lg py-3 lg:py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>

          <div className="flex items-center justify-between lg:justify-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <span className="text-sm text-gray-400">
              {sortedCourses.length} courses
            </span>
          </div>
        </div>
      </Card>

      {/* Course Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onCourseClick={handleCourseClick}
              onEnrollClick={handleEnrollClick}
              onToggleFavorite={toggleFavorite}
              enrolling={enrolling}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedCourses.map(course => (
            <CourseListItem
              key={course.id}
              course={course}
              onCourseClick={handleCourseClick}
              onEnrollClick={handleEnrollClick}
              onToggleFavorite={toggleFavorite}
              enrolling={enrolling}
            />
          ))}
        </div>
      )}

      {sortedCourses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No courses found</h3>
          <p className="text-gray-400">
            Try adjusting your search criteria or filters.
          </p>
        </div>
      )}

      {/* Course Detail Modal */}
      {showCourseModal && selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => setShowCourseModal(false)}
          onEnroll={handleEnrollClick}
          enrolling={enrolling}
        />
      )}
    </div>
  );
};

// Course Card Component
interface CourseCardProps {
  course: Course & { isEnrolled?: boolean; progress?: number; isFavorite?: boolean };
  onCourseClick: (course: Course) => void;
  onEnrollClick: (course: Course) => void;
  onToggleFavorite: (courseId: string) => void;
  enrolling: boolean;
}

const CourseCard = ({ course, onCourseClick, onEnrollClick, onToggleFavorite, enrolling }: CourseCardProps) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-success-dark text-success-light';
      case 'intermediate': return 'bg-warning-dark text-warning-light';
      case 'advanced': return 'bg-error-dark text-error-light';
      default: return 'bg-background-700 text-gray-300';
    }
  };

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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(course.id);
            }}
            className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
              course.isFavorite 
                ? 'bg-red-500 text-white' 
                : 'bg-black/50 text-white hover:bg-red-500'
            }`}
          >
            <Heart size={16} className={course.isFavorite ? 'fill-current' : ''} />
          </button>
        </div>
        <div className="absolute bottom-3 left-3">
          <span className={`px-2 py-1 rounded-full text-xs ${getLevelColor(course.level)}`}>
            {course.level}
          </span>
        </div>
        {course.isEnrolled && (
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
          onClick={() => onCourseClick(course)}
        >
          {course.title}
        </h3>

        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center gap-2 mb-3">
          <User size={14} className="text-gray-400" />
          <span className="text-sm text-gray-300 truncate">{course.instructor}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <span className="text-sm text-gray-400">{course.duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-white">
              {course.price === 0 ? 'Free' : `৳${course.price}`}
            </span>
          </div>
        </div>

        {/* Additional Features Display */}
        {(course.hasQnA || course.hasStudyPlanner) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {course.hasQnA && (
              <span className="px-2 py-1 bg-primary-900/30 text-primary-300 text-xs rounded flex items-center gap-1">
                <BookOpen size={12} />
                Q&A
              </span>
            )}
            {course.hasStudyPlanner && (
              <span className="px-2 py-1 bg-secondary-900/30 text-secondary-300 text-xs rounded flex items-center gap-1">
                <Calendar size={12} />
                Study Planner
              </span>
            )}
          </div>
        )}

        {course.isEnrolled ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Progress</span>
              <span className="text-white">{course.progress}%</span>
            </div>
            <div className="w-full bg-background-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-success-DEFAULT"
                style={{ width: `${course.progress}%` }}
              ></div>
            </div>
            <button
              onClick={() => onCourseClick(course)}
              className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Continue Learning
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onCourseClick(course)}
              className="flex-1 py-2 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Eye size={16} />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() => onEnrollClick(course)}
              disabled={enrolling}
              className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {enrolling ? (
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

// DO NOT ADD ANYTHING HERE - CONTINUE WITH PART 2

// src/pages/CourseEnrollment.tsx - PART 2 OF 2
// PASTE THIS IMMEDIATELY AFTER PART 1

// Course List Item Component
interface CourseListItemProps extends CourseCardProps {}

const CourseListItem = ({ course, onCourseClick, onEnrollClick, onToggleFavorite, enrolling }: CourseListItemProps) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-success-dark text-success-light';
      case 'intermediate': return 'bg-warning-dark text-warning-light';
      case 'advanced': return 'bg-error-dark text-error-light';
      default: return 'bg-background-700 text-gray-300';
    }
  };

  return (
    <Card className="p-4 hover:bg-background-800/50 transition-colors">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-shrink-0">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full sm:w-32 h-24 object-cover rounded-lg"
              loading="lazy"
            />
          ) : (
            <div className="w-full sm:w-32 h-24 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-lg flex items-center justify-center">
              <BookOpen size={24} className="text-white opacity-50" />
            </div>
          )}
          {course.isEnrolled && (
            <div className="absolute -top-2 -right-2">
              <span className="px-2 py-1 bg-success-DEFAULT text-white rounded-full text-xs flex items-center gap-1">
                <CheckCircle size={12} />
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 
                className="text-white font-medium mb-1 cursor-pointer hover:text-primary-300 transition-colors line-clamp-1"
                onClick={() => onCourseClick(course)}
              >
                {course.title}
              </h3>
              <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                {course.description}
              </p>
            </div>
            <button
              onClick={() => onToggleFavorite(course.id)}
              className={`p-2 rounded-full transition-colors ml-4 ${
                course.isFavorite 
                  ? 'text-red-500' 
                  : 'text-gray-400 hover:text-red-500'
              }`}
            >
              <Heart size={16} className={course.isFavorite ? 'fill-current' : ''} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 text-sm">
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <span className="text-gray-300 truncate">{course.instructor}</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${getLevelColor(course.level)}`}>
              {course.level}
            </span>
            <div className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400 fill-current" />
              <span className="text-white">{course.rating.toFixed(1)}</span>
              <span className="text-gray-400">({course.reviewCount})</span>
            </div>
            {course.hasQnA && (
              <span className="px-2 py-1 bg-primary-900/30 text-primary-300 text-xs rounded">
                Q&A
              </span>
            )}
            {course.hasStudyPlanner && (
              <span className="px-2 py-1 bg-secondary-900/30 text-secondary-300 text-xs rounded">
                Study Planner
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Clock size={14} className="text-gray-400" />
                <span className="text-gray-400">{course.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users size={14} className="text-gray-400" />
                <span className="text-gray-400">{course.studentCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen size={14} className="text-gray-400" />
                <span className="text-gray-400">{course.lessons?.length || 0} lessons</span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {course.price === 0 ? 'Free' : `৳${course.price}`}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onCourseClick(course)}
                  className="py-2 px-4 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Eye size={16} />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                {!course.isEnrolled && (
                  <button
                    onClick={() => onEnrollClick(course)}
                    disabled={enrolling}
                    className="py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {enrolling ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <>
                        <TrendingUp size={16} />
                        <span>Enroll</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// Course Detail Modal Component
interface CourseDetailModalProps {
  course: Course & { isEnrolled?: boolean };
  onClose: () => void;
  onEnroll: (course: Course) => void;
  enrolling: boolean;
}

const CourseDetailModal = ({ course, onClose, onEnroll, enrolling }: CourseDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'instructor'>('overview');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="relative">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-48 sm:h-64 object-cover"
            />
          ) : (
            <div className="w-full h-48 sm:h-64 bg-gradient-to-r from-primary-600 to-secondary-600 flex items-center justify-center">
              <BookOpen size={64} className="text-white opacity-50" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <X size={20} />
          </button>
          {course.previewVideo && (
            <button className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <Play size={32} className="text-white ml-1" />
              </div>
            </button>
          )}
        </div>

        <div className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-4 gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-2">{course.title}</h2>
              <p className="text-gray-400 mb-4">{course.description}</p>
              
              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-gray-400" />
                  <span className="text-white">{course.instructor}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-yellow-400 fill-current" />
                  <span className="text-white">{course.rating.toFixed(1)}</span>
                  <span className="text-gray-400">({course.reviewCount} reviews)</span>
                </div>
                <span className="text-gray-400">{course.studentCount.toLocaleString()} students</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  course.level === 'beginner' ? 'bg-success-dark text-success-light' :
                  course.level === 'intermediate' ? 'bg-warning-dark text-warning-light' :
                  'bg-error-dark text-error-light'
                }`}>
                  {course.level}
                </span>
              </div>

              {/* Additional Features */}
              {(course.hasQnA || course.hasStudyPlanner) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {course.hasQnA && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary-900/30 border border-primary-700 rounded-lg">
                      <BookOpen size={16} className="text-primary-400" />
                      <span className="text-primary-300 text-sm">Q&A Available</span>
                    </div>
                  )}
                  {course.hasStudyPlanner && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-secondary-900/30 border border-secondary-700 rounded-lg">
                      <Calendar size={16} className="text-secondary-400" />
                      <span className="text-secondary-300 text-sm">Study Planner Included</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-center lg:text-right lg:ml-6">
              <div className="mb-4">
                <div className="text-2xl font-bold text-white">
                  {course.price === 0 ? 'Free' : `৳${course.price}`}
                </div>
              </div>
              
              {!course.isEnrolled && (
                <button
                  onClick={() => onEnroll(course)}
                  disabled={enrolling}
                  className="w-full lg:w-auto py-3 px-6 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {enrolling ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      <span>Enrolling...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp size={20} />
                      <span>Enroll Now & Access in Library</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-background-800 mb-6">
            <div className="flex gap-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'curriculum', label: 'Curriculum' },
                { id: 'instructor', label: 'Instructor' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-500'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="max-h-96 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">What you'll learn</h3>
                  <ul className="space-y-2">
                    {course.whatYouWillLearn.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle size={16} className="text-success-DEFAULT mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Requirements</h3>
                  <ul className="space-y-2">
                    {course.requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={16} className="text-primary-400" />
                      <span className="text-white font-medium">Duration</span>
                    </div>
                    <span className="text-gray-300">{course.duration}</span>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={16} className="text-primary-400" />
                      <span className="text-white font-medium">Level</span>
                    </div>
                    <span className="text-gray-300 capitalize">{course.level}</span>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={16} className="text-primary-400" />
                      <span className="text-white font-medium">Lessons</span>
                    </div>
                    <span className="text-gray-300">{course.lessons?.length || 0} lessons</span>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag size={16} className="text-primary-400" />
                      <span className="text-white font-medium">Category</span>
                    </div>
                    <span className="text-gray-300">{course.category}</span>
                  </div>
                </div>

                {course.tags && course.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {course.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-primary-900/30 text-primary-300 rounded-full text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Course Content</h3>
                {course.lessons && course.lessons.length > 0 ? (
                  course.lessons.map((lesson, index) => (
                    <div key={lesson.id} className="flex items-center justify-between p-3 bg-background-800 rounded-lg hover:bg-background-700 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-gray-400 text-sm flex-shrink-0">{index + 1}.</span>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {lesson.type === 'video' && <Video size={16} className="text-primary-400 flex-shrink-0" />}
                          {lesson.type === 'text' && <FileText size={16} className="text-secondary-400 flex-shrink-0" />}
                          {lesson.type === 'quiz' && <Award size={16} className="text-accent-400 flex-shrink-0" />}
                          <span className="text-white truncate">{lesson.title}</span>
                        </div>
                        {lesson.isPreview && (
                          <span className="px-2 py-1 bg-success-dark text-success-light text-xs rounded flex-shrink-0">
                            Preview
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-gray-400 text-sm">{lesson.duration}</span>
                        {!lesson.isPreview && !course.isEnrolled && (
                          <Lock size={16} className="text-gray-500" />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <BookOpen size={48} className="mx-auto text-gray-500 mb-4" />
                    <p className="text-gray-400">No lessons added yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'instructor' && (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl text-white">
                      {course.instructor.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{course.instructor}</h3>
                    <p className="text-gray-400 text-sm mb-3">Course Instructor</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-gray-300">{course.studentCount.toLocaleString()} students</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-gray-400" />
                        <span className="text-gray-300">Instructor ID: {course.instructorId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseEnrollment;
