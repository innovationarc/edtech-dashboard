// src/pages/TeacherQA.tsx - PART 1 OF 2
// IMPORTANT: Copy this entire file, then immediately paste Part 2 after it

import { useState, useEffect } from 'react';
import { Search, BookOpen, User, MessageSquare, Loader, AlertCircle, CheckCircle, Clock, Send, X, Mic, FileText, Volume2, Plus, Book, Trash2 } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { qaService, Question, Knowledge } from '../services/qaService';
import { notificationService } from '../services/notificationService';

const TeacherQA = () => {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState<'questions' | 'knowledge'>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'answered'>('all');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);

  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'English', 'General'
  ];

  useEffect(() => {
    if (activeTab === 'questions') {
      loadQuestions();
      
      const unsubscribe = qaService.onNewPendingQuestions((newQuestions) => {
        setQuestions(prev => {
          const existing = prev.filter(q => q.status !== 'pending');
          return [...newQuestions, ...existing];
        });
      });

      return () => unsubscribe();
    } else {
      loadKnowledge();
    }
  }, [selectedSubject, selectedStatus, activeTab]);

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

  const loadKnowledge = async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedKnowledge = selectedSubject === 'all' 
        ? await qaService.getAllKnowledge()
        : await qaService.getKnowledgeBySubject(selectedSubject);
      setKnowledge(fetchedKnowledge);
    } catch (err: any) {
      setError('Failed to load knowledge: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionClick = (question: Question) => {
    setSelectedQuestion(question);
    setShowAnswerModal(true);
  };

  const handleAnswerSuccess = () => {
    loadQuestions();
    setShowAnswerModal(false);
    setSelectedQuestion(null);
    if ((window as any).addNotification) {
      (window as any).addNotification('Answer submitted successfully!', 'success');
    }
  };

  const handleKnowledgeSuccess = () => {
    loadKnowledge();
    setShowKnowledgeModal(false);
    if ((window as any).addNotification) {
      (window as any).addNotification('Knowledge added successfully!', 'success');
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this knowledge entry?')) return;
    
    try {
      await qaService.deleteKnowledge(id);
      loadKnowledge();
      if ((window as any).addNotification) {
        (window as any).addNotification('Knowledge deleted successfully!', 'success');
      }
    } catch (err: any) {
      setError('Failed to delete knowledge: ' + err.message);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredKnowledge = knowledge.filter(k => {
    const matchesSearch = k.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          k.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          k.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
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
          <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
          <p className="text-gray-400 mt-1">Manage questions and knowledge base</p>
        </div>
        {activeTab === 'knowledge' && (
          <button
            onClick={() => setShowKnowledgeModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            <span>Add Knowledge</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-background-700">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'questions'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={18} />
            <span>Questions</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'knowledge'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Book size={18} />
            <span>Knowledge Base</span>
          </div>
        </button>
      </div>

      <Card tilt={false}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder={activeTab === 'questions' ? 'Search questions...' : 'Search knowledge...'}
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex gap-3">
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

            {activeTab === 'questions' && (
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'answered')}
                className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="answered">Answered</option>
              </select>
            )}
          </div>
        </div>

        {activeTab === 'questions' ? (
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4" />
                <p>No questions found matching your criteria.</p>
              </div>
            ) : (
              filteredQuestions.map(question => (
                <div
                  key={question.id}
                  className="bg-background-800 rounded-lg p-4 cursor-pointer hover:bg-background-700 transition-colors"
                  onClick={() => handleQuestionClick(question)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-primary-400" />
                      <span className="text-sm font-medium text-white">{question.subject}</span>
                      {question.isFollowUp && (
                        <span className="text-xs text-orange-400 bg-orange-900 px-2 py-0.5 rounded">Follow-up</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                      question.status === 'pending' ? 'bg-warning-dark text-warning-light' : 'bg-success-dark text-success-light'
                    }`}>
                      {question.status === 'pending' ? <Clock size={12} /> : <CheckCircle size={12} />}
                      {question.status === 'pending' ? 'Pending' : 'Answered'}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>
                  {question.imageUrl && (
                    <img src={question.imageUrl} alt="Question attachment" className="max-h-40 object-contain rounded-lg mb-2" />
                  )}
                  {question.fileName && (
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <FileText size={14} />
                      <a href={question.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-400" onClick={(e) => e.stopPropagation()}>
                        {question.fileName}
                      </a>
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
        ) : (
          <div className="space-y-4">
            {filteredKnowledge.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Book size={48} className="mx-auto mb-4" />
                <p>No knowledge entries found. Add some to help AI solve questions better!</p>
              </div>
            ) : (
              filteredKnowledge.map(item => (
                <div key={item.id} className="bg-background-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-primary-400" />
                      <span className="text-sm font-medium text-white">{item.subject}</span>
                      <span className="text-xs px-2 py-1 rounded bg-purple-900 text-purple-300">
                        {item.type}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteKnowledge(item.id)}
                      className="text-error-light hover:text-error-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">{item.title}</h3>
                  <p className="text-gray-300 whitespace-pre-wrap mb-3 text-sm">{item.content}</p>
                  {item.imageUrls && item.imageUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {item.imageUrls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Knowledge ${idx + 1}`} className="max-h-32 object-contain rounded-lg border border-background-700" />
                      ))}
                    </div>
                  )}
                  {item.fileNames && item.fileNames.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {item.fileNames.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-400">
                          <FileText size={14} />
                          <a href={item.fileUrls?.[idx]} target="_blank" rel="noopener noreferrer" className="hover:text-primary-400">
                            {name}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-background-700">
                    Added by {item.teacherName} on {item.createdAt.toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {showAnswerModal && selectedQuestion && (
        <AnswerQuestionModal
          question={selectedQuestion}
          teacherId={user?.uid || ''}
          teacherName={user?.name || 'Teacher'}
          onClose={() => {
            setShowAnswerModal(false);
            setSelectedQuestion(null);
          }}
          onSuccess={handleAnswerSuccess}
        />
      )}

      {showKnowledgeModal && (
        <AddKnowledgeModal
          teacherId={user?.uid || ''}
          teacherName={user?.name || 'Teacher'}
          subjects={subjects}
          onClose={() => setShowKnowledgeModal(false)}
          onSuccess={handleKnowledgeSuccess}
        />
      )}
    </div>
  );
};

interface AnswerQuestionModalProps {
  question: Question;
  teacherId: string;
  teacherName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AnswerQuestionModal = ({ question, teacherId, teacherName, onClose, onSuccess }: AnswerQuestionModalProps) => {
  const [answerText, setAnswerText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

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
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(audioFile);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!answerText.trim() && !imageFile && !audioFile && !docFile) {
      setError('Please provide an answer (text, image, audio, or document).');
      setLoading(false);
      return;
    }

    try {
      let imageUrl: string | undefined;
      let audioUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // Upload all files to Google Drive (Q&A folder)
      if (imageFile) {
        const driveResult = await qaService.uploadToGoogleDrive(imageFile, 'answer_images');
        imageUrl = driveResult.webViewLink;
      }

      if (audioFile) {
        const driveResult = await qaService.uploadToGoogleDrive(audioFile, 'answer_audio');
        audioUrl = driveResult.webViewLink;
      }

      if (docFile) {
        const driveResult = await qaService.uploadToGoogleDrive(docFile, 'answer_documents');
        fileUrl = driveResult.webViewLink;
        fileName = docFile.name;
      }

      await qaService.answerQuestion({
        questionId: question.id,
        teacherId,
        teacherName,
        answerText: answerText.trim(),
        imageUrl,
        audioUrl,
        fileUrl,
        fileName,
        type: 'teacher',
      });

      notificationService.createNotification({
        userId: question.studentId,
        title: question.isFollowUp ? 'Follow-up Answered' : 'Your Question Was Answered',
        message: question.questionText,
        type: 'announcement',
        priority: 'high',
        isPermanent: true,
        relatedId: question.id,
        relatedType: 'qa',
        metadata: {
          subject: question.subject,
          courseId: question.courseId,
          isFollowUp: question.isFollowUp ?? false,
        },
      });

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit answer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-4xl my-8 relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Answer Question</h2>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Question Details */}
            <div className="space-y-4">
              <div className="bg-background-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={16} className="text-primary-400" />
                  <span className="text-sm font-medium text-white">{question.subject}</span>
                  {question.isFollowUp && (
                    <span className="text-xs text-orange-400 bg-orange-900 px-2 py-0.5 rounded">Follow-up</span>
                  )}
                </div>
                <h3 className="text-lg font-medium text-white mb-3">{question.questionText}</h3>
                {question.imageUrl && (
                  <img src={question.imageUrl} alt="Question" className="max-h-60 object-contain rounded-lg mb-3" />
                )}
                {question.fileName && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                    <FileText size={14} />
                    <a href={question.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-400">
                      {question.fileName}
                    </a>
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
            </div>

            {/* Answer Form */}
            <div className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Your Answer</label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Type your answer here..."
                    rows={8}
                    disabled={loading}
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Attach Image (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    disabled={loading}
                  />
                  {imageFile && (
                    <span className="text-sm text-gray-400 mt-1 block">{imageFile.name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Voice Answer (Optional)</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={loading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isRecording 
                          ? 'bg-error-dark text-error-light' 
                          : 'bg-background-800 text-white hover:bg-background-700'
                      }`}
                    >
                      {isRecording ? <Volume2 size={16} className="animate-pulse" /> : <Mic size={16} />}
                      <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                    </button>
                    {audioFile && (
                      <span className="text-sm text-gray-400 flex items-center">
                        Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Attach Document (PDF/DOCX)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleDocChange}
                    className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                    disabled={loading}
                  />
                  {docFile && (
                    <span className="text-sm text-gray-400 mt-1 block">{docFile.name}</span>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-background-800">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loading && <Loader size={16} className="animate-spin" />}
                    <Send size={16} />
                    <span>{loading ? 'Submitting...' : 'Submit Answer'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// PART 2 OF 2 - Paste this immediately after Part 1 in the same file

interface AddKnowledgeModalProps {
  teacherId: string;
  teacherName: string;
  subjects: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const AddKnowledgeModal = ({ teacherId, teacherName, subjects, onClose, onSuccess }: AddKnowledgeModalProps) => {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'concept' | 'sample_qa' | 'procedure'>('procedure');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!subject || !title.trim() || !content.trim()) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    try {
      const imageUrls: string[] = [];
      const fileUrls: string[] = [];
      const fileNames: string[] = [];

      // Upload images to Google Drive (Knowledge folder)
      for (const file of imageFiles) {
        const driveResult = await qaService.uploadToGoogleDrive(file, 'knowledge_images');
        imageUrls.push(driveResult.webViewLink);
      }

      // Upload documents to Google Drive (Knowledge folder)
      for (const file of docFiles) {
        const driveResult = await qaService.uploadToGoogleDrive(file, 'knowledge_documents');
        fileUrls.push(driveResult.webViewLink);
        fileNames.push(file.name);
      }

      await qaService.addKnowledge({
        teacherId,
        teacherName,
        subject,
        title: title.trim(),
        content: content.trim(),
        type,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        fileUrls: fileUrls.length > 0 ? fileUrls : undefined,
        fileNames: fileNames.length > 0 ? fileNames : undefined,
      });

      onSuccess();
    } catch (err: any) {
      setError('Failed to add knowledge: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-3xl my-8 relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Add Knowledge to Database</h2>
          <p className="text-gray-400 text-sm mb-6">
            Add teaching materials, solution methods, or sample Q&A that AI will use when answering student questions.
          </p>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                  required
                >
                  <option value="">Select a subject</option>
                  {subjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'concept' | 'sample_qa' | 'procedure')}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading}
                  required
                >
                  <option value="procedure">Solution Procedure</option>
                  <option value="concept">Concept/Theory</option>
                  <option value="sample_qa">Sample Q&A</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., Quadratic Formula Method, Photosynthesis Process"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Content/Procedure *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter the knowledge content, solving procedures, sample questions with answers, or teaching methods that AI should follow..."
                rows={10}
                disabled={loading}
                required
              ></textarea>
              <p className="text-xs text-gray-500 mt-1">
                Tip: Be specific about the steps and methods. AI will follow these exact procedures when solving similar questions.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Attach Images (Optional)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                disabled={loading}
              />
              {imageFiles.length > 0 && (
                <div className="text-sm text-gray-400 mt-1">
                  {imageFiles.length} image(s) selected: {imageFiles.map(f => f.name).join(', ')}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Attach Documents (PDF/DOCX) - Optional</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                multiple
                onChange={handleDocChange}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                disabled={loading}
              />
              {docFiles.length > 0 && (
                <div className="text-sm text-gray-400 mt-1">
                  {docFiles.length} document(s) selected: {docFiles.map(f => f.name).join(', ')}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Files will be uploaded to: Google Drive → Knowledge Folder (15CmR8svI9TYW8uqcCB0RbdgNkXAk1cTI)
              </p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-background-800">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader size={16} className="animate-spin" />}
                <Plus size={16} />
                <span>{loading ? 'Adding Knowledge...' : 'Add Knowledge'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TeacherQA;

// END OF PART 2 - File is complete
