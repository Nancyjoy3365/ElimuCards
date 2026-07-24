// ============================================================
// ELIMUCARDS — Complete Production Application
// Dual-Curriculum (CBC + Cambridge) School Report Card System
// ============================================================
import { useState, useEffect, useRef } from "react";
import { supabase } from './supabase'
import { KICD_DATA } from './kicd_data'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const COLORS = {
  teal:   "#0d9488",
  teal2:  "#0f766e",
  teal3:  "#134e4a",
  tealL:  "#ccfbf1",
  tealL2: "#99f6e4",
  amber:  "#d97706",
  amber2: "#b45309",
  amberL: "#fef3c7",
  coral:  "#e05a4e",
  coral2: "#c0392b",
  blue:   "#3b82f6",
  blueL:  "#dbeafe",
  emerald:"#10b981",
  emeraldL:"#d1fae5",
  coralL: "#fde8e8",
  bg:     "#f8fafc",
  card:   "#ffffff",
  border: "#e2e8f0",
  text:   "#0f172a",
  text2:  "#475569",
  text3:  "#94a3b8",
};

// CBC Grades
const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9"];
// Cambridge Grades
const CAM_GRADES = ["Early Years 1","Early Years 2","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6","Year 7","Year 8","Year 9"];

// CBC Subjects by level
const CBC_SUBJECTS = {
  "PP1": ["Literacy Activities","Mathematical Activities","Environmental Activities","Creative Activities","Movement and Physical Education","Religious Education"],
  "PP2": ["Literacy Activities","Mathematical Activities","Environmental Activities","Creative Activities","Movement and Physical Education","Religious Education"],
  "Grade 1": ["Literacy","English Language Activities","Kiswahili Language Activities","Mathematical Activities","Environmental Activities","Religious Education","Creative Activities","Movement and Physical Education"],
  "Grade 2": ["Literacy","English Language Activities","Kiswahili Language Activities","Mathematical Activities","Environmental Activities","Religious Education","Creative Activities","Movement and Physical Education"],
  "Grade 3": ["Literacy","English Language Activities","Kiswahili Language Activities","Mathematical Activities","Environmental Activities","Religious Education","Creative Activities","Movement and Physical Education"],
  "Grade 4": ["English","Kiswahili","Mathematics","Science and Technology","Agriculture and Nutrition","Social Studies","Creative Arts","Physical and Health Education","Religious Education","Computer"],
  "Grade 5": ["English","Kiswahili","Mathematics","Science and Technology","Agriculture and Nutrition","Social Studies","Creative Arts","Physical and Health Education","Religious Education","Computer"],
  "Grade 6": ["English","Kiswahili","Mathematics","Science and Technology","Agriculture and Nutrition","Social Studies","Creative Arts","Physical and Health Education","Religious Education","Computer"],
  "Grade 7": ["English","Kiswahili","Mathematics","Integrated Science","Health Education","Social Studies","Religious Education","Business Studies","Agriculture and Nutrition","Pre-Technical Studies","Computer Science","Creative Arts and Sports","Life Skills Education"],
  "Grade 8": ["English","Kiswahili","Mathematics","Integrated Science","Health Education","Social Studies","Religious Education","Business Studies","Agriculture and Nutrition","Pre-Technical Studies","Computer Science","Creative Arts and Sports","Life Skills Education"],
  "Grade 9": ["English","Kiswahili","Mathematics","Integrated Science","Health Education","Social Studies","Religious Education","Business Studies","Agriculture and Nutrition","Pre-Technical Studies","Computer Science","Creative Arts and Sports","Life Skills Education"],
};

const CAM_SUBJECTS_BASE = ["English","Mathematics","Science","Cambridge Global Perspectives","Art & Design","Digital Literacy / Computing","Music","Physical Education","Modern Foreign Languages","Wellbeing"];

const CAM_SUBJECTS = {};
CAM_GRADES.forEach(g => { CAM_SUBJECTS[g] = [...CAM_SUBJECTS_BASE]; });

const CBC_GRADES_STR = ["EE","ME","AE","BE"];
const CBC_GRADE_LABELS = { EE:"Exceeding Expectations", ME:"Meeting Expectations", AE:"Approaching Expectations", BE:"Below Expectations" };
const CBC_GRADE_COLORS = { EE:"#0d9488", ME:"#2563eb", AE:"#d97706", BE:"#e05a4e" };

const CAM_LETTER_GRADES = ["A","B","C","D","E"];

const CHECKPOINT_YEARS = ["Year 6","Year 9"];

// Term calendars
const TERM_CALENDARS = {
  CBC: [
    { term: "Term 1", months: "January – April" },
    { term: "Term 2", months: "May – July" },
    { term: "Term 3", months: "August – November" },
  ],
  Cambridge: [
    { term: "Term 1", months: "September – December" },
    { term: "Term 2", months: "January – March" },
    { term: "Term 3", months: "April – June" },
  ],
};

// ─── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────

const LS = {
  get: (key, def = null) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del: (key) => { try { localStorage.removeItem(key); } catch {} },
};

function generateId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

// ─── INITIAL STORE ────────────────────────────────────────────────────────────

