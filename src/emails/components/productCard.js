const theme = require("../config/theme");

function productCard({
  image,
  name,
  color,
  size,
  quantity,
  price,
}) {
  const { colors, fonts } = theme;

  return `
<mj-section
  background-color="${colors.surface}"
  padding="20px 24px"
>

  <mj-column width="90px">

    <mj-image
      src="${image}"
      width="80px"
      padding="0"
      border-radius="${theme.radius.sm}"
    />

  </mj-column>

  <mj-column>

    <mj-text
      font-family="${fonts.heading}"
      font-size="18px"
      font-weight="700"
      color="${colors.heading}"
      padding="0 0 8px"
    >
      ${name}
    </mj-text>

    <mj-text
      color="${colors.muted}"
      font-size="14px"
      line-height="22px"
      padding="2px 0"
    >
      <strong>Color:</strong> ${color}
    </mj-text>

    <mj-text
      color="${colors.muted}"
      font-size="14px"
      line-height="22px"
      padding="2px 0"
    >
      <strong>Size:</strong> ${size}
    </mj-text>

    <mj-text
      color="${colors.muted}"
      font-size="14px"
      line-height="22px"
      padding="2px 0"
    >
      <strong>Quantity:</strong> ${quantity}
    </mj-text>

    <mj-text
      font-size="18px"
      font-weight="700"
      color="${colors.heading}"
      padding="12px 0 0"
    >
      $${Number(price).toFixed(2)}
    </mj-text>

  </mj-column>

</mj-section>

<mj-section padding="0">
  <mj-column>
    <mj-divider
      border-color="${colors.border}"
      border-width="1px"
    />
  </mj-column>
</mj-section>
`;
}

module.exports = productCard;