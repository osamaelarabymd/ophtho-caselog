const SUPABASE_URL = 'https://wvopihnkbdbasykvtkxf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2b3BpaG5rYmRiYXN5a3Z0a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODM4NjUsImV4cCI6MjA5Mzk1OTg2NX0.zpdRwihfqdBaFwEInE5gE034SD7rGaSNB8HIXFXOHfs';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let allCases = [];

const acgme = {
    'Cataract / Phaco': 86,
    'Vitreoretinal (PPV)': 25,
    'Glaucoma': 25,
    'Cornea / Keratoplasty': 35,
    'Oculoplastics': 20,
    'Strabismus': 26,
    'Laser (LIO / SLT / YAG)': 25
};

// Sign Up
async function signUp() {
    let email    = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let { error } = await db.auth.signUp({ email, password });
    if (error) { alert(error.message); }
    else { alert('Account created! Please sign in.'); }
}

// Sign In
async function signIn() {
    let email    = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let { error } = await db.auth.signInWithPassword({ email, password });
    if (error) { alert(error.message); }
    else { showApp(); }
}

// Sign Out
async function signOut() {
    await db.auth.signOut();
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('appSection').style.display   = 'none';
}

// Show app after login
function showApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appSection').style.display   = 'block';
    loadCases();
}

// Check if already logged in
db.auth.getSession().then(({ data }) => {
    if (data.session) { showApp(); }
});

// Save case
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('saveBtn').addEventListener('click', async function() {
        let { data: { user } } = await db.auth.getUser();
        let pgy   = document.getElementById('pgyYear').value;
        let name  = document.getElementById('residentName').value;
        let notes = document.getElementById('notes').value;
        let { error } = await db.from('cases').insert({
            procedure: document.getElementById('procedure').value,
            role:      document.getElementById('role').value,
            date:      document.getElementById('date').value,
            notes:     pgy + ' - ' + name + ' - ' + notes,
            user_id:   user.id
        });
        if (error) { alert(error.message); }
        else { loadCases(); }
    });
});

// Load cases
async function loadCases() {
    let { data: { user } } = await db.auth.getUser();
    let { data: cases } = await db.from('cases').select('*').eq('user_id', user.id);
    allCases = cases || [];
    displayAll(allCases);
}

// Delete a case
async function deleteCase(id) {
    await db.from('cases').delete().eq('id', id);
    loadCases();
}

// Export PDF
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('Ophtho CaseLog Report', 14, 20);

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
        headStyles: { fillColor: [52, 152, 219] }
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
        p,
        counts[p],
        acgme[p],
        Math.min(Math.round((counts[p] / acgme[p]) * 100), 100) + '%'
    ]);

    doc.autoTable({
        startY: finalY + 5,
        head: [['Procedure', 'Done', 'Required', 'Progress']],
        body: progressData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [52, 152, 219] }
    });

    doc.save('ophtho-caselog-report.pdf');
}

// Apply filter
function applyFilter() {
    let search    = document.getElementById('searchNotes').value.toLowerCase();
    let procedure = document.getElementById('filterProcedure').value;
    let role      = document.getElementById('filterRole').value;
    let dateFrom  = document.getElementById('filterDateFrom').value;
    let dateTo    = document.getElementById('filterDateTo').value;

    let filtered = allCases.filter(c => {
        let matchSearch    = search    === '' || (c.notes && c.notes.toLowerCase().includes(search));
        let matchProcedure = procedure === '' || c.procedure === procedure;
        let matchRole      = role      === '' || c.role === role;
        let matchDateFrom  = dateFrom  === '' || c.date >= dateFrom;
        let matchDateTo    = dateTo    === '' || c.date <= dateTo;
        return matchSearch && matchProcedure && matchRole && matchDateFrom && matchDateTo;
    });

    displayAll(filtered);
}

// Clear filter
function clearFilter() {
    document.getElementById('searchNotes').value     = '';
    document.getElementById('filterProcedure').value = '';
    document.getElementById('filterRole').value      = '';
    document.getElementById('filterDateFrom').value  = '';
    document.getElementById('filterDateTo').value    = '';
    displayAll(allCases);
}

// Display cases + stats
function displayAll(cases) {
    let tableHtml = '<h2>Saved Cases (الكيسات المحفوظة)</h2>';
    tableHtml += '<table>';
    tableHtml += '<tr><th>Procedure</th><th>Role</th><th>Date</th><th>Notes</th><th>Action</th></tr>';
    for (let i = 0; i < cases.length; i++) {
        tableHtml += '<tr>';
        tableHtml += '<td>' + cases[i].procedure + '</td>';
        tableHtml += '<td>' + cases[i].role + '</td>';
        tableHtml += '<td>' + cases[i].date + '</td>';
        tableHtml += '<td>' + cases[i].notes + '</td>';
        tableHtml += '<td><button onclick="deleteCase(\'' + cases[i].id + '\')">Delete</button></td>';
        tableHtml += '</tr>';
    }
    tableHtml += '</table>';
    document.getElementById('caseList').innerHTML = tableHtml;

    let counts = {};
    for (let p in acgme) { counts[p] = 0; }
    for (let i = 0; i < cases.length; i++) {
        let p = cases[i].procedure;
        if (counts[p] !== undefined) { counts[p]++; }
    }
    let statsHtml = '<h2>ACGME Progress (التقدم)</h2>';
    for (let p in acgme) {
        let done    = counts[p];
        let req     = acgme[p];
        let percent = Math.min(Math.round((done / req) * 100), 100);
        statsHtml += '<div class="stat-row">';
        statsHtml += '<p><strong>' + p + '</strong>: ' + done + ' / ' + req + '</p>';
        statsHtml += '<div class="progress-bar">';
        statsHtml += '<div class="progress-fill" style="width:' + percent + '%">' + percent + '%</div>';
        statsHtml += '</div></div>';
    }
    document.getElementById('stats').innerHTML = statsHtml;
}