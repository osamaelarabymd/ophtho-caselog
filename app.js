const SUPABASE_URL = 'https://wvopihnkbdbasykvtkxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2b3BpaG5rYmRiYXN5a3Z0a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODM4NjUsImV4cCI6MjA5Mzk1OTg2NX0.zpdRwihfqdBaFwEInE5gE034SD7rGaSNB8HIXFXOHfs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let allCases      = [];
let monthlyChart  = null;
let roleChart     = null;
let dayChart      = null;
let roleDashChart = null;
let currentUserRole = 'resident';

const acgme = {
    'Cataract / Phaco': 86,
    'Vitreoretinal (PPV)': 25,
    'Glaucoma': 25,
    'Cornea / Keratoplasty': 35,
    'Oculoplastics': 20,
    'Strabismus': 26,
    'Laser (LIO / SLT / YAG)': 25
};

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
    if (profile.name)      document.getElementById('profileNameInput').value  = profile.name;
    if (profile.pgy)       document.getElementById('profilePgyInput').value   = profile.pgy;
    if (profile.program)   document.getElementById('profileProgramInput').value = profile.program;
    if (profile.startYear) document.getElementById('profileStartYear').value  = profile.startYear;
    if (profile.endYear)   document.getElementById('profileEndYear').value    = profile.endYear;
    if (profile.goals)     document.getElementById('profileGoals').value      = profile.goals;
    updateProfileDisplay();
}

function updateProfileDisplay() {
    let profile = JSON.parse(localStorage.getItem('userProfile')) || {};

    // Header card
    let nameEl = document.getElementById('profileName');
    let pgyEl  = document.getElementById('profilePgy');
    let progEl = document.getElementById('profileProgram');
    if (nameEl) nameEl.textContent = profile.name ? 'Dr. ' + profile.name : 'Dr. Osama Elaraby';
    if (pgyEl)  pgyEl.textContent  = profile.pgy  || 'PGY-1';
    if (progEl) progEl.textContent = (profile.program || 'Stanford University') + ' — Ophthalmology';

    // Goals display
    let goalsEl = document.getElementById('profileGoalsDisplay');
    if (goalsEl) {
        if (profile.goals) {
            goalsEl.innerHTML = '<p style="color:#1e293b; font-size:14px; line-height:1.7">' + profile.goals + '</p>';
        } else {
            goalsEl.innerHTML = '<p style="color:#94a3b8; font-size:14px">No goals set yet — add them above!</p>';
        }
    }

    // Residency timeline
    if (profile.startYear && profile.endYear) {
        let now     = new Date().getFullYear();
        let total   = profile.endYear - profile.startYear;
        let done    = now - profile.startYear;
        let pct     = Math.min(Math.round((done / total) * 100), 100);
        let timeEl  = document.getElementById('profileStats');
        if (timeEl) {
            timeEl.innerHTML =
                '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">📅</div><h3>' + profile.startYear + '</h3><p>Start Year</p></div>' +
                '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">🎓</div><h3>' + profile.endYear + '</h3><p>End Year</p></div>' +
                '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">⏳</div><h3>' + pct + '%</h3><p>Residency Done</p></div>';
        }
    }

    // Welcome card name
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
    document.getElementById('editNotes').value         = c.notes || '';
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
        notes:         document.getElementById('editNotes').value
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

function showTab(tab, e) {
    document.getElementById('dashboard').style.display    = 'none';
    document.getElementById('logCase').style.display      = 'none';
    document.getElementById('caseListTab').style.display  = 'none';
    document.getElementById('analyticsTab').style.display = 'none';
    document.getElementById('profileTab').style.display   = 'none';
    document.getElementById('adminPanel').style.display   = 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));

    if (tab === 'dashboard') {
        document.getElementById('dashboard').style.display = 'block';
    } else if (tab === 'logCase') {
        document.getElementById('logCase').style.display = 'block';
        loadTemplates();
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
    } else if (tab === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminData();
    }

    if (e && e.target) e.target.classList.add('active-tab');
}

