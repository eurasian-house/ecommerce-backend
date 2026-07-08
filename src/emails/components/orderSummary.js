const theme = require("../config/theme");
const infoRow = require("./infoRow");

function orderSummary({
  orderNumber,
  paymentMethod,
  orderDate,
  deliveryDate,
  status,
}) {
  const { colors, fonts } = theme;

  return `
<mj-section
  background-color="${colors.surface}"
  padding="28px 24px"
>

  <mj-column>

    <mj-text
      font-family="${fonts.heading}"
      font-size="22px"
      font-weight="700"
      color="${colors.heading}"
      padding="0 0 18px"
    >
      Order Details
    </mj-text>

    ${infoRow({
      label: "Order",
      value: orderNumber,
    })}

    ${
      status
        ? infoRow({
            label: "Status",
            value:
              status.charAt(0).toUpperCase() +
              status.slice(1).replace("_", " "),
          })
        : ""
    }

    ${infoRow({
      label: "Payment",
      value: paymentMethod,
    })}

    ${infoRow({
      label: "Placed On",
      value: orderDate,
    })}

    ${infoRow({
      label: "Estimated Delivery",
      value: deliveryDate,
    })}

  </mj-column>

</mj-section>
`;
}

module.exports = orderSummary;