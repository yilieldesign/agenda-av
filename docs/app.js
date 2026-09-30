const STORAGE_KEY = "agenda-av-web-v3";
const PROFILE_KEY = "agenda-av-profile-v2";
const APP_CREDIT = "Esta app fue creada por Eliezer Cruz";
const PALETTE = ["#DC2626", "#6B7280", "#2563EB", "#84CC16", "#7C3AED", "#0F766E", "#C2410C", "#A16207"];

const REAL_COMPANIES = [
  { id: "co-grabandord", name: "GrabandoRD", color: "#DC2626" },
  { id: "co-solingeniosas", name: "Soluciones ingeniosas", color: "#6B7280" },
  { id: "co-solaudiovisuales", name: "Soluciones Audiovisuales", color: "#2563EB" },
  { id: "co-audiovisualiard", name: "AudiovisualiaRD", color: "#84CC16" },
  { id: "co-larento", name: "Larento", color: "#7C3AED" },
];

const REAL_SERVICES = [
  { id: "sv-sonidista", name: "Sonidista" },
  { id: "sv-lumino", name: "Lumino técnico" },
  { id: "sv-vj", name: "Serv. VJ Pantalla" },
  { id: "sv-tecnico", name: "Serv. Técnico completo" },
  { id: "sv-streaming", name: "Serv. de Streaming" },
  { id: "sv-parcheo", name: "Parcheo Pantalla" },
  { id: "sv-ensayo", name: "Ensayo" },
];

const state = {
  tab: "agenda",
  month: startOfMonth(new Date()),
  selected: toISODate(new Date()),
  companies: [],
  events: [],
  services: [],
  editingId: null,
  paymentStatus: "pending",
  selectedCompanyId: null,
  selectedServiceIds: [],
  editingCompanyId: null,
  editingServiceId: null,
  lastAmount: 0,
  activeInvoiceId: null,
  previewMode: "company",
  reminderKinds: new Set(),
  reminderTime: "08:00",
  customReminders: [],
  report: {
    kind: "monthly",
    month: startOfMonth(new Date()),
    biweekly: "firstHalf",
    customStart: toISODate(new Date()),
    customEnd: toISODate(new Date()),
  },
};

function localeTag() {
  const nav = navigator.language || "es-DO";
  const region = (nav.split("-")[1] || "DO").toUpperCase();
  const known = ["DO", "MX", "CL", "AR", "CO", "PE", "US", "ES"];
  return `es-${known.includes(region) ? region : "DO"}`;
}

function formatDate(date, options) {
  const text = date.toLocaleDateString(localeTag(), options);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function money(amount) {
  const n = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `RD$${formatted}`;
}

function parseAmount(value) {
  const raw = String(value ?? "").replace(/RD\$/gi, "").replace(/\s/g, "").trim();
  if (!raw) return 0;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw.replace(/[^\d.,-]/g, "");
  if (lastComma > lastDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatAmountInput(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}

function toISODate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function daysBetween(start, end) {
  const list = [];
  let cur = start;
  while (cur <= end) {
    list.push(cur);
    cur = addDays(cur, 1);
  }
  return list;
}

function dayCount(start, end) {
  const last = end < start ? start : end;
  return Math.max(1, daysBetween(start, last).length);
}

function eventDayCount(event) {
  return dayCount(event.startDate, event.endDate);
}

function jobTotal(event) {
  return (Number(event.amount) || 0) * eventDayCount(event);
}

function jobOverlapsRange(event, start, end) {
  return event.startDate <= end && event.endDate >= start;
}

function jobStartsInRange(event, start, end) {
  return event.startDate >= start && event.startDate <= end;
}

/** Cobro completo del trabajo si cae en el período; no se parte por días del mes. */
function amountInRange(event, start, end) {
  return jobOverlapsRange(event, start, end) ? jobTotal(event) : 0;
}

function updateAmountHint() {
  const form = document.getElementById("eventForm");
  const hint = document.getElementById("amountHint");
  if (!form || !hint) return;
  const start = form.startDate.value;
  const end = form.endDate.value;
  if (!start) {
    hint.textContent = "Se multiplica por los días del rango.";
    return;
  }
  const days = dayCount(start, end || start);
  const rate = parseAmount(form.amount.value);
  if (days === 1) {
    hint.textContent = rate
      ? `Total a cobrar: ${money(rate)} (1 día)`
      : "Si eliges más de un día, este monto se multiplica.";
    return;
  }
  hint.textContent = rate
    ? `Total a cobrar: ${money(rate * days)} (${money(rate)} × ${days} días)`
    : `Este monto se multiplicará por ${days} días.`;
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function load() {
  ["agenda-av-web-v1", "agenda-av-web-v2", "agenda-av-profile-v1"].forEach((key) => {
    localStorage.removeItem(key);
  });
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const data = JSON.parse(raw);
    state.companies = data.companies || [];
    state.events = data.events || [];
    state.services = data.services || [];
    state.lastAmount = parseAmount(data.lastAmount);
  } else {
    seed();
  }
  ensureCatalog();
  pruneUnusedCatalog();
  sortCatalog();
  state.events.forEach((event) => {
    event.reminders = AgendaReminders.normalizeReminders(event.reminders);
    event.activityName = event.activityName || "";
    event.amount = parseAmount(event.amount);
  });
  if (!state.lastAmount) {
    const recent = [...state.events].reverse().find((event) => parseAmount(event.amount) > 0);
    if (recent) state.lastAmount = parseAmount(recent.amount);
  }
  persist();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    companies: state.companies,
    events: state.events,
    services: state.services,
    lastAmount: state.lastAmount,
  }));
}

function seed() {
  state.companies = REAL_COMPANIES.map((c) => ({ ...c }));
  state.services = REAL_SERVICES.map((s) => ({ ...s }));
  state.events = [];
}

function ensureCatalog() {
  REAL_COMPANIES.forEach((wanted) => {
    const existing = state.companies.find((c) =>
      c.id === wanted.id || c.name.toLowerCase() === wanted.name.toLowerCase()
    );
    if (existing) {
      existing.name = wanted.name;
      existing.color = wanted.color;
    } else {
      state.companies.push({ ...wanted });
    }
  });
  if (!state.services.length) {
    state.services = REAL_SERVICES.map((item) => ({ ...item }));
  }
}

function pruneUnusedCatalog() {
  const usedCompanyIds = new Set(state.events.map((event) => event.companyId));
  state.companies = state.companies.filter((company) => {
    const isReal = REAL_COMPANIES.some((item) => item.id === company.id || item.name.toLowerCase() === company.name.toLowerCase());
    return isReal || usedCompanyIds.has(company.id);
  });
}

function catalogIndex(list, name) {
  const index = list.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
  return index === -1 ? 100 : index;
}

function sortCatalog() {
  state.companies.sort((a, b) => {
    const order = catalogIndex(REAL_COMPANIES, a.name) - catalogIndex(REAL_COMPANIES, b.name);
    return order !== 0 ? order : a.name.localeCompare(b.name, "es");
  });
  state.services.sort((a, b) => {
    const order = catalogIndex(REAL_SERVICES, a.name) - catalogIndex(REAL_SERVICES, b.name);
    return order !== 0 ? order : a.name.localeCompare(b.name, "es");
  });
}

