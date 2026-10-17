"use strict";

const PAGE_SIZE = 200;
const REQUEST_TIMEOUT_MS = 15000;
const STATUS_REFRESH_MS = 30000;
const MIN_RETRY_MS = 700;
const DEFAULT_TOOL = "rhymes";
const FILTER_FLAGS = ["include_phrases", "include_affixes", "include_proper"];
const TIER_ORDER = ["unknown", "rare", "medium", "common"];

const SEARCH_MODES = [
  ["contains", "Contengan estas letras"],
  ["prefix", "Empiecen por estas letras"],
  ["suffix", "Terminen en estas letras"],
];

const TIER_FILTER_LABELS = {
  unknown: "Sin datos de uso",
  rare: "Poco usuales",
  medium: "Usuales",
  common: "Muy usuales",
};

const TIER_LABELS = {
  common: "Muy usual",
  medium: "Usual",
  rare: "Poco usual",
  unknown: "Sin datos de uso",
};

const MESSAGES = {
  down: "El servicio de palabras no responde ahora mismo. Espera un momento y vuelve a intentarlo.",
  bad_key: "El servicio no está bien configurado. Avisa a quien lo administra.",
  still_down: "Sigue sin ser posible conectar con el servicio. Inténtalo de nuevo en unos minutos.",
  not_ready: "El servicio se está preparando. Vuelve a intentarlo en un minuto.",
  not_found: "No hemos encontrado esa palabra.",
  invalid: "Revisa lo que has escrito: no es válido.",
  rate_limit: "Hay demasiadas consultas seguidas. Espera unos segundos.",
  timeout: "La respuesta está tardando demasiado. Inténtalo de nuevo.",
  unknown: "Algo ha salido mal. Inténtalo de nuevo.",
};

const STATUS_BANNERS = {
  down: MESSAGES.down,
  bad_key: MESSAGES.bad_key,
  not_ready: MESSAGES.not_ready,
};

const LIST_KIND = "list";

const ICONS = {
  brand: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 7h6"/>',
  rhymes: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pattern: '<path d="M12 6v12"/><path d="M17.2 9 6.8 15"/><path d="m6.8 9 10.4 6"/>',
  letter: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  length: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  random: '<rect width="12" height="12" x="2" y="10" rx="2"/><path d="m17.9 14 3.5-3.5a2.2 2.2 0 0 0 0-3l-5-4.9a2.2 2.2 0 0 0-3 0L10 6"/><path d="M6 18h.01M10 14h.01M15 6h.01M18 9h.01"/>',
  definition: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  exists: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  system: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
};

const THEMES = [
  ["light", "Claro"],
  ["dark", "Oscuro"],
  ["system", "Automático"],
];

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const attributes = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  };
  for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value);
  svg.innerHTML = ICONS[name];
  return svg;
}

