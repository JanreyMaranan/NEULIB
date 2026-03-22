const SB_URL = 'https://plmwuwcvjbrspogdivmf.supabase.co'; 
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbXd1d2N2amJyc3BvZ2Rpdm1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4Mjg3MTQsImV4cCI6MjA4OTQwNDcxNH0.WfcZyXopfb9CHUvim2vG08qqAL-TWe16shbV3W0Dr1k';
const _supabase = supabase.createClient(SB_URL, SB_KEY);

const ADMINS = ["admin2@neu.edu.ph", "jcesperanza@neu.edu.ph", "janrey.maranan@neu.edu.ph"];

/* ================= POPUP FUNCTION ================= */
function showPopup(message, type) {
    const popup = document.createElement("div");
    popup.className = `popup ${type}`;
    popup.innerText = message;

    document.body.appendChild(popup);

    setTimeout(() => popup.classList.add("show"), 100);

    setTimeout(() => {
        popup.classList.remove("show");
        setTimeout(() => popup.remove(), 300);
    }, 3000);
}

/* ================= AUTH ================= */
window.handleAuth = (role) => {
    localStorage.setItem('neu_role', role);
    _supabase.auth.signInWithOAuth({ provider: 'google' });
};

window.handleLogout = async () => {
    try {
        const { data: { session } } = await _supabase.auth.getSession();

        if (session) {
            const email = session.user.email;

            // 🔍 Check if user is still checked IN (no exit_time)
            const { data } = await _supabase
                .from('visitor_logs')
                .select('*')
                .eq('email', email)
                .is('exit_time', null);

            const existing = data && data.length > 0 ? data[0] : null;

            if (existing) {
                // ✅ AUTO CHECK OUT
                await _supabase
                    .from('visitor_logs')
                    .update({
                        exit_time: new Date().toLocaleTimeString()
                    })
                    .eq('id', existing.id);

                // 🔴 show logout checkout popup
                showPopup("Auto Checked OUT on Sign Out", "danger");

                // ⏳ small delay so user can see popup
                setTimeout(async () => {
                    await _supabase.auth.signOut();
                    localStorage.clear();
                    location.reload();
                }, 1500);

                return;
            }
        }

        // normal logout if no active session
        await _supabase.auth.signOut();
        localStorage.clear();
        location.reload();

    } catch (error) {
        console.error(error);

        // fallback logout
        await _supabase.auth.signOut();
        localStorage.clear();
        location.reload();
    }
};

/* ================= PROCESS VISIT ================= */
window.processVisit = async () => {
    console.log("processVisit triggered");

    const name = document.getElementById('v-display-name').innerText;
    const email = document.getElementById('v-email-text').innerText;
    const program = document.getElementById('v-program').value;
    const reason = document.getElementById('v-reason').value;

    if (!program || !reason) {
        alert("Please complete the form");
        return;
    }

    try {
        // CHECK existing active session
        const { data } = await _supabase
            .from('visitor_logs')
            .select('*')
            .eq('email', email)
            .is('exit_time', null);

        const existing = data && data.length > 0 ? data[0] : null;

        if (!existing) {
            // ✅ CHECK IN
            await _supabase.from('visitor_logs').insert([{
                name,
                email,
                program,
                reason,
                entry_time: new Date().toLocaleTimeString(),
                visit_date: new Date().toLocaleDateString()
            }]);

            showPopup("Checked IN successfully", "success");

        } else {
            // ✅ CHECK OUT
            await _supabase
                .from('visitor_logs')
                .update({
                    exit_time: new Date().toLocaleTimeString()
                })
                .eq('id', existing.id);

            showPopup("Checked OUT successfully", "danger");
        }

    } catch (error) {
        console.error(error);
        alert("Something went wrong");
    }
};

/* ================= ADMIN ================= */
window.block = async (email, name) => {
    const reason = prompt(`Reason for blocking ${name}?`);
    if (reason) {
        await _supabase.from('blocked_users').insert([{ email, name, reason }]);
        refreshAdmin();
        loadBlockedList(); // ✅ refresh blocked table
    }
};

window.block = async (email, name) => {
    const reason = prompt(`Reason for blocking ${name}?`);
    if (reason) {
        await _supabase.from('blocked_users').insert([{ email, name, reason }]);
        refreshAdmin();
        loadBlockedList(); // ✅ refresh blocked table
    }
};
window.unblockUser = async (email) => {
    if (confirm(`Unblock ${email}?`)) {
        await _supabase.from('blocked_users').delete().eq('email', email);
        refreshAdmin();
        loadBlockedList();
    }
};

async function refreshAdmin() {
    const { data: logs } = await _supabase.from('visitor_logs').select('*').order('id', {ascending: false});
    const { data: blockedData } = await _supabase.from('blocked_users').select('*');
    const blockedEmails = new Set((blockedData || []).map(b => b.email));

    document.getElementById('count-in').innerText = logs.filter(l => !l.exit_time).length;
    document.getElementById('count-today').innerText = logs.length;
    document.getElementById('count-blocked').innerText = blockedData.length;

    document.getElementById('log-body').innerHTML = logs.map(l => {
        const isBlocked = blockedEmails.has(l.email);
        const displayDate = l.visit_date || new Date(l.created_at).toLocaleDateString();

        return `
            <tr class="log-row" data-date="${displayDate}">
                <td><strong>${l.name}</strong><br><small style="color:#888">${l.email}</small></td>
                <td>${l.program}</td>
                <td>${displayDate}</td>
                <td>${l.entry_time}</td>
                <td>${l.exit_time || '--'}</td>
                <td>
                    <span style="color:${l.exit_time ? 'red' : 'green'}; font-weight:bold">
                        ${l.exit_time ? 'OUT' : 'IN'}
                    </span>
                </td>
                <td>
                    ${isBlocked 
                        ? `<button class="btn-green-small" onclick="unblockUser('${l.email}')">Unblock</button>` 
                        : `<button class="btn-red-small" onclick="block('${l.email}','${l.name}')">Block</button>`}
                </td>
            </tr>
        `;
    }).join('');
}

