require("dotenv").config();

const merchantFeedRoute = require("./routes/merchantFeed");

const express = require("express");

const corsMiddleware = require("./middleware/cors");

const razorpayRoutes = require("./routes/payments/razorpay");
const paypalRoutes = require("./routes/payments/paypal");

const app = express();

app.use(express.json());

app.use(corsMiddleware);

app.use("/", merchantFeedRoute);

app.get("/", (req, res) => {
  res.send("Server OK");
});

app.use("/", razorpayRoutes);
app.use("/", paypalRoutes);

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});