const express = require("express");
const sendEmail = require("../sendEmail");
const orderConfirmation = require("./orderConfirmation");

const router = express.Router();

router.get("/test-email", async (req, res) => {
  try {
    const result = await sendEmail({
      to: process.env.TEST_EMAIL || "saquibnew12@gmail.com",

      subject: "Eurasian House Design System",

      html: orderConfirmation({
        customerName: "Saquib",

        orderNumber: "#EH1024",

        paymentMethod: "PayPal",

        orderDate: "8 July 2026",

        deliveryDate: "20 July 2026",

        orderUrl: "https://eurasianrugs.com/account/orders",

        items: [
          {
            image:
              "https://images.unsplash.com/photo-1600166898405-da9535204843?w=500",

            name: "Persian Silk Rug",

            color: "Ivory",

            size: "6 × 9 ft",

            quantity: 1,

            price: 899,
          },

          {
            image:
              "https://images.unsplash.com/photo-1616627455286-3c2c8a85b2e1?w=500",

            name: "Modern Wool Rug",

            color: "Grey",

            size: "5 × 7 ft",

            quantity: 2,

            price: 399,
          },
        ],
      }),
    });

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;