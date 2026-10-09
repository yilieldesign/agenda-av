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
  expenses: [],
  expensePaid: {},
  budgetMonth: startOfMonth(new Date()),
  editingExpenseId: null,
  editingId: null,
  paymentStatus: "pending",
  selectedCompanyId: null,
  selectedServiceIds: [],
  editingCompanyId: null,
  editingServiceId: null,
  savedAmounts: [],
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

function formatAmountOption(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function uniqueSavedAmounts() {
  const listed = (state.savedAmounts || []).map(parseAmount);
  const fromEvents = (state.events || []).map((event) => parseAmount(event.amount));
  return [...new Set([...listed, ...fromEvents].filter((n) => n > 0))].sort((a, b) => b - a);
}

function rememberAmount(amount) {
  const n = parseAmount(amount);
  if (!(n > 0)) return;
  state.savedAmounts = [n, ...uniqueSavedAmounts().filter((item) => item !== n)];
}

function formAmountValue() {
  const select = document.getElementById("amountSelect");
  const form = document.getElementById("eventForm");
  if (select && select.value && select.value !== "__other") {
    return parseAmount(select.value);
  }
  return parseAmount(form?.amount?.value);
}

function showOtherAmount(show) {
  const wrap = document.getElementById("otherAmountWrap");
  const selectWrap = document.getElementById("amountSelectWrap");
  const amounts = uniqueSavedAmounts();
  if (selectWrap) selectWrap.classList.toggle("hidden", amounts.length === 0);
  if (wrap) wrap.classList.toggle("hidden", amounts.length > 0 && !show);
}

function renderAmountSelect(selected) {
  const select = document.getElementById("amountSelect");
  const form = document.getElementById("eventForm");
  if (!select || !form) return;
  const amounts = uniqueSavedAmounts();
  const current = selected === "" || selected == null ? "" : parseAmount(selected);
  const inList = current !== "" && amounts.includes(current);
  select.innerHTML = [
    `<option value=""></option>`,
    ...amounts.map((n) => `<option value="${n}">${formatAmountOption(n)}</option>`),
    `<option value="__other">Otro monto…</option>`,
  ].join("");
  if (current === "") {
    select.value = "";
    form.amount.value = "";
    showOtherAmount(amounts.length === 0);
  } else if (inList) {
    select.value = String(current);
    form.amount.value = formatAmountInput(current);
    showOtherAmount(false);
  } else {
    select.value = "__other";
    form.amount.value = formatAmountInput(current);
    showOtherAmount(true);
  }
}

function onAmountSelectChange() {
  const select = document.getElementById("amountSelect");
  const form = document.getElementById("eventForm");
  if (!select || !form) return;
  if (select.value === "__other") {
    form.amount.value = "";
    showOtherAmount(true);
    form.amount.focus();
  } else if (!select.value) {
    form.amount.value = "";
    showOtherAmount(false);
  } else {
    form.amount.value = formatAmountInput(select.value);
    showOtherAmount(false);
  }
  updateAmountHint();
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

function daysLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? "1 día" : `${n} días`;
}

function normalizeTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatJobHours(event) {
  const start = normalizeTime(event?.startTime);
  const end = normalizeTime(event?.endTime);
  if (start && end) return `desde ${start} - hasta ${end}`;
  if (start) return `desde ${start}`;
  if (end) return `hasta ${end}`;
  return "";
}

function jobTotal(event) {
  return (Number(event.amount) || 0) * eventDayCount(event);
}

function jobNeedsCompletion(event) {
  if (!event) return true;
  if (event.needsCompletion) return true;
  if (!event.companyId) return true;
  if (!eventServices(event).length) return true;
  return !(Number(event.amount) > 0);
}

function billableEvents() {
  return state.events.filter((event) => !jobNeedsCompletion(event));
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
  const rate = formAmountValue();
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
    state.expenses = (data.expenses || []).map(normalizeExpense).filter(Boolean);
    state.expensePaid = data.expensePaid && typeof data.expensePaid === "object" ? data.expensePaid : {};
    state.savedAmounts = (data.savedAmounts || []).map(parseAmount).filter((n) => n > 0);
    if (data.lastAmount) rememberAmount(data.lastAmount);
  } else {
    seed();
  }
  ensureCatalog();
  pruneUnusedCatalog();
  sortCatalog();
  state.events.forEach((event) => {
    event.reminders = AgendaReminders.normalizeReminders(event.reminders);
    event.activityName = event.activityName || "";
    event.startTime = normalizeTime(event.startTime);
    event.endTime = normalizeTime(event.endTime);
    event.icsUid = event.icsUid || "";
    event.amount = parseAmount(event.amount);
    if (event.needsCompletion == null && event.icsUid) {
      event.needsCompletion = jobNeedsCompletion(event);
    }
    rememberAmount(event.amount);
  });
  persist();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    companies: state.companies,
    events: state.events,
    services: state.services,
    expenses: state.expenses,
    expensePaid: state.expensePaid,
    savedAmounts: uniqueSavedAmounts(),
  }));
}

