const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

// MySQL database connection pool
const db = mysql.createPool({
  host: 'srv1862.hstgr.io',
  user: 'u587046233_eremze',
  password: 'eremze-123-Ere',
  database: 'u587046233_eremzeDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: 'eremze@eremzeakademi.com',
    pass: 'eremze-E1221',
  },
});

// Temporary storage for unverified users
const unverifiedUsers = new Map();

// Registration endpoint
app.post('/register', (req, res) => {
    const { firstName, lastName, email, password } = req.body;
  
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
  
    // Generate a random verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000);
  
    db.query('SELECT * FROM TempEremzeUsers WHERE user_email = ?', [email], (err, result) => {
      if (err) {
        console.error('Error checking email:', err);
        return res.status(500).json({ error: 'Database error' });
      }
  
      if (result.length > 0) {
        return res.status(400).json({ error: 'Email already registered for verification' });
      }
  
      // Insert into TempEremzeUsers
      const query = 'INSERT INTO TempEremzeUsers (user_name, user_surname, user_email, user_password, verification_code) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [firstName, lastName, email, password, verificationCode], (err) => {
        if (err) {
          console.error('Error inserting user:', err);
          return res.status(500).json({ error: 'Database error' });
        }
  
        // Send verification email
        const mailOptions = {
          from: 'eremze@eremzeakademi.com',
          to: email,
          subject: 'Email Verification',
          html: `
            <h1>Verify Your Email</h1>
            <p>Hi ${firstName},</p>
            <p>Thank you for registering. Use the code below to verify your email:</p>
            <h2>${verificationCode}</h2>
            <p>Or click <a href="http://localhost:3000/register?email=${email}&code=${verificationCode}">here</a> to verify.</p>
          `,
        };
  
        transporter.sendMail(mailOptions, (err) => {
          if (err) {
            console.error('Error sending email:', err);
            return res.status(500).json({ error: 'Failed to send verification email' });
          }
  
          return res.status(200).json({ message: 'Verification email sent.' });
        });
      });
    });
  });
  

// Verification endpoint
// Verification endpoint
app.get('/verify', (req, res) => {
    const { email, code } = req.query;
  
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
  
    db.query(
      'SELECT * FROM TempEremzeUsers WHERE user_email = ? AND verification_code = ?',
      [email, code],
      (err, results) => {
        if (err) {
          console.error('Error checking verification code:', err);
          return res.status(500).json({ error: 'Database error' });
        }
  
        if (results.length === 0) {
          return res.status(400).json({ error: 'Invalid verification code' });
        }
  
        const user = results[0];
  
        // Move user to the main table
        db.query(
          'INSERT INTO EremzeUsers (user_name, user_surname, user_email, user_password, is_verified) VALUES (?, ?, ?, ?, ?)',
          [user.user_name, user.user_surname, user.user_email, user.user_password, 1],
          (err) => {
            if (err) {
              console.error('Error moving user to main table:', err);
              return res.status(500).json({ error: 'Database error' });
            }
  
            // Delete from TempEremzeUsers
            db.query('DELETE FROM TempEremzeUsers WHERE user_email = ?', [email], (err) => {
              if (err) {
                console.error('Error deleting temporary user:', err);
                return res.status(500).json({ error: 'Database error' });
              }
  
              // Redirect to registration page with success message
              res.redirect('http://localhost:3000/register?status=success');
            });
          }
        );
      }
    );
  });
  
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.query('SELECT * FROM EremzeUsers WHERE user_email = ?', [email], (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = results[0];

    // Compare password directly without hashing (insecure in real apps)
    if (password !== user.user_password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    // Check if the user is an admin
    const isAdmin = user.role === 'admin'; // assuming there's a `role` column in your database

    // Generate a JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.user_email, 
        name: user.user_name, 
        surname: user.user_surname, 
        isAdmin: isAdmin 
      },
      'your_jwt_secret_key', // Use a secure secret
      { expiresIn: '1h' } // Token expiration
    );

    // Return the token, user info, and isAdmin flag
    res.status(200).json({
      message: 'Login successful',
      token: token,  // Send token back to client
      user: { 
        id: user.id, 
        email: user.user_email,
        name: user.user_name, 
        surname: user.user_surname,
        isAdmin: isAdmin // Include the admin status
      },
    });
  });
});


// Feedback endpoint (after checking if the user is logged in)
app.post('/submit-feedback', (req, res) => {
    const { message, name, surname } = req.body;
    const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the header

    if (!token) {
        return res.status(401).json({ error: 'You must be logged in to submit feedback.' });
    }

    // Verify the token
    jwt.verify(token, 'your_jwt_secret_key', (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // User is authenticated, proceed with storing the feedback
        // Insert the feedback into the database
        db.query(
            'INSERT INTO EremzeUserFeedback (user_name, user_surname, user_message) VALUES (?, ?, ?)',
            [name, surname, message],
            (err) => {
                if (err) {
                    console.error('Error inserting feedback:', err);
                    return res.status(500).json({ error: 'Failed to submit feedback' });
                }
                // Send a thank you message along with the response
                return res.status(200).json({
                    message: 'Feedback submitted successfully',
                    thankYouMessage: 'Thank you for your feedback! We appreciate your input and will review it shortly.'
                });
            }
        );
    });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
