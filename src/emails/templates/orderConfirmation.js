const layout = require("../layout");
const title = require("../components/title");
const header = require("../components/header");
const footer = require("../components/footer");
const paragraph = require("../components/paragraph");
const button = require("../components/button");
const orderSummary = require("../components/orderSummary");
const productCard = require("../components/productCard");

function orderConfirmation({
  customerName,
  orderNumber,
  paymentMethod,
  orderDate,
  deliveryDate,
  items = [],
  orderUrl,
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
    title: "Order Confirmed",
    preheader: `Your order ${orderNumber} has been confirmed.`,

    content: `

    ${header()}

      <mj-section background-color="#FFFFFF" padding="32px 24px">
        <mj-column>

          ${title("Your order is confirmed 🎉")}

          ${paragraph(
      `Hello <strong>${customerName}</strong>,<br><br>
Thank you for choosing Eurasian House.<br><br>
Your order has been successfully placed. Our artisans will begin preparing your rug shortly.`
    )}

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

module.exports = orderConfirmation;