function initStore() {
  return {
    schoolName: "",
    schoolLogo: null,
    curricula: [],          // ["CBC"] | ["Cambridge"] | ["CBC","Cambridge"]
    classes: [],            // [{id, curriculum, grade, streams:[{id,name}], subjects:[]}]
    students: [],           // [{id, name, admNo, gender, curriculum, grade, stream, parentId}]
    teachers: [],           // [{id, name, email, phone, homeClass, homeStream, subjectAssignments:[{grade,stream,subject}], curriculum}]
    parents: [],            // [{id, name, email, phone, childIds:[]}]
    grades: {},             // {studentId:{subject:{ term1:{grade,score,comment}, term2:..., term3:...}}}
    remarks: {},            // {teacherId:{studentId:{term:remark}}}
    strands: [],
    strandGrades: {},
    subStrands: [],
    learningOutcomes: [],
    outcomeGrades: {},
    users: [],              // [{id, role, name, email, password, linkedId}]
    currentTerm: "Term 1",
    currentYear: new Date().getFullYear(),
    activeCurriculum: "CBC",
    setupComplete: false,
    examConfig: ["Mid Term", "End Term"],
  };
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [store, setStore] = useState(initStore);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    // FIRST — check if this is a password reset redirect
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        }).then(() => {
          setShowPasswordReset(true);
          setLoading(false);
          // Clear the hash from URL so refresh doesn't trigger reset again
          window.history.replaceState(null, '', window.location.pathname);
        });
        return;
      }
    }

    // SECOND — normal session check
    const savedSchoolId = localStorage.getItem('elimucards_school_id');

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const meta = session.user.user_metadata;
        setSession({
          userId: session.user.id,
          role: meta.role,
          name: meta.name,
          linkedId: meta.linkedId,
        });
        await loadSchoolData(meta.schoolId || savedSchoolId);
      } else if (savedSchoolId) {
        await loadSchoolData(savedSchoolId);
      } else {
        setStore(prev => ({ ...prev, setupComplete: false }));
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setSession(null);
        const schoolId = localStorage.getItem('elimucards_school_id');
        if (schoolId) {
          setStore(prev => ({ ...prev, setupComplete: true }));
        } else {
          setStore(prev => ({ ...prev, setupComplete: false }));
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadSchoolData(schoolId) {
    if (!schoolId) return;
    localStorage.setItem('elimucards_school_id', schoolId);
    const [
      { data: school },
      { data: classes },
      { data: students },
      { data: teachers },
      { data: parents },
      { data: grades },
      { data: remarks },
      { data: strands },
      { data: subStrands },
      { data: learningOutcomes },
      { data: outcomeGrades },
    ] = await Promise.all([
      supabase.from('schools').select('*').eq('id', schoolId).single(),
      supabase.from('classes').select('*').eq('school_id', schoolId),
      supabase.from('students').select('*').eq('school_id', schoolId),
      supabase.from('teachers').select('*').eq('school_id', schoolId),
      supabase.from('parents').select('*').eq('school_id', schoolId),
      supabase.from('grades').select('*'),
      supabase.from('remarks').select('*'),
      supabase.from('strands').select('*').eq('school_id', schoolId),
      supabase.from('sub_strands').select('*'),
      supabase.from('learning_outcomes').select('*'),
      supabase.from('outcome_grades').select('*'),
    ]);

    setStore({
      ...initStore(),
      schoolId,
      schoolName: school?.name || "",
      curricula: school?.curricula || [],
      currentTerm: school?.current_term || "Term 1",
      currentYear: school?.current_year || new Date().getFullYear(),
      activeCurriculum: school?.active_curriculum || "CBC",
      setupComplete: school?.setup_complete || false,
      examConfig: school?.exam_config || ["Mid Term", "End Term"],
      classes: classes || [],
      students: students || [],
      teachers: teachers || [],
      parents: parents || [],
      grades: (grades || []).reduce((acc, g) => {
        if (!acc[g.student_id]) acc[g.student_id] = {};
        if (!acc[g.student_id][g.subject]) acc[g.student_id][g.subject] = {};
        acc[g.student_id][g.subject][g.term] = {
          grade: g.grade_value,
          score: g.score,
          comment: g.comment,
        };
        return acc;
      }, {}),
      remarks: (remarks || []).reduce((acc, r) => {
        if (!acc[r.teacher_id]) acc[r.teacher_id] = {};
        if (!acc[r.teacher_id][r.student_id]) acc[r.teacher_id][r.student_id] = {};
        acc[r.teacher_id][r.student_id][r.term] = r.remark;
        return acc;
      }, {}),
      strands: strands || [],
      strandGrades: {},
      subStrands: subStrands || [],
      learningOutcomes: learningOutcomes || [],
      outcomeGrades: (outcomeGrades || []).reduce((acc, og) => {
        if (!acc[og.student_id]) acc[og.student_id] = {};
        if (!acc[og.student_id][og.outcome_id]) acc[og.student_id][og.outcome_id] = {};
        acc[og.student_id][og.outcome_id][og.term] = {
          grade: og.grade_value,
          reflection: og.reflection,
        };
        return acc;
      }, {}),
    });
  }

  function updateStore(patch) {
    setStore(prev => typeof patch === "function" ? patch(prev) : { ...prev, ...patch });
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    const meta = data.user.user_metadata;
    setSession({
      userId: data.user.id,
      role: meta.role,
      name: meta.name,
      linkedId: meta.linkedId,
    });
    await loadSchoolData(meta.schoolId);
    return null;
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    const schoolId = localStorage.getItem('elimucards_school_id');
    if (schoolId) {
      setStore(prev => ({ ...prev, setupComplete: true }));
    } else {
      setStore(prev => ({ ...prev, setupComplete: false }));
    }
  }

  if (showPasswordReset) return <PasswordResetPage supabase={supabase} onDone={() => setShowPasswordReset(false)} />;

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Plus Jakarta Sans, sans-serif", color:COLORS.teal }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32, fontWeight:800, marginBottom:8 }}>ElimuCards</div>
        <div style={{ fontSize:14, opacity:.6 }}>Loading...</div>
      </div>
    </div>
  );

  // Scenarios:
  // 1. No school set up at all — new visitor — show welcome/login (setupComplete=false, no savedSchoolId)
  // 2. School exists, no session — show login page
  // 3. School exists, session active — show dashboard
  // 4. Brand new school signup — show setup wizard only after clicking "Create New School"

  const savedSchoolId = localStorage.getItem('elimucards_school_id');

  if (!store.setupComplete && !savedSchoolId) {
    // New visitor — show login/welcome with option to create account
    return <LoginPage store={store} onLogin={login} onSetup={() => updateStore({ setupComplete: "wizard" })} supabase={supabase} />;
  }

  if (store.setupComplete === "wizard") {
    return <SetupWizard store={store} updateStore={updateStore} supabase={supabase} />;
  }

  if (!session) {
    return <LoginPage store={store} onLogin={login} onSetup={() => updateStore({ setupComplete: "wizard" })} supabase={supabase} />;
  }

  const props = { store, updateStore, session, logout, supabase };
  if (session.role === "admin") return <AdminApp {...props} />;
  if (session.role === "teacher") return <TeacherApp {...props} />;
  if (session.role === "parent") return <ParentApp {...props} />;
  return <div>Unknown role</div>;
}
// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 15px; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: ${COLORS.bg}; color: ${COLORS.text}; min-height: 100vh; }
h1,h2,h3,h4,h5,h6 { font-family: 'Plus Jakarta Sans', sans-serif; }
  button { cursor: pointer; font-family: inherit; }
  input, select, textarea { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.tealL2}; border-radius: 3px; }
  .fade-in { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
  .slide-down { animation: slideDown 0.25s ease; }
  @keyframes slideDown { from { opacity:0; transform:translateY(-8px);} to { opacity:1; transform:translateY(0);} }
`;

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────

const btn = (variant="primary", extra={}) => {
  const base = { display:"inline-flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:8, fontWeight:600, fontSize:14, border:"none", transition:"all 0.18s", cursor:"pointer", ...extra };
  if (variant === "primary")   return { ...base, background:COLORS.teal, color:"#fff", boxShadow:"0 1px 4px rgba(13,148,136,0.18)" };
  if (variant === "secondary") return { ...base, background:COLORS.tealL, color:COLORS.teal2, border:`1px solid ${COLORS.tealL2}` };
  if (variant === "amber")     return { ...base, background:COLORS.amber, color:"#fff" };
  if (variant === "danger")    return { ...base, background:COLORS.coralL, color:COLORS.coral2, border:`1px solid ${COLORS.coral}` };
  if (variant === "ghost")     return { ...base, background:"transparent", color:COLORS.teal, border:`1px solid ${COLORS.border}` };
  return base;
};

const input = (extra={}) => ({
  width:"100%", padding:"9px 12px", borderRadius:7, border:`1.5px solid ${COLORS.border}`,
  fontSize:14, background:"#fff", color:COLORS.text, outline:"none",
  transition:"border-color 0.15s",
  ...extra,
});

const card = (extra={}) => ({
  background:COLORS.card, borderRadius:12, border:`1px solid ${COLORS.border}`,
  boxShadow:"0 1px 4px rgba(0,0,0,0.06)", ...extra,
});

// ─── SMALL REUSABLES ─────────────────────────────────────────────────────────

function StyleTag() { return <style dangerouslySetInnerHTML={{ __html: GS }} />; }

function Badge({ color="#0d9488", bg="#ccfbf1", children, style={} }) {
  return <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:20, background:bg, color, fontWeight:600, fontSize:12, ...style }}>{children}</span>;
}

function CurriculumBadge({ curriculum }) {
  return curriculum === "CBC"
    ? <Badge color={COLORS.teal2} bg={COLORS.tealL}>CBC</Badge>
    : <Badge color={COLORS.amber2} bg={COLORS.amberL}>Cambridge</Badge>;
}

function Modal({ title, onClose, children, wide=false }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ ...card(), padding:0, width:"100%", maxWidth:wide?760:520, maxHeight:"90vh", display:"flex", flexDirection:"column", overflowY:"auto" }} onClick={e => e.stopPropagation()} className="fade-in">
        <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${COLORS.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
          <h3 style={{ fontSize:17, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ ...btn("ghost"), padding:"4px 10px" }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px", overflowY:"auto" }}>{children}</div>
      </div>
    </div>
  );
}

function FormGroup({ label, children, required }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontWeight:600, fontSize:13, color:COLORS.text2, marginBottom:5 }}>{label}{required && <span style={{ color:COLORS.coral }}>*</span>}</label>
      {children}
    </div>
  );
}

function Input({ label, required, ...props }) {
  return (
    <FormGroup label={label} required={required}>
      <input style={input()} {...props} />
    </FormGroup>
  );
}

function Select({ label, required, options, ...props }) {
  return (
    <FormGroup label={label} required={required}>
      <select style={{ ...input(), cursor:"pointer" }} {...props}>
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </FormGroup>
  );
}

function TopBar({ store, session, logout, onCurriculumSwitch }) {
  const dual = store.curricula.length > 1;
  return (
    <header style={{ background:"#fff", borderBottom:`1px solid ${COLORS.border}`, padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:900, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:36, height:36, borderRadius:8, background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal3})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontFamily:"Sora", fontSize:16 }}>E</div>
        <div>
          <div style={{ fontFamily:"Sora", fontWeight:700, fontSize:17, color:COLORS.teal3, lineHeight:1.1 }}>{store.schoolName || "School"}</div>
          <div style={{ fontSize:11, color:COLORS.text3, fontWeight:500 }}>ElimuCards</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {dual && (
          <div style={{ display:"flex", gap:4, background:COLORS.bg, borderRadius:8, padding:4, border:`1px solid ${COLORS.border}` }}>
            {["CBC","Cambridge"].map(c => (
              <button key={c} onClick={() => onCurriculumSwitch && onCurriculumSwitch(c)} style={{ padding:"5px 14px", borderRadius:6, border:"none", fontWeight:600, fontSize:12, cursor:"pointer", background:store.activeCurriculum===c?(c==="CBC"?COLORS.teal:COLORS.amber):"transparent", color:store.activeCurriculum===c?"#fff":(c==="CBC"?COLORS.teal:COLORS.amber), transition:"all 0.18s" }}>
                {c === "CBC" ? "🇰🇪 CBC" : "🇬🇧 Cambridge"}
              </button>
            ))}
          </div>
        )}
        <div style={{ fontSize:13, color:COLORS.text2, fontWeight:500 }}>{session?.name}</div>
        <Badge color={session?.role==="admin"?COLORS.teal2:session?.role==="teacher"?COLORS.amber2:COLORS.coral2} bg={session?.role==="admin"?COLORS.tealL:session?.role==="teacher"?COLORS.amberL:COLORS.coralL}>{session?.role}</Badge>
        <button onClick={logout} style={btn("ghost", { fontSize:12, padding:"5px 12px" })}>Log out</button>
      </div>
    </header>
  );
}

function Sidebar({ items, active, onSelect }) {
  return (
    <nav style={{ width:220, flexShrink:0, background:"#fff", borderRight:`1px solid ${COLORS.border}`, padding:"16px 10px", display:"flex", flexDirection:"column", gap:2, minHeight:"calc(100vh - 60px)" }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onSelect(item.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, border:"none", background:active===item.id?COLORS.tealL:"transparent", color:active===item.id?COLORS.teal2:COLORS.text2, fontWeight:active===item.id?600:400, fontSize:14, textAlign:"left", transition:"all 0.15s" }}>
          <span style={{ fontSize:16 }}>{item.icon}</span>{item.label}
        </button>
      ))}
    </nav>
  );
}

// ─── SETUP WIZARD ─────────────────────────────────────────────────────────────

function SetupWizard({ store, updateStore, supabase }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    schoolName: store.schoolName || "",
    curricula: store.curricula.length ? store.curricula : [],
    classes: [],     // [{grade, streams:[], subjects:[]}]
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    currentTerm: "Term 1",
    currentYear: new Date().getFullYear(),
  });

  const totalSteps = 4;

  function next() { setStep(s => Math.min(s + 1, totalSteps)); }
  function back() { setStep(s => Math.max(s - 1, 1)); }

  function toggleCurriculum(c) {
    setForm(f => ({ ...f, curricula: f.curricula.includes(c) ? f.curricula.filter(x => x !== c) : [...f.curricula, c] }));
  }

  function addClassConfig(curriculum, grade) {
    if (form.classes.find(c => c.curriculum === curriculum && c.grade === grade)) return;
    const defaultSubs = curriculum === "CBC" ? (CBC_SUBJECTS[grade] || []) : (CAM_SUBJECTS[grade] || []);
    setForm(f => ({ ...f, classes: [...f.classes, { id: generateId(), curriculum, grade, streams: [{ id: generateId(), name: "Main" }], subjects: [...defaultSubs] }] }));
  }

  function removeClassConfig(id) { setForm(f => ({ ...f, classes: f.classes.filter(c => c.id !== id) })); }

  function addStream(classId, streamName) {
    if (!streamName.trim()) return;
    setForm(f => ({ ...f, classes: f.classes.map(c => c.id === classId ? { ...c, streams: [...c.streams, { id: generateId(), name: streamName.trim() }] } : c) }));
  }

  function removeStream(classId, streamId) {
    setForm(f => ({ ...f, classes: f.classes.map(c => c.id === classId ? { ...c, streams: c.streams.filter(s => s.id !== streamId) } : c) }));
  }

  function toggleSubject(classId, subject) {
    setForm(f => ({ ...f, classes: f.classes.map(c => c.id === classId ? { ...c, subjects: c.subjects.includes(subject) ? c.subjects.filter(s => s !== subject) : [...c.subjects, subject] } : c) }));
  }

  function addCustomSubject(classId, subject) {
    if (!subject.trim()) return;
    setForm(f => ({ ...f, classes: f.classes.map(c => c.id === classId && !c.subjects.includes(subject.trim()) ? { ...c, subjects: [...c.subjects, subject.trim()] } : c) }));
  }

  async function finish() {
    // 1. Create school in Supabase
    const insertData = {
      name: form.schoolName,
      curricula: form.curricula,
      current_term: form.currentTerm,
      current_year: Number(form.currentYear),
      active_curriculum: form.curricula[0] || "CBC",
      setup_complete: true,
    };

    console.log("Inserting school:", insertData);
    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert(insertData)
      .select()
      .single();

    if (schoolError) { alert("Error creating school: " + schoolError.message); return; }

    // 2. Save classes
    if (form.classes.length > 0) {
      await supabase.from('classes').insert(
        form.classes.map(c => ({
          school_id: school.id,
          curriculum: c.curriculum,
          grade: c.grade,
          streams: c.streams,
          subjects: c.subjects,
        }))
      );
    }

    // 3. Create admin user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.adminEmail,
      password: form.adminPassword,
      options: {
        data: {
          role: "admin",
          name: form.adminName,
          schoolId: school.id,
          linkedId: school.id,
        }
      }
    });

    if (authError) { alert("Error creating admin account: " + authError.message); return; }

    // 4. Update local store
    updateStore({
      schoolId: school.id,
      schoolName: form.schoolName,
      curricula: form.curricula,
      classes: form.classes,
      currentTerm: form.currentTerm,
      currentYear: Number(form.currentYear),
      activeCurriculum: form.curricula[0] || "CBC",
      setupComplete: true,
    });
  }

  const gradeList = form.curricula.includes("CBC") && form.curricula.includes("Cambridge")
    ? [{ label:"🇰🇪 CBC Grades", grades:CBC_GRADES, curriculum:"CBC" }, { label:"🇬🇧 Cambridge Grades", grades:CAM_GRADES, curriculum:"Cambridge" }]
    : form.curricula.includes("CBC")
      ? [{ label:"CBC Grades", grades:CBC_GRADES, curriculum:"CBC" }]
      : [{ label:"Cambridge Grades", grades:CAM_GRADES, curriculum:"Cambridge" }];

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${COLORS.teal3} 0%, #1a5276 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <StyleTag />
      <div style={{ ...card(), width:"100%", maxWidth:680, padding:0, overflow:"hidden" }}>
        {/* Progress */}
        <div style={{ background:`linear-gradient(135deg, ${COLORS.teal},${COLORS.teal2})`, padding:"24px 32px", color:"#fff" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontFamily:"Sora", fontSize:22, fontWeight:700 }}>ElimuCards</span>
            <span style={{ fontSize:12, opacity:.7, fontWeight:400 }}>School Setup</span>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} style={{ height:4, flex:1, borderRadius:2, background: i < step ? "#fff" : "rgba(255,255,255,0.25)", transition:"background 0.3s" }} />
            ))}
          </div>
          <div style={{ fontSize:13, marginTop:8, opacity:.85 }}>Step {step} of {totalSteps}</div>
        </div>

        <div style={{ padding:"28px 32px", maxHeight:"62vh", overflowY:"auto" }}>
          {step === 1 && (
            <div className="fade-in">
              <h2 style={{ marginBottom:6, fontSize:20 }}>School Information</h2>
              <p style={{ color:COLORS.text2, fontSize:14, marginBottom:24 }}>Set up your school profile and academic calendar.</p>
              <Input label="School Name" required value={form.schoolName} onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))} placeholder="e.g. Sunshine Academy" />
              <Select label="Current Academic Term" required value={form.currentTerm} onChange={e => setForm(f => ({ ...f, currentTerm: e.target.value }))} options={["Term 1","Term 2","Term 3"]} />
              <Input label="Academic Year" required type="number" value={form.currentYear} onChange={e => setForm(f => ({ ...f, currentYear: e.target.value }))} />
              <FormGroup label="Curriculum Offered" required>
                <div style={{ display:"flex", gap:12 }}>
                  {["CBC","Cambridge"].map(c => (
                    <label key={c} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:8, border:`2px solid ${form.curricula.includes(c)?COLORS.teal:COLORS.border}`, background:form.curricula.includes(c)?COLORS.tealL:"#fff", cursor:"pointer", fontWeight:600, fontSize:14, transition:"all 0.15s" }}>
                      <input type="checkbox" checked={form.curricula.includes(c)} onChange={() => toggleCurriculum(c)} style={{ accentColor:COLORS.teal }} />
                      {c === "CBC" ? "🇰🇪 CBC (Kenya)" : "🇬🇧 Cambridge"}
                    </label>
                  ))}
                </div>
              </FormGroup>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in">
              <h2 style={{ marginBottom:6, fontSize:20 }}>Classes & Streams</h2>
              <p style={{ color:COLORS.text2, fontSize:14, marginBottom:20 }}>Select which grades your school offers and configure their streams.</p>
              {gradeList.map(({ label, grades, curriculum }) => (
                <div key={curriculum} style={{ marginBottom:24 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:COLORS.text2, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                    <CurriculumBadge curriculum={curriculum} /> {label}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {grades.map(grade => {
                      const active = form.classes.find(c => c.curriculum === curriculum && c.grade === grade);
                      return (
                        <button key={grade} onClick={() => active ? removeClassConfig(active.id) : addClassConfig(curriculum, grade)}
                          style={{ padding:"6px 14px", borderRadius:20, border:`2px solid ${active?COLORS.teal:COLORS.border}`, background:active?COLORS.tealL:"#fff", color:active?COLORS.teal2:COLORS.text2, fontWeight:600, fontSize:13, cursor:"pointer", transition:"all 0.15s" }}>
                          {grade}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {form.classes.length > 0 && (
                <div style={{ marginTop:20 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:COLORS.text, marginBottom:12 }}>Configure Streams</div>
                  {form.classes.map(cls => (
                    <StreamEditor key={cls.id} cls={cls} onAddStream={addStream} onRemoveStream={removeStream} />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="fade-in">
              <h2 style={{ marginBottom:6, fontSize:20 }}>Subjects Configuration</h2>
              <p style={{ color:COLORS.text2, fontSize:14, marginBottom:20 }}>Review and customize subjects for each class. Pre-filled based on curriculum standards.</p>
              {form.classes.map(cls => (
                <SubjectEditor key={cls.id} cls={cls} onToggle={toggleSubject} onAdd={addCustomSubject} />
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="fade-in">
              <h2 style={{ marginBottom:6, fontSize:20 }}>Administrator Account</h2>
              <p style={{ color:COLORS.text2, fontSize:14, marginBottom:24 }}>Create the master admin account for your school.</p>
              <Input label="Full Name" required value={form.adminName} onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} placeholder="e.g. Jane Mwangi" />
              <Input label="Email Address" required type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="admin@school.ac.ke" />
              <Input label="Password" required type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="Secure password" />
            </div>
          )}
        </div>

        <div style={{ padding:"16px 32px", borderTop:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"space-between", background:"#fafafa" }}>
          <button onClick={back} disabled={step === 1} style={btn("ghost", { opacity:step===1?0.4:1 })}>← Back</button>
          {step < totalSteps
            ? <button onClick={next} disabled={step===1&&(!form.schoolName||!form.curricula.length)} style={btn("primary", { opacity:(step===1&&(!form.schoolName||!form.curricula.length))?0.5:1 })}>Continue →</button>
            : <button onClick={finish} disabled={!form.adminName||!form.adminEmail||!form.adminPassword} style={btn("primary", { opacity:(!form.adminName||!form.adminEmail||!form.adminPassword)?0.5:1 })}>🚀 Complete Setup</button>
          }
        </div>
      </div>
    </div>
  );
}

function StreamEditor({ cls, onAddStream, onRemoveStream }) {
  const [newStream, setNewStream] = useState("");
  return (
    <div style={{ ...card(), padding:"14px 16px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <span style={{ fontWeight:700, fontSize:14 }}>{cls.grade} <CurriculumBadge curriculum={cls.curriculum} /></span>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
        {cls.streams.map(s => (
          <div key={s.id} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", background:COLORS.tealL, color:COLORS.teal2, borderRadius:20, fontSize:13, fontWeight:600 }}>
            {s.name}
            {cls.streams.length > 1 && <button onClick={() => onRemoveStream(cls.id, s.id)} style={{ border:"none", background:"none", color:COLORS.coral, cursor:"pointer", padding:0, fontWeight:700 }}>×</button>}
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...input(), flex:1 }} placeholder="Add stream (e.g. Red, A, North)" value={newStream} onChange={e => setNewStream(e.target.value)} onKeyDown={e => { if(e.key==="Enter"){ onAddStream(cls.id,newStream); setNewStream(""); }}} />
        <button style={btn("secondary")} onClick={() => { onAddStream(cls.id, newStream); setNewStream(""); }}>Add</button>
      </div>
    </div>
  );
}

function SubjectEditor({ cls, onToggle, onAdd }) {
  const [custom, setCustom] = useState("");
  const defaultSubs = cls.curriculum === "CBC" ? (CBC_SUBJECTS[cls.grade] || []) : (CAM_SUBJECTS_BASE);
  const allSubs = Array.from(new Set([...defaultSubs, ...cls.subjects]));
  return (
    <div style={{ ...card(), padding:"14px 16px", marginBottom:12 }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>{cls.grade} <CurriculumBadge curriculum={cls.curriculum} /></div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
        {allSubs.map(s => (
          <button key={s} onClick={() => onToggle(cls.id, s)} style={{ padding:"4px 12px", borderRadius:20, border:`2px solid ${cls.subjects.includes(s)?COLORS.teal:COLORS.border}`, background:cls.subjects.includes(s)?COLORS.tealL:"#fff", color:cls.subjects.includes(s)?COLORS.teal2:COLORS.text2, fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
            {cls.subjects.includes(s) ? "✓ " : ""}{s}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...input(), flex:1 }} placeholder="Custom subject…" value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if(e.key==="Enter"){ onAdd(cls.id,custom); setCustom(""); }}} />
        <button style={btn("secondary")} onClick={() => { onAdd(cls.id, custom); setCustom(""); }}>Add</button>
      </div>
    </div>
  );
}

function PasswordResetPage({ supabase, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!password || password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess("Password updated successfully!");
    setTimeout(() => onDone(), 2000);
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${COLORS.teal3} 0%, #1a5276 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <StyleTag />
      <div style={{ ...card(), padding:0, width:"100%", maxWidth:440, overflow:"hidden" }}>
        <div style={{ background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, padding:"28px 32px", color:"#fff", textAlign:"center" }}>
          <div style={{ fontFamily:"Plus Jakarta Sans, sans-serif", fontSize:28, fontWeight:800 }}>ElimuCards</div>
          <div style={{ marginTop:4, fontSize:14, opacity:.8 }}>Set New Password</div>
        </div>
        <div style={{ padding:"28px 32px" }}>
          <p style={{ color:COLORS.text2, fontSize:13, marginBottom:20 }}>Enter your new password below.</p>
          <Input label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <Input label="Confirm Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {error && <div style={{ color:COLORS.coral, fontSize:13, marginBottom:12 }}>⚠ {error}</div>}
          {success && <div style={{ color:COLORS.teal, fontSize:13, marginBottom:12, background:COLORS.tealL, padding:"8px 12px", borderRadius:7 }}>✓ {success}</div>}
          <button onClick={handleReset} disabled={loading} style={{ ...btn("primary"), width:"100%", justifyContent:"center", opacity:loading?0.6:1 }}>
            {loading ? "Updating..." : "Update Password →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

function LoginPage({ store, onLogin, onSetup, supabase }) {
  const [mode, setMode] = useState("choose"); // choose | login | signup
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  async function handleLogin() {
    setError(""); setLoading(true);
    const result = await onLogin(email, password);
    if (result) setError(result);
    setLoading(false);
  }

  async function handleSignup() {
    setError(""); setLoading(true);
    if (!name || !email || !password) { setError("All fields are required."); setLoading(false); return; }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role: "admin" } }
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess("Account created! Check your email to confirm, then sign in.");
    setLoading(false);
  }

  async function handleReset() {
  if (!resetEmail) return;
  setLoading(true);
  const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
    redirectTo: window.location.origin + '/?reset=true',
  });
  if (error) {
    setError(error.message);
  } else {
    setResetMsg("Reset link sent! Check your email and click the link to set a new password.");
  }
  setLoading(false);
}

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${COLORS.teal3} 0%, #1a5276 100%)`, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <StyleTag />
      <div style={{ ...card(), padding:0, width:"100%", maxWidth:440, overflow:"hidden" }}>
        <div style={{ background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, padding:"28px 32px", color:"#fff", textAlign:"center" }}>
          <div style={{ fontFamily:"Sora", fontSize:28, fontWeight:800, letterSpacing:-0.5 }}>ElimuCards</div>
          <div style={{ marginTop:4, fontSize:14, opacity:.8 }}>{store.schoolName || "School Management System"}</div>
        </div>
        <div style={{ padding:"28px 32px" }}>

          {/* Mode: Choose login or signup */}
          {mode === "choose" && (
            <div className="fade-in">
              <h2 style={{ marginBottom:6, fontSize:18, textAlign:"center" }}>Welcome</h2>
              <p style={{ color:COLORS.text2, fontSize:14, textAlign:"center", marginBottom:24 }}>What would you like to do?</p>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button onClick={() => setMode("login")} style={{ ...btn("primary"), width:"100%", justifyContent:"center", padding:"12px" }}>
                  Sign In to Existing Account
                </button>
                <button onClick={() => { if (onSetup) onSetup(); else setMode("signup"); }} style={{ ...btn("ghost"), width:"100%", justifyContent:"center", padding:"12px" }}>
                  Create New School Account
                </button>
              </div>
            </div>
          )}

          {/* Mode: Login */}
          {mode === "login" && (
  <div className="fade-in">
    {!role ? (
      <div>
        <button onClick={() => { setMode("choose"); setRole(null); setError(""); }} style={{ ...btn("ghost", { fontSize:13, padding:"5px 10px", marginBottom:16 }) }}>← Back</button>
        <h2 style={{ marginBottom:20, fontSize:18 }}>Sign In As</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[
                      { r:"admin", label:"Administrator", desc:"Full system access" },
                      { r:"teacher", label:"Teacher", desc:"Grade & manage classes" },
                      { r:"parent", label:"Parent / Guardian", desc:"View your child's reports" }
                    ].map(({ r, label, icon, desc }) => (
                      <button key={r} onClick={() => setRole(r)} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", border:`2px solid ${COLORS.border}`, borderRadius:10, background:"#fff", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor=COLORS.teal; e.currentTarget.style.background=COLORS.tealL; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor=COLORS.border; e.currentTarget.style.background="#fff"; }}>
                        <span style={{ fontSize:24 }}>{icon}</span>
                        <div>
                          <div style={{ fontWeight:700, fontSize:15 }}>{label}</div>
                          <div style={{ fontSize:12, color:COLORS.text3 }}>{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="fade-in">
                  <button onClick={() => { setRole(null); setError(""); }} style={{ ...btn("ghost", { fontSize:13, padding:"5px 10px", marginBottom:16 }) }}>← Back</button>
                  <h2 style={{ marginBottom:20, fontSize:18 }}>Sign In as {role.charAt(0).toUpperCase()+role.slice(1)}</h2>
                  <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
<Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
{error && <div style={{ color:COLORS.coral, fontSize:13, marginBottom:12 }}>⚠ {error}</div>}
{success && <div style={{ color:COLORS.teal, fontSize:13, marginBottom:12, background:COLORS.tealL, padding:"8px 12px", borderRadius:7 }}>✓ {success}</div>}
<button onClick={handleLogin} disabled={loading} style={{ ...btn("primary"), width:"100%", justifyContent:"center", opacity:loading?0.6:1 }}>
  {loading ? "Signing in..." : "Sign In →"}
</button>
<button onClick={() => setShowForgot(true)} style={{ background:"none", border:"none", color:COLORS.teal, fontSize:12, cursor:"pointer", marginTop:8, textDecoration:"underline" }}>
  Forgot password?
</button>

{showForgot && (
  <div style={{ marginTop:14, padding:"14px", background:COLORS.bg, borderRadius:8, border:`1px solid ${COLORS.border}` }}>
    <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Reset Password</div>
    <div style={{ fontSize:12, color:COLORS.text2, marginBottom:10 }}>Enter your email and we'll send you a reset link.</div>
    <Input label="Email Address" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
    {resetMsg && <div style={{ color:COLORS.teal, fontSize:12, marginBottom:8 }}>{resetMsg}</div>}
    <div style={{ display:"flex", gap:8 }}>
      <button onClick={handleReset} disabled={loading} style={{ ...btn("primary"), fontSize:12, opacity:loading?0.6:1 }}>
        {loading ? "Sending..." : "Send Reset Link"}
      </button>
      <button onClick={() => setShowForgot(false)} style={btn("ghost", { fontSize:12 })}>Cancel</button>
    </div>
  </div>
)}
                </div>
              )}
            </div>
          )}

          {/* Mode: Signup */}
          {mode === "signup" && (
            <div className="fade-in">
              <button onClick={() => { setMode("choose"); setError(""); setSuccess(""); }} style={{ ...btn("ghost", { fontSize:13, padding:"5px 10px", marginBottom:16 }) }}>← Back</button>
              <h2 style={{ marginBottom:6, fontSize:18 }}>Create School Account</h2>
              <p style={{ color:COLORS.text2, fontSize:13, marginBottom:20 }}>Set up a new school on ElimuCards. You'll be the administrator.</p>
              {success ? (
                <div style={{ background:COLORS.tealL, border:`1px solid ${COLORS.tealL2}`, borderRadius:8, padding:"14px 16px", color:COLORS.teal2, fontSize:13 }}>
                  ✓ {success}
                  <button onClick={() => { setMode("login"); setSuccess(""); }} style={{ display:"block", marginTop:10, ...btn("primary") }}>Go to Sign In</button>
                </div>
              ) : (
                <>
                  <Input label="Your Full Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Mwangi" />
                  <Input label="Email Address" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.ac.ke" />
                  <Input label="Password" required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Secure password" />
                  {error && <div style={{ color:COLORS.coral, fontSize:13, marginBottom:12 }}>⚠ {error}</div>}
                  <button onClick={handleSignup} disabled={loading} style={{ ...btn("primary"), width:"100%", justifyContent:"center", opacity:loading?0.6:1 }}>
                    {loading ? "Creating account..." : "Create Account →"}
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── ADMIN APP ────────────────────────────────────────────────────────────────

function AdminApp({ store, updateStore, session, logout }) {
  const [page, setPage] = useState("dashboard");

  function switchCurriculum(c) { updateStore({ activeCurriculum: c }); }

  const sidebarItems = [
    { id:"dashboard", label:"Dashboard" },
    { id:"classes", label:"Classes & Streams" },
    { id:"students",  label:"Students" },
    { id:"teachers", label:"Teachers" },
    { id:"parents",  label:"Parents" },
    { id:"grades",  label:"Grades & Reports" },
    { id:"strands",  label:"Strands Setup" },
    { id:"settings",  label:"Settings" },
  ];

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <StyleTag />
      <TopBar store={store} session={session} logout={logout} onCurriculumSwitch={switchCurriculum} />
      <div style={{ display:"flex", flex:1 }}>
        <Sidebar items={sidebarItems} active={page} onSelect={setPage} />
        <main style={{ flex:1, padding:24, overflowY:"auto", maxHeight:"calc(100vh - 60px)" }}>
          {page === "dashboard"  && <AdminDashboard store={store} updateStore={updateStore} />}
          {page === "classes"    && <ClassesManager store={store} updateStore={updateStore} />}
          {page === "students" && <StudentsManager store={store} updateStore={updateStore} supabase={supabase} />}
          {page === "teachers" && <TeachersManager store={store} updateStore={updateStore} supabase={supabase} />}
          {page === "parents" && <ParentsManager store={store} updateStore={updateStore} supabase={supabase} />}
          {page === "grades"     && <AdminGrades store={store} updateStore={updateStore} />}
          {page === "strands" && <StrandsManager store={store} updateStore={updateStore} supabase={supabase} />}
          {page === "settings" && <AdminSettings store={store} updateStore={updateStore} supabase={supabase} />}
       </main>
      </div>
    </div>
  );
}

// Admin Dashboard - Grid cards for grades with dropdown streams
function AdminDashboard({ store, updateStore }) {
  const [openGrade, setOpenGrade] = useState(null);
  const [selectedStream, setSelectedStream] = useState(null);

  const filteredClasses = store.classes.filter(c =>
    store.curricula.length < 2 || c.curriculum === store.activeCurriculum
  );

  const students = selectedStream
    ? store.students.filter(s => s.grade === selectedStream.grade && s.stream === selectedStream.stream && s.curriculum === selectedStream.curriculum)
    : [];

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>Admin Dashboard</h1>
          <p style={{ color:COLORS.text2, fontSize:14 }}>{store.schoolName} · {store.currentTerm} {store.currentYear}</p>
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <StatCard label="Students" value={store.students.length} color={COLORS.teal} />
          <StatCard label="Teachers" value={store.teachers.length} color={COLORS.amber} />
          <StatCard label="Classes" value={store.classes.reduce((acc,c)=>acc+c.streams.length,0)} color={COLORS.coral} />
        </div>
      </div>

      {filteredClasses.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 0", color:COLORS.text3 }}>
          <div style={{ fontSize:40 }}>🏫</div>
          <div style={{ marginTop:8 }}>No classes configured yet. Go to Classes & Streams to set up grades.</div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:14, marginBottom:24 }}>
        {filteredClasses.map(cls => (
          <div key={cls.id}>
            <button onClick={() => { setOpenGrade(openGrade===cls.id?null:cls.id); setSelectedStream(null); }}
              style={{ ...card(), width:"100%", padding:"16px 18px", border:`2px solid ${openGrade===cls.id?COLORS.teal:COLORS.border}`, cursor:"pointer", textAlign:"left", transition:"all 0.2s" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, fontFamily:"Sora" }}>{cls.grade}</div>
                  <div style={{ fontSize:12, color:COLORS.text3, marginTop:2 }}>{cls.streams.length} stream{cls.streams.length>1?"s":""}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                  <CurriculumBadge curriculum={cls.curriculum} />
                  <span style={{ fontSize:12, color:COLORS.text3 }}>{store.students.filter(s=>s.grade===cls.grade&&s.curriculum===cls.curriculum).length} students</span>
                </div>
              </div>
            </button>
            {openGrade === cls.id && (
              <div className="slide-down" style={{ ...card(), marginTop:4, padding:"10px 14px", border:`1px solid ${COLORS.tealL2}` }}>
                {cls.streams.map(st => (
                  <button key={st.id} onClick={() => setSelectedStream({ grade:cls.grade, stream:st.name, curriculum:cls.curriculum })}
                    style={{ display:"block", width:"100%", textAlign:"left", padding:"7px 10px", borderRadius:7, border:"none", background:selectedStream?.stream===st.name&&selectedStream?.grade===cls.grade?COLORS.tealL:"transparent", color:COLORS.text, fontWeight:500, fontSize:13, cursor:"pointer", transition:"background 0.15s" }}>
                    → {cls.grade} {st.name} ({store.students.filter(s=>s.grade===cls.grade&&s.stream===st.name&&s.curriculum===cls.curriculum).length} students)
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedStream && (
        <div className="fade-in">
          <StreamWorkspace store={store} grade={selectedStream.grade} stream={selectedStream.stream} curriculum={selectedStream.curriculum} students={students} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...card(), padding:"12px 18px", textAlign:"center", minWidth:80 }}>
      <div style={{ fontSize:24, fontWeight:800, color, fontFamily:"Sora" }}>{value}</div>
      <div style={{ fontSize:12, color:COLORS.text3, fontWeight:500 }}>{label}</div>
    </div>
  );
}

function StreamWorkspace({ store, grade, stream, curriculum, students }) {
  return (
    <div>
      <div style={{ background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, borderRadius:12, padding:"16px 22px", color:"#fff", marginBottom:16 }}>
        <div style={{ fontFamily:"Sora", fontWeight:700, fontSize:20 }}>{grade} — {stream}</div>
        <div style={{ fontSize:13, opacity:.85, marginTop:2 }}>{curriculum} Curriculum · {students.length} students enrolled</div>
      </div>
      {students.length === 0 ? (
        <div style={{ textAlign:"center", color:COLORS.text3, padding:32 }}>No students enrolled in this stream yet.</div>
      ) : (
        <div style={{ ...card(), overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
            <thead>
              <tr style={{ background:COLORS.bg }}>
                {["#","Adm No","Full Name","Gender"].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                  <td style={{ padding:"9px 14px", color:COLORS.text3 }}>{i+1}</td>
                  <td style={{ padding:"9px 14px", fontWeight:600, color:COLORS.teal2 }}>{s.admNo}</td>
                  <td style={{ padding:"9px 14px", fontWeight:500 }}>{s.name}</td>
                  <td style={{ padding:"9px 14px", color:COLORS.text2 }}>{s.gender}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── CLASSES MANAGER ──────────────────────────────────────────────────────────

function ClassesManager({ store, updateStore }) {
  const [showAddStream, setShowAddStream] = useState(null);
  const [newStreamName, setNewStreamName] = useState("");
  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassForm, setNewClassForm] = useState({ curriculum:"CBC", grade:"" });

  function deleteClass(id) {
    if (!confirm("Delete this class and all its streams?")) return;
    updateStore(s => ({ ...s, classes: s.classes.filter(c => c.id !== id) }));
  }

  function addStream(classId) {
    if (!newStreamName.trim()) return;
    updateStore(s => ({ ...s, classes: s.classes.map(c => c.id === classId ? { ...c, streams: [...c.streams, { id: generateId(), name: newStreamName.trim() }] } : c) }));
    setNewStreamName(""); setShowAddStream(null);
  }

  function deleteStream(classId, streamId) {
    updateStore(s => ({ ...s, classes: s.classes.map(c => c.id === classId ? { ...c, streams: c.streams.filter(st => st.id !== streamId) } : c) }));
  }

  function addClass() {
    if (!newClassForm.grade) return;
    if (store.classes.find(c => c.curriculum === newClassForm.curriculum && c.grade === newClassForm.grade)) return;
    const defSubs = newClassForm.curriculum === "CBC" ? (CBC_SUBJECTS[newClassForm.grade] || []) : (CAM_SUBJECTS_BASE);
    updateStore(s => ({ ...s, classes: [...s.classes, { id: generateId(), curriculum: newClassForm.curriculum, grade: newClassForm.grade, streams: [{ id: generateId(), name: "Main" }], subjects: defSubs }] }));
    setShowAddClass(false);
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Classes & Streams</h1>
        <button style={btn("primary")} onClick={() => setShowAddClass(true)}>+ Add Class</button>
      </div>

      {store.classes.map(cls => (
        <div key={cls.id} style={{ ...card(), padding:"16px 20px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontFamily:"Sora", fontWeight:700, fontSize:16 }}>{cls.grade}</span>
              <CurriculumBadge curriculum={cls.curriculum} />
              <span style={{ fontSize:13, color:COLORS.text3 }}>{cls.subjects.length} subjects</span>
            </div>
            <button style={btn("danger", { fontSize:12, padding:"4px 10px" })} onClick={() => deleteClass(cls.id)}>🗑 Delete</button>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {cls.streams.map(st => (
              <div key={st.id} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", background:COLORS.tealL, color:COLORS.teal2, borderRadius:20, fontSize:13, fontWeight:600 }}>
                {cls.grade} {st.name}
                {cls.streams.length > 1 && <button onClick={() => deleteStream(cls.id, st.id)} style={{ border:"none", background:"none", color:COLORS.coral, cursor:"pointer", fontWeight:700 }}>×</button>}
              </div>
            ))}
            {showAddStream === cls.id ? (
              <div style={{ display:"flex", gap:6 }}>
                <input style={{ ...input(), width:160, padding:"4px 10px" }} placeholder="Stream name" value={newStreamName} onChange={e => setNewStreamName(e.target.value)} autoFocus onKeyDown={e => { if(e.key==="Enter") addStream(cls.id); if(e.key==="Escape"){ setShowAddStream(null); setNewStreamName(""); } }} />
                <button style={btn("secondary", { padding:"4px 10px", fontSize:12 })} onClick={() => addStream(cls.id)}>Add</button>
                <button style={btn("ghost", { padding:"4px 10px", fontSize:12 })} onClick={() => { setShowAddStream(null); setNewStreamName(""); }}>✕</button>
              </div>
            ) : (
              <button style={{ padding:"5px 12px", borderRadius:20, border:`2px dashed ${COLORS.border}`, background:"transparent", color:COLORS.text3, fontSize:12, cursor:"pointer" }} onClick={() => setShowAddStream(cls.id)}>+ Add Stream</button>
            )}
          </div>
        </div>
      ))}

      {showAddClass && (
        <Modal title="Add New Class" onClose={() => setShowAddClass(false)}>
          <Select label="Curriculum" options={store.curricula} value={newClassForm.curriculum} onChange={e => setNewClassForm(f => ({ ...f, curriculum: e.target.value, grade:"" }))} />
          <Select label="Grade" options={(newClassForm.curriculum === "CBC" ? CBC_GRADES : CAM_GRADES).filter(g => !store.classes.find(c => c.curriculum===newClassForm.curriculum&&c.grade===g))} value={newClassForm.grade} onChange={e => setNewClassForm(f => ({ ...f, grade: e.target.value }))} />
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={btn("ghost")} onClick={() => setShowAddClass(false)}>Cancel</button>
            <button style={btn("primary")} onClick={addClass}>Add Class</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── STUDENTS MANAGER ─────────────────────────────────────────────────────────

function StudentsManager({ store, updateStore, supabase }) {
  const [activeCurTab, setActiveCurTab] = useState(store.curricula[0] || "CBC");
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", admNo:"", gender:"", curriculum:"CBC", grade:"", stream:"" });
  const fileRef = useRef();

  const students = store.students.filter(s => s.curriculum === activeCurTab && (s.name.toLowerCase().includes(search.toLowerCase()) || s.admNo.includes(search)));

  async function addStudent() {
    if (!form.name || !form.admNo || !form.grade || !form.stream) return;
    const { data, error } = await supabase
      .from('students')
      .insert({
        school_id: store.schoolId,
        name: form.name,
        adm_no: form.admNo,
        gender: form.gender,
        curriculum: form.curriculum,
        grade: form.grade,
        stream: form.stream,
      })
      .select()
      .single();

    if (error) { alert("Error adding student: " + error.message); return; }
    updateStore(st => ({ ...st, students: [...st.students, data] }));
    setShowAddModal(false);
    setForm({ name:"", admNo:"", gender:"", curriculum:activeCurTab, grade:"", stream:"" });
  }

  function deleteStudent(id) {
    if (!confirm("Remove this student?")) return;
    updateStore(s => ({ ...s, students: s.students.filter(st => st.id !== id) }));
  }
  const [editStudent, setEditStudent] = useState(null);

function openEditStudent(student) {
  setEditStudent({
    id: student.id,
    name: student.name,
    admNo: student.admNo || student.adm_no || "",
    gender: student.gender || "",
    curriculum: student.curriculum || activeCurTab,
    grade: student.grade || "",
    stream: student.stream || "",
  });
}

async function saveEditStudent() {
  const { error } = await supabase
    .from('students')
    .update({
      name: editStudent.name,
      adm_no: editStudent.admNo,
      gender: editStudent.gender,
      grade: editStudent.grade,
      stream: editStudent.stream,
    })
    .eq('id', editStudent.id);

  if (error) { alert("Error updating student: " + error.message); return; }

  updateStore(s => ({
    ...s,
    students: s.students.map(st => st.id === editStudent.id
      ? { ...st, ...editStudent, adm_no: editStudent.admNo }
      : st
    )
  }));
  setEditStudent(null);
}

  function handleCSV(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split(/\r?\n/).filter(Boolean);
      const header = lines[0].split(/,|\t/).map(h => h.trim().toLowerCase());
      const nameIdx = header.findIndex(h => h.includes("name"));
      const admIdx = header.findIndex(h => h.includes("adm") || h.includes("no") || h.includes("id"));
      const genderIdx = header.findIndex(h => h.includes("gender") || h.includes("sex"));
      const gradeIdx = header.findIndex(h => h.includes("grade") || h.includes("class") || h.includes("year"));
      const streamIdx = header.findIndex(h => h.includes("stream") || h.includes("section"));

      const newStudents = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/,|\t/).map(c => c.trim().replace(/^"|"$/g, ""));
        if (!cols[nameIdx]) continue;
        newStudents.push({
          id: generateId(),
          name: nameIdx >= 0 ? cols[nameIdx] : "",
          admNo: admIdx >= 0 ? cols[admIdx] : `ADM${i}`,
          gender: genderIdx >= 0 ? cols[genderIdx] : "",
          curriculum: activeCurTab,
          grade: gradeIdx >= 0 ? cols[gradeIdx] : "",
          stream: streamIdx >= 0 ? cols[streamIdx] : "Main",
          parentId: null,
        });
      }
      updateStore(s => ({ ...s, students: [...s.students, ...newStudents] }));
      alert(`Imported ${newStudents.length} students.`);
    };
    reader.readAsText(file);
  }

  const classesByCurriculum = store.classes.filter(c => c.curriculum === activeCurTab);

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Students</h1>
        <div style={{ display:"flex", gap:8 }}>
          <button style={btn("ghost")} onClick={() => fileRef.current?.click()}>📥 Import CSV/TSV</button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display:"none" }} onChange={e => { if(e.target.files[0]) handleCSV(e.target.files[0]); e.target.value=""; }} />
          <button style={btn("primary")} onClick={() => { setForm(f => ({ ...f, curriculum:activeCurTab })); setShowAddModal(true); }}>+ Add Student</button>
        </div>
      </div>

      {store.curricula.length > 1 && (
        <div style={{ display:"flex", gap:4, marginBottom:16, background:COLORS.bg, padding:4, borderRadius:8, border:`1px solid ${COLORS.border}`, width:"fit-content" }}>
          {store.curricula.map(c => (
            <button key={c} onClick={() => setActiveCurTab(c)} style={{ padding:"7px 18px", borderRadius:6, border:"none", fontWeight:600, fontSize:13, cursor:"pointer", background:activeCurTab===c?(c==="CBC"?COLORS.teal:COLORS.amber):"transparent", color:activeCurTab===c?"#fff":(c==="CBC"?COLORS.teal:COLORS.amber), transition:"all 0.15s" }}>
              {c === "CBC" ? "🇰🇪 CBC" : "🇬🇧 Cambridge"}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom:14 }}>
        <input style={{ ...input(), maxWidth:320 }} placeholder="Search by name or admission number…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ ...card(), overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead>
            <tr style={{ background:COLORS.bg }}>
              {["#","Adm No","Full Name","Gender","Grade","Stream","Actions"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}`, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr><td colSpan={7} style={{ padding:32, textAlign:"center", color:COLORS.text3 }}>No students found. Import a roster or add students manually.</td></tr>
            )}
            {students.map((s, i) => (
              <tr key={s.id} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                <td style={{ padding:"9px 14px", color:COLORS.text3 }}>{i+1}</td>
                <td style={{ padding:"9px 14px", fontWeight:600, color:COLORS.teal2 }}>{s.admNo || s.adm_no}</td>
                <td style={{ padding:"9px 14px", fontWeight:500 }}>{s.name}</td>
                <td style={{ padding:"9px 14px", color:COLORS.text2 }}>{s.gender}</td>
                <td style={{ padding:"9px 14px" }}>{s.grade}</td>
                <td style={{ padding:"9px 14px" }}>{s.stream}</td>
                <td style={{ padding:"9px 14px", display:"flex", gap:6 }}>
                  <button onClick={() => openEditStudent(s)} style={btn("secondary", { padding:"3px 10px", fontSize:12 })}>Edit</button>
                  <button onClick={() => deleteStudent(s.id)} style={btn("danger", { padding:"3px 10px", fontSize:12 })}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <Modal title="Add Student" onClose={() => setShowAddModal(false)}>
          <Input label="Full Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
          <Input label="Admission Number" required value={form.admNo} onChange={e => setForm(f => ({ ...f, admNo:e.target.value }))} />
          <Select label="Gender" options={["Male","Female","Other"]} value={form.gender} onChange={e => setForm(f => ({ ...f, gender:e.target.value }))} />
          <Select label="Curriculum" options={store.curricula} value={form.curriculum} onChange={e => setForm(f => ({ ...f, curriculum:e.target.value, grade:"", stream:"" }))} />
          <Select label="Grade" required options={store.classes.filter(c=>c.curriculum===form.curriculum).map(c=>c.grade)} value={form.grade} onChange={e => setForm(f => ({ ...f, grade:e.target.value, stream:"" }))} />
          <Select label="Stream" required options={(store.classes.find(c=>c.curriculum===form.curriculum&&c.grade===form.grade)?.streams||[]).map(s=>s.name)} value={form.stream} onChange={e => setForm(f => ({ ...f, stream:e.target.value }))} />
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button style={btn("ghost")} onClick={() => setShowAddModal(false)}>Cancel</button>
            <button style={btn("primary")} onClick={addStudent}>Add Student</button>
          </div>
        </Modal>
      )}
      {editStudent && (
  <Modal title="Edit Student" onClose={() => setEditStudent(null)}>
    <Input label="Full Name" required value={editStudent.name} onChange={e => setEditStudent(f=>({...f,name:e.target.value}))} />
    <Input label="Admission Number" required value={editStudent.admNo} onChange={e => setEditStudent(f=>({...f,admNo:e.target.value}))} />
    <Select label="Gender" options={["Male","Female","Other"]} value={editStudent.gender} onChange={e => setEditStudent(f=>({...f,gender:e.target.value}))} />
    <Select label="Grade" required options={store.classes.filter(c=>c.curriculum===editStudent.curriculum).map(c=>c.grade)} value={editStudent.grade} onChange={e => setEditStudent(f=>({...f,grade:e.target.value,stream:""}))} />
    <Select label="Stream" required options={(store.classes.find(c=>c.curriculum===editStudent.curriculum&&c.grade===editStudent.grade)?.streams||[]).map(s=>s.name)} value={editStudent.stream} onChange={e => setEditStudent(f=>({...f,stream:e.target.value}))} />
    <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
      <button style={btn("ghost")} onClick={() => setEditStudent(null)}>Cancel</button>
      <button style={btn("primary")} onClick={saveEditStudent}>Save Changes</button>
    </div>
  </Modal>
)} 
    </div>
  );
}

// ─── TEACHERS MANAGER ─────────────────────────────────────────────────────────

function TeachersManager({ store, updateStore, supabase }) {
  const [activeCurTab, setActiveCurTab] = useState(store.curricula[0] || "CBC");
  const [showModal, setShowModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [form, setForm] = useState({ name:"", email:"", phone:"", password:"", homeClass:"", homeStream:"", curriculum:"CBC", subjectAssignments:[] });
  const [newAssign, setNewAssign] = useState({ grade:"", stream:"", subject:"" });

  async function addTeacher() {
    if (!form.name || !form.email || !form.password) return;
    
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .insert({
        school_id: store.schoolId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        home_class: form.homeClass,
        home_stream: form.homeStream,
        curriculum: form.curriculum,
        subject_assignments: form.subjectAssignments,
      })
      .select()
      .single();

    if (teacherError) { alert("Error adding teacher: " + teacherError.message); return; }

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role: "teacher",
          name: form.name,
          schoolId: store.schoolId,
          linkedId: teacher.id,
        }
      }
    });

    if (authError) { alert("Error creating teacher login: " + authError.message); return; }

    updateStore(s => ({ ...s, teachers: [...s.teachers, teacher] }));
    setShowModal(false);
  }

  function deleteTeacher(id) {
    if (!confirm("Remove this teacher?")) return;
    updateStore(s => ({ ...s, teachers:s.teachers.filter(t=>t.id!==id), users:s.users.filter(u=>u.linkedId!==id) }));
  }

function openEditTeacher(teacher) {
  setEditTeacher({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone || "",
    homeClass: teacher.homeClass || teacher.home_class || "",
    homeStream: teacher.homeStream || teacher.home_stream || "",
    curriculum: teacher.curriculum || "CBC",
    subjectAssignments: teacher.subjectAssignments || teacher.subject_assignments || [],
  });
}

async function saveEditTeacher() {
  const { error } = await supabase
    .from('teachers')
    .update({
      name: editTeacher.name,
      phone: editTeacher.phone,
      home_class: editTeacher.homeClass,
      home_stream: editTeacher.homeStream,
      curriculum: editTeacher.curriculum,
      subject_assignments: editTeacher.subjectAssignments,
    })
    .eq('id', editTeacher.id);

  if (error) { alert("Error updating teacher: " + error.message); return; }

  updateStore(s => ({ ...s, teachers: s.teachers.map(t => t.id === editTeacher.id ? { ...t, ...editTeacher, home_class: editTeacher.homeClass, home_stream: editTeacher.homeStream, subject_assignments: editTeacher.subjectAssignments } : t) }));
  setEditTeacher(null);
}

  function addAssignment() {
    if (!newAssign.grade || !newAssign.subject) return;
    setForm(f => ({ ...f, subjectAssignments: [...f.subjectAssignments, { ...newAssign, id: generateId() }] }));
    setNewAssign({ grade:"", stream:"", subject:"" });
  }

  const availGrades = store.classes.filter(c=>c.curriculum===form.curriculum);
  const availStreams = availGrades.find(c=>c.grade===newAssign.grade)?.streams || [];
  const availSubjects = store.classes.find(c=>c.curriculum===form.curriculum&&c.grade===newAssign.grade)?.subjects || [];

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Teachers</h1>
        <button style={btn("primary")} onClick={() => setShowModal(true)}>+ Add Teacher</button>
      </div>
      {store.curricula.length > 1 && (
        <div style={{ display:"flex", gap:4, marginBottom:16, background:COLORS.bg, padding:4, borderRadius:8, border:`1px solid ${COLORS.border}`, width:"fit-content" }}>
          {store.curricula.map(c => (
            <button key={c} onClick={() => setActiveCurTab(c)} style={{ padding:"7px 18px", borderRadius:6, border:"none", fontWeight:600, fontSize:13, cursor:"pointer", background:activeCurTab===c?(c==="CBC"?COLORS.teal:COLORS.amber):"transparent", color:activeCurTab===c?"#fff":(c==="CBC"?COLORS.teal:COLORS.amber), transition:"all 0.15s" }}>
              {c === "CBC" ? "CBC" : "Cambridge"}
            </button>
         ))}
       </div>
     )}
      <div style={{ ...card(), overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead>
            <tr style={{ background:COLORS.bg }}>
              {["Name","Email","Phone","Home Class","Assignments","Actions"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {store.teachers.length === 0 && (
              <tr><td colSpan={6} style={{ padding:32, textAlign:"center", color:COLORS.text3 }}>No teachers added yet.</td></tr>
            )}
            {store.teachers.filter(t => store.curricula.length < 2 || t.curriculum === activeCurTab).map(t => (
              <tr key={t.id} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                <td style={{ padding:"9px 14px", fontWeight:600 }}>{t.name}</td>
                <td style={{ padding:"9px 14px", color:COLORS.text2 }}>{t.email}</td>
                <td style={{ padding:"9px 14px", color:COLORS.text2 }}>{t.phone || "—"}</td>
                <td style={{ padding:"9px 14px" }}>{(t.homeClass || t.home_class) ? `${t.homeClass || t.home_class} ${t.homeStream || t.home_stream}` : "—"}</td>
  <td style={{ padding:"9px 14px" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {(t.subjectAssignments || t.subject_assignments || []).length === 0 && <span style={{ color:COLORS.text3, fontSize:12 }}>No assignments</span>}
                  {Array.from(new Set([
                    ...(t.homeClass || t.home_class ? [`${t.homeClass || t.home_class} (${t.homeStream || t.home_stream}) — Home Class Teacher`] : []),
                    ...(t.subjectAssignments || t.subject_assignments || []).map(a => `${a.grade}${a.stream ? ` (${a.stream})` : ""} — ${a.subject}`)
                  ])).map((label, i) => (
                    <span key={i} style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:i===0&&(t.homeClass||t.home_class)?COLORS.amberL:COLORS.tealL, color:i===0&&(t.homeClass||t.home_class)?COLORS.amber2:COLORS.teal2, fontWeight:600 }}>
                      {label}
                    </span>
                  ))}
                </div>
              </td>
              <td style={{ padding:"9px 14px", display:"flex", gap:6 }}>
                <button onClick={() => openEditTeacher(t)} style={btn("secondary",{padding:"3px 10px",fontSize:12})}>Edit</button>
                <button onClick={() => deleteTeacher(t.id)} style={btn("danger",{padding:"3px 10px",fontSize:12})}>Remove</button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Add Teacher" onClose={() => setShowModal(false)} wide>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" }}>
            <Input label="Full Name" required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
            <Input label="Email" required type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
            <Input label="Phone" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
            <Input label="Login Password" required type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} />
          </div>
          <Select label="Curriculum" options={store.curricula} value={form.curriculum} onChange={e => setForm(f=>({...f,curriculum:e.target.value,homeClass:"",homeStream:""}))} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" }}>
            <Select label="Home Class (optional)" options={store.classes.filter(c=>c.curriculum===form.curriculum).map(c=>c.grade)} value={form.homeClass} onChange={e => setForm(f=>({...f,homeClass:e.target.value,homeStream:""}))} />
            {form.homeClass && <Select label="Home Stream" options={(store.classes.find(c=>c.curriculum===form.curriculum&&c.grade===form.homeClass)?.streams||[]).map(s=>s.name)} value={form.homeStream} onChange={e => setForm(f=>({...f,homeStream:e.target.value}))} />}
          </div>
          <div style={{ ...card({ background:COLORS.bg }), padding:"14px 16px", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Subject Assignments</div>
            {form.subjectAssignments.map((a, i) => (
              <div key={a.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${COLORS.border}`, fontSize:13 }}>
                <span>{a.grade} {a.stream && `(${a.stream})`} — {a.subject}</span>
                <button onClick={() => setForm(f=>({...f,subjectAssignments:f.subjectAssignments.filter((_,j)=>j!==i)}))} style={{ border:"none", background:"none", color:COLORS.coral, cursor:"pointer", fontWeight:700 }}>×</button>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
              <select style={{ ...input(), flex:1, minWidth:100 }} value={newAssign.grade} onChange={e => setNewAssign(a=>({...a,grade:e.target.value,stream:"",subject:""}))}>
                <option value="">Grade</option>
                {availGrades.map(c => <option key={c.grade} value={c.grade}>{c.grade}</option>)}
              </select>
              <select style={{ ...input(), flex:1, minWidth:100 }} value={newAssign.stream} onChange={e => setNewAssign(a=>({...a,stream:e.target.value}))}>
                <option value="">All Streams</option>
                {availStreams.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <select style={{ ...input(), flex:2, minWidth:140 }} value={newAssign.subject} onChange={e => setNewAssign(a=>({...a,subject:e.target.value}))}>
                <option value="">Subject</option>
                {availSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button style={btn("secondary")} onClick={addAssignment}>Add</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={btn("ghost")} onClick={() => setShowModal(false)}>Cancel</button>
            <button style={btn("primary")} onClick={addTeacher}>Save Teacher</button>
            </div>
        </Modal>
      )}

      {editTeacher && (
  <Modal title="Edit Teacher" onClose={() => setEditTeacher(null)}>
    <Input label="Full Name" value={editTeacher.name} onChange={e => setEditTeacher(f=>({...f,name:e.target.value}))} />
    <Input label="Phone" value={editTeacher.phone} onChange={e => setEditTeacher(f=>({...f,phone:e.target.value}))} />
    <Select label="Curriculum" options={store.curricula} value={editTeacher.curriculum} onChange={e => setEditTeacher(f=>({...f,curriculum:e.target.value,homeClass:"",homeStream:""}))} />
    <Select label="Home Class" options={store.classes.filter(c=>c.curriculum===editTeacher.curriculum).map(c=>c.grade)} value={editTeacher.homeClass} onChange={e => setEditTeacher(f=>({...f,homeClass:e.target.value,homeStream:""}))} />
    {editTeacher.homeClass && (
      <Select label="Home Stream" options={(store.classes.find(c=>c.curriculum===editTeacher.curriculum&&c.grade===editTeacher.homeClass)?.streams||[]).map(s=>s.name)} value={editTeacher.homeStream} onChange={e => setEditTeacher(f=>({...f,homeStream:e.target.value}))} />
    )}
    <div style={{ ...card({ background:COLORS.bg }), padding:"14px 16px", marginBottom:14 }}>
      <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Subject Assignments</div>
      {(editTeacher.subjectAssignments || []).map((a, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${COLORS.border}`, fontSize:13 }}>
          <span>{a.grade} {a.stream && `(${a.stream})`} — {a.subject}</span>
          <button onClick={() => setEditTeacher(f=>({...f, subjectAssignments: f.subjectAssignments.filter((_,j)=>j!==i)}))} style={{ border:"none", background:"none", color:COLORS.coral, cursor:"pointer", fontWeight:700 }}>×</button>
        </div>
      ))}
      <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
        <select style={{ ...input(), flex:1, minWidth:100 }} value={newAssign.grade} onChange={e => setNewAssign(a=>({...a,grade:e.target.value,stream:"",subject:""}))}>
          <option value="">Grade</option>
          {store.classes.filter(c=>c.curriculum===editTeacher.curriculum).map(c => <option key={c.grade} value={c.grade}>{c.grade}</option>)}
        </select>
        <select style={{ ...input(), flex:1, minWidth:100 }} value={newAssign.stream} onChange={e => setNewAssign(a=>({...a,stream:e.target.value}))}>
          <option value="">All Streams</option>
          {(store.classes.find(c=>c.curriculum===editTeacher.curriculum&&c.grade===newAssign.grade)?.streams||[]).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select style={{ ...input(), flex:2, minWidth:140 }} value={newAssign.subject} onChange={e => setNewAssign(a=>({...a,subject:e.target.value}))}>
          <option value="">Subject</option>
          {(store.classes.find(c=>c.curriculum===editTeacher.curriculum&&c.grade===newAssign.grade)?.subjects||[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={btn("secondary")} onClick={() => {
          if (!newAssign.grade || !newAssign.subject) return;
          setEditTeacher(f=>({...f, subjectAssignments: [...(f.subjectAssignments||[]), {...newAssign, id: generateId()}]}));
          setNewAssign({ grade:"", stream:"", subject:"" });
        }}>Add</button>
      </div>
    </div>
    <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
      <button style={btn("ghost")} onClick={() => setEditTeacher(null)}>Cancel</button>
      <button style={btn("primary")} onClick={saveEditTeacher}>Save Changes</button>
    </div>
  </Modal>
  )}
    </div>
  );
  }
    

// ─── PARENTS MANAGER ──────────────────────────────────────────────────────────

function ParentsManager({ store, updateStore, supabase }) {
  const [activeCurTab, setActiveCurTab] = useState(store.curricula[0] || "CBC");
  const [showModal, setShowModal] = useState(false);
  const [editParent, setEditParent] = useState(null);
  const [form, setForm] = useState({ name:"", email:"", phone:"", password:"", childIds:[] });

 async function addParent() {
    if (!form.name || !form.email || !form.password) return;

    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .insert({
        school_id: store.schoolId,
        name: form.name,
        email: form.email,
        phone: form.phone,
        child_ids: form.childIds,
      })
      .select()
      .single();

    if (parentError) { alert("Error adding parent: " + parentError.message); return; }

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role: "parent",
          name: form.name,
          schoolId: store.schoolId,
          linkedId: parent.id,
        }
      }
    });

    if (authError) { alert("Error creating parent login: " + authError.message); return; }

    updateStore(s => ({ ...s, parents: [...s.parents, parent] }));
    setShowModal(false);
    setForm({ name:"", email:"", phone:"", password:"", childIds:[] });
  }

  function deleteParent(id) {
    if (!confirm("Remove this parent?")) return;
    updateStore(s => ({ ...s, parents:s.parents.filter(p=>p.id!==id), users:s.users.filter(u=>u.linkedId!==id) }));
  }
  

function openEditParent(parent) {
  setEditParent({
    id: parent.id,
    name: parent.name,
    email: parent.email,
    phone: parent.phone || "",
    childIds: parent.childIds || parent.child_ids || [],
  });
}

async function saveEditParent() {
  const { error } = await supabase
    .from('parents')
    .update({
      name: editParent.name,
      phone: editParent.phone,
      child_ids: editParent.childIds,
    })
    .eq('id', editParent.id);

  if (error) { alert("Error updating parent: " + error.message); return; }

  updateStore(s => ({ ...s, parents: s.parents.map(p => p.id === editParent.id ? { ...p, ...editParent, child_ids: editParent.childIds } : p) }));
  setEditParent(null);
}

  function toggleChild(childId) {
    setForm(f => ({ ...f, childIds: f.childIds.includes(childId) ? f.childIds.filter(c=>c!==childId) : [...f.childIds, childId] }));
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Parents & Guardians</h1>
        <button style={btn("primary")} onClick={() => setShowModal(true)}>+ Add Parent</button>
      </div>
      {store.curricula.length > 1 && (
        <div style={{ display:"flex", gap:4, marginBottom:16, background:COLORS.bg, padding:4, borderRadius:8, border:`1px solid ${COLORS.border}`, width:"fit-content" }}>
          {store.curricula.map(c => (
            <button key={c} onClick={() => setActiveCurTab(c)} style={{ padding:"7px 18px", borderRadius:6, border:"none", fontWeight:600, fontSize:13, cursor:"pointer", background:activeCurTab===c?(c==="CBC"?COLORS.teal:COLORS.amber):"transparent", color:activeCurTab===c?"#fff":(c==="CBC"?COLORS.teal:COLORS.amber), transition:"all 0.15s" }}>
              {c === "CBC" ? "CBC" : "Cambridge"}
            </button>
          ))}
        </div>
     )}
      <div style={{ ...card(), overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14 }}>
          <thead>
            <tr style={{ background:COLORS.bg }}>
              {["Name","Email","Phone","Children","Actions"].map(h => (
                <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {store.parents.length === 0 && (
              <tr><td colSpan={5} style={{ padding:32, textAlign:"center", color:COLORS.text3 }}>No parents added yet.</td></tr>
            )}
            {store.parents.filter(p => {
              if (store.curricula.length < 2) return true;
              return p.child_ids || p.childIds ? (p.childIds || p.child_ids || []).some(cid => {
                const child = store.students.find(s => s.id === cid);
                return child?.curriculum === activeCurTab;
             }) : true;
           }).map(p => (
              <tr key={p.id} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                <td style={{ padding:"9px 14px", fontWeight:600 }}>{p.name}</td>
                <td style={{ padding:"9px 14px", color:COLORS.text2 }}>{p.email}</td>
                <td style={{ padding:"9px 14px", color:COLORS.text2 }}>{p.phone || "—"}</td>
                <td style={{ padding:"9px 14px" }}>
                  {(p.childIds || p.child_ids || []).map(cid => {
                    const child = store.students.find(s=>s.id===cid);
                    return child ? <Badge key={cid} color={COLORS.teal2} bg={COLORS.tealL} style={{ marginRight:4 }}>{child.name}</Badge> : null;
                  })}
                </td>
                <td style={{ padding:"9px 14px", display:"flex", gap:6 }}>
                  <button onClick={() => openEditParent(p)} style={btn("secondary",{padding:"3px 10px",fontSize:12})}>Edit</button>
                  <button onClick={() => deleteParent(p.id)} style={btn("danger",{padding:"3px 10px",fontSize:12})}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Add Parent / Guardian" onClose={() => setShowModal(false)}>
          <Input label="Full Name" required value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
          <Input label="Email" required type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
          <Input label="Phone" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
          <Input label="Login Password" required type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} />
          <FormGroup label="Link Children">
            <div style={{ maxHeight:160, overflowY:"auto", border:`1px solid ${COLORS.border}`, borderRadius:7, padding:"8px 10px" }}>
              {store.students.length === 0 && <div style={{ color:COLORS.text3, fontSize:13 }}>No students enrolled yet.</div>}
              {store.students.map(s => (
                <label key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", fontSize:13, cursor:"pointer" }}>
                  <input type="checkbox" checked={form.childIds.includes(s.id)} onChange={() => toggleChild(s.id)} style={{ accentColor:COLORS.teal }} />
                  {s.name} — {s.grade} {s.stream} ({s.curriculum})
                </label>
              ))}
            </div>
          </FormGroup>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <button style={btn("ghost")} onClick={() => setShowModal(false)}>Cancel</button>
            <button style={btn("primary")} onClick={addParent}>Save Parent</button>
          </div>
        </Modal>
      )}
      {editParent && (
  <Modal title="Edit Parent" onClose={() => setEditParent(null)}>
    <Input label="Full Name" value={editParent.name} onChange={e => setEditParent(f=>({...f,name:e.target.value}))} />
    <Input label="Phone" value={editParent.phone} onChange={e => setEditParent(f=>({...f,phone:e.target.value}))} />
    <FormGroup label="Link Children">
      <div style={{ maxHeight:160, overflowY:"auto", border:`1px solid ${COLORS.border}`, borderRadius:7, padding:"8px 10px" }}>
        {store.students.map(s => (
          <label key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 0", fontSize:13, cursor:"pointer" }}>
            <input type="checkbox" checked={editParent.childIds.includes(s.id)} onChange={() => setEditParent(f=>({ ...f, childIds: f.childIds.includes(s.id) ? f.childIds.filter(c=>c!==s.id) : [...f.childIds, s.id] }))} style={{ accentColor:COLORS.teal }} />
            {s.name} — {s.grade} {s.stream}
          </label>
        ))}
      </div>
    </FormGroup>
    <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
      <button style={btn("ghost")} onClick={() => setEditParent(null)}>Cancel</button>
      <button style={btn("primary")} onClick={saveEditParent}>Save Changes</button>
    </div>
  </Modal>
)}
    </div>
  );
}

// ─── ADMIN GRADES ─────────────────────────────────────────────────────────────

function AdminGrades({ store, updateStore }) {
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const filteredClasses = store.classes.filter(c =>
    store.curricula.length < 2 || c.curriculum === store.activeCurriculum
  );

  const streamStudents = selectedClass && selectedStream
    ? store.students.filter(s => s.grade === selectedClass.grade && s.stream === selectedStream && s.curriculum === selectedClass.curriculum)
    : [];

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, marginBottom:20 }}>Grades & Reports</h1>
      <div style={{ display:"grid", gridTemplateColumns:"220px 1fr", gap:16 }}>
        <div>
          {filteredClasses.map(cls => (
            <div key={cls.id} style={{ marginBottom:8 }}>
              <button onClick={() => { setSelectedClass(selectedClass?.id===cls.id?null:cls); setSelectedStream(null); setSelectedStudent(null); }}
                style={{ width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:8, border:`1px solid ${selectedClass?.id===cls.id?COLORS.teal:COLORS.border}`, background:selectedClass?.id===cls.id?COLORS.tealL:"#fff", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                {cls.grade}
              </button>
              {selectedClass?.id === cls.id && (
                <div style={{ paddingLeft:8, marginTop:4 }}>
                  {cls.streams.map(st => (
                    <button key={st.id} onClick={() => { setSelectedStream(st.name); setSelectedStudent(null); }}
                      style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 10px", borderRadius:6, border:"none", background:selectedStream===st.name?COLORS.amberL:"transparent", color:selectedStream===st.name?COLORS.amber2:COLORS.text2, fontSize:12, fontWeight:selectedStream===st.name?700:400, cursor:"pointer" }}>
                      → {st.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div>
          {!selectedClass && <div style={{ textAlign:"center", padding:"60px 0", color:COLORS.text3 }}>Select a class to view grades</div>}
          {selectedClass && !selectedStream && <div style={{ textAlign:"center", padding:"60px 0", color:COLORS.text3 }}>Select a stream</div>}
          {selectedClass && selectedStream && (
            <div>
              <div style={{ background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, borderRadius:12, padding:"14px 20px", color:"#fff", marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:18 }}>{selectedClass.grade} — {selectedStream}</div>
                <div style={{ fontSize:12, opacity:.8 }}>{selectedClass.curriculum} · {streamStudents.length} students</div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
                {streamStudents.map(s => (
                  <button key={s.id} onClick={() => setSelectedStudent(selectedStudent?.id===s.id?null:s)} style={{ padding:"7px 14px", borderRadius:8, border:`2px solid ${selectedStudent?.id===s.id?COLORS.teal:COLORS.border}`, background:selectedStudent?.id===s.id?COLORS.tealL:"#fff", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                    {s.name}
                  </button>
                ))}
              </div>
              {selectedStudent && (
                <ReportCardView store={store} student={selectedStudent} curriculum={selectedClass.curriculum} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN SETTINGS ───────────────────────────────────────────────────────────

function AdminSettings({ store, updateStore, supabase }) {
  const [form, setForm] = useState({ 
  schoolName:store.schoolName, 
  currentTerm:store.currentTerm, 
  currentYear:store.currentYear,
  examConfig: store.examConfig || ["Mid Term", "End Term"],
});

  async function save() { 
  updateStore({ schoolName:form.schoolName, currentTerm:form.currentTerm, currentYear:Number(form.currentYear), examConfig:form.examConfig });
  await supabase.from('schools').update({ 
    name:form.schoolName, 
    current_term:form.currentTerm, 
    current_year:Number(form.currentYear),
    exam_config: form.examConfig,
  }).eq('id', store.schoolId);
  alert("Settings saved!"); 
}

  function resetAll() {
    if (!confirm("This will erase ALL school data and reset to setup. Are you sure?")) return;
    localStorage.clear(); window.location.reload();
  }

  return (
    <div style={{ maxWidth:520 }}>
      <h1 style={{ fontSize:22, fontWeight:800, marginBottom:20 }}>Settings</h1>
      <div style={{ ...card(), padding:"20px 24px", marginBottom:16 }}>
        <h3 style={{ marginBottom:14, fontSize:16 }}>School Information</h3>
        <Input label="School Name" value={form.schoolName} onChange={e => setForm(f=>({...f,schoolName:e.target.value}))} />
        <Select label="Current Term" options={["Term 1","Term 2","Term 3"]} value={form.currentTerm} onChange={e => setForm(f=>({...f,currentTerm:e.target.value}))} />
        <Input label="Academic Year" type="number" value={form.currentYear} onChange={e => setForm(f=>({...f,currentYear:e.target.value}))} />
        <div style={{ marginTop:8, background:COLORS.tealL, borderRadius:8, padding:"10px 14px", fontSize:13 }}>
          <strong>Term Calendars:</strong><br/>
          <strong>CBC:</strong> Term 1: Jan–Apr · Term 2: May–Jul · Term 3: Aug–Nov<br/>
          <strong>Cambridge:</strong> Term 1: Sep–Dec · Term 2: Jan–Mar · Term 3: Apr–Jun
        </div>
        <FormGroup label="Cambridge Exam Structure">
  <div style={{ fontSize:12, color:COLORS.text2, marginBottom:8 }}>Select which exams teachers enter grades for each term:</div>
  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
    {["Entry Exam", "Mid Term", "End Term"].map(exam => (
      <label key={exam} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:`1.5px solid ${form.examConfig?.includes(exam)?COLORS.teal:COLORS.border}`, background:form.examConfig?.includes(exam)?COLORS.tealL:"#fff", cursor:"pointer", fontSize:13, fontWeight:500 }}>
        <input type="checkbox" 
          checked={form.examConfig?.includes(exam) || false}
          onChange={() => setForm(f => ({
            ...f,
            examConfig: f.examConfig?.includes(exam)
              ? f.examConfig.filter(e => e !== exam)
              : [...(f.examConfig || []), exam]
          }))}
          style={{ accentColor:COLORS.teal }} />
        {exam}
        {exam === "End Term" && <span style={{ fontSize:11, color:COLORS.text3, marginLeft:4 }}>(always shown on report card)</span>}
      </label>
    ))}
  </div>
</FormGroup>
        <button style={{ ...btn("primary"), marginTop:16 }} onClick={save}>Save Changes</button>
      </div>
      <div style={{ ...card(), padding:"20px 24px", borderColor:COLORS.coral }}>
        <h3 style={{ marginBottom:8, fontSize:16, color:COLORS.coral2 }}>⚠ Danger Zone</h3>
        <p style={{ fontSize:13, color:COLORS.text2, marginBottom:12 }}>This will permanently delete all school data and cannot be undone.</p>
        <button style={btn("danger")} onClick={resetAll}>Reset All Data</button>
      </div>
    </div>
  );
}

function StrandsManager({ store, updateStore, supabase }) {
  const [selectedCurriculum, setSelectedCurriculum] = useState(store.curricula[0] || "CBC");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [expandedStrand, setExpandedStrand] = useState(null);
  const [expandedSubStrand, setExpandedSubStrand] = useState(null);
  const [newStrandName, setNewStrandName] = useState("");
  const [newSubStrandName, setNewSubStrandName] = useState("");
  const [newOutcomes, setNewOutcomes] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [kicdMode, setKicdMode] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const gradeOptions = store.classes.filter(c => c.curriculum === selectedCurriculum).map(c => c.grade);
  const subjectOptions = store.classes.find(c => c.curriculum === selectedCurriculum && c.grade === selectedGrade)?.subjects || [];

  const currentStrands = (store.strands || []).filter(s =>
    s.curriculum === selectedCurriculum &&
    s.grade === selectedGrade &&
    s.subject === selectedSubject &&
    s.term === store.currentTerm
  ).sort((a, b) => a.sort_order - b.sort_order);

  function parsePasteText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result = [];
    let currentStrand = null;
    let currentSubStrand = null;
    for (const line of lines) {
      const strandMatch = line.match(/^(\d+\.0)\s+(.+)/);
      const subStrandMatch = line.match(/^(\d+\.\d+)\s+(.+)/) && !line.match(/^(\d+\.0)\s+/);
      if (strandMatch) {
        currentStrand = { name: line, subStrands: [] };
        currentSubStrand = null;
        result.push(currentStrand);
      } else if (subStrandMatch && currentStrand) {
        currentSubStrand = { name: line, outcomes: [] };
        currentStrand.subStrands.push(currentSubStrand);
      } else if (currentSubStrand) {
        currentSubStrand.outcomes.push(line);
      }
    }
    return result;
  }

  function handlePreview() {
    if (!pasteText.trim()) return;
    setPreview(parsePasteText(pasteText));
  }

  async function saveStrands(strandsData) {
    setSaving(true);
    for (let si = 0; si < strandsData.length; si++) {
      const strand = strandsData[si];
      const { data: strandData, error: strandError } = await supabase.from('strands').insert({
        school_id: store.schoolId,
        curriculum: selectedCurriculum,
        grade: selectedGrade,
        subject: selectedSubject,
        term: store.currentTerm,
        name: strand.name,
        sort_order: currentStrands.length + si,
      }).select().single();
      if (strandError) { alert("Error: " + strandError.message); setSaving(false); return; }
      updateStore(s => ({ ...s, strands: [...(s.strands||[]), strandData] }));

      for (let ssi = 0; ssi < strand.subStrands.length; ssi++) {
        const ss = strand.subStrands[ssi];
        const { data: ssData, error: ssError } = await supabase.from('sub_strands').insert({
          strand_id: strandData.id, name: ss.name, sort_order: ssi
        }).select().single();
        if (ssError) { alert("Error: " + ssError.message); setSaving(false); return; }
        updateStore(s => ({ ...s, subStrands: [...(s.subStrands||[]), ssData] }));

        if (ss.outcomes.length > 0) {
          const { data: outData, error: outError } = await supabase.from('learning_outcomes').insert(
            ss.outcomes.map((name, i) => ({ sub_strand_id: ssData.id, name, sort_order: i }))
          ).select();
          if (outError) { alert("Error: " + outError.message); setSaving(false); return; }
          updateStore(s => ({ ...s, learningOutcomes: [...(s.learningOutcomes||[]), ...outData] }));
        }
      }
    }
    setSaving(false);
    return true;
  }

  async function handleSavePaste() {
    if (!preview || preview.length === 0) return;
    const success = await saveStrands(preview);
    if (success) { setPasteText(""); setPreview(null); setPasteMode(false); alert("Strands saved successfully!"); }
  }

  async function addStrand() {
    if (!newStrandName.trim() || !selectedGrade || !selectedSubject) return;
    setSaving(true);
    const { data, error } = await supabase.from('strands').insert({
      school_id: store.schoolId,
      curriculum: selectedCurriculum,
      grade: selectedGrade,
      subject: selectedSubject,
      term: store.currentTerm,
      name: newStrandName.trim(),
      sort_order: currentStrands.length,
    }).select().single();
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    updateStore(s => ({ ...s, strands: [...(s.strands||[]), data] }));
    setNewStrandName("");
    setSaving(false);
  }

  async function deleteStrand(strandId) {
    if (!confirm("Delete this strand and all its sub-strands and outcomes?")) return;
    await supabase.from('strands').delete().eq('id', strandId);
    updateStore(s => ({
      ...s,
      strands: s.strands.filter(st => st.id !== strandId),
      subStrands: (s.subStrands||[]).filter(ss => ss.strand_id !== strandId),
      learningOutcomes: (s.learningOutcomes||[]).filter(lo => {
        const ss = (s.subStrands||[]).find(ss => ss.id === lo.sub_strand_id);
        return ss?.strand_id !== strandId;
      }),
    }));
  }

  async function addSubStrand(strandId) {
    if (!newSubStrandName.trim()) return;
    setSaving(true);
    const existing = (store.subStrands||[]).filter(ss => ss.strand_id === strandId);
    const { data, error } = await supabase.from('sub_strands').insert({
      strand_id: strandId, name: newSubStrandName.trim(), sort_order: existing.length,
    }).select().single();
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    updateStore(s => ({ ...s, subStrands: [...(s.subStrands||[]), data] }));
    setNewSubStrandName("");
    setSaving(false);
  }

  async function deleteSubStrand(subStrandId) {
    if (!confirm("Delete this sub-strand and all its outcomes?")) return;
    await supabase.from('sub_strands').delete().eq('id', subStrandId);
    updateStore(s => ({
      ...s,
      subStrands: (s.subStrands||[]).filter(ss => ss.id !== subStrandId),
      learningOutcomes: (s.learningOutcomes||[]).filter(lo => lo.sub_strand_id !== subStrandId),
    }));
  }

  async function addOutcomes(subStrandId) {
    if (!newOutcomes.trim()) return;
    setSaving(true);
    const lines = newOutcomes.split('\n').map(l => l.trim()).filter(Boolean);
    const existing = (store.learningOutcomes||[]).filter(lo => lo.sub_strand_id === subStrandId);
    const { data, error } = await supabase.from('learning_outcomes').insert(
      lines.map((name, i) => ({ sub_strand_id: subStrandId, name, sort_order: existing.length + i }))
    ).select();
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    updateStore(s => ({ ...s, learningOutcomes: [...(s.learningOutcomes||[]), ...data] }));
    setNewOutcomes("");
    setSaving(false);
  }

  async function deleteOutcome(outcomeId) {
    await supabase.from('learning_outcomes').delete().eq('id', outcomeId);
    updateStore(s => ({ ...s, learningOutcomes: (s.learningOutcomes||[]).filter(lo => lo.id !== outcomeId) }));
  }

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>Strands Setup</h1>
          <p style={{ color:COLORS.text2, fontSize:14 }}>Configure assessment structure for {store.currentTerm} — set once, teachers grade instantly</p>
        </div>
      </div>

      <div style={{ ...card(), padding:"20px 24px", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
          <Select label="Curriculum" options={store.curricula} value={selectedCurriculum} onChange={e => { setSelectedCurriculum(e.target.value); setSelectedGrade(""); setSelectedSubject(""); }} />
          <Select label="Grade" options={gradeOptions} value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSubject(""); }} />
          <Select label="Subject" options={subjectOptions} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} />
        </div>
      </div>

      {selectedGrade && selectedSubject && (
        <div className="fade-in">
          <div style={{ ...card(), padding:"20px 24px", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div>
                <div style={{ fontFamily:"Sora", fontWeight:700, fontSize:16 }}>{selectedGrade} — {selectedSubject}</div>
                <div style={{ fontSize:12, color:COLORS.text3, marginTop:2 }}>{store.currentTerm} · {currentStrands.length} strand{currentStrands.length!==1?"s":""}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <CurriculumBadge curriculum={selectedCurriculum} />
                <button onClick={() => { setKicdMode(!kicdMode); setPasteMode(false); setPreview(null); }} style={btn(kicdMode?"primary":"secondary", { fontSize:12 })}>
                  {kicdMode ? "Close KICD" : "Load from KICD"}
                </button>
                <button onClick={() => { setPasteMode(!pasteMode); setKicdMode(false); setPreview(null); }} style={btn(pasteMode?"primary":"secondary", { fontSize:12 })}>
                  {pasteMode ? "Close Paste" : "Paste from Book"}
                </button>
              </div>
            </div>

            {/* KICD MODE */}
            {kicdMode && (
              <div className="fade-in" style={{ marginBottom:16 }}>
                {(() => {
                  const kicdContent = KICD_DATA?.[selectedGrade]?.[selectedSubject];
                  const kicdSubjects = KICD_DATA?.[selectedGrade] ? Object.keys(KICD_DATA[selectedGrade]) : [];
                  if (!kicdContent) {
                    return (
                      <div style={{ textAlign:"center", padding:"20px", background:COLORS.amberL, borderRadius:8, fontSize:13 }}>
                        <div style={{ fontWeight:600, marginBottom:6 }}>No KICD data available for {selectedGrade} — {selectedSubject} yet.</div>
                        {kicdSubjects.length > 0 && <div style={{ fontSize:12, color:COLORS.text2 }}>Available for {selectedGrade}: {kicdSubjects.join(", ")}</div>}
                        <div style={{ fontSize:12, color:COLORS.text2, marginTop:6 }}>Use "Paste from Book" to add strands manually.</div>
                      </div>
                    );
                  }
                  const totalOutcomes = kicdContent.strands.reduce((acc, s) => acc + s.subStrands.reduce((a, ss) => a + ss.outcomes.length, 0), 0);
                  return (
                    <div>
                      <div style={{ background:COLORS.tealL, border:`1px solid ${COLORS.tealL2}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:COLORS.teal2, marginBottom:12 }}>
                        Official KICD curriculum design for <strong>{selectedGrade} — {selectedSubject}</strong> loaded. {kicdContent.strands.length} strands · {kicdContent.strands.reduce((acc,s)=>acc+s.subStrands.length,0)} sub-strands · {totalOutcomes} outcomes ready to save.
                      </div>
                      <div style={{ border:`1px solid ${COLORS.border}`, borderRadius:8, overflow:"hidden", marginBottom:12, maxHeight:300, overflowY:"auto" }}>
                        {kicdContent.strands.map((strand, si) => (
                          <div key={si}>
                            <div style={{ padding:"8px 14px", background:COLORS.teal3, color:"#fff", fontSize:12, fontWeight:700 }}>{strand.name}</div>
                            {strand.subStrands.map((ss, ssi) => (
                              <div key={ssi}>
                                <div style={{ padding:"6px 14px 6px 24px", background:"#1e293b", color:"#94a3b8", fontSize:11, fontWeight:600, fontStyle:"italic" }}>{ss.name}</div>
                                {ss.outcomes.map((lo, loi) => (
                                  <div key={loi} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 14px 5px 36px", borderBottom:`1px solid ${COLORS.border}`, fontSize:11 }}>
                                    <span style={{ width:14, height:14, borderRadius:3, background:COLORS.tealL, border:`1.5px solid ${COLORS.teal}`, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, color:COLORS.teal, flexShrink:0 }}>✓</span>
                                    {lo}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} disabled={saving} onClick={async () => {
                          const success = await saveStrands(kicdContent.strands);
                          if (success) { setKicdMode(false); alert("KICD strands saved successfully!"); }
                        }}>
                          {saving ? "Saving..." : "Save All to My School"}
                        </button>
                        <button style={btn("ghost")} onClick={() => setKicdMode(false)}>Cancel</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* PASTE MODE */}
            {pasteMode && (
              <div className="fade-in" style={{ marginBottom:16 }}>
                <div style={{ background:COLORS.tealL, borderRadius:8, padding:"10px 14px", fontSize:12, color:COLORS.teal2, marginBottom:12 }}>
                  Copy from your curriculum design document and paste below. Format:<br/><br/>
                  <strong>3.0 Social Organizations</strong><br/>
                  3.1 Aspects of Traditional Culture<br/>
                  Identify aspects of traditional culture in the county<br/>
                  Illustrate aspects practised in the county
                </div>
                <textarea style={{ ...input(), minHeight:180, resize:"vertical", fontSize:13, fontFamily:"monospace" }}
                  placeholder={"3.0 Social Organizations\n3.1 Aspects of Traditional Culture\nIdentify aspects of traditional culture\nIllustrate aspects practised in the county"}
                  value={pasteText} onChange={e => { setPasteText(e.target.value); setPreview(null); }} />
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button style={btn("secondary")} onClick={handlePreview}>Preview</button>
                  {preview && <button style={{ ...btn("primary"), opacity:saving?0.6:1 }} onClick={handleSavePaste} disabled={saving}>{saving?"Saving...":"Save All Strands"}</button>}
                  <button style={btn("ghost")} onClick={() => { setPasteText(""); setPreview(null); }}>Clear</button>
                </div>
                {preview && (
                  <div style={{ marginTop:14, border:`1px solid ${COLORS.border}`, borderRadius:8, overflow:"hidden" }}>
                    <div style={{ padding:"8px 14px", background:COLORS.bg, borderBottom:`1px solid ${COLORS.border}`, fontWeight:700, fontSize:13 }}>
                      Preview — {preview.length} strand{preview.length!==1?"s":""} detected
                    </div>
                    {preview.map((strand, si) => (
                      <div key={si} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                        <div style={{ padding:"7px 14px", background:COLORS.teal3, color:"#fff", fontSize:12, fontWeight:700 }}>{strand.name}</div>
                        {strand.subStrands.map((ss, ssi) => (
                          <div key={ssi}>
                            <div style={{ padding:"5px 14px 5px 24px", background:COLORS.bg, fontSize:11, fontWeight:600, color:COLORS.text2, fontStyle:"italic" }}>{ss.name}</div>
                            {ss.outcomes.map((lo, loi) => (
                              <div key={loi} style={{ padding:"4px 14px 4px 36px", fontSize:11, color:COLORS.text, borderBottom:`1px solid ${COLORS.border}` }}>{loi+1}. {lo}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MANUAL MODE */}
            {!pasteMode && !kicdMode && (
              <div>
                {currentStrands.length === 0 && (
                  <div style={{ textAlign:"center", padding:"20px 0", color:COLORS.text3, fontSize:13 }}>
                    No strands yet. Use "Load from KICD" for instant setup, "Paste from Book" for quick entry, or add manually below.
                  </div>
                )}

                {currentStrands.map((strand) => {
                  const strandSubStrands = (store.subStrands||[]).filter(ss => ss.strand_id === strand.id).sort((a,b) => a.sort_order - b.sort_order);
                  return (
                    <div key={strand.id} style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:COLORS.teal3, color:"#fff", borderRadius:"8px 8px 0 0" }}>
                        <button onClick={() => setExpandedStrand(expandedStrand===strand.id?null:strand.id)} style={{ background:"none", border:"none", color:"#fff", fontSize:13, cursor:"pointer", flex:1, textAlign:"left", fontWeight:700 }}>
                          {expandedStrand===strand.id ? "▾" : "▸"} {strand.name}
                        </button>
                        <button onClick={() => deleteStrand(strand.id)} style={btn("danger", { padding:"2px 8px", fontSize:11 })}>Remove</button>
                      </div>
                      {expandedStrand === strand.id && (
                        <div style={{ border:`1px solid ${COLORS.border}`, borderTop:"none", borderRadius:"0 0 8px 8px", padding:"12px 14px" }}>
                          {strandSubStrands.map(ss => {
                            const outcomes = (store.learningOutcomes||[]).filter(lo => lo.sub_strand_id === ss.id).sort((a,b) => a.sort_order - b.sort_order);
                            return (
                              <div key={ss.id} style={{ marginBottom:10 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:COLORS.bg, borderRadius:6, marginBottom:6 }}>
                                  <button onClick={() => setExpandedSubStrand(expandedSubStrand===ss.id?null:ss.id)} style={{ background:"none", border:"none", fontSize:12, cursor:"pointer", flex:1, textAlign:"left", fontWeight:600, color:COLORS.text2, fontStyle:"italic" }}>
                                    {expandedSubStrand===ss.id ? "▾" : "▸"} {ss.name}
                                  </button>
                                  <span style={{ fontSize:11, color:COLORS.text3 }}>{outcomes.length} outcomes</span>
                                  <button onClick={() => deleteSubStrand(ss.id)} style={btn("danger", { padding:"2px 8px", fontSize:11 })}>Remove</button>
                                </div>
                                {expandedSubStrand === ss.id && (
                                  <div style={{ paddingLeft:16 }}>
                                    {outcomes.map((lo, i) => (
                                      <div key={lo.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderBottom:`1px solid ${COLORS.border}`, fontSize:12 }}>
                                        <span style={{ color:COLORS.text3, minWidth:20 }}>{i+1}.</span>
                                        <span style={{ flex:1 }}>{lo.name}</span>
                                        <button onClick={() => deleteOutcome(lo.id)} style={{ border:"none", background:"none", color:COLORS.coral, cursor:"pointer", fontWeight:700 }}>×</button>
                                      </div>
                                    ))}
                                    <div style={{ marginTop:8 }}>
                                      <textarea style={{ ...input(), minHeight:70, resize:"vertical", fontSize:12 }} placeholder="Add outcomes — one per line" value={newOutcomes} onChange={e => setNewOutcomes(e.target.value)} />
                                      <button style={{ ...btn("secondary", { fontSize:12, marginTop:6 }), opacity:saving?0.6:1 }} onClick={() => addOutcomes(ss.id)} disabled={saving}>
                                        {saving ? "Saving..." : "+ Add Outcomes"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div style={{ display:"flex", gap:8, marginTop:10 }}>
                            <input style={{ ...input(), flex:1 }} placeholder="Add sub-strand e.g. 3.1 Aspects of Traditional Culture" value={newSubStrandName} onChange={e => setNewSubStrandName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") addSubStrand(strand.id); }} />
                            <button style={btn("secondary", { opacity:saving?0.6:1 })} onClick={() => addSubStrand(strand.id)} disabled={saving}>Add</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ display:"flex", gap:8, marginTop:16 }}>
                  <input style={{ ...input(), flex:1 }} placeholder="Add strand e.g. 3.0 Social Organizations" value={newStrandName} onChange={e => setNewStrandName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") addStrand(); }} />
                  <button style={btn("primary", { opacity:saving?0.6:1 })} onClick={addStrand} disabled={saving}>
                    {saving ? "Adding..." : "+ Add Strand"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(!selectedGrade || !selectedSubject) && (
        <div style={{ textAlign:"center", padding:"40px 0", color:COLORS.text3 }}>
          Select a grade and subject above to configure strands.
        </div>
      )}
    </div>
  );
}

// ─── TEACHER APP ──────────────────────────────────────────────────────────────

function TeacherApp({ store, updateStore, session, logout }) {
  const [page, setPage] = useState("grades");
  const teacherRaw = store.teachers.find(t => t.id === session.linkedId);
const teacher = teacherRaw ? {
    ...teacherRaw,
    homeClass: teacherRaw.homeClass || teacherRaw.home_class,
    homeStream: teacherRaw.homeStream || teacherRaw.home_stream,
    subjectAssignments: teacherRaw.subjectAssignments || teacherRaw.subject_assignments || [],
    curriculum: teacherRaw.curriculum,
  } : null;

  function switchCurriculum(c) { updateStore({ activeCurriculum: c }); }

  const sidebarItems = [
    { id:"grades", icon:"📊", label:"Grade Entry" },
    { id:"homeclass", icon:"🏠", label:"Home Class" },
    { id:"profile", icon:"👤", label:"My Profile" },
  ];

  if (!teacher) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <StyleTag />
      <div>Teacher profile not found. Contact admin. <button style={btn("ghost")} onClick={logout}>Log out</button></div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <StyleTag />
      <TopBar store={store} session={session} logout={logout} />
      <div style={{ display:"flex", flex:1 }}>
        <Sidebar items={sidebarItems} active={page} onSelect={setPage} />
        <main style={{ flex:1, padding:24, overflowY:"auto", maxHeight:"calc(100vh - 60px)" }}>
          {page === "grades" && <TeacherGradeEntry store={store} updateStore={updateStore} teacher={teacher} supabase={supabase} />}
          {page === "homeclass" && <TeacherHomeClass store={store} updateStore={updateStore} teacher={teacher} supabase={supabase} />}
          {page === "profile"    && <TeacherProfile teacher={teacher} />}
        </main>
      </div>
    </div>
  );
}

function CambridgeExamEntry({ store, student, subject, term, isCheckpoint, examConfig, onGrade }) {
  const [activeExam, setActiveExam] = useState(examConfig[examConfig.length - 1] || "End Term");

  const examKey = `${term}__${activeExam}`;
  const gradeData = store.grades?.[student.id]?.[subject]?.[examKey] || {};

  return (
    <div style={{ ...card(), padding:"16px 20px", marginBottom:14 }}>
      {/* Exam tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16, background:COLORS.bg, padding:4, borderRadius:8, border:`1px solid ${COLORS.border}`, width:"fit-content" }}>
        {examConfig.map(exam => (
          <button key={exam} onClick={() => setActiveExam(exam)}
            style={{ padding:"6px 14px", borderRadius:6, border:"none", fontWeight:600, fontSize:12, cursor:"pointer", background:activeExam===exam?COLORS.teal:"transparent", color:activeExam===exam?"#fff":COLORS.text2, transition:"all 0.15s" }}>
            {exam}
            {exam === "End Term" && <span style={{ fontSize:9, display:"block", opacity:.7 }}>Official</span>}
          </button>
        ))}
      </div>

      {/* Exam grade entry */}
      {isCheckpoint ? (
        <div>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:COLORS.text2 }}>Checkpoint Score (0–50) — {activeExam}</div>
          <input style={{ ...input(), maxWidth:120, fontSize:20, fontWeight:800, textAlign:"center" }}
            type="number" min="0" max="50" placeholder="0–50"
            value={gradeData.score || ""}
            onChange={e => onGrade(student.id, subject, examKey, "score", e.target.value)} />
          {gradeData.score && <CheckpointBand score={Number(gradeData.score)} />}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:COLORS.text2 }}>Score (%) — {activeExam}</div>
            <input style={{ ...input(), fontSize:20, fontWeight:800, textAlign:"center" }}
              type="number" min="0" max="100" placeholder="%"
              value={gradeData.score || ""}
              onChange={e => onGrade(student.id, subject, examKey, "score", e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:COLORS.text2 }}>Letter Grade</div>
            <div style={{ display:"flex", gap:6 }}>
              {CAM_LETTER_GRADES.map(g => (
                <button key={g} onClick={() => onGrade(student.id, subject, examKey, "grade", g)}
                  style={{ flex:1, padding:"10px 0", borderRadius:8, border:`2px solid ${gradeData.grade===g?COLORS.teal:COLORS.border}`, background:gradeData.grade===g?COLORS.teal:"#fff", color:gradeData.grade===g?"#fff":COLORS.text2, fontSize:14, fontWeight:800, cursor:"pointer" }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary of all exams */}
      {examConfig.length > 1 && (
        <div style={{ marginTop:14, padding:"10px 14px", background:COLORS.bg, borderRadius:8, border:`1px solid ${COLORS.border}` }}>
          <div style={{ fontSize:11, fontWeight:700, color:COLORS.text2, marginBottom:8 }}>All Exams This Term</div>
          <div style={{ display:"flex", gap:12 }}>
            {examConfig.map(exam => {
              const ek = `${term}__${exam}`;
              const gd = store.grades?.[student.id]?.[subject]?.[ek] || {};
              return (
                <div key={exam} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:10, color:COLORS.text3, marginBottom:3 }}>{exam}</div>
                  <div style={{ fontWeight:800, fontSize:16, color:gd.score||gd.grade?COLORS.teal:COLORS.text3 }}>
                    {gd.grade || (gd.score ? `${gd.score}%` : "—")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Teacher Grade Entry
function TeacherGradeEntry({ store, updateStore, teacher, supabase }) {
  const [selectedAssign, setSelectedAssign] = useState(null);
  const [currentStudentIdx, setCurrentStudentIdx] = useState(0);

  const assignments = teacher.subjectAssignments || teacher.subject_assignments || [];

  const studentsForAssign = selectedAssign
    ? store.students.filter(s =>
        s.curriculum === teacher.curriculum &&
        s.grade === selectedAssign.grade &&
        (selectedAssign.stream ? s.stream === selectedAssign.stream : true)
      )
    : [];

  const currentStudent = studentsForAssign[currentStudentIdx] || null;

  const subjectStrands = selectedAssign ? (store.strands || []).filter(st =>
    st.curriculum === teacher.curriculum &&
    st.grade === selectedAssign.grade &&
    st.subject === selectedAssign.subject &&
    st.term === store.currentTerm
  ) : [];

  const subjectSubStrands = subjectStrands.length > 0
    ? (store.subStrands || []).filter(ss => subjectStrands.some(st => st.id === ss.strand_id))
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const subjectOutcomes = subjectSubStrands.length > 0
    ? (store.learningOutcomes || []).filter(lo => subjectSubStrands.some(ss => ss.id === lo.sub_strand_id))
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const hasOutcomes = subjectOutcomes.length > 0;

  const term = store.currentTerm;
  const isCheckpoint = selectedAssign && CHECKPOINT_YEARS.includes(selectedAssign.grade);

  function getStudentProgress(studentId) {
    if (!hasOutcomes) return null;
    const graded = subjectOutcomes.filter(lo => store.outcomeGrades?.[studentId]?.[lo.id]?.[term]?.grade).length;
    return { graded, total: subjectOutcomes.length };
  }

  async function setStrandGrade(studentId, outcomeId, term, gradeValue) {
    updateStore(s => {
      const og = JSON.parse(JSON.stringify(s.outcomeGrades || {}));
      if (!og[studentId]) og[studentId] = {};
      if (!og[studentId][outcomeId]) og[studentId][outcomeId] = {};
      if (!og[studentId][outcomeId][term]) og[studentId][outcomeId][term] = {};
      og[studentId][outcomeId][term].grade = gradeValue;
      return { ...s, outcomeGrades: og };
    });
    const { error } = await supabase.from('outcome_grades').upsert({
      student_id: studentId, outcome_id: outcomeId, term,
      grade_value: gradeValue, updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,outcome_id,term' });
    if (error) console.error("Outcome grade error:", error);
  }

  async function setOutcomeReflection(studentId, outcomeId, term, reflection) {
    updateStore(s => {
      const og = JSON.parse(JSON.stringify(s.outcomeGrades || {}));
      if (!og[studentId]) og[studentId] = {};
      if (!og[studentId][outcomeId]) og[studentId][outcomeId] = {};
      if (!og[studentId][outcomeId][term]) og[studentId][outcomeId][term] = {};
      og[studentId][outcomeId][term].reflection = reflection;
      return { ...s, outcomeGrades: og };
    });
    await supabase.from('outcome_grades').upsert({
      student_id: studentId, outcome_id: outcomeId, term,
      reflection, updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,outcome_id,term' });
  }

  async function setGradeForStudent(studentId, subject, term, field, value) {
    updateStore(s => {
      const grades = JSON.parse(JSON.stringify(s.grades || {}));
      if (!grades[studentId]) grades[studentId] = {};
      if (!grades[studentId][subject]) grades[studentId][subject] = {};
      if (!grades[studentId][subject][term]) grades[studentId][subject][term] = {};
      grades[studentId][subject][term][field] = value;
      return { ...s, grades };
    });
    const existing = store.grades?.[studentId]?.[subject]?.[term] || {};
    const { error } = await supabase.from('grades').upsert({
      student_id: studentId, subject, term,
      grade_value: field === "grade" ? value : (existing.grade || null),
      score: field === "score" ? Number(value) : (existing.score || null),
      comment: field === "comment" ? value : (existing.comment || null),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,subject,term' });
    if (error) console.error("Grade save error:", error);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>Grade Entry</h1>
        <p style={{ color:COLORS.text2, fontSize:14 }}>Active Term: <strong>{term}</strong></p>
      </div>

      {/* Assignment selector */}
      {assignments.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 0", color:COLORS.text3 }}>No subject assignments. Contact the administrator.</div>
      )}

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        {assignments.map((a, i) => {
          const isActive = selectedAssign === a;
          const totalStudents = store.students.filter(s =>
            s.curriculum === teacher.curriculum && s.grade === a.grade &&
            (a.stream ? s.stream === a.stream : true)
          ).length;
          return (
            <button key={a.id || i} onClick={() => { setSelectedAssign(isActive ? null : a); setCurrentStudentIdx(0); }}
              style={{ padding:"10px 16px", borderRadius:10, border:`2px solid ${isActive ? COLORS.teal : COLORS.border}`, background:isActive ? COLORS.tealL : "#fff", fontWeight:600, fontSize:13, cursor:"pointer", transition:"all 0.15s", textAlign:"left" }}>
              <div style={{ color:isActive ? COLORS.teal2 : COLORS.text }}>{a.grade}{a.stream ? ` (${a.stream})` : ""}</div>
              <div style={{ fontSize:11, color:isActive ? COLORS.teal : COLORS.text3, marginTop:2 }}>{a.subject} · {totalStudents} students</div>
            </button>
          );
        })}
      </div>

      {selectedAssign && (
        <div className="fade-in">
          {/* Subject banner */}
          <div style={{ background:`linear-gradient(135deg, ${COLORS.teal}, ${COLORS.teal2})`, borderRadius:12, padding:"16px 22px", color:"#fff", marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:18 }}>{selectedAssign.subject}</div>
            <div style={{ fontSize:12, opacity:.8, marginTop:2 }}>{selectedAssign.grade}{selectedAssign.stream ? ` · ${selectedAssign.stream}` : ""} · {teacher.curriculum} · {term}</div>
          </div>

          {/* Student tabs */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
            {studentsForAssign.map((s, i) => {
              const prog = getStudentProgress(s.id);
              const isDone = prog && prog.graded === prog.total && prog.total > 0;
              const isCurrent = i === currentStudentIdx;
              return (
                <button key={s.id} onClick={() => setCurrentStudentIdx(i)}
                  style={{ padding:"6px 14px", borderRadius:8, border:`2px solid ${isCurrent ? COLORS.teal : isDone ? COLORS.emerald || "#10b981" : COLORS.border}`, background:isCurrent ? COLORS.tealL : isDone ? (COLORS.emeraldL || "#d1fae5") : "#fff", fontWeight:600, fontSize:12, cursor:"pointer", transition:"all 0.15s", color:isCurrent ? COLORS.teal2 : isDone ? "#059669" : COLORS.text2 }}>
                  {s.name.split(" ")[0]} {isDone ? "✓" : ""}
                </button>
              );
            })}
          </div>

          {studentsForAssign.length === 0 && (
            <div style={{ textAlign:"center", padding:32, color:COLORS.text3 }}>No students in this class/stream.</div>
          )}

          {currentStudent && (
            <div className="fade-in">
              {/* Student card header */}
              <div style={{ ...card(), padding:"16px 20px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:18 }}>
                    {currentStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16 }}>{currentStudent.name}</div>
                    <div style={{ fontSize:12, color:COLORS.text2 }}>Adm: {currentStudent.admNo || currentStudent.adm_no} · Student {currentStudentIdx + 1} of {studentsForAssign.length}</div>
                  </div>
                </div>
                {hasOutcomes && (() => {
                  const prog = getStudentProgress(currentStudent.id);
                  const pct = prog ? Math.round(prog.graded / prog.total * 100) : 0;
                  return (
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:pct===100?"#059669":COLORS.teal }}>{prog?.graded}/{prog?.total} outcomes</div>
                      <div style={{ width:80, height:6, background:COLORS.border, borderRadius:3, marginTop:4, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:pct===100?"#10b981":COLORS.teal, borderRadius:3, transition:"width 0.3s" }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* CBC with outcomes */}
              {teacher.curriculum === "CBC" && hasOutcomes && (
                <div style={{ ...card(), overflow:"hidden", marginBottom:14 }}>
                  {subjectStrands.map(strand => {
                    const strandSubs = subjectSubStrands.filter(ss => ss.strand_id === strand.id);
                    return (
                      <div key={strand.id}>
                        <div style={{ padding:"9px 16px", background:COLORS.teal3, color:"#fff", fontSize:12, fontWeight:700 }}>{strand.name}</div>
                        {strandSubs.map(ss => {
                          const ssOutcomes = subjectOutcomes.filter(lo => lo.sub_strand_id === ss.id);
                          return (
                            <div key={ss.id}>
                              <div style={{ padding:"6px 16px 5px 24px", background:"#1e293b", color:"#94a3b8", fontSize:11, fontWeight:600, fontStyle:"italic" }}>{ss.name}</div>
                              {ssOutcomes.map((lo, loi) => {
                                const og = store.outcomeGrades?.[currentStudent.id]?.[lo.id]?.[term];
                                const currentGrade = og?.grade || "";
                                return (
                                  <div key={lo.id} style={{ padding:"10px 16px 10px 32px", borderBottom:`1px solid ${COLORS.border}`, background:"#fff" }}>
                                    <div style={{ fontSize:12, color:COLORS.text, marginBottom:8, lineHeight:1.5 }}>
                                      <span style={{ fontSize:10, color:COLORS.text3, fontWeight:600, marginRight:6 }}>{loi + 1}.</span>
                                      {lo.name}
                                    </div>
                                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                      <div style={{ display:"flex", gap:6 }}>
                                        {CBC_GRADES_STR.map(g => (
                                          <button key={g} onClick={() => setStrandGrade(currentStudent.id, lo.id, term, g)}
                                            style={{ padding:"5px 12px", borderRadius:8, border:`2px solid ${currentGrade===g ? CBC_GRADE_COLORS[g] : COLORS.border}`, background:currentGrade===g ? CBC_GRADE_COLORS[g] : "#fff", color:currentGrade===g ? "#fff" : COLORS.text2, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                                            {g}
                                          </button>
                                        ))}
                                      </div>
                                      <input style={{ ...input(), flex:1, minWidth:180, fontSize:12, padding:"5px 10px" }}
                                        placeholder="Reflection (optional)…"
                                        value={og?.reflection || ""}
                                        onChange={e => setOutcomeReflection(currentStudent.id, lo.id, term, e.target.value)} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CBC without outcomes — simple grade */}
              {teacher.curriculum === "CBC" && !hasOutcomes && (
                <div style={{ ...card(), padding:"16px 20px", marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:COLORS.text2 }}>Overall Grade</div>
                  <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                    {CBC_GRADES_STR.map(g => {
                      const gradeData = store.grades?.[currentStudent.id]?.[selectedAssign.subject]?.[term] || {};
                      const current = gradeData.grade || "";
                      return (
                        <button key={g} onClick={() => setGradeForStudent(currentStudent.id, selectedAssign.subject, term, "grade", g)}
                          style={{ flex:1, padding:"12px 0", borderRadius:10, border:`2px solid ${current===g ? CBC_GRADE_COLORS[g] : COLORS.border}`, background:current===g ? CBC_GRADE_COLORS[g] : "#fff", color:current===g ? "#fff" : COLORS.text2, fontSize:14, fontWeight:800, cursor:"pointer", transition:"all 0.15s" }}>
                          <div>{g}</div>
                          <div style={{ fontSize:9, fontWeight:500, marginTop:2, opacity:.8 }}>{CBC_GRADE_LABELS[g]}</div>
                        </button>
                      );
                    })}
                  </div>
                  <input style={{ ...input(), fontSize:13 }} placeholder="Teacher comment…"
                    value={store.grades?.[currentStudent.id]?.[selectedAssign.subject]?.[term]?.comment || ""}
                    onChange={e => setGradeForStudent(currentStudent.id, selectedAssign.subject, term, "comment", e.target.value)} />
                </div>
              )}

              {/* Cambridge */}
              {teacher.curriculum === "Cambridge" && (
                <CambridgeExamEntry
                  store={store}
                  student={currentStudent}
                  subject={selectedAssign.subject}
                  term={term}
                  isCheckpoint={isCheckpoint}
                  examConfig={store.examConfig || ["Mid Term", "End Term"]}
                  onGrade={setGradeForStudent}
                />
              )}

              {/* Save & Next / Previous navigation */}
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <button onClick={() => setCurrentStudentIdx(i => Math.max(0, i - 1))} disabled={currentStudentIdx === 0}
                  style={{ ...btn("ghost"), opacity:currentStudentIdx===0?0.4:1 }}>← Previous</button>
                <div style={{ flex:1, textAlign:"center", fontSize:12, color:COLORS.text3 }}>
                  {currentStudentIdx + 1} of {studentsForAssign.length} students
                </div>
                {currentStudentIdx < studentsForAssign.length - 1 ? (
                  <button onClick={() => setCurrentStudentIdx(i => i + 1)} style={btn("primary")}>Save & Next →</button>
                ) : (
                  <button style={btn("primary", { background:"#10b981" })}>All Done ✓</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Teacher Home Class — read-only aggregated grid
function TeacherHomeClass({ store, updateStore, teacher, supabase }) {
  const [liveGrades, setLiveGrades] = useState({});

  useEffect(() => {
    async function fetchGrades() {
      const homeStudents = store.students.filter(s =>
        s.grade === (teacher.homeClass || teacher.home_class) &&
        s.stream === (teacher.homeStream || teacher.home_stream) &&
        s.curriculum === teacher.curriculum
      );
      const studentIds = homeStudents.map(s => s.id);
      if (studentIds.length === 0) return;

      const { data: grades } = await supabase
        .from('grades')
        .select('*')
        .in('student_id', studentIds);

      if (grades) {
        const formatted = grades.reduce((acc, g) => {
          if (!acc[g.student_id]) acc[g.student_id] = {};
          if (!acc[g.student_id][g.subject]) acc[g.student_id][g.subject] = {};
          acc[g.student_id][g.subject][g.term] = {
            grade: g.grade_value,
            score: g.score,
            comment: g.comment,
          };
          return acc;
        }, {});
        setLiveGrades(formatted);
      }
    }
    fetchGrades();
  }, []);
  const [selectedStudent, setSelectedStudent] = useState(null);

  if (!teacher.homeClass) {
    return <div style={{ padding:"40px 0", textAlign:"center", color:COLORS.text3 }}>No home class assigned. Contact the administrator.</div>;
  }

  const homeStudents = store.students.filter(s =>
    s.grade === teacher.homeClass &&
    s.stream === teacher.homeStream &&
    s.curriculum === teacher.curriculum
  );

  const classCfg = store.classes.find(c => c.curriculum === teacher.curriculum && c.grade === teacher.homeClass);
  const subjects = classCfg?.subjects || [];

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>Home Class</h1>
          <p style={{ color:COLORS.text2, fontSize:14 }}>{teacher.homeClass} {teacher.homeStream} · {homeStudents.length} students</p>
        </div>
      </div>

      <div style={{ background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, borderRadius:12, padding:"14px 20px", color:"#fff", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:18 }}>{teacher.homeClass} — {teacher.homeStream}</div>
        <div style={{ fontSize:12, opacity:.8 }}>Read-Only Master Grid · {store.currentTerm}</div>
      </div>

      <div style={{ ...card(), overflow:"auto", marginBottom:20 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:COLORS.bg }}>
              <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}`, position:"sticky", left:0, background:COLORS.bg }}>Student</th>
              {subjects.map(sub => (
                <th key={sub} style={{ padding:"8px 10px", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}`, whiteSpace:"nowrap", minWidth:80 }}>{sub}</th>
              ))}
              <th style={{ padding:"8px 12px", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {homeStudents.map(s => (
              <tr key={s.id} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                <td style={{ padding:"7px 12px", fontWeight:600, position:"sticky", left:0, background:"#fff", fontSize:12 }}>{s.name}</td>
                {subjects.map(sub => {
                  const g = liveGrades?.[s.id]?.[sub]?.[store.currentTerm];
                  return (
                    <td key={sub} style={{ padding:"7px 10px", textAlign:"center" }}>
                      {(() => {
                        const subStrands = store.strands ? store.strands.filter(st =>
                          st.curriculum === teacher.curriculum &&
                          st.grade === (teacher.homeClass || teacher.home_class) &&
                          st.subject === sub &&
                          st.term === store.currentTerm
                        ) : [];
                        if (subStrands.length > 0) {
                          return (
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {subStrands.map(strand => {
                                const sg = store.strandGrades?.[s.id]?.[strand.id]?.[store.currentTerm] || "";
                                return (
                                  <div key={strand.id} style={{ display:"flex", alignItems:"center", gap:4 }}>
                                    <span style={{ fontSize:10, color:COLORS.text3, flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:80 }}>{strand.name.split("—")[0].trim()}</span>
                                    {sg ? <span style={{ fontSize:10, fontWeight:700, color:CBC_GRADE_COLORS[sg]||COLORS.text3, minWidth:20 }}>{sg}</span> : <span style={{ fontSize:10, color:COLORS.text3 }}>—</span>}
                                  </div>
                                );
                              })}
                              {g?.comment && <div style={{ fontSize:10, color:COLORS.text2, fontStyle:"italic", marginTop:2 }}>{g.comment}</div>}
                            </div>
                          );
                        }
                        return g ? (
                          teacher.curriculum === "CBC"
                            ? <div>
                                <span style={{ fontWeight:700, color:CBC_GRADE_COLORS[g.grade]||COLORS.text3, fontSize:12 }}>{g.grade || "—"}</span>
                                {g.comment && <div style={{ fontSize:10, color:COLORS.text2, fontStyle:"italic", marginTop:2 }}>{g.comment}</div>}
                              </div>
                            : <div>
                                <span style={{ fontWeight:700, color:COLORS.teal, fontSize:12 }}>{g.grade || (g.score ? g.score+"%" : "—")}</span>
                                {g.comment && <div style={{ fontSize:10, color:COLORS.text2, fontStyle:"italic", marginTop:2 }}>{g.comment}</div>}
                              </div>
                        ) : <span style={{ color:COLORS.text3 }}>—</span>;
                      })()}
                    </td>
                  );
                })}
                <td style={{ padding:"7px 12px" }}>
                  <RemarksInput store={store} updateStore={updateStore} teacherId={teacher.id} studentId={s.id} term={store.currentTerm} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RemarksInput({ store, updateStore, teacherId, studentId, term }) {
  const val = store.remarks?.[teacherId]?.[studentId]?.[term] || "";
  function handleChange(e) {
    if (!updateStore) return;
    updateStore(s => {
      const remarks = JSON.parse(JSON.stringify(s.remarks || {}));
      if (!remarks[teacherId]) remarks[teacherId] = {};
      if (!remarks[teacherId][studentId]) remarks[teacherId][studentId] = {};
      remarks[teacherId][studentId][term] = e.target.value;
      return { ...s, remarks };
    });
  }
  if (!updateStore) return <span style={{ fontSize:11, color:COLORS.text2, fontStyle:"italic" }}>{val || "—"}</span>;
  return (
    <input style={{ ...input(), fontSize:11, padding:"4px 8px", minWidth:160 }} placeholder="Final remarks…" value={val} onChange={handleChange} />
  );
}

function TeacherProfile({ teacher }) {
  return (
    <div style={{ maxWidth:400 }}>
      <h1 style={{ fontSize:22, fontWeight:800, marginBottom:20 }}>My Profile</h1>
      <div style={{ ...card(), padding:"20px 24px" }}>
        <div style={{ width:60, height:60, borderRadius:"50%", background:`linear-gradient(135deg,${COLORS.teal},${COLORS.teal2})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"Sora", fontWeight:700, fontSize:24, marginBottom:16 }}>
          {teacher.name.charAt(0)}
        </div>
        <div style={{ marginBottom:8 }}><span style={{ fontWeight:700, color:COLORS.text2, fontSize:13 }}>Name: </span>{teacher.name}</div>
        <div style={{ marginBottom:8 }}><span style={{ fontWeight:700, color:COLORS.text2, fontSize:13 }}>Email: </span>{teacher.email}</div>
        {teacher.phone && <div style={{ marginBottom:8 }}><span style={{ fontWeight:700, color:COLORS.text2, fontSize:13 }}>Phone: </span>{teacher.phone}</div>}
        {teacher.homeClass && <div style={{ marginBottom:8 }}><span style={{ fontWeight:700, color:COLORS.text2, fontSize:13 }}>Home Class: </span>{teacher.homeClass} {teacher.homeStream}</div>}
        <div style={{ marginBottom:8 }}><span style={{ fontWeight:700, color:COLORS.text2, fontSize:13 }}>Curriculum: </span><CurriculumBadge curriculum={teacher.curriculum} /></div>
        {teacher.subjectAssignments.length > 0 && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontWeight:700, color:COLORS.text2, fontSize:13, marginBottom:6 }}>Subject Assignments:</div>
            {teacher.subjectAssignments.map((a, i) => (
              <div key={i} style={{ fontSize:13, padding:"3px 0", borderBottom:`1px solid ${COLORS.border}` }}>{a.grade}{a.stream?` (${a.stream})`:""} — {a.subject}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PARENT APP ───────────────────────────────────────────────────────────────

function ParentApp({ store, updateStore, session, logout }) {
  const parent = store.parents.find(p => p.id === session.linkedId);
  const [selectedChildId, setSelectedChildId] = useState((parent?.childIds || parent?.child_ids)?.[0] || null);

  const children = parent ? (parent.childIds || parent.child_ids || []).map(id => store.students.find(s => s.id === id)).filter(Boolean) : [];
  const selectedChild = children.find(c => c.id === selectedChildId);

  function switchCurriculum(c) { updateStore({ activeCurriculum: c }); }

  if (!parent || children.length === 0) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <StyleTag />
        <div style={{ textAlign:"center", color:COLORS.text3 }}>
          <div style={{ fontSize:40 }}>👨‍👩‍👧</div>
          <div style={{ marginTop:8 }}>No children linked to your account. Contact the school admin.</div>
          <button style={{ ...btn("ghost"), marginTop:16 }} onClick={logout}>Log out</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      <StyleTag />
      <TopBar store={store} session={session} logout={logout} onCurriculumSwitch={switchCurriculum} />
      <div style={{ flex:1, padding:24, maxWidth:900, margin:"0 auto", width:"100%" }}>
        {children.length > 1 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:13, color:COLORS.text2, marginBottom:8 }}>Select Child:</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {children.map(c => (
                <button key={c.id} onClick={() => setSelectedChildId(c.id)} style={{ padding:"9px 18px", borderRadius:8, border:`2px solid ${selectedChildId===c.id?COLORS.teal:COLORS.border}`, background:selectedChildId===c.id?COLORS.tealL:"#fff", fontWeight:600, fontSize:13, cursor:"pointer" }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedChild && (
          <ParentChildView store={store} child={selectedChild} />
        )}
      </div>
    </div>
  );
}

function ParentChildView({ store, child }) {
  const [selectedTerm, setSelectedTerm] = useState(store.currentTerm);

  const classCfg = store.classes.find(c => c.curriculum === child.curriculum && c.grade === child.grade);
  const subjects = classCfg?.subjects || [];
  const terms = ["Term 1", "Term 2", "Term 3"];
  const isCheckpoint = CHECKPOINT_YEARS.includes(child.grade);

  const subjectColors = [
    { bg:"#ccfbf1", fg:COLORS.teal2, border:COLORS.tealL2 },
    { bg:"#fef3c7", fg:COLORS.amber2, border:"#fcd34d" },
    { bg:"#fde8e8", fg:COLORS.coral2, border:COLORS.coral },
    { bg:"#dbeafe", fg:"#1d4ed8", border:"#93c5fd" },
    { bg:"#d1fae5", fg:"#059669", border:"#6ee7b7" },
    { bg:"#ede9fe", fg:"#7c3aed", border:"#c4b5fd" },
    { bg:"#fff7ed", fg:COLORS.amber, border:"#fed7aa" },
    { bg:"#f0f9ff", fg:"#0284c7", border:"#7dd3fc" },
    { bg:"#fdf4ff", fg:"#a21caf", border:"#e879f9" },
    { bg:"#f0fdf4", fg:"#15803d", border:"#86efac" },
  ];

  function getGrade(sub, term) {
    return store.grades?.[child.id]?.[sub]?.[term];
  }

  function getStrands(sub, term) {
    return (store.strands || []).filter(st =>
      st.curriculum === child.curriculum &&
      st.grade === child.grade &&
      st.subject === sub &&
      st.term === term
    );
  }

  function getSubStrands(strandId) {
    return (store.subStrands || []).filter(ss => ss.strand_id === strandId).sort((a, b) => a.sort_order - b.sort_order);
  }

  function getOutcomes(subStrandId) {
    return (store.learningOutcomes || []).filter(lo => lo.sub_strand_id === subStrandId).sort((a, b) => a.sort_order - b.sort_order);
  }

  function getOutcomeGrade(outcomeId, term) {
    return store.outcomeGrades?.[child.id]?.[outcomeId]?.[term];
  }

  function GradePill({ grade, size="sm" }) {
    if (!grade) return <span style={{ fontSize:size==="sm"?10:12, color:COLORS.text3 }}>—</span>;
    const colors = { EE:["#ccfbf1","#0f766e"], ME:["#dbeafe","#1d4ed8"], AE:["#fef3c7","#b45309"], BE:["#fee2e2","#b91c1c"] };
    const [bg, fg] = colors[grade] || ["#f1f5f9","#64748b"];
    return <span style={{ fontSize:size==="sm"?10:12, fontWeight:800, padding:size==="sm"?"1px 7px":"3px 10px", borderRadius:20, background:bg, color:fg }}>{grade}</span>;
  }

  // Overall trend
  function getTrend(sub) {
    const gradeOrder = { EE:4, ME:3, AE:2, BE:1 };
    const values = terms.map(t => {
      const strands = getStrands(sub, t);
      if (strands.length > 0) {
        const allOutcomes = strands.flatMap(st => getSubStrands(st.id).flatMap(ss => getOutcomes(ss.id)));
        const grades = allOutcomes.map(lo => getOutcomeGrade(lo.id, t)?.grade).filter(Boolean);
        if (grades.length === 0) return null;
        return grades.reduce((acc, g) => acc + (gradeOrder[g] || 0), 0) / grades.length;
      }
      const g = getGrade(sub, t);
      return g?.grade ? gradeOrder[g.grade] : null;
    }).filter(v => v !== null);
    if (values.length < 2) return null;
    const diff = values[values.length-1] - values[values.length-2];
    if (diff > 0) return { label:"Improving", color:"#059669", icon:"↑" };
    if (diff < 0) return { label:"Needs attention", color:COLORS.coral, icon:"↓" };
    return { label:"Steady", color:COLORS.amber, icon:"→" };
  }

  return (
    <div className="fade-in">
      {/* Child header */}
      <div style={{ background:`linear-gradient(135deg, ${COLORS.teal3}, #1a5276)`, borderRadius:16, padding:"22px 28px", color:"#fff", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:24 }}>
            {child.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:22, letterSpacing:-0.5 }}>{child.name}</div>
            <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>{child.grade} · {child.stream} · <CurriculumBadge curriculum={child.curriculum} /></div>
            <div style={{ fontSize:11, opacity:.65, marginTop:2 }}>Adm: {child.admNo || child.adm_no}</div>
          </div>
          <div style={{ marginLeft:"auto", textAlign:"right" }}>
            <div style={{ fontSize:11, opacity:.7 }}>Academic Year</div>
            <div style={{ fontWeight:800, fontSize:18 }}>{store.currentYear}</div>
          </div>
        </div>
      </div>

      {/* Term selector */}
      <div style={{ display:"flex", gap:6, marginBottom:20 }}>
        {terms.map(t => (
          <button key={t} onClick={() => setSelectedTerm(t)}
            style={{ flex:1, padding:"10px 0", borderRadius:10, border:`2px solid ${selectedTerm===t ? COLORS.teal : COLORS.border}`, background:selectedTerm===t ? COLORS.tealL : "#fff", fontWeight:700, fontSize:13, cursor:"pointer", color:selectedTerm===t ? COLORS.teal2 : COLORS.text2, transition:"all 0.15s", textAlign:"center" }}>
            {t}
            {t === store.currentTerm && <div style={{ fontSize:9, color:COLORS.teal, fontWeight:500 }}>Current</div>}
          </button>
        ))}
      </div>

      {/* Subject cards grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14, marginBottom:20 }}>
        {subjects.map((sub, si) => {
          const col = subjectColors[si % subjectColors.length];
          const strands = getStrands(sub, selectedTerm);
          const hasStrands = strands.length > 0;
          const g = getGrade(sub, selectedTerm);
          const trend = getTrend(sub);

          return (
            <div key={sub} style={{ background:"#fff", borderRadius:12, border:`1.5px solid ${col.border}`, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Subject header */}
              <div style={{ background:col.bg, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontWeight:700, fontSize:13, color:col.fg }}>{sub}</div>
                {trend && (
                  <span style={{ fontSize:11, fontWeight:700, color:trend.color, background:"#fff", padding:"1px 8px", borderRadius:20 }}>
                    {trend.icon} {trend.label}
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding:"10px 14px" }}>
                {hasStrands ? (
                  strands.map(strand => {
                    const subs = getSubStrands(strand.id);
                    return (
                      <div key={strand.id} style={{ marginBottom:8 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:col.fg, marginBottom:4, textTransform:"uppercase", letterSpacing:0.3 }}>{strand.name}</div>
                        {subs.map(ss => {
                          const outcomes = getOutcomes(ss.id);
                          return (
                            <div key={ss.id} style={{ marginBottom:6 }}>
                              <div style={{ fontSize:10, color:COLORS.text3, fontStyle:"italic", marginBottom:3 }}>{ss.name}</div>
                              {outcomes.map(lo => {
                                const og = getOutcomeGrade(lo.id, selectedTerm);
                                return (
                                  <div key={lo.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid #f8fafc` }}>
                                    <span style={{ fontSize:11, color:COLORS.text, flex:1, paddingRight:8, lineHeight:1.4 }}>{lo.name}</span>
                                    <GradePill grade={og?.grade} />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                        {g?.comment && <div style={{ fontSize:10, color:COLORS.text3, fontStyle:"italic", marginTop:4 }}>{g.comment}</div>}
                      </div>
                    );
                  })
                ) : g ? (
                  <div>
                    {child.curriculum === "CBC" ? (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <GradePill grade={g.grade} size="lg" />
                        {g.grade && <span style={{ fontSize:11, color:COLORS.text2 }}>{CBC_GRADE_LABELS[g.grade]}</span>}
                      </div>
                    ) : isCheckpoint ? (
                      <div>
                        {(store.examConfig || ["Mid Term","End Term"]).map(exam => {
                          const ek = `${selectedTerm}__${exam}`;
                          const eg = store.grades?.[child.id]?.[sub]?.[ek];
                          return (
                            <div key={exam} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"3px 0", borderBottom:`1px solid ${COLORS.border}` }}>
                              <span style={{ fontSize:11, color:COLORS.text2 }}>{exam}</span>
                              <span style={{ fontWeight:800, fontSize:12, color:eg?.score?COLORS.teal2:COLORS.text3 }}>
                                {eg?.score ? `${eg.score}/50` : "—"}
                                {eg?.score && <CheckpointBand score={Number(eg.score)} />}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        {(store.examConfig || ["Mid Term","End Term"]).map(exam => {
                          const ek = `${selectedTerm}__${exam}`;
                          const eg = store.grades?.[child.id]?.[sub]?.[ek];
                          const isEndTerm = exam === "End Term";
                          return (
                            <div key={exam} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${COLORS.border}`, background:isEndTerm?"rgba(204,251,241,0.2)":"transparent" }}>
                              <span style={{ fontSize:11, color:COLORS.text2, fontWeight:isEndTerm?700:400 }}>{exam}{isEndTerm && " ★"}</span>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                {eg?.grade && <span style={{ fontWeight:800, fontSize:12, color:COLORS.teal2 }}>{eg.grade}</span>}
                                {eg?.score && <span style={{ fontSize:11, color:COLORS.text3 }}>{eg.score}%</span>}
                                {!eg?.grade && !eg?.score && <span style={{ fontSize:11, color:COLORS.text3 }}>—</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {g.comment && <div style={{ fontSize:11, color:COLORS.text3, fontStyle:"italic", marginTop:6 }}>{g.comment}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:COLORS.text3, padding:"8px 0" }}>No grades entered yet for {selectedTerm}.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Term comparison summary */}
      <div style={{ ...card(), overflow:"auto" }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${COLORS.border}` }}>
          <div style={{ fontWeight:700, fontSize:14 }}>Term Comparison</div>
          <div style={{ fontSize:12, color:COLORS.text2, marginTop:2 }}>See progress across all three terms</div>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr style={{ background:COLORS.bg }}>
              <th style={{ padding:"9px 14px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>Subject</th>
              {terms.map(t => (
                <th key={t} style={{ padding:"9px 14px", textAlign:"center", fontWeight:700, color:t===store.currentTerm?COLORS.teal:COLORS.text2, borderBottom:`1px solid ${COLORS.border}`, background:t===store.currentTerm?"rgba(204,251,241,0.2)":"transparent" }}>
                  {t}{t===store.currentTerm && <span style={{ fontSize:9, display:"block", color:COLORS.teal }}>Current</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map(sub => (
              <tr key={sub} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                <td style={{ padding:"9px 14px", fontWeight:600 }}>{sub}</td>
                {terms.map(t => {
                  const strands = getStrands(sub, t);
                  if (strands.length > 0) {
                    const allOutcomes = strands.flatMap(st => getSubStrands(st.id).flatMap(ss => getOutcomes(ss.id)));
                    const grades = allOutcomes.map(lo => getOutcomeGrade(lo.id, t)?.grade).filter(Boolean);
                    const counts = { EE:0, ME:0, AE:0, BE:0 };
                    grades.forEach(g => { if (counts[g] !== undefined) counts[g]++; });
                    return (
                      <td key={t} style={{ padding:"9px 14px", textAlign:"center", background:t===store.currentTerm?"rgba(204,251,241,0.1)":"transparent" }}>
                        <div style={{ display:"flex", gap:3, justifyContent:"center", flexWrap:"wrap" }}>
                          {Object.entries(counts).filter(([,v])=>v>0).map(([g,v]) => (
                            <span key={g} style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:g==="EE"?"#ccfbf1":g==="ME"?"#dbeafe":g==="AE"?"#fef3c7":"#fee2e2", color:g==="EE"?"#0f766e":g==="ME"?"#1d4ed8":g==="AE"?"#b45309":"#b91c1c" }}>{g}×{v}</span>
                          ))}
                          {grades.length === 0 && <span style={{ color:COLORS.text3 }}>—</span>}
                        </div>
                      </td>
                    );
                  }
                  const g = getGrade(sub, t);
                  return (
                    <td key={t} style={{ padding:"9px 14px", textAlign:"center", background:t===store.currentTerm?"rgba(204,251,241,0.1)":"transparent" }}>
                      {g ? <GradePill grade={g.grade} /> : <span style={{ color:COLORS.text3 }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  function GradePill({ grade, size="sm" }) {
    if (!grade) return <span style={{ fontSize:size==="sm"?10:12, color:COLORS.text3 }}>—</span>;
    const colors = { EE:["#ccfbf1","#0f766e"], ME:["#dbeafe","#1d4ed8"], AE:["#fef3c7","#b45309"], BE:["#fee2e2","#b91c1c"] };
    const [bg, fg] = colors[grade] || ["#f1f5f9","#64748b"];
    return <span style={{ fontSize:size==="sm"?10:12, fontWeight:800, padding:size==="sm"?"1px 7px":"3px 10px", borderRadius:20, background:bg, color:fg }}>{grade}</span>;
  }
}

// ─── REPORT CARD VIEW (Admin) ─────────────────────────────────────────────────

function ReportCardView({ store, student, curriculum }) {
  const classCfg = store.classes.find(c => c.curriculum === curriculum && c.grade === student.grade);
  const subjects = classCfg?.subjects || [];
  const terms = ["Term 1","Term 2","Term 3"];
  const isCheckpoint = CHECKPOINT_YEARS.includes(student.grade);

  return (
    <div className="fade-in" style={{ ...card(), overflow:"hidden" }}>
      <div style={{ background:`linear-gradient(135deg,${COLORS.teal3},#1a5276)`, padding:"18px 24px", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontFamily:"Sora", fontSize:20, fontWeight:800 }}>{store.schoolName}</div>
            <div style={{ fontSize:12, opacity:.8 }}>Academic Report Card · {store.currentYear}</div>
          </div>
          <CurriculumBadge curriculum={curriculum} />
        </div>
        <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {[["Name", student.name], ["Adm No", student.admNo], ["Grade", `${student.grade} · ${student.stream}`]].map(([l,v]) => (
            <div key={l}><div style={{ fontSize:10, opacity:.7 }}>{l}</div><div style={{ fontWeight:700, fontSize:14 }}>{v}</div></div>
          ))}
        </div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:COLORS.bg }}>
              <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>Subject</th>
              {terms.map(t => <th key={t} style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:COLORS.text2, borderBottom:`1px solid ${COLORS.border}` }}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map(sub => (
              <tr key={sub} style={{ borderBottom:`1px solid ${COLORS.border}` }}>
                <td style={{ padding:"9px 14px", fontWeight:600 }}>{sub}</td>
                {terms.map(t => {
                  const g = store.grades?.[student.id]?.[sub]?.[t];
                  return (
                    <td key={t} style={{ padding:"9px 14px", textAlign:"center" }}>
                      {g ? (
                        curriculum === "CBC"
                          ? <span style={{ fontWeight:800, color:CBC_GRADE_COLORS[g.grade]||COLORS.text }}>{g.grade||"—"}</span>
                          : isCheckpoint
                            ? <span style={{ fontWeight:800, color:COLORS.teal2 }}>{g.score||"—"}/50</span>
                            : <span style={{ fontWeight:800, color:COLORS.teal2 }}>{g.grade||"—"}{g.score?` (${g.score}%)`:""}</span>
                      ) : <span style={{ color:COLORS.text3 }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}