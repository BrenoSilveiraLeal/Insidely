"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction, openNotificationAction } from "@/app/actions";

type NotificationItem = { id: string; title: string; body: string; href: string | null; readAt: string | null };

export function NotificationPopover({ notifications }: { notifications: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((notification) => !notification.readAt);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return <div className="notification-wrap" ref={ref}>
    <button className={`notification-bell ${unread.length ? "notification-bell-active" : ""}`} type="button" aria-label={unread.length ? `${unread.length} notificações não lidas` : "Notificações"} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <Bell size={19} aria-hidden="true" />{unread.length > 0 && <span>{unread.length > 99 ? "99+" : unread.length}</span>}
    </button>
    {open && <div className="notification-popover" role="dialog" aria-label="Notificações">
      <div className="notification-popover-head"><strong>Notificações</strong>{unread.length > 0 && <form action={markAllNotificationsReadAction}><button className="notification-popover-link" type="submit">Marcar todas como lidas</button></form>}</div>
      {notifications.length === 0 ? <p className="muted">Nenhuma notificação.</p> : <div className="notification-popover-list">{notifications.slice(0, 10).map((notification) => <div className={`notification-popover-item ${notification.readAt ? "" : "is-unread"}`} key={notification.id}>
        <strong>{notification.title}</strong><p>{notification.body}</p>
        <div className="notification-popover-actions">{notification.href && <form action={openNotificationAction.bind(null, notification.id, notification.href)}><button className="button button-ghost button-sm" type="submit">Abrir</button></form>}{!notification.readAt && <form action={markNotificationReadAction.bind(null, notification.id)}><button className="button button-ghost button-sm" type="submit">Lida</button></form>}</div>
      </div>)}</div>}
    </div>}
  </div>;
}
