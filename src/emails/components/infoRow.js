const theme = require("../config/theme");

function infoRow({
  label,
  value,
}) {
  return `
<mj-text
  font-family="${theme.fonts.body}"
  font-size="15px"
  line-height="24px"
  color="${theme.colors.text}"
  padding="6px 0"
>
  <strong>${label}:</strong> ${value}
</mj-text>
`;
}

module.exports = infoRow;