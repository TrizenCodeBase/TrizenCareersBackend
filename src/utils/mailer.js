import nodemailer from 'nodemailer';
import { logger } from './logger.js';

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Trizen Careers" <no-reply@trizen.com>`,
        to,
        subject,
        text,
        html
      });

      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return info;
    } else {
      // Fallback: log the email for environments without SMTP configured
      logger.info('Simulated email send (SMTP not configured)', { to, subject, text });
      return { simulated: true };
    }
  } catch (err) {
    logger.error('Error sending email', err);
    throw err;
  }
};

export default sendEmail;
