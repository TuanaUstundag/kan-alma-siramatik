// Mobile Kiosk (Contactless Ticket Dispenser) Logic

document.addEventListener('DOMContentLoaded', () => {
  const btnGetStandard = document.getElementById('btn-get-standard');
  const btnGetPriority = document.getElementById('btn-get-priority');
  const inputPatientName = document.getElementById('input-patient-name');
  const mobileWaitingCount = document.getElementById('mobile-waiting-count');
  const mobileLastCalled = document.getElementById('mobile-last-called');

  let isSubmitting = false;

  // Fetch initial queue stats for mobile summary
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      
      if (mobileWaitingCount) {
        mobileWaitingCount.textContent = stats.totalWaiting;
      }
      if (mobileLastCalled) {
        if (stats.callingList && stats.callingList.length > 0) {
          mobileLastCalled.textContent = stats.callingList[stats.callingList.length - 1].number;
        } else {
          mobileLastCalled.textContent = "Yok";
        }
      }
    } catch (err) {
      console.error("Failed to load stats on mobile:", err);
    }
  }

  fetchStats();

  // Socket.IO for live queue count updates
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('ticket-created', () => fetchStats());
    socket.on('ticket-called', () => fetchStats());
    socket.on('ticket-completed', () => fetchStats());
    socket.on('queue-reset', () => fetchStats());
  }

  // Handle Ticket Request
  async function handleTakeTicket(type, clickedBtn) {
    if (isSubmitting) return;
    isSubmitting = true;

    // UI Loading state
    const originalContent = clickedBtn.innerHTML;
    clickedBtn.innerHTML = `
      <div class="flex items-center justify-center space-x-2 py-1 w-full">
        <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Sıra Numaranız Alınıyor...</span>
      </div>
    `;
    clickedBtn.disabled = true;
    clickedBtn.classList.add('opacity-80');

    if (type === 'standard' && btnGetPriority) btnGetPriority.disabled = true;
    if (type === 'priority' && btnGetStandard) btnGetStandard.disabled = true;

    try {
      const patientNameVal = inputPatientName ? inputPatientName.value.trim() : "";
      const defaultName = type === 'priority' ? "Öncelikli Hasta" : "Misafir Hasta";

      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: type,
          patientName: patientNameVal || defaultName
        })
      });

      if (!res.ok) {
        throw new Error("Sıra oluşturulamadı.");
      }

      const ticket = await res.json();

      // Immediately redirect to patient live tracking screen
      const encodedNo = encodeURIComponent(ticket.number);
      window.location.href = `/track?no=${encodedNo}`;

    } catch (error) {
      alert("Sıra alınırken bir hata oluştu: " + error.message);
      clickedBtn.innerHTML = originalContent;
      clickedBtn.disabled = false;
      clickedBtn.classList.remove('opacity-80');
      if (btnGetStandard) btnGetStandard.disabled = false;
      if (btnGetPriority) btnGetPriority.disabled = false;
      isSubmitting = false;
    }
  }

  // Button Listeners
  if (btnGetStandard) {
    btnGetStandard.addEventListener('click', () => handleTakeTicket('standard', btnGetStandard));
  }

  if (btnGetPriority) {
    btnGetPriority.addEventListener('click', () => handleTakeTicket('priority', btnGetPriority));
  }
});
