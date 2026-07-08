const mjml2html = require("mjml");

async function renderEmail(mjml) {
  try {
    const result = await mjml2html(mjml, {
      validationLevel: "strict",
      minify: true,
      beautify: false,
    });

    return result.html;
  } catch (error) {
    console.error("\n========== MJML VALIDATION ==========");

    if (Array.isArray(error.errors)) {
      error.errors.forEach((err) => {
        console.error(err.formattedMessage || err.message);
      });
    } else {
      console.error(error);
    }

    console.error("=====================================\n");

    throw error;
  }
}

module.exports = renderEmail;