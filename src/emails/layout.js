const theme = require("./config/theme");

function layout({
  title,
  preheader = "",
  content,
}) {
  const { colors, fonts } = theme;

  return `
<mjml>

  <mj-head>

    <mj-title>${title}</mj-title>

    <mj-preview>${preheader}</mj-preview>

    <mj-attributes>

      <mj-all
        font-family="${fonts.body}"
      />

      <mj-body
        background-color="${colors.background}"
      />

      <mj-section
        padding="0"
      />

      <mj-column
        padding="0"
      />

      <mj-text
        color="${colors.text}"
        font-size="16px"
        line-height="28px"
        padding="0"
      />

      <mj-button
        background-color="${colors.heading}"
        color="#FFFFFF"
        border-radius="${theme.button.radius}"
        font-size="15px"
        font-weight="600"
        padding="${theme.button.padding}"
      />

    </mj-attributes>

  </mj-head>

  <mj-body background-color="${colors.background}">

    ${content}

  </mj-body>

</mjml>
`;
}

module.exports = layout;