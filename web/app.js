const STORAGE_KEY = "agenda-av-web-v2";
const PROFILE_KEY = "agenda-av-profile-v1";
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
  activeInvoiceId: null,
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

function currencyCode() {
  const region = (localeTag().split("-")[1] || "DO").toUpperCase();
  return { DO: "DOP", MX: "MXN", CL: "CLP", AR: "ARS", CO: "COP", PE: "PEN", US: "USD" }[region] || "DOP";
}

function money(amount) {
  return new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: currencyCode(),
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
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
  const rate = Number(form.amount.value) || 0;
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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const data = JSON.parse(raw);
    state.companies = data.companies || [];
    state.events = data.events || [];
    state.services = data.services || [];
  } else {
    seed();
  }
  ensureCatalog();
  pruneUnusedCatalog();
  sortCatalog();
  persist();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    companies: state.companies,
    events: state.events,
    services: state.services,
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
  REAL_SERVICES.forEach((wanted) => {
    const existing = state.services.find((s) =>
      s.id === wanted.id || s.name.toLowerCase() === wanted.name.toLowerCase()
    );
    if (existing) {
      existing.name = wanted.name;
    } else {
      state.services.push({ ...wanted });
    }
  });
  state.events.forEach((event) => {
    eventServices(event).forEach((name) => rememberService(name));
  });
}

