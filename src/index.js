require("dotenv").config();

const sitemapRoute = require("./routes/sitemap");

const express = require("express");

const corsMiddleware = require("./middleware/cors");

// const { verifyTransporter } = require("./emails/transporter");

const testEmailRoute = require("./emails/templates/testEmail");

const merchantFeedRoute = require("./routes/merchantFeed");

const razorpayRoutes = require("./routes/payments/razorpay");
const paypalRoutes = require("./routes/payments/paypal");
const ordersRoute = require("./routes/orders");

const app = express();

app.use(express.json());
app.use(corsMiddleware);

// Routes
app.use("/", merchantFeedRoute);
app.use("/", sitemapRoute);
app.use("/", razorpayRoutes);
app.use("/", paypalRoutes);
app.use("/api/orders", ordersRoute);
app.use("/", testEmailRoute);

app.get("/", (req, res) => {
  res.send("Server OK");
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://127.0.0.1:${PORT}`);

  // verifyTransporter().catch(console.error);
});