const TOOLS = [
  {
    id: "rhymes",
    label: "Rimas",
    title: "Rimas consonantes",
    help: "Encuentra palabras que riman con el final que tú elijas.",
    submit: "Buscar rimas",
    kind: LIST_KIND,
    fields: [
      {
        name: "ending",
        label: "¿Cómo termina la palabra?",
        placeholder: "Final de la palabra, desde la vocal que más se oye",
        hideLabel: true,
        maxlength: 30,
      },
    ],
    request: (v) => ({ path: "words/rhymes", params: { ending: v.ending } }),
  },
  {
    id: "search",
    label: "Buscar",
    title: "Buscar palabras",
    help: "Encuentra palabras a partir de unas letras.",
    submit: "Buscar palabras",
    kind: LIST_KIND,
    fields: [
      {
        name: "q",
        label: "Letras que buscas",
        maxlength: 80,
      },
      {
        name: "mode",
        label: "Quiero palabras que…",
        type: "select",
        options: SEARCH_MODES,
      },
    ],
    request: (v) => ({ path: "words/search", params: { q: v.q, mode: v.mode } }),
  },
  {
    id: "pattern",
    label: "Con huecos",
    title: "Palabras con huecos",
    help: "Pon «_» en cada letra que no sepas y «*» si no sabes cuántas letras faltan.",
    submit: "Buscar palabras",
    kind: LIST_KIND,
    fields: [
      {
        name: "p",
        label: "Escribe la palabra con huecos",
        maxlength: 30,
      },
      {
        name: "length",
        label: "Número de letras (opcional)",
        type: "number",
        min: 1,
        max: 100,
        required: false,
      },
    ],
    request: (v) => ({ path: "words/pattern", params: { p: v.p, length: v.length } }),
  },
  {
    id: "letter",
    label: "Por letra",
    title: "Palabras por letra inicial",
    help: "Mira las palabras que empiezan por una letra.",
    submit: "Ver palabras",
    kind: LIST_KIND,
    fields: [
      {
        name: "letter",
        label: "Letra",
        placeholder: "Escribe una sola letra",
        hideLabel: true,
        maxlength: 1,
      },
    ],
    request: (v) => ({ path: `words/by-letter/${encodeURIComponent(v.letter)}`, params: {} }),
  },
  {
    id: "length",
    label: "Por longitud",
    title: "Palabras por número de letras",
    help: "Mira las palabras que tienen un número exacto de letras.",
    submit: "Ver palabras",
    kind: LIST_KIND,
    fields: [
      {
        name: "length",
        label: "Número de letras",
        placeholder: "Número de letras",
        hideLabel: true,
        type: "number",
        min: 1,
        max: 100,
      },
    ],
    request: (v) => ({ path: `words/by-length/${encodeURIComponent(v.length)}`, params: {} }),
  },
  {
    id: "random",
    label: "Al azar",
    title: "Palabra al azar",
    help: "Te sugerimos una palabra cualquiera. Puedes limitarla si quieres.",
    submit: "Dame una palabra",
    kind: "random",
    fields: [
      { name: "letter", label: "Que empiece por (opcional)", maxlength: 1, required: false },
      {
        name: "length",
        label: "Número de letras (opcional)",
        type: "number",
        min: 1,
        max: 100,
        required: false,
      },
    ],
    request: (v) => ({ path: "words/random", params: { letter: v.letter, length: v.length } }),
  },
  {
    id: "definition",
    label: "Significado",
    title: "Significado de una palabra",
    help: "Consulta qué quiere decir una palabra.",
    submit: "Ver significado",
    kind: "definition",
    plain: true,
    fields: [
      {
        name: "word",
        label: "Palabra",
        placeholder: "Escribe una palabra",
        hideLabel: true,
        maxlength: 80,
      },
    ],
    request: (v) => ({ path: `definitions/${encodeURIComponent(v.word)}`, params: {} }),
  },
  {
    id: "exists",
    label: "¿Existe?",
    title: "¿Existe esta palabra?",
    help: "Comprueba si una palabra está en el diccionario.",
    submit: "Comprobar",
    kind: "exists",
    plain: true,
    fields: [
      {
        name: "words",
        label: "Una o varias palabras",
        placeholder: "Una o varias palabras separadas por comas; no importan las tildes",
        hideLabel: true,
        maxlength: 800,
      },
    ],
    request: (v) => ({
      path: "words/exists",
      params: splitWords(v.words).map((word) => ["w", word]),
    }),
  },
];

const $ = (selector) => document.querySelector(selector);

const dom = {
  menu: $("#menu"),
  title: $("#title"),
  help: $("#help"),
  form: $("#form"),
  fields: $("#fields"),
  filters: $("#filters"),
  submit: $("#submit"),
  result: $("#result"),
  banner: $("#banner"),
  bannerText: $("#banner-text"),
  retry: $("#banner-retry"),
  retrySpinner: $("#banner-retry .spinner"),
  retryText: $("#banner-retry-text"),
  theme: $("#theme"),
  status: $("#status"),
  statusText: $("#status-text"),
};

