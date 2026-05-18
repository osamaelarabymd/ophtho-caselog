const SUPABASE_URL = 'https://wvopihnkbdbasykvtkxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2b3BpaG5rYmRiYXN5a3Z0a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODM4NjUsImV4cCI6MjA5Mzk1OTg2NX0.zpdRwihfqdBaFwEInE5gE034SD7rGaSNB8HIXFXOHfs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let allCases        = [];
let monthlyChart    = null;
let roleChart       = null;
let dayChart        = null;
let roleDashChart   = null;
let complexityChart = null;
let currentUserRole = 'resident';

const acgme = {
    'Cataract / Phaco':         86,
    'Vitreoretinal (PPV)':      25,
    'Glaucoma':                 25,
    'Cornea / Keratoplasty':    35,
    'Oculoplastics':            20,
    'Strabismus':               26,
    'Laser (LIO / SLT / YAG)': 25
};

const procedureColors = {
    'Cataract / Phaco':         '#2563eb',
    'Vitreoretinal (PPV)':      '#7c3aed',
    'Glaucoma':                 '#16a34a',
    'Cornea / Keratoplasty':    '#0891b2',
    'Oculoplastics':            '#d97706',
    'Strabismus':               '#dc2626',
    'Laser (LIO / SLT / YAG)': '#8C1515'
};

const roleColors = {
    'Primary Surgeon': '#16a34a',
    'Assistant':       '#2563eb',
    'Observer':        '#d97706'
};

const milestones = [
    { pct: 25,  emoji: '🌱', title: 'Great Start!',    text: "You've completed 25% of your ACGME requirements!",     badge: '25% Pioneer',  color: '#d97706' },
    { pct: 50,  emoji: '🔥', title: 'Halfway There!',  text: "Amazing! You're halfway through your ACGME goals!",    badge: '50% Achiever', color: '#2563eb' },
    { pct: 75,  emoji: '⭐', title: 'Almost There!',   text: "75% complete — you're in the home stretch!",           badge: '75% Champion', color: '#7c3aed' },
    { pct: 100, emoji: '🏆', title: 'ACGME Complete!', text: "Outstanding! You've completed ALL ACGME requirements!", badge: '100% Legend',  color: '#16a34a' }
];

// ── Annual Goals ──────────────────────────────────────────────────────────────
const GOALS_KEY = 'eyeGoals';
function getGoals() { return JSON.parse(localStorage.getItem(GOALS_KEY) || '{"cases":200,"journal":100,"study":50}'); }
function saveGoals() {
    let g = {
        cases:   parseInt(document.getElementById('goalCases').value)   || 200,
        journal: parseInt(document.getElementById('goalJournal').value) || 100,
        study:   parseInt(document.getElementById('goalStudy').value)   || 50
    };
    localStorage.setItem(GOALS_KEY, JSON.stringify(g));
    document.getElementById('goalsModal').style.display = 'none';
    renderGoalsWidget();
    showToast('Goals saved!');
}
function openGoalsModal() {
    let g = getGoals();
    document.getElementById('goalCases').value   = g.cases;
    document.getElementById('goalJournal').value = g.journal;
    document.getElementById('goalStudy').value   = g.study;
    document.getElementById('goalsModal').style.display = 'flex';
}
function renderGoalsWidget() {
    let el = document.getElementById('goalsWidget');
    if (!el) return;
    let g = getGoals();
    let today = new Date();
    let dayOfYear = Math.ceil((today - new Date(today.getFullYear(),0,1)) / 86400000);
    let studyItems = getStudyItems();
    let vals = {
        cases:   allCases.length,
        journal: getJournalEntries().length,
        study:   studyItems.filter(s=>s.status==='done').length
    };
    function bar(label, now, goal, color) {
        let pct = Math.min(100, goal ? Math.round(now/goal*100) : 0);
        let paceTarget = Math.round((goal/365)*dayOfYear);
        let diff = now - paceTarget;
        let paceLabel = diff >= 0 ? `+${diff} ahead of pace` : `${Math.abs(diff)} behind pace`;
        let paceColor = diff >= 0 ? '#16a34a' : '#ef4444';
        return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px">
                <span style="font-size:13px;font-weight:600;color:#0f172a">${label}</span>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:10px;font-weight:700;color:${paceColor}">${paceLabel}</span>
                    <span style="font-size:12px;color:#64748b;font-weight:500">${now}<span style="color:#cbd5e1"> / ${goal}</span></span>
                </div>
            </div>
            <div style="height:7px;background:#f1f5f9;border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:99px"></div>
            </div>
        </div>`;
    }
    el.innerHTML = `<div class="dash-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;font-size:14px;font-weight:700">My Annual Goals</h3>
            <button onclick="openGoalsModal()" style="width:auto;padding:5px 12px;margin:0;background:#f1f5f9;color:#374151;border-radius:9px;font-size:11px;font-weight:700;box-shadow:none;border:1px solid #e2e8f0">Edit</button>
        </div>
        ${bar('Cases Logged', vals.cases, g.cases, '#2563eb')}
        ${bar('Journal Entries', vals.journal, g.journal, '#7c3aed')}
        ${bar('Study Items Done', vals.study, g.study, '#16a34a')}
    </div>`;
}

// ── Global Search ─────────────────────────────────────────────────────────────
// ── Command Palette (⌘K) ──────────────────────────────────────────────────────
let _cpIndex = -1;
let _cpActions = []; // flat list of executable items currently shown

const _CP_COMMANDS = [
    // Navigate
    { section:'Navigate', label:'Dashboard',    sub:'Go to Dashboard',       icon:'#dbeafe', iconColor:'#2563eb', iconPath:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>', action:"showTab('dashboard',null);closeGlobalSearch()" },
    { section:'Navigate', label:'Log a Case',   sub:'Open case logging form', icon:'#dcfce7', iconColor:'#16a34a', iconPath:'<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>', action:"showTab('logCase',null);closeGlobalSearch()" },
    { section:'Navigate', label:'My Cases',     sub:'Browse case history',    icon:'#f3e8ff', iconColor:'#7c3aed', iconPath:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', action:"showTab('caseList',null);closeGlobalSearch()" },
    { section:'Navigate', label:'Journal',      sub:'Open journal workspace', icon:'#faf5ff', iconColor:'#7c3aed', iconPath:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"/>', action:"showTab('journal',null);showWorkspaceTab('journal');closeGlobalSearch()" },
    { section:'Navigate', label:'Notes',        sub:'Clinical pearls & notes',icon:'#ecfdf5', iconColor:'#059669', iconPath:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>', action:"showTab('journal',null);showWorkspaceTab('notes');closeGlobalSearch()" },
    { section:'Navigate', label:'Missions',     sub:'Calendar & daily missions',icon:'#fef9c3', iconColor:'#ca8a04', iconPath:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', action:"showTab('journal',null);showWorkspaceTab('calendar');closeGlobalSearch()" },
    { section:'Navigate', label:'Study',        sub:'QBank · OKAP scores · Didactics',icon:'#faf5ff', iconColor:'#7c3aed', iconPath:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', action:"showTab('journal',null);showWorkspaceTab('study');closeGlobalSearch()" },
    { section:'Navigate', label:'Reading List', sub:'Papers & resources tracker',icon:'#eff6ff', iconColor:'#2563eb', iconPath:'<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', action:"showTab('journal',null);showWorkspaceTab('reading');closeGlobalSearch()" },
    { section:'Navigate', label:'Duty Hours',   sub:'ACGME 80-hour compliance',icon:'#fef9c3', iconColor:'#d97706', iconPath:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', action:"showTab('journal',null);showWorkspaceTab('duty');closeGlobalSearch()" },
    { section:'Navigate', label:'Complications',sub:'Private intraop log',     icon:'#fef2f2', iconColor:'#dc2626', iconPath:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', action:"showTab('journal',null);showWorkspaceTab('compl');closeGlobalSearch()" },
    { section:'Navigate', label:'Wellness',     sub:'Wellbeing check-in tracker',icon:'#fdf4ff', iconColor:'#ec4899', iconPath:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>', action:"showTab('journal',null);showWorkspaceTab('wellness');closeGlobalSearch()" },
    { section:'Navigate', label:'Match',        sub:'Fellowship pipeline & rank list',icon:'#f0fdf4', iconColor:'#059669', iconPath:'<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', action:"showTab('journal',null);showWorkspaceTab('fellowship');closeGlobalSearch()" },
    { section:'Navigate', label:'Settings',     sub:'App settings',           icon:'#f1f5f9', iconColor:'#64748b', iconPath:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', action:"showTab('settings',null);closeGlobalSearch()" },
    // Create
    { section:'Create', label:'New Journal Entry',  sub:'Write a reflection',             icon:'#faf5ff', iconColor:'#7c3aed', iconPath:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"/>', action:"showTab('journal',null);showWorkspaceTab('journal');closeGlobalSearch();setTimeout(()=>openJournalModal(),100)" },
    { section:'Create', label:'Weekly Review',       sub:'Structured weekly reflection',    icon:'#fffbeb', iconColor:'#f59e0b', iconPath:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', action:"showTab('journal',null);showWorkspaceTab('journal');closeGlobalSearch();setTimeout(()=>{openJournalModal();setTimeout(()=>applyJournalTemplate('weekly'),80)},100)" },
    { section:'Create', label:'Add Mission',         sub:'Add to calendar / mission list',  icon:'#fef9c3', iconColor:'#ca8a04', iconPath:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', action:"showTab('journal',null);showWorkspaceTab('calendar');closeGlobalSearch();setTimeout(()=>openEventModal(),100)" },
    { section:'Create', label:'Add Note',            sub:'Quick clinical pearl',            icon:'#ecfdf5', iconColor:'#059669', iconPath:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', action:"showTab('journal',null);showWorkspaceTab('notes');closeGlobalSearch();setTimeout(()=>openNoteModal(),100)" },
    { section:'Create', label:'Add to Reading List', sub:'Add paper or resource',           icon:'#eff6ff', iconColor:'#2563eb', iconPath:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', action:"showTab('journal',null);showWorkspaceTab('reading');closeGlobalSearch();setTimeout(()=>openStudyModal(),100)" },
    { section:'Create', label:'Wellness Check-in',   sub:'Log how you\'re feeling today',   icon:'#fdf4ff', iconColor:'#ec4899', iconPath:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>', action:"showTab('journal',null);showWorkspaceTab('wellness');closeGlobalSearch();setTimeout(()=>openWellnessModal(),100)" },
];

function openGlobalSearch() {
    let modal = document.getElementById('globalSearchModal');
    if (!modal) return;
    modal.style.display = 'flex';
    let inp = document.getElementById('globalSearchInput');
    if (inp) { inp.value = ''; inp.focus(); }
    _cpIndex = -1;
    _cpActions = [];
    _renderCpDefaults();
}

// ── Help accordion toggle ─────────────────────────────────────────────────────
function toggleAcc(item) {
    let isOpen = item.classList.contains('open');
    // Close all siblings
    item.closest('.dash-card').querySelectorAll('.help-acc-item.open').forEach(el => el.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
}

// ── Procedure "Others" toggle ─────────────────────────────────────────────────
function toggleOtherProcedure(val) {
    let inp = document.getElementById('procedureOther');
    if (!inp) return;
    if (val === 'Others') {
        inp.style.display = 'block';
        inp.focus();
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
}

function closeGlobalSearch() {
    let modal = document.getElementById('globalSearchModal');
    if (modal) modal.style.display = 'none';
    _cpIndex = -1;
    _cpActions = [];
}

function cpKeyDown(e) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); _cpMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _cpMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); _cpExecute(); }
}

function _cpMove(dir) {
    let items = document.querySelectorAll('.cp-item');
    if (!items.length) return;
    items[_cpIndex]?.classList.remove('cp-active');
    _cpIndex = Math.max(0, Math.min(items.length - 1, _cpIndex + dir));
    items[_cpIndex]?.classList.add('cp-active');
    items[_cpIndex]?.scrollIntoView({ block: 'nearest' });
}

function _cpExecute() {
    let items = document.querySelectorAll('.cp-item');
    let active = _cpIndex >= 0 ? items[_cpIndex] : items[0];
    if (active) active.click();
}

function _cpItemHTML(icon, iconColor, iconPath, label, sub, action) {
    return `<div class="cp-item" onclick="${action.replace(/"/g,"'")}" onmouseenter="_cpHover(this)">
        <div class="cp-icon" style="background:${icon}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
        </div>
        <div class="cp-label">${label}</div>
        <div class="cp-sub">${sub}</div>
    </div>`;
}

function _cpHover(el) {
    document.querySelectorAll('.cp-item').forEach((x,i) => {
        x.classList.remove('cp-active');
        if (x === el) _cpIndex = i;
    });
    el.classList.add('cp-active');
}

function _renderCpDefaults() {
    let out = document.getElementById('globalSearchResults');
    if (!out) return;
    let sections = {};
    _CP_COMMANDS.forEach(cmd => {
        if (!sections[cmd.section]) sections[cmd.section] = [];
        sections[cmd.section].push(cmd);
    });
    // Recent cases
    let recent = allCases.slice(0,3);
    let html = '';
    if (recent.length) {
        html += `<div class="cp-section">Recent Cases</div>`;
        let pColors = {'Cataract / Phaco':'#2563eb','Vitreoretinal (PPV)':'#7c3aed','Glaucoma':'#059669','Cornea':'#0891b2','Strabismus':'#ea580c','Oculoplastics':'#d97706'};
        html += recent.map(c => _cpItemHTML('#f8fafc', pColors[c.procedure]||'#64748b', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', c.procedure||'Case', `${c.date||''} · ${c.role||''}`, `showTab('caseList',null);closeGlobalSearch()`)).join('');
        html += `<div class="cp-divider"></div>`;
    }
    for (let [section, cmds] of Object.entries(sections)) {
        html += `<div class="cp-section">${section}</div>`;
        html += cmds.map(cmd => _cpItemHTML(cmd.icon, cmd.iconColor, cmd.iconPath, cmd.label, cmd.sub, cmd.action)).join('');
        html += `<div class="cp-divider"></div>`;
    }
    out.innerHTML = html;
}

document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openGlobalSearch(); return; }
    if (e.key === 'Escape') closeGlobalSearch();
});
document.addEventListener('click', e => {
    let dd = document.getElementById('jLinkDropdown');
    let inp = document.getElementById('jLinkSearch');
    if (dd && inp && !dd.contains(e.target) && e.target !== inp) dd.style.display = 'none';
});

function runGlobalSearch() {
    let q   = (document.getElementById('globalSearchInput')?.value || '').trim().toLowerCase();
    let out = document.getElementById('globalSearchResults');
    if (!out) return;
    _cpIndex = -1;

    if (q.length < 1) { _renderCpDefaults(); return; }

    let html = '';
    const pColors = {'Cataract / Phaco':'#2563eb','Vitreoretinal (PPV)':'#7c3aed','Glaucoma':'#059669','Cornea':'#0891b2','Strabismus':'#ea580c','Oculoplastics':'#d97706'};

    // Filter commands
    let cmdHits = _CP_COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
    if (cmdHits.length) {
        html += `<div class="cp-section">Commands</div>`;
        html += cmdHits.map(cmd => _cpItemHTML(cmd.icon, cmd.iconColor, cmd.iconPath, cmd.label, cmd.sub, cmd.action)).join('');
        html += `<div class="cp-divider"></div>`;
    }

    // Cases
    let caseHits = allCases.filter(c =>
        (c.procedure||'').toLowerCase().includes(q) ||
        (c.attending||'').toLowerCase().includes(q)  ||
        (c.hospital||'').toLowerCase().includes(q)   ||
        (c.notes||'').toLowerCase().includes(q)
    ).slice(0, 5);
    if (caseHits.length) {
        html += `<div class="cp-section">Cases</div>`;
        html += caseHits.map(c => _cpItemHTML('#f8fafc', pColors[c.procedure]||'#64748b',
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
            c.procedure||'Case', `${c.date||''} · ${c.role||''} · ${c.attending||''}`,
            `showTab('caseList',null);closeGlobalSearch()`)).join('');
        html += `<div class="cp-divider"></div>`;
    }

    // Journal
    let jHits = getJournalEntries().filter(e =>
        (e.title||'').toLowerCase().includes(q) ||
        (e.body||'').replace(/<[^>]*>/g,' ').toLowerCase().includes(q)
    ).slice(0, 4);
    if (jHits.length) {
        html += `<div class="cp-section">Journal</div>`;
        html += jHits.map(e => _cpItemHTML('#faf5ff', '#7c3aed',
            '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"/>',
            e.title||'Untitled entry', `${e.date||''} · ${(e.body||'').replace(/<[^>]*>/g,' ').trim().slice(0,60)}`,
            `showTab('journal',null);showWorkspaceTab('journal');openJournalModal('${e.id}');closeGlobalSearch()`)).join('');
        html += `<div class="cp-divider"></div>`;
    }

    // Notes
    let nHits = getNotes().filter(n =>
        (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q)
    ).slice(0, 4);
    if (nHits.length) {
        html += `<div class="cp-section">Notes</div>`;
        html += nHits.map(n => _cpItemHTML('#ecfdf5', '#059669',
            '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
            n.title||'Untitled', n.tag||'Note',
            `showTab('journal',null);showWorkspaceTab('notes');closeGlobalSearch()`)).join('');
        html += `<div class="cp-divider"></div>`;
    }

    // Todos
    let priColor = { high:'#dc2626', medium:'#d97706', low:'#16a34a' };
    let tHits = getTodos().filter(t => (t.text||'').toLowerCase().includes(q)).slice(0, 4);
    if (tHits.length) {
        html += `<div class="cp-section">Tasks</div>`;
        html += tHits.map(t => _cpItemHTML('#fff7ed', priColor[t.priority]||'#64748b',
            '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
            t.text, `${t.priority} priority${t.due?' · due '+t.due:''}`,
            `showTab('journal',null);showWorkspaceTab('calendar');closeGlobalSearch()`)).join('');
        html += `<div class="cp-divider"></div>`;
    }

    // Study
    let stColor = { 'to-read':'#2563eb', 'reading':'#d97706', 'done':'#16a34a' };
    let sHits = getStudyItems().filter(s =>
        (s.topic||'').toLowerCase().includes(q) || (s.notes||'').toLowerCase().includes(q)
    ).slice(0, 4);
    if (sHits.length) {
        html += `<div class="cp-section">Reading List</div>`;
        html += sHits.map(s => _cpItemHTML('#eff6ff', stColor[s.status]||'#64748b',
            '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
            s.topic, `${s.type||''} · ${s.status||''}`,
            `showTab('journal',null);showWorkspaceTab('reading');closeGlobalSearch()`)).join('');
    }

    if (!html) {
        html = `<div style="text-align:center;padding:48px 20px">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p style="font-size:14px;font-weight:600;color:#64748b;margin:0 0 4px">No results for "<em>${q}</em>"</p>
            <p style="font-size:12px;color:#94a3b8;margin:0">Try a procedure name, journal title, or command</p>
        </div>`;
    }
    out.innerHTML = html;
}

function _srSection(label, items) {
    return `<div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">${label}</div>
        ${items.join('')}
    </div>`;
}

function _srItem(icon, title, sub, action, color) {
    return `<div onclick="${action}" style="display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:12px;margin-bottom:6px;cursor:pointer;border:1px solid #f1f5f9;transition:background 0.1s"
        onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <div style="width:36px;height:36px;background:${color}18;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
            <p style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</p>
            <p style="font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</p>
        </div>
        <span style="font-size:16px;color:#cbd5e1;flex-shrink:0">›</span>
    </div>`;
}

// ── Analytics Accordion ───────────────────────────────────────────────────────
let _accordionState = {};

function initAnalyticsAccordions() {
    let tab = document.getElementById('analyticsTab');
    if (!tab) return;
    let cards = tab.querySelectorAll('.dash-card');
    cards.forEach((card, i) => {
        let h3 = card.querySelector('h3');
        if (!h3 || card.dataset.accordion) return;
        card.dataset.accordion = 'true';
        let key = 'acc_' + i;
        // First 2 cards open by default, rest closed
        let open = _accordionState[key] !== undefined ? _accordionState[key] : (i < 2);

        // Wrap all children except h3 in a collapsible body
        let children = Array.from(card.children).filter(c => c !== h3);
        let body = document.createElement('div');
        body.className = 'acc-body';
        body.style.cssText = open ? '' : 'display:none';
        children.forEach(c => body.appendChild(c));
        card.appendChild(body);

        // Style the h3 as a toggle
        h3.style.cssText += ';cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:' + (open?'14px':'0');
        let chevron = document.createElement('span');
        chevron.className = 'acc-chevron';
        chevron.textContent = open ? '▾' : '▸';
        chevron.style.cssText = 'font-size:14px;color:#94a3b8;transition:transform 0.2s;margin-left:8px;flex-shrink:0';
        h3.appendChild(chevron);

        h3.onclick = () => {
            let isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            chevron.textContent = isOpen ? '▸' : '▾';
            h3.style.marginBottom = isOpen ? '0' : '14px';
            _accordionState[key] = !isOpen;
        };
    });
}

// Toast
function showToast(message, type = 'success') {
    let toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = type;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// Loading
function showLoading() { document.getElementById('loadingSpinner').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingSpinner').style.display = 'none'; }

// Milestones
function checkMilestones(percent) {
    let reached = JSON.parse(localStorage.getItem('milestonesReached')) || [];
    for (let m of milestones) {
        if (percent >= m.pct && !reached.includes(m.pct)) {
            reached.push(m.pct);
            localStorage.setItem('milestonesReached', JSON.stringify(reached));
            showMilestone(m);
            break;
        }
    }
}

function showMilestone(m) {
    document.getElementById('milestoneEmoji').textContent  = m.emoji;
    document.getElementById('milestoneTitle').textContent  = m.title;
    document.getElementById('milestoneText').textContent   = m.text;
    document.getElementById('milestoneBadge').textContent  = m.badge;
    document.getElementById('milestoneBadge').style.background = 'linear-gradient(135deg,' + m.color + ',#7c3aed)';
    document.getElementById('milestoneModal').style.display = 'flex';
    setTimeout(() => {
        if (typeof confetti !== 'undefined') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#2563eb','#8C1515','#16a34a','#d97706','#7c3aed'] });
        }
    }, 300);
}

function closeMilestone() {
    document.getElementById('milestoneModal').style.display = 'none';
}

// ── Per-Procedure Milestone Notifications ─────────────────────────────────────
function checkProcedureMilestones(cases) {
    let allProcs = getAllProcedures();
    let reached  = JSON.parse(localStorage.getItem('procMilestonesReached')) || {};
    const pcts   = [25, 50, 75, 100];

    for (let [proc, required] of Object.entries(allProcs)) {
        // Count Primary Surgeon cases for this procedure
        let done = cases.filter(c => c.procedure === proc && c.role === 'Primary Surgeon').length;
        let pct  = required > 0 ? Math.min(Math.round((done / required) * 100), 100) : 0;
        if (!reached[proc]) reached[proc] = [];

        for (let milestone of pcts) {
            if (pct >= milestone && !reached[proc].includes(milestone)) {
                reached[proc].push(milestone);
                localStorage.setItem('procMilestonesReached', JSON.stringify(reached));
                showProcedureMilestone(proc, milestone, done, required);
                return; // show one at a time
            }
        }
    }
}

function showProcedureMilestone(proc, pct, done, required) {
    let short = proc.split('/')[0].trim().split('(')[0].trim();
    let color = procedureColors[proc] || '#2563eb';
    let emoji = pct === 100 ? '🏆' : pct >= 75 ? '⭐' : pct >= 50 ? '🔥' : '🌱';
    let title = pct === 100 ? short + ' Complete!' : short + ': ' + pct + '% done';
    let text  = pct === 100
        ? 'Outstanding! You\'ve completed all ' + required + ' required ' + short + ' cases as Primary Surgeon!'
        : 'You\'ve reached ' + pct + '% of your ' + short + ' goal — ' + done + ' of ' + required + ' Primary Surgeon cases logged.';
    let badge = short + ' ' + pct + '%';
    showMilestone({ emoji, title, text, badge, color });
}

function updateAchievementBadges(percent) {
    let reached  = JSON.parse(localStorage.getItem('milestonesReached')) || [];
    let badgesEl = document.getElementById('achievementBadges');
    if (!badgesEl || reached.length === 0) return;
    let html = '';
    for (let m of milestones) {
        if (reached.includes(m.pct)) {
            html += `<div style="background:linear-gradient(135deg,${m.color},#7c3aed); color:white; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(0,0,0,0.15)">${m.emoji} ${m.badge}</div>`;
        }
    }
    badgesEl.innerHTML = html;
}

// Onboarding
function checkOnboarding() {
    if (!localStorage.getItem('onboardingSeen')) {
        document.getElementById('onboarding').style.display = 'flex';
    }
}

function nextSlide(num) {
    document.querySelectorAll('.onboard-slide').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('active-dot'));
    document.getElementById('slide' + num).style.display = 'block';
    document.getElementById('dot' + num).classList.add('active-dot');
}

function finishOnboarding() {
    localStorage.setItem('onboardingSeen', 'true');
    document.getElementById('onboarding').style.display = 'none';
}

// Welcome guide
function checkWelcomeGuide() {
    if (!localStorage.getItem('welcomeGuideSeen')) {
        setTimeout(() => {
            document.getElementById('welcomeGuide').style.display = 'flex';
        }, 1000);
    }
}

function closeWelcomeGuide() {
    localStorage.setItem('welcomeGuideSeen', 'true');
    document.getElementById('welcomeGuide').style.display = 'none';
    showTab('profile', null);
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    let profileBtn = document.querySelector('.tab-btn:nth-child(2)');
    if (profileBtn) profileBtn.classList.add('active-tab');
}

// Dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    let isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
    document.getElementById('darkBtn').textContent = isDark ? '☀️ Light' : '🌙 Dark';
}

function loadDarkMode() {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark');
        let btn = document.getElementById('darkBtn');
        if (btn) btn.textContent = '☀️ Light';
    }
}

window.addEventListener('load', function() {
    checkOnboarding();
    loadDarkMode();
});

// Streak
function updateStreak(cases) {
    if (cases.length === 0) return;
    let dates     = [...new Set(cases.map(c => c.date))].filter(Boolean).sort().reverse();
    let today     = getTodayStr();
    let yesterday = getYesterdayStr();
    if (dates[0] !== today && dates[0] !== yesterday) {
        localStorage.setItem('streak', 0);
        return;
    }
    let streak = 1;
    for (let i = 0; i < dates.length - 1; i++) {
        let diff = (new Date(dates[i]) - new Date(dates[i+1])) / 86400000;
        if (diff === 1) { streak++; } else { break; }
    }
    localStorage.setItem('streak', streak);
    let banner = document.getElementById('streakBanner');
    if (streak >= 2) {
        banner.style.display = 'block';
        banner.textContent = streak + ' day streak — keep logging!';
    } else {
        banner.style.display = 'none';
    }
}

// Profile
function _drName(profile) {
    // Returns "Dr. [preferred]" — falls back to first name, then generic
    if (profile.preferredName) return 'Dr. ' + profile.preferredName;
    if (profile.name) return 'Dr. ' + profile.name.split(' ')[0];
    return 'Dr. ___';
}

function saveProfile() {
    let pronounsVal = (document.getElementById('profilePronounsInput')?.value || '').trim();
    let profile = {
        name:          document.getElementById('profileNameInput').value,
        preferredName: (document.getElementById('profilePreferredName')?.value || '').trim(),
        pronouns:      pronounsVal,
        pgy:           document.getElementById('profilePgyInput').value,
        program:       document.getElementById('profileProgramInput').value,
        startYear:     document.getElementById('profileStartYear').value,
        endYear:       document.getElementById('profileEndYear').value,
        goals:         document.getElementById('profileGoals').value
    };
    if (!profile.preferredName && profile.name) profile.preferredName = profile.name.split(' ')[0];
    localStorage.setItem('userProfile', JSON.stringify(profile));
    localStorage.setItem('residentName', profile.name);
    updateProfileDisplay();
    updateSettingsAvatarPreview();
    showToast('✅ Profile saved!');
}

function loadProfile() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    let _set = (id, val) => { let el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    _set('profileNameInput',    profile.name || '');
    _set('profilePreferredName', profile.preferredName || (profile.name ? profile.name.split(' ')[0] : ''));
    _set('profilePgyInput',     profile.pgy || 'PGY-1');
    _set('profileProgramInput', profile.program || '');
    _set('profileStartYear',    profile.startYear || '');
    _set('profileEndYear',      profile.endYear || '');
    _set('profileGoals',        profile.goals || '');
    // Timezone
    let tzSel = document.getElementById('profileTimezone');
    if (tzSel) tzSel.value = localStorage.getItem('eyeTimezone') || '';
    updateTzPreview();
    // Pronouns
    let pron = profile.pronouns || '';
    _set('profilePronounsInput', pron);
    updatePronounLabels(pron);
    updateSettingsAvatarPreview();
    updateProfileDisplay();
}

// ── Timezone preference ───────────────────────────────────────────────────────
function saveTimezonePreference(tz) {
    if (tz) {
        localStorage.setItem('eyeTimezone', tz);
    } else {
        localStorage.removeItem('eyeTimezone');
    }
    updateTzPreview();
    showToast('🌐 Time zone saved!');
}

function updateTzPreview() {
    let el = document.getElementById('tzCurrentTime');
    if (!el) return;
    let tz = localStorage.getItem('eyeTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
        let now = new Date().toLocaleString('en-US', {
            timeZone: tz, weekday:'short', year:'numeric', month:'short', day:'numeric',
            hour:'numeric', minute:'2-digit', hour12:true
        });
        el.textContent = `🕐 Current time in ${tz.replace('_',' ')}: ${now}`;
    } catch(e) { el.textContent = ''; }
}

// Helper: get user's preferred timezone
function getUserTz() {
    return localStorage.getItem('eyeTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
// Helper: today as YYYY-MM-DD in user's timezone
function getTodayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: getUserTz() }); // en-CA = YYYY-MM-DD
}
// Helper: this month as YYYY-MM in user's timezone
function getThisMonthStr() {
    return getTodayStr().slice(0, 7);
}
// Helper: yesterday as YYYY-MM-DD in user's timezone
function getYesterdayStr() {
    let d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: getUserTz() });
}
// Helper: current hour (0-23) in user's timezone
function getNowHour() {
    return parseInt(new Date().toLocaleString('en-US', { timeZone: getUserTz(), hour: 'numeric', hour12: false }), 10);
}

// ── Pronouns radio helper ────────────────────────────────────────────────────
function updatePronounLabels(val) {
    if (val === undefined) val = (document.getElementById('profilePronounsInput')?.value || '').trim();
    let presets = { 'he/him': 'pron-lbl-him', 'she/her': 'pron-lbl-her', 'they/them': 'pron-lbl-they' };
    let isPreset = Object.keys(presets).includes(val);
    Object.entries(presets).forEach(([v, id]) => {
        let el = document.getElementById(id);
        if (!el) return;
        let active = v === val;
        el.style.borderColor = active ? '#2563eb' : '#E5E7EB';
        el.style.background  = active ? '#eff6ff'  : 'white';
        el.style.color       = active ? '#2563eb'  : '#374151';
        let radio = el.querySelector('input');
        if (radio) radio.checked = active;
    });
    let customEl = document.getElementById('pron-lbl-custom');
    if (customEl) {
        let customActive = !isPreset && val !== '';
        customEl.style.borderColor = customActive ? '#2563eb' : '#E5E7EB';
        customEl.style.background  = customActive ? '#eff6ff'  : 'white';
        customEl.style.color       = customActive ? '#2563eb'  : '#374151';
    }
}

// ── Profile picture ──────────────────────────────────────────────────────────
function handleProfilePic(input) {
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        localStorage.setItem('profilePicture', e.target.result);
        updateProfileDisplay();
        updateSettingsAvatarPreview();
        showToast('Photo updated!');
    };
    reader.readAsDataURL(file);
}

function removeProfilePic() {
    localStorage.removeItem('profilePicture');
    updateProfileDisplay();
    updateSettingsAvatarPreview();
    showToast('Photo removed');
}

function updateSettingsAvatarPreview() {
    let el = document.getElementById('settingsAvatarPreview');
    if (!el) return;
    let pic = localStorage.getItem('profilePicture');
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    if (pic) {
        el.innerHTML = `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:20px">`;
    } else {
        let parts = (profile.name || '').trim().split(' ');
        let initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : (parts[0]||'DR').slice(0,2).toUpperCase();
        el.style.background = 'linear-gradient(135deg,#2563eb,#7c3aed)';
        el.innerHTML = initials;
    }
}

function updateProfileDisplay() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    let pic     = localStorage.getItem('profilePicture');

    let nameEl = document.getElementById('profileName');
    let pgyEl  = document.getElementById('profilePgy');
    let progEl = document.getElementById('profileProgram');
    let pronEl = document.getElementById('profilePronouns');
    if (nameEl) nameEl.textContent = _drName(profile);
    if (pgyEl)  pgyEl.textContent  = profile.pgy || 'PGY-1';
    if (progEl) progEl.textContent = (profile.program || 'Ophthalmology Program') + ' — Ophthalmology';
    if (pronEl) pronEl.textContent = profile.pronouns ? '(' + profile.pronouns + ')' : '';

    // Avatar — photo or initials
    let avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
        if (pic) {
            avatarEl.innerHTML = `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:20px">`;
            avatarEl.style.background = 'none';
        } else {
            let parts = (profile.name || '').trim().split(' ');
            let initials = parts.length >= 2
                ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
                : (parts[0] || 'DR').slice(0,2).toUpperCase();
            avatarEl.innerHTML = initials;
            avatarEl.style.background = 'linear-gradient(135deg,#2563eb,#7c3aed)';
        }
    }

    // Goals
    let goalsEl = document.getElementById('profileGoalsDisplay');
    if (goalsEl) {
        goalsEl.innerHTML = profile.goals
            ? `<p style="color:#374151;font-size:13px;line-height:1.7;margin:0">${profile.goals}</p>`
            : `<p style="color:#9CA3AF;font-size:13px;font-style:italic;margin:0">No goals set — <button onclick="showTab('settings',event)" style="background:none;border:none;color:#2563eb;font-size:13px;font-weight:600;padding:0;margin:0;cursor:pointer;box-shadow:none;width:auto;min-width:0">add in Settings</button></p>`;
    }

    // Residency timeline
    if (profile.startYear && profile.endYear) {
        let now   = new Date().getFullYear();
        let total = Math.max(profile.endYear - profile.startYear, 1);
        let done  = now - profile.startYear;
        let pct   = Math.min(Math.max(Math.round((done / total) * 100), 0), 100);
        let statsEl = document.getElementById('profileStats');
        if (statsEl) {
            const _ps = (val, label, color, last) =>
                `<div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:14px 8px;gap:3px;${last?'':'border-right:1px solid #F3F4F6'}">
                    <span style="font-size:17px;font-weight:800;color:${color};letter-spacing:-0.5px">${val}</span>
                    <span style="font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.4px">${label}</span>
                </div>`;
            statsEl.style.display = 'flex';
            statsEl.innerHTML =
                _ps(profile.startYear, 'Started', '#2563eb') +
                _ps(profile.endYear,   'Ends',    '#7c3aed') +
                _ps(pct+'%', 'Done',   '#16a34a', true);
        }
    }

    let welcomeEl = document.getElementById('welcomeName');
    if (welcomeEl) welcomeEl.textContent = _drName(profile);
}

// Templates
function loadTemplates() {
    let templates = JSON.parse(localStorage.getItem('caseTemplates')) || [];
    let html = '';
    for (let i = 0; i < templates.length; i++) {
        html += '<button onclick="applyTemplate(' + i + ')" style="background:#f1f5f9; color:#1e293b; border:2px solid #e2e8f0; padding:8px 14px; font-size:12px; width:auto; margin:0; border-radius:8px">';
        html += templates[i].procedure + ' — ' + templates[i].role;
        html += ' <span onclick="deleteTemplate(event,' + i + ')" style="color:#dc2626; margin-left:6px">✕</span>';
        html += '</button>';
    }
    document.getElementById('templatesList').innerHTML = html || '<p style="color:#94a3b8; font-size:13px">No templates yet</p>';
}

function saveTemplate() {
    let templates = JSON.parse(localStorage.getItem('caseTemplates')) || [];
    templates.push({
        procedure:     document.getElementById('procedure').value,
        role:          document.getElementById('role').value,
        pgy_year:      document.getElementById('pgyYear').value,
        resident_name: document.getElementById('residentName').value,
        attending:     document.getElementById('attending').value,
        hospital:      document.getElementById('hospital').value
    });
    localStorage.setItem('caseTemplates', JSON.stringify(templates));
    loadTemplates();
    showToast('Template saved');
}

// ── Role & complexity radio helpers ──────────────────────────────────────────
function updateRoleLabels(selectedVal) {
    let val = selectedVal || document.getElementById('role').value;
    let map = { 'Primary Surgeon': 'role-lbl-primary', 'Assistant': 'role-lbl-assistant', 'Observer': 'role-lbl-observer' };
    let colors = { 'Primary Surgeon': '#2563eb', 'Assistant': '#16a34a', 'Observer': '#7c3aed' };
    let bgs    = { 'Primary Surgeon': '#eff6ff', 'Assistant': '#f0fdf4', 'Observer': '#faf5ff' };
    Object.keys(map).forEach(r => {
        let el = document.getElementById(map[r]);
        if (!el) return;
        let active = r === val;
        el.style.borderColor  = active ? colors[r] : '#E5E7EB';
        el.style.background   = active ? bgs[r]    : 'white';
        let radio = el.querySelector('input[type=radio]');
        if (radio) radio.checked = active;
    });
}
function updateCxLabels(selectedVal) {
    let val = selectedVal || document.getElementById('complexity').value;
    let map = { 'Routine': 'cx-lbl-routine', 'Complex': 'cx-lbl-complex', 'Challenging': 'cx-lbl-challenging' };
    let colors = { 'Routine': '#16a34a', 'Complex': '#d97706', 'Challenging': '#dc2626' };
    Object.keys(map).forEach(c => {
        let el = document.getElementById(map[c]);
        if (!el) return;
        let active = c === val;
        el.style.borderColor = active ? colors[c] : '#E5E7EB';
        el.style.background  = active ? colors[c]+'12' : 'white';
        let radio = el.querySelector('input[type=radio]');
        if (radio) radio.checked = active;
    });
}

function applyTemplate(index) {
    let t = JSON.parse(localStorage.getItem('caseTemplates'))[index];
    document.getElementById('procedure').value    = t.procedure;
    document.getElementById('role').value         = t.role;
    document.getElementById('pgyYear').value      = t.pgy_year;
    document.getElementById('residentName').value = t.resident_name;
    document.getElementById('attending').value    = t.attending;
    document.getElementById('hospital').value     = t.hospital;
    updateRoleLabels(t.role);
    showToast('Template applied');
}

function deleteTemplate(event, index) {
    event.stopPropagation();
    let templates = JSON.parse(localStorage.getItem('caseTemplates')) || [];
    templates.splice(index, 1);
    localStorage.setItem('caseTemplates', JSON.stringify(templates));
    loadTemplates();
    showToast('🗑️ Template deleted', 'warning');
}

// Edit modal
function openEditModal(id) {
    let c = allCases.find(c => c.id === id);
    if (!c) return;
    document.getElementById('editId').value            = c.id;
    document.getElementById('editProcedure').value     = c.procedure;
    document.getElementById('editRole').value          = c.role;
    document.getElementById('editDate').value          = c.date;
    document.getElementById('editResidentName').value  = c.resident_name || '';
    document.getElementById('editPgyYear').value       = c.pgy_year || 'PGY-1';
    document.getElementById('editAttending').value     = c.attending || '';
    document.getElementById('editHospital').value      = c.hospital || '';
    let compEl = document.getElementById('editComplexity');
    if (compEl) compEl.value = parseComplexity(c.notes);
    document.getElementById('editNotes').value         = stripComplexity(c.notes);
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function saveEdit() {
    showLoading();
    let { error } = await db.from('cases').update({
        procedure:     document.getElementById('editProcedure').value,
        role:          document.getElementById('editRole').value,
        date:          document.getElementById('editDate').value,
        resident_name: document.getElementById('editResidentName').value,
        pgy_year:      document.getElementById('editPgyYear').value,
        attending:     document.getElementById('editAttending').value,
        hospital:      document.getElementById('editHospital').value,
        notes:         document.getElementById('editNotes').value + ' [COMP:' + (document.getElementById('editComplexity') ? document.getElementById('editComplexity').value : 'Routine') + ']'
    }).eq('id', document.getElementById('editId').value);
    hideLoading();
    if (error) { showToast('Error: ' + error.message, 'error'); }
    else { closeEditModal(); loadCases(); showToast('✅ Case updated!'); }
}

// Duplicate
async function duplicateCase(id) {
    let c = allCases.find(c => c.id === id);
    if (!c) return;
    showLoading();
    let { data: { user } } = await db.auth.getUser();
    let { error } = await db.from('cases').insert({
        procedure:     c.procedure,
        role:          c.role,
        date:          getTodayStr(),
        notes:         c.notes,
        resident_name: c.resident_name,
        pgy_year:      c.pgy_year,
        attending:     c.attending,
        hospital:      c.hospital,
        user_id:       user.id
    });
    hideLoading();
    if (error) { showToast('Error: ' + error.message, 'error'); }
    else { loadCases(); showToast('Case duplicated'); }
}

// Tab navigation
function showTab(tab, e) {
    document.getElementById('dashboard').style.display    = 'none';
    document.getElementById('logCase').style.display      = 'none';
    document.getElementById('caseListTab').style.display  = 'none';
    document.getElementById('analyticsTab').style.display = 'none';
    document.getElementById('profileTab').style.display   = 'none';
    let st = document.getElementById('settingsTab'); if (st) st.style.display = 'none';
    document.getElementById('helpTab').style.display      = 'none';
    document.getElementById('adminPanel').style.display    = 'none';
    let ap = document.getElementById('attendingPanel'); if (ap) ap.style.display = 'none';
    let jt = document.getElementById('journalTab'); if (jt) jt.style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));

    if (tab === 'dashboard') {
        document.getElementById('dashboard').style.display = 'block';
    } else if (tab === 'logCase') {
        document.getElementById('logCase').style.display = 'block';
        loadTemplates();
        loadCustomProcList();
        refreshProcedureDropdowns();
        let dateEl = document.getElementById('date');
        if (dateEl && !dateEl.value) dateEl.value = getTodayStr();
        updateRoleLabels();
        updateCxLabels();
    } else if (tab === 'caseList') {
        document.getElementById('caseListTab').style.display = 'block';
        showCasesSubTab('list');
        renderSavedFiltersBar();
        displayCaseList(allCases);
    } else if (tab === 'analytics') {
        // Analytics merged into Cases > Insights
        document.getElementById('caseListTab').style.display = 'block';
        showCasesSubTab('insights');
        showAnalytics();
    } else if (tab === 'profile') {
        document.getElementById('profileTab').style.display = 'block';
        updateProfileDisplay();
        loadProfileEmail();
        loadProfileCaseStats();
    } else if (tab === 'settings') {
        document.getElementById('settingsTab').style.display = 'block';
        loadProfile();
        loadProfileEmail();
        updateNotifStatus();
    } else if (tab === 'journal') {
        document.getElementById('journalTab').style.display = 'block';
        renderJournalList();
        setTimeout(()=>{ let g=document.getElementById('wsGrid'); if(g && window.innerWidth<=768) g.style.display='grid'; }, 10);
    } else if (tab === 'help') {
        document.getElementById('helpTab').style.display = 'block';
    } else if (tab === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminData();
    } else if (tab === 'attending') {
        let ap = document.getElementById('attendingPanel');
        if (ap) ap.style.display = 'block';
        loadAttendingDashboard();
    }

    if (e && e.target && e.target.classList.contains('tab-btn')) {
        e.target.classList.add('active-tab');
    }
    const navMap = { dashboard: 'nav-dashboard', logCase: 'nav-logCase', caseList: 'nav-caseList', analytics: 'nav-analytics', journal: 'nav-journal', help: 'nav-help' };
    if (navMap[tab]) setActiveNav(navMap[tab]);
}

function showCasesSubTab(which) {
    let listEl     = document.getElementById('cl-section-list');
    let insightsEl = document.getElementById('cl-section-insights');
    let listBtn    = document.getElementById('cl-tab-list');
    let insBtn     = document.getElementById('cl-tab-insights');
    if (!listEl || !insightsEl) return;
    if (which === 'insights') {
        listEl.style.display     = 'none';
        insightsEl.style.display = 'block';
        if (listBtn) { listBtn.style.background = 'transparent'; listBtn.style.color = '#6B7280'; listBtn.style.boxShadow = 'none'; }
        if (insBtn)  { insBtn.style.background  = 'white';       insBtn.style.color  = '#111827'; insBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }
        showAnalytics();
        renderLearningCurve();
    } else {
        insightsEl.style.display = 'none';
        listEl.style.display     = 'block';
        if (insBtn)  { insBtn.style.background  = 'transparent'; insBtn.style.color  = '#6B7280'; insBtn.style.boxShadow = 'none'; }
        if (listBtn) { listBtn.style.background = 'white';       listBtn.style.color = '#111827'; listBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'; }
    }
}

// ── Learning Curve ────────────────────────────────────────────────────────────
let _lcChart = null;
function renderLearningCurve() {
    let sel = document.getElementById('lcProcedure');
    let canvas = document.getElementById('learningCurveChart');
    let statsEl = document.getElementById('learningCurveStats');
    if (!sel || !canvas) return;

    // Populate procedure selector from logged cases
    let procs = [...new Set(allCases.map(c => c.procedure).filter(Boolean))].sort();
    if (!sel.options.length || sel.dataset.loaded !== '1') {
        sel.innerHTML = procs.map(p => `<option value="${p}">${p}</option>`).join('');
        sel.dataset.loaded = '1';
    }
    let proc = sel.value || procs[0];
    if (!proc) { canvas.parentElement.style.display = 'none'; return; }

    // Get cases for this procedure sorted by date
    let cx = { 'Routine': 1, 'Complex': 2, 'Challenging': 3 };
    let cxLabel = { 1:'Routine', 2:'Complex', 3:'Challenging' };
    let cases = allCases
        .filter(c => c.procedure === proc && c.date)
        .sort((a,b) => a.date.localeCompare(b.date))
        .map((c, i) => ({
            n: i + 1,
            score: cx[c.complexity] || 1,
            date: c.date,
            role: c.role || ''
        }));

    if (cases.length < 2) {
        canvas.style.display = 'none';
        if (statsEl) statsEl.innerHTML = `<p style="font-size:13px;color:#94a3b8;margin:0">Log at least 2 ${proc} cases to see your curve.</p>`;
        return;
    }
    canvas.style.display = 'block';

    // Rolling average (window=3)
    function rollingAvg(data, key, win) {
        return data.map((_, i) => {
            let slice = data.slice(Math.max(0, i - win + 1), i + 1);
            return slice.reduce((s, d) => s + d[key], 0) / slice.length;
        });
    }
    let rolling = rollingAvg(cases, 'score', 3);

    // Theoretical novice→expert sigmoid (scaled to match y 1–3)
    let sigmoid = cases.map((_, i) => {
        let x = i / (cases.length - 1);
        let s = 1 / (1 + Math.exp(-10 * (x - 0.5)));
        return 1 + s * 2; // maps 1–3
    });

    // Stats
    let first5avg = cases.slice(0, 5).reduce((s,c) => s + c.score, 0) / Math.min(5, cases.length);
    let last5avg  = cases.slice(-5).reduce((s,c) => s + c.score, 0) / Math.min(5, cases.length);
    let trend = last5avg - first5avg;
    let trendLabel = trend > 0.3 ? '↑ Taking on harder cases' : trend < -0.3 ? '↓ Trending simpler' : '→ Stable complexity';
    let trendColor = trend > 0.3 ? '#16a34a' : trend < -0.3 ? '#dc2626' : '#64748b';

    if (statsEl) statsEl.innerHTML = [
        { label:'Total cases', val: cases.length, col:'#2563eb' },
        { label:'Avg complexity', val: cxLabel[Math.round(cases.reduce((s,c)=>s+c.score,0)/cases.length)] || 'Routine', col:'#7c3aed' },
        { label:'Trend', val: trendLabel, col: trendColor },
    ].map(s=>`<div style="flex:1;min-width:90px;background:#f8fafc;border-radius:10px;padding:8px 10px">
        <div style="font-size:18px;font-weight:800;color:${s.col};margin-bottom:2px">${s.val}</div>
        <div style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">${s.label}</div>
    </div>`).join('');

    if (_lcChart) _lcChart.destroy();
    _lcChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: cases.map(c => `#${c.n}`),
            datasets: [
                {
                    label: 'Your progression',
                    data: rolling,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124,58,237,0.08)',
                    borderWidth: 2.5,
                    pointRadius: 3,
                    pointBackgroundColor: '#7c3aed',
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: 'Expert curve',
                    data: sigmoid,
                    borderColor: '#e2e8f0',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0.4,
                    fill: false,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.datasetIndex === 0
                            ? ` Complexity: ${cxLabel[Math.round(ctx.raw)] || ctx.raw.toFixed(1)}`
                            : ' Expert reference'
                    }
                }
            },
            scales: {
                y: {
                    min: 0.8, max: 3.2,
                    ticks: {
                        stepSize: 1,
                        callback: v => cxLabel[v] || '',
                        font: { size: 10 }
                    },
                    grid: { color: '#f1f5f9' }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        font: { size: 10 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    let el = document.getElementById(id);
    if (el) el.classList.add('active');
}

async function loadProfileEmail() {
    let { data: { user } } = await db.auth.getUser();
    let el = document.getElementById('profileEmail');
    if (el && user) el.textContent = '📧 ' + user.email;
}

function loadProfileCaseStats() {
    let total   = allCases.length;
    let primary = allCases.filter(c => c.role === 'Primary Surgeon').length;
    let thisMonth = getThisMonthStr();
    let monthly = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let el = document.getElementById('profileCaseStats');
    if (!el) return;
    const _sc = (val, label, color) =>
        `<div style="background:white;border:1px solid #E5E7EB;border-radius:14px;padding:14px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
            <div style="font-size:22px;font-weight:800;color:${color};letter-spacing:-1px;line-height:1;margin-bottom:4px">${val}</div>
            <div style="font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
        </div>`;
    el.innerHTML = _sc(total, 'Total Cases', '#2563eb') + _sc(monthly, 'This Month', '#0891b2') + _sc(primary, 'As Primary', '#16a34a');
}

async function forgotPassword() {
    let email = document.getElementById('emailIn').value;
    if (!email) { showToast('⚠️ Enter your email address first', 'warning'); return; }
    showLoading();
    let { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });
    hideLoading();
    if (error) { showToast(error.message, 'error'); }
    else { showToast('📧 Password reset email sent to ' + email); }
}

// Auth
let _signupRole = 'resident';
let _pendingEmail = '', _pendingPassword = '', _pendingFullName = '';

function selectSignupRole(role) {
    _signupRole = role;
    ['resident','attending'].forEach(r => {
        let btn = document.getElementById('roleBtn-' + r);
        if (!btn) return;
        btn.style.borderColor = r === role ? (r === 'resident' ? '#2563eb' : '#0891b2') : '#e2e8f0';
        btn.style.background  = r === role ? (r === 'resident' ? '#eff6ff' : '#f0f9ff')  : '#f8fafc';
        btn.style.color       = r === role ? (r === 'resident' ? '#2563eb' : '#0891b2')  : '#64748b';
    });
    let pgyRow = document.getElementById('pgySignupRow');
    if (pgyRow) pgyRow.style.display = role === 'resident' ? 'block' : 'none';
}

async function signUp() {
    _pendingEmail    = document.getElementById('email').value.trim();
    _pendingPassword = document.getElementById('password').value;
    _pendingFullName = document.getElementById('fullName').value.trim();
    if (!_pendingFullName) { showToast('⚠️ Please enter your full name', 'warning'); return; }
    if (!_pendingEmail || !_pendingPassword) { showToast('⚠️ Enter email and password', 'warning'); return; }
    if (_pendingPassword.length < 6) { showToast('⚠️ Password must be at least 6 characters', 'warning'); return; }

    // Pre-fill preferred name with first name, then show role modal
    let firstNameGuess = _pendingFullName.split(' ')[0];
    let inp = document.getElementById('preferredNameInput');
    if (inp) { inp.value = firstNameGuess; }

    selectSignupRole('resident'); // reset to default selection
    document.getElementById('roleModal').style.display = 'flex';
    setTimeout(() => { if (inp) { inp.focus(); inp.select(); } }, 150);
}

async function completeSignUp() {
    document.getElementById('roleModal').style.display = 'none';
    let completeBtn = document.getElementById('completeSignUpBtn');
    if (completeBtn) { completeBtn.textContent = 'Submitting…'; completeBtn.disabled = true; }

    const resetBtn = () => { if (completeBtn) { completeBtn.textContent = 'Complete Registration →'; completeBtn.disabled = false; } };

    try {
        let email         = _pendingEmail;
        let password      = _pendingPassword;
        let fullName      = _pendingFullName;
        let preferredName = (document.getElementById('preferredNameInput')?.value || '').trim() || fullName.split(' ')[0];
        let pgy           = _signupRole === 'resident' ? (document.getElementById('signupPgy')?.value || 'PGY-1') : null;

        if (!email || !password || !fullName) {
            showToast('⚠️ Missing fields — please go back and fill in all fields', 'warning');
            resetBtn(); return;
        }

        let userId = null;

        let { data, error } = await db.auth.signUp({ email, password });

        if (error) {
            // Already registered — sign in to get userId, save profile, then sign out
            let { data: siData, error: siErr } = await db.auth.signInWithPassword({ email, password });
            if (siErr) { showToast('⚠️ ' + error.message, 'error'); resetBtn(); return; }
            userId = siData.user?.id;
            if (userId) {
                let row = { id: userId, email, full_name: fullName, role: _signupRole, status: 'pending', preferred_name: preferredName };
                await db.from('profiles').upsert(row);
            }
            await db.auth.signOut();
        } else {
            userId = data.user?.id;
            if (userId) {
                // Save profile while still authenticated
                let row = { id: userId, email, full_name: fullName, role: _signupRole, status: 'pending', preferred_name: preferredName };
                let { error: profErr } = await db.from('profiles').upsert(row);
                if (profErr) showToast('⚠️ Profile save error: ' + profErr.message, 'error');
            }
            if (data.session) await db.auth.signOut();
        }

        if (!userId) {
            // Email confirmation required — show pending (DB trigger creates default profile)
            showPendingScreen(preferredName || fullName);
            return;
        }

        let p = JSON.parse(localStorage.getItem('userProfile')) || {};
        p.name = fullName; p.preferredName = preferredName;
        if (pgy) p.pgy = pgy;
        localStorage.setItem('userProfile', JSON.stringify(p));

        document.getElementById('roleModal').style.display = 'none';
        showPendingScreen(preferredName || fullName);

    } catch(e) {
        showToast('⚠️ Unexpected error: ' + e.message, 'error');
        resetBtn();
    }
}

function showPendingScreen(name) {
    document.getElementById('loginSection').style.display   = 'none';
    document.getElementById('appSection').style.display     = 'none';
    document.getElementById('pendingSection').style.display = 'block';
    let nameEl = document.getElementById('pendingName');
    if (nameEl && name) {
        nameEl.textContent = 'Dr. ' + name.trim().split(' ')[0];
    }
}

async function signInForm() {
    let email    = document.getElementById('emailIn').value;
    let password = document.getElementById('passwordIn').value;
    if (!email || !password) { showToast('⚠️ Enter email and password', 'warning'); return; }
    showLoading();
    let { error } = await db.auth.signInWithPassword({ email, password });
    hideLoading();
    if (error) { showToast(error.message, 'error'); return; }
    let { data: { user } } = await db.auth.getUser();
    let { data: profile }  = await db.from('profiles').select('*').eq('id', user.id).single();
    const adminEmails = ['elarabyo@stanford.edu'];
    const isAdminEmail = adminEmails.includes(user.email);
    // If profile missing, insert (never upsert — avoids overwriting existing row)
    if (!profile) {
        if (isAdminEmail) { showApp(); return; }
        await db.from('profiles').insert({
            id: user.id, email: user.email,
            full_name: user.email.split('@')[0],
            role: 'resident', status: 'pending'
        }).select();
        showPendingScreen(user.email.split('@')[0]);
        await db.auth.signOut();
        return;
    }
    if (profile.role === 'admin' || isAdminEmail) { showApp(); return; }
    if (profile.status === 'pending') {
        showPendingScreen(profile.preferred_name || profile.full_name || '');
        await db.auth.signOut();
        return;
    }
    if (profile.status === 'rejected') {
        showToast('❌ Your access request was declined.', 'error');
        await db.auth.signOut();
        return;
    }
    showApp();
}

function toggleForm() {
    let signUp = document.getElementById('signUpForm');
    let signIn = document.getElementById('signInForm');
    if (signUp.style.display === 'none') {
        signUp.style.display = 'block';
        signIn.style.display = 'none';
    } else {
        signUp.style.display = 'none';
        signIn.style.display = 'block';
    }
}

async function signOut() {
    await db.auth.signOut();
    document.getElementById('loginSection').style.display   = 'block';
    document.getElementById('appSection').style.display     = 'none';
    document.getElementById('pendingSection').style.display = 'none';
    document.getElementById('signUpForm').style.display     = 'block';
    document.getElementById('signInForm').style.display     = 'none';
}

async function showApp() {
    document.getElementById('loginSection').style.display   = 'none';
    document.getElementById('appSection').style.display     = 'block';
    document.getElementById('pendingSection').style.display = 'none';

    const adminEmails = ['elarabyo@stanford.edu'];
    let user, profile;
    try {
        let r = await db.auth.getUser();
        user  = r.data?.user;
        let p = await db.from('profiles').select('*').eq('id', user.id).single();
        profile = p.data;
        if (!profile && adminEmails.includes(user.email)) {
            await db.from('profiles').upsert({ id: user.id, email: user.email, full_name: 'Dr. Elaraby', role: 'admin', status: 'approved' });
            profile = { role: 'admin', status: 'approved', full_name: 'Dr. Elaraby', preferred_name: 'Osama' };
        }
    } catch(e) { console.error('showApp profile fetch:', e); }

    currentUserRole = profile?.role || 'resident';
    if (currentUserRole === 'admin' || adminEmails.includes(user?.email)) {
        currentUserRole = 'admin';
        document.getElementById('adminTab').style.display = 'inline-block';
        checkPendingUsers();
    }
    if (currentUserRole === 'attending') {
        ['tabBtnDashboard','tabBtnLogCase','tabBtnAnalytics','nav-dashboard','nav-logCase','nav-analytics'].forEach(id => {
            let el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        let at = document.getElementById('attendingTab');
        if (at) at.style.display = 'inline-block';
        showTab('attending', null);
    }

    // Sync name + preferred name from Supabase into localStorage
    let saved = JSON.parse(localStorage.getItem('userProfile')) || {};
    if (profile?.full_name && !saved.name) saved.name = profile.full_name;
    if (profile?.preferred_name && !saved.preferredName) saved.preferredName = profile.preferred_name;
    // Derive preferredName from full_name if still missing
    if (!saved.preferredName && saved.name) saved.preferredName = saved.name.split(' ')[0];
    localStorage.setItem('userProfile', JSON.stringify(saved));

    let nameForForm = saved.name || profile?.full_name || '';
    if (nameForForm) document.getElementById('residentName').value = nameForForm;
    updateProfileDisplay();
    loadCases();
    syncWorkspaceFromCloud();
    checkWelcomeGuide();
    if (localStorage.getItem('notificationsEnabled') === 'true') scheduleReminder();
}

db.auth.getSession().then(async ({ data }) => {
    if (data.session) {
        let { data: { user } } = await db.auth.getUser();
        let { data: profile, error: pErr } = await db.from('profiles').select('*').eq('id', user.id).single();
        // If fetch failed entirely, let admin email bypass to avoid lockout
        const adminEmails = ['elarabyo@stanford.edu'];
        if (pErr || !profile) {
            if (adminEmails.includes(user.email)) { showApp(); return; }
            showPendingScreen('');
            await db.auth.signOut();
            return;
        }
        if (profile.role === 'admin') {
            showApp();
        } else if (profile.status === 'pending') {
            showPendingScreen(profile.preferred_name || profile.full_name || '');
            await db.auth.signOut();
        } else if (profile.status === 'rejected') {
            await db.auth.signOut();
        } else {
            showApp();
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    checkShareURL();
    document.getElementById('saveBtn').addEventListener('click', async function() {
        if (!document.getElementById('residentName').value) {
            showToast('⚠️ Please enter resident name', 'warning'); return;
        }
        if (!document.getElementById('date').value) {
            showToast('⚠️ Please select a date', 'warning'); return;
        }
        showLoading();
        let { data: { user } } = await db.auth.getUser();
        let residentName = document.getElementById('residentName').value;
        let baseNotes  = document.getElementById('notes').value;
        let complexity = document.getElementById('complexity') ? document.getElementById('complexity').value : 'Routine';
        let notesWithComp = baseNotes + (baseNotes ? ' ' : '') + '[COMP:' + complexity + ']';
        let procSel = document.getElementById('procedure').value;
        let procVal = procSel === 'Others'
            ? (document.getElementById('procedureOther').value.trim() || 'Others')
            : procSel;
        let { error } = await db.from('cases').insert({
            procedure:     procVal,
            role:          document.getElementById('role').value,
            date:          document.getElementById('date').value,
            notes:         notesWithComp,
            resident_name: residentName,
            pgy_year:      document.getElementById('pgyYear').value,
            attending:     document.getElementById('attending').value,
            hospital:      document.getElementById('hospital').value,
            user_id:       user.id
        });
        hideLoading();
        if (error) { showToast('Error: ' + error.message, 'error'); }
        else {
            localStorage.setItem('residentName', residentName);
            document.getElementById('attending').value = '';
            document.getElementById('hospital').value  = '';
            document.getElementById('notes').value     = '';
            document.getElementById('date').value      = '';
            // Reset Others procedure
            let otherInp = document.getElementById('procedureOther');
            if (otherInp) { otherInp.style.display = 'none'; otherInp.value = ''; }
            let procEl = document.getElementById('procedure');
            if (procEl) procEl.value = 'Cataract / Phaco';
            loadCases();
            showToast('✅ Case saved!');
        }
    });
});

async function loadCases() {
    showLoading();
    let { data: { user } } = await db.auth.getUser();
    let { data: cases } = await db.from('cases').select('*').eq('user_id', user.id).order('date', { ascending: false });
    allCases = cases || [];
    updateDashboard(allCases);
    checkSmartAlerts(allCases);
    updateStreak(allCases);
    hideLoading();
    // Procedure-level milestone checks (runs after loading, non-blocking)
    setTimeout(() => checkProcedureMilestones(allCases), 800);
}

async function deleteCase(id) {
    if (!confirm('Delete this case?')) return;
    showLoading();
    await db.from('cases').delete().eq('id', id);
    hideLoading();
    loadCases();
    showToast('🗑️ Case deleted', 'warning');
}

let _lastPendingCount = 0;
async function checkPendingUsers() {
    if (currentUserRole !== 'admin') return;
    let { data: profiles } = await db.from('profiles').select('status').eq('status', 'pending');
    let count    = profiles ? profiles.length : 0;
    let adminTab = document.getElementById('adminTab');
    if (adminTab) {
        if (count > 0) {
            adminTab.innerHTML = 'PD Panel <span style="background:#dc2626; color:white; border-radius:50%; padding:2px 7px; font-size:11px; margin-left:4px">' + count + '</span>';
        } else {
            adminTab.innerHTML = 'PD Panel';
        }
    }
    if (count > _lastPendingCount) {
        showToast('⚠️ ' + count + ' user(s) pending approval!', 'warning');
    }
    _lastPendingCount = count;
}
// Poll every 60 seconds so new sign-ups appear without requiring re-login
setInterval(() => { if (currentUserRole === 'admin') checkPendingUsers(); }, 60000);

async function loadAdminData() {
    showLoading();
    let { data: cases }    = await db.from('cases').select('*');
    let { data: profiles } = await db.from('profiles').select('*');
    hideLoading();

    let pending = profiles ? profiles.filter(p => p.status === 'pending') : [];
    let html = '<h2>Program Director Panel</h2>';

    if (pending.length > 0) {
        html += '<div style="background:#fff7ed; border:2px solid #f97316; border-radius:14px; padding:16px; margin-bottom:20px">';
        html += '<h3 style="color:#ea580c; margin-bottom:12px">⏳ Pending Approval (' + pending.length + ')</h3>';
        for (let p of pending) {
            let isAttending = p.role === 'attending';
            let roleBadge   = isAttending
                ? '<span style="font-size:10px;font-weight:700;background:#0891b218;color:#0891b2;padding:2px 8px;border-radius:20px;margin-left:6px">Attending</span>'
                : '<span style="font-size:10px;font-weight:700;background:#2563eb18;color:#2563eb;padding:2px 8px;border-radius:20px;margin-left:6px">Resident</span>';
            html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #fed7aa">';
            html += '<div><div style="display:flex;align-items:center;flex-wrap:wrap"><strong>' + (p.full_name || 'Unknown') + '</strong>' + roleBadge + '</div>';
            html += '<span style="font-size:12px; color:#64748b">' + p.email + '</span></div>';
            html += '<div style="display:flex; gap:8px; flex-wrap:wrap">';
            // Role override selector
            html += '<select onchange="changeUserRole(\'' + p.id + '\',this.value)" style="width:auto;margin:0;padding:6px 8px;font-size:12px;border-radius:8px;border:1px solid #e2e8f0">'
                  + '<option value="resident"' + (!isAttending?' selected':'') + '>Resident</option>'
                  + '<option value="attending"' + (isAttending?' selected':'') + '>Attending</option>'
                  + '</select>';
            html += '<button onclick="approveUser(\'' + p.id + '\')" style="background:#16a34a; width:auto; padding:8px 16px; font-size:12px; margin:0; border-radius:8px">✅ Approve</button>';
            html += '<button onclick="rejectUser(\'' + p.id + '\')" style="background:#dc2626; width:auto; padding:8px 16px; font-size:12px; margin:0; border-radius:8px">❌ Reject</button>';
            html += '</div></div>';
        }
        html += '</div>';
    } else {
        html += '<div style="background:#f0fdf4; border:2px solid #16a34a; border-radius:14px; padding:16px; margin-bottom:20px; color:#15803d; font-weight:600">✅ No pending requests</div>';
    }

    // ── Approved Residents
    html += '<h3 style="margin-bottom:12px">Approved Residents</h3>';
    html += '<table>';
    html += '<tr><th>Name</th><th>Email</th><th>PGY</th><th>Total</th><th>Cataract</th><th>VR</th><th>Glaucoma</th><th>Progress</th><th>Action</th></tr>';
    if (profiles) {
        for (let profile of profiles) {
            if (profile.role === 'resident' && profile.status === 'approved') {
                let uc      = cases ? cases.filter(c => c.user_id === profile.id) : [];
                let total   = uc.length;
                let percent = Math.min(Math.round((total / Object.values(acgme).reduce((a,b)=>a+b,0)) * 100), 100);
                let name    = profile.full_name || (uc.length > 0 && uc[0].resident_name ? uc[0].resident_name : '-');
                let pgy     = uc.length > 0 && uc[0].pgy_year ? uc[0].pgy_year : '-';
                html += '<tr>';
                html += '<td>' + name + '</td><td>' + profile.email + '</td><td>' + pgy + '</td><td>' + total + '</td>';
                html += '<td>' + uc.filter(c=>c.procedure==='Cataract / Phaco').length + '/86</td>';
                html += '<td>' + uc.filter(c=>c.procedure==='Vitreoretinal (PPV)').length + '/25</td>';
                html += '<td>' + uc.filter(c=>c.procedure==='Glaucoma').length + '/25</td>';
                html += '<td>' + percent + '%</td>';
                html += '<td style="display:flex;gap:6px;flex-wrap:wrap">';
                html += '<button onclick="revokeUser(\'' + profile.id + '\')" style="background:#dc2626; padding:6px 10px; font-size:11px; margin:0; width:auto; border-radius:6px">Revoke</button>';
                if (uc.length > 0) {
                    let last = uc[uc.length - 1];
                    let info = (last.procedure || '') + ' — ' + (last.date || '');
                    let safeInfo = info.replace(/'/g, "\\'");
                    html += '<button onclick="openFeedbackModal(\'' + last.id + '\',\'' + safeInfo + '\')" style="background:#7c3aed; padding:6px 10px; font-size:11px; margin:0; width:auto; border-radius:6px">Feedback</button>';
                    let tLabel = last.is_teaching ? 'Unmark Teaching' : 'Teaching';
                    let tBg    = last.is_teaching ? '#d97706' : '#0891b2';
                    html += '<button onclick="toggleTeachingCase(\'' + last.id + '\',' + (!!last.is_teaching) + ')" style="background:' + tBg + '; padding:6px 10px; font-size:11px; margin:0; width:auto; border-radius:6px">' + tLabel + '</button>';
                }
                html += '</td>';
                html += '</tr>';
            }
        }
    }
    html += '</table>';

    // ── Approved Attendings
    let approvedAttending = profiles ? profiles.filter(p => p.role === 'attending' && p.status === 'approved') : [];
    if (approvedAttending.length > 0) {
        html += '<h3 style="margin:20px 0 12px">Approved Attendings</h3>';
        html += '<div style="display:flex;flex-direction:column;gap:10px">';
        for (let p of approvedAttending) {
            let supervisedCount = cases ? cases.filter(c => c.attending && p.full_name && c.attending.toLowerCase().includes(p.full_name.split(' ').pop().toLowerCase())).length : 0;
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px">';
            html += '<div><strong style="font-size:14px">Dr. ' + (p.preferred_name || p.full_name?.split(' ')[0] || p.full_name || '—') + '</strong>';
            html += '<br><span style="font-size:12px;color:#64748b">' + p.email + ' · ' + supervisedCount + ' cases supervised</span></div>';
            html += '<button onclick="revokeUser(\'' + p.id + '\')" style="background:#dc2626;padding:6px 10px;font-size:11px;margin:0;width:auto;border-radius:6px">Revoke</button>';
            html += '</div>';
        }
        html += '</div>';
    }

    document.getElementById('adminPanel').innerHTML = html;
}

async function changeUserRole(userId, role) {
    await db.from('profiles').update({ role }).eq('id', userId);
}

async function approveUser(userId) {
    await db.from('profiles').update({ status: 'approved' }).eq('id', userId);
    showToast('✅ User approved!');
    loadAdminData();
}

async function rejectUser(userId) {
    await db.from('profiles').update({ status: 'rejected' }).eq('id', userId);
    showToast('❌ User rejected', 'warning');
    loadAdminData();
}

async function revokeUser(userId) {
    if (!confirm('Revoke access for this user?')) return;
    await db.from('profiles').update({ status: 'pending' }).eq('id', userId);
    showToast('Access revoked', 'warning');
    loadAdminData();
}

function updateDashboard(cases) {
    let thisMonth      = getThisMonthStr();
    let monthCases     = cases.filter(c => c.date && c.date.startsWith(thisMonth));
    let totalRequired  = Object.values(acgme).reduce((a, b) => a + b, 0);
    let totalDone      = cases.length;
    let overallPercent = Math.min(Math.round((totalDone / totalRequired) * 100), 100);
    let streak         = localStorage.getItem('streak') || 0;

    let hour     = getNowHour();
    let greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
    let greetEl  = document.getElementById('greetingText');
    if (greetEl) greetEl.textContent = greeting;
    updateProfileDisplay();
    checkMilestones(overallPercent);
    updateAchievementBadges(overallPercent);

    // ── Hero stats — update the hardcoded number cells
    let _hs = id => document.getElementById(id);
    if (_hs('heroStatCases'))  _hs('heroStatCases').textContent  = totalDone;
    if (_hs('heroStatMonth'))  _hs('heroStatMonth').textContent  = monthCases.length;
    if (_hs('heroStatAcgme'))  _hs('heroStatAcgme').textContent  = overallPercent + '%';
    if (_hs('heroStatStreak')) _hs('heroStatStreak').textContent = streak;

    let badge = document.getElementById('overallBadge');
    if (badge) badge.textContent = overallPercent + '% Complete';

    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of cases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }

    // ── ACGME Progress — Notion-style bars
    let statsHtml = '';
    for (let p in acgme) {
        let done    = counts[p];
        let req     = acgme[p];
        let percent = Math.min(Math.round((done / req) * 100), 100);
        let color   = percent >= 100 ? '#16a34a' : percent >= 60 ? '#2563eb' : percent >= 30 ? '#d97706' : '#dc2626';
        let shortName = p.split('/')[0].trim().split('(')[0].trim();
        let statusDot = percent >= 100 ? '#16a34a' : percent >= 30 ? '#d97706' : '#dc2626';
        statsHtml += `
        <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #F9FAFB">
            <div style="width:6px;height:6px;border-radius:50%;background:${statusDot};flex-shrink:0"></div>
            <span style="font-size:13px;font-weight:600;color:#111827;min-width:120px;flex-shrink:0">${shortName}</span>
            <div style="flex:1;background:#F3F4F6;border-radius:99px;height:6px;overflow:hidden">
                <div style="background:${color};width:${percent}%;height:6px;border-radius:99px;transition:width 1s ease"></div>
            </div>
            <span style="font-size:12px;color:#6B7280;font-weight:600;min-width:60px;text-align:right">${done}<span style="color:#D1D5DB">/${req}</span></span>
            <span style="font-size:11px;font-weight:700;color:${color};min-width:34px;text-align:right">${percent}%</span>
        </div>`;
    }
    document.getElementById('stats').innerHTML = statsHtml;

    // ── Role breakdown (pure HTML — no Chart.js)
    let roleCounts = { 'Primary': 0, 'Assistant': 0, 'Observer': 0 };
    for (let c of cases) {
        if (c.role === 'Primary Surgeon') roleCounts['Primary']++;
        else if (c.role === 'Assistant')  roleCounts['Assistant']++;
        else if (c.role === 'Observer')   roleCounts['Observer']++;
    }
    let roleColors = { 'Primary': '#2563eb', 'Assistant': '#16a34a', 'Observer': '#d97706' };
    let roleIcons  = {
        'Primary':  '<path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>',
        'Assistant':'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/><line x1="20" y1="8" x2="20" y2="14"/>',
        'Observer': '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>'
    };
    let roleTotal = Object.values(roleCounts).reduce((a,b)=>a+b,0) || 1;
    let roleEl = document.getElementById('roleBreakdown');
    if (roleEl) {
        // Stacked proportion bar
        let barSegs = Object.entries(roleCounts).map(([role, count]) => {
            let pct = Math.round((count / roleTotal) * 100);
            return pct > 0
                ? `<div title="${role}: ${count} (${pct}%)" style="flex:${count};background:${roleColors[role]};height:8px;border-radius:0;transition:flex 0.6s ease"></div>`
                : '';
        }).join('');

        // Role rows
        let rows = Object.entries(roleCounts).map(([role, count]) => {
            let pct = Math.round((count / roleTotal) * 100);
            let color = roleColors[role];
            let icon  = roleIcons[role];
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F9FAFB">
                <div style="width:30px;height:30px;border-radius:8px;background:${color}14;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
                </div>
                <div style="flex:1;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:600;color:#111827">${role}</span>
                        <span style="font-size:12px;font-weight:700;color:${color}">${count}</span>
                    </div>
                    <div style="background:#F3F4F6;border-radius:99px;height:4px;overflow:hidden">
                        <div style="background:${color};width:${pct}%;height:4px;border-radius:99px;transition:width 0.8s ease"></div>
                    </div>
                </div>
                <span style="font-size:11px;color:#9CA3AF;font-weight:600;min-width:28px;text-align:right">${pct}%</span>
            </div>`;
        }).join('');

        roleEl.innerHTML = `
            <div style="display:flex;border-radius:6px;overflow:hidden;margin-bottom:16px;gap:2px;background:#F3F4F6;padding:2px;border-radius:8px">
                ${barSegs || `<div style="flex:1;background:#E5E7EB;height:8px;border-radius:6px"></div>`}
            </div>
            ${rows}
            <div style="margin-top:12px;text-align:center">
                <span style="font-size:11px;color:#9CA3AF;font-weight:500">${roleTotal} total case${roleTotal!==1?'s':''}</span>
            </div>`;
    }

    // ── Recent cases feed
    let recentEl = document.getElementById('recentCasesFeed');
    if (recentEl) {
        let recent = [...cases].sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0,5);
        if (recent.length === 0) {
            recentEl.innerHTML = `<p style="font-size:13px;color:#9CA3AF;text-align:center;padding:20px 0">No cases yet — log your first case!</p>`;
        } else {
            recentEl.innerHTML = recent.map(c => {
                let color = procedureColors[c.procedure] || '#6B7280';
                let short = (c.procedure||'—').split('/')[0].trim().split('(')[0].trim();
                let date  = c.date ? new Date(c.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
                return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F9FAFB">
                    <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
                    <div style="flex:1;min-width:0">
                        <p style="font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${short}</p>
                        <p style="font-size:11px;color:#9CA3AF;font-weight:500">${c.role||''}</p>
                    </div>
                    <span style="font-size:11px;color:#9CA3AF;font-weight:500;flex-shrink:0">${date}</span>
                </div>`;
            }).join('');
        }
    }

    // ── New feature widgets
    renderMotivationCard();
    renderGoalsWidget();
    renderReadinessScore(cases);
    renderWeeklyReviewWidget(cases);
    renderTodayWidget();
    renderActivityHeatmap();
}

// ── Motivation Card ───────────────────────────────────────────────────────────
const MOTIVATION_QUOTES = {
    en: [
        "The hands remember what the mind forgets. Keep operating.",
        "Every case you struggle through teaches you more than the ones you nail.",
        "Residency doesn't build character. It reveals it.",
        "Complications are just your education arriving unannounced.",
        "The OR is the one room where ego costs the most.",
        "Your notes will outlive your memory. Write them well.",
        "The best surgeons still get nervous before a hard case. That's not weakness — that's respect.",
        "Post-call you is still sharper than most on their best day.",
        "Phaco is not a procedure. It's a conversation between you and the eye.",
        "Every patient who trusts you with their vision is also trusting everyone who ever trained you.",
        "There is no small procedure for the patient on the table.",
        "The attending who made you feel most uncomfortable was investing the most in your future.",
        "You chose the most precise organ in the most complex organism. Precision is not optional.",
        "The day you stop second-guessing yourself is not the day you became good — it's the day you stopped growing.",
        "Fellowship will come. But the surgeon you become during residency is the one who earns it.",
        "Look at every fundus like it's the first one you've ever seen. It might show you something new.",
        "Sleep deprivation is temporary. A case done well is permanent.",
        "You are not tired. You are being forged.",
        "The OR doesn't care how you feel. It only cares what you do.",
        "One day a patient will see their grandchild's face because of what you learned today.",
    ],
    ar: [
        { q: "العين أمانة، والجراح وصيّها.", t: "The eye is a trust, and the surgeon its guardian." },
        { q: "اليد تحفظ ما نسيه العقل.", t: "The hand remembers what the mind forgets." },
        { q: "ما خاب من استشار.", t: "He who seeks counsel does not fail." },
        { q: "لكل يد ذاكرتها، فلا تتوقف عن التدريب.", t: "Every hand has its memory — never stop training." },
        { q: "أحسن النظر حتى لا يفوتك المنظر.", t: "Look carefully so nothing escapes your sight." },
        { q: "الليلة الصعبة تصنع الطبيب الجيد.", t: "A hard night makes a good doctor." },
        { q: "تعلّم حتى تعلّم.", t: "Learn until you can teach." },
        { q: "لا يصنع المبضع الجراح، والجراح يصنع المبضع.", t: "The scalpel doesn't make the surgeon; the surgeon makes the scalpel." },
        { q: "المريض الذي أمّنك على بصره أمّنك على كل شيء.", t: "The patient who trusts you with their sight trusts you with everything." },
        { q: "من وقف على حافة الخطأ تعلّم أكثر ممن ابتعد عنه.", t: "Those who stood at the edge of error learned more than those who avoided it." },
        { q: "زد علمًا تزد نورًا، وزد نورًا تزد رؤية.", t: "Add knowledge, add light. Add light, add vision." },
        { q: "طبيب بلا صبر كسيف بلا حدّة.", t: "A doctor without patience is a sword without an edge." },
        { q: "لن تمشي مشية الأساتذة حتى تتعثر مشية التلاميذ.", t: "You won't walk like a master until you've stumbled like a student." },
        { q: "كلما ضاقت الطريق، اتسعت الحكمة.", t: "The narrower the path, the wider the wisdom." },
        { q: "الإرهاق لا يُطفئ نور العقل إلا عند من سمح له بذلك.", t: "Exhaustion dims the mind only for those who allow it." },
        { q: "الحكمة تبدأ من اعتراف الطبيب بأنه لا يعلم كل شيء.", t: "Wisdom begins when the doctor admits he doesn't know everything." },
        { q: "الصبر مفتاح الفرج.", t: "Patience is the key to relief." },
        { q: "لا تُحسن الجراحة من لم يتعلم من جراحاته.", t: "No one masters surgery without learning from their wounds." },
        { q: "يومًا ما سيرى مريضك وجه حفيده بسبب ما تتعلمه اليوم.", t: "One day a patient will see their grandchild's face because of what you learn today." },
        { q: "الطبيب الحقيقي يتعلم من أخطائه أكثر مما يتعلم من نجاحاته.", t: "The true physician learns more from mistakes than from successes." },
    ],
    fr: [
        "L'œil ne ment pas — apprenez à écouter ce qu'il vous dit.",
        "La résidence forge ce que les années d'école n'ont fait qu'esquisser.",
        "Ce n'est pas la salle d'opération qui fait le chirurgien — c'est ce qu'il y apporte.",
        "Chaque complication est un enseignant qui n'a pas pris rendez-vous.",
        "La main se souvient de ce que l'esprit oublie.",
        "Opérer, c'est dialoguer avec la matière vivante. Soyez à l'écoute.",
        "On ne devient pas ophtalmologiste pour voir moins — mais pour voir mieux.",
        "La confiance du patient est le privilège le plus lourd à porter.",
        "Un bon chirurgien n'est pas celui qui n'a jamais eu de complications — c'est celui qui les a traversées.",
        "Le meilleur diagnostic commence par regarder vraiment.",
        "La fatigue est temporaire. Un geste bien fait est permanent.",
        "L'ego est l'instrument le plus dangereux en salle d'opération.",
        "Celui qui cesse de s'interroger cesse d'apprendre.",
        "Vos notes survivront à votre mémoire. Rédigez-les avec soin.",
        "Un jour, un patient verra le visage de son petit-enfant grâce à ce que vous apprenez aujourd'hui.",
    ],
    es: [
        "La mano aprende lo que el ojo enseña.",
        "No hay cirugía pequeña para quien está en la mesa.",
        "El residente que no duda tampoco aprende.",
        "Cada guardia es un maestro disfrazado de insomnio.",
        "La confianza del paciente es el instrumento más delicado del quirófano.",
        "Ver bien no es suficiente — hay que entender lo que se ve.",
        "El ojo no miente. Aprende a escuchar lo que te dice.",
        "La residencia no construye el carácter — lo revela.",
        "Cada complicación es tu educación llegando sin avisar.",
        "Los mejores cirujanos que conozco aún se ponen nerviosos antes de un caso difícil.",
        "El cansancio es temporal. Una cirugía bien hecha es permanente.",
        "El ego es el instrumento más peligroso en el quirófano.",
        "Tus notas sobrevivirán a tu memoria. Escríbelas bien.",
        "Un día un paciente verá la cara de su nieto gracias a lo que aprendes hoy.",
        "No eres el primero en dudar. Tampoco serás el último. Pero sí puedes ser el mejor.",
    ],
};

const QUOTE_LANG_META = {
    en: { label:'EN', name:'English',  dir:'ltr', accent:'#1e40af', bg:'linear-gradient(135deg,#eff6ff,#e0f2fe)', border:'#bfdbfe' },
    ar: { label:'ع',  name:'العربية', dir:'rtl', accent:'#92400e', bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', border:'#fde68a' },
    fr: { label:'FR', name:'Français', dir:'ltr', accent:'#065f46', bg:'linear-gradient(135deg,#ecfdf5,#d1fae5)', border:'#a7f3d0' },
    es: { label:'ES', name:'Español',  dir:'ltr', accent:'#7c2d12', bg:'linear-gradient(135deg,#fff7ed,#fed7aa)', border:'#fdba74' },
};

let quoteLang = localStorage.getItem('quoteLang') || 'en';

function setQuoteLang(lang) {
    quoteLang = lang;
    localStorage.setItem('quoteLang', lang);
    renderMotivationCard();
}

function getQuoteForToday(lang) {
    const quotes = MOTIVATION_QUOTES[lang] || MOTIVATION_QUOTES.en;
    // Advance once per calendar day — deterministic, consistent within a day
    const daysSinceEpoch = Math.floor(Date.now() / 86400000);
    return quotes[daysSinceEpoch % quotes.length];
}

function renderMotivationCard() {
    let el = document.getElementById('motivationCard');
    if (!el) return;

    const meta  = QUOTE_LANG_META[quoteLang] || QUOTE_LANG_META.en;
    const raw   = getQuoteForToday(quoteLang);
    const isAr  = quoteLang === 'ar';
    const quote = isAr ? raw.q : raw;
    const trans = isAr ? raw.t : null;

    const langBtns = Object.entries(QUOTE_LANG_META).map(([k, m]) =>
        `<button onclick="setQuoteLang('${k}')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${k === quoteLang ? meta.accent : '#e2e8f0'};background:${k === quoteLang ? meta.accent : 'transparent'};color:${k === quoteLang ? 'white' : '#94a3b8'};font-size:11px;font-weight:700;margin:0;box-shadow:none;cursor:pointer;transition:all 0.15s">${m.label}</button>`
    ).join('');

    el.innerHTML = `
    <div style="background:${meta.bg};border:1.5px solid ${meta.border};border-radius:18px;padding:20px 22px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-18px;right:-18px;width:80px;height:80px;border-radius:50%;background:${meta.accent};opacity:0.06"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:6px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${meta.accent}" opacity="0.7"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                <span style="font-size:10px;font-weight:700;color:${meta.accent};text-transform:uppercase;letter-spacing:1px;opacity:0.8">Daily Reflection</span>
            </div>
            <div style="display:flex;gap:4px">${langBtns}</div>
        </div>
        <p style="font-size:${isAr ? '17px' : '14px'};font-weight:${isAr ? '600' : '600'};color:#0f172a;line-height:1.7;margin:0 0 ${trans ? '10px' : '0'};direction:${meta.dir};text-align:${isAr ? 'right' : 'left'};font-family:${isAr ? "'Amiri','Arabic UI','Geeza Pro',serif" : 'inherit'}">${quote}</p>
        ${trans ? `<p style="font-size:11px;color:#94a3b8;margin:0;font-style:italic;line-height:1.5">${trans}</p>` : ''}
    </div>`;
}

// Custom procedure categories
function getCustomProcedures() {
    return JSON.parse(localStorage.getItem('customProcedures')) || [];
}

function getAllProcedures() {
    let custom = getCustomProcedures();
    let all = { ...acgme };
    for (let p of custom) all[p.name] = p.required;
    return all;
}

function toggleCustomProc() {
    let form = document.getElementById('customProcForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function addCustomProcedure() {
    let name = document.getElementById('customProcInput').value.trim();
    let req  = parseInt(document.getElementById('customProcReq').value) || 10;
    if (!name) { showToast('⚠️ Enter a procedure name', 'warning'); return; }
    let custom = getCustomProcedures();
    if (custom.find(p => p.name === name) || acgme[name]) { showToast('⚠️ Procedure already exists', 'warning'); return; }
    custom.push({ name, required: req });
    localStorage.setItem('customProcedures', JSON.stringify(custom));
    document.getElementById('customProcInput').value = '';
    document.getElementById('customProcReq').value   = '';
    refreshProcedureDropdowns();
    loadCustomProcList();
    showToast('✅ Procedure added!');
}

function deleteCustomProcedure(name) {
    let custom = getCustomProcedures().filter(p => p.name !== name);
    localStorage.setItem('customProcedures', JSON.stringify(custom));
    refreshProcedureDropdowns();
    loadCustomProcList();
    showToast('🗑️ Procedure removed', 'warning');
}

function loadCustomProcList() {
    let custom = getCustomProcedures();
    let el = document.getElementById('customProcList');
    if (!el) return;
    el.innerHTML = custom.length === 0
        ? '<p style="font-size:12px; color:#94a3b8">No custom procedures yet</p>'
        : custom.map(p =>
            `<div style="background:#f1f5f9; border:2px solid #e2e8f0; padding:6px 12px; border-radius:8px; font-size:12px; display:flex; align-items:center; gap:8px">
                <span style="font-weight:700; color:#0f172a">${p.name}</span>
                <span style="color:#94a3b8">req: ${p.required}</span>
                <span onclick="deleteCustomProcedure('${p.name}')" style="color:#dc2626; cursor:pointer; font-weight:700">✕</span>
            </div>`
          ).join('');
}

function refreshProcedureDropdowns() {
    let custom   = getCustomProcedures();
    let baseOpts = ['Cataract / Phaco','Vitreoretinal (PPV)','Glaucoma','Cornea / Keratoplasty','Oculoplastics','Strabismus','Laser (LIO / SLT / YAG)'];
    let all      = [...baseOpts, ...custom.map(p => p.name)];
    ['procedure','editProcedure','filterProcedure'].forEach(id => {
        let el = document.getElementById(id);
        if (!el) return;
        let cur = el.value;
        let hasAll = id === 'filterProcedure';
        el.innerHTML = (hasAll ? '<option value="">All Procedures</option>' : '') +
            all.map(p => `<option${p === cur ? ' selected' : ''}>${p}</option>`).join('');
    });
}

// CSV Import
function importCSV() {
    let input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        let text  = await file.text();
        let lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { showToast('⚠️ CSV has no data rows', 'warning'); return; }
        showLoading();
        let { data: { user } } = await db.auth.getUser();
        let profile  = JSON.parse(localStorage.getItem('userProfile')) || {};
        let saved = 0, errors = 0;
        for (let i = 1; i < lines.length; i++) {
            let cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            let row  = {
                date:          cols[0] || getTodayStr(),
                procedure:     cols[1] || 'Cataract / Phaco',
                role:          cols[2] || 'Primary Surgeon',
                attending:     cols[3] || '',
                hospital:      cols[4] || '',
                notes:         cols[5] || '',
                resident_name: cols[6] || profile.name || '',
                pgy_year:      cols[7] || profile.pgy  || 'PGY-1',
                user_id:       user.id
            };
            let { error } = await db.from('cases').insert(row);
            if (error) errors++; else saved++;
        }
        hideLoading();
        loadCases();
        showToast(`✅ Imported ${saved} case${saved !== 1 ? 's' : ''}${errors > 0 ? ', ' + errors + ' failed' : ''}!`);
    };
    input.click();
}

function downloadCSVTemplate() {
    let header = 'date,procedure,role,attending,hospital,notes,resident_name,pgy_year';
    let example = '2026-05-14,Cataract / Phaco,Primary Surgeon,Dr. Smith,Stanford Hospital,Right eye uncomplicated,John Doe,PGY-2';
    let blob = new Blob([header + '\n' + example], { type: 'text/csv' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'eyelog-import-template.csv';
    a.click();
}

function showAnalytics() {
    let total      = allCases.length;
    let thisMonth  = getThisMonthStr();
    let monthCount = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let primary    = allCases.filter(c => c.role === 'Primary Surgeon').length;
    let primaryPct = total > 0 ? Math.round((primary / total) * 100) : 0;

    const _as = (val, label, color) =>
        `<div style="background:white;border:1px solid #E5E7EB;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:4px;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
            <span style="font-size:24px;font-weight:800;color:${color};letter-spacing:-1px;line-height:1">${val}</span>
            <span style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px">${label}</span>
        </div>`;
    document.getElementById('analyticsSummary').innerHTML =
        _as(total,       'Total Cases',  '#2563eb') +
        _as(monthCount,  'This Month',   '#0891b2') +
        _as(primaryPct+'%', 'As Primary','#16a34a');

    let months = [], monthlyCounts = [];
    for (let i = 5; i >= 0; i--) {
        let d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('default', { month: 'short' }));
        monthlyCounts.push(allCases.filter(c => c.date && c.date.startsWith(d.toISOString().slice(0,7))).length);
    }

    const chartDefaults = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9CA3AF' } },
            x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Inter' }, color: '#9CA3AF' } }
        }
    };

    if (monthlyChart) { monthlyChart.destroy(); }
    monthlyChart = new Chart(document.getElementById('monthlyChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{ data: monthlyCounts, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 2.5, fill: true, tension: 0.45, pointBackgroundColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6 }]
        },
        options: { ...chartDefaults }
    });

    // Role Split — pure HTML (same style as dashboard)
    let roleCounts = { 'Primary': 0, 'Assistant': 0, 'Observer': 0 };
    for (let c of allCases) {
        if (c.role === 'Primary Surgeon') roleCounts['Primary']++;
        else if (c.role === 'Assistant')  roleCounts['Assistant']++;
        else if (c.role === 'Observer')   roleCounts['Observer']++;
    }
    let roleColors2 = { 'Primary': '#6366f1', 'Assistant': '#0891b2', 'Observer': '#f59e0b' };
    let roleTotal2  = Object.values(roleCounts).reduce((a,b)=>a+b,0) || 1;
    let roleEl2 = document.getElementById('roleChart');
    if (roleEl2) {
        let barSegs2 = Object.entries(roleCounts).map(([r, n]) => {
            let pct = Math.round((n / roleTotal2) * 100);
            return pct > 0 ? `<div style="flex:${n};background:${roleColors2[r]};height:6px;transition:flex 0.6s" title="${r}: ${n}"></div>` : '';
        }).join('');
        let rows2 = Object.entries(roleCounts).map(([r, n]) => {
            let pct = Math.round((n / roleTotal2) * 100);
            let col = roleColors2[r];
            return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #F9FAFB">
                <div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></div>
                <span style="flex:1;font-size:12px;font-weight:600;color:#111827">${r}</span>
                <div style="width:80px;background:#F3F4F6;border-radius:99px;height:4px;overflow:hidden">
                    <div style="background:${col};width:${pct}%;height:4px;border-radius:99px"></div>
                </div>
                <span style="font-size:12px;font-weight:700;color:${col};min-width:24px;text-align:right">${n}</span>
                <span style="font-size:11px;color:#9CA3AF;min-width:30px;text-align:right">${pct}%</span>
            </div>`;
        }).join('');
        roleEl2.innerHTML = `
            <div style="display:flex;gap:2px;border-radius:6px;overflow:hidden;margin-bottom:12px;background:#F3F4F6;padding:2px;border-radius:8px">${barSegs2 || '<div style="flex:1;background:#E5E7EB;height:6px;border-radius:6px"></div>'}</div>
            ${rows2}
            <p style="font-size:11px;color:#9CA3AF;text-align:center;margin-top:10px">${roleTotal2} total case${roleTotal2!==1?'s':''}</p>`;
    }

    let dayCounts = [0,0,0,0,0,0,0];
    for (let c of allCases) { if (c.date) { dayCounts[new Date(c.date).getDay()]++; } }

    if (dayChart) { dayChart.destroy(); }
    dayChart = new Chart(document.getElementById('dayChart').getContext('2d'), {
        type: 'bar',
        data: { labels: ['Su','Mo','Tu','We','Th','Fr','Sa'], datasets: [{ data: dayCounts, backgroundColor: '#818cf8', borderRadius: 5, hoverBackgroundColor: '#6366f1' }] },
        options: { ...chartDefaults }
    });

    let monthCases = allCases.filter(c => c.date && c.date.startsWith(thisMonth));
    let procCounts = {};
    for (let c of monthCases) { procCounts[c.procedure] = (procCounts[c.procedure] || 0) + 1; }
    let sorted = Object.entries(procCounts).sort((a, b) => b[1] - a[1]);
    let html = sorted.length === 0 ? '<p style="color:#9CA3AF;font-size:12px">No cases this month yet.</p>' : '';
    for (let [proc, count] of sorted) {
        let pct = Math.round((count / monthCases.length) * 100);
        let shortProc = proc.split('/')[0].trim().split('(')[0].trim();
        html += `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F9FAFB">
            <span style="font-size:12px;font-weight:600;color:#111827;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${shortProc}</span>
            <div style="width:50px;background:#F3F4F6;border-radius:99px;height:4px;overflow:hidden"><div style="background:#6366f1;width:${pct}%;height:4px;border-radius:99px"></div></div>
            <span style="font-size:11px;font-weight:700;color:#6366f1;min-width:28px;text-align:right">${count}</span>
        </div>`;
    }
    document.getElementById('topProcedures').innerHTML = html;

    showProjections();
    showAttendingBreakdown();
    showYearComparison();
    generateInsights();
    showComplexityChart();
    showProcedureCalendar();
    // Run after all content is rendered so cards have their children
    setTimeout(initAnalyticsAccordions, 50);
}

function showProjections() {
    let now           = new Date();
    let threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0,7);
    let recentCases   = allCases.filter(c => c.date && c.date >= threeMonthsAgo);
    let allProcs      = getAllProcedures();

    let html = '';
    for (let p in allProcs) {
        let req       = allProcs[p];
        let done      = allCases.filter(c => c.procedure === p).length;
        let remaining = Math.max(0, req - done);
        let recentCount = recentCases.filter(c => c.procedure === p).length;
        let monthlyRate = recentCount / 3;

        let statusColor, statusText, barColor;
        if (remaining === 0) {
            statusColor = '#16a34a'; barColor = '#16a34a';
            statusText  = '✅ Complete!';
        } else if (monthlyRate === 0) {
            statusColor = '#94a3b8'; barColor = '#e2e8f0';
            statusText  = remaining + ' remaining — no recent cases';
        } else {
            let monthsNeeded    = remaining / monthlyRate;
            let completionDate  = new Date(now.getFullYear(), now.getMonth() + Math.ceil(monthsNeeded), 1);
            let monthsFromNow   = Math.ceil(monthsNeeded);
            statusColor = monthsNeeded <= 6 ? '#16a34a' : monthsNeeded <= 18 ? '#2563eb' : '#d97706';
            barColor    = statusColor;
            statusText  = remaining + ' left · ~' + monthsFromNow + ' mo · ' + completionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        let pct = Math.min(Math.round((done / req) * 100), 100);

        html += `<div style="margin-bottom:14px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px">
                <span style="font-size:13px; font-weight:700; color:#0f172a">${p}</span>
                <span style="font-size:12px; color:${statusColor}; font-weight:600">${statusText}</span>
            </div>
            <div style="background:#f1f5f9; border-radius:99px; height:7px">
                <div style="background:${barColor}; width:${pct}%; height:7px; border-radius:99px; transition:width 0.8s ease"></div>
            </div>
        </div>`;
    }
    document.getElementById('projections').innerHTML = html || '<p style="color:#94a3b8">Log some cases to see projections.</p>';
}

function showAttendingBreakdown() {
    let counts = {};
    for (let c of allCases) {
        if (c.attending) counts[c.attending] = (counts[c.attending] || 0) + 1;
    }
    let sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length === 0) {
        document.getElementById('attendingBreakdown').innerHTML = '<p style="color:#94a3b8">No attending data yet.</p>';
        return;
    }
    let max  = sorted[0][1];
    let html = '';
    for (let [name, count] of sorted) {
        let pct = Math.round((count / max) * 100);
        html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F9FAFB">
            <div style="width:28px;height:28px;border-radius:8px;background:#faf5ff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:13px;font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
                    <span style="font-size:12px;font-weight:700;color:#7c3aed;flex-shrink:0;margin-left:8px">${count}</span>
                </div>
                <div style="background:#F3F4F6;border-radius:99px;height:4px;overflow:hidden">
                    <div style="background:#7c3aed;width:${pct}%;height:4px;border-radius:99px"></div>
                </div>
            </div>
        </div>`;
    }
    document.getElementById('attendingBreakdown').innerHTML = html;
}

function showYearComparison() {
    let now      = new Date();
    let thisYear = now.getFullYear();
    let years    = [thisYear - 1, thisYear];
    let allProcs = getAllProcedures();

    let html = '<table style="width:100%; border-collapse:collapse; font-size:13px">';
    html += '<tr><th style="text-align:left; padding:8px 4px; color:#64748b; font-size:11px; text-transform:uppercase">Procedure</th>';
    for (let y of years) html += `<th style="text-align:center; padding:8px 4px; color:#64748b; font-size:11px; text-transform:uppercase">${y}</th>`;
    html += '<th style="text-align:center; padding:8px 4px; color:#64748b; font-size:11px; text-transform:uppercase">Change</th></tr>';

    for (let p in allProcs) {
        let counts = years.map(y => allCases.filter(c => c.procedure === p && c.date && c.date.startsWith(y)).length);
        let change = counts[1] - counts[0];
        let changeStr = change > 0 ? `<span style="color:#16a34a">+${change}</span>` : change < 0 ? `<span style="color:#dc2626">${change}</span>` : '<span style="color:#94a3b8">—</span>';
        let shortName = p.split('/')[0].trim().split('(')[0].trim();
        html += `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:10px 4px; font-weight:600; color:#0f172a">${shortName}</td>
            ${counts.map(c => `<td style="text-align:center; padding:10px 4px; color:#64748b">${c}</td>`).join('')}
            <td style="text-align:center; padding:10px 4px; font-weight:700">${changeStr}</td>
        </tr>`;
    }
    html += '</table>';
    document.getElementById('yearComparison').innerHTML = html;
}

function exportAnalyticsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let profile  = JSON.parse(localStorage.getItem('userProfile')) || {};
    let name     = profile.name    || 'Ophthalmology Resident';
    let program  = profile.program || 'Ophthalmology Program';
    let now      = new Date();
    let allProcs = getAllProcedures();

    doc.setFillColor(140,21,21); doc.rect(0,0,220,40,'F');
    doc.setFillColor(37,99,235); doc.rect(0,36,220,5,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(20); doc.setFont('helvetica','bold'); doc.text('EyeLog — Analytics Report', 14, 16);
    doc.setFontSize(11); doc.setFont('helvetica','normal');
    doc.text('Dr. ' + name + '  |  ' + program, 14, 27);
    doc.text('Generated: ' + now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}), 14, 35);

    let y = 52;
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('ACGME Progress & Projections', 14, y); y += 6;

    let threeMonthsAgo = new Date(now.getFullYear(), now.getMonth()-3, 1).toISOString().slice(0,7);
    let recentCases    = allCases.filter(c => c.date && c.date >= threeMonthsAgo);
    let rows = [];
    for (let p in allProcs) {
        let req   = allProcs[p];
        let done  = allCases.filter(c => c.procedure === p).length;
        let rem   = Math.max(0, req - done);
        let rate  = recentCases.filter(c => c.procedure === p).length / 3;
        let proj  = rem === 0 ? '✅ Done' : rate === 0 ? 'No recent cases' :
            new Date(now.getFullYear(), now.getMonth() + Math.ceil(rem/rate), 1)
                .toLocaleDateString('en-US',{month:'short',year:'numeric'});
        rows.push([p, done, req, Math.min(Math.round((done/req)*100),100)+'%', rem, proj]);
    }
    doc.autoTable({ startY:y, head:[['Procedure','Done','Req','%','Remaining','Projected']], body:rows, styles:{fontSize:8,cellPadding:3}, headStyles:{fillColor:[140,21,21],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]} });

    y = doc.lastAutoTable.finalY + 14;
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Top Attendings', 14, y); y += 4;
    let counts = {};
    for (let c of allCases) { if (c.attending) counts[c.attending] = (counts[c.attending]||0)+1; }
    let attRows = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([n,c])=>[n,c]);
    doc.autoTable({ startY:y, head:[['Attending','Cases']], body:attRows, styles:{fontSize:9,cellPadding:3}, headStyles:{fillColor:[37,99,235],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]} });

    y = doc.lastAutoTable.finalY + 14;
    let thisYear = now.getFullYear();
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Year-over-Year', 14, y); y += 4;
    let yrRows = Object.keys(allProcs).map(p => {
        let prev = allCases.filter(c=>c.procedure===p&&c.date&&c.date.startsWith(thisYear-1)).length;
        let cur  = allCases.filter(c=>c.procedure===p&&c.date&&c.date.startsWith(thisYear)).length;
        return [p.split('/')[0].trim(), prev, cur, (cur-prev>0?'+':'')+(cur-prev)];
    });
    doc.autoTable({ startY:y, head:[['Procedure',String(thisYear-1),String(thisYear),'Change']], body:yrRows, styles:{fontSize:9,cellPadding:3}, headStyles:{fillColor:[124,58,237],textColor:255,fontStyle:'bold'}, alternateRowStyles:{fillColor:[248,250,252]} });

    let pageCount = doc.internal.getNumberOfPages();
    for (let i=1;i<=pageCount;i++) {
        doc.setPage(i); doc.setFillColor(140,21,21); doc.rect(0,doc.internal.pageSize.height-12,220,12,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text('EyeLog Analytics  |  '+program, 14, doc.internal.pageSize.height-4);
        doc.text('Page '+i+' of '+pageCount, 196, doc.internal.pageSize.height-4, {align:'right'});
    }
    doc.save('eyelog-analytics-'+now.toISOString().slice(0,10)+'.pdf');
    showToast('Analytics PDF exported');
}

function displayCaseList(cases) {
    let countEl = document.getElementById('caseCount');
    if (countEl) countEl.textContent = cases.length + ' case' + (cases.length !== 1 ? 's' : '') + ' found';

    if (cases.length === 0) {
        document.getElementById('caseList').innerHTML =
            '<div style="text-align:center; padding:60px 20px; color:#94a3b8">' +
            '<div style="margin-bottom:16px;display:flex;justify-content:center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>' +
            '<p style="font-size:16px; font-weight:600; margin-bottom:8px">No cases found</p>' +
            '<p style="font-size:14px">Try adjusting your filters or log a new case</p>' +
            '</div>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:12px">';
    for (let c of cases) {
        let color     = procedureColors[c.procedure] || '#2563eb';
        let roleColor = roleColors[c.role] || '#64748b';
        let dateStr   = c.date ? new Date(c.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
        let initials  = c.procedure ? c.procedure.slice(0,2).toUpperCase() : '??';

        let ratingColor = c.pd_rating === 'Excellent' ? '#16a34a' : c.pd_rating === 'Good' ? '#2563eb' : c.pd_rating === 'Needs Work' ? '#d97706' : '#64748b';
        html += `
        <div style="background:white; border-radius:16px; padding:0; box-shadow:0 2px 12px rgba(37,99,235,0.08); border:1px solid #e2e8f0; overflow:hidden; transition:transform 0.2s, box-shadow 0.2s"
             onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 28px rgba(37,99,235,0.13)'"
             onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 12px rgba(37,99,235,0.08)'">
            <div style="height:5px; background:${color}; border-radius:16px 16px 0 0"></div>
            <div style="padding:16px 18px">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px">
                    <div style="display:flex; align-items:center; gap:12px">
                        <div style="width:44px; height:44px; border-radius:12px; background:${color}18; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:${color}; flex-shrink:0">${initials}</div>
                        <div>
                            <div style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:3px">${c.procedure}</div>
                            <div style="display:flex; gap:6px; flex-wrap:wrap">
                                <span style="background:${roleColor}18; color:${roleColor}; font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px">${c.role}</span>
                                <span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${dateStr}</span>
                                ${c.pgy_year ? `<span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px">${c.pgy_year}</span>` : ''}
                                ${c.is_teaching ? `<span style="background:#fef3c7; color:#d97706; font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:4px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>Teaching</span>` : ''}
                                ${c.pd_rating  ? `<span style="background:${ratingColor}18; color:${ratingColor}; font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px">PD: ${c.pd_rating}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0">
                        <button onclick="openEditModal('${c.id}')" title="Edit" style="background:#2563eb18;color:#2563eb;padding:7px 9px;font-size:13px;margin:0;width:auto;border-radius:8px;line-height:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onclick="duplicateCase('${c.id}')" title="Duplicate" style="background:#7c3aed18;color:#7c3aed;padding:7px 9px;font-size:13px;margin:0;width:auto;border-radius:8px;line-height:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
                        <button onclick="deleteCase('${c.id}')" title="Delete" style="background:#dc262618;color:#dc2626;padding:7px 9px;font-size:13px;margin:0;width:auto;border-radius:8px;line-height:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                    </div>
                </div>
                <div style="display:flex; gap:16px; flex-wrap:wrap; border-top:1px solid #f1f5f9; padding-top:10px">
                    ${c.attending ? `<span style="font-size:12px; color:#64748b"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><strong>${c.attending}</strong></span>` : ''}
                    ${c.hospital  ? `<span style="font-size:12px; color:#64748b"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><strong>${c.hospital}</strong></span>` : ''}
                    ${c.notes     ? `<span style="font-size:12px; color:#64748b; flex:1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:3px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>${stripComplexity(c.notes)}</span>` : ''}
                    ${parseComplexity(c.notes) !== 'Routine' ? `<span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; background:${parseComplexity(c.notes)==='Challenging'?'#fef2f2':'#fefce8'}; color:${parseComplexity(c.notes)==='Challenging'?'#dc2626':'#ca8a04'}"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${parseComplexity(c.notes)==='Challenging'?'#dc2626':'#ca8a04'};margin-right:4px;vertical-align:middle"></span>${parseComplexity(c.notes)}</span>` : ''}
                </div>
                ${c.pd_feedback ? `<div style="margin-top:10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:8px 12px">
                    <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">PD Feedback</div>
                    <div style="font-size:12px;color:#374151;line-height:1.5">${c.pd_feedback}</div>
                </div>` : ''}
                ${c.is_teaching && c.teaching_note ? `<div style="margin-top:8px;background:#fefce8;border-left:3px solid #d97706;border-radius:0 8px 8px 0;padding:8px 12px">
                    <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px">Teaching Point</div>
                    <div style="font-size:12px;color:#374151;line-height:1.5">${c.teaching_note}</div>
                </div>` : ''}
            </div>
        </div>`;
    }
    html += '</div>';
    document.getElementById('caseList').innerHTML = html;
}

// ── Saved Case Filters ────────────────────────────────────────────────────────
const SAVED_FILTERS_KEY = 'eyeSavedFilters';
function getSavedFilters() { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY)||'[]'); }
function renderSavedFiltersBar() {
    let el = document.getElementById('savedFiltersBar');
    if (!el) return;
    let filters = getSavedFilters();
    let activeId = localStorage.getItem('eyeActiveFilter')||'';
    let html = `<button onclick="clearSavedFilter()" style="padding:5px 12px;margin:0;border-radius:20px;font-size:11px;font-weight:700;box-shadow:none;${!activeId?'background:#0f172a;color:white;border:none':'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0'}">All</button>`;
    filters.forEach(f => {
        let isActive = f.id === activeId;
        html += `<div style="display:flex;align-items:center;gap:0">
            <button onclick="applySavedFilter('${f.id}')" style="padding:5px 12px;margin:0;border-radius:20px 0 0 20px;font-size:11px;font-weight:700;box-shadow:none;${isActive?'background:#2563eb;color:white;border:none':'background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-right:none'}">${f.name}</button>
            <button onclick="deleteSavedFilter('${f.id}')" style="padding:5px 8px;margin:0;border-radius:0 20px 20px 0;font-size:10px;font-weight:700;box-shadow:none;${isActive?'background:#2563eb;color:rgba(255,255,255,0.7);border:none':'background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;border-left:none'}">✕</button>
        </div>`;
    });
    html += `<button onclick="saveCurrentFilter()" style="padding:5px 12px;margin:0;border-radius:20px;font-size:11px;font-weight:600;box-shadow:none;background:transparent;color:#2563eb;border:1px dashed #93c5fd">+ Save view</button>`;
    el.innerHTML = html;
}
function saveCurrentFilter() {
    let name = prompt('Name this filter view:');
    if (!name) return;
    let proc = document.getElementById('filterProcedure')?.value || '';
    let role = document.getElementById('filterRole')?.value || '';
    let search = document.getElementById('searchNotes')?.value || '';
    let filters = getSavedFilters();
    filters.push({ id: crypto.randomUUID(), name: name.trim(), proc, role, search });
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
    renderSavedFiltersBar();
    showToast('Filter saved!');
}
function applySavedFilter(id) {
    let f = getSavedFilters().find(x=>x.id===id);
    if (!f) return;
    localStorage.setItem('eyeActiveFilter', id);
    if (document.getElementById('filterProcedure'))   document.getElementById('filterProcedure').value = f.proc||'';
    if (document.getElementById('filterRole'))   document.getElementById('filterRole').value = f.role||'';
    if (document.getElementById('searchNotes'))   document.getElementById('searchNotes').value = f.search||'';
    renderSavedFiltersBar();
    applyFilter();
}
function clearSavedFilter() {
    localStorage.removeItem('eyeActiveFilter');
    if (document.getElementById('filterProcedure'))  document.getElementById('filterProcedure').value  = '';
    if (document.getElementById('filterRole'))  document.getElementById('filterRole').value  = '';
    if (document.getElementById('searchNotes'))  document.getElementById('searchNotes').value  = '';
    renderSavedFiltersBar();
    applyFilter();
}
function deleteSavedFilter(id) {
    let filters = getSavedFilters().filter(f=>f.id!==id);
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
    if (localStorage.getItem('eyeActiveFilter')===id) localStorage.removeItem('eyeActiveFilter');
    renderSavedFiltersBar();
}

// ── Case Gallery / List view toggle ──────────────────────────────────────────
let _caseView = 'list';
function setCaseView(v) {
    _caseView = v;
    let listBtn    = document.getElementById('caseViewList');
    let galleryBtn = document.getElementById('caseViewGallery');
    let _a = {background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'};
    let _i = {background:'transparent',boxShadow:'none'};
    if (listBtn)    { Object.assign(listBtn.style, v==='list' ? _a : _i); listBtn.querySelector('svg').setAttribute('stroke', v==='list'?'#374151':'#94a3b8'); }
    if (galleryBtn) { Object.assign(galleryBtn.style, v==='gallery' ? _a : _i); galleryBtn.querySelector('svg').setAttribute('stroke', v==='gallery'?'#374151':'#94a3b8'); }
    applyFilter();
}

function _renderGallery(cases) {
    let el = document.getElementById('caseList');
    if (!el) return;
    const pColors = {'Cataract / Phaco':'#2563eb','Vitreoretinal (PPV)':'#7c3aed','Glaucoma':'#059669','Cornea / Keratoplasty':'#0891b2','Oculoplastics':'#d97706','Strabismus':'#ea580c','Laser (LIO / SLT / YAG)':'#16a34a'};
    const pBg     = {'Cataract / Phaco':'#eff6ff','Vitreoretinal (PPV)':'#faf5ff','Glaucoma':'#f0fdf4','Cornea / Keratoplasty':'#f0f9ff','Oculoplastics':'#fffbeb','Strabismus':'#fff7ed','Laser (LIO / SLT / YAG)':'#f0fdf4'};
    const roleColor = {'Primary Surgeon':'#16a34a','Assistant':'#2563eb','Supervisor':'#d97706','Observer':'#94a3b8'};
    if (!cases.length) { el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8"><p style="font-weight:600">No cases match</p></div>`; return; }
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:12px">` +
        cases.map(c => {
            let col = pColors[c.procedure]||'#64748b';
            let bg  = pBg[c.procedure]||'#f8fafc';
            let rc  = roleColor[c.role]||'#94a3b8';
            let dateStr = c.date ? new Date(c.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : '';
            return `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;cursor:pointer;transition:box-shadow 0.15s,transform 0.12s"
                onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.1)';this.style.transform='translateY(-1px)'"
                onmouseout="this.style.boxShadow='none';this.style.transform='none'">
                <div style="height:6px;background:${col}"></div>
                <div style="padding:12px">
                    <div style="font-size:11px;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;line-height:1.2">${(c.procedure||'Case').replace(' / ',' /​')}</div>
                    <div style="font-size:10px;color:white;background:${rc};border-radius:20px;padding:2px 8px;display:inline-block;font-weight:700;margin-bottom:8px">${c.role||'—'}</div>
                    <div style="font-size:11px;color:#64748b;font-weight:500">${dateStr}</div>
                    ${c.attending?`<div style="font-size:11px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Dr. ${c.attending}</div>`:''}
                </div>
            </div>`;
        }).join('') + `</div>
        <div style="text-align:center;font-size:12px;color:#94a3b8;padding:8px">${cases.length} case${cases.length!==1?'s':''}</div>`;
}

function applyFilter() {
    let search    = document.getElementById('searchNotes').value.toLowerCase();
    let procedure = document.getElementById('filterProcedure').value;
    let role      = document.getElementById('filterRole').value;
    let dateFrom  = document.getElementById('filterDateFrom').value;
    let dateTo    = document.getElementById('filterDateTo').value;
    let sort      = document.getElementById('sortOrder') ? document.getElementById('sortOrder').value : 'newest';

    let filtered = allCases.filter(c =>
        (search === '' ||
        (c.notes && c.notes.toLowerCase().includes(search)) ||
        (c.resident_name && c.resident_name.toLowerCase().includes(search)) ||
        (c.attending && c.attending.toLowerCase().includes(search)) ||
        (c.hospital && c.hospital.toLowerCase().includes(search)) ||
        (c.procedure && c.procedure.toLowerCase().includes(search))) &&
        (procedure === '' || c.procedure === procedure) &&
        (role      === '' || c.role === role) &&
        (dateFrom  === '' || c.date >= dateFrom) &&
        (dateTo    === '' || c.date <= dateTo)
    );

    if (sort === 'newest')    filtered.sort((a,b) => b.date > a.date ? 1 : -1);
    if (sort === 'oldest')    filtered.sort((a,b) => a.date > b.date ? 1 : -1);
    if (sort === 'procedure') filtered.sort((a,b) => a.procedure.localeCompare(b.procedure));
    if (sort === 'role')      filtered.sort((a,b) => a.role.localeCompare(b.role));

    if (_caseView === 'gallery') _renderGallery(filtered);
    else displayCaseList(filtered);
}

function clearFilter() {
    document.getElementById('searchNotes').value     = '';
    document.getElementById('filterProcedure').value = '';
    document.getElementById('filterRole').value      = '';
    document.getElementById('filterDateFrom').value  = '';
    document.getElementById('filterDateTo').value    = '';
    let sortEl = document.getElementById('sortOrder');
    if (sortEl) sortEl.value = 'newest';
    displayCaseList(allCases);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    let name    = profile.name    || 'Ophthalmology Resident';
    let pgy     = profile.pgy     || '';
    let program = profile.program || 'Stanford University';

    doc.setFillColor(140,21,21); doc.rect(0,0,220,45,'F');
    doc.setFillColor(37,99,235); doc.rect(0,40,220,5,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(24); doc.setFont('helvetica','bold'); doc.text('EyeLog', 14, 18);
    doc.setFontSize(13); doc.setFont('helvetica','normal'); doc.text('Ophthalmology Residency Case Log Report', 14, 30);
    doc.setFontSize(10); doc.text('Generated: ' + new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}), 14, 39);

    doc.setFillColor(248,250,252); doc.roundedRect(14,52,182,28,3,3,'F');
    doc.setDrawColor(226,232,240); doc.roundedRect(14,52,182,28,3,3,'S');
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Dr. ' + name, 22, 63);
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text(program + ' — Ophthalmology' + (pgy ? '   |   ' + pgy : ''), 22, 72);

    let totalReq   = Object.values(acgme).reduce((a,b)=>a+b,0);
    let overallPct = Math.min(Math.round((allCases.length/totalReq)*100),100);
    let thisMonth  = getThisMonthStr();
    let monthCount = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let primary    = allCases.filter(c => c.role === 'Primary Surgeon').length;

    let cardY = 88; let cardW = 42;
    let cards = [
        { label:'Total Cases',    value:allCases.length, color:[37,99,235] },
        { label:'This Month',     value:monthCount,      color:[124,58,237] },
        { label:'ACGME Progress', value:overallPct+'%',  color:[22,163,74] },
        { label:'As Primary',     value:primary,         color:[140,21,21] }
    ];
    for (let i = 0; i < cards.length; i++) {
        let x = 14 + i*(cardW+3);
        doc.setFillColor(...cards[i].color); doc.roundedRect(x,cardY,cardW,20,3,3,'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(14); doc.setFont('helvetica','bold');
        doc.text(String(cards[i].value), x+cardW/2, cardY+11, {align:'center'});
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text(cards[i].label, x+cardW/2, cardY+17, {align:'center'});
    }

    let y = 118;
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('ACGME Progress Summary', 14, y); y += 6;

    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of allCases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }

    for (let p in acgme) {
        let done = counts[p]; let req = acgme[p];
        let pct  = Math.min(Math.round((done/req)*100),100);
        let barColor = pct >= 100 ? [22,163,74] : pct >= 50 ? [37,99,235] : [217,119,6];
        doc.setTextColor(15,23,42); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text(p, 14, y+6);
        doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
        doc.text(done+' / '+req+'  ('+pct+'%)', 155, y+6, {align:'right'});
        doc.setFillColor(226,232,240); doc.roundedRect(14,y+8,182,4,2,2,'F');
        if (pct > 0) { doc.setFillColor(...barColor); doc.roundedRect(14,y+8,Math.max(182*pct/100,4),4,2,2,'F'); }
        y += 16;
    }

    y += 4;
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Case Log', 14, y); y += 4;
    doc.autoTable({
        startY:y,
        head:[['Date','Procedure','Role','Attending','Hospital','Notes']],
        body:allCases.map(c=>[c.date||'-',c.procedure||'-',c.role||'-',c.attending||'-',c.hospital||'-',c.notes||'-']),
        styles:{fontSize:8,cellPadding:4},
        headStyles:{fillColor:[140,21,21],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        columnStyles:{5:{cellWidth:40}}
    });

    let pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(140,21,21); doc.rect(0,doc.internal.pageSize.height-12,220,12,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text('EyeLog  |  '+program+'  |  Generated '+new Date().toLocaleDateString(), 14, doc.internal.pageSize.height-4);
        doc.text('Page '+i+' of '+pageCount, 196, doc.internal.pageSize.height-4, {align:'right'});
    }
    doc.save('eyelog-report-'+new Date().toISOString().slice(0,10)+'.pdf');
    showToast('PDF exported');
}

function exportMonthlyReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let profile  = JSON.parse(localStorage.getItem('userProfile')) || {};
    let name     = profile.name    || 'Ophthalmology Resident';
    let pgy      = profile.pgy     || '';
    let program  = profile.program || 'Stanford University';
    let now      = new Date();
    let thisMonth      = now.toISOString().slice(0,7);
    let lastMonth      = new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().slice(0,7);
    let monthName      = now.toLocaleString('default',{month:'long',year:'numeric'});
    let thisMonthCases = allCases.filter(c => c.date && c.date.startsWith(thisMonth));
    let lastMonthCases = allCases.filter(c => c.date && c.date.startsWith(lastMonth));

    doc.setFillColor(140,21,21); doc.rect(0,0,220,45,'F');
    doc.setFillColor(37,99,235); doc.rect(0,40,220,5,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.text('EyeLog', 14, 17);
    doc.setFontSize(13); doc.setFont('helvetica','normal'); doc.text('Monthly Progress Report — '+monthName, 14, 28);
    doc.setFontSize(9); doc.text('Generated: '+now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}), 14, 38);

    doc.setFillColor(248,250,252); doc.roundedRect(14,52,182,28,3,3,'F');
    doc.setDrawColor(226,232,240); doc.roundedRect(14,52,182,28,3,3,'S');
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('Dr. '+name, 22, 63);
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text(program+' — Ophthalmology'+(pgy ? '   |   '+pgy : ''), 22, 72);

    let totalReq   = Object.values(acgme).reduce((a,b)=>a+b,0);
    let overallPct = Math.min(Math.round((allCases.length/totalReq)*100),100);
    let cardY = 88; let cardW = 42;
    let cards = [
        { label:'This Month',  value:thisMonthCases.length, color:[37,99,235] },
        { label:'Last Month',  value:lastMonthCases.length, color:[124,58,237] },
        { label:'Total Cases', value:allCases.length,       color:[140,21,21] },
        { label:'ACGME Done',  value:overallPct+'%',        color:[22,163,74] }
    ];
    for (let i = 0; i < cards.length; i++) {
        let x = 14+i*(cardW+3);
        doc.setFillColor(...cards[i].color); doc.roundedRect(x,cardY,cardW,20,3,3,'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(14); doc.setFont('helvetica','bold');
        doc.text(String(cards[i].value), x+cardW/2, cardY+11, {align:'center'});
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text(cards[i].label, x+cardW/2, cardY+17, {align:'center'});
    }

    let y = 118;
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('This Month — Procedure Breakdown', 14, y); y += 4;
    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of thisMonthCases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }
    doc.autoTable({
        startY:y,
        head:[['Procedure','This Month','Required Total','Overall %']],
        body:Object.keys(acgme).map(p=>[p,counts[p],acgme[p],Math.min(Math.round((allCases.filter(c=>c.procedure===p).length/acgme[p])*100),100)+'%']),
        styles:{fontSize:9,cellPadding:4},
        headStyles:{fillColor:[140,21,21],textColor:255,fontStyle:'bold'},
        alternateRowStyles:{fillColor:[248,250,252]}
    });

    if (thisMonthCases.length > 0) {
        let y2 = doc.lastAutoTable.finalY + 10;
        doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
        doc.text('This Month — Case Details', 14, y2);
        doc.autoTable({
            startY:y2+4,
            head:[['Date','Procedure','Role','Attending','Hospital','Notes']],
            body:thisMonthCases.map(c=>[c.date,c.procedure,c.role,c.attending||'-',c.hospital||'-',c.notes||'-']),
            styles:{fontSize:8,cellPadding:3},
            headStyles:{fillColor:[37,99,235],textColor:255,fontStyle:'bold',fontSize:8},
            alternateRowStyles:{fillColor:[248,250,252]},
            columnStyles:{5:{cellWidth:40}}
        });
    }

    let pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(140,21,21); doc.rect(0,doc.internal.pageSize.height-12,220,12,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text('EyeLog  |  '+program+'  |  Monthly Report '+monthName, 14, doc.internal.pageSize.height-4);
        doc.text('Page '+i+' of '+pageCount, 196, doc.internal.pageSize.height-4, {align:'right'});
    }
    doc.save('eyelog-monthly-'+thisMonth+'.pdf');
    showToast('Monthly report exported');
}

// PWA Install
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (localStorage.getItem('installBannerDismissed') !== 'true') {
        let banner = document.getElementById('installBanner');
        if (banner) banner.style.display = 'flex';
    }
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    let banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
    showToast('✅ EyeLog installed!');
});

async function installPWA() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    let { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('installBanner').style.display = 'none';
    if (outcome === 'accepted') showToast('✅ App installed!');
}

function dismissInstallBanner() {
    document.getElementById('installBanner').style.display = 'none';
    localStorage.setItem('installBannerDismissed', 'true');
}

// Notifications
function updateNotifStatus() {
    let el = document.getElementById('notifStatus');
    if (!el) return;
    if (!('Notification' in window)) {
        el.textContent = '⚠️ Notifications not supported on this browser.';
    } else if (Notification.permission === 'granted' && localStorage.getItem('notificationsEnabled') === 'true') {
        el.textContent = '✅ Daily reminders are enabled (6 PM if no case logged).';
        el.style.color = '#16a34a';
    } else if (Notification.permission === 'denied') {
        el.textContent = '🚫 Notifications are blocked. Enable them in your browser settings.';
        el.style.color = '#dc2626';
    } else {
        el.textContent = 'Not enabled — tap Enable to get daily case reminders.';
        el.style.color = '';
    }
}

async function setupNotifications() {
    if (!('Notification' in window)) { showToast('Notifications not supported', 'error'); return; }
    let permission = await Notification.requestPermission();
    if (permission === 'granted') {
        localStorage.setItem('notificationsEnabled', 'true');
        showToast('Daily reminders enabled');
        scheduleReminder();
    } else {
        showToast('Notifications blocked — check browser settings', 'warning');
    }
    updateNotifStatus();
}

function disableNotifications() {
    localStorage.setItem('notificationsEnabled', 'false');
    showToast('🔕 Reminders disabled', 'warning');
    updateNotifStatus();
}

function checkDailyReminder() {
    if (localStorage.getItem('notificationsEnabled') !== 'true') return;
    if (Notification.permission !== 'granted') return;
    let now = new Date();
    let lastReminder = localStorage.getItem('lastReminder');
    let today = now.toDateString();
    if (now.getHours() >= 18 && lastReminder !== today) {
        localStorage.setItem('lastReminder', today);
        new Notification('EyeLog Reminder 🏥', { body: "Don't forget to log your cases today!", icon: '/icon.svg' });
    }
}

function scheduleReminder() {
    checkDailyReminder();
    setInterval(checkDailyReminder, 60 * 60 * 1000);
}

// ── Complexity Helpers ───────────────────────────────────────────────────────
function parseComplexity(notes) {
    let m = (notes || '').match(/\[COMP:(Routine|Complex|Challenging)\]/);
    return m ? m[1] : 'Routine';
}
function stripComplexity(notes) {
    return (notes || '').replace(/\s*\[COMP:(Routine|Complex|Challenging)\]/g, '').trim();
}

// ── AI Insights Engine ───────────────────────────────────────────────────────
function generateInsights() {
    let el = document.getElementById('aiInsights');
    if (!el) return;
    if (allCases.length === 0) { el.innerHTML = '<p style="color:#94a3b8; font-size:13px">Log at least 5 cases to unlock AI insights.</p>'; return; }

    let insights = [];
    let now = new Date();
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};

    let procCounts = {};
    for (let p in acgme) procCounts[p] = allCases.filter(c => c.procedure === p).length;
    let sorted = Object.entries(procCounts).sort((a,b) => b[1]-a[1]);
    let strongest = sorted[0], weakest = sorted[sorted.length-1];
    let strongPct = Math.round((strongest[1]/acgme[strongest[0]])*100);
    let weakPct   = Math.round((weakest[1]/acgme[weakest[0]])*100);
    const _isvg = (path, vb) => `<svg width="14" height="14" viewBox="${vb||'0 0 24 24'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    insights.push({ icon:_isvg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'), color:'#16a34a', bg:'#f0fdf4', text:'Your strongest area is <strong>'+strongest[0].split('/')[0].trim()+'</strong> ('+strongPct+'% of ACGME goal). Keep it up!' });
    if (weakest[1] === 0) {
        insights.push({ icon:_isvg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'), color:'#dc2626', bg:'#fef2f2', text:'You have <strong>zero</strong> '+weakest[0].split('/')[0].trim()+' cases logged. This is your biggest gap — prioritize it next.' });
    } else {
        insights.push({ icon:_isvg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'), color:'#d97706', bg:'#fffbeb', text:'Focus on <strong>'+weakest[0].split('/')[0].trim()+'</strong> — only '+weakPct+'% complete. Consider requesting more of these cases.' });
    }

    let thisMonth = now.toISOString().slice(0,7);
    let lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    let thisMo = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let lastMo = allCases.filter(c => c.date && c.date.startsWith(lastMonth)).length;
    if (lastMo > 0) {
        let trend = thisMo - lastMo;
        if (trend > 0) insights.push({ icon:_isvg('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'), color:'#2563eb', bg:'#eff6ff', text:'You logged <strong>'+trend+' more</strong> case'+(trend>1?'s':'')+' this month than last — great momentum!' });
        else if (trend < 0) insights.push({ icon:_isvg('<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>'), color:'#d97706', bg:'#fffbeb', text:'Case volume dropped by <strong>'+Math.abs(trend)+'</strong> this month vs last. Try to schedule more OR time.' });
        else insights.push({ icon:_isvg('<line x1="5" y1="12" x2="19" y2="12"/>'), color:'#64748b', bg:'#f8fafc', text:'Consistent pace — same number of cases as last month. Can you push for more?' });
    }

    let primaryPct = Math.round((allCases.filter(c=>c.role==='Primary Surgeon').length / allCases.length)*100);
    if (primaryPct < 30) insights.push({ icon:_isvg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'), color:'#dc2626', bg:'#fef2f2', text:'Only <strong>'+primaryPct+'%</strong> of your cases are as Primary Surgeon. Push to operate more independently.' });
    else if (primaryPct >= 60) insights.push({ icon:_isvg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'), color:'#16a34a', bg:'#f0fdf4', text:'<strong>'+primaryPct+'%</strong> of cases as Primary Surgeon — excellent independence!' });

    let challenging = allCases.filter(c=>parseComplexity(c.notes)==='Challenging').length;
    let complex     = allCases.filter(c=>parseComplexity(c.notes)==='Complex').length;
    let compPct = Math.round(((challenging+complex)/allCases.length)*100);
    if (compPct >= 20) insights.push({ icon:_isvg('<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'), color:'#7c3aed', bg:'#faf5ff', text:'<strong>'+compPct+'%</strong> of your cases are Complex or Challenging — you\'re taking on high-acuity surgical experience.' });

    if (profile.endYear) {
        let monthsLeft = Math.max(1,(new Date(parseInt(profile.endYear),5,30)-now)/(1000*60*60*24*30.44));
        let remaining  = Math.max(0,Object.values(acgme).reduce((a,b)=>a+b,0)-allCases.length);
        insights.push({ icon:_isvg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>'), color:'#0891b2', bg:'#f0f9ff', text:'<strong>'+Math.round(monthsLeft)+' months</strong> until graduation. You need ~<strong>'+(remaining/monthsLeft).toFixed(1)+' cases/month</strong> to complete all ACGME requirements.' });
    }

    el.innerHTML = insights.map(ins =>
        '<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;background:'+ins.bg+';border-radius:12px;margin-bottom:10px;border-left:3px solid '+ins.color+'">' +
        '<div style="width:28px;height:28px;border-radius:8px;background:'+ins.color+'18;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+ins.icon+'</div>' +
        '<p style="font-size:13px;color:#0f172a;line-height:1.5;margin:0">'+ins.text+'</p></div>'
    ).join('');
}

// ── Peer Benchmarking ────────────────────────────────────────────────────────
async function showPeerBenchmark() {
    let el = document.getElementById('peerBenchmark');
    if (!el) return;
    el.innerHTML = '<p style="color:#64748b;font-size:13px;text-align:center;padding:12px 0">Loading cohort data…</p>';

    let { data: { user } } = await db.auth.getUser();
    let domain   = user.email.split('@')[1] || '';
    let thisMonth = getThisMonthStr();
    let myTotal   = allCases.length;
    let myMonthly = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let myPrimary = allCases.filter(c => c.role === 'Primary Surgeon').length;
    let myPrimaryPct = myTotal > 0 ? Math.round((myPrimary / myTotal) * 100) : 0;

    // Try the secure RPC first (domain-filtered, security definer)
    let bench = null;
    let { data: rpcData, error: rpcError } = await db.rpc('get_program_benchmarks', { user_domain: domain });
    if (!rpcError && rpcData) {
        bench = rpcData;
    } else {
        // Fallback: direct query (works if RLS allows reading all cases)
        let { data: allProgramCases, error: qErr } = await db.from('cases').select('user_id, procedure, role, date');
        if (!qErr && allProgramCases && allProgramCases.length > 0) {
            let peers = [...new Set(allProgramCases.map(c => c.user_id).filter(id => id !== user.id))];
            let totalCases = allProgramCases.length;
            let primaryCases = allProgramCases.filter(c => c.role === 'Primary Surgeon').length;
            let monthCases = allProgramCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
            bench = {
                total_residents: peers.length + 1,
                total_cases: totalCases,
                avg_cases_per_resident: peers.length > 0 ? Math.round(totalCases / (peers.length + 1)) : myTotal,
                primary_pct: totalCases > 0 ? Math.round((primaryCases / totalCases) * 100) : 0,
                cases_this_month: peers.length > 0 ? Math.round(monthCases / (peers.length + 1)) : myMonthly
            };
        }
    }

    if (!bench) {
        // ── Fallback: National ACGME benchmark estimates
        // Source: ACGME Ophthalmology case log data (national averages)
        // Phaco avg: ~86 by graduation (4-yr program), ~6-8/month peak years
        // Total cases: ~250 average graduate, ~200 minimum
        let profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        // Residencies typically start July 1
        let startDate = profile.startYear ? new Date(profile.startYear + '-07-01') : null;
        let monthsIn  = startDate ? Math.max(1, Math.round((new Date() - startDate) / (1000*60*60*24*30.4))) : 18;
        let clampedMonths = Math.min(monthsIn, 48);

        // Linear interpolation of national averages across 48-month residency
        // Total cases target: 250 over 48 months ≈ 5.2/month
        let natAvgTotal   = Math.round(clampedMonths * 5.2);
        let natAvgMonthly = 8; // peak year avg
        let natPrimaryPct = 65;
        // Phaco: ~2.5/month average over residency
        let myPhacos = allCases.filter(c => c.procedure && c.procedure.toLowerCase().includes('phaco')).length;
        let natPhaco = Math.round(clampedMonths * 2.5);

        const _brow = (label, myVal, cohortVal, unit = '', higherIsBetter = true) => {
            let m = parseFloat(myVal), c2 = parseFloat(cohortVal);
            let better = higherIsBetter ? m >= c2 : m <= c2;
            let col  = better ? '#16a34a' : '#d97706';
            let diff = m - c2;
            let sign = diff >= 0 ? '+' : '';
            return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #F9FAFB">
                <span style="flex:1;font-size:12px;font-weight:600;color:#374151">${label}</span>
                <span style="font-size:14px;font-weight:800;color:${col}">${myVal}${unit}</span>
                <span style="font-size:11px;color:#9CA3AF">vs ${cohortVal}${unit} nat'l avg</span>
                <span style="font-size:11px;font-weight:700;color:${col}">${sign}${Math.round(diff)}${unit}</span>
            </div>`;
        };

        let summaryText = myTotal >= natAvgTotal
            ? `You're <strong>ahead of</strong> the national average by ${myTotal - natAvgTotal} cases 🎯`
            : `You're <strong>${natAvgTotal - myTotal} cases behind</strong> the national average at this point in training`;

        el.innerHTML = `
            <div style="background:#fffbeb;border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style="font-size:12px;color:#92400e;font-weight:600;margin:0">National ACGME averages · ${monthsIn} months into training · opt-in program data coming soon</p>
            </div>
            <p style="font-size:13px;color:#374151;margin-bottom:14px;line-height:1.5">${summaryText}</p>
            ${_brow('Total cases', myTotal, natAvgTotal)}
            ${_brow('Phaco cases', myPhacos, natPhaco)}
            ${_brow('Cases this month', myMonthly, natAvgMonthly)}
            ${_brow('As Primary Surgeon', myPrimaryPct, natPrimaryPct, '%')}
            <p style="font-size:10px;color:#9CA3AF;text-align:center;margin-top:12px">📊 Based on ACGME national case log data. Real-time program benchmarking available when your program connects to EyeLog.</p>`;
        return;
    }

    const _brow = (label, myVal, cohortVal, unit = '', higherIsBetter = true) => {
        let m = parseFloat(myVal), c2 = parseFloat(cohortVal);
        let better = higherIsBetter ? m >= c2 : m <= c2;
        let col    = better ? '#16a34a' : '#d97706';
        let arrow  = better ? '↑' : '↓';
        return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #F9FAFB">
            <span style="flex:1;font-size:12px;font-weight:600;color:#374151">${label}</span>
            <span style="font-size:14px;font-weight:800;color:${col}">${myVal}${unit}</span>
            <span style="font-size:11px;color:#9CA3AF">vs ${cohortVal}${unit} avg</span>
            <span style="font-size:13px;font-weight:700;color:${col}">${arrow}</span>
        </div>`;
    };

    let html = `
        <div style="background:#eff6ff;border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <p style="font-size:12px;color:#1d4ed8;font-weight:600;margin:0">${bench.total_residents} resident${bench.total_residents !== 1 ? 's' : ''} · ${bench.total_cases} cases logged · data anonymous</p>
        </div>
        ${_brow('Cases this month', myMonthly, bench.cases_this_month)}
        ${_brow('Total cases logged', myTotal, bench.avg_cases_per_resident)}
        ${_brow('As Primary Surgeon', myPrimaryPct + '%', bench.primary_pct + '%', '', true)}
        <p style="font-size:10px;color:#9CA3AF;text-align:center;margin-top:12px">Only aggregated counts are used — no individual names or records are exposed</p>`;

    el.innerHTML = html;
}

// ── Complexity Progression Chart ─────────────────────────────────────────────
function showComplexityChart() {
    let canvas    = document.getElementById('complexityChart');
    let summaryEl = document.getElementById('complexitySummary');
    if (!canvas) return;

    let months = [], routineData = [], complexData = [], challengingData = [];
    let now = new Date();
    for (let i = 5; i >= 0; i--) {
        let d  = new Date(now.getFullYear(), now.getMonth()-i, 1);
        let mo = d.toISOString().slice(0,7);
        let moCases = allCases.filter(c => c.date && c.date.startsWith(mo));
        months.push(d.toLocaleString('default',{month:'short'}));
        routineData.push(moCases.filter(c=>parseComplexity(c.notes)==='Routine').length);
        complexData.push(moCases.filter(c=>parseComplexity(c.notes)==='Complex').length);
        challengingData.push(moCases.filter(c=>parseComplexity(c.notes)==='Challenging').length);
    }

    if (complexityChart) complexityChart.destroy();
    complexityChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: months, datasets: [
            { label:'Routine',     data:routineData,     backgroundColor:'#6ee7b7', borderRadius:3 },
            { label:'Complex',     data:complexData,     backgroundColor:'#fcd34d', borderRadius:3 },
            { label:'Challenging', data:challengingData, backgroundColor:'#f87171', borderRadius:3 }
        ]},
        options: { responsive:true, scales:{
            x:{stacked:true,grid:{display:false},ticks:{font:{size:9,family:'Inter'},color:'#9CA3AF'}},
            y:{stacked:true,beginAtZero:true,grid:{color:'#F3F4F6'},ticks:{font:{size:9,family:'Inter'},color:'#9CA3AF'}}
        }, plugins:{legend:{position:'bottom',labels:{font:{size:10,family:'Inter'},boxWidth:8,boxHeight:8,padding:8}}} }
    });

    let totR  = allCases.filter(c=>parseComplexity(c.notes)==='Routine').length;
    let totC  = allCases.filter(c=>parseComplexity(c.notes)==='Complex').length;
    let totCh = allCases.filter(c=>parseComplexity(c.notes)==='Challenging').length;
    let tot   = allCases.length || 1;
    if (summaryEl) {
        summaryEl.innerHTML =
            '<div style="display:flex;gap:6px;margin-top:4px">' +
            `<div style="flex:1;background:#f0fdf4;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:#059669">${totR}</div><div style="font-size:10px;color:#9CA3AF;font-weight:600">${Math.round(totR/tot*100)}%</div><div style="font-size:10px;color:#6B7280">Routine</div></div>` +
            `<div style="flex:1;background:#fffbeb;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:#d97706">${totC}</div><div style="font-size:10px;color:#9CA3AF;font-weight:600">${Math.round(totC/tot*100)}%</div><div style="font-size:10px;color:#6B7280">Complex</div></div>` +
            `<div style="flex:1;background:#fef2f2;border-radius:8px;padding:8px;text-align:center"><div style="font-size:16px;font-weight:800;color:#dc2626">${totCh}</div><div style="font-size:10px;color:#9CA3AF;font-weight:600">${Math.round(totCh/tot*100)}%</div><div style="font-size:10px;color:#6B7280">Challenging</div></div>` +
            '</div>';
    }
}

// ── Smart OR Calendar ────────────────────────────────────────────────────────
function showProcedureCalendar() {
    let el = document.getElementById('procedureCalendar');
    if (!el) return;

    let profile    = JSON.parse(localStorage.getItem('userProfile')) || {};
    let endYear    = parseInt(profile.endYear);
    let now        = new Date();
    let monthsLeft = endYear ? Math.max(1,(new Date(endYear,5,30)-now)/(1000*60*60*24*30.44)) : 24;

    let urgency = {};
    for (let p in acgme) {
        let done = allCases.filter(c=>c.procedure===p).length;
        urgency[p] = Math.max(0, acgme[p]-done) / monthsLeft;
    }
    let ranked = Object.entries(urgency).sort((a,b)=>b[1]-a[1]);

    let year  = now.getFullYear(), month = now.getMonth();
    let firstDay = new Date(year,month,1).getDay();
    let daysInMonth = new Date(year,month+1,0).getDate();
    let monthName = now.toLocaleString('default',{month:'long',year:'numeric'});
    let colors = ['#2563eb','#7c3aed','#16a34a','#d97706','#0891b2','#dc2626','#8C1515'];
    let procColor = {};
    Object.keys(acgme).forEach((p,i)=>{ procColor[p]=colors[i%colors.length]; });

    let weeks = [];
    let d = 1 - firstDay;
    for (let w = 0; w < 6; w++) {
        let week = []; let hasDay = false;
        for (let dow = 0; dow < 7; dow++, d++) {
            if (d < 1 || d > daysInMonth) { week.push(null); continue; }
            hasDay = true;
            let moCases = allCases.filter(c => {
                if (!c.date) return false;
                let cd = new Date(c.date);
                return cd.getFullYear()===year && cd.getMonth()===month && cd.getDate()===d;
            });
            week.push({ d, isToday: d===now.getDate(), cases: moCases });
        }
        if (hasDay) weeks.push(week);
    }

    let weekFocus = weeks.map((_,wi) => {
        let top = ranked.slice(0,4);
        return [top[wi%top.length][0], top[(wi+1)%top.length][0]].filter(Boolean);
    });

    let html = '<div style="font-weight:700;color:#0f172a;margin-bottom:12px;text-align:center;font-size:15px">'+monthName+'</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">';
    for (let day of ['Su','Mo','Tu','We','Th','Fr','Sa']) {
        html += '<div style="text-align:center;font-size:10px;font-weight:700;color:#94a3b8;padding:4px 0">'+day+'</div>';
    }
    html += '</div>';

    weeks.forEach((week, wi) => {
        html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">';
        week.forEach(day => {
            if (!day) { html += '<div></div>'; return; }
            let bg = day.isToday ? '#2563eb' : day.cases.length>0 ? '#dcfce7' : '#f8fafc';
            let tc = day.isToday ? 'white' : '#0f172a';
            html += '<div style="background:'+bg+';border-radius:8px;padding:6px 4px;text-align:center;min-height:36px;border:'+(day.isToday?'2px solid #1d4ed8':'1px solid #e2e8f0')+'">' +
                '<div style="font-size:12px;font-weight:'+(day.isToday?900:600)+';color:'+tc+'">'+day.d+'</div>' +
                (day.cases.length>0?'<div style="font-size:9px;color:#16a34a;font-weight:700">✓'+day.cases.length+'</div>':'') + '</div>';
        });
        html += '</div>';
        let focus = weekFocus[wi];
        if (focus.length>0) {
            let banners = focus.map(p => {
                let short = p.split('/')[0].trim().split('(')[0].trim();
                let rem   = Math.max(0, acgme[p]-allCases.filter(c=>c.procedure===p).length);
                return '<span style="background:'+procColor[p]+'18;color:'+procColor[p]+';font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid '+procColor[p]+'40">'+short+' ('+rem+' left)</span>';
            }).join(' ');
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:6px 4px;margin-bottom:4px"><span style="font-size:10px;color:#94a3b8;font-weight:600">Focus:</span>'+banners+'</div>';
        }
    });

    html += '<div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#64748b">' +
        '<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;background:#dcfce7;border-radius:3px;display:inline-block;border:1px solid #e2e8f0"></span> Case logged</span>' +
        '<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;background:#2563eb;border-radius:3px;display:inline-block"></span> Today</span></div>';
    el.innerHTML = html;
}

// ── Fellowship Application PDF ───────────────────────────────────────────────
function exportFellowshipPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let profile   = JSON.parse(localStorage.getItem('userProfile')) || {};
    let name      = profile.name      || 'Ophthalmology Resident';
    let pgy       = profile.pgy       || '';
    let program   = profile.program   || 'Stanford University';
    let goals     = profile.goals     || '';
    let startYear = profile.startYear || '';
    let endYear   = profile.endYear   || '';
    let now       = new Date();
    let totalReq  = Object.values(acgme).reduce((a,b)=>a+b,0);
    let overallPct = Math.min(Math.round((allCases.length/totalReq)*100),100);

    // Cover
    doc.setFillColor(140,21,21); doc.rect(0,0,210,80,'F');
    doc.setFillColor(37,99,235); doc.rect(0,75,210,6,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.text('OPHTHALMOLOGY RESIDENCY', 14, 22);
    doc.setFontSize(26); doc.setFont('helvetica','bold');
    doc.text('Fellowship Application', 14, 38); doc.text('Case Portfolio', 14, 50);
    doc.setFontSize(11); doc.setFont('helvetica','normal');
    doc.text('Prepared by EyeLog  ·  '+now.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}), 14, 62);

    doc.setFillColor(248,250,252); doc.roundedRect(14,90,182,35,4,4,'F');
    doc.setDrawColor(226,232,240); doc.roundedRect(14,90,182,35,4,4,'S');
    doc.setTextColor(15,23,42); doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text('Dr. '+name, 22, 103);
    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
    doc.text(program+' — Ophthalmology'+(pgy?'   ·   '+pgy:''), 22, 112);
    if (startYear && endYear) doc.text('Residency '+startYear+' – '+endYear, 22, 120);

    let stats = [
        {label:'Total Cases',   val:allCases.length},
        {label:'ACGME Progress',val:overallPct+'%'},
        {label:'As Primary',    val:allCases.filter(c=>c.role==='Primary Surgeon').length},
        {label:'Attendings',    val:[...new Set(allCases.map(c=>c.attending).filter(Boolean))].length}
    ];
    let sx=14,sy=135,sw=43;
    for (let s of stats) {
        doc.setFillColor(37,99,235); doc.roundedRect(sx,sy,sw,22,3,3,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
        doc.text(String(s.val), sx+sw/2, sy+11, {align:'center'});
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text(s.label, sx+sw/2, sy+18, {align:'center'});
        sx += sw+3;
    }

    let y = 168;
    doc.setTextColor(15,23,42); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('ACGME Requirement Progress', 14, y); y += 8;
    let counts = {};
    for (let p in acgme) { counts[p] = allCases.filter(c=>c.procedure===p).length; }
    for (let p in acgme) {
        let done=counts[p], req=acgme[p], pct=Math.min(Math.round((done/req)*100),100);
        let barC = pct>=100?[22,163,74]:pct>=50?[37,99,235]:[217,119,6];
        doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(15,23,42); doc.text(p, 14, y+5);
        doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
        doc.text(done+' / '+req+'  ('+pct+'%)', 165, y+5, {align:'right'});
        doc.setFillColor(226,232,240); doc.roundedRect(14,y+7,152,4,2,2,'F');
        if (pct>0){doc.setFillColor(...barC); doc.roundedRect(14,y+7,Math.max(152*pct/100,3),4,2,2,'F');}
        y+=16; if(y>270){doc.addPage(); y=20;}
    }

    if (goals) {
        y += 4;
        doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(15,23,42);
        doc.text('Personal Statement & Goals', 14, y); y += 8;
        doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
        let lines = doc.splitTextToSize(goals, 182);
        doc.text(lines, 14, y);
    }

    // Case table page
    doc.addPage();
    doc.setFillColor(140,21,21); doc.rect(0,0,210,22,'F');
    doc.setFillColor(37,99,235); doc.rect(0,19,210,3,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Complete Case Log', 14, 14);
    doc.autoTable({
        startY: 28,
        head: [['Date','Procedure','Role','Attending','Institution','Complexity']],
        body: allCases.slice(0,200).map(c=>[
            c.date||'-',
            (c.procedure||'-').split('/')[0].trim().split('(')[0].trim(),
            c.role==='Primary Surgeon'?'Primary':c.role||'-',
            c.attending||'-', c.hospital||'-',
            parseComplexity(c.notes)
        ]),
        styles:{fontSize:8,cellPadding:3},
        headStyles:{fillColor:[37,99,235],textColor:255,fontStyle:'bold',fontSize:8},
        alternateRowStyles:{fillColor:[248,250,252]},
        columnStyles:{0:{cellWidth:24},1:{cellWidth:42},2:{cellWidth:26},3:{cellWidth:38},4:{cellWidth:36},5:{cellWidth:22}}
    });

    let pages = doc.internal.getNumberOfPages();
    for (let i=1;i<=pages;i++) {
        doc.setPage(i);
        doc.setFillColor(140,21,21); doc.rect(0,doc.internal.pageSize.height-12,210,12,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text('Dr. '+name+'  ·  '+program+'  ·  Fellowship Application Portfolio', 14, doc.internal.pageSize.height-4);
        doc.text('Page '+i+' of '+pages, 196, doc.internal.pageSize.height-4, {align:'right'});
    }
    doc.save('fellowship-portfolio-'+name.replace(/\s+/g,'-').toLowerCase()+'.pdf');
    showToast('Fellowship PDF exported');
}

// ── Smart Gap Alerts ────────────────────────────────────────────────────────
function checkSmartAlerts(cases) {
    let banner = document.getElementById('smartAlertsBanner');
    if (!banner) return;

    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    let endYear = parseInt(profile.endYear);
    if (!endYear || isNaN(endYear)) { banner.style.display = 'none'; return; }

    let now = new Date();
    let graduation = new Date(endYear, 5, 30); // June 30 of graduation year
    let monthsLeft = Math.max(0, (graduation - now) / (1000 * 60 * 60 * 24 * 30.44));

    let threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 7);
    let recentCases = cases.filter(c => c.date && c.date >= threeMonthsAgo);
    let alerts = [];

    for (let proc in acgme) {
        let req = acgme[proc];
        let done = cases.filter(c => c.procedure === proc).length;
        let remaining = Math.max(0, req - done);
        if (remaining === 0) continue;

        let recentRate = recentCases.filter(c => c.procedure === proc).length / 3; // per month
        if (recentRate <= 0) {
            if (remaining > 0 && monthsLeft < 12) {
                alerts.push({ proc, remaining, color: '#dc2626', icon: '🚨', label: 'Critical — no recent cases' });
            }
        } else {
            let monthsNeeded = remaining / recentRate;
            if (monthsNeeded > monthsLeft * 0.9) {
                let isRed = monthsNeeded > monthsLeft;
                alerts.push({ proc, remaining, monthsNeeded: Math.round(monthsNeeded), color: isRed ? '#dc2626' : '#d97706', icon: isRed ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', label: isRed ? 'At risk — behind pace' : 'Behind — needs attention' });
            }
        }
    }

    if (alerts.length === 0) { banner.style.display = 'none'; return; }

    let html = '<div style="background:white; border-radius:14px; padding:16px; border:2px solid #fca5a5; box-shadow:0 2px 12px rgba(220,38,38,0.1)">';
    html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><strong style="color:#dc2626; font-size:14px">ACGME Gap Alerts</strong><span style="font-size:12px; color:#64748b; margin-left:auto">' + Math.round(monthsLeft) + ' months left</span></div>';
    for (let a of alerts) {
        let short = a.proc.split('/')[0].trim().split('(')[0].trim();
        html += '<div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-top:1px solid #f1f5f9">';
        html += '<span>' + a.icon + '</span>';
        html += '<div style="flex:1"><strong style="font-size:13px; color:#0f172a">' + short + '</strong><br><span style="font-size:11px; color:#64748b">' + a.label + ' — ' + a.remaining + ' cases needed</span></div>';
        html += '<span style="font-size:11px; font-weight:700; color:' + a.color + '">' + (a.monthsNeeded ? a.monthsNeeded + 'mo' : '—') + '</span>';
        html += '</div>';
    }
    html += '</div>';
    banner.innerHTML = html;
    banner.style.display = 'block';
}

// ── Voice Logging ────────────────────────────────────────────────────────────
let _voiceRec = null;
let _voiceActive = false;
let _vfLang = 'en-US'; // current voice language — toggled by user

function toggleVoiceLang(lang) {
    _vfLang = lang;
    const enBtn = document.getElementById('vlangEN');
    const arBtn = document.getElementById('vlangAR');
    const liveText = document.getElementById('voiceLiveText');
    if (enBtn) {
        const active   = { background: '#0f172a', color: 'white' };
        const inactive = { background: '#f1f5f9', color: '#64748b' };
        Object.assign(enBtn.style, lang === 'en-US' ? active : inactive);
        Object.assign(arBtn.style, lang === 'ar-SA' ? active : inactive);
    }
    if (liveText) {
        liveText.dir         = lang === 'ar-SA' ? 'rtl' : 'ltr';
        liveText.style.textAlign = lang === 'ar-SA' ? 'right' : 'left';
        liveText.placeholder = lang === 'ar-SA' ? 'جارٍ الاستماع…' : 'Listening…';
    }
}

// Universal voice fill — shows floating overlay with live transcript
let _vfRec = null, _vfTargetId = null, _vfBtn = null, _vfAccumulated = '';

function startVoiceFill(targetId, btnEl) {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        showToast('⚠️ Voice not supported — use Chrome or Safari', 'error'); return;
    }
    if (_vfRec) { stopVoiceFill(); return; }

    _vfTargetId = targetId;
    _vfBtn = btnEl;
    _vfAccumulated = '';

    let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _vfRec = new SR();
    _vfRec.lang = _vfLang;
    _vfRec.interimResults = true;
    _vfRec.continuous = true;
    _vfRec.maxAlternatives = 1;

    // Show overlay
    let overlay = document.getElementById('voiceOverlay');
    let liveText = document.getElementById('voiceLiveText');
    if (overlay) overlay.style.display = 'block';
    if (liveText) {
        liveText.textContent = _vfLang === 'ar-SA' ? 'جارٍ الاستماع…' : 'Listening…';
        liveText.dir = _vfLang === 'ar-SA' ? 'rtl' : 'ltr';
        liveText.style.textAlign = _vfLang === 'ar-SA' ? 'right' : 'left';
    }
    // mark btn as active — red mic
    btnEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#dc2626" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
    btnEl.style.background = '#fef2f2'; btnEl.style.borderColor = '#fca5a5';

    _vfRec.onresult = (e) => {
        let interim = '';
        let newFinal = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            let t = e.results[i][0].transcript;
            if (e.results[i].isFinal) newFinal += t;
            else interim += t;
        }
        if (newFinal) _vfAccumulated += (_vfAccumulated ? ' ' : '') + newFinal.trim();
        if (liveText) liveText.textContent = (_vfAccumulated + (interim ? ' ' + interim : '')) || 'Listening…';
    };

    _vfRec.onerror = (e) => {
        let msg = {'not-allowed':'Mic permission denied — allow in browser settings','no-speech':'No speech detected','network':'Network error','audio-capture':'No microphone found'}[e.error] || e.error;
        showToast('⚠️ ' + msg, 'error');
        _cleanupVoiceFill(false);
    };

    _vfRec.onend = () => {
        if (_vfAccumulated) {
            let el = document.getElementById(_vfTargetId);
            if (el) {
                if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                    el.value = el.value ? el.value + ' ' + _vfAccumulated : _vfAccumulated;
                } else {
                    el.focus();
                    let sel = window.getSelection();
                    if (!sel.rangeCount) { let r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
                    document.execCommand('insertText', false, (el.textContent.trim() ? ' ' : '') + _vfAccumulated);
                }
                el.focus();
            }
        }
        _cleanupVoiceFill(true);
    };

    try { _vfRec.start(); }
    catch(e) { showToast('⚠️ ' + e.message, 'error'); _cleanupVoiceFill(false); }
}

function stopVoiceFill() {
    if (_vfRec) { try { _vfRec.stop(); } catch(e) {} }
}

function _cleanupVoiceFill(saved) {
    if (saved && _vfAccumulated) showToast('✅ Saved: "' + _vfAccumulated.slice(0, 60) + ((_vfAccumulated.length > 60) ? '…' : '') + '"');
    _vfRec = null; _vfAccumulated = '';
    let overlay = document.getElementById('voiceOverlay');
    if (overlay) overlay.style.display = 'none';
    if (_vfBtn) {
        _vfBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
        _vfBtn.style.background = '#eff6ff'; _vfBtn.style.borderColor = '#bfdbfe'; _vfBtn.style.color = '';
        _vfBtn = null;
    }
}

function startVoiceLog() {
    let statusEl = document.getElementById('voiceStatus');
    let voiceBtn = document.getElementById('voiceBtn');

    const _micSVG = (col) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
    // Toggle off if already recording
    if (_voiceActive && _voiceRec) {
        _voiceRec.stop();
        _voiceActive = false;
        voiceBtn.innerHTML = _micSVG('white') + ' <span>Voice</span>';
        voiceBtn.style.background = '#2563eb'; voiceBtn.style.borderColor = '#2563eb';
        if (statusEl) { statusEl.textContent = 'Recording stopped'; setTimeout(() => { statusEl.style.display = 'none'; }, 2000); }
        return;
    }

    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        showToast('⚠️ Voice not supported — try Chrome on Android or Safari on iOS', 'warning');
        return;
    }

    let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _voiceRec = new SR();
    _voiceRec.lang = _vfLang;
    _voiceRec.interimResults = true;
    _voiceRec.maxAlternatives = 1;
    _voiceActive = true;

    const _hint = _vfLang === 'ar-SA'
        ? 'استمع… قل مثلاً: "إعتام عدسة العين جراح أساسي اليوم"'
        : 'Listening… say e.g. "Cataract primary surgeon today with Dr. Smith"';
    statusEl.textContent = _hint;
    statusEl.dir = _vfLang === 'ar-SA' ? 'rtl' : 'ltr';
    statusEl.style.display = 'block';
    // Active state: red pill + stop icon
    voiceBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="#fff"><rect x="1" y="1" width="8" height="8" rx="2"/></svg> <span>Stop</span>';
    voiceBtn.style.background = '#dc2626'; voiceBtn.style.borderColor = '#dc2626';

    _voiceRec.onresult = (e) => {
        let interim = '';
        let final   = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            let t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t; else interim += t;
        }
        if (interim) { statusEl.textContent = interim + '…'; statusEl.dir = _vfLang === 'ar-SA' ? 'rtl' : 'ltr'; }
        if (final)   { statusEl.textContent = (_vfLang === 'ar-SA' ? 'سُمع: "' : 'Heard: "') + final + '"'; statusEl.dir = _vfLang === 'ar-SA' ? 'rtl' : 'ltr'; parseVoiceInput(final); }
    };
    _voiceRec.onerror = (e) => {
        _voiceActive = false;
        voiceBtn.innerHTML = _micSVG('white') + ' <span>Voice</span>';
        voiceBtn.style.background = '#2563eb'; voiceBtn.style.borderColor = '#2563eb';
        let msg = { 'not-allowed':'Microphone permission denied — allow mic in browser settings', 'no-speech':'No speech detected — tap and speak clearly', 'network':'Network error — check connection', 'audio-capture':'No microphone found' }[e.error] || ('Error: ' + e.error);
        statusEl.textContent = msg;
        setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
    };
    _voiceRec.onend = () => {
        _voiceActive = false;
        voiceBtn.innerHTML = _micSVG('white') + ' <span>Voice</span>';
        voiceBtn.style.background = '#2563eb'; voiceBtn.style.borderColor = '#2563eb';
        setTimeout(() => { if (statusEl.textContent.startsWith('Heard') || statusEl.textContent.startsWith('سُمع')) setTimeout(() => { statusEl.style.display = 'none'; }, 3000); }, 100);
    };

    try { _voiceRec.start(); }
    catch(e) { showToast('⚠️ Could not start microphone: ' + e.message, 'error'); _voiceActive = false; voiceBtn.innerHTML = 'Voice'; }
}

function parseVoiceInput(text) {
    let t = text.toLowerCase();

    let procedureMap = {
        'cataract': 'Cataract / Phaco', 'phaco': 'Cataract / Phaco',
        'vitreo': 'Vitreoretinal (PPV)', 'retinal': 'Vitreoretinal (PPV)', 'ppv': 'Vitreoretinal (PPV)',
        'glaucoma': 'Glaucoma',
        'cornea': 'Cornea / Keratoplasty', 'keratoplasty': 'Cornea / Keratoplasty', 'transplant': 'Cornea / Keratoplasty',
        'oculoplastic': 'Oculoplastics', 'plastics': 'Oculoplastics', 'eyelid': 'Oculoplastics',
        'strabismus': 'Strabismus', 'squint': 'Strabismus',
        'laser': 'Laser (LIO / SLT / YAG)', 'slt': 'Laser (LIO / SLT / YAG)', 'yag': 'Laser (LIO / SLT / YAG)'
    };
    let roleMap = {
        'primary': 'Primary Surgeon', 'surgeon': 'Primary Surgeon',
        'assist': 'Assistant', 'second': 'Assistant',
        'observe': 'Observer', 'observer': 'Observer', 'watch': 'Observer'
    };

    let matched = { procedure: null, role: null, date: null, attending: null };
    for (let kw in procedureMap) { if (t.includes(kw)) { matched.procedure = procedureMap[kw]; break; } }
    for (let kw in roleMap)      { if (t.includes(kw)) { matched.role = roleMap[kw]; break; } }

    if (t.includes('today') || t.includes('tonight')) matched.date = getTodayStr();
    else if (t.includes('yesterday')) matched.date = getYesterdayStr();

    let drMatch = t.match(/(?:dr\.?|doctor)\s+([a-z]+)/i);
    if (drMatch) matched.attending = 'Dr. ' + drMatch[1].charAt(0).toUpperCase() + drMatch[1].slice(1);

    if (matched.procedure) {
        let el = document.getElementById('procedure');
        if (el) el.value = matched.procedure;
    }
    if (matched.role) {
        let el = document.getElementById('role');
        if (el) el.value = matched.role;
    }
    if (matched.date) {
        let el = document.getElementById('date');
        if (el) el.value = matched.date;
    }
    if (matched.attending) {
        let el = document.getElementById('attending');
        if (el) el.value = matched.attending;
    }
    let filled = Object.values(matched).filter(Boolean).length;
    if (filled > 0) showToast('Filled ' + filled + ' field' + (filled > 1 ? 's' : '') + ' — review and save!');
}

// ── QR Shareable Stats Card ──────────────────────────────────────────────────
function showStatsCard() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    let name    = profile.name    || 'Resident';
    let pgy     = profile.pgy     || 'PGY-1';
    let program = profile.program || 'Ophthalmology';

    let totalReq = Object.values(acgme).reduce((a,b) => a+b, 0);
    let total    = allCases.length;
    let pct      = Math.min(Math.round((total / totalReq) * 100), 100);

    let counts = {};
    for (let p in acgme) { counts[p] = allCases.filter(c => c.procedure === p).length; }

    document.getElementById('scName').textContent    = 'Dr. ' + name;
    document.getElementById('scProgram').textContent = program + ' Ophthalmology';
    document.getElementById('scPgy').textContent     = pgy;
    document.getElementById('scTotal').textContent   = total;
    document.getElementById('scPct').textContent     = pct + '%';

    let payload = btoa(JSON.stringify({ name, pgy, program, total, pct, counts, ts: Date.now() }));
    let shareURL = location.origin + location.pathname + '?share=' + payload;

    let canvas = document.getElementById('statsQR');
    QRCode.toCanvas(canvas, shareURL, { width: 180, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }, () => {});

    window._shareURL = shareURL;
    document.getElementById('statsCardModal').style.display = 'flex';
}

function copyShareLink() {
    if (!window._shareURL) return;
    navigator.clipboard.writeText(window._shareURL).then(() => {
        showToast('🔗 Link copied to clipboard!');
    }).catch(() => {
        prompt('Copy this link:', window._shareURL);
    });
}

function checkShareURL() {
    let params = new URLSearchParams(location.search);
    let share  = params.get('share');
    if (!share) return;

    try {
        let data = JSON.parse(atob(share));
        document.getElementById('shareView').style.display = 'block';
        document.getElementById('loadingSpinner').style.display = 'none';

        let svName = document.getElementById('svName');
        let svPgy  = document.getElementById('svPgy');
        let svProg = document.getElementById('svProgram');
        if (svName) svName.textContent = 'Dr. ' + (data.name || 'Resident');
        if (svPgy)  svPgy.textContent  = data.pgy || 'PGY-1';
        if (svProg) svProg.textContent = (data.program || 'Ophthalmology') + ' Program';

        let stats = [
            { val: data.total,       label: 'Total Cases', color: '#2563eb' },
            { val: data.pct + '%',   label: 'ACGME Done',  color: '#16a34a' },
            { val: data.pgy || '—',  label: 'Year',        color: '#7c3aed' }
        ];
        document.getElementById('svStats').innerHTML = stats.map(s =>
            `<div style="background:white;border-radius:14px;padding:16px;text-align:center;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(37,99,235,0.07)">
                <div style="font-size:22px;font-weight:900;color:${s.color};letter-spacing:-0.5px;margin-bottom:4px">${s.val}</div>
                <div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px">${s.label}</div>
            </div>`
        ).join('');

        let progHtml = '';
        if (data.counts) {
            for (let p in acgme) {
                let done = data.counts[p] || 0;
                let req  = acgme[p];
                let pct  = Math.min(Math.round((done / req) * 100), 100);
                let color = pct >= 100 ? '#16a34a' : pct >= 50 ? '#2563eb' : pct >= 25 ? '#d97706' : '#dc2626';
                progHtml += `<div style="margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px">
                        <span>${p}</span><span style="color:${color}">${done}/${req}</span>
                    </div>
                    <div style="background:#e2e8f0;border-radius:99px;height:8px">
                        <div style="background:${color};width:${pct}%;height:8px;border-radius:99px"></div>
                    </div>
                </div>`;
            }
        }
        document.getElementById('svProgress').innerHTML = progHtml;

        document.querySelector('#loginContainer')    && (document.querySelector('#loginContainer').style.display    = 'none');
        document.querySelector('#appContainer')      && (document.querySelector('#appContainer').style.display      = 'none');
        document.querySelector('#welcomeGuideModal') && (document.querySelector('#welcomeGuideModal').style.display = 'none');
        document.getElementById('shareView').style.display = 'block';
    } catch(e) {
        console.error('Invalid share URL', e);
    }
}

// ── Attending Dashboard ───────────────────────────────────────────────────────
let _attendingCases = [];

async function loadAttendingDashboard() {
    let { data: { user } } = await db.auth.getUser();
    let { data: profile }  = await db.from('profiles').select('*').eq('id', user.id).single();
    let name     = profile?.full_name || '';
    let dispName = profile?.preferred_name || name.split(' ')[0] || name;

    // Populate header
    let nameEl = document.getElementById('attName');
    let titleEl = document.getElementById('attTitle');
    if (nameEl) nameEl.textContent = 'Dr. ' + dispName;
    if (titleEl) titleEl.textContent = 'Attending Ophthalmologist';

    // Fetch all cases (requires attending RLS policy — see setup SQL)
    let { data: cases } = await db.from('cases').select('*').order('date', { ascending: false });
    if (!cases) { cases = []; }

    // Filter to cases where the attending field loosely matches this user's name
    let lastName = name.split(' ').pop().toLowerCase();
    _attendingCases = cases.filter(c => c.attending && c.attending.toLowerCase().includes(lastName));

    // Stats
    let uniqueResidents = [...new Set(_attendingCases.map(c => c.resident_name).filter(Boolean))];
    let mocHours = Math.round(_attendingCases.length * 0.5); // 0.5 CME per case supervised

    let totalEl     = document.getElementById('attTotal');
    let residentsEl = document.getElementById('attResidents');
    let mocEl       = document.getElementById('attMOC');
    if (totalEl)     totalEl.textContent     = _attendingCases.length;
    if (residentsEl) residentsEl.textContent = uniqueResidents.length;
    if (mocEl)       mocEl.textContent       = mocHours;

    // Procedure breakdown
    let procEl = document.getElementById('attProcBreakdown');
    if (procEl) {
        let counts = {};
        _attendingCases.forEach(c => { counts[c.procedure] = (counts[c.procedure] || 0) + 1; });
        let sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
        let max = sorted[0]?.[1] || 1;
        procEl.innerHTML = sorted.length === 0 ? '<p style="color:#94a3b8;font-size:13px">No cases yet</p>' :
            sorted.map(([proc, cnt]) => {
                let color = procedureColors[proc] || '#64748b';
                let pct   = Math.round((cnt / max) * 100);
                let short = proc.split('/')[0].trim().split('(')[0].trim();
                return `<div style="margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px">
                        <span>${short}</span><span style="color:${color}">${cnt} cases</span>
                    </div>
                    <div style="background:#e2e8f0;border-radius:99px;height:8px">
                        <div style="background:${color};width:${pct}%;height:8px;border-radius:99px;transition:width 0.5s"></div>
                    </div>
                </div>`;
            }).join('');
    }

    // Resident list
    let resListEl = document.getElementById('attResidentList');
    if (resListEl) {
        let resCounts = {};
        _attendingCases.forEach(c => { if (c.resident_name) resCounts[c.resident_name] = (resCounts[c.resident_name] || 0) + 1; });
        let sorted = Object.entries(resCounts).sort((a,b) => b[1]-a[1]);
        resListEl.innerHTML = sorted.length === 0 ? '<p style="color:#94a3b8;font-size:13px">No residents yet</p>' :
            sorted.map(([res, cnt]) => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9">
                    <div style="width:36px;height:36px;background:#0891b218;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                    <div style="flex:1"><p style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:2px">${res}</p>
                        <p style="font-size:11px;color:#64748b">${cnt} case${cnt>1?'s':''} supervised</p></div>
                </div>`).join('');
    }

    renderAttendingCases();
}

function renderAttendingCases() {
    let el = document.getElementById('attCaseList');
    if (!el) return;
    let search = (document.getElementById('attSearch')?.value || '').toLowerCase();
    let cases = search ? _attendingCases.filter(c =>
        (c.procedure||'').toLowerCase().includes(search) ||
        (c.resident_name||'').toLowerCase().includes(search) ||
        (c.hospital||'').toLowerCase().includes(search)
    ) : _attendingCases;

    if (cases.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:32px;color:#94a3b8">
            <div style="margin-bottom:10px;display:flex;justify-content:center"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
            <p style="font-size:14px;font-weight:600;color:#64748b">${search ? 'No matching cases' : 'No supervised cases found'}</p>
            <p style="font-size:12px;margin-top:6px">Cases appear here when residents enter your name as attending</p>
        </div>`;
        return;
    }

    el.innerHTML = cases.slice(0, 30).map(c => {
        let color = procedureColors[c.procedure] || '#64748b';
        return `<div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="flex:1;min-width:0">
                    <p style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:3px">${c.procedure||'—'}</p>
                    <p style="font-size:12px;color:#64748b">${c.resident_name||'Unknown'} · ${c.role||'—'} · ${c.hospital||'—'}</p>
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:10px">
                    <span style="font-size:11px;font-weight:700;color:${color};background:${color}18;padding:3px 8px;border-radius:20px">${c.date||'—'}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    if (cases.length > 30) {
        el.innerHTML += `<p style="text-align:center;font-size:12px;color:#94a3b8;padding:12px 0">Showing 30 of ${cases.length} cases</p>`;
    }
}

// ── PD Feedback ──────────────────────────────────────────────────────────────
function openFeedbackModal(caseId, caseInfo) {
    document.getElementById('feedbackCaseId').value         = caseId;
    document.getElementById('feedbackCaseInfo').textContent = caseInfo;
    document.getElementById('feedbackText').value           = '';
    document.getElementById('feedbackTeaching').checked     = false;
    document.getElementById('feedbackTeachingNote').value   = '';
    window._feedbackRating = '';
    document.querySelectorAll('.feedback-rating-btn').forEach(b => {
        b.style.background  = '#f8fafc';
        b.style.borderColor = '#e2e8f0';
        b.style.color       = '#64748b';
    });
    document.getElementById('feedbackModal').style.display = 'flex';
}

function selectFeedbackRating(rating, btn) {
    window._feedbackRating = rating;
    const ratingColors = { 'Excellent': '#16a34a', 'Good': '#2563eb', 'Needs Work': '#d97706' };
    let col = ratingColors[rating] || '#2563eb';
    document.querySelectorAll('.feedback-rating-btn').forEach(b => {
        b.style.background  = '#f8fafc';
        b.style.borderColor = '#e2e8f0';
        b.style.color       = '#64748b';
    });
    btn.style.background  = col + '18';
    btn.style.borderColor = col;
    btn.style.color       = col;
}

async function submitFeedback() {
    let caseId    = document.getElementById('feedbackCaseId').value;
    let text      = document.getElementById('feedbackText').value.trim();
    let rating    = window._feedbackRating || '';
    let teaching  = document.getElementById('feedbackTeaching').checked;
    let teachNote = document.getElementById('feedbackTeachingNote').value.trim();

    if (!text && !rating && !teaching) {
        showToast('⚠️ Add a rating, note, or mark as teaching case', 'warning');
        return;
    }

    let updates = {};
    if (text)    updates.pd_feedback    = text;
    if (rating)  updates.pd_rating      = rating;
    if (teaching) {
        updates.is_teaching   = true;
        if (teachNote) updates.teaching_note = teachNote;
    }

    let { error } = await db.from('cases').update(updates).eq('id', caseId);
    if (error) {
        // Fallback: columns may not exist yet — append to notes
        let { data: existing } = await db.from('cases').select('notes').eq('id', caseId).single();
        let old = existing?.notes || '';
        let tag = rating ? `[PD ${rating}] ` : '';
        let newNotes = old + (old ? '\n' : '') + tag + (text || '') + (teaching ? ' [Teaching Case]' : '');
        await db.from('cases').update({ notes: newNotes }).eq('id', caseId);
    }

    document.getElementById('feedbackModal').style.display = 'none';
    showToast('✅ Feedback saved!');
    if (typeof loadAdminData === 'function') loadAdminData();
}

// ── Teaching Case Toggle (from resident's case list) ─────────────────────────
async function toggleTeachingCase(caseId, currentValue) {
    let newVal = !currentValue;
    let { error } = await db.from('cases').update({ is_teaching: newVal }).eq('id', caseId);
    if (error) { showToast('❌ Could not update teaching status', 'error'); return; }
    // Refresh local copy
    let c = allCases.find(x => x.id === caseId);
    if (c) c.is_teaching = newVal;
    showToast(newVal ? 'Marked as Teaching Case' : 'Teaching badge removed');
    applyFilter();
}

// ── Workspace Sub-Tabs ───────────────────────────────────────────────────────
let activeWorkspaceTab = 'journal';

function showWorkspaceTab(tab) {
    activeWorkspaceTab = tab;
    let wsGrid = document.getElementById('wsGrid');
    let wsSectionHeader = document.getElementById('wsSectionHeader');
    let wsSectionLabel  = document.getElementById('wsSectionLabel');
    if (wsGrid) wsGrid.style.display = 'none';
    if (wsSectionHeader) { wsSectionHeader.style.display = 'flex'; wsSectionHeader.classList.add('active'); }
    const WS_LABELS = { calendar:'📅 Missions', journal:'📓 Journal', notes:'📌 Notes', study:'📝 Study', reading:'📚 Reading', fellowship:'🎓 Match', duty:'⏰ Duty Hours', compl:'⚠️ Complications', wellness:'💆 Wellness', fitness:'💪 Fitness' };
    if (wsSectionLabel) wsSectionLabel.textContent = WS_LABELS[tab] || tab;
    ['calendar','journal','notes','study','reading','fellowship','duty','compl','wellness','fitness'].forEach(t => {
        let el = document.getElementById('ws-'+t);
        if (el) el.style.display = t === tab ? 'block' : 'none';
        let btn = document.getElementById('ws-tab-'+t);
        if (btn) {
            if (t === tab) {
                btn.style.background = 'white';
                btn.style.color      = '#2563eb';
                btn.style.boxShadow  = '0 2px 8px rgba(0,0,0,0.08)';
            } else {
                btn.style.background = 'transparent';
                btn.style.color      = '#64748b';
                btn.style.boxShadow  = 'none';
            }
        }
    });
    if (tab === 'calendar')   { if (calView === 'week') renderWeekView(); else renderCalendar(); }
    if (tab === 'journal')    renderJournalList();
    if (tab === 'notes')      renderNotes();
    if (tab === 'study')      showStudySubTab('qbank');
    if (tab === 'reading')    renderStudyList();
    if (tab === 'fellowship') { showFpTab('pipeline'); }
    if (tab === 'duty')       renderDutyHours();
    if (tab === 'compl')      renderCompls();
    if (tab === 'wellness')   renderWellness();
    if (tab === 'fitness')    { if (typeof showFitnessView === 'function') showFitnessView(activeFitnessView || 'programs'); else renderFitness(); }
}

function showStudySubTab(sub) {
    const tabColors = { qbank:'#7c3aed', okap:'#2563eb', didactics:'#059669', clinician:'#0891b2' };
    ['qbank','okap','didactics','clinician'].forEach(s => {
        let el = document.getElementById('st-'+s);
        if (el) el.style.display = s === sub ? 'block' : 'none';
        let btn = document.getElementById('st-tab-'+s);
        if (btn) {
            if (s === sub) {
                btn.style.background = tabColors[s] || '#0f172a';
                btn.style.color = 'white';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            } else {
                btn.style.background = '#f1f5f9';
                btn.style.color = '#64748b';
                btn.style.boxShadow = 'none';
            }
        }
    });
    if (sub === 'qbank')     renderQbankHome();
    if (sub === 'okap')      renderIteScores();
    if (sub === 'didactics') renderDidactics();
    if (sub === 'clinician') renderClinicianNotes();
}

function backToWsGrid() {
    let wsGrid = document.getElementById('wsGrid');
    let wsSectionHeader = document.getElementById('wsSectionHeader');
    if (wsGrid) wsGrid.style.display = 'grid';
    if (wsSectionHeader) { wsSectionHeader.style.display = 'none'; wsSectionHeader.classList.remove('active'); }
    ['calendar','journal','notes','study','reading','fellowship','duty','compl','wellness','fitness'].forEach(t => {
        let el = document.getElementById('ws-'+t);
        if (el) el.style.display = 'none';
        let btn = document.getElementById('ws-tab-'+t);
        if (btn) { btn.style.background='transparent'; btn.style.color='#64748b'; btn.style.boxShadow='none'; }
    });
    activeWorkspaceTab = '';
}

function toggleMoreDrawer() {
    let d = document.getElementById('moreDrawer');
    if (d) d.style.display = d.style.display === 'none' ? 'flex' : 'none';
}

function closeMoreDrawer() {
    let d = document.getElementById('moreDrawer');
    if (d) d.style.display = 'none';
}

// ── Workspace Cloud Sync ──────────────────────────────────────────────────────
async function _getUid() {
    let { data: { user } } = await db.auth.getUser();
    return user?.id;
}

// Maps between app objects (camelCase) and Supabase rows (snake_case)
const _wsMap = {
    events: {
        toCloud:   e => ({ id:e.id, title:e.title, date:e.date, time:e.time||null, type:e.type||null, notes:e.notes||null, created_at:e.createdAt||new Date().toISOString() }),
        fromCloud: r => ({ id:r.id, title:r.title, date:r.date, time:r.time, type:r.type, notes:r.notes, createdAt:r.created_at })
    },
    journal: {
        toCloud:   e => ({ id:e.id, date:e.date, mood:e.mood||null, title:e.title||null, body:e.body||null, case_id:e.caseId||null, updated_at:e.updatedAt||new Date().toISOString() }),
        fromCloud: r => ({ id:r.id, date:r.date, mood:r.mood, title:r.title, body:r.body, caseId:r.case_id, updatedAt:r.updated_at })
    },
    todos: {
        toCloud:   e => ({ id:e.id, text:e.text, priority:e.priority||'medium', due:e.due||null, done:e.done||false, created_at:e.createdAt||new Date().toISOString() }),
        fromCloud: r => ({ id:r.id, text:r.text, priority:r.priority, due:r.due, done:r.done, createdAt:r.created_at })
    },
    notes: {
        toCloud:   e => ({ id:e.id, title:e.title||null, tag:e.tag||null, body:e.body||null, updated_at:e.updatedAt||new Date().toISOString() }),
        fromCloud: r => ({ id:r.id, title:r.title, tag:r.tag, body:r.body, updatedAt:r.updated_at })
    },
    study: {
        toCloud:   e => ({ id:e.id, topic:e.topic, type:e.type||'Textbook', notes:e.notes||null, status:e.status||'to-read', created_at:e.createdAt||new Date().toISOString() }),
        fromCloud: r => ({ id:r.id, topic:r.topic, type:r.type, notes:r.notes, status:r.status, createdAt:r.created_at })
    }
};

async function syncWorkspaceFromCloud() {
    let uid = await _getUid();
    if (!uid) return;
    try {
        let tables = [
            { table:'workspace_events',  key:EVENTS_KEY,  map:_wsMap.events  },
            { table:'workspace_journal', key:JOURNAL_KEY, map:_wsMap.journal },
            { table:'workspace_todos',   key:TODO_KEY,    map:_wsMap.todos   },
            { table:'workspace_notes',   key:NOTES_KEY,   map:_wsMap.notes   },
            { table:'workspace_study',   key:STUDY_KEY,   map:_wsMap.study   },
        ];
        for (let { table, key, map } of tables) {
            let { data } = await db.from(table).select('*').eq('user_id', uid);
            if (data && data.length > 0) {
                // Cloud has data → use it
                localStorage.setItem(key, JSON.stringify(data.map(map.fromCloud)));
            } else {
                // Cloud empty → migrate local data up
                let local = JSON.parse(localStorage.getItem(key) || '[]');
                if (local.length > 0) {
                    await db.from(table).upsert(local.map(item => ({ ...map.toCloud(item), user_id: uid })));
                }
            }
        }
    } catch(e) { console.warn('Workspace cloud sync failed:', e); }
}

async function _cloudUpsert(table, appObj, map) {
    let uid = await _getUid();
    if (!uid) return;
    try { await db.from(table).upsert({ ...map.toCloud(appObj), user_id: uid }); }
    catch(e) { console.warn('Cloud upsert failed:', e); }
}

async function _cloudDelete(table, id) {
    let uid = await _getUid();
    if (!uid) return;
    try { await db.from(table).delete().eq('id', id).eq('user_id', uid); }
    catch(e) { console.warn('Cloud delete failed:', e); }
}

// ── Calendar ──────────────────────────────────────────────────────────────────
const EVENTS_KEY = 'eyeEvents';
let calYear, calMonth, selectedCalDate;
let calView = 'month';
let calWeekStart = null; // Date object — Monday of current week view

function getEvents()         { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); }
function saveEvents(events)  { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }

function initCal() {
    let now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth();
    calWeekStart = _getWeekStart(now);
}

function _getWeekStart(date) {
    let d = new Date(date);
    let day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // back to Monday
    d.setHours(0,0,0,0);
    return d;
}

function _dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function toggleCalView(v) {
    calView = v;
    let monthBtn = document.getElementById('cal-toggle-month');
    let weekBtn  = document.getElementById('cal-toggle-week');
    const _active   = { background: 'white',       color: '#111827', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
    const _inactive = { background: 'transparent', color: '#6B7280',  boxShadow: 'none' };
    if (monthBtn) { let s = v==='month' ? _active : _inactive; Object.assign(monthBtn.style, s); }
    if (weekBtn)  { let s = v==='week'  ? _active : _inactive; Object.assign(weekBtn.style,  s); }
    let dd = document.getElementById('dayDetail');
    if (dd) dd.style.display = 'none';
    selectedCalDate = null;
    if (v === 'week') renderWeekView();
    else renderCalendar();
}

function calJumpToday() {
    let now = new Date();
    calYear  = now.getFullYear();
    calMonth = now.getMonth();
    calWeekStart = _getWeekStart(now);
    let dd = document.getElementById('dayDetail');
    if (dd) dd.style.display = 'none';
    selectedCalDate = null;
    if (calView === 'week') renderWeekView();
    else renderCalendar();
}

function calNav(dir) {
    if (calView === 'week') {
        calWeekStart = calWeekStart || _getWeekStart(new Date());
        calWeekStart.setDate(calWeekStart.getDate() + dir * 7);
        renderWeekView();
        return;
    }
    calMonth += dir;
    if (calMonth > 11) { calMonth = 0;  calYear++; }
    if (calMonth < 0)  { calMonth = 11; calYear--; }
    let dd = document.getElementById('dayDetail');
    if (dd) dd.style.display = 'none';
    selectedCalDate = null;
    renderCalendar();
}

function renderWeekView() {
    if (!calWeekStart) initCal();
    let ws = new Date(calWeekStart);

    // Header label
    let we = new Date(ws); we.setDate(we.getDate() + 6);
    let label = ws.toLocaleString('default',{month:'short',day:'numeric'}) + ' – ' + we.toLocaleString('default',{month:'short',day:'numeric',year:'numeric'});
    let el = document.getElementById('calMonthLabel');
    if (el) el.textContent = label;

    let grid  = document.getElementById('calGrid');
    let wGrid = document.getElementById('weekGrid');
    if (grid)  grid.style.display = 'none';
    if (!wGrid) return;
    wGrid.style.display = 'block';

    let events  = getEvents();
    let todos   = getTodos();
    let journal = getJournalEntries();
    let today   = getTodayStr();
    let dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    let typeColors = { clinic:'#0891b2', meeting:'#7c3aed', or:'#16a34a', education:'#d97706', personal:'#ec4899' };

    let cols = '';
    for (let i = 0; i < 7; i++) {
        let d   = new Date(ws); d.setDate(ws.getDate() + i);
        let dk  = _dayKey(d);
        let isToday = dk === today;
        let isWknd  = i >= 5;
        let dayNum  = d.getDate();
        let evs   = events.filter(e => e.date === dk);
        let tds   = todos.filter(t => t.due === dk && !t.done);
        let cases = allCases.filter(c => c.date === dk);
        let jrnl  = journal.filter(j => j.date === dk);

        // ── Column header ──────────────────────────────────────────────────────
        let hdrBg    = isToday ? '#2563eb'     : isWknd ? '#fafafa' : '#f8fafc';
        let hdrBdr   = isToday ? '#2563eb'     : '#e2e8f0';
        let dayColor = isToday ? 'rgba(255,255,255,0.75)' : isWknd ? '#94a3b8' : '#94a3b8';
        let numColor = isToday ? 'white'        : isWknd ? '#6B7280' : '#0f172a';

        // ── Items ──────────────────────────────────────────────────────────────
        let items = '';
        evs.forEach(e => {
            let c = typeColors[e.type] || '#2563eb';
            items += `<div onclick="selectCalDay('${dk}')" style="background:${c}12;border-left:2px solid ${c};border-radius:5px;padding:3px 6px;margin-bottom:3px;cursor:pointer">
                <div style="font-size:9px;font-weight:700;color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4">${e.time?e.time+' ':''}${e.title}</div>
            </div>`;
        });
        cases.forEach(c => {
            let short = (c.procedure||'').split('/')[0].trim().split('(')[0].trim();
            items += `<div style="background:#16a34a12;border-left:2px solid #16a34a;border-radius:5px;padding:3px 6px;margin-bottom:3px">
                <div style="font-size:9px;font-weight:700;color:#16a34a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4">${short}</div>
            </div>`;
        });
        tds.forEach(t => {
            let pc = { high:'#dc2626', medium:'#d97706', low:'#16a34a' }[t.priority] || '#64748b';
            items += `<div style="background:${pc}12;border-left:2px solid ${pc};border-radius:5px;padding:3px 6px;margin-bottom:3px">
                <div style="font-size:9px;font-weight:600;color:${pc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4">${t.text}</div>
            </div>`;
        });
        if (jrnl.length > 0) {
            items += `<div style="background:#7c3aed12;border-left:2px solid #7c3aed;border-radius:5px;padding:3px 6px;margin-bottom:3px">
                <div style="font-size:9px;font-weight:600;color:#7c3aed;line-height:1.4">${jrnl.length} journal entr${jrnl.length>1?'ies':'y'}</div>
            </div>`;
        }

        cols += `<div style="min-width:94px;flex:1;display:flex;flex-direction:column;gap:4px">
            <div onclick="selectCalDay('${dk}')" style="text-align:center;padding:8px 4px 7px;border-radius:12px;cursor:pointer;background:${hdrBg};border:1.5px solid ${hdrBdr}">
                <div style="font-size:9px;font-weight:700;color:${dayColor};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">${dayNames[i]}</div>
                <div style="font-size:18px;font-weight:800;color:${numColor};line-height:1">${dayNum}</div>
            </div>
            <div style="flex:1;min-height:80px;display:flex;flex-direction:column">
                ${items || `<div style="font-size:9px;color:#e2e8f0;text-align:center;padding:10px 0;letter-spacing:0.5px">—</div>`}
            </div>
            <button onclick="openEventModal('${dk}')" style="margin:0;padding:5px;font-size:11px;font-weight:700;border-radius:8px;background:#f8fafc;color:#9CA3AF;box-shadow:none;width:100%;border:1px dashed #e2e8f0;line-height:1">+</button>
        </div>`;
    }

    wGrid.innerHTML = `<div style="display:flex;gap:5px;min-width:680px">${cols}</div>`;

    if (selectedCalDate) renderDayDetail(selectedCalDate);
}

function renderCalendar() {
    if (calYear === undefined) initCal();
    let wg = document.getElementById('weekGrid');
    let cg = document.getElementById('calGrid');
    if (wg) wg.style.display = 'none';
    if (cg) cg.style.display = 'block';

    let now         = new Date();
    let today       = getTodayStr();
    let firstDay    = new Date(calYear, calMonth, 1).getDay();
    let daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    let monthLabel  = new Date(calYear, calMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    let el = document.getElementById('calMonthLabel');
    if (el) el.textContent = monthLabel;

    let events  = getEvents();
    let todos   = getTodos();
    let journal = getJournalEntries();

    function pad(d)          { return String(d).padStart(2,'0'); }
    function dayKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }

    // ── Day-of-week headers ────────────────────────────────────────────────────
    const dayLetters = ['S','M','T','W','T','F','S'];
    let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px">';
    for (let i = 0; i < 7; i++) {
        let wknd = i === 0 || i === 6;
        html += `<div style="text-align:center;font-size:10px;font-weight:700;color:${wknd?'#c7d2fe':'#94a3b8'};padding:0 0 6px;letter-spacing:0.8px">${dayLetters[i]}</div>`;
    }
    html += '</div>';

    // ── Day cells ──────────────────────────────────────────────────────────────
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px">';
    let day = 1 - firstDay;

    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++, day++) {
            if (day < 1 || day > daysInMonth) {
                html += '<div style="min-height:52px"></div>';
                continue;
            }
            let dk      = dayKey(calYear, calMonth, day);
            let isToday = dk === today;
            let isSel   = dk === selectedCalDate;
            let isWknd  = col === 0 || col === 6;

            let hasEv    = events.some(e => e.date === dk);
            let hasTodo  = todos.some(t => t.due === dk && !t.done);
            let hasJ     = journal.some(j => j.date === dk);
            let hasCase  = allCases.some(c => c.date === dk);

            // Number circle
            let circleBg, circleColor, circleWeight;
            if (isSel && isToday) { circleBg = '#1d4ed8'; circleColor = 'white'; circleWeight = '800'; }
            else if (isSel)       { circleBg = '#2563eb'; circleColor = 'white'; circleWeight = '800'; }
            else if (isToday)     { circleBg = '#2563eb'; circleColor = 'white'; circleWeight = '800'; }
            else                  { circleBg = 'transparent'; circleColor = isWknd ? '#94a3b8' : '#111827'; circleWeight = '400'; }

            // Activity dots — priority order, max 3 visible
            let evDotColor = '#2563eb'; // default blue
            if (hasEv) {
                let dayEvs = events.filter(e => e.date === dk);
                let allDone = dayEvs.length > 0 && dayEvs.every(e => e.status === 'done');
                let anyInProgress = dayEvs.some(e => e.status === 'inprogress');
                if (allDone) evDotColor = '#16a34a';
                else if (anyInProgress) evDotColor = '#2563eb';
                else evDotColor = '#d97706';
            }
            let dotColors = [
                hasCase  && '#16a34a',
                hasEv    && evDotColor,
                hasTodo  && '#d97706',
                hasJ     && '#7c3aed'
            ].filter(Boolean).slice(0, 3);
            let dots = dotColors.map(c =>
                `<span style="width:4px;height:4px;border-radius:50%;background:${c};display:inline-block;margin:0 1.5px;flex-shrink:0"></span>`
            ).join('');

            let cellBg = isSel ? '#eff6ff' : 'transparent';

            html += `<div onclick="selectCalDay('${dk}')"
                style="min-height:52px;padding:4px 2px 6px;text-align:center;cursor:pointer;border-radius:12px;background:${cellBg};transition:background 0.12s"
                onmouseover="this.style.background='${isSel?'#e0f2fe':'#f8fafc'}'"
                onmouseout="this.style.background='${cellBg}'">
                <div style="width:30px;height:30px;border-radius:50%;background:${circleBg};margin:0 auto 4px;display:flex;align-items:center;justify-content:center">
                    <span style="font-size:12px;font-weight:${circleWeight};color:${circleColor};line-height:1">${day}</span>
                </div>
                <div style="display:flex;justify-content:center;align-items:center;min-height:6px">${dots}</div>
            </div>`;
        }
        if (day > daysInMonth) break;
    }
    html += '</div>';

    // ── Legend ─────────────────────────────────────────────────────────────────
    html += `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1px solid #f1f5f9">
        ${[['#16a34a','Case'],['#2563eb','Event'],['#d97706','Task'],['#7c3aed','Journal']].map(([c,l]) =>
            `<span style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;color:#64748b;letter-spacing:0.2px">
                <span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span>${l}
            </span>`
        ).join('')}
    </div>`;

    let grid = document.getElementById('calGrid');
    if (grid) grid.innerHTML = html;

    if (selectedCalDate) renderDayDetail(selectedCalDate);
}

function selectCalDay(dk) {
    selectedCalDate = dk;
    renderCalendar();
    let dd = document.getElementById('dayDetail');
    if (dd) { dd.style.display = 'block'; dd.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function renderDayDetail(dk) {
    let titleEl   = document.getElementById('dayDetailTitle');
    let contentEl = document.getElementById('dayDetailContent');
    if (!titleEl || !contentEl) return;

    let d = new Date(dk + 'T12:00:00');
    titleEl.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

    let events  = getEvents().filter(e => e.date === dk).sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'));
    let todos   = getTodos().filter(t => t.due === dk);
    let journal = getJournalEntries().filter(j => j.date === dk);
    let cases   = allCases.filter(c => c.date === dk);

    let evTypeBg    = { clinic:'#eff6ff', meeting:'#f0fdf4', or:'#faf5ff', education:'#fffbeb', personal:'#fff1f2' };
    let evTypeColor = { clinic:'#2563eb', meeting:'#16a34a', or:'#7c3aed', education:'#ca8a04', personal:'#e11d48' };
    let evTypeIcon  = { clinic:'Clinic', meeting:'Meeting', or:'OR', education:'Education', personal:'Personal' };
    let priColor    = { high:'#dc2626', medium:'#ca8a04', low:'#16a34a' };

    let html = '';

    const statusMeta = {
        pending:    { label:'Pending',     color:'#d97706', bg:'#fffbeb', icon:'🕐' },
        inprogress: { label:'In Progress', color:'#2563eb', bg:'#eff6ff', icon:'⚡' },
        done:       { label:'Done',        color:'#16a34a', bg:'#f0fdf4', icon:'✅' },
        cancelled:  { label:'Cancelled',   color:'#94a3b8', bg:'#f8fafc', icon:'✕'  },
    };
    const priorityMeta = {
        high:   { label:'High',   color:'#dc2626', dot:'🔴' },
        medium: { label:'Medium', color:'#d97706', dot:'🟡' },
        low:    { label:'Low',    color:'#16a34a', dot:'🟢' },
    };

    // Events / Missions
    if (events.length > 0) {
        html += '<div style="margin-bottom:16px"><p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">MISSIONS</p>';
        for (let ev of events) {
            let sm = statusMeta[ev.status || 'pending'];
            let pm = priorityMeta[ev.priority || 'medium'];
            let isDone = ev.status === 'done';
            let isCancelled = ev.status === 'cancelled';
            let titleStyle = (isDone || isCancelled) ? 'text-decoration:line-through;opacity:0.55;' : '';

            // Week days for move-to picker
            let evDate = new Date(ev.date + 'T12:00:00');
            let weekStart = _getWeekStart(evDate);
            let weekDaysBtns = '';
            for (let i = 0; i < 7; i++) {
                let wd = new Date(weekStart);
                wd.setDate(weekStart.getDate() + i);
                let wdk = _dayKey(wd);
                let dayLabel = wd.toLocaleDateString('en-US', { weekday:'short' }).slice(0,2);
                let dayNum = wd.getDate();
                let isSelected = wdk === ev.date;
                weekDaysBtns += `<button onclick="moveMissionToDay('${ev.id}','${wdk}','${dk}')" style="flex:1;margin:0;padding:4px 2px;font-size:10px;font-weight:${isSelected?'800':'600'};border-radius:7px;border:1.5px solid ${isSelected?sm.color:'#e2e8f0'};background:${isSelected?sm.color:'#f8fafc'};color:${isSelected?'#fff':'#64748b'};line-height:1.3">${dayLabel}<br>${dayNum}</button>`;
            }

            html += `<div style="padding:12px;background:${sm.bg};border-radius:14px;margin-bottom:8px;border-left:3px solid ${sm.color}">
                <div style="display:flex;align-items:flex-start;gap:10px">
                    <button onclick="quickToggleMissionStatus('${ev.id}','${dk}')" title="Toggle status" style="flex-shrink:0;width:34px;height:34px;padding:0;margin:0;background:${sm.color};border-radius:10px;box-shadow:none;display:flex;align-items:center;justify-content:center;font-size:15px">${sm.icon}</button>
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
                            <p style="font-weight:700;font-size:14px;color:#0f172a;margin:0;${titleStyle}">${ev.title}</p>
                            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:${pm.color}18;color:${pm.color}">${pm.dot} ${pm.label}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span style="font-size:11px;font-weight:600;color:${sm.color}">${sm.label}</span>
                            ${ev.time ? `<span style="font-size:11px;color:#94a3b8">🕐 ${formatTime(ev.time)}</span>` : ''}
                            ${ev.notes ? `<span style="font-size:11px;color:#64748b">${ev.notes}</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button onclick="openEventModal('${dk}','${ev.id}')" style="width:28px;height:28px;padding:0;margin:0;background:rgba(255,255,255,0.7);border-radius:8px;box-shadow:none;display:flex;align-items:center;justify-content:center" title="Edit"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onclick="deleteEvent('${ev.id}')" style="width:28px;height:28px;padding:0;margin:0;background:rgba(255,255,255,0.7);border-radius:8px;box-shadow:none;display:flex;align-items:center;justify-content:center" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
                    </div>
                </div>
                <div style="margin-top:10px">
                    <p style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">Move to this week</p>
                    <div style="display:flex;gap:4px">${weekDaysBtns}</div>
                </div>
            </div>`;
        }
        html += '</div>';
    }

    // Cases
    if (cases.length > 0) {
        html += '<div style="margin-bottom:16px"><p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">CASES LOGGED</p>';
        for (let c of cases) {
            html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f0fdf4;border-radius:12px;margin-bottom:6px;border-left:3px solid #16a34a">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                <div>
                    <p style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:2px">${c.procedure||'Unknown'}</p>
                    <p style="font-size:12px;color:#64748b">${c.role||''}${c.attending?' · '+c.attending:''}${c.hospital?' · '+c.hospital:''}</p>
                </div>
            </div>`;
        }
        html += '</div>';
    }

    // Todos
    if (todos.length > 0) {
        html += '<div style="margin-bottom:16px"><p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">TASKS DUE</p>';
        for (let t of todos) {
            html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fffbeb;border-radius:12px;margin-bottom:6px;border-left:3px solid ${priColor[t.priority]||'#d97706'}">
                <input type="checkbox" ${t.done?'checked':''} onchange="toggleTodo('${t.id}');renderDayDetail('${dk}')" style="width:16px;height:16px;accent-color:#2563eb;cursor:pointer;flex-shrink:0">
                <p style="font-size:13px;font-weight:600;color:#0f172a;margin:0;${t.done?'text-decoration:line-through;opacity:0.5':''}">${t.text}</p>
            </div>`;
        }
        html += '</div>';
    }

    // Journal
    if (journal.length > 0) {
        html += '<div style="margin-bottom:16px"><p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">JOURNAL</p>';
        for (let j of journal) {
            html += `<div onclick="openJournalModal('${j.id}')" style="padding:12px;background:#faf5ff;border-radius:12px;margin-bottom:6px;border-left:3px solid #7c3aed;cursor:pointer">
                <p style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:4px">${j.mood} ${j.title||'Journal Entry'}</p>
                <p style="font-size:12px;color:#64748b;line-height:1.5">${((j.body||'').replace(/<[^>]*>/g,' ').trim()).slice(0,100)}…</p>
            </div>`;
        }
        html += '</div>';
    }

    if (!events.length && !cases.length && !todos.length && !journal.length) {
        html = `<div style="text-align:center;padding:28px;color:#94a3b8">
            <p style="font-size:14px;font-weight:600;color:#64748b;margin-bottom:6px">Nothing planned</p>
            <p style="font-size:13px">Tap + Add Event to schedule something</p>
        </div>`;
    }

    contentEl.innerHTML = html;
}

function formatTime(t) {
    if (!t) return '';
    let [h, m] = t.split(':').map(Number);
    let ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

let selectedMissionStatus   = 'pending';
let selectedMissionPriority = 'medium';

function selectMissionStatus(s) {
    selectedMissionStatus = s;
    ['pending','inprogress','done','cancelled'].forEach(v => {
        let btn = document.getElementById('ms-' + v);
        if (!btn) return;
        let active = v === s;
        let styles = {
            pending:     { border:'#fde68a', bg:'#fffbeb',  color:'#d97706' },
            inprogress:  { border:'#bfdbfe', bg:'#eff6ff',  color:'#2563eb' },
            done:        { border:'#bbf7d0', bg:'#f0fdf4',  color:'#16a34a' },
            cancelled:   { border:'#e2e8f0', bg:'#f8fafc',  color:'#94a3b8' },
        };
        let st = styles[v];
        btn.style.border    = active ? `2px solid ${st.color}` : `2px solid ${st.border}`;
        btn.style.background = active ? st.color : st.bg;
        btn.style.color     = active ? '#fff' : st.color;
        btn.style.transform  = active ? 'scale(1.03)' : '';
    });
}

function selectMissionPriority(p) {
    selectedMissionPriority = p;
    ['high','medium','low'].forEach(v => {
        let btn = document.getElementById('mp-' + v);
        if (!btn) return;
        let active = v === p;
        let styles = {
            high:   { border:'#fecaca', bg:'#fef2f2', color:'#dc2626' },
            medium: { border:'#fde68a', bg:'#fffbeb', color:'#d97706' },
            low:    { border:'#bbf7d0', bg:'#f0fdf4', color:'#16a34a' },
        };
        let st = styles[v];
        btn.style.border     = active ? `2px solid ${st.color}` : `2px solid ${st.border}`;
        btn.style.background = active ? st.color : st.bg;
        btn.style.color      = active ? '#fff' : st.color;
        btn.style.transform  = active ? 'scale(1.03)' : '';
    });
}

function openEventModal(date, id) {
    let ev = id ? getEvents().find(e => e.id === id) : null;
    document.getElementById('eventId').value    = ev ? ev.id : '';
    document.getElementById('eventTitle').value = ev ? ev.title : '';
    document.getElementById('eventDate').value  = ev ? ev.date : (date || (selectedCalDate || getTodayStr()));
    document.getElementById('eventTime').value  = ev ? (ev.time || '') : '';
    document.getElementById('eventNotes').value = ev ? (ev.notes || '') : '';
    selectMissionStatus(ev ? (ev.status || 'pending') : 'pending');
    selectMissionPriority(ev ? (ev.priority || 'medium') : 'medium');
    document.getElementById('eventModal').style.display = 'flex';
    setTimeout(() => document.getElementById('eventTitle').focus(), 100);
}
function closeEventModal() { document.getElementById('eventModal').style.display = 'none'; }

function saveEvent() {
    let title = document.getElementById('eventTitle').value.trim();
    let date  = document.getElementById('eventDate').value;
    if (!title) { showToast('⚠️ Enter a mission title', 'warning'); return; }
    if (!date)  { showToast('⚠️ Pick a date', 'warning'); return; }

    let events = getEvents();
    let id     = document.getElementById('eventId').value;
    let existing = id ? events.find(e => e.id === id) : null;
    let ev = {
        id:        id || crypto.randomUUID(),
        title,
        date,
        time:      document.getElementById('eventTime').value || null,
        notes:     document.getElementById('eventNotes').value.trim(),
        status:    selectedMissionStatus,
        priority:  selectedMissionPriority,
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };

    if (id) { let idx = events.findIndex(e => e.id === id); if (idx !== -1) events[idx] = ev; else events.push(ev); }
    else events.push(ev);
    saveEvents(events);
    _cloudUpsert('workspace_events', ev, _wsMap.events);
    closeEventModal();
    selectedCalDate = date;
    renderCalendar();
    if (selectedCalDate) renderDayDetail(selectedCalDate);
    let dd = document.getElementById('dayDetail');
    if (dd) dd.style.display = 'block';
    showToast('Mission saved');
}

function deleteEvent(id) {
    if (!confirm('Delete this mission?')) return;
    saveEvents(getEvents().filter(e => e.id !== id));
    _cloudDelete('workspace_events', id);
    renderCalendar();
    if (selectedCalDate) renderDayDetail(selectedCalDate);
    showToast('🗑️ Mission deleted', 'warning');
}

function quickToggleMissionStatus(id, dk) {
    let events = getEvents();
    let ev = events.find(e => e.id === id);
    if (!ev) return;
    const cycle = { pending:'inprogress', inprogress:'done', done:'pending', cancelled:'pending' };
    ev.status = cycle[ev.status || 'pending'] || 'pending';
    saveEvents(events);
    _cloudUpsert('workspace_events', ev, _wsMap.events);
    renderCalendar();
    renderDayDetail(dk);
}

function moveMissionToDay(id, newDate, currentDk) {
    let events = getEvents();
    let ev = events.find(e => e.id === id);
    if (!ev) return;
    ev.date = newDate;
    saveEvents(events);
    _cloudUpsert('workspace_events', ev, _wsMap.events);
    renderCalendar();
    selectedCalDate = newDate;
    renderDayDetail(newDate);
    let dd = document.getElementById('dayDetail');
    if (dd) {
        let d = new Date(newDate + 'T12:00:00');
        let titleEl = document.getElementById('dayDetailTitle');
        if (titleEl) titleEl.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    }
    showToast('Mission moved to ' + new Date(newDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }));
}

// ── Journal ──────────────────────────────────────────────────────────────────
const JOURNAL_KEY = 'eyeJournal';
let selectedMood  = '😊';

const ENTRY_TYPES = {
    personal:    { label:'Personal',       color:'#64748b', bg:'#f8fafc',  border:'#cbd5e1', icon:'✍️' },
    case:        { label:'Case Reflection', color:'#7c3aed', bg:'#faf5ff',  border:'#ddd6fe', icon:'🔬' },
    postcall:    { label:'Post-Call',       color:'#d97706', bg:'#fffbeb',  border:'#fde68a', icon:'🌙' },
    grandrounds: { label:'Grand Rounds',    color:'#2563eb', bg:'#eff6ff',  border:'#bfdbfe', icon:'🎤' },
    procedure:   { label:'Procedure Log',   color:'#16a34a', bg:'#f0fdf4',  border:'#bbf7d0', icon:'👁️' },
    rotation:    { label:'Rotation',        color:'#4f46e5', bg:'#eef2ff',  border:'#c7d2fe', icon:'🔄' },
    weekly:      { label:'Weekly Review',   color:'#f59e0b', bg:'#fef3c7',  border:'#fde68a', icon:'📋' },
};

const ENTRY_TYPE_PROMPTS = {
    personal:    'What\'s on your mind today?',
    case:        'Which case stood out and why? What would you do differently next time?',
    postcall:    'How did the call go? What was the hardest moment, and what did you learn?',
    grandrounds: 'What was the key learning from today\'s session? How will it change your practice?',
    procedure:   'Which procedure did you perform? What went smoothly, and what needs work?',
    rotation:    'How has this rotation shaped you as a clinician? What will you carry forward?',
    weekly:      'How would you rate this week? What defined it — a case, a moment, a lesson?',
};

let selectedEntryType     = 'personal';
let activeJournalTypeFilter = '';

function getJournalEntries() {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
}
function saveJournalEntries(entries) {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

function selectEntryType(type, applyTemplate, force) {
    // If applyTemplate is undefined, auto-detect: apply template only if body is empty
    if (applyTemplate === undefined) {
        let bodyEl = document.getElementById('journalBody');
        applyTemplate = !bodyEl || bodyEl.textContent.trim() === '';
    }
    selectedEntryType = type;
    document.querySelectorAll('.entry-type-btn').forEach(btn => {
        btn.style.background  = '#f8fafc';
        btn.style.color       = '#64748b';
        btn.style.borderColor = '#e2e8f0';
    });
    let active = document.getElementById('et-' + type);
    if (active) {
        let t = ENTRY_TYPES[type] || ENTRY_TYPES.personal;
        active.style.background  = t.bg;
        active.style.color       = t.color;
        active.style.borderColor = t.border;
    }
    let hint = document.getElementById('entryTypePrompt');
    if (hint) {
        let prompt = ENTRY_TYPE_PROMPTS[type];
        if (prompt) {
            hint.textContent = prompt;
            hint.style.borderLeftColor = (ENTRY_TYPES[type] || ENTRY_TYPES.personal).color;
            hint.style.display = 'block';
        } else {
            hint.style.display = 'none';
        }
    }
    let ratingRow = document.getElementById('weeklyRatingRow');
    if (ratingRow) ratingRow.style.display = type === 'weekly' ? 'block' : 'none';
    if (type !== 'weekly') { selectedWeeklyRating = 0; setWeeklyRating(0); }
    if (applyTemplate && type !== 'personal') applyJournalTemplate(type);
}

function setJournalTypeFilter(type) {
    activeJournalTypeFilter = type;
    const allTypes = ['', 'personal', 'case', 'postcall', 'grandrounds', 'procedure', 'rotation', 'weekly'];
    allTypes.forEach(t => {
        let btn = document.getElementById('jtf-' + (t || 'all'));
        if (!btn) return;
        if (t === type) {
            if (t === '') {
                btn.style.background = '#0f172a'; btn.style.color = 'white'; btn.style.borderColor = '#0f172a';
            } else {
                let et = ENTRY_TYPES[t] || ENTRY_TYPES.personal;
                btn.style.background = et.bg; btn.style.color = et.color; btn.style.borderColor = et.border;
            }
        } else {
            btn.style.background = 'white'; btn.style.color = '#64748b'; btn.style.borderColor = '#e2e8f0';
        }
    });
    renderJournalList();
}

function showJournalView(view) {
    let listEl   = document.getElementById('journalList');
    let insEl    = document.getElementById('journalInsights');
    let weekEl   = document.getElementById('journalWeekReport');
    let listBtn  = document.getElementById('jv-list');
    let insBtn   = document.getElementById('jv-insights');
    let weekBtn  = document.getElementById('jv-week');
    if (!listEl) return;

    // Reset all panels and buttons
    [listEl, insEl, weekEl].forEach(el => { if (el) el.style.display = 'none'; });
    [listBtn, insBtn, weekBtn].forEach(btn => {
        if (btn) { btn.style.background = 'transparent'; btn.style.color = '#64748b'; btn.style.boxShadow = 'none'; }
    });

    if (view === 'insights') {
        insEl.style.display = 'block';
        insBtn.style.background = '#0f172a'; insBtn.style.color = 'white'; insBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
        renderJournalInsights();
    } else if (view === 'week') {
        weekEl.style.display = 'block';
        weekBtn.style.background = '#0f172a'; weekBtn.style.color = 'white'; weekBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
        renderWeeklyReport();
    } else {
        listEl.style.display = 'block';
        listBtn.style.background = '#0f172a'; listBtn.style.color = 'white'; listBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
    }
}

function renderWeeklyReport() {
    let el = document.getElementById('journalWeekReport');
    if (!el) return;

    // Week bounds (Mon–Sun)
    let todayStr = getTodayStr();
    let today    = new Date(todayStr + 'T12:00:00');
    let dow      = today.getDay();
    let monday   = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
    let sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6);
    let monISO   = monday.toLocaleDateString('en-CA');
    let sunISO   = sunday.toLocaleDateString('en-CA');
    let fmt      = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });

    const inRange = date => date && date >= monISO && date <= sunISO;

    // ── Collect all section data ──
    let cases      = allCases.filter(c => inRange(c.date));
    let missions   = JSON.parse(localStorage.getItem('calEvents') || '[]').filter(e => inRange(e.date));
    let todos      = JSON.parse(localStorage.getItem('eyeTodos')  || '[]').filter(t => t.done && inRange(t.doneAt?.slice(0,10)));
    let journals   = getJournalEntries().filter(e => inRange(e.date));
    let notes      = JSON.parse(localStorage.getItem('eyeNotes')  || '[]').filter(n => inRange(n.date || n.createdAt?.slice(0,10)));
    let didactics  = getDidactics().filter(d => inRange(d.date));
    let duty       = JSON.parse(localStorage.getItem('eyeDutyShifts') || '[]').filter(s => inRange(s.date));
    let wellness   = getWellness().filter(w => inRange(w.date));
    let fitness    = getFitness().filter(f => inRange(f.date));

    // ── Summary numbers ──
    let primaryCases = cases.filter(c => c.role === 'Primary Surgeon').length;
    let dutyHrs      = duty.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);
    let fitnessMins  = fitness.reduce((s, f) => s + (f.duration || 0), 0);
    let avgWellness  = wellness.length ? Math.round(wellness.reduce((s, w) => s + (w.wellbeing || 0), 0) / wellness.length * 10) / 10 : null;

    const section = (icon, title, color, content) => content ? `
        <div style="background:white;border:1.5px solid #f1f5f9;border-radius:14px;padding:14px 16px;margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">${icon} ${title}</div>
            ${content}
        </div>` : '';

    const pill = (text, color, bg) =>
        `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;color:${color};background:${bg};margin:2px 3px 2px 0">${text}</span>`;

    const row = (label, val) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <span style="color:#374151">${label}</span>
            <span style="font-weight:700;color:#0f172a">${val}</span>
        </div>`;

    // Cases section
    let casesHtml = cases.length ? cases.sort((a,b) => a.date > b.date ? 1 : -1).map(c =>
        `<div style="padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px;display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">${c.role === 'Primary Surgeon' ? '🔵' : c.role === 'Assistant' ? '⚪' : '👁️'}</span>
            <div>
                <div style="font-weight:600;color:#0f172a">${c.procedure || 'Unknown'}</div>
                <div style="font-size:11px;color:#94a3b8">${new Date(c.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}${c.attending ? ' · ' + c.attending : ''}</div>
            </div>
        </div>`).join('') : '';

    // Missions section
    const _rSmeta = { pending:{icon:'🕐',color:'#d97706'}, inprogress:{icon:'⚡',color:'#2563eb'}, done:{icon:'✅',color:'#16a34a'}, cancelled:{icon:'✕',color:'#94a3b8'} };
    const _rPmeta = { high:{dot:'🔴'}, medium:{dot:'🟡'}, low:{dot:'🟢'} };
    let missionsHtml = missions.length ? missions.map(m => {
        let sm = _rSmeta[m.status || 'pending'];
        let pm = _rPmeta[m.priority || 'medium'];
        return `<div style="padding:7px 0;border-bottom:1px solid #f8fafc;font-size:13px;display:flex;align-items:center;gap:8px">
            <span style="font-size:14px">${sm.icon}</span>
            <div style="flex:1">
                <span style="font-weight:600;color:#0f172a;${m.status==='done'?'text-decoration:line-through;opacity:0.6':''}">${m.title}</span>
                <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:20px;background:${sm.color}15;color:${sm.color};margin-left:6px">${sm.icon.length>1?sm.icon:''} ${m.status==='inprogress'?'In Progress':m.status||'Pending'}</span>
                <span style="font-size:10px;margin-left:4px">${pm.dot}</span>
                <span style="font-size:11px;color:#94a3b8;margin-left:6px">${new Date(m.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}${m.time ? ' ' + m.time : ''}</span>
            </div>
        </div>`;
    }).join('') : '';

    // Completed todos
    let todosHtml = todos.length ? todos.map(t =>
        `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <span style="color:#16a34a">✓</span>
            <span style="color:#374151">${t.text}</span>
        </div>`).join('') : '';

    // Journal entries
    let journalsHtml = journals.length ? journals.map(e => {
        let et = ENTRY_TYPES[e.type || 'personal'] || ENTRY_TYPES.personal;
        let words = (e.body||'').replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length;
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px;cursor:pointer" onclick="openJournalModal('${e.id}')">
            <span style="font-size:16px">${e.mood || '😊'}</span>
            <div style="flex:1">
                <span style="font-weight:600;color:#0f172a">${e.title || 'Journal Entry'}</span>
                <span style="display:inline-block;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:700;color:${et.color};background:${et.bg};margin-left:6px">${et.icon} ${et.label}</span>
            </div>
            <span style="font-size:11px;color:#94a3b8">${words}w</span>
        </div>`;
    }).join('') : '';

    // Notes section
    let notesHtml = notes.length ? notes.map(n =>
        `<div style="padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <span style="font-weight:600;color:#0f172a">${n.title || 'Note'}</span>
            ${n.content ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${(n.content||'').replace(/<[^>]*>/g,' ').slice(0,80)}…</div>` : ''}
        </div>`).join('') : '';

    // Didactics section
    let didacticsHtml = didactics.length ? didactics.map(d =>
        `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <span style="font-size:14px">🎤</span>
            <div><span style="font-weight:600;color:#0f172a">${d.title || d.type || 'Session'}</span>
            ${d.speaker ? `<span style="font-size:11px;color:#94a3b8;margin-left:6px">— ${d.speaker}</span>` : ''}</div>
        </div>`).join('') : '';

    // Fitness section
    let fitnessHtml = fitness.length ? fitness.map(f => {
        let ft = FITNESS_TYPES[f.type] || FITNESS_TYPES.other;
        return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <span style="font-size:18px">${ft.icon}</span>
            <div>
                <span style="font-weight:600;color:#0f172a">${ft.label}${f.details ? ' — ' + f.details : ''}</span>
                <span style="font-size:11px;color:#94a3b8;margin-left:6px">${f.duration}min</span>
            </div>
        </div>`;
    }).join('') : '';

    // Wellness section
    let wellnessHtml = wellness.length ? wellness.map(w =>
        `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #f8fafc;font-size:13px">
            <div style="width:28px;height:28px;border-radius:8px;background:${w.wellbeing >= 8 ? '#f0fdf4' : w.wellbeing >= 5 ? '#fffbeb' : '#fef2f2'};border:1.5px solid ${w.wellbeing >= 8 ? '#86efac' : w.wellbeing >= 5 ? '#fde68a' : '#fca5a5'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${w.wellbeing >= 8 ? '#16a34a' : w.wellbeing >= 5 ? '#d97706' : '#dc2626'};flex-shrink:0">${w.wellbeing || '–'}</div>
            <div>
                <span style="font-size:11px;color:#94a3b8">${new Date(w.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                ${w.win ? `<div style="font-size:12px;color:#374151;font-style:italic">🏆 ${w.win}</div>` : ''}
                ${w.stressors?.length ? `<div style="font-size:11px;color:#94a3b8">Stressors: ${w.stressors.join(', ')}</div>` : ''}
            </div>
        </div>`).join('') : '';

    // Duty hours
    let dutyHtml = duty.length ? row('Shifts logged', duty.length) + row('Total hours', dutyHrs.toFixed(1) + 'h') : '';

    el.innerHTML = `
    <!-- Week header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e40af);border-radius:16px;padding:18px 20px;margin-bottom:14px;color:white">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:4px">Weekly Report</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:12px">${fmt(monday)} – ${fmt(sunday)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${pill(`${cases.length} cases`, 'white', 'rgba(255,255,255,0.15)')}
            ${pill(`${primaryCases} primary`, 'white', 'rgba(255,255,255,0.15)')}
            ${missions.length ? pill(`${missions.length} missions`, 'white', 'rgba(255,255,255,0.15)') : ''}
            ${todos.length ? pill(`${todos.length} tasks done`, 'white', 'rgba(255,255,255,0.15)') : ''}
            ${journals.length ? pill(`${journals.length} journal entries`, 'white', 'rgba(255,255,255,0.15)') : ''}
            ${fitness.length ? pill(`${fitness.length} workouts · ${fitnessMins}min`, 'white', 'rgba(255,255,255,0.15)') : ''}
            ${avgWellness !== null ? pill(`Wellness ${avgWellness}/10`, 'white', 'rgba(255,255,255,0.15)') : ''}
            ${dutyHrs > 0 ? pill(`${dutyHrs.toFixed(0)}h duty`, 'white', 'rgba(255,255,255,0.15)') : ''}
        </div>
    </div>

    ${section('🔬', 'Cases Logged', '#7c3aed', casesHtml)}
    ${section('📌', 'Missions', '#ca8a04', missionsHtml)}
    ${section('✅', 'Tasks Completed', '#16a34a', todosHtml)}
    ${section('📓', 'Journal Entries', '#7c3aed', journalsHtml)}
    ${section('📌', 'Notes Added', '#059669', notesHtml)}
    ${section('🎤', 'Didactics & Education', '#2563eb', didacticsHtml)}
    ${section('💪', 'Fitness', '#e11d48', fitnessHtml)}
    ${section('💆', 'Wellness Check-ins', '#ec4899', wellnessHtml)}
    ${dutyHrs > 0 ? section('⏰', 'Duty Hours', '#d97706', dutyHtml) : ''}

    ${!cases.length && !missions.length && !journals.length && !fitness.length ? `
    <div style="text-align:center;padding:40px 20px;color:#94a3b8">
        <div style="font-size:36px;margin-bottom:10px">📅</div>
        <p style="font-size:14px;font-weight:600;color:#64748b">Nothing logged this week yet</p>
        <p style="font-size:13px">Start logging cases, missions, and journal entries</p>
    </div>` : ''}

    <button onclick="showTab('journal',null);showWorkspaceTab('journal');setTimeout(()=>{openJournalModal();setTimeout(()=>{selectEntryType('weekly',true)},80)},100)"
        style="width:100%;margin:14px 0 0;background:#0f172a;color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;padding:13px">
        ✍️ Write Weekly Review Entry
    </button>`;
}

function openJournalWithPrompt() {
    let promptText = document.getElementById('journalPromptText')?.textContent || '';
    openJournalModal();
    setTimeout(() => {
        let titleEl = document.getElementById('journalTitle');
        if (titleEl && promptText) titleEl.value = promptText;
    }, 80);
}

// ── Journal linked records ─────────────────────────────────────────────────────
let _jLinks = []; // [{type:'case'|'study', id, label}]

function searchJournalLinks(q) {
    let dd = document.getElementById('jLinkDropdown');
    if (!q || q.length < 1) { dd.style.display = 'none'; return; }
    let ql = q.toLowerCase();

    // Collect candidates: cases + study items
    let results = [];
    allCases.forEach(c => {
        let label = [c.procedure, c.date, c.attending].filter(Boolean).join(' · ');
        if (label.toLowerCase().includes(ql)) {
            results.push({ type:'case', id:c.id, label, color:'#7c3aed', bg:'#faf5ff', icon:'🔬' });
        }
    });
    getStudyItems().forEach(s => {
        let label = s.title || s.author || '';
        if (label.toLowerCase().includes(ql)) {
            results.push({ type:'study', id:s.id, label, color:'#2563eb', bg:'#eff6ff', icon:'📚' });
        }
    });

    // Filter out already-linked
    results = results.filter(r => !_jLinks.some(l => l.id === r.id));
    results = results.slice(0, 8);

    if (!results.length) { dd.style.display = 'none'; return; }

    dd.innerHTML = results.map(r => `
        <div onclick="addJournalLink('${r.type}','${r.id}',${JSON.stringify(r.label)},${JSON.stringify(r.color)},${JSON.stringify(r.bg)},${JSON.stringify(r.icon)})"
            style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;font-size:13px;transition:background 0.1s"
            onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <span style="font-size:16px">${r.icon}</span>
            <div>
                <div style="font-weight:600;color:#0f172a">${r.label}</div>
                <div style="font-size:11px;color:#94a3b8;text-transform:capitalize">${r.type}</div>
            </div>
        </div>`).join('');
    dd.style.display = 'block';
}

function addJournalLink(type, id, label, color, bg, icon) {
    if (!_jLinks.some(l => l.id === id)) {
        _jLinks.push({ type, id, label, color, bg, icon });
    }
    let inp = document.getElementById('jLinkSearch');
    if (inp) inp.value = '';
    document.getElementById('jLinkDropdown').style.display = 'none';
    _renderJLinkPills();
}

function removeJournalLink(id) {
    _jLinks = _jLinks.filter(l => l.id !== id);
    _renderJLinkPills();
}

function _renderJLinkPills() {
    let el = document.getElementById('jLinkPills');
    if (!el) return;
    if (!_jLinks.length) { el.innerHTML = ''; return; }
    el.innerHTML = _jLinks.map(l => `
        <span style="display:inline-flex;align-items:center;gap:5px;background:${l.bg||'#f1f5f9'};color:${l.color||'#374151'};border:1.5px solid ${l.color||'#e2e8f0'}33;border-radius:20px;padding:4px 10px 4px 8px;font-size:12px;font-weight:600">
            <span>${l.icon||'🔗'}</span>
            <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.label}</span>
            <button onclick="removeJournalLink('${l.id}')" style="background:none;border:none;cursor:pointer;padding:0;margin:0;width:auto;min-width:0;line-height:0;color:${l.color||'#94a3b8'};opacity:0.6" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </span>`).join('');
}

function openJournalModal(id) {
    let entry = id ? getJournalEntries().find(e => e.id === id) : null;

    let hdr = document.querySelector('#journalModal h2');
    if (hdr) hdr.textContent = entry ? 'Edit Entry' : 'New Entry';

    document.getElementById('journalEntryId').value  = entry ? entry.id : '';
    document.getElementById('journalDate').value     = entry ? entry.date : getTodayStr();
    document.getElementById('journalTitle').value    = entry ? (entry.title || '') : '';
    document.getElementById('journalBody').innerHTML = entry ? (entry.body || '') : '';

    selectedMood = entry ? (entry.mood || '😊') : '😊';
    updateMoodButtons();

    // Entry type — restore from entry or default to personal
    selectEntryType(entry ? (entry.type || 'personal') : 'personal', false);

    // Populate case link dropdown
    let sel = document.getElementById('journalCaseLink');
    sel.innerHTML = '<option value="">— No case linked —</option>';
    allCases.slice(0,50).forEach(c => {
        let opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = (c.date || '') + ' · ' + (c.procedure || '') + (c.attending ? ' · ' + c.attending : '');
        if (entry && entry.caseId === c.id) opt.selected = true;
        sel.appendChild(opt);
    });

    // Load linked records
    _jLinks = entry && Array.isArray(entry.links) ? [...entry.links] : [];
    let inp = document.getElementById('jLinkSearch');
    if (inp) inp.value = '';
    let dd = document.getElementById('jLinkDropdown');
    if (dd) dd.style.display = 'none';
    _renderJLinkPills();

    document.getElementById('journalModal').style.display = 'flex';
}

function closeJournalModal() {
    document.getElementById('journalModal').style.display = 'none';
    let dd = document.getElementById('jLinkDropdown');
    if (dd) dd.style.display = 'none';
    _jLinks = [];
    let ratingRow = document.getElementById('weeklyRatingRow');
    if (ratingRow) ratingRow.style.display = 'none';
    selectedWeeklyRating = 0;
    let hint = document.getElementById('entryTypePrompt');
    if (hint) hint.style.display = 'none';
    selectedEntryType = 'personal';
}

function selectMood(mood) {
    selectedMood = mood;
    updateMoodButtons();
}

function updateMoodButtons() {
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.style.borderColor  = '#e2e8f0';
        btn.style.background   = '#f8fafc';
        btn.style.transform    = 'scale(1)';
        btn.style.boxShadow    = 'none';
        btn.style.opacity      = '0.55';
    });
    let active = document.getElementById('mood-' + selectedMood);
    if (active) {
        active.style.borderColor = '#0f172a';
        active.style.background  = '#f1f5f9';
        active.style.transform   = 'scale(1.15)';
        active.style.boxShadow   = '0 2px 8px rgba(0,0,0,0.12)';
        active.style.opacity     = '1';
    }
}

function renderJournalStats() {
    let el = document.getElementById('journalStats');
    if (!el) return;
    let entries  = getJournalEntries();
    let today    = getTodayStr();
    let sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6);
    let weekISO  = sevenAgo.toISOString().slice(0,10);
    let thisWeek = entries.filter(e => e.date && e.date >= weekISO && e.date <= today).length;
    let totalWords = entries.reduce((s,e) => s + (e.body||'').replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length, 0);

    // Streak: consecutive days back from today that have at least one entry
    let dateSet = new Set(entries.map(e => e.date));
    let streak  = 0;
    let cur     = new Date(today + 'T12:00:00');
    while (dateSet.has(cur.toISOString().slice(0,10))) {
        streak++;
        cur.setDate(cur.getDate() - 1);
    }

    // Show daily prompt banner if no entry today
    let banner = document.getElementById('journalPromptBanner');
    if (banner) {
        if (!dateSet.has(today)) {
            let promptIdx = new Date().getDay() % JOURNAL_PROMPTS.length;
            let promptEl  = document.getElementById('journalPromptText');
            if (promptEl) promptEl.textContent = JOURNAL_PROMPTS[promptIdx];
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }

    const stat = (val, label, color) =>
        `<div style="flex-shrink:0;background:white;border:1.5px solid #f1f5f9;border-radius:12px;padding:10px 14px;text-align:center;min-width:72px">
            <div style="font-size:20px;font-weight:800;color:${color};line-height:1">${val}</div>
            <div style="font-size:10px;font-weight:600;color:#94a3b8;margin-top:2px;white-space:nowrap">${label}</div>
        </div>`;

    el.innerHTML =
        stat(entries.length, 'Total', '#0f172a') +
        stat(thisWeek, 'This Week', '#7c3aed') +
        stat(streak, streak === 1 ? 'Day Streak' : 'Day Streak', streak >= 7 ? '#f59e0b' : streak >= 3 ? '#7c3aed' : '#94a3b8') +
        stat(totalWords >= 1000 ? Math.round(totalWords/1000)+'k' : totalWords, 'Words', '#2563eb');
}

function renderJournalInsights() {
    let el = document.getElementById('journalInsights');
    if (!el) return;
    let entries = getJournalEntries();
    if (!entries.length) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:32px;margin-bottom:10px">📊</div>
            <p style="font-size:14px;font-weight:600;color:#64748b">No entries yet</p>
            <p style="font-size:13px">Start journaling to see your insights</p>
        </div>`;
        return;
    }

    // Mood distribution
    let moodCounts = {};
    entries.forEach(e => { moodCounts[e.mood || '😊'] = (moodCounts[e.mood || '😊'] || 0) + 1; });
    let moodMax = Math.max(...Object.values(moodCounts));
    let moodColors = { '💪':'#16a34a', '😊':'#2563eb', '😐':'#94a3b8', '😤':'#ea580c', '🤔':'#7c3aed' };
    let moodBars = Object.entries(moodCounts).sort((a,b) => b[1]-a[1]).map(([m,n]) =>
        `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:18px;width:24px">${m}</span>
            <div style="flex:1;background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden">
                <div style="background:${moodColors[m]||'#94a3b8'};width:${Math.round(n/moodMax*100)}%;height:8px;border-radius:99px;transition:width 0.6s ease"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:#374151;min-width:20px;text-align:right">${n}</span>
        </div>`).join('');

    // Entry type breakdown
    let typeCounts = {};
    entries.forEach(e => { typeCounts[e.type || 'personal'] = (typeCounts[e.type || 'personal'] || 0) + 1; });
    let typeMax = Math.max(...Object.values(typeCounts));
    let typeBars = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).map(([t,n]) => {
        let et = ENTRY_TYPES[t] || ENTRY_TYPES.personal;
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:14px;width:20px">${et.icon}</span>
            <span style="font-size:11px;font-weight:600;color:#374151;min-width:90px">${et.label}</span>
            <div style="flex:1;background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden">
                <div style="background:${et.color};width:${Math.round(n/typeMax*100)}%;height:8px;border-radius:99px;transition:width 0.6s ease"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:#374151;min-width:20px;text-align:right">${n}</span>
        </div>`;
    }).join('');

    // Monthly writing count (last 6 months)
    let monthlyCounts = {};
    entries.forEach(e => { if (e.date) { let m = e.date.slice(0,7); monthlyCounts[m] = (monthlyCounts[m]||0)+1; } });
    let last6 = [];
    let now = new Date();
    for (let i = 5; i >= 0; i--) {
        let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        let key = d.toLocaleDateString('en-CA').slice(0,7);
        let lbl = d.toLocaleString('default', { month:'short' });
        last6.push({ key, lbl, count: monthlyCounts[key] || 0 });
    }
    let monthMax = Math.max(...last6.map(m => m.count), 1);
    let monthBars = last6.map(m =>
        `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
            <div style="width:100%;background:#f1f5f9;border-radius:4px;height:50px;display:flex;align-items:flex-end;overflow:hidden">
                <div style="width:100%;background:${m.count ? '#7c3aed' : 'transparent'};height:${Math.round(m.count/monthMax*100)}%;border-radius:3px;transition:height 0.6s ease;min-height:${m.count?'4px':'0'}"></div>
            </div>
            <span style="font-size:9px;font-weight:600;color:#94a3b8">${m.lbl}</span>
            <span style="font-size:10px;font-weight:700;color:${m.count?'#374151':'#d1d5db'}">${m.count||''}</span>
        </div>`).join('');

    // Summary stats
    let avgWords = Math.round(entries.reduce((s,e)=>s+(e.body||'').replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length,0) / entries.length);
    let longestEntry = entries.reduce((best,e) => {
        let w = (e.body||'').replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length;
        return w > (best.w||0) ? { ...e, w } : best;
    }, {});
    let months = Object.keys(monthlyCounts);
    let mostActive = months.sort((a,b)=>(monthlyCounts[b]||0)-(monthlyCounts[a]||0))[0];
    let mostActiveLabel = mostActive ? new Date(mostActive+'-02').toLocaleString('default',{month:'long',year:'numeric'}) : '—';

    el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#7c3aed">${avgWords}</div>
            <div style="font-size:10px;font-weight:600;color:#94a3b8;margin-top:2px">Avg words/entry</div>
        </div>
        <div style="background:#f8fafc;border-radius:12px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:#2563eb">${longestEntry.w || 0}</div>
            <div style="font-size:10px;font-weight:600;color:#94a3b8;margin-top:2px">Longest entry</div>
        </div>
    </div>
    <div style="background:white;border:1.5px solid #f1f5f9;border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Mood Distribution</div>
        ${moodBars}
    </div>
    <div style="background:white;border:1.5px solid #f1f5f9;border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Entry Types</div>
        ${typeBars}
    </div>
    <div style="background:white;border:1.5px solid #f1f5f9;border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Writing Activity</div>
        <div style="display:flex;gap:6px;align-items:flex-end">${monthBars}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:10px">Most active: <strong style="color:#374151">${mostActiveLabel}</strong></div>
    </div>`;
}

const JOURNAL_PROMPTS = [
    "What's the one thing you want to master this week?",
    "Describe a case that challenged you today.",
    "What did you learn from your attending today?",
    "What would you do differently next time?",
    "What are you most proud of this week?",
    "What clinical skill improved most recently?",
    "Reflect on a patient interaction that stayed with you.",
];
function renderActivityHeatmap() {
    let el = document.getElementById('activityHeatmap');
    if (!el) return;
    let activity = {};
    allCases.forEach(c => { if (c.date) activity[c.date] = (activity[c.date]||0) + 1; });
    getJournalEntries().forEach(e => { if (e.date) activity[e.date] = (activity[e.date]||0) + 1; });
    let today = new Date();
    let todayStr = getTodayStr();
    let startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 52*7 - today.getDay());
    let dayLabels = ['S','M','T','W','T','F','S'];
    let colors = ['#f1f5f9','#bfdbfe','#60a5fa','#2563eb','#1e40af'];
    function getColor(count) {
        if (!count) return colors[0];
        if (count === 1) return colors[1];
        if (count === 2) return colors[2];
        if (count <= 4) return colors[3];
        return colors[4];
    }
    let weeks = [];
    let cur = new Date(startDate);
    while (cur <= today) {
        let week = [];
        for (let d = 0; d < 7; d++) {
            let ds = cur.toISOString().slice(0,10);
            let count = activity[ds] || 0;
            let isFuture = cur > today;
            let isToday = ds === todayStr;
            week.push({ ds, count, isFuture, isToday });
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(week);
    }
    let html = `<div style="display:inline-grid;grid-template-columns:16px repeat(${weeks.length},12px);grid-template-rows:16px repeat(7,12px);gap:2px;align-items:center">`;
    html += `<div></div>`;
    weeks.forEach((week, wi) => {
        let m = new Date(week[0].ds+'T12:00:00').getMonth();
        let prevM = wi > 0 ? new Date(weeks[wi-1][0].ds+'T12:00:00').getMonth() : -1;
        html += `<div style="font-size:9px;color:#94a3b8;white-space:nowrap;overflow:visible">${m !== prevM ? new Date(week[0].ds+'T12:00:00').toLocaleString('default',{month:'short'}) : ''}</div>`;
    });
    for (let d = 0; d < 7; d++) {
        html += `<div style="font-size:9px;color:#94a3b8;padding-right:2px;text-align:right">${[0,2,4,6].includes(d)?dayLabels[d]:''}</div>`;
        weeks.forEach(week => {
            let cell = week[d];
            if (!cell) { html += `<div></div>`; return; }
            let bg = cell.isFuture ? 'transparent' : getColor(cell.count);
            let border = cell.isToday ? '1.5px solid #2563eb' : '1.5px solid transparent';
            let tip = cell.isFuture ? '' : `title="${cell.ds}: ${cell.count} activit${cell.count===1?'y':'ies'}"`;
            html += `<div ${tip} style="width:11px;height:11px;border-radius:3px;background:${bg};border:${border};cursor:${cell.isFuture?'default':'pointer'}"></div>`;
        });
    }
    html += `</div>`;
    el.innerHTML = html;
}

function renderReadinessScore(cases) {
    let el = document.getElementById('readinessWidget');
    if (!el) return;

    let now = new Date();
    let toISO = d => d.toISOString().slice(0,10);
    let sevenAgo = new Date(now); sevenAgo.setDate(now.getDate() - 7);
    let fourteenAgo = new Date(now); fourteenAgo.setDate(now.getDate() - 14);
    let sevenISO = toISO(sevenAgo), fourteenISO = toISO(fourteenAgo), todayISO = toISO(now);

    // ── Factor 1: Cases this week (max 30 pts, 5 cases = full)
    let weekCases = cases.filter(c => c.date && c.date >= sevenISO && c.date <= todayISO);
    let casePts   = Math.min(weekCases.length / 5, 1) * 30;

    // ── Factor 2: Journal activity this week (max 20 pts, 3 entries = full)
    let weekJournal = getJournalEntries().filter(j => j.date && j.date >= sevenISO && j.date <= todayISO);
    let journalPts  = Math.min(weekJournal.length / 3, 1) * 20;

    // ── Factor 3: Todos completed this week (max 20 pts, 5 done = full)
    let todos = JSON.parse(localStorage.getItem('eyeTodos') || '[]');
    let doneTodos = todos.filter(t => t.done && t.doneAt && t.doneAt >= sevenISO);
    let todoPts   = Math.min(doneTodos.length / 5, 1) * 20;

    // ── Factor 4: Phaco recency (max 30 pts — decays over 14 days)
    let phacos = cases.filter(c => c.procedure && c.procedure.toLowerCase().includes('phaco') && c.date)
        .sort((a,b) => b.date.localeCompare(a.date));
    let lastPhaco = phacos[0];
    let phacoPts  = 0;
    let phacoLabel = 'No phaco logged';
    if (lastPhaco) {
        let daysSince = Math.floor((now - new Date(lastPhaco.date+'T12:00:00')) / 86400000);
        phacoPts  = Math.max(0, (1 - daysSince / 14)) * 30;
        phacoLabel = daysSince === 0 ? 'Phaco today 🎯' : `Last phaco ${daysSince}d ago`;
    }

    let score = Math.round(casePts + journalPts + todoPts + phacoPts);

    // ── Last week score for trend
    let prevWeekCases   = cases.filter(c => c.date && c.date >= fourteenISO && c.date < sevenISO);
    let prevJournal     = getJournalEntries().filter(j => j.date && j.date >= fourteenISO && j.date < sevenISO);
    let prevScore = Math.round(
        Math.min(prevWeekCases.length / 5, 1) * 30 +
        Math.min(prevJournal.length / 3, 1) * 20
    );
    let trend = score > prevScore ? '↑' : score < prevScore ? '↓' : '→';
    let trendColor = score > prevScore ? '#16a34a' : score < prevScore ? '#dc2626' : '#94a3b8';

    // ── Color
    let scoreColor = score >= 75 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
    let scoreBg    = score >= 75 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : '#fef2f2';
    let scoreLabel = score >= 75 ? 'Peak' : score >= 50 ? 'Moderate' : 'Low Activity';

    // ── SVG ring (280° arc, r=36)
    let r = 36, cx = 52, cy = 52;
    let circumference = 2 * Math.PI * r;
    let filled = (score / 100) * circumference * 0.78; // 0.78 ≈ 280°/360°
    let ring = `<svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="10" stroke-dasharray="${circumference*0.78} ${circumference}" stroke-dashoffset="${-circumference*0.11}" stroke-linecap="round" transform="rotate(140 ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${scoreColor}" stroke-width="10"
            stroke-dasharray="${filled} ${circumference}" stroke-dashoffset="${-circumference*0.11}" stroke-linecap="round"
            transform="rotate(140 ${cx} ${cy})" style="transition:stroke-dasharray 1s ease"/>
        <text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="22" font-weight="800" fill="${scoreColor}" font-family="Inter,sans-serif">${score}</text>
        <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="9" font-weight="700" fill="#94a3b8" font-family="Inter,sans-serif" letter-spacing="0.5">/ 100</text>
    </svg>`;

    const factor = (label, pts, max, icon, detail) => {
        let pct = Math.round((pts / max) * 100);
        let fc  = pct >= 80 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';
        return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f8fafc">
            <span style="font-size:16px;width:22px;text-align:center">${icon}</span>
            <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                    <span style="font-size:12px;font-weight:600;color:#374151">${label}</span>
                    <span style="font-size:11px;font-weight:700;color:${fc}">${Math.round(pts)}/${max}</span>
                </div>
                <div style="background:#f1f5f9;border-radius:99px;height:4px;overflow:hidden">
                    <div style="background:${fc};width:${Math.round(pts/max*100)}%;height:4px;border-radius:99px;transition:width 0.8s ease"></div>
                </div>
                <span style="font-size:10px;color:#94a3b8">${detail}</span>
            </div>
        </div>`;
    };

    el.innerHTML = `<div class="dash-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
                <h3 style="margin:0 0 2px;font-size:14px;font-weight:700">Readiness Score</h3>
                <p style="margin:0;font-size:11px;color:#94a3b8">Based on last 7 days of activity</p>
            </div>
            <span style="font-size:12px;font-weight:700;color:${trendColor};padding:3px 10px;border-radius:20px;background:${trendColor}14">${trend} vs last week</span>
        </div>
        <div style="display:flex;align-items:center;gap:20px">
            <div style="flex-shrink:0;position:relative">
                ${ring}
                <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px">
                    <span style="font-size:9px;font-weight:800;color:${scoreColor};text-transform:uppercase;letter-spacing:0.5px">${scoreLabel}</span>
                </div>
            </div>
            <div style="flex:1;min-width:0">
                ${factor('Cases this week', casePts, 30, '🔬', `${weekCases.length} case${weekCases.length!==1?'s':''} (goal: 5)`)}
                ${factor('Phaco recency', phacoPts, 30, '👁️', phacoLabel)}
                ${factor('Journal entries', journalPts, 20, '📔', `${weekJournal.length} entr${weekJournal.length!==1?'ies':'y'} (goal: 3)`)}
                ${factor('Tasks completed', todoPts, 20, '✅', `${doneTodos.length} done this week`)}
            </div>
        </div>
    </div>`;
}

function renderTodayWidget() {
    let el = document.getElementById('todayFocus');
    if (!el) return;
    let today = getTodayStr();
    let todayCases = allCases.filter(c => c.date === today);
    let todos      = JSON.parse(localStorage.getItem('eyeTodos')||'[]').filter(t => !t.done && t.due === today);
    let events     = JSON.parse(localStorage.getItem('calEvents')||'[]').filter(ev => ev.date === today);
    let dateLabel  = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    let isSunday   = new Date().getDay() === 0;

    // Build rows
    let rows = '';
    if (events.length) rows += events.map(ev =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">
            <div style="width:8px;height:8px;border-radius:50%;background:#2563eb;flex-shrink:0"></div>
            <span style="font-size:13px;color:#0f172a;font-weight:500">${ev.title}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:auto">Event</span>
         </div>`).join('');

    if (todayCases.length) rows += todayCases.map(c =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">
            <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0"></div>
            <span style="font-size:13px;color:#0f172a;font-weight:500">${c.procedure||'Case'}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:auto">${c.role||''}</span>
         </div>`).join('');
    else rows += `<div style="font-size:13px;color:#94a3b8;padding:8px 0;border-bottom:1px solid #f1f5f9">No cases logged today yet</div>`;

    if (todos.length) rows += todos.map(t =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9">
            <div style="width:8px;height:8px;border-radius:2px;border:2px solid #f59e0b;flex-shrink:0"></div>
            <span style="font-size:13px;color:#0f172a">${t.text}</span>
            <span style="font-size:11px;color:#94a3b8;margin-left:auto">Due today</span>
         </div>`).join('');

    el.innerHTML = `<div class="dash-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
                <h3 style="margin:0 0 1px;font-size:14px;font-weight:700">Today</h3>
                <p style="margin:0;font-size:11px;color:#94a3b8">${dateLabel}</p>
            </div>
            <button onclick="showTab('logCase',null)" style="width:auto;padding:5px 14px;margin:0;background:#0f172a;color:white;border-radius:9px;font-size:12px;font-weight:700;box-shadow:none">+ Log Case</button>
        </div>
        ${rows}
        ${isSunday ? `<div style="margin-top:10px"><button onclick="showTab('journal',null);showWorkspaceTab('journal');setTimeout(()=>{openJournalModal();setTimeout(()=>applyJournalTemplate('weekly'),80)},100)" style="width:100%;margin:0;background:#fffbeb;color:#92400e;border:1.5px solid #fde68a;border-radius:10px;font-size:12px;font-weight:700;padding:9px;box-shadow:none">📋 Write your weekly review</button></div>` : ''}
    </div>`;
}

// ── Weekly Rating ─────────────────────────────────────────────────────────────
let selectedWeeklyRating = 0;
function setWeeklyRating(n) {
    selectedWeeklyRating = n;
    for (let i = 1; i <= 10; i++) {
        let btn = document.getElementById('wr-' + i);
        if (!btn) continue;
        if (i <= n) {
            let col = n <= 4 ? { bg:'#fef2f2', txt:'#dc2626', bd:'#fca5a5' }
                     : n <= 6 ? { bg:'#fffbeb', txt:'#d97706', bd:'#fde68a' }
                     : { bg:'#f0fdf4', txt:'#16a34a', bd:'#86efac' };
            btn.style.background   = col.bg;
            btn.style.color        = col.txt;
            btn.style.borderColor  = col.bd;
            btn.style.fontWeight   = '800';
            btn.style.transform    = 'scale(1.05)';
        } else {
            btn.style.background   = '#f8fafc';
            btn.style.color        = '#94a3b8';
            btn.style.borderColor  = '#e2e8f0';
            btn.style.fontWeight   = '600';
            btn.style.transform    = 'scale(1)';
        }
    }
}

// ── Weekly Review Dashboard Widget ────────────────────────────────────────────
function renderWeeklyReviewWidget(cases) {
    let el = document.getElementById('weeklyReviewWidget');
    if (!el) return;

    // Timezone-aware week (Mon–Sun)
    let todayStr = getTodayStr();
    let today    = new Date(todayStr + 'T12:00:00');
    let dow      = today.getDay();
    let monday   = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
    let sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6);
    let fmt      = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    let toISO    = d => d.toLocaleDateString('en-CA');
    let monISO   = toISO(monday), sunISO = toISO(sunday);

    let weekCases    = cases.filter(c => c.date && c.date >= monISO && c.date <= sunISO);
    let primaryCount = weekCases.filter(c => c.role === 'Primary Surgeon').length;
    let procCounts   = {};
    weekCases.forEach(c => { procCounts[c.procedure||'?'] = (procCounts[c.procedure||'?']||0)+1; });
    let topProcs = Object.entries(procCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);

    let journals    = getJournalEntries();
    let reviewEntry = journals.find(j => j.date >= monISO && j.date <= sunISO
        && j.body && j.body.includes('Weekly Review'));

    if (reviewEntry) {
        el.innerHTML = `
        <div class="dash-card" style="border-left:3px solid #16a34a">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                    <div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">✅ Weekly Review</div>
                    <div style="font-size:14px;font-weight:700;color:#0f172a">${fmt(monday)} – ${fmt(sunday)}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:3px">${weekCases.length} case${weekCases.length!==1?'s':''} · ${primaryCount} primary · Review written</div>
                </div>
                <button onclick="editJournalEntry('${reviewEntry.id}')" style="width:auto;padding:7px 14px;margin:0;background:#f0fdf4;color:#16a34a;border:1.5px solid #86efac;border-radius:9px;font-size:12px;font-weight:700;box-shadow:none">View →</button>
            </div>
        </div>`;
    } else {
        el.innerHTML = `
        <div class="dash-card" style="border-left:3px solid #f59e0b">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <div>
                    <div style="font-size:10px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">📋 Weekly Review</div>
                    <div style="font-size:14px;font-weight:700;color:#0f172a">${fmt(monday)} – ${fmt(sunday)}</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px">Not written yet</div>
                </div>
                <button onclick="showTab('journal',null);showWorkspaceTab('journal');setTimeout(()=>{openJournalModal();setTimeout(()=>applyJournalTemplate('weekly'),80)},100)"
                    style="width:auto;padding:7px 14px;margin:0;background:#fffbeb;color:#92400e;border:1.5px solid #fde68a;border-radius:9px;font-size:12px;font-weight:700;box-shadow:none">
                    Write Review
                </button>
            </div>
            <div style="display:flex;gap:20px;align-items:center">
                <div style="text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1">${weekCases.length}</div>
                    <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Cases</div>
                </div>
                <div style="text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#0f172a;line-height:1">${primaryCount}</div>
                    <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">Primary</div>
                </div>
                ${topProcs.length ? `<div style="flex:1;border-left:1px solid #f1f5f9;padding-left:18px">
                    ${topProcs.map(([p,n])=>`<div style="font-size:11px;color:#64748b;margin-bottom:2px">${p.split('/')[0].trim()} <strong style="color:#0f172a">×${n}</strong></div>`).join('')}
                </div>` : ''}
            </div>
        </div>`;
    }
}

function applyJournalTemplate(tpl) {
    let el = document.getElementById('journalBody');
    if (!el) return;

    let content = '';
    if (tpl === 'weekly') {
        // Timezone-aware week (Mon–Sun)
        let todayStr = getTodayStr();
        let today    = new Date(todayStr + 'T12:00:00');
        let dow      = today.getDay();
        let monday   = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
        let sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6);
        let fmt      = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
        let toISO    = d => d.toLocaleDateString('en-CA');
        let monISO   = toISO(monday), sunISO = toISO(sunday);

        let weekCases = allCases.filter(c => c.date && c.date >= monISO && c.date <= sunISO);

        // Build detailed case list: one line per case with date + role + attending
        let caseLines = weekCases.length === 0
            ? '<li>No cases logged this week</li>'
            : weekCases
                .sort((a,b) => a.date > b.date ? 1 : -1)
                .map(c => {
                    let d   = new Date(c.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
                    let att = c.attending ? ` · ${c.attending}` : '';
                    let role = c.role === 'Primary Surgeon' ? ' 🔵' : c.role === 'Assistant' ? ' ⚪' : ' 👁️';
                    return `<li>${c.procedure||'Unknown'}${role} — ${d}${att}</li>`;
                }).join('');

        let primary = weekCases.filter(c => c.role === 'Primary Surgeon').length;
        let weekJournals = getJournalEntries().filter(j => j.date && j.date >= monISO && j.date <= sunISO);

        // Set title automatically
        let titleEl = document.getElementById('journalTitle');
        if (titleEl && !titleEl.value) titleEl.value = `Weekly Review — ${fmt(monday)} to ${fmt(sunday)}`;

        // Show interactive rating row
        let ratingRow = document.getElementById('weeklyRatingRow');
        if (ratingRow) ratingRow.style.display = 'block';
        selectedWeeklyRating = 0;
        setWeeklyRating(0);

        // Missions for the week
        let weekMissions = JSON.parse(localStorage.getItem('calEvents') || '[]').filter(e => e.date >= monISO && e.date <= sunISO);
        let missionLines = weekMissions.length === 0 ? '' : '<h3>📌 Missions</h3><ul>' +
            weekMissions.map(m => `<li>${m.title}${m.time ? ' (' + m.time + ')' : ''}</li>`).join('') + '</ul>';

        // Completed todos
        let weekTodos = JSON.parse(localStorage.getItem('eyeTodos') || '[]').filter(t => t.done && t.doneAt && t.doneAt.slice(0,10) >= monISO && t.doneAt.slice(0,10) <= sunISO);
        let todoLines = weekTodos.length === 0 ? '' : '<h3>✅ Tasks Completed</h3><ul>' +
            weekTodos.map(t => `<li>${t.text}</li>`).join('') + '</ul>';

        // Fitness for the week
        let weekFitness = getFitness().filter(f => f.date >= monISO && f.date <= sunISO);
        let fitnessMins = weekFitness.reduce((s, f) => s + (f.duration || 0), 0);
        let fitnessLines = weekFitness.length === 0 ? '' : '<h3>💪 Fitness</h3><ul>' +
            weekFitness.map(f => { let ft = FITNESS_TYPES[f.type] || FITNESS_TYPES.other; return `<li>${ft.icon} ${ft.label}${f.details ? ' — ' + f.details : ''} (${f.duration}min)</li>`; }).join('') + '</ul>';

        // Didactics for the week
        let weekDidactics = getDidactics().filter(d => d.date >= monISO && d.date <= sunISO);
        let didacticsLines = weekDidactics.length === 0 ? '' : '<h3>🎤 Education</h3><ul>' +
            weekDidactics.map(d => `<li>${d.title || d.type || 'Session'}${d.speaker ? ' — ' + d.speaker : ''}</li>`).join('') + '</ul>';

        // Wellness average
        let weekWellness = getWellness().filter(w => w.date >= monISO && w.date <= sunISO);
        let avgWell = weekWellness.length ? (weekWellness.reduce((s, w) => s + (w.wellbeing || 0), 0) / weekWellness.length).toFixed(1) : null;
        let wellnessLine = avgWell !== null ? `<p><strong>💆 Avg Wellbeing:</strong> ${avgWell}/10 over ${weekWellness.length} check-in${weekWellness.length !== 1 ? 's' : ''}</p>` : '';

        content = `<h3>Weekly Review — ${fmt(monday)} to ${fmt(sunday)}</h3>
<p><strong>📊 Stats:</strong> ${weekCases.length} case${weekCases.length!==1?'s':''} · ${primary} primary · ${weekJournals.length} journal entr${weekJournals.length!==1?'ies':'y'}${weekFitness.length ? ' · ' + weekFitness.length + ' workout' + (weekFitness.length!==1?'s':'') + ' (' + fitnessMins + 'min)' : ''}${avgWell ? ' · Wellness ' + avgWell + '/10' : ''}</p>
<h3>🔬 Cases Logged</h3><ul>${caseLines}</ul>
${missionLines}
${todoLines}
${didacticsLines}
${fitnessLines}
${wellnessLine}
<h3>🏆 Biggest Win This Week</h3><p></p>
<h3>😤 Hardest Moment</h3><p></p>
<h3>🔁 What I'd Do Differently</h3><p></p>
<h3>📚 What I Learned</h3><p></p>
<h3>🎯 Next Week's Focus</h3><p></p>`;
    } else {
        const templates = {
            postcall:    `<h3>🌙 Post-Call Reflection</h3><p><strong>Sleep hours:</strong> </p><p><strong>Energy level (1–10):</strong> </p><h3>Hardest Case</h3><p></p><h3>What I'd Do Differently</h3><p></p><h3>Win of the Call</h3><p></p><h3>📚 What I Learned</h3><p></p>`,
            grandrounds: `<h3>🎤 Grand Rounds / Conference Notes</h3><p><strong>Topic:</strong> </p><p><strong>Speaker:</strong> </p><p><strong>Date:</strong> </p><h3>Key Learnings</h3><ul><li></li><li></li><li></li></ul><h3>How This Changes My Practice</h3><p></p><h3>Follow-Up / Action Items</h3><p></p>`,
            rotation:    `<h3>🔄 End of Rotation Summary</h3><p><strong>Rotation:</strong> </p><p><strong>Dates:</strong> </p><p><strong>Attending(s):</strong> </p><h3>Cases Highlights</h3><p></p><h3>Skills Gained</h3><ul><li></li><li></li></ul><h3>What to Work On Next</h3><p></p><h3>Overall Rating</h3><p> / 10</p>`,
            procedure:   `<h3>👁️ Procedure Log</h3><p><strong>Procedure:</strong> </p><p><strong>Role:</strong> </p><p><strong>Attending:</strong> </p><h3>Steps That Went Well</h3><ul><li></li><li></li></ul><h3>Steps That Needed Work</h3><ul><li></li></ul><h3>Intraoperative Findings / Complications</h3><p></p><h3>What I'll Focus On Next Time</h3><p></p>`,
            case:        `<h3>🔬 Case Reflection</h3><p><strong>Diagnosis:</strong> </p><p><strong>Procedure / Plan:</strong> </p><h3>What Was Interesting About This Case</h3><p></p><h3>What I Learned</h3><p></p><h3>What I'd Do Differently</h3><p></p>`,
            personal:    ``,
        };
        content = templates[tpl] || '';
    }

    if (content) {
        el.innerHTML = content;
        el.focus();
        let range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    }
}

function rtFmt(cmd) {
    let el = document.getElementById('journalBody');
    if (!el) return;
    el.focus();
    if (cmd === 'bold')   document.execCommand('bold', false, null);
    else if (cmd === 'italic') document.execCommand('italic', false, null);
    else if (cmd === 'h3')  document.execCommand('formatBlock', false, 'h3');
    else if (cmd === 'ul')  document.execCommand('insertUnorderedList', false, null);
    else if (cmd === 'todo') {
        document.execCommand('insertHTML', false,
            '<div class="rt-task"><input type="checkbox" onclick="event.stopPropagation()"><span> </span></div>');
    }
}

function saveJournalEntry() {
    let bodyEl = document.getElementById('journalBody');
    let body = bodyEl.innerHTML.trim();
    if (!body || bodyEl.textContent.trim() === '') { showToast('Write something first!', 'warning'); return; }

    // Append weekly rating to body if set
    if (selectedWeeklyRating > 0) {
        let stars = '⭐'.repeat(selectedWeeklyRating) + (selectedWeeklyRating < 10 ? '☆'.repeat(10 - selectedWeeklyRating) : '');
        let col   = selectedWeeklyRating <= 4 ? '#dc2626' : selectedWeeklyRating <= 6 ? '#d97706' : '#16a34a';
        body += `<h3>Overall Rating</h3><p><strong style="color:${col};font-size:18px">${selectedWeeklyRating}/10</strong> &nbsp; <span style="font-size:14px;letter-spacing:1px">${stars}</span></p>`;
    }

    let entries = getJournalEntries();
    let id      = document.getElementById('journalEntryId').value;
    let entry   = {
        id:        id || crypto.randomUUID(),
        date:      document.getElementById('journalDate').value || getTodayStr(),
        mood:      selectedMood,
        type:      selectedEntryType || 'personal',
        title:     document.getElementById('journalTitle').value.trim(),
        body,
        caseId:    document.getElementById('journalCaseLink').value || null,
        links:     _jLinks.length ? [..._jLinks] : [],
        updatedAt: new Date().toISOString()
    };

    if (id) {
        let idx = entries.findIndex(e => e.id === id);
        if (idx !== -1) entries[idx] = entry; else entries.unshift(entry);
    } else {
        entries.unshift(entry);
    }

    saveJournalEntries(entries);
    _cloudUpsert('workspace_journal', entry, _wsMap.journal);
    closeJournalModal();
    renderJournalList();
    showToast('📔 Journal entry saved!');
}

function editJournalEntry(id) {
    showTab('journal', null);
    showWorkspaceTab('journal');
    setTimeout(() => openJournalModal(id), 100);
}

function deleteJournalEntry(id) {
    if (!confirm('Delete this journal entry?')) return;
    let entries = getJournalEntries().filter(e => e.id !== id);
    saveJournalEntries(entries);
    _cloudDelete('workspace_journal', id);
    renderJournalList();
    showToast('🗑️ Entry deleted', 'warning');
}

function renderJournalList() {
    let el = document.getElementById('journalList');
    if (!el) return;

    renderJournalStats();

    let search     = (document.getElementById('journalSearch')?.value || '').toLowerCase();
    let moodFilter = document.getElementById('journalMoodFilter')?.value || '';
    let entries    = getJournalEntries();

    if (search)                entries = entries.filter(e => (e.title+(e.body||'').replace(/<[^>]*>/g,' ')).toLowerCase().includes(search));
    if (moodFilter)            entries = entries.filter(e => e.mood === moodFilter);
    if (activeJournalTypeFilter) entries = entries.filter(e => (e.type || 'personal') === activeJournalTypeFilter);

    if (entries.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="width:52px;height:52px;background:#f1f5f9;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <p style="font-size:15px;font-weight:600;color:#64748b;margin-bottom:6px">${search || moodFilter || activeJournalTypeFilter ? 'No entries match' : 'No entries yet'}</p>
            <p style="font-size:13px">${search || moodFilter || activeJournalTypeFilter ? 'Try a different filter' : 'Tap <strong>New</strong> to start journaling'}</p>
        </div>`;
        return;
    }

    // Group by month
    let grouped = {};
    entries.forEach(e => {
        let key = e.date ? e.date.slice(0,7) : 'Unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
    });

    let html = '';
    for (let month of Object.keys(grouped).sort().reverse()) {
        let label = new Date(month+'-02').toLocaleString('default',{month:'long',year:'numeric'});
        html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">${label}</div>`;
        for (let e of grouped[month]) {
            let plainBody  = (e.body||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
            let preview    = plainBody.length > 130 ? plainBody.slice(0,130)+'…' : plainBody;
            let dateStr    = e.date ? new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
            let wordCount  = plainBody.split(/\s+/).filter(Boolean).length;
            let linkedCase = e.caseId ? allCases.find(c => c.id === e.caseId) : null;
            let et = ENTRY_TYPES[e.type || 'personal'] || ENTRY_TYPES.personal;

            html += `<div style="background:white;border:1.5px solid #f1f5f9;border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:box-shadow 0.15s,border-color 0.15s"
                onclick="openJournalModal('${e.id}')"
                onmouseover="this.style.boxShadow='0 4px 18px rgba(0,0,0,0.08)';this.style.borderColor='${et.border}'"
                onmouseout="this.style.boxShadow='none';this.style.borderColor='#f1f5f9'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
                        <span style="font-size:20px;flex-shrink:0">${e.mood || '😊'}</span>
                        <div style="flex:1;min-width:0">
                            ${e.title ? `<div style="font-weight:700;font-size:14px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.title}</div>` : ''}
                            <div style="font-size:11px;color:#94a3b8;margin-top:1px">${dateStr} · ${wordCount} words</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">
                        <span style="font-size:10px;font-weight:700;color:${et.color};background:${et.bg};border:1px solid ${et.border};border-radius:20px;padding:2px 8px;white-space:nowrap">${et.icon} ${et.label}</span>
                        <button onclick="event.stopPropagation();deleteJournalEntry('${e.id}')" title="Delete"
                            style="background:transparent;border:none;color:#d1d5db;padding:4px;margin:0;width:auto;min-width:0;cursor:pointer;line-height:0;border-radius:6px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#d1d5db'">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                    </div>
                </div>
                <p style="font-size:13px;color:#374151;line-height:1.65;margin:0 0 ${(linkedCase||e.links?.length)?'8px':'0'}">${preview || '<span style="color:#94a3b8;font-style:italic">No content</span>'}</p>
                ${linkedCase ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#7c3aed;font-weight:600;margin-top:6px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>${linkedCase.procedure} · ${linkedCase.date}</div>` : ''}
                ${e.links && e.links.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${e.links.map(l=>`<span onclick="event.stopPropagation();_jLinkNavigate('${l.type}','${l.id}')" style="display:inline-flex;align-items:center;gap:4px;background:${l.bg||'#f1f5f9'};color:${l.color||'#374151'};border:1px solid ${l.color||'#e2e8f0'}33;border-radius:20px;padding:3px 9px;font-size:11px;font-weight:600;cursor:pointer" title="Go to ${l.type}">${l.icon||'🔗'} ${l.label.length>28?l.label.slice(0,28)+'…':l.label}</span>`).join('')}</div>` : ''}
            </div>`;
        }
    }

    let total = getJournalEntries().length;
    let words = getJournalEntries().reduce((s,e)=>s+(e.body||'').replace(/<[^>]*>/g,' ').split(/\s+/).filter(Boolean).length,0);
    html += `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;margin-top:4px">
        ${total} entr${total===1?'y':'ies'} · ${words.toLocaleString()} words written
    </div>`;

    el.innerHTML = html;
}

function _jLinkNavigate(type, id) {
    if (type === 'case') {
        // Navigate to case list and open that case
        showTab('caseList', null);
        setTimeout(() => {
            let c = allCases.find(x => x.id === id);
            if (c) viewCaseDetail(c.id);
        }, 150);
    } else if (type === 'study') {
        showTab('journal', null);
        showWorkspaceTab('reading');
    }
}

// ── Fitness Tracker ───────────────────────────────────────────────────────────
const FITNESS_KEY = 'eyeFitness';
const FITNESS_TYPES = {
    run:     { label:'Run',     icon:'🏃', color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
    lift:    { label:'Lift',    icon:'🏋️', color:'#7c3aed', bg:'#faf5ff', border:'#ddd6fe' },
    cardio:  { label:'Cardio',  icon:'❤️', color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
    yoga:    { label:'Yoga',    icon:'🧘', color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc' },
    cycling: { label:'Cycling', icon:'🚴', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    walk:    { label:'Walk',    icon:'🚶', color:'#059669', bg:'#ecfdf5', border:'#a7f3d0' },
    hiit:    { label:'HIIT',    icon:'⚡', color:'#ea580c', bg:'#fff7ed', border:'#fed7aa' },
    swim:    { label:'Swim',    icon:'🏊', color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe' },
    other:   { label:'Other',   icon:'💪', color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
};

function getFitness()        { return JSON.parse(localStorage.getItem(FITNESS_KEY) || '[]'); }
function saveFitness_(arr)   { localStorage.setItem(FITNESS_KEY, JSON.stringify(arr)); }

let selectedFitnessType  = 'run';
let activeFitnessFilter  = '';

function selectFitnessType(type) {
    selectedFitnessType = type;
    document.querySelectorAll('.fitness-type-btn').forEach(btn => {
        btn.style.background  = '#f8fafc';
        btn.style.color       = '#64748b';
        btn.style.borderColor = '#e2e8f0';
    });
    let active = document.getElementById('ft-' + type);
    if (active) {
        let t = FITNESS_TYPES[type] || FITNESS_TYPES.other;
        active.style.background  = t.bg;
        active.style.color       = t.color;
        active.style.borderColor = t.border;
    }
}

function setFitnessFilter(type) {
    activeFitnessFilter = type;
    const all = ['', 'run', 'lift', 'cardio', 'yoga', 'cycling', 'walk', 'hiit', 'swim'];
    all.forEach(t => {
        let btn = document.getElementById('ff-' + (t || 'all'));
        if (!btn) return;
        if (t === type) {
            if (!t) { btn.style.background = '#0f172a'; btn.style.color = 'white'; btn.style.borderColor = '#0f172a'; }
            else { let ft = FITNESS_TYPES[t]; btn.style.background = ft.bg; btn.style.color = ft.color; btn.style.borderColor = ft.border; }
        } else {
            btn.style.background = 'white'; btn.style.color = '#64748b'; btn.style.borderColor = '#e2e8f0';
        }
    });
    renderFitness();
}

function openFitnessModal(id) {
    let w = id ? getFitness().find(e => e.id === id) : null;
    document.getElementById('fitnessId').value       = w ? w.id : '';
    document.getElementById('fitnessDate').value     = w ? w.date : getTodayStr();
    document.getElementById('fitnessDuration').value = w ? (w.duration || '') : '';
    document.getElementById('fitnessDetails').value  = w ? (w.details || '') : '';
    document.getElementById('fitnessNotes').value    = w ? (w.notes || '') : '';
    selectFitnessType(w ? (w.type || 'run') : 'run');
    document.getElementById('fitnessModal').style.display = 'flex';
}

function closeFitnessModal() {
    document.getElementById('fitnessModal').style.display = 'none';
}

function saveFitnessEntry() {
    let date     = document.getElementById('fitnessDate').value || getTodayStr();
    let duration = parseInt(document.getElementById('fitnessDuration').value) || 0;
    let details  = document.getElementById('fitnessDetails').value.trim();
    let notes    = document.getElementById('fitnessNotes').value.trim();
    let id       = document.getElementById('fitnessId').value;

    if (!duration) { showToast('Enter a duration', 'warning'); return; }

    let entry = { id: id || crypto.randomUUID(), date, type: selectedFitnessType, duration, details, notes, createdAt: new Date().toISOString() };
    let arr   = getFitness();
    if (id) { let i = arr.findIndex(e => e.id === id); if (i !== -1) arr[i] = entry; else arr.unshift(entry); }
    else arr.unshift(entry);

    saveFitness_(arr);
    closeFitnessModal();
    renderFitness();
    showToast('💪 Workout logged!');
}

function deleteFitnessEntry(id) {
    if (!confirm('Delete this workout?')) return;
    saveFitness_(getFitness().filter(e => e.id !== id));
    renderFitness();
    showToast('🗑️ Workout deleted', 'warning');
}

function renderFitnessStats() {
    let el = document.getElementById('fitnessStats');
    if (!el) return;
    let all     = getFitness();
    let today   = getTodayStr();
    let weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
    let weekISO = weekAgo.toISOString().slice(0, 10);
    let thisWeek   = all.filter(e => e.date >= weekISO && e.date <= today);
    let totalMins  = all.reduce((s, e) => s + (e.duration || 0), 0);
    let weekMins   = thisWeek.reduce((s, e) => s + (e.duration || 0), 0);

    // Streak
    let dateSet = new Set(all.map(e => e.date));
    let streak  = 0;
    let cur     = new Date(today + 'T12:00:00');
    while (dateSet.has(cur.toISOString().slice(0, 10))) { streak++; cur.setDate(cur.getDate() - 1); }

    const stat = (val, label, color) =>
        `<div style="flex-shrink:0;background:white;border:1.5px solid #f1f5f9;border-radius:12px;padding:10px 14px;text-align:center;min-width:72px">
            <div style="font-size:20px;font-weight:800;color:${color};line-height:1">${val}</div>
            <div style="font-size:10px;font-weight:600;color:#94a3b8;margin-top:2px;white-space:nowrap">${label}</div>
        </div>`;

    el.innerHTML =
        stat(thisWeek.length, 'This Week', '#e11d48') +
        stat(streak, 'Day Streak', streak >= 7 ? '#f59e0b' : streak >= 3 ? '#e11d48' : '#94a3b8') +
        stat(weekMins, 'Mins/Week', '#7c3aed') +
        stat(totalMins >= 1000 ? Math.round(totalMins / 60) + 'h' : totalMins + 'm', 'Total Time', '#2563eb');
}

function renderFitness() {
    renderFitnessStats();
    if (activeFitnessView === 'programs') { renderProgramCards(); return; }
    let el = document.getElementById('fitnessList');
    if (!el) return;

    let entries = getFitness();
    if (activeFitnessFilter) entries = entries.filter(e => e.type === activeFitnessFilter);

    if (!entries.length) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:40px;margin-bottom:10px">🏃</div>
            <p style="font-size:14px;font-weight:600;color:#64748b;margin-bottom:6px">${activeFitnessFilter ? 'No workouts of this type' : 'No workouts yet'}</p>
            <p style="font-size:13px">Tap <strong>Log Workout</strong> to start tracking</p>
        </div>`;
        return;
    }

    // Group by month
    let grouped = {};
    entries.forEach(e => { let k = e.date.slice(0,7); if (!grouped[k]) grouped[k] = []; grouped[k].push(e); });

    let html = '';
    for (let month of Object.keys(grouped).sort().reverse()) {
        let label = new Date(month + '-02').toLocaleString('default', { month:'long', year:'numeric' });
        let monthMins = grouped[month].reduce((s, e) => s + (e.duration || 0), 0);
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0 8px">
            <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">${label}</span>
            <span style="font-size:11px;font-weight:600;color:#94a3b8">${grouped[month].length} sessions · ${monthMins}min</span>
        </div>`;
        for (let e of grouped[month]) {
            let ft      = FITNESS_TYPES[e.type] || FITNESS_TYPES.other;
            let dateStr = new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
            html += `<div style="background:white;border:1.5px solid #f1f5f9;border-radius:14px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:box-shadow 0.15s,border-color 0.15s"
                onclick="openFitnessModal('${e.id}')"
                onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,0.07)';this.style.borderColor='${ft.border}'"
                onmouseout="this.style.boxShadow='none';this.style.borderColor='#f1f5f9'">
                <div style="width:42px;height:42px;border-radius:12px;background:${ft.bg};border:1.5px solid ${ft.border};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${ft.icon}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:14px;color:#0f172a">${ft.label}${e.details ? ' — ' + e.details : ''}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:2px">${dateStr} · ${e.duration} min</div>
                    ${e.notes ? `<div style="font-size:12px;color:#64748b;margin-top:4px;font-style:italic">${e.notes}</div>` : ''}
                </div>
                <button onclick="event.stopPropagation();deleteFitnessEntry('${e.id}')" style="background:transparent;border:none;color:#d1d5db;padding:4px;margin:0;width:auto;min-width:0;cursor:pointer;line-height:0;border-radius:6px" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#d1d5db'">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
            </div>`;
        }
    }

    let total = getFitness().length;
    let totalMin = getFitness().reduce((s, e) => s + (e.duration || 0), 0);
    html += `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;margin-top:4px">${total} workout${total !== 1 ? 's' : ''} · ${Math.round(totalMin / 60)}h ${totalMin % 60}m total</div>`;
    el.innerHTML = html;
}

// ── Workout Programs ──────────────────────────────────────────────────────────
const POSE_SVGS = {
  squat: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="8" r="5.5" fill="#0f172a"/><line x1="15" y1="20" x2="65" y2="20" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><line x1="40" y1="14" x2="38" y2="42" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="38" y1="22" x2="18" y2="30" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="38" y1="22" x2="58" y2="30" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="38" y1="42" x2="24" y2="64" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="38" y1="42" x2="52" y2="64" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="24" y1="64" x2="20" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="52" y1="64" x2="56" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="83" x2="28" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="48" y1="83" x2="66" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  rdl: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="56" cy="18" r="5.5" fill="#0f172a"/><line x1="51" y1="23" x2="26" y2="50" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="60" x2="52" y2="46" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><line x1="42" y1="38" x2="16" y2="60" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="42" y1="38" x2="50" y2="46" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="26" y1="50" x2="24" y2="83" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="26" y1="50" x2="36" y2="83" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="12" y1="83" x2="28" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="34" y1="83" x2="50" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  bench: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="67" width="64" height="7" rx="3.5" fill="#e2e8f0"/><circle cx="13" cy="52" r="5.5" fill="#0f172a"/><line x1="19" y1="52" x2="62" y2="52" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="14" y1="28" x2="66" y2="28" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><line x1="28" y1="52" x2="28" y2="28" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="52" y1="52" x2="52" y2="28" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="62" y1="52" x2="68" y2="67" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/></svg>`,
  ohp: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="10" r="5.5" fill="#0f172a"/><line x1="40" y1="16" x2="40" y2="52" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="24" x2="68" y2="24" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><line x1="40" y1="28" x2="16" y2="24" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="40" y1="28" x2="64" y2="24" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="40" y1="52" x2="32" y2="75" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="52" x2="48" y2="75" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="83" x2="36" y2="75" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="48" y1="75" x2="62" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  row: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="56" cy="24" r="5.5" fill="#0f172a"/><line x1="52" y1="29" x2="26" y2="54" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="54" x2="52" y2="40" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><line x1="40" y1="40" x2="14" y2="54" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="40" y1="40" x2="50" y2="40" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="26" y1="54" x2="22" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="26" y1="54" x2="34" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="83" x2="26" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="83" x2="48" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  pullup: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="8" y1="10" x2="72" y2="10" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/><line x1="40" y1="20" x2="28" y2="10" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="40" y1="20" x2="52" y2="10" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><circle cx="40" cy="28" r="5.5" fill="#0f172a"/><line x1="40" y1="34" x2="40" y2="62" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="62" x2="34" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="62" x2="46" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/></svg>`,
  lunge: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="42" cy="8" r="5.5" fill="#0f172a"/><line x1="42" y1="14" x2="42" y2="44" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="42" y1="28" x2="30" y2="40" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="42" y1="28" x2="54" y2="38" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="42" y1="44" x2="54" y2="66" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="54" y1="66" x2="60" y2="83" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="42" y1="44" x2="28" y2="62" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="28" y1="62" x2="18" y2="76" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="52" y1="83" x2="68" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  plank: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="48" r="5" fill="#0f172a"/><line x1="18" y1="50" x2="68" y2="50" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="28" y1="50" x2="26" y2="65" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/><line x1="46" y1="50" x2="44" y2="65" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="65" x2="52" y2="65" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/><line x1="34" y1="50" x2="60" y2="50" stroke="#e11d48" stroke-width="5" stroke-linecap="round" opacity="0.55"/><line x1="68" y1="50" x2="72" y2="65" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="64" y1="65" x2="78" y2="65" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  run: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="36" cy="8" r="5.5" fill="#0f172a"/><line x1="34" y1="14" x2="32" y2="44" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="34" y1="26" x2="18" y2="18" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="34" y1="26" x2="52" y2="36" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="44" x2="48" y2="64" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="48" y1="64" x2="60" y2="76" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="32" y1="44" x2="20" y2="60" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="60" x2="28" y2="74" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="52" y1="76" x2="70" y2="80" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  curl: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="8" r="5.5" fill="#0f172a"/><line x1="40" y1="14" x2="40" y2="52" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="38" y1="24" x2="30" y2="52" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="42" y1="24" x2="54" y2="36" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="54" y1="36" x2="46" y2="24" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><circle cx="46" cy="22" r="4" fill="none" stroke="#94a3b8" stroke-width="2.5"/><line x1="40" y1="52" x2="33" y2="75" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="52" x2="47" y2="75" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="22" y1="83" x2="37" y2="75" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="47" y1="75" x2="60" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  lateral: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="8" r="5.5" fill="#0f172a"/><line x1="40" y1="14" x2="40" y2="52" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="26" x2="12" y2="40" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><line x1="40" y1="26" x2="68" y2="40" stroke="#e11d48" stroke-width="4.5" stroke-linecap="round"/><circle cx="10" cy="40" r="4" fill="none" stroke="#94a3b8" stroke-width="2.5"/><circle cx="70" cy="40" r="4" fill="none" stroke="#94a3b8" stroke-width="2.5"/><line x1="40" y1="52" x2="33" y2="75" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="52" x2="47" y2="75" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="22" y1="83" x2="37" y2="75" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><line x1="47" y1="75" x2="60" y2="83" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  leg_press: `<svg viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="44" r="5.5" fill="#0f172a"/><line x1="18" y1="46" x2="42" y2="62" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="42" y1="62" x2="66" y2="44" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="66" y1="44" x2="74" y2="26" stroke="#e11d48" stroke-width="5" stroke-linecap="round"/><line x1="66" y1="20" x2="78" y2="20" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/><line x1="26" y1="50" x2="22" y2="62" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/><rect x="36" y="65" width="14" height="5" rx="2.5" fill="#e2e8f0"/></svg>`,
};

const WORKOUT_PROGRAMS = {
  push: {
    label:'Push Day', icon:'💪', color:'#7c3aed', bg:'linear-gradient(135deg,#faf5ff,#ede9fe)', border:'#c4b5fd',
    muscle:'Chest · Shoulders · Triceps', duration:'50–60 min', logType:'lift',
    exercises:[
      { id:'bench_press',  name:'Barbell Bench Press',    muscles:['Chest','Triceps','Shoulders'],  sets:4, reps:'8–10', rest:'90s', optional:false, pose:'bench',
        tips:'Retract scapulae, keep natural arch. Bar path: lower chest. Drive feet into floor for stability.' },
      { id:'incline_db',   name:'Incline Dumbbell Press', muscles:['Upper Chest','Shoulders'],      sets:3, reps:'10–12', rest:'75s', optional:false, pose:'bench',
        tips:'30–45° incline. Control the descent fully. Think "push ceiling away" not "push bar up."' },
      { id:'ohp',          name:'Overhead Press',         muscles:['Shoulders','Triceps'],          sets:3, reps:'8–10', rest:'90s', optional:false, pose:'ohp',
        tips:'Brace core hard. Bar starts at collarbone, press straight up. Squeeze glutes to protect lower back.' },
      { id:'lateral',      name:'Lateral Raises',         muscles:['Side Delts'],                   sets:4, reps:'12–15', rest:'60s', optional:false, pose:'lateral',
        tips:'Lead with elbows. Slight forward lean. Stop at shoulder height — no higher. Slow the negative.' },
      { id:'tri_push',     name:'Tricep Pushdown',        muscles:['Triceps'],                      sets:3, reps:'12–15', rest:'60s', optional:false, pose:'ohp',
        tips:'Elbows pinned to sides throughout. Full extension at bottom. Controlled 2-sec return.' },
      { id:'pec_fly',      name:'Cable / Pec Fly',        muscles:['Chest'],                        sets:3, reps:'12–15', rest:'60s', optional:true,  pose:'bench',
        tips:'Slight bend in elbows throughout. Focus on chest squeeze at midline. Avoid flaring shoulders.' },
    ]
  },
  pull: {
    label:'Pull Day', icon:'🔙', color:'#2563eb', bg:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'#93c5fd',
    muscle:'Back · Biceps · Rear Delts', duration:'50–60 min', logType:'lift',
    exercises:[
      { id:'pullup',       name:'Pull-ups / Lat Pulldown', muscles:['Lats','Biceps'],              sets:4, reps:'6–10', rest:'90s', optional:false, pose:'pullup',
        tips:'Dead hang at bottom — full stretch. Drive elbows down and back. Chest to the bar at top.' },
      { id:'bb_row',       name:'Barbell Bent-Over Row',   muscles:['Lats','Rhomboids','Biceps'],  sets:4, reps:'8–10', rest:'90s', optional:false, pose:'row',
        tips:'Hinge ~45°. Pull bar to lower chest. Pause at top and squeeze shoulder blades together.' },
      { id:'cable_row',    name:'Seated Cable Row',         muscles:['Mid Back','Biceps'],          sets:3, reps:'10–12', rest:'75s', optional:false, pose:'row',
        tips:'Keep chest tall and proud. Full stretch forward, then drive elbows past your body line.' },
      { id:'face_pull',    name:'Face Pulls',               muscles:['Rear Delts','Rotator Cuff'], sets:3, reps:'15–20', rest:'60s', optional:false, pose:'row',
        tips:'Rope to forehead, externally rotate at top (hands wide). Essential for shoulder longevity.' },
      { id:'bb_curl',      name:'Barbell / EZ Bar Curl',    muscles:['Biceps'],                    sets:3, reps:'10–12', rest:'60s', optional:false, pose:'curl',
        tips:'No swinging. Supinate wrists at top. Full eccentric stretch at bottom counts most.' },
      { id:'hammer',       name:'Hammer Curls',             muscles:['Brachialis','Forearms'],     sets:3, reps:'12', rest:'60s', optional:true, pose:'curl',
        tips:'Neutral grip (thumbs up). Curl up with control, resist gravity on the way down.' },
    ]
  },
  legs: {
    label:'Leg Day', icon:'🦵', color:'#dc2626', bg:'linear-gradient(135deg,#fff1f2,#fce7f3)', border:'#fca5a5',
    muscle:'Quads · Hamstrings · Glutes · Calves', duration:'55–65 min', logType:'lift',
    exercises:[
      { id:'squat',        name:'Barbell Back Squat',       muscles:['Quads','Glutes','Core'],           sets:4, reps:'6–8',   rest:'2 min', optional:false, pose:'squat',
        tips:'Big breath + brace before descent. Knees track toes. Break parallel. Drive floor away on ascent.' },
      { id:'rdl',          name:'Romanian Deadlift',        muscles:['Hamstrings','Glutes','Lower Back'], sets:3, reps:'10–12', rest:'90s',   optional:false, pose:'rdl',
        tips:'Hip hinge — not a squat. Bar stays close to legs. Feel the hamstring stretch at bottom, then drive.' },
      { id:'leg_press',    name:'Leg Press',                muscles:['Quads','Glutes'],                  sets:3, reps:'12–15', rest:'90s',   optional:false, pose:'leg_press',
        tips:"Don't lock knees at top. Foot position changes emphasis: high/wide = glutes, low = more quads." },
      { id:'lunge',        name:'Walking Lunges',           muscles:['Quads','Glutes','Balance'],        sets:3, reps:'10 each', rest:'75s',  optional:false, pose:'lunge',
        tips:"Front knee stays over ankle. Upright torso. Back knee lightly brushes the floor, don't crash it." },
      { id:'leg_curl',     name:'Lying Leg Curl',           muscles:['Hamstrings'],                      sets:3, reps:'12–15', rest:'60s',   optional:false, pose:'rdl',
        tips:'Point toes slightly down for more hamstring activation. Pause at full contraction for 1 second.' },
      { id:'calf',         name:'Standing Calf Raises',     muscles:['Calves','Soleus'],                 sets:4, reps:'15–20', rest:'45s',   optional:false, pose:'ohp',
        tips:'Full range: deep stretch at bottom, fully up on toes. Slow tempo beats heavy weight here.' },
    ]
  },
  fullbody: {
    label:'Full Body', icon:'🏋️', color:'#059669', bg:'linear-gradient(135deg,#ecfdf5,#d1fae5)', border:'#6ee7b7',
    muscle:'All major muscle groups', duration:'45–55 min', logType:'lift',
    exercises:[
      { id:'deadlift',     name:'Conventional Deadlift',    muscles:['Posterior Chain','Core'],     sets:4, reps:'5',    rest:'2 min', optional:false, pose:'rdl',
        tips:'Bar over mid-foot. Neutral spine throughout. Push floor away, then hips lock through at top.' },
      { id:'goblet',       name:'Goblet Squat',             muscles:['Quads','Core'],               sets:3, reps:'10',   rest:'90s',   optional:false, pose:'squat',
        tips:'Dumbbell at chest, elbows inside knees at bottom. Great pattern trainer for squat mechanics.' },
      { id:'bench_fb',     name:'Bench Press',              muscles:['Chest','Triceps'],            sets:3, reps:'8',    rest:'90s',   optional:false, pose:'bench',
        tips:"Controlled descent — don't bounce off chest. Full lockout at top." },
      { id:'db_row',       name:'Dumbbell Row',             muscles:['Back','Biceps'],              sets:3, reps:'10',   rest:'75s',   optional:false, pose:'row',
        tips:'One hand on bench. Pull elbow to hip — think "fill your back pocket." Full stretch at bottom.' },
      { id:'db_ohp',       name:'Dumbbell Shoulder Press',  muscles:['Shoulders'],                  sets:3, reps:'10',   rest:'75s',   optional:false, pose:'ohp',
        tips:"Neutral grip (palms in) is kinder to shoulders. Brace core like you're about to take a punch." },
      { id:'plank',        name:'Plank + Variations',       muscles:['Core','Stabilisers'],         sets:3, reps:'40s',  rest:'45s',   optional:false, pose:'plank',
        tips:"No sagging hips. Add shoulder taps or hip dips for progression. Breathe — don't hold." },
    ]
  },
  hiit: {
    label:'HIIT & Cardio', icon:'⚡', color:'#ea580c', bg:'linear-gradient(135deg,#fff7ed,#fed7aa)', border:'#fb923c',
    muscle:'Full body · Cardiovascular', duration:'25–35 min', logType:'hiit',
    exercises:[
      { id:'warmup',       name:'Warm-Up Jog / March',      muscles:['Cardiovascular'],             sets:1, reps:'5 min',       rest:'–', optional:false, pose:'run',
        tips:'Easy pace. Heart rate to ~120 bpm. Arm circles, leg swings — wake the joints before intensity.' },
      { id:'sprint',       name:'Sprint Intervals',         muscles:['Legs','Cardiovascular'],      sets:8, reps:'20s on / 40s off', rest:'–', optional:false, pose:'run',
        tips:'All-out during the 20s — hold nothing back. Walk or slow jog during the recovery window.' },
      { id:'burpee',       name:'Burpees',                  muscles:['Full Body'],                  sets:3, reps:'10',          rest:'60s', optional:false, pose:'plank',
        tips:'Chest fully to floor. Explosive jump at top. Modify: step out feet instead of jumping for lower impact.' },
      { id:'jump_squat',   name:'Jump Squats',              muscles:['Quads','Glutes','Power'],     sets:3, reps:'15',          rest:'60s', optional:false, pose:'squat',
        tips:'Land soft with knees bent — absorb the impact. Focus on explosive hip extension on the way up.' },
      { id:'mtn_climber',  name:'Mountain Climbers',        muscles:['Core','Shoulders'],           sets:3, reps:'30s',         rest:'45s', optional:false, pose:'plank',
        tips:"Hips level — don't let them rise. Drive knees fast for cardio, slow for core strength." },
      { id:'cooldown',     name:'Cool-Down Walk + Stretch', muscles:['Recovery'],                   sets:1, reps:'5 min',       rest:'–', optional:false, pose:'run',
        tips:'Bring heart rate below 100 bpm before stopping. Light quad + calf + hip stretch here.' },
    ]
  },
  mobility: {
    label:'Mobility & Stretch', icon:'🧘', color:'#0891b2', bg:'linear-gradient(135deg,#ecfeff,#cffafe)', border:'#67e8f9',
    muscle:'Flexibility · Joint health · Recovery', duration:'20–30 min', logType:'yoga',
    exercises:[
      { id:'hip_flexor',   name:'Kneeling Hip Flexor Stretch', muscles:['Hip Flexors','Quads'],       sets:2, reps:'45s each', rest:'–', optional:false, pose:'lunge',
        tips:'Rear knee padded. Tuck pelvis, lean gently forward. Feel it deep in the hip crease — not in the knee.' },
      { id:'hamstring_s',  name:'Standing Hamstring Stretch',  muscles:['Hamstrings'],               sets:2, reps:'45s each', rest:'–', optional:false, pose:'rdl',
        tips:'Hinge at hip — not waist. Soft knee bend. Flat back. You should feel the pull in the belly of the muscle.' },
      { id:'thoracic',     name:'Thoracic Rotation (Quadruped)', muscles:['Spine','Lats'],            sets:2, reps:'10 each', rest:'–', optional:false, pose:'plank',
        tips:'Hand behind head. Rotate elbow toward ceiling. Exhale as you rotate — it deepens the range.' },
      { id:'shoulder_op',  name:'Shoulder Opener (Band / Wall)', muscles:['Chest','Biceps','Shoulders'], sets:2, reps:'45s', rest:'–', optional:false, pose:'ohp',
        tips:'Hold band wide behind body or reach back against wall. Gentle forward lean. No bouncing.' },
      { id:'pigeon',       name:'Pigeon Pose (Hip Opener)',     muscles:['Glutes','Hip Rotators'],    sets:2, reps:'60s each', rest:'–', optional:false, pose:'lunge',
        tips:'Front shin parallel to mat if possible. Walk hands forward to deepen. Breathe into the tension.' },
      { id:'child_pose',   name:"Child's Pose",                 muscles:['Lats','Lower Back','Hips'], sets:2, reps:'60s',   rest:'–', optional:false, pose:'plank',
        tips:"Knees wide, arms extended forward. Forehead on mat. Let gravity do the stretching — no forcing." },
    ]
  },
};

let activeFitnessView  = 'programs';
let activeProgramKey   = null;
let programOrders      = JSON.parse(localStorage.getItem('fitnessProgOrders') || '{}');
let _dragSrcIdx        = -1;
let _dragNodes         = [];

function showFitnessView(v) {
    activeFitnessView = v;
    let pv = document.getElementById('fitnessProgramsView');
    let lv = document.getElementById('fitnessLogView');
    let bp = document.getElementById('fv-programs');
    let bl = document.getElementById('fv-log');
    if (!pv || !lv) return;
    pv.style.display = v === 'programs' ? 'block' : 'none';
    lv.style.display = v === 'log' ? 'block' : 'none';
    if (bp) { bp.style.background = v==='programs' ? '#0f172a' : 'transparent'; bp.style.color = v==='programs' ? 'white' : '#64748b'; }
    if (bl) { bl.style.background = v==='log' ? '#0f172a' : 'transparent'; bl.style.color = v==='log' ? 'white' : '#64748b'; }
    if (v === 'programs') renderProgramCards();
    else renderFitness();
}

function renderProgramCards() {
    let el = document.getElementById('programCards');
    let det = document.getElementById('programDetail');
    if (!el) return;
    det.style.display = 'none';
    el.style.display  = 'block';

    let html = `<p style="font-size:12px;color:#94a3b8;margin-bottom:12px">Choose a program to see the full exercise guide. Drag exercises to rearrange.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
    for (let [key, prog] of Object.entries(WORKOUT_PROGRAMS)) {
        html += `<div onclick="openProgram('${key}')" style="border-radius:16px;padding:16px 14px;background:${prog.bg};border:1.5px solid ${prog.border};cursor:pointer;transition:transform 0.15s,box-shadow 0.15s"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'"
            onmouseout="this.style.transform='';this.style.boxShadow=''">
            <div style="font-size:28px;margin-bottom:8px">${prog.icon}</div>
            <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:3px">${prog.label}</div>
            <div style="font-size:11px;color:#64748b;line-height:1.4;margin-bottom:8px">${prog.muscle}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
                <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:${prog.color}20;color:${prog.color}">⏱ ${prog.duration}</span>
                <span style="font-size:10px;color:#94a3b8">${WORKOUT_PROGRAMS[key].exercises.length} exercises</span>
            </div>
        </div>`;
    }
    html += '</div>';
    el.innerHTML = html;
}

function openProgram(key) {
    activeProgramKey = key;
    let el  = document.getElementById('programCards');
    let det = document.getElementById('programDetail');
    if (!el || !det) return;
    el.style.display  = 'none';
    det.style.display = 'block';
    renderProgramDetail(key);
}

function renderProgramDetail(key) {
    let prog = WORKOUT_PROGRAMS[key];
    if (!prog) return;
    let det = document.getElementById('programDetail');
    if (!det) return;

    // Get exercise order (user may have reordered)
    let order = programOrders[key] || prog.exercises.map(e => e.id);
    // Filter to only valid ids, then append any new ones
    let validIds = prog.exercises.map(e => e.id);
    order = [...order.filter(id => validIds.includes(id)), ...validIds.filter(id => !order.includes(id))];
    let exercises = order.map(id => prog.exercises.find(e => e.id === id)).filter(Boolean);

    let exHtml = exercises.map((ex, idx) => {
        let pose = POSE_SVGS[ex.pose] || POSE_SVGS.squat;
        let muscleChips = ex.muscles.map(m => `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${prog.color}18;color:${prog.color};margin:2px 3px 2px 0">${m}</span>`).join('');
        return `<div class="prog-ex-item" data-idx="${idx}" data-id="${ex.id}" draggable="true"
            style="background:white;border:1.5px solid #f1f5f9;border-radius:16px;margin-bottom:10px;overflow:hidden;transition:border-color 0.15s,box-shadow 0.15s;cursor:grab"
            onmouseover="this.style.borderColor='${prog.border}';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.06)'"
            onmouseout="this.style.borderColor='#f1f5f9';this.style.boxShadow='none'">
            <div style="display:flex;align-items:stretch">
                <!-- Drag handle + pose -->
                <div style="width:90px;flex-shrink:0;background:${prog.bg};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 6px;border-right:1.5px solid ${prog.border}20;gap:6px">
                    <div style="font-size:8px;font-weight:700;color:${prog.color};letter-spacing:0.5px;opacity:0.6">⠿ DRAG</div>
                    ${pose}
                    ${ex.optional ? `<span style="font-size:9px;font-weight:700;color:${prog.color};opacity:0.7;background:${prog.color}15;padding:1px 6px;border-radius:10px">optional</span>` : ''}
                </div>
                <!-- Exercise info -->
                <div style="flex:1;padding:12px 14px">
                    <div style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:4px">${ex.name}</div>
                    <div style="margin-bottom:8px">${muscleChips}</div>
                    <!-- Sets/Reps/Rest row -->
                    <div style="display:flex;gap:8px;margin-bottom:9px;flex-wrap:wrap">
                        <div style="text-align:center;background:#f8fafc;border-radius:10px;padding:5px 10px">
                            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Sets</div>
                            <div style="font-size:15px;font-weight:900;color:${prog.color}">${ex.sets}</div>
                        </div>
                        <div style="text-align:center;background:#f8fafc;border-radius:10px;padding:5px 10px">
                            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Reps</div>
                            <div style="font-size:14px;font-weight:900;color:${prog.color};white-space:nowrap">${ex.reps}</div>
                        </div>
                        <div style="text-align:center;background:#f8fafc;border-radius:10px;padding:5px 10px">
                            <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Rest</div>
                            <div style="font-size:14px;font-weight:900;color:#64748b">${ex.rest}</div>
                        </div>
                    </div>
                    <!-- Form tip -->
                    <div style="background:${prog.color}08;border-left:3px solid ${prog.color};border-radius:0 8px 8px 0;padding:7px 10px">
                        <div style="font-size:10px;font-weight:700;color:${prog.color};margin-bottom:2px">💡 Form Tip</div>
                        <div style="font-size:12px;color:#374151;line-height:1.5">${ex.tips}</div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    det.innerHTML = `
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <button onclick="renderProgramCards();document.getElementById('programCards').style.display='block';document.getElementById('programDetail').style.display='none'" style="width:36px;height:36px;padding:0;margin:0;background:#f1f5f9;border-radius:10px;font-size:16px;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0">←</button>
            <div style="flex:1">
                <div style="font-size:22px;line-height:1">${prog.icon} <span style="font-weight:900;font-size:18px;color:#0f172a">${prog.label}</span></div>
                <div style="font-size:12px;color:#64748b;margin-top:2px">${prog.muscle} · ⏱ ${prog.duration}</div>
            </div>
            <button onclick="startWorkoutFromProgram('${key}')" style="margin:0;padding:9px 14px;font-size:12px;font-weight:700;border-radius:12px;background:${prog.color};color:white;border:none;white-space:nowrap;flex-shrink:0">▶ Start</button>
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:5px">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Drag exercises to reorder • Changes save automatically
        </div>
        <!-- Exercise list (draggable) -->
        <div id="progExList-${key}">${exHtml}</div>
    `;

    initExerciseDrag(key);
}

function initExerciseDrag(key) {
    let container = document.getElementById('progExList-' + key);
    if (!container) return;
    _dragNodes = Array.from(container.querySelectorAll('.prog-ex-item'));
    _dragSrcIdx = -1;

    _dragNodes.forEach((node, i) => {
        node.addEventListener('dragstart', (e) => {
            _dragSrcIdx = i;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => { node.style.opacity = '0.4'; }, 0);
        });
        node.addEventListener('dragend', () => {
            node.style.opacity = '';
            _dragNodes.forEach(n => n.style.borderTop = '');
        });
        node.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            _dragNodes.forEach(n => n.style.borderTop = '');
            if (i !== _dragSrcIdx) node.style.borderTop = '3px solid ' + (WORKOUT_PROGRAMS[key]?.color || '#2563eb');
        });
        node.addEventListener('drop', (e) => {
            e.preventDefault();
            if (_dragSrcIdx === i || _dragSrcIdx < 0) return;
            node.style.borderTop = '';
            node.style.opacity   = '';

            let prog = WORKOUT_PROGRAMS[key];
            let order = programOrders[key] || prog.exercises.map(ex => ex.id);
            let validIds = prog.exercises.map(ex => ex.id);
            order = [...order.filter(id => validIds.includes(id)), ...validIds.filter(id => !order.includes(id))];

            let moved = order.splice(_dragSrcIdx, 1)[0];
            order.splice(i, 0, moved);
            programOrders[key] = order;
            localStorage.setItem('fitnessProgOrders', JSON.stringify(programOrders));
            renderProgramDetail(key);
        });
    });
}

function startWorkoutFromProgram(key) {
    let prog = WORKOUT_PROGRAMS[key];
    if (!prog) return;
    showFitnessView('log');
    openFitnessModal();
    setTimeout(() => {
        selectFitnessType(prog.logType || 'lift');
        let detailEl = document.getElementById('fitnessDetails');
        if (detailEl) detailEl.value = prog.label + ' — ' + prog.exercises.slice(0,3).map(e=>e.name).join(', ');
    }, 100);
    showToast('💪 ' + prog.label + ' loaded — log it when done!');
}

// ── To-Do ─────────────────────────────────────────────────────────────────────
const TODO_KEY = 'eyeTodos';
let selectedPriority = 'medium';
let todoFilter = 'all';

function getTodos()        { return JSON.parse(localStorage.getItem(TODO_KEY) || '[]'); }
function saveTodos(todos)  { localStorage.setItem(TODO_KEY, JSON.stringify(todos)); }

function openTodoModal(id) {
    let todo = id ? getTodos().find(t => t.id === id) : null;
    document.getElementById('todoId').value   = todo ? todo.id : '';
    document.getElementById('todoText').value = todo ? todo.text : '';
    document.getElementById('todoDue').value  = todo ? (todo.due || '') : '';
    selectedPriority = todo ? todo.priority : 'medium';
    updatePriorityButtons();
    document.getElementById('todoModal').style.display = 'flex';
    setTimeout(() => document.getElementById('todoText').focus(), 100);
}
function closeTodoModal() { document.getElementById('todoModal').style.display = 'none'; }

function selectPriority(p) { selectedPriority = p; updatePriorityButtons(); }
function updatePriorityButtons() {
    ['low','medium','high'].forEach(p => {
        let btn = document.getElementById('pri-'+p);
        if (!btn) return;
        btn.style.borderColor = p === selectedPriority ? '#7c3aed' : '#e2e8f0';
        btn.style.transform   = p === selectedPriority ? 'scale(1.05)' : 'scale(1)';
    });
}

function saveTodo() {
    let text = document.getElementById('todoText').value.trim();
    if (!text) { showToast('⚠️ Enter a task', 'warning'); return; }
    let todos = getTodos();
    let id    = document.getElementById('todoId').value;
    let todo  = { id: id || crypto.randomUUID(), text, priority: selectedPriority, due: document.getElementById('todoDue').value || null, done: false, createdAt: new Date().toISOString() };
    if (id) { let idx = todos.findIndex(t => t.id === id); if (idx !== -1) { todo.done = todos[idx].done; todos[idx] = todo; } else todos.unshift(todo); }
    else todos.unshift(todo);
    saveTodos(todos);
    _cloudUpsert('workspace_todos', todo, _wsMap.todos);
    closeTodoModal();
    renderTodos();
    showToast('✅ Task saved!');
}

function toggleTodo(id) {
    let todos = getTodos();
    let todo  = todos.find(t => t.id === id);
    if (todo) {
        todo.done = !todo.done;
        todo.doneAt = todo.done ? getTodayStr() : null;
        saveTodos(todos);
        renderTodos();
        _cloudUpsert('workspace_todos', todo, _wsMap.todos);
    }
}

function deleteTodo(id) {
    if (!confirm('Delete this task?')) return;
    saveTodos(getTodos().filter(t => t.id !== id));
    _cloudDelete('workspace_todos', id);
    renderTodos();
    showToast('🗑️ Task deleted', 'warning');
}

function filterTodos(f) {
    todoFilter = f;
    ['all','open','done'].forEach(x => {
        let btn = document.getElementById('tf-'+x);
        if (!btn) return;
        btn.style.background = x === f ? '#2563eb' : '#f1f5f9';
        btn.style.color      = x === f ? 'white' : '#64748b';
    });
    renderTodos();
}

function renderTodos() {
    let el = document.getElementById('todoList');
    if (!el) return;
    let todos = getTodos();
    if (todoFilter === 'open') todos = todos.filter(t => !t.done);
    if (todoFilter === 'done') todos = todos.filter(t => t.done);

    let priColors = { high:'#dc2626', medium:'#ca8a04', low:'#16a34a' };
    let priBg     = { high:'#fef2f2', medium:'#fffbeb', low:'#f0fdf4' };
    let priDot    = (c) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle"></span>`;

    let open = getTodos().filter(t=>!t.done).length;
    let total = getTodos().length;

    if (todos.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:40px;margin-bottom:12px">✅</div>
            <p style="font-size:14px;font-weight:600;color:#64748b">${todoFilter==='done'?'No completed tasks yet':'All clear!'}</p>
        </div>`;
    } else {
        el.innerHTML = todos.map(t => {
            let overdue = t.due && !t.done && new Date(t.due) < new Date();
            return `<div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:${t.done?'#f8fafc':priBg[t.priority]};border:1.5px solid ${t.done?'#e2e8f0':priColors[t.priority]+'33'};border-radius:14px;margin-bottom:8px;opacity:${t.done?0.6:1}">
                <input type="checkbox" ${t.done?'checked':''} onchange="toggleTodo('${t.id}')" style="width:18px;height:18px;margin-top:2px;accent-color:#2563eb;flex-shrink:0;cursor:pointer">
                <div style="flex:1;min-width:0">
                    <p style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:4px;${t.done?'text-decoration:line-through;color:#94a3b8':''}">${t.text}</p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                        <span style="font-size:11px;font-weight:700;color:${priColors[t.priority]}">${priDot(priColors[t.priority])}${t.priority.charAt(0).toUpperCase()+t.priority.slice(1)}</span>
                        ${t.due?`<span style="font-size:11px;color:${overdue?'#dc2626':'#64748b'};font-weight:${overdue?700:400}">${overdue?'Overdue · ':''}${new Date(t.due+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`:''}
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="openTodoModal('${t.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#f1f5f9;border-radius:8px;box-shadow:none;display:flex;align-items:center;justify-content:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button onclick="deleteTodo('${t.id}')"    style="width:28px;height:28px;padding:0;margin:0;background:#fef2f2;border-radius:8px;box-shadow:none;display:flex;align-items:center;justify-content:center"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                </div>
            </div>`;
        }).join('');
    }

    // Stats bar
    let statsEl = document.getElementById('todoStats');
    if (!statsEl) {
        let bar = document.createElement('div');
        bar.id = 'todoStats';
        bar.style.cssText = 'margin-bottom:12px;font-size:12px;color:#64748b;display:flex;justify-content:space-between';
        el.parentNode.insertBefore(bar, el);
    }
    let s = document.getElementById('todoStats');
    if (s) s.innerHTML = `<span>${open} open task${open!==1?'s':''}</span><span>${total-open} completed</span>`;
}

// ── Notes ─────────────────────────────────────────────────────────────────────
const NOTES_KEY = 'eyeNotes';

function getNotes()        { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); }
function saveNotes(notes)  { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }

function openNoteModal(id) {
    let note = id ? getNotes().find(n => n.id === id) : null;
    document.getElementById('noteId').value    = note ? note.id : '';
    document.getElementById('noteTitle').value = note ? note.title : '';
    document.getElementById('noteTag').value   = note ? (note.tag || '') : '';
    document.getElementById('noteBody').value  = note ? note.body : '';
    document.getElementById('noteModal').style.display = 'flex';
    setTimeout(() => document.getElementById('noteTitle').focus(), 100);
}
function closeNoteModal() { document.getElementById('noteModal').style.display = 'none'; }

function saveNote() {
    let title = document.getElementById('noteTitle').value.trim();
    let body  = document.getElementById('noteBody').value.trim();
    if (!title && !body) { showToast('⚠️ Write something first!', 'warning'); return; }
    let notes = getNotes();
    let id    = document.getElementById('noteId').value;
    let note  = { id: id || crypto.randomUUID(), title: title || 'Untitled', tag: document.getElementById('noteTag').value, body, updatedAt: new Date().toISOString() };
    if (id) { let idx = notes.findIndex(n => n.id === id); if (idx !== -1) notes[idx] = note; else notes.unshift(note); }
    else notes.unshift(note);
    saveNotes(notes);
    _cloudUpsert('workspace_notes', note, _wsMap.notes);
    closeNoteModal();
    renderNotes();
    showToast('📝 Note saved!');
}

function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    saveNotes(getNotes().filter(n => n.id !== id));
    _cloudDelete('workspace_notes', id);
    renderNotes();
    showToast('🗑️ Note deleted', 'warning');
}

function togglePinNote(id, e) {
    e.stopPropagation();
    let notes = getNotes();
    let n = notes.find(x => x.id === id);
    if (n) { n.pinned = !n.pinned; saveNotes(notes); renderNotes(); }
}

function renderNotes() {
    let el = document.getElementById('notesList');
    if (!el) return;
    let search = (document.getElementById('notesSearch')?.value || '').toLowerCase();
    let notes  = getNotes();
    if (search) notes = notes.filter(n => (n.title+n.body+n.tag).toLowerCase().includes(search));
    // Pinned first
    notes = [...notes.filter(n=>n.pinned), ...notes.filter(n=>!n.pinned)];

    if (notes.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:40px;margin-bottom:12px">📝</div>
            <p style="font-size:14px;font-weight:600;color:#64748b">${search?'No notes match':'No notes yet'}</p>
            <p style="font-size:13px">Save clinical pearls, drug doses, technique tips</p>
        </div>`;
        return;
    }

    let tagColors = { 'Clinical Pearl':'#d97706','Technique':'#2563eb','Drug / Dosing':'#16a34a','Anatomy':'#7c3aed','Board Prep':'#dc2626','Reminder':'#0891b2' };
    let tagBg     = { 'Clinical Pearl':'#fffbeb','Technique':'#eff6ff','Drug / Dosing':'#f0fdf4','Anatomy':'#faf5ff','Board Prep':'#fef2f2','Reminder':'#f0f9ff' };

    let pinnedNotes = notes.filter(n => n.pinned);
    let html = '';
    if (pinnedNotes.length && !search) {
        html += `<div style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="#94a3b8" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Pinned</div>`;
    }
    html += notes.map((n, i) => {
        let isPinSeparator = i > 0 && !n.pinned && notes[i-1]?.pinned && !search;
        return `${isPinSeparator ? '<div style="height:1px;background:#f1f5f9;margin:10px 0 14px"></div>' : ''}
        <div style="background:${n.tag&&tagBg[n.tag]?tagBg[n.tag]:'white'};border:1.5px solid ${n.pinned?'#fbbf24':n.tag&&tagColors[n.tag]?tagColors[n.tag]+'33':'#e2e8f0'};border-radius:14px;padding:16px;margin-bottom:10px;cursor:pointer;transition:box-shadow 0.15s${n.pinned?';box-shadow:0 2px 12px rgba(251,191,36,0.15)':''}"
             onclick="openNoteModal('${n.id}')"
             onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'"
             onmouseout="this.style.boxShadow='${n.pinned?'0 2px 12px rgba(251,191,36,0.15)':'none'}'">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div style="flex:1;min-width:0">
                    <p style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${n.title}</p>
                    ${n.tag?`<span style="font-size:11px;font-weight:700;color:${tagColors[n.tag]||'#64748b'};background:${tagColors[n.tag]||'#94a3b8'}18;padding:2px 8px;border-radius:20px">${n.tag}</span>`:''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px">
                    <button onclick="togglePinNote('${n.id}',event)" title="${n.pinned?'Unpin':'Pin'}"
                        style="width:26px;height:26px;padding:0;margin:0;background:${n.pinned?'#fef9c3':'#f8fafc'};border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="${n.pinned?'#ca8a04':'none'}" stroke="${n.pinned?'#ca8a04':'#94a3b8'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                    <button onclick="event.stopPropagation();deleteNote('${n.id}')" title="Delete"
                        style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </div>
            </div>
            ${n.body?`<p style="font-size:13px;color:#374151;line-height:1.6;margin:0">${n.body.length>160?n.body.slice(0,160)+'…':n.body}</p>`:''}
        </div>`;
    }).join('');
    el.innerHTML = html;
}

// ── Study Kanban ──────────────────────────────────────────────────────────────
let _studyView = 'list';
function setStudyView(v) {
    _studyView = v;
    let listBtn  = document.getElementById('studyViewList');
    let boardBtn = document.getElementById('studyViewBoard');
    let kanban   = document.getElementById('studyKanban');
    let list     = document.getElementById('studyList');
    let _a = {background:'white',color:'#111827',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'};
    let _i = {background:'transparent',color:'#6B7280',boxShadow:'none'};
    if (listBtn)  Object.assign(listBtn.style,  v==='list'  ? _a : _i);
    if (boardBtn) Object.assign(boardBtn.style, v==='board' ? _a : _i);
    if (kanban) kanban.style.display = v==='board' ? 'block' : 'none';
    if (list)   list.style.display   = v==='list'  ? 'block' : 'none';
    if (v==='board') renderStudyKanban();
}
function renderStudyKanban() {
    let el = document.getElementById('studyKanban');
    if (!el) return;
    let items = getStudyItems();
    let cols = {
        'to-read': { label:'To Read', color:'#f59e0b', bg:'#fffbeb', items:[] },
        'reading':  { label:'Reading',  color:'#2563eb', bg:'#eff6ff', items:[] },
        'done':     { label:'Done',     color:'#16a34a', bg:'#f0fdf4', items:[] }
    };
    items.forEach(s => { if (cols[s.status]) cols[s.status].items.push(s); });
    const typeColors = {'Textbook':'#7c3aed','Article':'#2563eb','Video':'#dc2626','Question Bank':'#d97706','Other':'#64748b'};
    let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start">`;
    for (let [status, col] of Object.entries(cols)) {
        html += `<div style="background:${col.bg};border-radius:14px;padding:12px;border-top:3px solid ${col.color}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-size:12px;font-weight:700;color:${col.color};text-transform:uppercase;letter-spacing:0.5px">${col.label}</span>
                <span style="font-size:11px;font-weight:600;color:#94a3b8">${col.items.length}</span>
            </div>`;
        if (col.items.length === 0) {
            html += `<div style="text-align:center;padding:20px 0;color:#cbd5e1;font-size:12px">Empty</div>`;
        } else {
            col.items.forEach(s => {
                let tc = typeColors[s.type]||'#64748b';
                html += `<div draggable="true" ondragstart="event.dataTransfer.setData('studyId','${s.id}')"
                    ondragover="event.preventDefault()" ondrop="dropStudyCard(event,'${status}')"
                    style="background:white;border-radius:10px;padding:10px 12px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:grab;border-left:3px solid ${tc}">
                    <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:3px">${s.topic}</div>
                    <div style="font-size:11px;color:${tc};font-weight:600">${s.type||'Other'}</div>
                </div>`;
            });
        }
        html += `<div style="height:60px;border:1.5px dashed #e2e8f0;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#e2e8f0;font-size:11px"
            ondragover="event.preventDefault()" ondrop="dropStudyCard(event,'${status}')">drop here</div>`;
        html += `</div>`;
    }
    html += `</div>`;
    el.innerHTML = html;
}
function dropStudyCard(event, newStatus) {
    event.preventDefault();
    let id = event.dataTransfer.getData('studyId');
    let items = getStudyItems();
    let item = items.find(s=>s.id===id);
    if (item) {
        item.status = newStatus;
        saveStudyItems(items);
        renderStudyKanban();
        renderStudyList();
    }
}

// ── Study List ────────────────────────────────────────────────────────────────
const STUDY_KEY = 'eyeStudy';
let studyFilter = 'all';

function getStudyItems()       { return JSON.parse(localStorage.getItem(STUDY_KEY) || '[]'); }
function saveStudyItems(items) { localStorage.setItem(STUDY_KEY, JSON.stringify(items)); }

function openStudyModal(id) {
    let item = id ? getStudyItems().find(s => s.id === id) : null;
    document.getElementById('studyId').value    = item ? item.id : '';
    document.getElementById('studyTopic').value = item ? item.topic : '';
    document.getElementById('studyType').value  = item ? item.type : 'Textbook';
    document.getElementById('studyNotes').value = item ? (item.notes || '') : '';
    let authorEl = document.getElementById('bookAuthor');
    let totalEl  = document.getElementById('bookTotalPages');
    let curEl    = document.getElementById('bookCurrentPage');
    if (authorEl) authorEl.value = item ? (item.bookAuthor || '') : '';
    if (totalEl)  totalEl.value  = item ? (item.bookTotalPages || '') : '';
    if (curEl)    curEl.value    = item ? (item.bookCurrentPage || '') : '';
    toggleBookFields();
    document.getElementById('studyModal').style.display = 'flex';
    setTimeout(() => document.getElementById('studyTopic').focus(), 100);
}
function closeStudyModal() { document.getElementById('studyModal').style.display = 'none'; }

function saveStudyItem() {
    let topic = document.getElementById('studyTopic').value.trim();
    if (!topic) { showToast('⚠️ Enter a topic', 'warning'); return; }
    let items = getStudyItems();
    let id    = document.getElementById('studyId').value;
    let type = document.getElementById('studyType').value;
    let item  = { id: id || crypto.randomUUID(), topic, type, notes: document.getElementById('studyNotes').value.trim(), status: 'to-read', createdAt: new Date().toISOString() };
    if (type === 'Book') {
        item.bookAuthor      = document.getElementById('bookAuthor').value.trim();
        item.bookTotalPages  = parseInt(document.getElementById('bookTotalPages').value) || 0;
        item.bookCurrentPage = parseInt(document.getElementById('bookCurrentPage').value) || 0;
        if (item.bookTotalPages && item.bookCurrentPage >= item.bookTotalPages) item.status = 'done';
        else if (item.bookCurrentPage > 0) item.status = 'reading';
    }
    if (id) { let idx = items.findIndex(s => s.id === id); if (idx !== -1) { item.status = items[idx].status; items[idx] = item; } else items.unshift(item); }
    else items.unshift(item);
    saveStudyItems(items);
    _cloudUpsert('workspace_study', item, _wsMap.study);
    closeStudyModal();
    renderStudyList();
    showToast('Added to study list');
}

function cycleStudyStatus(id) {
    let items  = getStudyItems();
    let item   = items.find(s => s.id === id);
    if (!item) return;
    let cycle  = { 'to-read':'reading', 'reading':'done', 'done':'to-read' };
    item.status = cycle[item.status] || 'to-read';
    saveStudyItems(items);
    renderStudyList();
    _cloudUpsert('workspace_study', item, _wsMap.study);
}

function deleteStudyItem(id) {
    if (!confirm('Remove from study list?')) return;
    saveStudyItems(getStudyItems().filter(s => s.id !== id));
    _cloudDelete('workspace_study', id);
    renderStudyList();
    showToast('🗑️ Removed', 'warning');
}

function filterStudy(f) {
    studyFilter = f;
    ['all','to-read','reading','done','books'].forEach(x => {
        let btn = document.getElementById('sf-'+x);
        if (!btn) return;
        btn.style.background = x === f ? '#7c3aed' : '#f1f5f9';
        btn.style.color      = x === f ? 'white' : '#64748b';
    });
    renderStudyList();
}

function toggleBookFields() {
    let type = document.getElementById('studyType').value;
    let bf = document.getElementById('bookFields');
    if (bf) bf.style.display = type === 'Book' ? 'block' : 'none';
}

function updateBookProgress(id, val) {
    let items = getStudyItems();
    let item = items.find(s => s.id === id);
    if (!item) return;
    item.bookCurrentPage = parseInt(val) || 0;
    if (item.bookTotalPages && item.bookCurrentPage >= item.bookTotalPages) {
        item.status = 'done';
    } else if (item.bookCurrentPage > 0) {
        item.status = 'reading';
    }
    saveStudyItems(items);
    _cloudUpsert('workspace_study', item, _wsMap.study);
    renderStudyList();
}

function renderStudyList() {
    let el = document.getElementById('studyList');
    let progressEl = document.getElementById('studyProgress');
    if (!el) return;

    let all     = getStudyItems();
    let done    = all.filter(s => s.status === 'done').length;
    let reading = all.filter(s => s.status === 'reading').length;
    let toRead  = all.filter(s => s.status === 'to-read').length;

    if (progressEl && all.length > 0) {
        let pct = Math.round((done / all.length) * 100);
        progressEl.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px">
            <span>${all.length} item${all.length!==1?'s':''} total</span><span style="font-weight:700;color:#7c3aed">${pct}% complete</span>
        </div>
        <div style="background:#e2e8f0;border-radius:99px;height:8px">
            <div style="background:linear-gradient(90deg,#7c3aed,#2563eb);width:${pct}%;height:8px;border-radius:99px;transition:width 0.5s"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:#64748b">
            <span>${toRead} to read</span><span>${reading} in progress</span><span>${done} done</span>
        </div>`;
    } else if (progressEl) { progressEl.innerHTML = ''; }

    let items = studyFilter === 'all'   ? all :
                studyFilter === 'books' ? all.filter(s => s.type === 'Book') :
                all.filter(s => s.status === studyFilter);

    if (items.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <p style="font-size:14px;font-weight:600;color:#64748b">${studyFilter!=='all'?'Nothing in this category':'Study list empty'}</p>
            <p style="font-size:13px">Add textbooks, articles, or videos to study</p>
        </div>`;
        return;
    }

    let statusLabel = { 'to-read':'To Read', 'reading':'Reading', 'done':'Done' };
    let statusBg    = { 'to-read':'#eff6ff', 'reading':'#fffbeb', 'done':'#f0fdf4' };
    let statusColor = { 'to-read':'#2563eb', 'reading':'#ca8a04', 'done':'#16a34a' };
    const _tsvg = (d, col) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${col||'#64748b'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    let typeIcon    = {
        'Textbook':      _tsvg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', '#7c3aed'),
        'Article':       _tsvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', '#2563eb'),
        'Video':         _tsvg('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>', '#dc2626'),
        'Question Bank': _tsvg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', '#d97706'),
        'Book':          _tsvg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', '#059669'),
        'Other':         _tsvg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>', '#64748b')
    };

    // Book shelf stats banner when Books filter is active
    if (studyFilter === 'books' && progressEl) {
        let books    = all.filter(s => s.type === 'Book');
        let bDone    = books.filter(s => s.status === 'done').length;
        let bReading = books.filter(s => s.status === 'reading').length;
        progressEl.innerHTML = books.length ? `
        <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:16px;padding:16px;margin-bottom:4px">
            <div style="display:flex;gap:16px;flex-wrap:wrap">
                <div style="text-align:center"><div style="font-size:24px;font-weight:900;color:#059669">${bDone}</div><div style="font-size:11px;color:#059669;font-weight:700">Finished</div></div>
                <div style="text-align:center"><div style="font-size:24px;font-weight:900;color:#d97706">${bReading}</div><div style="font-size:11px;color:#d97706;font-weight:700">Reading</div></div>
                <div style="text-align:center"><div style="font-size:24px;font-weight:900;color:#64748b">${books.length}</div><div style="font-size:11px;color:#64748b;font-weight:700">Total</div></div>
            </div>
        </div>` : '';
    }

    el.innerHTML = items.map(s => {
        let isBook = s.type === 'Book';
        let bookPct = isBook && s.bookTotalPages ? Math.min(100, Math.round(((s.bookCurrentPage||0) / s.bookTotalPages) * 100)) : 0;
        let bookBar = isBook && s.bookTotalPages ? `
            <div style="margin-top:10px">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px">
                    <span>Page ${s.bookCurrentPage||0} of ${s.bookTotalPages}</span>
                    <span style="font-weight:700;color:#059669">${bookPct}%</span>
                </div>
                <div style="background:#e2e8f0;border-radius:99px;height:7px;position:relative">
                    <div style="background:linear-gradient(90deg,#059669,#34d399);width:${bookPct}%;height:7px;border-radius:99px;transition:width 0.4s"></div>
                </div>
                <div style="margin-top:6px;display:flex;gap:6px;align-items:center">
                    <input type="number" value="${s.bookCurrentPage||0}" min="0" max="${s.bookTotalPages}"
                        onchange="updateBookProgress('${s.id}',this.value)"
                        style="width:70px;padding:4px 8px;font-size:12px;border:1.5px solid #e2e8f0;border-radius:8px;margin:0"
                        placeholder="Page">
                    <span style="font-size:11px;color:#94a3b8">update current page</span>
                </div>
            </div>` : '';
        return `
        <div style="background:white;border:1.5px solid ${isBook?'#bbf7d0':'#e2e8f0'};border-radius:14px;padding:14px;margin-bottom:8px">
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                        <span style="display:flex;align-items:center">${typeIcon[s.type]||typeIcon['Other']}</span>
                        <p style="font-weight:700;font-size:14px;color:#0f172a;margin:0">${s.topic}</p>
                    </div>
                    ${isBook && s.bookAuthor ? `<p style="font-size:12px;color:#64748b;margin:0 0 4px;font-style:italic">by ${s.bookAuthor}</p>` : ''}
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <span style="font-size:11px;color:#64748b">${s.type}</span>
                        <button onclick="cycleStudyStatus('${s.id}')"
                            style="font-size:11px;font-weight:700;color:${statusColor[s.status]};background:${statusBg[s.status]};border:none;padding:3px 10px;border-radius:20px;cursor:pointer;margin:0;width:auto;min-width:0;box-shadow:none">
                            ${statusLabel[s.status]}
                        </button>
                    </div>
                    ${s.notes?`<p style="font-size:12px;color:#64748b;margin-top:6px;line-height:1.5">${s.notes}</p>`:''}
                    ${bookBar}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="openStudyModal('${s.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#f1f5f9;border-radius:8px;box-shadow:none;display:flex;align-items:center;justify-content:center" title="Edit">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onclick="deleteStudyItem('${s.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#fef2f2;border-radius:8px;box-shadow:none;display:flex;align-items:center;justify-content:center" title="Delete">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Clinician Notes ───────────────────────────────────────────────────────────
const CLNOTE_KEY = 'eyeClinicianNotes';
const CLNOTE_CAT = {
    cornea:        { label:'Cornea',        icon:'👁️', color:'#2563eb', bg:'#eff6ff',  border:'#bfdbfe' },
    glaucoma:      { label:'Glaucoma',      icon:'🔵', color:'#059669', bg:'#ecfdf5',  border:'#a7f3d0' },
    retina:        { label:'Retina',        icon:'🔴', color:'#dc2626', bg:'#fef2f2',  border:'#fecaca' },
    neuro:         { label:'Neuro-Ophtho',  icon:'🧠', color:'#7c3aed', bg:'#faf5ff',  border:'#ddd6fe' },
    pediatric:     { label:'Pediatrics',    icon:'🩷', color:'#db2777', bg:'#fdf2f8',  border:'#fbcfe8' },
    oculoplastics: { label:'Oculoplastics', icon:'✂️', color:'#9333ea', bg:'#faf5ff',  border:'#e9d5ff' },
    uveitis:       { label:'Uveitis',       icon:'🟠', color:'#d97706', bg:'#fffbeb',  border:'#fde68a' },
    general:       { label:'General',       icon:'📋', color:'#64748b', bg:'#f8fafc',  border:'#e2e8f0' },
};

function getClinicianNotes()      { return JSON.parse(localStorage.getItem(CLNOTE_KEY) || '[]'); }
function saveClinicianNotes(arr)  { localStorage.setItem(CLNOTE_KEY, JSON.stringify(arr)); }

let selectedNoteCategory = 'general';
let activeNoteFilter     = '';

function selectNoteCategory(cat) {
    selectedNoteCategory = cat;
    Object.keys(CLNOTE_CAT).forEach(k => {
        let btn = document.getElementById('nc-' + k);
        if (!btn) return;
        let m = CLNOTE_CAT[k];
        if (k === cat) {
            btn.style.background = m.color;
            btn.style.color      = 'white';
            btn.style.borderColor = m.color;
        } else {
            btn.style.background = m.bg;
            btn.style.color      = m.color;
            btn.style.borderColor = m.border;
        }
    });
}

function filterClinicianNotes(cat) {
    activeNoteFilter = cat;
    let all = ['', ...Object.keys(CLNOTE_CAT)];
    all.forEach(k => {
        let btn = document.getElementById('cn-' + (k || 'all'));
        if (!btn) return;
        let active = k === cat;
        if (k === '') {
            btn.style.background  = active ? '#0891b2' : 'white';
            btn.style.color       = active ? 'white' : '#64748b';
            btn.style.borderColor = active ? '#0891b2' : '#e2e8f0';
        } else {
            let m = CLNOTE_CAT[k];
            btn.style.background  = active ? m.color : 'white';
            btn.style.color       = active ? 'white' : '#64748b';
            btn.style.borderColor = active ? m.color : '#e2e8f0';
        }
    });
    renderClinicianNotes();
}

function openClinicianNoteModal(id) {
    let note = id ? getClinicianNotes().find(n => n.id === id) : null;
    document.getElementById('clinNoteId').value      = note ? note.id : '';
    document.getElementById('clinNoteTitle').value   = note ? note.title : '';
    document.getElementById('clinNoteContent').value = note ? note.content : '';
    let delBtn = document.getElementById('clinNoteDeleteBtn');
    if (delBtn) delBtn.style.display = note ? 'block' : 'none';
    selectNoteCategory(note ? (note.category || 'general') : 'general');
    document.getElementById('clinicianNoteModal').style.display = 'flex';
    setTimeout(() => document.getElementById('clinNoteTitle').focus(), 100);
}

function closeClinicianNoteModal() {
    document.getElementById('clinicianNoteModal').style.display = 'none';
}

function saveClinicianNote() {
    let title   = document.getElementById('clinNoteTitle').value.trim();
    let content = document.getElementById('clinNoteContent').value.trim();
    if (!title)   { showToast('⚠️ Enter a title', 'warning'); return; }
    if (!content) { showToast('⚠️ Add some content', 'warning'); return; }
    let notes = getClinicianNotes();
    let id    = document.getElementById('clinNoteId').value;
    let note  = {
        id:        id || crypto.randomUUID(),
        title,
        content,
        category:  selectedNoteCategory,
        updatedAt: new Date().toISOString(),
        createdAt: id ? (notes.find(n => n.id === id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };
    if (id) { let idx = notes.findIndex(n => n.id === id); if (idx !== -1) notes[idx] = note; else notes.unshift(note); }
    else notes.unshift(note);
    saveClinicianNotes(notes);
    closeClinicianNoteModal();
    renderClinicianNotes();
    showToast('📋 Note saved');
}

function deleteClinicianNote() {
    let id = document.getElementById('clinNoteId').value;
    if (!id || !confirm('Delete this note?')) return;
    saveClinicianNotes(getClinicianNotes().filter(n => n.id !== id));
    closeClinicianNoteModal();
    renderClinicianNotes();
    showToast('🗑️ Note deleted', 'warning');
}

function renderClinicianNotes() {
    let el = document.getElementById('clinicianNotesList');
    if (!el) return;
    let notes = getClinicianNotes();
    if (activeNoteFilter) notes = notes.filter(n => n.category === activeNoteFilter);
    let q = (document.getElementById('clinNoteSearch')?.value || '').toLowerCase();
    if (q) notes = notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));

    if (!notes.length) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:36px;margin-bottom:10px">🏥</div>
            <p style="font-size:14px;font-weight:600;color:#64748b;margin-bottom:6px">${activeNoteFilter || q ? 'No notes match' : 'No clinical notes yet'}</p>
            <p style="font-size:13px">Tap <strong>New Note</strong> to capture a clinical pearl or management protocol</p>
        </div>`;
        return;
    }

    // Group by category
    let grouped = {};
    notes.forEach(n => { let c = n.category || 'general'; if (!grouped[c]) grouped[c] = []; grouped[c].push(n); });

    let html = '';
    let order = activeNoteFilter ? [activeNoteFilter] : Object.keys(CLNOTE_CAT).filter(k => grouped[k]);
    for (let cat of order) {
        if (!grouped[cat]) continue;
        let m = CLNOTE_CAT[cat];
        html += `<div style="margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="font-size:14px">${m.icon}</span>
                <span style="font-size:11px;font-weight:800;color:${m.color};text-transform:uppercase;letter-spacing:0.8px">${m.label}</span>
                <span style="font-size:11px;color:#94a3b8">${grouped[cat].length}</span>
            </div>`;
        for (let n of grouped[cat]) {
            let preview = n.content.replace(/\n/g,' ').slice(0, 120);
            let ago = (() => { let d = new Date(n.updatedAt); let diff = Math.floor((Date.now()-d)/86400000); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff + 'd ago'; })();
            html += `<div onclick="openClinicianNoteModal('${n.id}')"
                style="background:white;border:1.5px solid ${m.border};border-left:4px solid ${m.color};border-radius:14px;padding:14px;margin-bottom:8px;cursor:pointer;transition:box-shadow 0.15s"
                onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'"
                onmouseout="this.style.boxShadow='none'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:5px">
                    <p style="font-weight:700;font-size:14px;color:#0f172a;margin:0;flex:1">${n.title}</p>
                    <span style="font-size:10px;color:#94a3b8;flex-shrink:0;margin-top:2px">${ago}</span>
                </div>
                <p style="font-size:12px;color:#64748b;margin:0;line-height:1.5">${preview}${n.content.length > 120 ? '…' : ''}</p>
            </div>`;
        }
        html += '</div>';
    }
    el.innerHTML = html;
}

// ── Duty Hours ────────────────────────────────────────────────────────────────
function getDutyShifts()      { return JSON.parse(localStorage.getItem('eyeDutyShifts')||'[]'); }
function saveDutyShifts(arr)  { localStorage.setItem('eyeDutyShifts', JSON.stringify(arr)); }

let selectedShiftType = 'Clinic';

function selectShiftType(type) {
    selectedShiftType = type;
    document.querySelectorAll('.shift-type-btn').forEach(b => {
        b.style.background   = '#f8fafc';
        b.style.color        = '#64748b';
        b.style.borderColor  = '#e2e8f0';
    });
    let active = document.getElementById('stype-' + type);
    if (active) {
        active.style.background  = '#eff6ff';
        active.style.color       = '#2563eb';
        active.style.borderColor = '#93c5fd';
    }
}

function calcShiftHours() {
    let start = document.getElementById('shiftStart').value;
    let end   = document.getElementById('shiftEnd').value;
    let prev  = document.getElementById('shiftHoursPreview');
    if (!start || !end) { if (prev) prev.textContent = '— h'; return null; }
    let [sh, sm] = start.split(':').map(Number);
    let [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    let overnight = document.getElementById('shiftOvernight').checked;
    if (mins <= 0 || overnight) mins += 24 * 60;
    let hrs = Math.round(mins / 60 * 10) / 10;
    if (prev) {
        prev.textContent  = hrs + ' h';
        prev.style.color  = hrs > 24 ? '#dc2626' : hrs > 16 ? '#d97706' : '#2563eb';
    }
    return hrs;
}

function openShiftModal(id) {
    let shifts = getDutyShifts();
    let s = id ? shifts.find(x => x.id === id) : null;
    document.getElementById('shiftId').value    = s ? s.id : '';
    document.getElementById('shiftDate').value  = s ? s.date : getTodayStr();
    document.getElementById('shiftStart').value = s ? s.startTime : '';
    document.getElementById('shiftEnd').value   = s ? s.endTime : '';
    document.getElementById('shiftOvernight').checked = s ? s.overnight : false;
    document.getElementById('shiftNotes').value = s ? (s.notes || '') : '';
    selectShiftType(s ? s.type : 'Clinic');
    calcShiftHours();
    let m = document.getElementById('shiftModal');
    m.style.display = 'flex';
}

function closeShiftModal() {
    document.getElementById('shiftModal').style.display = 'none';
}

function saveShift() {
    let date  = document.getElementById('shiftDate').value;
    let start = document.getElementById('shiftStart').value;
    let end   = document.getElementById('shiftEnd').value;
    if (!date || !start || !end) { showToast('Fill in date, start and end time', 'warning'); return; }
    let hours = calcShiftHours();
    if (!hours || hours <= 0) { showToast('Invalid time range', 'warning'); return; }
    let shifts = getDutyShifts();
    let id     = document.getElementById('shiftId').value;
    let shift  = {
        id:        id || crypto.randomUUID(),
        date,
        startTime: start,
        endTime:   end,
        overnight: document.getElementById('shiftOvernight').checked,
        type:      selectedShiftType,
        notes:     document.getElementById('shiftNotes').value.trim(),
        hours
    };
    if (id) {
        let idx = shifts.findIndex(s => s.id === id);
        if (idx !== -1) shifts[idx] = shift; else shifts.unshift(shift);
    } else {
        shifts.unshift(shift);
    }
    saveDutyShifts(shifts);
    closeShiftModal();
    renderDutyHours();
    showToast('✅ Shift logged!');
}

function deleteShift(id) {
    if (!confirm('Delete this shift?')) return;
    saveDutyShifts(getDutyShifts().filter(s => s.id !== id));
    renderDutyHours();
}

function _dutyWeekBounds(offsetWeeks) {
    let todayStr = getTodayStr();
    let today    = new Date(todayStr + 'T12:00:00');
    let dow      = today.getDay();
    let monday   = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7) - offsetWeeks * 7);
    let sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6);
    let toISO    = d => d.toLocaleDateString('en-CA');
    return { mon: toISO(monday), sun: toISO(sunday), monday, sunday };
}

function renderDutyHours() {
    let shifts = getDutyShifts();

    // ── Current week ──
    let { mon, sun, monday, sunday } = _dutyWeekBounds(0);
    let fmt = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    let weekShifts = shifts.filter(s => s.date >= mon && s.date <= sun);
    let weekHours  = weekShifts.reduce((a,s) => a + s.hours, 0);
    weekHours      = Math.round(weekHours * 10) / 10;

    // ── 4-week rolling avg ──
    let fourWeekTotal = 0, fourWeekDaysWorked = new Set();
    for (let w = 0; w < 4; w++) {
        let { mon: wm, sun: ws } = _dutyWeekBounds(w);
        let wShifts = shifts.filter(s => s.date >= wm && s.date <= ws);
        fourWeekTotal += wShifts.reduce((a,s) => a + s.hours, 0);
        wShifts.forEach(s => fourWeekDaysWorked.add(s.date));
    }
    let fourWeekAvg = Math.round(fourWeekTotal / 4 * 10) / 10;

    // ── 4-week days off (need ≥1 day off per 7, so ≥4 in 28 days) ──
    // Days in the past 28 days
    let { mon: m4 } = _dutyWeekBounds(3);
    let totalDays28 = 28;
    let daysWorked28 = new Set();
    shifts.filter(s => s.date >= m4 && s.date <= sun).forEach(s => daysWorked28.add(s.date));
    let daysOff28 = totalDays28 - daysWorked28.size;

    // ── Compliance status ──
    let wkOk    = weekHours <= 80;
    let avgOk   = fourWeekAvg <= 80;
    let doffOk  = daysOff28 >= 4;

    // ── Render compliance cards ──
    let cardsEl = document.getElementById('dutyComplianceCards');
    if (cardsEl) {
        let card = (label, val, sub, ok) => {
            let col = ok ? '#16a34a' : '#dc2626';
            let bg  = ok ? '#f0fdf4' : '#fef2f2';
            let bd  = ok ? '#86efac' : '#fca5a5';
            return `<div style="background:${bg};border:1.5px solid ${bd};border-radius:14px;padding:12px 14px;text-align:center">
                <div style="font-size:22px;font-weight:800;color:${col};line-height:1">${val}</div>
                <div style="font-size:10px;font-weight:700;color:${col};text-transform:uppercase;letter-spacing:0.6px;margin-top:3px">${label}</div>
                <div style="font-size:10px;color:${ok?'#4ade80':'#f87171'};margin-top:2px">${sub}</div>
            </div>`;
        };
        cardsEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            ${card('This Week', weekHours+'h', weekHours<=80?'✅ ≤80h':'❌ >80h limit', wkOk)}
            ${card('4-Wk Avg', fourWeekAvg+'h', fourWeekAvg<=80?'✅ Compliant':'❌ Over limit', avgOk)}
            ${card('Days Off', daysOff28+' days', daysOff28>=4?'✅ ≥4 in 28d':'❌ Need '+Math.max(0,4-daysOff28)+' more', doffOk)}
        </div>`;
    }

    // ── Weekly progress bar ──
    let barEl = document.getElementById('dutyWeekBar');
    if (barEl) {
        let pct     = Math.min(weekHours / 80 * 100, 100);
        let barCol  = weekHours > 80 ? '#dc2626' : weekHours > 70 ? '#d97706' : '#2563eb';
        let remaining = Math.max(0, 80 - weekHours);
        barEl.innerHTML = `<div class="dash-card" style="padding:14px 16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:#374151">${fmt(monday)} – ${fmt(sunday)}</div>
                <div style="font-size:12px;font-weight:700;color:${barCol}">${weekHours}h / 80h ${remaining>0?'('+remaining+'h left)':'⚠️ LIMIT'}</div>
            </div>
            <div style="height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${barCol};border-radius:99px;transition:width 0.4s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:5px">
                <span style="font-size:10px;color:#9ca3af">0h</span>
                <span style="font-size:10px;color:#9ca3af;position:relative;left:-2px">80h limit</span>
            </div>
        </div>`;
    }

    // ── Shift history grouped by week ──
    let histEl = document.getElementById('dutyHistory');
    if (!histEl) return;
    if (shifts.length === 0) {
        histEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#9ca3af">
            <div style="font-size:32px;margin-bottom:12px">⏰</div>
            <div style="font-size:14px;font-weight:600">No shifts logged yet</div>
            <div style="font-size:12px;margin-top:4px">Tap Log Shift to start tracking</div>
        </div>`;
        return;
    }

    // Group by week
    let weekMap = {};
    shifts.forEach(s => {
        let d   = new Date(s.date + 'T12:00:00');
        let dow = d.getDay();
        let m   = new Date(d); m.setDate(d.getDate() - ((dow + 6) % 7));
        let key = m.toLocaleDateString('en-CA');
        if (!weekMap[key]) weekMap[key] = { monday: m, shifts: [] };
        weekMap[key].shifts.push(s);
    });

    let typeColor = { 'Clinic':'#0891b2','OR':'#7c3aed','Night Call':'#1e40af','Post-Call':'#d97706','Admin':'#64748b','Education':'#16a34a' };
    let typeEmoji = { 'Clinic':'🏥','OR':'🔪','Night Call':'🌙','Post-Call':'😴','Admin':'📋','Education':'📚' };

    let html = '<div style="margin-bottom:8px"><h3 style="font-size:13px;font-weight:700;color:#374151;margin:0 0 10px">Shift History</h3></div>';
    Object.keys(weekMap).sort().reverse().forEach(wk => {
        let { monday: wMon, shifts: wShifts } = weekMap[wk];
        let wSun = new Date(wMon); wSun.setDate(wMon.getDate() + 6);
        let wTotal = Math.round(wShifts.reduce((a,s)=>a+s.hours,0)*10)/10;
        let wCol   = wTotal > 80 ? '#dc2626' : wTotal > 70 ? '#d97706' : '#64748b';
        html += `<div class="dash-card" style="margin-bottom:10px;padding:12px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:12px;font-weight:700;color:#0f172a">${fmt(wMon)} – ${fmt(wSun)}</div>
                <div style="font-size:13px;font-weight:800;color:${wCol}">${wTotal}h</div>
            </div>`;
        wShifts.sort((a,b)=>a.date>b.date?-1:1).forEach(s => {
            let col = typeColor[s.type] || '#64748b';
            let emo = typeEmoji[s.type] || '⏰';
            let d   = new Date(s.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
            html += `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid #f9fafb">
                <div style="width:32px;height:32px;border-radius:8px;background:${col}18;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${emo}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:700;color:#374151">${s.type} <span style="font-weight:400;color:#94a3b8">· ${d}</span></div>
                    <div style="font-size:11px;color:#94a3b8">${s.startTime} – ${s.endTime}${s.overnight?' (overnight)':''}${s.notes?' · '+s.notes:''}</div>
                </div>
                <div style="font-size:13px;font-weight:800;color:${col};flex-shrink:0">${s.hours}h</div>
                <button onclick="deleteShift('${s.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:6px;font-size:13px;color:#dc2626;border:1px solid #fecaca;box-shadow:none;flex-shrink:0">×</button>
            </div>`;
        });
        html += `</div>`;
    });
    histEl.innerHTML = html;
}

// ── Didactics Log ─────────────────────────────────────────────────────────────
function getDidactics()     { return JSON.parse(localStorage.getItem('eyeDidactics')||'[]'); }
function saveDidactics_(arr){ localStorage.setItem('eyeDidactics', JSON.stringify(arr)); }

const DIDACTICS_TYPES = ['Grand Rounds','Journal Club','Conference','Lecture','Simulation','Teaching'];
const DIDACTICS_EMOJI = { 'Grand Rounds':'🏛️','Journal Club':'📖','Conference':'🌐','Lecture':'🎓','Simulation':'🔬','Teaching':'👨‍🏫' };
const DIDACTICS_COLOR = { 'Grand Rounds':'#2563eb','Journal Club':'#7c3aed','Conference':'#059669','Lecture':'#d97706','Simulation':'#0891b2','Teaching':'#16a34a' };
const DIDACTICS_BG    = { 'Grand Rounds':'#eff6ff','Journal Club':'#faf5ff','Conference':'#ecfdf5','Lecture':'#fffbeb','Simulation':'#f0f9ff','Teaching':'#f0fdf4' };

let selectedDidacticsType = 'Grand Rounds';

function selectDidacticsType(type) {
    selectedDidacticsType = type;
    document.querySelectorAll('.didactics-type-btn').forEach(b => {
        b.style.background  = '#f8fafc';
        b.style.color       = '#64748b';
        b.style.borderColor = '#e2e8f0';
    });
    let col = DIDACTICS_COLOR[type] || '#2563eb';
    let bg  = DIDACTICS_BG[type]    || '#eff6ff';
    let btn = document.getElementById('dtype-' + type);
    if (btn) { btn.style.background = bg; btn.style.color = col; btn.style.borderColor = col + '80'; }
}

function openDidacticsModal(id) {
    let items = getDidactics();
    let d = id ? items.find(x => x.id === id) : null;
    document.getElementById('didacticsId').value      = d ? d.id : '';
    document.getElementById('didacticsTitle').value   = d ? d.title : '';
    document.getElementById('didacticsSpeaker').value = d ? (d.speaker||'') : '';
    document.getElementById('didacticsHours').value   = d ? d.hours : '';
    document.getElementById('didacticsDate').value    = d ? d.date : getTodayStr();
    document.getElementById('didacticsCme').value     = d ? (d.cme||'') : '';
    document.getElementById('didacticsNotes').value   = d ? (d.notes||'') : '';
    selectDidacticsType(d ? d.type : 'Grand Rounds');
    document.getElementById('didacticsModal').style.display = 'flex';
}

function closeDidacticsModal() {
    document.getElementById('didacticsModal').style.display = 'none';
}

function saveDidactics() {
    let title = document.getElementById('didacticsTitle').value.trim();
    let hours = parseFloat(document.getElementById('didacticsHours').value);
    let date  = document.getElementById('didacticsDate').value;
    if (!title) { showToast('Enter a title or topic', 'warning'); return; }
    if (!date)  { showToast('Enter a date', 'warning'); return; }

    let items = getDidactics();
    let id    = document.getElementById('didacticsId').value;
    let entry = {
        id:      id || crypto.randomUUID(),
        date,
        type:    selectedDidacticsType,
        title,
        speaker: document.getElementById('didacticsSpeaker').value.trim(),
        hours:   isNaN(hours) ? 1 : hours,
        cme:     parseFloat(document.getElementById('didacticsCme').value) || null,
        notes:   document.getElementById('didacticsNotes').value.trim(),
        createdAt: new Date().toISOString()
    };
    if (id) {
        let idx = items.findIndex(x => x.id === id);
        if (idx !== -1) items[idx] = entry; else items.unshift(entry);
    } else {
        items.unshift(entry);
    }
    saveDidactics_(items);
    closeDidacticsModal();
    renderDidactics();
    showToast('✅ Session logged!');
}

function deleteDidactics(id) {
    if (!confirm('Delete this session?')) return;
    saveDidactics_(getDidactics().filter(x => x.id !== id));
    renderDidactics();
}

function renderDidactics() {
    let items   = getDidactics();
    let statsEl = document.getElementById('didacticsStats');
    let listEl  = document.getElementById('didacticsList');

    // ── Stats ──
    if (statsEl) {
        if (items.length === 0) { statsEl.innerHTML = ''; }
        else {
            let totalHours = Math.round(items.reduce((a,x) => a + (x.hours||0), 0) * 10) / 10;
            let totalCme   = Math.round(items.reduce((a,x) => a + (x.cme||0), 0) * 10) / 10;
            let thisMonth  = getThisMonthStr();
            let monthItems = items.filter(x => x.date && x.date.startsWith(thisMonth));
            let monthHours = Math.round(monthItems.reduce((a,x) => a + (x.hours||0), 0) * 10) / 10;

            // Per-type breakdown
            let typeCounts = {};
            DIDACTICS_TYPES.forEach(t => { typeCounts[t] = items.filter(x=>x.type===t).length; });

            // Stat cards
            statsEl.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
                <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#2563eb;line-height:1">${totalHours}h</div>
                    <div style="font-size:9px;color:#2563eb;font-weight:700;text-transform:uppercase;margin-top:3px">Total Hours</div>
                </div>
                <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#16a34a;line-height:1">${items.length}</div>
                    <div style="font-size:9px;color:#16a34a;font-weight:700;text-transform:uppercase;margin-top:3px">Sessions</div>
                </div>
                <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:800;color:#d97706;line-height:1">${monthHours}h</div>
                    <div style="font-size:9px;color:#d97706;font-weight:700;text-transform:uppercase;margin-top:3px">This Month</div>
                </div>
            </div>
            <div class="dash-card" style="padding:12px 14px;margin-bottom:14px">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">By Type</div>
                ${DIDACTICS_TYPES.filter(t=>typeCounts[t]>0).map(t => {
                    let pct = Math.round(typeCounts[t]/items.length*100);
                    let col = DIDACTICS_COLOR[t]||'#64748b';
                    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        <span style="font-size:12px">${DIDACTICS_EMOJI[t]||''}</span>
                        <span style="font-size:11px;color:#374151;width:90px;flex-shrink:0">${t}</span>
                        <div style="flex:1;height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden">
                            <div style="height:100%;width:${pct}%;background:${col};border-radius:99px"></div>
                        </div>
                        <span style="font-size:11px;font-weight:700;color:#374151;width:20px;text-align:right">${typeCounts[t]}</span>
                    </div>`;
                }).join('')}
                ${totalCme > 0 ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;font-size:12px;color:#7c3aed;font-weight:700">🏅 ${totalCme} CME credits earned</div>` : ''}
            </div>`;
        }
    }

    // ── List ──
    if (!listEl) return;
    if (items.length === 0) {
        listEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#9ca3af">
            <div style="font-size:32px;margin-bottom:12px">📚</div>
            <div style="font-size:14px;font-weight:600">No sessions logged yet</div>
            <div style="font-size:12px;margin-top:4px">Log grand rounds, journal clubs, conferences and more</div>
        </div>`;
        return;
    }

    // Group by month
    let monthMap = {};
    items.forEach(x => {
        let m = x.date ? x.date.slice(0,7) : 'Unknown';
        if (!monthMap[m]) monthMap[m] = [];
        monthMap[m].push(x);
    });

    let html = '';
    Object.keys(monthMap).sort().reverse().forEach(m => {
        let mItems = monthMap[m];
        let mHours = Math.round(mItems.reduce((a,x) => a+(x.hours||0), 0)*10)/10;
        let label  = m !== 'Unknown' ? new Date(m+'-15').toLocaleDateString('en-US',{month:'long',year:'numeric'}) : 'Unknown';
        html += `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:#374151">${label}</div>
                <div style="font-size:11px;color:#94a3b8">${mItems.length} session${mItems.length>1?'s':''} · ${mHours}h</div>
            </div>`;
        mItems.forEach(x => {
            let col = DIDACTICS_COLOR[x.type]||'#64748b';
            let bg  = DIDACTICS_BG[x.type]||'#f8fafc';
            let emo = DIDACTICS_EMOJI[x.type]||'📋';
            let d   = x.date ? new Date(x.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
            html += `<div class="dash-card" style="margin-bottom:8px;padding:12px 14px;border-left:3px solid ${col}">
                <div style="display:flex;align-items:flex-start;gap:10px">
                    <div style="width:34px;height:34px;border-radius:9px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${emo}</div>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:2px">${x.title}</div>
                        <div style="font-size:11px;color:#94a3b8">
                            <span style="background:${bg};color:${col};border-radius:5px;padding:1px 6px;font-size:10px;font-weight:700">${x.type}</span>
                            ${x.speaker?' · '+x.speaker:''}
                            ${d?' · '+d:''}
                            · <strong style="color:#374151">${x.hours}h</strong>
                            ${x.cme?` · <span style="color:#7c3aed;font-weight:700">${x.cme} CME</span>`:''}
                        </div>
                        ${x.notes?`<div style="font-size:12px;color:#64748b;margin-top:6px;padding:6px 8px;background:#f8fafc;border-radius:7px;font-style:italic">${x.notes}</div>`:''}
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button onclick="openDidacticsModal('${x.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#f1f5f9;border-radius:6px;font-size:11px;color:#64748b;border:none;box-shadow:none">✏️</button>
                        <button onclick="deleteDidactics('${x.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:6px;font-size:13px;color:#dc2626;border:1px solid #fecaca;box-shadow:none">×</button>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    });
    listEl.innerHTML = html;
}

// ── Intraoperative Complications (Private — localStorage only, never synced) ──
function getCompls()     { return JSON.parse(localStorage.getItem('eyeCompls')||'[]'); }
function saveCompls(arr) { localStorage.setItem('eyeCompls', JSON.stringify(arr)); }

let selectedComplType     = '';
let selectedComplSeverity = 'Minor';
let selectedComplOutcome  = 'Good';

function selectCompl(type) {
    selectedComplType = type;
    document.querySelectorAll('.compl-type-btn').forEach(b => {
        b.style.background  = '#f8fafc';
        b.style.color       = '#64748b';
        b.style.borderColor = '#e2e8f0';
    });
    let active = document.getElementById('ctype-' + type);
    if (active) { active.style.background='#fef2f2'; active.style.color='#dc2626'; active.style.borderColor='#fca5a5'; }
    let customEl = document.getElementById('complTypeCustom');
    if (customEl) customEl.style.display = type === 'Other' ? 'block' : 'none';
}

function selectComplSeverity(sev) {
    selectedComplSeverity = sev;
    let cols = { Minor:['#f0fdf4','#16a34a','#86efac'], Moderate:['#fffbeb','#d97706','#fde68a'], Major:['#fef2f2','#dc2626','#fca5a5'] };
    ['Minor','Moderate','Major'].forEach(s => {
        let btn = document.getElementById('csev-'+s);
        if (!btn) return;
        let [bg,txt,bd] = s===sev ? cols[s] : ['#f8fafc','#64748b','#e2e8f0'];
        btn.style.background=bg; btn.style.color=txt; btn.style.borderColor=bd;
    });
}

function selectComplOutcome(out) {
    selectedComplOutcome = out;
    let cols = { Good:['#f0fdf4','#16a34a','#86efac'], Fair:['#fffbeb','#d97706','#fde68a'], Poor:['#fef2f2','#dc2626','#fca5a5'] };
    ['Good','Fair','Poor'].forEach(o => {
        let btn = document.getElementById('cout-'+o);
        if (!btn) return;
        let [bg,txt,bd] = o===out ? cols[o] : ['#f8fafc','#64748b','#e2e8f0'];
        btn.style.background=bg; btn.style.color=txt; btn.style.borderColor=bd;
    });
}

function openComplModal(id) {
    let compls = getCompls();
    let c = id ? compls.find(x => x.id === id) : null;
    document.getElementById('complId').value          = c ? c.id : '';
    document.getElementById('complDate').value        = c ? c.date : getTodayStr();
    document.getElementById('complProcedure').value   = c ? c.procedure : 'Cataract / Phaco';
    document.getElementById('complManagement').value  = c ? (c.management||'') : '';
    document.getElementById('complNotes').value       = c ? (c.notes||'') : '';
    document.getElementById('complTypeCustom').value  = '';
    selectCompl(c ? c.complication : 'PCR');
    selectComplSeverity(c ? c.severity : 'Minor');
    selectComplOutcome(c ? c.outcome : 'Good');
    if (c && !document.getElementById('ctype-'+c.complication)) {
        selectCompl('Other');
        document.getElementById('complTypeCustom').value = c.complication;
    }
    document.getElementById('complModal').style.display = 'flex';
}

function closeComplModal() {
    document.getElementById('complModal').style.display = 'none';
}

function saveCompl() {
    let date = document.getElementById('complDate').value;
    if (!date) { showToast('Enter date', 'warning'); return; }
    let type = selectedComplType === 'Other'
        ? (document.getElementById('complTypeCustom').value.trim() || 'Other')
        : selectedComplType;
    if (!type) { showToast('Select a complication type', 'warning'); return; }

    let compls = getCompls();
    let id     = document.getElementById('complId').value;
    let entry  = {
        id:         id || crypto.randomUUID(),
        date,
        procedure:  document.getElementById('complProcedure').value,
        complication: type,
        severity:   selectedComplSeverity,
        management: document.getElementById('complManagement').value.trim(),
        outcome:    selectedComplOutcome,
        notes:      document.getElementById('complNotes').value.trim(),
        createdAt:  new Date().toISOString()
    };
    if (id) {
        let idx = compls.findIndex(c => c.id === id);
        if (idx !== -1) compls[idx] = entry; else compls.unshift(entry);
    } else {
        compls.unshift(entry);
    }
    saveCompls(compls);
    closeComplModal();
    renderCompls();
    showToast('🔒 Saved privately');
}

function deleteCompl(id) {
    if (!confirm('Delete this complication entry?')) return;
    saveCompls(getCompls().filter(c => c.id !== id));
    renderCompls();
}

function renderCompls() {
    let compls = getCompls();
    let statsEl = document.getElementById('complStats');
    let histEl  = document.getElementById('complHistory');

    // ── Stats cards: total, PCR rate, severity breakdown ──
    if (statsEl) {
        if (compls.length === 0) { statsEl.innerHTML = ''; }
        else {
            let total    = compls.length;
            let pcrCount = compls.filter(c => c.complication === 'PCR' || c.complication === 'Posterior Capsule Rupture').length;
            let vlCount  = compls.filter(c => c.complication === 'Vitreous Loss').length;
            let majCount = compls.filter(c => c.severity === 'Major').length;
            let goodOut  = compls.filter(c => c.outcome === 'Good').length;

            // PCR rate vs all cataract cases
            let cataractCases = allCases.filter(c => c.procedure && c.procedure.toLowerCase().includes('cataract') || c.procedure && c.procedure.toLowerCase().includes('phaco')).length;
            let pcrRate = cataractCases > 0 ? ((pcrCount / cataractCases) * 100).toFixed(1) : null;

            statsEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
                <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:10px;text-align:center">
                    <div style="font-size:20px;font-weight:800;color:#dc2626">${total}</div>
                    <div style="font-size:9px;color:#dc2626;font-weight:700;text-transform:uppercase;margin-top:2px">Total</div>
                </div>
                <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:12px;padding:10px;text-align:center">
                    <div style="font-size:20px;font-weight:800;color:#ea580c">${pcrCount}</div>
                    <div style="font-size:9px;color:#ea580c;font-weight:700;text-transform:uppercase;margin-top:2px">PCR${pcrRate?'<br><span style=\'font-size:8px;font-weight:400\'>('+pcrRate+'%)</span>':''}</div>
                </div>
                <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:10px;text-align:center">
                    <div style="font-size:20px;font-weight:800;color:#dc2626">${majCount}</div>
                    <div style="font-size:9px;color:#dc2626;font-weight:700;text-transform:uppercase;margin-top:2px">Major</div>
                </div>
                <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:10px;text-align:center">
                    <div style="font-size:20px;font-weight:800;color:#16a34a">${goodOut}</div>
                    <div style="font-size:9px;color:#16a34a;font-weight:700;text-transform:uppercase;margin-top:2px">Good Outcome</div>
                </div>
            </div>`;
        }
    }

    // ── History list ──
    if (!histEl) return;
    if (compls.length === 0) {
        histEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#9ca3af">
            <div style="font-size:32px;margin-bottom:12px">✅</div>
            <div style="font-size:14px;font-weight:600">No complications logged</div>
            <div style="font-size:12px;margin-top:4px">This log is private — only visible on this device</div>
        </div>`;
        return;
    }

    let sevColor = { Minor:'#16a34a', Moderate:'#d97706', Major:'#dc2626' };
    let sevBg    = { Minor:'#f0fdf4', Moderate:'#fffbeb', Major:'#fef2f2' };
    let outEmoji = { Good:'✅', Fair:'🟡', Poor:'⚠️' };

    histEl.innerHTML = compls.map(c => {
        let d     = new Date(c.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
        let scol  = sevColor[c.severity]||'#64748b';
        let sbg   = sevBg[c.severity]||'#f8fafc';
        return `<div class="dash-card" style="margin-bottom:10px;border-left:3px solid ${scol}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px">
                        <span style="font-size:13px;font-weight:800;color:#0f172a">${c.complication}</span>
                        <span style="background:${sbg};color:${scol};border-radius:6px;font-size:10px;font-weight:700;padding:2px 8px">${c.severity}</span>
                        <span style="font-size:11px">${outEmoji[c.outcome]||''} ${c.outcome}</span>
                    </div>
                    <div style="font-size:11px;color:#94a3b8">${c.procedure} · ${d}</div>
                </div>
                <div style="display:flex;gap:5px;flex-shrink:0;margin-left:8px">
                    <button onclick="openComplModal('${c.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#f1f5f9;border-radius:6px;font-size:11px;color:#64748b;border:none;box-shadow:none">✏️</button>
                    <button onclick="deleteCompl('${c.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:6px;font-size:13px;color:#dc2626;border:1px solid #fecaca;box-shadow:none">×</button>
                </div>
            </div>
            ${c.management ? `<div style="font-size:12px;color:#374151;margin-top:6px;padding:8px 10px;background:#f8fafc;border-radius:8px"><strong>Management:</strong> ${c.management}</div>` : ''}
            ${c.notes ? `<div style="font-size:12px;color:#64748b;margin-top:6px;font-style:italic;padding:6px 10px;background:#fef2f2;border-radius:8px;border-left:2px solid #fca5a5">🔒 ${c.notes}</div>` : ''}
        </div>`;
    }).join('');
}

// ── ITE / OKAP Score Tracker ──────────────────────────────────────────────────
function getIteScores()     { return JSON.parse(localStorage.getItem('eyeIteScores')||'[]'); }
function saveIteScores(arr) { localStorage.setItem('eyeIteScores', JSON.stringify(arr)); }

// National OKAP averages by PGY year (approximate historical data)
const OKAP_NATIONAL_AVG = { 'PGY-1': 44, 'PGY-2': 52, 'PGY-3': 60, 'PGY-4': 67 };

const ITE_SUBJECTS = ['optics','fundamentals','glaucoma','cornea','retina','oculoplastics','neuro','peds','uveitis','cataract'];
const ITE_SUBJECT_LABELS = {
    optics:'Optics & Refraction', fundamentals:'Fundamentals', glaucoma:'Glaucoma',
    cornea:'Cornea / Anterior', retina:'Retina / Vitreous', oculoplastics:'Oculoplastics',
    neuro:'Neuro-Ophthalmology', peds:'Pediatrics / Strabismus', uveitis:'Uveitis / Oncology', cataract:'Cataract'
};

let iteChartInstance = null;

function openIteModal(id) {
    let scores = getIteScores();
    let s = id ? scores.find(x => x.id === id) : null;
    document.getElementById('iteId').value          = s ? s.id : '';
    document.getElementById('iteYear').value        = s ? s.year : new Date().getFullYear();
    document.getElementById('itePgy').value         = s ? s.pgy : 'PGY-2';
    document.getElementById('iteScore').value       = s ? s.score : '';
    document.getElementById('itePercentile').value  = s ? (s.percentile || '') : '';
    document.getElementById('iteNotes').value       = s ? (s.notes || '') : '';
    ITE_SUBJECTS.forEach(sub => {
        let el = document.getElementById('ite-' + sub);
        if (el) el.value = (s && s.subjects && s.subjects[sub] != null) ? s.subjects[sub] : '';
    });
    document.getElementById('iteModal').style.display = 'flex';
}

function closeIteModal() {
    document.getElementById('iteModal').style.display = 'none';
}

function saveIteScore() {
    let year  = parseInt(document.getElementById('iteYear').value);
    let score = parseFloat(document.getElementById('iteScore').value);
    if (!year || isNaN(score)) { showToast('Enter exam year and score', 'warning'); return; }

    let subjects = {};
    ITE_SUBJECTS.forEach(sub => {
        let v = document.getElementById('ite-' + sub).value;
        if (v !== '') subjects[sub] = parseFloat(v);
    });

    // Auto-calculate cases at time of exam (cases logged up to Dec of that year)
    let cutoff = year + '-12-31';
    let casesAtTime = allCases.filter(c => c.date && c.date <= cutoff).length;

    let scores = getIteScores();
    let id     = document.getElementById('iteId').value;
    let entry  = {
        id:          id || crypto.randomUUID(),
        year,
        pgy:         document.getElementById('itePgy').value,
        score,
        percentile:  parseFloat(document.getElementById('itePercentile').value) || null,
        subjects:    Object.keys(subjects).length ? subjects : null,
        notes:       document.getElementById('iteNotes').value.trim(),
        casesAtTime,
        savedAt:     new Date().toISOString()
    };
    if (id) {
        let idx = scores.findIndex(s => s.id === id);
        if (idx !== -1) scores[idx] = entry; else scores.unshift(entry);
    } else {
        scores.unshift(entry);
    }
    saveIteScores(scores);
    closeIteModal();
    renderIteScores();
    showToast('✅ Score saved!');
}

function deleteIteScore(id) {
    if (!confirm('Delete this score?')) return;
    saveIteScores(getIteScores().filter(s => s.id !== id));
    renderIteScores();
}

function renderIteScores() {
    let scores = getIteScores().sort((a,b) => a.year - b.year);

    // ── Stat cards ──
    let cardsEl = document.getElementById('iteStatCards');
    if (cardsEl && scores.length > 0) {
        let latest  = scores[scores.length - 1];
        let prev    = scores.length > 1 ? scores[scores.length - 2] : null;
        let delta   = prev ? (latest.score - prev.score) : null;
        let natAvg  = OKAP_NATIONAL_AVG[latest.pgy] || 55;
        let vsNat   = latest.score - natAvg;
        let best    = Math.max(...scores.map(s => s.score));

        let card = (label, val, sub, colClass) => {
            let cols = { blue:'#2563eb:#eff6ff:#dbeafe', green:'#16a34a:#f0fdf4:#dcfce7', amber:'#d97706:#fffbeb:#fef3c7', red:'#dc2626:#fef2f2:#fee2e2' };
            let [txt, bg, bd] = (cols[colClass]||cols.blue).split(':');
            return `<div style="background:${bg};border:1.5px solid ${bd};border-radius:14px;padding:12px 14px;text-align:center">
                <div style="font-size:22px;font-weight:800;color:${txt};line-height:1">${val}</div>
                <div style="font-size:10px;font-weight:700;color:${txt};text-transform:uppercase;letter-spacing:0.6px;margin-top:3px">${label}</div>
                <div style="font-size:10px;color:${txt};opacity:0.7;margin-top:2px">${sub}</div>
            </div>`;
        };

        cardsEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            ${card('Latest', latest.score+'%', latest.pgy+' · '+latest.year, latest.score>=natAvg?'green':'amber')}
            ${card('vs National', (vsNat>=0?'+':'')+vsNat.toFixed(1)+'%', 'Avg: ~'+natAvg+'% ('+latest.pgy+')', vsNat>=0?'green':'red')}
            ${delta!==null ? card('Trend', (delta>=0?'+':'')+delta.toFixed(1)+'%', 'vs prior year', delta>=0?'green':'red') : card('Best Ever', best+'%', scores.length+' exam'+(scores.length>1?'s':''), 'blue')}
        </div>`;
    } else if (cardsEl) {
        cardsEl.innerHTML = '';
    }

    // ── Trend chart ──
    let chartCard = document.getElementById('iteChartCard');
    if (chartCard) chartCard.style.display = scores.length >= 2 ? 'block' : 'none';

    if (scores.length >= 2) {
        let labels   = scores.map(s => s.pgy + ' (' + s.year + ')');
        let myScores = scores.map(s => s.score);
        let natAvgs  = scores.map(s => OKAP_NATIONAL_AVG[s.pgy] || 55);
        let pctiles  = scores.map(s => s.percentile);
        let ctx      = document.getElementById('iteChart');
        if (ctx) {
            if (iteChartInstance) iteChartInstance.destroy();
            iteChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'My Score (%)',
                            data: myScores,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37,99,235,0.08)',
                            borderWidth: 2.5,
                            pointRadius: 5,
                            pointBackgroundColor: '#2563eb',
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'National Avg (%)',
                            data: natAvgs,
                            borderColor: '#94a3b8',
                            borderWidth: 1.5,
                            borderDash: [5, 4],
                            pointRadius: 3,
                            pointBackgroundColor: '#94a3b8',
                            tension: 0.3,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
                        tooltip: {
                            callbacks: {
                                afterLabel: (ctx) => {
                                    if (ctx.datasetIndex === 0) {
                                        let s = scores[ctx.dataIndex];
                                        let lines = [];
                                        if (s.percentile) lines.push('Percentile: ' + s.percentile + 'th');
                                        if (s.casesAtTime) lines.push('Cases logged: ' + s.casesAtTime);
                                        return lines;
                                    }
                                    return [];
                                }
                            }
                        }
                    },
                    scales: {
                        y: { min: 30, max: 100, ticks: { font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                        x: { ticks: { font: { size: 10 } } }
                    }
                }
            });
        }
    }

    // ── History list ──
    let histEl = document.getElementById('iteHistory');
    if (!histEl) return;
    if (scores.length === 0) {
        histEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#9ca3af">
            <div style="font-size:32px;margin-bottom:12px">📊</div>
            <div style="font-size:14px;font-weight:600">No OKAP scores yet</div>
            <div style="font-size:12px;margin-top:4px">Add your first score to start tracking progress</div>
        </div>`;
        return;
    }

    let html = '';
    [...scores].reverse().forEach(s => {
        let natAvg = OKAP_NATIONAL_AVG[s.pgy] || 55;
        let vs     = s.score - natAvg;
        let vsCol  = vs >= 0 ? '#16a34a' : '#dc2626';
        let scoreCol = s.score >= 70 ? '#16a34a' : s.score >= 55 ? '#2563eb' : '#d97706';

        // Subject breakdown bars
        let subjectHtml = '';
        if (s.subjects && Object.keys(s.subjects).length) {
            let subEntries = Object.entries(s.subjects).sort((a,b) => a[1]-b[1]);
            subjectHtml = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9">
                <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Subject Breakdown</div>
                ${subEntries.map(([k,v]) => `
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                        <div style="font-size:11px;color:#64748b;width:130px;flex-shrink:0">${ITE_SUBJECT_LABELS[k]||k}</div>
                        <div style="flex:1;height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden">
                            <div style="height:100%;width:${v}%;background:${v>=60?'#16a34a':v>=45?'#2563eb':'#dc2626'};border-radius:99px"></div>
                        </div>
                        <div style="font-size:11px;font-weight:700;color:#374151;width:32px;text-align:right">${v}%</div>
                    </div>`).join('')}
            </div>`;
        }

        html += `<div class="dash-card" style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <div>
                    <span style="font-size:14px;font-weight:800;color:#0f172a">${s.pgy}</span>
                    <span style="font-size:12px;color:#94a3b8;margin-left:6px">${s.year}</span>
                    ${s.percentile ? `<span style="font-size:11px;font-weight:700;background:#eff6ff;color:#2563eb;border-radius:6px;padding:2px 7px;margin-left:6px">${s.percentile}th %ile</span>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:22px;font-weight:800;color:${scoreCol}">${s.score}%</span>
                    <span style="font-size:12px;font-weight:700;color:${vsCol}">${vs>=0?'+':''}${vs.toFixed(1)}% vs avg</span>
                    <button onclick="openIteModal('${s.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#f1f5f9;border-radius:6px;font-size:11px;color:#64748b;border:none;box-shadow:none">✏️</button>
                    <button onclick="deleteIteScore('${s.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:6px;font-size:13px;color:#dc2626;border:1px solid #fecaca;box-shadow:none">×</button>
                </div>
            </div>
            ${s.casesAtTime ? `<div style="font-size:11px;color:#94a3b8">📋 ${s.casesAtTime} cases logged by end of ${s.year}</div>` : ''}
            ${s.notes ? `<div style="font-size:12px;color:#64748b;margin-top:4px;font-style:italic">"${s.notes}"</div>` : ''}
            ${subjectHtml}
        </div>`;
    });
    histEl.innerHTML = html;
}

// ── Fellowship Application Suite ─────────────────────────────────────────────
const FP_KEY   = 'eyeFellowship';
const IV_KEY   = 'eyeFellowshipInterviews';
const RL_KEY   = 'eyeFellowshipRanks'; // ordered array of program ids

function getFellowshipPrograms() { return JSON.parse(localStorage.getItem(FP_KEY)||'[]'); }
function saveFellowshipPrograms(p) { localStorage.setItem(FP_KEY, JSON.stringify(p)); }
function getInterviews()  { return JSON.parse(localStorage.getItem(IV_KEY)||'[]'); }
function saveInterviews_(arr) { localStorage.setItem(IV_KEY, JSON.stringify(arr)); }
function getRankList()    { return JSON.parse(localStorage.getItem(RL_KEY)||'[]'); } // array of program ids in order
function saveRankList_(arr) { localStorage.setItem(RL_KEY, JSON.stringify(arr)); }

let activeFpTab = 'pipeline';
let selectedGutRank = 0;
let selectedIvGut   = 0;
let selectedSubspec = '';

function showFpTab(tab) {
    activeFpTab = tab;
    ['pipeline','interviews','ranklist','stats'].forEach(t => {
        let panel = document.getElementById('fp-'+t);
        let btn   = document.getElementById('fp-tab-'+t);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        if (btn) {
            btn.style.background  = t === tab ? 'white' : 'transparent';
            btn.style.color       = t === tab ? '#2563eb' : '#64748b';
            btn.style.boxShadow   = t === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none';
        }
    });
    if (tab === 'pipeline')    renderFellowshipBoard();
    if (tab === 'interviews')  renderInterviews();
    if (tab === 'ranklist')    renderRankList();
    if (tab === 'stats')       renderStatsLetter();
}

// ── Gut stars ──
function setGutRank(n) {
    selectedGutRank = n;
    for (let i=1;i<=5;i++) {
        let btn = document.getElementById('gut-'+i);
        if (btn) { btn.style.background = i<=n ? '#fef9c3' : '#f8fafc'; btn.style.borderColor = i<=n ? '#fde68a' : '#e2e8f0'; }
    }
}
function setIvGut(n) {
    selectedIvGut = n;
    for (let i=1;i<=5;i++) {
        let btn = document.getElementById('ivgut-'+i);
        if (btn) { btn.style.background = i<=n ? '#fef9c3' : '#f8fafc'; btn.style.borderColor = i<=n ? '#fde68a' : '#e2e8f0'; }
    }
}

// ── Program CRUD ──
function openFellowshipModal(id) {
    let prog = id ? getFellowshipPrograms().find(p=>p.id===id) : null;
    document.getElementById('fpId').value       = prog ? prog.id : '';
    document.getElementById('fpName').value     = prog ? prog.name : '';
    document.getElementById('fpCity').value     = prog ? (prog.city||'') : '';
    document.getElementById('fpSubspec').value  = prog ? (prog.subspec||'') : '';
    document.getElementById('fpStage').value    = prog ? (prog.stage||'applied') : 'applied';
    document.getElementById('fpDeadline').value = prog ? (prog.deadline||'') : '';
    document.getElementById('fpDate').value     = prog ? (prog.date||'') : '';
    document.getElementById('fpFormat').value   = prog ? (prog.format||'') : '';
    document.getElementById('fpNotes').value    = prog ? (prog.notes||'') : '';
    selectedGutRank = prog ? (prog.gutRank||0) : 0;
    for (let i=1;i<=5;i++) {
        let btn = document.getElementById('gut-'+i);
        if (btn) { btn.style.background = i<=selectedGutRank ? '#fef9c3' : '#f8fafc'; btn.style.borderColor = i<=selectedGutRank ? '#fde68a' : '#e2e8f0'; }
    }
    document.getElementById('fellowshipModal').style.display = 'flex';
}
function closeFellowshipModal() {
    document.getElementById('fellowshipModal').style.display = 'none';
    selectedGutRank = 0;
}
function saveFellowshipProgram() {
    let name = document.getElementById('fpName').value.trim();
    if (!name) { showToast('Enter a program name', 'warning'); return; }
    let programs = getFellowshipPrograms();
    let id = document.getElementById('fpId').value;
    let prog = {
        id:       id || crypto.randomUUID(),
        name,
        city:     document.getElementById('fpCity').value.trim(),
        subspec:  document.getElementById('fpSubspec').value,
        stage:    document.getElementById('fpStage').value,
        deadline: document.getElementById('fpDeadline').value,
        date:     document.getElementById('fpDate').value,
        format:   document.getElementById('fpFormat').value,
        gutRank:  selectedGutRank,
        notes:    document.getElementById('fpNotes').value.trim(),
    };
    if (id) { let i = programs.findIndex(p=>p.id===id); if (i>=0) programs[i]=prog; else programs.unshift(prog); }
    else programs.unshift(prog);
    saveFellowshipPrograms(programs);
    // Auto-add to rank list if interviewed/ranked and not already there
    if (['interviewed','ranked'].includes(prog.stage)) {
        let rl = getRankList();
        if (!rl.includes(prog.id)) { rl.push(prog.id); saveRankList_(rl); }
    }
    closeFellowshipModal();
    renderFellowshipBoard();
    showToast('Program saved!');
}
function deleteFellowshipProgram(id) {
    if (!confirm('Remove this program?')) return;
    saveFellowshipPrograms(getFellowshipPrograms().filter(p=>p.id!==id));
    saveRankList_(getRankList().filter(rid=>rid!==id));
    renderFellowshipBoard();
}

// ── Pipeline render ──
function renderFellowshipBoard() {
    let el = document.getElementById('fellowshipBoard');
    if (!el) return;
    let programs = getFellowshipPrograms();
    const stages = [
        { key:'wishlist',          label:'Wish List',         color:'#94a3b8', bg:'#f8fafc' },
        { key:'researching',       label:'Researching',        color:'#0891b2', bg:'#ecfeff' },
        { key:'applied',           label:'Applied',            color:'#2563eb', bg:'#eff6ff' },
        { key:'interview-offered', label:'Interview Offered',  color:'#d97706', bg:'#fffbeb' },
        { key:'interviewed',       label:'Interviewed',        color:'#7c3aed', bg:'#faf5ff' },
        { key:'ranked',            label:'Ranked',             color:'#059669', bg:'#f0fdf4' },
        { key:'matched',           label:'Matched 🎉',         color:'#16a34a', bg:'#dcfce7' },
        { key:'not-matched',       label:'Not Matched',        color:'#dc2626', bg:'#fef2f2' },
        { key:'withdrawn',         label:'Withdrawn',          color:'#64748b', bg:'#f8fafc' },
    ];
    if (!programs.length) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:36px;margin-bottom:8px">🎓</div>
            <p style="font-size:14px;font-weight:600;color:#64748b;margin:0 0 6px">No programs yet</p>
            <p style="font-size:13px;margin:0">Add fellowship programs to start tracking your applications</p>
        </div>`;
        return;
    }
    // Stats bar
    let applied      = programs.filter(p=>['applied','interview-offered','interviewed','ranked','matched'].includes(p.stage)).length;
    let interviewed  = programs.filter(p=>['interviewed','ranked','matched'].includes(p.stage)).length;
    let matched      = programs.filter(p=>p.stage==='matched').length;
    let statsHtml = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
        ${[
            {label:'Total',       val:programs.length,  col:'#64748b'},
            {label:'Applied',     val:applied,           col:'#2563eb'},
            {label:'Interviewed', val:interviewed,       col:'#7c3aed'},
            {label:'Matched',     val:matched,           col:'#16a34a'},
        ].map(s=>`<div style="background:white;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:${s.col}">${s.val}</div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">${s.label}</div>
        </div>`).join('')}
    </div>`;

    let stagesHtml = '';
    stages.forEach(stage => {
        let sp = programs.filter(p => p.stage === stage.key);
        if (!sp.length) return;
        stagesHtml += `<div style="margin-bottom:18px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <div style="width:9px;height:9px;border-radius:50%;background:${stage.color}"></div>
                <span style="font-size:11px;font-weight:700;color:${stage.color};text-transform:uppercase;letter-spacing:0.5px">${stage.label}</span>
                <span style="font-size:11px;color:#94a3b8">${sp.length}</span>
            </div>
            ${sp.map(p=>`<div style="background:${stage.bg};border:1.5px solid ${stage.color}22;border-radius:12px;padding:12px 14px;margin-bottom:7px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:2px">${p.name}</div>
                    <div style="font-size:11px;color:#64748b">${[p.city,p.subspec].filter(Boolean).join(' · ')}</div>
                    ${p.date ? `<div style="font-size:11px;color:${stage.color};font-weight:600;margin-top:4px">📅 ${new Date(p.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>` : ''}
                    ${p.deadline ? `<div style="font-size:11px;color:#dc2626;font-weight:600">⏰ Deadline: ${new Date(p.deadline+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>` : ''}
                    ${p.gutRank ? `<div style="font-size:12px;margin-top:4px">${'⭐'.repeat(p.gutRank)}</div>` : ''}
                    ${p.notes ? `<div style="font-size:11px;color:#64748b;margin-top:5px;line-height:1.4">${p.notes.slice(0,100)}${p.notes.length>100?'…':''}</div>` : ''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="openFellowshipModal('${p.id}')" title="Edit" style="width:26px;height:26px;padding:0;margin:0;background:#f1f5f9;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onclick="deleteFellowshipProgram('${p.id}')" title="Delete" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                </div>
            </div>`).join('')}
        </div>`;
    });
    el.innerHTML = statsHtml + stagesHtml;
}

// ── Interview CRUD ──
function openInterviewModal(id) {
    let interviews = getInterviews();
    let iv = id ? interviews.find(x=>x.id===id) : null;
    // Populate program dropdown from programs that have been offered/interviewed/ranked/matched
    let programs = getFellowshipPrograms().filter(p=>['interview-offered','interviewed','ranked','matched'].includes(p.stage));
    let sel = document.getElementById('ivProgram');
    if (sel) {
        sel.innerHTML = `<option value="">— Select Program —</option>` +
            programs.map(p=>`<option value="${p.id}" ${iv&&iv.programId===p.id?'selected':''}>${p.name}</option>`).join('');
    }
    document.getElementById('ivId').value           = iv ? iv.id : '';
    document.getElementById('ivDate').value         = iv ? (iv.date||'') : getTodayStr();
    document.getElementById('ivFormat').value       = iv ? (iv.format||'In-Person') : 'In-Person';
    document.getElementById('ivInterviewers').value = iv ? (iv.interviewers||'') : '';
    document.getElementById('ivQuestions').value   = iv ? (iv.questions||'') : '';
    document.getElementById('ivImpressions').value = iv ? (iv.impressions||'') : '';
    document.getElementById('ivThankYou').checked  = iv ? !!iv.thankYou : false;
    selectedIvGut = iv ? (iv.gut||0) : 0;
    for (let i=1;i<=5;i++) {
        let btn = document.getElementById('ivgut-'+i);
        if (btn) { btn.style.background = i<=selectedIvGut ? '#fef9c3' : '#f8fafc'; btn.style.borderColor = i<=selectedIvGut ? '#fde68a' : '#e2e8f0'; }
    }
    document.getElementById('interviewModal').style.display = 'flex';
}
function closeInterviewModal() {
    document.getElementById('interviewModal').style.display = 'none';
    selectedIvGut = 0;
}
function saveInterview() {
    let programId = document.getElementById('ivProgram').value;
    if (!programId) { showToast('Select a program', 'warning'); return; }
    let interviews = getInterviews();
    let id = document.getElementById('ivId').value;
    let iv = {
        id:           id || crypto.randomUUID(),
        programId,
        date:         document.getElementById('ivDate').value,
        format:       document.getElementById('ivFormat').value,
        interviewers: document.getElementById('ivInterviewers').value.trim(),
        questions:    document.getElementById('ivQuestions').value.trim(),
        impressions:  document.getElementById('ivImpressions').value.trim(),
        gut:          selectedIvGut,
        thankYou:     document.getElementById('ivThankYou').checked,
    };
    if (id) { let i = interviews.findIndex(x=>x.id===id); if (i>=0) interviews[i]=iv; else interviews.push(iv); }
    else interviews.push(iv);
    interviews.sort((a,b)=>b.date.localeCompare(a.date));
    saveInterviews_(interviews);
    // Mark program as interviewed
    let programs = getFellowshipPrograms();
    let pi = programs.findIndex(p=>p.id===programId);
    if (pi>=0 && programs[pi].stage === 'interview-offered') {
        programs[pi].stage = 'interviewed';
        saveFellowshipPrograms(programs);
    }
    // Add to rank list
    let rl = getRankList();
    if (!rl.includes(programId)) { rl.push(programId); saveRankList_(rl); }
    closeInterviewModal();
    renderInterviews();
    showToast('Interview notes saved!');
}
function deleteInterview(id) {
    if (!confirm('Delete this interview record?')) return;
    saveInterviews_(getInterviews().filter(x=>x.id!==id));
    renderInterviews();
}

function renderInterviews() {
    let el = document.getElementById('interviewList');
    if (!el) return;
    let interviews = getInterviews();
    let programs   = getFellowshipPrograms();
    if (!interviews.length) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:36px;margin-bottom:8px">📅</div>
            <div style="font-size:14px;font-weight:600">No interviews logged yet</div>
            <div style="font-size:12px;margin-top:4px">Add interview notes as you complete interviews</div>
        </div>`;
        return;
    }
    let pending = interviews.filter(iv=>!iv.thankYou).length;
    let thankYouBar = pending ? `<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;font-weight:700;color:#92400e">✉️ ${pending} thank-you note${pending>1?'s':''} not yet sent</div>` : `<div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;font-weight:700;color:#166534">✅ All thank-you notes sent</div>`;
    el.innerHTML = thankYouBar + interviews.map(iv => {
        let prog = programs.find(p=>p.id===iv.programId);
        return `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1">
                    <div style="font-weight:800;font-size:13px;color:#0f172a">${prog?prog.name:'Unknown Program'}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px">${iv.date} · ${iv.format} ${iv.gut ? '· '+'⭐'.repeat(iv.gut) : ''}</div>
                    ${iv.thankYou ? '<div style="display:inline-block;background:#f0fdf4;color:#16a34a;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid #86efac;margin-top:4px">✉️ Thank-you sent</div>' : '<div style="display:inline-block;background:#fef9c3;color:#92400e;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid #fde68a;margin-top:4px">⏳ Thank-you pending</div>'}
                    ${iv.interviewers ? `<div style="font-size:11px;color:#475569;margin-top:8px"><strong>Interviewers:</strong> ${iv.interviewers}</div>` : ''}
                    ${iv.questions ? `<div style="font-size:11px;color:#475569;margin-top:6px"><strong>Questions:</strong> ${iv.questions}</div>` : ''}
                    ${iv.impressions ? `<div style="font-size:11px;color:#475569;margin-top:6px"><strong>Impressions:</strong> ${iv.impressions}</div>` : ''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="openInterviewModal('${iv.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#f1f5f9;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onclick="deleteInterview('${iv.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── Rank List ──
function moveRank(id, dir) {
    let rl = getRankList();
    let i = rl.indexOf(id);
    if (i < 0) return;
    let newI = i + dir;
    if (newI < 0 || newI >= rl.length) return;
    [rl[i], rl[newI]] = [rl[newI], rl[i]];
    saveRankList_(rl);
    renderRankList();
}
function removeFromRankList(id) {
    saveRankList_(getRankList().filter(rid=>rid!==id));
    renderRankList();
}

function renderRankList() {
    let el = document.getElementById('rankListEl');
    if (!el) return;
    let rl       = getRankList();
    let programs = getFellowshipPrograms();
    // Filter rank list to only programs that still exist and are in relevant stages
    rl = rl.filter(id => programs.find(p=>p.id===id));
    if (rl.length !== getRankList().length) saveRankList_(rl);

    if (!rl.length) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:36px;margin-bottom:8px">🏆</div>
            <div style="font-size:14px;font-weight:600">No programs ranked yet</div>
            <div style="font-size:12px;margin-top:4px">Programs move here automatically when you mark them as Interviewed or Ranked</div>
        </div>`;
        return;
    }
    el.innerHTML = `
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:#1e40af">
        💡 This is your working rank list. Order programs with ↑↓ — share it with yourself before submitting to the match.
    </div>` +
    rl.map((id, idx) => {
        let prog = programs.find(p=>p.id===id);
        if (!prog) return '';
        return `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="font-size:22px;font-weight:900;color:#e2e8f0;min-width:28px;text-align:center">${idx+1}</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px;color:#0f172a">${prog.name}</div>
                <div style="font-size:11px;color:#64748b">${[prog.city,prog.subspec].filter(Boolean).join(' · ')}${prog.gutRank?' · '+'⭐'.repeat(prog.gutRank):''}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
                <button onclick="moveRank('${id}',-1)" style="width:26px;height:22px;padding:0;margin:0;background:#f1f5f9;border-radius:5px;font-size:12px;box-shadow:none;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center" ${idx===0?'disabled':''}>↑</button>
                <button onclick="moveRank('${id}',1)"  style="width:26px;height:22px;padding:0;margin:0;background:#f1f5f9;border-radius:5px;font-size:12px;box-shadow:none;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center" ${idx===rl.length-1?'disabled':''}>↓</button>
            </div>
            <button onclick="removeFromRankList('${id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:7px;box-shadow:none;border:1px solid #fecaca;display:flex;align-items:center;justify-content:center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
        </div>`;
    }).join('');
}

// ── Stats Letter ──
const ACGME_CATS = [
    { key:'phaco',        label:'Cataract (Phacoemulsification)', min:86,  procs:['Phacoemulsification','Cataract'] },
    { key:'cornea',       label:'Cornea',                         min:35,  procs:['Cornea','DSEK','DMEK','PKP','Keratoplasty','PTK'] },
    { key:'glaucoma',     label:'Glaucoma',                       min:30,  procs:['Glaucoma','Trabeculectomy','Tube Shunt','MIGS','SLT','iStent'] },
    { key:'retina',       label:'Vitreoretinal',                  min:25,  procs:['Retina','Vitrectomy','Scleral Buckle','Laser','Injection','Anti-VEGF'] },
    { key:'oculoplastics',label:'Oculoplastics',                  min:30,  procs:['Oculoplastics','Blepharoplasty','Ptosis','Entropion','Ectropion','Dacryocystorhinostomy','DCR','Orbital','Enucleation'] },
    { key:'peds',         label:'Pediatric',                      min:20,  procs:['Pediatric','Strabismus','Esotropia','Exotropia','Amblyopia'] },
    { key:'neuro',        label:'Neuro-Ophthalmology',            min:null, procs:['Neuro','Botox'] },
    { key:'other',        label:'Other Procedures',               min:null, procs:[] },
];

function _categorizeCases(cases) {
    let cats = {};
    ACGME_CATS.forEach(c => { cats[c.key] = { primary:0, assistant:0, observer:0, total:0 }; });
    cases.forEach(c => {
        let proc  = (c.procedure || c.type || '').toLowerCase();
        let role  = (c.role || '').toLowerCase();
        let matched = false;
        for (let cat of ACGME_CATS) {
            if (cat.key === 'other') continue;
            if (cat.procs.some(p => proc.includes(p.toLowerCase()))) {
                if (role.includes('primary'))   cats[cat.key].primary++;
                else if (role.includes('assist')) cats[cat.key].assistant++;
                else cats[cat.key].observer++;
                cats[cat.key].total++;
                matched = true;
                break;
            }
        }
        if (!matched) {
            if (role.includes('primary'))   cats['other'].primary++;
            else if (role.includes('assist')) cats['other'].assistant++;
            else cats['other'].observer++;
            cats['other'].total++;
        }
    });
    return cats;
}

let statsLetterSubspecialty = '';
function setSubspec(btn, subspec) {
    statsLetterSubspecialty = subspec;
    document.querySelectorAll('.subspec-btn').forEach(b => {
        b.style.background  = '#f8fafc';
        b.style.color       = '#64748b';
        b.style.borderColor = '#e2e8f0';
    });
    btn.style.background  = '#eff6ff';
    btn.style.color       = '#2563eb';
    btn.style.borderColor = '#bfdbfe';
    renderStatsLetter();
}

function renderStatsLetter() {
    let el = document.getElementById('statsLetterPreview');
    if (!el) return;
    let cases = getCases ? getCases() : (JSON.parse(localStorage.getItem('eyeCases')||'[]'));
    if (!cases.length) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;background:#f8fafc;border-radius:14px;color:#94a3b8">
            <div style="font-size:36px;margin-bottom:8px">📊</div>
            <div style="font-size:14px;font-weight:600">No cases logged yet</div>
            <div style="font-size:12px;margin-top:4px">Log cases in the Case Log tab — your stats letter will auto-generate here</div>
        </div>`;
        return;
    }
    let cats      = _categorizeCases(cases);
    let name      = localStorage.getItem('eyeName') || localStorage.getItem('userName') || 'Resident Physician';
    let pgy       = localStorage.getItem('eyePGY')  || localStorage.getItem('userPGY')  || '';
    let program   = localStorage.getItem('eyeProgram') || localStorage.getItem('userProgram') || 'Ophthalmology Residency Program';
    let today     = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    let grandTotalPrimary   = Object.values(cats).reduce((s,c)=>s+c.primary,0);
    let grandTotalAssistant = Object.values(cats).reduce((s,c)=>s+c.assistant,0);
    let grandTotal          = Object.values(cats).reduce((s,c)=>s+c.total,0);
    let phacoPrimary        = cats.phaco.primary;
    let subspec             = statsLetterSubspecialty || '[Fellowship Subspecialty]';

    // Generate letter text
    let letterText = `Dr. ${name}${pgy?' · PGY-'+pgy:''}\n${program}\nDate: ${today}\n\nDEAR FELLOWSHIP SELECTION COMMITTEE,\n\nI am applying for fellowship training in ${subspec}. The following is a summary of my surgical and clinical case experience during ophthalmology residency, accurate as of ${today}.\n\nCASE LOG SUMMARY\n${'─'.repeat(60)}\n\n`;
    ACGME_CATS.forEach(cat => {
        let c = cats[cat.key];
        if (!c.total) return;
        letterText += `${cat.label}\n`;
        letterText += `  Primary: ${c.primary}   Assistant: ${c.assistant}   Observer: ${c.observer}   Total: ${c.total}`;
        if (cat.min) letterText += `   (ACGME min: ${cat.min})`;
        letterText += `\n\n`;
    });
    letterText += `${'─'.repeat(60)}\nGRAND TOTAL: ${grandTotal} cases  (${grandTotalPrimary} as Primary Surgeon)\n\nOf ${cases.length} logged cases, ${phacoPrimary} were performed as primary surgeon for phacoemulsification.\n\nSincerely,\nDr. ${name}\n${pgy?'PGY-'+pgy+' ':''}Ophthalmology Resident\n${program}`;

    // Render the preview card
    let tableRows = ACGME_CATS.map(cat => {
        let c = cats[cat.key];
        if (!c.total) return '';
        let minOk = cat.min ? (c.primary >= cat.min) : true;
        let pct   = cat.min ? Math.min(100, Math.round(c.primary/cat.min*100)) : null;
        return `<tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:9px 10px;font-size:12px;font-weight:600;color:#0f172a">${cat.label}</td>
            <td style="padding:9px 10px;text-align:center;font-size:13px;font-weight:800;color:${c.primary>0?'#2563eb':'#94a3b8'}">${c.primary}</td>
            <td style="padding:9px 10px;text-align:center;font-size:12px;color:#64748b">${c.assistant}</td>
            <td style="padding:9px 10px;text-align:center;font-size:12px;color:#94a3b8">${c.observer}</td>
            <td style="padding:9px 10px;text-align:center;font-size:12px;font-weight:700;color:#0f172a">${c.total}</td>
            <td style="padding:9px 10px;text-align:center;font-size:11px">${cat.min ? `<span style="color:${minOk?'#16a34a':'#dc2626'};font-weight:700">${c.primary}/${cat.min}</span>` : '—'}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:16px;overflow:hidden;margin-bottom:14px">
        <div style="background:#0f172a;padding:16px 18px">
            <div style="color:white;font-size:15px;font-weight:800">Dr. ${name}${pgy?' · PGY-'+pgy:''}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:2px">${program}</div>
            <div style="color:#64748b;font-size:11px;margin-top:1px">As of ${today} · Applying: ${subspec}</div>
        </div>
        <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
                        <th style="padding:9px 10px;text-align:left;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Category</th>
                        <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px">Primary</th>
                        <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Assist</th>
                        <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Obs</th>
                        <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">Total</th>
                        <th style="padding:9px 10px;text-align:center;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">vs Min</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
                <tfoot>
                    <tr style="background:#f8fafc;border-top:2px solid #e2e8f0">
                        <td style="padding:10px;font-size:12px;font-weight:800;color:#0f172a">TOTAL</td>
                        <td style="padding:10px;text-align:center;font-size:14px;font-weight:900;color:#2563eb">${grandTotalPrimary}</td>
                        <td style="padding:10px;text-align:center;font-size:13px;font-weight:700;color:#64748b">${grandTotalAssistant}</td>
                        <td style="padding:10px;text-align:center;font-size:12px;color:#94a3b8">${grandTotal-grandTotalPrimary-grandTotalAssistant}</td>
                        <td style="padding:10px;text-align:center;font-size:14px;font-weight:900;color:#0f172a">${grandTotal}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div style="padding:12px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">
            🔵 Primary surgeon count shown in blue — this is what fellowship programs care most about.
        </div>
    </div>
    <textarea id="statsLetterText" style="width:100%;height:300px;font-family:monospace;font-size:11px;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;color:#374151;background:#f8fafc;resize:vertical;box-sizing:border-box" readonly>${letterText}</textarea>`;
    // Store for copy/PDF
    window._statsLetterText = letterText;
    window._statsLetterCats = cats;
    window._statsLetterMeta = { name, pgy, program, today, grandTotal, grandTotalPrimary, subspec };
}

function copyStatsLetter() {
    let ta = document.getElementById('statsLetterText');
    if (!ta) return;
    navigator.clipboard.writeText(ta.value).then(()=>showToast('Copied to clipboard!')).catch(()=>{
        ta.select(); document.execCommand('copy'); showToast('Copied!');
    });
}

function exportStatsLetterPDF() {
    let meta = window._statsLetterMeta;
    let cats = window._statsLetterCats;
    if (!meta || !cats) { renderStatsLetter(); meta=window._statsLetterMeta; cats=window._statsLetterCats; }
    if (!meta) { showToast('Generate the letter first','warning'); return; }
    let doc = new jspdf.jsPDF();
    let y = 20;
    doc.setFontSize(18); doc.setFont(undefined,'bold');
    doc.text('Fellowship Case Statistics', 14, y); y+=10;
    doc.setFontSize(11); doc.setFont(undefined,'normal');
    doc.text(`Dr. ${meta.name}${meta.pgy?' · PGY-'+meta.pgy:''}`, 14, y); y+=6;
    doc.text(meta.program, 14, y); y+=6;
    doc.text(`Date: ${meta.today}   Applying for: ${meta.subspec}`, 14, y); y+=12;
    // Table header
    doc.setFont(undefined,'bold'); doc.setFontSize(9);
    doc.text('Category', 14, y);
    doc.text('Primary', 100, y); doc.text('Assist', 120, y); doc.text('Observer', 138, y); doc.text('Total', 162, y); doc.text('ACGME Min', 176, y);
    y+=2; doc.line(14,y,196,y); y+=5;
    doc.setFont(undefined,'normal'); doc.setFontSize(9);
    ACGME_CATS.forEach(cat => {
        let c = cats[cat.key]; if (!c||!c.total) return;
        doc.text(cat.label.slice(0,35), 14, y);
        doc.text(String(c.primary),   103, y);
        doc.text(String(c.assistant), 123, y);
        doc.text(String(c.observer),  142, y);
        doc.text(String(c.total),     164, y);
        doc.text(cat.min ? String(cat.min) : '—', 182, y);
        y+=7;
    });
    y+=2; doc.line(14,y,196,y); y+=7;
    doc.setFont(undefined,'bold');
    doc.text(`GRAND TOTAL: ${meta.grandTotal} cases (${meta.grandTotalPrimary} as Primary Surgeon)`, 14, y);
    doc.save(`fellowship-stats-${(meta.name||'resident').replace(/\s+/g,'-').toLowerCase()}.pdf`);
    showToast('PDF exported!');
}

// ── Wellness Check-in ─────────────────────────────────────────────────────────
function getWellness()      { return JSON.parse(localStorage.getItem('eyeWellness')||'[]'); }
function saveWellness_(arr) { localStorage.setItem('eyeWellness', JSON.stringify(arr)); }

let selectedWellbeing  = 0;
let selectedStressors  = [];
let wellnessChartInst  = null;

const WELLBEING_LABELS = {
    1:'Terrible 😞', 2:'Very low 😔', 3:'Struggling 😟', 4:'Below average 😕',
    5:'Okay 😐', 6:'Decent 🙂', 7:'Good 😊', 8:'Really good 😄', 9:'Great 🌟', 10:'Amazing 🚀'
};

function setWellbeing(n) {
    selectedWellbeing = n;
    for (let i = 1; i <= 10; i++) {
        let btn = document.getElementById('wb-'+i);
        if (!btn) continue;
        let active = i === n;
        let col = i <= 3 ? '#dc2626' : i <= 5 ? '#f59e0b' : i <= 7 ? '#2563eb' : '#16a34a';
        btn.style.background  = active ? col : '#f1f5f9';
        btn.style.color       = active ? 'white' : '#64748b';
        btn.style.borderColor = active ? col : '#e2e8f0';
        btn.style.fontWeight  = active ? '800' : '600';
    }
    let lbl = document.getElementById('wellbeingLabel');
    if (lbl) lbl.textContent = WELLBEING_LABELS[n] || '';
}

function toggleStressor(btn, label) {
    let idx = selectedStressors.indexOf(label);
    if (idx >= 0) {
        selectedStressors.splice(idx, 1);
        btn.style.background  = '#f1f5f9';
        btn.style.color       = '#64748b';
        btn.style.borderColor = '#e2e8f0';
    } else {
        selectedStressors.push(label);
        btn.style.background  = '#fef2f2';
        btn.style.color       = '#dc2626';
        btn.style.borderColor = '#fca5a5';
    }
}

function openWellnessModal(id) {
    let entries = getWellness();
    let w = id ? entries.find(x => x.id === id) : null;
    document.getElementById('wellnessId').value   = w ? w.id : '';
    document.getElementById('wellnessDate').value = w ? w.date : getTodayStr();
    document.getElementById('wellnessSleep').value = w ? (w.sleep || '') : '';
    document.getElementById('wellnessPostCall').checked = w ? !!w.postCall : false;
    document.getElementById('wellnessWin').value   = w ? (w.win || '') : '';
    document.getElementById('wellnessNotes').value = w ? (w.notes || '') : '';

    // Reset wellbeing buttons
    selectedWellbeing = w ? (w.wellbeing || 0) : 0;
    for (let i = 1; i <= 10; i++) {
        let btn = document.getElementById('wb-'+i);
        if (!btn) continue;
        btn.style.background  = '#f1f5f9';
        btn.style.color       = '#64748b';
        btn.style.borderColor = '#e2e8f0';
        btn.style.fontWeight  = '600';
    }
    let lbl = document.getElementById('wellbeingLabel');
    if (lbl) lbl.textContent = '';
    if (selectedWellbeing) setWellbeing(selectedWellbeing);

    // Reset stressors
    selectedStressors = w ? (w.stressors ? [...w.stressors] : []) : [];
    document.querySelectorAll('.stressor-btn').forEach(btn => {
        let label = btn.dataset.stressor;
        let active = selectedStressors.includes(label);
        btn.style.background  = active ? '#fef2f2' : '#f1f5f9';
        btn.style.color       = active ? '#dc2626' : '#64748b';
        btn.style.borderColor = active ? '#fca5a5' : '#e2e8f0';
    });

    document.getElementById('wellnessModal').style.display = 'flex';
}

function closeWellnessModal() {
    document.getElementById('wellnessModal').style.display = 'none';
    selectedWellbeing = 0;
    selectedStressors = [];
}

function saveWellness() {
    let date = document.getElementById('wellnessDate').value;
    if (!date) { alert('Please select a date.'); return; }
    if (!selectedWellbeing) { alert('Please rate your wellbeing.'); return; }

    let entries = getWellness();
    let id  = document.getElementById('wellnessId').value;
    let obj = {
        id:       id || crypto.randomUUID(),
        date,
        wellbeing: selectedWellbeing,
        sleep:     parseFloat(document.getElementById('wellnessSleep').value) || null,
        postCall:  document.getElementById('wellnessPostCall').checked,
        stressors: [...selectedStressors],
        win:       document.getElementById('wellnessWin').value.trim(),
        notes:     document.getElementById('wellnessNotes').value.trim(),
        createdAt: id ? (entries.find(x=>x.id===id)||{}).createdAt : new Date().toISOString()
    };

    if (id) {
        let i = entries.findIndex(x => x.id === id);
        if (i >= 0) entries[i] = obj; else entries.push(obj);
    } else {
        entries.push(obj);
    }
    entries.sort((a,b) => b.date.localeCompare(a.date));
    saveWellness_(entries);
    closeWellnessModal();
    renderWellness();
}

function deleteWellness(id) {
    if (!confirm('Delete this check-in?')) return;
    saveWellness_(getWellness().filter(x => x.id !== id));
    renderWellness();
}

function _wellnessStreak(entries) {
    if (!entries.length) return 0;
    let today = getTodayStr();
    let streak = 0;
    let cur = new Date(today);
    let dates = new Set(entries.map(e => e.date));
    while (true) {
        let ds = cur.toLocaleDateString('en-CA', { timeZone: getUserTz() });
        if (dates.has(ds)) { streak++; cur.setDate(cur.getDate()-1); }
        else break;
    }
    return streak;
}

function renderWellness() {
    let el = document.getElementById('ws-wellness');
    if (!el) return;
    let entries = getWellness();
    let today   = getTodayStr();
    let thisWeekStart = _dutyWeekBounds(0).monday; // reuse week bounds helper

    // Stats
    let avgWellbeing = entries.length ? (entries.reduce((s,e)=>s+e.wellbeing,0)/entries.length).toFixed(1) : '—';
    let sleepEntries = entries.filter(e=>e.sleep!=null);
    let avgSleep     = sleepEntries.length ? (sleepEntries.reduce((s,e)=>s+e.sleep,0)/sleepEntries.length).toFixed(1) : '—';
    let streak       = _wellnessStreak(entries);
    let weekEntries  = entries.filter(e => e.date >= thisWeekStart && e.date <= today);

    // Wins gallery — last 5 wins
    let wins = entries.filter(e=>e.win).slice(0,5);

    // Wellbeing color helper
    let wbColor = v => v >= 8 ? '#16a34a' : v >= 6 ? '#2563eb' : v >= 4 ? '#f59e0b' : '#dc2626';

    // Stressor frequency
    let stressorMap = {};
    entries.forEach(e => (e.stressors||[]).forEach(s => { stressorMap[s] = (stressorMap[s]||0)+1; }));
    let topStressors = Object.entries(stressorMap).sort((a,b)=>b[1]-a[1]).slice(0,3);

    let statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        ${[
            { label:'Avg Wellbeing', val: avgWellbeing !== '—' ? avgWellbeing+'/10' : '—', col: avgWellbeing !== '—' ? wbColor(parseFloat(avgWellbeing)) : '#94a3b8' },
            { label:'Avg Sleep',     val: avgSleep !== '—' ? avgSleep+'h' : '—',           col: avgSleep!=='—' && parseFloat(avgSleep)>=7 ? '#16a34a' : avgSleep!=='—' ? '#f59e0b' : '#94a3b8' },
            { label:'Check-in Streak', val: streak ? streak+'d 🔥' : '0d',                col: streak >= 7 ? '#16a34a' : streak >= 3 ? '#f59e0b' : '#94a3b8' },
            { label:'This Week',     val: weekEntries.length+'/7',                         col: '#7c3aed' }
        ].map(s=>`<div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:${s.col}">${s.val}</div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${s.label}</div>
        </div>`).join('')}
    </div>`;

    // Trend chart
    let chartHtml = '';
    if (entries.length >= 3) {
        chartHtml = `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Wellbeing Trend</div>
            <canvas id="wellnessChart" height="90"></canvas>
        </div>`;
    }

    // Top stressors
    let stressorHtml = '';
    if (topStressors.length) {
        stressorHtml = `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Top Stressors</div>
            ${topStressors.map(([s,n])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <div style="flex:1;font-size:12px;font-weight:600;color:#374151">${s}</div>
                <div style="background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${n}×</div>
            </div>`).join('')}
        </div>`;
    }

    // Wins gallery
    let winsHtml = '';
    if (wins.length) {
        winsHtml = `<div style="background:linear-gradient(135deg,#fdf4ff,#fce7f3);border:1.5px solid #f0abfc;border-radius:14px;padding:16px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">🏆 Highlight Reel</div>
            ${wins.map(e=>`<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
                <div style="font-size:16px;flex-shrink:0">⭐</div>
                <div>
                    <div style="font-size:12px;font-weight:600;color:#1e1b4b">${e.win}</div>
                    <div style="font-size:10px;color:#7c3aed;margin-top:1px">${e.date}</div>
                </div>
            </div>`).join('')}
        </div>`;
    }

    // History
    let histHtml = '';
    if (!entries.length) {
        histHtml = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:36px;margin-bottom:8px">💆</div>
            <div style="font-size:14px;font-weight:600">No check-ins yet</div>
            <div style="font-size:12px;margin-top:4px">Tap "Check In" to start tracking your wellness</div>
        </div>`;
    } else {
        histHtml = entries.map(e => {
            let col = wbColor(e.wellbeing);
            return `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px;border-left:4px solid ${col}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                    <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                            <div style="font-size:20px;font-weight:900;color:${col}">${e.wellbeing}/10</div>
                            <div style="font-size:12px;font-weight:600;color:#374151">${WELLBEING_LABELS[e.wellbeing]||''}</div>
                            ${e.postCall ? '<span style="background:#fef2f2;color:#dc2626;font-size:9px;font-weight:700;padding:2px 6px;border-radius:20px;border:1px solid #fecaca">POST-CALL</span>' : ''}
                        </div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:4px">${e.date}${e.sleep != null ? ` · 💤 ${e.sleep}h sleep` : ''}</div>
                        ${e.stressors&&e.stressors.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${e.stressors.map(s=>`<span style="background:#fef2f2;color:#dc2626;font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;border:1px solid #fecaca">${s}</span>`).join('')}</div>` : ''}
                        ${e.win ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:7px 10px;margin-bottom:5px;font-size:12px;color:#78350f"><span style="font-weight:700">⭐ Win:</span> ${e.win}</div>` : ''}
                        ${e.notes ? `<div style="font-size:12px;color:#475569;font-style:italic">${e.notes}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <button onclick="openWellnessModal('${e.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#f1f5f9;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center;border:1px solid #e2e8f0">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onclick="deleteWellness('${e.id}')" style="width:26px;height:26px;padding:0;margin:0;background:#fef2f2;border-radius:7px;box-shadow:none;display:flex;align-items:center;justify-content:center;border:1px solid #fecaca">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    let mainEl = document.getElementById('ws-wellness');
    if (!mainEl) return;
    mainEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
            <div style="font-size:18px;font-weight:800;color:#1e1b4b">Wellness Check-in 💆</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">Track how you're doing — mind, body, burnout</div>
        </div>
        <button onclick="openWellnessModal()" style="background:linear-gradient(135deg,#ec4899,#8b5cf6);color:white;font-size:12px;font-weight:700;padding:9px 16px;border-radius:12px;border:none;box-shadow:0 4px 12px rgba(139,92,246,0.3)">+ Check In</button>
    </div>
    ${statsHtml}
    ${chartHtml}
    ${stressorHtml}
    ${winsHtml}
    <div id="wellnessList">${histHtml}</div>`;

    // Draw chart if enough data
    if (entries.length >= 3) {
        setTimeout(() => {
            let canvas = document.getElementById('wellnessChart');
            if (!canvas) return;
            if (wellnessChartInst) { wellnessChartInst.destroy(); wellnessChartInst = null; }
            let recent = [...entries].reverse().slice(-30); // oldest first, max 30
            wellnessChartInst = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: recent.map(e => e.date.slice(5)),
                    datasets: [{
                        label: 'Wellbeing',
                        data: recent.map(e => e.wellbeing),
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139,92,246,0.08)',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: recent.map(e => wbColor(e.wellbeing)),
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => WELLBEING_LABELS[ctx.raw] || ctx.raw+'/10' } } },
                    scales: {
                        y: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 10 } }, grid: { color: '#f1f5f9' } },
                        x: { ticks: { font: { size: 9 }, maxRotation: 45 }, grid: { display: false } }
                    }
                }
            });
        }, 50);
    }
}

// ── OKAP / ITE Question Bank ──────────────────────────────────────────────────
const QB_ATTEMPTS_KEY  = 'eyeQBankAttempts';
const QB_BOOKMARKS_KEY = 'eyeQBankBookmarks';

function getQBAttempts()   { return JSON.parse(localStorage.getItem(QB_ATTEMPTS_KEY)||'[]'); }
function saveQBAttempts(a) { localStorage.setItem(QB_ATTEMPTS_KEY, JSON.stringify(a)); }
function getQBBookmarks()  { return JSON.parse(localStorage.getItem(QB_BOOKMARKS_KEY)||'[]'); }
function saveQBBookmarks(b){ localStorage.setItem(QB_BOOKMARKS_KEY, JSON.stringify(b)); }

const QB_SUBJECTS = {
    optics:'Optics & Refraction', cataract:'Cataract & Lens',
    cornea:'Cornea & External Disease', glaucoma:'Glaucoma',
    retina:'Retina & Vitreous', oculoplastics:'Oculoplastics & Orbit',
    pediatrics:'Pediatric & Strabismus', neuro:'Neuro-Ophthalmology',
    uveitis:'Uveitis', basic:'Basic Science'
};

const QB_COLORS = {
    optics:'#7c3aed', cataract:'#2563eb', cornea:'#0891b2', glaucoma:'#059669',
    retina:'#dc2626', oculoplastics:'#d97706', pediatrics:'#ea580c',
    neuro:'#0f172a', uveitis:'#be185d', basic:'#64748b'
};

let qbMode    = 'study';
let qbCount   = 10;
let qbQueue   = [];
let qbCurrent = 0;
let qbAnswers = {};
let qbRevealed = {};

function openQbankModal() {
    selectQMode('study');
    selectQCount(10);
    document.getElementById('qbankModal').style.display = 'flex';
}
function closeQbankModal() {
    document.getElementById('qbankModal').style.display = 'none';
}
function selectQMode(mode) {
    qbMode = mode;
    ['study','quiz'].forEach(m => {
        let btn = document.getElementById('qmode-'+m);
        if (!btn) return;
        btn.style.background  = m===mode ? '#eff6ff' : '#f8fafc';
        btn.style.color       = m===mode ? '#2563eb' : '#64748b';
        btn.style.borderColor = m===mode ? '#2563eb' : '#e2e8f0';
    });
}
function selectQCount(n) {
    qbCount = n;
    [10,20,40,999].forEach(c => {
        let btn = document.getElementById('qcount-'+(c===999?'all':c));
        if (!btn) return;
        btn.style.background  = c===n ? '#eff6ff' : '#f8fafc';
        btn.style.color       = c===n ? '#2563eb' : '#64748b';
        btn.style.borderColor = c===n ? '#2563eb' : '#e2e8f0';
    });
}

function _buildQueue(subject) {
    let all = typeof EYELOG_QUESTIONS !== 'undefined' ? EYELOG_QUESTIONS : [];
    let attempts  = getQBAttempts();
    let bookmarks = getQBBookmarks();
    let wrongIds  = new Set(attempts.filter(a=>!a.correct).map(a=>a.qid));

    let pool;
    if (subject === 'all')       pool = all;
    else if (subject === 'weak') {
        let iteScores = typeof getIteScores === 'function' ? getIteScores() : [];
        let weakSubjects = new Set();
        if (iteScores.length) {
            let latest = iteScores[0];
            if (latest.subjects) {
                Object.entries(latest.subjects).forEach(([s,pct]) => { if (pct < 50) weakSubjects.add(s); });
            }
        }
        pool = weakSubjects.size ? all.filter(q => weakSubjects.has(q.subject)) : all;
        if (!pool.length) pool = all;
    }
    else if (subject === 'bookmarks') pool = all.filter(q => bookmarks.includes(q.id));
    else if (subject === 'wrong')     pool = all.filter(q => wrongIds.has(q.id));
    else pool = all.filter(q => q.subject === subject);

    if (!pool.length) pool = all;
    let shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, qbCount === 999 ? shuffled.length : qbCount);
}

function beginQbankQuiz() {
    let subject = document.getElementById('qbSubject').value;
    qbQueue   = _buildQueue(subject);
    qbCurrent = 0;
    qbAnswers = {};
    qbRevealed = {};
    closeQbankModal();
    if (!qbQueue.length) { showToast('No questions found for that filter', 'warning'); return; }
    document.getElementById('qbankHome').style.display  = 'none';
    document.getElementById('qbankQuiz').style.display  = 'block';
    renderQbankQuestion();
}

function renderQbankQuestion() {
    let el = document.getElementById('qbankQuiz');
    if (!el) return;
    if (qbCurrent >= qbQueue.length) { renderQbankResults(); return; }

    let q         = qbQueue[qbCurrent];
    let bookmarks = getQBBookmarks();
    let isBookmarked = bookmarks.includes(q.id);
    let selected  = qbAnswers[q.id];
    let revealed  = qbRevealed[q.id];
    let col       = QB_COLORS[q.subject] || '#2563eb';
    let subLabel  = QB_SUBJECTS[q.subject] || q.subject;
    let progress  = Math.round((qbCurrent/qbQueue.length)*100);

    let optionsHtml = q.options.map(opt => {
        let letter = opt[0];
        let isSelected = selected === letter;
        let isCorrect  = letter === q.correct;
        let bg = '#f8fafc', border = '#e2e8f0', textCol = '#374151';
        if (revealed) {
            if (isCorrect)               { bg='#f0fdf4'; border='#86efac'; textCol='#166534'; }
            else if (isSelected)         { bg='#fef2f2'; border='#fca5a5'; textCol='#991b1b'; }
        } else if (isSelected) {
            bg='#eff6ff'; border='#93c5fd'; textCol='#1e40af';
        }
        return `<button onclick="selectQBAnswer('${letter}')" style="width:100%;margin:0 0 8px;padding:12px 14px;border-radius:12px;border:2px solid ${border};background:${bg};color:${textCol};font-size:13px;font-weight:600;text-align:left;box-shadow:none;display:block;line-height:1.4">
            <span style="font-weight:800;margin-right:6px">${letter}.</span>${opt.slice(3)}
            ${revealed && isCorrect ? ' <span style="float:right">&#x2713;</span>' : ''}
            ${revealed && isSelected && !isCorrect ? ' <span style="float:right">&#x2717;</span>' : ''}
        </button>`;
    }).join('');

    let explanationHtml = revealed ? `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:14px;margin-top:12px">
        <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Explanation</div>
        <div style="font-size:13px;color:#166534;line-height:1.6">${q.explanation}</div>
        ${q.reference ? `<div style="font-size:11px;color:#16a34a;margin-top:6px;font-weight:600">&#x1F4DA; ${q.reference}</div>` : ''}
    </div>` : '';

    let actionBtn = '';
    if (qbMode === 'study') {
        if (!revealed && selected) {
            actionBtn = `<button onclick="revealQBAnswer()" style="width:100%;margin:12px 0 0;background:#0f172a;font-size:13px;font-weight:700;padding:13px;border-radius:12px">Check Answer</button>`;
        } else if (revealed) {
            actionBtn = qbCurrent < qbQueue.length-1
                ? `<button onclick="nextQBQuestion()" style="width:100%;margin:12px 0 0;background:#2563eb;font-size:13px;font-weight:700;padding:13px;border-radius:12px">Next Question &#x2192;</button>`
                : `<button onclick="renderQbankResults()" style="width:100%;margin:12px 0 0;background:#16a34a;font-size:13px;font-weight:700;padding:13px;border-radius:12px">See Results &#x1F389;</button>`;
        }
    } else {
        actionBtn = qbCurrent < qbQueue.length-1
            ? `<button onclick="nextQBQuestion()" ${!selected?'disabled style="opacity:0.4;cursor:not-allowed;"':''} style="width:100%;margin:12px 0 0;background:#2563eb;font-size:13px;font-weight:700;padding:13px;border-radius:12px">Next &#x2192;</button>`
            : `<button onclick="renderQbankResults()" ${!selected?'disabled style="opacity:0.4;cursor:not-allowed;"':''} style="width:100%;margin:12px 0 0;background:#16a34a;font-size:13px;font-weight:700;padding:13px;border-radius:12px">Finish &amp; Review &#x1F389;</button>`;
    }

    el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <button onclick="exitQBQuiz()" style="width:32px;height:32px;border-radius:10px;background:#f1f5f9;border:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin:0;padding:0;box-shadow:none;color:#374151">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style="flex:1">
            <div style="background:#e2e8f0;border-radius:4px;height:4px;overflow:hidden">
                <div style="background:${col};height:100%;width:${progress}%;transition:width 0.3s;border-radius:4px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px">
                <span style="font-size:10px;font-weight:700;color:${col}">${subLabel}</span>
                <span style="font-size:10px;color:#94a3b8">${qbCurrent+1} / ${qbQueue.length}</span>
            </div>
        </div>
        <button onclick="toggleQBBookmark('${q.id}')" style="width:32px;height:32px;border-radius:10px;background:${isBookmarked?'#fef9c3':'#f1f5f9'};border:1.5px solid ${isBookmarked?'#fde68a':'#e2e8f0'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin:0;padding:0;box-shadow:none;font-size:16px">&#x1F516;</button>
    </div>
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:16px;padding:18px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;color:#374151;line-height:1.6">${q.stem}</div>
    </div>
    ${optionsHtml}
    ${explanationHtml}
    ${actionBtn}`;
}

function selectQBAnswer(letter) {
    let q = qbQueue[qbCurrent];
    if (!q) return;
    if (qbMode === 'study' && qbRevealed[q.id]) return;
    qbAnswers[q.id] = letter;
    renderQbankQuestion();
}

function revealQBAnswer() {
    let q = qbQueue[qbCurrent];
    if (!q) return;
    qbRevealed[q.id] = true;
    let attempts = getQBAttempts();
    let correct = qbAnswers[q.id] === q.correct;
    attempts.push({ qid: q.id, subject: q.subject, answer: qbAnswers[q.id], correct, date: getTodayStr() });
    saveQBAttempts(attempts);
    renderQbankQuestion();
}

function nextQBQuestion() {
    let q = qbQueue[qbCurrent];
    if (qbMode === 'quiz' && q && qbAnswers[q.id]) {
        let attempts = getQBAttempts();
        let correct = qbAnswers[q.id] === q.correct;
        attempts.push({ qid: q.id, subject: q.subject, answer: qbAnswers[q.id], correct, date: getTodayStr() });
        saveQBAttempts(attempts);
    }
    qbCurrent++;
    renderQbankQuestion();
}

function toggleQBBookmark(qid) {
    let bookmarks = getQBBookmarks();
    let i = bookmarks.indexOf(qid);
    if (i >= 0) bookmarks.splice(i,1); else bookmarks.push(qid);
    saveQBBookmarks(bookmarks);
    renderQbankQuestion();
    showToast(i >= 0 ? 'Bookmark removed' : 'Bookmarked!');
}

function exitQBQuiz() {
    qbQueue = []; qbAnswers = {}; qbRevealed = {};
    document.getElementById('qbankQuiz').style.display = 'none';
    document.getElementById('qbankHome').style.display = 'block';
    renderQbankHome();
}

function renderQbankResults() {
    let total   = qbQueue.length;
    let correct = qbQueue.filter(q => qbAnswers[q.id] === q.correct).length;
    let pct     = total ? Math.round(correct/total*100) : 0;
    let col     = pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
    let emoji   = pct >= 80 ? '&#x1F3C6;' : pct >= 60 ? '&#x1F44D;' : pct >= 40 ? '&#x1F4AA;' : '&#x1F4DA;';

    let bySubject = {};
    qbQueue.forEach(q => {
        if (!bySubject[q.subject]) bySubject[q.subject] = { correct:0, total:0 };
        bySubject[q.subject].total++;
        if (qbAnswers[q.id] === q.correct) bySubject[q.subject].correct++;
    });

    let subjectRows = Object.entries(bySubject).map(([s,v]) => {
        let sp = Math.round(v.correct/v.total*100);
        let sc = sp>=70?'#16a34a':sp>=50?'#d97706':'#dc2626';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="font-size:12px;font-weight:600;color:#374151;width:140px;flex-shrink:0">${QB_SUBJECTS[s]||s}</div>
            <div style="flex:1;background:#f1f5f9;border-radius:4px;height:6px;overflow:hidden">
                <div style="background:${sc};width:${sp}%;height:100%;border-radius:4px"></div>
            </div>
            <div style="font-size:11px;font-weight:700;color:${sc};min-width:40px;text-align:right">${v.correct}/${v.total}</div>
        </div>`;
    }).join('');

    let reviewHtml = qbQueue.map(q => {
        let ans    = qbAnswers[q.id];
        let isOk   = ans === q.correct;
        let corOpt = q.options.find(o=>o[0]===q.correct);
        return `<div style="background:white;border:1.5px solid ${isOk?'#86efac':'#fca5a5'};border-radius:12px;padding:12px 14px;margin-bottom:8px">
            <div style="display:flex;align-items:flex-start;gap:8px">
                <div style="font-size:16px;flex-shrink:0">${isOk?'&#x2705;':'&#x274C;'}</div>
                <div style="flex:1">
                    <div style="font-size:12px;font-weight:600;color:#374151;line-height:1.5;margin-bottom:6px">${q.stem.slice(0,120)}${q.stem.length>120?'&hellip;':''}</div>
                    ${!isOk ? `<div style="font-size:11px;color:#dc2626">Your answer: <strong>${ans||'&mdash;'}</strong></div>` : ''}
                    <div style="font-size:11px;color:#16a34a">Correct: <strong>${q.correct}. ${corOpt?corOpt.slice(3):''}</strong></div>
                </div>
            </div>
        </div>`;
    }).join('');

    let el = document.getElementById('qbankQuiz');
    el.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:56px;margin-bottom:8px">${emoji}</div>
        <div style="font-size:36px;font-weight:900;color:${col}">${pct}%</div>
        <div style="font-size:14px;color:#64748b">${correct} of ${total} correct</div>
    </div>
    ${Object.keys(bySubject).length > 1 ? `
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">By Subject</div>
        ${subjectRows}
    </div>` : ''}
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Review Answers</div>
        ${reviewHtml}
    </div>
    <button onclick="exitQBQuiz()" style="width:100%;margin:0;background:#0f172a;font-size:13px;font-weight:700;padding:14px;border-radius:14px">Back to Question Bank</button>`;
}

function renderQbankHome() {
    let el = document.getElementById('qbankHome');
    if (!el) return;
    let all       = typeof EYELOG_QUESTIONS !== 'undefined' ? EYELOG_QUESTIONS : [];
    let attempts  = getQBAttempts();
    let bookmarks = getQBBookmarks();

    let totalAttempted = new Set(attempts.map(a=>a.qid)).size;
    let totalCorrect   = attempts.filter(a=>a.correct).length;
    let totalAttempts  = attempts.length;
    let pct            = totalAttempts ? Math.round(totalCorrect/totalAttempts*100) : 0;
    let pctCol         = pct>=70?'#16a34a':pct>=50?'#d97706':'#dc2626';

    let subjectStats = {};
    Object.keys(QB_SUBJECTS).forEach(s => {
        let qCount      = all.filter(q=>q.subject===s).length;
        let subAttempts = attempts.filter(a=>a.subject===s);
        let subCorrect  = subAttempts.filter(a=>a.correct).length;
        subjectStats[s] = { total: qCount, attempted: new Set(subAttempts.map(a=>a.qid)).size, correct: subCorrect, attempts: subAttempts.length };
    });

    let subjectGrid = Object.entries(QB_SUBJECTS).map(([s,label]) => {
        let st  = subjectStats[s];
        let sp  = st.attempts ? Math.round(st.correct/st.attempts*100) : null;
        let col = QB_COLORS[s] || '#64748b';
        return `<div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;cursor:pointer" onclick="document.getElementById('qbSubject').value='${s}';openQbankModal()">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:${col}">${label}</div>
                ${sp!==null ? `<div style="font-size:11px;font-weight:800;color:${sp>=70?'#16a34a':sp>=50?'#d97706':'#dc2626'}">${sp}%</div>` : ''}
            </div>
            <div style="background:#f1f5f9;border-radius:4px;height:4px;overflow:hidden;margin-bottom:6px">
                <div style="background:${col};width:${st.total?Math.round(st.attempted/st.total*100):0}%;height:100%;border-radius:4px"></div>
            </div>
            <div style="font-size:10px;color:#94a3b8">${st.attempted}/${st.total} attempted</div>
        </div>`;
    }).join('');

    el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
            <div style="font-size:18px;font-weight:800;color:#1e1b4b">OKAP Question Bank</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px">${all.length} questions &middot; BCSC-aligned</div>
        </div>
        <button onclick="openQbankModal()" style="width:auto;margin:0;padding:10px 16px;font-size:12px;font-weight:700;border-radius:12px;background:#0f172a;color:white">Start Quiz &#x2192;</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
        ${[
            { label:'Questions', val:all.length, col:'#2563eb' },
            { label:'Attempted', val:totalAttempted, col:'#7c3aed' },
            { label:'Avg Score', val:totalAttempts?pct+'%':'&mdash;', col:pctCol },
        ].map(s=>`<div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:900;color:${s.col}">${s.val}</div>
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;margin-top:2px">${s.label}</div>
        </div>`).join('')}
    </div>
    ${bookmarks.length ? `<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="document.getElementById('qbSubject').value='bookmarks';openQbankModal()">
        <div style="font-size:13px;font-weight:700;color:#92400e">&#x1F516; ${bookmarks.length} Bookmarked Questions</div>
        <div style="font-size:12px;color:#d97706">Review &#x2192;</div>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
        ${subjectGrid}
    </div>
    <button onclick="document.getElementById('qbSubject').value='wrong';openQbankModal()" style="width:100%;margin:0;background:#fef2f2;color:#dc2626;border:1.5px solid #fecaca;font-size:12px;font-weight:700;padding:12px;border-radius:12px;box-shadow:none">&#x274C; Review Wrong Answers</button>`;
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js');
    });
}