function normalizeExpense(item) {
  if (!item || typeof item !== "object") return null;
  const dueDay = Math.min(31, Math.max(1, Number(item.dueDay) || 1));
  return {
    id: item.id || uid(),
    name: String(item.name || "").trim() || "Gasto",
    amount: parseAmount(item.amount),
    dueDay,
    notes: String(item.notes || "").slice(0, 500),
  };
}

function monthKey(date) {
  const d = date instanceof Date ? date : parseISO(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function expensePaidKey(expenseId, monthDate) {
  return `${monthKey(monthDate)}:${expenseId}`;
}

function isExpensePaid(expense, monthDate = state.budgetMonth) {
  return Boolean(state.expensePaid[expensePaidKey(expense.id, monthDate)]);
}

function setExpensePaid(expenseId, monthDate, paid) {
  const key = expensePaidKey(expenseId, monthDate);
  if (paid) state.expensePaid[key] = true;
  else delete state.expensePaid[key];
}

function expenseDueDate(expense, monthDate = state.budgetMonth) {
  const last = endOfMonth(monthDate).getDate();
  const day = Math.min(Math.max(Number(expense.dueDay) || 1, 1), last);
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
}

function sortedExpenses() {
  return [...state.expenses].sort((a, b) => {
    const day = (a.dueDay || 1) - (b.dueDay || 1);
    if (day) return day;
    return a.name.localeCompare(b.name, localeTag());
  });
}

function budgetJobSummary(monthDate = state.budgetMonth) {
  return summarizeRange(toISODate(startOfMonth(monthDate)), toISODate(endOfMonth(monthDate)));
}

function budgetSnapshot(monthDate = state.budgetMonth) {
  const jobs = budgetJobSummary(monthDate);
  const expenses = sortedExpenses();
  const pending = expenses.filter((item) => !isExpensePaid(item, monthDate));
  const paid = expenses.filter((item) => isExpensePaid(item, monthDate));
  const expenseTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const expensePaid = paid.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const expensePending = pending.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return {
    jobs,
    expenses,
    pending,
    paid,
    expenseTotal,
    expensePaid,
    expensePending,
    incomeTotal: jobs.total,
    incomePaid: jobs.paid.amount,
    incomePending: jobs.pending.amount,
    plannedBalance: jobs.total - expenseTotal,
    cashBalance: jobs.paid.amount - expensePaid,
  };
}

function seed() {
  state.companies = REAL_COMPANIES.map((c) => ({ ...c }));
  state.services = REAL_SERVICES.map((s) => ({ ...s }));
  state.events = [];
  state.expenses = [];
  state.expensePaid = {};
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
  if (activity && services) return `${activity} - ${services}`;
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
    .sort((a, b) => {
      const time = (normalizeTime(a.startTime) || "99:99").localeCompare(normalizeTime(b.startTime) || "99:99");
      return time !== 0 ? time : a.startDate.localeCompare(b.startDate);
    });
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
    const hours = formatJobHours(event);
    return `
      <button type="button" class="event" data-edit="${event.id}">
        <span class="bar" style="--c:${company?.color || "#6B7280"}"></span>
        <div>
          <strong>${escapeHtml(eventTitle(event))}</strong>
          ${hours ? `<div class="muted">${escapeHtml(hours)}</div>` : ""}
          ${(event.activityName || "").trim() && eventServicesLabel(event)
            ? `<div class="muted">${escapeHtml(eventServicesLabel(event))}</div>`
            : ""}
          <div class="muted">${escapeHtml(company?.name || "Sin empresa")}</div>
          ${range}
          ${jobNeedsCompletion(event)
            ? `<span class="badge incomplete">Completar</span>`
            : `<span class="badge ${event.paymentStatus}">${event.paymentStatus === "paid" ? "Pagado" : "Pendiente"}</span>`}
          ${event.reminders?.length ? `<span class="bell" title="Con recordatorio">🔔</span>` : ""}
        </div>
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
  const events = billableEvents()
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
    const started = billableEvents().filter((event) => jobStartsInRange(event, start, end));
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

function formatJobDateWithDays(event) {
  const hours = formatJobHours(event);
  return `${formatJobDate(event)} (${daysLabel(eventDayCount(event))})${hours ? ` · ${hours}` : ""}`;
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

function resetAppToFirstUse() {
  const ok = window.confirm(
    "¿Reiniciar la app como el primer uso?\n\nSe borran trabajos, gastos fijos, empresas nuevas, montos, tu nombre y todo lo guardado en este teléfono."
  );
  if (!ok) return;
  const sure = window.confirm("Esto no se puede deshacer. ¿Borrar todo?");
  if (!sure) return;
  [
    STORAGE_KEY,
    PROFILE_KEY,
    "agenda-av-google-v1",
    "agenda-av-web-v1",
    "agenda-av-web-v2",
    "agenda-av-profile-v1",
  ].forEach((key) => localStorage.removeItem(key));
  window.location.reload();
}

function icsEventKey(item) {
  return `${item.uid || item.title || "evento"}::${item.startDate}::${item.startTime || ""}`;
}

function importParsedItems(items) {
  const existing = new Set(state.events.map((event) => event.icsUid).filter(Boolean));
  let added = 0;
  let skipped = 0;
  const created = [];
  for (const item of items) {
    if (!item?.startDate) continue;
    const key = icsEventKey(item);
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    existing.add(key);
    const startDate = item.startDate;
    const endDate = item.endDate && item.endDate >= startDate ? item.endDate : startDate;
    const startTime = normalizeTime(item.startTime);
    let endTime = normalizeTime(item.endTime);
    if (startDate === endDate && startTime && endTime && endTime <= startTime) endTime = "";
    const event = {
      id: uid(),
      startDate,
      endDate,
      startTime,
      endTime,
      serviceIds: [],
      projectName: "",
      activityName: String(item.title || "Trabajo importado").slice(0, 80),
      amount: 0,
      paymentStatus: "pending",
      notes: String(item.notes || "").slice(0, 500),
      companyId: "",
      reminders: [],
      icsUid: key,
      needsCompletion: true,
    };
    state.events.push(event);
    created.push(event);
    added += 1;
  }
  if (added) persist();
  return { added, skipped, created };
}

function applyImportedItems(items, goToAgenda) {
  const result = importParsedItems(items);
  if (goToAgenda && result.created[0]) {
    state.month = startOfMonth(parseISO(result.created[0].startDate));
    state.selected = result.created[0].startDate;
    setTab("agenda");
  }
  render();
  return result;
}

async function importIcsFile(file) {
  if (!file) return;
  if (/\.zip$/i.test(file.name) || /zip/i.test(file.type || "")) {
    window.alert("Google a veces exporta un ZIP. Ábrelo y elige el archivo .ics que va dentro.");
    return;
  }
  let text = "";
  try {
    text = await file.text();
  } catch (_) {
    window.alert("No se pudo leer el archivo.");
    return;
  }
  if (!/BEGIN:VEVENT/i.test(text)) {
    window.alert("Ese archivo no parece un calendario .ics de Google.");
    return;
  }
  const items = typeof AgendaIcs !== "undefined" ? AgendaIcs.parse(text) : [];
  if (!items.length) {
    window.alert("No se encontraron eventos en el archivo.");
    return;
  }
  const { added, skipped } = applyImportedItems(items, true);
  if (added) {
    showReminderToast(`Se importaron ${added} trabajo${added === 1 ? "" : "s"}. Ábrelos y completa empresa, servicio y monto.`);
  } else if (skipped) {
    showReminderToast("Esos eventos ya estaban en la agenda.");
  }
}

function renderGoogleCard() {
  if (typeof AgendaGoogle === "undefined") return;
  const status = document.getElementById("googleStatus");
  const actions = document.getElementById("googleActions");
  const clientInput = document.getElementById("googleClientId");
  if (!status || !actions) return;
  if (clientInput && document.activeElement !== clientInput) {
    clientInput.value = AgendaGoogle.clientId();
  }
  const data = AgendaGoogle.load();
  const wrap = document.getElementById("googleClientWrap");
  if (wrap) wrap.classList.toggle("hidden", Boolean(data.granted && AgendaGoogle.clientId()));
  if (!AgendaGoogle.clientId()) {
    status.textContent = "Copia el ID desde Google Cloud y pégalo arriba.";
    actions.innerHTML = "";
    return;
  }
  if (data.granted) {
    let when = "";
    if (data.lastSync) {
      const synced = new Date(data.lastSync);
      if (!Number.isNaN(synced.getTime())) {
        when = synced.toLocaleString(localeTag(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
      }
    }
    status.textContent = when
      ? `Conectado. Última sincronización: ${when}.`
      : "Conectado. Toca Sincronizar para traer los eventos.";
    actions.innerHTML = `
      <button type="button" class="primary" id="googleSync">Sincronizar</button>
      <button type="button" class="secondary" id="googleDisconnect">Desconectar</button>
    `;
    return;
  }
  status.textContent = "Listo. Toca conectar y acepta el permiso de solo lectura.";
  actions.innerHTML = `<button type="button" class="primary" id="googleConnect">Conectar Google Calendar</button>`;
}

function saveGoogleClientId() {
  if (typeof AgendaGoogle === "undefined") return;
  const value = document.getElementById("googleClientId")?.value.trim() || "";
  const data = AgendaGoogle.load();
  data.clientId = value;
  AgendaGoogle.save(data);
  renderGoogleCard();
  showReminderToast(value ? "ID guardado. Ya puedes conectar Google." : "Se quitó el ID de cliente.");
}

async function connectGoogle() {
  if (typeof AgendaGoogle === "undefined") return;
  if (!AgendaGoogle.clientId()) {
    document.getElementById("googleClientId")?.focus();
    window.alert("Primero pega el ID de cliente arriba del calendario.");
    return;
  }
  try {
    const items = await AgendaGoogle.connect();
    const { added } = applyImportedItems(items, true);
    renderGoogleCard();
    showReminderToast(
      added
        ? `Conectado. Se importaron ${added} trabajo${added === 1 ? "" : "s"}. Ábrelos y completa empresa, servicio y monto.`
        : "Conectado. No había eventos nuevos."
    );
  } catch (err) {
    window.alert(AgendaGoogle.explainError(err));
    renderGoogleCard();
  }
}

function disconnectGoogle() {
  if (typeof AgendaGoogle === "undefined") return;
  if (!window.confirm("¿Desconectar Google Calendar?\n\nLos trabajos ya importados se quedan en la agenda.")) return;
  AgendaGoogle.disconnect();
  renderGoogleCard();
  showReminderToast("Google Calendar desconectado.");
}

async function syncGoogle(interactive) {
  if (typeof AgendaGoogle === "undefined") return;
  try {
    const items = interactive ? await AgendaGoogle.sync() : await AgendaGoogle.syncIfFresh();
    if (!interactive && !items.length) return;
    const { added, skipped } = applyImportedItems(items, interactive);
    renderGoogleCard();
    if (!interactive) {
      if (added) {
        showReminderToast(`Google: ${added} trabajo${added === 1 ? "" : "s"} nuevo${added === 1 ? "" : "s"}. Complétalos en la agenda.`);
      }
      return;
    }
    if (added) {
      showReminderToast(`Se importaron ${added} trabajo${added === 1 ? "" : "s"}. Ábrelos y completa empresa, servicio y monto.`);
    } else if (skipped) {
      showReminderToast("No hay eventos nuevos en Google.");
    } else {
      showReminderToast("No se encontraron eventos en Google Calendar.");
    }
  } catch (err) {
    if (interactive) window.alert(AgendaGoogle.explainError(err));
    renderGoogleCard();
  }
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
      <span class="date">${escapeHtml(formatJobDateWithDays(event))}</span>
      <span class="job-activity">${escapeHtml(eventReportLabel(event))}</span>
      <strong class="job-amount">${money(jobTotal(event))}</strong>
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
  const totalDays = jobs.reduce((sum, event) => sum + eventDayCount(event), 0);
  return {
    issued: formatDate(new Date(), { day: "numeric", month: "long", year: "numeric" }),
    fromName: profile.name || "Servicios audiovisuales freelance",
    fromPhone: profile.phone,
    paymentNote: profile.payment,
    companyName: company.name,
    period: formatRange(summary.start, summary.end),
    jobs: jobs.map((event) => ({
      date: formatJobDate(event),
      days: eventDayCount(event),
      daysLabel: daysLabel(eventDayCount(event)),
      project: eventReportLabel(event),
      status: "",
      amount: money(jobTotal(event)),
      amountRaw: jobTotal(event),
    })),
    totalDays,
    totalDaysLabel: daysLabel(totalDays),
    total: money(eventsAmount(jobs)),
    fileName: `Reporte-${(company.name || "cliente").replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/gi, "-")}.pdf`,
  };
}

function invoiceHTML(inv) {
  const rows = inv.jobs.map((job) => `
    <tr>
      <td>${escapeHtml(job.date)}<br><strong>${escapeHtml(job.daysLabel || daysLabel(job.days))}</strong></td>
      <td>${escapeHtml(job.daysLabel || daysLabel(job.days))}</td>
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
      <thead><tr><th>Fecha</th><th>Días</th><th>Trabajo</th><th>Monto</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th colspan="2">Total · ${escapeHtml(inv.totalDaysLabel || daysLabel(inv.totalDays))}</th><th colspan="2">${escapeHtml(inv.total)}</th></tr>
      </tfoot>
    </table>
    ${inv.paymentNote ? `<p><strong>Pago:</strong> ${escapeHtml(inv.paymentNote)}</p>` : ""}
    <p class="muted">Documento para cobro de servicios audiovisuales.</p>
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
  const pendingImport = state.events.filter(jobNeedsCompletion).length;
  const jobsIntro = pendingImport
    ? `<p class="muted">Hay ${pendingImport} trabajo${pendingImport === 1 ? "" : "s"} importado${pendingImport === 1 ? "" : "s"} por completar (empresa, servicio y monto). No salen en este reporte hasta que los completes.</p>`
    : "";
  document.getElementById("jobsList").innerHTML = `
    <h3>Trabajos del período</h3>
    ${jobsIntro}
    ${summary.events.map((event) => {
      const company = companyById(event.companyId);
      const paid = event.paymentStatus === "paid";
      const hours = formatJobHours(event);
      return `<div class="breakdown-row"><div><strong>${escapeHtml(eventReportLabel(event))}</strong><div class="muted">${event.startDate}${event.startDate !== event.endDate ? " – " + event.endDate : ""}${hours ? ` · ${escapeHtml(hours)}` : ""} · ${escapeHtml(company?.name || "")} · ${paid ? "Historial" : "Pendiente"}</div></div><strong>${money(jobTotal(event))}</strong></div>`;
    }).join("") || `<p class="muted">Ajusta el rango para ver resultados.</p>`}
  `;
  renderGoogleCard();
}

function expenseCardHTML(expense, paid) {
  const due = expenseDueDate(expense);
  const dueText = formatDate(due, { day: "numeric", month: "short" });
  return `
    <article class="expense-card" data-edit-expense="${expense.id}">
      <div class="breakdown-row">
        <div>
          <strong>${escapeHtml(expense.name)}</strong>
          <div class="muted">Día ${expense.dueDay} · ${escapeHtml(dueText)}</div>
          ${expense.notes ? `<div class="muted">${escapeHtml(expense.notes)}</div>` : ""}
        </div>
        <strong>${money(expense.amount)}</strong>
      </div>
      <span class="badge ${paid ? "paid" : "pending"}">${paid ? "Pagado" : "Pendiente"}</span>
      ${paid
        ? `<button type="button" class="expense-unpay-btn" data-unpay-expense="${expense.id}">Marcar pendiente</button>`
        : `<button type="button" class="expense-pay-btn" data-pay-expense="${expense.id}">Marcar pagado</button>`}
    </article>
  `;
}

function renderBudget() {
  const snap = budgetSnapshot();
  const monthLabel = formatDate(state.budgetMonth, { month: "long", year: "numeric" });
  document.getElementById("budgetMonthLabel").textContent = monthLabel;
  const balanceClass = snap.plannedBalance >= 0 ? "positive" : "negative";
  document.getElementById("budgetMetrics").innerHTML = `
    <div class="metric"><span>Ingresos (trabajos)</span><strong>${money(snap.incomeTotal)}</strong></div>
    <div class="metric"><span>Gastos fijos</span><strong>${money(snap.expenseTotal)}</strong></div>
    <div class="metric"><span>Pagado</span><strong>${money(snap.expensePaid)}</strong></div>
    <div class="metric"><span>Falta por pagar</span><strong>${money(snap.expensePending)}</strong></div>
    <div class="metric"><span>Balance</span><strong class="${balanceClass}">${money(snap.plannedBalance)}</strong></div>
    <div class="metric"><span>Queda (cobrado − pagado)</span><strong>${money(snap.cashBalance)}</strong></div>
  `;
  document.getElementById("budgetPending").innerHTML = `
    <h3>Falta por pagar</h3>
    <p class="muted">Gastos de ${monthLabel} que todavía no marcas como pagados.</p>
    ${snap.pending.length
      ? snap.pending.map((item) => expenseCardHTML(item, false)).join("")
      : `<p class="muted">${snap.expenses.length ? "Este mes no te falta ningún gasto fijo." : "Todavía no hay gastos fijos. Toca + o Agregar gasto fijo."}</p>`}
  `;
  const paidBox = document.getElementById("budgetPaid");
  paidBox.classList.toggle("hidden", !snap.paid.length);
  paidBox.innerHTML = snap.paid.length ? `
    <h3>Ya pagado</h3>
    <p class="muted">Estos gastos ya los marcaste como pagados este mes.</p>
    ${snap.paid.map((item) => expenseCardHTML(item, true)).join("")}
  ` : "";
}

function fillExpenseDueDay(selected) {
  const select = document.getElementById("expenseDueDay");
  const value = String(selected || 1);
  select.innerHTML = Array.from({ length: 31 }, (_, i) => {
    const day = String(i + 1);
    return `<option value="${day}" ${day === value ? "selected" : ""}>${day}</option>`;
  }).join("");
}

function openExpenseForm(expenseId) {
  const form = document.getElementById("expenseForm");
  const expense = state.expenses.find((item) => item.id === expenseId);
  state.editingExpenseId = expenseId || null;
  form.name.value = expense?.name || "";
  form.amount.value = expense ? formatAmountInput(expense.amount) : "";
  form.notes.value = expense?.notes || "";
  fillExpenseDueDay(expense?.dueDay || 1);
  document.getElementById("expenseFormTitle").textContent = expense ? "Editar gasto fijo" : "Nuevo gasto fijo";
  document.getElementById("deleteExpense").classList.toggle("hidden", !expense);
  document.getElementById("expenseFormError").classList.add("hidden");
  document.getElementById("expenseOverlay").classList.remove("hidden");
}

function closeExpenseForm() {
  document.getElementById("expenseOverlay").classList.add("hidden");
  state.editingExpenseId = null;
}

function deleteSavedExpense() {
  const expense = state.expenses.find((item) => item.id === state.editingExpenseId);
  if (!expense) return;
  if (!confirm(`¿Eliminar "${expense.name}" de los gastos fijos?\n\nDeja de salir en todos los meses.`)) return;
  const id = expense.id;
  state.expenses = state.expenses.filter((item) => item.id !== id);
  Object.keys(state.expensePaid).forEach((key) => {
    if (key.endsWith(`:${id}`)) delete state.expensePaid[key];
  });
  persist();
  closeExpenseForm();
  renderBudget();
}

function budgetHTML(snap) {
  const monthLabel = formatDate(state.budgetMonth, { month: "long", year: "numeric" });
  const row = (item, paid) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>Día ${item.dueDay}</td>
      <td>${paid ? "Pagado" : "Pendiente"}</td>
      <td>${money(item.amount)}</td>
    </tr>`;
  return `
    <h1>Presupuesto</h1>
    <p>${escapeHtml(monthLabel)}</p>
    <p>Generado ${new Date().toLocaleString(localeTag())}</p>
    <p><strong>Ingresos:</strong> ${money(snap.incomeTotal)} &nbsp; <strong>Gastos fijos:</strong> ${money(snap.expenseTotal)} &nbsp; <strong>Balance:</strong> ${money(snap.plannedBalance)}</p>
    <p><strong>Gastos pagados:</strong> ${money(snap.expensePaid)} &nbsp; <strong>Falta por pagar:</strong> ${money(snap.expensePending)}</p>
    <p><strong>Queda (cobrado − pagado):</strong> ${money(snap.cashBalance)}</p>
    <h3>Falta por pagar</h3>
    <table>
      <thead><tr><th>Gasto</th><th>Día</th><th>Estado</th><th>Monto</th></tr></thead>
      <tbody>${snap.pending.map((item) => row(item, false)).join("") || `<tr><td colspan="4">Nada pendiente</td></tr>`}</tbody>
    </table>
    <h3>Ya pagado</h3>
    <table>
      <thead><tr><th>Gasto</th><th>Día</th><th>Estado</th><th>Monto</th></tr></thead>
      <tbody>${snap.paid.map((item) => row(item, true)).join("") || `<tr><td colspan="4">Nada pagado este mes</td></tr>`}</tbody>
    </table>
  `;
}

function printBudget() {
  const snap = budgetSnapshot();
  const root = document.getElementById("printRoot");
  root.innerHTML = `${budgetHTML(snap)}<p class="pdf-footer">${APP_CREDIT}</p>`;
  root.hidden = false;
  window.print();
}

function reportHTML(summary) {
  const totalDays = summary.events.reduce((sum, event) => sum + eventDayCount(event), 0);
  const rows = summary.events.map((event) => {
    const company = companyById(event.companyId);
    const fecha = event.startDate === event.endDate
      ? event.startDate
      : `${event.startDate} – ${event.endDate}`;
    return `<tr><td>${fecha}<br><strong>${daysLabel(eventDayCount(event))}</strong></td><td>${daysLabel(eventDayCount(event))}</td><td>${escapeHtml(company?.name || "—")}</td><td>${escapeHtml(eventReportLabel(event))}</td><td>${money(jobTotal(event))}</td></tr>`;
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
    <p><strong>Trabajos:</strong> ${summary.jobCount} &nbsp; <strong>Días:</strong> ${totalDays} &nbsp; <strong>${state.report.kind === "yearly" ? "Total del año" : "Total a cobrar"}:</strong> ${money(summary.total)}</p>
    ${monthsBlock}
    <h3>Desglose por empresa</h3>
    ${summary.companies.map((c) => `<p>${escapeHtml(c.name)} · ${daysLabel(c.days.size)} · ${money(c.amount)}</p>`).join("")}
    <table>
      <thead><tr><th>Fecha</th><th>Días</th><th>Empresa</th><th>Proyecto</th><th>Monto</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">Sin trabajos</td></tr>`}</tbody>
      <tfoot>
        <tr><th colspan="2">Total · ${daysLabel(totalDays)}</th><th colspan="3">${money(summary.total)}</th></tr>
      </tfoot>
    </table>
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
    <style>
      body{font-family:Segoe UI,sans-serif;padding:24px 24px 48px}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}
      th{background:#122027;color:#fff}
      .pdf-footer{position:fixed;bottom:16px;left:0;right:0;text-align:center;font-size:10px;color:#5b6b73}
    </style>
    </head><body>${reportHTML(summary)}<p class="pdf-footer">${APP_CREDIT}</p></body></html>`;
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

function renderServiceSelect() {
  const select = document.getElementById("serviceSelect");
  const selected = state.selectedServiceIds[0] || "";
  const services = sortedServices();
  select.innerHTML = `<option value="">Selecciona un servicio</option>` + services.map((s) => `
    <option value="${s.id}" ${s.id === selected ? "selected" : ""}>${escapeHtml(s.name)}</option>
  `).join("");
  const editBtn = document.getElementById("editServiceBtn");
  if (editBtn) editBtn.disabled = !selected;
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
    if (jobNeedsCompletion(event)) continue;
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
  navigator.serviceWorker.register("./sw.js?v=presupuesto-simple").catch(() => {});
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
  form.startTime.value = event ? (normalizeTime(event.startTime) || "") : "08:00";
  form.endTime.value = event ? (normalizeTime(event.endTime) || "") : "18:00";
  renderAmountSelect(event ? event.amount : "");
  form.activityName.value = event?.activityName || "";
  form.notes.value = event?.notes || "";
  document.getElementById("formTitle").textContent = event
    ? (jobNeedsCompletion(event) ? "Completar trabajo" : "Editar trabajo")
    : "Nuevo trabajo";
  const importHint = document.getElementById("importHint");
  if (importHint) importHint.classList.toggle("hidden", !(event && jobNeedsCompletion(event)));
  document.getElementById("deleteEvent").classList.toggle("hidden", !event);
  document.getElementById("formError").classList.add("hidden");
  document.querySelectorAll(".pay-btn").forEach((b) => b.classList.toggle("active", b.dataset.status === state.paymentStatus));
  renderCompanySelect();
  renderServiceSelect();
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
  renderServiceSelect();
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
  document.getElementById("budgetScreen").classList.toggle("hidden", tab !== "budget");
  const titles = { agenda: "Agenda", reports: "Reportes", budget: "Presupuesto" };
  document.getElementById("screenTitle").textContent = titles[tab] || "Agenda";
  document.getElementById("headerAction").classList.toggle("hidden", tab === "reports");
  document.getElementById("headerAction").setAttribute(
    "aria-label",
    tab === "budget" ? "Agregar gasto fijo" : "Agendar nuevo trabajo"
  );
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "reports") renderReports();
  if (tab === "budget") renderBudget();
}

function render() {
  renderCalendar();
  renderDayPanel();
  if (state.tab === "reports") renderReports();
  if (state.tab === "budget") renderBudget();
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
document.getElementById("headerAction").onclick = () => {
  if (state.tab === "budget") openExpenseForm();
  else openEventForm();
};
document.getElementById("addExpenseFromBudget").onclick = () => openExpenseForm();
document.getElementById("cancelExpense").onclick = closeExpenseForm;
document.getElementById("deleteExpense").onclick = deleteSavedExpense;
document.getElementById("printBudget").onclick = printBudget;
document.getElementById("prevBudgetMonth").onclick = () => {
  state.budgetMonth = new Date(state.budgetMonth.getFullYear(), state.budgetMonth.getMonth() - 1, 1);
  renderBudget();
};
document.getElementById("nextBudgetMonth").onclick = () => {
  state.budgetMonth = new Date(state.budgetMonth.getFullYear(), state.budgetMonth.getMonth() + 1, 1);
  renderBudget();
};
document.getElementById("budgetScreen").addEventListener("click", (event) => {
  const pay = event.target.closest("[data-pay-expense]");
  if (pay) {
    event.preventDefault();
    event.stopPropagation();
    setExpensePaid(pay.dataset.payExpense, state.budgetMonth, true);
    persist();
    renderBudget();
    return;
  }
  const unpay = event.target.closest("[data-unpay-expense]");
  if (unpay) {
    event.preventDefault();
    event.stopPropagation();
    setExpensePaid(unpay.dataset.unpayExpense, state.budgetMonth, false);
    persist();
    renderBudget();
    return;
  }
  const edit = event.target.closest("[data-edit-expense]");
  if (edit) openExpenseForm(edit.dataset.editExpense);
});
document.getElementById("expenseForm").onsubmit = (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("expenseFormError");
  const name = form.name.value.trim();
  const amount = parseAmount(form.amount.value);
  if (!name) {
    error.textContent = "Escribe el nombre del gasto.";
    error.classList.remove("hidden");
    return;
  }
  if (!(amount > 0)) {
    error.textContent = "Escribe el monto del mes.";
    error.classList.remove("hidden");
    return;
  }
  const payload = {
    id: state.editingExpenseId || uid(),
    name,
    amount,
    dueDay: Number(form.dueDay.value) || 1,
    notes: form.notes.value.trim(),
  };
  if (state.editingExpenseId) {
    state.expenses = state.expenses.map((item) => (item.id === payload.id ? payload : item));
  } else {
    state.expenses.push(payload);
  }
  persist();
  closeExpenseForm();
  renderBudget();
};
document.getElementById("cancelForm").onclick = closeEventForm;
document.getElementById("newCompanyBtn").onclick = () => openCompanyForm();
document.getElementById("editServiceBtn").onclick = () => {
  const id = state.selectedServiceIds[0];
  if (id) openServiceForm(id);
};
document.getElementById("newServiceBtn").onclick = () => openServiceForm();
document.getElementById("serviceSelect").onchange = (event) => {
  state.selectedServiceIds = event.target.value ? [event.target.value] : [];
  renderServiceSelect();
};
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
document.getElementById("resetApp").onclick = resetAppToFirstUse;
document.getElementById("importIcs").onclick = () => document.getElementById("icsFile").click();
document.getElementById("icsFile").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  importIcsFile(file).catch(() => window.alert("No se pudo importar el calendario."));
});
document.getElementById("googleCard")?.addEventListener("click", (event) => {
  if (event.target.id === "googleConnect") connectGoogle();
  if (event.target.id === "googleSync") syncGoogle(true);
  if (event.target.id === "googleDisconnect") disconnectGoogle();
  if (event.target.id === "saveGoogleClient") saveGoogleClientId();
});
document.getElementById("goAgendaGoogle")?.addEventListener("click", () => {
  setTab("agenda");
  document.getElementById("googleCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
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
  if (event.target.id === "amountSelect") {
    onAmountSelectChange();
    return;
  }
  if (["startDate", "endDate"].includes(event.target.name)) {
    updateAmountHint();
  }
});

document.getElementById("eventForm").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById("formError");
  if (!state.selectedServiceIds.length) {
    error.textContent = "Selecciona un servicio.";
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
    error.textContent = "Selecciona un servicio.";
    error.classList.remove("hidden");
    return;
  }
  const amount = formAmountValue();
  const select = document.getElementById("amountSelect");
  const typed = String(form.amount.value || "").trim();
  if ((!select?.value || select.value === "__other") && !typed && uniqueSavedAmounts().length) {
    error.textContent = "Selecciona o escribe el monto.";
    error.classList.remove("hidden");
    return;
  }
  if (!select?.value && !typed && !uniqueSavedAmounts().length) {
    error.textContent = "Escribe el monto.";
    error.classList.remove("hidden");
    return;
  }
  const startDate = form.startDate.value;
  const endDate = form.endDate.value < startDate ? startDate : form.endDate.value;
  const startTime = normalizeTime(form.startTime.value);
  const endTime = normalizeTime(form.endTime.value);
  if (startDate === endDate && startTime && endTime && endTime <= startTime) {
    error.textContent = "La hora de fin debe ser después de la de inicio.";
    error.classList.remove("hidden");
    return;
  }
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
    startTime,
    endTime,
    serviceIds: [...state.selectedServiceIds],
    projectName: names.join(", "),
    activityName: form.activityName.value.trim(),
    amount,
    paymentStatus: state.paymentStatus,
    notes: form.notes.value.trim(),
    companyId: state.selectedCompanyId,
    reminders,
    icsUid: previous?.icsUid || "",
    needsCompletion: false,
  };
  if (state.editingId) {
    state.events = state.events.map((e) => (e.id === state.editingId ? payload : e));
  } else {
    state.events.push(payload);
  }
  rememberAmount(payload.amount);
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
    if (created) state.selectedServiceIds = [created.id];
  }
  persist();
  closeServiceForm();
  renderServiceSelect();
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
(async () => {
  try {
    const fromRedirect = typeof AgendaGoogle !== "undefined" ? AgendaGoogle.consumeRedirect() : null;
    renderGoogleCard();
    if (fromRedirect === "token") {
      const items = await AgendaGoogle.sync();
      const { added } = applyImportedItems(items, false);
      renderGoogleCard();
      showReminderToast(
        added
          ? `Conectado. Se importaron ${added} trabajo${added === 1 ? "" : "s"}. Ábrelos y completa empresa, servicio y monto.`
          : "Conectado. No había eventos nuevos."
      );
      return;
    }
  } catch (err) {
    renderGoogleCard();
    window.alert(typeof AgendaGoogle !== "undefined" ? AgendaGoogle.explainError(err) : String(err.message || err));
    return;
  }
  renderGoogleCard();
  syncGoogle(false);
})();
