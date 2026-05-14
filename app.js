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
    document.getElementById('milestoneBadge').textContent  = '🏅 ' + m.badge;
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
    let today     = new Date().toISOString().slice(0, 10);
    let yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
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
        banner.textContent = '🔥 ' + streak + ' day streak! Keep logging cases!';
    } else {
        banner.style.display = 'none';
    }
}

// Profile
function saveProfile() {
    let profile = {
        name:      document.getElementById('profileNameInput').value,
        pgy:       document.getElementById('profilePgyInput').value,
        program:   document.getElementById('profileProgramInput').value,
        startYear: document.getElementById('profileStartYear').value,
        endYear:   document.getElementById('profileEndYear').value,
        goals:     document.getElementById('profileGoals').value
    };
    localStorage.setItem('userProfile', JSON.stringify(profile));
    localStorage.setItem('residentName', profile.name);
    updateProfileDisplay();
    showToast('✅ Profile saved!');
}

function loadProfile() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    if (profile.name)      document.getElementById('profileNameInput').value    = profile.name;
    if (profile.pgy)       document.getElementById('profilePgyInput').value     = profile.pgy;
    if (profile.program)   document.getElementById('profileProgramInput').value = profile.program;
    if (profile.startYear) document.getElementById('profileStartYear').value    = profile.startYear;
    if (profile.endYear)   document.getElementById('profileEndYear').value      = profile.endYear;
    if (profile.goals)     document.getElementById('profileGoals').value        = profile.goals;
    updateProfileDisplay();
}

function updateProfileDisplay() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    let nameEl  = document.getElementById('profileName');
    let pgyEl   = document.getElementById('profilePgy');
    let progEl  = document.getElementById('profileProgram');
    if (nameEl) nameEl.textContent = profile.name ? 'Dr. ' + profile.name : 'Dr. Resident';
    if (pgyEl)  pgyEl.textContent  = profile.pgy  || 'PGY-1';
    if (progEl) progEl.textContent = (profile.program || 'Ophthalmology Program') + ' — Ophthalmology';
    let goalsEl = document.getElementById('profileGoalsDisplay');
    if (goalsEl) {
        goalsEl.innerHTML = profile.goals
            ? '<p style="color:#1e293b; font-size:14px; line-height:1.7">' + profile.goals + '</p>'
            : '<p style="color:#94a3b8; font-size:14px">No goals set yet — add them above!</p>';
    }
    if (profile.startYear && profile.endYear) {
        let now   = new Date().getFullYear();
        let total = profile.endYear - profile.startYear;
        let done  = now - profile.startYear;
        let pct   = Math.min(Math.round((done / total) * 100), 100);
        let statsEl = document.getElementById('profileStats');
        if (statsEl) {
            statsEl.innerHTML =
                '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">📅</div><h3>' + profile.startYear + '</h3><p>Start Year</p></div>' +
                '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">🎓</div><h3>' + profile.endYear + '</h3><p>End Year</p></div>' +
                '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">⏳</div><h3>' + pct + '%</h3><p>Residency Done</p></div>';
        }
    }
    let welcomeEl = document.getElementById('welcomeName');
    if (welcomeEl && profile.name) {
        let parts    = profile.name.trim().split(' ');
        let lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        welcomeEl.textContent = 'Dr. ' + lastName;
    }
}

// Templates
function loadTemplates() {
    let templates = JSON.parse(localStorage.getItem('caseTemplates')) || [];
    let html = '';
    for (let i = 0; i < templates.length; i++) {
        html += '<button onclick="applyTemplate(' + i + ')" style="background:#f1f5f9; color:#1e293b; border:2px solid #e2e8f0; padding:8px 14px; font-size:12px; width:auto; margin:0; border-radius:8px">';
        html += '⚡ ' + templates[i].procedure + ' — ' + templates[i].role;
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
    showToast('📋 Template saved!');
}

function applyTemplate(index) {
    let t = JSON.parse(localStorage.getItem('caseTemplates'))[index];
    document.getElementById('procedure').value    = t.procedure;
    document.getElementById('role').value         = t.role;
    document.getElementById('pgyYear').value      = t.pgy_year;
    document.getElementById('residentName').value = t.resident_name;
    document.getElementById('attending').value    = t.attending;
    document.getElementById('hospital').value     = t.hospital;
    showToast('⚡ Template applied!');
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
        date:          new Date().toISOString().slice(0, 10),
        notes:         c.notes,
        resident_name: c.resident_name,
        pgy_year:      c.pgy_year,
        attending:     c.attending,
        hospital:      c.hospital,
        user_id:       user.id
    });
    hideLoading();
    if (error) { showToast('Error: ' + error.message, 'error'); }
    else { loadCases(); showToast('🔄 Case duplicated!'); }
}

// Tab navigation
function showTab(tab, e) {
    document.getElementById('dashboard').style.display    = 'none';
    document.getElementById('logCase').style.display      = 'none';
    document.getElementById('caseListTab').style.display  = 'none';
    document.getElementById('analyticsTab').style.display = 'none';
    document.getElementById('profileTab').style.display   = 'none';
    document.getElementById('helpTab').style.display      = 'none';
    document.getElementById('adminPanel').style.display   = 'none';
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
        if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    } else if (tab === 'caseList') {
        document.getElementById('caseListTab').style.display = 'block';
        displayCaseList(allCases);
    } else if (tab === 'analytics') {
        document.getElementById('analyticsTab').style.display = 'block';
        showAnalytics();
    } else if (tab === 'profile') {
        document.getElementById('profileTab').style.display = 'block';
        loadProfile();
        loadProfileEmail();
        loadProfileCaseStats();
        updateNotifStatus();
    } else if (tab === 'journal') {
        document.getElementById('journalTab').style.display = 'block';
        renderJournalList();
    } else if (tab === 'help') {
        document.getElementById('helpTab').style.display = 'block';
    } else if (tab === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminData();
    }

    if (e && e.target && e.target.classList.contains('tab-btn')) {
        e.target.classList.add('active-tab');
    }
    const navMap = { dashboard: 'nav-dashboard', logCase: 'nav-logCase', caseList: 'nav-caseList', analytics: 'nav-analytics', journal: 'nav-journal', help: 'nav-help' };
    if (navMap[tab]) setActiveNav(navMap[tab]);
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
    let total    = allCases.length;
    let totalReq = Object.values(acgme).reduce((a,b)=>a+b,0);
    let pct      = Math.min(Math.round((total/totalReq)*100),100);
    let streak   = localStorage.getItem('streak') || 0;
    let statsEl  = document.getElementById('profileStats');
    if (statsEl) {
        statsEl.innerHTML =
            '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">📋</div><h3>' + total + '</h3><p>Total Cases</p></div>' +
            '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">🏆</div><h3>' + pct + '%</h3><p>ACGME Done</p></div>' +
            '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">🔥</div><h3>' + streak + '</h3><p>Day Streak</p></div>';
    }
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
async function signUp() {
    let email    = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let fullName = document.getElementById('fullName').value;
    if (!fullName) { showToast('⚠️ Please enter your full name', 'warning'); return; }
    if (!email || !password) { showToast('⚠️ Enter email and password', 'warning'); return; }
    if (password.length < 6) { showToast('⚠️ Password must be at least 6 characters', 'warning'); return; }
    showLoading();
    let { data, error } = await db.auth.signUp({ email, password });
    if (error) { hideLoading(); showToast(error.message, 'error'); return; }
    if (data.user) {
        await db.from('profiles').upsert({
            id:        data.user.id,
            email:     email,
            full_name: fullName,
            role:      'resident',
            status:    'pending'
        });
    }
    hideLoading();
    showPendingScreen(fullName);
}

