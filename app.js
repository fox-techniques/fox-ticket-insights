const TICKETS_API_PATH = "/api/tickets";
const DAY_MS = 24 * 60 * 60 * 1000;

const CSV_EXPORT_HEADERS = [
  "id",
  "ticketCode",
  "title",
  "createdBy",
  "closedBy",
  "status",
  "highPriority",
  "submittedDate",
  "completedDate",
  "archived",
  "details",
  "changeReason",
  "expectedBenefit",
  "notes",
  "createdAt",
  "updatedAt"
];

const CSV_HEADER_ALIASES = {
  id: ["id"],
  ticketCode: ["ticketcode", "ticketid"],
  title: ["title"],
  createdBy: ["createdby", "creator", "requester"],
  closedBy: ["closedby", "closer"],
  status: ["status"],
  highPriority: ["highpriority"],
  submittedDate: ["submitteddate", "datesubmitted"],
  completedDate: ["completeddate", "datecompleted"],
  archived: ["archived"],
  details: ["details", "entrydetails"],
  changeReason: ["changereason", "reasonofthechange", "reasonforchange"],
  expectedBenefit: ["expectedbenefit", "benefit"],
  notes: ["notes"],
  createdAt: ["createdat"],
  updatedAt: ["updatedat"]
};

const STATUS_CONFIG = {
  inprogress: {
    label: "In Progress",
    priority: 0,
    badgeClass: "badge-inprogress",
    cardClass: "status-inprogress",
    bannerClass: "inprogress"
  },
  waiting: {
    label: "Requires Approval",
    priority: 1,
    badgeClass: "badge-waiting",
    cardClass: "status-waiting",
    bannerClass: "waiting"
  },
  completed: {
    label: "Completed",
    priority: 2,
    badgeClass: "badge-completed",
    cardClass: "status-completed",
    bannerClass: "completed"
  },
  canceled: {
    label: "Canceled",
    priority: 3,
    badgeClass: "badge-canceled",
    cardClass: "status-canceled",
    bannerClass: "canceled"
  },
  abandoned: {
    label: "Abandoned",
    priority: 4,
    badgeClass: "badge-abandoned",
    cardClass: "status-abandoned",
    bannerClass: "abandoned"
  },
  rejected: {
    label: "Rejected",
    priority: 5,
    badgeClass: "badge-rejected",
    cardClass: "status-rejected",
    bannerClass: "rejected"
  }
};

const state = {
  tickets: [],
  selectedId: "",
  showArchived: false,
  searchQuery: "",
  repositoryVersion: "",
  repositoryReady: false,
  repositoryError: "",
  isSaving: false,
  analyticsOpen: false
};

const $ = (id) => document.getElementById(id);
const el = {
  status: $("status"),
  showArchivedBtn: $("showArchivedBtn"),
  showArchivedState: $("showArchivedState"),
  ticketCode: $("ticketCode"),
  ticketTitle: $("ticketTitle"),
  ticketCreatedBy: $("ticketCreatedBy"),
  ticketClosedBy: $("ticketClosedBy"),
  ticketSubmitted: $("ticketSubmitted"),
  ticketSubmittedDisplay: $("ticketSubmittedDisplay"),
  ticketCompleted: $("ticketCompleted"),
  ticketCompletedDisplay: $("ticketCompletedDisplay"),
  ticketStatus: $("ticketStatus"),
  ticketDetails: $("ticketDetails"),
  ticketChangeReason: $("ticketChangeReason"),
  ticketExpectedBenefit: $("ticketExpectedBenefit"),
  addTicketBtn: $("addTicketBtn"),
  importCsvBtn: $("importCsvBtn"),
  exportCsvBtn: $("exportCsvBtn"),
  clearFormBtn: $("clearFormBtn"),
  csvImportInput: $("csvImportInput"),
  queueMeta: $("queueMeta"),
  ticketSearch: $("ticketSearch"),
  ticketList: $("ticketList"),
  countInProgress: $("countInProgress"),
  countWaiting: $("countWaiting"),
  countCompleted: $("countCompleted"),
  countCanceled: $("countCanceled"),
  countAbandoned: $("countAbandoned"),
  countRejected: $("countRejected"),
  countArchived: $("countArchived"),
  detailsSection: $("detailsSection"),
  detailsTrack: $("detailsTrack"),
  detailsEmpty: $("detailsEmpty"),
  detailsPanel: $("detailsPanel"),
  detailsId: $("detailsId"),
  detailsCode: $("detailsCode"),
  detailsTitle: $("detailsTitle"),
  detailsCreatedBy: $("detailsCreatedBy"),
  detailsClosedBy: $("detailsClosedBy"),
  detailsSubmitted: $("detailsSubmitted"),
  detailsSubmittedDisplay: $("detailsSubmittedDisplay"),
  detailsCompleted: $("detailsCompleted"),
  detailsCompletedDisplay: $("detailsCompletedDisplay"),
  detailsStatus: $("detailsStatus"),
  detailsText: $("detailsText"),
  detailsChangeReason: $("detailsChangeReason"),
  detailsExpectedBenefit: $("detailsExpectedBenefit"),
  detailsStatusBadge: $("detailsStatusBadge"),
  detailsDayCount: $("detailsDayCount"),
  saveTicketBtn: $("saveTicketBtn"),
  priorityTicketBtn: $("priorityTicketBtn"),
  archiveTicketBtn: $("archiveTicketBtn"),
  detailsMeta: $("detailsMeta"),
  noteCount: $("noteCount"),
  noteText: $("noteText"),
  addNoteBtn: $("addNoteBtn"),
  noteList: $("noteList"),
  bannerText: $("bannerText"),
  analyticsBtn: $("analyticsBtn"),
  analyticsView: $("analyticsView"),
  closeAnalyticsBtn: $("closeAnalyticsBtn"),
  resetAnalyticsBtn: $("resetAnalyticsBtn"),
  analyticsRange: $("analyticsRange"),
  analyticsGrouping: $("analyticsGrouping"),
  analyticsStatus: $("analyticsStatus"),
  analyticsPriority: $("analyticsPriority"),
  analyticsCreator: $("analyticsCreator"),
  analyticsCloser: $("analyticsCloser"),
  analyticsScope: $("analyticsScope"),
  analyticsContent: $("analyticsContent")
};

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  const safe = normalizeDateString(value);
  if (!safe) return "—";
  const [year, month, day] = safe.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function formatDateTime(value) {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";

  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function normalizeDateString(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return raw;
}

function readDateInput(input, label, { required = false } = {}) {
  const raw = String(input.value || "").trim();
  if (!raw) {
    if (!required) return "";
    alert(`${label} is required.`);
    input.focus();
    return null;
  }

  const parsed = normalizeDateString(raw);
  if (!parsed) {
    alert(`${label} must be a valid date.`);
    input.focus();
    return null;
  }

  return parsed;
}

function dateStringToUtcMs(value) {
  const safe = normalizeDateString(value);
  if (!safe) return null;
  const [year, month, day] = safe.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function normalizeTicketCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeStatus(value) {
  return Object.hasOwn(STATUS_CONFIG, value) ? value : "inprogress";
}

function normalizeNotes(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id ? item.id : `note-${Date.now()}-${index}`,
      text: String(item.text ?? "").trim(),
      createdAt: typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now()
    }))
    .filter((note) => note.text);
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(raw);
}

function parseImportedDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—") return "";

  const isoDate = normalizeDateString(raw);
  if (isoDate) return isoDate;

  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  return normalizeDateString(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  );
}

function parseImportedDateTime(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—") return null;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const isoTimestamp = Date.parse(raw);
  if (!Number.isNaN(isoTimestamp)) {
    return isoTimestamp;
  }

  const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;

  const [, day, month, year, hours = "0", minutes = "0"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hours) ||
    parsed.getMinutes() !== Number(minutes)
  ) {
    return null;
  }

  return parsed.getTime();
}

function parseImportedStatus(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "inprogress";

  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  const map = {
    inprogress: "inprogress",
    waiting: "waiting",
    requiresapproval: "waiting",
    waitingforapproval: "waiting",
    completed: "completed",
    canceled: "canceled",
    cancelled: "canceled",
    abandoned: "abandoned",
    rejected: "rejected"
  };

  return map[key] || normalizeStatus(raw);
}

function parseNotesCell(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  try {
    return normalizeNotes(JSON.parse(raw));
  } catch {
    return raw
      .split("||")
      .map((item, index) => {
        const cleaned = item.trim();
        if (!cleaned) return null;
        const match = cleaned.match(/^\[(.+?)\]\s*(.*)$/);
        const text = (match?.[2] ?? cleaned).trim();
        if (!text) return null;
        return {
          id: createId("note"),
          text,
          createdAt: parseImportedDateTime(match?.[1] ?? "") ?? Date.now() + index
        };
      })
      .filter(Boolean);
  }
}

