const express = require('express');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../../.env' });
const cron = require('node-cron'); // Import node-cron

const router = express.Router();

// POST request to login
router.post('/userlogin', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if email exists in TempEremzeUsers table
        const [tempRows] = await db.query(
            'SELECT * FROM TempEremzeUsers WHERE user_email = ?',
            [email]
        );

        if (tempRows.length > 0) {
            return res.status(400).json({
                message: 'E-posta adresiniz doğrulanmamış. Lütfen doğrulayın.',
            });
        }

        // Check if email exists in EremzeUsers table
        const [rows] = await db.query(
            'SELECT * FROM EremzeUsers WHERE user_email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: 'E-posta adresi veya parola hatalı.',
            });
        }

        const user = rows[0];

        // Compare entered password with the stored password
        if (password !== user.user_password) {
            return res.status(400).json({
                message: 'E-posta adresi veya parola hatalı.',
            });
        }

        // Insert or update user in EremzeActiveUsers table
        const [activeUserRows] = await db.query(
            'SELECT * FROM EremzeActiveUsers WHERE user_email = ?',
            [email]
        );

        if (activeUserRows.length > 0) {
            // If the user is already in the active users table, update the info
            await db.query(
                'UPDATE EremzeActiveUsers SET is_active = 1, last_login = CURRENT_TIMESTAMP WHERE user_email = ?',
                [email]
            );
        } else {
            // Otherwise, insert the new user into the active users table
            await db.query(
                'INSERT INTO EremzeActiveUsers (user_name, user_surname, user_email, last_login, is_active) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)',
                [user.user_name, user.user_surname, email]
            );
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                user_email: user.user_email,
                user_name: user.user_name,
                user_surname: user.user_surname,
                user_id: user.user_id,
            },
            process.env.JWT_LGN_SECRET,
            { expiresIn: '1h' } // Token will expire in 1 hour
        );

        // Send user info and token in response (for frontend to use)
        return res.status(200).json({
            message: 'Giriş başarılı.',
            token, // Send the JWT token for frontend to use
            user_name: user.user_name,
            user_email: user.user_email,
            user_id: user.user_id,
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        });
    }
});

// Active user fetch route
router.post('/activeuser', async (req, res) => {
    const { email } = req.body; // Email is passed in the request body

    try {
        const [rows] = await db.query(
            'SELECT * FROM EremzeActiveUsers WHERE user_email = ? AND is_active = 1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: 'Aktif kullanıcı bulunamadı.',
            });
        }

        const activeUser = rows[0];
        return res.status(200).json({
            user_name: activeUser.user_name,
            user_surname: activeUser.user_surname,
            user_email: activeUser.user_email,
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        });
    }
});

// Logout route
router.post('/logout', async (req, res) => {
    const { email } = req.body; // Get email from the request body

    try {
        // Update the is_active field to 0 for the user
        const [result] = await db.query(
            'UPDATE EremzeActiveUsers SET is_active = 0 WHERE user_email = ?',
            [email]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Kullanıcı bulunamadı veya zaten çıkış yapmış.',
            });
        }

        return res.status(200).json({
            message: 'Çıkış işlemi başarılı.',
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        });
    }
});

// // Add the cron job to update inactive users every minute
// cron.schedule('* * * * *', async () => {
//     try {
//         // Set is_active to 0 for users who haven't logged in for 10 minutes
//         await db.query(
//             'UPDATE EremzeActiveUsers SET is_active = 0 WHERE last_login < NOW() - INTERVAL 30 MINUTE'
//         );
//     } catch (error) {
//         console.error('Error updating inactive users:', error);
//     }
// });

module.exports = router;
