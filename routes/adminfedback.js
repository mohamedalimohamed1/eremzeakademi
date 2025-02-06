const express = require('express');
const router = express.Router();

require('dotenv').config();
const db = require('../config/db');

router.get('/userfeedbackcheck', async (req, res) => {
    try {
      const [feedback] = await db.query('SELECT * FROM EremzeUserFeedback ORDER BY CASE WHEN message_status = 2 THEN 0 WHEN message_status = 1 THEN 1 WHEN message_status = 0 THEN 2 ELSE 3 END;');
      res.status(200).json(feedback);
    } catch (err) {
      console.error('Error fetching feedback:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

// PUT /approvefeedback/:id
router.put('/approvefeedback/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      await db.query('UPDATE EremzeUserFeedback SET message_status = 1 WHERE id = ?', [id]);
      res.status(200).json({ message: 'Feedback approved successfully' });
    } catch (err) {
      console.error('Error approving feedback:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // PUT /rejectfeedback/:id
router.put('/rejectfeedback/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      await db.query('UPDATE EremzeUserFeedback SET message_status = 0 WHERE id = ?', [id]);
      res.status(200).json({ message: 'Feedback rejected successfully' });
    } catch (err) {
      console.error('Error rejecting feedback:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  router.get('/userlist', async (req, res) => {
    try {
      const [users] = await db.query('SELECT * FROM EremzeUsers');
      res.status(200).json(users);
    } catch (err) {
      console.error('Error fetching user list:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  module.exports = router;