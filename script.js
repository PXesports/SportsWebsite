// ============================================
// 1. CONFIGURATION & STATE
// ============================================
const OWNERS = ['aftabharis242@gmail.com', 'ayushmaharia70@gmail.com'];
let currentUser = null;
let chatListener = null;

// DOM Elements
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
// 2. AUTHENTICATION (Cloud Based)
// ============================================

// Toggle Forms
document.getElementById('show-register').onclick = () => {
    dom.loginForm.classList.add('hidden');
    dom.regForm.classList.remove('hidden');
};
document.getElementById('show-login').onclick = () => {
    dom.regForm.classList.add('hidden');
    dom.loginForm.classList.remove('hidden');
};

// REGISTER WITH STRICT TRIPLE UNIQUE CHECK
dom.regForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value.trim();
    const uid = document.getElementById('reg-uid').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;

    try {
        // 1. UNIQUE EMAIL CHECK
        const emailCheck = await db.collection('users').where('email', '==', email).get();
        if (!emailCheck.empty) {
            alert("❌ EMAIL IN USE: This email is already registered. Please Login.");
            return;
        }

        // 2. UNIQUE USERNAME CHECK
        const nameCheck = await db.collection('users').where('username', '==', username).get();
        if (!nameCheck.empty) {
            alert("❌ USERNAME TAKEN: This Username is already registered. Try another.");
            return;
        }

        // 3. UNIQUE GAME UID CHECK
        const uidCheck = await db.collection('users').where('uid', '==', uid).get();
        if (!uidCheck.empty) {
            alert("❌ UID REGISTERED: This Game UID is already linked to an existing account.");
            return;
        }

        // 4. IF ALL 3 ARE UNIQUE, CREATE ACCOUNT
        await db.collection('users').add({
            username: username,
            uid: uid,
            email: email,
            password: password, 
            hasPaid: false,
            chatAccess: false,
            role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("✅ Account created successfully! You can now Login.");
        document.getElementById('show-login').click();

    } catch (err) {
        console.error("Critical Reg Error:", err);
        alert("Database Error: Could not verify uniqueness.");
    }
};

// LOGIN
dom.loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    try {
        // 1. Check Blacklist
        const blacklistSnap = await db.collection('blacklist').where('email', '==', email).get();
        if (!blacklistSnap.empty) {
            return alert("ACCESS DENIED: This account has been blocked by the Owner.");
        }

        // 2. Verify Credentials
        const userSnap = await db.collection('users')
            .where('email', '==', email)
            .where('password', '==', password)
            .get();

        if (userSnap.empty) {
            return alert("Invalid Email or Password");
        }

        // Login Success
        currentUser = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() };
        initApp();

    } catch (error) {
        console.error(error);
        alert("Login Error: " + error.message);
    }
};

document.getElementById('logout-btn').onclick = () => location.reload();

// ============================================
// 3. APP INITIALIZATION & NAVIGATION
// ============================================

async function initApp() {
    dom.auth.classList.add('hidden');
    dom.app.classList.remove('hidden');

    const email = currentUser.email.toLowerCase();
    const isOwner = OWNERS.includes(email);
    
    // Check Admin Status from Cloud
    const adminSnap = await db.collection('admins').where('email', '==', email).get();
    const isAdmin = !adminSnap.empty || currentUser.role === 'admin';

    // Show Admin/Owner Tabs
    if (isOwner || isAdmin) {
        dom.adminLink.classList.remove('hidden');
        initAdminListeners(); // Start listening for admin data
    }
    
    if (isOwner && dom.ownerZone) {
        dom.ownerZone.classList.remove('hidden');
        initOwnerListeners();
    }

    // Live Watcher for Chat Access (Updates UI instantly if admin grants access)
    db.collection('users').doc(currentUser.id).onSnapshot(doc => {
        const data = doc.data();
        const chatLink = document.getElementById('pro-chat-link');
        
        // Show Chat Link if: Owner OR Admin OR Explicitly Granted Access
        if (isOwner || data.role === 'admin' || data.chatAccess === true) {
            chatLink.classList.remove('hidden');
            currentUser.chatAccess = true;
            currentUser.role = data.role; // Update local role
        } else {
            chatLink.classList.add('hidden');
            currentUser.chatAccess = false;
        }
    });

    // Load Public Data Listeners (Real-time Tournaments, Teams, Results)
    initPublicListeners();
    
    // Start at Home
    navigate('home');
}

