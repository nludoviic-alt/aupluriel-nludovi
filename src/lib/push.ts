export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function isIosNonSafari(): boolean {
  return false;
}

export function isIosNonStandalone(): boolean {
  return false;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  return null;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  return true;
}
