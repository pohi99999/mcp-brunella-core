import nodemailer from 'nodemailer';
import { logInfo, logWarn, logError } from './logger.js';

export interface CriticalEmailPayload {
  count: number;
  tasks: Array<{ id: string; todo_text: string; file_path: string; line_number: number }>;
}

export interface EmailSendResult {
  sent: boolean;
  message: string;
}

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
}

function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const to = process.env.SMTP_TO;

  if (!host || !port || !user || !pass || !from || !to) {
    return null;
  }

  return { host, port, user, pass, from, to };
}

export async function sendCriticalTasksEmail(payload: CriticalEmailPayload): Promise<EmailSendResult> {
  if (payload.count === 0) {
    return { sent: false, message: 'No critical tasks to notify' };
  }

  const config = getEmailConfig();
  if (!config) {
    logWarn('NotificationService', 'SMTP config missing, skipping email');
    return { sent: false, message: 'SMTP config missing' };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const topTasks = payload.tasks.slice(0, 5);
  const subject = `Brunella Alert: ${payload.count} kritikus TODO`;
  const textLines = topTasks.map(
    (task) => `• ${task.todo_text} (${task.file_path}:${task.line_number})`,
  );

  const htmlLines = topTasks.map(
    (task) => `<li><strong>${task.todo_text}</strong> <em>(${task.file_path}:${task.line_number})</em></li>`,
  );

  try {
    await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject,
      text: [
        `Kritikus TODO-k száma: ${payload.count}`,
        '',
        ...textLines,
      ].join('\n'),
      html: [
        `<p>Kritikus TODO-k száma: <strong>${payload.count}</strong></p>`,
        '<ul>',
        ...htmlLines,
        '</ul>',
      ].join(''),
    });

    logInfo('NotificationService', `Critical TODO email sent to ${config.to}`);
    return { sent: true, message: 'Email sent' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError('NotificationService', `Email send failed: ${message}`);
    return { sent: false, message };
  }
}