function showPendingScreen(name) {
    document.getElementById('loginSection').style.display   = 'none';
    document.getElementById('appSection').style.display     = 'none';
    document.getElementById('pendingSection').style.display = 'block';
    let nameEl = document.getElementById('pendingName');
    if (nameEl && name) {
        let parts    = name.trim().split(' ');
        let lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        nameEl.textContent = 'Dr. ' + lastName;
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
    let { data: profile }  = await db.from('profiles').select('status, role, full_name').eq('id', user.id).single();
    if (!profile || profile.status === 'pending') {
        showPendingScreen(profile ? profile.full_name : '');
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
    let { data: { user } } = await db.auth.getUser();
    let { data: profile }  = await db.from('profiles').select('role, full_name, status').eq('id', user.id).single();
    currentUserRole = profile ? profile.role : 'resident';
    if (currentUserRole === 'admin') {
        document.getElementById('adminTab').style.display = 'inline-block';
        checkPendingUsers();
    }
    let savedProfile = JSON.parse(localStorage.getItem('userProfile')) || {};
    if (savedProfile.name) {
        document.getElementById('residentName').value = savedProfile.name;
    } else if (profile && profile.full_name) {
        document.getElementById('residentName').value = profile.full_name;
        let p = JSON.parse(localStorage.getItem('userProfile')) || {};
        p.name = profile.full_name;
        localStorage.setItem('userProfile', JSON.stringify(p));
    }
    updateProfileDisplay();
    loadCases();
    checkWelcomeGuide();
    if (localStorage.getItem('notificationsEnabled') === 'true') scheduleReminder();
}

db.auth.getSession().then(async ({ data }) => {
    if (data.session) {
        let { data: { user } } = await db.auth.getUser();
        let { data: profile }  = await db.from('profiles').select('status, role').eq('id', user.id).single();
        if (!profile || profile.status === 'pending') {
            showPendingScreen('');
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
        let { error } = await db.from('cases').insert({
            procedure:     document.getElementById('procedure').value,
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
}

async function deleteCase(id) {
    if (!confirm('Delete this case?')) return;
    showLoading();
    await db.from('cases').delete().eq('id', id);
    hideLoading();
    loadCases();
    showToast('🗑️ Case deleted', 'warning');
}

async function checkPendingUsers() {
    if (currentUserRole !== 'admin') return;
    let { data: profiles } = await db.from('profiles').select('status').eq('status', 'pending');
    let count    = profiles ? profiles.length : 0;
    let adminTab = document.getElementById('adminTab');
    if (adminTab && count > 0) {
        adminTab.innerHTML = '👨‍⚕️ PD Panel <span style="background:#dc2626; color:white; border-radius:50%; padding:2px 7px; font-size:11px; margin-left:4px">' + count + '</span>';
        showToast('⚠️ ' + count + ' new user(s) pending approval!', 'warning');
    }
}

async function loadAdminData() {
    showLoading();
    let { data: cases }    = await db.from('cases').select('*');
    let { data: profiles } = await db.from('profiles').select('*');
    hideLoading();

    let pending = profiles ? profiles.filter(p => p.status === 'pending') : [];
    let html = '<h2>👨‍⚕️ Program Director Panel</h2>';

    if (pending.length > 0) {
        html += '<div style="background:#fff7ed; border:2px solid #f97316; border-radius:14px; padding:16px; margin-bottom:20px">';
        html += '<h3 style="color:#ea580c; margin-bottom:12px">⏳ Pending Approval (' + pending.length + ')</h3>';
        for (let p of pending) {
            html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #fed7aa">';
            html += '<div><strong>' + (p.full_name || 'Unknown') + '</strong><br><span style="font-size:12px; color:#64748b">' + p.email + '</span></div>';
            html += '<div style="display:flex; gap:8px">';
            html += '<button onclick="approveUser(\'' + p.id + '\')" style="background:#16a34a; width:auto; padding:8px 16px; font-size:12px; margin:0; border-radius:8px">✅ Approve</button>';
            html += '<button onclick="rejectUser(\'' + p.id + '\')" style="background:#dc2626; width:auto; padding:8px 16px; font-size:12px; margin:0; border-radius:8px">❌ Reject</button>';
            html += '</div></div>';
        }
        html += '</div>';
    } else {
        html += '<div style="background:#f0fdf4; border:2px solid #16a34a; border-radius:14px; padding:16px; margin-bottom:20px; color:#15803d; font-weight:600">✅ No pending requests</div>';
    }

    html += '<h3 style="margin-bottom:12px">✅ Approved Residents</h3>';
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
                    html += '<button onclick="openFeedbackModal(\'' + last.id + '\',\'' + safeInfo + '\')" style="background:#7c3aed; padding:6px 10px; font-size:11px; margin:0; width:auto; border-radius:6px">💬 Feedback</button>';
                }
                html += '</td>';
                html += '</tr>';
            }
        }
    }
    html += '</table>';
    document.getElementById('adminPanel').innerHTML = html;
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
    showToast('🔒 Access revoked', 'warning');
    loadAdminData();
}

function updateDashboard(cases) {
    let thisMonth      = new Date().toISOString().slice(0, 7);
    let monthCases     = cases.filter(c => c.date && c.date.startsWith(thisMonth));
    let totalRequired  = Object.values(acgme).reduce((a, b) => a + b, 0);
    let totalDone      = cases.length;
    let overallPercent = Math.min(Math.round((totalDone / totalRequired) * 100), 100);
    let streak         = localStorage.getItem('streak') || 0;

    let hour     = new Date().getHours();
    let greeting = hour < 12 ? 'GOOD MORNING' : hour < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
    let greetEl  = document.getElementById('greetingText');
    if (greetEl) greetEl.textContent = greeting;
    updateProfileDisplay();
    checkMilestones(overallPercent);
    updateAchievementBadges(overallPercent);

    document.getElementById('summaryCards').innerHTML =
        '<div class="summary-card"><div style="font-size:26px;margin-bottom:4px">📋</div><h3>' + totalDone + '</h3><p>Total Cases</p></div>' +
        '<div class="summary-card"><div style="font-size:26px;margin-bottom:4px">📅</div><h3>' + monthCases.length + '</h3><p>This Month</p></div>' +
        '<div class="summary-card"><div style="font-size:26px;margin-bottom:4px">🎯</div><h3>' + overallPercent + '%</h3><p>ACGME Progress</p></div>' +
        '<div class="summary-card"><div style="font-size:26px;margin-bottom:4px">🔥</div><h3>' + streak + '</h3><p>Day Streak</p></div>';

    let badge = document.getElementById('overallBadge');
    if (badge) badge.textContent = overallPercent + '% Complete';

    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of cases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }

    let procHtml = '';
    for (let p in acgme) {
        let done          = counts[p];
        let req           = acgme[p];
        let percent       = Math.min(Math.round((done / req) * 100), 100);
        let color         = percent >= 100 ? '#16a34a' : percent >= 50 ? '#2563eb' : percent >= 25 ? '#d97706' : '#dc2626';
        let shortName     = p.split('/')[0].trim().split('(')[0].trim();
        let circumference = 2 * Math.PI * 28;
        let dashOffset    = circumference - (percent / 100) * circumference;

        procHtml += `
        <div style="background:#f8fafc; border-radius:14px; padding:14px 10px; text-align:center; border:1px solid #e2e8f0; transition:transform 0.2s, box-shadow 0.2s; cursor:default"
             onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 24px rgba(37,99,235,0.12)'"
             onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
            <svg width="72" height="72" viewBox="0 0 72 72" style="transform:rotate(-90deg)">
                <circle cx="36" cy="36" r="28" fill="none" stroke="#e2e8f0" stroke-width="7"/>
                <circle cx="36" cy="36" r="28" fill="none" stroke="${color}" stroke-width="7"
                    stroke-dasharray="${circumference.toFixed(2)}"
                    stroke-dashoffset="${dashOffset.toFixed(2)}"
                    stroke-linecap="round"/>
            </svg>
            <div style="margin-top:-52px; margin-bottom:36px; font-size:16px; font-weight:900; color:${color}">${percent}%</div>
            <div style="font-size:11px; font-weight:700; color:#0f172a; margin-bottom:3px; line-height:1.3">${shortName}</div>
            <div style="font-size:11px; color:#64748b; font-weight:600">${done} / ${req}</div>
        </div>`;
    }
    document.getElementById('procedureCards').innerHTML = procHtml;

    let roleCounts = { 'Primary': 0, 'Assistant': 0, 'Observer': 0 };
    for (let c of cases) {
        if (c.role === 'Primary Surgeon') roleCounts['Primary']++;
        else if (c.role === 'Assistant')  roleCounts['Assistant']++;
        else if (c.role === 'Observer')   roleCounts['Observer']++;
    }

    if (roleDashChart) { roleDashChart.destroy(); }
    roleDashChart = new Chart(document.getElementById('roleDonut').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(roleCounts),
            datasets: [{ data: Object.values(roleCounts), backgroundColor: ['#2563eb','#16a34a','#d97706'], borderWidth: 0 }]
        },
        options: { responsive: true, cutout: '72%', plugins: { legend: { position: 'bottom' } } }
    });

    let statsHtml = '';
    for (let p in acgme) {
        let done    = counts[p];
        let req     = acgme[p];
        let percent = Math.min(Math.round((done / req) * 100), 100);
        let color   = percent >= 100 ? '#16a34a' : percent >= 50 ? '#2563eb' : '#d97706';
        statsHtml += '<div style="margin-bottom:14px">';
        statsHtml += '<div style="display:flex; justify-content:space-between; margin-bottom:6px">';
        statsHtml += '<span style="font-size:13px; font-weight:600">' + p + '</span>';
        statsHtml += '<span style="font-size:13px; color:#64748b">' + done + ' / ' + req + ' <strong style="color:' + color + '">' + percent + '%</strong></span>';
        statsHtml += '</div>';
        statsHtml += '<div style="background:#f1f5f9; border-radius:99px; height:8px">';
        statsHtml += '<div style="background:' + color + '; width:' + percent + '%; height:8px; border-radius:99px; transition:width 0.8s ease"></div>';
        statsHtml += '</div></div>';
    }
    document.getElementById('stats').innerHTML = statsHtml;
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
                date:          cols[0] || new Date().toISOString().slice(0,10),
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
    let thisMonth  = new Date().toISOString().slice(0, 7);
    let monthCount = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let primary    = allCases.filter(c => c.role === 'Primary Surgeon').length;
    let primaryPct = total > 0 ? Math.round((primary / total) * 100) : 0;

    document.getElementById('analyticsSummary').innerHTML =
        '<div class="summary-card"><h3>' + total + '</h3><p>Total Cases</p></div>' +
        '<div class="summary-card"><h3>' + monthCount + '</h3><p>This Month</p></div>' +
        '<div class="summary-card"><h3>' + primaryPct + '%</h3><p>As Primary Surgeon</p></div>';

    let months = [], monthlyCounts = [];
    for (let i = 5; i >= 0; i--) {
        let d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('default', { month: 'short' }));
        monthlyCounts.push(allCases.filter(c => c.date && c.date.startsWith(d.toISOString().slice(0,7))).length);
    }

    if (monthlyChart) { monthlyChart.destroy(); }
    monthlyChart = new Chart(document.getElementById('monthlyChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{ label: 'Cases', data: monthlyCounts, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.08)', borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: '#2563eb', pointRadius: 5 }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }
    });

    let roleCounts = { 'Primary Surgeon': 0, 'Assistant': 0, 'Observer': 0 };
    for (let c of allCases) { if (roleCounts[c.role] !== undefined) { roleCounts[c.role]++; } }

    if (roleChart) { roleChart.destroy(); }
    roleChart = new Chart(document.getElementById('roleChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(roleCounts), datasets: [{ data: Object.values(roleCounts), backgroundColor: ['#2563eb','#16a34a','#d97706'] }] },
        options: { responsive: true }
    });

    let dayCounts = [0,0,0,0,0,0,0];
    for (let c of allCases) { if (c.date) { dayCounts[new Date(c.date).getDay()]++; } }

    if (dayChart) { dayChart.destroy(); }
    dayChart = new Chart(document.getElementById('dayChart').getContext('2d'), {
        type: 'bar',
        data: { labels: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], datasets: [{ label: 'Cases', data: dayCounts, backgroundColor: '#8C1515', borderRadius: 6 }] },
        options: { responsive: true, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } } }
    });

    let monthCases = allCases.filter(c => c.date && c.date.startsWith(thisMonth));
    let procCounts = {};
    for (let c of monthCases) { procCounts[c.procedure] = (procCounts[c.procedure] || 0) + 1; }
    let sorted = Object.entries(procCounts).sort((a, b) => b[1] - a[1]);
    let html = sorted.length === 0 ? '<p style="color:#94a3b8">No cases this month yet.</p>' : '';
    for (let [proc, count] of sorted) {
        let pct = Math.round((count / monthCases.length) * 100);
        html += '<div style="margin-bottom:12px"><p style="font-size:14px; font-weight:600; margin-bottom:4px">' + proc + ' — ' + count + ' (' + pct + '%)</p>';
        html += '<div style="background:#e2e8f0; border-radius:99px; height:8px"><div style="background:#2563eb; width:' + pct + '%; height:8px; border-radius:99px"></div></div></div>';
    }
    document.getElementById('topProcedures').innerHTML = html;

    showProjections();
    showAttendingBreakdown();
    showYearComparison();
    generateInsights();
    showComplexityChart();
    showProcedureCalendar();
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
        html += `<div style="margin-bottom:12px">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                <span style="font-size:13px; font-weight:600; color:#0f172a">👨‍⚕️ ${name}</span>
                <span style="font-size:13px; color:#64748b; font-weight:600">${count} case${count !== 1 ? 's' : ''}</span>
            </div>
            <div style="background:#f1f5f9; border-radius:99px; height:7px">
                <div style="background:#7c3aed; width:${pct}%; height:7px; border-radius:99px"></div>
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
    showToast('📄 Analytics PDF exported!');
}

function displayCaseList(cases) {
    let countEl = document.getElementById('caseCount');
    if (countEl) countEl.textContent = cases.length + ' case' + (cases.length !== 1 ? 's' : '') + ' found';

    if (cases.length === 0) {
        document.getElementById('caseList').innerHTML =
            '<div style="text-align:center; padding:60px 20px; color:#94a3b8">' +
            '<div style="font-size:48px; margin-bottom:16px">📋</div>' +
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
                                <span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px">📅 ${dateStr}</span>
                                ${c.pgy_year ? `<span style="background:#f1f5f9; color:#64748b; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px">${c.pgy_year}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0">
                        <button onclick="openEditModal('${c.id}')" style="background:#2563eb18; color:#2563eb; padding:7px 10px; font-size:13px; margin:0; width:auto; border-radius:8px; font-weight:600">✏️</button>
                        <button onclick="duplicateCase('${c.id}')" style="background:#7c3aed18; color:#7c3aed; padding:7px 10px; font-size:13px; margin:0; width:auto; border-radius:8px; font-weight:600">🔄</button>
                        <button onclick="deleteCase('${c.id}')" style="background:#dc262618; color:#dc2626; padding:7px 10px; font-size:13px; margin:0; width:auto; border-radius:8px; font-weight:600">🗑️</button>
                    </div>
                </div>
                <div style="display:flex; gap:16px; flex-wrap:wrap; border-top:1px solid #f1f5f9; padding-top:10px">
                    ${c.attending ? `<span style="font-size:12px; color:#64748b">👨‍⚕️ <strong>${c.attending}</strong></span>` : ''}
                    ${c.hospital  ? `<span style="font-size:12px; color:#64748b">🏥 <strong>${c.hospital}</strong></span>` : ''}
                    ${c.notes     ? `<span style="font-size:12px; color:#64748b; flex:1">📝 ${stripComplexity(c.notes)}</span>` : ''}
                    ${parseComplexity(c.notes) !== 'Routine' ? `<span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; background:${parseComplexity(c.notes)==='Challenging'?'#fef2f2':'#fefce8'}; color:${parseComplexity(c.notes)==='Challenging'?'#dc2626':'#ca8a04'}">${parseComplexity(c.notes)==='Challenging'?'🔴':'🟡'} ${parseComplexity(c.notes)}</span>` : ''}
                </div>
            </div>
        </div>`;
    }
    html += '</div>';
    document.getElementById('caseList').innerHTML = html;
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

    displayCaseList(filtered);
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
    let thisMonth  = new Date().toISOString().slice(0,7);
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
    showToast('📄 PDF exported!');
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
    showToast('📅 Monthly report exported!');
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
        el.textContent = '🔔 Not enabled — tap Enable to get daily case reminders.';
        el.style.color = '';
    }
}

async function setupNotifications() {
    if (!('Notification' in window)) { showToast('Notifications not supported', 'error'); return; }
    let permission = await Notification.requestPermission();
    if (permission === 'granted') {
        localStorage.setItem('notificationsEnabled', 'true');
        showToast('🔔 Daily reminders enabled!');
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
    insights.push({ icon:'💪', color:'#16a34a', bg:'#f0fdf4', text:'Your strongest area is <strong>'+strongest[0].split('/')[0].trim()+'</strong> ('+strongPct+'% of ACGME goal). Keep it up!' });
    if (weakest[1] === 0) {
        insights.push({ icon:'⚠️', color:'#dc2626', bg:'#fef2f2', text:'You have <strong>zero</strong> '+weakest[0].split('/')[0].trim()+' cases logged. This is your biggest gap — prioritize it next.' });
    } else {
        insights.push({ icon:'🎯', color:'#d97706', bg:'#fffbeb', text:'Focus on <strong>'+weakest[0].split('/')[0].trim()+'</strong> — only '+weakPct+'% complete. Consider requesting more of these cases.' });
    }

    let thisMonth = now.toISOString().slice(0,7);
    let lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    let thisMo = allCases.filter(c => c.date && c.date.startsWith(thisMonth)).length;
    let lastMo = allCases.filter(c => c.date && c.date.startsWith(lastMonth)).length;
    if (lastMo > 0) {
        let trend = thisMo - lastMo;
        if (trend > 0) insights.push({ icon:'📈', color:'#2563eb', bg:'#eff6ff', text:'You logged <strong>'+trend+' more</strong> case'+(trend>1?'s':'')+' this month than last — great momentum! 🔥' });
        else if (trend < 0) insights.push({ icon:'📉', color:'#d97706', bg:'#fffbeb', text:'Case volume dropped by <strong>'+Math.abs(trend)+'</strong> this month vs last. Try to schedule more OR time.' });
        else insights.push({ icon:'〽️', color:'#64748b', bg:'#f8fafc', text:'Consistent pace — same number of cases as last month. Can you push for more?' });
    }

    let primaryPct = Math.round((allCases.filter(c=>c.role==='Primary Surgeon').length / allCases.length)*100);
    if (primaryPct < 30) insights.push({ icon:'🏥', color:'#dc2626', bg:'#fef2f2', text:'Only <strong>'+primaryPct+'%</strong> of your cases are as Primary Surgeon. Push to operate more independently.' });
    else if (primaryPct >= 60) insights.push({ icon:'⭐', color:'#16a34a', bg:'#f0fdf4', text:'<strong>'+primaryPct+'%</strong> of cases as Primary Surgeon — excellent independence!' });

    let challenging = allCases.filter(c=>parseComplexity(c.notes)==='Challenging').length;
    let complex     = allCases.filter(c=>parseComplexity(c.notes)==='Complex').length;
    let compPct = Math.round(((challenging+complex)/allCases.length)*100);
    if (compPct >= 20) insights.push({ icon:'🧠', color:'#7c3aed', bg:'#faf5ff', text:'<strong>'+compPct+'%</strong> of your cases are Complex or Challenging — you\'re taking on high-acuity surgical experience.' });

    if (profile.endYear) {
        let monthsLeft = Math.max(1,(new Date(parseInt(profile.endYear),5,30)-now)/(1000*60*60*24*30.44));
        let remaining  = Math.max(0,Object.values(acgme).reduce((a,b)=>a+b,0)-allCases.length);
        insights.push({ icon:'🗓️', color:'#0891b2', bg:'#f0f9ff', text:'<strong>'+Math.round(monthsLeft)+' months</strong> until graduation. You need ~<strong>'+(remaining/monthsLeft).toFixed(1)+' cases/month</strong> to complete all ACGME requirements.' });
    }

    el.innerHTML = insights.map(ins =>
        '<div style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;background:'+ins.bg+';border-radius:12px;margin-bottom:10px;border-left:3px solid '+ins.color+'">' +
        '<span style="font-size:18px;flex-shrink:0">'+ins.icon+'</span>' +
        '<p style="font-size:13px;color:#0f172a;line-height:1.5;margin:0">'+ins.text+'</p></div>'
    ).join('');
}

// ── Peer Benchmarking ────────────────────────────────────────────────────────
async function showPeerBenchmark() {
    let el = document.getElementById('peerBenchmark');
    el.innerHTML = '<p style="color:#64748b; font-size:13px">Loading program data…</p>';

    let { data: allProgramCases, error } = await db.from('cases').select('user_id, procedure, role');
    if (error || !allProgramCases || allProgramCases.length === 0) {
        el.innerHTML = '<p style="color:#94a3b8; font-size:13px">⚠️ Program data unavailable — benchmarking requires shared data access.</p>';
        return;
    }

    let { data: { user } } = await db.auth.getUser();
    let myCases    = allProgramCases.filter(c => c.user_id === user.id);
    let otherCases = allProgramCases.filter(c => c.user_id !== user.id);
    let peers      = [...new Set(otherCases.map(c => c.user_id))];

    if (peers.length === 0) {
        el.innerHTML = '<p style="color:#94a3b8; font-size:13px">No peer data yet — you\'re the first in the program! 🏆</p>';
        return;
    }

    let peerTotals = peers.map(uid => allProgramCases.filter(c => c.user_id === uid).length);
    let myTotal    = myCases.length;
    let rank       = peerTotals.filter(t => t > myTotal).length + 1;
    let pctile     = Math.round((1-(rank-1)/peers.length)*100);

    let html = '<div style="background:#f8fafc;border-radius:12px;padding:14px;margin-bottom:14px;text-align:center">' +
        '<div style="font-size:28px;font-weight:900;color:#2563eb">'+pctile+'th</div>' +
        '<div style="font-size:12px;color:#64748b">Percentile in your program</div>' +
        '<div style="font-size:12px;color:#94a3b8;margin-top:4px">Ranked #'+rank+' of '+(peers.length+1)+' residents</div></div>';

    for (let p in acgme) {
        let mine     = myCases.filter(c => c.procedure === p).length;
        let peerAvgs = peers.map(uid => allProgramCases.filter(c => c.user_id===uid && c.procedure===p).length);
        let avg      = peerAvgs.length > 0 ? Math.round(peerAvgs.reduce((a,b)=>a+b,0)/peerAvgs.length) : 0;
        let short    = p.split('/')[0].trim().split('(')[0].trim();
        let myPct    = Math.min(Math.round((mine/acgme[p])*100),100);
        let avgPct   = Math.min(Math.round((avg/acgme[p])*100),100);
        let better   = mine >= avg;
        html += '<div style="margin-bottom:10px">' +
            '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
            '<span style="font-weight:600;color:#0f172a">'+short+'</span>' +
            '<span style="'+(better?'color:#16a34a':'color:#d97706')+';font-weight:700">You: '+mine+' '+(better?'▲':'▼')+' Avg: '+avg+'</span></div>' +
            '<div style="position:relative;height:8px;background:#e2e8f0;border-radius:99px">' +
            '<div style="position:absolute;height:8px;background:#cbd5e1;border-radius:99px;width:'+avgPct+'%"></div>' +
            '<div style="position:absolute;height:8px;background:'+(better?'#16a34a':'#d97706')+';border-radius:99px;width:'+myPct+'%;opacity:0.9"></div></div></div>';
    }
    html += '<p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:8px">Data is anonymous — only counts are compared, never names</p>';
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
            { label:'Routine',     data:routineData,     backgroundColor:'#86efac', borderRadius:4 },
            { label:'Complex',     data:complexData,     backgroundColor:'#fde68a', borderRadius:4 },
            { label:'Challenging', data:challengingData, backgroundColor:'#fca5a5', borderRadius:4 }
        ]},
        options: { responsive:true, scales:{ x:{stacked:true,grid:{display:false}}, y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'}} }, plugins:{legend:{position:'bottom'}} }
    });

    let totR  = allCases.filter(c=>parseComplexity(c.notes)==='Routine').length;
    let totC  = allCases.filter(c=>parseComplexity(c.notes)==='Complex').length;
    let totCh = allCases.filter(c=>parseComplexity(c.notes)==='Challenging').length;
    let tot   = allCases.length || 1;
    if (summaryEl) {
        summaryEl.innerHTML =
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">' +
            '<div style="background:#f0fdf4;border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:900;color:#16a34a">'+totR+'</div><div style="font-size:11px;color:#64748b">Routine ('+Math.round(totR/tot*100)+'%)</div></div>' +
            '<div style="background:#fffbeb;border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:900;color:#ca8a04">'+totC+'</div><div style="font-size:11px;color:#64748b">Complex ('+Math.round(totC/tot*100)+'%)</div></div>' +
            '<div style="background:#fef2f2;border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:900;color:#dc2626">'+totCh+'</div><div style="font-size:11px;color:#64748b">Challenging ('+Math.round(totCh/tot*100)+'%)</div></div></div>';
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

    let html = '<div style="font-weight:700;color:#0f172a;margin-bottom:12px;text-align:center;font-size:15px">📅 '+monthName+'</div>';
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
    showToast('🎓 Fellowship PDF exported!');
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
                alerts.push({ proc, remaining, monthsNeeded: Math.round(monthsNeeded), color: isRed ? '#dc2626' : '#d97706', icon: isRed ? '🚨' : '⚠️', label: isRed ? 'At risk — behind pace' : 'Behind — needs attention' });
            }
        }
    }

    if (alerts.length === 0) { banner.style.display = 'none'; return; }

    let html = '<div style="background:white; border-radius:14px; padding:16px; border:2px solid #fca5a5; box-shadow:0 2px 12px rgba(220,38,38,0.1)">';
    html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px"><span style="font-size:18px">🎯</span><strong style="color:#dc2626; font-size:14px">ACGME Gap Alerts</strong><span style="font-size:12px; color:#64748b; margin-left:auto">' + Math.round(monthsLeft) + ' months left</span></div>';
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
function startVoiceLog() {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        showToast('⚠️ Voice input not supported on this browser', 'warning');
        return;
    }
    let statusEl = document.getElementById('voiceStatus');
    let voiceBtn = document.getElementById('voiceBtn');
    let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    statusEl.textContent = '🎤 Listening… say e.g. "Cataract primary surgeon today with Dr. Smith"';
    statusEl.style.display = 'block';
    voiceBtn.textContent = '⏹ Stop';

    rec.onresult = (e) => {
        let transcript = e.results[0][0].transcript;
        statusEl.textContent = '✅ Heard: "' + transcript + '"';
        parseVoiceInput(transcript);
        voiceBtn.innerHTML = '🎤 Voice';
    };
    rec.onerror = () => {
        statusEl.textContent = '⚠️ Could not hear clearly — try again';
        voiceBtn.innerHTML = '🎤 Voice';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    };
    rec.onend = () => { voiceBtn.innerHTML = '🎤 Voice'; };
    rec.start();
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

    if (t.includes('today') || t.includes('tonight')) matched.date = new Date().toISOString().slice(0, 10);
    else if (t.includes('yesterday')) { let d = new Date(); d.setDate(d.getDate()-1); matched.date = d.toISOString().slice(0,10); }

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
    if (filled > 0) showToast('🎤 Filled ' + filled + ' field' + (filled > 1 ? 's' : '') + ' — review and save!');
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
            { icon: '📋', val: data.total, label: 'Total Cases' },
            { icon: '🎯', val: data.pct + '%', label: 'ACGME Done' },
            { icon: '🏥', val: data.pgy || '—', label: 'Year' }
        ];
        document.getElementById('svStats').innerHTML = stats.map(s =>
            `<div style="background:white;border-radius:14px;padding:16px;text-align:center;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(37,99,235,0.07)">
                <div style="font-size:24px;margin-bottom:4px">${s.icon}</div>
                <div style="font-size:22px;font-weight:900;color:#0f172a">${s.val}</div>
                <div style="font-size:11px;color:#64748b">${s.label}</div>
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

