const theme = require("../config/theme");

function title(
  text,
  {
    align = "left",
    color = theme.colors.heading,
  } = {}
) {
  const { fonts } = theme;

  return `
<mj-text
  align="${align}"
  font-family="${fonts.heading}"
  font-size="30px"
  font-weight="700"
  line-height="40px"
  color="${color}"
  padding="0 0 16px"
>
  ${text}
</mj-text>
`;
}

module.exports = title;