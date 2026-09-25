const express = require("express");

const supabase = require("../../config/supabase");

const {
  PAYPAL_BASE,
  getAccessToken,
} = require("../../utils/paypal");

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
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        error: "Order ID is required",
      });
    }

    /**
     * Get the order from our database.
     *
     * IMPORTANT:
     * The payment amount comes from our database,
     * NOT from the frontend.
     */
    const { data: dbOrder, error: orderError } = await supabase
      .from("orders")
      .select("id, total_amount, status")
      .eq("id", orderId)
      .single();

    if (orderError || !dbOrder) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    /**
     * Only pending orders can be paid.
     */
    if (dbOrder.status !== "pending") {
      return res.status(400).json({
        error: "Order is not available for payment",
      });
    }

    const amount = Number(dbOrder.total_amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({
        error: "Invalid order amount",
      });
    }

    /**
     * Get PayPal access token.
     */
    const accessToken = await getAccessToken();

    /**
     * Create PayPal order.
     *
     * The amount is taken from our database.
     * custom_id connects the PayPal order to our
     * internal website order.
     */
    const response = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              custom_id: String(orderId),

              amount: {
                currency_code: "USD",
                value: Number(amount).toFixed(2),
              },
            },
          ],
        }),
      }
    );

    const order = await response.json();

    if (!response.ok) {
      console.error("PayPal create order error:", order);

      return res.status(response.status).json(order);
    }

    res.json(order);
  } catch (err) {
    console.error("PAYPAL CREATE ORDER ERROR:");
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

    /**
     * Get the website order from Supabase.
     */
    const { data: dbOrder, error: orderError } = await supabase
      .from("orders")
      .select("id, total_amount, status")
      .eq("id", orderId)
      .single();

    if (orderError || !dbOrder) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    /**
     * Only pending orders can be captured.
     */
    if (dbOrder.status !== "pending") {
      return res.status(400).json({
        error: "Order is not available for payment",
      });
    }

    /**
     * Get PayPal access token.
     */
    const accessToken = await getAccessToken();

    /**
     * Capture the PayPal order.
     */
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
      console.error("PayPal capture error:", capture);

      return res.status(response.status).json(capture);
    }

    /**
     * Extract capture details.
     */
    const captureStatus =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.status;

    const paypalPaymentId =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    const capturedAmount =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;

    const capturedCurrency =
      capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount
        ?.currency_code;

    /**
     * Verify that PayPal actually completed the payment
     * and that the captured amount/currency match our order.
     */
    if (
      capture.status !== "COMPLETED" ||
      captureStatus !== "COMPLETED" ||
      capturedCurrency !== "USD" ||
      Number(capturedAmount) !== Number(dbOrder.total_amount)
    ) {
      console.error("PayPal payment not completed:", capture);

      return res.status(400).json({
        error: "PayPal payment was not completed.",
      });
    }

    /**
     * Mark the order as paid.
     *
     * IMPORTANT:
     * The update only succeeds if the order is still pending.
     *
     * This prevents duplicate processing if the frontend,
     * PayPal, or another request tries to process the same
     * payment more than once.
     */
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        paypal_payment_id: paypalPaymentId,
      })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      console.error("Failed to update order after PayPal capture:", error);

      return res.status(500).json({
        error: "Unable to update order.",
      });
    }

    /**
     * If no row was updated, the order was already processed.
     *
     * IMPORTANT:
     * Do NOT send emails in this case.
     */
    if (!updatedOrder || updatedOrder.length === 0) {
      console.log(
        `ℹ️ Order ${orderId} was already processed. No emails sent.`
      );

      return res.json(capture);
    }

    /**
     * The order was successfully changed from pending → paid.
     *
     * Send customer confirmation email.
     */
    try {
      await sendOrderConfirmationEmail(orderId);
    } catch (emailError) {
      console.error(
        "Customer order confirmation email failed:",
        emailError
      );
    }

    /**
     * Send admin new-order email.
     */
    try {
      await sendAdminNewOrderEmail(orderId);
    } catch (emailError) {
      console.error(
        "Admin new order email failed:",
        emailError
      );
    }

    /**
     * Return the successful PayPal capture response.
     */
    res.json(capture);
  } catch (err) {
    console.error("CAPTURE ERROR:");
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
});

/**
 * PayPal Webhook
 */