// ── Attending Feedback ───────────────────────────────────────────────────────
function openFeedbackModal(caseId, caseInfo) {
    document.getElementById('feedbackCaseId').value      = caseId;
    document.getElementById('feedbackCaseInfo').textContent = caseInfo;
    document.getElementById('feedbackText').value        = '';
    document.getElementById('feedbackModal').style.display = 'flex';
}

async function submitFeedback() {
    let caseId = document.getElementById('feedbackCaseId').value;
    let text   = document.getElementById('feedbackText').value.trim();
    if (!text) { showToast('⚠️ Enter feedback text', 'warning'); return; }

    let { data: existing } = await db.from('cases').select('notes').eq('id', caseId).single();
    let oldNotes = existing ? (existing.notes || '') : '';
    let newNotes = oldNotes + (oldNotes ? '\n' : '') + '[PD Feedback: ' + text + ']';

    let { error } = await db.from('cases').update({ notes: newNotes }).eq('id', caseId);
    if (error) { showToast('❌ Failed to save feedback', 'error'); return; }

    document.getElementById('feedbackModal').style.display = 'none';
    showToast('✅ Feedback saved to case!');
    if (typeof loadAdminData === 'function') loadAdminData();
}

// ── Workspace Sub-Tabs ───────────────────────────────────────────────────────
let activeWorkspaceTab = 'journal';

