"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(...names) {
    names.forEach((name) => this.names.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.names.delete(name));
  }

  contains(name) {
    return this.names.has(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.names.has(name) : Boolean(force);
    if (shouldAdd) this.names.add(name);
    else this.names.delete(name);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(id) {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.options = [];
    this.style = {};
    this.dataset = {};
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    (this.listeners.get(type) || []).forEach((handler) => handler({
      target: this,
      preventDefault() {},
      ...event
    }));
  }

  add(option) {
    this.options.push(option);
  }

  replaceChildren() {
    this.options = [];
  }

  setAttribute() {}

  querySelectorAll() {
    return [];
  }

  getBoundingClientRect() {
    return { top: 0 };
  }

  focus() {}

  scrollIntoView() {}
}

test("the app hydrates and opens, filters, and closes the analytics dashboard", async () => {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };

  getElement("analyticsView").classList.add("hidden");
  getElement("analyticsRange").value = "90";
  getElement("analyticsGrouping").value = "auto";
  getElement("analyticsStatus").value = "all";
  getElement("analyticsPriority").value = "all";
  getElement("ticketStatus").value = "inprogress";
  getElement("detailsStatus").value = "inprogress";

  global.Option = class FakeOption {
    constructor(label, value) {
      this.label = label;
      this.text = label;
      this.value = value;
    }
  };
  global.document = {
    body: { classList: new FakeClassList() },
    getElementById: getElement
  };
  global.window = {
    innerWidth: 1280,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    setTimeout,
    clearTimeout
  };
  global.alert = () => {};
  global.confirm = () => true;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "etag" ? '"test-version"' : null },
    async json() {
      return [{
        id: "ticket-smoke",
        ticketCode: "SMOKE-1",
        title: "Analytics smoke test",
        submittedDate: new Date().toISOString().slice(0, 10),
        completedDate: "",
        status: "inprogress",
        highPriority: true,
        archived: false,
        details: "Dashboard integration",
        changeReason: "Track performance",
        expectedBenefit: "Operational visibility",
        notes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
    }
  });

  delete require.cache[require.resolve("./analytics.js")];
  require("./analytics.js");
  global.window.FoxTicketAnalytics = global.FoxTicketAnalytics;
  delete require.cache[require.resolve("./app.js")];
  require("./app.js");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(getElement("analyticsBtn").disabled, false);
  getElement("analyticsBtn").dispatch("click");
  assert.equal(getElement("analyticsView").classList.contains("hidden"), false);
  assert.equal(global.document.body.classList.contains("analytics-open"), true);
  const dashboardHtml = getElement("analyticsContent").innerHTML;
  assert.equal((dashboardHtml.match(/class="analytics-kpi tone-/g) || []).length, 10);
  assert.match(dashboardHtml, /Repository tickets/);
  assert.match(dashboardHtml, /Cohort completion/);
  assert.match(dashboardHtml, /Median resolution/);
  assert.match(dashboardHtml, /P90 resolution/);
  assert.match(dashboardHtml, /Average open age/);
  assert.match(dashboardHtml, /analytics-kpi-description/);
  assert.match(dashboardHtml, /Ticket flow/);
  assert.doesNotMatch(dashboardHtml, /Demand by creator|Closure performance|Highest closure volume|Created by missing|Closed by missing/);

  getElement("analyticsPriority").value = "high";
  getElement("analyticsPriority").dispatch("change");
  assert.match(getElement("analyticsScope").textContent, /1 active filters/);

  getElement("closeAnalyticsBtn").dispatch("click");
  assert.equal(getElement("analyticsView").classList.contains("hidden"), true);
  assert.equal(global.document.body.classList.contains("analytics-open"), false);
});