const control = (name) => dom.form.querySelector(`[name="${name}"]`);
const tierBoxes = () => [...dom.form.querySelectorAll('[name="tier"]')];
const selectedTiers = () => tierBoxes().filter((box) => box.checked).map((box) => box.value);

let activeTool = null;
let currentRequest = null;
let cameFromList = false;
let backAvailable = false;

class ApiError extends Error {
  constructor(kind) {
    super(MESSAGES[kind] ?? MESSAGES.unknown);
    this.kind = kind;
  }
}

function el(tag, { className, text, attrs } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs ?? {})) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function splitWords(text) {
  const separator = text.includes(",") ? "," : /\s+/;
  return text.split(separator).map((word) => word.trim()).filter(Boolean).slice(0, 100);
}

function formatNumber(value) {
  return value.toLocaleString("es", { useGrouping: "always" });
}

function errorKindFromStatus(status) {
  if (status === 404) return "not_found";
  if (status === 422) return "invalid";
  if (status === 429) return "rate_limit";
  if (status === 502) return "bad_key";
  if (status === 503) return "down";
  return "unknown";
}

async function callApi(path, params, signal) {
  const url = new URL(`/api/${path}`, location.origin);
  for (const [key, value] of params) {
    if (value !== "" && value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(error.name === "TimeoutError" ? "timeout" : "down");
  }
  if (!response.ok) throw new ApiError(errorKindFromStatus(response.status));
  try {
    return await response.json();
  } catch {
    throw new ApiError("unknown");
  }
}

function setStatus(state, stillFailing = false) {
  const ok = state === "ok";
  dom.status.dataset.state = ok ? "ok" : "problem";
  dom.statusText.textContent = ok ? "Servicio disponible" : "Servicio no disponible";
  dom.banner.hidden = ok;
  if (ok) return;
  dom.bannerText.textContent = stillFailing && state === "down" ? MESSAGES.still_down : STATUS_BANNERS[state] ?? MESSAGES.down;
}

async function fetchStatus() {
  try {
    const response = await fetch("/api/status", { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    return (await response.json()).state;
  } catch {
    return "down";
  }
}

async function refreshStatus() {
  setStatus(await fetchStatus());
}

async function retryStatus() {
  dom.retry.disabled = true;
  dom.retrySpinner.hidden = false;
  dom.retryText.textContent = "Comprobando…";
  const [state] = await Promise.all([fetchStatus(), new Promise((resolve) => setTimeout(resolve, MIN_RETRY_MS))]);
  setStatus(state, true);
  dom.retry.disabled = false;
  dom.retrySpinner.hidden = true;
  dom.retryText.textContent = "Reintentar";
}

function applyTheme(theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {}
  for (const button of dom.theme.children) {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  }
}

function buildThemeToggle() {
  for (const [id, label] of THEMES) {
    const button = el("button", { attrs: { type: "button", "data-theme": id, title: label, "aria-label": label } }, icon(id));
    button.addEventListener("click", () => applyTheme(id));
    dom.theme.append(button);
  }
  applyTheme(document.documentElement.dataset.theme ?? "system");
}

function buildMenu() {
  for (const tool of TOOLS) {
    const link = el(
      "a",
      { attrs: { href: `#${tool.id}`, "data-tool": tool.id } },
      icon(tool.id),
      el("span", { text: tool.label }),
    );
    dom.menu.append(link);
  }
}

function buildField(field) {
  const wrapper = el("div", { className: "field" });
  const label = el("label", {
    className: field.hideLabel ? "label sr-only" : "label",
    text: field.label,
    attrs: { for: `f-${field.name}` },
  });
  let input;
  if (field.type === "select") {
    input = el("select", { attrs: { id: `f-${field.name}`, name: field.name } });
    for (const [value, text] of field.options) input.append(el("option", { text, attrs: { value } }));
  } else {
    input = el("input", {
      attrs: {
        id: `f-${field.name}`,
        name: field.name,
        type: field.type ?? "text",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
      },
    });
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.maxlength) input.maxLength = field.maxlength;
    if (field.min) input.min = field.min;
    if (field.max) input.max = field.max;
  }
  input.required = field.required !== false;
  wrapper.append(label, input);
  if (field.hint) {
    const hint = el("span", { className: "hint", text: field.hint, attrs: { id: `h-${field.name}` } });
    input.setAttribute("aria-describedby", hint.id);
    wrapper.append(hint);
  }
  return wrapper;
}

function showTool(tool, params = new URLSearchParams()) {
  currentRequest?.abort();
  activeTool = tool;
  dom.title.textContent = tool.title;
  dom.help.textContent = tool.help;
  dom.submit.textContent = tool.submit;
  dom.submit.disabled = false;
  dom.fields.replaceChildren(...tool.fields.map(buildField));
  dom.filters.hidden = tool.plain === true;
  dom.result.replaceChildren();

  for (const field of tool.fields) control(field.name).value = params.get(field.name) ?? "";
  for (const name of FILTER_FLAGS) dom.form.elements[name].checked = params.has(name);
  const tiers = params.getAll("tier");
  for (const box of tierBoxes()) box.checked = tiers.includes(box.value);
  dom.filters.open = !tool.plain && (tiers.length > 0 || FILTER_FLAGS.some((name) => params.has(name)));
  for (const link of dom.menu.children) {
    if (link.dataset.tool === tool.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (!params.size) control(tool.fields[0].name).focus({ preventScroll: true });
}

function readValues(tool) {
  const values = {};
  for (const field of tool.fields) values[field.name] = control(field.name).value.trim();
  return values;
}

function currentHash(tool) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(readValues(tool))) if (value) params.set(name, value);
  if (!tool.plain) {
    for (const name of FILTER_FLAGS) if (dom.form.elements[name].checked) params.set(name, "1");
    for (const tier of selectedTiers()) params.append("tier", tier);
  }
  const query = params.toString();
  return `#${tool.id}${query ? `?${query}` : ""}`;
}

function parseHash() {
  const raw = location.hash.slice(1);
  const split = raw.indexOf("?");
  const id = split === -1 ? raw : raw.slice(0, split);
  const params = new URLSearchParams(split === -1 ? "" : raw.slice(split + 1));
  const tool = TOOLS.find((candidate) => candidate.id === id) ?? TOOLS.find((candidate) => candidate.id === DEFAULT_TOOL);
  return { tool, params };
}

function filterParams(tool) {
  if (tool.plain) return [];
  const form = dom.form.elements;
  const params = [];
  for (const name of ["include_phrases", "include_affixes", "include_proper"]) {
    if (form[name].checked) params.push([name, "true"]);
  }
  return params;
}

function showLoading() {
  dom.result.replaceChildren(
    el("p", { className: "message" }, el("span", { className: "spinner", attrs: { "aria-hidden": "true" } }), "Buscando…"),
  );
}

function showError(error) {
  dom.result.replaceChildren(el("p", { className: "message error", text: error.message }));
}

function definitionHref(word) {
  return `#definition?word=${encodeURIComponent(word)}`;
}

function wordLink(word) {
  return el("li", {}, el("a", { className: "word", text: word, attrs: { href: definitionHref(word), title: "Ver significado" } }));
}

function tierBar() {
  const selected = selectedTiers();
  const buttons = TIER_ORDER.map((tier) => {
    const button = el("button", {
      className: "secondary small toggle",
      text: TIER_FILTER_LABELS[tier],
      attrs: { type: "button", "aria-pressed": String(selected.includes(tier)) },
    });
    button.addEventListener("click", () => {
      const box = tierBoxes().find((candidate) => candidate.value === tier);
      box.checked = !box.checked;
      dom.form.requestSubmit();
    });
    return button;
  });
  return el("div", { className: "narrow" }, el("span", { text: "Elige qué palabras ver según su uso:" }), ...buttons);
}

function groupSection(state, group, titled) {
  const section = el("section", { className: "group" });
  if (titled) {
    section.append(el("h2", { className: "group-title", text: `${TIER_FILTER_LABELS[group.tier]} · ${formatNumber(group.total)}` }));
  }
  if (group.words.length === 0) {
    section.append(el("p", { className: "hint", text: "No hay palabras de este tipo." }));
    return section;
  }
  section.append(el("ul", { className: "words" }, ...group.words.map(wordLink)));
  if (group.words.length < group.total) {
    const remaining = formatNumber(group.total - group.words.length);
    const more = el("button", { className: "secondary more", text: `Mostrar más (${remaining} restantes)`, attrs: { type: "button" } });
    more.addEventListener("click", () => loadMore(state, group, more));
    section.append(more);
  }
  return section;
}

function renderList(state) {
  const { groups } = state;
  const words = groups.flatMap((group) => group.words);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const tiered = groups[0].tier !== null;

  const parts = [];
  if (total === 0) {
    parts.push(el("p", { className: "message", text: "No hay palabras que cumplan lo que has pedido. Prueba con menos letras o quita alguna opción." }));
  } else {
    const copy = el("button", { className: "secondary small", text: "Copiar lista", attrs: { type: "button" } });
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(words.join(", "));
        copy.textContent = "¡Copiada!";
      } catch {
        copy.textContent = "No se ha podido copiar";
      }
      setTimeout(() => (copy.textContent = "Copiar lista"), 2000);
    });
    const noun = total === 1 ? "palabra" : "palabras";
    const partial = words.length < total;
    const text = `${formatNumber(total)} ${noun} encontradas${partial ? `; se muestran ${formatNumber(words.length)}, por orden alfabético` : ""}.`;
    parts.push(el("div", { className: "summary" }, el("p", { text }), copy));
  }
  if (tiered || total > PAGE_SIZE) parts.push(tierBar());
  if (total > 0) parts.push(...groups.map((group) => groupSection(state, group, groups.length > 1)));
  dom.result.replaceChildren(...parts);
}

