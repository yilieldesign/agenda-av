/** Conecta Google Calendar (solo lectura) y trae eventos al abrir o sincronizar. */
const AgendaGoogle = {
  STORE_KEY: "agenda-av-google-v1",
  SCOPE: "https://www.googleapis.com/auth/calendar.readonly",
  CLIENT_ID: "",

  load() {
    try {
      return Object.assign(
        { clientId: "", accessToken: "", expiresAt: 0, granted: false, lastSync: "", email: "" },
        JSON.parse(localStorage.getItem(this.STORE_KEY) || "{}")
      );
    } catch {
      return { clientId: "", accessToken: "", expiresAt: 0, granted: false, lastSync: "", email: "" };
    }
  },

  save(data) {
    localStorage.setItem(this.STORE_KEY, JSON.stringify(data));
  },

  clear() {
    localStorage.removeItem(this.STORE_KEY);
  },

  clientId() {
    const stored = this.load().clientId;
    return String(stored || this.CLIENT_ID || "").trim();
  },

  isTokenFresh() {
    const data = this.load();
    return Boolean(data.accessToken) && Number(data.expiresAt) > Date.now() + 15000;
  },

  isConnected() {
    return Boolean(this.load().granted && this.clientId());
  },

  needsRedirect() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  },

  redirectUri() {
    const url = new URL(window.location.href);
    const path = url.pathname.endsWith("/") || /\.html$/i.test(url.pathname)
      ? url.pathname
      : `${url.pathname}/`;
    return `${url.origin}${path}`;
  },

  explainError(err) {
    const raw = String(err?.error_description || err?.error || err?.message || err?.type || err || "");
    const lower = raw.toLowerCase();
    if (/access_denied|403|not completed the google verification|has not completed|access blocked|app is currently being tested|unverified/.test(lower)) {
      return "Google no dejó entrar ese correo. En console.cloud.google.com abre la pantalla de consentimiento, agrégalo como usuario de prueba (el Gmail exacto que estás eligiendo) y vuelve a conectar.";
    }
    if (/redirect_uri_mismatch|origin_mismatch/.test(lower)) {
      return "Esta dirección no coincide con la del ID de cliente. En Google Cloud, orígenes JavaScript: https://yilieldesign.github.io  URI de redirección: https://yilieldesign.github.io/agenda-av/";
    }
    if (/popup_failed_to_open|popup_blocked/.test(lower)) {
      return "El teléfono bloqueó la ventana de Google. Toca Conectar otra vez; se abrirá la página de Google en esta misma pestaña.";
    }
    if (/popup_closed/.test(lower)) {
      return "Se cerró la ventana de Google antes de aceptar. Toca Conectar otra vez y espera a pulsar Permitir.";
    }
    if (/idpiframe_initialization_failed|cookies/.test(lower)) {
      return "Safari está bloqueando Google. En Ajustes → Safari, permite ventanas emergentes y no bloquees cookies de accounts.google.com.";
    }
    if (raw && raw !== "[object Object]") return raw;
    return "No se pudo conectar con Google. Revisa que el correo esté como usuario de prueba y vuelve a intentar.";
  },

  consumeRedirect() {
    const fromHash = new URLSearchParams(String(window.location.hash || "").replace(/^#/, ""));
    const fromQuery = new URLSearchParams(window.location.search);
    const error = fromHash.get("error") || fromQuery.get("error");
    const errorDesc = fromHash.get("error_description") || fromQuery.get("error_description") || "";
    const token = fromHash.get("access_token");
    const state = fromHash.get("state") || fromQuery.get("state");
    if (!error && !token) return null;
    if (state && state !== "agenda-google") return null;
    const clean = new URL(window.location.href);
    clean.hash = "";
    clean.searchParams.delete("error");
    clean.searchParams.delete("error_description");
    clean.searchParams.delete("state");
    history.replaceState(null, "", `${clean.pathname}${clean.search}`);
    if (error) {
      let desc = errorDesc;
      try { desc = decodeURIComponent(errorDesc.replace(/\+/g, " ")); } catch (_) { /* keep raw */ }
      throw new Error(this.explainError({ message: `${error} ${desc}` }));
    }
    if (!token) return null;
    const data = this.load();
    data.accessToken = token;
    data.expiresAt = Date.now() + (Number(fromHash.get("expires_in")) || 3600) * 1000;
    data.granted = true;
    this.save(data);
    return "token";
  },

  startRedirect(prompt) {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      response_type: "token",
      scope: this.SCOPE,
      include_granted_scopes: "true",
      prompt: prompt || "consent",
      state: "agenda-google",
    });
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  },

  async ensureScript() {
    if (window.google?.accounts?.oauth2) return;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-google-gis]");
      if (existing) {
        if (window.google?.accounts?.oauth2) return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google.")));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.googleGis = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar Google."));
      document.head.appendChild(script);
    });
  },

  requestToken(prompt) {
    const clientId = this.clientId();
    if (!clientId) {
      return Promise.reject(new Error("Falta el ID de cliente de Google."));
    }
    if (this.needsRedirect()) {
      this.startRedirect(prompt || "consent");
      return new Promise(() => {});
    }
    return this.ensureScript().then(() => new Promise((resolve, reject) => {
      const fail = (err) => reject(new Error(this.explainError(err)));
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPE,
        callback: (resp) => {
          if (resp?.error) {
            fail(resp);
            return;
          }
          if (!resp?.access_token) {
            fail({ message: "popup_failed_to_open" });
            return;
          }
          const data = this.load();
          data.accessToken = resp.access_token;
          data.expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
          data.granted = true;
          this.save(data);
          resolve(resp.access_token);
        },
        error_callback: (err) => {
          const type = String(err?.type || err?.message || "");
          if (type === "popup_failed_to_open") {
            this.startRedirect(prompt || "consent");
            return;
          }
          fail(err);
        },
      });
      client.requestAccessToken({ prompt: prompt || "" });
    }));
  },

  async token() {
    if (this.isTokenFresh()) return this.load().accessToken;
    return this.requestToken(this.load().granted ? "" : "consent");
  },

  async connect() {
    await this.requestToken("consent");
    return this.sync();
  },

  disconnect() {
    const data = this.load();
    if (data.accessToken && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(data.accessToken, () => {});
    }
    const clientId = data.clientId;
    this.clear();
    if (clientId) this.save({ ...this.load(), clientId });
  },

  async apiGet(path, token) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      const data = this.load();
      data.accessToken = "";
      data.expiresAt = 0;
      this.save(data);
      throw new Error("La sesión de Google caducó. Vuelve a sincronizar.");
    }
    if (res.status === 403) {
      throw new Error(this.explainError({ error: "access_denied" }));
    }
    if (!res.ok) throw new Error("Google no respondió bien. Inténtalo otra vez.");
    return res.json();
  },

  skipCalendar(cal) {
    const id = String(cal?.id || "");
    return /holiday@group|birthday#|contacts@group/i.test(id);
  },

  async listCalendarIds(token) {
    const json = await this.apiGet("users/me/calendarList?minAccessRole=reader&maxResults=50", token);
    const ids = (json.items || [])
      .filter((cal) => !this.skipCalendar(cal))
      .map((cal) => cal.id)
      .filter(Boolean);
    return ids.length ? ids : ["primary"];
  },

  async listEvents(token, calendarId, timeMin, timeMax) {
    const items = [];
    let page = "";
    for (let i = 0; i < 8; i += 1) {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        showDeleted: "false",
        maxResults: "250",
        timeMin,
        timeMax,
      });
      if (page) params.set("pageToken", page);
      const json = await this.apiGet(`calendars/${encodeURIComponent(calendarId)}/events?${params}`, token);
      items.push(...(json.items || []));
      page = json.nextPageToken || "";
      if (!page) break;
    }
    return items;
  },

  toItem(event) {
    if (!event || event.status === "cancelled") return null;
    const start = event.start || {};
    const end = event.end || {};
    let startDate = "";
    let endDate = "";
    let startTime = "";
    let endTime = "";
    if (start.date) {
      startDate = start.date;
      endDate = end.date ? addIsoDays(end.date, -1) : start.date;
      if (endDate < startDate) endDate = startDate;
    } else if (start.dateTime) {
      const s = new Date(start.dateTime);
      const e = new Date(end.dateTime || start.dateTime);
      if (Number.isNaN(s.getTime())) return null;
      startDate = toLocalIsoDate(s);
      startTime = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
      endDate = toLocalIsoDate(e);
      endTime = `${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
      if (endTime === "00:00" && endDate > startDate) {
        endDate = addIsoDays(endDate, -1);
        endTime = "";
      }
    } else {
      return null;
    }
    const title = String(event.summary || "Trabajo importado").trim();
    const notes = [event.location, event.description].filter(Boolean).join("\n").slice(0, 500);
    return {
      uid: `google:${event.id}:${startDate}:${startTime}`,
      title: title || "Trabajo importado",
      notes,
      startDate,
      endDate,
      startTime,
      endTime,
    };
  },

  async sync() {
    const token = await this.token();
    const now = new Date();
    const timeMin = new Date(now.getTime() - 400 * 86400000).toISOString();
    const timeMax = new Date(now.getTime() + 548 * 86400000).toISOString();
    const calendarIds = await this.listCalendarIds(token);
    const items = [];
    const seen = new Set();
    for (const calendarId of calendarIds) {
      const events = await this.listEvents(token, calendarId, timeMin, timeMax);
      for (const event of events) {
        const item = this.toItem(event);
        if (!item || seen.has(item.uid)) continue;
        seen.add(item.uid);
        items.push(item);
        if (items.length >= 400) break;
      }
      if (items.length >= 400) break;
    }
    const data = this.load();
    data.lastSync = new Date().toISOString();
    this.save(data);
    return items;
  },

  async syncIfFresh() {
    if (!this.isConnected() || !this.isTokenFresh()) return [];
    return this.sync();
  },
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addIsoDays(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}