function pruneUnusedCatalog() {
  const usedCompanyIds = new Set(state.events.map((event) => event.companyId));
  state.companies = state.companies.filter((company) => {
    const isReal = REAL_COMPANIES.some((item) => item.id === company.id || item.name.toLowerCase() === company.name.toLowerCase());
    return isReal || usedCompanyIds.has(company.id);
  });

  const realServiceNames = new Set(REAL_SERVICES.map((item) => item.name.toLowerCase()));
  const usedServiceIds = new Set(state.events.flatMap((event) => event.serviceIds || []));
  const usedServiceNames = new Set(state.events.flatMap((event) => eventServices(event).map((name) => name.toLowerCase())));
  state.services = state.services.filter((service) => {
    if (realServiceNames.has(service.name.toLowerCase())) return true;
    return usedServiceIds.has(service.id) || usedServiceNames.has(service.name.toLowerCase());
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

function eventTitle(event) {
  const names = eventServices(event);
  return names.length ? names.join(", ") : (event.projectName || "Trabajo");
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
          <div class="muted">${escapeHtml(company?.name || "Sin empresa")}</div>
          ${range}
          <span class="badge ${event.paymentStatus}">${event.paymentStatus === "paid" ? "Pagado" : "Pendiente"}</span>
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
  if (r.kind === "biweekly") {
    if (r.biweekly === "firstHalf") return { start: startMonth, end: addDays(startMonth, 14) };
    if (r.biweekly === "secondHalf") return { start: addDays(startMonth, 15), end: endMonth };
    return { start: r.customStart, end: addDays(r.customStart, 14) };
  }
  const a = r.customStart < r.customEnd ? r.customStart : r.customEnd;
  const b = r.customStart < r.customEnd ? r.customEnd : r.customStart;
  return { start: a, end: b };
}

function summarize() {
  const { start, end } = reportRange();
  const events = state.events
    .filter((e) => e.startDate <= end && e.endDate >= start)
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
    byCompany[key].jobs += 1;
    byCompany[key].amount += jobTotal(event);
    if (event.paymentStatus === "pending") {
      byCompany[key].pendingAmount += jobTotal(event);
    }
    byCompany[key].events.push(event);
  }
  const paid = events.filter((e) => e.paymentStatus === "paid");
  const pending = events.filter((e) => e.paymentStatus === "pending");
  const total = events.reduce((sum, e) => sum + jobTotal(e), 0);
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
    paid: { count: paid.length, amount: paid.reduce((s, e) => s + jobTotal(e), 0) },
    pending: { count: pending.length, amount: pending.reduce((s, e) => s + jobTotal(e), 0) },
  };
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

function renderInvoiceProfile() {
  const profile = loadProfile();
  document.getElementById("invoiceProfileCard").innerHTML = `
    <h3>Tus datos en la factura</h3>
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

function companyInvoice(companyId) {
  const summary = summarize();
  const company = summary.companies.find((c) => c.id === companyId);
  if (!company) return null;
  const profile = loadProfile();
  return {
    issued: formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" }),
    fromName: profile.name || "Servicios audiovisuales freelance",
    fromPhone: profile.phone,
    paymentNote: profile.payment,
    companyName: company.name,
    period: formatRange(summary.start, summary.end),
    jobs: company.events.map((event) => ({
      date: formatJobDate(event),
      project: eventTitle(event),
      status: event.paymentStatus === "paid" ? "Pagado" : "Pendiente",
      amount: money(jobTotal(event)),
      amountRaw: jobTotal(event),
    })),
    total: money(company.amount),
    fileName: `Reporte-${(company.name || "cliente").replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/gi, "-")}.pdf`,
  };
}

function invoiceHTML(inv) {
  const rows = inv.jobs.map((job) => `
    <tr>
      <td>${escapeHtml(job.date)}</td>
      <td>${escapeHtml(job.project)}</td>
      <td>${escapeHtml(job.status)}</td>
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
      <thead><tr><th>Fecha</th><th>Trabajo</th><th>Estado</th><th>Monto</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="3">Total</th><th>${escapeHtml(inv.total)}</th></tr>
      </tfoot>
    </table>
    ${inv.paymentNote ? `<p><strong>Pago:</strong> ${escapeHtml(inv.paymentNote)}</p>` : ""}
    <p class="muted">Documento para cobro de servicios audiovisuales.</p>
  `;
}

function openInvoice(companyId) {
  const inv = companyInvoice(companyId);
  if (!inv) return;
  state.activeInvoiceId = companyId;
  document.getElementById("invoicePreview").innerHTML = `<div class="invoice-preview">${invoiceHTML(inv)}</div>`;
  document.getElementById("invoiceOverlay").classList.remove("hidden");
}

function closeInvoice() {
  document.getElementById("invoiceOverlay").classList.add("hidden");
  state.activeInvoiceId = null;
}

function printCurrentInvoice() {
  const inv = companyInvoice(state.activeInvoiceId);
  if (!inv) return;
  const root = document.getElementById("printRoot");
  root.innerHTML = invoiceHTML(inv);
  root.hidden = false;
  window.print();
}

async function sendCurrentInvoice() {
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

function renderReports() {
  const r = state.report;
  let extra = `
    <div class="month-nav">
      <button type="button" id="prevReportMonth">‹</button>
      <h2>${formatDate(r.month, { month: "long", year: "numeric" })}</h2>
      <button type="button" id="nextReportMonth">›</button>
    </div>
  `;
  if (r.kind === "biweekly") {
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
    <div class="metric"><span>Total a cobrar</span><strong>${money(summary.total)}</strong></div>
    <div class="metric"><span>Pagado</span><strong>${money(summary.paid.amount)}</strong></div>
    <div class="metric"><span>Pendiente</span><strong>${money(summary.pending.amount)}</strong></div>
  `;
  document.getElementById("companyBreakdown").innerHTML = `
    <h3>Desglose por empresa</h3>
    <p class="muted">Cada cliente muestra sus trabajos por fecha y el total a cobrar. Genera una factura PDF para enviarla y que te paguen.</p>
    ${summary.companies.length ? summary.companies.map((c) => `
      <article class="company-block-card">
        <div class="breakdown-row">
          <div>
            <span class="swatch" style="background:${c.color}"></span>
            <strong>${escapeHtml(c.name)}</strong>
            <div class="muted">${c.days.size} día${c.days.size === 1 ? "" : "s"} · ${c.jobs} trabajo${c.jobs === 1 ? "" : "s"}</div>
          </div>
          <strong>${money(c.amount)}</strong>
        </div>
        ${c.events.map((event) => `
          <div class="job-line">
            <span class="date">${escapeHtml(formatJobDate(event))}</span>
            <span>${escapeHtml(eventTitle(event))}</span>
            <strong>${money(jobTotal(event))}</strong>
          </div>
        `).join("")}
        <div class="total-line"><span>Total</span><span>${money(c.amount)}</span></div>
        <div class="pending-line"><span>Pendiente de pago</span><span>${money(c.pendingAmount)}</span></div>
        <div class="row-actions invoice-actions">
          <button type="button" class="secondary" data-print-company="${c.id}">Imprimir</button>
          <button type="button" class="primary" data-invoice="${c.id}">Factura PDF</button>
        </div>
      </article>
    `).join("") : `<p class="muted">No hay trabajos en este período.</p>`}
  `;
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
      return `<div class="breakdown-row"><div><strong>${escapeHtml(eventTitle(event))}</strong><div class="muted">${event.startDate}${event.startDate !== event.endDate ? " – " + event.endDate : ""} · ${escapeHtml(company?.name || "")}</div></div><strong>${money(jobTotal(event))}</strong></div>`;
    }).join("") || `<p class="muted">Ajusta el rango para ver resultados.</p>`}
  `;
}

function reportHTML(summary) {
  const rows = summary.events.map((event) => {
    const company = companyById(event.companyId);
    const fecha = event.startDate === event.endDate ? event.startDate : `${event.startDate} – ${event.endDate}`;
    return `<tr><td>${fecha}</td><td>${escapeHtml(company?.name || "—")}</td><td>${escapeHtml(eventTitle(event))}</td><td>${money(jobTotal(event))}</td></tr>`;
  }).join("");
  return `
    <h1>Informe de trabajos</h1>
    <p>Agenda AV · Período: ${formatRange(summary.start, summary.end)}</p>
    <p>Generado ${new Date().toLocaleString(localeTag())}</p>
    <p><strong>Trabajos:</strong> ${summary.jobCount} &nbsp; <strong>Total a cobrar:</strong> ${money(summary.total)}</p>
    <h3>Desglose por empresa</h3>
    ${summary.companies.map((c) => `<p>${escapeHtml(c.name)} · ${c.days.size} días · ${money(c.amount)}</p>`).join("")}
    <table>
      <thead><tr><th>Fecha</th><th>Empresa</th><th>Proyecto</th><th>Monto</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">Sin trabajos</td></tr>`}</tbody>
    </table>
    <p style="text-align:right;font-weight:700">TOTAL GENERAL ${money(summary.total)}</p>
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
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe Agenda AV</title>
    <style>body{font-family:Segoe UI,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left} th{background:#122027;color:#fff}</style>
    </head><body>${reportHTML(summary)}</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const file = new File([blob], `Informe-AgendaAV-${summary.start}.html`, { type: "text/html" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Informe Agenda AV", files: [file] });
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
    <button type="button" class="chip ${selected.has(s.id) ? "active" : ""}" data-service-toggle="${s.id}">
      ${escapeHtml(s.name)}
    </button>
  `).join("") || `<p class="muted">Crea el primer servicio con + Nuevo.</p>`;
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
  form.amount.value = event?.amount ?? "";
  form.notes.value = event?.notes || "";
  document.getElementById("formTitle").textContent = event ? "Editar trabajo" : "Nuevo trabajo";
  document.getElementById("deleteEvent").classList.toggle("hidden", !event);
  document.getElementById("formError").classList.add("hidden");
  document.querySelectorAll(".pay-btn").forEach((b) => b.classList.toggle("active", b.dataset.status === state.paymentStatus));
  renderCompanySelect();
  renderServiceChips();
  updateAmountHint();
  document.getElementById("overlay").classList.remove("hidden");
}

function closeEventForm() {
  document.getElementById("overlay").classList.add("hidden");
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
  const invoiceBtn = event.target.closest("[data-invoice]");
  if (invoiceBtn) {
    openInvoice(invoiceBtn.dataset.invoice);
    return;
  }
  const printCompany = event.target.closest("[data-print-company]");
  if (printCompany) {
    state.activeInvoiceId = printCompany.dataset.printCompany;
    printCurrentInvoice();
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
document.getElementById("newServiceBtn").onclick = () => {
  document.getElementById("serviceForm").name.value = "";
  document.getElementById("serviceOverlay").classList.remove("hidden");
};
document.getElementById("cancelService").onclick = () => document.getElementById("serviceOverlay").classList.add("hidden");
document.getElementById("companySelect").onchange = (event) => {
  state.selectedCompanyId = event.target.value || null;
};
document.getElementById("cancelCompany").onclick = () => document.getElementById("companyOverlay").classList.add("hidden");
document.getElementById("printPdf").onclick = printReport;
document.getElementById("sharePdf").onclick = () => shareReport().catch(() => printReport());
document.getElementById("printInvoice").onclick = printCurrentInvoice;
document.getElementById("sendInvoice").onclick = () => sendCurrentInvoice().catch(() => printCurrentInvoice());
document.getElementById("closeInvoice").onclick = closeInvoice;
document.getElementById("invoiceProfileCard").addEventListener("input", () => {
  saveProfile({
    name: document.getElementById("profileName")?.value.trim() || "",
    phone: document.getElementById("profilePhone")?.value.trim() || "",
    payment: document.getElementById("profilePayment")?.value.trim() || "",
  });
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
});
document.getElementById("eventForm").addEventListener("change", (event) => {
  if (["startDate", "endDate"].includes(event.target.name)) {
    updateAmountHint();
  }
});

document.getElementById("eventForm").onsubmit = (event) => {
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
  const payload = {
    id: state.editingId || uid(),
    startDate,
    endDate,
    serviceIds: [...state.selectedServiceIds],
    projectName: names.join(", "),
    amount: Number(form.amount.value) || 0,
    paymentStatus: state.paymentStatus,
    notes: form.notes.value.trim(),
    companyId: state.selectedCompanyId,
  };
  if (state.editingId) {
    state.events = state.events.map((e) => (e.id === state.editingId ? payload : e));
  } else {
    state.events.push(payload);
  }
  persist();
  closeEventForm();
  render();
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
  if (!name) return;
  const created = rememberService(name);
  if (!state.selectedServiceIds.includes(created.id)) {
    state.selectedServiceIds.push(created.id);
  }
  persist();
  document.getElementById("serviceOverlay").classList.add("hidden");
  renderServiceChips();
};

load();
document.querySelector(".phone").dataset.tab = "agenda";
render();