function renderRandom(data) {
  const again = el("button", { className: "secondary", text: "Otra palabra", attrs: { type: "button" } });
  again.addEventListener("click", () => dom.form.requestSubmit());
  const meaning = el("a", { className: "secondary", text: "Ver significado", attrs: { href: definitionHref(data.word) } });
  dom.result.replaceChildren(
    el("p", { className: "big-word", text: data.word }),
    el("div", { className: "fields" }, meaning, again),
  );
}

function renderDefinition(data) {
  const senses = el("ol", { className: "senses" });
  for (const sense of data.senses) {
    const item = el("li");
    if (sense.category) item.append(el("span", { className: "category", text: `${sense.category.replace(/\.$/, "")}. ` }));
    item.append(sense.description);
    senses.append(item);
  }
  const back = el("button", { className: "secondary small back", text: "← Volver a los resultados", attrs: { type: "button" } });
  back.addEventListener("click", () => history.back());
  dom.result.replaceChildren(
    ...(backAvailable ? [back] : []),
    el("p", { className: "big-word", text: data.word }),
    data.senses.length ? senses : el("p", { className: "message", text: "No hay definición disponible para esta palabra." }),
    el("p", { className: "source", text: "Fuente: Diccionario de la RAE" }),
  );
}

function existsTags(entry) {
  const tags = [];
  if (entry.is_phrase) tags.push("Expresión");
  if (entry.is_affix) tags.push("Prefijo o sufijo");
  if (entry.is_proper) tags.push("Nombre propio");
  if (entry.tier && TIER_LABELS[entry.tier]) tags.push(TIER_LABELS[entry.tier]);
  return tags.map((text) => el("span", { className: "tag", text }));
}

