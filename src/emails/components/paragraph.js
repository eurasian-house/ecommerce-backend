const theme = require("../config/theme");

function paragraph(
  text,
  {
    align = "left",
    color = theme.colors.muted,
  } = {}
) {
  return `
<mj-text
  align="${align}"
  font-family="${theme.fonts.body}"
  font-size="16px"
  line-height="28px"
  color="${color}"
  padding="0 0 20px"
>
  ${text}
</mj-text>
`;
}

module.exports = paragraph;