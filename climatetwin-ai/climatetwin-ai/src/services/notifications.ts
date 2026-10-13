/**
 * Browser notifications. Permission is only requested from an explicit button press.
 * Notifications are shown while this page is open; they are not push messages and do
 * not arrive when the browser or tab is closed. No SMS/WhatsApp delivery exists.
 */
export type NotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied';

export function notificationStatus(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (notificationStatus() === 'unsupported') return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return notificationStatus();
  }
}

/** Returns true if a notification was shown. `tag` lets the browser replace a duplicate. */
export function showBrowserNotification(title: string, body: string, tag: string): boolean {
  if (notificationStatus() !== 'granted') return false;
  try {
    new window.Notification(title, { body, tag, icon: '/favicon.svg' });
    return true;
  } catch {
    return false;
  }
}
