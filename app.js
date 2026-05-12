const SUPABASE_URL = 'https://wvopihnkbdbasykvtkxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2b3BpaG5rYmRiYXN5a3Z0a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODM4NjUsImV4cCI6MjA5Mzk1OTg2NX0.zpdRwihfqdBaFwEInE5gE034SD7rGaSNB8HIXFXOHfs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let allCases = [];
let procedureChart = null;
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

// Onboarding
function checkOnboarding() {
    let seen = localStorage.getItem('onboardingSeen');
    if (!seen) {
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

window.addEventListener('load', checkOnboarding);

function showTab(tab) {
    document.getElementById('dashboard').style.display   = 'none';
    document.getElementById('logCase').style.display     = 'none';
    document.getElementById('caseListTab').style.display = 'none';
    document.getElementById('adminPanel').style.display  = 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
    if (tab === 'dashboard') {
        document.getElementById('dashboard').style.display = 'block';
    } else if (tab === 'logCase') {
        document.getElementById('logCase').style.display = 'block';
    } else if (tab === 'caseList') {
        document.getElementById('caseListTab').style.display = 'block';
        displayCaseList(allCases);
    } else if (tab === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminData();
    }
    event.target.classList.add('active-tab');
}

async function signUp() {
    let email    = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let { error } = await db.auth.signUp({ email, password });
    if (error) { alert(error.message); }
    else { alert('Account created! Please sign in.'); }
}

async function signIn() {
    let email    = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let { error } = await db.auth.signInWithPassword({ email, password });
    if (error) { alert(error.message); }
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
    loadCases();
}

db.auth.getSession().then(({ data }) => {
    if (data.session) { showApp(); }
});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveBtn').addEventListener('click', async function() {
        let { data: { user } } = await db.auth.getUser();
        let pgy       = document.getElementById('pgyYear').value;
        let name      = document.getElementById('residentName').value;
        let attending = document.getElementById('attending').value;
        let hospital  = document.getElementById('hospital').value;
        let notes     = document.getElementById('notes').value;
        let { error } = await db.from('cases').insert({
            procedure: document.getElementById('procedure').value,
            role:      document.getElementById('role').value,
            date:      document.getElementById('date').value,
            notes:     pgy + ' | ' + name + ' | Attending: ' + attending + ' | Hospital: ' + hospital + ' | ' + notes,
            user_id:   user.id
        });
        if (error) { alert(error.message); }
        else { alert('Case saved!'); loadCases(); }
    });
});

async function loadCases() {
    let { data: { user } } = await db.auth.getUser();
    let { data: cases } = await db.from('cases').select('*').eq('user_id', user.id);
    allCases = cases || [];
    updateDashboard(allCases);
}

async function deleteCase(id) {
    await db.from('cases').delete().eq('id', id);
    loadCases();
}

