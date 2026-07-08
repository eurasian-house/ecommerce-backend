const layout = require("../layout");
const header = require("../components/header");
const footer = require("../components/footer");
const title = require("../components/title");
const paragraph = require("../components/paragraph");
const button = require("../components/button");
const orderSummary = require("../components/orderSummary");
const productCard = require("../components/productCard");

function adminNewOrder({
  customerName,
  customerEmail,
  phone,
  address,
  orderNumber,
  paymentMethod,
  orderDate,
  deliveryDate,
  items = [],
  adminUrl,
}) {
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
    title: "New Paid Order",
    preheader: `New order ${orderNumber} has been paid.`,

    content: `
      ${header()}

      <mj-section background-color="#FFFFFF" padding="32px 24px">
        <mj-column>

          ${title("A new paid order has been received 💰")}

          ${paragraph(`
            <strong>Customer:</strong> ${customerName}<br>
            <strong>Email:</strong> ${customerEmail}<br>
            <strong>Phone:</strong> ${phone || "-"}<br><br>

            <strong>Shipping Address</strong><br>
            ${address}
          `)}

        </mj-column>
      </mj-section>

      ${orderSummary({
        orderNumber,
        paymentMethod,
        orderDate,
        deliveryDate,
        status: "paid",
      })}

      ${products}

      <mj-section background-color="#FFFFFF" padding="0 24px 32px">
        <mj-column>

          ${button({
            text: "Open Admin Panel",
            href: adminUrl,
          })}

        </mj-column>
      </mj-section>

      ${footer()}
    `,
  });
}

module.exports = adminNewOrder;