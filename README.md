# fox-ticket-tracker

Static ticket tracker built in the same visual style as `fox-time-tracker`.

## Features

- Create ticket entries with title, creator, closer, submitted date, completed date, status, details, change reason, and expected benefit
- Unique ticket ID validation across create, edit, and CSV import
- Rectangular ticket cards
- `In Progress` status uses yellow
- `Waiting For Approval` status uses orange
- `Completed` status uses green
- `Canceled` status uses grey
- `Abandoned` status uses blue-grey
- `Rejected` status uses red
- Default sort order keeps `In Progress` tickets first, then newer submitted dates
- Details panel for reviewing and editing a ticket
- Notes / updates timeline per ticket
- Archive / restore support
- Search by ticket ID, title, details, and notes
- CSV import and export with the same round-trip format
- Full-screen service analytics for volume, throughput, backlog, resolution, priority, and data quality
- Repository-backed storage exclusively in [`data/tickets.json`](data/tickets.json)
- Atomic, validated saves with stale-session protection

## Usage

Run the local server to load and update tickets:

```bash
node server.js
```

Then open `http://127.0.0.1:4173` in any browser on the same machine.

The server is required for editing. The app does not read or write browser storage; every successful ticket update has already been persisted to `data/tickets.json` by the server.

Run the analytics calculation tests with:

```bash
node --test analytics.test.js app.smoke.test.js
```
