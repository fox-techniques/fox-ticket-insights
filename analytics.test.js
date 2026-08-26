"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("./analytics.js");

function ticket(overrides) {
  return {
    id: overrides.ticketCode,
    ticketCode: overrides.ticketCode,
    title: overrides.ticketCode,
    createdBy: "",
    closedBy: "",
    submittedDate: "2026-08-02",
    completedDate: "",
    status: "inprogress",
    highPriority: false,
    archived: false,
    details: "",
    changeReason: "Reason",
    expectedBenefit: "Benefit",
    notes: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

const dataset = [
  ticket({
    ticketCode: "A",
    createdBy: "Alice",
    closedBy: "Bob",
    submittedDate: "2026-08-02",
    completedDate: "2026-08-04",
    status: "completed"
  }),
  ticket({
    ticketCode: "B",
    createdBy: "Alice",
    submittedDate: "2026-08-10",
    highPriority: true
  }),
  ticket({
    ticketCode: "C",
    createdBy: "Carol",
    closedBy: "Dana",
    submittedDate: "2026-08-15",
    completedDate: "2026-08-17",
    status: "canceled"
  }),
  ticket({
    ticketCode: "D",
    createdBy: "Evan",
    closedBy: "Bob",
    submittedDate: "2026-07-01",
    completedDate: "2026-08-20",
    status: "completed"
  }),
  ticket({
    ticketCode: "E",
    createdBy: "Grace",
    closedBy: "Erin",
    submittedDate: "2026-08-18",
    completedDate: "2026-08-19",
    status: "rejected"
  }),
  ticket({
    ticketCode: "F",
    createdBy: "Hugo",
    closedBy: "Frank",
    submittedDate: "2026-08-20",
    completedDate: "2026-08-22",
    status: "abandoned"
  }),
  ticket({
    ticketCode: "G",
    createdBy: "Ivy",
    submittedDate: "2026-05-01",
    status: "waiting"
  })
];

test("buildModel calculates the original dashboard measures", () => {
  const model = analytics.buildModel(dataset, {
    range: "30",
    today: "2026-08-31"
  });

  assert.equal(model.summary.createdCount, 5);
  assert.equal(model.summary.completedCount, 2);
  assert.equal(model.summary.canceledCount, 1);
  assert.equal(model.summary.abandonedCount, 1);
  assert.equal(model.summary.rejectedCount, 1);
  assert.equal(model.summary.unsuccessfulCount, 3);
  assert.equal(model.summary.openCount, 2);
  assert.equal(model.summary.highPriorityOpenCount, 1);
  assert.equal(model.summary.completionRate, 20);
  assert.equal(model.summary.medianResolution, 26);
  assert.equal(model.summary.p90Resolution, 45.2);
  assert.equal(model.summary.averageOpenAge, 71.5);
  assert.deepEqual(
    model.statusBreakdown.map((item) => [item.status, item.count]),
    [
      ["inprogress", 1],
      ["waiting", 0],
      ["completed", 1],
      ["canceled", 1],
      ["abandoned", 1],
      ["rejected", 1]
    ]
  );
});

test("unsuccessful terminal outcomes never inflate completion or resolution", () => {
  const unsuccessful = dataset.filter((item) => ["canceled", "abandoned", "rejected"].includes(item.status));
  const model = analytics.buildModel(unsuccessful, {
    range: "30",
    today: "2026-08-31"
  });

  assert.equal(model.summary.createdCount, 3);
  assert.equal(model.summary.completedCount, 0);
  assert.equal(model.summary.completionRate, 0);
  assert.equal(model.summary.medianResolution, null);
  assert.equal(model.summary.p90Resolution, null);
});

test("people tables separate demand from terminal-ticket closure performance", () => {
  const model = analytics.buildModel(dataset, {
    range: "30",
    today: "2026-08-31"
  });

  assert.deepEqual(
    model.creators.map((row) => [row.name, row.count]),
    [["Alice", 2], ["Carol", 1], ["Grace", 1], ["Hugo", 1]]
  );
  assert.deepEqual(
    model.closers.map((row) => [row.name, row.count, row.completed, row.canceled, row.abandoned, row.rejected]),
    [
      ["Bob", 2, 2, 0, 0, 0],
      ["Dana", 1, 0, 1, 0, 0],
      ["Erin", 1, 0, 0, 0, 1],
      ["Frank", 1, 0, 0, 1, 0]
    ]
  );
  assert.equal(model.closers[0].medianResolution, 26);
});

test("priority and person filters constrain the complete dashboard model", () => {
  const priorityModel = analytics.buildModel(dataset, {
    range: "30",
    priority: "high",
    today: "2026-08-31"
  });
  assert.equal(priorityModel.totalTickets, 1);
  assert.equal(priorityModel.summary.createdCount, 1);
  assert.equal(priorityModel.summary.openCount, 1);

  const creatorModel = analytics.buildModel(dataset, {
    range: "30",
    creator: analytics.personKey("Alice"),
    today: "2026-08-31"
  });
  assert.equal(creatorModel.totalTickets, 2);
  assert.equal(creatorModel.summary.createdCount, 2);
  assert.equal(creatorModel.summary.completedCount, 1);
});

test("data quality identifies missing reporting fields", () => {
  const incomplete = [ticket({
    ticketCode: "MISSING",
    createdBy: "",
    closedBy: "",
    completedDate: "2026-08-03",
    status: "completed",
    changeReason: "",
    expectedBenefit: ""
  })];
  const model = analytics.buildModel(incomplete, {
    range: "30",
    today: "2026-08-31"
  });
  assert.deepEqual(model.quality.map((item) => item.count), [1, 1, 0, 1, 1]);
});
