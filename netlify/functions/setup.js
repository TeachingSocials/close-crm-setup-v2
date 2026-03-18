const https = require("https");

const LEAD_STATUSES = [
  "Neu", "In Bearbeitung", "Hot Lead", "Setting Gebucht",
  "Setting No-Show", "Qualifiziert", "Closing Gebucht",
  "Gewonnen", "Verloren", "Blacklist", "Bestandskunde",
  "Closing No-Show", "Nicht Erreichbar", "Onboarding No-Show"
];

const LEAD_CUSTOM_FIELDS = [
  { name: "Opener", type: "user" },
  { name: "Setter", type: "user" },
  { name: "Closer", type: "user" },
  { name: "Account Manager", type: "user" },
  { name: "Kampagnen-Kanal", type: "dropdown", choices: ["ManyChat","Instagram","Facebook","YouTube","Referral","Kalt"] },
  { name: "Registrierungs-Lead-Magnet", type: "text" },
  { name: "Letzter Lead-Magnet", type: "dropdown", choices: ["Webinar","Challenge","VSL","Freebie","Direkt"] },
  { name: "ManyChat User-ID", type: "text" },
  { name: "Trigger-Content", type: "text" },
  { name: "Webinar-Status", type: "dropdown", choices: ["Registriert","Erschienen","No-Show","Abgebrochen"] },
  { name: "Verweildauer Webinar", type: "number" },
  { name: "Setting-Termin gebucht", type: "datetime" },
  { name: "Closing-Termin gebucht", type: "datetime" },
  { name: "Onboarding-Termin gebucht", type: "datetime" },
  { name: "Termin-Status", type: "dropdown", choices: ["Gebucht","Bestaetigt","No-Show","Storniert","Erschienen"] },
  { name: "Anrufe heute", type: "number" },
  { name: "Anwahlversuche", type: "number" },
  { name: "Letzter Anrufversuch", type: "datetime" },
  { name: "Naechster Anruf moeglich ab", type: "datetime" },
  { name: "Anzahl Konvertierungen", type: "number" },
  { name: "Wiedervorlage", type: "datetime" },
  { name: "Wiedervorlage (Closer)", type: "datetime" },
  { name: "Wiedervorlage (AM)", type: "datetime" }
];

const CONTACT_CUSTOM_FIELDS = [
  { name: "Quelle", type: "text" },
  { name: "Plattform", type: "dropdown", choices: ["Instagram","Facebook","YouTube","TikTok","LinkedIn"] },
  { name: "Reel", type: "text" },
  { name: "Erstellt", type: "datetime" }
];

