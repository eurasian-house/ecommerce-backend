const renderEmail = require("./renderer");

let mailboxResourceId = null;

async function getMailboxResourceId() {
  if (mailboxResourceId) {
    return mailboxResourceId;
  }

  const response = await fetch("https://api.mail.hostinger.com/api/v1/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.HOSTINGER_MAIL_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Hostinger API authentication failed (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();

  // Extract plain email from:
  // "Eurasian House <contact@eurasianrugs.com>"
  const emailMatch = process.env.EMAIL_FROM?.match(/<([^>]+)>/);

  const emailAddress = emailMatch
    ? emailMatch[1]
    : process.env.EMAIL_FROM;

  const mailbox = result?.data?.mailboxes?.find(
    (item) =>
      item.address?.toLowerCase() === emailAddress?.toLowerCase()
  );

  if (!mailbox) {
    throw new Error(
      `Hostinger mailbox not found for ${emailAddress}`
    );
  }

  mailboxResourceId = mailbox.resourceId;

  console.log(
    `📬 Hostinger mailbox found: ${mailbox.address} (${mailbox.resourceId})`
  );

  return mailboxResourceId;
}

async function sendEmail({
  to,
  subject,
  html,
  text = "",
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

    const mailboxId = await getMailboxResourceId();

    const response = await fetch(
      `https://api.mail.hostinger.com/api/v1/mailboxes/${mailboxId}/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HOSTINGER_MAIL_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: Array.isArray(to) ? to : [to],
          display_name: "Eurasian House",
          subject,
          html: renderedHtml,
          text,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Hostinger Mail API failed (${response.status}): ${errorText}`
      );
    }

    console.log("📧 Email sent successfully through Hostinger Mail API.");

    return {
      success: true,
    };
  } catch (error) {
    console.error("❌ Failed to send email:");
    console.error(error);

    throw error;
  }
}

module.exports = sendEmail;