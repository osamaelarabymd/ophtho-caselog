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

// ── Global Search ─────────────────────────────────────────────────────────────
function openGlobalSearch() {
    let modal = document.getElementById('globalSearchModal');
    if (!modal) return;
    modal.style.display = 'block';
    setTimeout(() => { let inp = document.getElementById('globalSearchInput'); if (inp) inp.focus(); }, 100);
}

function closeGlobalSearch() {
    let modal = document.getElementById('globalSearchModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeGlobalSearch(); });

function runGlobalSearch() {
    let q   = (document.getElementById('globalSearchInput')?.value || '').trim().toLowerCase();
    let out = document.getElementById('globalSearchResults');
    if (!out) return;

    if (q.length < 2) {
        out.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><div style="font-size:40px;margin-bottom:12px">🔍</div><p style="font-size:14px;font-weight:600;color:#64748b">Start typing to search everything</p><p style="font-size:12px">Cases · Journal · Notes · Tasks · Study List</p></div>';
        return;
    }

    let html = '';

    // Cases
    let caseHits = allCases.filter(c =>
        (c.procedure||'').toLowerCase().includes(q) ||
        (c.attending||'').toLowerCase().includes(q)  ||
        (c.hospital||'').toLowerCase().includes(q)   ||
        (c.notes||'').toLowerCase().includes(q)
    ).slice(0, 6);
    if (caseHits.length) {
        html += _srSection('📋 Cases', caseHits.map(c =>
            _srItem('📋', c.procedure, `${c.date||''} · ${c.role||''} · ${c.attending||''}`, `showTab('caseList',null);closeGlobalSearch()`, procedureColors[c.procedure]||'#2563eb')
        ));
    }

    // Journal
    let jHits = getJournalEntries().filter(e =>
        (e.title||'').toLowerCase().includes(q) ||
        (e.body||'').toLowerCase().includes(q)
    ).slice(0, 4);
    if (jHits.length) {
        html += _srSection('📔 Journal', jHits.map(e =>
            _srItem(e.mood||'📔', e.title||'Untitled entry', `${e.date||''} · ${(e.body||'').slice(0,60)}…`, `showTab('journal',null);showWorkspaceTab('journal');closeGlobalSearch()`, '#7c3aed')
        ));
    }

    // Notes
    let nHits = getNotes().filter(n =>
        (n.title||'').toLowerCase().includes(q) ||
        (n.body||'').toLowerCase().includes(q)  ||
        (n.tag||'').toLowerCase().includes(q)
    ).slice(0, 4);
    if (nHits.length) {
        html += _srSection('📝 Notes', nHits.map(n =>
            _srItem('📝', n.title||'Untitled', (n.tag||'') + (n.body ? ' · ' + n.body.slice(0,60) : ''), `showTab('journal',null);showWorkspaceTab('notes');closeGlobalSearch()`, '#0891b2')
        ));
    }

    // Todos
    let tHits = getTodos().filter(t => (t.text||'').toLowerCase().includes(q)).slice(0, 4);
    if (tHits.length) {
        let priColor = { high:'#dc2626', medium:'#d97706', low:'#16a34a' };
        html += _srSection('✅ Tasks', tHits.map(t =>
            _srItem(t.done ? '✅' : '⬜', t.text, `${t.priority} priority${t.due?' · due '+t.due:''}`, `showTab('journal',null);showWorkspaceTab('todo');closeGlobalSearch()`, priColor[t.priority]||'#64748b')
        ));
    }

    // Study
    let sHits = getStudyItems().filter(s =>
        (s.topic||'').toLowerCase().includes(q) ||
        (s.notes||'').toLowerCase().includes(q)
    ).slice(0, 4);
    if (sHits.length) {
        let stColor = { 'to-read':'#2563eb', 'reading':'#d97706', 'done':'#16a34a' };
        html += _srSection('📚 Study List', sHits.map(s =>
            _srItem('📚', s.topic, `${s.type||''} · ${s.status||''}`, `showTab('journal',null);showWorkspaceTab('study');closeGlobalSearch()`, stColor[s.status]||'#64748b')
        ));
    }

    if (!html) {
        html = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
            <div style="font-size:40px;margin-bottom:12px">🤷</div>
            <p style="font-size:14px;font-weight:600;color:#64748b">No results for "${q}"</p>
            <p style="font-size:12px">Try a different keyword</p>
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
function _drName(profile) {
    // Returns "Dr. [preferred]" — falls back to first name, then generic
    if (profile.preferredName) return 'Dr. ' + profile.preferredName;
    if (profile.name) return 'Dr. ' + profile.name.split(' ')[0];
    return 'Dr. ___';
}

function saveProfile() {
    let profile = {
        name:          document.getElementById('profileNameInput').value,
        preferredName: (document.getElementById('profilePreferredName')?.value || '').trim(),
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
    showToast('✅ Profile saved!');
}

function loadProfile() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};
    if (profile.name)          document.getElementById('profileNameInput').value    = profile.name;
    let prefEl = document.getElementById('profilePreferredName');
    if (prefEl) prefEl.value = profile.preferredName || (profile.name ? profile.name.split(' ')[0] : '');
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
    if (nameEl) nameEl.textContent = _drName(profile);
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
    if (welcomeEl) welcomeEl.textContent = _drName(profile);
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

let _lastPendingCount = 0;
async function checkPendingUsers() {
    if (currentUserRole !== 'admin') return;
    let { data: profiles } = await db.from('profiles').select('status').eq('status', 'pending');
    let count    = profiles ? profiles.length : 0;
    let adminTab = document.getElementById('adminTab');
    if (adminTab) {
        if (count > 0) {
            adminTab.innerHTML = '👨‍⚕️ PD Panel <span style="background:#dc2626; color:white; border-radius:50%; padding:2px 7px; font-size:11px; margin-left:4px">' + count + '</span>';
        } else {
            adminTab.innerHTML = '👨‍⚕️ PD Panel';
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
    let html = '<h2>👨‍⚕️ Program Director Panel</h2>';

    if (pending.length > 0) {
        html += '<div style="background:#fff7ed; border:2px solid #f97316; border-radius:14px; padding:16px; margin-bottom:20px">';
        html += '<h3 style="color:#ea580c; margin-bottom:12px">⏳ Pending Approval (' + pending.length + ')</h3>';
        for (let p of pending) {
            let isAttending = p.role === 'attending';
            let roleBadge   = isAttending
                ? '<span style="font-size:10px;font-weight:700;background:#0891b218;color:#0891b2;padding:2px 8px;border-radius:20px;margin-left:6px">🩺 Attending</span>'
                : '<span style="font-size:10px;font-weight:700;background:#2563eb18;color:#2563eb;padding:2px 8px;border-radius:20px;margin-left:6px">👨‍🎓 Resident</span>';
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

    // ── Approved Attendings
    let approvedAttending = profiles ? profiles.filter(p => p.role === 'attending' && p.status === 'approved') : [];
    if (approvedAttending.length > 0) {
        html += '<h3 style="margin:20px 0 12px">🩺 Approved Attendings</h3>';
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

    // ── Inline stats row (Notion property style)
    const _sv = (icon, val, label, color) =>
        `<div style="flex:1;display:flex;flex-direction:column;align-items:center;padding:16px 10px;gap:6px">
            <div style="width:36px;height:36px;border-radius:10px;background:${color}14;display:flex;align-items:center;justify-content:center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>
            </div>
            <span style="font-size:22px;font-weight:800;color:${color};letter-spacing:-0.5px;line-height:1">${val}</span>
            <span style="font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.6px">${label}</span>
        </div>`;
    const _div = `<div style="width:1px;background:#F3F4F6;align-self:stretch;margin:12px 0"></div>`;
    document.getElementById('summaryCards').innerHTML =
        `<div style="background:white;border-radius:16px;border:1px solid #E5E7EB;display:flex;align-items:stretch;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
            ${_sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',totalDone,'Total Cases','#2563eb')}
            ${_div}
            ${_sv('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',monthCases.length,'This Month','#0891b2')}
            ${_div}
            ${_sv('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',overallPercent+'%','ACGME','#7c3aed')}
            ${_div}
            ${_sv('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',streak,'Day Streak','#d97706')}
        </div>`;

    let badge = document.getElementById('overallBadge');
    if (badge) badge.textContent = overallPercent + '% Complete';

    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of cases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }

    // ── Today's Focus (Notion callout style)
    let todayStr  = new Date().toISOString().split('T')[0];
    let todayCases = cases.filter(c => c.date === todayStr);
    let openTodos  = (JSON.parse(localStorage.getItem('eyelog_todos')) || []).filter(t => !t.done && (!t.due || t.due <= todayStr));
    let focusEl = document.getElementById('todayFocus');
    if (focusEl) {
        let todoItems = openTodos.slice(0,3).map(t =>
            `<div style="display:flex;align-items:center;gap:8px;padding:5px 0">
                <div style="width:6px;height:6px;border-radius:50%;background:#7c3aed;flex-shrink:0"></div>
                <span style="font-size:13px;color:#374151;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.text}</span>
            </div>`).join('');
        focusEl.innerHTML = `
        <div style="background:#fafafa;border:1px solid #E5E7EB;border-radius:14px;padding:16px 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <div style="width:28px;height:28px;background:#eff6ff;border-radius:8px;display:flex;align-items:center;justify-content:center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#374151;letter-spacing:0.3px">TODAY</span>
                    <span style="font-size:12px;font-weight:700;color:#2563eb;background:#eff6ff;padding:2px 8px;border-radius:20px">${todayCases.length} case${todayCases.length!==1?'s':''}</span>
                </div>
                ${todayCases.length === 0
                    ? `<p style="font-size:12px;color:#9CA3AF;font-style:italic">No cases logged today yet</p>`
                    : todayCases.slice(0,3).map(c=>`<div style="font-size:12px;color:#374151;padding:4px 0;border-bottom:1px solid #F3F4F6">${c.procedure?.split('/')[0]?.trim()||c.procedure} · <span style="color:#6B7280">${c.role||''}</span></div>`).join('')
                }
            </div>
            <div style="border-left:1px solid #E5E7EB;padding-left:14px;display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <div style="width:28px;height:28px;background:#faf5ff;border-radius:8px;display:flex;align-items:center;justify-content:center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:#374151;letter-spacing:0.3px">OPEN TASKS</span>
                    <span style="font-size:12px;font-weight:700;color:#7c3aed;background:#faf5ff;padding:2px 8px;border-radius:20px">${openTodos.length}</span>
                </div>
                ${openTodos.length === 0
                    ? `<p style="font-size:12px;color:#9CA3AF;font-style:italic">All caught up!</p>`
                    : todoItems
                }
            </div>
        </div>`;
    }

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

    // ── Role breakdown donut
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
            datasets: [{ data: Object.values(roleCounts), backgroundColor: ['#2563eb','#16a34a','#d97706'], borderWidth: 0, borderRadius: 4 }]
        },
        options: { responsive: true, cutout: '74%', plugins: { legend: { position: 'bottom', labels: { font: { size: 11, family: 'Inter', weight: '600' }, padding: 10, boxWidth: 10, boxHeight: 10, borderRadius: 3 } } } }
    });

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
let _voiceRec = null;
let _voiceActive = false;

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
    _vfRec.lang = 'en-US';
    _vfRec.interimResults = true;
    _vfRec.continuous = true;
    _vfRec.maxAlternatives = 1;

    // Show overlay
    let overlay = document.getElementById('voiceOverlay');
    let liveText = document.getElementById('voiceLiveText');
    if (overlay) overlay.style.display = 'block';
    if (liveText) liveText.textContent = 'Listening…';
    btnEl.innerHTML = '⏹'; btnEl.style.color = '#dc2626';

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
        // Save accumulated text to field
        if (_vfAccumulated) {
            let el = document.getElementById(_vfTargetId);
            if (el) {
                el.value = el.value ? el.value + ' ' + _vfAccumulated : _vfAccumulated;
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
    if (_vfBtn) { _vfBtn.innerHTML = '🎤'; _vfBtn.style.color = ''; _vfBtn = null; }
}

function startVoiceLog() {
    let statusEl = document.getElementById('voiceStatus');
    let voiceBtn = document.getElementById('voiceBtn');

    // Toggle off if already recording
    if (_voiceActive && _voiceRec) {
        _voiceRec.stop();
        _voiceActive = false;
        voiceBtn.innerHTML = '🎤 Voice';
        if (statusEl) { statusEl.textContent = '⏹ Recording stopped'; setTimeout(() => { statusEl.style.display = 'none'; }, 2000); }
        return;
    }

    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        showToast('⚠️ Voice not supported — try Chrome on Android or Safari on iOS', 'warning');
        return;
    }

    let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    _voiceRec = new SR();
    _voiceRec.lang = 'en-US';
    _voiceRec.interimResults = true;
    _voiceRec.maxAlternatives = 1;
    _voiceActive = true;

    statusEl.textContent = '🎤 Listening… say e.g. "Cataract primary surgeon today with Dr. Smith"';
    statusEl.style.display = 'block';
    voiceBtn.innerHTML = '⏹ Stop';

    _voiceRec.onresult = (e) => {
        let interim = '';
        let final   = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            let t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t; else interim += t;
        }
        if (interim) statusEl.textContent = '🎤 ' + interim + '…';
        if (final)   { statusEl.textContent = '✅ Heard: "' + final + '"'; parseVoiceInput(final); }
    };
    _voiceRec.onerror = (e) => {
        _voiceActive = false;
        voiceBtn.innerHTML = '🎤 Voice';
        let msg = { 'not-allowed':'⚠️ Microphone permission denied — allow mic in browser settings', 'no-speech':'⚠️ No speech detected — tap and speak clearly', 'network':'⚠️ Network error — check connection', 'audio-capture':'⚠️ No microphone found' }[e.error] || ('⚠️ Error: ' + e.error);
        statusEl.textContent = msg;
        setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
    };
    _voiceRec.onend = () => {
        _voiceActive = false;
        voiceBtn.innerHTML = '🎤 Voice';
        setTimeout(() => { if (statusEl.textContent.startsWith('✅')) setTimeout(() => { statusEl.style.display = 'none'; }, 3000); }, 100);
    };

    try { _voiceRec.start(); }
    catch(e) { showToast('⚠️ Could not start microphone: ' + e.message, 'error'); _voiceActive = false; voiceBtn.innerHTML = '🎤 Voice'; }
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
                    <div style="width:36px;height:36px;background:#0891b218;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">👨‍⚕️</div>
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
            <div style="font-size:40px;margin-bottom:10px">🩺</div>
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
    ['calendar','journal','todo','notes','study'].forEach(t => {
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
    if (tab === 'calendar') { if (calView === 'week') renderWeekView(); else renderCalendar(); }
    if (tab === 'journal')  renderJournalList();
    if (tab === 'todo')     renderTodos();
    if (tab === 'notes')    renderNotes();
    if (tab === 'study')    renderStudyList();
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
    if (monthBtn) { monthBtn.style.background = v==='month' ? '#2563eb' : '#f1f5f9'; monthBtn.style.color = v==='month' ? 'white' : '#64748b'; }
    if (weekBtn)  { weekBtn.style.background  = v==='week'  ? '#2563eb' : '#f1f5f9'; weekBtn.style.color  = v==='week'  ? 'white' : '#64748b'; }
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

    // Update header label
    let we = new Date(ws); we.setDate(we.getDate() + 6);
    let label = ws.toLocaleString('default',{month:'short',day:'numeric'}) + ' – ' + we.toLocaleString('default',{month:'short',day:'numeric',year:'numeric'});
    let el = document.getElementById('calMonthLabel');
    if (el) el.textContent = label;

    let grid    = document.getElementById('calGrid');
    let wGrid   = document.getElementById('weekGrid');
    if (grid)  grid.style.display  = 'none';
    if (!wGrid) return;
    wGrid.style.display = 'block';

    let events  = getEvents();
    let todos   = getTodos();
    let journal = getJournalEntries();
    let today   = new Date().toISOString().slice(0,10);
    let dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    let cols = '';
    for (let i = 0; i < 7; i++) {
        let d   = new Date(ws); d.setDate(ws.getDate() + i);
        let dk  = _dayKey(d);
        let isToday = dk === today;
        let dayNum  = d.getDate();
        let evs     = events.filter(e => e.date === dk);
        let tds     = todos.filter(t => t.due === dk && !t.done);
        let cases   = allCases.filter(c => c.date === dk);
        let jrnl    = journal.filter(j => j.date === dk);

        let typeColors = { clinic:'#0891b2', meeting:'#7c3aed', or:'#16a34a', education:'#d97706', personal:'#ec4899' };

        let items = '';
        evs.forEach(e => {
            let c = typeColors[e.type] || '#2563eb';
            items += `<div onclick="selectCalDay('${dk}')" style="background:${c}18;border-left:3px solid ${c};border-radius:6px;padding:4px 6px;margin-bottom:3px;cursor:pointer">
                <div style="font-size:10px;font-weight:700;color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.time?e.time+' ':''}${e.title}</div>
            </div>`;
        });
        cases.forEach(c => {
            let short = c.procedure.split('/')[0].trim().split('(')[0].trim();
            items += `<div style="background:#16a34a18;border-left:3px solid #16a34a;border-radius:6px;padding:4px 6px;margin-bottom:3px">
                <div style="font-size:10px;font-weight:700;color:#16a34a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🔪 ${short}</div>
            </div>`;
        });
        tds.forEach(t => {
            let pc = { high:'#dc2626', medium:'#d97706', low:'#16a34a' }[t.priority] || '#64748b';
            items += `<div style="background:${pc}18;border-left:3px solid ${pc};border-radius:6px;padding:4px 6px;margin-bottom:3px">
                <div style="font-size:10px;font-weight:600;color:${pc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">✅ ${t.text}</div>
            </div>`;
        });
        if (jrnl.length > 0) {
            items += `<div style="background:#7c3aed18;border-left:3px solid #7c3aed;border-radius:6px;padding:4px 6px;margin-bottom:3px">
                <div style="font-size:10px;font-weight:600;color:#7c3aed">📔 ${jrnl.length} entr${jrnl.length>1?'ies':'y'}</div>
            </div>`;
        }

        cols += `<div style="min-width:110px;flex:1;display:flex;flex-direction:column">
            <div onclick="selectCalDay('${dk}')" style="text-align:center;padding:8px 4px;margin-bottom:6px;border-radius:12px;cursor:pointer;
                background:${isToday?'#2563eb':'#f8fafc'};border:${isToday?'2px solid #2563eb':'1px solid #e2e8f0'}">
                <div style="font-size:10px;font-weight:700;color:${isToday?'rgba(255,255,255,0.8)':'#94a3b8'};text-transform:uppercase">${dayNames[i]}</div>
                <div style="font-size:20px;font-weight:900;color:${isToday?'white':'#0f172a'};line-height:1.2">${dayNum}</div>
            </div>
            <div style="flex:1;min-height:80px">${items || '<div style="font-size:10px;color:#cbd5e1;text-align:center;padding:8px 0">—</div>'}</div>
            <button onclick="openEventModal('${dk}')" style="margin:4px 0 0;padding:5px;font-size:11px;font-weight:700;border-radius:8px;background:#f1f5f9;color:#64748b;box-shadow:none;width:100%">＋</button>
        </div>`;
    }

    wGrid.innerHTML = `<div style="display:flex;gap:6px;min-width:700px">${cols}</div>`;

    // Keep dayDetail open if a day was selected
    if (selectedCalDate) renderDayDetail(selectedCalDate);
}

function renderCalendar() {
    if (calYear === undefined) initCal();
    // Ensure correct grid visibility for month view
    let wg = document.getElementById('weekGrid');
    let cg = document.getElementById('calGrid');
    if (wg) wg.style.display = 'none';
    if (cg) cg.style.display = 'block';

    let now          = new Date();
    let firstDay     = new Date(calYear, calMonth, 1).getDay();
    let daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate();
    let monthLabel   = new Date(calYear, calMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    let el = document.getElementById('calMonthLabel');
    if (el) el.textContent = monthLabel;

    let events   = getEvents();
    let todos    = getTodos();
    let journal  = getJournalEntries();

    // Build day-data index
    function pad(d) { return String(d).padStart(2,'0'); }
    function dayKey(y,m,d) { return `${y}-${pad(m+1)}-${pad(d)}`; }

    let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">';
    for (let d of ['Su','Mo','Tu','We','Th','Fr','Sa']) {
        html += `<div style="text-align:center;font-size:10px;font-weight:700;color:#94a3b8;padding:4px 0">${d}</div>`;
    }
    html += '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';

    let day = 1 - firstDay;
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++, day++) {
            if (day < 1 || day > daysInMonth) {
                html += '<div></div>';
                continue;
            }
            let dk       = dayKey(calYear, calMonth, day);
            let isToday  = dk === now.toISOString().slice(0,10);
            let isSel    = dk === selectedCalDate;
            let hasEv    = events.some(e => e.date === dk);
            let hasTodo  = todos.some(t => t.due === dk && !t.done);
            let hasJ     = journal.some(j => j.date === dk);
            let hasCase  = allCases.some(c => c.date === dk);

            let bg = isSel ? '#2563eb' : isToday ? '#dbeafe' : 'white';
            let tc = isSel ? 'white' : isToday ? '#1d4ed8' : '#0f172a';
            let border = isSel ? '2px solid #2563eb' : isToday ? '2px solid #93c5fd' : '1px solid #f1f5f9';

            let dots = '';
            if (hasEv)   dots += `<span style="width:5px;height:5px;border-radius:50%;background:#2563eb;display:inline-block;margin:0 1px"></span>`;
            if (hasCase) dots += `<span style="width:5px;height:5px;border-radius:50%;background:#16a34a;display:inline-block;margin:0 1px"></span>`;
            if (hasTodo) dots += `<span style="width:5px;height:5px;border-radius:50%;background:#d97706;display:inline-block;margin:0 1px"></span>`;
            if (hasJ)    dots += `<span style="width:5px;height:5px;border-radius:50%;background:#7c3aed;display:inline-block;margin:0 1px"></span>`;

            html += `<div onclick="selectCalDay('${dk}')" style="background:${bg};border:${border};border-radius:10px;padding:6px 4px;text-align:center;min-height:44px;cursor:pointer;transition:all 0.1s"
                onmouseover="this.style.background='${isSel?'#2563eb':'#f1f5f9'}'"
                onmouseout="this.style.background='${bg}'">
                <div style="font-size:13px;font-weight:${isToday||isSel?800:500};color:${tc}">${day}</div>
                <div style="display:flex;justify-content:center;flex-wrap:wrap;margin-top:3px;min-height:8px">${dots}</div>
            </div>`;
        }
        if (day > daysInMonth) break;
    }
    html += '</div>';

    // Legend
    html += `<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:#64748b">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#2563eb;display:inline-block"></span>Event</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#16a34a;display:inline-block"></span>Case logged</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#d97706;display:inline-block"></span>Todo due</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#7c3aed;display:inline-block"></span>Journal</span>
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
    let evTypeIcon  = { clinic:'🏥', meeting:'🤝', or:'🔬', education:'📚', personal:'👤' };
    let priColor    = { high:'#dc2626', medium:'#ca8a04', low:'#16a34a' };

    let html = '';

    // Events
    if (events.length > 0) {
        html += '<div style="margin-bottom:16px"><p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">EVENTS</p>';
        for (let ev of events) {
            html += `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:${evTypeBg[ev.type]||'#f8fafc'};border-radius:12px;margin-bottom:6px;border-left:3px solid ${evTypeColor[ev.type]||'#64748b'}">
                <span style="font-size:20px">${evTypeIcon[ev.type]||'📅'}</span>
                <div style="flex:1">
                    <p style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:2px">${ev.title}</p>
                    ${ev.time?`<p style="font-size:12px;color:#64748b;margin-bottom:2px">🕐 ${formatTime(ev.time)}</p>`:''}
                    ${ev.notes?`<p style="font-size:12px;color:#64748b">${ev.notes}</p>`:''}
                </div>
                <div style="display:flex;gap:4px">
                    <button onclick="openEventModal('${dk}','${ev.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#f1f5f9;border-radius:8px;font-size:12px;box-shadow:none">✏️</button>
                    <button onclick="deleteEvent('${ev.id}')" style="width:28px;height:28px;padding:0;margin:0;background:#fef2f2;border-radius:8px;font-size:12px;box-shadow:none;color:#dc2626">🗑️</button>
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
                <span style="font-size:18px">🔬</span>
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
                <p style="font-size:12px;color:#64748b;line-height:1.5">${j.body.slice(0,100)}${j.body.length>100?'…':''}</p>
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

let selectedEventType = 'clinic';

function openEventModal(date, id) {
    let ev = id ? getEvents().find(e => e.id === id) : null;
    document.getElementById('eventId').value    = ev ? ev.id : '';
    document.getElementById('eventTitle').value = ev ? ev.title : '';
    document.getElementById('eventDate').value  = ev ? ev.date : (date || (selectedCalDate || new Date().toISOString().slice(0,10)));
    document.getElementById('eventTime').value  = ev ? (ev.time || '') : '';
    document.getElementById('eventNotes').value = ev ? (ev.notes || '') : '';
    selectedEventType = ev ? ev.type : 'clinic';
    updateEventTypeButtons();
    document.getElementById('eventModal').style.display = 'flex';
    setTimeout(() => document.getElementById('eventTitle').focus(), 100);
}
function closeEventModal() { document.getElementById('eventModal').style.display = 'none'; }

function selectEventType(t) { selectedEventType = t; updateEventTypeButtons(); }
function updateEventTypeButtons() {
    ['clinic','meeting','or','education','personal'].forEach(t => {
        let btn = document.getElementById('et-'+t);
        if (!btn) return;
        btn.style.borderColor = t === selectedEventType ? '#2563eb' : '#e2e8f0';
        btn.style.transform   = t === selectedEventType ? 'scale(1.05)' : 'scale(1)';
    });
}

function saveEvent() {
    let title = document.getElementById('eventTitle').value.trim();
    let date  = document.getElementById('eventDate').value;
    if (!title) { showToast('⚠️ Enter a title', 'warning'); return; }
    if (!date)  { showToast('⚠️ Pick a date', 'warning'); return; }

    let events = getEvents();
    let id     = document.getElementById('eventId').value;
    let ev     = { id: id || crypto.randomUUID(), title, date, time: document.getElementById('eventTime').value || null, type: selectedEventType, notes: document.getElementById('eventNotes').value.trim(), createdAt: new Date().toISOString() };

    if (id) { let idx = events.findIndex(e => e.id === id); if (idx !== -1) events[idx] = ev; else events.push(ev); }
    else events.push(ev);
    saveEvents(events);
    _cloudUpsert('workspace_events', ev, _wsMap.events);
    closeEventModal();
    selectedCalDate = date;
    renderCalendar();
    let dd = document.getElementById('dayDetail');
    if (dd) dd.style.display = 'block';
    showToast('📅 Event saved!');
}

function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    saveEvents(getEvents().filter(e => e.id !== id));
    _cloudDelete('workspace_events', id);
    renderCalendar();
    showToast('🗑️ Event deleted', 'warning');
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
    _cloudUpsert('workspace_journal', entry, _wsMap.journal);
    closeJournalModal();
    renderJournalList();
    showToast('📔 Journal entry saved!');
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
    _cloudUpsert('workspace_todos', todo, _wsMap.todos);
    closeTodoModal();
    renderTodos();
    showToast('✅ Task saved!');
}

function toggleTodo(id) {
    let todos = getTodos();
    let todo  = todos.find(t => t.id === id);
    if (todo) { todo.done = !todo.done; saveTodos(todos); renderTodos(); _cloudUpsert('workspace_todos', todo, _wsMap.todos); }
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
    _cloudUpsert('workspace_study', item, _wsMap.study);
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