function showWorkspaceTab(tab) {
    activeWorkspaceTab = tab;
    ['journal','todo','notes','study'].forEach(t => {
        let el = document.getElementById('ws-'+t);
        if (el) el.style.display = t === tab ? 'block' : 'none';
        let btn = document.getElementById('ws-tab-'+t);
        if (btn) {
            if (t === tab) {
                btn.style.background  = 'white';
                btn.style.color       = '#2563eb';
                btn.style.boxShadow   = '0 2px 8px rgba(0,0,0,0.08)';
            } else {
                btn.style.background  = 'transparent';
                btn.style.color       = '#64748b';
                btn.style.boxShadow   = 'none';
            }
        }
    });
    if (tab === 'journal') renderJournalList();
    if (tab === 'todo')    renderTodos();
    if (tab === 'notes')   renderNotes();
    if (tab === 'study')   renderStudyList();
}

// ── Journal ──────────────────────────────────────────────────────────────────
const JOURNAL_KEY = 'eyeJournal';
let selectedMood  = '😊';

function getJournalEntries() {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
}
function saveJournalEntries(entries) {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

function openJournalModal(id) {
    let entry = id ? getJournalEntries().find(e => e.id === id) : null;

    document.getElementById('journalEntryId').value = entry ? entry.id : '';
    document.getElementById('journalDate').value    = entry ? entry.date : new Date().toISOString().slice(0,10);
    document.getElementById('journalTitle').value   = entry ? (entry.title || '') : '';
    document.getElementById('journalBody').value    = entry ? entry.body : '';

    selectedMood = entry ? entry.mood : '😊';
    updateMoodButtons();

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

    document.getElementById('journalModal').style.display = 'flex';
}

function closeJournalModal() {
    document.getElementById('journalModal').style.display = 'none';
}

function selectMood(mood) {
    selectedMood = mood;
    updateMoodButtons();
}

function updateMoodButtons() {
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.style.borderColor = '#e2e8f0';
        btn.style.transform   = 'scale(1)';
        btn.style.boxShadow   = 'none';
    });
    let active = document.getElementById('mood-' + selectedMood);
    if (active) {
        active.style.borderColor = '#7c3aed';
        active.style.transform   = 'scale(1.12)';
        active.style.boxShadow   = '0 4px 12px rgba(124,58,237,0.25)';
    }
}

