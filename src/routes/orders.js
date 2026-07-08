const express = require("express");
const supabase = require("../config/supabase");

const {
  sendOrderStatusEmail,
} = require("../services/orderEmailService");

const router = express.Router();

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    // Send email without blocking the response
    sendOrderStatusEmail(id, status).catch((err) => {
      console.error("Order status email failed:", err);
    });

    res.json({
      success: true,
      message: "Order status updated.",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update order.",
    });
  }
});

module.exports = router;