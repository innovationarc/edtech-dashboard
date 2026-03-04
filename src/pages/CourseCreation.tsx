// src/pages/CourseCreation.tsx - Part 1/5
// COMPLETE REWRITE: Course List + Creation with Hierarchical Content Structure

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Upload, 
  Save, 
  Image as ImageIcon,
  Trash2,
  Loader,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Edit,
  BarChart3,
  Calendar,
  Users,
  FileText,
  ChevronDown,
  ChevronRight,
  GripVertical,
  FolderPlus,
  FilePlus,
  Download,
  Clock,
  Tag,
  Award,
  DollarSign,
  MessageSquare,
  CalendarCheck,
  Brain,
  UserCheck
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course } from '../services/courseService';
import { contentService, Content } from '../services/contentService';
import { uploadService } from '../services/uploadService';
import { useNavigate, useParams } from 'react-router-dom';
import { courseAssignmentService, CourseAssignment } from '../services/courseAssignmentService';

// ==================== INTERFACES ====================

interface CourseFormData {
  courseId: string; // Immutable after creation
  title: string;
  description: string;
  price: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'unspecified';
  category: string;
  class: string;
  subjects: string[]; // Auto-inherited from lessons
  tags: string[];
  requirements: string[];
  whatYouWillLearn: string[];
  thumbnailFile?: File;
  existingThumbnail?: string;
  validity: Date | null; // How long students can access
  
  // Discounts - ALL IN BDT
  previousStudentDiscount: number; // Amount in BDT
  extraDiscount: number; // Amount in BDT
  extraDiscountValidUntil: Date | null;
  
  // Routine & Other Files
  routineFiles: RoutineFile[];
  
  // Content Structure
  contentStructure: ContentNode[];
  
  // Special Features
  hasAiQnA: boolean;
  hasHumanQnA: boolean;
  hasStudyPlanner: boolean;
  
  // Status
  isPublished: boolean;
  isDraft: boolean;
}

interface RoutineFile {
  id: string;
  file?: File;
  existingUrl?: string;
  fileName?: string;
  category: string; // e.g., "routine", "leaflet", "outline"
}

interface ContentNode {
  id: string;
  type: 'folder' | 'content';
  name: string;
  contentId?: string; // For content type
  contentData?: Content; // Cached content data
  children: ContentNode[];
  isExpanded?: boolean;
  order: number;
}

interface CourseAnalytics {
  totalEnrollments: number;
  activeStudents: number;
  completionRate: number;
  averageProgress: number;
  revenue: number;
  enrollmentsByDate: Array<{ date: string; count: number }>;
  topPerformers: Array<{ studentName: string; progress: number }>;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ==================== MAIN COMPONENT ====================

const CourseCreation = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const { courseId: routeCourseId } = useParams<{ courseId: string }>();

