const layout = require("../layout");
const title = require("../components/title");
const header = require("../components/header");
const footer = require("../components/footer");
const paragraph = require("../components/paragraph");
const button = require("../components/button");
const orderSummary = require("../components/orderSummary");
const productCard = require("../components/productCard");

const STATUS_CONTENT = {
  processed: {
    title: "Order Processed",
    heading: "Your order is being processed 📦",
    message:
      "We've received your order and our team is reviewing every detail before production begins.",
  },

  manufacturing: {
    title: "Manufacturing Started",
    heading: "Your rug is now being handcrafted 🧶",
    message:
      "Our skilled artisans have started crafting your rug. Every piece is handmade with great care.",
  },

  manufactured: {
    title: "Manufacturing Complete",
    heading: "Your rug is ready for dispatch ✅",
    message:
      "Your rug has completed production and is now being prepared for shipment.",
  },

  shipped: {
    title: "Order Shipped",
    heading: "Your order is on its way 🚚",
    message:
      "Great news! Your order has been shipped and is now travelling to your delivery address.",
  },

  delivered: {
    title: "Order Delivered",
    heading: "Your order has been delivered 🎉",
    message:
      "We hope you love your handmade rug. Thank you for choosing Eurasian House.",
  },
};

function orderStatus({
  customerName,
  orderNumber,
  paymentMethod,
  orderDate,
  deliveryDate,
  status,
  items = [],
  orderUrl,
}) {
  const email = STATUS_CONTENT[status];

  if (!email) {
    throw new Error(`Unsupported order status: ${status}`);
  }

  const products = items
    .map((item) =>
      productCard({
        image: item.image,
        name: item.name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
      })
    )
    .join("");

  return layout({
    title: email.title,
    preheader: `${orderNumber} has been updated to ${status}.`,

    content: `
      ${header()}

      <mj-section background-color="#FFFFFF" padding="32px 24px">
        <mj-column>

          ${title(email.heading)}

          ${paragraph(`
            Hello <strong>${customerName}</strong>,<br><br>
            ${email.message}
          `)}

        </mj-column>
      </mj-section>

      ${orderSummary({
        orderNumber,
        paymentMethod,
        orderDate,
        deliveryDate,
        status,
      })}

      ${products}

      <mj-section background-color="#FFFFFF" padding="0 24px 32px">
        <mj-column>

          ${button({
            text: "View My Order",
            href: orderUrl,
            align: "center",
          })}

        </mj-column>
      </mj-section>

      ${footer()}
    `,
  });
}

module.exports = orderStatus;