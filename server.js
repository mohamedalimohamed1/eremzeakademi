require('dotenv').config({ path: './.env' });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const userRegisterRoute = require('./routes/userregister');
const userLoginRoute = require('./routes/userlogin');
const feedbackRoute = require('./routes/feedback');

const app = express();

const port = process.env.PORT || 10000; // Use Render's PORT or default to 10000 if not set

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', userRegisterRoute);
app.use('/api', userLoginRoute);
app.use('/api', feedbackRoute);

// Health check route
app.get('/api/ping', (req, res) => {
  res.status(200).send({ message: 'Server is up and running!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
