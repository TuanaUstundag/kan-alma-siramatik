const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// Default database structure including default admin and nurse
const defaultData = {
  users: [
    {
      email: "admin@hastane.com",
      password: "admin",
      name: "Bashekim / Sistem Yoneticisi",
      role: "admin"
    },
    {
      email: "ayse.hemsire@hastane.com",
      password: "123",
      name: "Hemsire Ayse",
      role: "nurse"
    }
  ],
  tickets: [],
  logs: [],
  feedbacks: [],
  config: {
    ticketPrefix: "K-",
    priorityPrefix: "Ö-",
    nextNumber: 101,
    nextPriorityNumber: 201
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(defaultData);
      return defaultData;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Auto-migrate if old database file is present without users or logs
    let migrated = false;
    if (!parsed.users) {
      parsed.users = defaultData.users;
      migrated = true;
    }
    if (!parsed.logs) {
      parsed.logs = [];
      migrated = true;
    }
    if (migrated) {
      writeDb(parsed);
    }
    
    return parsed;
  } catch (error) {
    console.error("Database read error, returning defaults:", error);
    return defaultData;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error("Database write error:", error);
  }
}

const Database = {
  // User Management
  authenticateUser(email, password) {
    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password);
    if (!user) return null;
    
    // Return user info without password
    const { password: _, ...userInfo } = user;
    return userInfo;
  },

  getUsers() {
    const db = readDb();
    // Return users without passwords
    return db.users.map(({ password, ...u }) => u);
  },

  addUser(name, email, password, role = "nurse") {
    const db = readDb();
    
    const exists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (exists) {
      return { error: "Bu e-posta adresi zaten kayıtlı." };
    }

    const newUser = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      role: role
    };

    db.users.push(newUser);
    writeDb(db);

    const { password: _, ...userInfo } = newUser;
    return { success: true, user: userInfo };
  },

  deleteUser(email) {
    const db = readDb();
    const cleanEmail = email.toLowerCase().trim();

    if (cleanEmail === "admin@hastane.com") {
      return { error: "Sistem yöneticisi silinemez." };
    }

    const index = db.users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    if (index === -1) {
      return { error: "Kullanıcı bulunamadı." };
    }

    db.users.splice(index, 1);
    writeDb(db);
    return { success: true };
  },

  // Log Management
  getLogs() {
    const db = readDb();
    // Return logs sorted by timestamp descending
    return db.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  addLog(userEmail, action, ticketNumber, desk, details = {}) {
    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === userEmail.toLowerCase().trim());
    
    // Attempt to lookup patientName from ticket
    const ticket = db.tickets.find(t => t.number === ticketNumber);
    const patientName = ticket ? ticket.patientName : null;

    const newLog = {
      timestamp: new Date().toISOString(),
      userEmail: userEmail,
      userName: user ? user.name : "Bilinmeyen Kullanıcı",
      action: action, // "CALL" | "COMPLETE" | "RECALL"
      ticketNumber: ticketNumber,
      patientName: patientName,
      desk: desk,
      duration: details.duration || (ticket ? ticket.duration : null),
      tubes: details.tubes || (ticket ? ticket.tubes : []),
      notes: details.notes || (ticket ? ticket.notes : [])
    };

    db.logs.push(newLog);
    writeDb(db);
  },

  // Ticket Operations (Now with nurse tracing)
  getTickets() {
    return readDb().tickets;
  },

  getTicket(number) {
    const db = readDb();
    return db.tickets.find(t => t.number === number) || null;
  },

  createTicket(type = "standard", patientName = "Misafir Hasta", phone = "") {
    const db = readDb();
    const isPriority = type === "priority";
    const prefix = isPriority ? (db.config.priorityPrefix || "Ö-") : (db.config.ticketPrefix || "K-");
    const num = isPriority ? (db.config.nextPriorityNumber || 201) : (db.config.nextNumber || 101);
    const ticketNumber = `${prefix}${num}`;

    // Clean phone number (e.g. 0532 123 45 67 -> 905321234567)
    let cleanPhone = (phone || "").replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = '9' + cleanPhone;
    } else if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
      cleanPhone = '90' + cleanPhone;
    }

    const newTicket = {
      number: ticketNumber,
      patientName: patientName ? patientName.trim() : (isPriority ? "Öncelikli Hasta" : "Misafir Hasta"),
      phone: cleanPhone || null,
      type: isPriority ? "priority" : "standard",
      status: "waiting",
      createdAt: new Date().toISOString(),
      calledAt: null,
      completedAt: null,
      desk: null,
      processedBy: null
    };

    db.tickets.push(newTicket);
    if (isPriority) {
      db.config.nextPriorityNumber = num + 1;
    } else {
      db.config.nextNumber = num + 1;
    }
    writeDb(db);

    return newTicket;
  },

  callNext(desk, userEmail) {
    const db = readDb();
    
    // 1. Check for waiting priority tickets first (FIFO among priority)
    let nextTicket = db.tickets.find(t => t.status === "waiting" && t.type === "priority");
    
    // 2. If no priority tickets are waiting, find the oldest standard waiting ticket
    if (!nextTicket) {
      nextTicket = db.tickets.find(t => t.status === "waiting");
    }
    
    if (!nextTicket) return null;

    // Set any currently "calling" ticket at this desk to "completed" first
    db.tickets.forEach(t => {
      if (t.status === "calling" && t.desk === desk) {
        t.status = "completed";
        t.completedAt = new Date().toISOString();
      }
    });

    nextTicket.status = "calling";
    nextTicket.desk = desk;
    nextTicket.calledAt = new Date().toISOString();
    nextTicket.processedBy = userEmail;

    writeDb(db);
    
    // Add transaction log
    this.addLog(userEmail, "CALL", nextTicket.number, desk);
    
    return nextTicket;
  },

  recall(number, desk, userEmail) {
    const db = readDb();
    const cleanNo = (number || '').toUpperCase();
    const ticket = db.tickets.find(t => t.number.toUpperCase() === cleanNo || (cleanNo.length > 2 && t.number.endsWith(cleanNo.slice(-3))));
    if (!ticket) return null;

    ticket.status = "calling";
    ticket.desk = desk;
    ticket.calledAt = new Date().toISOString();
    ticket.processedBy = userEmail;

    writeDb(db);
    
    // Add transaction log
    this.addLog(userEmail, "RECALL", number, desk);
    
    return ticket;
  },

  complete(number, userEmail, details = {}) {
    const db = readDb();
    const cleanNo = (number || '').toUpperCase();
    const ticket = db.tickets.find(t => t.number.toUpperCase() === cleanNo || (cleanNo.length > 2 && t.number.endsWith(cleanNo.slice(-3))));
    if (!ticket) return null;

    ticket.status = "completed";
    ticket.completedAt = new Date().toISOString();
    ticket.duration = details.duration || null;
    ticket.tubes = details.tubes || [];
    ticket.notes = details.notes || [];
    
    // Update processedBy if it was completed by a different user
    if (userEmail) {
      ticket.processedBy = userEmail;
    }

    writeDb(db);
    
    // Add transaction log
    this.addLog(userEmail || ticket.processedBy || "sistem@hastane.com", "COMPLETE", number, ticket.desk, details);
    
    return ticket;
  },

  noShow(number, userEmail) {
    const db = readDb();
    const cleanNo = (number || '').toUpperCase();
    const ticket = db.tickets.find(t => t.number.toUpperCase() === cleanNo || (cleanNo.length > 2 && t.number.endsWith(cleanNo.slice(-3))));
    if (!ticket) return null;

    ticket.status = "noshow";
    ticket.completedAt = new Date().toISOString();
    if (userEmail) {
      ticket.processedBy = userEmail;
    }

    writeDb(db);

    // Add transaction log
    this.addLog(userEmail || ticket.processedBy || "sistem@hastane.com", "NO_SHOW", number, ticket.desk);

    return ticket;
  },

  submitFeedback(number, rating, comment = "") {
    const db = readDb();
    if (!db.feedbacks) db.feedbacks = [];

    const numRating = Number(rating) || 5;
    const cleanNo = (number || '').toUpperCase();
    const ticket = db.tickets.find(t => t.number.toUpperCase() === cleanNo || (cleanNo.length > 2 && t.number.endsWith(cleanNo.slice(-3))));

    const feedbackItem = {
      ticketNumber: number,
      patientName: ticket ? (ticket.patientName || "Misafir Hasta") : "Misafir Hasta",
      desk: ticket ? (ticket.desk || "Kan Alma") : "Kan Alma",
      processedBy: ticket ? (ticket.processedBy || "-") : "-",
      rating: Math.min(5, Math.max(1, numRating)),
      comment: comment ? comment.trim() : "",
      createdAt: new Date().toISOString()
    };

    db.feedbacks.push(feedbackItem);

    // Also attach to the ticket if exists
    if (ticket) {
      ticket.rating = feedbackItem.rating;
      ticket.feedbackComment = feedbackItem.comment;
    }

    writeDb(db);
    return feedbackItem;
  },

  getFeedbacks() {
    const db = readDb();
    return (db.feedbacks || []).slice().reverse();
  },

  saveSubscription(number, subscription) {
    const db = readDb();
    if (!db.subscriptions) db.subscriptions = {};
    const cleanNo = (number || '').toUpperCase();
    db.subscriptions[cleanNo] = subscription;
    writeDb(db);
    return true;
  },

  getSubscription(number) {
    const db = readDb();
    if (!db.subscriptions) return null;
    const cleanNo = (number || '').toUpperCase();
    return db.subscriptions[cleanNo] || null;
  },

  removeSubscription(number) {
    const db = readDb();
    if (!db.subscriptions) return false;
    const cleanNo = (number || '').toUpperCase();
    delete db.subscriptions[cleanNo];
    writeDb(db);
    return true;
  },

  resetQueue(userEmail = "admin@hastane.com") {
    const db = readDb();
    
    db.tickets = [];
    db.logs = [];
    db.config.nextNumber = 101;
    db.config.nextPriorityNumber = 201;
    
    writeDb(db);
    
    // Add a log for queue resetting
    this.addLog(userEmail, "RESET_QUEUE", "HEPSİ", "TÜM ODALAR");
    
    return db;
  },

  // Extended Stats
  getStats() {
    const db = readDb();
    const tickets = db.tickets;
    const waiting = tickets.filter(t => t.status === "waiting");
    const calling = tickets.filter(t => t.status === "calling");
    const completed = tickets.filter(t => t.status === "completed");
    
    // Get the last 5 called tickets (calling or completed) sorted by calledAt descending
    const calledHistory = tickets
      .filter(t => t.calledAt !== null)
      .sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
      .slice(0, 5)
      .map(t => ({ 
        number: t.number, 
        patientName: t.patientName, 
        type: t.type || (t.number.startsWith('Ö-') ? 'priority' : 'standard'),
        desk: t.desk, 
        status: t.status 
      }));

    // Sort waiting tickets (priority first, then standard by createdAt)
    const waitingSorted = [...waiting].sort((a, b) => {
      const aIsPriority = a.type === 'priority' || a.number.startsWith('Ö-');
      const bIsPriority = b.type === 'priority' || b.number.startsWith('Ö-');
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Generate nurse statistics
    // Find all users who are nurses
    const nurseStats = db.users
      .filter(u => u.role === "nurse")
      .map(user => {
        // Find tickets processed by this nurse
        const processedTickets = tickets.filter(t => t.processedBy === user.email);
        
        return {
          name: user.name,
          email: user.email,
          totalProcessed: processedTickets.length,
          totalCompleted: processedTickets.filter(t => t.status === "completed").length,
          totalCalling: processedTickets.filter(t => t.status === "calling").length
        };
      });

    // Calculate hourly density distribution (08:00 to 17:00)
    const hourlyDistribution = [
      { hour: "08:00", count: 0 },
      { hour: "09:00", count: 0 },
      { hour: "10:00", count: 0 },
      { hour: "11:00", count: 0 },
      { hour: "12:00", count: 0 },
      { hour: "13:00", count: 0 },
      { hour: "14:00", count: 0 },
      { hour: "15:00", count: 0 },
      { hour: "16:00", count: 0 },
      { hour: "17:00", count: 0 }
    ];

    tickets.forEach(t => {
      if (t.createdAt) {
        const date = new Date(t.createdAt);
        const h = date.getHours();
        const label = String(h).padStart(2, '0') + ":00";
        const slot = hourlyDistribution.find(s => s.hour === label);
        if (slot) {
          slot.count++;
        }
      }
    });

    return {
      totalWaiting: waiting.length,
      totalCalling: calling.length,
      totalCompleted: completed.length,
      waitingList: waitingSorted.map(t => ({ 
        number: t.number, 
        patientName: t.patientName,
        type: t.type || (t.number.startsWith('Ö-') ? 'priority' : 'standard')
      })),
      callingList: calling.map(t => ({ 
        number: t.number, 
        patientName: t.patientName, 
        type: t.type || (t.number.startsWith('Ö-') ? 'priority' : 'standard'),
        desk: t.desk 
      })),
      calledHistory,
      nurseStats,
      hourlyDistribution,
      averageRating: db.feedbacks && db.feedbacks.length > 0 
        ? (db.feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0) / db.feedbacks.length).toFixed(1)
        : "5.0",
      totalFeedbacks: db.feedbacks ? db.feedbacks.length : 0
    };
  },

  getWaitingCountBefore(number) {
    const tickets = this.getTickets();
    const targetTicket = tickets.find(t => t.number === number);
    if (!targetTicket || targetTicket.status !== "waiting") return 0;

    const isTargetPriority = targetTicket.type === 'priority' || targetTicket.number.startsWith('Ö-');

    if (isTargetPriority) {
      // For priority tickets, only count priority tickets created before it
      return tickets.filter(t => 
        t.status === "waiting" && 
        (t.type === 'priority' || t.number.startsWith('Ö-')) &&
        new Date(t.createdAt) < new Date(targetTicket.createdAt)
      ).length;
    } else {
      // For standard tickets, count ALL waiting priority tickets + standard tickets created before it
      const waitingPriorityCount = tickets.filter(t => 
        t.status === "waiting" && 
        (t.type === 'priority' || t.number.startsWith('Ö-'))
      ).length;

      const olderStandardCount = tickets.filter(t => 
        t.status === "waiting" && 
        t.type !== 'priority' && 
        !t.number.startsWith('Ö-') &&
        new Date(t.createdAt) < new Date(targetTicket.createdAt)
      ).length;

      return waitingPriorityCount + olderStandardCount;
    }
  }
};

module.exports = Database;
