// Patient Live Tracking Business Logic

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const ticketNumber = urlParams.get('no') ? urlParams.get('no').toUpperCase().trim() : null;

  // Elements
  const trackingCard = document.getElementById('tracking-card');
  const errorCard = document.getElementById('error-card');
  const ticketNumberEl = document.getElementById('ticket-number');
  
  const statusCard = document.getElementById('status-card');
  const statusIcon = document.getElementById('status-icon');
  const statusTitle = document.getElementById('status-title');
  const statusDesc = document.getElementById('status-desc');
  
  const waitingBeforeEl = document.getElementById('waiting-before');
  const currentCalledNumberEl = document.getElementById('current-called-number');
  const consentBanner = document.getElementById('consent-banner');
  const btnAllowPermissions = document.getElementById('btn-allow-permissions');
  
  const callingModal = document.getElementById('calling-modal');
  const callingModalDesk = document.getElementById('calling-modal-desk');
  const btnAckCalling = document.getElementById('btn-ack-calling');

  // Web Audio Context for generating notification sounds
  let audioCtx = null;

  function checkBannerVisibility() {
    const hasNotificationPermission = !('Notification' in window) || Notification.permission === 'granted';
    const hasAudioCtx = audioCtx !== null;
    
    if (hasNotificationPermission && hasAudioCtx) {
      consentBanner.classList.add('hidden');
    }
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      console.log("Audio Context initialized successfully.");
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    checkBannerVisibility();
  }

  // Trigger audio initialization on user interaction
  document.body.addEventListener('click', initAudio);
  document.body.addEventListener('touchstart', initAudio);

  // Allow permissions button click logic
  if (btnAllowPermissions) {
    btnAllowPermissions.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log("Notification permission granted.");
            new Notification("Bildirimler Aktif Edildi", {
              body: "Sıranız geldiğinde ekran arka planda olsa dahi bildirim alacaksınız.",
              tag: "sira-test"
            });
          }
          checkBannerVisibility();
        });
      }
    });
  }

  // Sound generator
  function playAlarm() {
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    // Play a series of 3 alert tones
    for (let i = 0; i < 3; i++) {
      const startTime = now + (i * 0.35);
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, startTime); // A5 note
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    }
  }

  // Check if we have a ticket number
  if (!ticketNumber) {
    showError();
    return;
  }

  ticketNumberEl.textContent = ticketNumber;

  // Fetch ticket details & stats
  async function refreshData() {
    try {
      // 1. Fetch individual ticket info
      const ticketRes = await fetch(`/api/ticket/${ticketNumber}`);
      if (!ticketRes.ok) {
        showError();
        return;
      }
      const ticket = await ticketRes.json();
      updateTicketUI(ticket);

      // 2. Fetch general stats for "Yanan Sıra"
      const statsRes = await fetch('/api/stats');
      const stats = await statsRes.json();
      
      if (stats.callingList && stats.callingList.length > 0) {
        // Show the most recently called ticket
        currentCalledNumberEl.textContent = stats.callingList[stats.callingList.length - 1].number;
      } else {
        currentCalledNumberEl.textContent = "-";
      }

    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  }

  function updateTicketUI(ticket) {
    // Waiting Count
    waitingBeforeEl.textContent = ticket.waitingBefore;

    // Status UI changes
    if (ticket.status === 'waiting') {
      // Reset status card to blue info mode
      statusCard.className = "bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center space-y-3";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
        </svg>`;
      statusTitle.className = "text-lg font-bold text-blue-900";
      statusTitle.textContent = "Sıranız Beklemede";
      statusDesc.className = "text-sm text-blue-700 font-medium";
      statusDesc.textContent = `Önünüzde ${ticket.waitingBefore} kişi bulunuyor. Lütfen bekleyiniz.`;
      
      callingModal.classList.add('hidden');
    } 
    else if (ticket.status === 'calling') {
      // Set status card to emerald flashing mode
      statusCard.className = "animate-pulse-green border border-emerald-500 rounded-2xl p-6 text-center space-y-3 text-white";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>`;
      statusTitle.className = "text-xl font-black";
      statusTitle.textContent = "SIRANIZ GELDİ!";
      statusDesc.className = "text-sm font-semibold";
      statusDesc.textContent = `Lütfen hemen ${ticket.desk} ünitesine geçiniz.`;

      // Trigger alerts if not already acknowledged
      showCallingModal(ticket.desk);
    } 
    else if (ticket.status === 'completed') {
      // Set status card to gray completed mode
      statusCard.className = "bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center space-y-3 text-slate-500";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;
      statusTitle.className = "text-lg font-bold text-slate-700";
      statusTitle.textContent = "İşleminiz Tamamlandı";
      statusDesc.className = "text-sm font-medium text-slate-500";
      statusDesc.textContent = "Kan alma işleminiz bitti. Geçmiş olsun dileriz.";
      
      callingModal.classList.add('hidden');
    }
  }

  function showCallingModal(desk) {
    callingModalDesk.textContent = desk;
    if (callingModal.classList.contains('hidden')) {
      callingModal.classList.remove('hidden');
      
      // Play Sound
      playAlarm();
      
      // Vibrate on mobile devices (200ms vibe, 100ms pause, 200ms vibe)
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 200]);
      }

      // Send System Level Notification (even if minimized / background)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("Sıranız Geldi!", {
          body: `Lütfen hemen ${desk} birimine geçiniz. (Bilet No: ${ticketNumber})`,
          tag: "sira-cagrisi",
          requireInteraction: true
        });
      }
    }
  }

  function showError() {
    trackingCard.classList.add('hidden');
    errorCard.classList.remove('hidden');
  }

  // Load initial data
  refreshData();

  // Socket.IO real-time binding
  const socket = io();

  // Subscribe to tracking events for this specific ticket
  socket.emit('track-ticket', ticketNumber);

  // Triggered when called specifically
  socket.on('your-turn', (data) => {
    refreshData();
    showCallingModal(data.desk || data.ticket.desk);
  });

  // Triggered when anything updates (re-calculate positions and called numbers)
  socket.on('ticket-created', refreshData);
  socket.on('ticket-called', refreshData);
  socket.on('ticket-completed', refreshData);

  socket.on('queue-reset', () => {
    showError();
  });

  // Acknowledge calling notification modal
  btnAckCalling.addEventListener('click', () => {
    callingModal.classList.add('hidden');
    initAudio(); // Initialize audio context if not already done
  });
});
