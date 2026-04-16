# Life Manager — Action Plan
> Last updated: April 16, 2026  
> Status: Version 1.0 live (3-file vanilla JS app)

---

## What Is This App?

A personal life management web app that combines a **daily to-do list**, a **habit tracker**, and a **progress dashboard** in one place. All data is saved locally in the browser. The long-term goal is to launch it as a **public product**.

---

## What Is Already Built (v1.0)

| Feature | Status | Notes |
|---|---|---|
| Daily to-do list | ✅ Done | Shows today's tasks, add / check / delete |
| Todo streak counter | ✅ Done | Consecutive days with ≥1 completed task |
| Habit tracker | ✅ Done | 7-day grid, custom name & colour |
| Habit streak counter | ✅ Done | Per-habit consecutive day streak |
| Stats — completion bars | ✅ Done | 7 / 30 / 90 day completion % per todo & habit |
| Stats — line chart | ✅ Done | SVG daily % chart with 7d / 30d / 90d range |
| Calendar sidebar | ✅ Done | Always visible, month grid with activity dots |
| Calendar day detail | ✅ Done | Click any past day → see todos & habits for that day |
| Past day browsing | ✅ Done | Calendar click navigates Todo tab to that date |
| Habit grid range toggle | ✅ Done | 7 / 14 / 30 day columns |
| Collapsible habit stat cards | ✅ Done | Click to expand / collapse each habit in Stats |
| localStorage persistence | ✅ Done | Data survives page refresh |
| Mobile responsive layout | ✅ Done | Stacks to single column below 720px |
| XSS protection | ✅ Done | All user text escaped before inserting into HTML |

---

## Interview Findings & Decisions

### 1. Data & Storage

| Topic | Decision |
|---|---|
| **Data growing too large** | Auto-archive todos older than 90 days (move to a separate storage key, not deleted) |
| **Cross-device sync** | Migrate to **Firebase / Firestore** |
| **Authentication** | **Google Sign-In only** (one-click, no password) |
| **Single device for now** | localStorage is the current solution until Firebase is added |

---

### 2. Streak System

This is the most unique and complex feature of the app.

#### Completion Threshold
- A day **counts toward the streak** only if **≥ 50% of that day's todos** were completed
- Example: 4 tasks added, 2 completed = 50% = streak maintained ✅
- Example: 4 tasks added, 1 completed = 25% = streak broken ❌

#### Over-Scheduling Guard
- If a user adds **too many tasks** in one day (threshold TBD, suggested: > 10), show an **alert**:
  > *"You have a lot of tasks today! Do you want to trim your list?"*
- If the user keeps all tasks and hits 50%: **streak is maintained** but progress is displayed as the real % (e.g. 50%), not inflated

#### Freeze Token System
| How to Earn | Tokens |
|---|---|
| Complete **100%** of todos in a day | +1 token |
| Maintain a **30-day streak** | +2 tokens |
| **Free grace day** | 1 per calendar month (no token cost) |

**How to Spend:**
- When today's streak is at risk, show a warning banner: *"Spend a token to protect your streak?"*
- Token balance shown in the header at all times
- Can also tap the 🔥 streak banner to open a *"Protect streak?"* dialog

**Calendar visual for streaks:**
- Normal streak days → 🔥 orange
- Freeze token used → 🔵 blue that day
- Free grace day used → 🎆 fireworks sticker, same orange colour kept

---

### 3. To-Do Tab

| Topic | Decision |
|---|---|
| **Browse past days** | Click a calendar day → Todo tab navigates to that date ✅ Already built |
| **Task priority** | Add **High / Medium / Low** labels with colour coding |
| **Recurring tasks** | Toggle at creation: repeat daily / weekdays / weekly |
| **Day reset time** | **Configurable per user** in Settings (default: **3:00 AM**) — night owls' work at 1am counts for the previous day |
| **Past-day editing** | Read-only when browsing past days (no add/delete) ✅ Already built |

