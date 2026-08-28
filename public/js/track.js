// Patient Live Tracking Business Logic

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const ticketNumber = urlParams.get('no') ? decodeURIComponent(urlParams.get('no')).toUpperCase().trim() : null;

  // Elements
  const trackingCard = document.getElementById('tracking-card');
  const errorCard = document.getElementById('error-card');
  const ticketNumberEl = document.getElementById('ticket-number');
  const trackPatientNameEl = document.getElementById('track-patient-name');
  const trackTicketTypeBadge = document.getElementById('track-ticket-type-badge');
  const preCallAlert = document.getElementById('pre-call-alert');
  const estimatedWaitTimeEl = document.getElementById('estimated-wait-time');
  
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

  // Feedback Elements
  const feedbackCard = document.getElementById('feedback-card');
  const feedbackCommentInput = document.getElementById('feedback-comment');
  const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
  const feedbackThankyou = document.getElementById('feedback-thankyou');
  const starButtons = document.querySelectorAll('.star-btn');
  let selectedRating = 5;
  let preAlertTriggered = false;
  let callAcknowledged = false;
  let lastCalledTimestamp = null;

  // Web Audio Context
  let audioCtx = null;

  function checkBannerVisibility() {
    const hasNotificationPermission = !('Notification' in window) || Notification.permission === 'granted';
    const hasAudioCtx = audioCtx !== null;
    
    if (hasNotificationPermission && hasAudioCtx) {
      if (consentBanner) consentBanner.classList.add('hidden');
    }
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    checkBannerVisibility();
  }

  document.body.addEventListener('click', initAudio);
  document.body.addEventListener('touchstart', initAudio);

  if (btnAllowPermissions) {
    btnAllowPermissions.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
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
    
    for (let i = 0; i < 3; i++) {
      const startTime = now + (i * 0.35);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    }
  }

  if (!ticketNumber) {
    showError();
    return;
  }

  ticketNumberEl.textContent = ticketNumber;

  // Star Rating Click Logic
  starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.getAttribute('data-star'), 10) || 5;
      updateStarsUI(selectedRating);
    });
  });

  function updateStarsUI(rating) {
    starButtons.forEach(btn => {
      const starVal = parseInt(btn.getAttribute('data-star'), 10);
      if (starVal <= rating) {
        btn.classList.add('text-amber-400');
        btn.classList.remove('text-slate-300');
      } else {
        btn.classList.remove('text-amber-400');
        btn.classList.add('text-slate-300');
      }
    });
  }

  if (btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener('click', async () => {
      btnSubmitFeedback.disabled = true;
      btnSubmitFeedback.textContent = "Gönderiliyor...";
      const comment = feedbackCommentInput ? feedbackCommentInput.value.trim() : "";
      
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: ticketNumber, rating: selectedRating, comment })
        });
        if (feedbackThankyou) feedbackThankyou.classList.remove('hidden');
        btnSubmitFeedback.classList.add('hidden');
        if (feedbackCommentInput) feedbackCommentInput.classList.add('hidden');
      } catch (err) {
        console.error("Feedback submit error:", err);
      }
    });
  }

  // Fetch ticket details & stats
  async function refreshData() {
    try {
      const ticketRes = await fetch(`/api/ticket/${encodeURIComponent(ticketNumber)}`);
      if (!ticketRes.ok) {
        showError();
        return;
      }
      const ticket = await ticketRes.json();
      updateTicketUI(ticket);

      const statsRes = await fetch('/api/stats');
      const stats = await statsRes.json();
      
      if (stats.callingList && stats.callingList.length > 0) {
        currentCalledNumberEl.textContent = stats.callingList[stats.callingList.length - 1].number;
      } else {
        currentCalledNumberEl.textContent = "-";
      }

    } catch (error) {
      console.error("Error refreshing data:", error);
    }
  }

  function updateTicketUI(ticket) {
    // Patient Name & Priority Badge
    if (trackPatientNameEl) {
      trackPatientNameEl.textContent = ticket.patientName && ticket.patientName !== "Misafir Hasta" 
        ? `Sayın ${ticket.patientName}` 
        : "Sayın Misafirimiz";
    }

    const isPriority = ticket.type === 'priority' || ticket.number.startsWith('Ö-');
    if (trackTicketTypeBadge) {
      if (isPriority) {
        trackTicketTypeBadge.classList.remove('hidden');
      } else {
        trackTicketTypeBadge.classList.add('hidden');
      }
    }

    // Waiting Count
    waitingBeforeEl.textContent = ticket.waitingBefore;

    // Dynamic Estimated Wait Time calculation (~3 mins per patient ahead)
    if (estimatedWaitTimeEl) {
      if (ticket.status === 'waiting') {
        const estMin = Math.max(1, (ticket.waitingBefore || 0) * 3);
        estimatedWaitTimeEl.textContent = `~${estMin} dk`;
      } else if (ticket.status === 'calling') {
        estimatedWaitTimeEl.textContent = "Şimdi!";
      } else {
        estimatedWaitTimeEl.textContent = "-";
      }
    }

    // Pre-call Early Warning Alert (When 1-2 people ahead)
    if (preCallAlert) {
      if (ticket.status === 'waiting' && ticket.waitingBefore > 0 && ticket.waitingBefore <= 2) {
        preCallAlert.classList.remove('hidden');
        if (!preAlertTriggered) {
          preAlertTriggered = true;
          if (navigator.vibrate) navigator.vibrate([150, 75, 150]);
        }
      } else {
        preCallAlert.classList.add('hidden');
      }
    }

    // Status UI changes
    if (ticket.status === 'waiting') {
      statusCard.className = "bg-blue-50 border border-blue-100 rounded-2xl p-5 text-center space-y-2.5";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
        </svg>`;
      statusTitle.className = "text-base font-bold text-blue-900";
      statusTitle.textContent = "Sıranız Beklemede";
      statusDesc.className = "text-xs text-blue-700 font-medium";
      statusDesc.textContent = `Önünüzde ${ticket.waitingBefore} kişi bulunuyor. Sıranız gelene kadar bekleyiniz.`;
      
      callingModal.classList.add('hidden');
      if (feedbackCard) feedbackCard.classList.add('hidden');
    } 
    else if (ticket.status === 'calling') {
      statusCard.className = "bg-gradient-to-r from-emerald-500 to-green-600 border border-emerald-400 rounded-2xl p-5 text-center space-y-2 text-white shadow-lg animate-pulse";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>`;
      statusTitle.className = "text-lg font-black";
      statusTitle.textContent = "SIRANIZ GELDİ!";
      statusDesc.className = "text-xs font-semibold text-emerald-100";
      statusDesc.textContent = `Lütfen hemen ${ticket.desk} ünitesine geçiniz.`;

      // If this is a new call or a recall (new calledAt timestamp), reset acknowledgement
      if (ticket.calledAt && ticket.calledAt !== lastCalledTimestamp) {
        lastCalledTimestamp = ticket.calledAt;
        callAcknowledged = false;
      }

      if (!callAcknowledged) {
        showCallingModal(ticket.desk);
      }
      if (feedbackCard) feedbackCard.classList.add('hidden');
    } 
    else if (ticket.status === 'completed') {
      callAcknowledged = true;
      statusCard.className = "bg-slate-100 border border-slate-200 rounded-2xl p-5 text-center space-y-2 text-slate-600";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;
      statusTitle.className = "text-base font-bold text-slate-800";
      statusTitle.textContent = "İşleminiz Tamamlandı";
      statusDesc.className = "text-xs font-medium text-slate-500";
      statusDesc.textContent = "Kan alma işleminiz bitti. Sağlıklı günler dileriz.";
      
      callingModal.classList.add('hidden');
      if (feedbackCard) feedbackCard.classList.remove('hidden');
    }
    else if (ticket.status === 'noshow') {
      callAcknowledged = true;
      statusCard.className = "bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center space-y-2 text-rose-700";
      statusIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>`;
      statusTitle.className = "text-base font-bold text-rose-900";
      statusTitle.textContent = "Çağrıya Cevap Verilmedi";
      statusDesc.className = "text-xs font-medium text-rose-600";
      statusDesc.textContent = "Sıranız çağrıldı ancak odaya gelinmediği için pas geçildi. Lütfen görevli danışmaya başvurunuz.";
      callingModal.classList.add('hidden');
    }
  }

  function showCallingModal(desk) {
    if (callAcknowledged) return;
    callingModalDesk.textContent = desk;
    if (callingModal.classList.contains('hidden')) {
      callingModal.classList.remove('hidden');
      playAlarm();
      
      if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]);
      }

      // Trigger OS-level system pop-up banner over all other apps
      if ('Notification' in window && Notification.permission === 'granted') {
        const notifTitle = "🔔 SIRANIZ GELDİ!";
        const notifOptions = {
          body: `Lütfen hemen ${desk} birimine geçiniz. (Bilet No: ${ticketNumber})`,
          icon: "https://cdn-icons-png.flaticon.com/512/2869/2869818.png",
          badge: "https://cdn-icons-png.flaticon.com/512/2869/2869818.png",
          tag: "sira-cagrisi",
          renotify: true,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          data: { url: window.location.href }
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(notifTitle, notifOptions);
          }).catch(() => {
            new Notification(notifTitle, notifOptions);
          });
        } else {
          new Notification(notifTitle, notifOptions);
        }
      }
    }
  }

  function showError() {
    trackingCard.classList.add('hidden');
    errorCard.classList.remove('hidden');
  }

  refreshData();
  // Auto-sync polling every 3 seconds for continuous live connectivity
  setInterval(refreshData, 3000);

  // Socket.IO real-time binding
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.emit('track-ticket', ticketNumber);

    socket.on('your-turn', (data) => {
      callAcknowledged = false;
      refreshData();
      showCallingModal(data.desk || data.ticket.desk);
    });

    socket.on('ticket-created', refreshData);
    socket.on('ticket-called', refreshData);
    socket.on('ticket-completed', refreshData);
    socket.on('queue-reset', showError);
  }

  btnAckCalling.addEventListener('click', () => {
    callAcknowledged = true;
    callingModal.classList.add('hidden');
    initAudio();
  });
});