function normalizeTicket(ticket) {
  const now = Date.now();
  return {
    id: typeof ticket?.id === "string" && ticket.id ? ticket.id : createId("ticket"),
    ticketCode: normalizeTicketCode(ticket?.ticketCode),
    highPriority: parseBoolean(ticket?.highPriority),
    title: String(ticket?.title ?? "").trim() || "Untitled Ticket",
    createdBy: String(ticket?.createdBy ?? "").trim(),
    closedBy: String(ticket?.closedBy ?? "").trim(),
    submittedDate: normalizeDateString(ticket?.submittedDate) || todayInputValue(),
    completedDate: normalizeDateString(ticket?.completedDate),
    status: normalizeStatus(ticket?.status),
    details: String(ticket?.details ?? "").trim(),
    changeReason: String(ticket?.changeReason ?? "").trim(),
    expectedBenefit: String(ticket?.expectedBenefit ?? "").trim(),
    archived: parseBoolean(ticket?.archived),
    createdAt: typeof ticket?.createdAt === "number" && Number.isFinite(ticket.createdAt)
      ? ticket.createdAt
      : now,
    updatedAt: typeof ticket?.updatedAt === "number" && Number.isFinite(ticket.updatedAt)
      ? ticket.updatedAt
      : now,
    notes: normalizeNotes(ticket?.notes)
  };
}

function getTickets() {
  return state.tickets.slice();
}

function getSelectedId() {
  return state.selectedId;
}

function setSelectedId(ticketId) {
  state.selectedId = typeof ticketId === "string" ? ticketId : "";
}

function isShowArchivedEnabled() {
  return state.showArchived;
}

function setShowArchivedEnabled(value) {
  state.showArchived = Boolean(value);
}

function getStatusConfig(status) {
  return STATUS_CONFIG[normalizeStatus(status)];
}

function isTerminalStatus(status) {
  const safe = normalizeStatus(status);
  return ["completed", "canceled", "abandoned", "rejected"].includes(safe);
}

async function loadTicketsFromRepo() {
  const response = await fetch(TICKETS_API_PATH, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Could not load repo data: ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Repo data payload is not an array.");
  }

  return {
    tickets: payload.map(normalizeTicket),
    version: response.headers.get("ETag") || ""
  };
}

async function getApiError(response, fallback) {
  try {
    const payload = await response.json();
    return typeof payload?.error === "string" ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

async function saveTicketsToRepo(tickets) {
  const response = await fetch(TICKETS_API_PATH, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "If-Match": state.repositoryVersion
    },
    body: JSON.stringify(tickets.map(normalizeTicket))
  });

  if (!response.ok) {
    const error = new Error(await getApiError(response, `Could not save repository data: ${response.status}`));
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Repository data payload is not an array.");
  }

  return {
    tickets: payload.map(normalizeTicket),
    version: response.headers.get("ETag") || ""
  };
}

async function hydrateTickets() {
  const repository = await loadTicketsFromRepo();
  state.tickets = repository.tickets;
  state.repositoryVersion = repository.version;
  state.repositoryReady = true;
  state.repositoryError = "";
}

async function saveTickets(nextTickets) {
  if (!state.repositoryReady || state.isSaving) {
    return false;
  }

  const normalizedTickets = nextTickets.map(normalizeTicket);
  state.isSaving = true;
  setMutationControlsDisabled(true);

  try {
    const repository = await saveTicketsToRepo(normalizedTickets);
    state.tickets = repository.tickets;
    state.repositoryVersion = repository.version;
    state.repositoryError = "";
    return true;
  } catch (error) {
    console.error(error);
    const saveError = error instanceof Error ? error.message : "Could not save repository data.";
    state.repositoryError = saveError;

    if (error?.status === 412) {
      try {
        await hydrateTickets();
        state.repositoryError = `${saveError} The latest repository data has been loaded; retry your change.`;
      } catch (reloadError) {
        console.error(reloadError);
      }
    }

    alert(state.repositoryError);
    render();
    return false;
  } finally {
    state.isSaving = false;
    setMutationControlsDisabled(!state.repositoryReady);
  }
}

function getTicketElapsedDays(ticket) {
  const submittedMs = dateStringToUtcMs(ticket.submittedDate);
  if (submittedMs === null) return 0;

  const status = normalizeStatus(ticket.status);
  const endDate = isTerminalStatus(status) && normalizeDateString(ticket.completedDate)
    ? ticket.completedDate
    : todayInputValue();
  const endMs = dateStringToUtcMs(endDate);
  if (endMs === null) return 0;

  return Math.max(0, Math.floor((endMs - submittedMs) / DAY_MS));
}

function getDayCountClass(status) {
  return `day-count-${normalizeStatus(status)}`;
}

function getTicketBadgeClass(ticket) {
  return ticket.highPriority ? "badge-priority" : getStatusConfig(ticket.status).badgeClass;
}

function getTicketDayCountClass(ticket) {
  return ticket.highPriority ? "day-count-priority" : getDayCountClass(ticket.status);
}

function getDateDisplayElement(input) {
  return $(`${input.id}Display`);
}

function syncDateDisplay(input) {
  const display = getDateDisplayElement(input);
  if (!display) return;

  const safe = normalizeDateString(input.value);
  display.textContent = safe ? formatDisplayDate(safe) : "dd/mm/yyyy";
  display.classList.toggle("is-placeholder", !safe);
}

