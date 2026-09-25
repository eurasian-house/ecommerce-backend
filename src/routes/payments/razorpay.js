const {
  sendOrderConfirmationEmail,
  sendAdminNewOrderEmail,
} = require("../../services/orderEmailService");

const express = require("express");
const crypto = require("crypto");

const razorpay = require("../../config/razorpay");
const supabase = require("../../config/supabase");

// const {
//   sendOrderConfirmationEmail,
// } = require("../../services/orderEmailService");

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
      currency: "USD",
      receipt: orderId,
      payment_capture: 1,
    });

    return res.json(order);
  } catch (err) {
    console.error("Razorpay Error:", err);

    if (err.error) {
      console.error("Razorpay Response:", err.error);
    }

    return res.status(500).json({
      success: false,
      error: err.error || err.message,
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

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        error: "Payment has not been captured yet.",
      });
    }

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

    // Email delivery can take several seconds. It should not delay the verified
    // payment response or the customer's redirect to the success page.
    void Promise.allSettled([
      sendOrderConfirmationEmail(orderId),
      sendAdminNewOrderEmail(orderId),
    ]).then(([customerEmail, adminEmail]) => {
      if (customerEmail.status === "rejected") {
        console.error(
          "Customer order confirmation email failed:",
          customerEmail.reason
        );
      }

      if (adminEmail.status === "rejected") {
        console.error("Admin new order email failed:", adminEmail.reason);
      }
    });

    return res.json({ success: true });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
    });
  }
});

module.exports = router;
