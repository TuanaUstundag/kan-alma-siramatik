const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('./database');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Home / Root Route: Smart Device Detection
app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  
  if (isMobile) {
    return res.sendFile(path.join(__dirname, 'public', 'mobile-kiosk.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

// Dedicated desktop kiosk route
app.get('/kiosk', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

// Middleware helper to mock authentication check (optional, but clean)
function getRequesterEmail(req) {
  return req.headers['x-user-email'] || req.body.userEmail || "sistem@hastane.com";
}

// API Routes

// Get server LAN IP address (Prioritizes Wi-Fi and skips 169.254 link-local)
app.get('/api/server-ip', (req, res) => {
  const interfaces = os.networkInterfaces();
  let bestCandidate = null;

  for (const name of Object.keys(interfaces)) {
    const isWifi = name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan') || name.toLowerCase().includes('wireless');
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        if (isWifi) {
          return res.json({ ip: iface.address, port: PORT });
        }
        if (!bestCandidate) {
          bestCandidate = iface.address;
        }
      }
    }
  }

  res.json({ ip: bestCandidate || 'localhost', port: PORT });
});

// User Login Endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });
  }

  const user = Database.authenticateUser(email, password);
  if (!user) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }

  res.json({ success: true, user });
});

// Admin Route: Get Users List
app.get('/api/admin/users', (req, res) => {
  res.json(Database.getUsers());
});

// Admin Route: Add New User
app.post('/api/admin/users', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Tüm alanlar gereklidir.' });
  }

  const result = Database.addUser(name, email, password, role);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  // Notify clients (like admin dashboard) to refresh user lists
  io.emit('users-updated');

  res.json(result);
});

// Admin Route: Delete User
app.delete('/api/admin/users/:email', (req, res) => {
  const { email } = req.params;
  const result = Database.deleteUser(email);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  io.emit('users-updated');
  res.json(result);
});

// Admin Route: Get Logs List
app.get('/api/admin/logs', (req, res) => {
  res.json(Database.getLogs());
});

// Admin Route: Get Feedbacks & Reviews List
app.get('/api/admin/feedbacks', (req, res) => {
  res.json(Database.getFeedbacks());
});

// Get current queue statistics
app.get('/api/stats', (req, res) => {
  res.json(Database.getStats());
});

// Create a new queue ticket (called from kiosk)
app.post('/api/ticket', (req, res) => {
  const { patientName, type } = req.body || {};
  const ticket = Database.createTicket(patientName, type);
  
  // Broadcast to all clients
  io.emit('ticket-created', ticket);
  res.json(ticket);
});

// Get specific ticket status and waiting position
app.get('/api/ticket/:number', (req, res) => {
  const number = decodeURIComponent(req.params.number).toUpperCase();
  const ticket = Database.getTicket(number);
  
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const waitingBefore = Database.getWaitingCountBefore(number);
  res.json({
    ...ticket,
    waitingBefore
  });
});

// Call the next patient (called from portal nurse panel)
app.post('/api/call', (req, res) => {
  const { desk } = req.body;
  const userEmail = getRequesterEmail(req);

  if (!desk) {
    return res.status(400).json({ error: 'Desk parameter is required' });
  }

  const ticket = Database.callNext(desk, userEmail);
  if (!ticket) {
    return res.status(404).json({ error: 'Sırada bekleyen hasta bulunamadı.' });
  }

  // 1. Broadcast call event
  io.emit('ticket-called', { ticket, desk });

  // 2. Target specific patient
  io.to(ticket.number).emit('your-turn', { ticket, desk });

  res.json(ticket);
});

// Recall the patient (called from portal nurse panel)
app.post('/api/recall', (req, res) => {
  const { number, desk } = req.body;
  const userEmail = getRequesterEmail(req);

  if (!number || !desk) {
    return res.status(400).json({ error: 'Number and Desk parameters are required' });
  }

  const ticket = Database.recall(number, desk, userEmail);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // 1. Broadcast call event
  io.emit('ticket-called', { ticket, desk });

  // 2. Target specific patient
  io.to(number).emit('your-turn', { ticket, desk });

  res.json(ticket);
});

// Mark patient processing as completed (called from portal nurse panel)
app.post('/api/complete', (req, res) => {
  const { number, duration, tubes, notes } = req.body || {};
  const userEmail = getRequesterEmail(req);

  if (!number) {
    return res.status(400).json({ error: 'Number parameter is required' });
  }

  const ticket = Database.complete(number, userEmail, { duration, tubes, notes });
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  io.emit('ticket-completed', ticket);
  res.json(ticket);
});

// Mark patient as No-Show / Pas Geç (called from portal nurse panel)
app.post('/api/noshow', (req, res) => {
  const { number } = req.body || {};
  const userEmail = getRequesterEmail(req);

  if (!number) {
    return res.status(400).json({ error: 'Number parameter is required' });
  }

  const ticket = Database.noShow(number, userEmail);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  io.emit('ticket-completed', ticket);
  res.json(ticket);
});

// Patient Satisfaction Feedback (called from track screen)
app.post('/api/feedback', (req, res) => {
  const { number, rating, comment } = req.body || {};
  if (!number || !rating) {
    return res.status(400).json({ error: 'Number and rating are required' });
  }

  const feedback = Database.submitFeedback(number, rating, comment);
  io.emit('feedback-submitted', feedback);
  res.json(feedback);
});

// Reset the entire queue (called from portal admin dashboard)
app.post('/api/reset', (req, res) => {
  const userEmail = getRequesterEmail(req);
  const db = Database.resetQueue(userEmail);
  
  io.emit('queue-reset');
  res.json({ message: 'Queue reset successfully', config: db.config });
});

// WebSocket Connection Management
io.on('connection', (socket) => {
  socket.on('track-ticket', (ticketNumber) => {
    if (ticketNumber) {
      const upperNumber = ticketNumber.toUpperCase();
      socket.join(upperNumber);
      console.log(`Socket ${socket.id} joined tracking room: ${upperNumber}`);
    }
  });

  socket.on('untrack-ticket', (ticketNumber) => {
    if (ticketNumber) {
      const upperNumber = ticketNumber.toUpperCase();
      socket.leave(upperNumber);
      console.log(`Socket ${socket.id} left tracking room: ${upperNumber}`);
    }
  });

  socket.on('disconnect', () => {
    // Disconnect cleanup
  });
});

// Serve frontend views
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// Redirect old admin route to unified portal
app.get('/admin', (req, res) => {
  res.redirect('/portal');
});

// Serve new portal view
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

app.get('/track', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

// Mobile Kiosk (Contactless Ticket Dispenser for Phones)
app.get(['/sira-al', '/mobile-kiosk'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile-kiosk.html'));
});

// Fallback to Kiosk page for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`  🏥 Kan Alma Portal ve Sıramatik Başlatıldı!`);
  console.log(`  🌐 Portal Giriş: http://localhost:${PORT}/portal`);
  console.log(`  🎫 Kiosk Ekranı: http://localhost:${PORT}/kiosk`);
  console.log(`  📺 TV Bekleme:   http://localhost:${PORT}/display`);
  console.log(`===================================================`);
});