async function loadProfileEmail() {
    let { data: { user } } = await db.auth.getUser();
    let el = document.getElementById('profileEmail');
    if (el && user) el.textContent = '📧 ' + user.email;
}

function loadProfileCaseStats() {
    let total      = allCases.length;
    let totalReq   = Object.values(acgme).reduce((a,b)=>a+b,0);
    let pct        = Math.min(Math.round((total/totalReq)*100),100);
    let primary    = allCases.filter(c => c.role === 'Primary Surgeon').length;
    let streak     = localStorage.getItem('streak') || 0;

    let statsEl = document.getElementById('profileStats');
    if (statsEl) {
        statsEl.innerHTML =
            '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">📋</div><h3>' + total + '</h3><p>Total Cases</p></div>' +
            '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">🏆</div><h3>' + pct + '%</h3><p>ACGME Done</p></div>' +
            '<div class="summary-card"><div style="font-size:24px;margin-bottom:4px">🔥</div><h3>' + streak + '</h3><p>Day Streak</p></div>';
    }
}

async function signUp() {
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    if (!email || !password) { showToast('⚠️ Enter email and password', 'warning'); return; }
    showLoading();
    let { error } = await db.auth.signUp({ email, password });
    hideLoading();
    if (error) { showToast(error.message, 'error'); }
    else { showToast('Account created! Please sign in.'); }
}

async function signIn() {
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    if (!email || !password) { showToast('⚠️ Enter email and password', 'warning'); return; }
    showLoading();
    let { error } = await db.auth.signInWithPassword({ email, password });
    hideLoading();
    if (error) { showToast(error.message, 'error'); }
    else { showApp(); }
}

async function signOut() {
    await db.auth.signOut();
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display   = 'none';
}

async function showApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appSection').style.display   = 'block';
    let { data: { user } } = await db.auth.getUser();
    let { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
    currentUserRole = profile ? profile.role : 'resident';
    if (currentUserRole === 'admin') {
        document.getElementById('adminTab').style.display = 'inline-block';
    }
    let savedProfile = JSON.parse(localStorage.getItem('userProfile')) || {};
    if (savedProfile.name) document.getElementById('residentName').value = savedProfile.name;
    updateProfileDisplay();
    loadCases();
}

db.auth.getSession().then(({ data }) => {
    if (data.session) { showApp(); }
});