function syncAllDateDisplays() {
  [
    el.ticketSubmitted,
    el.ticketCompleted,
    el.detailsSubmitted,
    el.detailsCompleted
  ].forEach(syncDateDisplay);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function compareTickets(a, b) {
  if (a.archived !== b.archived) {
    return a.archived ? 1 : -1;
  }

  const statusDiff = getStatusConfig(a.status).priority - getStatusConfig(b.status).priority;
  if (statusDiff !== 0) return statusDiff;

  if (a.submittedDate !== b.submittedDate) {
    return a.submittedDate < b.submittedDate ? 1 : -1;
  }

  if (a.updatedAt !== b.updatedAt) {
    return b.updatedAt - a.updatedAt;
  }

  return a.ticketCode.localeCompare(b.ticketCode) || a.title.localeCompare(b.title);
}

function normalizeSearchQuery(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getTicketSearchBlob(ticket) {
  return [
    ticket.ticketCode,
    ticket.title,
    ticket.createdBy,
    ticket.closedBy,
    getStatusConfig(ticket.status).label,
    ticket.details,
    ticket.changeReason,
    ticket.expectedBenefit,
    ...ticket.notes.map((note) => note.text)
  ].join("\n").toLowerCase();
}

function matchesTicketSearch(ticket, searchQuery) {
  if (!searchQuery) return true;
  return getTicketSearchBlob(ticket).includes(searchQuery);
}

function getVisibleTickets(tickets, showArchived, searchQuery) {
  return tickets
    .filter((ticket) => (showArchived || !ticket.archived) && matchesTicketSearch(ticket, searchQuery))
    .sort(compareTickets);
}

function getCounts(tickets) {
  return tickets.reduce((counts, ticket) => {
    counts[normalizeStatus(ticket.status)] += 1;
    return counts;
  }, {
    inprogress: 0,
    waiting: 0,
    completed: 0,
    canceled: 0,
    abandoned: 0,
    rejected: 0
  });
}

function getSelectedTicket(tickets, showArchived, searchQuery) {
  const selectedId = getSelectedId();
  const visibleTickets = getVisibleTickets(tickets, showArchived, searchQuery);
  const selected = tickets.find((ticket) => ticket.id === selectedId);

  if (selected && (showArchived || !selected.archived) && matchesTicketSearch(selected, searchQuery)) {
    return selected;
  }

  const fallback = visibleTickets[0] ?? null;
  setSelectedId(fallback?.id ?? "");
  return fallback;
}

function clearCreateForm() {
  el.ticketCode.value = "";
  el.ticketTitle.value = "";
  el.ticketCreatedBy.value = "";
  el.ticketClosedBy.value = "";
  el.ticketSubmitted.value = todayInputValue();
  el.ticketCompleted.value = "";
  el.ticketStatus.value = "inprogress";
  el.ticketDetails.value = "";
  el.ticketChangeReason.value = "";
  el.ticketExpectedBenefit.value = "";
  syncAllDateDisplays();
}

function syncCreateCompletedDate() {
  if (isTerminalStatus(el.ticketStatus.value) && !el.ticketCompleted.value) {
    el.ticketCompleted.value = todayInputValue();
  }
  syncDateDisplay(el.ticketCompleted);
}

function syncDetailsCompletedDate() {
  if (isTerminalStatus(el.detailsStatus.value) && !el.detailsCompleted.value) {
    el.detailsCompleted.value = todayInputValue();
  }
  syncDateDisplay(el.detailsCompleted);
}

function hasValidTicketDates(submittedDate, completedDate) {
  if (submittedDate && completedDate && completedDate < submittedDate) {
    return false;
  }

  return true;
}

function validateTicketDates(submittedDate, completedDate) {
  if (!hasValidTicketDates(submittedDate, completedDate)) {
    alert("Date completed cannot be earlier than date submitted.");
    return false;
  }

  return true;
}

function getDuplicateTicket(ticketCode, excludeId = "") {
  const normalizedCode = normalizeTicketCode(ticketCode);
  if (!normalizedCode) return null;

  return getTickets().find((ticket) => ticket.id !== excludeId && ticket.ticketCode === normalizedCode) ?? null;
}

function ensureUniqueTicketCode(ticketCode, { excludeId = "", input = null } = {}) {
  const duplicate = getDuplicateTicket(ticketCode, excludeId);
  if (!duplicate) return true;

  alert(`Ticket ID \"${normalizeTicketCode(ticketCode)}\" already exists.`);
  input?.focus();
  return false;
}

function buildTicketFromCreateForm() {
  const ticketCode = normalizeTicketCode(el.ticketCode.value);
  if (!ticketCode) {
    alert("Ticket ID is required.");
    el.ticketCode.focus();
    return null;
  }

  if (!ensureUniqueTicketCode(ticketCode, { input: el.ticketCode })) {
    return null;
  }

  const title = el.ticketTitle.value.trim();
  if (!title) {
    alert("Please enter a ticket title.");
    el.ticketTitle.focus();
    return null;
  }

  const submittedDate = readDateInput(el.ticketSubmitted, "Date submitted", { required: true });
  if (submittedDate === null) return null;

  const status = normalizeStatus(el.ticketStatus.value);
  const completedDate = readDateInput(el.ticketCompleted, "Date completed");
  if (completedDate === null) return null;

  const safeCompletedDate = completedDate || (isTerminalStatus(status) ? todayInputValue() : "");
  if (!validateTicketDates(submittedDate, safeCompletedDate)) {
    return null;
  }

  return normalizeTicket({
    id: createId("ticket"),
    ticketCode,
    highPriority: false,
    title,
    createdBy: el.ticketCreatedBy.value.trim(),
    closedBy: el.ticketClosedBy.value.trim(),
    submittedDate,
    completedDate: safeCompletedDate,
    status,
    details: el.ticketDetails.value.trim(),
    changeReason: el.ticketChangeReason.value.trim(),
    expectedBenefit: el.ticketExpectedBenefit.value.trim(),
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notes: []
  });
}

function getSelectedDetailsPriority() {
  const ticketId = el.detailsId.value;
  if (!ticketId) return false;

  const ticket = getTickets().find((item) => item.id === ticketId);
  return Boolean(ticket?.highPriority);
}

function updateDetailsPriorityVisual({ status, highPriority }) {
  const ticket = { status, highPriority };
  el.detailsStatusBadge.className = `badge ${getTicketBadgeClass(ticket)}`;
  el.detailsStatusBadge.textContent = getStatusConfig(status).label;
  el.detailsDayCount.className = `day-count ${getTicketDayCountClass(ticket)}`;
  el.priorityTicketBtn.textContent = highPriority ? "Clear High Priority" : "Mark High Priority";
}

function renderDayCount(days) {
  return `<span class="day-count-value">${days}</span><span class="day-count-label">days</span>`;
}

function renderDetails(ticket) {
  if (!ticket) {
    el.detailsEmpty.classList.remove("hidden");
    el.detailsPanel.classList.add("hidden");
    el.detailsId.value = "";
    el.detailsCode.value = "";
    el.detailsTitle.value = "";
    el.detailsCreatedBy.value = "";
    el.detailsClosedBy.value = "";
    el.detailsSubmitted.value = todayInputValue();
    el.detailsCompleted.value = "";
    el.detailsStatus.value = "inprogress";
    el.detailsText.value = "";
    el.detailsChangeReason.value = "";
    el.detailsExpectedBenefit.value = "";
    el.noteText.value = "";
    el.detailsMeta.textContent = "";
    el.detailsStatusBadge.className = "badge badge-muted";
    el.detailsStatusBadge.textContent = "Select a ticket";
    el.detailsDayCount.className = "day-count day-count-muted";
    el.detailsDayCount.innerHTML = renderDayCount(0);
    el.noteCount.textContent = "0 notes";
    el.noteList.innerHTML = '<div class="empty-queue">No updates yet for this ticket.</div>';
    syncAllDateDisplays();
    return;
  }

  el.detailsEmpty.classList.add("hidden");
  el.detailsPanel.classList.remove("hidden");

  el.detailsId.value = ticket.id;
  el.detailsCode.value = ticket.ticketCode;
  el.detailsTitle.value = ticket.title;
  el.detailsCreatedBy.value = ticket.createdBy;
  el.detailsClosedBy.value = ticket.closedBy;
  el.detailsSubmitted.value = ticket.submittedDate;
  el.detailsCompleted.value = ticket.completedDate;
  el.detailsStatus.value = ticket.status;
  el.detailsText.value = ticket.details;
  el.detailsChangeReason.value = ticket.changeReason;
  el.detailsExpectedBenefit.value = ticket.expectedBenefit;

  updateDetailsPriorityVisual({
    status: ticket.status,
    highPriority: ticket.highPriority
  });
  el.detailsDayCount.innerHTML = renderDayCount(getTicketElapsedDays(ticket));

  const archivedText = ticket.archived ? "Yes" : "No";
  el.detailsMeta.textContent = [
    `Ticket ID ${ticket.ticketCode || "—"}`,
    `Created by ${ticket.createdBy || "—"}`,
    `Closed by ${ticket.closedBy || "—"}`,
    `High Priority ${ticket.highPriority ? "Yes" : "No"}`,
    `Submitted ${formatDisplayDate(ticket.submittedDate)}`,
    `Completed ${formatDisplayDate(ticket.completedDate)}`,
    `Last updated ${formatDateTime(ticket.updatedAt)}`,
    `Archived ${archivedText}`
  ].join(" • ");

  el.archiveTicketBtn.textContent = ticket.archived ? "Restore Ticket" : "Archive Ticket";

  const notes = [...ticket.notes].sort((a, b) => b.createdAt - a.createdAt);
  el.noteCount.textContent = pluralize(notes.length, "note");
  el.noteList.innerHTML = notes.length
    ? notes.map((note) => `
        <div class="note-card">
          <div class="note-meta">${escapeHtml(formatDateTime(note.createdAt))}</div>
          <div class="note-text">${escapeHtml(note.text)}</div>
        </div>
      `).join("")
    : '<div class="empty-queue">No updates yet for this ticket.</div>';

  syncAllDateDisplays();
}

function buildTicketCard(ticket, selectedId) {
  const config = getStatusConfig(ticket.status);
  const preview = ticket.details ? escapeHtml(ticket.details) : "No details added yet.";
  const previewClass = ticket.details ? "ticket-preview" : "ticket-preview is-empty";
  const archivedLabel = ticket.archived ? " • Archived" : "";
  const elapsedDays = getTicketElapsedDays(ticket);
  const codeHtml = ticket.ticketCode
    ? `<div class="ticket-code">${escapeHtml(ticket.ticketCode)}</div>`
    : "";

  return `
    <article class="ticket-card ${config.cardClass} ${ticket.id === selectedId ? "is-selected" : ""} ${ticket.archived ? "is-archived" : ""}" data-ticket-id="${ticket.id}">
      <div class="ticket-top">
        <div class="ticket-main">
          ${codeHtml}
          <div class="ticket-title">${escapeHtml(ticket.title)}</div>
          <div class="ticket-meta">
            <span>Submitted: ${escapeHtml(formatDisplayDate(ticket.submittedDate))}</span>
            <span>Completed: ${escapeHtml(formatDisplayDate(ticket.completedDate))}</span>
            <span>Created by: ${escapeHtml(ticket.createdBy || "—")}</span>
            <span>Closed by: ${escapeHtml(ticket.closedBy || "—")}</span>
            <span>${pluralize(ticket.notes.length, "note")}${archivedLabel}</span>
          </div>
        </div>
        <div class="status-stack">
          <span class="badge ${getTicketBadgeClass(ticket)}">${config.label}</span>
          <div class="day-count ${getTicketDayCountClass(ticket)}" title="${escapeHtml(pluralize(elapsedDays, "day"))}">
            ${renderDayCount(elapsedDays)}
          </div>
        </div>
      </div>
      <div class="${previewClass}">${preview}</div>
      <div class="ticket-actions">
        <button class="${ticket.archived ? "btn-ok" : "btn-info"}" type="button" data-act="archive" data-id="${ticket.id}">
          ${ticket.archived ? "Restore" : "Archive"}
        </button>
        <button class="btn-danger" type="button" data-act="delete" data-id="${ticket.id}">Delete</button>
      </div>
    </article>
  `;
}

function buildBannerHtml(tickets) {
  const activeTickets = tickets.filter((ticket) => !ticket.archived);
  const highPriorityCount = activeTickets.filter((ticket) => ticket.highPriority).length;
  const waitingCount = activeTickets.filter((ticket) => ticket.status === "waiting").length;
  const inProgressCount = activeTickets.filter((ticket) => ticket.status === "inprogress").length;
  const completedCount = activeTickets.filter((ticket) => ticket.status === "completed").length;
  const canceledCount = activeTickets.filter((ticket) => ticket.status === "canceled").length;
  const abandonedCount = activeTickets.filter((ticket) => ticket.status === "abandoned").length;
  const rejectedCount = activeTickets.filter((ticket) => ticket.status === "rejected").length;
  const archivedCount = tickets.length - activeTickets.length;

  return [
    `<span class="proj priority">High Prio: ${highPriorityCount}</span>`,
    `<span class="proj waiting">Requires Approval: ${waitingCount}</span>`,
    `<span class="proj inprogress">In Progress: ${inProgressCount}</span>`,
    `<span class="proj completed">Completed: ${completedCount}</span>`,
    `<span class="proj canceled">Canceled: ${canceledCount}</span>`,
    `<span class="proj abandoned">Abandoned: ${abandonedCount}</span>`,
    `<span class="proj rejected">Rejected: ${rejectedCount}</span>`,
    `<span class="proj archived">Archived: ${archivedCount}</span>`
  ].join('<span class="sep">◆</span>');
}

const ANALYTICS_STATUS_COLORS = {
  inprogress: "#ffd166",
  waiting: "#ff9800",
  completed: "#8ed081",
  canceled: "#8b96a2",
  abandoned: "#7890a8",
  rejected: "#ff7477"
};

function formatAnalyticsNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function formatAnalyticsDays(value) {
  if (!Number.isFinite(value)) return "—";
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${formatAnalyticsNumber(value, digits)}d`;
}

function formatAnalyticsPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${formatAnalyticsNumber(value, 1)}%`;
}

function buildAnalyticsComparison(current, previous, {
  unit = "",
  lowerIsBetter = false,
  higherIsBetter = false
} = {}) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) {
    return { text: "No prior-period baseline", className: "" };
  }

  const difference = current - previous;
  if (Math.abs(difference) < 0.05) {
    return { text: "No change vs prior period", className: "" };
  }

  const rounded = Math.abs(difference) < 10
    ? formatAnalyticsNumber(Math.abs(difference), 1)
    : formatAnalyticsNumber(Math.abs(difference));
  const direction = difference > 0 ? "+" : "−";
  let className = "";
  if (lowerIsBetter) className = difference < 0 ? "is-good" : "is-bad";
  if (higherIsBetter) className = difference > 0 ? "is-good" : "is-bad";
  return {
    text: `${direction}${rounded}${unit} vs prior period`,
    className
  };
}

