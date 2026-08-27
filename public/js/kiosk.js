// Contactless Lobby Kiosk Business Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const waitingCountEl = document.getElementById('waiting-count');
  const lastCalledEl = document.getElementById('last-called');
  
  const lobbyQrcodeContainer = document.getElementById('lobby-qrcode');
  const lobbyQrUrlEl = document.getElementById('lobby-qr-url');

  // Touch Screen Fallback Elements
  const btnOpenTouchKiosk = document.getElementById('btn-open-touch-kiosk');
  const touchKioskModal = document.getElementById('touch-kiosk-modal');
  const btnCloseTouchModal = document.getElementById('btn-close-touch-modal');
  const btnGetTicket = document.getElementById('btn-get-ticket');
  const btnGetPriorityTicket = document.getElementById('btn-get-priority-ticket');
  
  const ticketModal = document.getElementById('ticket-modal');
  const modalTicketNumber = document.getElementById('modal-ticket-number');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalCountdownEl = document.getElementById('modal-countdown');
  
  let countdownInterval = null;
  let lobbyQrInstance = null;

  // Initialize clock
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hours}:${minutes}`;

    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    if (dateEl) dateEl.textContent = now.toLocaleDateString('tr-TR', options);
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Initialize Main Lobby QR Code pointing to /sira-al
  async function initLobbyQRCode() {
    let origin = window.location.origin;

    // If running locally, fetch server LAN Wi-Fi IP so phones can access
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const ipRes = await fetch('/api/server-ip');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          origin = `http://${ipData.ip}:${ipData.port}`;
        }
      } catch (err) {
        console.warn("Server LAN IP fetch failed:", err);
      }
    }

    const mobileKioskUrl = `${origin}/sira-al`;

    if (lobbyQrUrlEl) {
      lobbyQrUrlEl.textContent = mobileKioskUrl;
    }

    if (lobbyQrcodeContainer) {
      lobbyQrcodeContainer.innerHTML = '';
      try {
        lobbyQrInstance = new QRCode(lobbyQrcodeContainer, {
          text: mobileKioskUrl,
          width: 190,
          height: 190,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (qrErr) {
        console.error("Lobby QR generation error:", qrErr);
      }
    }
  }

  initLobbyQRCode();

  // Fetch initial stats
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      updateStatsUI(stats);
    } catch (error) {
      console.error("Failed to fetch initial stats:", error);
    }
  }
  fetchStats();

  function updateStatsUI(stats) {
    if (waitingCountEl) waitingCountEl.textContent = stats.totalWaiting;
    if (lastCalledEl) {
      if (stats.callingList && stats.callingList.length > 0) {
        lastCalledEl.textContent = stats.callingList[stats.callingList.length - 1].number;
      } else {
        lastCalledEl.textContent = "Yok";
      }
    }
  }

  // Socket.IO connections for live queue sync
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('ticket-created', () => fetchStats());
    socket.on('ticket-called', () => fetchStats());
    socket.on('ticket-completed', () => fetchStats());
    socket.on('queue-reset', () => fetchStats());
  }

  // Touch Screen Modal Controls
  if (btnOpenTouchKiosk && touchKioskModal) {
    btnOpenTouchKiosk.addEventListener('click', () => {
      touchKioskModal.classList.remove('hidden');
    });
  }

  if (btnCloseTouchModal && touchKioskModal) {
    btnCloseTouchModal.addEventListener('click', () => {
      touchKioskModal.classList.add('hidden');
    });
  }

  // Fallback direct ticket issue from touch screen
  async function requestDirectTicket(type, btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.classList.add('opacity-70');
    }
    
    try {
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          type, 
          patientName: type === 'priority' ? 'Öncelikli Hasta' : 'Misafir Hasta' 
        })
      });
      const ticket = await res.json();
      
      // Close touch selection modal and show ticket number
      if (touchKioskModal) touchKioskModal.classList.add('hidden');
      showSuccessModal(ticket);
    } catch (error) {
      alert("Sıra alınırken bir hata oluştu. Lütfen tekrar deneyin.");
      console.error(error);
    } finally {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.classList.remove('opacity-70');
      }
    }
  }

  if (btnGetTicket) {
    btnGetTicket.addEventListener('click', () => requestDirectTicket('standard', btnGetTicket));
  }

  if (btnGetPriorityTicket) {
    btnGetPriorityTicket.addEventListener('click', () => requestDirectTicket('priority', btnGetPriorityTicket));
  }

  // Success Modal Functions
  function showSuccessModal(ticket) {
    if (modalTicketNumber) modalTicketNumber.textContent = ticket.number;
    if (ticketModal) ticketModal.classList.remove('hidden');
    
    let timeLeft = 10;
    if (modalCountdownEl) modalCountdownEl.textContent = timeLeft;
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
      timeLeft--;
      if (modalCountdownEl) modalCountdownEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        closeSuccessModal();
      }
    }, 1000);
  }

  function closeSuccessModal() {
    if (ticketModal) ticketModal.classList.add('hidden');
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closeSuccessModal);
  }
});
