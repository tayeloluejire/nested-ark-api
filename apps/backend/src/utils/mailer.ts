import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendRecoveryEmail(email: string, resetLink: string) {
  await transporter.sendMail({
    from: `"Nested Ark Recovery" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Operator Access Key",
    html: `
      <h2>Recovery Protocol</h2>
      <p>Click below to reset your operator key:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link is valid for 15 minutes.</p>
    `
  });
}