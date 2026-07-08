const express = require("express");

const supabase = require("../../config/supabase");

const {
  PAYPAL_BASE,
  getAccessToken,
} = require("../../utils/paypal");

// const {
//   sendOrderConfirmationEmail,
// } = require("../../services/orderEmailService");

const {
  sendOrderConfirmationEmail,
  sendAdminNewOrderEmail,
} = require("../../services/orderEmailService");

const router = express.Router();

/**
 * Frontend fetches Client ID from here
 */
router.get("/paypal/config", (req, res) => {
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
  });
});

/**
 * Create PayPal Order
 */
router.post("/paypal/create-order", async (req, res) => {
  try {
    const { amount, currency = "USD" } = req.body;

    if (!amount) {
      return res.status(400).json({
        error: "Amount is required",
      });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: Number(amount).toFixed(2),
            },
          },
        ],
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error(order);
      return res.status(response.status).json(order);
    }

    res.json(order);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Unable to create PayPal order.",
    });
  }
});

/**
 * Capture PayPal Order
 */
router.post("/paypal/capture-order", async (req, res) => {
  try {
    const { orderID, orderId } = req.body;

    if (!orderID || !orderId) {
      return res.status(400).json({
        error: "Order ID is required",
      });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const capture = await response.json();

    if (!response.ok) {
      console.error(capture);
      return res.status(response.status).json(capture);
    }

    const paypalPaymentId =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paypal_payment_id: paypalPaymentId,
      })
      .eq("id", orderId);

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: "Unable to update order.",
      });
    }

    // ✅ Send confirmation email
    try {
      await sendOrderConfirmationEmail(orderId);
      await sendAdminNewOrderEmail(orderId);
    } catch (emailError) {
      console.error(
        "Order confirmation email failed:",
        emailError
      );
    }

    res.json(capture);

  } catch (err) {
    console.error("CAPTURE ERROR:");
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;