require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');

const userRegisterRoute = require('./routes/userregister');
const userLoginRoute = require('./routes/userlogin');
const feedbackRoute = require('./routes/feedback');
const adminregister = require('./routes/adminregister');
const emailVerification = require('./routes/emailverification');
const adminfdback = require('./routes/adminfedback');
const adminRoutes = require('./routes/adminRoutes');
const AdminProfile = require('./routes/adminprofile');

// Add this right after dotenv config
const environment = process.env.NODE_ENV || 'development';
console.log(`Running in ${environment} mode`);

const jwtScrt = process.env.JWT_SECRET;
const ALLOWED_DOMAIN = process.env.DMN_NME;
const ALLOWED_IPS = (process.env.PC_IP || "").split(',');

const app = express();

// 1. Configure Middleware
app.use(cors({
  origin: ALLOWED_DOMAIN,
  methods: 'GET,POST,PUT,DELETE',
  credentials: true
}));

app.use(morgan('dev')); // Log HTTP requests
app.use(express.json());
app.use(bodyParser.json());

// 2. Configure Sessions
app.use(session({
  secret: jwtScrt,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// 3. Enhanced IP & Domain Access Control Middleware
app.use((req, res, next) => {
    const origin = req.get('origin');
    let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Clean IP address formatting
    clientIP = clientIP.replace('::ffff:', '').split(',')[0].trim();
    const cleanOrigin = origin ? new URL(origin).hostname : 'no-origin';

    // IP-based access check
    const isAllowedIP = ALLOWED_IPS.some(ip => {
        return clientIP === ip || ip.includes(clientIP);
    });

    // Origin-based access check
    const isAllowedOrigin = origin ? 
        new URL(origin).hostname.includes(ALLOWED_DOMAIN) : 
        false;

    // Grant access if either condition is met
    if (isAllowedIP || isAllowedOrigin) {
        console.log(`Access granted - IP: ${clientIP}, Origin: ${cleanOrigin}`);
        return next();
    }

    // Detailed rejection logging
    console.warn(`Access denied - IP: ${clientIP}, Origin: ${cleanOrigin}`);
    console.log(`Allowed IPs: ${ALLOWED_IPS.join(', ')}`);
    console.log(`Allowed Domain: ${ALLOWED_DOMAIN}`);
    
    return res.status(403).json({ 
        error: 'Access denied',
        details: {
            yourIp: clientIP,
            allowedIps: ALLOWED_IPS,
            yourOrigin: cleanOrigin,
            allowedDomain: ALLOWED_DOMAIN
        }
    });
});

// 4. Register API Routes
app.use('/api', userRegisterRoute);
app.use('/api', userLoginRoute);
app.use('/api', feedbackRoute);
app.use('/api', adminregister);
app.use('/api', emailVerification);
app.use('/api', adminfdback);
app.use('/api', adminRoutes);
app.use('/api', AdminProfile);

// 5. Health Check Route
app.get('/api/ping', (req, res) => {
    res.status(200).send({ message: 'Server is up and running!' });
});

// 6. Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 7. Start the Server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
