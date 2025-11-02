import { notificationsAPI } from './api';

/**
 * Send a simple email notification.
 * Usage: await sendEmailNotification('user@example.com', 'Subject', 'Body text');
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  body: string,
  html?: string
): Promise<{ success: boolean; message: string }> {
  return notificationsAPI.sendEmail(to, subject, body, html);
}


