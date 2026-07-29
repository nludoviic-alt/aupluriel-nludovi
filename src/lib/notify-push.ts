/**
 * Client-side notification service (Web Notification API + Telegram Webhook Relay)
 */

export function relayPush(title: string, body: string, url: string = "/") {
  // 1. Web Browser Native Notification
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
    } catch (e) {
      console.warn("Native Notification failed:", e);
    }
  }

  // 2. Console Audit Log
  console.log(`[Push Relay] ${title} - ${body}`);
}

export function requestNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
