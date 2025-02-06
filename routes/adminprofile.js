const express = require('express');
const bodyParser = require('body-parser');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const router = express.Router();
router.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET;
const UPLOADS_DIR = 'uploads/';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Upload and update profile picture
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Dosya yüklenmedi" });
        }
        
        res.status(200).json({ filePath: `/${UPLOADS_DIR}${req.file.filename}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Dosya yükleme başarısız" });
    }
});

router.post('/update-profile-pic', async (req, res) => {
    try {
        const { email, profilePic } = req.body;
        if (!email || !profilePic) {
            return res.status(400).json({ error: "Email ve profil resmi gereklidir" });
        }

        const [admins] = await db.query("SELECT * FROM EremzeAdmins WHERE admin_email = ?", [email]);
        const admin = admins[0];
        if (!admin || admin.admin_email_verified !== 1) {
            return res.status(403).json({ error: "Geçersiz veya doğrulanmamış e-posta" });
        }

        // Delete old profile picture (excluding default image)
        if (admin.admin_profile_pic && admin.admin_profile_pic !== '/uploads/adminprofile.jpeg') {
            const oldPath = `.${admin.admin_profile_pic}`;
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        await db.query("UPDATE EremzeAdmins SET admin_profile_pic = ? WHERE admin_email = ?", [profilePic, email]);
        res.status(200).json({ message: "Profil resmi güncellendi", profilePic });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Profil resmi güncellenemedi" });
    }
});

router.delete('/delete-uploaded-file', async (req, res) => {
    try {
        const { filePath } = req.query;
        if (!filePath) {
            return res.status(400).json({ error: "Dosya yolu belirtilmelidir" });
        }
        
        const fullPath = `.${filePath}`;
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        res.status(200).json({ message: "Dosya başarıyla silindi" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Dosya silinemedi" });
    }
});

module.exports = router;