const SMART_VIEWS = [
  { name: "Opener - Neue Leads", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Neu}}" }},{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Opener}}" }, condition: { type: "is_empty" }}]}},
  { name: "Opener - Hot Lead Follow-Up", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Hot Lead}}" }}},
  { name: "Setter - Termine Heute", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Setting-Termin gebucht}}" }, condition: { type: "moment_range", gte: "today/d", lte: "today/d+1d" }},{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Setting Gebucht}}" }}]}},
  { name: "Setter - Follow Up & Qualifizierung", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:In Bearbeitung}}" }}},
  { name: "Closer - Termine Heute", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Closing-Termin gebucht}}" }, condition: { type: "moment_range", gte: "today/d", lte: "today/d+1d" }},{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Closing Gebucht}}" }}]}},
  { name: "Closer - Follow Up", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Qualifiziert}}" }}},
  { name: "Closer - Heutige Abschluesse", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Gewonnen}}" }},{ type: "field_condition", field: { type: "regular_field", field_name: "date_updated" }, condition: { type: "moment_range", gte: "today/d", lte: "today/d+1d" }}]}},
  { name: "AM - Onboarding Termine Heute", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Onboarding-Termin gebucht}}" }, condition: { type: "moment_range", gte: "today/d", lte: "today/d+1d" }},{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Gewonnen}}" }}]}},
  { name: "AM - Follow Up & Bestandskunden", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Bestandskunde}}" }}},
  { name: "AM - Cross-Sell Goldmine", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Bestandskunde}}" }},{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Account Manager}}" }, condition: { type: "is_not_empty" }}]}},
  { name: "Gewonnen diese Woche", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Gewonnen}}" }},{ type: "field_condition", field: { type: "regular_field", field_name: "date_updated" }, condition: { type: "moment_range", gte: "now/w", lte: "now/w+1w" }}]}},
  { name: "Verloren diese Woche", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Verloren}}" }},{ type: "field_condition", field: { type: "regular_field", field_name: "date_updated" }, condition: { type: "moment_range", gte: "now/w", lte: "now/w+1w" }}]}},
  { name: "Admin Protokoll-Check", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference_any", val: ["{{STATUS:Setting No-Show}}","{{STATUS:Closing No-Show}}","{{STATUS:Onboarding No-Show}}"]}}},
  { name: "Leads ohne Zuordnung", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Opener}}" }, condition: { type: "is_empty" }},{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Neu}}" }}]}},
  { name: "Webinar - Marketing Follow-Up", type: "lead", is_shared: true, s_query: { type: "and", queries: [{ type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Webinar-Status}}" }, condition: { type: "reference", val: "No-Show" }},{ type: "field_condition", field: { type: "regular_field", field_name: "status_id" }, condition: { type: "reference", val: "{{STATUS:Neu}}" }}]}},
  { name: "Webinar - Hot Leads", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:Webinar-Status}}" }, condition: { type: "reference", val: "Erschienen" }}},
  { name: "Marketing - ManyChat Leads", type: "lead", is_shared: true, s_query: { type: "field_condition", field: { type: "custom_field", custom_field_id: "{{FIELD:ManyChat User-ID}}" }, condition: { type: "is_not_empty" }}}
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function apiRequest(apiKey, method, path, body) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(apiKey + ":").toString("base64");
    const data = body ? JSON.stringify(body) : null;
    const cleanPath = path.startsWith("/") ? path : "/" + path;
    const fullPath = "/api/v1" + cleanPath + (cleanPath.endsWith("/") ? "" : "/");
    const options = {
      hostname: "api.close.com",
      path: fullPath,
      method,
      headers: {
        "Authorization": "Basic " + auth,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(data && { "Content-Length": Buffer.byteLength(data) })
      }
    };
    const req = https.request(options, res => {
      let buf = "";
      res.on("data", c => buf += c);
      res.on("end", () => {
        if (res.statusCode === 429) {
          const wait = parseInt(res.headers["retry-after"] || "3") * 1000;
          setTimeout(() => apiRequest(apiKey, method, path, body).then(resolve).catch(reject), wait);
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(buf ? JSON.parse(buf) : {});
        } else {
          reject(new Error(res.statusCode + ": " + buf.substring(0, 300)));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function apiGet(key, path) { await sleep(130); return apiRequest(key, "GET", path); }
async function apiPost(key, path, body) { await sleep(130); return apiRequest(key, "POST", path, body); }

function replacePlaceholders(obj, statusMap, fieldMap) {
  let str = JSON.stringify(obj);
  for (const [name, id] of Object.entries(statusMap)) str = str.split("{{STATUS:" + name + "}}").join(id);
  for (const [name, id] of Object.entries(fieldMap)) str = str.split("{{FIELD:" + name + "}}").join(id);
  return JSON.parse(str);
}

async function runSetup(apiKey, log) {
  log("🚀 Starte CRM Setup...");
  const me = await apiGet(apiKey, "/me");
  const orgName = (me.organizations && me.organizations[0]) ? me.organizations[0].name : "Unknown";
  log("✅ Verbunden als: " + (me.first_name || me.email || "User") + " | Org: " + orgName);

  log("\n📋 Erstelle Lead Statuses...");
  const statusMap = {};
  const existingStatuses = await apiGet(apiKey, "/status/lead");
  const existingStatusMap = {};
  for (const s of existingStatuses.data || []) existingStatusMap[s.label] = s.id;
  for (const label of LEAD_STATUSES) {
    if (existingStatusMap[label]) { statusMap[label] = existingStatusMap[label]; log(" → '" + label + "' bereits vorhanden"); }
    else { const r = await apiPost(apiKey, "/status/lead", { label }); statusMap[label] = r.id; log(" ✓ '" + label + "' erstellt"); }
  }

  log("\n🔧 Erstelle Lead Custom Fields...");
  const fieldMap = {};
  const schema = await apiGet(apiKey, "/custom_field_schema/lead");
  const existingFields = {};
  for (const f of (schema.fields || [])) existingFields[f.name] = f.id;
  for (const field of LEAD_CUSTOM_FIELDS) {
    if (existingFields[field.name]) { fieldMap[field.name] = existingFields[field.name]; log(" → '" + field.name + "' bereits vorhanden"); }
    else {
      const body = { name: field.name, type: field.type };
      if (field.choices) body.choices = field.choices;
      const r = await apiPost(apiKey, "/custom_field/lead", body);
      fieldMap[field.name] = r.id;
      log(" ✓ '" + field.name + "' erstellt");
    }
  }

  log("\n🔧 Erstelle Contact Custom Fields...");
  const contactSchema = await apiGet(apiKey, "/custom_field_schema/contact");
  const existingCF = {};
  for (const f of (contactSchema.fields || [])) existingCF[f.name] = f.id;
  for (const field of CONTACT_CUSTOM_FIELDS) {
    if (existingCF[field.name]) { log(" → '" + field.name + "' bereits vorhanden"); }
    else {
      const body = { name: field.name, type: field.type };
      if (field.choices) body.choices = field.choices;
      await apiPost(apiKey, "/custom_field/contact", body);
      log(" ✓ '" + field.name + "' erstellt");
    }
  }

  log("\n👁️ Erstelle Smart Views...");
  const existingSV = await apiGet(apiKey, "/saved_search?type__in=lead,contact&_limit=100");
  const existingSVNames = new Set((existingSV.data || []).map(v => v.name));
  for (const view of SMART_VIEWS) {
    if (existingSVNames.has(view.name)) { log(" → '" + view.name + "' bereits vorhanden"); continue; }
    const resolvedQuery = replacePlaceholders(view.s_query, statusMap, fieldMap);
    try {
      await apiPost(apiKey, "/saved_search", { name: view.name, type: view.type, is_shared: view.is_shared, s_query: resolvedQuery });
      log(" ✓ '" + view.name + "' erstellt");
    } catch(e) { log(" ⚠️ '" + view.name + "' Fehler: " + e.message); }
  }
  log("\n✅ Setup vollstaendig abgeschlossen!");
}

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  let apiKey;
  try { apiKey = JSON.parse(event.body || "{}").apiKey; } catch(e) { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  if (!apiKey || !apiKey.startsWith("api_")) return { statusCode: 400, headers, body: JSON.stringify({ error: "Ungueltiger API Key." }) };
  const logs = [];
  try { await runSetup(apiKey, msg => logs.push(msg)); } catch(e) { logs.push("\n❌ Kritischer Fehler: " + e.message); }
  return { statusCode: 200, headers, body: JSON.stringify({ logs }) };
};
