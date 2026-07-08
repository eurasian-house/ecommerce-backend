const theme = require("../config/theme");

function button({
  text,
  href,
  align = "left",
  backgroundColor = theme.colors.heading,
  color = "#FFFFFF",
}) {
  const { button: buttonTheme } = theme;

  return `
<mj-button
  href="${href}"
  align="${align}"
  background-color="${backgroundColor}"
  color="${color}"
  font-size="15px"
  font-weight="600"
  border-radius="${buttonTheme.radius}"
  inner-padding="${buttonTheme.padding}"
>
  ${text}
</mj-button>
`;
}

module.exports = button;