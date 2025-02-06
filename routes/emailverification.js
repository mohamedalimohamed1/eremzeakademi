// POST /emailverification
const express = require('express');
const db = require('../config/db');
const router = express.Router();
require('dotenv').config();

router.post('/emailverification', async (req, res) => {
    const { email, verificationCode } = req.body;
  
    // Validate input
    if (!email || !verificationCode) {
      return res.status(400).json({ message: 'E-posta ve doğrulama kodu gerekli' });
    }
  
    try {
      // Check if the verification code matches
      const [admin] = await db.query(
        'SELECT * FROM EremzeAdmins WHERE admin_email = ? AND admin_verif_code = ?',
        [email, verificationCode]
      );
  
      if (admin.length === 0) {
        return res.status(400).json({ message: 'Geçersiz doğrulama kodu' });
      }
  
      // Mark the admin as verified (clear verification code)
      await db.query(
        'UPDATE EremzeAdmins SET admin_verif_code = NULL, admin_email_verified = 1 WHERE admin_email = ?',
        [email]
      );
  
      res.status(200).json({ message: 'E-posta başarıyla doğrulandı' });
    } catch (err) {
      console.error('E-posta doğrulaması sırasında hata:', err);
      res.status(500).json({ message: 'İç Sunucu Hatası' });
    }
  });
  
  module.exports = router;