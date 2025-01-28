// server/config/transporter.js
const nodemailer = require('nodemailer');

// Create a transporter using your SMTP credentials
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER, 
    pass: process.env.MAIL_PASS, 
  },
});

module.exports = transporter;

// // mailer.js
// const nodemailer = require('nodemailer');

// // Nodemailer transporter configuration
// const transporter = nodemailer.createTransport({
//   host: 'smtp.hostinger.com',
//   port: 465,
//   secure: true,
//   auth: {
//     user: 'eremze@eremzeakademi.com',
//     pass: 'eremze-E1221',
//   },
// });

// module.exports = transporter;  // Export the transporter
