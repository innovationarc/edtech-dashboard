// src/pages/StudentQA.tsx
import { useState, useEffect } from 'react';
import { Plus, Search, Loader, AlertCircle, BookOpen, User, MessageSquare, X, Brain, Bell, FileText } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { qaService, Question } from '../services/qaService';
import { useNavigate } from 'react-router-dom';

const StudentQA = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskQuestionModal, setShowAskQuestionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'answered'>('all');
  const [questionFilter, setQuestionFilter] = useState<'my' | 'others' | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'English', 'General'
  ];

  useEffect(() => {
    loadQuestions();
    loadNotifications();
    
    const unsubscribe = qaService.onNewNotifications(user?.uid || '', (notifications) => {
      setUnreadCount(notifications.length);
      if (notifications.length > 0 && (window as any).addNotification) {
        (window as any).addNotification(notifications[0].message, 'info');
      }
    });

    return () => unsubscribe();
  }, [selectedSubject, selectedStatus, questionFilter]);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedQuestions = await qaService.getQuestions(selectedSubject, selectedStatus);
      setQuestions(fetchedQuestions);
    } catch (err: any) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifications = await qaService.getNotifications(user?.uid || '');
      const unread = notifications.filter(n => !n.read);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleAskQuestionSuccess = () => {
    loadQuestions();
    setShowAskQuestionModal(false);
    if ((window as any).addNotification) {
      (window as any).addNotification('Your question has been submitted!', 'success');
    }
  };

  const handleQuestionClick = async (question: Question) => {
    if (question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent) {
      await qaService.markQuestionAsViewed(question.id);
      
      const notifications = await qaService.getNotifications(user?.uid || '');
      const relatedNotif = notifications.find(n => n.questionId === question.id && !n.read);
      if (relatedNotif) {
        await qaService.markNotificationAsRead(relatedNotif.id);
        loadNotifications();
      }
    }
    navigate(`/question/${question.id}`);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      questionFilter === 'all' ? true :
      questionFilter === 'my' ? q.studentId === user?.uid :
      q.studentId !== user?.uid;
    
    return matchesSearch && matchesFilter;
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
        <div>
          <h1 className="text-2xl font-bold text-white">Ask a Question</h1>
          <p className="text-gray-400 mt-1">Get help from teachers, AI, and peers</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="relative">
              <Bell size={20} className="text-primary-400" />
              <span className="absolute -top-1 -right-1 bg-error-light text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowAskQuestionModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            <span>Ask New Question</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search questions..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex gap-3 flex-wrap">
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value as 'my' | 'others' | 'all')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Questions</option>
              <option value="my">My Questions</option>
              <option value="others">Others' Questions</option>
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'answered')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4" />
              <p>No questions found. Be the first to ask!</p>
            </div>
          ) : (
            filteredQuestions.map(question => (
              <div
                key={question.id}
                className={`bg-background-800 rounded-lg p-4 cursor-pointer hover:bg-background-700 transition-colors ${
                  question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent 
                    ? 'ring-2 ring-primary-500' 
                    : ''
                }`}
                onClick={() => handleQuestionClick(question)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-white">{question.subject}</span>
                    {question.studentId === user?.uid && (
                      <span className="text-xs text-primary-400 bg-primary-900 px-2 py-0.5 rounded">You</span>
                    )}
                    {question.isFollowUp && (
                      <span className="text-xs text-orange-400 bg-orange-900 px-2 py-0.5 rounded">Follow-up</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {question.status === 'answered' && question.answeredBy && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        question.answeredBy === 'ai' 
                          ? 'bg-purple-900 text-purple-300' 
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {question.answeredBy === 'ai' ? '🤖 AI' : '👨‍🏫 Teacher'}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      question.status === 'pending' 
                        ? 'bg-warning-dark text-warning-light' 
                        : 'bg-success-dark text-success-light'
                    }`}>
                      {question.status === 'pending' ? 'Pending' : 'Answered'}
                    </span>
                    {question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>
                {question.imageUrl && (
                  <img src={question.imageUrl} alt="Question attachment" className="max-h-40 object-contain rounded-lg mb-2" />
                )}
                {question.fileName && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <FileText size={14} />
                    <span>{question.fileName}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{question.studentName}</span>
                  </div>
                  <span>•</span>
                  <span>{question.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {showAskQuestionModal && (
        <AskQuestionModal
          onClose={() => setShowAskQuestionModal(false)}
          onSuccess={handleAskQuestionSuccess}
          studentId={user?.uid || ''}
          studentName={user?.name || 'Student'}
          subjects={subjects}
        />
      )}
    </div>
  );
};

interface AskQuestionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  subjects: string[];
}

const AskQuestionModal = ({ onClose, onSuccess, studentId, studentName, subjects }: AskQuestionModalProps) => {
  const [questionText, setQuestionText] = useState('');
  const [subject, setSubject] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAiSolution, setShowAiSolution] = useState(false);
  const [aiSolution, setAiSolution] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.5-flash';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid file (JPG, JPEG, PNG, GIF, WebP, PDF, or DOCX)');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        return;
      }
      
      setAttachedFile(file);
      setError('');
    }
  };

  const getFileType = (file: File): 'image' | 'document' => {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    return 'document';
  };

  // Detect language of the question
  const detectLanguage = (text: string): 'bengali' | 'english' | 'banglish' => {
    const bengaliPattern = /[\u0980-\u09FF]/;
    const banglishPattern = /\b(keno|karon|tumi|ami|kothay|kivabe|kobe|ke|ki|ache|hobe|kora|koto|kore|korte|jai|jay|jabe|jabo|chile|chilo|chilam|thake|thaki|thakbo|thakbe|bole|boli|bolte|bolbo|bolbe|kori|kivabe|korbo|korbe|hoy|hoye|jabe|geche|gelo|dao|den|debo|dibe)\b/i;
    
    if (bengaliPattern.test(text)) {
      return 'bengali';
    } else if (banglishPattern.test(text)) {
      return 'bengali';
    } else {
      return 'english';
    }
  };

  const handleSubmitToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!questionText.trim() || !subject) {
      setError('Please fill in question text and select a subject.');
      setLoading(false);
      return;
    }

    try {
      let imageUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // Upload file to Google Drive (Q&A folder)
      if (attachedFile) {
        const fileType = getFileType(attachedFile);
        const driveResult = await qaService.uploadToGoogleDrive(
          attachedFile, 
          fileType === 'image' ? 'question_images' : 'question_documents'
        );
        
        if (fileType === 'image') {
          imageUrl = driveResult.webViewLink;
        } else {
          fileUrl = driveResult.webViewLink;
          fileName = attachedFile.name;
        }
      }

      await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        imageUrl,
        fileUrl,
        fileName,
      });

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiSolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim() || !subject) {
      setError('Please fill in question text and select a subject.');
      return;
    }

    if (!API_KEY) {
      setError('API key not configured. Please check your .env file.');
      return;
    }

    setAiLoading(true);
    setShowAiSolution(true);
    setAiSolution('');

    try {
      // Get knowledge base for the subject
      const knowledgeList = await qaService.getKnowledgeBySubject(subject);
      const knowledgeContext = knowledgeList.length > 0 
        ? `\n\nTeacher's Knowledge Base for ${subject}:\n${knowledgeList.map(k => 
            `Title: ${k.title}\nContent: ${k.content}`
          ).join('\n\n')}`
        : '';

      // Detect question language
      const language = detectLanguage(questionText);
      const languageInstruction = language === 'bengali' || language === 'banglish'
        ? 'Answer ONLY in Bengali (Bangla script - বাংলা). If the question uses Banglish (Bengali written in English letters like "keno", "kivabe"), convert it to proper Bengali script first, then answer in Bengali.'
        : 'Answer ONLY in English.';

      const aiPrompt = `You are an expert AI tutor for Bengali (Bangla) education, teaching classes 6–12.

CRITICAL SUBJECT VALIDATION:
- The selected subject is: ${subject}
- If the question is NOT related to ${subject}, respond EXACTLY: "দয়া করে ${subject} বিষয়ের প্রশ্ন করুন। (Please ask questions related to ${subject}.)"
- Do NOT answer questions from other subjects.

LANGUAGE RULE:
${languageInstruction}
- Scientific/technical terms that MUST be in English (like "photosynthesis", "DNA", "Newton's Law", "quadratic equation") should remain in English.
- Mathematical symbols and equations use standard notation.
- All explanations and steps must be in the target language.

TEACHING METHOD:
${knowledgeContext ? '- IMPORTANT: Use the Teacher\'s Knowledge Base provided above for solving methods and procedures. Follow those exact methods.' : '- Use traditional Bengali school textbook methods (NCERT/NCTB style).'}

ANSWER FORMAT:
1. Provide ONLY:
   - Clear, numbered step-by-step solution (each step short and necessary)
   - Show ALL calculations and work
   - End with "চূড়ান্ত উত্তর:" (for Bengali) or "Final answer:" (for English)

2. No greetings, no summaries, no extra commentary.

3. For multi-part problems, label clearly: (ক), (খ), (গ) (for Bengali) or (a), (b), (c) (for English)

Subject: ${subject}
Question: ${questionText}${knowledgeContext}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: aiPrompt
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error (${response.status})`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from AI');
      }

      const solution = data.candidates[0].content.parts[0].text;
      setAiSolution(solution);

      // Save AI answer to database
      let imageUrl: string | undefined;
      if (attachedFile && getFileType(attachedFile) === 'image') {
        const driveResult = await qaService.uploadToGoogleDrive(attachedFile, 'question_images');
        imageUrl = driveResult.webViewLink;
      }

      const questionId = await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        imageUrl,
      });

      await qaService.answerQuestion({
        questionId,
        answerText: solution,
        type: 'ai',
      });

    } catch (err: any) {
      setError('Failed to get AI solution: ' + err.message);
      setShowAiSolution(false);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-6xl my-8 relative">
        <button
          onClick={onClose}
          disabled={loading || aiLoading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Ask a New Question</h2>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Question Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading || aiLoading}
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Question *</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Type your question here in Bengali or English..."
                  rows={6}
                  disabled={loading || aiLoading}
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Attach File (Optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                  disabled={loading || aiLoading}
                />
                {attachedFile && (
                  <div className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                    <FileText size={14} />
                    <span>{attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Supported: Images (JPG, PNG, GIF, WebP), Documents (PDF, DOCX) - Max 10MB
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-4 border-t border-background-800">
                <button
                  onClick={handleSubmitToTeacher}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {loading && <Loader size={16} className="animate-spin" />}
                  <User size={16} />
                  <span>{loading ? 'Submitting...' : 'Submit to Human Teacher'}</span>
                </button>

                <button
                  onClick={handleAiSolve}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {aiLoading && <Loader size={16} className="animate-spin" />}
                  <Brain size={16} />
                  <span>{aiLoading ? 'Solving...' : 'AI Solve-mate'}</span>
                </button>

                <button
                  onClick={onClose}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* AI Solution Panel */}
            <div className="space-y-4">
              {showAiSolution ? (
                <div className="bg-background-800 rounded-lg p-4 h-full min-h-[500px] max-h-[600px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-background-700 sticky top-0 bg-background-800 z-10">
                    <Brain size={20} className="text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">AI Solution</h3>
                  </div>

                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader size={32} className="animate-spin text-purple-500 mb-3" />
                      <p className="text-gray-400 text-sm">AI is solving your question...</p>
                    </div>
                  ) : aiSolution ? (
                    <div className="prose prose-invert max-w-none">
                      <div className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                        {aiSolution}
                      </div>
                      <div className="text-xs text-red-500 mt-4 pt-4 border-t border-background-700">
                        N.B.: AI Solve-mate answers may be inaccurate. Please use the Human Teacher option if you notice a flawed answer.
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="bg-background-800 rounded-lg p-8 h-full min-h-[500px] flex flex-col items-center justify-center text-center">
                  <Brain size={48} className="text-purple-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">AI Solve-mate</h3>
                  <p className="text-gray-400 text-sm max-w-sm mb-4">
                    Click "AI Solve-mate" to get an instant solution from our AI tutor. Perfect for quick help!
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports Bengali (বাংলা), Bengali (Romanized), and English
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQA;
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { qaService, Question } from '../services/qaService';
import { useNavigate } from 'react-router-dom';

const StudentQA = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskQuestionModal, setShowAskQuestionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'answered'>('all');
  const [questionFilter, setQuestionFilter] = useState<'my' | 'others' | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'English', 'General'
  ];

  useEffect(() => {
    loadQuestions();
    loadNotifications();
    
    const unsubscribe = qaService.onNewNotifications(user?.uid || '', (notifications) => {
      setUnreadCount(notifications.length);
      if (notifications.length > 0 && (window as any).addNotification) {
        (window as any).addNotification(notifications[0].message, 'info');
      }
    });

    return () => unsubscribe();
  }, [selectedSubject, selectedStatus, questionFilter]);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedQuestions = await qaService.getQuestions(selectedSubject, selectedStatus);
      setQuestions(fetchedQuestions);
    } catch (err: any) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifications = await qaService.getNotifications(user?.uid || '');
      const unread = notifications.filter(n => !n.read);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleAskQuestionSuccess = () => {
    loadQuestions();
    setShowAskQuestionModal(false);
    if ((window as any).addNotification) {
      (window as any).addNotification('Your question has been submitted!', 'success');
    }
  };

  const handleQuestionClick = async (question: Question) => {
    if (question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent) {
      await qaService.markQuestionAsViewed(question.id);
      
      const notifications = await qaService.getNotifications(user?.uid || '');
      const relatedNotif = notifications.find(n => n.questionId === question.id && !n.read);
      if (relatedNotif) {
        await qaService.markNotificationAsRead(relatedNotif.id);
        loadNotifications();
      }
    }
    navigate(`/question/${question.id}`);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      questionFilter === 'all' ? true :
      questionFilter === 'my' ? q.studentId === user?.uid :
      q.studentId !== user?.uid;
    
    return matchesSearch && matchesFilter;
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
        <div>
          <h1 className="text-2xl font-bold text-white">Ask a Question</h1>
          <p className="text-gray-400 mt-1">Get help from teachers, AI, and peers</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="relative">
              <Bell size={20} className="text-primary-400" />
              <span className="absolute -top-1 -right-1 bg-error-light text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowAskQuestionModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            <span>Ask New Question</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search questions..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex gap-3 flex-wrap">
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value as 'my' | 'others' | 'all')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Questions</option>
              <option value="my">My Questions</option>
              <option value="others">Others' Questions</option>
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'answered')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4" />
              <p>No questions found. Be the first to ask!</p>
            </div>
          ) : (
            filteredQuestions.map(question => (
              <div
                key={question.id}
                className={`bg-background-800 rounded-lg p-4 cursor-pointer hover:bg-background-700 transition-colors ${
                  question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent 
                    ? 'ring-2 ring-primary-500' 
                    : ''
                }`}
                onClick={() => handleQuestionClick(question)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-white">{question.subject}</span>
                    {question.studentId === user?.uid && (
                      <span className="text-xs text-primary-400 bg-primary-900 px-2 py-0.5 rounded">You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {question.status === 'answered' && question.answeredBy && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        question.answeredBy === 'ai' 
                          ? 'bg-purple-900 text-purple-300' 
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {question.answeredBy === 'ai' ? '🤖 AI' : '👨‍🏫 Teacher'}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      question.status === 'pending' 
                        ? 'bg-warning-dark text-warning-light' 
                        : 'bg-success-dark text-success-light'
                    }`}>
                      {question.status === 'pending' ? 'Pending' : 'Answered'}
                    </span>
                    {question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>
                {question.imageUrl && (
                  <img src={question.imageUrl} alt="Question attachment" className="max-h-40 object-contain rounded-lg mb-2" />
                )}
                {question.fileName && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <FileText size={14} />
                    <span>{question.fileName}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{question.studentName}</span>
                  </div>
                  <span>•</span>
                  <span>{question.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {showAskQuestionModal && (
        <AskQuestionModal
          onClose={() => setShowAskQuestionModal(false)}
          onSuccess={handleAskQuestionSuccess}
          studentId={user?.uid || ''}
          studentName={user?.name || 'Student'}
          subjects={subjects}
        />
      )}
    </div>
  );
};

interface AskQuestionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  subjects: string[];
}

const AskQuestionModal = ({ onClose, onSuccess, studentId, studentName, subjects }: AskQuestionModalProps) => {
  const [questionText, setQuestionText] = useState('');
  const [subject, setSubject] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAiSolution, setShowAiSolution] = useState(false);
  const [aiSolution, setAiSolution] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.0-flash-exp';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocFile(e.target.files[0]);
    }
  };

  const handleSubmitToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!questionText.trim() || !subject) {
      setError('Please fill in question text and select a subject.');
      setLoading(false);
      return;
    }

    try {
      let imageUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // Upload image to Google Drive (Q&A folder)
      if (imageFile) {
        const driveResult = await qaService.uploadToGoogleDrive(imageFile, 'questions');
        imageUrl = driveResult.webViewLink;
      }

      // Upload document to Google Drive (Q&A folder)
      if (docFile) {
        const driveResult = await qaService.uploadToGoogleDrive(docFile, 'questions');
        fileUrl = driveResult.webViewLink;
        fileName = docFile.name;
      }

      await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        imageUrl,
        fileUrl,
        fileName,
      });

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const detectLanguage = (text: string): string => {
    const bengaliChars = /[\u0980-\u09FF]/;
    const englishWords = /^[a-zA-Z\s]+$/;
    
    if (bengaliChars.test(text)) return 'Bengali';
    if (englishWords.test(text)) return 'English';
    return 'Banglish';
  };

  const handleAiSolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim() || !subject) {
      setError('Please fill in question text and select a subject.');
      return;
    }

    if (!API_KEY) {
      setError('API key not configured. Please check your .env file.');
      return;
    }

    setAiLoading(true);
    setShowAiSolution(true);
    setAiSolution('');

    try {
      // Fetch knowledge base for the subject
      const knowledgeBase = await qaService.getKnowledgeBySubject(subject);
      const knowledgeContext = knowledgeBase.length > 0 
        ? `\n\nImportant Knowledge Base (Use these methods/procedures when applicable):\n${knowledgeBase.map(k => 
            `- ${k.title}: ${k.content}`
          ).join('\n')}`
        : '';

      const language = detectLanguage(questionText);
      const languageInstruction = 
        language === 'Bengali' ? 'Answer FULLY in Bengali (বাংলা).' :
        language === 'Banglish' ? 'The question uses Banglish (Bengali words written in English). Answer FULLY in proper Bengali script (বাংলা). Convert all Banglish words to proper Bengali.' :
        'Answer FULLY in English.';

      const aiPrompt = `You are an expert AI tutor for Bengali (Bangla) education, teaching classes 6–12.

CRITICAL SUBJECT VALIDATION:
- The selected subject is: ${subject}
- If the question is NOT related to ${subject}, respond ONLY with: "দয়া করে ${subject} বিষয়ের প্রশ্ন জিজ্ঞাসা করুন। (Please ask questions related to ${subject}.)"
- Do NOT attempt to answer questions from other subjects.

Language Rule: ${languageInstruction}
- Keep scientific/technical terms in English (e.g., "photosynthesis", "quadratic equation", "DNA", "Newton's Law").
- All explanations, steps, and general text must be in the target language.

Solution Method:
${knowledgeContext}
- If the question matches any knowledge base procedure, USE THAT METHOD EXACTLY as taught by the teacher.
- Otherwise, use traditional Bengali school textbook methods (NCERT/NCTB style).

Format:
1. Provide ONLY step-by-step solution (numbered, short, necessary steps).
2. Show ALL calculations and reasoning clearly.
3. For math: Write formulas, then substitute values, then calculate.
4. For science: State the principle/law, apply it, show work.
5. End with "চূড়ান্ত উত্তর:" (if Bengali) or "Final answer:" (if English) followed by the result.
6. NO greetings, NO summaries, NO extra commentary.

Subject: ${subject}
Question: ${questionText}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: aiPrompt
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error (${response.status})`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from AI');
      }

      const solution = data.candidates[0].content.parts[0].text;
      setAiSolution(solution);

      // Save AI answer to database
      let imageUrl: string | undefined;
      if (imageFile) {
        const driveResult = await qaService.uploadToGoogleDrive(imageFile, 'questions');
        imageUrl = driveResult.webViewLink;
      }

      const questionId = await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        imageUrl,
      });

      await qaService.answerQuestion({
        questionId,
        answerText: solution,
        type: 'ai',
      });

    } catch (err: any) {
      setError('Failed to get AI solution: ' + err.message);
      setShowAiSolution(false);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-6xl my-8 relative">
        <button
          onClick={onClose}
          disabled={loading || aiLoading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Ask a New Question</h2>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading || aiLoading}
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Question *</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Type your question here..."
                  rows={6}
                  disabled={loading || aiLoading}
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Attach Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                  disabled={loading || aiLoading}
                />
                {imageFile && (
                  <span className="text-sm text-gray-400 mt-1 block">{imageFile.name}</span>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Attach Document (PDF/DOCX) - Teacher Only</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleDocChange}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                  disabled={loading || aiLoading}
                />
                {docFile && (
                  <span className="text-sm text-gray-400 mt-1 block">{docFile.name}</span>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-background-800">
                <button
                  onClick={handleSubmitToTeacher}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {loading && <Loader size={16} className="animate-spin" />}
                  <User size={16} />
                  <span>{loading ? 'Submitting...' : 'Submit to Human Teacher'}</span>
                </button>

                <button
                  onClick={handleAiSolve}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {aiLoading && <Loader size={16} className="animate-spin" />}
                  <Brain size={16} />
                  <span>{aiLoading ? 'Solving...' : 'AI Solve-mate'}</span>
                </button>

                <button
                  onClick={onClose}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {showAiSolution ? (
                <div className="bg-background-800 rounded-lg p-4 h-full min-h-[500px] max-h-[600px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-background-700 sticky top-0 bg-background-800">
                    <Brain size={20} className="text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">AI Solution</h3>
                  </div>

                  {aiLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader size={32} className="animate-spin text-purple-500 mb-3" />
                      <p className="text-gray-400 text-sm">AI is solving your question...</p>
                    </div>
                  ) : aiSolution ? (
                    <div className="prose prose-invert max-w-none">
                      <div className="text-white whitespace-pre-wrap text-sm leading-relaxed">
                        {aiSolution}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="bg-background-800 rounded-lg p-8 h-full min-h-[500px] flex flex-col items-center justify-center text-center">
                  <Brain size={48} className="text-purple-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">AI Solve-mate</h3>
                  <p className="text-gray-400 text-sm max-w-sm">
                    Click "AI Solve-mate" to get an instant solution from our AI tutor. Perfect for quick help!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQA;