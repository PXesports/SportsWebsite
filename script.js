// ============================================
// 1. CONFIGURATION
// ============================================
const OWNERS = ['aftabharis242@gmail.com', 'ayushmaharia70@gmail.com'];
let currentUser = null;

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

// REGISTER WITH TRIPLE UNIQUE CHECK
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
        currentUser = userSnap.docs[0].data();
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
    const isAdmin = !adminSnap.empty;

    // Show Admin/Owner Tabs
    if (isOwner || isAdmin) {
        dom.adminLink.classList.remove('hidden');
        initAdminListeners(); // Start listening for admin data
    }
    if (isOwner) {
        dom.ownerZone.classList.remove('hidden');
        initOwnerListeners();
    }
    // Inside your login success or app init function:
    if (currentUser.hasPaid || isAdmin || isOwner) {
        document.getElementById('pro-chat-link').classList.remove('hidden');
    }

    // Inside your navigation click handler:
    if (target === 'pro-chat') {
        initProChat();
    }

    // Load Public Data Listeners (Real-time)
    initPublicListeners();
    navigate('home');
}

function navigate(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    document.getElementById(pageId).classList.remove('hidden');
    const activeLink = document.querySelector(`.nav-item[data-target="${pageId}"]`);
    if (activeLink) activeLink.classList.add('active');
}

// Nav Click Handlers
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.getAttribute('data-target'));
        dom.navLinks.classList.remove('active');
    });
});
document.querySelector('.hamburger').onclick = () => dom.navLinks.classList.toggle('active');

// ============================================
// 4. PUBLIC DATA (REAL-TIME LISTENERS)
// ============================================

function initPublicListeners() {
    // A. Tournaments
    db.collection('updates').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const list = document.getElementById('updates-list');
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
        });

    // B. Teams
    db.collection('teams').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const list = document.getElementById('teams-list');
            list.innerHTML = snapshot.docs.map(doc => {
                const t = doc.data();
                return `
                    <div class="card">
                        <h3>${t.name}</h3>
                        <p style="color:#aaa; font-size:0.9rem;">${t.players}</p>
                    </div>
                `;
            }).join('') || '<p style="color:#666;">No teams registered yet.</p>';
        });

    // C. Results
    db.collection('results').orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const list = document.getElementById('results-list');
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
        });
}

// ============================================
// 5. ADMIN DASHBOARD LOGIC
// ============================================

