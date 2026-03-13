import PageSkeleton from '../components/ui/PageSkeleton';
// src/pages/TeacherTopicGroups.tsx
// Teacher Topic Group Manager — Create groups · Add subjects/chapters/topics · CSV import · Assign to courses

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Edit, ChevronDown, ChevronRight, Upload, Download,
  Loader, AlertCircle, CheckCircle2, X, BookOpen, Layers, FileText,
  Link, Unlink, Save, RotateCcw,
} from 'lucide-react';
import {
  topicGroupService, TopicGroup, TopicSubject, TopicChapter, Topic, genId,
} from '../services/topicGroupService';
import { studyPlanService } from '../services/studyPlanService';
import { useDashboard } from '../contexts/DashboardContext';
import Card from '../components/ui/Card';

const DIFF_CLS: Record<string, string> = {
  easy:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  hard:   'bg-red-500/15 text-red-400 border-red-500/30',
};

const CSV_TEMPLATE = `Subject,Chapter,Topic,MinHours,MaxHours,Difficulty
Mathematics,Algebra,Linear Equations,1,2,easy
Mathematics,Algebra,Quadratic Equations,1.5,3,medium
Physics,Mechanics,Newton's Laws,1,2,medium
Physics,Mechanics,Energy & Work,1.5,2.5,hard
`;

// ─── Component ───────────────────────────────────────────────────────────────

