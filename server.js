require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const IPCIDR = require('ip-cidr');

// Import routes
const userRegisterRoute = require('./routes/userregister');
const userLoginRoute = require('./routes/userlogin');
const feedbackRoute = require('./routes/feedback');
const adminregister = require('./routes/adminregister');
const emailVerification = require('./routes/emailverification');
const adminfdback = require('./routes/adminfedback');
const adminRoutes = require('./routes/adminRoutes');
const AdminProfile = require('./routes/adminprofile');

// Environment configuration
const environment = process.env.NODE_ENV || 'development';
console.log(`Running in ${environment} mode`);

// Validate environment variables
const jwtScrt = process.env.JWT_SECRET;
if (!jwtScrt) throw new Error("JWT_SECRET environment variable is missing");

const ALLOWED_DOMAIN = process.env.DMN_NME
  ?.replace(/^(https?:\/\/)?/i, '') // Remove protocol
  .split('/')[0] // Remove paths
  .trim() || '';

const ALLOWED_IPS = (process.env.PC_IP || "")
  .split(',')
  .map(ip => ip.trim())
  .filter(ip => ip);

if (!ALLOWED_DOMAIN) throw new Error("DMN_NME environment variable is missing");

const app = express();

// ================= MIDDLEWARE CONFIGURATION =================
// 1. CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow non-browser requests
    
    try {
      const originHost = new URL(origin).hostname;
      const isAllowed = originHost === ALLOWED_DOMAIN || 
                       originHost.endsWith(`.${ALLOWED_DOMAIN}`);
      callback(null, isAllowed);
    } catch (err) {
      callback(new Error('Invalid origin'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// 2. Logging Middleware
app.use(morgan('dev'));

// 3. Body Parsers
app.use(express.json());
app.use(bodyParser.json());

// 4. Session Configuration
app.use(session({
  secret: jwtScrt,
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// 5. Security Middleware (Single Instance)
app.use((req, res, next) => {
  const origin = req.get('origin');
  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  clientIP = clientIP.replace('::ffff:', '').split(',')[0].trim();

  // Origin Validation
  let isAllowedOrigin = false;
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      isAllowedOrigin = originHost === ALLOWED_DOMAIN || 
                       originHost.endsWith(`.${ALLOWED_DOMAIN}`);
    } catch (e) {
      isAllowedOrigin = false;
    }
  }

  // IP Validation (Supports CIDR and exact matches)
  const isAllowedIP = ALLOWED_IPS.some(ip => {
    try {
      const cidr = new IPCIDR(ip);
      return cidr.isValid() ? cidr.contains(clientIP) : ip === clientIP;
    } catch {
      return ip === clientIP;
    }
  });

  if (isAllowedIP || isAllowedOrigin) {
    console.log(`Access granted - IP: ${clientIP}, Origin: ${origin || 'no-origin'}`);
    return next();
  }

  console.warn(`Access denied - IP: ${clientIP}, Origin: ${origin || 'no-origin'}`);
  return res.status(403).json({ 
    error: 'Access denied',
    details: {
      yourIp: clientIP,
      allowedIps: ALLOWED_IPS,
      yourOrigin: origin,
      allowedDomain: ALLOWED_DOMAIN
    }
  });
});

// ================= ROUTE CONFIGURATION =================
app.use('/api', userRegisterRoute);
app.use('/api', userLoginRoute);
app.use('/api', feedbackRoute);
app.use('/api', adminregister);
app.use('/api', emailVerification);
app.use('/api', adminfdback);
app.use('/api', adminRoutes);
app.use('/api', AdminProfile);

// Health Check Endpoint
app.get('/api/ping', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? {
      message: err.message,
      stack: err.stack
    } : 'Internal Server Error'
  });
});

// Server Initialization
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server operational on port ${port}`);
  console.log(`Allowed Domain: ${ALLOWED_DOMAIN}`);
  console.log(`Allowed IPs: ${ALLOWED_IPS.join(', ') || 'None'}`);
});