function renderAnalyticsKpi({
  label,
  description,
  value,
  comparison,
  note = "",
  technicalDefinition = "",
  tone = "cyan",
  index = 0
}) {
  const compare = comparison || { text: "", className: "" };
  const valueClass = value.length > 13 ? " is-long" : "";
  return `
    <article class="analytics-kpi tone-${tone}" style="animation-delay:${index * 35}ms" title="${escapeHtml(technicalDefinition)}">
      <div class="analytics-kpi-label">${escapeHtml(label)}</div>
      <div class="analytics-kpi-description">${escapeHtml(description)}</div>
      <div class="analytics-kpi-value${valueClass}">${escapeHtml(value)}</div>
      <div class="analytics-kpi-compare ${compare.className}">${escapeHtml(compare.text)}</div>
      ${note ? `<div class="analytics-kpi-note">${escapeHtml(note)}</div>` : ""}
    </article>
  `;
}

function renderAnalyticsPanelHeader(title, description, legend = "") {
  return `
    <div class="analytics-panel-head">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      ${legend}
    </div>
  `;
}

function renderThroughputChart(trend) {
  if (!trend.length) return '<div class="analytics-empty">No throughput data in this period.</div>';
  const maximum = Math.max(1, ...trend.flatMap((bucket) => [
    bucket.created,
    bucket.completed,
    bucket.unsuccessful
  ]));

  return `
    <div class="analytics-throughput" aria-label="Received, completed, and unsuccessful ticket outcomes by period">
      ${trend.map((bucket) => {
        const height = (value) => value ? Math.max(4, (value / maximum) * 100) : 1;
        return `
          <div class="analytics-period-column">
            <div class="analytics-period-bars">
              <i class="analytics-bar created" style="height:${height(bucket.created)}%" title="${escapeHtml(`${bucket.label}: ${bucket.created} created`)}"></i>
              <i class="analytics-bar completed" style="height:${height(bucket.completed)}%" title="${escapeHtml(`${bucket.label}: ${bucket.completed} completed`)}"></i>
              <i class="analytics-bar unsuccessful" style="height:${height(bucket.unsuccessful)}%" title="${escapeHtml(`${bucket.label}: ${bucket.unsuccessful} unsuccessful outcomes`)}"></i>
            </div>
            <div class="analytics-period-label" title="${escapeHtml(bucket.label)}">${escapeHtml(bucket.label)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderAnalyticsLineChart(trend, series) {
  const width = 820;
  const height = 240;
  const paddingX = 42;
  const paddingTop = 16;
  const paddingBottom = 34;
  const values = trend.flatMap((bucket) => series.map((item) => bucket[item.key]))
    .filter(Number.isFinite);
  if (!values.length) {
    return '<div class="analytics-empty">Not enough completed-ticket data for this chart.</div>';
  }

  const maximum = Math.max(1, ...values);
  const plotWidth = width - (paddingX * 2);
  const plotHeight = height - paddingTop - paddingBottom;
  const xFor = (index) => trend.length === 1
    ? width / 2
    : paddingX + ((index / (trend.length - 1)) * plotWidth);
  const yFor = (value) => paddingTop + (plotHeight - ((value / maximum) * plotHeight));
  const gridValues = [maximum, maximum / 2, 0];
  const labelStep = Math.max(1, Math.ceil(trend.length / 7));

  const paths = series.map((item) => {
    const points = trend
      .map((bucket, index) => ({ value: bucket[item.key], index, label: bucket.label }))
      .filter((point) => Number.isFinite(point.value));
    if (!points.length) return "";
    const pointList = points.map((point) => `${xFor(point.index)},${yFor(point.value)}`).join(" ");
    const circles = points.map((point) => `
      <circle cx="${xFor(point.index)}" cy="${yFor(point.value)}" r="3.5" fill="${item.color}">
        <title>${escapeHtml(`${point.label}: ${formatAnalyticsNumber(point.value, 1)}${item.unit || ""}`)}</title>
      </circle>
    `).join("");
    return `
      <polyline points="${pointList}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${circles}
    `;
  }).join("");

  const xLabels = trend.map((bucket, index) => {
    if (index % labelStep !== 0 && index !== trend.length - 1) return "";
    return `<text class="analytics-chart-axis" x="${xFor(index)}" y="${height - 8}" text-anchor="middle">${escapeHtml(bucket.label)}</text>`;
  }).join("");

  return `
    <svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(series.map((item) => item.label).join(" and "))}">
      ${gridValues.map((value) => {
        const y = yFor(value);
        return `
          <line class="analytics-chart-grid" x1="${paddingX}" x2="${width - paddingX}" y1="${y}" y2="${y}"></line>
          <text class="analytics-chart-axis" x="${paddingX - 8}" y="${y + 3}" text-anchor="end">${escapeHtml(formatAnalyticsNumber(value, value < 10 ? 1 : 0))}</text>
        `;
      }).join("")}
      ${paths}
      ${xLabels}
    </svg>
  `;
}

function renderAnalyticsBreakdown(rows, total, colorByKey = {}) {
  if (!rows.some((row) => row.count)) {
    return '<div class="analytics-empty">No tickets available for this breakdown.</div>';
  }
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return `
    <div class="analytics-breakdown">
      ${rows.map((row) => `
        <div class="analytics-breakdown-row">
          <div class="analytics-breakdown-label">${escapeHtml(row.label)}</div>
          <div class="analytics-meter"><span style="width:${(row.count / maximum) * 100}%;background:${colorByKey[row.key] || "#35e3db"}"></span></div>
          <div class="analytics-breakdown-value">${row.count} · ${total ? formatAnalyticsPercent((row.count / total) * 100) : "0.0%"}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStatusPanel(model) {
  const labels = {
    inprogress: "In Progress",
    waiting: "Requires Approval",
    completed: "Completed",
    canceled: "Canceled",
    abandoned: "Abandoned",
    rejected: "Rejected"
  };
  const total = model.summary.createdCount;
  const segments = model.statusBreakdown.map((item) => `
    <span
      class="analytics-status-segment"
      style="width:${total ? (item.count / total) * 100 : 0}%;background:${ANALYTICS_STATUS_COLORS[item.status]}"
      title="${escapeHtml(`${labels[item.status]}: ${item.count}`)}"
    ></span>
  `).join("");
  const rows = model.statusBreakdown.map((item) => ({
    key: item.status,
    label: labels[item.status],
    count: item.count
  }));
  return `
    <div class="analytics-status-bar">${segments}</div>
    ${renderAnalyticsBreakdown(rows, total, ANALYTICS_STATUS_COLORS)}
  `;
}

function renderCreatorTable(model) {
  if (!model.creators.length) return '<div class="analytics-empty">No creators in this period.</div>';
  return `
    <div class="analytics-table-wrap">
      <table class="analytics-table">
        <thead><tr><th>Created by</th><th>Tickets</th><th>Share</th><th>Completed</th><th>Cohort rate</th><th>High prio</th></tr></thead>
        <tbody>
          ${model.creators.map((row) => `
            <tr>
              <td class="analytics-person ${row.key === "__missing__" ? "is-missing" : ""}">${escapeHtml(row.name)}</td>
              <td>${row.count}</td>
              <td>${formatAnalyticsPercent((row.count / model.summary.createdCount) * 100)}</td>
              <td>${row.completed}</td>
              <td>${formatAnalyticsPercent((row.completed / row.count) * 100)}</td>
              <td>${row.highPriority}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCloserTable(model) {
  if (!model.closers.length) return '<div class="analytics-empty">No closed tickets in this period.</div>';
  return `
    <div class="analytics-table-wrap">
      <table class="analytics-table">
        <thead><tr><th>Closed by</th><th>Closed</th><th>Share</th><th>Completed</th><th>Canceled</th><th>Abandoned</th><th>Rejected</th><th>Median</th><th>P90</th></tr></thead>
        <tbody>
          ${model.closers.map((row) => `
            <tr>
              <td class="analytics-person ${row.key === "__missing__" ? "is-missing" : ""}">${escapeHtml(row.name)}</td>
              <td>${row.count}</td>
              <td>${formatAnalyticsPercent((row.count / model.summary.terminalCount) * 100)}</td>
              <td>${row.completed}</td>
              <td>${row.canceled}</td>
              <td>${row.abandoned}</td>
              <td>${row.rejected}</td>
              <td>${formatAnalyticsDays(row.medianResolution)}</td>
              <td>${formatAnalyticsDays(row.p90Resolution)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPriorityPanel(model) {
  const rows = [
    { label: "Created high priority", value: String(model.priority.created) },
    { label: "Completed high priority", value: String(model.priority.completed) },
    { label: "Open high priority", value: String(model.priority.open) },
    { label: "Cohort completion rate", value: formatAnalyticsPercent(model.priority.cohortCompletionRate) },
    { label: "Median resolution", value: formatAnalyticsDays(model.priority.medianResolution) }
  ];
  return `
    <div class="analytics-quality-list">
      ${rows.map((row) => `
        <div class="analytics-quality-item">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderQualityPanel(model) {
  return `
    <div class="analytics-quality-list">
      ${model.quality.map((item) => `
        <div class="analytics-quality-item">
          <span>${escapeHtml(item.label)}</span>
          <strong>${item.count}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function analyticsTicketLabel(item) {
  if (!item?.ticket) return "—";
  return item.ticket.ticketCode || item.ticket.title || "Untitled ticket";
}

function renderHighlights(model) {
  const highlights = model.highlights;
  const netFlowLabel = highlights.netFlow > 0
    ? `+${highlights.netFlow}`
    : String(highlights.netFlow);
  const cards = [
    {
      label: "Net ticket flow",
      value: netFlowLabel,
      note: highlights.netFlow > 0
        ? "More tickets entered than reached a terminal state"
        : highlights.netFlow < 0
          ? "The team reduced the reconstructed backlog"
          : "Incoming and terminal-state volume were balanced"
    },
    {
      label: "Peak intake period",
      value: highlights.peak?.label || "—",
      note: highlights.peak ? pluralize(highlights.peak.created, "ticket") + " created" : "No intake data"
    },
    {
      label: "Fastest completion",
      value: analyticsTicketLabel(highlights.fastest),
      note: highlights.fastest ? `${formatAnalyticsDays(highlights.fastest.days)} resolution` : "No completed tickets"
    },
    {
      label: "Slowest completion",
      value: analyticsTicketLabel(highlights.slowest),
      note: highlights.slowest ? `${formatAnalyticsDays(highlights.slowest.days)} resolution` : "No completed tickets"
    },
    {
      label: "Oldest open ticket",
      value: analyticsTicketLabel(highlights.oldestOpen),
      note: highlights.oldestOpen ? `${formatAnalyticsDays(highlights.oldestOpen.days)} open at period end` : "No open tickets"
    },
    {
      label: "Highest closure volume",
      value: highlights.busiestCloser?.name || "—",
      note: highlights.busiestCloser ? pluralize(highlights.busiestCloser.count, "closure") : "No closure data"
    }
  ];

  return `<div class="analytics-highlights">${cards.map((card) => `
    <article class="analytics-highlight">
      <div class="analytics-highlight-label">${escapeHtml(card.label)}</div>
      <div class="analytics-highlight-value">${escapeHtml(card.value)}</div>
      <div class="analytics-highlight-note">${escapeHtml(card.note)}</div>
    </article>
  `).join("")}</div>`;
}

function getAnalyticsSettings() {
  return {
    range: el.analyticsRange.value,
    grouping: el.analyticsGrouping.value,
    status: el.analyticsStatus.value,
    priority: el.analyticsPriority.value,
    creator: el.analyticsCreator.value,
    closer: el.analyticsCloser.value,
    today: todayInputValue()
  };
}

function syncAnalyticsPersonSelect(select, people, allLabel) {
  const selectedValue = select.value || "all";
  select.replaceChildren();
  select.add(new Option(allLabel, "all"));
  people.forEach((person) => {
    select.add(new Option(`${person.label} (${person.count})`, person.key));
  });
  select.value = [...select.options].some((option) => option.value === selectedValue)
    ? selectedValue
    : "all";
}

function syncAnalyticsPersonFilters() {
  const analytics = window.FoxTicketAnalytics;
  if (!analytics) return;
  const tickets = getTickets();
  syncAnalyticsPersonSelect(
    el.analyticsCreator,
    analytics.collectPeople(tickets, "createdBy"),
    "All creators"
  );
  syncAnalyticsPersonSelect(
    el.analyticsCloser,
    analytics.collectPeople(tickets, "closedBy"),
    "All closers"
  );
}

function renderAnalytics() {
  const analytics = window.FoxTicketAnalytics;
  if (!analytics) {
    el.analyticsContent.innerHTML = '<div class="analytics-empty">Analytics engine could not be loaded.</div>';
    return;
  }

  const model = analytics.buildModel(getTickets(), getAnalyticsSettings());
  const summary = model.summary;
  const previous = model.previous;
  const periodStart = formatDisplayDate(analytics.toIsoDate(model.period.start));
  const periodEnd = formatDisplayDate(analytics.toIsoDate(model.period.end));
  const groupingLabel = `${model.period.grouping[0].toUpperCase()}${model.period.grouping.slice(1)}ly`;
  const activeFilters = [
    model.settings.status !== "all",
    model.settings.priority !== "all",
    model.settings.creator !== "all",
    model.settings.closer !== "all"
  ].filter(Boolean).length;
  el.analyticsScope.textContent = `${periodStart} to ${periodEnd} · ${groupingLabel} trend · ${pluralize(model.totalTickets, "ticket")} in repository scope${activeFilters ? ` · ${activeFilters} active filters` : ""}`;

  const kpis = [
    {
      label: "Repository tickets",
      description: "All tickets matching the current filters",
      value: formatAnalyticsNumber(model.totalTickets),
      comparison: { text: "Current filtered dataset", className: "" },
      technicalDefinition: "Total tickets in tickets.json after applying status, priority, creator, and closer filters."
    },
    {
      label: "Tickets created",
      description: "Tickets submitted during the selected period",
      value: formatAnalyticsNumber(summary.createdCount),
      comparison: buildAnalyticsComparison(summary.createdCount, previous?.createdCount)
    },
    {
      label: "Tickets completed",
      description: "Successful completions during the period",
      value: formatAnalyticsNumber(summary.completedCount),
      comparison: buildAnalyticsComparison(summary.completedCount, previous?.completedCount, { higherIsBetter: true }),
      tone: "green"
    },
    {
      label: "Tickets canceled",
      description: "Canceled tickets closed during the period",
      value: formatAnalyticsNumber(summary.canceledCount),
      comparison: buildAnalyticsComparison(summary.canceledCount, previous?.canceledCount, { lowerIsBetter: true }),
      tone: "amber"
    },
    {
      label: "Open at period end",
      description: "In Progress or Requires Approval tickets",
      value: formatAnalyticsNumber(summary.openCount),
      comparison: buildAnalyticsComparison(summary.openCount, previous?.openCount, { lowerIsBetter: true }),
      tone: "amber"
    },
    {
      label: "Cohort completion",
      description: "Share of tickets received that are now completed",
      value: formatAnalyticsPercent(summary.completionRate),
      comparison: buildAnalyticsComparison(summary.completionRate, previous?.completionRate, { unit: " pts", higherIsBetter: true }),
      technicalDefinition: "Percentage of tickets submitted in the selected period whose current status is completed."
    },
    {
      label: "Median resolution",
      description: "Typical completion time in calendar days",
      value: formatAnalyticsDays(summary.medianResolution),
      comparison: buildAnalyticsComparison(summary.medianResolution, previous?.medianResolution, { unit: "d", lowerIsBetter: true }),
      technicalDefinition: "Median calendar days from submitted date to completed date for completed tickets."
    },
    {
      label: "P90 resolution",
      description: "90% of completed tickets finished within this time",
      value: formatAnalyticsDays(summary.p90Resolution),
      comparison: buildAnalyticsComparison(summary.p90Resolution, previous?.p90Resolution, { unit: "d", lowerIsBetter: true }),
      technicalDefinition: "90th percentile calendar-day resolution time for completed tickets."
    },
    {
      label: "Average open age",
      description: "Average age of the currently active workload",
      value: formatAnalyticsDays(summary.averageOpenAge),
      comparison: buildAnalyticsComparison(summary.averageOpenAge, previous?.averageOpenAge, { unit: "d", lowerIsBetter: true }),
      tone: "amber"
    },
    {
      label: "High priority open",
      description: "Active tickets currently marked high priority",
      value: formatAnalyticsNumber(summary.highPriorityOpenCount),
      comparison: buildAnalyticsComparison(summary.highPriorityOpenCount, previous?.highPriorityOpenCount, { lowerIsBetter: true }),
      tone: "red"
    }
  ];

  const throughputLegend = `
    <div class="analytics-legend">
      <span><i style="background:#35e3db"></i>Created</span>
      <span><i style="background:#8ed081"></i>Completed</span>
      <span><i style="background:#8b96a2"></i>Not completed</span>
    </div>
  `;
  const backlogLegend = '<div class="analytics-legend"><span><i style="background:#35e3db"></i>Open backlog</span></div>';
  const resolutionLegend = `
    <div class="analytics-legend">
      <span><i style="background:#8ed081"></i>Median</span>
      <span><i style="background:#ffd166"></i>P90</span>
    </div>
  `;
  const ageColors = ["#8ed081", "#35e3db", "#ffd166", "#ff9800", "#ff7477"];
  const ageColorMap = Object.fromEntries(model.ageBuckets.map((row, index) => [String(index), ageColors[index]]));
  const ageRows = model.ageBuckets.map((row, index) => ({ key: String(index), ...row }));

  el.analyticsContent.innerHTML = `
    <section class="analytics-kpis">
      ${kpis.map((kpi, index) => renderAnalyticsKpi({ ...kpi, index })).join("")}
    </section>

    <section class="analytics-grid">
      <article class="analytics-panel analytics-span-8">
        ${renderAnalyticsPanelHeader("Ticket flow", "Created versus terminal-state throughput by period", throughputLegend)}
        ${renderThroughputChart(model.trend)}
      </article>

      <article class="analytics-panel analytics-span-4">
        ${renderAnalyticsPanelHeader("Cohort status", "Current status of tickets submitted in this period")}
        ${renderStatusPanel(model)}
      </article>

      <article class="analytics-panel analytics-span-6">
        ${renderAnalyticsPanelHeader("Backlog over time", "Reconstructed open tickets at each period end", backlogLegend)}
        ${renderAnalyticsLineChart(model.trend, [
          { key: "backlog", label: "Open backlog", color: "#35e3db" }
        ])}
      </article>

      <article class="analytics-panel analytics-span-6">
        ${renderAnalyticsPanelHeader("Resolution trend", "Calendar-day median and P90 for completed tickets", resolutionLegend)}
        ${renderAnalyticsLineChart(model.trend, [
          { key: "medianResolution", label: "Median resolution", color: "#8ed081", unit: "d" },
          { key: "p90Resolution", label: "P90 resolution", color: "#ffd166", unit: "d" }
        ])}
      </article>

      <article class="analytics-panel analytics-span-4">
        ${renderAnalyticsPanelHeader("Open-ticket aging", "Age of active In Progress and Requires Approval tickets")}
        ${renderAnalyticsBreakdown(ageRows, summary.openCount, ageColorMap)}
      </article>

      <article class="analytics-panel analytics-span-4">
        ${renderAnalyticsPanelHeader("Priority performance", "High-priority demand, backlog, and completion")}
        ${renderPriorityPanel(model)}
      </article>

      <article class="analytics-panel analytics-span-4">
        ${renderAnalyticsPanelHeader("Data quality", "Missing values that weaken performance reporting")}
        ${renderQualityPanel(model)}
      </article>

      <article class="analytics-panel analytics-span-6">
        ${renderAnalyticsPanelHeader("Demand by creator", "Who submitted tickets and how their cohort progressed")}
        ${renderCreatorTable(model)}
      </article>

      <article class="analytics-panel analytics-span-6">
        ${renderAnalyticsPanelHeader("Closure performance", "Who closed tickets and how quickly successful work was completed")}
        ${renderCloserTable(model)}
      </article>

      <article class="analytics-panel analytics-span-12">
        ${renderAnalyticsPanelHeader("Operational highlights", "Extremes and pressure points in the selected period")}
        ${renderHighlights(model)}
      </article>

      <article class="analytics-panel analytics-span-12">
        ${renderAnalyticsPanelHeader("How to read these metrics", "Definitions based only on fields stored in tickets.json")}
        <div class="analytics-methodology">
          Resolution time is calendar days from Date Submitted to Date Completed for Completed tickets. Completion rate is cohort-based: tickets submitted in the selected period that are currently Completed. Canceled, Abandoned, and Rejected tickets are terminal outcomes but are not completions. Backlog is reconstructed from submitted and completed dates; reopened history and time spent in each status are not available in the current schema. Archived tickets remain part of historical performance.
        </div>
      </article>
    </section>
  `;
}

function openAnalytics() {
  state.analyticsOpen = true;
  syncAnalyticsPersonFilters();
  renderAnalytics();
  el.analyticsView.classList.remove("hidden");
  document.body.classList.add("analytics-open");
  el.analyticsView.scrollTop = 0;
  window.requestAnimationFrame(() => el.closeAnalyticsBtn.focus());
}

function closeAnalytics() {
  state.analyticsOpen = false;
  el.analyticsView.classList.add("hidden");
  document.body.classList.remove("analytics-open");
  el.analyticsBtn.focus();
}

function resetAnalyticsFilters() {
  el.analyticsRange.value = "90";
  el.analyticsGrouping.value = "auto";
  el.analyticsStatus.value = "all";
  el.analyticsPriority.value = "all";
  el.analyticsCreator.value = "all";
  el.analyticsCloser.value = "all";
  renderAnalytics();
}

let detailsTrackSyncFrame = null;

function setMutationControlsDisabled(disabled) {
  [
    el.addTicketBtn,
    el.importCsvBtn,
    el.saveTicketBtn,
    el.priorityTicketBtn,
    el.archiveTicketBtn,
    el.addNoteBtn
  ].forEach((button) => {
    button.disabled = disabled;
  });

  el.ticketList.querySelectorAll("[data-act]").forEach((button) => {
    button.disabled = disabled;
  });
}

function getSelectedTicketCard(selectedId) {
  return Array.from(el.ticketList.querySelectorAll(".ticket-card"))
    .find((card) => card.dataset.ticketId === selectedId) ?? null;
}

function clearDetailsTrackOffset() {
  el.detailsTrack.style.paddingTop = "0px";
}

function syncDetailsTrackOffset(selectedId) {
  clearDetailsTrackOffset();

  if (!selectedId || window.innerWidth <= 980) {
    return;
  }

  const selectedCard = getSelectedTicketCard(selectedId);
  if (!selectedCard) {
    return;
  }

  const trackTop = el.detailsTrack.getBoundingClientRect().top;
  const cardTop = selectedCard.getBoundingClientRect().top;
  const offset = Math.max(0, Math.round(cardTop - trackTop));

  if (offset) {
    el.detailsTrack.style.paddingTop = `${offset}px`;
  }
}

function scheduleDetailsTrackSync(selectedId = getSelectedId()) {
  if (detailsTrackSyncFrame) {
    window.cancelAnimationFrame(detailsTrackSyncFrame);
  }

  detailsTrackSyncFrame = window.requestAnimationFrame(() => {
    detailsTrackSyncFrame = null;
    syncDetailsTrackOffset(selectedId);
  });
}

function render() {
  const tickets = getTickets();
  const searchQuery = state.searchQuery;
  const showArchived = isShowArchivedEnabled();
  const activeTickets = tickets.filter((ticket) => !ticket.archived);
  const archivedCount = tickets.length - activeTickets.length;
  const visibleTickets = getVisibleTickets(tickets, showArchived, searchQuery);
  const selectedTicket = getSelectedTicket(tickets, showArchived, searchQuery);
  const counts = getCounts(activeTickets);

  el.countInProgress.textContent = String(counts.inprogress);
  el.countWaiting.textContent = String(counts.waiting);
  el.countCompleted.textContent = String(counts.completed);
  el.countCanceled.textContent = String(counts.canceled);
  el.countAbandoned.textContent = String(counts.abandoned);
  el.countRejected.textContent = String(counts.rejected);
  el.countArchived.textContent = String(archivedCount);

  if (state.repositoryError) {
    el.status.textContent = `Repository error: ${state.repositoryError}`;
  } else if (!tickets.length) {
    el.status.textContent = "No tickets yet • Repository JSON";
  } else {
    el.status.textContent = `${pluralize(activeTickets.length, "ticket")} in queue • ${pluralize(archivedCount, "archived ticket")} • Repository JSON`;
  }

  el.showArchivedBtn.classList.toggle("is-on", showArchived);
  el.showArchivedBtn.classList.toggle("is-off", !showArchived);
  el.showArchivedBtn.setAttribute("aria-pressed", String(showArchived));
  el.showArchivedState.textContent = showArchived ? "Visible" : "Hidden";

  const searchMeta = searchQuery ? " • Search active" : "";
  el.queueMeta.textContent = `${pluralize(visibleTickets.length, "ticket")} shown • ${pluralize(archivedCount, "archived ticket")}${searchMeta}`;

  if (visibleTickets.length) {
    el.ticketList.innerHTML = visibleTickets
      .map((ticket) => buildTicketCard(ticket, selectedTicket?.id ?? ""))
      .join("");
  } else {
    const emptyMessage = searchQuery
      ? "No tickets match the current search."
      : "No tickets match this view. Add a ticket, import a CSV, or show archived tickets.";
    el.ticketList.innerHTML = `<div class="empty-queue">${escapeHtml(emptyMessage)}</div>`;
  }

  renderDetails(selectedTicket);
  el.bannerText.innerHTML = buildBannerHtml(tickets);
  setMutationControlsDisabled(!state.repositoryReady || state.isSaving);
  el.analyticsBtn.disabled = !state.repositoryReady;
  if (state.analyticsOpen) {
    syncAnalyticsPersonFilters();
    renderAnalytics();
  }
  scheduleDetailsTrackSync(selectedTicket?.id ?? "");
}

async function addTicket() {
  const ticket = buildTicketFromCreateForm();
  if (!ticket) return;

  const tickets = getTickets();
  tickets.push(ticket);
  if (!await saveTickets(tickets)) return;
  setSelectedId(ticket.id);
  clearCreateForm();
  render();
}

let detailsFocusTimer = null;

function exportTicketsCsv() {
  const tickets = getTickets().sort(compareTickets);
  if (!tickets.length) {
    alert("There are no tickets to export.");
    return;
  }

  const rows = [CSV_EXPORT_HEADERS];

  for (const ticket of tickets) {
    rows.push([
      ticket.id,
      ticket.ticketCode,
      ticket.title,
      ticket.createdBy,
      ticket.closedBy,
      ticket.status,
      ticket.highPriority ? "true" : "false",
      ticket.submittedDate,
      ticket.completedDate,
      ticket.archived ? "true" : "false",
      ticket.details,
      ticket.changeReason,
      ticket.expectedBenefit,
      JSON.stringify(ticket.notes),
      String(ticket.createdAt),
      String(ticket.updatedAt)
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
  downloadFile(`fox-ticket-tracker_${todayInputValue()}.csv`, csv, "text/csv;charset=utf-8");
}

function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normalizeHeaderKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildCsvHeaderIndex(headers) {
  const normalizedHeaders = headers.map(normalizeHeaderKey);
  const indexByKey = {};

  for (const [canonicalKey, aliases] of Object.entries(CSV_HEADER_ALIASES)) {
    indexByKey[canonicalKey] = normalizedHeaders.findIndex((header) => aliases.includes(header));
  }

  return indexByKey;
}

function getCsvCell(row, headerIndex, key) {
  const index = headerIndex[key];
  if (index < 0) return "";
  return String(row[index] ?? "").trim();
}

function buildImportedTickets(rows) {
  if (!rows.length) {
    throw new Error("CSV file is empty.");
  }

  const headerIndex = buildCsvHeaderIndex(rows[0]);
  if (headerIndex.ticketCode < 0) {
    throw new Error("CSV must include a Ticket ID column.");
  }

  const seenCodes = new Set();
  const usedIds = new Set();
  const importedTickets = [];

  rows.slice(1).forEach((row, rowIndex) => {
    if (!row.some((cell) => String(cell ?? "").trim())) {
      return;
    }

    const csvRowNumber = rowIndex + 2;
    const ticketCode = normalizeTicketCode(getCsvCell(row, headerIndex, "ticketCode"));
    if (!ticketCode) {
      throw new Error(`Row ${csvRowNumber}: Ticket ID is required.`);
    }

    if (seenCodes.has(ticketCode)) {
      throw new Error(`Row ${csvRowNumber}: Ticket ID \"${ticketCode}\" is duplicated in the CSV.`);
    }

    const title = getCsvCell(row, headerIndex, "title") || "Untitled Ticket";
    const status = parseImportedStatus(getCsvCell(row, headerIndex, "status"));
    const submittedDate = parseImportedDate(getCsvCell(row, headerIndex, "submittedDate")) || todayInputValue();
    const completedDate = parseImportedDate(getCsvCell(row, headerIndex, "completedDate"));
    const safeCompletedDate = completedDate || (isTerminalStatus(status) ? todayInputValue() : "");

    if (!hasValidTicketDates(submittedDate, safeCompletedDate)) {
      throw new Error(`Row ${csvRowNumber}: Date completed cannot be earlier than date submitted.`);
    }

    let ticketId = getCsvCell(row, headerIndex, "id");
    if (!ticketId || usedIds.has(ticketId)) {
      ticketId = createId("ticket");
    }

    usedIds.add(ticketId);
    seenCodes.add(ticketCode);

    const createdAt = parseImportedDateTime(getCsvCell(row, headerIndex, "createdAt")) ?? Date.now();
    const updatedAt = parseImportedDateTime(getCsvCell(row, headerIndex, "updatedAt")) ?? createdAt;

    importedTickets.push(normalizeTicket({
      id: ticketId,
      ticketCode,
      title,
      createdBy: getCsvCell(row, headerIndex, "createdBy"),
      closedBy: getCsvCell(row, headerIndex, "closedBy"),
      status,
      highPriority: parseBoolean(getCsvCell(row, headerIndex, "highPriority")),
      submittedDate,
      completedDate: safeCompletedDate,
      archived: parseBoolean(getCsvCell(row, headerIndex, "archived")),
      details: getCsvCell(row, headerIndex, "details"),
      changeReason: getCsvCell(row, headerIndex, "changeReason"),
      expectedBenefit: getCsvCell(row, headerIndex, "expectedBenefit"),
      notes: parseNotesCell(getCsvCell(row, headerIndex, "notes")),
      createdAt,
      updatedAt
    }));
  });

  return importedTickets;
}

async function importTicketsFromCsvFile(file) {
  const rawCsv = await file.text();
  const rows = parseCsv(rawCsv);
  const importedTickets = buildImportedTickets(rows);

  if (!importedTickets.length) {
    throw new Error("CSV did not contain any tickets to import.");
  }

  const confirmed = window.confirm(
    `Replace the current dataset with ${pluralize(importedTickets.length, "ticket")} from \"${file.name}\"?`
  );
  if (!confirmed) return;

  if (!await saveTickets(importedTickets)) return;
  setSelectedId(importedTickets[0]?.id ?? "");
  state.searchQuery = "";
  el.ticketSearch.value = "";
  clearCreateForm();
  el.noteText.value = "";
  render();
}

function spotlightDetailsSection(shouldScroll) {
  if (!el.detailsSection) return;

  el.detailsSection.classList.remove("details-focus");
  void el.detailsSection.offsetWidth;
  el.detailsSection.classList.add("details-focus");

  if (detailsFocusTimer) {
    window.clearTimeout(detailsFocusTimer);
  }

  detailsFocusTimer = window.setTimeout(() => {
    el.detailsSection.classList.remove("details-focus");
  }, 900);

  if (shouldScroll) {
    el.detailsSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function openTicketDetails(ticketId, { shouldScroll = false } = {}) {
  if (!ticketId) return;
  setSelectedId(ticketId);
  render();
  window.requestAnimationFrame(() => {
    spotlightDetailsSection(shouldScroll);
  });
}

async function deleteTicket(ticketId) {
  const tickets = getTickets();
  const ticket = tickets.find((item) => item.id === ticketId);
  if (!ticket) return;

  const confirmed = confirm(`Are you sure you want to delete \"${ticket.title}\"? This cannot be undone.`);
  if (!confirmed) return;

  if (!await saveTickets(tickets.filter((item) => item.id !== ticketId))) return;
  render();
}

async function saveSelectedTicket() {
  const ticketId = el.detailsId.value;
  if (!ticketId) return;

  const ticketCode = normalizeTicketCode(el.detailsCode.value);
  if (!ticketCode) {
    alert("Ticket ID is required.");
    el.detailsCode.focus();
    return;
  }

  if (!ensureUniqueTicketCode(ticketCode, { excludeId: ticketId, input: el.detailsCode })) {
    return;
  }

  const title = el.detailsTitle.value.trim();
  if (!title) {
    alert("Ticket title cannot be empty.");
    el.detailsTitle.focus();
    return;
  }

  const submittedDate = readDateInput(el.detailsSubmitted, "Date submitted", { required: true });
  if (submittedDate === null) return;

  const status = normalizeStatus(el.detailsStatus.value);
  const completedDate = readDateInput(el.detailsCompleted, "Date completed");
  if (completedDate === null) return;

  const safeCompletedDate = completedDate || (isTerminalStatus(status) ? todayInputValue() : "");
  if (!validateTicketDates(submittedDate, safeCompletedDate)) {
    return;
  }

  const tickets = getTickets().map((ticket) => {
    if (ticket.id !== ticketId) return ticket;
    return normalizeTicket({
      ...ticket,
      ticketCode,
      title,
      createdBy: el.detailsCreatedBy.value.trim(),
      closedBy: el.detailsClosedBy.value.trim(),
      submittedDate,
      completedDate: safeCompletedDate,
      status,
      details: el.detailsText.value.trim(),
      changeReason: el.detailsChangeReason.value.trim(),
      expectedBenefit: el.detailsExpectedBenefit.value.trim(),
      updatedAt: Date.now()
    });
  });

  if (!await saveTickets(tickets)) return;
  render();
}

async function toggleTicketArchive(ticketId) {
  const tickets = getTickets().map((ticket) => {
    if (ticket.id !== ticketId) return ticket;
    return normalizeTicket({
      ...ticket,
      archived: !ticket.archived,
      updatedAt: Date.now()
    });
  });

  if (!await saveTickets(tickets)) return;
  render();
}

async function toggleTicketPriority(ticketId) {
  const tickets = getTickets().map((ticket) => {
    if (ticket.id !== ticketId) return ticket;
    return normalizeTicket({
      ...ticket,
      highPriority: !ticket.highPriority,
      updatedAt: Date.now()
    });
  });

  if (!await saveTickets(tickets)) return;
  render();
}

async function addNoteToSelectedTicket() {
  const ticketId = el.detailsId.value;
  const noteText = el.noteText.value.trim();
  if (!ticketId) return;

  if (!noteText) {
    alert("Enter a note before adding it.");
    el.noteText.focus();
    return;
  }

  const nextNote = {
    id: createId("note"),
    text: noteText,
    createdAt: Date.now()
  };

  const tickets = getTickets().map((ticket) => {
    if (ticket.id !== ticketId) return ticket;
    return normalizeTicket({
      ...ticket,
      notes: [...ticket.notes, nextNote],
      updatedAt: Date.now()
    });
  });

  if (!await saveTickets(tickets)) return;
  el.noteText.value = "";
  render();
}

function syncTicketCodeInputs() {
  el.ticketCode.value = normalizeTicketCode(el.ticketCode.value);
  el.detailsCode.value = normalizeTicketCode(el.detailsCode.value);
}

el.addTicketBtn.addEventListener("click", () => {
  void addTicket();
});
el.importCsvBtn.addEventListener("click", () => {
  el.csvImportInput.click();
});
el.csvImportInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await importTicketsFromCsvFile(file);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not import that CSV file.");
  } finally {
    event.target.value = "";
  }
});
el.exportCsvBtn.addEventListener("click", exportTicketsCsv);
el.analyticsBtn.addEventListener("click", openAnalytics);
el.closeAnalyticsBtn.addEventListener("click", closeAnalytics);
el.resetAnalyticsBtn.addEventListener("click", resetAnalyticsFilters);
[
  el.analyticsRange,
  el.analyticsGrouping,
  el.analyticsStatus,
  el.analyticsPriority,
  el.analyticsCreator,
  el.analyticsCloser
].forEach((control) => {
  control.addEventListener("change", renderAnalytics);
});
el.clearFormBtn.addEventListener("click", clearCreateForm);
el.ticketSearch.addEventListener("input", () => {
  state.searchQuery = normalizeSearchQuery(el.ticketSearch.value);
  render();
});
el.ticketStatus.addEventListener("change", syncCreateCompletedDate);
el.detailsStatus.addEventListener("change", () => {
  syncDetailsCompletedDate();
  updateDetailsPriorityVisual({
    status: el.detailsStatus.value,
    highPriority: getSelectedDetailsPriority()
  });
});

const dateInputs = [
  el.ticketSubmitted,
  el.ticketCompleted,
  el.detailsSubmitted,
  el.detailsCompleted
];

dateInputs.forEach((input) => {
  input.addEventListener("change", () => syncDateDisplay(input));
  input.addEventListener("input", () => syncDateDisplay(input));
  input.addEventListener("click", () => input.showPicker?.());
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.showPicker?.();
    }
  });
});

[el.ticketCode, el.detailsCode].forEach((input) => {
  input.addEventListener("blur", syncTicketCodeInputs);
});

el.priorityTicketBtn.addEventListener("click", () => {
  if (el.detailsId.value) {
    void toggleTicketPriority(el.detailsId.value);
  }
});

el.showArchivedBtn.addEventListener("click", () => {
  setShowArchivedEnabled(!isShowArchivedEnabled());
  render();
});
el.saveTicketBtn.addEventListener("click", () => {
  void saveSelectedTicket();
});
el.archiveTicketBtn.addEventListener("click", () => {
  if (el.detailsId.value) {
    void toggleTicketArchive(el.detailsId.value);
  }
});
el.addNoteBtn.addEventListener("click", () => {
  void addNoteToSelectedTicket();
});

el.ticketList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) {
    const ticketId = button.dataset.id;
    if (!ticketId) return;

    if (button.dataset.act === "archive") {
      void toggleTicketArchive(ticketId);
    }

    if (button.dataset.act === "delete") {
      void deleteTicket(ticketId);
    }
    return;
  }

  const card = event.target.closest(".ticket-card");
  if (!card) return;
  openTicketDetails(card.dataset.ticketId || "");
});

el.noteText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    void addNoteToSelectedTicket();
  }
});

window.addEventListener("resize", () => {
  scheduleDetailsTrackSync();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.analyticsOpen) {
    closeAnalytics();
  }
});

async function init() {
  clearCreateForm();
  el.status.textContent = "Loading tickets...";

  try {
    await hydrateTickets();
  } catch (error) {
    console.error(error);
    state.repositoryReady = false;
    state.repositoryError = error instanceof Error
      ? error.message
      : "Could not load repository data.";
  }

  render();
}

void init();