  // ==================== VIEW MODE STATE ====================
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [showOverview, setShowOverview] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showContentPicker, setShowContentPicker] = useState(false);
  const [selectedParentNode, setSelectedParentNode] = useState<ContentNode | null>(null);

  // ==================== COURSE LIST STATE ====================
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // ==================== SEARCH & FILTER STATE ====================
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSituation, setFilterSituation] = useState<'all' | 'published' | 'draft' | 'unpublished'>('all');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  
  // ==================== FILTER OPTIONS STATE ====================
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // ==================== LOADING & MESSAGES STATE ====================
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // ==================== ANALYTICS STATE ====================
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ==================== FORM STATE ====================
  const [formData, setFormData] = useState<CourseFormData>({
    courseId: '',
    title: '',
    description: '',
    price: 0,
    level: 'unspecified',
    category: 'Unspecified',
    class: '',
    subjects: [],
    tags: [],
    requirements: [''],
    whatYouWillLearn: [''],
    validity: null,
    previousStudentDiscount: 0, // Changed to BDT
    extraDiscount: 0,
    extraDiscountValidUntil: null,
    routineFiles: [],
    contentStructure: [],
    hasAiQnA: false,
    hasHumanQnA: false,
    hasStudyPlanner: false,
    isPublished: false,
    isDraft: true
  });

  const [currentTag, setCurrentTag] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');

  // ==================== CONTENT PICKER STATE ====================
  const [availableContent, setAvailableContent] = useState<Content[]>([]);
  const [contentSearchTerm, setContentSearchTerm] = useState('');
  const [filteredContent, setFilteredContent] = useState<Content[]>([]);

  // ==================== DRAG & DROP STATE ====================
  const [draggedNode, setDraggedNode] = useState<ContentNode | null>(null);
  const [dragOverNode, setDragOverNode] = useState<ContentNode | null>(null);

  // ==================== ASSIGNMENT & PERMISSION STATE ====================
  // For teachers: their course assignments (editing permission) and creation permission
  const [teacherAssignments, setTeacherAssignments] = useState<CourseAssignment[]>([]);
  const [canCreateCourse, setCanCreateCourse] = useState(false);
  // For admin/manager: tab selection
  const [courseTab, setCourseTab] = useState<'all' | 'mine'>('all');

  // ==================== INITIAL LOAD EFFECTS ====================

  useEffect(() => {
    if (user?.uid) {
      loadCourses();
      loadFilterOptions();
      loadTeacherAssignments();
    }
  }, [user]);

  useEffect(() => {
    filterCourses();
  }, [searchTerm, filterSubject, filterClass, filterCategory, filterSituation, courses]);

  useEffect(() => {
    if (routeCourseId) {
      // Load course for editing from route params
      loadCourseForEdit(routeCourseId);
    }
  }, [routeCourseId]);

  useEffect(() => {
    if (showContentPicker) {
      loadAvailableContent();
    }
  }, [showContentPicker]);

  useEffect(() => {
    filterAvailableContent();
  }, [contentSearchTerm, availableContent]);

  // ==================== DATA LOADING FUNCTIONS ====================

  const loadCourses = async () => {
    try {
      setLoading(true);
      let data: Course[];
      
      if (user?.role === 'admin' || user?.role === 'manager') {
        data = await courseService.getAllCourses();
      } else if (user?.role === 'teacher') {
        // Teachers only see courses they're assigned to with 'editing' permission
        const assignments = await courseAssignmentService.getTeacherAssignments(user.uid);
        const activeEditingAssignments = assignments.filter(
          a => a.isActive && a.permissions.includes('editing')
        );
        const assignedCourseIds = new Set(activeEditingAssignments.map(a => a.courseId));
        const allCourses = await courseService.getAllCourses();
        data = allCourses.filter(c => assignedCourseIds.has(c.id));
      } else {
        data = await courseService.getCoursesByInstructor(user?.uid || '');
      }
      
      console.log('Loaded courses:', data);
      setCourses(data);
    } catch (error) {
      console.error('Error loading courses:', error);
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const allCourses = await courseService.getAllCourses();
      
      const subjectSet = new Set<string>();
      const classSet = new Set<string>();
      const categorySet = new Set<string>();
      
      allCourses.forEach(course => {
        course.subjects.forEach(subject => subjectSet.add(subject));
        if (course.class) classSet.add(course.class);
        if (course.category) categorySet.add(course.category);
      });
      
      setSubjects(Array.from(subjectSet).sort());
      setClasses(Array.from(classSet).sort());
      setCategories(Array.from(categorySet).sort());
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadTeacherAssignments = async () => {
    if (!user?.uid) return;
    try {
      if (user.role === 'teacher') {
        const assignments = await courseAssignmentService.getTeacherAssignments(user.uid);
        const active = assignments.filter(a => a.isActive);
        setTeacherAssignments(active);
        // Teacher can create a course only if they have 'course_creation' permission on any assignment
        const hasCreation = active.some(a => a.permissions.includes('course_creation'));
        setCanCreateCourse(hasCreation);
      } else {
        // Admin and manager can always create courses
        setCanCreateCourse(true);
      }
    } catch (error) {
      console.error('Error loading teacher assignments:', error);
    }
  };

  const loadCourseForEdit = async (id: string) => {
    try {
      setInitialLoading(true);
      setError('');
      
      const course = await courseService.getCourseById(id);
      if (!course) {
        setError('Course not found');
        return;
      }

      if (user?.role !== 'admin' && user?.role !== 'manager' && course.instructorId !== user?.uid) {
        setError('You do not have permission to edit this course');
        return;
      }

      await populateFormFromCourse(course);
      setEditingCourse(course);
      setViewMode('edit');
    } catch (error: any) {
      console.error('Error loading course:', error);
      setError('Failed to load course data: ' + error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  const populateFormFromCourse = async (course: Course) => {
    const routineFiles: RoutineFile[] = course.routineFiles?.map((file: any) => ({
      id: file.id || Date.now().toString() + Math.random(),
      existingUrl: file.url,
      fileName: file.fileName,
      category: file.category
    })) || [];

    setFormData({
      courseId: course.id,
      title: course.title,
      description: course.description,
      price: course.price,
      level: course.level as any,
      category: course.category || 'Unspecified',
      class: course.class || '',
      subjects: course.subjects || [],
      tags: course.tags || [],
      requirements: course.requirements.length > 0 ? course.requirements : [''],
      whatYouWillLearn: course.whatYouWillLearn.length > 0 ? course.whatYouWillLearn : [''],
      existingThumbnail: course.thumbnail,
      validity: course.validity ? new Date(course.validity) : null,
      previousStudentDiscount: course.previousStudentDiscount || 0, // Now BDT
      extraDiscount: course.extraDiscount || 0,
      extraDiscountValidUntil: course.extraDiscountValidUntil ? new Date(course.extraDiscountValidUntil) : null,
      routineFiles,
      contentStructure: course.contentStructure || [],
      hasAiQnA: course.hasAiQnA || false,
      hasHumanQnA: course.hasHumanQnA || false,
      hasStudyPlanner: course.hasStudyPlanner || false,
      isPublished: course.isPublished,
      isDraft: !course.isPublished
    });

    if (course.thumbnail) {
      setThumbnailPreview(course.thumbnail);
    }

    // Load content data for each content node
    if (course.contentStructure) {
      await loadContentDataForNodes(course.contentStructure);
    }
  };

  const loadContentDataForNodes = async (nodes: ContentNode[]) => {
    for (const node of nodes) {
      if (node.type === 'content' && node.contentId) {
        try {
          const content = await contentService.getContentById(node.contentId);
          if (content) {
            node.contentData = content;
          }
        } catch (error) {
          console.error('Error loading content data:', error);
        }
      }
      
      if (node.children && node.children.length > 0) {
        await loadContentDataForNodes(node.children);
      }
    }
  };

  const loadAvailableContent = async () => {
    try {
      let content: Content[];
      if (user?.role === 'admin' || user?.role === 'manager') {
        content = await contentService.getAllContent();
      } else {
        content = await contentService.getContentByUser(user?.uid || '');
      }
      setAvailableContent(content);
    } catch (error) {
      console.error('Error loading available content:', error);
    }
  };

  const filterCourses = () => {
    let filtered = courses;

    if (searchTerm) {
      filtered = filtered.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        course.subjects?.some(subject => subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        course.class?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterSubject !== 'all') {
      filtered = filtered.filter(course => course.subjects?.includes(filterSubject));
    }

    if (filterClass !== 'all') {
      filtered = filtered.filter(course => course.class === filterClass);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(course => course.category === filterCategory);
    }

    if (filterSituation !== 'all') {
      if (filterSituation === 'published') {
        filtered = filtered.filter(course => course.isPublished === true);
      } else if (filterSituation === 'draft') {
        filtered = filtered.filter(course => course.isPublished === false);
      } else if (filterSituation === 'unpublished') {
        filtered = filtered.filter(course => course.isPublished === false);
      }
    }

    setFilteredCourses(filtered);
  };

  const filterAvailableContent = () => {
    if (!contentSearchTerm) {
      setFilteredContent(availableContent);
      return;
    }

    const filtered = availableContent.filter(content =>
      content.title.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
      content.customId.toLowerCase().includes(contentSearchTerm.toLowerCase()) ||
      content.subject.toLowerCase().includes(contentSearchTerm.toLowerCase())
    );

    setFilteredContent(filtered);
  };
// src/pages/CourseCreation.tsx - Part 2/5
// NAVIGATION & FORM HANDLERS

  // ==================== NAVIGATION FUNCTIONS ====================

  const openCreateForm = () => {
    resetForm();
    setEditingCourse(null);
    setViewMode('create');
  };

  const openEditForm = (course: Course) => {
    setEditingCourse(course);
    populateFormFromCourse(course);
    setViewMode('edit');
    setShowOverview(false);
  };

  const closeForm = () => {
    resetForm();
    setEditingCourse(null);
    setViewMode('list');
    loadCourses();
  };

  const handleViewOverview = (course: Course) => {
    setSelectedCourse(course);
    setShowOverview(true);
  };

  const handleViewAnalytics = async (course: Course) => {
    setSelectedCourse(course);
    setShowAnalytics(true);
    await loadAnalytics(course.id);
  };

  const loadAnalytics = async (courseId: string) => {
    try {
      setLoadingAnalytics(true);
      const data = await courseService.getCourseAnalytics(courseId);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (!window.confirm(`Are you sure you want to delete "${course.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await courseService.deleteCourse(course.id);
      await loadCourses();
      setShowOverview(false);
      setSuccess('Course deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error deleting course:', error);
      setError(error.message || 'Failed to delete course');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishToggle = async (course: Course) => {
    try {
      setLoading(true);
      await courseService.updateCourse(course.id, {
        isPublished: !course.isPublished
      });
      await loadCourses();
      setSuccess(`Course ${!course.isPublished ? 'published' : 'unpublished'} successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
      if (selectedCourse && selectedCourse.id === course.id) {
        setSelectedCourse({ ...course, isPublished: !course.isPublished });
      }
    } catch (error: any) {
      console.error('Error toggling publish status:', error);
      setError(error.message || 'Failed to update course status');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FORM RESET ====================

  const resetForm = () => {
    setFormData({
      courseId: '',
      title: '',
      description: '',
      price: 0,
      level: 'unspecified',
      category: 'Unspecified',
      class: '',
      subjects: [],
      tags: [],
      requirements: [''],
      whatYouWillLearn: [''],
      validity: null,
      previousStudentDiscount: 0,
      extraDiscount: 0,
      extraDiscountValidUntil: null,
      routineFiles: [],
      contentStructure: [],
      hasAiQnA: false,
      hasHumanQnA: false,
      hasStudyPlanner: false,
      isPublished: false,
      isDraft: true
    });
    setCurrentTag('');
    setThumbnailPreview('');
    setError('');
    setSuccess('');
    setUploadProgress(null);
  };

  // ==================== FORM INPUT HANDLERS ====================

  const handleInputChange = (field: keyof CourseFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleArrayFieldChange = (field: 'requirements' | 'whatYouWillLearn', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field: 'requirements' | 'whatYouWillLearn') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field: 'requirements' | 'whatYouWillLearn', index: number) => {
    if (formData[field].length === 1) return;
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // ==================== TAG MANAGEMENT ====================

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // ==================== FILE HANDLERS ====================

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, thumbnailFile: file }));
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setFormData(prev => ({ 
      ...prev, 
      thumbnailFile: undefined,
      existingThumbnail: undefined 
    }));
    setThumbnailPreview('');
  };

  // ==================== ROUTINE FILE MANAGEMENT ====================

  const addRoutineFile = () => {
    const newFile: RoutineFile = {
      id: Date.now().toString() + Math.random(),
      category: ''
    };
    setFormData(prev => ({
      ...prev,
      routineFiles: [...prev.routineFiles, newFile]
    }));
  };

  const removeRoutineFile = (id: string) => {
    setFormData(prev => ({
      ...prev,
      routineFiles: prev.routineFiles.filter(f => f.id !== id)
    }));
  };

  const handleRoutineFileChange = (id: string, file: File) => {
    setFormData(prev => ({
      ...prev,
      routineFiles: prev.routineFiles.map(f => 
        f.id === id ? { ...f, file } : f
      )
    }));
  };

  const handleRoutineFileCategoryChange = (id: string, category: string) => {
    setFormData(prev => ({
      ...prev,
      routineFiles: prev.routineFiles.map(f => 
        f.id === id ? { ...f, category } : f
      )
    }));
  };

  // ==================== CONTENT STRUCTURE MANAGEMENT ====================

  const addFolder = (parentNode?: ContentNode) => {
    const newFolder: ContentNode = {
      id: Date.now().toString() + Math.random(),
      type: 'folder',
      name: 'New Folder',
      children: [],
      isExpanded: true,
      order: parentNode 
        ? parentNode.children.length 
        : formData.contentStructure.length
    };

    if (parentNode) {
      setFormData(prev => ({
        ...prev,
        contentStructure: updateNodeInTree(prev.contentStructure, parentNode.id, (node) => ({
          ...node,
          children: [...node.children, newFolder]
        }))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        contentStructure: [...prev.contentStructure, newFolder]
      }));
    }
  };

  const openContentPicker = (parentNode?: ContentNode) => {
    setSelectedParentNode(parentNode || null);
    setShowContentPicker(true);
  };

  const addContentToStructure = (content: Content) => {
    const newContentNode: ContentNode = {
      id: Date.now().toString() + Math.random(),
      type: 'content',
      name: content.title,
      contentId: content.id,
      contentData: content,
      children: [],
      order: selectedParentNode 
        ? selectedParentNode.children.length 
        : formData.contentStructure.length
    };

    if (selectedParentNode) {
      setFormData(prev => ({
        ...prev,
        contentStructure: updateNodeInTree(prev.contentStructure, selectedParentNode.id, (node) => ({
          ...node,
          children: [...node.children, newContentNode]
        }))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        contentStructure: [...prev.contentStructure, newContentNode]
      }));
    }

    // Auto-update subjects from content
    if (content.subject && !formData.subjects.includes(content.subject)) {
      setFormData(prev => ({
        ...prev,
        subjects: [...prev.subjects, content.subject]
      }));
    }

    setShowContentPicker(false);
    setSelectedParentNode(null);
  };

  const removeNodeFromStructure = (nodeId: string) => {
    setFormData(prev => ({
      ...prev,
      contentStructure: removeNodeFromTree(prev.contentStructure, nodeId)
    }));
  };

  const toggleNodeExpansion = (nodeId: string) => {
    setFormData(prev => ({
      ...prev,
      contentStructure: updateNodeInTree(prev.contentStructure, nodeId, (node) => ({
        ...node,
        isExpanded: !node.isExpanded
      }))
    }));
  };

  const renameNode = (nodeId: string, newName: string) => {
    setFormData(prev => ({
      ...prev,
      contentStructure: updateNodeInTree(prev.contentStructure, nodeId, (node) => ({
        ...node,
        name: newName
      }))
    }));
  };

  // ==================== TREE UTILITY FUNCTIONS ====================

  const updateNodeInTree = (
    nodes: ContentNode[], 
    nodeId: string, 
    updater: (node: ContentNode) => ContentNode
  ): ContentNode[] => {
    return nodes.map(node => {
      if (node.id === nodeId) {
        return updater(node);
      }
      if (node.children.length > 0) {
        return {
          ...node,
          children: updateNodeInTree(node.children, nodeId, updater)
        };
      }
      return node;
    });
  };

  const removeNodeFromTree = (nodes: ContentNode[], nodeId: string): ContentNode[] => {
    return nodes
      .filter(node => node.id !== nodeId)
      .map(node => ({
        ...node,
        children: removeNodeFromTree(node.children, nodeId)
      }));
  };

  const calculateTotalDuration = (nodes: ContentNode[]): number => {
    let total = 0;
    for (const node of nodes) {
      if (node.type === 'content' && node.contentData) {
        total += node.contentData.duration || 0;
      }
      if (node.children.length > 0) {
        total += calculateTotalDuration(node.children);
      }
    }
    return total;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // ==================== DRAG & DROP HANDLERS ====================

  const handleDragStart = (node: ContentNode) => {
    setDraggedNode(node);
  };

  const handleDragOver = (e: React.DragEvent, node: ContentNode) => {
    e.preventDefault();
    setDragOverNode(node);
  };

  const handleDrop = (e: React.DragEvent, targetNode: ContentNode) => {
    e.preventDefault();
    
    if (!draggedNode || draggedNode.id === targetNode.id) {
      setDraggedNode(null);
      setDragOverNode(null);
      return;
    }

    // Remove dragged node from tree
    let newStructure = removeNodeFromTree(formData.contentStructure, draggedNode.id);
    
    // Insert at new position
    if (targetNode.type === 'folder') {
      // Insert as child of folder
      newStructure = updateNodeInTree(newStructure, targetNode.id, (node) => ({
        ...node,
        children: [...node.children, { ...draggedNode, order: node.children.length }],
        isExpanded: true
      }));
    } else {
      // Insert after target node (same level)
      newStructure = insertAfterNode(newStructure, targetNode.id, draggedNode);
    }

    setFormData(prev => ({ ...prev, contentStructure: newStructure }));
    setDraggedNode(null);
    setDragOverNode(null);
  };

  const insertAfterNode = (nodes: ContentNode[], targetId: string, nodeToInsert: ContentNode): ContentNode[] => {
    const result: ContentNode[] = [];
    
    for (const node of nodes) {
      result.push(node);
      
      if (node.id === targetId) {
        result.push(nodeToInsert);
      }
      
      if (node.children.length > 0) {
        result[result.length - 1] = {
          ...node,
          children: insertAfterNode(node.children, targetId, nodeToInsert)
        };
      }
    }
    
    return result;
  };
// src/pages/CourseCreation.tsx - Part 3/5
// FORM SUBMISSION & HELPER FUNCTIONS

  // ==================== FORM SUBMISSION ====================

  const handleSubmit = async (publishNow: boolean = false) => {
    if (!user) {
      setError('You must be logged in to create/edit a course');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(null);

    try {
      // Validation
      if (!formData.title.trim()) {
        throw new Error('Course title is required');
      }
      if (!formData.class.trim()) {
        throw new Error('Class is required');
      }
      if (!editingCourse && !formData.courseId.trim()) {
        throw new Error('Course ID is required');
      }

      // Check for duplicate course ID (only when creating)
      if (!editingCourse) {
        const existing = await courseService.getCourseById(formData.courseId);
        if (existing) {
          throw new Error(`Course with ID "${formData.courseId}" already exists`);
        }
      }

      // Upload thumbnail to Supabase if new file provided
      let thumbnailUrl = formData.existingThumbnail || '';
      if (formData.thumbnailFile) {
        setUploadProgress({ loaded: 0, total: 100, percentage: 0 });
        
        const result = await uploadService.uploadToSupabase(
          formData.thumbnailFile, 
          'course_thumbnails',
          (progress) => {
            setUploadProgress(progress);
          }
        );
        thumbnailUrl = result.url;
        
        // Delete old thumbnail from Supabase if editing
        if (editingCourse?.thumbnail) {
          try {
            const oldFileName = editingCourse.thumbnail.split('/').pop();
            if (oldFileName) {
              await uploadService.deleteFromSupabase(`course_thumbnails/${oldFileName}`);
            }
          } catch (e) {
            console.warn('Failed to delete old thumbnail:', e);
          }
        }
        
        setUploadProgress(null);
      }

      // Upload routine files to Supabase
      const uploadedRoutineFiles = await Promise.all(
        formData.routineFiles.map(async (routineFile) => {
          if (routineFile.file) {
            const result = await uploadService.uploadToSupabase(
              routineFile.file,
              'course_routines'
            );
            return {
              id: routineFile.id,
              url: result.url,
              fileName: routineFile.file.name,
              category: routineFile.category
            };
          } else if (routineFile.existingUrl) {
            return {
              id: routineFile.id,
              url: routineFile.existingUrl,
              fileName: routineFile.fileName || '',
              category: routineFile.category
            };
          }
          return null;
        })
      );

      const validRoutineFiles = uploadedRoutineFiles.filter(f => f !== null);

      // Calculate total duration from content structure
      const totalDurationMinutes = calculateTotalDuration(formData.contentStructure);
      const durationFormatted = formatDuration(totalDurationMinutes);

      // Prepare course data - ONLY include validity if it's set
      const courseData: Partial<Course> = {
        title: formData.title,
        description: formData.description,
        instructor: user.name,
        instructorId: user.uid,
        price: formData.price,
        level: formData.level === 'unspecified' ? 'beginner' : formData.level,
        category: formData.category || 'Unspecified',
        class: formData.class,
        subjects: formData.subjects,
        tags: formData.tags,
        thumbnail: thumbnailUrl,
        requirements: formData.requirements.filter(req => req.trim()),
        whatYouWillLearn: formData.whatYouWillLearn.filter(item => item.trim()),
        previousStudentDiscount: formData.previousStudentDiscount, // Now in BDT
        extraDiscount: formData.extraDiscount,
        routineFiles: validRoutineFiles as any,
        contentStructure: formData.contentStructure,
        duration: durationFormatted,
        hasAiQnA: formData.hasAiQnA,
        hasHumanQnA: formData.hasHumanQnA,
        hasStudyPlanner: formData.hasStudyPlanner,
        isPublished: publishNow,
        lessons: [] // Keep for backward compatibility
      };

      // Only add validity if it's set (not null)
      if (formData.validity) {
        courseData.validity = formData.validity.toISOString();
      }

      // Only add extraDiscountValidUntil if it's set
      if (formData.extraDiscountValidUntil) {
        courseData.extraDiscountValidUntil = formData.extraDiscountValidUntil.toISOString();
      }

      let courseId: string;

      if (editingCourse) {
        // Update existing course
        courseId = editingCourse.id;
        await courseService.updateCourse(courseId, courseData);
        setSuccess(`Course updated${publishNow ? ' and published' : ''} successfully!`);
      } else {
        // Create new course
        courseData.id = formData.courseId; // Use custom course ID
        courseId = await courseService.createCourse(courseData as any);
        setSuccess(`Course created${publishNow ? ' and published' : ' as draft'} successfully!`);
      }

      if ((window as any).addNotification) {
        (window as any).addNotification(
          editingCourse 
            ? `Course "${formData.title}" updated successfully!`
            : `Course "${formData.title}" created successfully! Course ID: ${courseId}`,
          'success'
        );
      }

      setTimeout(() => {
        closeForm();
      }, 2000);

    } catch (error: any) {
      console.error('Error saving course:', error);
      setError(error.message || 'Failed to save course');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  // ==================== RENDER HELPERS ====================

  const getSituationBadge = (course: Course) => {
    if (course.isPublished) {
      return <span className="px-2 py-1 text-xs rounded bg-success-dark text-success-light">Published</span>;
    } else {
      return <span className="px-2 py-1 text-xs rounded bg-warning-dark text-warning-light">Draft</span>;
    }
  };

  const getSituationColor = (course: Course) => {
    if (course.isPublished) {
      return 'border-success-DEFAULT';
    } else {
      return 'border-warning-DEFAULT';
    }
  };

  // ==================== CONTENT NODE RENDERER ====================

  const renderContentNode = (node: ContentNode, level: number = 0): JSX.Element => {
    const indent = level * 24;

    return (
      <div key={node.id} className="mb-1">
        <div
          draggable
          onDragStart={() => handleDragStart(node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDrop={(e) => handleDrop(e, node)}
          className={`flex items-center gap-2 p-2 rounded-lg bg-background-800 hover:bg-background-700 transition-colors cursor-move ${
            dragOverNode?.id === node.id ? 'ring-2 ring-primary-500' : ''
          }`}
          style={{ marginLeft: `${indent}px` }}
        >
          <GripVertical size={16} className="text-gray-500" />
          
          {node.type === 'folder' ? (
            <>
              <button
                type="button"
                onClick={() => toggleNodeExpansion(node.id)}
                className="text-gray-400 hover:text-white"
              >
                {node.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <BookOpen size={16} className="text-blue-400" />
              <input
                type="text"
                value={node.name}
                onChange={(e) => renameNode(node.id, e.target.value)}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 rounded px-2 py-1"
              />
              <button
                type="button"
                onClick={() => addFolder(node)}
                className="p-1 text-blue-400 hover:text-blue-300"
                title="Add Subfolder"
              >
                <FolderPlus size={14} />
              </button>
              <button
                type="button"
                onClick={() => openContentPicker(node)}
                className="p-1 text-green-400 hover:text-green-300"
                title="Add Content"
              >
                <FilePlus size={14} />
              </button>
            </>
          ) : (
            <>
              <FileText size={16} className="text-primary-400" />
              <span className="flex-1 text-white text-sm">{node.name}</span>
              {node.contentData && (
                <span className="text-xs text-gray-500">
                  {node.contentData.type} • {node.contentData.duration}min
                </span>
              )}
            </>
          )}
          
          <button
            type="button"
            onClick={() => removeNodeFromStructure(node.id)}
            className="p-1 text-error-DEFAULT hover:text-error-light"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {node.type === 'folder' && node.isExpanded && node.children.length > 0 && (
          <div className="mt-1">
            {node.children.map(child => renderContentNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==================== COURSE CARD RENDERER ====================

  const renderCourseCard = (course: Course) => {
    if (displayMode === 'grid') {
      return (
        <Card key={course.id} className={`hover:border-primary-500/50 transition-all cursor-pointer relative ${getSituationColor(course)}`}>
          <div onClick={() => handleViewOverview(course)}>
            {/* Thumbnail */}
            <div className="relative mb-4 rounded-lg overflow-hidden h-40 bg-background-800">
              {course.thumbnail ? (
                <img 
                  src={course.thumbnail} 
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen size={48} className="text-gray-600" />
                </div>
              )}
              
              {/* Floating badges */}
              <div className="absolute top-2 left-2">
                <span className="px-2 py-1 text-xs rounded bg-background-900/80 text-white">
                  ID: {course.id}
                </span>
              </div>
              <div className="absolute top-2 right-2">
                {getSituationBadge(course)}
              </div>
            </div>

            {/* Title & Class */}
            <h3 className="text-lg font-semibold text-white mb-1 line-clamp-2">
              {course.title}
            </h3>
            <p className="text-sm text-gray-400 mb-3">{course.class}</p>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-1">
                <Users size={14} />
                <span>{course.studentCount || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{course.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <Award size={14} />
                <span>{course.rating || 0}</span>
              </div>
            </div>

            {/* Tags */}
            {course.tags && course.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {course.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 bg-primary-900/30 text-primary-400 rounded">
                    {tag}
                  </span>
                ))}
                {course.tags.length > 3 && (
                  <span className="text-xs px-2 py-1 bg-background-700 text-gray-400 rounded">
                    +{course.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Overview Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewOverview(course);
            }}
            className="w-full mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Eye size={16} />
            Overview
          </button>
        </Card>
      );
    } else {
      // List view
      return (
        <Card key={course.id} className={`hover:border-primary-500/50 transition-all cursor-pointer ${getSituationColor(course)}`}>
          <div onClick={() => handleViewOverview(course)} className="flex items-center gap-4">
            {/* Thumbnail */}
            <div className="w-32 h-20 rounded-lg overflow-hidden bg-background-800 flex-shrink-0">
              {course.thumbnail ? (
                <img 
                  src={course.thumbnail} 
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen size={32} className="text-gray-600" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-white truncate">{course.title}</h3>
                {getSituationBadge(course)}
              </div>
              <p className="text-sm text-gray-400 mb-2">{course.class}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>ID: {course.id}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{course.studentCount || 0} students</span>
                </div>
                <span>•</span>
                <span>{course.duration}</span>
              </div>
            </div>

            {/* Overview Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewOverview(course);
              }}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Eye size={16} />
              Overview
            </button>
          </div>
        </Card>
      );
    }
  };
// src/pages/CourseCreation.tsx - Part 4/5
// COURSE LIST VIEW & MODAL COMPONENTS

  // ==================== OVERVIEW MODAL RENDERER ====================

  const renderOverviewModal = () => {
    if (!selectedCourse) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-xl w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
          <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedCourse.title}</h2>
              <p className="text-gray-400 text-sm mt-1">Course Overview</p>
            </div>
            <button
              onClick={() => setShowOverview(false)}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-400">Course ID</label>
                <p className="text-white mt-1">{selectedCourse.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Status</label>
                <div className="mt-1">{getSituationBadge(selectedCourse)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Class</label>
                <p className="text-white mt-1">{selectedCourse.class}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Category</label>
                <p className="text-white mt-1">{selectedCourse.category || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Level</label>
                <p className="text-white mt-1 capitalize">{selectedCourse.level}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Duration</label>
                <p className="text-white mt-1">{selectedCourse.duration}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Price</label>
                <p className="text-white mt-1">৳{selectedCourse.price}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400">Instructor</label>
                <p className="text-white mt-1">{selectedCourse.instructor}</p>
              </div>
            </div>

            {/* Description */}
            {selectedCourse.description && (
              <div>
                <label className="text-sm font-medium text-gray-400">Description</label>
                <p className="text-white mt-1">{selectedCourse.description}</p>
              </div>
            )}

            {/* Special Features */}
            <div className="bg-background-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Award size={20} className="text-primary-400" />
                Special Features
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-lg ${selectedCourse.hasAiQnA ? 'bg-green-900/30 border border-green-500/30' : 'bg-background-700'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Brain size={16} className={selectedCourse.hasAiQnA ? 'text-green-400' : 'text-gray-500'} />
                    <span className={`text-sm font-medium ${selectedCourse.hasAiQnA ? 'text-green-400' : 'text-gray-500'}`}>AI Q&A</span>
                  </div>
                  <p className="text-xs text-gray-400">{selectedCourse.hasAiQnA ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className={`p-3 rounded-lg ${selectedCourse.hasHumanQnA ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-background-700'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare size={16} className={selectedCourse.hasHumanQnA ? 'text-blue-400' : 'text-gray-500'} />
                    <span className={`text-sm font-medium ${selectedCourse.hasHumanQnA ? 'text-blue-400' : 'text-gray-500'}`}>Human Q&A</span>
                  </div>
                  <p className="text-xs text-gray-400">{selectedCourse.hasHumanQnA ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className={`p-3 rounded-lg ${selectedCourse.hasStudyPlanner ? 'bg-purple-900/30 border border-purple-500/30' : 'bg-background-700'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarCheck size={16} className={selectedCourse.hasStudyPlanner ? 'text-purple-400' : 'text-gray-500'} />
                    <span className={`text-sm font-medium ${selectedCourse.hasStudyPlanner ? 'text-purple-400' : 'text-gray-500'}`}>Study Planner</span>
                  </div>
                  <p className="text-xs text-gray-400">{selectedCourse.hasStudyPlanner ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </div>

            {/* Subjects */}
            {selectedCourse.subjects && selectedCourse.subjects.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">Subjects</label>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.subjects.map(subject => (
                    <span key={subject} className="px-3 py-1 bg-secondary-900 text-secondary-300 rounded-full text-sm">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {selectedCourse.tags && selectedCourse.tags.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-primary-900 text-primary-300 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Discounts */}
            {(selectedCourse.previousStudentDiscount > 0 || selectedCourse.extraDiscount > 0) && (
              <div className="bg-background-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">Discounts</h3>
                <div className="space-y-2">
                  {selectedCourse.previousStudentDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Previous Student Discount</span>
                      <span className="text-primary-400 font-semibold">
                        ৳{selectedCourse.previousStudentDiscount}
                      </span>
                    </div>
                  )}
                  {selectedCourse.extraDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Extra Discount</span>
                      <span className="text-primary-400 font-semibold">
                        ৳{selectedCourse.extraDiscount}
                        {selectedCourse.extraDiscountValidUntil && (
                          <span className="text-xs text-gray-500 ml-2">
                            (until {new Date(selectedCourse.extraDiscountValidUntil).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 bg-background-800 p-4 rounded-lg">
              <div>
                <label className="text-sm text-gray-400">Students</label>
                <p className="text-2xl font-bold text-primary-400">{selectedCourse.studentCount || 0}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Rating</label>
                <p className="text-2xl font-bold text-yellow-400">{selectedCourse.rating || 0}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Reviews</label>
                <p className="text-2xl font-bold text-blue-400">{selectedCourse.reviewCount || 0}</p>
              </div>
              <div>
                <label className="text-sm text-gray-400">Duration</label>
                <p className="text-2xl font-bold text-green-400">{selectedCourse.duration}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t border-background-700">
              <button
                onClick={() => {
                  setShowOverview(false);
                  openEditForm(selectedCourse);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <Edit size={20} />
                Edit
              </button>
              <button
                onClick={() => {
                  setShowOverview(false);
                  handleViewAnalytics(selectedCourse);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                <BarChart3 size={20} />
                Analytics
              </button>
              <button
                onClick={() => handlePublishToggle(selectedCourse)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg transition-colors font-medium ${
                  selectedCourse.isPublished
                    ? 'bg-warning-600 hover:bg-warning-700'
                    : 'bg-success-600 hover:bg-success-700'
                }`}
              >
                <CheckCircle size={20} />
                {selectedCourse.isPublished ? 'Unpublish' : 'Publish'}
              </button>
              <button
                onClick={() => handleDelete(selectedCourse)}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-error-600 hover:bg-error-700 text-white rounded-lg transition-colors font-medium"
              >
                <Trash2 size={20} />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== ANALYTICS MODAL RENDERER ====================

  const renderAnalyticsModal = () => {
    if (!selectedCourse) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
          <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
              <p className="text-gray-400 text-sm mt-1">{selectedCourse.title}</p>
            </div>
            <button
              onClick={() => setShowAnalytics(false)}
              className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-primary-400" size={48} />
              </div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Total Enrollments</label>
                    <p className="text-3xl font-bold text-primary-400 mt-1">{analytics.totalEnrollments}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Active Students</label>
                    <p className="text-3xl font-bold text-blue-400 mt-1">{analytics.activeStudents}</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Avg. Progress</label>
                    <p className="text-3xl font-bold text-green-400 mt-1">{analytics.averageProgress.toFixed(1)}%</p>
                  </div>
                  <div className="bg-background-800 p-4 rounded-lg">
                    <label className="text-sm text-gray-400">Revenue</label>
                    <p className="text-3xl font-bold text-yellow-400 mt-1">৳{analytics.revenue}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                No analytics data available
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== CONTENT PICKER MODAL ====================

  const renderContentPickerModal = () => {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-background-900 rounded-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-background-700 my-8">
          <div className="sticky top-0 z-10 bg-background-900 border-b border-background-700 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Add Content</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedParentNode 
                    ? `Adding to: ${selectedParentNode.name}`
                    : 'Adding to root level'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowContentPicker(false);
                  setSelectedParentNode(null);
                }}
                className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={contentSearchTerm}
                onChange={(e) => setContentSearchTerm(e.target.value)}
                placeholder="Search content..."
                className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
            {filteredContent.length > 0 ? (
              filteredContent.map(content => (
                <div
                  key={content.id}
                  onClick={() => addContentToStructure(content)}
                  className="p-4 bg-background-800 hover:bg-background-700 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{content.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span>ID: {content.customId}</span>
                        <span>•</span>
                        <span>{content.type}</span>
                        <span>•</span>
                        <span>{content.subject}</span>
                        {content.duration && (
                          <>
                            <span>•</span>
                            <span>{content.duration}min</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Plus size={20} className="text-primary-400" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-400">
                No content found
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER - LIST VIEW ====================

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading course data...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Course Management</h1>
            <p className="text-gray-400 mt-1">Manage your courses</p>
          </div>
          {canCreateCourse && (
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-lg"
            >
              <Plus size={20} />
              Create Course
            </button>
          )}
        </div>

        {/* Tabs for Admin/Manager: All Courses vs My Courses */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <div className="flex gap-1 p-1 bg-background-800 rounded-lg w-fit">
            <button
              onClick={() => setCourseTab('all')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                courseTab === 'all'
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Courses
            </button>
            <button
              onClick={() => setCourseTab('mine')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
                courseTab === 'mine'
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              My Courses
            </button>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-error-light hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-success-dark text-success-light px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-success-light hover:text-white">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Search and Filters */}
        <Card>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title, ID, tags..."
                  className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`p-3 rounded-lg transition-colors ${
                    displayMode === 'grid'
                      ? 'bg-primary-600 text-white'
                      : 'bg-background-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Grid size={20} />
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`p-3 rounded-lg transition-colors ${
                    displayMode === 'list'
                      ? 'bg-primary-600 text-white'
                      : 'bg-background-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <List size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Subjects</option>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Classes</option>
                {classes.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select
                value={filterSituation}
                onChange={(e) => setFilterSituation(e.target.value as any)}
                className="bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Course List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="animate-spin text-primary-400" size={48} />
          </div>
        ) : (() => {
          // Apply tab filter for admin/manager
          const displayCourses = (user?.role === 'admin' || user?.role === 'manager') && courseTab === 'mine'
            ? filteredCourses.filter(c => c.instructorId === user?.uid)
            : filteredCourses;

          return displayCourses.length > 0 ? (
            <div className={
              displayMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-4'
            }>
              {displayCourses.map(course => renderCourseCard(course))}
            </div>
          ) : (
            <Card>
              <div className="text-center py-12">
                <BookOpen size={64} className="mx-auto text-gray-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-300 mb-2">
                  {courses.length === 0 ? 'No Courses Yet' : 'No Matching Courses'}
                </h3>
                <p className="text-gray-400 mb-6">
                  {courses.length === 0
                    ? 'Get started by creating your first course'
                    : 'Try adjusting your search or filters'}
                </p>
                {courses.length === 0 && canCreateCourse && (
                  <button
                    onClick={openCreateForm}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <Plus size={20} />
                    Create Your First Course
                  </button>
                )}
              </div>
            </Card>
          );
        })()}

        {/* Modals */}
        {showOverview && renderOverviewModal()}
        {showAnalytics && renderAnalyticsModal()}
      </div>
    );
  }
// src/pages/CourseCreation.tsx - Part 5/5
// COURSE CREATION/EDIT FORM & EXPORT

  // ==================== MAIN RENDER - CREATE/EDIT VIEW ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={closeForm}
            className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Back to Course List"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {editingCourse ? 'Edit Course' : 'Create New Course'}
            </h1>
            <p className="text-gray-400 mt-1">
              {editingCourse ? `Editing: ${editingCourse.title}` : 'Create a comprehensive course with lessons and content'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-success-dark text-success-light px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="bg-primary-dark text-primary-light px-4 py-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span>Uploading thumbnail...</span>
            <span>{uploadProgress.percentage}%</span>
          </div>
          <div className="w-full bg-background-800 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      <form className="space-y-6">
        {/* Basic Information */}
        <Card title="Basic Information">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Course ID <span className="text-error-DEFAULT">*</span>
                </label>
                <input
                  type="text"
                  value={formData.courseId}
                  onChange={(e) => handleInputChange('courseId', e.target.value)}
                  disabled={!!editingCourse || loading}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="e.g., MATH-101, PHY-ADV-2025"
                  required
                />
                {editingCourse && (
                  <p className="text-xs text-gray-500 mt-1">Course ID cannot be changed after creation</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Course Title <span className="text-error-DEFAULT">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter course title..."
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe your course..."
                rows={4}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Class <span className="text-error-DEFAULT">*</span>
                </label>
                <input
                  type="text"
                  value={formData.class}
                  onChange={(e) => handleInputChange('class', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Class 6, Grade 10"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Science, Mathematics"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">Defaults to "Unspecified" if empty</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Level
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => handleInputChange('level', e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                >
                  <option value="unspecified">Unspecified</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="bg-background-800 p-4 rounded-lg border border-blue-500/30">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-400 font-medium">Subjects & Duration</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Subjects are automatically inherited from the content you add to this course.
                    Duration is auto-calculated based on total lesson duration.
                  </p>
                </div>
              </div>
            </div>

            {formData.subjects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Subjects (Auto-inherited from content)
                </label>
                <div className="flex flex-wrap gap-2">
                  {formData.subjects.map(subject => (
                    <span key={subject} className="px-3 py-1 bg-secondary-900 text-secondary-300 rounded-full text-sm">
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Special Features */}
        <Card title="Special Features">
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Enable or disable special features for this course
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* AI Q&A Toggle */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                formData.hasAiQnA 
                  ? 'bg-green-900/20 border-green-500/50' 
                  : 'bg-background-800 border-background-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain size={20} className={formData.hasAiQnA ? 'text-green-400' : 'text-gray-500'} />
                    <span className={`font-medium ${formData.hasAiQnA ? 'text-green-400' : 'text-gray-400'}`}>
                      AI Q&A
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('hasAiQnA', !formData.hasAiQnA)}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.hasAiQnA ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.hasAiQnA ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  AI-powered question answering for students
                </p>
              </div>

              {/* Human Q&A Toggle */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                formData.hasHumanQnA 
                  ? 'bg-blue-900/20 border-blue-500/50' 
                  : 'bg-background-800 border-background-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={20} className={formData.hasHumanQnA ? 'text-blue-400' : 'text-gray-500'} />
                    <span className={`font-medium ${formData.hasHumanQnA ? 'text-blue-400' : 'text-gray-400'}`}>
                      Human Q&A
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('hasHumanQnA', !formData.hasHumanQnA)}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.hasHumanQnA ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.hasHumanQnA ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Students can ask questions to instructors
                </p>
              </div>

              {/* Study Planner Toggle */}
              <div className={`p-4 rounded-lg border-2 transition-all ${
                formData.hasStudyPlanner 
                  ? 'bg-purple-900/20 border-purple-500/50' 
                  : 'bg-background-800 border-background-700'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CalendarCheck size={20} className={formData.hasStudyPlanner ? 'text-purple-400' : 'text-gray-500'} />
                    <span className={`font-medium ${formData.hasStudyPlanner ? 'text-purple-400' : 'text-gray-400'}`}>
                      Study Planner
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('hasStudyPlanner', !formData.hasStudyPlanner)}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.hasStudyPlanner ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.hasStudyPlanner ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  AI-powered personalized study planning
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Pricing & Discounts */}
        <Card title="Pricing & Discounts">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Price (BDT) <span className="text-error-DEFAULT">*</span>
              </label>
              <div className="relative">
                <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Previous Student Discount (BDT)
                </label>
                <input
                  type="number"
                  value={formData.previousStudentDiscount}
                  onChange={(e) => handleInputChange('previousStudentDiscount', parseFloat(e.target.value) || 0)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                  min="0"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Flat discount for users enrolled in any other course
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Extra Discount (BDT)
                </label>
                <input
                  type="number"
                  value={formData.extraDiscount}
                  onChange={(e) => handleInputChange('extraDiscount', parseFloat(e.target.value) || 0)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                  min="0"
                  disabled={loading}
                />
              </div>
            </div>

            {formData.extraDiscount > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Extra Discount Valid Until
                </label>
                <input
                  type="date"
                  value={formData.extraDiscountValidUntil ? formData.extraDiscountValidUntil.toISOString().split('T')[0] : ''}
                  onChange={(e) => handleInputChange('extraDiscountValidUntil', e.target.value ? new Date(e.target.value) : null)}
                  className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Validity */}
        <Card title="Course Validity">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Access Validity Date
            </label>
            <input
              type="date"
              value={formData.validity ? formData.validity.toISOString().split('T')[0] : ''}
              onChange={(e) => handleInputChange('validity', e.target.value ? new Date(e.target.value) : null)}
              className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              How long students can access this course after enrollment (optional)
            </p>
          </div>
        </Card>

        {/* Thumbnail */}
        <Card title="Course Thumbnail">
          <div className="space-y-4">
            {thumbnailPreview && (
              <div className="relative inline-block">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-64 h-40 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removeThumbnail}
                  className="absolute -top-2 -right-2 p-1 bg-error-DEFAULT text-white rounded-full hover:bg-error-dark transition-colors"
                  disabled={loading}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Upload Thumbnail Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Recommended size: 1280x720 pixels (will be uploaded to Supabase)</p>
            </div>
          </div>
        </Card>

        {/* Tags */}
        <Card title="Tags">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Add a tag..."
                disabled={loading}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                disabled={loading}
              >
                <Plus size={16} />
              </button>
            </div>
            
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary-900 text-primary-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-white"
                      disabled={loading}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Requirements */}
        <Card title="Requirements">
          <div className="space-y-3">
            {formData.requirements.map((requirement, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={requirement}
                  onChange={(e) => handleArrayFieldChange('requirements', index, e.target.value)}
                  className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter a requirement..."
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => removeArrayField('requirements', index)}
                  className="p-2 text-gray-400 hover:text-error-DEFAULT transition-colors"
                  disabled={loading || formData.requirements.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayField('requirements')}
              className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
              disabled={loading}
            >
              <Plus size={16} />
              <span>Add requirement</span>
            </button>
          </div>
        </Card>

        {/* What You'll Learn */}
        <Card title="What You'll Learn">
          <div className="space-y-3">
            {formData.whatYouWillLearn.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleArrayFieldChange('whatYouWillLearn', index, e.target.value)}
                  className="flex-1 bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="What will students learn..."
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => removeArrayField('whatYouWillLearn', index)}
                  className="p-2 text-gray-400 hover:text-error-DEFAULT transition-colors"
                  disabled={loading || formData.whatYouWillLearn.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addArrayField('whatYouWillLearn')}
              className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-colors"
              disabled={loading}
            >
              <Plus size={16} />
              <span>Add learning outcome</span>
            </button>
          </div>
        </Card>

        {/* Routine & Other Files */}
        <Card title="Routine & Other Files">
          <div className="space-y-4">
            {formData.routineFiles.map((routineFile) => (
              <div key={routineFile.id} className="p-4 bg-background-800 rounded-lg space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      File Category
                    </label>
                    <input
                      type="text"
                      value={routineFile.category}
                      onChange={(e) => handleRoutineFileCategoryChange(routineFile.id, e.target.value)}
                      className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., routine, leaflet, outline"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Upload File
                    </label>
                    <input
                      type="file"
                      onChange={(e) => e.target.files?.[0] && handleRoutineFileChange(routineFile.id, e.target.files[0])}
                      className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer file:text-sm"
                      disabled={loading}
                    />
                  </div>
                </div>

                {routineFile.file && (
                  <p className="text-xs text-success-DEFAULT">✓ File selected: {routineFile.file.name}</p>
                )}
                {routineFile.existingUrl && !routineFile.file && (
                  <p className="text-xs text-blue-400">ℹ Current: {routineFile.fileName || 'Existing file'}</p>
                )}

                <button
                  type="button"
                  onClick={() => removeRoutineFile(routineFile.id)}
                  className="flex items-center gap-2 text-error-DEFAULT hover:text-error-light text-sm"
                  disabled={loading}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addRoutineFile}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              disabled={loading}
            >
              <Plus size={16} />
              Add File
            </button>
          </div>
        </Card>

        {/* Content Structure */}
        <Card title="Course Content Structure">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400">
                  Build your course structure with folders and content
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Drag and drop to reorder • Unlimited nesting depth
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addFolder()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  disabled={loading}
                >
                  <FolderPlus size={16} />
                  Add Folder
                </button>
                <button
                  type="button"
                  onClick={() => openContentPicker()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  disabled={loading}
                >
                  <FilePlus size={16} />
                  Add Content
                </button>
              </div>
            </div>

            {formData.contentStructure.length > 0 ? (
              <div className="space-y-1">
                {formData.contentStructure.map(node => renderContentNode(node))}
              </div>
            ) : (
              <div className="text-center py-12 bg-background-800 rounded-lg border-2 border-dashed border-background-600">
                <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 mb-2">No content added yet</p>
                <p className="text-sm text-gray-500">
                  Start by adding folders to organize your content, or add content directly
                </p>
              </div>
            )}

            {formData.contentStructure.length > 0 && (
              <div className="bg-background-800 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Total Course Duration:</span>
                  <span className="text-xl font-bold text-primary-400">
                    {formatDuration(calculateTotalDuration(formData.contentStructure))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t border-background-700">
          <button
            type="button"
            onClick={closeForm}
            className="px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="px-6 py-3 bg-warning-600 hover:bg-warning-700 disabled:bg-warning-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            <Save size={16} />
            <span>{loading ? 'Saving...' : 'Save as Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="px-6 py-3 bg-success-600 hover:bg-success-700 disabled:bg-success-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            <CheckCircle size={16} />
            <span>{loading ? 'Publishing...' : 'Publish Course'}</span>
          </button>
        </div>
      </form>

      {/* Content Picker Modal */}
      {showContentPicker && renderContentPickerModal()}
    </div>
  );
};

export default CourseCreation;
