const layout = require("../components/layout");
const header = require("../components/header");
const footer = require("../components/footer");

function testTemplate() {
  return layout({
    title: "Email Design System",

    preheader: "Testing Eurasian House email layout.",

    content: `

      ${header()}

      <mj-section
        background-color="#FFFFFF"
        padding="40px"
        border-radius="10px"
      >

        <mj-column>

          <mj-text
            font-size="28px"
            font-weight="700"
          >
            Welcome 👋
          </mj-text>

          <mj-text>
            This is the first reusable email template for Eurasian House.
          </mj-text>

        </mj-column>

      </mj-section>

      ${footer()}

    `,
  });
}

module.exports = testTemplate;