// --- A. CREATE TOURNAMENT ---
document.getElementById('form-create-tour').onsubmit = async (e) => {
    e.preventDefault();
    try {
        await db.collection('updates').add({
            title: document.getElementById('tour-name').value,
            date: document.getElementById('tour-date').value,
            time: document.getElementById('tour-time').value,
            desc: document.getElementById('tour-desc').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Tournament Posted to Cloud!");
        e.target.reset();
    } catch (err) { alert(err.message); }
};

// --- B. CREATE TEAM ---
document.getElementById('form-create-team').onsubmit = async (e) => {
    e.preventDefault();
    try {
        await db.collection('teams').add({
            name: document.getElementById('team-name').value.trim(),
            players: document.getElementById('team-players').value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Team Registered in Cloud!");
        e.target.reset();
    } catch (err) { alert(err.message); }
};

// --- C. PUBLISH RESULT ---
document.getElementById('form-publish-result').onsubmit = async (e) => {
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

// --- D. ADMIN MANAGE LISTS (With Delete ID) ---
function initAdminListeners() {
    // Manage Tournaments
    db.collection('updates').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const list = document.getElementById('list-manage-tours');
        list.innerHTML = snap.docs.map(doc => {
            const u = doc.data();
            return `
                <div class="manage-item">
                    <strong>${u.title}</strong>
                    <button class="btn-danger" onclick="deleteCloudItem('updates', '${doc.id}')">Delete</button>
                </div>
            `;
        }).join('');
    });

    // Manage Teams
    db.collection('teams').orderBy('createdAt', 'desc').onSnapshot(snap => {
        const list = document.getElementById('list-manage-teams');
        list.innerHTML = snap.docs.map(doc => {
            const t = doc.data();
            return `
                <div class="manage-item">
                    <strong style="color:var(--primary)">${t.name}</strong>
                    <p style="font-size:0.8rem; color:#ccc">${t.players}</p>
                    <div class="manage-actions">
                        <button class="btn-danger" onclick="deleteCloudItem('teams', '${doc.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    });
}

// Global Delete Function (Cloud)
window.deleteCloudItem = async (collection, docId) => {
    if (confirm("Permanently delete this from the Cloud?")) {
        await db.collection(collection).doc(docId).delete();
    }
};

// Search Users (Cloud Query)
window.searchUsers = async () => {
    const query = document.getElementById('search-user').value.toLowerCase();
    if (query.length < 3) return; // Save reads

    const display = document.getElementById('list-users');
    display.innerHTML = '<p>Searching...</p>';

    // Note: Firestore doesn't allow native substring search (like LIKE %query%)
    // Simple implementation: Fetch all and filter (for small apps) or use exact match
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

// ============================================
// 6. OWNER PANEL LOGIC
// ============================================

function initOwnerListeners() {
    // Admins List
    db.collection('admins').onSnapshot(snap => {
        document.getElementById('list-admins').innerHTML = snap.docs.map(doc => `
            <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
                <span>${doc.data().email}</span> 
                <button class="btn-danger" onclick="deleteCloudItem('admins', '${doc.id}')">X</button>
            </div>
        `).join('');
    });

    // Blocklist
    db.collection('blacklist').onSnapshot(snap => {
        document.getElementById('list-blocked').innerHTML = snap.docs.map(doc => `
            <div class="manage-item" style="flex-direction:row; justify-content:space-between;">
                <span style="color:red;">${doc.data().email}</span> 
                <button class="btn-primary" style="width:auto;" onclick="deleteCloudItem('blacklist', '${doc.id}')">Undo</button>
            </div>
        `).join('');
    });
}

window.ownerGrantAdmin = async () => {
    const email = document.getElementById('owner-admin-email').value.trim().toLowerCase();
    if (!email) return;
    await db.collection('admins').add({ email: email });
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
// --- DYNAMIC UPI INTEGRATION ---
window.payViaUPI = () => {
    const upiId = "7296922359@fam";
    const payeeName = "PX ESPORTS";
    const amount = "50.00";
    
    // Check if the user is on a Mobile Device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;
        window.location.href = upiUrl;
    } else {
        // If on PC, tell them to use the QR code
        alert("UPI Buttons only work on Mobile. Please scan the QR Code shown on the screen with your phone.");
    }


    // 4. Log the payment attempt in Firebase so you can track it
    db.collection('payment_attempts').add({
        username: currentUser.username,
        email: currentUser.email,
        amount: amount,
        txnId: transactionId,
        status: "Pending/Initiated",
        time: firebase.firestore.FieldValue.serverTimestamp()
    });
};
function navigate(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
    
    // Show clicked page
    document.getElementById(pageId).classList.remove('hidden');

    // IF CHAT TAB IS CLICKED, START THE REAL-TIME SYNC
    if (pageId === 'pro-chat') {
        startProChat();
    } else {
        // Stop listening to chat if we leave the page to save data/battery
        if (chatListener) {
            chatListener();
            chatListener = null;
        }
    }
}
// --- PRO CHAT SYSTEM (FIXED) ---
let chatListener = null;

function startProChat() {
    const chatBox = document.getElementById('chat-box');
    
    // Stop any previous listener to prevent duplicate messages
    if (chatListener) chatListener();

    // Listen to Firebase "pro_chat" collection
    chatListener = db.collection('pro_chat')
        .orderBy('time', 'asc')
        .limitToLast(50) 
        .onSnapshot(snapshot => {
            chatBox.innerHTML = ""; // Clear box for fresh load
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // Identify if the message is from ME or OTHERS
                const isMe = data.email === currentUser.email;
                
                const msgDiv = document.createElement('div');
                msgDiv.className = `msg-wrapper ${isMe ? 'msg-me' : 'msg-other'}`;
                
                // We use data.username which we save when sending the message
                msgDiv.innerHTML = `
                    <span class="msg-info">${data.username}</span>
                    <div class="msg-text">${data.text}</div>
                `;
                
                chatBox.appendChild(msgDiv);
            });
            
            // Auto-scroll to bottom so you see the newest message
            chatBox.scrollTop = chatBox.scrollHeight;
        }, error => {
            console.error("Chat Error: ", error);
            chatBox.innerHTML = `<p style="color:red; text-align:center;">You don't have permission to view this chat.</p>`;
        });
}

// Handle Sending Messages (Attaching Username)
document.getElementById('chat-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-msg');
    const messageText = input.value.trim();

    if (messageText !== "") {
        try {
            await db.collection('pro_chat').add({
                username: currentUser.username, // From your Registration data
                email: currentUser.email,       // To identify the sender
                text: messageText,
                time: firebase.firestore.FieldValue.serverTimestamp() // Cloud Time
            });
            input.value = ""; // Clear input box
        } catch (error) {
            alert("Could not send message. Check if you have Paid!");
        }
    }
};
// Helper to format Date and Time
function formatChatTime(timestamp) {
    if (!timestamp) return "Sending...";
    const date = timestamp.toDate();
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function startProChat() {
    const chatBox = document.getElementById('chat-box');
    if (chatListener) chatListener();

    chatListener = db.collection('pro_chat').orderBy('time', 'asc').onSnapshot(snap => {
        chatBox.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            const isMe = data.email === currentUser.email;
            
            // 1. Determine Role & Style
            let roleClass = "";
            let roleIcon = "";
            
            if (OWNERS.includes(data.email)) {
                roleClass = "role-owner";
                roleIcon = '<i class="fas fa-crown crown-owner"></i>';
            } else if (data.role === 'admin') {
                roleClass = "role-admin";
                roleIcon = '<i class="fas fa-user-shield shield-admin"></i>';
            }

            const msgDiv = document.createElement('div');
            // Logic: if it's me, use gold; if other, use dark. Then add the role-specific class.
            msgDiv.className = `msg-wrapper ${isMe ? 'msg-me' : 'msg-other'} ${roleClass}`;
            
            msgDiv.innerHTML = `
                <span class="msg-info">${roleIcon}${data.username}</span>
                <div class="msg-text">${data.text}</div>
                <span class="msg-time">${formatChatTime(data.time)}</span>
            `;
            
            chatBox.appendChild(msgDiv);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}
