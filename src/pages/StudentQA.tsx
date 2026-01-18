// src/pages/StudentQA.tsx - Part 1 of 3 (Enhanced with Advanced Similarity Detection)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  BookOpen,
  User,
  Loader,
  AlertCircle,
  Search,
  Filter,
  X,
  FileText,
  Send,
  Image as ImageIcon,
  Upload,
  Mic,
  Volume2,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { qaService, Question } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { useDashboard } from '../contexts/DashboardContext';

const StudentQA = () => {
  const navigate = useNavigate();
  const { user } = useDashboard();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [enrolledCoursesWithQnA, setEnrolledCoursesWithQnA] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskModal, setShowAskModal] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
    loadQuestions();
  }, []);

  const loadEnrolledCoursesWithQnA = async () => {
    try {
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      const enrolledCourses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const course = await courseService.getCourseById(enrollment.courseId);
          return course;
        })
      );
      const coursesWithQnA = enrolledCourses.filter(
        (course): course is Course => course !== null && course.hasQnA === true
      );
      setEnrolledCoursesWithQnA(coursesWithQnA);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const allQs = await qaService.getQuestions('all', 'all');
      const enrolledCourseIds = enrolledCoursesWithQnA.map(c => c.id);
      
      // Filter: student's own questions + answered questions from enrolled courses (excluding closed from others)
      // Exclude follow-up questions from main listing
      const filteredQuestions = allQs.filter(q => {
        if (q.isFollowUp) return false;
        
        if (q.studentId === user?.uid) {
          return true;
        } else {
          const isEnrolled = q.courseId === 'help-support' || enrolledCourseIds.includes(q.courseId || '');
          return q.status === 'answered' && q.status !== 'closed' && isEnrolled;
        }
      });
      
      const rootQuestions = filteredQuestions.filter(q => !q.parentQuestionId);
      setQuestions(rootQuestions);
    } catch (err: any) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasUnreadAnswer = (question: Question): boolean => {
    if (question.studentId !== user?.uid) return false;
    
    if (question.status === 'answered' && !question.viewedByStudent) return true;
    
    const hasUnreadFollowUp = questions.some(q => 
      q.parentQuestionId === question.id && 
      q.studentId === user?.uid && 
      q.status === 'answered' && 
      !q.viewedByStudent
    );
    
    return hasUnreadFollowUp;
  };

  const getUniqueSubjects = () => {
    const subjects = new Set(questions.map(q => q.subject));
    return Array.from(subjects).sort();
  };

  const filteredQuestions = questions.filter(q => {
    const subjectMatch = selectedSubjectFilter === 'all' || q.subject === selectedSubjectFilter;
    const courseMatch = selectedCourseFilter === 'all' ? true :
                        selectedCourseFilter === 'help-support' ? q.courseId === 'help-support' :
                        q.courseId === selectedCourseFilter;
    const statusMatch = statusFilter === 'all' || q.status === statusFilter;
    const searchMatch = searchQuery === '' || 
                       q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       q.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return subjectMatch && courseMatch && statusMatch && searchMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Questions & Answers</h1>
        <button
          onClick={() => setShowAskModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
        >
          <Plus size={20} />
          <span>Ask Question</span>
        </button>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 bg-background-800 hover:bg-background-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Filter size={20} />
              <span>Filters</span>
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-background-800 rounded-lg">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject</label>
                <select
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="w-full bg-background-900 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Subjects</option>
                  {getUniqueSubjects().map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Course</label>
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="w-full bg-background-900 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Courses</option>
                  <option value="help-support">Help & Support</option>
                  {enrolledCoursesWithQnA.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-background-900 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="answered">Answered</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4">
        {filteredQuestions.length === 0 ? (
          <Card>
            <div className="text-center py-12 text-gray-400">
              <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No questions found</p>
              <p className="text-sm">
                {searchQuery || selectedSubjectFilter !== 'all' || selectedCourseFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Start by asking your first question!'}
              </p>
            </div>
          </Card>
        ) : (
          filteredQuestions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              hasUnreadAnswer={hasUnreadAnswer(question)}
              isOwnQuestion={question.studentId === user?.uid}
              onClick={() => navigate(`/question/${question.id}`)}
            />
          ))
        )}
      </div>

      {showAskModal && (
        <AskQuestionModal
          enrolledCoursesWithQnA={enrolledCoursesWithQnA}
          onClose={() => setShowAskModal(false)}
          onSuccess={() => {
            setShowAskModal(false);
            loadQuestions();
            if ((window as any).addNotification) {
              (window as any).addNotification('Question submitted successfully!', 'success');
            }
          }}
        />
      )}
    </div>
  );
};

interface QuestionCardProps {
  question: Question;
  hasUnreadAnswer: boolean;
  isOwnQuestion: boolean;
  onClick: () => void;
}

const QuestionCard = ({ question, hasUnreadAnswer, isOwnQuestion, onClick }: QuestionCardProps) => {
  return (
    <Card className="hover:border-primary-500 cursor-pointer transition-all" onClick={onClick}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BookOpen size={20} className="text-primary-400 flex-shrink-0" />
            <span className="text-lg font-medium text-white truncate">{question.subject}</span>
            {hasUnreadAnswer && (
              <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {question.answeredBy && question.status !== 'closed' && (
              <span className={`text-xs px-3 py-1 rounded-full ${
                question.answeredBy === 'ai' 
                  ? 'bg-purple-900 text-purple-300' 
                  : 'bg-blue-900 text-blue-300'
              }`}>
                {question.answeredBy === 'ai' ? 'AI' : question.courseId === 'help-support' ? 'Admin' : 'Teacher'}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs ${
              question.status === 'pending' 
                ? 'bg-warning-dark text-warning-light' 
                : question.status === 'closed'
                ? 'bg-error-dark text-error-light'
                : 'bg-success-dark text-success-light'
            }`}>
              {question.status === 'pending' ? 'Pending' : question.status === 'closed' ? 'Closed' : 'Answered'}
            </span>
          </div>
        </div>

        <p className="text-gray-300 line-clamp-2">{question.questionText}</p>

        {(question.imageUrl || question.audioUrl || question.fileUrl) && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {question.imageUrl && (
              <div className="flex items-center gap-1">
                <ImageIcon size={14} />
                <span>Image</span>
              </div>
            )}
            {question.audioUrl && (
              <div className="flex items-center gap-1">
                <Volume2 size={14} />
                <span>Audio</span>
              </div>
            )}
            {question.fileUrl && (
              <div className="flex items-center gap-1">
                <FileText size={14} />
                <span>File</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-400 pt-3 border-t border-background-700">
          <div className="flex items-center gap-2">
            <User size={16} />
            <span>{question.studentName}</span>
            {isOwnQuestion && (
              <span className="text-primary-400">(You)</span>
            )}
          </div>
          <span>{question.createdAt.toLocaleDateString()}</span>
        </div>
      </div>
    </Card>
  );
};
// src/pages/StudentQA.tsx - Part 2 of 3 (Similar Questions Modal with Advanced Similarity)

interface AskQuestionModalProps {
  enrolledCoursesWithQnA: Course[];
  onClose: () => void;
  onSuccess: () => void;
}

const AskQuestionModal = ({ enrolledCoursesWithQnA, onClose, onSuccess }: AskQuestionModalProps) => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [selectedAnswerType, setSelectedAnswerType] = useState<'ai' | 'teacher'>('ai');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSimilarQuestions, setShowSimilarQuestions] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<Question[]>([]);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.0-flash-exp';

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Document size must be less than 10MB');
        return;
      }
      setDocumentFile(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFileObj = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(audioFileObj);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const checkForSimilarQuestions = async () => {
    if (!questionText.trim() || !subject) return;

    setCheckingSimilarity(true);
    try {
      const courseId = selectedCourse === 'help-support' ? 'help-support' : selectedCourse;
      
      // Upload image temporarily if exists to get URL for similarity check
      let tempImageUrl = '';
      if (imageFile) {
        const uploadResult = await qaService.uploadToSupabase(imageFile, 'question_images');
        tempImageUrl = uploadResult.url;
      }

      const similar = await qaService.findSimilarQuestions(
        questionText.trim(),
        subject,
        undefined,
        tempImageUrl,
        courseId
      );

      if (similar.length > 0) {
        setSimilarQuestions(similar);
        setShowSimilarQuestions(true);
      } else {
        // No similar questions, proceed to submit
        await handleSubmitQuestion();
      }
    } catch (err: any) {
      setError('Failed to check for similar questions: ' + err.message);
    } finally {
      setCheckingSimilarity(false);
    }
  };

  const handleSubmitQuestion = async () => {
    setError('');
    
    if (!selectedCourse) {
      setError('Please select a course');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!questionText.trim()) {
      setError('Please enter your question');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = '';
      let audioUrl = '';
      let fileUrl = '';
      let fileName = '';

      if (imageFile) {
        const uploadResult = await qaService.uploadToSupabase(imageFile, 'question_images');
        imageUrl = uploadResult.url;
      }

      if (audioFile) {
        const uploadResult = await qaService.uploadToSupabase(audioFile, 'question_audio');
        audioUrl = uploadResult.url;
      }

      if (documentFile) {
        const uploadResult = await qaService.uploadToSupabase(documentFile, 'question_documents');
        fileUrl = uploadResult.url;
        fileName = documentFile.name;
      }

      const courseId = selectedCourse === 'help-support' ? 'help-support' : selectedCourse;

      const questionId = await qaService.askQuestion({
        studentId: user?.uid || '',
        studentName: user?.displayName || 'Student',
        subject: subject.trim(),
        questionText: questionText.trim(),
        imageUrl,
        audioUrl,
        fileUrl,
        fileName,
        courseId,
      });

      if (selectedAnswerType === 'ai') {
        const knowledgeList = await qaService.getKnowledgeBySubject(subject);
        const knowledgeContext = knowledgeList.length > 0 
          ? `\n\nTeacher's Knowledge Base:\n${knowledgeList.map(k => `${k.title}: ${k.content}`).join('\n')}`
          : '';

        const aiPrompt = `You are an AI tutor helping students. A student has asked:

"${questionText.trim()}"

Subject: ${subject}
${knowledgeContext}

Provide a clear, detailed, step-by-step answer to their question. Use simple language and examples where appropriate.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: aiPrompt }] }]
            })
          }
        );

        if (!response.ok) throw new Error('AI request failed');

        const data = await response.json();
        const solution = data.candidates[0].content.parts[0].text;

        await qaService.answerQuestion({
          questionId,
          answerText: solution,
          type: 'ai',
        });
      }

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await checkForSimilarQuestions();
  };

  const handleSimilarQuestionClick = (question: Question) => {
    // Close the modal first
    onClose();
    // Navigate to the question detail page
    navigate(`/question/${question.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Ask a Question</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {!showSimilarQuestions ? (
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Select Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                disabled={loading || checkingSimilarity}
              >
                <option value="">Choose a course...</option>
                <option value="help-support">Help & Support</option>
                {enrolledCoursesWithQnA.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Algebra, Physics, History..."
                required
                disabled={loading || checkingSimilarity}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Question</label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Describe your question in detail..."
                rows={6}
                required
                disabled={loading || checkingSimilarity}
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Attach Image (Optional)</label>
                <label className="flex items-center justify-center gap-2 bg-background-800 hover:bg-background-700 text-white px-4 py-3 rounded-lg transition-colors cursor-pointer">
                  <ImageIcon size={18} />
                  <span>{imageFile ? imageFile.name : 'Choose Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={loading || checkingSimilarity}
                  />
                </label>
                {imagePreview && (
                  <div className="mt-2 relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                      }}
                      className="absolute top-2 right-2 p-1 bg-error-dark hover:bg-error-DEFAULT text-white rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Attach Document (Optional)</label>
                <label className="flex items-center justify-center gap-2 bg-background-800 hover:bg-background-700 text-white px-4 py-3 rounded-lg transition-colors cursor-pointer">
                  <Upload size={18} />
                  <span>{documentFile ? documentFile.name : 'Choose File'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleDocumentSelect}
                    className="hidden"
                    disabled={loading || checkingSimilarity}
                  />
                </label>
                {documentFile && (
                  <div className="mt-2 flex items-center justify-between bg-background-800 rounded-lg p-2">
                    <span className="text-sm text-gray-300 truncate">{documentFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocumentFile(null)}
                      className="p-1 text-error-light hover:text-error-DEFAULT"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Voice Message (Optional)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={loading || checkingSimilarity}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-error-dark text-error-light' 
                      : 'bg-background-800 text-white hover:bg-background-700'
                  }`}
                >
                  {isRecording ? <Volume2 size={18} className="animate-pulse" /> : <Mic size={18} />}
                  <span>{isRecording ? 'Stop Recording' : 'Record Audio'}</span>
                </button>
                {audioFile && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setAudioFile(null)}
                      className="text-error-light hover:text-error-DEFAULT"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Answer Preference</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedAnswerType('ai')}
                  disabled={loading || checkingSimilarity}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    selectedAnswerType === 'ai'
                      ? 'bg-purple-600 text-white'
                      : 'bg-background-800 text-gray-400 hover:bg-background-700'
                  }`}
                >
                  <Sparkles size={18} />
                  <span>AI Solve-mate (Instant)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAnswerType('teacher')}
                  disabled={loading || checkingSimilarity}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    selectedAnswerType === 'teacher'
                      ? 'bg-blue-600 text-white'
                      : 'bg-background-800 text-gray-400 hover:bg-background-700'
                  }`}
                >
                  <User size={18} />
                  <span>Human {selectedCourse === 'help-support' ? 'Admin' : 'Teacher'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {selectedAnswerType === 'ai'
                  ? 'Get instant AI-powered answers. Note: AI answers may be inaccurate.'
                  : `Wait for a ${selectedCourse === 'help-support' ? 'admin' : 'teacher'} to answer your question.`}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || checkingSimilarity}
                className="flex-1 px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || checkingSimilarity}
                className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {(loading || checkingSimilarity) && <Loader size={18} className="animate-spin" />}
                <span>
                  {checkingSimilarity ? 'Checking...' : loading ? 'Submitting...' : 'Submit Question'}
                </span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-warning-dark text-warning-light px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              <div className="flex-1">
                <p className="font-medium">Similar Questions Found!</p>
                <p className="text-sm">We found {similarQuestions.length} similar question{similarQuestions.length > 1 ? 's' : ''} that might help you.</p>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {similarQuestions.map((sq) => (
                <div
                  key={sq.id}
                  onClick={() => handleSimilarQuestionClick(sq)}
                  className="bg-background-800 hover:bg-background-700 rounded-lg p-4 cursor-pointer transition-colors border border-transparent hover:border-primary-500"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <BookOpen size={16} className="text-primary-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-white">{sq.subject}</span>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs bg-success-dark text-success-light flex-shrink-0">
                      Answered
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm line-clamp-2 mb-2">{sq.questionText}</p>
                  {sq.imageUrl && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <ImageIcon size={12} />
                      <span>Has image attachment</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-background-700">
              <button
                onClick={() => setShowSimilarQuestions(false)}
                className="flex-1 px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <EyeOff size={18} />
                <span>Back to Question</span>
              </button>
              <button
                onClick={handleSubmitQuestion}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader size={18} className="animate-spin" />}
                <Send size={18} />
                <span>{loading ? 'Submitting...' : 'Ask Anyway'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentQA;
