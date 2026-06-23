const express = require("express");
const crypto = require("crypto");

const razorpay = require("../../config/razorpay");
const supabase = require("../../config/supabase");

const router = express.Router();

// ✅ Create Razorpay Order
router.post("/create-razorpay-order", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0 || !orderId) {
      return res.status(400).json({ error: "Invalid data" });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: orderId,
    });

    return res.json(order);
  } catch (err) {
    return res.status(403).json({
      error: "Razorpay failed",
      message: err?.error?.description || err.message,
    });
  }
});

// ✅ Verify Payment
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({ success: false });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    const razorpayOrder = await razorpay.orders.fetch(
      razorpay_order_id
    );

    const orderId = razorpayOrder.receipt;

    if (!orderId) {
      return res.status(400).json({ success: false });
    }

    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        razorpay_payment_id,
      })
      .eq("id", orderId);

    if (error) {
      return res.status(500).json({ success: false });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false });
  }
});

module.exports = router;