require('dotenv').config({ path: '../.env' });
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
  cookie: { secure: process.env.NODE_ENV === 'production' } // Secure in production
}));

// 3. IP & Domain Access Control Middleware
app.use((req, res, next) => {
    const origin = req.get('origin');
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];

    const ipList = ip.split(',').map(ip => ip.trim());
    const isAllowedIP = ipList.some(ip => ALLOWED_IPS.includes(ip));

    if (isAllowedIP || (origin && origin.includes(ALLOWED_DOMAIN))) {
        console.log(`Access granted. IP: ${ip}, Origin: ${origin}`);
        return next();
    }

    console.log(`Access denied. Origin: ${origin}, IPs: ${ipList}`);
    return res.status(403).json({ error: 'Access denied' });
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
