const express = require('express');
const bodyParser = require('body-parser');
const db = require('../config/db');
const transporter = require('../config/transporter.js');
const router = express.Router();
require('dotenv').config();

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Generate a random 4-digit verification code
function generateVerificationCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// POST /adminregister
router.post('/adminregister', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // Validate input
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: 'Tüm alanların doldurulması zorunludur' });
  }

  // Check if email already exists
  try {
    const [existingAdmin] = await db.query(
      'SELECT * FROM EremzeAdmins WHERE admin_email = ?',
      [email]
    );

    if (existingAdmin.length > 0) {
      return res.status(400).json({ message: 'E-posta zaten kayıtlı' });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();

    // Save admin data with verification code (not verified yet)
    await db.query(
      'INSERT INTO EremzeAdmins (admin_name, admin_surname, admin_email, admin_password, admin_verif_code) VALUES (?, ?, ?, ?, ?)',
      [firstName, lastName, email, password, verificationCode]
    );

    // Send verification email
    const mailOptions = {
      from: 'eremze@eremzeakademi.com',
      to: email,
      subject: 'E Posta Doğrulama',
      html: `
        <p>Merhaba ${firstName},</p>
        <p>Lütfen aşağıdaki Kod ile e-posta adresinizi doğrulayın:</p>
        <p><strong>${verificationCode}</strong></p>
        <p>Eğer bu mesaj size yanlışlıkla ulaştıysa lütfen dikkate almayın. Destek almak için bizimle iletişime geçebilirsiniz.</p>
        <p>Teşekkürler,<br><strong>Eremze Akademi</strong></p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ message: 'Doğrulama e-postası gönderilemedi' });
      }
      console.log('Verification email sent:', info.response);
      res.status(200).json({ message: 'Doğrulama e-postası gönderildi' });
    });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'İç Sunucu Hatası' });
  }
});

module.exports = router;