// src/pages/CourseAssignment.tsx
// Course Assignment Management - Full Production Grade Admin Page
// Assign teachers to courses with granular per-section permissions

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Check, ChevronDown, ChevronUp,
  Edit3, MessageSquare, ClipboardList, BookCheck, Shield, Loader,
  AlertTriangle, Trash2, ToggleLeft, ToggleRight,
  History, RefreshCw, ArrowLeft, GraduationCap, Zap, BookOpen,
  UserCheck, AlertCircle, CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../contexts/DashboardContext';
import { teacherService, Teacher } from '../services/teacherService';
import { courseService, Course } from '../services/courseService';
import {
  courseAssignmentService,
  CourseAssignment,
  CoursePermission,
  GlobalPermission,
  AssignmentLog,
  AssignmentStats,
  ALL_PERMISSIONS,
  PERMISSION_META,
} from '../services/courseAssignmentService';

// ==================== TYPES ====================
type TeacherWithAssignments = Teacher & { assignments: CourseAssignment[]; isExpanded: boolean; };
interface ToastMsg { id: string; type: 'success' | 'error' | 'info'; message: string; }
interface AssignModalState { open: boolean; teacher: Teacher | null; existingAssignments: CourseAssignment[]; }
interface LogsModalState { open: boolean; teacherUid?: string; teacherName?: string; }
interface ConfirmState { open: boolean; assignmentId: string; label: string; }

// ==================== PERMISSION ICONS ====================
const PermIcon: Record<CoursePermission, React.FC<{size?: number; color?: string}>> = {
  editing: ({size=14,color}) => <Edit3 size={size} color={color}/>,
  qna:     ({size=14,color}) => <MessageSquare size={size} color={color}/>,
  task_creation:   ({size=14,color}) => <ClipboardList size={size} color={color}/>,
  task_editing:    ({size=14,color}) => <Edit3 size={size} color={color}/>,
  task_evaluation: ({size=14,color}) => <BookCheck size={size} color={color}/>,
  exams:   ({size=14,color}) => <BookCheck size={size} color={color}/>,
};

// ==================== MINI COMPONENTS ====================

