// const { transporter } = require("./transporter");
// const renderEmail = require("./renderer");

// async function sendEmail({
//   to,
//   subject,
//   html,
//   text = "",
//   replyTo = process.env.SMTP_USER,
// }) {
//   if (!to) {
//     throw new Error("sendEmail: 'to' is required.");
//   }

//   if (!subject) {
//     throw new Error("sendEmail: 'subject' is required.");
//   }

//   if (!html) {
//     throw new Error("sendEmail: 'html' is required.");
//   }

//   try {
//     const renderedHtml = await renderEmail(html);

//     const info = await transporter.sendMail({
//       from: process.env.EMAIL_FROM,
//       to: Array.isArray(to) ? to.join(", ") : to,
//       replyTo,
//       subject,
//       html: renderedHtml,
//       text,
//     });

//     console.log(`📧 Email sent successfully: ${info.messageId}`);

//     return {
//       success: true,
//       messageId: info.messageId,
//     };
//   } catch (error) {
//     console.error("❌ Failed to send email:");
//     console.error(error);

//     return {
//       success: false,
//       error,
//     };
//   }
// }

// module.exports = sendEmail;


const { transporter } = require("./transporter");
const renderEmail = require("./renderer");

async function sendEmail({
  to,
  subject,
  html,
  text = "",
  replyTo = process.env.SMTP_USER,
}) {
  if (!to) {
    throw new Error("sendEmail: 'to' is required.");
  }

  if (!subject) {
    throw new Error("sendEmail: 'subject' is required.");
  }

  if (!html) {
    throw new Error("sendEmail: 'html' is required.");
  }

  try {
    const renderedHtml = await renderEmail(html);

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: Array.isArray(to) ? to.join(", ") : to,
      replyTo,
      subject,
      html: renderedHtml,
      text,
    });

    console.log(`📧 Email sent successfully: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ Failed to send email:");
    console.error(error);

    // Re-throw so the calling function can identify
    // exactly why the email failed.
    throw error;
  }
}

module.exports = sendEmail;