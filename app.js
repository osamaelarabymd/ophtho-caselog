// Load saved cases
// حمّل الكيسات المحفوظة
let cases = JSON.parse(localStorage.getItem('cases')) || [];

// ACGME requirements
// متطلبات ACGME
const acgme = {
    'Cataract / Phaco': 86,
    'Vitreoretinal (PPV)': 25,
    'Glaucoma': 25,
    'Cornea / Keratoplasty': 35,
    'Oculoplastics': 20,
    'Strabismus': 26,
    'Laser (LIO / SLT / YAG)': 25
};

// Save button click
// لما الزرار يتضغط
document.getElementById('saveBtn').addEventListener('click', function() {
    let newCase = {
        procedure: document.getElementById('procedure').value,
        role:      document.getElementById('role').value,
        date:      document.getElementById('date').value,
        notes:     document.getElementById('notes').value
    };
    cases.push(newCase);
    localStorage.setItem('cases', JSON.stringify(cases));
    displayAll();
});

// Delete a case
// احذف كيس
function deleteCase(index) {
    cases.splice(index, 1);
    localStorage.setItem('cases', JSON.stringify(cases));
    displayAll();
}

// Display cases + stats
// اعرض الكيسات والإحصائيات
function displayAll() {

    // --- Table ---
    let tableHtml = '<h2>Saved Cases (الكيسات المحفوظة)</h2>';
    tableHtml += '<table>';
    tableHtml += '<tr><th>Procedure</th><th>Role</th><th>Date</th><th>Notes</th><th>Action</th></tr>';
    for (let i = 0; i < cases.length; i++) {
        tableHtml += '<tr>';
        tableHtml += '<td>' + cases[i].procedure + '</td>';
        tableHtml += '<td>' + cases[i].role + '</td>';
        tableHtml += '<td>' + cases[i].date + '</td>';
        tableHtml += '<td>' + cases[i].notes + '</td>';
        tableHtml += '<td><button onclick="deleteCase(' + i + ')">Delete</button></td>';
        tableHtml += '</tr>';
    }
    tableHtml += '</table>';
    document.getElementById('caseList').innerHTML = tableHtml;

    // --- Stats ---
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

// Run on page load
// شغّل لما الصفحة تفتح
displayAll();