"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
};

/**
 * Polls for new admin notifications every 5 seconds. New ones become on-screen
 * toasts and (if permission is granted) browser Web Notifications.
 */
export function NotificationCenter() {
  const [toasts, setToasts] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const sinceRef = useRef<string>(new Date().toISOString());
  const [notifPermission, setNotifPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/notifications?since=${encodeURIComponent(sinceRef.current)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.unreadCount);
      const fresh: Notif[] = data.notifications;
      if (fresh.length > 0) {
        sinceRef.current = fresh[0].createdAt;
        setToasts((prev) => [...fresh, ...prev].slice(0, 5));
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const n of fresh) {
            try {
              new Notification(`CSAIS: ${n.title}`, { body: n.body, tag: n.id });
            } catch {
              // Some browsers require a service worker; toast still shows.
            }
          }
        }
      }
    } catch {
      // Network blip — next poll retries.
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPermission(p);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {notifPermission === "default" && (
          <button
            type="button"
            onClick={enableBrowserNotifications}
            className="rounded border border-line bg-surface-2 px-2 py-1 text-xs font-semibold text-muted hover:text-foreground"
          >
            Enable browser alerts
          </button>
        )}
        {unread > 0 && (
          <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-black text-white">
            {unread} unread
          </span>
        )}
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const danger = t.type === "checkin_missed";
          return (
            <div
              key={t.id}
              className={`rounded-xl border-2 p-4 shadow-xl ${
                danger
                  ? "pulse-danger border-danger bg-[#2a0f0f]"
                  : "border-line bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`font-black ${danger ? "text-danger" : ""}`}>{t.title}</p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="text-sm text-muted underline"
                >
                  Dismiss
                </button>
              </div>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-foreground/90">
                {t.body}
              </pre>
            </div>
          );
        })}
      </div>
    </>
  );
}
