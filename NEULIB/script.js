// CONFIGURATION
const SB_URL = 'https://plmwuwcvjbrspogdivmf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbXd1d2N2amJyc3BvZ2Rpdm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjg3MTQsImV4cCI6MjA4OTQwNDcxNH0.WfcZyXopfb9CHUvim2vG08qqAL-TWe16shbV3W0Dr1k'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

const ADMIN_EMAILS = ["admin2@neu.edu.ph", "jcesperanza@neu.edu.ph"];
let logs = [];
let blockedUsers = [];
let toastTimer;

// NOTIFICATION LOGIC (Centered Popup)
function showToast(msg, type = 'success') {
    clearTimeout(toastTimer);
    const container = document.getElementById('toast-container');
    const text = document.getElementById('toast-text');
    
    if (!container || !text) return;

    text.innerText = msg;
    // Types: success (green), info (dark), error (red)
    container.className = `show toast-${type}`;
    
    // Auto-hide after 4 seconds
    toastTimer = setTimeout(() => hideToast(), 4000);
}

function hideToast() {
    const container = document.getElementById('toast-container');
    if (container) {
        container.classList.remove('show');
        setTimeout(() => { 
            if(!container.classList.contains('show')) container.className = 'toast-hidden'; 
        }, 300);
    }
}

// DATA FLOW
async function fetchData() {
    const { data: logData } = await _supabase.from('visitor_logs').select('*');
    const { data: blockData } = await _supabase.from('blocked_users').select('*');
    logs = logData || [];
    blockedUsers = blockData || [];
    updateStats();
    renderTable();
    renderBlockedTable();
}

async function processEntry() {
    const email = document.getElementById('v-email').value.trim().toLowerCase();
    
    if (ADMIN_EMAILS.includes(email)) {
        showAdmin();
        return;
    }

    const name = document.getElementById('v-name').value.trim();
    const program = document.getElementById('v-program').value.trim();
    const reason = document.getElementById('v-reason').value;

    if (!name || !email || !program || !reason) {
        showToast("Please fill all fields", "error");
        return;
    }

    if (blockedUsers.some(b => b.email === email)) {
        showToast("Access Denied: Your account is blocked", "error");
        return;
    }

    const active = logs.find(l => l.email === email && !l.exit_time);
    const timeNow = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    if (active) {
        await _supabase.from('visitor_logs').update({ exit_time: timeNow }).eq('id', active.id);
        showToast(`Goodbye, ${name}! See you Again!`, "info");
    } else {
        await _supabase.from('visitor_logs').insert([{
            name, email, program, reason, entry_time: timeNow, visit_date: new Date().toDateString()
        }]);
        showToast(`Welcome to NEU Library, ${name}!`, "success");
    }
    
    fetchData();
}

// ADMIN UI LOGIC
function switchTab(tab) {
    document.getElementById('view-logs').classList.toggle('hidden', tab !== 'logs');
    document.getElementById('view-blocked').classList.toggle('hidden', tab !== 'blocked');
    document.getElementById('tab-logs').classList.toggle('active', tab === 'logs');
    document.getElementById('tab-blocked').classList.toggle('active', tab === 'blocked');
}

function renderTable() {
    const searchInput = document.getElementById('search');
    const term = searchInput ? searchInput.value.toLowerCase() : "";
    const body = document.getElementById('table-body');
    if (!body) return;
    body.innerHTML = "";

    logs.filter(l => l.name.toLowerCase().includes(term)).reverse().forEach(l => {
        const isBlocked = blockedUsers.some(b => b.email === l.email);
        const actionBtn = isBlocked 
            ? `<button class="btn-success" onclick="unblockUser('${l.email}')">Unblock</button>`
            : `<button class="btn-danger" onclick="blockUser('${l.email}')">Block</button>`;

        body.innerHTML += `<tr>
            <td>${l.name}</td><td>${l.program}</td><td>${l.reason}</td>
            <td>${l.entry_time}</td><td>${l.exit_time || '--:--'}</td>
            <td><span class="badge ${l.exit_time ? '' : 'status-in'}">${l.exit_time ? 'OUT' : 'IN'}</span></td>
            <td>${actionBtn}</td>
        </tr>`;
    });
}

function renderBlockedTable() {
    const body = document.getElementById('blocked-table-body');
    if (!body) return;
    body.innerHTML = "";
    blockedUsers.forEach(u => {
        body.innerHTML += `<tr>
            <td>${u.email}</td><td>${u.date_blocked}</td>
            <td><button class="btn-success" onclick="unblockUser('${u.email}')">Unblock</button></td>
        </tr>`;
    });
}

async function blockUser(email) {
    if(!confirm(`Are you sure you want to block ${email}?`)) return;
    await _supabase.from('blocked_users').insert([{ email, date_blocked: new Date().toLocaleString() }]);
    showToast("User has been blocked", "error");
    fetchData();
}

async function unblockUser(email) {
    await _supabase.from('blocked_users').delete().eq('email', email);
    showToast("User has been unblocked", "success");
    fetchData();
}

function showAdmin() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('admin-container').classList.remove('hidden');
    fetchData();
}

function updateStats() {
    const today = new Date().toDateString();
    const activeCount = document.getElementById('s-active');
    const dayCount = document.getElementById('s-day');
    const blockedCount = document.getElementById('s-blocked');

    if (activeCount) activeCount.innerText = logs.filter(l => l.visit_date === today && !l.exit_time).length;
    if (dayCount) dayCount.innerText = logs.filter(l => l.visit_date === today).length;
    if (blockedCount) blockedCount.innerText = blockedUsers.length;
}
async function clearAllLogs() {
    // First Confirmation
    const confirmFirst = confirm("Are you sure you want to CLEAR ALL visitor logs? This cannot be undone.");
    
    if (confirmFirst) {
        // Second Confirmation for safety
        const confirmSecond = confirm("LAST WARNING: This will permanently delete every entry in the database. Proceed?");
        
        if (confirmSecond) {
            try {
                // Deletes all rows where ID is greater than 0 (effectively everything)
                const { error } = await _supabase
                    .from('visitor_logs')
                    .delete()
                    .gt('id', 0);

                if (error) throw error;

                showToast("All logs have been cleared successfully", "error");
                fetchData(); // Refresh the table and stats
            } catch (err) {
                console.error("Error clearing logs:", err);
                showToast("Failed to clear logs. Check console.", "error");
            }
        }
    }
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Add Title
    doc.setFontSize(18);
    doc.text("NEU Library Visitor Report", 14, 20);
    
    // 2. Add Generation Date
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    // 3. Prepare Table Data
    // We map the logs array into the format autoTable expects
    const tableData = logs.map(l => [
        l.name,
        l.program,
        l.reason,
        l.entry_time,
        l.exit_time || 'Still Inside',
        l.visit_date
    ]);

    // 4. Generate Table
    doc.autoTable({
        startY: 40,
        head: [['Visitor', 'Program', 'Reason', 'Time In', 'Time Out', 'Date']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [26, 28, 35] } // Matches your dark theme UI
    });

    // 5. Save the file
    doc.save(`NEU_Library_Logs_${new Date().toLocaleDateString()}.pdf`);
    
    // Optional: Show your toast notification that it's done
    showToast("PDF Report Downloaded", "success");
}

fetchData();
