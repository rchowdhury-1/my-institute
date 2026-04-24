require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./src/db');

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/auth', require('./src/routes/auth'));
app.use('/students', require('./src/routes/students'));
app.use('/teachers', require('./src/routes/teachers'));
app.use('/admin', require('./src/routes/admin'));
app.use('/sessions', require('./src/routes/sessions'));
app.use('/homework', require('./src/routes/homework'));
app.use('/messages', require('./src/routes/messages'));
app.use('/notifications', require('./src/routes/notifications'));
app.use('/exams', require('./src/routes/exams'));
app.use('/payments', require('./src/routes/payments'));
app.use('/scholarships', require('./src/routes/scholarships'));
app.use('/courses', require('./src/routes/courses'));
app.use('/cms', require('./src/routes/cms'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
