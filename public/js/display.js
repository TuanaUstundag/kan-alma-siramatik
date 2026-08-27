// Waiting Room TV Display Business Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const mainTicketEl = document.getElementById('main-ticket');
  const mainPatientNameEl = document.getElementById('main-patient-name');
  const mainDeskEl = document.getElementById('main-desk');
  const mainDisplayBox = document.getElementById('main-display-box');
  const historyRows = document.getElementById('history-rows');
  const audioConsentTv = document.getElementById('audio-consent-tv');

  let audioCtx = null;

  // Real-time Clock
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}:${seconds}`;

    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    dateEl.textContent = now.toLocaleDateString('tr-TR', options);
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Audio Context initialization for chime
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioConsentTv.classList.add('hidden');
      console.log("TV Chime Audio initialized.");
      
      // Play a quick test sound
      playChime();
    }
  }
  audioConsentTv.addEventListener('click', initAudio);

  // Chime synthesizer (Ding-Dong)
  function playChime() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;
    
    // Tone 1: E5 (659.25 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);
    
    // Tone 2: C5 (523.25 Hz) after 0.25 seconds
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, now + 0.25);
    
    gain2.gain.setValueAtTime(0, now + 0.25);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 1.2);
  }

  // Turkish Text-to-Speech (TTS) Announcement
  function speakAnnouncement(number, desk, patientName) {
    if (!('speechSynthesis' in window)) return;
    
    // Convert ticket number letters for natural Turkish reading (e.g. K-101 -> Ka 101)
    let readableNumber = number;
    if (number.includes('-')) {
      const parts = number.split('-');
      let prefix = parts[0].toUpperCase();
      if (prefix === 'K') prefix = 'Ka';
      if (prefix === 'Ö' || prefix === 'O') prefix = 'Öncelikli';
      
      const numPart = parseInt(parts[1], 10);
      readableNumber = `${prefix} ${numPart}`;
    }

    // Format desk name to sound natural (e.g. "Oda 1" -> "1 numaralı oda")
    let readableDesk = desk;
    if (desk.toLowerCase().includes('oda')) {
      const odaNum = desk.replace(/\D/g, ""); // extract numbers
      if (odaNum) {
        readableDesk = `${odaNum} numaralı kan alma odasına`;
      } else {
        readableDesk = `${desk} bölümüne`;
      }
    } else {
      readableDesk = `${desk} bölümüne`;
    }
    
    // Announce patient name if available, otherwise call them dear guest
    const nameText = patientName && patientName !== "Misafir Hasta" && patientName !== "Öncelikli Hasta" ? `Sayın ${patientName}` : "Sayın Misafirimiz";
    const text = `Sıra numarası ${readableNumber}. ${nameText}. Lütfen ${readableDesk} geçiniz.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 0.9; // Slightly slower for clarity
    
    // Load Turkish voice if available
    const voices = window.speechSynthesis.getVoices();
    const trVoice = voices.find(v => v.lang.includes('tr') || v.lang.includes('TR'));
    if (trVoice) {
      utterance.voice = trVoice;
    }
    
    // Play after chime finishes (approx 800ms)
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 850);
  }

  // Load voices list (needed for Chrome support of speechSynthesis.getVoices())
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = window.speechSynthesis.getVoices;
    }
  }

  // Fetch initial data
  async function refreshDisplay() {
    try {
      const res = await fetch('/api/stats');
      const stats = await res.json();
      updateUI(stats);
    } catch (error) {
      console.error("Failed to refresh TV display:", error);
    }
  }
  refreshDisplay();

  function updateUI(stats) {
    const history = stats.calledHistory || [];
    
    if (history.length > 0) {
      // The first item in history is the most recently called ticket
      const activeCall = history[0];
      mainTicketEl.textContent = activeCall.number;
      mainPatientNameEl.textContent = activeCall.patientName || "Misafir Hasta";
      mainDeskEl.textContent = activeCall.desk;
      mainTicketEl.classList.remove('text-slate-600');
      mainTicketEl.classList.add('text-blue-500');

      // Populate history table with remaining items
      const historyItems = history.slice(1);
      historyRows.innerHTML = '';
      
      // Pad history rows to keep exactly 4 slots
      for (let i = 0; i < 4; i++) {
        const item = historyItems[i];
        const row = document.createElement('tr');
        row.className = "border-b border-slate-700/50 hover:bg-slate-750 transition-colors";
        
        if (item) {
          row.innerHTML = `
            <td class="py-5 px-8 text-blue-400 font-bold">
              ${item.number} 
              <span class="text-slate-400 text-lg font-medium block md:inline md:ml-3">(${item.patientName || "Misafir Hasta"})</span>
            </td>
            <td class="py-5 px-8 text-right text-white font-medium">${item.desk}</td>
          `;
        } else {
          row.innerHTML = `
            <td class="py-5 px-8 text-slate-600 font-bold">-</td>
            <td class="py-5 px-8 text-right text-slate-600 font-medium">-</td>
          `;
        }
        historyRows.appendChild(row);
      }
    } else {
      mainTicketEl.textContent = "-";
      mainPatientNameEl.textContent = "";
      mainDeskEl.textContent = "Sıra Bekleniyor";
      mainTicketEl.classList.add('text-slate-600');
      mainTicketEl.classList.remove('text-blue-500');
      
      // Empty history table
      historyRows.innerHTML = Array(4).fill(0).map(() => `
        <tr class="border-b border-slate-700/50">
          <td class="py-5 px-8 text-slate-600 font-bold">-</td>
          <td class="py-5 px-8 text-right text-slate-600 font-medium">-</td>
        </tr>
      `).join('');
    }
  }

  // Socket.IO real-time triggers
  const socket = io();

  socket.on('ticket-called', (data) => {
    // 1. Refresh stats to update table
    refreshDisplay();

    // 2. Play Audio alerts (pass ticket's patientName)
    playChime();
    speakAnnouncement(data.ticket.number, data.desk, data.ticket.patientName);

    // 3. Visual flash alert on the main box
    mainDisplayBox.classList.remove('active-call-flash');
    void mainDisplayBox.offsetWidth; // Trigger reflow to restart CSS animation
    mainDisplayBox.classList.add('active-call-flash');
  });

  socket.on('ticket-created', refreshDisplay);
  socket.on('ticket-completed', refreshDisplay);
  socket.on('queue-reset', refreshDisplay);
});
