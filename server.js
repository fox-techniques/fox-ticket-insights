"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "tickets.json");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const VALID_STATUSES = new Set(["inprogress", "waiting", "completed", "canceled"]);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

async function ensureDataFile() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  try {
    await fsp.access(DATA_FILE);
  } catch {
    await fsp.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function validateTickets(tickets, statusCode = 400) {
  if (!Array.isArray(tickets)) {
    throw new ApiError(statusCode, "Payload must be an array of tickets.");
  }

  const ids = new Set();
  const ticketCodes = new Set();

  tickets.forEach((ticket, ticketIndex) => {
    const label = `Ticket at index ${ticketIndex}`;
    if (!ticket || typeof ticket !== "object" || Array.isArray(ticket)) {
      throw new ApiError(statusCode, `${label} must be an object.`);
    }

    if (typeof ticket.id !== "string" || !ticket.id.trim()) {
      throw new ApiError(statusCode, `${label} must have a non-empty id.`);
    }
    if (ids.has(ticket.id)) {
      throw new ApiError(statusCode, `Duplicate ticket id: ${ticket.id}.`);
    }
    ids.add(ticket.id);

    if (typeof ticket.ticketCode !== "string" || !ticket.ticketCode.trim()) {
      throw new ApiError(statusCode, `${label} must have a non-empty ticketCode.`);
    }
    const normalizedCode = ticket.ticketCode.trim().toUpperCase();
    if (ticketCodes.has(normalizedCode)) {
      throw new ApiError(statusCode, `Duplicate ticketCode: ${ticket.ticketCode}.`);
    }
    ticketCodes.add(normalizedCode);

    if (typeof ticket.title !== "string" || !ticket.title.trim()) {
      throw new ApiError(statusCode, `${label} must have a non-empty title.`);
    }
    if (typeof ticket.createdBy !== "string" || typeof ticket.closedBy !== "string") {
      throw new ApiError(statusCode, `${label} has invalid creator or closer fields.`);
    }
    if (!VALID_STATUSES.has(ticket.status)) {
      throw new ApiError(statusCode, `${label} has an invalid status.`);
    }
    if (typeof ticket.highPriority !== "boolean" || typeof ticket.archived !== "boolean") {
      throw new ApiError(statusCode, `${label} has invalid boolean fields.`);
    }
    if (!isValidDateString(ticket.submittedDate)) {
      throw new ApiError(statusCode, `${label} has an invalid submittedDate.`);
    }
    if (typeof ticket.completedDate !== "string"
      || (ticket.completedDate && !isValidDateString(ticket.completedDate))) {
      throw new ApiError(statusCode, `${label} has an invalid completedDate.`);
    }
    if (ticket.completedDate && ticket.completedDate < ticket.submittedDate) {
      throw new ApiError(statusCode, `${label} has a completedDate before its submittedDate.`);
    }
    if (typeof ticket.details !== "string"
      || typeof ticket.changeReason !== "string"
      || typeof ticket.expectedBenefit !== "string") {
      throw new ApiError(statusCode, `${label} has invalid descriptive fields.`);
    }
    if (!Number.isFinite(ticket.createdAt) || !Number.isFinite(ticket.updatedAt)) {
      throw new ApiError(statusCode, `${label} has invalid timestamps.`);
    }
    if (!Array.isArray(ticket.notes)) {
      throw new ApiError(statusCode, `${label} must have a notes array.`);
    }

    const noteIds = new Set();
    ticket.notes.forEach((note, noteIndex) => {
      const noteLabel = `${label}, note at index ${noteIndex}`;
      if (!note || typeof note !== "object" || Array.isArray(note)) {
        throw new ApiError(statusCode, `${noteLabel} must be an object.`);
      }
      if (typeof note.id !== "string" || !note.id.trim()) {
        throw new ApiError(statusCode, `${noteLabel} must have a non-empty id.`);
      }
      if (noteIds.has(note.id)) {
        throw new ApiError(statusCode, `${label} has duplicate note id: ${note.id}.`);
      }
      noteIds.add(note.id);
      if (typeof note.text !== "string" || !note.text.trim() || !Number.isFinite(note.createdAt)) {
        throw new ApiError(statusCode, `${noteLabel} has invalid content.`);
      }
    });
  });
}

function createVersion(content) {
  return `"${crypto.createHash("sha256").update(content).digest("hex")}"`;
}

async function readTicketStore() {
  await ensureDataFile();
  const raw = await fsp.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || "[]");
  validateTickets(parsed, 500);
  return {
    tickets: parsed,
    version: createVersion(raw)
  };
}

let writeQueue = Promise.resolve();

function serializeWrite(operation) {
  const result = writeQueue.then(operation);
  writeQueue = result.catch(() => {});
  return result;
}

async function replaceTickets(tickets, expectedVersion) {
  return serializeWrite(async () => {
    const currentStore = await readTicketStore();
    if (!expectedVersion) {
      throw new ApiError(428, "Load the current tickets before saving changes.");
    }
    if (expectedVersion !== currentStore.version) {
      throw new ApiError(412, "Tickets changed in another session. Your update was not saved.");
    }

    const content = `${JSON.stringify(tickets, null, 2)}\n`;
    const temporaryFile = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;

    try {
      await fsp.writeFile(temporaryFile, content, "utf8");
      await fsp.rename(temporaryFile, DATA_FILE);
    } finally {
      await fsp.unlink(temporaryFile).catch(() => {});
    }

    return {
      tickets,
      version: createVersion(content)
    };
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(body);
}

function applyApiHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, If-Match");
  res.setHeader("Access-Control-Expose-Headers", "ETag");
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function resolveFilePath(urlPathname) {
  const requestedPath = urlPathname === "/" ? "/index.html" : decodeURIComponent(urlPathname);
  const safePath = path.normalize(path.join(ROOT_DIR, requestedPath));

  if (!safePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return safePath;
}

async function serveStaticFile(req, res, pathname) {
  const filePath = resolveFilePath(pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    sendText(res, 404, "Not found");
    return;
  }

  if (stat.isDirectory()) {
    sendText(res, 403, "Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
  applyApiHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET") {
    const store = await readTicketStore();
    res.setHeader("ETag", store.version);
    sendJson(res, 200, store.tickets);
    return;
  }

  if (req.method === "PUT") {
    const rawBody = await collectRequestBody(req);
    let payload;

    try {
      payload = JSON.parse(rawBody || "[]");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload." });
      return;
    }

    try {
      validateTickets(payload);
      const store = await replaceTickets(payload, req.headers["if-match"] || "");
      res.setHeader("ETag", store.version);
      sendJson(res, 200, store.tickets);
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(res, error.statusCode, { error: error.message });
        return;
      }
      throw error;
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (requestUrl.pathname === "/api/tickets") {
      await handleApi(req, res);
      return;
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      sendText(res, 405, "Method not allowed");
      return;
    }

    await serveStaticFile(req, res, requestUrl.pathname);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error." });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureDataFile();
  console.log(`FOX Ticket Tracker running at http://${HOST}:${PORT}`);
});
