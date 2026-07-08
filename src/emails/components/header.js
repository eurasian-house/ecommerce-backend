const brand = require("../config/brand");
const theme = require("../config/theme");

function header() {
  const { colors, fonts } = theme;

  return `
<mj-section
  background-color="${colors.background}"
  padding="40px 32px 24px"
>

  <mj-column>

    <mj-text
      align="center"
      font-family="${fonts.heading}"
      font-size="30px"
      font-weight="700"
      color="${colors.heading}"
      letter-spacing="2px"
      padding="0"
    >
      ${brand.name.toUpperCase()}
    </mj-text>

    <mj-text
      align="center"
      font-size="14px"
      color="${colors.muted}"
      letter-spacing="1px"
      padding="8px 0 0"
    >
      ${brand.tagline}
    </mj-text>

    <mj-divider
      border-color="${colors.gold}"
      border-width="2px"
      width="120px"
      padding="24px 0 0"
    />

  </mj-column>

</mj-section>
`;
}

module.exports = header;