// Unified Navigation Function
function navigate(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
    
    // Deactivate all nav links
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    // Show clicked page
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.remove('hidden');
        
        // Activate link
        const activeLink = document.querySelector(`.nav-item[data-target="${pageId}"]`);
        if (activeLink) activeLink.classList.add('active');
    }

    // Chat Logic: Start listener ONLY if on chat page
    if (pageId === 'pro-chat') {
        startProChat();
    } else {
        // Stop listening to chat if we leave the page to save resources
        if (chatListener) {
            chatListener(); // This function (returned by onSnapshot) stops the listener
            chatListener = null;
        }
    }
}

// Nav Click Handlers
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.getAttribute('data-target'));
        if(dom.navLinks) dom.navLinks.classList.remove('active'); // Close mobile menu
    });
});
document.querySelector('.hamburger').onclick = () => dom.navLinks.classList.toggle('active');

// ============================================
// 4. PUBLIC DATA (REAL-TIME LISTENERS)
// ============================================

function initPublicListeners() {
    // A. Tournaments (Collection: 'updates')
    db.collection('updates').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const list = document.getElementById('updates-list');
            if(list) {
                list.innerHTML = snapshot.docs.map(doc => {
                    const u = doc.data();
                    return `
                        <div class="card">
                            <h3>${u.title}</h3>
                            <span class="card-meta"><i class="far fa-calendar-alt"></i> ${u.date} | <i class="far fa-clock"></i> ${u.time}</span>
                            <p>${u.desc}</p>
                        </div>
                    `;
                }).join('') || '<p style="color:#666;">No active tournaments.</p>';
            }
        });

    // B. Teams (Collection: 'teams')
    db.collection('teams').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const list = document.getElementById('teams-list');
            if(list) {
                list.innerHTML = snapshot.docs.map(doc => {
                    const t = doc.data();
                    return `
                        <div class="card">
                            <h3>${t.name}</h3>
                            <p style="color:#aaa; font-size:0.9rem;">${t.players}</p>
                        </div>
                    `;
                }).join('') || '<p style="color:#666;">No teams registered yet.</p>';
            }
        });

    // C. Results (Collection: 'results')
    db.collection('results').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const list = document.getElementById('results-list');
            if(list) {
                list.innerHTML = snapshot.docs.map(doc => {
                    const r = doc.data();
                    return `
                        <tr>
                            <td>${r.tourName}</td>
                            <td style="color:var(--primary); font-weight:bold;">${r.winner}</td>
                            <td>${r.runner}</td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="3">No results published.</td></tr>';
            }
        });
}

// ============================================
// 5. ADMIN DASHBOARD LOGIC
// ============================================

// --- A. CREATE TOURNAMENT ---
const tourForm = document.getElementById('form-create-tour');
if(tourForm) {
    tourForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await db.collection('updates').add({
                title: document.getElementById('tour-name').value,
                date: document.getElementById('tour-date').value,
                time: document.getElementById('tour-time').value,
                desc: document.getElementById('tour-desc').value,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Tournament Posted!");
            e.target.reset();
        } catch (err) { alert(err.message); }
    };
}

// --- B. CREATE TEAM ---
const teamForm = document.getElementById('form-create-team');
if(teamForm) {
    teamForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await db.collection('teams').add({
                name: document.getElementById('team-name').value.trim(),
                players: document.getElementById('team-players').value.trim(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Team Registered!");
            e.target.reset();
        } catch (err) { alert(err.message); }
    };
}

// --- C. PUBLISH RESULT ---
const resForm = document.getElementById('form-publish-result');
if(resForm) {
    resForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            await db.collection('results').add({
                tourName: document.getElementById('res-tour-name').value,
                winner: document.getElementById('res-winner').value,
                runner: document.getElementById('res-runner').value,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Result Published!");
            e.target.reset();
        } catch (err) { alert(err.message); }
    };
}

// --- D. ADMIN MANAGE LISTS & ACCESS ---
function initAdminListeners() {
    // Manage Tournaments
    db.collection('updates').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const list = document.getElementById('list-manage-tours');
        if(list) {
            list.innerHTML = snap.docs.map(doc => {
                const u = doc.data();
                return `
                    <div class="manage-item">
                        <strong>${u.title}</strong>
                        <button class="btn-danger" onclick="deleteCloudItem('updates', '${doc.id}')">Delete</button>
                    </div>
                `;
            }).join('');
        }
    });

    // Manage Teams
    db.collection('teams').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const list = document.getElementById('list-manage-teams');
        if(list) {
            list.innerHTML = snap.docs.map(doc => {
                const t = doc.data();
                return `
                    <div class="manage-item">
                        <strong style="color:var(--primary)">${t.name}</strong>
                        <div class="manage-actions">
                            <button class="btn-danger" onclick="deleteCloudItem('teams', '${doc.id}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    });

    // Payment Logs
    db.collection('payment_attempts').orderBy('time', 'desc').onSnapshot(snap => {
        const logBox = document.getElementById('payment-logs');
        if (logBox) {
            logBox.innerHTML = snap.docs.map(doc => {
                const p = doc.data();
                return `<div class="manage-item" style="font-size:0.8rem; border-bottom:1px solid #333;">
                    <b>${p.username}</b> (${p.amount})<br>
                    <small>${p.email}</small>
                </div>`;
            }).join('') || '<p>No payments.</p>';
        }
    });
}

// Global Delete Function
window.deleteCloudItem = async (collection, docId) => {
    if (confirm("Permanently delete this?")) {
        await db.collection(collection).doc(docId).delete();
    }
};

// Search Users
window.searchUsers = async () => {
    const query = document.getElementById('search-user').value.toLowerCase();
    if (query.length < 3) return;

    const display = document.getElementById('list-users');
    display.innerHTML = '<p>Searching...</p>';

    const snap = await db.collection('users').get();
    const filtered = snap.docs
        .map(doc => doc.data())
        .filter(u => u.username.toLowerCase().includes(query) || u.uid.includes(query));

    display.innerHTML = filtered.map(u => `
        <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
            <span>${u.username}</span>
            <small style="color:#777;">${u.uid}</small>
        </div>
    `).join('') || '<p>No users found.</p>';
};

// --- E. ACCESS CONTROL (Grant Chat / Make Admin) ---
window.setAccess = async (type) => {
    const emailInput = document.getElementById('target-email');
    if(!emailInput) return; // Safety check
    
    const email = emailInput.value.trim().toLowerCase();
    if(!email) return alert("Please enter a Gmail address first!");

    try {
        const snap = await db.collection('users').where('email', '==', email).get();
        if (snap.empty) return alert("User not found! They must register first.");

        const docId = snap.docs[0].id;
        let updates = {};

        if (type === 'player') {
            updates = { chatAccess: true, role: 'user' };
        } else if (type === 'admin') {
            updates = { chatAccess: true, role: 'admin' };
        } else if (type === 'revoke') {
            updates = { chatAccess: false, role: 'user' };
        }

        await db.collection('users').doc(docId).update(updates);
        
        // If making admin, also add to admins collection for persistence
        if (type === 'admin') {
             await db.collection('admins').add({ email: email });
        }

        alert(`Successfully updated permissions for: ${email}`);
        emailInput.value = ""; 
    } catch (err) {
        alert("Permission Error: " + err.message);
    }
};

// ============================================
// 6. OWNER PANEL LOGIC
// ============================================

function initOwnerListeners() {
    // Admins List
    db.collection('admins').onSnapshot(snap => {
        const list = document.getElementById('list-admins');
        if(list) {
            list.innerHTML = snap.docs.map(doc => `
                <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
                    <span>${doc.data().email}</span> 
                    <button class="btn-danger" onclick="deleteCloudItem('admins', '${doc.id}')">X</button>
                </div>
            `).join('');
        }
    });

    // Blocklist
    db.collection('blacklist').onSnapshot(snap => {
        const list = document.getElementById('list-blocked');
        if(list) {
            list.innerHTML = snap.docs.map(doc => `
                <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
                    <span style="color:red;">${doc.data().email}</span> 
                    <button class="btn-primary" style="width:auto;" onclick="deleteCloudItem('blacklist', '${doc.id}')">Undo</button>
                </div>
            `).join('');
        }
    });
}

window.ownerGrantAdmin = async () => {
    const email = document.getElementById('owner-admin-email').value.trim().toLowerCase();
    if (!email) return;
    await db.collection('admins').add({ email: email });
    
    // Also update user doc to reflect role immediately
    const snap = await db.collection('users').where('email', '==', email).get();
    if(!snap.empty) {
        await db.collection('users').doc(snap.docs[0].id).update({ role: 'admin', chatAccess: true });
    }

    document.getElementById('owner-admin-email').value = '';
    alert("Admin Added!");
};

window.ownerBlockUser = async () => {
    const email = document.getElementById('owner-block-email').value.trim().toLowerCase();
    if (!email) return;
    if (OWNERS.includes(email)) return alert("Cannot block Owner!");

    await db.collection('blacklist').add({ email: email });
    document.getElementById('owner-block-email').value = '';
    alert("User Blocked!");
};

// ============================================
// 7. UPI PAYMENT & PRO CHAT SYSTEM
// ============================================

window.payViaUPI = () => {
    const upiId = "7296922359@fam";
    const payeeName = "PX ESPORTS";
    const amount = "20.00";
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Log payment attempt
    db.collection('payment_attempts').add({
        username: currentUser.username,
        email: currentUser.email,
        amount: amount,
        time: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (isMobile) {
        const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
        window.location.href = upiUrl;
    } else {
        alert("Please scan the QR Code on screen with your phone.");
    }
};

// Helper: Format Date/Time
function formatChatTime(timestamp) {
    if (!timestamp) return "Sending...";
    const date = timestamp.toDate();
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Pro Chat Logic
function startProChat() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    if (chatListener) chatListener(); // Clear previous

    chatListener = db.collection('pro_chat').orderBy('time', 'asc').limitToLast(50)
        .onSnapshot(snap => {
            chatBox.innerHTML = "";
            snap.forEach(doc => {
                const data = doc.data();
                const isMe = data.email === currentUser.email;
                
                // Determine Role & Style
                let roleClass = "";
                let roleIcon = "";
                
                if (OWNERS.includes(data.email)) {
                    roleClass = "role-owner";
                    roleIcon = '<i class="fas fa-crown" style="color:gold; margin-right:5px;"></i>';
                } else if (data.role === 'admin') {
                    roleClass = "role-admin";
                    roleIcon = '<i class="fas fa-user-shield" style="color:#3b82f6; margin-right:5px;"></i>';
                }

                // Format Time
                const timeStr = formatChatTime(data.time);

                const msgDiv = document.createElement('div');
                msgDiv.className = `msg-wrapper ${isMe ? 'msg-me' : 'msg-other'} ${roleClass}`;
                
                msgDiv.innerHTML = `
                    <span class="msg-info">${roleIcon}${data.username}</span>
                    <div class="msg-text">${data.text}</div>
                    <span class="msg-time">${timeStr}</span>
                `;
                
                chatBox.appendChild(msgDiv);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        }, err => {
            chatBox.innerHTML = `<p style="color:red; text-align:center; padding:20px;">
                <i class="fas fa-lock"></i> Chat Locked.<br>Ask Admin for access.
            </p>`;
        });
}

const chatForm = document.getElementById('chat-form');
if (chatForm) {
    chatForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-msg');
        const messageText = input.value.trim();

        if (messageText !== "") {
            try {
                await db.collection('pro_chat').add({
                    username: currentUser.username,
                    email: currentUser.email,
                    role: currentUser.role || 'user', // Send role with message
                    text: messageText,
                    time: firebase.firestore.FieldValue.serverTimestamp()
                });
                input.value = ""; 
            } catch (error) {
                alert("Permission Denied! You are not authorized to chat.");
            }
        }
    };
}
