const theme = require("../config/theme");

function card(content) {
  return `
<mj-section
  background-color="${theme.colors.surface}"
  padding="${theme.spacing.lg} ${theme.spacing.md}"
>

  <mj-column>

    ${content}

  </mj-column>

</mj-section>
`;
}

module.exports = card;