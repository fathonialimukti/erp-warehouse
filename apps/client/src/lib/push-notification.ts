const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Request OS/browser notification permission.
 * Call once on app start (mounted in PrivateLayout).
 */
export const requestPushPermission = async (): Promise<boolean> => {
  if (isTauri()) {
    try {
      const { isPermissionGranted, requestPermission } =
        await import("@tauri-apps/plugin-notification");
      if (await isPermissionGranted()) return true;
      const permission = await requestPermission();
      return permission === "granted";
    } catch {
      return false;
    }
  }

  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

/**
 * Show a push notification.
 * Silently no-ops if permission has not been granted.
 */
export const showPushNotification = async (
  title: string,
  body: string,
  url?: string,
): Promise<void> => {
  if (isTauri()) {
    try {
      const { isPermissionGranted, sendNotification } =
        await import("@tauri-apps/plugin-notification");
      if (!(await isPermissionGranted())) return;
      sendNotification({ title, body, ...(url && { extra: { url } }) });
      return;
    } catch {
      // fall through to web
    }
  }

  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const notif = new Notification(title, { body });
  if (url) {
    notif.onclick = () => {
      window.focus();
      window.location.href = url;
    };
  }
};

/**
 * One-time Tauri setup — call once on app mount.
 * - Creates the default Android notification channel (no-op on other platforms).
 * - Registers onNotificationReceived to navigate when a URL is carried in extra.
 * Returns a cleanup function that unregisters the listener.
 */
export const setupTauriNotifications = async (
  navigate: (url: string) => void,
): Promise<(() => void) | undefined> => {
  if (!isTauri()) return undefined;

  try {
    const { createChannel, Importance, Visibility, onNotificationReceived } =
      await import("@tauri-apps/plugin-notification");

    await createChannel({
      id: "erp-default",
      name: "ERP Notifications",
      description: "Default channel for ERP warehouse notifications",
      importance: Importance.Default,
      visibility: Visibility.Private,
    });

    const listener = await onNotificationReceived(
      (notification: { extra?: Record<string, unknown> }) => {
        const url = notification.extra?.url;
        if (typeof url === "string") navigate(url);
      },
    );

    return () => {
      void listener.unregister();
    };
  } catch {
    return undefined;
  }
};