document.addEventListener('DOMContentLoaded', function() {
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
        let { error } = await db.from('cases').insert({
            procedure:     document.getElementById('procedure').value,
            role:          document.getElementById('role').value,
            date:          document.getElementById('date').value,
            notes:         document.getElementById('notes').value,
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
    let { data: cases } = await db.from('cases').select('*').eq('user_id', user.id);
    allCases = cases || [];
    updateDashboard(allCases);
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

async function loadAdminData() {
    showLoading();
    let { data: cases }    = await db.from('cases').select('*');
    let { data: profiles } = await db.from('profiles').select('*');
    hideLoading();
    let html = '<h2>👨‍⚕️ Program Director Panel</h2><h3>All Residents</h3><table>';
    html += '<tr><th>Name</th><th>Email</th><th>PGY</th><th>Total</th><th>Cataract</th><th>VR</th><th>Glaucoma</th><th>Progress</th></tr>';
    if (profiles) {
        for (let profile of profiles) {
            if (profile.role === 'resident') {
                let uc      = cases ? cases.filter(c => c.user_id === profile.id) : [];
                let total   = uc.length;
                let percent = Math.min(Math.round((total / Object.values(acgme).reduce((a,b)=>a+b,0)) * 100), 100);
                let name    = uc.length > 0 && uc[0].resident_name ? uc[0].resident_name : '-';
                let pgy     = uc.length > 0 && uc[0].pgy_year ? uc[0].pgy_year : '-';
                html += '<tr><td>' + name + '</td><td>' + profile.email + '</td><td>' + pgy + '</td><td>' + total + '</td>';
                html += '<td>' + uc.filter(c=>c.procedure==='Cataract / Phaco').length + '/86</td>';
                html += '<td>' + uc.filter(c=>c.procedure==='Vitreoretinal (PPV)').length + '/25</td>';
                html += '<td>' + uc.filter(c=>c.procedure==='Glaucoma').length + '/25</td>';
                html += '<td>' + percent + '%</td></tr>';
            }
        }
    }
    html += '</table>';
    document.getElementById('adminPanel').innerHTML = html;
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
}

function displayCaseList(cases) {
    let html = '<h2>Saved Cases</h2><table>';
    html += '<tr><th>Resident</th><th>PGY</th><th>Procedure</th><th>Role</th><th>Date</th><th>Attending</th><th>Hospital</th><th>Notes</th><th>Actions</th></tr>';
    for (let i = 0; i < cases.length; i++) {
        html += '<tr>';
        html += '<td>' + (cases[i].resident_name || '-') + '</td>';
        html += '<td>' + (cases[i].pgy_year || '-') + '</td>';
        html += '<td>' + cases[i].procedure + '</td>';
        html += '<td>' + cases[i].role + '</td>';
        html += '<td>' + cases[i].date + '</td>';
        html += '<td>' + (cases[i].attending || '-') + '</td>';
        html += '<td>' + (cases[i].hospital || '-') + '</td>';
        html += '<td>' + (cases[i].notes || '-') + '</td>';
        html += '<td style="white-space:nowrap">';
        html += '<button onclick="openEditModal(\'' + cases[i].id + '\')" style="background:#2563eb; padding:6px 8px; font-size:12px; margin:0 2px; width:auto; border-radius:6px">✏️</button>';
        html += '<button onclick="duplicateCase(\'' + cases[i].id + '\')" style="background:#7c3aed; padding:6px 8px; font-size:12px; margin:0 2px; width:auto; border-radius:6px">🔄</button>';
        html += '<button onclick="deleteCase(\'' + cases[i].id + '\')" style="background:#dc2626; padding:6px 8px; font-size:12px; margin:0 2px; width:auto; border-radius:6px">🗑️</button>';
        html += '</td></tr>';
    }
    html += '</table>';
    document.getElementById('caseList').innerHTML = html;
}

function applyFilter() {
    let search    = document.getElementById('searchNotes').value.toLowerCase();
    let procedure = document.getElementById('filterProcedure').value;
    let role      = document.getElementById('filterRole').value;
    let dateFrom  = document.getElementById('filterDateFrom').value;
    let dateTo    = document.getElementById('filterDateTo').value;
    let filtered  = allCases.filter(c =>
        (search === '' || (c.notes && c.notes.toLowerCase().includes(search)) ||
        (c.resident_name && c.resident_name.toLowerCase().includes(search)) ||
        (c.attending && c.attending.toLowerCase().includes(search)) ||
        (c.hospital && c.hospital.toLowerCase().includes(search))) &&
        (procedure === '' || c.procedure === procedure) &&
        (role      === '' || c.role === role) &&
        (dateFrom  === '' || c.date >= dateFrom) &&
        (dateTo    === '' || c.date <= dateTo)
    );
    displayCaseList(filtered);
}

function clearFilter() {
    document.getElementById('searchNotes').value     = '';
    document.getElementById('filterProcedure').value = '';
    document.getElementById('filterRole').value      = '';
    document.getElementById('filterDateFrom').value  = '';
    document.getElementById('filterDateTo').value    = '';
    displayCaseList(allCases);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(20); doc.setTextColor(44,62,80); doc.text('OphthoLog Report', 14, 20);
    doc.setFontSize(11); doc.setTextColor(100); doc.text('Generated: ' + new Date().toLocaleDateString(), 14, 30);
    doc.setFontSize(14); doc.setTextColor(44,62,80); doc.text('Case Log', 14, 45);
    doc.autoTable({ startY:50, head:[['Date','Procedure','Role','Attending','Hospital','Notes']], body:allCases.map(c=>[c.date,c.procedure,c.role,c.attending||'-',c.hospital||'-',c.notes||'-']), styles:{fontSize:9}, headStyles:{fillColor:[37,99,235]} });
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14); doc.setTextColor(44,62,80); doc.text('ACGME Progress Summary', 14, finalY);
    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of allCases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }
    doc.autoTable({ startY:finalY+5, head:[['Procedure','Done','Required','Progress']], body:Object.keys(acgme).map(p=>[p,counts[p],acgme[p],Math.min(Math.round((counts[p]/acgme[p])*100),100)+'%']), styles:{fontSize:9}, headStyles:{fillColor:[37,99,235]} });
    doc.save('ophtholog-report.pdf');
}

function exportMonthlyReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let now = new Date();
    let thisMonth = now.toISOString().slice(0,7);
    let lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
    let monthName = now.toLocaleString('default', {month:'long', year:'numeric'});
    let thisMonthCases = allCases.filter(c => c.date && c.date.startsWith(thisMonth));
    let lastMonthCases = allCases.filter(c => c.date && c.date.startsWith(lastMonth));
    doc.setFillColor(140,21,21); doc.rect(0,0,220,35,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.text('OphthoLog', 14, 15);
    doc.setFontSize(14); doc.text('Monthly Progress Report — ' + monthName, 14, 27);
    doc.setTextColor(44,62,80); doc.setFontSize(14); doc.text('Monthly Summary', 14, 50);
    let totalReq = Object.values(acgme).reduce((a,b)=>a+b,0);
    let overallPct = Math.min(Math.round((allCases.length/totalReq)*100),100);
    doc.autoTable({ startY:55, head:[['Metric','This Month','Last Month','Total']], body:[['Cases Logged',thisMonthCases.length,lastMonthCases.length,allCases.length],['ACGME Progress','-','-',overallPct+'%']], styles:{fontSize:10}, headStyles:{fillColor:[140,21,21]} });
    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14); doc.text('Cases by Procedure', 14, finalY);
    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of thisMonthCases) { if (counts[c.procedure] !== undefined) { counts[c.procedure]++; } }
    doc.autoTable({ startY:finalY+5, head:[['Procedure','This Month','Required','Overall %']], body:Object.keys(acgme).map(p=>[p,counts[p],acgme[p],Math.min(Math.round((allCases.filter(c=>c.procedure===p).length/acgme[p])*100),100)+'%']), styles:{fontSize:9}, headStyles:{fillColor:[140,21,21]} });
    if (thisMonthCases.length > 0) {
        let y2 = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14); doc.text('Case Details', 14, y2);
        doc.autoTable({ startY:y2+5, head:[['Date','Procedure','Role','Attending','Hospital','Notes']], body:thisMonthCases.map(c=>[c.date,c.procedure,c.role,c.attending||'-',c.hospital||'-',c.notes||'-']), styles:{fontSize:8}, headStyles:{fillColor:[140,21,21]} });
    }
    let pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(9); doc.setTextColor(150);
        doc.text('Generated by OphthoLog — ' + new Date().toLocaleDateString(), 14, doc.internal.pageSize.height - 10);
    }
    doc.save('ophtholog-monthly-' + thisMonth + '.pdf');
}

async function setupNotifications() {
    if (!('Notification' in window)) { showToast('Notifications not supported', 'error'); return; }
    let permission = await Notification.requestPermission();
    if (permission === 'granted') { showToast('🔔 Daily reminders enabled!'); scheduleReminder(); }
    else { showToast('Notifications blocked', 'warning'); }
}

function scheduleReminder() {
    setInterval(function() {
        let now = new Date();
        let lastReminder = localStorage.getItem('lastReminder');
        let today = now.toDateString();
        if (now.getHours() >= 18 && lastReminder !== today) {
            localStorage.setItem('lastReminder', today);
            new Notification('OphthoLog Reminder 🏥', { body: 'Don\'t forget to log your cases today!', icon: '/icon.svg' });
        }
    }, 60 * 60 * 1000);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js');
    });
}