/* ================= FILTER ================= */
window.filterTable = () => {
    const search = document.getElementById("admin-search").value.toLowerCase();
    const filterDate = document.getElementById("admin-date-filter").value;

    document.querySelectorAll(".log-row").forEach(row => {
        const textMatch = row.innerText.toLowerCase().includes(search);

        let dateMatch = true;
        if (filterDate) {
            const rowDate = new Date(row.getAttribute("data-date"))
                .toISOString()
                .split('T')[0];
            dateMatch = (rowDate === filterDate);
        }

        row.style.display = (textMatch && dateMatch) ? "" : "none";
    });
};

/* ================= SESSION ================= */
(async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;

    const user = session.user;
    /* ================= BLOCK CHECK ================= */
const { data: blocked } = await _supabase
    .from('blocked_users')
    .select('*')
    .eq('email', user.email);

if (blocked && blocked.length > 0) {
    showPopup("You are BLOCKED from accessing the system", "danger");

    // auto logout after warning
    setTimeout(async () => {
        await _supabase.auth.signOut();
        localStorage.clear();
        location.reload();
    }, 2000);

    return; // ⛔ stop loading dashboard
}
    const role = localStorage.getItem('neu_role');

    if (role === 'admin' && ADMINS.includes(user.email.toLowerCase())) {
        document.getElementById('admin-email').innerText = user.email;
        document.getElementById('selection-container').classList.add('hidden');
        document.getElementById('admin-container').classList.remove('hidden');
        refreshAdmin();
    } else {
        document.getElementById('selection-container').classList.add('hidden');
        document.getElementById('visitor-form-container').classList.remove('hidden');

        document.getElementById('v-display-name').innerText = user.user_metadata.full_name;
        document.getElementById('v-email-text').innerText = user.email;
        document.getElementById('v-avatar').src = user.user_metadata.avatar_url;
    }
    /* ================= PDF REPORT ================= */
window.generatePDF = async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const isBlockedTab = document.getElementById('tab-blocked').classList.contains('active');

    let y = 10;

    doc.setFontSize(16);

    if (isBlockedTab) {
        doc.text("Blocked Users Report", 10, y);
        y += 10;

        const { data } = await _supabase.from('blocked_users').select('*');

        data.forEach((b, i) => {
            doc.text(`${i + 1}. ${b.name} | ${b.email} | ${b.reason}`, 10, y);
            y += 6;

            if (y > 280) {
                doc.addPage();
                y = 10;
            }
        });

        doc.save("blocked_users.pdf");

    } else {
        doc.text("Visitor Logs Report", 10, y);
        y += 10;

        const { data } = await _supabase.from('visitor_logs').select('*');

        data.forEach((log, i) => {
            doc.text(`${i + 1}. ${log.name} | ${log.program} | ${log.visit_date}`, 10, y);
            y += 6;

            if (y > 280) {
                doc.addPage();
                y = 10;
            }
        });

        doc.save("visitor_logs.pdf");
    }
};
/* ================= SWITCH TABS ================= */
window.switchTab = (tab) => {
    if (tab === 'blocked') {
        document.getElementById('view-logs').classList.add('hidden');
        document.getElementById('view-blocked').classList.remove('hidden');

        document.getElementById('tab-logs').classList.remove('active');
        document.getElementById('tab-blocked').classList.add('active');

        loadBlockedList(); // 🔥 VERY IMPORTANT
    } else {
        document.getElementById('view-logs').classList.remove('hidden');
        document.getElementById('view-blocked').classList.add('hidden');

        document.getElementById('tab-logs').classList.add('active');
        document.getElementById('tab-blocked').classList.remove('active');
    }
};
/* ================= LOAD BLOCKED LIST ================= */
async function loadBlockedList() {
    const { data, error } = await _supabase
        .from('blocked_users')
        .select('*');

    console.log("Blocked Data:", data, error);

    const table = document.getElementById('blocked-body');

    if (!table) {
        console.error("❌ blocked-body not found");
        return;
    }

    if (!data || data.length === 0) {
        table.innerHTML = `<tr><td colspan="4">No blocked users found</td></tr>`;
        return;
    }

    table.innerHTML = data.map(b => `
        <tr>
            <td>${b.name}</td>
            <td>${b.email}</td>
            <td>${b.reason}</td>
            <td>
                <button onclick="unblockUser('${b.email}')">Unblock</button>
            </td>
        </tr>
    `).join('');
}
/* ================= GLOBAL SEARCH ================= */
window.handleSearch = () => {
    const search = document.getElementById("admin-search").value.toLowerCase();

    const activeTab = document.getElementById('tab-blocked').classList.contains('active')
        ? 'blocked'
        : 'logs';

    if (activeTab === 'logs') {
        filterTable();
    } else {
        document.querySelectorAll("#blocked-body tr").forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(search) ? "" : "none";
        });
    }
};

})();