#### Recurring Todos Detail
- When adding a task, a "Repeat" toggle appears: `None / Daily / Weekdays / Weekly`
- At **3:00 AM** (or user's set time), recurring tasks auto-copy to the new day
- Uncompleted recurring tasks do **not** carry forward — each day is a fresh start

---

### 4. Habit Tracker

| Topic | Decision |
|---|---|
| **Grid range** | Toggle 7 / 14 / 30 days ✅ Already built |
| **Retroactive logging** | ✅ Allowed — you can check past days (you may forget to log) |
| **Streak freeze** | Covered by the token system above |

---

### 5. Notifications & Reminders

| Type | Details |
|---|---|
| **Evening reminder** | Push notification from **6:00 PM – 11:59 PM** reminding user to log habits |
| **Streak protection alert** | Notification near end of day if streak is at risk and tokens are available |
| **Permission flow** | Browser asks for notification permission on first launch |

---

### 6. Stats & Charts

| Topic | Decision |
|---|---|
| **Line chart gaps** | Days with no todos → fill with **0%** (not left as a gap) |
| **Trend indicator** | Add a **trend arrow** (↑ improving / ↓ declining) comparing current 7-day rate vs previous 7-day rate |
| **Many habits** | Collapsible stat cards ✅ Already built |

---

### 7. UI / UX

| Topic | Decision |
|---|---|
| **Primary devices** | Laptop + phone |
| **Mobile layout** | Responsive single-column below 720px ✅ Already built |
| **Dark mode** | Not now — planned for a future version |
| **Onboarding** | Welcome modal on first launch explaining: streaks, tokens, grace days, key features |
| **Day cutoff time** | Configurable in Settings (default 3:00 AM) |

---

### 8. Weekly Review (Sunday Feature)

A guided 3-step review that runs every Sunday:

```
Step 1 — Auto Summary Card
  • Total tasks completed this week
  • Habit completion rate
  • Best streak this week
  • One motivational message

Step 2 — Reflection Prompts
  • What went well this week?
  • What was hard or felt stuck?
  • What is my main focus for next week?

Step 3 — Next-Week Planning
  • Pre-add recurring todos for Mon – Sun
  • Set weekly intention / goal
```

---

## Prioritised Build Roadmap

### Phase 1 — Core Polish (Do First)
> Goal: Make v1.0 feel complete and trustworthy

- [ ] **Streak threshold (≥50%)** — update streak logic from "≥1 completed" to "≥50% completed"
- [ ] **Over-scheduling guard** — alert when too many tasks added in one day
- [ ] **Todo priority labels** — High / Medium / Low with colour tags
- [ ] **Fill chart gaps with 0%** — no empty spaces in the line chart
- [ ] **Trend arrow** — ↑↓ comparing this week vs last week in Stats

---

### Phase 2 — Daily Habit Features
> Goal: Make the app genuinely useful every day

- [ ] **Recurring todos** — repeat toggle at creation, auto-copy at 3am
- [ ] **Configurable day-reset time** — Settings panel with a time picker
- [ ] **Evening push notifications** — 6pm–11:59pm habit reminder
- [ ] **Streak protection notification** — alert when streak is at risk

---

### Phase 3 — Streak Economy
> Goal: Make streaks fun and forgiving

- [ ] **Freeze token system** — earn tokens, spend to protect streak
- [ ] **Grace day logic** — 1 free grace day per calendar month
- [ ] **Calendar streak visualisation** — blue day (token used), fireworks (grace day)
- [ ] **Token balance in header** — always visible 🛡️ counter

---

### Phase 4 — Sync & Accounts
> Goal: Make the app trustworthy across devices

- [ ] **Firebase / Firestore integration** — replace localStorage with cloud DB
- [ ] **Google Sign-In** — one-click login
- [ ] **Data migration** — import existing localStorage data into Firebase on first login
- [ ] **Offline support** — app still works without internet, syncs when reconnected

---

### Phase 5 — Reflection & Review
> Goal: Help users improve, not just track

- [ ] **Weekly review flow** — Sunday 3-step: summary → reflection → planning
- [ ] **Motivational messages** — personalised based on streak length & completion rate
- [ ] **Welcome onboarding modal** — tips on streaks, tokens, features

---

### Phase 6 — Polish & Launch
> Goal: Ready for real users

- [ ] **Dark mode** — auto-follow system setting
- [ ] **Data export** — download all data as JSON or CSV
- [ ] **Settings page** — day reset time, notification preferences, theme
- [ ] **Progressive Web App (PWA)** — "Add to Home Screen" on phone
- [ ] **Public deployment** — host on Firebase Hosting or Netlify

---

## Technical Stack

| Layer | Current | Planned |
|---|---|---|
| Frontend | Vanilla JS + HTML + CSS | Same (no framework needed) |
| Storage | localStorage | Firebase Firestore |
| Auth | None | Firebase Google Sign-In |
| Hosting | Local file | Firebase Hosting / Netlify |
| Notifications | None | Web Push API + Service Worker |
| Charts | Hand-drawn SVG | Same (no chart library) |

---

## File Structure

```
My App/
  index.html       ← HTML shell (48 lines)
  style.css        ← All styles, includes responsive rules (734 lines)
  script.js        ← Full app logic in 10 sections (994 lines)
  action plan.md   ← This file
```

### script.js Sections
```
Section 1  — State variables
Section 2  — localStorage save/load
Section 3  — Helper functions (dates, IDs, HTML escaping)
Section 4  — Streak calculations (todo / habit / combined)
Section 5  — Todo tab (render + add / toggle / delete / browse)
Section 6  — Habits tab (render + add / toggle / delete)
Section 7  — Stats tab (line chart SVG + rate bars)
Section 8  — Calendar sidebar (month grid + day detail panel)
Section 9  — Tab switching
Section 10 — Initialisation
```

---

## Data Shapes (localStorage)

```js
// A Todo item
{
  id:          "abc123",         // unique ID
  text:        "Buy groceries",  // task text
  completed:   true,             // done or not
  date:        "2026-04-16",     // which day this task belongs to
  completedAt: "2026-04-16"      // when it was checked off (null if not done)
}

// A Habit item
{
  id:             "xyz789",
  name:           "Exercise",
  color:          "#10b981",
  completedDates: ["2026-04-14", "2026-04-15", "2026-04-16"],
  createdAt:      "2026-04-01"
}
```

---

## How to Run

1. Open **File Explorer** and go to `Documents\MH in4\My App`
2. Double-click **`index.html`**
3. The app opens in your browser — no internet required
4. All data is saved automatically in the browser

> **Important:** Data is saved per-browser. If you clear browser history/cache, data will be lost. This will be fixed when Firebase sync is added in Phase 4.

---

*Built with plain HTML, CSS, and JavaScript — no frameworks, no build tools.*
