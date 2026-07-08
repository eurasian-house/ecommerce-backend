const brand = require("../config/brand");
const theme = require("../config/theme");

function footer() {
  const { colors } = theme;

  return `
<mj-section
  background-color="${colors.background}"
  padding="32px"
>

  <mj-column>

    <mj-divider
      border-color="${colors.border}"
      border-width="1px"
      padding="0 0 24px"
    />

    <mj-text
      align="center"
      font-size="18px"
      font-weight="600"
      color="${colors.heading}"
      padding="0"
    >
      Need Help?
    </mj-text>

    <mj-text
      align="center"
      color="${colors.muted}"
      font-size="15px"
      padding="12px 0 0"
    >
      ${brand.support.email}
    </mj-text>

    <mj-text
      align="center"
      color="${colors.muted}"
      font-size="15px"
      padding="4px 0 0"
    >
      ${brand.support.website}
    </mj-text>

    <mj-text
      align="center"
      color="${colors.muted}"
      font-size="13px"
      padding="24px 0 0"
      line-height="22px"
    >
      © ${new Date().getFullYear()} ${brand.name}<br/>
      Bhadohi, Uttar Pradesh, India
    </mj-text>

  </mj-column>

</mj-section>
`;
}

module.exports = footer;