// ============================================
// 1. CONFIG & DATABASE
// ============================================
const OWNERS = ['aftabharis242@gmail.com', 'ayushmaharia70@gmail.com']; 

// Helper to access LocalStorage
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key)) || [],
    set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    init: () => {
        if (!localStorage.getItem('updates')) DB.set('updates', []);
        if (!localStorage.getItem('teams')) DB.set('teams', []);
        if (!localStorage.getItem('results')) DB.set('results', []);
        if (!localStorage.getItem('users')) DB.set('users', []);
        if (!localStorage.getItem('admin_list')) DB.set('admin_list', []);
        if (!localStorage.getItem('blacklist')) DB.set('blacklist', []);
    }
};

DB.init(); // Run once on load

// ============================================
// 2. STATE & DOM ELEMENTS
// ============================================
let currentUser = null;

const dom = {
    auth: document.getElementById('auth-container'),
    app: document.getElementById('app-container'),
    loginForm: document.getElementById('login-form'),
    regForm: document.getElementById('register-form'),
    navLinks: document.querySelector('.nav-links'),
    adminLink: document.getElementById('admin-link'),
    ownerZone: document.getElementById('owner-zone')
};

// ============================================
// 3. AUTHENTICATION LOGIC
// ============================================

// Switch between Login/Register
document.getElementById('show-register').onclick = () => {
    dom.loginForm.classList.add('hidden');
    dom.regForm.classList.remove('hidden');
};
document.getElementById('show-login').onclick = () => {
    dom.regForm.classList.add('hidden');
    dom.loginForm.classList.remove('hidden');
};

// REGISTER
dom.regForm.onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const users = DB.get('users');

    if (users.find(u => u.email === email)) return alert("Email already registered!");

    const newUser = {
        username: document.getElementById('reg-username').value,
        uid: document.getElementById('reg-uid').value,
        email: email,
        password: document.getElementById('reg-password').value
    };

    users.push(newUser);
    DB.set('users', users);
    alert("Account created! Please Login.");
    document.getElementById('show-login').click();
};

// LOGIN
dom.loginForm.onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    // Security Check
    if (DB.get('blacklist').includes(email)) {
        alert("ACCESS DENIED: This account has been blocked by the Owner.");
        return;
    }

    const user = DB.get('users').find(u => u.email === email && u.password === password);

    if (user) {
        currentUser = user;
        initApp();
    } else {
        alert("Invalid Email or Password");
    }
};

document.getElementById('logout-btn').onclick = () => location.reload();

// ============================================
// 4. MAIN APP LOGIC
// ============================================

function initApp() {
    dom.auth.classList.add('hidden');
    dom.app.classList.remove('hidden');

    // Permission Check
    const email = currentUser.email.toLowerCase();
    const admins = DB.get('admin_list');
    const isOwner = OWNERS.includes(email);
    const isAdmin = admins.includes(email);

    if (isOwner || isAdmin) {
        dom.adminLink.classList.remove('hidden');
        renderAdminDashboard(); // Pre-load admin data
    }

    if (isOwner) {
        dom.ownerZone.classList.remove('hidden');
        renderOwnerPanel();
    }

    // Load Default Page
    navigate('home');
}

