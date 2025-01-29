require('dotenv').config({ path: '../.env' });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const userRegisterRoute = require('./routes/userregister');
const userLoginRoute = require('./routes/userlogin');
const feedbackRoute = require('./routes/feedback');

const app = express();

// Load allowed domain and IP from .env
const ALLOWED_DOMAIN = process.env.DMN_NME;
const ALLOWED_IPS = process.env.PC_IP.split(','); // Split the comma-separated list of IPs

// Middleware to restrict access with logs
app.use((req, res, next) => {
    const origin = req.get('origin'); // For browser-based requests
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // Client IP
    
    // Handle both IPv4 and IPv6 formats
    if (ip.includes('::ffff:')) {
        ip = ip.split('::ffff:')[1]; // Extract the IPv4 address from the IPv6 format
    }

    // If the 'x-forwarded-for' contains multiple IPs, pick the first one that isn't local
    if (ip.includes(',')) {
        ip = ip.split(',')[0]; // Get the first IP in the list
    }

    // Logging the incoming request's details
    console.log(`Incoming request from IP: ${ip} with origin: ${origin}`);

    // Check if the request is from a valid IP
    if (ALLOWED_IPS.includes(ip)) {
        console.log(`Access granted for IP: ${ip}`);
        return next(); // IP matches, grant access
    } else {
        console.log(`Access denied for IP: ${ip}`);
    }

    // Check if the request's origin matches the allowed domain
    if (origin && origin.includes(ALLOWED_DOMAIN)) {
        console.log(`Access granted for origin: ${origin}`);
        return next(); // Domain matches, grant access
    } else {
        console.log(`Access denied for origin: ${origin}`);
    }

    // If neither IP nor domain match, deny access
    console.log(`Access denied for both origin: ${origin} and IP: ${ip}`);
    return res.status(403).json({ error: 'Access denied' });
});

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', userRegisterRoute);
app.use('/api', userLoginRoute);
app.use('/api', feedbackRoute);

// Health check route
app.get('/api/ping', (req, res) => {
    res.status(200).send({ message: 'Server is up and running!' });
    console.log('Health check successful');
});

const port = process.env.PORT || 5000; // Default to 5000 if no environment variable is set

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