function saveJournalEntry() {
    let body = document.getElementById('journalBody').value.trim();
    if (!body) { showToast('⚠️ Write something first!', 'warning'); return; }

    let entries = getJournalEntries();
    let id      = document.getElementById('journalEntryId').value;
    let entry   = {
        id:        id || crypto.randomUUID(),
        date:      document.getElementById('journalDate').value || new Date().toISOString().slice(0,10),
        mood:      selectedMood,
        title:     document.getElementById('journalTitle').value.trim(),
        body,
        caseId:    document.getElementById('journalCaseLink').value || null,
        updatedAt: new Date().toISOString()
    };

    if (id) {
        let idx = entries.findIndex(e => e.id === id);
        if (idx !== -1) entries[idx] = entry; else entries.unshift(entry);
    } else {
        entries.unshift(entry);
    }

    saveJournalEntries(entries);
    closeJournalModal();
    renderJournalList();
    showToast('📔 Journal entry saved!');
}

function deleteJournalEntry(id) {
    if (!confirm('Delete this journal entry?')) return;
    let entries = getJournalEntries().filter(e => e.id !== id);
    saveJournalEntries(entries);
    renderJournalList();
    showToast('🗑️ Entry deleted', 'warning');
}

function renderJournalList() {
    let el = document.getElementById('journalList');
    if (!el) return;

    let search    = (document.getElementById('journalSearch')?.value || '').toLowerCase();
    let moodFilter = document.getElementById('journalMoodFilter')?.value || '';
    let entries   = getJournalEntries();

    if (search)     entries = entries.filter(e => (e.title+e.body).toLowerCase().includes(search));
    if (moodFilter) entries = entries.filter(e => e.mood === moodFilter);

    if (entries.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:48px;margin-bottom:12px">📔</div>
            <p style="font-size:15px;font-weight:600;color:#64748b;margin-bottom:6px">${search || moodFilter ? 'No entries match' : 'No entries yet'}</p>
            <p style="font-size:13px">${search || moodFilter ? 'Try a different search' : 'Tap <strong>New Entry</strong> to start journaling'}</p>
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

    let moodColors = { '💪':'#f0fdf4', '😊':'#eff6ff', '😐':'#f8fafc', '😤':'#fff7ed', '🤔':'#faf5ff' };
    let moodBorder = { '💪':'#16a34a', '😊':'#2563eb', '😐':'#94a3b8', '😤':'#ea580c', '🤔':'#7c3aed' };

    let html = '';
    for (let month of Object.keys(grouped).sort().reverse()) {
        let label = new Date(month+'-02').toLocaleString('default',{month:'long',year:'numeric'});
        html += `<div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px">${label}</div>`;
        for (let e of grouped[month]) {
            let preview = e.body.length > 120 ? e.body.slice(0,120)+'…' : e.body;
            let dateStr = e.date ? new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
            let linkedCase = e.caseId ? allCases.find(c => c.id === e.caseId) : null;
            html += `<div style="background:${moodColors[e.mood]||'#f8fafc'};border:1.5px solid ${moodBorder[e.mood]||'#e2e8f0'};border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:box-shadow 0.15s"
                onclick="openJournalModal('${e.id}')"
                onmouseover="this.style.boxShadow='0 4px 18px rgba(0,0,0,0.09)'"
                onmouseout="this.style.boxShadow='none'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-size:22px">${e.mood}</span>
                        <div>
                            ${e.title ? `<div style="font-weight:700;font-size:14px;color:#0f172a">${e.title}</div>` : ''}
                            <div style="font-size:12px;color:#64748b">${dateStr}</div>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation();deleteJournalEntry('${e.id}')"
                        style="background:transparent;border:none;color:#94a3b8;font-size:16px;padding:4px;margin:0;width:auto;min-width:0;cursor:pointer;line-height:1">🗑️</button>
                </div>
                <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 ${linkedCase?'8px':'0'}">${preview}</p>
                ${linkedCase ? `<div style="font-size:11px;color:#7c3aed;font-weight:600;margin-top:6px">🔗 ${linkedCase.procedure} · ${linkedCase.date}</div>` : ''}
            </div>`;
        }
    }

    // Word count footer
    let total = getJournalEntries().length;
    let words = getJournalEntries().reduce((sum,e)=>sum+(e.body||'').split(/\s+/).filter(Boolean).length,0);
    html += `<div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;margin-top:8px">
        ${total} entr${total===1?'y':'ies'} · ${words.toLocaleString()} words written
    </div>`;

    el.innerHTML = html;
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
    closeTodoModal();
    renderTodos();
    showToast('✅ Task saved!');
}

function toggleTodo(id) {
    let todos = getTodos();
    let todo  = todos.find(t => t.id === id);
    if (todo) { todo.done = !todo.done; saveTodos(todos); renderTodos(); }
}

function deleteTodo(id) {
    if (!confirm('Delete this task?')) return;
    saveTodos(getTodos().filter(t => t.id !== id));
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
    let priIcon   = { high:'🔴', medium:'🟡', low:'🟢' };

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
                        <span style="font-size:11px;font-weight:700;color:${priColors[t.priority]}">${priIcon[t.priority]} ${t.priority.charAt(0).toUpperCase()+t.priority.slice(1)}</span>
                        ${t.due?`<span style="font-size:11px;color:${overdue?'#dc2626':'#64748b'};font-weight:${overdue?700:400}">${overdue?'⚠️ Overdue · ':'📅 '}${new Date(t.due+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`:''}
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="openTodoModal('${t.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#f1f5f9;border-radius:8px;font-size:12px;color:#64748b;box-shadow:none">✏️</button>
                    <button onclick="deleteTodo('${t.id}')"    style="width:28px;height:28px;padding:0;margin:0;background:#fef2f2;border-radius:8px;font-size:12px;color:#dc2626;box-shadow:none">🗑️</button>
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
    closeNoteModal();
    renderNotes();
    showToast('📝 Note saved!');
}

function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    saveNotes(getNotes().filter(n => n.id !== id));
    renderNotes();
    showToast('🗑️ Note deleted', 'warning');
}

