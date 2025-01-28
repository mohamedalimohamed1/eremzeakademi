// require('dotenv').config({ path: '../.env' });

// const express = require('express');
// const bodyParser = require('body-parser');
// const cors = require('cors');

// const userRegisterRoute = require('./routes/userregister');
// const userLoginRoute = require('./routes/userlogin');
// const feedbackRoute = require('./routes/feedback');

// const app = express();
// const PORT = 5000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());

// // Routes
// app.use('/api', userRegisterRoute); // For user registration
// app.use('/api', userLoginRoute);    // For user login
// app.use('/api', feedbackRoute);          // For feedback routes

// // Ping route for health check
// app.get('/api/ping', (req, res) => {
//     res.status(200).send({ message: 'Server is up and running!' });
// });

// // Server start
// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });

require('dotenv').config({ path: './.env' });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const userRegisterRoute = require('./routes/userregister');
const userLoginRoute = require('./routes/userlogin');
const feedbackRoute = require('./routes/feedback');

const app = express();

// Use the environment's dynamic port provided by Render
const PORT = process.env.PORT || 5000;

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

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
