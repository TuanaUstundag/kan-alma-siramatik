// Kiosk Screen Business Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const btnGetTicket = document.getElementById('btn-get-ticket');
  const btnGetPriorityTicket = document.getElementById('btn-get-priority-ticket');
  const waitingCountEl = document.getElementById('waiting-count');
  const lastCalledEl = document.getElementById('last-called');
  
  const ticketModal = document.getElementById('ticket-modal');
  const modalTicketNumber = document.getElementById('modal-ticket-number');
  const qrcodeContainer = document.getElementById('qrcode');
  const qrDirectLinkEl = document.getElementById('qr-direct-link');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalCountdownEl = document.getElementById('modal-countdown');
  
  let countdownInterval = null;
  let qrCodeInstance = null;

  // Initialize clock
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;

    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateEl.textContent = now.toLocaleDateString('tr-TR', options);
  }
  updateClock();
  setInterval(updateClock, 1000);

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
    waitingCountEl.textContent = stats.totalWaiting;
    if (stats.callingList && stats.callingList.length > 0) {
      // Show the last called number
      lastCalledEl.textContent = stats.callingList[stats.callingList.length - 1].number;
    } else {
      lastCalledEl.textContent = "Yok";
    }
  }

  // Socket.IO connections (load socket.io library)
  if (typeof io !== 'undefined') {
    const socket = io();

    socket.on('ticket-created', () => {
      fetchStats();
    });

    socket.on('ticket-called', () => {
      fetchStats();
    });

    socket.on('ticket-completed', () => {
      fetchStats();
    });

    socket.on('queue-reset', () => {
      fetchStats();
    });
  }

  // Ticket Generation Request Handler
  async function requestTicket(type = 'standard', btnElement) {
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
      
      showTicketModal(ticket);
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

  // Get Standard Ticket Click
  btnGetTicket.addEventListener('click', () => {
    requestTicket('standard', btnGetTicket);
  });

  // Get Priority Ticket Click
  if (btnGetPriorityTicket) {
    btnGetPriorityTicket.addEventListener('click', () => {
      requestTicket('priority', btnGetPriorityTicket);
    });
  }

  // Modal Functions
  async function showTicketModal(ticket) {
    modalTicketNumber.textContent = ticket.number;
    
    // Clear old QR code
    qrcodeContainer.innerHTML = '';
    
    // Determine the host for QR code.
    // If opened via localhost, fetch server LAN IP dynamically so mobile scanning works.
    let origin = window.location.origin;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const ipRes = await fetch('/api/server-ip');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          origin = `http://${ipData.ip}:${ipData.port}`;
        }
      } catch (ipErr) {
        console.warn("Server LAN IP fetch failed, using current origin:", ipErr);
      }
    }
    
    // Generate QR Code containing the tracking URL
    // Encode ticket.number with encodeURIComponent so non-ASCII characters (e.g. 'Ö') don't crash QRCode.js
    const safeTicketNo = encodeURIComponent(ticket.number);
    const trackingUrl = `${origin}/track?no=${safeTicketNo}`;
    
    if (qrDirectLinkEl) {
      qrDirectLinkEl.textContent = `${origin}/track?no=${ticket.number}`;
    }

    try {
      qrCodeInstance = new QRCode(qrcodeContainer, {
        text: trackingUrl,
        width: 175,
        height: 175,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
      });
    } catch (qrError) {
      console.error("QR Code rendering error:", qrError);
    }

    // Show modal
    ticketModal.classList.remove('hidden');
    
    // Start countdown for auto-closing (15 seconds for easy phone scanning)
    let timeLeft = 15;
    modalCountdownEl.textContent = timeLeft;
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
      timeLeft--;
      modalCountdownEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        closeModal();
      }
    }, 1000);
  }

  function closeModal() {
    ticketModal.classList.add('hidden');
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  btnCloseModal.addEventListener('click', closeModal);
});
