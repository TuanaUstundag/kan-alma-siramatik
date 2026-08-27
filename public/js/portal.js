// Unified Portal Business Logic (Login, Nurse and Admin Portals)

document.addEventListener('DOMContentLoaded', () => {
  // Session details from sessionStorage
  let currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || null;
  let selectedDesk = localStorage.getItem('selectedDesk') || null;

  // Views
  const portalHeader = document.getElementById('portal-header');
  const loginView = document.getElementById('login-view');
  const nurseView = document.getElementById('nurse-view');
  const adminView = document.getElementById('admin-view');

  // Header Details
  const headerUserName = document.getElementById('header-user-name');
  const headerUserRole = document.getElementById('header-user-role');
  const btnLogout = document.getElementById('btn-logout');

  // Login Form elements
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginErrorBox = document.getElementById('login-error-box');
  const loginErrorMessage = document.getElementById('login-error-message');

  // Nurse Room Setup elements
  const nurseRoomSetup = document.getElementById('nurse-room-setup');
  const nurseDashboard = document.getElementById('nurse-dashboard');
  const btnChangeRoom = document.getElementById('btn-change-room');
  const nurseDeskName = document.getElementById('nurse-desk-name');

  // Nurse Action elements
  const nurseCurrentPatient = document.getElementById('nurse-current-patient');
  const btnNurseCallNext = document.getElementById('btn-nurse-call-next');
  const btnNurseRecall = document.getElementById('btn-nurse-recall');
  const btnNurseComplete = document.getElementById('btn-nurse-complete');

  // Nurse Stats elements
  const nurseStatWaiting = document.getElementById('nurse-stat-waiting');
  const nurseStatCalling = document.getElementById('nurse-stat-calling');
  const nurseStatCompleted = document.getElementById('nurse-stat-completed');
  const nurseBadgeWaitingCount = document.getElementById('nurse-badge-waiting-count');
  const nurseQueueList = document.getElementById('nurse-queue-list');

  // Admin Tab Navigation
  const adminTabs = document.querySelectorAll('.btn-admin-tab');
  const adminTabContents = document.querySelectorAll('.admin-tab-content');

  // Admin Stats Elements
  const adminStatWaiting = document.getElementById('admin-stat-waiting');
  const adminStatCalling = document.getElementById('admin-stat-calling');
  const adminStatCompleted = document.getElementById('admin-stat-completed');
  const tableNurseStatsRows = document.getElementById('table-nurse-stats-rows');

  // Admin User CRUD Elements
  const formAddNurse = document.getElementById('form-add-nurse');
  const addNurseName = document.getElementById('add-nurse-name');
  const addNurseEmail = document.getElementById('add-nurse-email');
  const addNursePassword = document.getElementById('add-nurse-password');
  const tableUsersRows = document.getElementById('table-users-rows');

  // Admin Logs Elements
  const tableLogsRows = document.getElementById('table-logs-rows');
  const btnAdminReset = document.getElementById('btn-admin-reset');
  const btnExportStatsCsv = document.getElementById('btn-export-stats-csv');
  const btnExportLogsCsv = document.getElementById('btn-export-logs-csv');

  // Nurse Timer & Clinical Elements
  const nurseTimerContainer = document.getElementById('nurse-timer-container');
  const nurseTimer = document.getElementById('nurse-timer');
  const nurseClinicalActions = document.getElementById('nurse-clinical-actions');
  const tubeTagButtons = document.querySelectorAll('.btn-tube-tag');
  const noteTagButtons = document.querySelectorAll('.btn-note-tag');

  // Admin Charts Elements
  const chartHourlyBars = document.getElementById('chart-hourly-bars');
  const chartNurseDistribution = document.getElementById('chart-nurse-distribution');

  let activeCallingPatient = null;
  let timerInterval = null;
  let timerStartTime = null;
  let selectedTubes = [];
  let selectedNotes = [];
  let socket = null;

  // Initialize App View State
  function renderView() {
    // Hide all views first
    loginView.classList.add('hidden');
    nurseView.classList.add('hidden');
    adminView.classList.add('hidden');
    portalHeader.classList.add('hidden');

    if (!currentUser) {
      // Show login view
      loginView.classList.remove('hidden');
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    } else {
      // User is logged in, show header
      portalHeader.classList.remove('hidden');
      headerUserName.textContent = currentUser.name;
      headerUserRole.textContent = currentUser.role === 'admin' ? 'Yönetici' : 'Çalışan Hemşire';

      // Connect socket if not connected
      initSocket();

      if (currentUser.role === 'nurse') {
        // Show Nurse view
        nurseView.classList.remove('hidden');
        renderNurseDashboard();
      } else if (currentUser.role === 'admin') {
        // Show Admin view
        adminView.classList.remove('hidden');
        renderAdminDashboard();
      }
    }
  }

  // Socket Connection setup
  let syncInterval = null;
  function initSocket() {
    if (!socket) {
      socket = io();

      socket.on('ticket-created', handleRealtimeUpdate);
      socket.on('ticket-called', handleRealtimeUpdate);
      socket.on('ticket-completed', handleRealtimeUpdate);
      socket.on('queue-reset', handleRealtimeUpdate);
      socket.on('users-updated', () => {
        if (currentUser && currentUser.role === 'admin') {
          fetchUsers();
          fetchStats();
        }
      });
    }

    if (!syncInterval) {
      syncInterval = setInterval(handleRealtimeUpdate, 3000);
    }
  }

  function handleRealtimeUpdate() {
    if (!currentUser) return;
    
    if (currentUser.role === 'nurse') {
      fetchNurseStats();
    } else if (currentUser.role === 'admin') {
      fetchStats();
      fetchLogs();
    }
  }

  // --- LOGIN LOGIC ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorBox.classList.add('hidden');
    
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Giriş yapılamadı.');
      }

      const data = await res.json();
      currentUser = data.user;
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      // Clear inputs
      loginEmail.value = '';
      loginPassword.value = '';
      
      renderView();
    } catch (err) {
      loginErrorMessage.textContent = err.message;
      loginErrorBox.classList.remove('hidden');
    }
  });

  // --- LOGOUT LOGIC ---
  btnLogout.addEventListener('click', () => {
    currentUser = null;
    selectedDesk = null;
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('selectedDesk');
    renderView();
  });


  // --- NURSE VIEW LOGIC ---
  function renderNurseDashboard() {
    if (selectedDesk) {
      nurseRoomSetup.classList.add('hidden');
      nurseDashboard.classList.remove('hidden');
      nurseDeskName.textContent = selectedDesk;
      fetchNurseStats();
    } else {
      nurseRoomSetup.classList.remove('hidden');
      nurseDashboard.classList.add('hidden');
    }
  }

  // Desk/Room select handlers
  document.querySelectorAll('.btn-select-room').forEach(btn => {
    btn.addEventListener('click', () => {
      const desk = btn.getAttribute('data-desk');
      if (desk) {
        selectedDesk = desk;
        localStorage.setItem('selectedDesk', desk);
        renderNurseDashboard();
      }
    });
  });

  btnChangeRoom.addEventListener('click', () => {
    selectedDesk = null;
    localStorage.removeItem('selectedDesk');
    renderNurseDashboard();
  });

  // Stopwatch and Clinical Tag Functions
  function startNurseTimer(calledAtIsoString) {
    clearInterval(timerInterval);
    if (!nurseTimerContainer) return;
    
    nurseTimerContainer.classList.remove('hidden');
    timerStartTime = calledAtIsoString ? new Date(calledAtIsoString).getTime() : Date.now();

    function updateTimer() {
      const now = Date.now();
      const elapsedSec = Math.max(0, Math.floor((now - timerStartTime) / 1000));
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      if (nurseTimer) nurseTimer.textContent = `${mins}:${secs}`;

      // Dynamic color thresholds: 0-3m green, 3-5m amber, 5m+ red
      if (elapsedSec < 180) {
        nurseTimerContainer.className = "inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full border border-emerald-200 shadow-sm transition-colors";
      } else if (elapsedSec < 300) {
        nurseTimerContainer.className = "inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-300 shadow-sm transition-colors animate-pulse";
      } else {
        nurseTimerContainer.className = "inline-flex items-center space-x-1.5 px-3 py-1 bg-rose-50 text-rose-700 font-bold text-xs rounded-full border border-rose-300 shadow-sm transition-colors animate-pulse";
      }
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function stopNurseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    if (nurseTimerContainer) nurseTimerContainer.classList.add('hidden');
    if (nurseTimer) nurseTimer.textContent = "00:00";
  }

  function resetClinicalButtons() {
    tubeTagButtons.forEach(btn => {
      btn.className = "btn-tube-tag px-3 py-1.5 rounded-lg text-xs font-bold border transition-all bg-white border-slate-200 text-slate-700 hover:border-blue-400 active:scale-95";
    });
    noteTagButtons.forEach(btn => {
      btn.className = "btn-note-tag px-3 py-1 rounded-lg text-xs font-semibold border transition-all bg-white border-slate-200 text-slate-600 hover:border-amber-400 active:scale-95";
    });
  }

  // Bind Clinical Tag click events
  tubeTagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tubeName = btn.getAttribute('data-tube');
      if (selectedTubes.includes(tubeName)) {
        selectedTubes = selectedTubes.filter(t => t !== tubeName);
        btn.className = "btn-tube-tag px-3 py-1.5 rounded-lg text-xs font-bold border transition-all bg-white border-slate-200 text-slate-700 hover:border-blue-400 active:scale-95";
      } else {
        selectedTubes.push(tubeName);
        btn.className = "btn-tube-tag px-3 py-1.5 rounded-lg text-xs font-bold border transition-all bg-blue-600 text-white border-blue-600 shadow-sm active:scale-95";
      }
    });
  });

  noteTagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const noteName = btn.getAttribute('data-note');
      if (selectedNotes.includes(noteName)) {
        selectedNotes = selectedNotes.filter(n => n !== noteName);
        btn.className = "btn-note-tag px-3 py-1 rounded-lg text-xs font-semibold border transition-all bg-white border-slate-200 text-slate-600 hover:border-amber-400 active:scale-95";
      } else {
        selectedNotes.push(noteName);
        btn.className = "btn-note-tag px-3 py-1 rounded-lg text-xs font-semibold border transition-all bg-amber-500 text-white border-amber-500 shadow-sm active:scale-95";
      }
    });
  });

  // Fetch stats for Nurse
  async function fetchNurseStats() {
    if (!selectedDesk || !currentUser) return;

    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      
      // Update counts
      nurseStatWaiting.textContent = stats.totalWaiting;
      nurseStatCalling.textContent = stats.totalCalling;
      nurseStatCompleted.textContent = stats.totalCompleted;
      nurseBadgeWaitingCount.textContent = stats.totalWaiting;

      // Find if this specific desk is calling anything
      const activeCall = stats.callingList.find(c => c.desk === selectedDesk);
      if (activeCall) {
        if (activeCallingPatient !== activeCall.number) {
          activeCallingPatient = activeCall.number;
          selectedTubes = [];
          selectedNotes = [];
          resetClinicalButtons();
          startNurseTimer(activeCall.calledAt || new Date().toISOString());
        }
        nurseCurrentPatient.textContent = `${activeCall.number} (${activeCall.patientName || "Misafir Hasta"})`;
        btnNurseComplete.disabled = false;
        btnNurseRecall.disabled = false;
        if (nurseClinicalActions) nurseClinicalActions.classList.remove('hidden');
      } else {
        activeCallingPatient = null;
        nurseCurrentPatient.textContent = "-";
        btnNurseComplete.disabled = true;
        btnNurseRecall.disabled = true;
        stopNurseTimer();
        if (nurseClinicalActions) nurseClinicalActions.classList.add('hidden');
        selectedTubes = [];
        selectedNotes = [];
        resetClinicalButtons();
      }

      // Populate wait list sidebar
      nurseQueueList.innerHTML = '';
      if (stats.waitingList && stats.waitingList.length > 0) {
        stats.waitingList.forEach(item => {
          const isPriority = item.type === 'priority' || (item.number && item.number.startsWith('Ö-'));
          const div = document.createElement('div');
          div.className = `flex justify-between items-center ${isPriority ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-100'} border rounded-xl p-3 hover:bg-slate-100 transition-colors`;
          div.innerHTML = `
            <div class="flex flex-col">
              <div class="flex items-center space-x-2">
                <span class="font-extrabold ${isPriority ? 'text-amber-800' : 'text-slate-800'} text-lg tracking-wider">${item.number}</span>
                ${isPriority ? '<span class="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">ÖNCELİKLİ</span>' : ''}
              </div>
              <span class="text-xs ${isPriority ? 'text-amber-700' : 'text-slate-500'} font-semibold italic">${item.patientName || (isPriority ? 'Öncelikli Hasta' : 'Misafir Hasta')}</span>
            </div>
            <span class="text-[10px] ${isPriority ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-750'} px-2 py-0.5 rounded-full font-bold uppercase">Bekliyor</span>
          `;
          nurseQueueList.appendChild(div);
        });
      } else {
        nurseQueueList.innerHTML = `
          <div class="text-center text-slate-400 text-sm py-12">
            Bekleyen hasta bulunmuyor.
          </div>
        `;
      }

    } catch (err) {
      console.error("Failed to load nurse statistics:", err);
    }
  }

  // Nurse Actions
  btnNurseCallNext.addEventListener('click', async () => {
    if (!selectedDesk || !currentUser) return;
    
    btnNurseCallNext.disabled = true;
    btnNurseCallNext.classList.add('opacity-75');

    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ desk: selectedDesk })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Sırada bekleyen hasta kalmadı.");
        return;
      }

      fetchNurseStats();
    } catch (err) {
      console.error(err);
      alert("Çağrı yapılamadı.");
    } finally {
      btnNurseCallNext.disabled = false;
      btnNurseCallNext.classList.remove('opacity-75');
    }
  });

  btnNurseRecall.addEventListener('click', async () => {
    if (!activeCallingPatient || !selectedDesk || !currentUser) return;

    btnNurseRecall.disabled = true;

    try {
      await fetch('/api/recall', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          number: activeCallingPatient,
          desk: selectedDesk
        })
      });
    } catch (err) {
      console.error(err);
    } finally {
      btnNurseRecall.disabled = false;
    }
  });

  btnNurseComplete.addEventListener('click', async () => {
    if (!activeCallingPatient || !currentUser) return;

    btnNurseComplete.disabled = true;

    try {
      const finalDuration = nurseTimer ? nurseTimer.textContent : null;
      const res = await fetch('/api/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ 
          number: activeCallingPatient,
          duration: finalDuration,
          tubes: selectedTubes,
          notes: selectedNotes
        })
      });

      if (res.ok) {
        stopNurseTimer();
        activeCallingPatient = null;
        selectedTubes = [];
        selectedNotes = [];
        resetClinicalButtons();
        fetchNurseStats();
      } else {
        alert("İşlem tamamlanamadı.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      btnNurseComplete.disabled = false;
    }
  });


  // --- ADMIN VIEW LOGIC ---
  function renderAdminDashboard() {
    // Select first tab by default
    switchTab('tab-stats');
    
    // Bind tab clicks
    adminTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // Populate data
    fetchStats();
    fetchUsers();
    fetchLogs();
  }

  function switchTab(tabId) {
    adminTabs.forEach(tab => {
      const target = tab.getAttribute('data-tab');
      if (target === tabId) {
        tab.className = "btn-admin-tab border-b-2 border-blue-600 px-5 py-3 text-sm font-bold text-blue-600 focus:outline-none";
      } else {
        tab.className = "btn-admin-tab border-b-2 border-transparent px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 focus:outline-none";
      }
    });

    adminTabContents.forEach(content => {
      if (content.id === tabId) {
        content.classList.remove('hidden');
      } else {
        content.classList.add('hidden');
      }
    });
  }

  // Tab 1: Stats and Nurse List
  async function fetchStats() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();

      // Top Counters
      adminStatWaiting.textContent = stats.totalWaiting;
      adminStatCalling.textContent = stats.totalCalling;
      adminStatCompleted.textContent = stats.totalCompleted;

      // Render Hourly Density Bars Chart
      if (chartHourlyBars) {
        chartHourlyBars.innerHTML = '';
        const hourlyData = stats.hourlyDistribution || [];
        const maxCount = Math.max(...hourlyData.map(d => d.count), 4);

        hourlyData.forEach(slot => {
          const heightPercent = Math.max(10, Math.round((slot.count / maxCount) * 100));
          const col = document.createElement('div');
          col.className = "flex-1 flex flex-col items-center justify-end h-full group relative";
          col.innerHTML = `
            <span class="text-[10px] font-black ${slot.count > 0 ? 'text-blue-600' : 'text-slate-300'} mb-1">${slot.count}</span>
            <div class="w-full max-w-[24px] rounded-t-lg transition-all duration-500 ${slot.count > 0 ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-sm' : 'bg-slate-200'}" style="height: ${heightPercent}%;"></div>
            <span class="text-[10px] font-bold text-slate-500 mt-2 whitespace-nowrap">${slot.hour}</span>
          `;
          chartHourlyBars.appendChild(col);
        });
      }

      // Render Nurse Workload Share Distribution
      if (chartNurseDistribution) {
        chartNurseDistribution.innerHTML = '';
        const nurses = stats.nurseStats || [];
        const totalCompletedAll = nurses.reduce((acc, curr) => acc + curr.totalCompleted, 0);

        if (nurses.length === 0 || totalCompletedAll === 0) {
          chartNurseDistribution.innerHTML = `
            <div class="text-center text-slate-400 text-xs py-8">
              Henüz tamamlanan işlem bulunmuyor.
            </div>
          `;
        } else {
          nurses.forEach((nurse, idx) => {
            const sharePercent = totalCompletedAll > 0 ? Math.round((nurse.totalCompleted / totalCompletedAll) * 100) : 0;
            const barColors = ['bg-emerald-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500'];
            const textColors = ['text-emerald-700', 'text-blue-700', 'text-indigo-700', 'text-purple-700'];
            const barColor = barColors[idx % barColors.length];
            const textColor = textColors[idx % textColors.length];

            const item = document.createElement('div');
            item.className = "space-y-1";
            item.innerHTML = `
              <div class="flex justify-between text-xs font-bold text-slate-700">
                <span>${nurse.name}</span>
                <span class="${textColor}">%${sharePercent} (${nurse.totalCompleted} hasta)</span>
              </div>
              <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div class="${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${sharePercent}%"></div>
              </div>
            `;
            chartNurseDistribution.appendChild(item);
          });
        }
      }

      // Populate Nurse Statistics Table
      tableNurseStatsRows.innerHTML = '';
      if (stats.nurseStats && stats.nurseStats.length > 0) {
        stats.nurseStats.forEach(nurse => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-slate-800">${nurse.name}</td>
            <td class="py-4 px-6 text-slate-500 font-medium">${nurse.email}</td>
            <td class="py-4 px-6 text-center text-blue-600 font-extrabold">${nurse.totalCalling}</td>
            <td class="py-4 px-6 text-center text-emerald-600 font-extrabold">${nurse.totalCompleted}</td>
          `;
          tableNurseStatsRows.appendChild(tr);
        });
      } else {
        tableNurseStatsRows.innerHTML = `
          <tr>
            <td colspan="4" class="py-6 text-center text-slate-400 font-medium">Sistemde kayıtlı çalışan hemşire bulunmuyor.</td>
          </tr>
        `;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Tab 2: CRUD Users List
  async function fetchUsers() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const res = await fetch('/api/admin/users');
      const users = await res.json();

      tableUsersRows.innerHTML = '';
      users.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 hover:bg-slate-50/50";
        
        const deleteButton = user.email === 'admin@hastane.com' 
          ? `<span class="text-xs text-slate-400 font-bold italic">Sistem Koruyucu</span>`
          : `<button class="btn-delete-user px-3 py-1 bg-red-50 hover:bg-red-100 text-red-650 font-bold rounded-lg text-xs transition-all" data-email="${user.email}">Sil</button>`;

        const roleText = user.role === 'admin' 
          ? `<span class="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-bold">Admin</span>`
          : `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">Hemşire</span>`;

        tr.innerHTML = `
          <td class="py-3.5 px-6 font-bold text-slate-800">${user.name}</td>
          <td class="py-3.5 px-6 font-semibold text-slate-500">${user.email}</td>
          <td class="py-3.5 px-6">${roleText}</td>
          <td class="py-3.5 px-6 text-right">${deleteButton}</td>
        `;
        tableUsersRows.appendChild(tr);
      });

      // Bind delete clicks
      document.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.getAttribute('data-email');
          const confirmDelete = confirm(`${email} e-postalı çalışanı silmek istediğinize emin misiniz?`);
          if (confirmDelete) {
            try {
              const res = await fetch(`/api/admin/users/${email}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                fetchUsers();
              } else {
                const data = await res.json();
                alert(data.error || "Çalışan silinemedi.");
              }
            } catch (err) {
              console.error(err);
            }
          }
        });
      });

    } catch (err) {
      console.error(err);
    }
  }

  // Create new Nurse (Admin only)
  formAddNurse.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = addNurseName.value.trim();
    const email = addNurseEmail.value.trim();
    const password = addNursePassword.value;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, role: 'nurse' })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Çalışan eklenemedi.');
      }

      // Reset form & reload users
      addNurseName.value = '';
      addNurseEmail.value = '';
      addNursePassword.value = '';
      alert("Hemşire başarıyla eklendi.");
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert(err.message);
    }
  });

  // Tab 3: System Logs
  async function fetchLogs() {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      const res = await fetch('/api/admin/logs');
      const logs = await res.json();

      tableLogsRows.innerHTML = '';
      if (logs && logs.length > 0) {
        logs.forEach(log => {
          const tr = document.createElement('tr');
          tr.className = "border-b border-slate-100 hover:bg-slate-50/50";
          
          let actionBadge = '';
          switch(log.action) {
            case 'CALL':
              actionBadge = `<span class="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Çağrıldı</span>`;
              break;
            case 'COMPLETE':
              actionBadge = `<span class="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Bitirildi</span>`;
              break;
            case 'RECALL':
              actionBadge = `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Tekrar Çağrıldı</span>`;
              break;
            case 'RESET_QUEUE':
              actionBadge = `<span class="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-bold">Sıfırlandı</span>`;
              break;
            default:
              actionBadge = `<span class="bg-slate-100 text-slate-800 text-xs px-2.5 py-0.5 rounded-full font-bold">${log.action}</span>`;
          }

          const localTime = new Date(log.timestamp).toLocaleString('tr-TR');

          tr.innerHTML = `
            <td class="py-3 px-6 text-slate-500 font-semibold">${localTime}</td>
            <td class="py-3 px-6 font-bold text-slate-800">${log.userName}</td>
            <td class="py-3 px-6 font-semibold text-slate-550">${log.userEmail}</td>
            <td class="py-3 px-6">${actionBadge}</td>
            <td class="py-3 px-6 font-bold text-slate-800">
              <div class="flex items-center space-x-2">
                <span>${log.ticketNumber}</span>
                ${log.duration ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">⏱️ ${log.duration}</span>` : ''}
              </div>
              ${log.patientName && log.patientName !== "Misafir Hasta" && log.patientName !== "Öncelikli Hasta" ? `<span class="text-slate-400 font-medium text-xs block">(${log.patientName})</span>` : ''}
              ${log.tubes && log.tubes.length > 0 ? `<div class="text-[10px] text-blue-700 font-semibold mt-0.5">${log.tubes.join(', ')}</div>` : ''}
              ${log.notes && log.notes.length > 0 ? `<div class="text-[10px] text-amber-700 font-semibold">${log.notes.join(', ')}</div>` : ''}
            </td>
            <td class="py-3 px-6 font-semibold text-slate-500">${log.desk}</td>
          `;
          tableLogsRows.appendChild(tr);
        });
      } else {
        tableLogsRows.innerHTML = `
          <tr>
            <td colspan="6" class="py-6 text-center text-slate-400 font-medium">Sistem eylemleri günlüğü boş.</td>
          </tr>
        `;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Tab 4: Reset Database Control
  btnAdminReset.addEventListener('click', async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    const confirmReset = confirm("DİKKAT! Tüm bekleme sırasını, aktif biletleri ve eylem loglarını sıfırlamak istediğinize emin misiniz?");
    if (confirmReset) {
      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: {
            'x-user-email': currentUser.email
          }
        });

        if (res.ok) {
          alert("Sistem başarılı bir şekilde sıfırlandı.");
          fetchStats();
          fetchLogs();
        } else {
          alert("Sıfırlama başarısız oldu.");
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Helper for downloading CSV files with Excel-friendly UTF-8 BOM
  function downloadCSV(filename, csvRows) {
    const csvContent = csvRows.map(row => 
      row.map(field => {
        const stringField = String(field === null || field === undefined ? '' : field);
        return `"${stringField.replace(/"/g, '""')}"`;
      }).join(';')
    ).join('\r\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Export Nurse Performance Stats to CSV
  if (btnExportStatsCsv) {
    btnExportStatsCsv.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        const nurseStats = stats.nurseStats || [];
        
        const dateStr = new Date().toISOString().split('T')[0];
        const csvData = [
          ["ÇALIŞAN HEMŞİRE", "E-POSTA ADRESİ", "İŞLEME ALINAN HASTA", "TAMAMLANAN HASTA", "AKTİF ÇAĞRILAN"],
          ...nurseStats.map(n => [
            n.name,
            n.email,
            n.totalProcessed,
            n.totalCompleted,
            n.totalCalling
          ])
        ];

        downloadCSV(`kan_alma_hemsire_performans_${dateStr}.csv`, csvData);
      } catch (err) {
        alert("Rapor indirilemedi: " + err.message);
      }
    });
  }

  // Export System Logs to CSV
  if (btnExportLogsCsv) {
    btnExportLogsCsv.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/admin/logs');
        const logs = await res.json();

        const dateStr = new Date().toISOString().split('T')[0];
        const csvData = [
          ["TARİH / SAAT", "ÇALIŞAN PERSONEL", "E-POSTA", "EYLEM TÜRÜ", "SIRA NUMARASI", "HASTA ADI", "ODA / BİRİM", "İŞLEM SÜRESİ", "SEÇİLEN TÜPLER", "KLİNİK NOTLAR"],
          ...logs.map(log => {
            const localTime = new Date(log.timestamp).toLocaleString('tr-TR');
            return [
              localTime,
              log.userName,
              log.userEmail,
              log.action,
              log.ticketNumber,
              log.patientName || "Standart/Misafir",
              log.desk,
              log.duration || "-",
              log.tubes && log.tubes.length > 0 ? log.tubes.join(' | ') : "-",
              log.notes && log.notes.length > 0 ? log.notes.join(' | ') : "-"
            ];
          })
        ];

        downloadCSV(`kan_alma_sistem_loglari_${dateStr}.csv`, csvData);
      } catch (err) {
        alert("Loglar indirilemedi: " + err.message);
      }
    });
  }

  // Render Page State on Boot
  renderView();
});
