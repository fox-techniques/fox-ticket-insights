(function initializeFoxTicketAnalytics(globalScope) {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const ACTIVE_STATUSES = new Set(["inprogress", "waiting"]);
  const UNSUCCESSFUL_STATUSES = new Set(["canceled", "abandoned", "rejected"]);
  const TERMINAL_STATUSES = new Set(["completed", ...UNSUCCESSFUL_STATUSES]);
  const STATUS_KEYS = ["inprogress", "waiting", "completed", "canceled", "abandoned", "rejected"];

  function parseDate(value) {
    const raw = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

    const [year, month, day] = raw.split("-").map(Number);
    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (
      parsed.getUTCFullYear() !== year
      || parsed.getUTCMonth() !== month - 1
      || parsed.getUTCDate() !== day
    ) {
      return null;
    }
    return timestamp;
  }

  function toIsoDate(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  function percentile(values, ratio) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];

    const position = (sorted.length - 1) * ratio;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const weight = position - lowerIndex;
    return sorted[lowerIndex] + ((sorted[upperIndex] - sorted[lowerIndex]) * weight);
  }

  function median(values) {
    return percentile(values, 0.5);
  }

  function personKey(value) {
    const name = String(value || "").trim();
    return name ? name.toLocaleLowerCase() : "__missing__";
  }

  function personLabel(value) {
    return String(value || "").trim() || "Not specified";
  }

  function isTerminal(ticket) {
    return TERMINAL_STATUSES.has(ticket.status);
  }

  function isActive(ticket) {
    return ACTIVE_STATUSES.has(ticket.status);
  }

  function isWithin(timestamp, start, end) {
    return timestamp !== null && timestamp >= start && timestamp <= end;
  }

  function resolutionDays(ticket) {
    const submitted = parseDate(ticket.submittedDate);
    const completed = parseDate(ticket.completedDate);
    if (submitted === null || completed === null || completed < submitted) return null;
    return Math.floor((completed - submitted) / DAY_MS);
  }

  function getPeriod(range, tickets, todayValue) {
    const parsedToday = parseDate(todayValue);
    const end = parsedToday === null
      ? Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
      : parsedToday;
    let start;

    if (range === "all") {
      const submittedDates = tickets.map((ticket) => parseDate(ticket.submittedDate)).filter(Number.isFinite);
      start = submittedDates.length ? Math.min(...submittedDates) : end;
      start = Math.min(start, end);
    } else if (range === "ytd") {
      start = Date.UTC(new Date(end).getUTCFullYear(), 0, 1);
    } else {
      const days = Math.max(1, Number(range) || 90);
      start = end - ((days - 1) * DAY_MS);
    }

    const inclusiveDays = Math.floor((end - start) / DAY_MS) + 1;
    const hasPrevious = range !== "all";
    const previousEnd = hasPrevious ? start - DAY_MS : null;
    const previousStart = hasPrevious ? previousEnd - ((inclusiveDays - 1) * DAY_MS) : null;

    return {
      start,
      end,
      inclusiveDays,
      previousStart,
      previousEnd,
      hasPrevious
    };
  }

  function filterTickets(tickets, options) {
    return tickets.filter((ticket) => {
      if (options.status !== "all" && ticket.status !== options.status) return false;
      if (options.priority === "high" && !ticket.highPriority) return false;
      if (options.priority === "standard" && ticket.highPriority) return false;
      if (options.creator !== "all" && personKey(ticket.createdBy) !== options.creator) return false;
      if (options.closer !== "all" && personKey(ticket.closedBy) !== options.closer) return false;
      return true;
    });
  }

  function getBacklogAtEnd(tickets, end) {
    return tickets.filter((ticket) => {
      const submitted = parseDate(ticket.submittedDate);
      if (submitted === null || submitted > end) return false;
      if (!isTerminal(ticket)) return true;

      const completed = parseDate(ticket.completedDate);
      return completed !== null && completed > end;
    });
  }

  function getActiveTickets(tickets, end) {
    return tickets.filter((ticket) => {
      const submitted = parseDate(ticket.submittedDate);
      return isActive(ticket) && submitted !== null && submitted <= end;
    });
  }

  function summarizePeriod(tickets, start, end) {
    const createdTickets = tickets.filter((ticket) => isWithin(parseDate(ticket.submittedDate), start, end));
    const completedTickets = tickets.filter((ticket) => (
      ticket.status === "completed" && isWithin(parseDate(ticket.completedDate), start, end)
    ));
    const canceledTickets = tickets.filter((ticket) => (
      ticket.status === "canceled" && isWithin(parseDate(ticket.completedDate), start, end)
    ));
    const abandonedTickets = tickets.filter((ticket) => (
      ticket.status === "abandoned" && isWithin(parseDate(ticket.completedDate), start, end)
    ));
    const rejectedTickets = tickets.filter((ticket) => (
      ticket.status === "rejected" && isWithin(parseDate(ticket.completedDate), start, end)
    ));
    const unsuccessfulTickets = [...canceledTickets, ...abandonedTickets, ...rejectedTickets];
    const terminalTickets = [...completedTickets, ...unsuccessfulTickets];
    const openTickets = getActiveTickets(tickets, end);
    const completedCohort = createdTickets.filter((ticket) => ticket.status === "completed");
    const resolutionValues = completedTickets.map(resolutionDays).filter(Number.isFinite);
    const openAges = openTickets
      .map((ticket) => parseDate(ticket.submittedDate))
      .filter(Number.isFinite)
      .map((submitted) => Math.max(0, Math.floor((end - submitted) / DAY_MS)));

    return {
      createdTickets,
      completedTickets,
      canceledTickets,
      abandonedTickets,
      rejectedTickets,
      unsuccessfulTickets,
      terminalTickets,
      openTickets,
      createdCount: createdTickets.length,
      completedCount: completedTickets.length,
      canceledCount: canceledTickets.length,
      abandonedCount: abandonedTickets.length,
      rejectedCount: rejectedTickets.length,
      unsuccessfulCount: unsuccessfulTickets.length,
      terminalCount: terminalTickets.length,
      openCount: openTickets.length,
      highPriorityOpenCount: openTickets.filter((ticket) => ticket.highPriority).length,
      completionRate: createdTickets.length ? (completedCohort.length / createdTickets.length) * 100 : null,
      medianResolution: median(resolutionValues),
      p90Resolution: percentile(resolutionValues, 0.9),
      averageOpenAge: openAges.length
        ? openAges.reduce((total, age) => total + age, 0) / openAges.length
        : null,
      resolutionValues,
      openAges
    };
  }

  function resolveGrouping(requestedGrouping, inclusiveDays) {
    if (["week", "month", "year"].includes(requestedGrouping)) return requestedGrouping;
    if (inclusiveDays <= 120) return "week";
    if (inclusiveDays <= 1095) return "month";
    return "year";
  }

  function bucketEnd(start, grouping) {
    const date = new Date(start);
    if (grouping === "week") return start + (6 * DAY_MS);
    if (grouping === "month") {
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
    }
    return Date.UTC(date.getUTCFullYear(), 11, 31);
  }

  function nextBucketStart(end) {
    return end + DAY_MS;
  }

  function formatBucketLabel(timestamp, grouping) {
    const date = new Date(timestamp);
    if (grouping === "week") {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC"
      }).format(date);
    }
    if (grouping === "month") {
      return new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC"
      }).format(date);
    }
    return String(date.getUTCFullYear());
  }

  function buildTrend(tickets, period, grouping) {
    const buckets = [];
    let cursor = period.start;

    while (cursor <= period.end) {
      const end = Math.min(bucketEnd(cursor, grouping), period.end);
      const summary = summarizePeriod(tickets, cursor, end);
      buckets.push({
        start: cursor,
        end,
        label: formatBucketLabel(cursor, grouping),
        created: summary.createdCount,
        completed: summary.completedCount,
        canceled: summary.canceledCount,
        abandoned: summary.abandonedCount,
        rejected: summary.rejectedCount,
        unsuccessful: summary.unsuccessfulCount,
        backlog: getBacklogAtEnd(tickets, end).length,
        medianResolution: summary.medianResolution,
        p90Resolution: summary.p90Resolution
      });
      cursor = nextBucketStart(end);
    }

    return buckets;
  }

  function buildStatusBreakdown(createdTickets) {
    return STATUS_KEYS.map((status) => ({
      status,
      count: createdTickets.filter((ticket) => ticket.status === status).length
    }));
  }

  function buildAgeBuckets(openAges) {
    const definitions = [
      { label: "0-2 days", min: 0, max: 2 },
      { label: "3-7 days", min: 3, max: 7 },
      { label: "8-14 days", min: 8, max: 14 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "30+ days", min: 31, max: Infinity }
    ];
    return definitions.map((definition) => ({
      label: definition.label,
      count: openAges.filter((age) => age >= definition.min && age <= definition.max).length
    }));
  }

  function groupCreators(tickets) {
    const groups = new Map();
    tickets.forEach((ticket) => {
      const key = personKey(ticket.createdBy);
      const current = groups.get(key) || {
        key,
        name: personLabel(ticket.createdBy),
        count: 0,
        completed: 0,
        highPriority: 0
      };
      current.count += 1;
      current.completed += ticket.status === "completed" ? 1 : 0;
      current.highPriority += ticket.highPriority ? 1 : 0;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  function groupClosers(tickets) {
    const groups = new Map();
    tickets.forEach((ticket) => {
      const key = personKey(ticket.closedBy);
      const current = groups.get(key) || {
        key,
        name: personLabel(ticket.closedBy),
        count: 0,
        completed: 0,
        canceled: 0,
        abandoned: 0,
        rejected: 0,
        resolutionValues: []
      };
      current.count += 1;
      current.completed += ticket.status === "completed" ? 1 : 0;
      current.canceled += ticket.status === "canceled" ? 1 : 0;
      current.abandoned += ticket.status === "abandoned" ? 1 : 0;
      current.rejected += ticket.status === "rejected" ? 1 : 0;
      const duration = ticket.status === "completed" ? resolutionDays(ticket) : null;
      if (duration !== null) current.resolutionValues.push(duration);
      groups.set(key, current);
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        medianResolution: median(group.resolutionValues),
        p90Resolution: percentile(group.resolutionValues, 0.9)
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  function collectPeople(tickets, field) {
    const groups = new Map();
    tickets.forEach((ticket) => {
      const key = personKey(ticket[field]);
      const current = groups.get(key) || {
        key,
        label: personLabel(ticket[field]),
        count: 0
      };
      current.count += 1;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => {
      if (a.key === "__missing__") return 1;
      if (b.key === "__missing__") return -1;
      return a.label.localeCompare(b.label);
    });
  }

  function buildQuality(tickets, summary) {
    const terminalWithoutDate = tickets.filter((ticket) => (
      isTerminal(ticket) && parseDate(ticket.completedDate) === null
    )).length;
    return [
      {
        label: "Created by missing",
        count: summary.createdTickets.filter((ticket) => !String(ticket.createdBy || "").trim()).length
      },
      {
        label: "Closed by missing",
        count: summary.terminalTickets.filter((ticket) => !String(ticket.closedBy || "").trim()).length
      },
      {
        label: "Completion date missing",
        count: terminalWithoutDate
      },
      {
        label: "Change reason missing",
        count: summary.createdTickets.filter((ticket) => !String(ticket.changeReason || "").trim()).length
      },
      {
        label: "Expected benefit missing",
        count: summary.createdTickets.filter((ticket) => !String(ticket.expectedBenefit || "").trim()).length
      }
    ];
  }

  function buildPrioritySummary(summary) {
    const createdHigh = summary.createdTickets.filter((ticket) => ticket.highPriority);
    const completedHigh = summary.completedTickets.filter((ticket) => ticket.highPriority);
    const durations = completedHigh.map(resolutionDays).filter(Number.isFinite);
    return {
      created: createdHigh.length,
      completed: completedHigh.length,
      open: summary.highPriorityOpenCount,
      cohortCompletionRate: createdHigh.length
        ? (createdHigh.filter((ticket) => ticket.status === "completed").length / createdHigh.length) * 100
        : null,
      medianResolution: median(durations)
    };
  }

  function buildHighlights(summary, closerRows, trend, periodEnd) {
    const completedWithDuration = summary.completedTickets
      .map((ticket) => ({ ticket, days: resolutionDays(ticket) }))
      .filter((item) => item.days !== null)
      .sort((a, b) => a.days - b.days);
    const openByAge = summary.openTickets
      .map((ticket) => ({
        ticket,
        days: Math.max(0, Math.floor((periodEnd - parseDate(ticket.submittedDate)) / DAY_MS))
      }))
      .filter((item) => Number.isFinite(item.days))
      .sort((a, b) => b.days - a.days);
    const peak = [...trend].sort((a, b) => b.created - a.created)[0] || null;
    const netFlow = summary.createdCount - summary.terminalCount;

    return {
      fastest: completedWithDuration[0] || null,
      slowest: completedWithDuration.at(-1) || null,
      oldestOpen: openByAge[0] || null,
      busiestCloser: closerRows[0] || null,
      peak,
      netFlow
    };
  }

  function buildModel(tickets, options = {}) {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const settings = {
      range: options.range || "90",
      grouping: options.grouping || "auto",
      status: options.status || "all",
      priority: options.priority || "all",
      creator: options.creator || "all",
      closer: options.closer || "all"
    };
    const period = getPeriod(settings.range, safeTickets, options.today);
    const filteredTickets = filterTickets(safeTickets, settings);
    const summary = summarizePeriod(filteredTickets, period.start, period.end);
    const previous = period.hasPrevious
      ? summarizePeriod(filteredTickets, period.previousStart, period.previousEnd)
      : null;
    const grouping = resolveGrouping(settings.grouping, period.inclusiveDays);
    const trend = buildTrend(filteredTickets, period, grouping);
    const creators = groupCreators(summary.createdTickets);
    const closers = groupClosers(summary.terminalTickets);

    return {
      settings,
      period: { ...period, grouping },
      totalTickets: filteredTickets.length,
      summary,
      previous,
      trend,
      statusBreakdown: buildStatusBreakdown(summary.createdTickets),
      ageBuckets: buildAgeBuckets(summary.openAges),
      creators,
      closers,
      priority: buildPrioritySummary(summary),
      quality: buildQuality(filteredTickets, summary),
      highlights: buildHighlights(summary, closers, trend, period.end)
    };
  }

  const api = {
    buildModel,
    collectPeople,
    personKey,
    percentile,
    resolutionDays,
    toIsoDate
  };

  globalScope.FoxTicketAnalytics = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : window));
