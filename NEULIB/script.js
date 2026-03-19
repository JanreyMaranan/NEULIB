const SB_URL = 'https://plmwuwcvjbrspogdivmf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbXd1d2N2amJyc3BvZ2Rpdm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjg3MTQsImV4cCI6MjA4OTQwNDcxNH0.WfcZyXopfb9CHUvim2vG08qqAL-TWe16shbV3W0Dr1k'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

const ADMIN_EMAILS = ["admin2@neu.edu.ph", "jcesperanza@neu.edu.ph"];
const ADMIN_PASSWORD = "staff_password123";

let logs = [];
let blockedUsers = [];
let currentFilter = 'today';
let toastTimer;

function togglePasswordVisibility() {
    const passInput = document.getElementById('admin-password');
    const eyeIcon = document.getElementById('eye-icon');
    if (passInput.type === "password") {
        passInput.type = "text";
        eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        passInput.type = "password";
        eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function showToast(msg, type = 'success') {
    clearTimeout(toastTimer);
    const container = document.getElementById('toast-container');
    document.getElementById('toast-text').innerText = msg;
    container.className = `show toast-${type}`;
    toastTimer = setTimeout(() => hideToast(), 4000);
}

function hideToast() {
    const container = document.getElementById('toast-container');
    if (container) container.classList.remove('show');
}

function setDateFilter(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`f-${type}`).classList.add('active');
    document.getElementById('custom-date-inputs').classList.toggle('hidden', type !== 'range');
    fetchData();
}

async function handleAdminLogin() {
    const email = document.getElementById('admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('admin-password').value;
    if (ADMIN_EMAILS.includes(email) && pass === ADMIN_PASSWORD) {
        document.getElementById('last-login-time').innerText = localStorage.getItem('neu_admin_last') || "First Access";
        localStorage.setItem('neu_admin_last', new Date().toLocaleString());
        showToast("Access Granted", "success");
        document.getElementById('staff-login-container').classList.add('hidden');
        document.getElementById('main-header').classList.add('hidden');
        document.getElementById('admin-container').classList.remove('hidden');
        fetchData();
    } else {
        showToast("Invalid Credentials", "error");
    }
}

async function fetchData() {
    const { data: allData } = await _supabase.from('visitor_logs').select('*');
    const { data: bData } = await _supabase.from('blocked_users').select('*');
    
    const unfilteredLogs = allData || [];
    blockedUsers = bData || [];

    const today = new Date(); today.setHours(0,0,0,0);

    logs = unfilteredLogs.filter(log => {
        const d = new Date(log.visit_date); d.setHours(0,0,0,0);
        if (currentFilter === 'today') return d.getTime() === today.getTime();
        if (currentFilter === 'week') {
            const start = new Date(today); start.setDate(today.getDate() - today.getDay());
            return d >= start && d <= today;
        }
        if (currentFilter === 'range') {
            const s = new Date(document.getElementById('start-date').value);
            const e = new Date(document.getElementById('end-date').value);
            if (!isNaN(s)) { s.setHours(0,0,0,0); e.setHours(23,59,59); return d >= s && d <= e; }
        }
        return true;
    });

    updateStats();
    renderTable();
    renderBlockedTable();
}

async function processEntry() {
    const email = document.getElementById('v-email').value.trim().toLowerCase();
    const name = document.getElementById('v-name').value.trim();
    const program = document.getElementById('v-program').value.trim();
    const reason = document.getElementById('v-reason').value;

    if (!name || !email || !program || !reason) return showToast("Fill all fields", "error");
    if (blockedUsers.some(b => b.email === email)) return showToast("Access Denied: Blocked", "error");

    const active = logs.find(l => l.email === email && !l.exit_time);
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    if (active) {
        await _supabase.from('visitor_logs').update({ exit_time: time }).eq('id', active.id);
        showToast(`Goodbye, ${name}!`, "info");
    } else {
        await _supabase.from('visitor_logs').insert([{ name, email, program, reason, entry_time: time, visit_date: new Date().toDateString() }]);
        showToast(`Welcome, ${name}!`, "success");
    }
    fetchData();
}

async function blockUser(email) {
    const reason = prompt("Reason for block:");
    if (reason) {
        await _supabase.from('blocked_users').insert([{ email, block_reason: reason, date_blocked: new Date().toLocaleString() }]);
        fetchData();
    }
}

async function unblockUser(email) {
    await _supabase.from('blocked_users').delete().eq('email', email);
    fetchData();
}

function renderTable() {
    const body = document.getElementById('table-body');
    body.innerHTML = "";
    logs.slice().reverse().forEach(l => {
        const isB = blockedUsers.some(b => b.email === l.email);
        const action = isB ? `<button class="btn-success" onclick="unblockUser('${l.email}')">Unblock</button>` : `<button class="btn-danger" onclick="blockUser('${l.email}')">Block</button>`;
        const status = l.exit_time ? `<span class="status-out">OUT</span>` : `<span class="status-in">IN</span>`;
        body.innerHTML += `<tr><td>${l.name}</td><td>${l.program}</td><td>${l.reason}</td><td>${l.entry_time}</td><td>${l.exit_time || '--'}</td><td>${l.visit_date}</td><td>${status}</td><td>${action}</td></tr>`;
    });
}

function renderBlockedTable() {
    const body = document.getElementById('blocked-table-body');
    body.innerHTML = "";
    blockedUsers.forEach(u => {
        body.innerHTML += `<tr><td>${u.email}</td><td style="color:red; font-weight:bold">${u.block_reason}</td><td>${u.date_blocked}</td><td><button class="btn-success" onclick="unblockUser('${u.email}')">Unblock</button></td></tr>`;
    });
}

function updateStats() {
    document.getElementById('s-active').innerText = logs.filter(l => !l.exit_time).length;
    document.getElementById('s-total').innerText = logs.length;
    document.getElementById('s-blocked').innerText = blockedUsers.length;
}

function showStaffLogin() { document.getElementById('login-container').classList.add('hidden'); document.getElementById('staff-login-container').classList.remove('hidden'); }
function showVisitorLogin() { document.getElementById('staff-login-container').classList.add('hidden'); document.getElementById('login-container').classList.remove('hidden'); }
function switchTab(t) { document.getElementById('view-logs').classList.toggle('hidden', t !== 'logs'); document.getElementById('view-blocked').classList.toggle('hidden', t !== 'blocked'); document.getElementById('tab-logs').classList.toggle('active', t === 'logs'); document.getElementById('tab-blocked').classList.toggle('active', t === 'blocked'); }
async function clearAllLogs() { if(confirm("Clear all?")) { await _supabase.from('visitor_logs').delete().gt('id',0); fetchData(); } }
function exportPDF() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("NEU Library Logs", 14, 15); const data = logs.map(l => [l.name, l.program, l.entry_time, l.exit_time || 'IN', l.visit_date]); doc.autoTable({ head: [['Name', 'Prog', 'In', 'Out', 'Date']], body: data, startY: 20 }); doc.save("Library_Report.pdf"); }

fetchData();