function companyById(id) {
  return state.companies.find((c) => c.id === id);
}

function serviceById(id) {
  return state.services.find((s) => s.id === id);
}

function eventServices(event) {
  if (Array.isArray(event.serviceIds) && event.serviceIds.length) {
    const names = event.serviceIds.map((id) => serviceById(id)?.name).filter(Boolean);
    if (names.length) return names;
  }
  if (event.projectName) {
    return event.projectName.split(/\s*,\s*/).map((n) => n.trim()).filter(Boolean);
  }
  return [];
}

function eventServicesLabel(event) {
  const names = eventServices(event);
  return names.length ? names.join(", ") : (event.projectName || "");
}

function eventTitle(event) {
  const activity = (event.activityName || "").trim();
  if (activity) return activity;
  return eventServicesLabel(event) || "Trabajo";
}

function eventReportLabel(event) {
  const activity = (event.activityName || "").trim();
  const services = eventServicesLabel(event);
  if (activity && services) return `${activity} · ${services}`;
  return activity || services || "Trabajo";
}

function rememberService(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const existing = state.services.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const created = { id: uid(), name: trimmed };
  state.services.push(created);
  state.services.sort((a, b) => a.name.localeCompare(b.name, localeTag()));
  return created;
}

function sortedCompanies() {
  return [...state.companies].sort((a, b) => {
    const order = catalogIndex(REAL_COMPANIES, a.name) - catalogIndex(REAL_COMPANIES, b.name);
    return order !== 0 ? order : a.name.localeCompare(b.name, localeTag());
  });
}

function sortedServices() {
  return [...state.services].sort((a, b) => {
    const order = catalogIndex(REAL_SERVICES, a.name) - catalogIndex(REAL_SERVICES, b.name);
    return order !== 0 ? order : a.name.localeCompare(b.name, localeTag());
  });
}

