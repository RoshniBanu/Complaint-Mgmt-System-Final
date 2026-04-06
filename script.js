const STORAGE_KEY = "complaint_system_data_v1";
const SESSION_KEY = "complaint_system_session_v1";

const INITIAL_DATA = {
  users: [
    { id: "a1", role: "admin", username: "admin", password: "admin123", name: "Main Admin" },
    { id: "u1", role: "user", username: "user1", password: "user123", name: "User One" },
    { id: "e1", role: "engineer", username: "eng1", password: "eng123", name: "Engineer One" },
    { id: "e2", role: "engineer", username: "eng2", password: "eng123", name: "Engineer Two" }
  ],
  complaints: [],
  nextComplaintId: 1
};

const authSection = document.getElementById("authSection");
const dashboardSection = document.getElementById("dashboardSection");
const authMessage = document.getElementById("authMessage");
const dashboardTitle = document.getElementById("dashboardTitle");
const dashboardSubtitle = document.getElementById("dashboardSubtitle");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const complaintForm = document.getElementById("complaintForm");

const logoutBtn = document.getElementById("logoutBtn");
const userPanel = document.getElementById("userPanel");
const adminPanel = document.getElementById("adminPanel");
const engineerPanel = document.getElementById("engineerPanel");

const userComplaints = document.getElementById("userComplaints");
const adminComplaints = document.getElementById("adminComplaints");
const engineerComplaints = document.getElementById("engineerComplaints");

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveData(INITIAL_DATA);
    return structuredClone(INITIAL_DATA);
  }
  return JSON.parse(raw);
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getSessionUserId() {
  return localStorage.getItem(SESSION_KEY);
}

function setSessionUserId(userId) {
  localStorage.setItem(SESSION_KEY, userId);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getCurrentUser(data) {
  const userId = getSessionUserId();
  if (!userId) return null;
  return data.users.find((u) => u.id === userId) || null;
}

function getUserById(data, id) {
  return data.users.find((u) => u.id === id) || null;
}

function statusClass(status) {
  if (status === "Submitted to Admin") return "status-open";
  if (status === "Assigned to Engineer") return "status-assigned";
  if (status === "Complaint Taken by Engineer") return "status-taken";
  if (status === "Complaint Denied by Engineer") return "status-denied";
  return "";
}

function showAuth(message = "", isError = true) {
  authSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#dc2626" : "#166534";
}

function showDashboard() {
  authSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
  authMessage.textContent = "";
}

function renderUserPanel(data, user) {
  const list = data.complaints.filter((c) => c.userId === user.id);
  if (!list.length) {
    userComplaints.innerHTML = `<p class="empty">No complaints registered yet.</p>`;
    return;
  }

  userComplaints.innerHTML = list
    .map((c) => {
      const engineer = c.assignedEngineerId ? getUserById(data, c.assignedEngineerId) : null;
      return `
      <article class="item">
        <h4>#${c.id} - ${escapeHtml(c.title)}</h4>
        <p>${escapeHtml(c.description)}</p>
        <div class="meta">
          <span class="chip ${statusClass(c.status)}">${c.status}</span>
          <span class="chip">Admin: ${c.adminForwarded ? "Received" : "Pending"}</span>
          <span class="chip">Engineer: ${engineer ? engineer.name : "Not assigned"}</span>
          <span class="chip">Engineer Decision: ${c.engineerDecision || "Pending"}</span>
        </div>
      </article>`;
    })
    .join("");
}

function engineerIsAvailable(data, engineerId) {
  return !data.complaints.some(
    (c) =>
      c.assignedEngineerId === engineerId &&
      (c.status === "Assigned to Engineer" || c.status === "Complaint Taken by Engineer")
  );
}

function renderAdminPanel(data) {
  if (!data.complaints.length) {
    adminComplaints.innerHTML = `<p class="empty">No complaints received from users yet.</p>`;
    return;
  }

  const engineers = data.users.filter((u) => u.role === "engineer");
  adminComplaints.innerHTML = data.complaints
    .map((c) => {
      const assignedEngineer = c.assignedEngineerId ? getUserById(data, c.assignedEngineerId) : null;
      const availableEngineers = engineers.filter((e) => engineerIsAvailable(data, e.id) || e.id === c.assignedEngineerId);
      const options = availableEngineers
        .map((e) => `<option value="${e.id}" ${c.assignedEngineerId === e.id ? "selected" : ""}>${e.name}</option>`)
        .join("");

      return `
      <article class="item">
        <h4>#${c.id} - ${escapeHtml(c.title)}</h4>
        <p>${escapeHtml(c.description)}</p>
        <div class="meta">
          <span class="chip ${statusClass(c.status)}">${c.status}</span>
          <span class="chip">From User: ${escapeHtml(c.userName)}</span>
          <span class="chip">Assigned Engineer: ${assignedEngineer ? assignedEngineer.name : "None"}</span>
          <span class="chip">Engineer Decision: ${c.engineerDecision || "Pending"}</span>
        </div>
        <div class="action-row">
          <select id="eng-select-${c.id}">
            <option value="">Select available engineer</option>
            ${options}
          </select>
          <button data-assign-id="${c.id}" type="button">Allocate Engineer</button>
        </div>
      </article>`;
    })
    .join("");

  adminComplaints.querySelectorAll("button[data-assign-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const complaintId = Number(btn.dataset.assignId);
      const select = document.getElementById(`eng-select-${complaintId}`);
      const engineerId = select.value;
      if (!engineerId) {
        alert("Please select an available engineer.");
        return;
      }

      const currentData = loadData();
      const complaint = currentData.complaints.find((co) => co.id === complaintId);
      if (!complaint) return;
      complaint.adminForwarded = true;
      complaint.assignedEngineerId = engineerId;
      complaint.status = "Assigned to Engineer";
      complaint.engineerDecision = "Pending";
      saveData(currentData);
      render();
    });
  });
}

