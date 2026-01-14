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
  ShoppingCart,
  Eye,
  CheckCircle,
  Lock,
  DollarSign,
  Calendar,
  User,
  Video,
  FileText,
  Download,
  Heart,
  Share2,
  X,
  Grid3X3,
  List,
  Loader
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService } from '../services/courseService';

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorAvatar: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  studentCount: number;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  thumbnail: string;
  previewVideo?: string;
  lessons: CourseLesson[];
  requirements: string[];
  whatYouWillLearn: string[];
  createdAt: Date;
  updatedAt: Date;
  isEnrolled?: boolean;
  isFavorite?: boolean;
  progress?: number;
}

interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  isPreview: boolean;
  isCompleted?: boolean;
}

interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  enrolledAt: Date;
  progress: number;
  completedLessons: string[];
  lastAccessedAt: Date;
}

const CourseEnrollment = () => {
  const { user } = useDashboard();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sample courses data
  const sampleCourses: Course[] = [
    {
      id: '1',
      title: 'Complete Python Programming Bootcamp',
      description: 'Master Python programming from basics to advanced concepts. Build real-world projects and become a Python developer.',
      instructor: 'Dr. Sarah Johnson',
      instructorAvatar: 'SJ',
      price: 89.99,
      originalPrice: 199.99,
      rating: 4.8,
      reviewCount: 2847,
      studentCount: 15420,
      duration: '42 hours',
      level: 'beginner',
      category: 'Programming',
      tags: ['Python', 'Programming', 'Web Development', 'Data Science'],
      thumbnail: 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg',
      previewVideo: 'https://example.com/preview1.mp4',
      lessons: [
        { id: '1', title: 'Introduction to Python', duration: '15 min', type: 'video', isPreview: true },
        { id: '2', title: 'Setting up Development Environment', duration: '20 min', type: 'video', isPreview: true },
        { id: '3', title: 'Variables and Data Types', duration: '25 min', type: 'video', isPreview: false },
        { id: '4', title: 'Control Structures', duration: '30 min', type: 'video', isPreview: false },
        { id: '5', title: 'Functions and Modules', duration: '35 min', type: 'video', isPreview: false },
      ],
      requirements: ['Basic computer skills', 'No programming experience required'],
      whatYouWillLearn: [
        'Python fundamentals and syntax',
        'Object-oriented programming',
        'Web development with Flask/Django',
        'Data analysis with pandas',
        'Build real-world projects'
      ],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-12-01'),
    },
    {
      id: '2',
      title: 'Advanced Mathematics for Engineers',
      description: 'Comprehensive course covering calculus, linear algebra, and differential equations for engineering applications.',
      instructor: 'Prof. Michael Chen',
      instructorAvatar: 'MC',
      price: 129.99,
      originalPrice: 249.99,
      rating: 4.9,
      reviewCount: 1523,
      studentCount: 8750,
      duration: '38 hours',
      level: 'advanced',
      category: 'Mathematics',
      tags: ['Calculus', 'Linear Algebra', 'Engineering', 'Mathematics'],
      thumbnail: 'https://images.pexels.com/photos/3729557/pexels-photo-3729557.jpeg',
      lessons: [
        { id: '1', title: 'Course Overview', duration: '10 min', type: 'video', isPreview: true },
        { id: '2', title: 'Limits and Continuity', duration: '45 min', type: 'video', isPreview: false },
        { id: '3', title: 'Derivatives and Applications', duration: '50 min', type: 'video', isPreview: false },
      ],
      requirements: ['Basic calculus knowledge', 'High school mathematics'],
      whatYouWillLearn: [
        'Advanced calculus techniques',
        'Linear algebra applications',
        'Differential equations solving',
        'Engineering problem solving'
      ],
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-11-15'),
    },
    {
      id: '3',
      title: 'Digital Marketing Masterclass',
      description: 'Learn modern digital marketing strategies, SEO, social media marketing, and analytics to grow your business.',
      instructor: 'Emma Rodriguez',
      instructorAvatar: 'ER',
      price: 79.99,
      rating: 4.7,
      reviewCount: 3241,
      studentCount: 22100,
      duration: '28 hours',
      level: 'intermediate',
      category: 'Business',
      tags: ['Marketing', 'SEO', 'Social Media', 'Analytics'],
      thumbnail: 'https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg',
      lessons: [
        { id: '1', title: 'Digital Marketing Fundamentals', duration: '20 min', type: 'video', isPreview: true },
        { id: '2', title: 'SEO Basics', duration: '30 min', type: 'video', isPreview: false },
      ],
      requirements: ['Basic computer skills', 'Interest in marketing'],
      whatYouWillLearn: [
        'SEO optimization techniques',
        'Social media marketing strategies',
        'Google Analytics setup',
        'Content marketing best practices'
      ],
      createdAt: new Date('2024-03-10'),
      updatedAt: new Date('2024-12-05'),
    },
    {
      id: '4',
      title: 'Introduction to Data Science',
      description: 'Start your data science journey with Python, statistics, and machine learning fundamentals.',
      instructor: 'Dr. Alex Kumar',
      instructorAvatar: 'AK',
      price: 99.99,
      originalPrice: 179.99,
      rating: 4.6,
      reviewCount: 1876,
      studentCount: 12340,
      duration: '35 hours',
      level: 'beginner',
      category: 'Data Science',
      tags: ['Data Science', 'Python', 'Statistics', 'Machine Learning'],
      thumbnail: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg',
      lessons: [
        { id: '1', title: 'What is Data Science?', duration: '15 min', type: 'video', isPreview: true },
        { id: '2', title: 'Python for Data Science', duration: '40 min', type: 'video', isPreview: false },
      ],
      requirements: ['Basic programming knowledge helpful but not required'],
      whatYouWillLearn: [
        'Data analysis with Python',
        'Statistical concepts',
        'Machine learning basics',
        'Data visualization'
      ],
      createdAt: new Date('2024-04-05'),
      updatedAt: new Date('2024-11-20'),
    },
    {
      id: '5',
      title: 'Free Web Development Basics',
      description: 'Learn HTML, CSS, and JavaScript fundamentals for free. Perfect for beginners starting their web development journey.',
      instructor: 'John Smith',
      instructorAvatar: 'JS',
      price: 0,
      rating: 4.5,
      reviewCount: 5432,
      studentCount: 45600,
      duration: '20 hours',
      level: 'beginner',
      category: 'Programming',
      tags: ['HTML', 'CSS', 'JavaScript', 'Web Development'],
      thumbnail: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg',
      lessons: [
        { id: '1', title: 'HTML Basics', duration: '25 min', type: 'video', isPreview: true },
        { id: '2', title: 'CSS Styling', duration: '30 min', type: 'video', isPreview: true },
      ],
      requirements: ['Basic computer skills'],
      whatYouWillLearn: [
        'HTML structure and elements',
        'CSS styling and layouts',
        'JavaScript fundamentals',
        'Building responsive websites'
      ],
      createdAt: new Date('2024-05-01'),
      updatedAt: new Date('2024-12-01'),
    }
  ];

  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      // Fetch courses from Firestore
      const coursesFromDb = await courseService.getPublishedCourses();
      setCourses(coursesFromDb);
    } catch (error) {
      console.error('Error loading courses:', error);
      // Fallback to sample courses if Firestore fails
      setCourses(sampleCourses);
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async () => {
    if (!user) return;
    
    try {
      // In a real app, this would fetch user's enrollments
      const sampleEnrollments: Enrollment[] = [
        {
          id: '1',
          courseId: '1',
          studentId: user.uid,
          enrolledAt: new Date('2024-11-01'),
          progress: 65,
          completedLessons: ['1', '2', '3'],
          lastAccessedAt: new Date('2024-12-15')
        }
      ];
      setEnrollments(sampleEnrollments);
      
      // Update courses with enrollment status
      setCourses(prevCourses => 
        prevCourses.map(course => ({
          ...course,
          isEnrolled: sampleEnrollments.some(e => e.courseId === course.id),
          progress: sampleEnrollments.find(e => e.courseId === course.id)?.progress || 0
        }))
      );
    } catch (error) {
      console.error('Error loading enrollments:', error);
    }
  };

  const categories = Array.from(new Set(courses.map(course => course.category)));

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
                        (priceFilter === 'under50' && course.price < 50) ||
                        (priceFilter === 'under100' && course.price < 100);
    
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

  const handleEnrollClick = (course: Course) => {
    if (course.price === 0) {
      // Free course - enroll directly
      handleEnrollment(course);
    } else {
      // Paid course - show payment modal
      setSelectedCourse(course);
      setShowPaymentModal(true);
    }
  };

  const handleEnrollment = async (course: Course) => {
    if (!user) return;
    
    try {
      console.log('Starting enrollment process for course:', course.title);
      
      // Create enrollment in database
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
      const newEnrollment: Enrollment = {
        id: enrollmentId,
        ...enrollmentData,
        enrolledAt: new Date()
      };
      
      setEnrollments(prev => [...prev, newEnrollment]);
      setCourses(prevCourses => 
        prevCourses.map(c => 
          c.id === course.id ? { ...c, isEnrolled: true, progress: 0 } : c
        )
      );
      
      setShowPaymentModal(false);
      
      // Show success message with more details
      const message = course.price === 0 
        ? `Successfully enrolled in "${course.title}"! You can now access all course materials in your Content Library.`
        : `Payment successful! You are now enrolled in "${course.title}". All course materials have been added to your Content Library.`;
      
      alert(message);
      
      console.log('Enrollment process completed successfully');
    } catch (error) {
      console.error('Error enrolling in course:', error);
      alert(`Failed to enroll in course: ${error.message}. Please try again.`);
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
          <h1 className="responsive-heading">Course Enrollment</h1>
          <p className="text-gray-400 mt-1 text-sm lg:text-base">Discover and enroll in courses to advance your learning</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded touch-target ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400'}`}
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded touch-target ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400'}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Mobile Filters Toggle */}
      <div className="lg:hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full mobile-button bg-background-800 text-white"
        >
          <Filter size={18} />
          <span>Filters & Search</span>
          <span className="ml-auto text-sm text-gray-400">
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
            <option value="under50">Under $50</option>
            <option value="under100">Under $100</option>
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
        <div className="mobile-grid">
          {sortedCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onCourseClick={handleCourseClick}
              onEnrollClick={handleEnrollClick}
              onToggleFavorite={toggleFavorite}
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
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCourse && (
        <PaymentModal
          course={selectedCourse}
          onClose={() => setShowPaymentModal(false)}
          onPaymentSuccess={() => handleEnrollment(selectedCourse)}
        />
      )}
    </div>
  );
};

// Course Card Component
interface CourseCardProps {
  course: Course;
  onCourseClick: (course: Course) => void;
  onEnrollClick: (course: Course) => void;
  onToggleFavorite: (courseId: string) => void;
}

const CourseCard = ({ course, onCourseClick, onEnrollClick, onToggleFavorite }: CourseCardProps) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-success-dark text-success-light';
      case 'intermediate': return 'bg-warning-dark text-warning-light';
      case 'advanced': return 'bg-error-dark text-error-light';
      default: return 'bg-background-700 text-gray-300';
    }
  };

  return (
    <Card className="p-0 responsive-card group overflow-hidden">
      <div className="relative">
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-40 sm:h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(course.id);
            }}
            className={`p-2 rounded-full backdrop-blur-sm transition-colors touch-target ${
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
            <span className="text-white">{course.rating}</span>
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
          <div className="h-6 w-6 rounded-full bg-primary-700 flex items-center justify-center">
            <span className="text-xs text-white">{course.instructorAvatar}</span>
          </div>
          <span className="text-sm text-gray-300 truncate">{course.instructor}</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-400" />
            <span className="text-sm text-gray-400">{course.duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign size={14} className="text-success-DEFAULT" />
            <span className="text-lg font-bold text-white">{course.price === 0 ? 'Free' : `$${course.price}`}</span>
            {course.originalPrice && course.originalPrice > course.price && (
              <span className="text-sm text-gray-400 line-through ml-1">${course.originalPrice}</span>
            )}
          </div>
        </div>

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
              className="w-full mobile-button bg-primary-600 hover:bg-primary-700 text-white"
            >
              Continue Learning
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onCourseClick(course)}
              className="flex-1 mobile-button bg-background-700 hover:bg-background-600 text-white"
            >
              <Eye size={16} />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() => onEnrollClick(course)}
              className="flex-1 mobile-button bg-primary-600 hover:bg-primary-700 text-white"
            >
              <ShoppingCart size={16} />
              <span>{course.price === 0 ? 'Enroll' : 'Buy & Access'}</span>
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

// Course List Item Component
interface CourseListItemProps extends CourseCardProps {}

const CourseListItem = ({ course, onCourseClick, onEnrollClick, onToggleFavorite }: CourseListItemProps) => {
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
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full sm:w-32 h-24 object-cover rounded-lg"
            loading="lazy"
          />
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
              className={`p-2 rounded-full transition-colors ml-4 touch-target ${
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
              <div className="h-6 w-6 rounded-full bg-primary-700 flex items-center justify-center">
                <span className="text-xs text-white">{course.instructorAvatar}</span>
              </div>
              <span className="text-gray-300 truncate">{course.instructor}</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs ${getLevelColor(course.level)}`}>
              {course.level}
            </span>
            <div className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400 fill-current" />
              <span className="text-white">{course.rating}</span>
              <span className="text-gray-400">({course.reviewCount})</span>
            </div>
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
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <DollarSign size={16} className="text-success-DEFAULT" />
                  <span className="text-lg font-bold text-white">
                    {course.price === 0 ? 'Free' : `$${course.price}`}
                  </span>
                </div>
                {course.originalPrice && course.originalPrice > course.price && (
                  <span className="text-sm text-gray-400 line-through">${course.originalPrice}</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onCourseClick(course)}
                  className="mobile-button bg-background-700 hover:bg-background-600 text-white px-4"
                >
                  <Eye size={16} />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                {!course.isEnrolled && (
                  <button
                    onClick={() => onEnrollClick(course)}
                    className="mobile-button bg-primary-600 hover:bg-primary-700 text-white px-4"
                  >
                    <ShoppingCart size={16} />
                    <span>{course.price === 0 ? 'Enroll' : 'Buy & Access'}</span>
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
  course: Course;
  onClose: () => void;
  onEnroll: (course: Course) => void;
}

const CourseDetailModal = ({ course, onClose, onEnroll }: CourseDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'curriculum' | 'reviews'>('overview');

  return (
    <div className="mobile-modal">
      <div className="mobile-modal-content">
        <div className="relative">
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-48 sm:h-64 object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors touch-target"
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
                  <div className="h-8 w-8 rounded-full bg-primary-700 flex items-center justify-center">
                    <span className="text-sm text-white">{course.instructorAvatar}</span>
                  </div>
                  <span className="text-white">{course.instructor}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-yellow-400 fill-current" />
                  <span className="text-white">{course.rating}</span>
                  <span className="text-gray-400">({course.reviewCount} reviews)</span>
                </div>
                <span className="text-gray-400">{course.studentCount.toLocaleString()} students</span>
              </div>
            </div>

            <div className="text-center lg:text-right lg:ml-6">
              <div className="mb-4">
                <div className="flex items-center gap-1 justify-center lg:justify-end">
                  <DollarSign size={20} className="text-success-DEFAULT" />
                  <span className="text-2xl font-bold text-white">
                    {course.price === 0 ? 'Free' : `$${course.price}`}
                  </span>
                </div>
                {course.originalPrice && course.originalPrice > course.price && (
                  <span className="text-gray-400 line-through">${course.originalPrice}</span>
                )}
              </div>
              
              {!course.isEnrolled && (
                <button
                  onClick={() => onEnroll(course)}
                  className="w-full lg:w-auto mobile-button bg-primary-600 hover:bg-primary-700 text-white px-6"
                >
                  <ShoppingCart size={20} />
                  {course.price === 0 ? 'Enroll Now' : 'Buy & Access in Library'}
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
                { id: 'reviews', label: 'Reviews' }
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
                </div>
              </div>
            )}

            {activeTab === 'curriculum' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Course Content</h3>
                {course.lessons.map((lesson, index) => (
                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-background-800 rounded-lg">
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
                      {lesson.isCompleted && (
                        <CheckCircle size={16} className="text-success-DEFAULT" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Student Reviews</h3>
                <div className="text-center py-8">
                  <Star size={48} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400">Reviews will be displayed here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Payment Modal Component
interface PaymentModalProps {
  course: Course;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const PaymentModal = ({ course, onClose, onPaymentSuccess }: PaymentModalProps) => {
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false);
      onPaymentSuccess();
    }, 2000);
  };

  return (
    <div className="mobile-modal">
      <div className="mobile-modal-content max-w-md">
        <div className="flex items-center justify-between mb-6 p-4 lg:p-6 border-b border-background-800">
          <h2 className="text-xl font-bold text-white">Complete Purchase</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white touch-target"
            disabled={processing}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 lg:p-6 space-y-6">
          <div>
            <div className="flex gap-3 mb-4">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-16 h-12 object-cover rounded"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-medium line-clamp-1">{course.title}</h3>
                <p className="text-gray-400 text-sm line-clamp-1">{course.instructor}</p>
              </div>
            </div>
            
            <div className="bg-background-800 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Course Price:</span>
                <span className="text-xl font-bold text-white">${course.price}</span>
              </div>
              {course.originalPrice && course.originalPrice > course.price && (
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-400">Original Price:</span>
                  <span className="text-gray-400 line-through">${course.originalPrice}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Card Number</label>
              <input
                type="text"
                placeholder="1234 5678 9012 3456"
                className="w-full bg-background-800 text-white rounded-lg py-3 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={processing}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Expiry</label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={processing}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">CVV</label>
                <input
                  type="text"
                  placeholder="123"
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={processing}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full mobile-button bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ShoppingCart size={16} />
                <span>Buy Course & Add to Library - ${course.price}</span>
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            After purchase, course content will be available in your Content Library
          </p>
        </div>
      </div>
    </div>
  );
};

export default CourseEnrollment;