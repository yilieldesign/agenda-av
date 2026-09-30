(function (root, factory) {
  const api = factory();
  root.AgendaReminders = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_TIME = "08:00";
  const STALE_MS = 14 * 24 * 60 * 60 * 1000;
  const KIND_LABELS = {
    sameDay: "El mismo día",
    dayBefore: "1 día antes",
    twoDaysBefore: "2 días antes",
    custom: "Fecha y hora",
  };
  const KIND_OFFSET = {
    sameDay: 0,
    dayBefore: 1,
    twoDaysBefore: 2,
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function parseISODate(iso) {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  }

  function parseTime(value) {
    const [h, m] = String(value || DEFAULT_TIME).split(":").map(Number);
    return {
      hours: Number.isFinite(h) ? h : 8,
      minutes: Number.isFinite(m) ? m : 0,
    };
  }

  function parseLocalDateTime(value) {
    if (!value) return null;
    const [datePart, timePart] = String(value).split("T");
    if (!datePart) return null;
    const [y, m, d] = datePart.split("-").map(Number);
    const { hours, minutes } = parseTime(timePart);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, hours, minutes, 0, 0);
  }

  function toLocalDateTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function reminderFireDate(startDateISO, reminder) {
    if (!reminder) return null;
    if (reminder.kind === "custom") return parseLocalDateTime(reminder.customAt);
    if (!(reminder.kind in KIND_OFFSET)) return null;
    const date = parseISODate(startDateISO);
    date.setDate(date.getDate() - KIND_OFFSET[reminder.kind]);
    const { hours, minutes } = parseTime(reminder.time);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  function normalizeReminders(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const kind = item.kind === "custom" || item.kind in KIND_OFFSET ? item.kind : null;
        if (!kind) return null;
        return {
          id: String(item.id || ""),
          kind,
          time: kind === "custom" ? "" : (item.time || DEFAULT_TIME),
          customAt: kind === "custom" ? String(item.customAt || "") : "",
          notifiedAt: item.notifiedAt || null,
        };
      })
      .filter((item) => item && item.id && (item.kind !== "custom" || item.customAt));
  }

  function reminderTitle({ company, services, dateText }) {
    return [company || "Trabajo", services, dateText].filter(Boolean).join(" · ");
  }

  function reminderBody(kind) {
    if (kind === "sameDay") return "Hoy tienes este trabajo.";
    if (kind === "dayBefore") return "Mañana tienes este trabajo.";
    if (kind === "twoDaysBefore") return "En 2 días tienes este trabajo.";
    return "Recordatorio de un trabajo agendado.";
  }

  function fireStatus(fireDate, now, notifiedAt) {
    if (notifiedAt) return "done";
    if (!(fireDate instanceof Date) || Number.isNaN(fireDate.getTime())) return "invalid";
    const t = now instanceof Date ? now : new Date(now);
    if (fireDate.getTime() > t.getTime()) return "upcoming";
    if (t.getTime() - fireDate.getTime() > STALE_MS) return "stale";
    return "due";
  }

  return {
    DEFAULT_TIME,
    KIND_LABELS,
    KIND_OFFSET,
    parseISODate,
    parseLocalDateTime,
    toLocalDateTime,
    reminderFireDate,
    normalizeReminders,
    reminderTitle,
    reminderBody,
    fireStatus,
  };
});
