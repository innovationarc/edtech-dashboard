import PageSkeleton from '../components/ui/PageSkeleton';
// src/pages/StudyPlan.tsx
// Teacher/Admin Study Plan Management — Search · Filter · Sort · AI Tips

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Plus, Edit, Trash2, Users, User, BookOpen, Clock,
  Search, Filter, SortAsc, Loader, AlertCircle, X, Sparkles,
  Brain, CheckCircle2, ChevronDown, TrendingUp, Layers, Video, Save,
} from 'lucide-react';
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService';
import { aiStudyPlannerService } from '../services/aiStudyPlannerService';
import { useDashboard } from '../contexts/DashboardContext';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const TYPE_EMOJI: Record<string, string> = {
  assignment:'📋', exam:'🎯', class:'🏫',
  study_session:'📚', deadline:'⏰', personal:'📝',
};

const PRIORITY_CLS: Record<string, string> = {
  high:   'bg-red-500/15 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

type SortKey = 'date' | 'priority' | 'type' | 'title';

const StudyPlan: React.FC = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();

  const [events, setEvents]         = useState<StudyPlanEvent[]>([]);
  const [allStudents, setAllStudents] = useState<{ uid: string; name: string; email: string }[]>([]);
  const [allCourses, setAllCourses]   = useState<{ id: string; title: string; instructorName: string }[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [showModal, setShowModal]         = useState(false);
  const [editingEvent, setEditingEvent]   = useState<StudyPlanEvent | null>(null);
  const [selectedDate, setSelectedDate]   = useState(new Date());

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType]     = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy]       = useState<SortKey>('date');
  const [showFilters, setShowFilters] = useState(false);

  // ── AI Tips ──────────────────────────────────────────────────────────────────
  const [tipsMap, setTipsMap]     = useState<Record<string, string[]>>({});
  const [tipsLoading, setTipsLoading] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Help Video URL ────────────────────────────────────────────────────────────
  const [helpVideoUrl, setHelpVideoUrl]       = useState('');
  const [helpVideoInput, setHelpVideoInput]   = useState('');
  const [savingVideoUrl, setSavingVideoUrl]   = useState(false);
  const [videoUrlSaved, setVideoUrlSaved]     = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      Promise.all([loadEvents(), loadStudentsAndCourses()]);
      studyPlanService.getHelpVideoUrl().then(url => {
        setHelpVideoUrl(url);
        setHelpVideoInput(url);
      });
    }
  }, [user]);

  const loadEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setEvents(await studyPlanService.getEventsByTeacher(user.uid));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadStudentsAndCourses = async () => {
    try {
      const [students, courses] = await Promise.all([
        studyPlanService.getAllStudents(),
        studyPlanService.getAllCourses(),
      ]);
      setAllStudents(students);
      setAllCourses(courses);
    } catch { /* silent */ }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const handleSaveEvent = async (data: Partial<StudyPlanEvent>) => {
    try {
      if (editingEvent) await studyPlanService.updateEvent(editingEvent.id, data);
      else              await studyPlanService.createEvent(data as any);
      setShowModal(false); setEditingEvent(null); await loadEvents();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    try { await studyPlanService.deleteEvent(id); await loadEvents(); }
    catch (e: any) { setError(e.message); }
  };

  // ── AI Tips ───────────────────────────────────────────────────────────────────
  const handleLoadTips = async (ev: StudyPlanEvent) => {
    if (tipsMap[ev.id] || tipsLoading[ev.id] || !GEMINI_KEY) return;
    setTipsLoading(p => ({ ...p, [ev.id]: true }));
    try {
      const tips = await aiStudyPlannerService.generateStudyTips(ev.course || ev.title, ev.eventType, GEMINI_KEY);
      setTipsMap(p => ({ ...p, [ev.id]: tips }));
    } catch { /* silent */ }
    finally { setTipsLoading(p => ({ ...p, [ev.id]: false })); }
  };

  const toggleExpand = (ev: StudyPlanEvent) => {
    const next = expandedId === ev.id ? null : ev.id;
    setExpandedId(next);
    if (next) handleLoadTips(ev);
  };

  const handleSaveVideoUrl = async () => {
    if (savingVideoUrl) return;
    setSavingVideoUrl(true);
    try {
      await studyPlanService.setHelpVideoUrl(helpVideoInput.trim());
      setHelpVideoUrl(helpVideoInput.trim());
      setVideoUrlSaved(true);
      setTimeout(() => setVideoUrlSaved(false), 2500);
    } catch (e: any) { setError(e.message); }
    finally { setSavingVideoUrl(false); }
  };

  // ── Filter + Sort ─────────────────────────────────────────────────────────────
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const filtered = events
    .filter(e => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.course.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== 'all' && e.eventType !== filterType) return false;
      if (filterPriority !== 'all' && e.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date')     return a.date.getTime() - b.date.getTime();
      if (sortBy === 'priority') return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === 'type')     return a.eventType.localeCompare(b.eventType);
      if (sortBy === 'title')    return a.title.localeCompare(b.title);
      return 0;
    });

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const now       = new Date();
  const upcoming  = events.filter(e => e.date >= now).length;
  const highPri   = events.filter(e => e.priority === 'high').length;
  const reached   = new Set(events.flatMap(e => e.targetStudentIds || [])).size;

  const inputCls = 'bg-background-800 text-white text-sm rounded-xl px-3 py-2 border border-background-700 focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-500';

  if (loading) return <PageSkeleton variant="mixed" />;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Study Plan Management
            {GEMINI_KEY && <span className="text-xs bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={9}/> AI</span>}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create and manage study plans for your students</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/teacher-topic-groups')}
            className="flex items-center gap-2 bg-background-700 hover:bg-background-600 text-gray-300 hover:text-white border border-background-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
            <Layers size={14} /> Topic Groups
          </button>
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg">
            <Plus size={15} /> Create Event
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events',     value: events.length,  icon: Calendar,     color: 'text-blue-400',    bg: 'bg-blue-500/10' },
          { label: 'Upcoming',         value: upcoming,       icon: Clock,        color: 'text-amber-400',  bg: 'bg-amber-500/10' },
          { label: 'High Priority',    value: highPri,        icon: TrendingUp,   color: 'text-red-400',    bg: 'bg-red-500/10' },
          { label: 'Students Reached', value: reached,        icon: Users,        color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        ].map(s => (
          <div key={s.label} className="bg-background-800 border border-background-700 rounded-2xl p-4">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-2`}>
              <s.icon size={16} className={s.color} />
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-background-800 border border-background-700 rounded-2xl p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search events…" className={inputCls + ' w-full pl-9'} />
          </div>
          <button onClick={() => setShowFilters(p => !p)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-colors ${showFilters ? 'bg-primary-600 border-primary-500 text-white' : 'bg-background-700 border-background-600 text-gray-400 hover:text-white'}`}>
            <Filter size={13} /> Filters
            {(filterType !== 'all' || filterPriority !== 'all') && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-background-700">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 font-medium">Type:</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className={inputCls}>
                <option value="all">All Types</option>
                {['class','assignment','exam','study_session','deadline','personal'].map(t => (
                  <option key={t} value={t}>{TYPE_EMOJI[t]} {t.replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 font-medium">Priority:</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={inputCls}>
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <SortAsc size={13} className="text-gray-400" />
              <label className="text-xs text-gray-400 font-medium">Sort:</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className={inputCls}>
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="type">Type</option>
                <option value="title">Title</option>
              </select>
            </div>
            {(filterType !== 'all' || filterPriority !== 'all' || search) && (
              <button onClick={() => { setFilterType('all'); setFilterPriority('all'); setSearch(''); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-background-700 hover:bg-background-600 px-3 py-2 rounded-xl transition-colors border border-background-600">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Help Video URL */}
      <div className="bg-background-800 border border-background-700 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Video size={15} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-white">Student Help Video</h2>
          <span className="text-xs text-gray-500 ml-1">Shown to students as a guide button + first-visit popup</span>
        </div>
        <div className="flex gap-2">
          <input
            value={helpVideoInput}
            onChange={e => setHelpVideoInput(e.target.value)}
            placeholder="Paste YouTube or Google Drive video URL…"
            className={inputCls + ' flex-1'}
          />
          <button
            onClick={handleSaveVideoUrl}
            disabled={savingVideoUrl || helpVideoInput.trim() === helpVideoUrl}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            {savingVideoUrl ? <Loader size={13} className="animate-spin" /> : videoUrlSaved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {videoUrlSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {helpVideoUrl && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-400" />
            Current: <a href={helpVideoUrl} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline truncate max-w-xs">{helpVideoUrl}</a>
          </p>
        )}
      </div>

      {/* Events List */}
      <div className="bg-background-800 border border-background-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-background-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Calendar size={15} className="text-primary-400" /> Study Plan Events
          </h2>
          <span className="text-xs text-gray-500">{filtered.length} of {events.length}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <Calendar size={40} className="mx-auto mb-4 text-gray-600" />
            <p className="text-sm font-medium">{events.length === 0 ? 'No events yet' : 'No events match your filters'}</p>
            <p className="text-xs text-gray-500 mt-1">{events.length === 0 ? 'Create your first event to get started' : 'Try adjusting your search or filters'}</p>
          </div>
        ) : (
          <div className="divide-y divide-background-700">
            {filtered.map(ev => {
              const isExpanded = expandedId === ev.id;
              const daysUntil  = Math.ceil((ev.date.getTime() - now.getTime()) / 86400000);
              const isPast     = ev.date < now;
              return (
                <div key={ev.id} className="hover:bg-background-750 transition-colors">
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className="text-lg">{TYPE_EMOJI[ev.eventType] || '📅'}</span>
                          <h3 className="text-sm font-semibold text-white">{ev.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITY_CLS[ev.priority]}`}>{ev.priority}</span>
                          {ev.isAIGenerated && <span className="text-xs bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={9}/>AI</span>}
                        </div>
                        {ev.description && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{ev.description}</p>}
                        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {ev.date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                            {ev.startTime && ` · ${ev.startTime}–${ev.endTime}`}
                          </span>
                          {ev.course && <span className="flex items-center gap-1"><BookOpen size={11}/>{ev.course}</span>}
                          <span className="flex items-center gap-1">
                            {ev.targetAudience === 'all'              && <><Users size={11}/>All Students</>}
                            {ev.targetAudience === 'specific_student' && <><User size={11}/>{ev.targetStudentIds?.length || 0} student{ev.targetStudentIds?.length !== 1 ? 's' : ''}</>}
                            {ev.targetAudience === 'course_students'  && <><BookOpen size={11}/>{ev.targetCourseIds?.length || 0} course{ev.targetCourseIds?.length !== 1 ? 's' : ''}</>}
                          </span>
                          <span className={`font-medium ${isPast ? 'text-gray-500' : daysUntil <= 1 ? 'text-red-400' : daysUntil <= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
                            {isPast ? 'Past' : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d away`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {GEMINI_KEY && (
                          <button onClick={() => toggleExpand(ev)}
                            className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${isExpanded ? 'bg-purple-500/20 text-purple-300' : 'bg-background-700 text-gray-400 hover:text-purple-300'}`}
                            title="AI Study Tips">
                            <Brain size={13} />
                            <ChevronDown size={11} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                        <button onClick={() => { setEditingEvent(ev); setSelectedDate(ev.date); setShowModal(true); }}
                          className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-lg transition-colors">
                          <Edit size={13} />
                        </button>
                        <button onClick={() => handleDelete(ev.id)}
                          className="p-1.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* AI Tips Panel */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-background-700">
                        <p className="text-xs font-semibold text-purple-300 flex items-center gap-1.5 mb-2">
                          <Brain size={12} /> AI Study Tips · {ev.course || ev.title}
                          <span className="text-gray-500 font-normal">Gemini 2.5 Flash</span>
                        </p>
                        {tipsLoading[ev.id] ? (
                          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                            <Loader size={12} className="animate-spin text-purple-400" /> Generating tips…
                          </div>
                        ) : tipsMap[ev.id]?.length ? (
                          <ul className="space-y-1.5">
                            {tipsMap[ev.id].map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                <span className="text-amber-400 font-bold flex-shrink-0">{i + 1}.</span>
                                <span className="leading-relaxed">{tip}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <StudyPlanEventModal
          event={editingEvent}
          selectedDate={selectedDate}
          currentUser={user}
          allStudents={allStudents}
          allCourses={allCourses}
          onSave={handleSaveEvent}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
          isPersonalEvent={false}
        />
      )}
    </div>
  );
};

export default StudyPlan;
