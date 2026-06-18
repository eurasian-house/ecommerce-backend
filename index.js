require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
  "https://www.eurasianrugs.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const allowedOrigin = process.env.FRONTEND_URL;

// ✅ Razorpay init
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID.trim(),
  key_secret: process.env.RAZORPAY_KEY_SECRET.trim(),
});

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Server OK");
});

// ✅ Create order
app.post("/create-razorpay-order", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: orderId, // ✅ LINK YOUR DB ORDER
    });

    return res.json(order);
  } catch (err) {
    return res.status(403).json({
      error: "Razorpay failed",
      message: err?.error?.description || err.message,
    });
  }
});

// ✅ VERIFY PAYMENT (SECURE)
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    console.log("REQ BODY:", req.body);

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      console.log("❌ Missing fields");
      return res.status(400).json({ success: false });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    console.log("EXPECTED:", expectedSignature);
    console.log("RECEIVED:", razorpay_signature);

    if (expectedSignature !== razorpay_signature) {
      console.log("❌ Signature mismatch");
      return res.status(400).json({ success: false });
    }

    console.log("✅ Signature verified");

    // 🔥 FETCH ORDER FROM RAZORPAY
    const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);

    console.log("RAZORPAY ORDER:", razorpayOrder);

    const orderId = razorpayOrder.receipt;

    if (!orderId) {
      console.log("❌ No receipt found");
      return res.status(400).json({ success: false });
    }

    const { createClient } = require("@supabase/supabase-js");

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        razorpay_payment_id,
      })
      .eq("id", orderId);

    if (error) {
      console.log("❌ DB ERROR:", error);
      return res.status(500).json({ success: false });
    }

    console.log("✅ ORDER MARKED PAID");

    return res.json({ success: true });

  } catch (err) {
    console.log("🔥 SERVER ERROR:", err);
    return res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});