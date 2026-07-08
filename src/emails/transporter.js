const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function verifyTransporter() {
  try {
    await transporter.verify();

    console.log("📧 Email transporter connected successfully.");
    console.log(`SMTP Host : ${process.env.SMTP_HOST}`);
    console.log(`SMTP Port : ${process.env.SMTP_PORT}`);
    console.log(`SMTP User : ${process.env.SMTP_USER}`);
  } catch (error) {
    console.error("❌ Failed to connect to the SMTP server.");
    console.error(error);

    throw error;
  }
}

module.exports = {
  transporter,
  verifyTransporter,
};