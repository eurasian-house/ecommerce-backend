const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
  "https://www.eurasianrugs.com",
];

module.exports = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: true,
});