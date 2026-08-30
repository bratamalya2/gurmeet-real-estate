import nodemailer from 'nodemailer';

const configured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_USER
  && process.env.SMTP_PASS
  && (process.env.LEAD_NOTIFICATION_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL),
);

export async function sendLeadNotification(lead) {
  if (!configured()) return { sent: false, reason: 'SMTP is not configured' };

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const recipient = process.env.LEAD_NOTIFICATION_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const submittedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const details = [
    `New ${lead.type} lead`,
    '',
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    lead.message ? `Message: ${lead.message}` : null,
    lead.preferredDate ? `Preferred date: ${lead.preferredDate}` : null,
    lead.propertyAddress ? `Property address: ${lead.propertyAddress}` : null,
    lead.squareFootage ? `Square footage: ${lead.squareFootage}` : null,
    lead.condition ? `Condition: ${lead.condition}` : null,
    '',
    `Submitted: ${submittedAt}`,
  ].filter(Boolean).join('\n');

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    replyTo: lead.email,
    subject: `New website ${lead.type} lead`,
    text: details,
  });
  return { sent: true };
}
