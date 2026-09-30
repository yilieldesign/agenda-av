/** Lee un .ics de Google Calendar y saca eventos con fecha, hora y título. */
const AgendaIcs = {
  parse(text) {
    const unfolded = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\n[ \t]/g, "");
    const blocks = [];
    const re = /BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/g;
    let match;
    while ((match = re.exec(unfolded))) blocks.push(match[1]);
    const items = [];
    for (const body of blocks) {
      try {
        items.push(...expandEvent(parseEvent(body)));
      } catch (_) { /* evento ilegible */ }
    }
    return items.slice(0, 400);
  },
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function icsUnescape(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function addIsoDays(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseStamp(value) {
  const raw = String(value || "").trim();
  const utc = /Z$/i.test(raw);
  const compact = raw.replace(/Z$/i, "").replace(/[-:]/g, "");
  const parts = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?$/);
  if (!parts) return null;
  const allDay = !parts[4];
  if (utc && !allDay) {
    const dt = new Date(Date.UTC(
      Number(parts[1]),
      Number(parts[2]) - 1,
      Number(parts[3]),
      Number(parts[4]),
      Number(parts[5]),
      Number(parts[6] || 0)
    ));
    return {
      date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
      allDay: false,
    };
  }
  return {
    date: `${parts[1]}-${parts[2]}-${parts[3]}`,
    time: allDay ? "" : `${parts[4]}:${parts[5]}`,
    allDay,
  };
}

function parseProps(body) {
  const props = [];
  String(body || "").split("\n").forEach((line) => {
    if (!line) return;
    const colon = line.indexOf(":");
    if (colon < 0) return;
    const meta = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const bits = meta.split(";");
    const name = (bits.shift() || "").toUpperCase();
    const params = {};
    bits.forEach((bit) => {
      const eq = bit.indexOf("=");
      if (eq >= 0) params[bit.slice(0, eq).toUpperCase()] = bit.slice(eq + 1);
    });
    props.push({ name, params, value });
  });
  return props;
}

function firstProp(props, name) {
  return props.find((item) => item.name === name) || null;
}

function allProps(props, name) {
  return props.filter((item) => item.name === name);
}

function inclusiveEnd(start, endStamp) {
  if (!endStamp) return start.date;
  if (start.allDay || endStamp.allDay) {
    if (endStamp.date <= start.date) return start.date;
    return addIsoDays(endStamp.date, -1);
  }
  if (endStamp.time === "00:00" && endStamp.date > start.date) {
    return addIsoDays(endStamp.date, -1);
  }
  return endStamp.date < start.date ? start.date : endStamp.date;
}

function parseRRule(raw) {
  const rule = {};
  String(raw || "").split(";").forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return;
    rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  });
  return rule;
}

function weekdayNum(token) {
  return { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }[token];
}

function simpleByDay(rule) {
  if (!rule.BYDAY) return null;
  const days = [];
  for (const token of String(rule.BYDAY).split(",")) {
    if (!/^[A-Z]{2}$/.test(token) || weekdayNum(token) == null) return "complex";
    days.push(weekdayNum(token));
  }
  return days;
}

function parseEvent(body) {
  const props = parseProps(body);
  const startProp = firstProp(props, "DTSTART");
  if (!startProp) return null;
  const start = parseStamp(startProp.value);
  if (!start) return null;
  const endProp = firstProp(props, "DTEND");
  const endStamp = endProp ? parseStamp(endProp.value) : null;
  const title = icsUnescape(firstProp(props, "SUMMARY")?.value || "") || "Trabajo importado";
  const description = icsUnescape(firstProp(props, "DESCRIPTION")?.value || "");
  const location = icsUnescape(firstProp(props, "LOCATION")?.value || "");
  const notes = [location, description].filter(Boolean).join("\n").slice(0, 500);
  const uid = icsUnescape(firstProp(props, "UID")?.value || "");
  const exdates = new Set();
  allProps(props, "EXDATE").forEach((item) => {
    String(item.value || "").split(",").forEach((stamp) => {
      const parsed = parseStamp(stamp);
      if (parsed) exdates.add(parsed.date);
    });
  });
  return {
    uid,
    title,
    notes,
    startDate: start.date,
    endDate: inclusiveEnd(start, endStamp),
    startTime: start.allDay ? "" : start.time,
    endTime: endStamp && !endStamp.allDay ? endStamp.time : "",
    rrule: firstProp(props, "RRULE")?.value || "",
    exdates,
  };
}

function shiftEnd(baseStart, baseEnd, nextStart) {
  const [ys, ms, ds] = baseStart.split("-").map(Number);
  const [ye, me, de] = baseEnd.split("-").map(Number);
  const delta = Math.round((new Date(ye, me - 1, de) - new Date(ys, ms - 1, ds)) / 86400000);
  return addIsoDays(nextStart, Math.max(0, delta));
}

function expandEvent(event) {
  if (!event) return [];
  const stamp = (startDate) => ({
    uid: event.uid,
    title: event.title,
    notes: event.notes,
    startDate,
    endDate: shiftEnd(event.startDate, event.endDate, startDate),
    startTime: event.startTime,
    endTime: event.endTime === "00:00" ? "" : event.endTime,
  });
  if (!event.rrule) return event.exdates.has(event.startDate) ? [] : [stamp(event.startDate)];

  const rule = parseRRule(event.rrule);
  const freq = String(rule.FREQ || "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(freq)) return [stamp(event.startDate)];
  const byday = simpleByDay(rule);
  if (byday === "complex") return [stamp(event.startDate)];

  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const maxCount = rule.COUNT ? Math.min(400, Number(rule.COUNT) || 1) : 400;
  const until = rule.UNTIL ? parseStamp(rule.UNTIL)?.date : "";
  const horizon = addIsoDays(isoToday(), 548);
  const past = addIsoDays(isoToday(), -400);
  const out = [];
  let cursor = event.startDate;
  let seen = 0;
  let guard = 0;

  while (seen < maxCount && guard < 2500) {
    guard += 1;
    if (until && cursor > until) break;
    if (!rule.COUNT && cursor > horizon) break;
    const weekday = isoWeekday(cursor);
    const dayOk = freq === "WEEKLY" && byday ? byday.includes(weekday) : true;
    const intervalOk = occurrenceFits(event.startDate, cursor, freq, interval, byday);
    if (dayOk && intervalOk && !event.exdates.has(cursor)) {
      seen += 1;
      if (cursor >= past && cursor <= horizon) out.push(stamp(cursor));
    }
    if (freq === "MONTHLY") cursor = nextCursor(cursor, "MONTHLY", interval);
    else if (freq === "WEEKLY" && !byday) cursor = addIsoDays(cursor, 7 * interval);
    else cursor = addIsoDays(cursor, freq === "DAILY" ? interval : 1);
  }
  return out.slice(0, 400);
}

function isoWeekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function daysBetweenIso(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}

function occurrenceFits(start, cursor, freq, interval, byday) {
  if (cursor < start) return false;
  const delta = daysBetweenIso(start, cursor);
  if (freq === "DAILY") return delta % interval === 0;
  if (freq === "WEEKLY") {
    if (byday) return Math.floor(delta / 7) % interval === 0;
    return delta % (7 * interval) === 0;
  }
  if (freq === "MONTHLY") return true;
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextCursor(iso, freq, interval) {
  if (freq === "DAILY") return addIsoDays(iso, interval);
  if (freq === "WEEKLY") return addIsoDays(iso, 7 * interval);
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + interval);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AgendaIcs;
}