// NAVIGATION
function navigate(pageId) {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
    // Remove active class from nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    // Show target
    document.getElementById(pageId).classList.remove('hidden');
    
    // Set active nav
    const activeLink = document.querySelector(`.nav-item[data-target="${pageId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Refresh Data for that page
    if (pageId === 'home') renderHome();
    if (pageId === 'teams') renderTeams();
    if (pageId === 'results') renderResults();
}

// Click Handlers for Nav
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.getAttribute('data-target'));
        dom.navLinks.classList.remove('active'); // Close mobile menu
    });
});
document.querySelector('.hamburger').onclick = () => dom.navLinks.classList.toggle('active');

// ============================================
// 5. PUBLIC RENDERING
// ============================================

function renderHome() {
    const list = document.getElementById('updates-list');
    const updates = DB.get('updates');
    list.innerHTML = updates.length ? updates.map(u => `
        <div class="card">
            <h3>${u.title}</h3>
            <span class="card-meta"><i class="far fa-calendar-alt"></i> ${u.date} | <i class="far fa-clock"></i> ${u.time}</span>
            <p>${u.desc}</p>
        </div>
    `).join('') : '<p style="color:#666;">No active tournaments.</p>';
}

function renderTeams() {
    const list = document.getElementById('teams-list');
    const teams = DB.get('teams');
    list.innerHTML = teams.length ? teams.map(t => `
        <div class="card">
            <h3>${t.name}</h3>
            <p style="color:#aaa; font-size:0.9rem;">${t.players}</p>
        </div>
    `).join('') : '<p style="color:#666;">No teams registered yet.</p>';
}

function renderResults() {
    const list = document.getElementById('results-list');
    const results = DB.get('results');
    list.innerHTML = results.length ? results.map(r => `
        <tr>
            <td>${r.tourName}</td>
            <td style="color:var(--primary); font-weight:bold;">${r.winner}</td>
            <td>${r.runner}</td>
        </tr>
    `).join('') : '<tr><td colspan="3">No results published.</td></tr>';
}

// ============================================
// 6. ADMIN DASHBOARD LOGIC
// ============================================

// --- A. CREATE TOURNAMENT ---
document.getElementById('form-create-tour').onsubmit = (e) => {
    e.preventDefault();
    const updates = DB.get('updates');
    updates.unshift({
        title: document.getElementById('tour-name').value,
        date: document.getElementById('tour-date').value,
        time: document.getElementById('tour-time').value,
        desc: document.getElementById('tour-desc').value
    });
    DB.set('updates', updates);
    alert("Tournament Created!");
    e.target.reset();
    renderAdminDashboard();
};

// --- B. CREATE TEAM (The previously buggy part) ---
document.getElementById('form-create-team').onsubmit = (e) => {
    e.preventDefault(); // Stop conflicts
    const teams = DB.get('teams');
    
    teams.unshift({
        name: document.getElementById('team-name').value.trim(),
        players: document.getElementById('team-players').value.trim()
    });

    DB.set('teams', teams);
    alert("Team Registered Successfully!");
    e.target.reset();
    renderAdminDashboard(); // Refresh the edit list immediately
};

// --- C. PUBLISH RESULT ---
document.getElementById('form-publish-result').onsubmit = (e) => {
    e.preventDefault();
    const results = DB.get('results');
    results.unshift({
        tourName: document.getElementById('res-tour-name').value,
        winner: document.getElementById('res-winner').value,
        runner: document.getElementById('res-runner').value
    });
    DB.set('results', results);
    alert("Result Published!");
    e.target.reset();
};

// --- D. RENDER ADMIN LISTS (Manage) ---
function renderAdminDashboard() {
    // 1. Manage Tournaments List
    const tList = document.getElementById('list-manage-tours');
    tList.innerHTML = DB.get('updates').map((u, i) => `
        <div class="manage-item">
            <strong>${u.title}</strong>
            <button class="btn-danger" onclick="deleteItem('updates', ${i})">Delete</button>
        </div>
    `).join('');

    // 2. Manage Teams List (Edit Capability)
    const teamList = document.getElementById('list-manage-teams');
    teamList.innerHTML = DB.get('teams').map((t, i) => `
        <div class="manage-item">
            <input type="text" id="edit-team-name-${i}" value="${t.name}" style="background:#000; color:var(--primary); border:none;">
            <textarea id="edit-team-players-${i}" style="height:50px; background:#222; border:1px solid #444; color:#fff;">${t.players}</textarea>
            <div class="manage-actions">
                <button class="btn-primary" style="width:auto; padding:5px 10px;" onclick="updateTeam(${i})">Save</button>
                <button class="btn-danger" onclick="deleteItem('teams', ${i})">Delete</button>
            </div>
        </div>
    `).join('');

    // 3. Search Users
    searchUsers();
}

// GLOBAL ADMIN ACTIONS
window.deleteItem = (key, index) => {
    if(confirm("Are you sure?")) {
        const data = DB.get(key);
        data.splice(index, 1);
        DB.set(key, data);
        renderAdminDashboard();
    }
};

window.updateTeam = (index) => {
    const teams = DB.get('teams');
    teams[index].name = document.getElementById(`edit-team-name-${index}`).value;
    teams[index].players = document.getElementById(`edit-team-players-${index}`).value;
    DB.set('teams', teams);
    alert("Team Updated!");
    renderAdminDashboard();
};

window.searchUsers = () => {
    const query = document.getElementById('search-user').value.toLowerCase();
    const users = DB.get('users');
    const display = document.getElementById('list-users');
    
    const filtered = users.filter(u => u.username.toLowerCase().includes(query) || u.uid.includes(query));
    
    display.innerHTML = filtered.map(u => `
        <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
            <span>${u.username}</span>
            <small style="color:#777;">${u.uid}</small>
        </div>
    `).join('');
};

// ============================================
// 7. OWNER PANEL LOGIC
// ============================================

function renderOwnerPanel() {
    const admins = DB.get('admin_list');
    const blocked = DB.get('blacklist');

    document.getElementById('list-admins').innerHTML = admins.map(e => `
        <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
            <span>${e}</span> <button class="btn-danger" onclick="ownerRevoke('${e}')">X</button>
        </div>
    `).join('');

    document.getElementById('list-blocked').innerHTML = blocked.map(e => `
        <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
            <span style="color:red;">${e}</span> <button class="btn-primary" style="width:auto;" onclick="ownerUnblock('${e}')">Undo</button>
        </div>
    `).join('');
}

window.ownerGrantAdmin = () => {
    const email = document.getElementById('owner-admin-email').value.trim().toLowerCase();
    if (!email) return;
    const list = DB.get('admin_list');
    if (!list.includes(email)) {
        list.push(email);
        DB.set('admin_list', list);
        renderOwnerPanel();
        alert("Admin added.");
    }
};

window.ownerBlockUser = () => {
    const email = document.getElementById('owner-block-email').value.trim().toLowerCase();
    if (!email) return;
    if (OWNERS.includes(email)) return alert("Cannot block an Owner.");
    
    const list = DB.get('blacklist');
    if (!list.includes(email)) {
        list.push(email);
        DB.set('blacklist', list);
        renderOwnerPanel();
        alert("User blocked.");
    }
};

window.ownerRevoke = (e) => {
    const list = DB.get('admin_list').filter(x => x !== e);
    DB.set('admin_list', list);
    renderOwnerPanel();
};

window.ownerUnblock = (e) => {
    const list = DB.get('blacklist').filter(x => x !== e);
    DB.set('blacklist', list);
    renderOwnerPanel();
};