function eventsOn(iso) {
  return state.events
    .filter((e) => iso >= e.startDate && iso <= e.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function occupancyForMonth() {
  const map = {};
  const start = toISODate(startOfMonth(state.month));
  const end = toISODate(endOfMonth(state.month));
  for (const event of state.events) {
    const from = event.startDate > start ? event.startDate : start;
    const to = event.endDate < end ? event.endDate : end;
    if (from > to) continue;
    for (const day of daysBetween(from, to)) {
      if (!map[day]) map[day] = { colors: new Map(), count: 0 };
      map[day].count += 1;
      const company = companyById(event.companyId);
      map[day].colors.set(event.companyId || "none", company?.color || "#6B7280");
    }
  }
  return map;
}

function renderCalendar() {
  document.getElementById("monthLabel").textContent = formatDate(state.month, {
    month: "long",
    year: "numeric",
  });
  const weekdays = ["L", "M", "X", "J", "V", "S", "D"];
  document.getElementById("weekdays").innerHTML = weekdays.map((d) => `<span>${d}</span>`).join("");

  const first = startOfMonth(state.month);
  const lead = (first.getDay() + 6) % 7;
  const totalDays = endOfMonth(state.month).getDate();
  const occupancy = occupancyForMonth();
  const today = toISODate(new Date());
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(`<div class="day empty"></div>`);
  for (let d = 1; d <= totalDays; d += 1) {
    const iso = toISODate(new Date(state.month.getFullYear(), state.month.getMonth(), d));
    const occ = occupancy[iso];
    const colors = occ ? [...occ.colors.values()] : [];
    const selected = iso === state.selected ? "selected" : "";
    const todayCls = iso === today ? "today" : "";
    const occupiedCls = colors.length === 1 ? "occupied" : colors.length > 1 ? "multi" : "";
    const style = colors.length === 1 ? `--day-color:${colors[0]}` : "";
    const dots = colors.slice(0, 3).map((c) => `<i style="background:${selected ? '#fff' : c}"></i>`).join("");
    cells.push(`
      <button type="button" class="day ${occupiedCls} ${selected} ${todayCls}" data-day="${iso}" style="${style}">
        ${d}
        <span class="dots">${dots}</span>
      </button>
    `);
  }
  document.getElementById("calendarGrid").innerHTML = cells.join("");
}

function renderDayPanel() {
  const events = eventsOn(state.selected);
  const date = formatDate(parseISO(state.selected), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const rows = events.map((event) => {
    const company = companyById(event.companyId);
    const range = event.startDate === event.endDate
      ? ""
      : `<div class="muted">${event.startDate} – ${event.endDate}</div>`;
    return `
      <button type="button" class="event" data-edit="${event.id}">
        <span class="bar" style="--c:${company?.color || "#6B7280"}"></span>
        <div>
          <strong>${escapeHtml(eventTitle(event))}</strong>
          ${(event.activityName || "").trim() && eventServicesLabel(event)
            ? `<div class="muted">${escapeHtml(eventServicesLabel(event))}</div>`
            : ""}
          <div class="muted">${escapeHtml(company?.name || "Sin empresa")}</div>
          ${range}
          <span class="badge ${event.paymentStatus}">${event.paymentStatus === "paid" ? "Pagado" : "Pendiente"}</span>
          ${event.reminders?.length ? `<span class="bell" title="Con recordatorio">🔔</span>` : ""}
        </div>
        <strong>${money(jobTotal(event))}</strong>
      </button>
    `;
  }).join("");

  document.getElementById("dayPanel").innerHTML = `
    <div class="row-between">
      <div>
        <h3 style="margin:0">${date}</h3>
        <p class="muted">${events.length ? `${events.length} trabajo${events.length === 1 ? "" : "s"}` : "Día disponible"}</p>
      </div>
    </div>
    ${events.length ? rows : `<div class="empty-state"><p>Sin trabajos. Este día está libre.</p></div>`}
    <button type="button" class="primary" id="addFromDay">Agendar nuevo trabajo</button>
  `;
}

function reportRange() {
  const r = state.report;
  const month = r.month;
  const startMonth = toISODate(startOfMonth(month));
  const endMonth = toISODate(endOfMonth(month));
  if (r.kind === "monthly") return { start: startMonth, end: endMonth };
  if (r.kind === "yearly") {
    const year = month.getFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (r.kind === "biweekly") {
    if (r.biweekly === "firstHalf") return { start: startMonth, end: addDays(startMonth, 14) };
    if (r.biweekly === "secondHalf") return { start: addDays(startMonth, 15), end: endMonth };
    return { start: r.customStart, end: addDays(r.customStart, 14) };
  }
  const a = r.customStart < r.customEnd ? r.customStart : r.customEnd;
  const b = r.customStart < r.customEnd ? r.customEnd : r.customStart;
  return { start: a, end: b };
}

function summarizeRange(start, end) {
  const events = state.events
    .filter((e) => jobOverlapsRange(e, start, end))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const byCompany = {};
  for (const event of events) {
    const key = event.companyId || "none";
    const company = companyById(event.companyId);
    if (!byCompany[key]) {
      byCompany[key] = {
        id: key,
        name: company?.name || "Sin empresa",
        color: company?.color || "#6B7280",
        days: new Set(),
        jobs: 0,
        amount: 0,
        pendingAmount: 0,
        events: [],
      };
    }
    const from = event.startDate > start ? event.startDate : start;
    const to = event.endDate < end ? event.endDate : end;
    daysBetween(from, to).forEach((d) => byCompany[key].days.add(d));
    const earned = amountInRange(event, start, end);
    byCompany[key].jobs += 1;
    byCompany[key].amount += earned;
    if (event.paymentStatus === "pending") {
      byCompany[key].pendingAmount += earned;
    }
    byCompany[key].events.push(event);
  }
  const paid = events.filter((e) => e.paymentStatus === "paid");
  const pending = events.filter((e) => e.paymentStatus === "pending");
  const total = events.reduce((sum, e) => sum + amountInRange(e, start, end), 0);
  return {
    start,
    end,
    events,
    total,
    jobCount: events.length,
    companies: Object.values(byCompany)
      .map((c) => ({
        ...c,
        events: [...c.events].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      }))
      .sort((a, b) => b.amount - a.amount),
    paid: { count: paid.length, amount: paid.reduce((s, e) => s + amountInRange(e, start, end), 0) },
    pending: { count: pending.length, amount: pending.reduce((s, e) => s + amountInRange(e, start, end), 0) },
  };
}

function summarize() {
  const { start, end } = reportRange();
  return summarizeRange(start, end);
}

function monthlyEarnings(year) {
  const rows = [];
  for (let month = 0; month < 12; month += 1) {
    const anchor = new Date(year, month, 1);
    const start = toISODate(startOfMonth(anchor));
    const end = toISODate(endOfMonth(anchor));
    const started = state.events.filter((event) => jobStartsInRange(event, start, end));
    const paid = started.filter((event) => event.paymentStatus === "paid");
    const pending = started.filter((event) => event.paymentStatus === "pending");
    rows.push({
      start,
      end,
      label: formatDate(anchor, { month: "long" }),
      total: started.reduce((sum, event) => sum + jobTotal(event), 0),
      jobCount: started.length,
      paid: paid.reduce((sum, event) => sum + jobTotal(event), 0),
      pending: pending.reduce((sum, event) => sum + jobTotal(event), 0),
    });
  }
  return rows;
}

function formatRange(start, end) {
  const opts = { day: "numeric", month: "long", year: "numeric" };
  return `${formatDate(parseISO(start), opts)} – ${formatDate(parseISO(end), opts)}`;
}

function formatJobDate(event) {
  const opts = { day: "numeric", month: "short" };
  const start = formatDate(parseISO(event.startDate), opts);
  if (event.startDate === event.endDate) return start;
  const end = formatDate(parseISO(event.endDate), opts);
  return `${start} – ${end}`;
}

function loadProfile() {
  try {
    return Object.assign(
      { name: "", phone: "", payment: "" },
      JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}")
    );
  } catch {
    return { name: "", phone: "", payment: "" };
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function applyUserName() {
  const name = loadProfile().name.trim();
  const eyebrow = document.getElementById("appEyebrow");
  if (eyebrow) eyebrow.textContent = name || "Agenda AV";
}

function showSetupIfNeeded() {
  const overlay = document.getElementById("setupOverlay");
  if (!overlay) return;
  overlay.classList.toggle("hidden", Boolean(loadProfile().name.trim()));
}

function renderInvoiceProfile() {
  const profile = loadProfile();
  document.getElementById("invoiceProfileCard").innerHTML = `
    <h3>Tus datos en el reporte</h3>
    <p class="muted">Salen en el PDF que envías a la empresa para que te paguen.</p>
    <label>Tu nombre
      <input id="profileName" value="${escapeHtml(profile.name)}" placeholder="Ej. Juan Pérez — Camarógrafo">
    </label>
    <label>Teléfono
      <input id="profilePhone" value="${escapeHtml(profile.phone)}" placeholder="Opcional">
    </label>
    <label>Datos de pago
      <input id="profilePayment" value="${escapeHtml(profile.payment)}" placeholder="Banco, cuenta, Zelle, etc.">
    </label>
  `;
}

function eventsAmount(events) {
  return events.reduce((sum, event) => sum + jobTotal(event), 0);
}

function companyRowsByStatus(summary, status) {
  return summary.companies
    .map((company) => {
      const events = company.events.filter((event) => event.paymentStatus === status);
      return {
        ...company,
        events,
        jobs: events.length,
        amount: eventsAmount(events),
        pendingAmount: status === "pending" ? eventsAmount(events) : 0,
      };
    })
    .filter((company) => company.events.length);
}

function jobLinesHTML(events) {
  return events.map((event) => `
    <div class="job-line">
      <span class="date">${escapeHtml(formatJobDate(event))}</span>
      <span>${escapeHtml(eventReportLabel(event))}</span>
      <strong>${money(jobTotal(event))}</strong>
    </div>
  `).join("");
}

function companyCardHTML(company, mode) {
  const pending = mode === "pending";
  return `
    <article class="company-block-card">
      <div class="breakdown-row">
        <div>
          <span class="swatch" style="background:${company.color}"></span>
          <strong>${escapeHtml(company.name)}</strong>
          <div class="muted">${company.jobs} trabajo${company.jobs === 1 ? "" : "s"}</div>
        </div>
        <strong>${money(company.amount)}</strong>
      </div>
      ${jobLinesHTML(company.events)}
      <div class="total-line"><span>Total</span><span>${money(company.amount)}</span></div>
      ${pending ? `
        <div class="pending-line"><span>Pendiente de pago</span><span>${money(company.pendingAmount)}</span></div>
        <button type="button" class="secondary preview-btn" data-preview-company="${company.id}">Vista previa</button>
        <div class="row-actions invoice-actions">
          <button type="button" class="secondary" data-print-company="${company.id}">Imprimir</button>
          <button type="button" class="primary" data-invoice="${company.id}">Reporte PDF</button>
        </div>
        <button type="button" class="pay-company-btn" data-pay-company="${company.id}">Pago por empresa</button>
      ` : `
        <div class="paid-line"><span>Pagado · historial</span><span>${money(company.amount)}</span></div>
      `}
    </article>
  `;
}

function markCompanyPaid(companyId) {
  const summary = summarize();
  const company = summary.companies.find((item) => item.id === companyId);
  if (!company) return;
  const pending = company.events.filter((event) => event.paymentStatus === "pending");
  if (!pending.length) return;
  const label = pending.length === 1 ? "1 trabajo pendiente" : `${pending.length} trabajos pendientes`;
  const ok = window.confirm(
    `¿Marcar como pagados los ${label} de ${company.name}?\n\nSalen de Pendiente y quedan en el historial.`
  );
  if (!ok) return;
  const ids = new Set(pending.map((event) => event.id));
  state.events.forEach((event) => {
    if (ids.has(event.id)) event.paymentStatus = "paid";
  });
  persist();
  render();
}

function companyInvoice(companyId) {
  const summary = summarize();
  const company = summary.companies.find((c) => c.id === companyId);
  if (!company) return null;
  const jobs = company.events.filter((event) => event.paymentStatus === "pending");
  if (!jobs.length) return null;
  const profile = loadProfile();
  return {
    issued: formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" }),
    fromName: profile.name || "Servicios audiovisuales freelance",
    fromPhone: profile.phone,
    paymentNote: profile.payment,
    companyName: company.name,
    period: formatRange(summary.start, summary.end),
    jobs: jobs.map((event) => ({
      date: formatJobDate(event),
      project: eventReportLabel(event),
      status: "",
      amount: money(jobTotal(event)),
      amountRaw: jobTotal(event),
    })),
    total: money(eventsAmount(jobs)),
    fileName: `Reporte-${(company.name || "cliente").replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/gi, "-")}.pdf`,
  };
}

function invoiceHTML(inv) {
  const rows = inv.jobs.map((job) => `
    <tr>
      <td>${escapeHtml(job.date)}</td>
      <td>${escapeHtml(job.project)}</td>
      <td>${escapeHtml(job.amount)}</td>
    </tr>
  `).join("");
  return `
    <h2>Reporte</h2>
    <p class="muted">${escapeHtml(inv.issued)}</p>
    <p><strong>De:</strong> ${escapeHtml(inv.fromName)}${inv.fromPhone ? ` · ${escapeHtml(inv.fromPhone)}` : ""}</p>
    <p><strong>Para:</strong> ${escapeHtml(inv.companyName)}</p>
    <p><strong>Período:</strong> ${escapeHtml(inv.period)}</p>
    <table>
      <thead><tr><th>Fecha</th><th>Trabajo</th><th>Monto</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="2">Total</th><th>${escapeHtml(inv.total)}</th></tr>
      </tfoot>
    </table>
    ${inv.paymentNote ? `<p><strong>Pago:</strong> ${escapeHtml(inv.paymentNote)}</p>` : ""}
    <p class="muted">Documento para cobro de servicios audiovisuales.</p>
    <p class="credit-line">${APP_CREDIT}</p>
  `;
}

function openInvoice(companyId) {
  const inv = companyInvoice(companyId);
  if (!inv) return;
  state.previewMode = "company";
  state.activeInvoiceId = companyId;
  document.getElementById("invoicePreview").innerHTML = `<div class="invoice-preview">${invoiceHTML(inv)}</div>`;
  document.getElementById("invoiceOverlay").classList.remove("hidden");
}

function openReportPreview() {
  state.previewMode = "period";
  state.activeInvoiceId = null;
  document.getElementById("invoicePreview").innerHTML = `<div class="invoice-preview">${reportHTML(summarize())}</div>`;
  document.getElementById("invoiceOverlay").classList.remove("hidden");
}

function closeInvoice() {
  document.getElementById("invoiceOverlay").classList.add("hidden");
  state.activeInvoiceId = null;
  state.previewMode = "company";
}

function printCurrentInvoice() {
  if (state.previewMode === "period") {
    printReport();
    return;
  }
  const inv = companyInvoice(state.activeInvoiceId);
  if (!inv) return;
  const root = document.getElementById("printRoot");
  root.innerHTML = invoiceHTML(inv);
  root.hidden = false;
  window.print();
}

async function sendCurrentInvoice() {
  if (state.previewMode === "period") {
    await shareReport();
    return;
  }
  const inv = companyInvoice(state.activeInvoiceId);
  if (!inv) return;
  const blob = InvoicePDF.build(inv);
  const file = new File([blob], inv.fileName, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `Reporte ${inv.companyName}`,
      text: `Reporte ${inv.companyName} · Total ${inv.total}`,
      files: [file],
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = inv.fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function shareCompanyInvoice(companyId) {
  state.previewMode = "company";
  state.activeInvoiceId = companyId;
  await sendCurrentInvoice();
}

function renderReports() {
  const r = state.report;
  let extra = `
    <div class="month-nav">
      <button type="button" id="prevReportMonth">‹</button>
      <h2>${formatDate(r.month, { month: "long", year: "numeric" })}</h2>
      <button type="button" id="nextReportMonth">›</button>
    </div>
  `;
  if (r.kind === "yearly") {
    extra = `
      <div class="month-nav">
        <button type="button" id="prevReportYear">‹</button>
        <h2>${r.month.getFullYear()}</h2>
        <button type="button" id="nextReportYear">›</button>
      </div>
    `;
  } else if (r.kind === "biweekly") {
    extra += `
      <label>Quincena
        <select id="biweeklyMode">
          <option value="firstHalf" ${r.biweekly === "firstHalf" ? "selected" : ""}>1 al 15</option>
          <option value="secondHalf" ${r.biweekly === "secondHalf" ? "selected" : ""}>16 al fin de mes</option>
          <option value="rolling15" ${r.biweekly === "rolling15" ? "selected" : ""}>15 días desde una fecha</option>
        </select>
      </label>
      ${r.biweekly === "rolling15" ? `<label>Desde <input type="date" id="rollingStart" value="${r.customStart}"></label>` : ""}
    `;
  } else if (r.kind === "custom") {
    extra = `
      <label>Desde <input type="date" id="customStart" value="${r.customStart}"></label>
      <label>Hasta <input type="date" id="customEnd" value="${r.customEnd}"></label>
    `;
  }
  document.getElementById("periodControls").innerHTML = extra;

  const summary = summarize();
  document.getElementById("periodTitle").textContent = formatRange(summary.start, summary.end);
  document.getElementById("metrics").innerHTML = `
    <div class="metric"><span>Trabajos</span><strong>${summary.jobCount}</strong></div>
    <div class="metric"><span>${r.kind === "yearly" ? "Total del año" : "Total a cobrar"}</span><strong>${money(summary.total)}</strong></div>
    <div class="metric"><span>Pagado</span><strong>${money(summary.paid.amount)}</strong></div>
    <div class="metric"><span>Pendiente</span><strong>${money(summary.pending.amount)}</strong></div>
  `;

  const monthsBox = document.getElementById("monthlyBreakdown");
  if (r.kind === "yearly") {
    const months = monthlyEarnings(r.month.getFullYear());
    monthsBox.classList.remove("hidden");
    monthsBox.innerHTML = `
      <h3>Ganado por mes</h3>
      <p class="muted">El cobro completo se cuenta en el mes en que empieza el trabajo. Toca un mes para ver el detalle.</p>
      ${months.map((m) => `
        <button type="button" class="month-earn" data-open-month="${m.start}">
          <span>
            <strong>${escapeHtml(m.label)}</strong>
            <div class="muted">${m.jobCount ? `${m.jobCount} trabajo${m.jobCount === 1 ? "" : "s"}` : "Sin trabajos"}</div>
          </span>
          <strong>${money(m.total)}</strong>
        </button>
      `).join("")}
    `;
  } else {
    monthsBox.classList.add("hidden");
    monthsBox.innerHTML = "";
  }

  const pendingCompanies = companyRowsByStatus(summary, "pending");
  const paidCompanies = companyRowsByStatus(summary, "paid");
  document.getElementById("companyBreakdown").innerHTML = `
    <h3>Pendiente por empresa</h3>
    <p class="muted">Aquí solo salen los cobros que faltan. Cuando te paguen, usa Pago por empresa: salen de esta lista y quedan en el historial.</p>
    ${pendingCompanies.length
      ? pendingCompanies.map((company) => companyCardHTML(company, "pending")).join("")
      : `<p class="muted">No hay cobros pendientes en este período.</p>`}
  `;
  const historyBox = document.getElementById("historyBreakdown");
  historyBox.classList.toggle("hidden", !paidCompanies.length);
  historyBox.innerHTML = paidCompanies.length ? `
    <h3>Historial</h3>
    <p class="muted">Trabajos ya cobrados. No entran en pendientes; sirven para ver lo ganado.</p>
    ${paidCompanies.map((company) => companyCardHTML(company, "history")).join("")}
  ` : "";
  renderInvoiceProfile();
  document.getElementById("statusBreakdown").innerHTML = `
    <h3>Desglose por estado</h3>
    <div class="breakdown-row"><span>Pagado · ${summary.paid.count}</span><strong>${money(summary.paid.amount)}</strong></div>
    <div class="breakdown-row"><span>Pendiente · ${summary.pending.count}</span><strong>${money(summary.pending.amount)}</strong></div>
  `;
  document.getElementById("jobsList").innerHTML = `
    <h3>Trabajos del período</h3>
    ${summary.events.map((event) => {
      const company = companyById(event.companyId);
      const paid = event.paymentStatus === "paid";
      return `<div class="breakdown-row"><div><strong>${escapeHtml(eventReportLabel(event))}</strong><div class="muted">${event.startDate}${event.startDate !== event.endDate ? " – " + event.endDate : ""} · ${escapeHtml(company?.name || "")} · ${paid ? "Historial" : "Pendiente"}</div></div><strong>${money(jobTotal(event))}</strong></div>`;
    }).join("") || `<p class="muted">Ajusta el rango para ver resultados.</p>`}
  `;
}

function reportHTML(summary) {
  const rows = summary.events.map((event) => {
    const company = companyById(event.companyId);
    const fecha = event.startDate === event.endDate ? event.startDate : `${event.startDate} – ${event.endDate}`;
    return `<tr><td>${fecha}</td><td>${escapeHtml(company?.name || "—")}</td><td>${escapeHtml(eventReportLabel(event))}</td><td>${money(jobTotal(event))}</td></tr>`;
  }).join("");
  const year = state.report.month.getFullYear();
  const months = state.report.kind === "yearly"
    ? monthlyEarnings(year).map((m) => `<tr><td>${escapeHtml(m.label)}</td><td>${m.jobCount}</td><td>${money(m.total)}</td></tr>`).join("")
    : "";
  const monthsBlock = state.report.kind === "yearly" ? `
    <h3>Ganado por mes</h3>
    <table>
      <thead><tr><th>Mes</th><th>Trabajos</th><th>Total</th></tr></thead>
      <tbody>${months}</tbody>
    </table>
  ` : "";
  return `
    <h1>Reporte</h1>
    <p>Período: ${formatRange(summary.start, summary.end)}</p>
    <p>Generado ${new Date().toLocaleString(localeTag())}</p>
    <p><strong>Trabajos:</strong> ${summary.jobCount} &nbsp; <strong>${state.report.kind === "yearly" ? "Total del año" : "Total a cobrar"}:</strong> ${money(summary.total)}</p>
    ${monthsBlock}
    <h3>Desglose por empresa</h3>
    ${summary.companies.map((c) => `<p>${escapeHtml(c.name)} · ${c.days.size} días · ${money(c.amount)}</p>`).join("")}
    <table>
      <thead><tr><th>Fecha</th><th>Empresa</th><th>Proyecto</th><th>Monto</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">Sin trabajos</td></tr>`}</tbody>
    </table>
    <p style="text-align:right;font-weight:700">TOTAL GENERAL ${money(summary.total)}</p>
    <p class="credit-line">${APP_CREDIT}</p>
  `;
}

function printReport() {
  const summary = summarize();
  const root = document.getElementById("printRoot");
  root.innerHTML = reportHTML(summary);
  root.hidden = false;
  window.print();
}

async function shareReport() {
  const summary = summarize();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte</title>
    <style>body{font-family:Segoe UI,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left} th{background:#122027;color:#fff}</style>
    </head><body>${reportHTML(summary)}</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const file = new File([blob], `Reporte-${summary.start}.html`, { type: "text/html" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Reporte", files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function renderCompanySelect() {
  const select = document.getElementById("companySelect");
  const companies = sortedCompanies();
  select.innerHTML = `<option value="">Selecciona una empresa</option>` + companies.map((c) => `
    <option value="${c.id}" ${c.id === state.selectedCompanyId ? "selected" : ""}>${escapeHtml(c.name)}</option>
  `).join("");
}

function renderServiceChips() {
  const selected = new Set(state.selectedServiceIds);
  document.getElementById("serviceChips").innerHTML = sortedServices().map((s) => `
    <div class="service-chip">
      <button type="button" class="chip ${selected.has(s.id) ? "active" : ""}" data-service-toggle="${s.id}">
        ${escapeHtml(s.name)}
      </button>
      <button type="button" class="chip-edit" data-edit-service="${s.id}" aria-label="Editar ${escapeHtml(s.name)}">✎</button>
    </div>
  `).join("") || `<p class="muted">Crea el primer servicio con + Nuevo.</p>`;
}

function jobDateLabel(iso) {
  return formatDate(parseISO(iso), { day: "numeric", month: "short" });
}

function collectFormReminders(previous = []) {
  const prevByKey = new Map(
    previous.map((item) => [`${item.kind}:${item.kind === "custom" ? item.customAt : item.time}`, item])
  );
  const reminders = [];
  for (const kind of ["sameDay", "dayBefore", "twoDaysBefore"]) {
    if (!state.reminderKinds.has(kind)) continue;
    const next = {
      id: uid(),
      kind,
      time: state.reminderTime || AgendaReminders.DEFAULT_TIME,
      customAt: "",
      notifiedAt: null,
    };
    const prev = previous.find((item) => item.kind === kind)
      || prevByKey.get(`${kind}:${next.time}`);
    if (prev) {
      next.id = prev.id;
      const sameTime = (prev.time || AgendaReminders.DEFAULT_TIME) === next.time;
      next.notifiedAt = sameTime ? prev.notifiedAt : null;
    }
    reminders.push(next);
  }
  if (state.reminderKinds.has("custom")) {
    for (const custom of state.customReminders) {
      if (!custom.at) continue;
      const prev = previous.find((item) => item.id === custom.id)
        || previous.find((item) => item.kind === "custom" && item.customAt === custom.at);
      reminders.push({
        id: custom.id || prev?.id || uid(),
        kind: "custom",
        time: "",
        customAt: custom.at,
        notifiedAt: prev && prev.customAt === custom.at ? prev.notifiedAt : null,
      });
    }
  }
  return AgendaReminders.normalizeReminders(reminders);
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function reminderHintText() {
  if (isIOSDevice()) {
    return "En iPhone, Safari suele notificar si instalas Agenda AV en Inicio y la tienes en uso. Si la cierras, el aviso se muestra al volver a abrir la app.";
  }
  return "El navegador no tiene alarmas persistentes. El aviso llega si la app está abierta o al abrirla. En el teléfono, «Añadir a pantalla de inicio» ayuda.";
}

function notificationsSupported() {
  return typeof Notification !== "undefined";
}

function updateReminderPermissionNote() {
  const note = document.getElementById("reminderPermissionNote");
  if (!note) return;
  const hasReminders = state.reminderKinds.size > 0;
  if (!hasReminders) {
    note.classList.add("hidden");
    note.textContent = "";
    return;
  }
  if (!notificationsSupported()) {
    note.textContent = "Este navegador no admite notificaciones. Guardamos el recordatorio y lo mostramos al abrir la app.";
    note.classList.remove("hidden");
    return;
  }
  if (Notification.permission === "denied") {
    note.textContent = "Sin permiso no llegan avisos del sistema. Puedes activarlo en Ajustes del navegador; el trabajo se guarda igual.";
    note.classList.remove("hidden");
    return;
  }
  if (Notification.permission === "granted") {
    note.classList.add("hidden");
    note.textContent = "";
    return;
  }
  note.textContent = "Al guardar te pediremos permiso para avisarte. Si lo niegas, el trabajo se guarda igual.";
  note.classList.remove("hidden");
}

async function ensureNotificationPermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch (_) {
    return Notification.permission;
  }
}

function renderReminderEditor() {
  const hint = document.getElementById("reminderHint");
  if (hint) hint.textContent = reminderHintText();
  document.querySelectorAll("[data-reminder-kind]").forEach((btn) => {
    btn.classList.toggle("active", state.reminderKinds.has(btn.dataset.reminderKind));
  });
  const timeWrap = document.getElementById("reminderTimeWrap");
  const hasRelative = ["sameDay", "dayBefore", "twoDaysBefore"].some((kind) => state.reminderKinds.has(kind));
  timeWrap.classList.toggle("hidden", !hasRelative);
  document.getElementById("reminderTime").value = state.reminderTime || AgendaReminders.DEFAULT_TIME;
  const customWrap = document.getElementById("customReminders");
  const showCustom = state.reminderKinds.has("custom");
  customWrap.classList.toggle("hidden", !showCustom);
  if (showCustom) {
    customWrap.innerHTML = state.customReminders.map((item, index) => `
      <div class="custom-reminder-row">
        <input type="datetime-local" data-custom-reminder="${item.id}" value="${item.at || ""}" />
        <button type="button" class="text-btn" data-remove-custom="${item.id}">Quitar</button>
      </div>
      ${index === state.customReminders.length - 1 ? `<button type="button" class="text-btn" id="addCustomReminder">+ Otra fecha y hora</button>` : ""}
    `).join("") || `<button type="button" class="text-btn" id="addCustomReminder">+ Fecha y hora</button>`;
  } else {
    customWrap.innerHTML = "";
  }
  updateReminderPermissionNote();
}

function defaultCustomAt(form) {
  const start = form?.startDate?.value || state.selected;
  const time = state.reminderTime || AgendaReminders.DEFAULT_TIME;
  return `${start}T${time}`;
}

function addCustomReminder() {
  const form = document.getElementById("eventForm");
  state.customReminders.push({ id: uid(), at: defaultCustomAt(form) });
  renderReminderEditor();
}

function loadRemindersIntoForm(event) {
  const reminders = AgendaReminders.normalizeReminders(event?.reminders);
  state.reminderKinds = new Set(reminders.map((item) => item.kind));
  const relative = reminders.find((item) => item.kind !== "custom");
  state.reminderTime = relative?.time || AgendaReminders.DEFAULT_TIME;
  state.customReminders = reminders
    .filter((item) => item.kind === "custom")
    .map((item) => ({ id: item.id, at: item.customAt }));
  renderReminderEditor();
}

function notificationTitleFor(event) {
  const company = companyById(event.companyId)?.name || "Trabajo";
  return AgendaReminders.reminderTitle({
    company,
    services: eventReportLabel(event),
    dateText: jobDateLabel(event.startDate),
  });
}

async function showSystemNotification(title, body, tag) {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const ready = navigator.serviceWorker?.ready;
    const reg = ready ? await Promise.race([
      ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 800)),
    ]) : null;
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, tag, lang: "es", renotify: true });
      return true;
    }
  } catch (_) { /* fallback below */ }
  try {
    new Notification(title, { body, tag });
    return true;
  } catch (_) {
    return false;
  }
}

function showReminderToast(text) {
  const toast = document.getElementById("reminderToast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showReminderToast._t);
  showReminderToast._t = setTimeout(() => toast.classList.add("hidden"), 6000);
}

async function checkReminders(now = new Date()) {
  let changed = false;
  const dueMessages = [];
  for (const event of state.events) {
    const reminders = AgendaReminders.normalizeReminders(event.reminders);
    if (!reminders.length) continue;
    let eventChanged = false;
    for (const reminder of reminders) {
      const fireAt = AgendaReminders.reminderFireDate(event.startDate, reminder);
      const status = AgendaReminders.fireStatus(fireAt, now, reminder.notifiedAt);
      if (status === "stale") {
        reminder.notifiedAt = now.toISOString();
        eventChanged = true;
        continue;
      }
      if (status !== "due") continue;
      const title = notificationTitleFor(event);
      const body = AgendaReminders.reminderBody(reminder.kind);
      const shown = await showSystemNotification(title, body, `agenda-${event.id}-${reminder.id}`);
      reminder.notifiedAt = now.toISOString();
      eventChanged = true;
      if (!shown) dueMessages.push(title);
    }
    if (eventChanged) {
      event.reminders = reminders;
      changed = true;
    }
  }
  if (changed) persist();
  if (dueMessages.length) showReminderToast(`Recordatorio: ${dueMessages[0]}`);
}

function startReminderWatch() {
  checkReminders();
  setInterval(() => {
    if (document.visibilityState === "visible") checkReminders();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkReminders();
  });
}

function registerReminderWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function openEventForm(eventId) {
  const form = document.getElementById("eventForm");
  const event = state.events.find((e) => e.id === eventId);
  state.editingId = eventId || null;
  state.paymentStatus = event?.paymentStatus || "pending";
  state.selectedCompanyId = event?.companyId || "";
  state.selectedServiceIds = event
    ? eventServices(event).map((name) => rememberService(name)?.id).filter(Boolean)
    : [];
  form.startDate.value = event?.startDate || state.selected;
  form.endDate.value = event?.endDate || state.selected;
  form.amount.value = event
    ? formatAmountInput(event.amount)
    : (state.lastAmount ? formatAmountInput(state.lastAmount) : "");
  form.activityName.value = event?.activityName || "";
  form.notes.value = event?.notes || "";
  document.getElementById("formTitle").textContent = event ? "Editar trabajo" : "Nuevo trabajo";
  document.getElementById("deleteEvent").classList.toggle("hidden", !event);
  document.getElementById("formError").classList.add("hidden");
  document.querySelectorAll(".pay-btn").forEach((b) => b.classList.toggle("active", b.dataset.status === state.paymentStatus));
  renderCompanySelect();
  renderServiceChips();
  loadRemindersIntoForm(event);
  updateAmountHint();
  document.getElementById("overlay").classList.remove("hidden");
}

function closeEventForm() {
  document.getElementById("overlay").classList.add("hidden");
}

function openServiceForm(id) {
  state.editingServiceId = id || null;
  const service = serviceById(id);
  const form = document.getElementById("serviceForm");
  const error = document.getElementById("serviceFormError");
  form.name.value = service?.name || "";
  document.getElementById("serviceFormTitle").textContent = service ? "Editar servicio" : "Nuevo servicio";
  document.getElementById("serviceFormHint").textContent = service
    ? "Cambia el nombre o quítalo de la lista. Los trabajos ya agendados conservan lo que tenían."
    : "Queda guardado en la lista para agendarlo más rápido la próxima vez.";
  document.getElementById("deleteService").classList.toggle("hidden", !service);
  error.classList.add("hidden");
  error.textContent = "";
  document.getElementById("serviceOverlay").classList.remove("hidden");
}

function closeServiceForm() {
  document.getElementById("serviceOverlay").classList.add("hidden");
  state.editingServiceId = null;
}

function deleteSavedService() {
  const service = serviceById(state.editingServiceId);
  if (!service) return;
  if (!confirm(`¿Quitar "${service.name}" de la lista?\n\nLos trabajos ya agendados no se borran.`)) return;
  state.selectedServiceIds = state.selectedServiceIds.filter((id) => id !== service.id);
  state.services = state.services.filter((item) => item.id !== service.id);
  persist();
  closeServiceForm();
  renderServiceChips();
}

function openCompanyForm(id) {
  state.editingCompanyId = id || null;
  const company = companyById(id);
  const form = document.getElementById("companyForm");
  form.name.value = company?.name || "";
  form.color.value = company?.color || PALETTE[state.companies.length % PALETTE.length];
  document.getElementById("companyFormTitle").textContent = company ? "Editar empresa" : "Nueva empresa";
  document.getElementById("companyOverlay").classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setTab(tab) {
  state.tab = tab;
  document.querySelector(".phone").dataset.tab = tab;
  document.getElementById("agendaScreen").classList.toggle("hidden", tab !== "agenda");
  document.getElementById("reportsScreen").classList.toggle("hidden", tab !== "reports");
  document.getElementById("screenTitle").textContent = tab === "agenda" ? "Agenda" : "Reportes";
  document.getElementById("headerAction").classList.toggle("hidden", tab !== "agenda");
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "reports") renderReports();
}

function render() {
  renderCalendar();
  renderDayPanel();
  if (state.tab === "reports") renderReports();
}

document.addEventListener("click", (event) => {
  const previewCompany = event.target.closest("[data-preview-company]");
  if (previewCompany) {
    openInvoice(previewCompany.dataset.previewCompany);
    return;
  }
  const invoiceBtn = event.target.closest("[data-invoice]");
  if (invoiceBtn) {
    shareCompanyInvoice(invoiceBtn.dataset.invoice).catch(() => {
      state.activeInvoiceId = invoiceBtn.dataset.invoice;
      printCurrentInvoice();
    });
    return;
  }
  const printCompany = event.target.closest("[data-print-company]");
  if (printCompany) {
    state.previewMode = "company";
    state.activeInvoiceId = printCompany.dataset.printCompany;
    printCurrentInvoice();
    return;
  }
  const payCompany = event.target.closest("[data-pay-company]");
  if (payCompany) {
    markCompanyPaid(payCompany.dataset.payCompany);
    return;
  }
  const day = event.target.closest("[data-day]");
  if (day) {
    state.selected = day.dataset.day;
    render();
    return;
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    openEventForm(edit.dataset.edit);
    return;
  }
  const editService = event.target.closest("[data-edit-service]");
  if (editService) {
    openServiceForm(editService.dataset.editService);
    return;
  }
  const chip = event.target.closest("[data-service-toggle]");
  if (chip) {
    const id = chip.dataset.serviceToggle;
    if (state.selectedServiceIds.includes(id)) {
      state.selectedServiceIds = state.selectedServiceIds.filter((item) => item !== id);
    } else {
      state.selectedServiceIds.push(id);
    }
    renderServiceChips();
    return;
  }
  const reminderKind = event.target.closest("[data-reminder-kind]");
  if (reminderKind) {
    const kind = reminderKind.dataset.reminderKind;
    if (state.reminderKinds.has(kind)) {
      state.reminderKinds.delete(kind);
      if (kind === "custom") state.customReminders = [];
    } else {
      state.reminderKinds.add(kind);
      if (kind === "custom" && !state.customReminders.length) addCustomReminder();
      ensureNotificationPermission().then(updateReminderPermissionNote);
    }
    renderReminderEditor();
    return;
  }
  if (event.target.id === "addCustomReminder") {
    addCustomReminder();
    return;
  }
  const removeCustom = event.target.closest("[data-remove-custom]");
  if (removeCustom) {
    state.customReminders = state.customReminders.filter((item) => item.id !== removeCustom.dataset.removeCustom);
    if (!state.customReminders.length) state.reminderKinds.delete("custom");
    renderReminderEditor();
    return;
  }
  const company = event.target.closest("[data-company]");
  if (company) {
    state.selectedCompanyId = company.dataset.company;
    renderCompanySelect();
  }
});

document.getElementById("prevMonth").onclick = () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
  state.selected = toISODate(state.month);
  render();
};
document.getElementById("nextMonth").onclick = () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
  state.selected = toISODate(state.month);
  render();
};
document.getElementById("headerAction").onclick = () => openEventForm();
document.getElementById("cancelForm").onclick = closeEventForm;
document.getElementById("newCompanyBtn").onclick = () => openCompanyForm();
document.getElementById("newServiceBtn").onclick = () => openServiceForm();
document.getElementById("cancelService").onclick = closeServiceForm;
document.getElementById("deleteService").onclick = deleteSavedService;
document.getElementById("companySelect").onchange = (event) => {
  state.selectedCompanyId = event.target.value || null;
};
document.getElementById("cancelCompany").onclick = () => document.getElementById("companyOverlay").classList.add("hidden");
document.getElementById("printPdf").onclick = printReport;
document.getElementById("sharePdf").onclick = () => shareReport().catch(() => printReport());
document.getElementById("previewPdf").onclick = openReportPreview;
document.getElementById("printInvoice").onclick = printCurrentInvoice;
document.getElementById("sendInvoice").onclick = () => sendCurrentInvoice().catch(() => printCurrentInvoice());
document.getElementById("closeInvoice").onclick = closeInvoice;
document.getElementById("invoiceProfileCard").addEventListener("input", () => {
  saveProfile({
    name: document.getElementById("profileName")?.value.trim() || "",
    phone: document.getElementById("profilePhone")?.value.trim() || "",
    payment: document.getElementById("profilePayment")?.value.trim() || "",
  });
  applyUserName();
});

document.getElementById("dayPanel").addEventListener("click", (event) => {
  if (event.target.id === "addFromDay") openEventForm();
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = () => setTab(btn.dataset.tab);
});

document.querySelectorAll(".pay-btn").forEach((btn) => {
  btn.onclick = () => {
    state.paymentStatus = btn.dataset.status;
    document.querySelectorAll(".pay-btn").forEach((b) => b.classList.toggle("active", b === btn));
  };
});

document.getElementById("kindPicker").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-kind]");
  if (!btn) return;
  state.report.kind = btn.dataset.kind;
  document.querySelectorAll("#kindPicker button").forEach((b) => b.classList.toggle("active", b === btn));
  renderReports();
});

document.getElementById("periodControls").addEventListener("click", (event) => {
  if (event.target.id === "prevReportMonth") {
    state.report.month = new Date(state.report.month.getFullYear(), state.report.month.getMonth() - 1, 1);
    renderReports();
  }
  if (event.target.id === "nextReportMonth") {
    state.report.month = new Date(state.report.month.getFullYear(), state.report.month.getMonth() + 1, 1);
    renderReports();
  }
  if (event.target.id === "prevReportYear") {
    state.report.month = new Date(state.report.month.getFullYear() - 1, 0, 1);
    renderReports();
  }
  if (event.target.id === "nextReportYear") {
    state.report.month = new Date(state.report.month.getFullYear() + 1, 0, 1);
    renderReports();
  }
});
document.getElementById("monthlyBreakdown").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-open-month]");
  if (!btn) return;
  state.report.kind = "monthly";
  state.report.month = startOfMonth(parseISO(btn.dataset.openMonth));
  document.querySelectorAll("#kindPicker button").forEach((b) => {
    b.classList.toggle("active", b.dataset.kind === "monthly");
  });
  renderReports();
});
document.getElementById("periodControls").addEventListener("change", (event) => {
  if (event.target.id === "biweeklyMode") state.report.biweekly = event.target.value;
  if (event.target.id === "rollingStart") state.report.customStart = event.target.value;
  if (event.target.id === "customStart") state.report.customStart = event.target.value;
  if (event.target.id === "customEnd") state.report.customEnd = event.target.value;
  renderReports();
});

document.getElementById("eventForm").addEventListener("input", (event) => {
  if (["startDate", "endDate", "amount"].includes(event.target.name)) {
    updateAmountHint();
  }
  if (event.target.id === "reminderTime") {
    state.reminderTime = event.target.value || AgendaReminders.DEFAULT_TIME;
  }
  const custom = event.target.closest("[data-custom-reminder]");
  if (custom) {
    const found = state.customReminders.find((item) => item.id === custom.dataset.customReminder);
    if (found) found.at = custom.value;
  }
});
document.getElementById("eventForm").addEventListener("change", (event) => {
  if (["startDate", "endDate"].includes(event.target.name)) {
    updateAmountHint();
  }
});

document.getElementById("eventForm").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("formError");
  if (!state.selectedServiceIds.length) {
    error.textContent = "Selecciona uno o más servicios.";
    error.classList.remove("hidden");
    return;
  }
  if (!state.selectedCompanyId) {
    error.textContent = "Selecciona o crea la empresa contratante.";
    error.classList.remove("hidden");
    return;
  }
  const names = state.selectedServiceIds.map((id) => serviceById(id)?.name).filter(Boolean);
  if (!names.length) {
    error.textContent = "Selecciona uno o más servicios.";
    error.classList.remove("hidden");
    return;
  }
  const startDate = form.startDate.value;
  const endDate = form.endDate.value < startDate ? startDate : form.endDate.value;
  const previous = state.events.find((e) => e.id === state.editingId);
  const reminders = collectFormReminders(previous?.reminders || []);
  let deniedNotice = false;
  if (reminders.length) {
    const permission = await ensureNotificationPermission();
    updateReminderPermissionNote();
    deniedNotice = permission === "denied";
  }
  const payload = {
    id: state.editingId || uid(),
    startDate,
    endDate,
    serviceIds: [...state.selectedServiceIds],
    projectName: names.join(", "),
    activityName: form.activityName.value.trim(),
    amount: parseAmount(form.amount.value),
    paymentStatus: state.paymentStatus,
    notes: form.notes.value.trim(),
    companyId: state.selectedCompanyId,
    reminders,
  };
  if (state.editingId) {
    state.events = state.events.map((e) => (e.id === state.editingId ? payload : e));
  } else {
    state.events.push(payload);
  }
  if (payload.amount > 0) state.lastAmount = payload.amount;
  persist();
  closeEventForm();
  render();
  if (deniedNotice) {
    showReminderToast("Guardado. Sin permiso no llegan avisos del sistema; al abrir la app sí verás el recordatorio.");
  }
  checkReminders();
};

document.getElementById("deleteEvent").onclick = () => {
  if (!state.editingId) return;
  if (!confirm("¿Eliminar este trabajo?")) return;
  state.events = state.events.filter((e) => e.id !== state.editingId);
  persist();
  closeEventForm();
  render();
};

document.getElementById("companyForm").onsubmit = (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.name.value.trim();
  if (!name) return;
  if (state.editingCompanyId) {
    state.companies = state.companies.map((c) => c.id === state.editingCompanyId ? { ...c, name, color: form.color.value } : c);
  } else {
    const created = { id: uid(), name, color: form.color.value };
    state.companies.push(created);
    state.selectedCompanyId = created.id;
  }
  persist();
  document.getElementById("companyOverlay").classList.add("hidden");
  renderCompanySelect();
  render();
};

document.getElementById("serviceForm").onsubmit = (event) => {
  event.preventDefault();
  const name = event.currentTarget.name.value.trim();
  const error = document.getElementById("serviceFormError");
  if (!name) return;
  const duplicate = state.services.find((item) =>
    item.name.toLowerCase() === name.toLowerCase() && item.id !== state.editingServiceId
  );
  if (duplicate) {
    error.textContent = "Ya hay un servicio con ese nombre.";
    error.classList.remove("hidden");
    return;
  }
  if (state.editingServiceId) {
    const current = serviceById(state.editingServiceId);
    if (current) current.name = name;
  } else {
    const created = rememberService(name);
    if (!state.selectedServiceIds.includes(created.id)) {
      state.selectedServiceIds.push(created.id);
    }
  }
  persist();
  closeServiceForm();
  renderServiceChips();
};

document.getElementById("setupForm").onsubmit = (event) => {
  event.preventDefault();
  const name = event.currentTarget.displayName.value.trim();
  if (!name) return;
  saveProfile({ ...loadProfile(), name });
  document.getElementById("setupOverlay").classList.add("hidden");
  applyUserName();
};

load();
document.querySelector(".phone").dataset.tab = "agenda";
applyUserName();
showSetupIfNeeded();
registerReminderWorker();
render();
startReminderWatch();