async function loadAdminData() {
    let { data: cases }    = await db.from('cases').select('*');
    let { data: profiles } = await db.from('profiles').select('*');
    let html = '<h2>👨‍⚕️ Program Director Panel</h2>';
    html += '<h3>All Residents</h3>';
    html += '<table>';
    html += '<tr><th>Email</th><th>Total Cases</th><th>Cataract</th><th>Vitreoretinal</th><th>Glaucoma</th><th>Progress</th></tr>';
    if (profiles) {
        for (let profile of profiles) {
            if (profile.role === 'resident') {
                let userCases = cases ? cases.filter(c => c.user_id === profile.id) : [];
                let cataract  = userCases.filter(c => c.procedure === 'Cataract / Phaco').length;
                let vr        = userCases.filter(c => c.procedure === 'Vitreoretinal (PPV)').length;
                let glaucoma  = userCases.filter(c => c.procedure === 'Glaucoma').length;
                let total     = userCases.length;
                let totalReq  = Object.values(acgme).reduce((a, b) => a + b, 0);
                let percent   = Math.min(Math.round((total / totalReq) * 100), 100);
                html += '<tr>';
                html += '<td>' + profile.email + '</td>';
                html += '<td>' + total + '</td>';
                html += '<td>' + cataract + '/86</td>';
                html += '<td>' + vr + '/25</td>';
                html += '<td>' + glaucoma + '/25</td>';
                html += '<td>' + percent + '%</td>';
                html += '</tr>';
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
    document.getElementById('summaryCards').innerHTML =
        '<div class="summary-card"><h3>' + totalDone + '</h3><p>Total Cases</p></div>' +
        '<div class="summary-card"><h3>' + monthCases.length + '</h3><p>This Month</p></div>' +
        '<div class="summary-card"><h3>' + overallPercent + '%</h3><p>Overall ACGME Progress</p></div>' +
        '<div class="summary-card"><h3>' + Object.keys(acgme).length + '</h3><p>Procedure Types</p></div>';
    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of cases) {
        if (counts[c.procedure] !== undefined) { counts[c.procedure]++; }
    }
    if (procedureChart) { procedureChart.destroy(); }
    let ctx = document.getElementById('procedureChart').getContext('2d');
    procedureChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(counts),
            datasets: [
                { label: 'Cases Done', data: Object.values(counts), backgroundColor: '#2563eb' },
                { label: 'Required',   data: Object.values(acgme),  backgroundColor: '#e2e8f0' }
            ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
    let statsHtml = '';
    for (let p in acgme) {
        let done    = counts[p];
        let req     = acgme[p];
        let percent = Math.min(Math.round((done / req) * 100), 100);
        statsHtml += '<div class="stat-row"><p><strong>' + p + '</strong>: ' + done + ' / ' + req + '</p>';
        statsHtml += '<div class="progress-bar"><div class="progress-fill" style="width:' + percent + '%"></div></div></div>';
    }
    document.getElementById('stats').innerHTML = statsHtml;
}

function displayCaseList(cases) {
    let html = '<h2>Saved Cases</h2><table>';
    html += '<tr><th>Procedure</th><th>Role</th><th>Date</th><th>Notes</th><th>Action</th></tr>';
    for (let i = 0; i < cases.length; i++) {
        html += '<tr><td>' + cases[i].procedure + '</td><td>' + cases[i].role + '</td><td>' + cases[i].date + '</td><td>' + cases[i].notes + '</td>';
        html += '<td><button onclick="deleteCase(\'' + cases[i].id + '\')">Delete</button></td></tr>';
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
    let filtered  = allCases.filter(c => {
        return (search    === '' || (c.notes && c.notes.toLowerCase().includes(search))) &&
               (procedure === '' || c.procedure === procedure) &&
               (role      === '' || c.role === role) &&
               (dateFrom  === '' || c.date >= dateFrom) &&
               (dateTo    === '' || c.date <= dateTo);
    });
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
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('OphthoLog Report', 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text('Generated: ' + new Date().toLocaleDateString(), 14, 30);
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('Case Log', 14, 45);
    doc.autoTable({
        startY: 50,
        head: [['Procedure', 'Role', 'Date', 'Notes']],
        body: allCases.map(c => [c.procedure, c.role, c.date, c.notes]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] }
    });
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('ACGME Progress Summary', 14, finalY);
    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of allCases) {
        if (counts[c.procedure] !== undefined) { counts[c.procedure]++; }
    }
    let progressData = Object.keys(acgme).map(p => [
        p, counts[p], acgme[p],
        Math.min(Math.round((counts[p] / acgme[p]) * 100), 100) + '%'
    ]);
    doc.autoTable({
        startY: finalY + 5,
        head: [['Procedure', 'Done', 'Required', 'Progress']],
        body: progressData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save('ophtholog-report.pdf');
}

function exportMonthlyReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let now           = new Date();
    let thisMonth     = now.toISOString().slice(0, 7);
    let lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let lastMonth     = lastMonthDate.toISOString().slice(0, 7);
    let monthName     = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    let thisMonthCases = allCases.filter(c => c.date && c.date.startsWith(thisMonth));
    let lastMonthCases = allCases.filter(c => c.date && c.date.startsWith(lastMonth));
    doc.setFillColor(140, 21, 21);
    doc.rect(0, 0, 220, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('OphthoLog', 14, 15);
    doc.setFontSize(14);
    doc.text('Monthly Progress Report — ' + monthName, 14, 27);
    doc.setTextColor(44, 62, 80);
    doc.setFontSize(14);
    doc.text('Monthly Summary', 14, 50);
    let totalReq   = Object.values(acgme).reduce((a, b) => a + b, 0);
    let totalDone  = allCases.length;
    let overallPct = Math.min(Math.round((totalDone / totalReq) * 100), 100);
    doc.autoTable({
        startY: 55,
        head: [['Metric', 'This Month', 'Last Month', 'Total to Date']],
        body: [
            ['Cases Logged', thisMonthCases.length, lastMonthCases.length, totalDone],
            ['ACGME Progress', '-', '-', overallPct + '%']
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [140, 21, 21] }
    });
    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text('This Month — Cases by Procedure', 14, finalY);
    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let c of thisMonthCases) {
        if (counts[c.procedure] !== undefined) { counts[c.procedure]++; }
    }
    let monthData = Object.keys(acgme).map(p => [
        p, counts[p], acgme[p],
        Math.min(Math.round((allCases.filter(c => c.procedure === p).length / acgme[p]) * 100), 100) + '%'
    ]);
    doc.autoTable({
        startY: finalY + 5,
        head: [['Procedure', 'This Month', 'Required Total', 'Overall Progress']],
        body: monthData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [140, 21, 21] }
    });
    if (thisMonthCases.length > 0) {
        let y2 = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('This Month — Case Details', 14, y2);
        doc.autoTable({
            startY: y2 + 5,
            head: [['Date', 'Procedure', 'Role', 'Notes']],
            body: thisMonthCases.map(c => [c.date, c.procedure, c.role, c.notes]),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [140, 21, 21] }
        });
    }
    let pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text('Generated by OphthoLog — ' + new Date().toLocaleDateString(), 14, doc.internal.pageSize.height - 10);
    }
    doc.save('ophtholog-monthly-' + thisMonth + '.pdf');
}

async function setupNotifications() {
    if (!('Notification' in window)) {
        alert('Your browser does not support notifications');
        return;
    }
    let permission = await Notification.requestPermission();
    if (permission === 'granted') {
        alert('Notifications enabled! You will get daily reminders at 6 PM.');
        scheduleReminder();
    } else {
        alert('Notifications blocked. Please enable them in your browser settings.');
    }
}

function scheduleReminder() {
    setInterval(function() {
        let now          = new Date();
        let hour         = now.getHours();
        let lastReminder = localStorage.getItem('lastReminder');
        let today        = now.toDateString();
        if (hour >= 18 && lastReminder !== today) {
            localStorage.setItem('lastReminder', today);
            new Notification('OphthoLog Reminder 🏥', {
                body: 'Don\'t forget to log your cases today!',
                icon: '/icon.svg'
            });
        }
    }, 60 * 60 * 1000);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js');
    });
}