function renderNotes() {
    let el = document.getElementById('notesList');
    if (!el) return;
    let search = (document.getElementById('notesSearch')?.value || '').toLowerCase();
    let notes  = getNotes();
    if (search) notes = notes.filter(n => (n.title+n.body+n.tag).toLowerCase().includes(search));

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

    el.innerHTML = notes.map(n => `
        <div style="background:${n.tag&&tagBg[n.tag]?tagBg[n.tag]:'white'};border:1.5px solid ${n.tag&&tagColors[n.tag]?tagColors[n.tag]+'33':'#e2e8f0'};border-radius:14px;padding:16px;margin-bottom:10px;cursor:pointer;transition:box-shadow 0.15s"
             onclick="openNoteModal('${n.id}')"
             onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'"
             onmouseout="this.style.boxShadow='none'">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                    <p style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${n.title}</p>
                    ${n.tag?`<span style="font-size:11px;font-weight:700;color:${tagColors[n.tag]||'#64748b'};background:${tagColors[n.tag]||'#94a3b8'}18;padding:2px 8px;border-radius:20px">${n.tag}</span>`:''}
                </div>
                <button onclick="event.stopPropagation();deleteNote('${n.id}')"
                    style="background:transparent;border:none;color:#94a3b8;font-size:14px;padding:4px;margin:0;width:auto;min-width:0;cursor:pointer">🗑️</button>
            </div>
            ${n.body?`<p style="font-size:13px;color:#374151;line-height:1.6;margin:0">${n.body.length>160?n.body.slice(0,160)+'…':n.body}</p>`:''}
        </div>`).join('');
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
    document.getElementById('studyModal').style.display = 'flex';
    setTimeout(() => document.getElementById('studyTopic').focus(), 100);
}
function closeStudyModal() { document.getElementById('studyModal').style.display = 'none'; }