function ToastStack({ toasts, remove }: { toasts: ToastMsg[]; remove:(id:string)=>void }) {
  return (
    <div style={{position:'fixed',top:20,right:20,zIndex:9999,display:'flex',flexDirection:'column',gap:10}}>
      {toasts.map(t=>(
        <div key={t.id} style={{
          display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderRadius:10,minWidth:300,
          background: t.type==='success'?'#0a1f13': t.type==='error'?'#1f0a0a':'#0a0f1f',
          border:`1px solid ${t.type==='success'?'#10b981':t.type==='error'?'#ef4444':'#3b82f6'}`,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',color:'#fff',animation:'toastIn 0.2s ease',
        }}>
          {t.type==='success' && <CheckCircle size={15} color="#10b981"/>}
          {t.type==='error'   && <AlertCircle size={15} color="#ef4444"/>}
          {t.type==='info'    && <Zap size={15} color="#3b82f6"/>}
          <span style={{fontSize:13,flex:1,lineHeight:1.4}}>{t.message}</span>
          <button onClick={()=>remove(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#666',padding:0}}>
            <X size={13}/>
          </button>
        </div>
      ))}
    </div>
  );
}

function PermBadge({ perm }: { perm: CoursePermission }) {
  const m = PERMISSION_META[perm];
  const Icon = PermIcon[perm];
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:6,
      background:m.bgColor,color:m.color,fontSize:10,fontWeight:700,
      border:`1px solid ${m.color}22`,whiteSpace:'nowrap',letterSpacing:'0.01em',
    }}>
      <Icon size={10} color={m.color}/>{m.label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: {label:string;value:number|string;icon:any;color:string}) {
  return (
    <div style={{
      background:'#111',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,
      padding:'16px 18px',display:'flex',alignItems:'center',gap:14,
    }}>
      <div style={{width:40,height:40,borderRadius:10,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <Icon size={19} color={color}/>
      </div>
      <div>
        <div style={{fontSize:22,fontWeight:800,color:'#fff',lineHeight:1}}>{value}</div>
        <div style={{fontSize:11,color:'#555',marginTop:3}}>{label}</div>
      </div>
    </div>
  );
}

function PermToggle({ perm, checked, onChange }: { perm:CoursePermission; checked:boolean; onChange:(v:boolean)=>void }) {
  const m = PERMISSION_META[perm];
  const Icon = PermIcon[perm];
  return (
    <button onClick={()=>onChange(!checked)} style={{
      display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',
      background: checked?m.bgColor:'rgba(255,255,255,0.03)',
      border:`1.5px solid ${checked?m.color:'rgba(255,255,255,0.09)'}`,
      transition:'all 0.14s',width:'100%',textAlign:'left',
    }}>
      <div style={{
        width:18,height:18,borderRadius:5,flexShrink:0,
        background:checked?m.color:'transparent',
        border:`2px solid ${checked?m.color:'rgba(255,255,255,0.25)'}`,
        display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.14s',
      }}>
        {checked && <Check size={11} color="#fff" strokeWidth={3}/>}
      </div>
      <Icon size={15} color={checked?m.color:'#666'}/>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:checked?'#fff':'#888'}}>{m.label}</div>
        <div style={{fontSize:11,color:'#555',marginTop:1}}>{m.description}</div>
      </div>
    </button>
  );
}

// ── Assign Modal ────────────────────────────────────────────────────────────────
function AssignModal({
  state, courses, onClose, onSave, onSaveGlobal, saving, savingGlobal
}: {
  state: AssignModalState;
  courses: Course[];
  onClose:()=>void;
  onSave:(courseId:string,courseTitle:string,thumbnail:string|undefined,perms:CoursePermission[],allowedSubjects:string[],notes:string,globalPerms:GlobalPermission[])=>Promise<void>;
  onSaveGlobal:(globalPerms:GlobalPermission[])=>Promise<void>;
  saving:boolean;
  savingGlobal:boolean;
}) {
  const [step, setStep] = useState<'course'|'perms'>('course');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<Course|null>(null);
  const [perms, setPerms] = useState<Set<CoursePermission>>(new Set());
  const [globalPerms, setGlobalPerms] = useState<Set<GlobalPermission>>(new Set());
  const [allowedSubjects, setAllowedSubjects] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  useEffect(()=>{
    if(state.open){
      setStep('course'); setSel(null); setPerms(new Set()); setAllowedSubjects(new Set()); setNotes(''); setSearch('');
      // Initialize global perms from any existing assignment (they are stored on every assignment)
      const existingGlobal = state.existingAssignments.find(a=>a.globalPermissions && a.globalPermissions.length>0);
      setGlobalPerms(existingGlobal ? new Set(existingGlobal.globalPermissions!) : new Set());
    }
  },[state.open]);

  const existingIds = new Set(state.existingAssignments.map(a=>a.courseId));

  const filtered = courses.filter(c=>{
    const q=search.toLowerCase();
    return c.title.toLowerCase().includes(q)||c.id.toLowerCase().includes(q)||(c.category||'').toLowerCase().includes(q);
  });

  const pickCourse = (c: Course) => {
    setSel(c);
    const ex = state.existingAssignments.find(a=>a.courseId===c.id);
    setPerms(ex ? new Set(ex.permissions) : new Set());
    setGlobalPerms(ex?.globalPermissions?.length ? new Set(ex.globalPermissions) : new Set());
    setAllowedSubjects(ex?.allowedSubjects?.length ? new Set(ex.allowedSubjects) : new Set());
    setNotes(ex?.notes||'');
    setStep('perms');
  };

  const toggle = (p: CoursePermission) => setPerms(prev=>{
    const n=new Set(prev); n.has(p)?n.delete(p):n.add(p); return n;
  });

  if(!state.open||!state.teacher) return null;

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(6px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:'#0d0d0d',borderRadius:16,border:'1px solid rgba(255,255,255,0.1)',
        width:'100%',maxWidth:540,maxHeight:'88vh',display:'flex',flexDirection:'column',
        boxShadow:'0 24px 80px rgba(0,0,0,0.85)',
      }}>
        {/* Header */}
        <div style={{padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:12}}>
          {step==='perms' && (
            <button onClick={()=>setStep('course')} style={{background:'rgba(255,255,255,0.07)',border:'none',borderRadius:8,
              width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#aaa'}}>
              <ArrowLeft size={14}/>
            </button>
          )}
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>
              {step==='course'?'Assign Course Access':`Set Permissions — ${sel?.title}`}
            </div>
            <div style={{fontSize:11,color:'#555',marginTop:2}}>
              Teacher: <span style={{color:'#888'}}>{state.teacher.surname} ({state.teacher.userId})</span>
            </div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,
            width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#777'}}>
            <X size={14}/>
          </button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflow:'auto',padding:'14px 22px'}}>
          {step==='course' && (
            <>
              {/* Global Permissions — shown at top of course selection */}
              <div style={{marginBottom:14,padding:'12px 14px',borderRadius:10,
                background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.09)'}}>
                <div style={{fontSize:11,color:'#666',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
                  Global Access Options
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {/* Course Creation */}
                  <button onClick={()=>setGlobalPerms(prev=>{const n=new Set(prev);n.has('course_creation')?n.delete('course_creation'):n.add('course_creation');return n;})}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',
                      background:globalPerms.has('course_creation')?'rgba(168,85,247,0.12)':'rgba(255,255,255,0.03)',
                      border:`1.5px solid ${globalPerms.has('course_creation')?'#a855f7':'rgba(255,255,255,0.09)'}`,
                      transition:'all 0.14s',width:'100%',textAlign:'left'}}>
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,
                      background:globalPerms.has('course_creation')?'#a855f7':'transparent',
                      border:`2px solid ${globalPerms.has('course_creation')?'#a855f7':'rgba(255,255,255,0.25)'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.14s'}}>
                      {globalPerms.has('course_creation') && <Check size={11} color="#fff" strokeWidth={3}/>}
                    </div>
                    <Plus size={15} color={globalPerms.has('course_creation')?'#a855f7':'#666'}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:globalPerms.has('course_creation')?'#fff':'#888'}}>Course Creation</div>
                      <div style={{fontSize:11,color:'#555',marginTop:1}}>Allow teacher to create new courses on the platform</div>
                    </div>
                  </button>
                  {/* Task Creation (global) */}
                  <button onClick={()=>setGlobalPerms(prev=>{const n=new Set(prev);n.has('task_creation_global')?n.delete('task_creation_global'):n.add('task_creation_global');return n;})}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,cursor:'pointer',
                      background:globalPerms.has('task_creation_global')?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.03)',
                      border:`1.5px solid ${globalPerms.has('task_creation_global')?'#f59e0b':'rgba(255,255,255,0.09)'}`,
                      transition:'all 0.14s',width:'100%',textAlign:'left'}}>
                    <div style={{width:18,height:18,borderRadius:5,flexShrink:0,
                      background:globalPerms.has('task_creation_global')?'#f59e0b':'transparent',
                      border:`2px solid ${globalPerms.has('task_creation_global')?'#f59e0b':'rgba(255,255,255,0.25)'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.14s'}}>
                      {globalPerms.has('task_creation_global') && <Check size={11} color="#fff" strokeWidth={3}/>}
                    </div>
                    <ClipboardList size={15} color={globalPerms.has('task_creation_global')?'#f59e0b':'#666'}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:globalPerms.has('task_creation_global')?'#fff':'#888'}}>Task Creation</div>
                      <div style={{fontSize:11,color:'#555',marginTop:1}}>Allow teacher to create tasks (class, all-student types) in Task Management</div>
                    </div>
                  </button>
                </div>
              </div>
              <div style={{fontSize:11,color:'#555',marginBottom:8,fontWeight:600}}>Course List — select a course to set permissions</div>
              <div style={{position:'relative',marginBottom:12}}>
                <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#555'}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search courses..." autoFocus
                  style={{width:'100%',padding:'9px 11px 9px 33px',background:'#1a1a1a',
                  border:'1px solid rgba(255,255,255,0.09)',borderRadius:8,color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {filtered.length===0 && <div style={{textAlign:'center',padding:'28px 0',color:'#444',fontSize:13}}>No courses found</div>}
                {filtered.map(c=>(
                  <button key={c.id} onClick={()=>pickCourse(c)} style={{
                    display:'flex',alignItems:'center',gap:11,padding:'11px 13px',borderRadius:9,cursor:'pointer',
                    background: existingIds.has(c.id)?'rgba(99,102,241,0.07)':'rgba(255,255,255,0.03)',
                    border:`1px solid ${existingIds.has(c.id)?'rgba(99,102,241,0.25)':'rgba(255,255,255,0.07)'}`,
                    textAlign:'left',transition:'all 0.1s',
                  }}>
                    <div style={{width:38,height:38,borderRadius:8,background:'#1e1e1e',flexShrink:0,
                      display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                      {(c.thumbnail||c.thumbnailUrl)
                        ? <img src={c.thumbnail||c.thumbnailUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : <BookOpen size={16} color="#444"/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.title}</div>
                      <div style={{fontSize:11,color:'#555',marginTop:2}}>{c.category} · {c.id}</div>
                    </div>
                    {existingIds.has(c.id) && (
                      <span style={{fontSize:9,color:'#6366f1',background:'rgba(99,102,241,0.15)',padding:'2px 7px',borderRadius:20,fontWeight:700,flexShrink:0}}>EDIT</span>
                    )}
                    <ChevronDown size={13} color="#444" style={{transform:'rotate(-90deg)',flexShrink:0}}/>
                  </button>
                ))}
              </div>
            </>
          )}

          {step==='perms' && sel && (
            <>
              <div style={{fontSize:11,color:'#555',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:700}}>
                Access Permissions
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:14}}>
                {ALL_PERMISSIONS.map(p=><PermToggle key={p} perm={p} checked={perms.has(p)} onChange={v=>toggle(p)}/>)}
              </div>
              <div style={{display:'flex',gap:7,marginBottom:14}}>
                <button onClick={()=>setPerms(new Set(ALL_PERMISSIONS))} style={{
                  flex:1,padding:'7px',borderRadius:8,fontSize:12,
                  background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',cursor:'pointer'}}>
                  Select All
                </button>
                <button onClick={()=>setPerms(new Set())} style={{
                  flex:1,padding:'7px',borderRadius:8,fontSize:12,
                  background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',cursor:'pointer'}}>
                  Clear All
                </button>
              </div>

              {/* Subject Access — only shown when qna or exams is selected */}
              {(perms.has('qna') || perms.has('exams')) && sel?.subjects && sel.subjects.length > 0 && (
                <div style={{marginBottom:14,padding:'12px 14px',borderRadius:10,
                  background:'rgba(14,165,233,0.06)',border:'1px solid rgba(14,165,233,0.18)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div>
                      <div style={{fontSize:11,color:'#0ea5e9',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                        Subject Access
                      </div>
                      <div style={{fontSize:11,color:'#555',marginTop:2}}>
                        Check subjects to grant access. Unchecked subjects are blocked.
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>setAllowedSubjects(new Set(sel.subjects))}
                        style={{fontSize:10,padding:'3px 8px',borderRadius:6,background:'rgba(14,165,233,0.12)',
                        border:'1px solid rgba(14,165,233,0.25)',color:'#0ea5e9',cursor:'pointer',fontWeight:600}}>
                        All
                      </button>
                      <button onClick={()=>setAllowedSubjects(new Set())}
                        style={{fontSize:10,padding:'3px 8px',borderRadius:6,background:'rgba(255,255,255,0.05)',
                        border:'1px solid rgba(255,255,255,0.09)',color:'#666',cursor:'pointer',fontWeight:600}}>
                        None
                      </button>
                    </div>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {sel.subjects.map(subject=>{
                      const checked = allowedSubjects.has(subject);
                      return (
                        <button key={subject} onClick={()=>{
                          setAllowedSubjects(prev=>{
                            const n=new Set(prev); n.has(subject)?n.delete(subject):n.add(subject); return n;
                          });
                        }} style={{
                          display:'inline-flex',alignItems:'center',gap:5,
                          padding:'5px 10px',borderRadius:8,cursor:'pointer',
                          background: checked?'rgba(14,165,233,0.15)':'rgba(255,255,255,0.04)',
                          border:`1.5px solid ${checked?'#0ea5e9':'rgba(255,255,255,0.1)'}`,
                          color: checked?'#38bdf8':'#666',
                          fontSize:12,fontWeight:checked?600:400,transition:'all 0.12s',
                        }}>
                          <div style={{width:13,height:13,borderRadius:3,flexShrink:0,
                            background:checked?'#0ea5e9':'transparent',
                            border:`1.5px solid ${checked?'#0ea5e9':'rgba(255,255,255,0.2)'}`,
                            display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {checked && <Check size={9} color="#fff" strokeWidth={3}/>}
                          </div>
                          {subject}
                        </button>
                      );
                    })}
                  </div>
                  {allowedSubjects.size===0 && (
                    <div style={{fontSize:10,color:'#e05252',marginTop:8,fontStyle:'italic'}}>
                      ⚠ No subjects selected — teacher will have no subject access for Q&amp;A / Exams
                    </div>
                  )}
                </div>
              )}
              <div>
                <div style={{fontSize:11,color:'#555',marginBottom:5,fontWeight:600}}>Notes (optional)</div>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add context..." rows={2}
                  style={{width:'100%',padding:'9px 11px',background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.09)',
                  borderRadius:8,color:'#fff',fontSize:13,resize:'none',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            </>
          )}
        </div>

        {/* Footer — Course step: save global perms */}
        {step==='course' && (
          <div style={{padding:'14px 22px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:9}}>
            <button onClick={onClose} style={{
              flex:1,padding:'10px',borderRadius:9,fontSize:13,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={()=>onSaveGlobal(Array.from(globalPerms))}
              disabled={savingGlobal} style={{
              flex:2,padding:'10px',borderRadius:9,fontSize:13,fontWeight:700,
              background:'linear-gradient(135deg,#7c3aed,#a855f7)',
              border:'none',color:'#fff',
              cursor:savingGlobal?'not-allowed':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:7,
            }}>
              {savingGlobal?<Loader size={14} style={{animation:'spin 0.8s linear infinite'}}/>:<Check size={14}/>}
              {savingGlobal?'Saving...':'Save Global Options'}
            </button>
          </div>
        )}

        {/* Footer — Perms step: save course-specific permissions */}
        {step==='perms' && (
          <div style={{padding:'14px 22px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:9}}>
            <button onClick={onClose} style={{
              flex:1,padding:'10px',borderRadius:9,fontSize:13,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',cursor:'pointer'}}>
              Cancel
            </button>
            <button onClick={()=>{ if(sel) onSave(sel.id,sel.title,sel.thumbnail||sel.thumbnailUrl,Array.from(perms),Array.from(allowedSubjects),notes,Array.from(globalPerms)); }}
              disabled={saving||perms.size===0} style={{
              flex:2,padding:'10px',borderRadius:9,fontSize:13,fontWeight:700,
              background: perms.size===0?'#222':'linear-gradient(135deg,#4f46e5,#7c3aed)',
              border:'none',color: perms.size===0?'#555':'#fff',
              cursor: perms.size===0||saving?'not-allowed':'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',gap:7,
            }}>
              {saving?<Loader size={14} style={{animation:'spin 0.8s linear infinite'}}/>:<Check size={14}/>}
              {saving?'Saving...':'Save Access'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Logs Modal ──────────────────────────────────────────────────────────────────
function LogsModal({ state, onClose }: { state:LogsModalState; onClose:()=>void }) {
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if(!state.open) return;
    setLoading(true);
    courseAssignmentService.getLogs(state.teacherUid?{teacherUid:state.teacherUid}:undefined)
      .then(setLogs).catch(console.error).finally(()=>setLoading(false));
  },[state.open,state.teacherUid]);

  const col: Record<string,string> = {
    assigned:'#10b981',unassigned:'#ef4444',permissions_updated:'#f59e0b',deactivated:'#6b7280',reactivated:'#3b82f6'
  };

  if(!state.open) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(6px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:'#0d0d0d',borderRadius:16,border:'1px solid rgba(255,255,255,0.1)',
        width:'100%',maxWidth:600,maxHeight:'84vh',display:'flex',flexDirection:'column',
        boxShadow:'0 24px 80px rgba(0,0,0,0.85)'}}>
        <div style={{padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,0.07)',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:'#fff'}}>Assignment Audit Log</div>
            <div style={{fontSize:11,color:'#555',marginTop:2}}>{state.teacherName?`For: ${state.teacherName}`:'All changes'}</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.06)',border:'none',borderRadius:8,
            width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#777'}}>
            <X size={14}/>
          </button>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'14px 22px'}}>
          {loading && <div style={{textAlign:'center',padding:'40px 0',color:'#555'}}><Loader size={22} style={{animation:'spin 0.8s linear infinite'}}/></div>}
          {!loading && logs.length===0 && <div style={{textAlign:'center',padding:'40px 0',color:'#444',fontSize:13}}>No logs found</div>}
          {!loading && logs.map((log,i)=>(
            <div key={log.id||i} style={{display:'flex',gap:12,marginBottom:14,paddingBottom:14,
              borderBottom: i<logs.length-1?'1px solid rgba(255,255,255,0.05)':'none'}}>
              <div style={{width:32,height:32,borderRadius:8,flexShrink:0,
                background:`${col[log.action]||'#888'}18`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <History size={14} color={col[log.action]||'#888'}/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',
                    color:col[log.action]||'#888',background:`${col[log.action]||'#888'}15`,padding:'2px 6px',borderRadius:4}}>
                    {log.action.replace(/_/g,' ')}
                  </span>
                  <span style={{fontSize:11,color:'#444'}}>
                    {log.timestamp instanceof Date?log.timestamp.toLocaleString():''}
                  </span>
                </div>
                <div style={{fontSize:12,color:'#bbb',lineHeight:1.5}}>{log.details}</div>
                <div style={{fontSize:11,color:'#444',marginTop:3}}>by {log.performedBySurname} ({log.performedByUserId})</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Confirm Modal ───────────────────────────────────────────────────────────────
function ConfirmModal({ open,title,message,confirmLabel,danger,onConfirm,onCancel,loading }: {
  open:boolean;title:string;message:string;confirmLabel:string;danger?:boolean;
  onConfirm:()=>void;onCancel:()=>void;loading?:boolean;
}) {
  if(!open) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#111',borderRadius:14,border:'1px solid rgba(255,255,255,0.09)',
        padding:26,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.85)'}}>
        <div style={{display:'flex',gap:12,marginBottom:18}}>
          <div style={{width:40,height:40,borderRadius:9,flexShrink:0,
            background: danger?'rgba(239,68,68,0.14)':'rgba(245,158,11,0.14)',
            display:'flex',alignItems:'center',justifyContent:'center'}}>
            <AlertTriangle size={19} color={danger?'#ef4444':'#f59e0b'}/>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff'}}>{title}</div>
            <div style={{fontSize:13,color:'#777',marginTop:4,lineHeight:1.5}}>{message}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:9}}>
          <button onClick={onCancel} style={{
            flex:1,padding:'10px',borderRadius:8,fontSize:13,
            background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',cursor:'pointer'}}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex:1,padding:'10px',borderRadius:8,fontSize:13,fontWeight:700,
            background:danger?'#dc2626':'#d97706',border:'none',color:'#fff',
            cursor:loading?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {loading&&<Loader size={13} style={{animation:'spin 0.8s linear infinite'}}/>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assignment Card ─────────────────────────────────────────────────────────────
function AssignmentCard({ assignment,onEdit,onRevoke,onToggleActive,isToggling }: {
  assignment:CourseAssignment;onEdit:()=>void;onRevoke:()=>void;onToggleActive:()=>void;isToggling:boolean;
}) {
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:11,padding:'11px 13px',borderRadius:10,
      background: assignment.isActive?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.2)',
      border:`1px solid ${assignment.isActive?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)'}`,
      opacity: assignment.isActive?1:0.6,transition:'all 0.15s',
    }}>
      {/* Thumbnail */}
      <div style={{width:34,height:34,borderRadius:7,background:'#1a1a1a',flexShrink:0,
        display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
        {assignment.courseThumbnail
          ? <img src={assignment.courseThumbnail} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          : <BookOpen size={14} color="#444"/>}
      </div>
      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:600,color: assignment.isActive?'#e2e8f0':'#666',
          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{assignment.courseTitle}</div>
        <div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap'}}>
          {assignment.permissions.map(p=><PermBadge key={p} perm={p}/>)}
        </div>
        {/* Subject scope — only shown when subjects are restricted */}
        {assignment.allowedSubjects?.length > 0 && (
          <div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:9,color:'#0ea5e9',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',flexShrink:0}}>subjects:</span>
            {assignment.allowedSubjects.map(s=>(
              <span key={s} style={{fontSize:10,color:'#38bdf8',background:'rgba(14,165,233,0.1)',
                padding:'1px 6px',borderRadius:4,border:'1px solid rgba(14,165,233,0.2)',whiteSpace:'nowrap'}}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Date + Status */}
      <div style={{fontSize:10,color:'#444',flexShrink:0,textAlign:'right'}}>
        <div>{assignment.assignedAt.toLocaleDateString()}</div>
        <div style={{marginTop:2,fontWeight:700,color: assignment.isActive?'#10b981':'#6b7280'}}>
          {assignment.isActive?'● ACTIVE':'● PAUSED'}
        </div>
      </div>
      {/* Actions */}
      <div style={{display:'flex',gap:5,flexShrink:0}}>
        <button onClick={onToggleActive} disabled={isToggling} title={assignment.isActive?'Pause':'Restore'}
          style={{padding:'5px 7px',borderRadius:7,background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(255,255,255,0.08)',color:assignment.isActive?'#f59e0b':'#10b981',
          cursor:isToggling?'not-allowed':'pointer',display:'flex',alignItems:'center'}}>
          {isToggling?<Loader size={13} style={{animation:'spin 0.8s linear infinite'}}/>
            : assignment.isActive?<ToggleRight size={14}/>:<ToggleLeft size={14}/>}
        </button>
        <button onClick={onEdit} title="Edit permissions"
          style={{padding:'5px 7px',borderRadius:7,background:'rgba(99,102,241,0.09)',
          border:'1px solid rgba(99,102,241,0.2)',color:'#818cf8',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <Edit3 size={13}/>
        </button>
        <button onClick={onRevoke} title="Revoke access"
          style={{padding:'5px 7px',borderRadius:7,background:'rgba(239,68,68,0.07)',
          border:'1px solid rgba(239,68,68,0.14)',color:'#f87171',cursor:'pointer',display:'flex',alignItems:'center'}}>
          <Trash2 size={13}/>
        </button>
      </div>
    </div>
  );
}

// ── Teacher Row ─────────────────────────────────────────────────────────────────
function TeacherRow({ teacher,onToggleExpand,onAssign,onEditAssignment,
  onRevokeAssignment,onToggleActive,onViewLogs,togglingId }: {
  teacher:TeacherWithAssignments;onToggleExpand:()=>void;onAssign:()=>void;
  onEditAssignment:(a:CourseAssignment)=>void;onRevokeAssignment:(a:CourseAssignment)=>void;
  onToggleActive:(a:CourseAssignment)=>void;onViewLogs:()=>void;togglingId:string|null;
}) {
  const active = teacher.assignments.filter(a=>a.isActive && a.courseId!=='__global__').length;
  const total = teacher.assignments.filter(a=>a.courseId!=='__global__').length;
  const initial = (teacher.surname||'T').charAt(0).toUpperCase();

  return (
    <div style={{background:'#0e0e0e',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,overflow:'hidden'}}>
      {/* Header Row */}
      <div style={{display:'flex',alignItems:'center',gap:13,padding:'13px 17px',cursor:'pointer'}} onClick={onToggleExpand}>
        {/* Avatar */}
        <div style={{width:42,height:42,borderRadius:10,flexShrink:0,overflow:'hidden',
          background:'linear-gradient(135deg,#1e1b4b,#312e81)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'#818cf8'}}>
          {teacher.profilePictureUrl
            ? <img src={teacher.profilePictureUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            : initial}
        </div>
        {/* Info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:14,fontWeight:700,color:'#fff'}}>{teacher.surname}</span>
            {teacher.fullName && teacher.fullName!==teacher.surname &&
              <span style={{fontSize:12,color:'#444'}}>{teacher.fullName}</span>}
          </div>
          <div style={{fontSize:11,color:'#444',marginTop:2}}>ID: {teacher.userId} · {teacher.phoneNumber}</div>
        </div>
        {/* Badge */}
        <div>
          {total>0 ? (
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,
              background: active>0?'rgba(16,185,129,0.1)':'rgba(107,114,128,0.1)',
              border:`1px solid ${active>0?'rgba(16,185,129,0.28)':'rgba(107,114,128,0.2)'}`}}>
              <BookOpen size={11} color={active>0?'#10b981':'#6b7280'}/>
              <span style={{fontSize:12,fontWeight:700,color: active>0?'#10b981':'#6b7280'}}>
                {active}/{total} courses
              </span>
            </div>
          ) : (
            <span style={{fontSize:11,color:'#333',background:'#181818',padding:'4px 10px',borderRadius:20}}>No access</span>
          )}
        </div>
        {/* Action Buttons */}
        <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
          <button onClick={onViewLogs} title="Audit log"
            style={{padding:'6px 9px',borderRadius:8,fontSize:12,background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.08)',color:'#666',cursor:'pointer',display:'flex',alignItems:'center'}}>
            <History size={13}/>
          </button>
          <button onClick={onAssign}
            style={{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:700,
            background:'linear-gradient(135deg,#4f46e5,#7c3aed)',border:'none',color:'#fff',
            cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
            <Plus size={13}/>Assign Course
          </button>
        </div>
        {/* Chevron */}
        <div style={{color:'#333',flexShrink:0}}>
          {teacher.isExpanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
        </div>
      </div>

      {/* Expanded Assignments */}
      {teacher.isExpanded && (
        <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'10px 17px 14px'}}>
          {teacher.assignments.filter(a=>a.courseId!=='__global__').length===0 ? (
            <div style={{textAlign:'center',padding:'18px',background:'#111',borderRadius:9,color:'#333',fontSize:12}}>
              No courses assigned. Click "Assign Course" to get started.
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {teacher.assignments.filter(a=>a.courseId!=='__global__').map(a=>(
                <AssignmentCard key={a.id} assignment={a}
                  onEdit={()=>onEditAssignment(a)}
                  onRevoke={()=>onRevokeAssignment(a)}
                  onToggleActive={()=>onToggleActive(a)}
                  isToggling={togglingId===a.id}/>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function CourseAssignmentPage() {
  const { user: currentUser } = useDashboard();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<TeacherWithAssignments[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<AssignmentStats|null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccess, setFilterAccess] = useState<'all'|'with'|'without'>('all');
  const [sortBy, setSortBy] = useState<'name'|'courses'|'recent'>('name');

  const [assignModal, setAssignModal] = useState<AssignModalState>({ open:false, teacher:null, existingAssignments:[] });
  const [logsModal, setLogsModal] = useState<LogsModalState>({ open:false });
  const [confirmRevoke, setConfirmRevoke] = useState<ConfirmState>({ open:false, assignmentId:'', label:'' });
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [revokingId, setRevokingId] = useState<string|null>(null);
  const [togglingId, setTogglingId] = useState<string|null>(null);

  const hasAccess = currentUser?.role==='admin'||currentUser?.role==='manager';

  useEffect(()=>{ if(currentUser&&!hasAccess) navigate('/manage/users',{replace:true}); },[currentUser,hasAccess,navigate]);

  const load = useCallback(async(silent=false)=>{
    if(!hasAccess) return;
    if(!silent) setLoading(true); else setRefreshing(true);
    try {
      const [rawTeachers, rawCourses, allAssignments, rawStats] = await Promise.all([
        teacherService.getAllTeachers(),
        courseService.getAllCourses(),
        courseAssignmentService.getAllAssignments(),
        courseAssignmentService.getStats(),
      ]);
      const byTeacher = new Map<string,CourseAssignment[]>();
      allAssignments.forEach(a=>{ const l=byTeacher.get(a.teacherUid)||[]; l.push(a); byTeacher.set(a.teacherUid,l); });
      setTeachers(rawTeachers.map(t=>({...t, assignments:byTeacher.get(t.uid)||[], isExpanded:false})));
      setCourses(rawCourses);
      setStats(rawStats);
    } catch(e:any) { toast('error', e.message||'Failed to load'); }
    finally { setLoading(false); setRefreshing(false); }
  },[hasAccess]);

  useEffect(()=>{ load(); },[load]);

  const toast = (type: ToastMsg['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p=>[...p,{id,type,message}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4500);
  };

  const toggleExpand = (uid:string) => setTeachers(p=>p.map(t=>t.uid===uid?{...t,isExpanded:!t.isExpanded}:t));

  const handleSaveAssignment = async(courseId:string,courseTitle:string,thumbnail:string|undefined,perms:CoursePermission[],allowedSubjects:string[],notes:string,globalPerms:GlobalPermission[]) => {
    if(!assignModal.teacher||!currentUser) return;
    setSavingAssignment(true);
    try {
      const course = courses.find(c=>c.id===courseId);
      const assignmentId = await courseAssignmentService.assignTeacherToCourse(
        { uid:assignModal.teacher.uid, userId:assignModal.teacher.userId,
          surname:assignModal.teacher.surname, fullName:assignModal.teacher.fullName,
          phoneNumber:assignModal.teacher.phoneNumber },
        { id:courseId, title:courseTitle, category:course?.category, thumbnail },
        perms,
        allowedSubjects,
        { uid:currentUser.uid, userId:currentUser.userId||'', surname:currentUser.surname||'' },
        notes,
        globalPerms
      );
      toast('success', `Access saved for ${assignModal.teacher.surname}`);

      // Optimistically update local teacher state — no need to wait for Firestore read propagation
      const teacherUid = assignModal.teacher.uid;
      setTeachers(prev => prev.map(t => {
        if (t.uid !== teacherUid) return t;
        const updatedAssignment: CourseAssignment = {
          id: assignmentId,
          teacherUid,
          teacherUserId: assignModal.teacher!.userId,
          teacherSurname: assignModal.teacher!.surname,
          courseId,
          courseTitle,
          courseThumbnail: thumbnail,
          permissions: perms,
          globalPermissions: globalPerms,
          allowedSubjects,
          notes,
          isActive: true,
          assignedAt: new Date(),
          assignedByUid: currentUser.uid,
          assignedByUserId: currentUser.userId||'',
          assignedBySurname: currentUser.surname||'',
          updatedAt: new Date(),
        };
        const existingIdx = t.assignments.findIndex(a => a.courseId === courseId);
        const newAssignments = existingIdx >= 0
          ? t.assignments.map((a,i) => i === existingIdx ? updatedAssignment : a)
          : [...t.assignments, updatedAssignment];
        return { ...t, assignments: newAssignments };
      }));

      setAssignModal({open:false,teacher:null,existingAssignments:[]});
      // Background refresh to sync any other changes (stats, etc.) — non-blocking
      load(true);
    } catch(e:any) { toast('error', e.message||'Failed to save'); }
    finally { setSavingAssignment(false); }
  };

  const handleSaveGlobal = async(globalPerms: GlobalPermission[]) => {
    if(!assignModal.teacher||!currentUser) return;
    setSavingGlobal(true);
    try {
      await courseAssignmentService.saveGlobalPermissions(
        { uid:assignModal.teacher.uid, userId:assignModal.teacher.userId,
          surname:assignModal.teacher.surname, fullName:assignModal.teacher.fullName,
          phoneNumber:assignModal.teacher.phoneNumber },
        globalPerms,
        { uid:currentUser.uid, userId:currentUser.userId||'', surname:currentUser.surname||'' }
      );
      toast('success', `Global options saved for ${assignModal.teacher.surname}`);

      // Optimistically patch globalPermissions on all local assignments for this teacher
      const teacherUid = assignModal.teacher.uid;
      setTeachers(prev => prev.map(t => {
        if (t.uid !== teacherUid) return t;
        return {
          ...t,
          assignments: t.assignments.map(a => ({ ...a, globalPermissions: globalPerms })),
        };
      }));

      // Background refresh — non-blocking
      load(true);
    } catch(e:any) { toast('error', e.message||'Failed to save global options'); }
    finally { setSavingGlobal(false); }
  };

  const handleRevoke = async() => {
    if(!currentUser) return;
    const aid = confirmRevoke.assignmentId;
    setRevokingId(aid);
    try {
      await courseAssignmentService.revokeAccess(aid,
        {uid:currentUser.uid,userId:currentUser.userId||'',surname:currentUser.surname||''});
      toast('success','Access revoked');
      setConfirmRevoke({open:false,assignmentId:'',label:''});
      // Optimistically remove the assignment from local state
      setTeachers(prev => prev.map(t => ({
        ...t,
        assignments: t.assignments.filter(a => a.id !== aid),
      })));
      load(true);
    } catch(e:any) { toast('error',e.message||'Failed'); }
    finally { setRevokingId(null); }
  };

  const handleToggleActive = async(a:CourseAssignment) => {
    if(!currentUser||!a.id) return;
    const newActive = !a.isActive;
    setTogglingId(a.id);
    try {
      await courseAssignmentService.toggleActive(a.id, newActive,
        {uid:currentUser.uid,userId:currentUser.userId||'',surname:currentUser.surname||''});
      toast('success',`Access ${newActive?'enabled':'paused'}`);
      // Optimistically update isActive in local state
      setTeachers(prev => prev.map(t => ({
        ...t,
        assignments: t.assignments.map(x => x.id===a.id ? {...x, isActive: newActive} : x),
      })));
      load(true);
    } catch(e:any) { toast('error',e.message); }
    finally { setTogglingId(null); }
  };

  const filtered = useMemo(()=>{
    let list = [...teachers];
    if(searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(t=>
        t.surname.toLowerCase().includes(q)||
        t.userId.toLowerCase().includes(q)||
        (t.fullName||'').toLowerCase().includes(q)||
        t.assignments.some(a=>a.courseTitle.toLowerCase().includes(q))
      );
    }
    if(filterAccess==='with') list=list.filter(t=>t.assignments.length>0);
    if(filterAccess==='without') list=list.filter(t=>t.assignments.length===0);
    list.sort((a,b)=>{
      if(sortBy==='name') return a.surname.localeCompare(b.surname);
      if(sortBy==='courses') return b.assignments.length-a.assignments.length;
      const aD=Math.max(...a.assignments.map(x=>x.assignedAt?.getTime()||0),0);
      const bD=Math.max(...b.assignments.map(x=>x.assignedAt?.getTime()||0),0);
      return bD-aD;
    });
    return list;
  },[teachers,searchTerm,filterAccess,sortBy]);

  if(!hasAccess) return null;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes toastIn { from { transform:translateX(20px);opacity:0; } to { transform:translateX(0);opacity:1; } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.09);border-radius:3px; }
        input::placeholder,textarea::placeholder { color:#444; }
        select option { background:#1a1a1a; }
      `}</style>

      <ToastStack toasts={toasts} remove={id=>setToasts(p=>p.filter(t=>t.id!==id))}/>

      <AssignModal state={assignModal} courses={courses}
        onClose={()=>setAssignModal({open:false,teacher:null,existingAssignments:[]})}
        onSave={handleSaveAssignment} saving={savingAssignment}
        onSaveGlobal={handleSaveGlobal} savingGlobal={savingGlobal}/>

      <LogsModal state={logsModal} onClose={()=>setLogsModal({open:false})}/>

      <ConfirmModal open={confirmRevoke.open} title="Revoke Access"
        message={`Remove all access for "${confirmRevoke.label}"? This action cannot be undone.`}
        confirmLabel="Revoke" danger loading={!!revokingId}
        onConfirm={handleRevoke}
        onCancel={()=>setConfirmRevoke({open:false,assignmentId:'',label:''})}/>

      <div style={{minHeight:'100vh',background:'#080808',color:'#fff',
        fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",padding:'22px 26px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,gap:14,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <button onClick={()=>navigate(-1)} style={{
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',
              borderRadius:9,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',
              cursor:'pointer',color:'#888'}}>
              <ArrowLeft size={15}/>
            </button>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:34,height:34,borderRadius:9,
                  background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Shield size={17} color="#fff"/>
                </div>
                <h1 style={{fontSize:20,fontWeight:800,margin:0,letterSpacing:'-0.02em',color:'#fff'}}>
                  Course Assignment
                </h1>
              </div>
              <p style={{fontSize:12,color:'#444',margin:'4px 0 0 0'}}>
                Manage teacher access and permissions across all courses
              </p>
            </div>
          </div>
          <div style={{display:'flex',gap:9}}>
            <button onClick={()=>setLogsModal({open:true})}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:9,fontSize:12,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',cursor:'pointer'}}>
              <History size={13}/>Full Audit Log
            </button>
            <button onClick={()=>load(true)} disabled={refreshing}
              style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:9,fontSize:12,
              background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#888',
              cursor:refreshing?'not-allowed':'pointer'}}>
              <RefreshCw size={13} style={refreshing?{animation:'spin 0.8s linear infinite'}:{}}/>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:20}}>
            <StatCard label="Total Teachers" value={teachers.length} icon={GraduationCap} color="#6366f1"/>
            <StatCard label="Teachers with Access" value={stats.teachersWithAccess} icon={UserCheck} color="#10b981"/>
            <StatCard label="Courses Assigned" value={stats.coursesAssigned} icon={BookOpen} color="#0ea5e9"/>
            <StatCard label="Active Assignments" value={stats.activeAssignments} icon={Zap} color="#f59e0b"/>
          </div>
        )}

        {/* Toolbar */}
        <div style={{display:'flex',gap:9,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{position:'relative',flex:'1 1 220px',minWidth:180}}>
            <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#444'}}/>
            <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
              placeholder="Search teachers or courses..."
              style={{width:'100%',padding:'9px 11px 9px 32px',background:'#111',
              border:'1px solid rgba(255,255,255,0.09)',borderRadius:9,color:'#fff',fontSize:13,outline:'none'}}/>
          </div>
          <select value={filterAccess} onChange={e=>setFilterAccess(e.target.value as any)}
            style={{padding:'9px 12px',background:'#111',border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:9,color:'#ccc',fontSize:13,cursor:'pointer',outline:'none'}}>
            <option value="all">All Teachers</option>
            <option value="with">Has Access</option>
            <option value="without">No Access</option>
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)}
            style={{padding:'9px 12px',background:'#111',border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:9,color:'#ccc',fontSize:13,cursor:'pointer',outline:'none'}}>
            <option value="name">Sort: Name</option>
            <option value="courses">Sort: Courses</option>
            <option value="recent">Sort: Recent</option>
          </select>
          <span style={{fontSize:12,color:'#444',whiteSpace:'nowrap'}}>
            {filtered.length} teacher{filtered.length!==1?'s':''}
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div style={{textAlign:'center',padding:'80px 0'}}>
            <Loader size={30} color="#6366f1" style={{animation:'spin 0.8s linear infinite'}}/>
            <div style={{fontSize:13,color:'#444',marginTop:12}}>Loading teachers and assignments...</div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{textAlign:'center',padding:'80px 0',background:'#0e0e0e',borderRadius:14,
            border:'1px solid rgba(255,255,255,0.06)'}}>
            <GraduationCap size={38} color="#222"/>
            <div style={{fontSize:14,color:'#444',marginTop:12}}>No teachers found</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {filtered.map(teacher=>(
              <TeacherRow key={teacher.uid} teacher={teacher}
                onToggleExpand={()=>toggleExpand(teacher.uid)}
                onAssign={()=>setAssignModal({open:true,teacher,existingAssignments:teacher.assignments})}
                onEditAssignment={a=>setAssignModal({open:true,teacher,existingAssignments:teacher.assignments})}
                onRevokeAssignment={a=>setConfirmRevoke({
                  open:true, assignmentId:a.id!,
                  label:`${teacher.surname} → ${a.courseTitle}`,
                })}
                onToggleActive={handleToggleActive}
                onViewLogs={()=>setLogsModal({open:true,teacherUid:teacher.uid,teacherName:teacher.surname})}
                togglingId={togglingId}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