const TeacherTopicGroups: React.FC = () => {
  const { user } = useDashboard();

  const [groups, setGroups]         = useState<TopicGroup[]>([]);
  const [allCourses, setAllCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  // Create group form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName]     = useState('');
  const [saving, setSaving]                 = useState(false);

  // Selected group for editing
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // CSV import
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvGroupId, setCsvGroupId]     = useState<string | null>(null);
  const [csvText, setCsvText]           = useState('');
  const [csvError, setCsvError]         = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline editing states
  const [editingSubjectId, setEditingSubjectId]   = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId]   = useState<string | null>(null);
  const [editingTopicId, setEditingTopicId]       = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName]       = useState('');
  const [newChapterName, setNewChapterName]       = useState('');
  const [expandedSubjects, setExpandedSubjects]   = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters]   = useState<Set<string>>(new Set());

  // New topic form state
  const [addingTopicToChapter, setAddingTopicToChapter] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' as Topic['difficulty'] });

  // Course assignment
  const [assigningGroupId, setAssigningGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [grps, courses] = await Promise.all([
        topicGroupService.getGroupsByTeacher(user.uid),
        studyPlanService.getAllCourses(),
      ]);
      setGroups(grps);
      setAllCourses(courses);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  // ── Create Group ──────────────────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim() || saving) return;
    setSaving(true);
    try {
      await topicGroupService.createGroup({
        teacherId: user.uid,
        name: newGroupName.trim(),
        subjects: [],
        assignedCourseIds: [],
      });
      setNewGroupName('');
      setShowCreateForm(false);
      flash('Group created!');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this topic group? This cannot be undone.')) return;
    try {
      await topicGroupService.deleteGroup(id);
      if (selectedGroupId === id) setSelectedGroupId(null);
      await load();
    } catch (e: any) { setError(e.message); }
  };

  // ── Subject Management ────────────────────────────────────────────────────

  const saveGroupUpdate = async (groupId: string, subjects: TopicSubject[]) => {
    await topicGroupService.updateGroup(groupId, { subjects });
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, subjects } : g));
  };

  const handleAddSubject = async (groupId: string) => {
    if (!newSubjectName.trim()) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const updated = [...group.subjects, { id: genId(), name: newSubjectName.trim(), chapters: [] }];
    await saveGroupUpdate(groupId, updated);
    setNewSubjectName('');
    setEditingSubjectId(null);
    flash('Subject added');
  };

  const handleDeleteSubject = async (groupId: string, subjectId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    await saveGroupUpdate(groupId, group.subjects.filter(s => s.id !== subjectId));
  };

  // ── Chapter Management ────────────────────────────────────────────────────

  const handleAddChapter = async (groupId: string, subjectId: string) => {
    if (!newChapterName.trim()) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const updated = group.subjects.map(s => s.id !== subjectId ? s : {
      ...s,
      chapters: [...s.chapters, { id: genId(), name: newChapterName.trim(), topics: [] }],
    });
    await saveGroupUpdate(groupId, updated);
    setNewChapterName('');
    setEditingChapterId(null);
    flash('Chapter added');
  };

  const handleDeleteChapter = async (groupId: string, subjectId: string, chapterId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const updated = group.subjects.map(s => s.id !== subjectId ? s : {
      ...s,
      chapters: s.chapters.filter(c => c.id !== chapterId),
    });
    await saveGroupUpdate(groupId, updated);
  };

  // ── Topic Management ──────────────────────────────────────────────────────

  const handleAddTopic = async (groupId: string, subjectId: string, chapterId: string) => {
    if (!newTopic.name.trim()) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const topic: Topic = { id: genId(), name: newTopic.name.trim(), minHours: newTopic.minHours, maxHours: newTopic.maxHours, difficulty: newTopic.difficulty };
    const updated = group.subjects.map(s => s.id !== subjectId ? s : {
      ...s,
      chapters: s.chapters.map(c => c.id !== chapterId ? c : {
        ...c,
        topics: [...c.topics, topic],
      }),
    });
    await saveGroupUpdate(groupId, updated);
    setNewTopic({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' });
    setAddingTopicToChapter(null);
    flash('Topic added');
  };

  const handleDeleteTopic = async (groupId: string, subjectId: string, chapterId: string, topicId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const updated = group.subjects.map(s => s.id !== subjectId ? s : {
      ...s,
      chapters: s.chapters.map(c => c.id !== chapterId ? c : {
        ...c,
        topics: c.topics.filter(t => t.id !== topicId),
      }),
    });
    await saveGroupUpdate(groupId, updated);
  };

  // ── CSV Import ────────────────────────────────────────────────────────────

  const handleOpenCSV = (groupId: string) => {
    setCsvGroupId(groupId);
    setCsvText('');
    setCsvError('');
    setShowCSVModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText((ev.target?.result as string) || '');
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportCSV = async () => {
    if (!csvGroupId || !csvText.trim() || csvImporting) return;
    setCsvError('');
    setCsvImporting(true);
    try {
      const newSubjects = topicGroupService.parseTopicCSV(csvText);
      const group = groups.find(g => g.id === csvGroupId);
      if (!group) return;
      // Merge: append new subjects or merge chapters into existing subjects
      const merged = [...group.subjects];
      for (const ns of newSubjects) {
        const existing = merged.find(s => s.name.toLowerCase() === ns.name.toLowerCase());
        if (existing) {
          for (const nc of ns.chapters) {
            const ec = existing.chapters.find(c => c.name.toLowerCase() === nc.name.toLowerCase());
            if (ec) {
              ec.topics = [...ec.topics, ...nc.topics];
            } else {
              existing.chapters.push(nc);
            }
          }
        } else {
          merged.push(ns);
        }
      }
      await saveGroupUpdate(csvGroupId, merged);
      setShowCSVModal(false);
      setCsvGroupId(null);
      flash(`Imported ${newSubjects.length} subject(s) from CSV`);
      await load();
    } catch (e: any) {
      setCsvError(e.message);
    } finally {
      setCsvImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'topics_template.csv';
    a.click();
  };

  // ── Course Assignment ─────────────────────────────────────────────────────

  const handleToggleCourseAssignment = async (groupId: string, courseId: string, assigned: boolean) => {
    try {
      if (assigned) {
        await topicGroupService.unassignFromCourse(groupId, courseId);
      } else {
        await topicGroupService.assignToCourse(groupId, courseId);
      }
      await load();
      flash(assigned ? 'Unassigned from course' : 'Assigned to course!');
    } catch (e: any) { setError(e.message); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleSubject = (id: string) =>
    setExpandedSubjects(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleChapter = (id: string) =>
    setExpandedChapters(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const inputCls = 'w-full bg-background-700 text-white text-sm rounded-xl px-3 py-2 border border-background-600 focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-500';
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  if (loading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-primary-400" /> Topic Groups
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create structured topic libraries for your courses</p>
        </div>
        <button
          onClick={() => setShowCreateForm(p => !p)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus size={14} /> New Group
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 size={14} />{success}
        </div>
      )}

      {/* ── Create Group Form ── */}
      {showCreateForm && (
        <Card>
          <h3 className="text-sm font-semibold text-white mb-3">New Topic Group</h3>
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="e.g. Physics 2024–25"
              className={inputCls + ' flex-1'}
              onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
            />
            <button
              onClick={handleCreateGroup}
              disabled={saving || !newGroupName.trim()}
              className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? <Loader size={12} className="animate-spin" /> : <Save size={13} />}
              Create
            </button>
            <button onClick={() => setShowCreateForm(false)} className="px-3 bg-background-700 text-gray-400 rounded-xl text-sm">
              <X size={13} />
            </button>
          </div>
        </Card>
      )}

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Group List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Your Groups ({groups.length})</h2>
          {groups.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500 text-center py-4">No topic groups yet. Create one to get started.</p>
            </Card>
          ) : (
            groups.map(g => (
              <div
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                  selectedGroupId === g.id
                    ? 'bg-primary-600/15 border-primary-500/40'
                    : 'bg-background-800 border-background-700 hover:border-primary-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {g.subjects.length} subject{g.subjects.length !== 1 ? 's' : ''} ·{' '}
                      {g.subjects.reduce((sum, s) => sum + s.chapters.reduce((cs, c) => cs + c.topics.length, 0), 0)} topics
                    </p>
                    {g.assignedCourseIds.length > 0 && (
                      <p className="text-xs text-primary-400 mt-0.5 flex items-center gap-1">
                        <Link size={9} /> {g.assignedCourseIds.length} course{g.assignedCourseIds.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Group Editor */}
        <div className="lg:col-span-2">
          {!selectedGroup ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers size={40} className="text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">Select a group to edit its content</p>
                <p className="text-gray-600 text-xs mt-1">or create a new group from the left panel</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">

              {/* Group Header */}
              <Card>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <BookOpen size={15} className="text-primary-400" />
                    {selectedGroup.name}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => { setAssigningGroupId(p => p === selectedGroup.id ? null : selectedGroup.id); }}
                      className="flex items-center gap-1 text-xs bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      <Link size={11} /> Assign to Course
                    </button>
                    <button
                      onClick={() => handleOpenCSV(selectedGroup.id)}
                      className="flex items-center gap-1 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      <Upload size={11} /> CSV Import
                    </button>
                  </div>
                </div>

                {/* Course assignment panel */}
                {assigningGroupId === selectedGroup.id && (
                  <div className="mb-4 p-3 bg-background-700 rounded-xl border border-background-600 space-y-2">
                    <p className="text-xs font-semibold text-gray-300 mb-2">Assign to courses:</p>
                    {allCourses.length === 0 ? (
                      <p className="text-xs text-gray-500">No courses found.</p>
                    ) : (
                      allCourses.map(c => {
                        const assigned = selectedGroup.assignedCourseIds.includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={() => handleToggleCourseAssignment(selectedGroup.id, c.id, assigned)}
                              className="h-4 w-4 rounded text-primary-600"
                            />
                            <span className="text-sm text-gray-200">{c.title}</span>
                            {assigned && <span className="text-xs text-primary-400">✓ assigned</span>}
                          </label>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Add subject button */}
                {editingSubjectId === selectedGroup.id ? (
                  <div className="flex gap-2 mb-3">
                    <input
                      autoFocus
                      value={newSubjectName}
                      onChange={e => setNewSubjectName(e.target.value)}
                      placeholder="Subject name (e.g. Mathematics)"
                      className={inputCls + ' flex-1'}
                      onKeyDown={e => e.key === 'Enter' && handleAddSubject(selectedGroup.id)}
                    />
                    <button onClick={() => handleAddSubject(selectedGroup.id)} className="px-3 bg-primary-600 text-white rounded-xl text-xs">Add</button>
                    <button onClick={() => setEditingSubjectId(null)} className="px-3 bg-background-700 text-gray-400 rounded-xl text-xs"><X size={12} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingSubjectId(selectedGroup.id)}
                    className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 mb-1"
                  >
                    <Plus size={12} /> Add Subject
                  </button>
                )}
              </Card>

              {/* Subjects */}
              {selectedGroup.subjects.length === 0 ? (
                <Card>
                  <p className="text-sm text-gray-500 text-center py-4">No subjects yet. Add a subject or import from CSV.</p>
                </Card>
              ) : (
                selectedGroup.subjects.map(subject => (
                  <Card key={subject.id}>
                    {/* Subject Header */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => toggleSubject(subject.id)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {expandedSubjects.has(subject.id)
                          ? <ChevronDown size={14} className="text-gray-400" />
                          : <ChevronRight size={14} className="text-gray-400" />}
                        <span className="text-sm font-semibold text-white">{subject.name}</span>
                        <span className="text-xs text-gray-500">({subject.chapters.length} chapters)</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(selectedGroup.id, subject.id)}
                        className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {expandedSubjects.has(subject.id) && (
                      <div className="pl-6 space-y-3">

                        {/* Add chapter */}
                        {editingChapterId === subject.id ? (
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              value={newChapterName}
                              onChange={e => setNewChapterName(e.target.value)}
                              placeholder="Chapter name (e.g. Chapter 1: Algebra)"
                              className={inputCls + ' flex-1'}
                              onKeyDown={e => e.key === 'Enter' && handleAddChapter(selectedGroup.id, subject.id)}
                            />
                            <button onClick={() => handleAddChapter(selectedGroup.id, subject.id)} className="px-3 bg-primary-600 text-white rounded-xl text-xs">Add</button>
                            <button onClick={() => setEditingChapterId(null)} className="px-2 bg-background-700 text-gray-400 rounded-xl"><X size={11} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingChapterId(subject.id)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            <Plus size={11} /> Add Chapter
                          </button>
                        )}

                        {/* Chapters */}
                        {subject.chapters.map(chapter => (
                          <div key={chapter.id} className="bg-background-800 rounded-xl p-3">
                            {/* Chapter Header */}
                            <div className="flex items-center justify-between mb-2">
                              <button
                                onClick={() => toggleChapter(chapter.id)}
                                className="flex items-center gap-2 flex-1 text-left"
                              >
                                {expandedChapters.has(chapter.id)
                                  ? <ChevronDown size={12} className="text-gray-500" />
                                  : <ChevronRight size={12} className="text-gray-500" />}
                                <span className="text-sm font-medium text-gray-200">{chapter.name}</span>
                                <span className="text-xs text-gray-600">({chapter.topics.length} topics)</span>
                              </button>
                              <button
                                onClick={() => handleDeleteChapter(selectedGroup.id, subject.id, chapter.id)}
                                className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {expandedChapters.has(chapter.id) && (
                              <div className="pl-4 space-y-2">

                                {/* Topics list */}
                                {chapter.topics.map(topic => (
                                  <div key={topic.id} className="flex items-center justify-between py-1.5 px-2 bg-background-900 rounded-lg">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-xs text-white">{topic.name}</span>
                                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded border ${DIFF_CLS[topic.difficulty]}`}>{topic.difficulty}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0 ml-2">
                                      <span>{topic.minHours}–{topic.maxHours}h</span>
                                      <button onClick={() => handleDeleteTopic(selectedGroup.id, subject.id, chapter.id, topic.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={10} /></button>
                                    </div>
                                  </div>
                                ))}

                                {/* Add topic form */}
                                {addingTopicToChapter === chapter.id ? (
                                  <div className="space-y-2 pt-1">
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        autoFocus
                                        value={newTopic.name}
                                        onChange={e => setNewTopic(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Topic name"
                                        className={inputCls}
                                      />
                                      <select
                                        value={newTopic.difficulty}
                                        onChange={e => setNewTopic(p => ({ ...p, difficulty: e.target.value as any }))}
                                        className={inputCls}
                                      >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                      </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Min Hours</label>
                                        <input type="number" min={0.25} step={0.25} value={newTopic.minHours}
                                          onChange={e => setNewTopic(p => ({ ...p, minHours: parseFloat(e.target.value) || 0.5 }))}
                                          className={inputCls} />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Max Hours</label>
                                        <input type="number" min={0.25} step={0.25} value={newTopic.maxHours}
                                          onChange={e => setNewTopic(p => ({ ...p, maxHours: parseFloat(e.target.value) || 1 }))}
                                          className={inputCls} />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleAddTopic(selectedGroup.id, subject.id, chapter.id)}
                                        disabled={!newTopic.name.trim()}
                                        className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                      >
                                        Add Topic
                                      </button>
                                      <button onClick={() => setAddingTopicToChapter(null)} className="px-3 bg-background-700 text-gray-400 rounded-lg text-xs"><X size={11} /></button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setAddingTopicToChapter(chapter.id); setNewTopic({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' }); }}
                                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                                  >
                                    <Plus size={10} /> Add Topic
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CSV Import Modal ── */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-background-700">
              <div className="flex items-center gap-2">
                <Upload size={15} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">Bulk Import via CSV</h3>
              </div>
              <button onClick={() => setShowCSVModal(false)} className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Required columns: <code className="text-primary-300">Subject, Chapter, Topic, MinHours, MaxHours, Difficulty</code></p>
                <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                  <Download size={11} /> Template
                </button>
              </div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-background-600 hover:border-primary-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors"
              >
                <FileText size={24} className="mx-auto mb-2 text-gray-500" />
                <p className="text-sm text-gray-400">Click to upload CSV file</p>
                <p className="text-xs text-gray-600 mt-0.5">or paste content below</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={CSV_TEMPLATE}
                rows={8}
                className={inputCls + ' font-mono text-xs resize-none'}
              />
              {csvError && (
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />{csvError}</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowCSVModal(false)} className="px-4 py-2 bg-background-700 text-gray-300 rounded-xl text-sm">Cancel</button>
                <button
                  onClick={handleImportCSV}
                  disabled={!csvText.trim() || csvImporting}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {csvImporting ? <Loader size={13} className="animate-spin" /> : <Upload size={13} />}
                  Import Topics
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTopicGroups;
