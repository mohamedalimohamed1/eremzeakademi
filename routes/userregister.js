const express = require('express');
const db = require('../config/db');
const transporter = require('../config/transporter');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

const nameRegex = /^[A-Za-zçğıöşüÇĞİÖŞÜ ]{2,15}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

router.post('/userregister', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  if (!nameRegex.test(firstName)) {
    return res.status(400).json({ message: 'Ad yalnızca harflerden oluşmalıdır ve 2-15 karakter arasında olmalıdır.' });
  }

  if (!nameRegex.test(lastName)) {
    return res.status(400).json({ message: 'Soyad yalnızca harflerden oluşmalıdır ve 2-15 karakter arasında olmalıdır.' });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'Şifre en az 8 karakter olmalı, büyük harf, küçük harf, sayı ve sembol içermelidir.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Şifreler eşleşmiyor.' });
  }

  try {
    // Checks if the email already exists in the permanent table
    const [rows] = await db.query('SELECT user_email FROM EremzeUsers WHERE user_email = ?', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ message: 'Bu e-mail adresi zaten kayıtlı.' });
    }

    // Checks if the email already exists in the temporary table
    const [tempRows] = await db.query('SELECT user_email FROM TempEremzeUsers WHERE user_email = ?', [email]);
    if (tempRows.length > 0) {
      return res.status(400).json({ message: 'Doğrulama linki e-posta adresinize gönderildi. Lütfen doğrulama için e-postayı kontrol edin, görmüyorsanız spam/junk klasörüne bakın.' });
    }

    // Save the plain password directly (no hashing)
    await db.query(
      'INSERT INTO TempEremzeUsers (user_name, user_surname, user_email, user_password) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, password]
    );

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send a verification email
    const verificationLink = `http://localhost:5000/api/verify-email?token=${token}`;

    const mailOptions = {
      from: 'eremze@eremzeakademi.com',
      to: email,
      subject: 'E Posta Doğrulama',
      html: `
        <p>Merhaba ${firstName},</p>
        <p>Lütfen aşağıdaki bağlantıya tıklayarak e-posta adresinizi doğrulayın:</p>
        <p><a href="${verificationLink}">E-posta adresinizi doğrulamak için buraya tıklayın</a></p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Doğrulama e-postası gönderilirken bir hata oluştu.' });
      }
      console.log('Verification email sent:', info.response);
    });

    res.status(201).json({ message: 'Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Bir hata oluştu. Lütfen tekrar deneyin.' });
  }
});

module.exports = router;

module.exports = router;


// After user clicks the verification link and email is verified
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  console.log("Token received for verification:", token); // Log token

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use the secret key from .env
    const email = decoded.email;

    console.log("Decoded token:", decoded); // Log the decoded token

    // Check if the email exists in the temporary table
    const [tempUser] = await db.query('SELECT * FROM TempEremzeUsers WHERE user_email = ?', [email]);
    if (tempUser.length === 0) {
      return res.status(400).json({ message: 'Kullanıcı bulunamadı.' });
    }

    // Move the user from the temporary table to the permanent table
    const user = tempUser[0];
    await db.query(
      'INSERT INTO EremzeUsers (user_name, user_surname, user_email, user_password) VALUES (?, ?, ?, ?)',
      [user.user_name, user.user_surname, user.user_email, user.user_password]
    );

    // Delete the user from the temporary table after moving to the permanent table
    await db.query('DELETE FROM TempEremzeUsers WHERE user_email = ?', [email]);

    // Update the user record to mark the email as verified
    await db.query('UPDATE EremzeUsers SET email_verified = 1 WHERE user_email = ?', [email]);

    // Send confirmation email after successful verification
    const confirmationMailOptions = {
      from: 'eremze@eremzeakademi.com',
      to: email,
      subject: 'E-posta Doğrulama Başarılı!',
      html: `
        <p>Merhaba ${user.user_name},</p>
        <p>E-postaınız başarıyla doğrulandı!</p>
      `,
    };

    transporter.sendMail(confirmationMailOptions, (err, info) => {
      if (err) {
        console.error("Error sending confirmation email:", err);
        return res.status(500).json({ message: 'Başarılı doğrulama sonrası e-posta gönderilemedi.' });
      }
      console.log('Confirmation email sent:', info.response);
    });

    res.status(200).json({ message: 'Email başarıyla doğrulandı!.' });

  } catch (error) {
    console.error("Token verification failed:", error); 
    res.status(400).json({ message: 'Geçersiz veya süresi dolmuş doğrulama bağlantısı.' });
  }
});


module.exports = router;