function saveStudyItem() {
    let topic = document.getElementById('studyTopic').value.trim();
    if (!topic) { showToast('⚠️ Enter a topic', 'warning'); return; }
    let items = getStudyItems();
    let id    = document.getElementById('studyId').value;
    let item  = { id: id || crypto.randomUUID(), topic, type: document.getElementById('studyType').value, notes: document.getElementById('studyNotes').value.trim(), status: 'to-read', createdAt: new Date().toISOString() };
    if (id) { let idx = items.findIndex(s => s.id === id); if (idx !== -1) { item.status = items[idx].status; items[idx] = item; } else items.unshift(item); }
    else items.unshift(item);
    saveStudyItems(items);
    closeStudyModal();
    renderStudyList();
    showToast('📚 Added to study list!');
}

function cycleStudyStatus(id) {
    let items  = getStudyItems();
    let item   = items.find(s => s.id === id);
    if (!item) return;
    let cycle  = { 'to-read':'reading', 'reading':'done', 'done':'to-read' };
    item.status = cycle[item.status] || 'to-read';
    saveStudyItems(items);
    renderStudyList();
}

function deleteStudyItem(id) {
    if (!confirm('Remove from study list?')) return;
    saveStudyItems(getStudyItems().filter(s => s.id !== id));
    renderStudyList();
    showToast('🗑️ Removed', 'warning');
}