function renderExists(data) {
  const rows = data.results.map((entry) => {
    const row = el("li", { className: `check-row ${entry.exists ? "yes" : "no"}` });
    if (entry.exists) {
      row.append(el("span", { className: "mark", text: "✓ Sí existe" }), el("strong", { text: entry.word }), ...existsTags(entry));
    } else {
      row.append(el("span", { className: "mark", text: "✗ No existe" }), el("strong", { text: entry.query }));
    }
    return row;
  });
  dom.result.replaceChildren(el("ul", { className: "checks" }, ...rows));
}

function buildQuery(tool, values, extra = []) {
  const { path, params } = tool.request(values);
  const entries = Array.isArray(params) ? [...params] : Object.entries(params);
  entries.push(...filterParams(tool), ...extra);
  return { path, entries };
}

function pageData(tool, values, group, signal) {
  const extra = [["limit", PAGE_SIZE], ["offset", group.words.length]];
  if (group.tier) extra.push(["tier", group.tier]);
  const { path, entries } = buildQuery(tool, values, extra);
  return callApi(path, entries, signal);
}

function startRequest() {
  currentRequest?.abort();
  currentRequest = new AbortController();
  return currentRequest;
}

async function loadMore(state, group, button) {
  const controller = startRequest();
  button.disabled = true;
  try {
    const data = await pageData(state.tool, state.values, group, controller.signal);
    if (controller.signal.aborted) return;
    group.words.push(...data.words);
    group.total = data.total;
    renderList(state);
  } catch (error) {
    if (error.name === "AbortError") return;
    button.disabled = false;
    button.textContent = error.message;
  }
}

