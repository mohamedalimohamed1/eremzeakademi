const express = require('express');
const db = require('../config/db');
const transporter = require('../config/transporter');
const crypto = require('crypto'); // Use crypto for generating random numbers
require('dotenv').config();

const router = express.Router();

const nameRegex = /^[A-Za-zçğıöşüÇĞİÖŞÜ ]{2,15}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

router.post('/userregister', async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  // Validate input
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
    // Check if the email already exists in the permanent table
    const [rows] = await db.query('SELECT user_email FROM EremzeUsers WHERE user_email = ?', [email]);
    if (rows.length > 0) {
      return res.status(400).json({ message: 'Bu e-mail adresi zaten kayıtlı.' });
    }

    // Check if the email already exists in the temporary table
    const [tempRows] = await db.query('SELECT user_email FROM TempEremzeUsers WHERE user_email = ?', [email]);
    if (tempRows.length > 0) {
      return res.status(400).json({ message: 'Doğrulama kodu e-posta adresinize gönderildi. Lütfen doğrulama için e-postayı kontrol edin.' });
    }

    // Generate 4-digit verification code and expiration time
    const verificationCode = crypto.randomInt(1000, 9999).toString();
    const codeExpiration = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save the user in the temporary table
    await db.query(
      'INSERT INTO TempEremzeUsers (user_name, user_surname, user_email, user_password, user_verification_code, code_expiration) VALUES (?, ?, ?, ?, ?, ?)',
      [firstName, lastName, email, password, verificationCode, codeExpiration]
    );

    // Send verification email with the code
    const mailOptions = {
      from: 'eremze@eremzeakademi.com',
      to: email,
      subject: 'E-posta Doğrulama Kodu',
      html: `
        <p>Merhaba ${firstName},</p>
        <p>Doğrulama kodunuz: <strong>${verificationCode}</strong></p>
        <p>Bu kod 15 dakika geçerlidir.</p>
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

// New endpoint for code verification
router.post('/verify-email-code', async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    // Check if the email and code exist in the temporary table
    const [tempUser ] = await db.query(
      `SELECT * FROM TempEremzeUsers 
       WHERE user_email = ? 
       AND user_verification_code = ? 
       AND code_expiration > NOW()`,
      [email, verificationCode]
    );

    if (tempUser .length === 0) {
      return res.status(400).json({ message: 'Geçersiz kod veya süresi dolmuş' });
    }

    // Move the user from the temporary table to the permanent table
    const user = tempUser [0];
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
        <p>E-posta adresiniz başarıyla doğrulandı!</p>
      `,
    };

    transporter.sendMail(confirmationMailOptions, (err, info) => {
      if (err) {
        console.error("Error sending confirmation email:", err);
        return res.status(500).json({ message: 'Başarılı doğrulama sonrası e-posta gönderilemedi.' });
      }
      console.log('Confirmation email sent:', info.response);
    });

    res.status(200).json({ message: 'E-posta başarıyla doğrulandı!' });

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: 'Doğrulama işlemi başarısız oldu' });
  }
});

module.exports = router;