function filterStudy(f) {
    studyFilter = f;
    ['all','to-read','reading','done'].forEach(x => {
        let btn = document.getElementById('sf-'+x);
        if (!btn) return;
        btn.style.background = x === f ? '#7c3aed' : '#f1f5f9';
        btn.style.color      = x === f ? 'white' : '#64748b';
    });
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
            <span>📚 ${all.length} items total</span><span style="font-weight:700;color:#7c3aed">${pct}% complete</span>
        </div>
        <div style="background:#e2e8f0;border-radius:99px;height:8px">
            <div style="background:linear-gradient(90deg,#7c3aed,#2563eb);width:${pct}%;height:8px;border-radius:99px;transition:width 0.5s"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;font-size:11px;color:#64748b">
            <span>📖 ${toRead} to read</span><span>⏳ ${reading} reading</span><span>✅ ${done} done</span>
        </div>`;
    } else if (progressEl) { progressEl.innerHTML = ''; }

    let items = studyFilter === 'all' ? all : all.filter(s => s.status === studyFilter);

    if (items.length === 0) {
        el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:40px;margin-bottom:12px">📚</div>
            <p style="font-size:14px;font-weight:600;color:#64748b">${studyFilter!=='all'?'Nothing in this category':'Study list empty'}</p>
            <p style="font-size:13px">Add textbooks, articles, or videos to study</p>
        </div>`;
        return;
    }

    let statusLabel = { 'to-read':'📖 To Read', 'reading':'⏳ Reading', 'done':'✅ Done' };
    let statusBg    = { 'to-read':'#eff6ff', 'reading':'#fffbeb', 'done':'#f0fdf4' };
    let statusColor = { 'to-read':'#2563eb', 'reading':'#ca8a04', 'done':'#16a34a' };
    let typeIcon    = { 'Textbook':'📖','Article':'📄','Video':'🎥','Question Bank':'❓','Other':'📌' };

    el.innerHTML = items.map(s => `
        <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:8px">
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                        <span style="font-size:16px">${typeIcon[s.type]||'📌'}</span>
                        <p style="font-weight:700;font-size:14px;color:#0f172a;margin:0">${s.topic}</p>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                        <span style="font-size:11px;color:#64748b">${s.type}</span>
                        <button onclick="cycleStudyStatus('${s.id}')"
                            style="font-size:11px;font-weight:700;color:${statusColor[s.status]};background:${statusBg[s.status]};border:none;padding:3px 10px;border-radius:20px;cursor:pointer;margin:0;width:auto;min-width:0;box-shadow:none">
                            ${statusLabel[s.status]}
                        </button>
                    </div>
                    ${s.notes?`<p style="font-size:12px;color:#64748b;margin-top:6px;line-height:1.5">${s.notes}</p>`:''}
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="openStudyModal('${s.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#f1f5f9;border-radius:8px;font-size:12px;color:#64748b;box-shadow:none">✏️</button>
                    <button onclick="deleteStudyItem('${s.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#fef2f2;border-radius:8px;font-size:12px;color:#dc2626;box-shadow:none">🗑️</button>
                </div>
            </div>
        </div>`).join('');
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js');
    });
}