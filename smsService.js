const https = require('https');

async function sendSMS(toPhone, message) {
  if (!toPhone) return { success: false, reason: 'No phone number provided' };

  let phone = String(toPhone).replace(/[^0-9]/g, '');
  if (phone.startsWith('0') && phone.length === 11) phone = '9' + phone;
  if (phone.length === 10 && phone.startsWith('5')) phone = '90' + phone;

  console.log(`\n======================================================`);
  console.log(`📱 [SMS GÖNDERİLİYOR] -> +${phone}`);
  console.log(`💬 Mesaj: "${message}"`);
  console.log(`======================================================\n`);

  // 1. Netgsm Integration (Turkey Standard)
  if (process.env.NETGSM_USER && process.env.NETGSM_PASS && process.env.NETGSM_HEADER) {
    try {
      const netgsmUrl = `https://api.netgsm.com.tr/sms/send/get/?usercode=${encodeURIComponent(process.env.NETGSM_USER)}&password=${encodeURIComponent(process.env.NETGSM_PASS)}&gsmno=${phone}&message=${encodeURIComponent(message)}&msgheader=${encodeURIComponent(process.env.NETGSM_HEADER)}`;
      
      return new Promise((resolve) => {
        https.get(netgsmUrl, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log(`[NETGSM Response]:`, data);
            resolve({ success: true, provider: 'netgsm', response: data });
          });
        }).on('error', (err) => {
          console.error(`[NETGSM Error]:`, err.message);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (err) {
      console.error("Netgsm send error:", err);
    }
  }

  // 2. Twilio Integration (Global Standard)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const postData = new URLSearchParams({
        To: '+' + phone,
        From: process.env.TWILIO_PHONE_NUMBER,
        Body: message
      }).toString();

      const options = {
        hostname: 'api.twilio.com',
        port: 443,
        path: `/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      return new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log(`[Twilio Response]:`, data);
            resolve({ success: true, provider: 'twilio', response: data });
          });
        });
        req.on('error', (e) => {
          console.error(`[Twilio Error]:`, e.message);
          resolve({ success: false, error: e.message });
        });
        req.write(postData);
        req.end();
      });
    } catch (err) {
      console.error("Twilio send error:", err);
    }
  }

  // 3. Simulated/Logged Dispatch (Ready to connect with any SMS API)
  return { success: true, provider: 'simulator', phone: phone, message: message };
}

module.exports = { sendSMS };