router.post("/paypal/webhook", async (req, res) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      console.error("PAYPAL_WEBHOOK_ID is missing");
      return res.sendStatus(500);
    }

    /**
     * PayPal webhook verification headers.
     */
    const transmissionId =
      req.headers["paypal-transmission-id"];

    const transmissionTime =
      req.headers["paypal-transmission-time"];

    const transmissionSig =
      req.headers["paypal-transmission-sig"];

    const certUrl =
      req.headers["paypal-cert-url"];

    const authAlgo =
      req.headers["paypal-auth-algo"];

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !certUrl ||
      !authAlgo
    ) {
      console.error("Missing PayPal webhook headers");
      return res.sendStatus(400);
    }

    /**
     * Get PayPal access token for webhook verification.
     */
    const accessToken = await getAccessToken();

    /**
     * Verify webhook with PayPal.
     */
    const verifyResponse = await fetch(
      `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: req.body,
        }),
      }
    );

    const verification = await verifyResponse.json();

    if (
      !verifyResponse.ok ||
      verification.verification_status !== "SUCCESS"
    ) {
      console.error(
        "PayPal webhook verification failed:",
        verification
      );

      return res.sendStatus(400);
    }

    const event = req.body;

    console.log(
      "✅ Verified PayPal webhook:",
      event.event_type
    );

    /**
     * PAYMENT.CAPTURE.COMPLETED
     *
     * This is the important event used to mark
     * our website order as paid.
     */
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const capture = event.resource;

      const paypalPaymentId = capture?.id;

      /**
       * PayPal provides the related Checkout Order ID here.
       */
      const paypalOrderId =
        capture?.supplementary_data?.related_ids?.order_id;

      if (!paypalOrderId) {
        console.error(
          "PayPal webhook missing related order ID:",
          event
        );

        /**
         * The webhook itself was valid, but we cannot
         * associate it with one of our website orders.
         *
         * Return 200 so PayPal does not repeatedly retry
         * an event that we cannot process.
         */
        return res.sendStatus(200);
      }

      /**
       * Get the PayPal order details.
       *
       * We use this to retrieve our website order ID
       * stored in custom_id.
       */
      const accessTokenForOrder = await getAccessToken();

      const paypalOrderResponse = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessTokenForOrder}`,
            "Content-Type": "application/json",
          },
        }
      );

      const paypalOrder = await paypalOrderResponse.json();

      if (!paypalOrderResponse.ok) {
        console.error(
          "Unable to retrieve PayPal order for webhook:",
          paypalOrder
        );

        return res.sendStatus(500);
      }

      const orderId =
        paypalOrder.purchase_units?.[0]?.custom_id;

      if (!orderId) {
        console.error(
          "PayPal order missing custom_id:",
          paypalOrder
        );

        return res.sendStatus(200);
      }

      /**
       * Get the corresponding website order.
       */
      const { data: existingOrder, error: findError } =
        await supabase
          .from("orders")
          .select("id, status, total_amount")
          .eq("id", orderId)
          .single();

      if (findError || !existingOrder) {
        console.error(
          "Order not found for PayPal webhook:",
          orderId
        );

        /**
         * The webhook is valid, but there is no matching
         * website order.
         */
        return res.sendStatus(200);
      }

      /**
       * Only update a pending order.
       *
       * This makes the webhook idempotent.
       *
       * If PayPal sends the same webhook more than once:
       *
       * First webhook:
       * pending → paid
       *
       * Second webhook:
       * paid → no update
       */
      const { data: updatedOrder, error: updateError } =
        await supabase
          .from("orders")
          .update({
            status: "paid",
            paypal_payment_id: paypalPaymentId,
          })
          .eq("id", orderId)
          .eq("status", "pending")
          .select("id");

      if (updateError) {
        console.error(
          "Failed to update order from PayPal webhook:",
          updateError
        );

        return res.sendStatus(500);
      }

      /**
       * IMPORTANT:
       *
       * If no row was updated, the order was already
       * processed.
       *
       * DO NOT send emails again.
       */
      if (!updatedOrder || updatedOrder.length === 0) {
        console.log(
          `ℹ️ Order ${orderId} was already processed. No emails sent.`
        );

        return res.sendStatus(200);
      }

      /**
       * The database update actually happened:
       *
       * pending → paid
       *
       * Only now send the customer email.
       */
      try {
        await sendOrderConfirmationEmail(orderId);
      } catch (emailError) {
        console.error(
          "Customer order confirmation email failed:",
          emailError
        );
      }

      /**
       * Only now send the admin email.
       */
      try {
        await sendAdminNewOrderEmail(orderId);
      } catch (emailError) {
        console.error(
          "Admin new order email failed:",
          emailError
        );
      }

      console.log(
        `✅ Order ${orderId} marked paid via PayPal webhook`
      );

      return res.sendStatus(200);
    }

    /**
     * PAYMENT.CAPTURE.PENDING
     */
    if (event.event_type === "PAYMENT.CAPTURE.PENDING") {
      console.log(
        "⏳ PayPal payment pending:",
        event.resource?.id
      );

      return res.sendStatus(200);
    }

    /**
     * PAYMENT.CAPTURE.DENIED
     */
    if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
      console.log(
        "❌ PayPal payment denied:",
        event.resource?.id
      );

      return res.sendStatus(200);
    }

    /**
     * CHECKOUT.PAYMENT-APPROVAL.REVERSED
     */
    if (
      event.event_type ===
      "CHECKOUT.PAYMENT-APPROVAL.REVERSED"
    ) {
      console.log(
        "⚠️ PayPal payment approval reversed:",
        event.resource?.order_id
      );

      return res.sendStatus(200);
    }

    /**
     * CHECKOUT.ORDER.APPROVED
     */
    if (
      event.event_type ===
      "CHECKOUT.ORDER.APPROVED"
    ) {
      console.log(
        "✅ PayPal order approved:",
        event.resource?.id
      );

      return res.sendStatus(200);
    }

    /**
     * Unknown / unused event
     */
    console.log(
      "ℹ️ Unhandled PayPal event:",
      event.event_type
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error(
      "PAYPAL WEBHOOK ERROR:",
      err
    );

    return res.sendStatus(500);
  }
});

module.exports = router;