function renderEngineerPanel(data, user) {
  const list = data.complaints.filter((c) => c.assignedEngineerId === user.id);
  if (!list.length) {
    engineerComplaints.innerHTML = `<p class="empty">No complaints allocated to you right now.</p>`;
    return;
  }

  engineerComplaints.innerHTML = list
    .map((c) => {
      const showActions = c.status === "Assigned to Engineer";
      return `
      <article class="item">
        <h4>#${c.id} - ${escapeHtml(c.title)}</h4>
        <p>${escapeHtml(c.description)}</p>
        <div class="meta">
          <span class="chip ${statusClass(c.status)}">${c.status}</span>
          <span class="chip">User: ${escapeHtml(c.userName)}</span>
          <span class="chip">Engineer Decision: ${c.engineerDecision || "Pending"}</span>
        </div>
        ${showActions ? `<div class="action-row">
          <button data-take-id="${c.id}" type="button">Complaint Taken</button>
          <button class="secondary" data-deny-id="${c.id}" type="button">Complaint Denied</button>
        </div>` : ""}
      </article>`;
    })
    .join("");

  engineerComplaints.querySelectorAll("button[data-take-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const complaintId = Number(btn.dataset.takeId);
      updateEngineerDecision(complaintId, "Taken");
    });
  });

  engineerComplaints.querySelectorAll("button[data-deny-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const complaintId = Number(btn.dataset.denyId);
      updateEngineerDecision(complaintId, "Denied");
    });
  });
}

function updateEngineerDecision(complaintId, decision) {
  const data = loadData();
  const complaint = data.complaints.find((c) => c.id === complaintId);
  if (!complaint) return;

  if (decision === "Taken") {
    complaint.engineerDecision = "Taken";
    complaint.status = "Complaint Taken by Engineer";
  } else {
    complaint.engineerDecision = "Denied";
    complaint.status = "Complaint Denied by Engineer";
    complaint.assignedEngineerId = null;
  }
  saveData(data);
  render();
}

function render() {
  const data = loadData();
  const user = getCurrentUser(data);
  if (!user) {
    showAuth();
    return;
  }

  showDashboard();
  userPanel.classList.add("hidden");
  adminPanel.classList.add("hidden");
  engineerPanel.classList.add("hidden");

  dashboardTitle.textContent = `${capitalize(user.role)} Dashboard`;
  dashboardSubtitle.textContent = `Logged in as ${user.name} (${user.username})`;

  if (user.role === "user") {
    userPanel.classList.remove("hidden");
    renderUserPanel(data, user);
  } else if (user.role === "admin") {
    adminPanel.classList.remove("hidden");
    renderAdminPanel(data);
  } else if (user.role === "engineer") {
    engineerPanel.classList.remove("hidden");
    renderEngineerPanel(data, user);
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const role = document.getElementById("role").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const data = loadData();
  const user = data.users.find(
    (u) => u.role === role && u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (!user) {
    showAuth("Invalid login details. Check role, username, and password.");
    return;
  }

  setSessionUserId(user.id);
  loginForm.reset();
  render();
});

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const usernameInput = document.getElementById("signupUsername");
  const passwordInput = document.getElementById("signupPassword");
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (username.length < 3 || password.length < 4) {
    showAuth("Username must be 3+ chars and password must be 4+ chars.");
    return;
  }

  const data = loadData();
  const alreadyExists = data.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (alreadyExists) {
    showAuth("Username already exists. Pick another username.");
    return;
  }

  const userId = `u${Date.now()}`;
  data.users.push({
    id: userId,
    role: "user",
    username,
    password,
    name: username
  });
  saveData(data);
  signupForm.reset();
  showAuth("User account created. Login using role: User.", false);
});

complaintForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("complaintTitle").value.trim();
  const description = document.getElementById("complaintDescription").value.trim();
  if (!title || !description) return;

  const data = loadData();
  const currentUser = getCurrentUser(data);
  if (!currentUser) {
    clearSession();
    render();
    return;
  }

  const complaint = {
    id: data.nextComplaintId++,
    userId: currentUser.id,
    userName: currentUser.name,
    title,
    description,
    adminForwarded: true,
    assignedEngineerId: null,
    engineerDecision: "Pending",
    status: "Submitted to Admin",
    createdAt: new Date().toISOString()
  };
  data.complaints.unshift(complaint);
  saveData(data);
  complaintForm.reset();
  render();
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  render();
});

render();