async function loadResult(tool, values, signal) {
  if (tool.kind === LIST_KIND) {
    const tiers = selectedTiers();
    const groups = (tiers.length ? tiers : [null]).map((tier) => ({ tier, words: [], total: 0 }));
    await Promise.all(
      groups.map(async (group) => {
        const data = await pageData(tool, values, group, signal);
        group.words = data.words;
        group.total = data.total;
      }),
    );
    return renderList({ tool, values, groups });
  }

  const tiers = selectedTiers();
  const extra = tool.kind === "random" && tiers.length ? [["tier", tiers[Math.floor(Math.random() * tiers.length)]]] : [];
  const { path, entries } = buildQuery(tool, values, extra);
  const data = await callApi(path, entries, signal);
  if (tool.kind === "random") renderRandom(data);
  else if (tool.kind === "definition") renderDefinition(data);
  else renderExists(data);
}

async function run(tool, values) {
  const controller = startRequest();
  showLoading();
  dom.submit.disabled = true;
  try {
    await loadResult(tool, values, controller.signal);
    if (controller.signal.aborted) return;
  } catch (error) {
    if (error.name === "AbortError") return;
    showError(error);
    if (error.kind === "down" || error.kind === "timeout") refreshStatus();
  } finally {
    if (currentRequest === controller) dom.submit.disabled = false;
  }
}

function route() {
  const { tool, params } = parseHash();
  backAvailable = cameFromList && tool.id === "definition";
  cameFromList = false;
  showTool(tool, params);
  if (params.size && dom.form.checkValidity()) run(tool, readValues(tool));
}

dom.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!dom.form.reportValidity()) return;
  const hash = currentHash(activeTool);
  if (location.hash !== hash) {
    history[location.hash.includes("?") ? "pushState" : "replaceState"](null, "", hash);
  }
  backAvailable = false;
  run(activeTool, readValues(activeTool));
});

dom.result.addEventListener("click", (event) => {
  if (event.target.closest("a.word")) cameFromList = true;
});
dom.retry.addEventListener("click", retryStatus);
window.addEventListener("popstate", route);

buildMenu();
buildThemeToggle();
$("#brand-icon").append(icon("brand"));
route();
refreshStatus();
setInterval(refreshStatus, STATUS_REFRESH_MS);
