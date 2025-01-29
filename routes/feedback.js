const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const transporter = require('../config/transporter');
require('dotenv').config({ path: '../../.env' });

const router = express.Router();


// Route to display feedback
router.post('/displayfeedback', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT user_name AS person, 
                            CONCAT(SUBSTRING(user_surname, 1, 1), '****') AS surname, 
                            user_message AS content
            FROM (
                SELECT user_name, user_surname, user_message
                FROM EremzeUserFeedback
                WHERE message_status = 1
                ORDER BY created_at DESC
                LIMIT 50
            ) AS subquery
            LIMIT 10;
        `;

        const [rows] = await db.query(query);

        res.status(200).json({ messages: rows });
    } catch (error) {
        console.error('Error fetching feedback messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/userfeedback', async (req, res) => {
    const { user_name, user_surname, user_message, user_email } = req.body;

    // Validate input
    if (!user_name || !user_surname || !user_message || !user_email) {
        return res.status(400).json({
            info: 'Lütfen tüm alanları doldurduğunuzdan emin olun.',
        });
    }

    try {
        // Save feedback to the database
        await db.query(
            'INSERT INTO TempEremzeUserFeedback (user_name, user_surname, user_message) VALUES (?, ?, ?)',
            [user_name, user_surname, user_message]
        );

        // Email configuration
        const mailOptions = {
            from: 'eremze@eremzeakademi.com',
            to: user_email,
            subject: 'Geri Bildiriminiz Alındı',
            html: `
                <p>Merhaba ${user_name},</p>
                <p>Yorumunuz alındı. Görüşleriniz bizim için çok değerli ve bize daha iyi hizmet sunma yolunda ışık tutacaktır.</p>
                <p>Teşekkürler,</p>
                <p>Eremze Akademi</p>
            `,
        };

        // Send email to the user
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Error sending email:', err);
                return res.status(500).json({
                    title: 'Hata',
                    info: 'Görüşünüz kaydedildi ancak e-posta gönderilirken bir hata oluştu.',
                });
            }
            console.log('Email sent:', info.response);

            // Respond with success message
            return res.status(200).json({
                title: 'Başarılı',
                info: 'Görüşleriniz alındı. Teşekkür ederiz!',
            });
        });
    } catch (error) {
        console.error('Error during feedback submission:', error);

        // Handle database errors
        return res.status(500).json({
            title: 'Hata',
            info: 'Mesajınız işlenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
        });
    }
});


module.exports = router;
