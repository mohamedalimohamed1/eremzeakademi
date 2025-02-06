const express = require('express');
const router = express.Router();
const db = require('../config/db');
const transporter = require('../config/transporter');
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;
const fs = require('fs');

// Admin Login - Step 1: Validate Email & Password
router.post('/adminlogin', async (req, res) => {
    const { email, password } = req.body;

    try {
        // First: Check credentials without email verification status
        const [admin] = await db.query(
            'SELECT * FROM EremzeAdmins WHERE admin_email = ? AND admin_password = ?',
            [email, password]
        );

        if (!admin.length) {
            return res.status(401).json({ 
                error: 'Geçersiz e-posta veya şifre' 
            });
        }

        // Second: Check email verification status
        if (admin[0].admin_email_verified !== 1) {
            return res.status(403).json({
                error: 'E-posta doğrulanmamış',
                requiresVerification: true,
                email: email
            });
        }

        // Proceed with verification code flow for verified users
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        await db.query('UPDATE EremzeAdmins SET admin_verif_code = ? WHERE admin_email = ?', 
            [verificationCode, email]);

        await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: email,
            subject: 'Yönetici Doğrulama Kodu',
            text: `Doğrulama kodunuz: ${verificationCode}`
        });

        res.json({ 
            message: 'Doğrulama kodu gönderildi',
            verified: true 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'İç Sunucu Hatası' });
    }
});

// Step 2: Verify Code & Authenticate
router.post('/verify-admin', async (req, res) => {
    const { email, verificationCode } = req.body;

    try {
        // Validate verification code
        const [admin] = await db.query('SELECT * FROM EremzeAdmins WHERE admin_email = ? AND admin_verif_code = ?', [email, verificationCode]);

        if (!admin.length) {
            return res.status(401).json({ error: 'Geçersiz doğrulama kodu' });
        }

        // Clear verification code from the database
        await db.query('UPDATE EremzeAdmins SET admin_verif_code = NULL WHERE admin_email = ?', [email]);

        // Create JWT token with a 1-hour expiration
        const token = jwt.sign(
            {
                id: admin[0].admin_id,
                email: admin[0].admin_email,
                name: admin[0].admin_name,
                surname: admin[0].admin_surname,
                profilepic: admin[0].admin_profile_pic,
                role: 'admin', // Add role as admin
            },
            secretKey,
            { expiresIn: '1h' }
        );

        // Store the admin session
        req.session.admin = {
            id: admin[0].admin_id,
            name: admin[0].admin_name,
            surname: admin[0].admin_surname,
            email: admin[0].admin_email,
            profilepic: admin[0].admin_profile_pic,
            role: 'admin', // Add role here as well
        };

        res.json({
            message: 'Yönetici başarıyla doğrulandı',
            token,
            adminInfo: { // Send admin info along with the token
                name: admin[0].admin_name,
                surname: admin[0].admin_surname,
                email: admin[0].admin_email,
                role: 'admin',
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'İç Sunucu Hatası' });
    }
});

// Get Admin List Endpoint
router.get('/get-admins', async (req, res) => {
    try {
      // Use async/await like other endpoints
      const [results] = await db.query(
        'SELECT admin_name, admin_surname, admin_email ' +
        'FROM EremzeAdmins ' +
        'WHERE admin_email_verified = 1'
      );
  
      // Ensure array response
      res.status(200).json(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error('GET /get-admins Error:', err);
      res.status(500).json([]);
    }
  });

// Remove Admin Endpoint
router.delete('/remove-admin', async (req, res) => {
    let connection;
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Yetkisiz erişim' });
      }
      
      const token = authHeader.split(' ')[1];
      const { emailToDelete } = req.body;
  
      // Verify token with expiration check
      const decoded = jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            throw new Error('Token expired');
          }
          throw new Error('Invalid token');
        }
        return decoded;
      });
  
      if (decoded.email === emailToDelete) {
        return res.status(403).json({ success: false, message: 'Kendinizi silemezsiniz!' });
      }
  
      connection = await db.getConnection();
      await connection.beginTransaction();
  
      // Check if admin exists
      const [existing] = await connection.query(
        'SELECT admin_id FROM EremzeAdmins WHERE admin_email = ?',
        [emailToDelete]
      );
  
      if (existing.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Admin bulunamadı' });
      }
  
      // Delete admin
      const [result] = await connection.query(
        'DELETE FROM EremzeAdmins WHERE admin_email = ?',
        [emailToDelete]
      );
  
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Admin bulunamadı' });
      }
  
      // Commit the transaction
      await connection.commit();
      res.json({ success: true, message: 'Admin başarıyla silindi' });
    } catch (error) {
        if (connection) await connection.rollback();
        
        console.error('Delete Error:', error);
        
        if (error.message === 'Token expired') {
          return res.status(401).json({ 
            success: false, 
            message: 'Oturum süresi doldu' 
          });
        }
        
        if (error.message === 'Invalid token') {
          return res.status(401).json({ 
            success: false, 
            message: 'Geçersiz oturum' 
          });
        }
    
        res.status(500).json({ 
          success: false, 
          message: 'Sunucu hatası' 
        });
      } finally {
        if (connection) connection.release();
      }
    });

    router.post('/pas-update', async (req, res) => {
        try {
            const { newPassword, confirmPassword } = req.body;
            const authHeader = req.headers.authorization;
    
            // Validate authorization header
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Geçersiz yetkilendirme başlığı.' });
            }
            const token = authHeader.split(' ')[1];
    
            // Validate password inputs
            if (!newPassword || !confirmPassword) {
                return res.status(400).json({ message: 'Lütfen tüm alanları doldurunuz.' });
            }
    
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: 'Girdiğiniz parolalar eşleşmiyor.' });
            }
    
            if (newPassword.length < 8) {
                return res.status(400).json({ message: 'Parola en az 9 karakter olmalıdır.' });
            }
    
            // Verify JWT token
            const decoded = jwt.verify(token, secretKey);
            const adminEmail = decoded.email;
    
            // Check if admin exists
            const [admin] = await db.query('SELECT admin_id FROM EremzeAdmins WHERE admin_email = ?', [adminEmail]);
            if (admin.length === 0) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }
    
            // Update password in database
            await db.query('UPDATE EremzeAdmins SET admin_password = ? WHERE admin_email = ?', 
                [newPassword, adminEmail]);
    
            res.status(200).json({ message: 'Parolanız başarıyla güncellendi!' });
    
        } catch (error) {
            // Handle token expiration
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' });
            }
            // Handle invalid token
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Geçersiz oturum bilgisi.' });
            }
            // Handle other errors
            console.error('Parola güncelleme hatası:', error);
            res.status(500).json({ message: 'Bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.' });
        }
    });

module.exports = router;
