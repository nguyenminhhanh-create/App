// ═══════════════════════════════════════════════════════════════
//  script.js — Life Manager  (Vanilla JS — no build step needed)
//  Just open index.html in any browser. All data saved locally.
// ═══════════════════════════════════════════════════════════════


// ──────────────────────────────────────────────────────────────
//  SECTION 1 — STATE
//  All app data lives in these variables.
//  When something changes, we call save() then re-render.
// ──────────────────────────────────────────────────────────────

// Loaded from localStorage on startup (or defaults to empty arrays)
let todos  = JSON.parse(localStorage.getItem('lm-todos')  || '[]')
let habits = JSON.parse(localStorage.getItem('lm-habits') || '[]')

let activeTab      = 'todo'       // which tab is visible
let browseDate     = getToday()   // which date the Todo tab shows (default = today)
let calYear        = new Date().getFullYear()
let calMonth       = new Date().getMonth()
let calSelectedDay = null         // which calendar day is clicked (shows detail)
let showAddHabit   = false        // whether the "add habit" form is open
let chartRange     = 30           // line chart time window: 7 / 30 / 90 days
let habitRange     = 7            // habit grid columns: 7 / 14 / 30 days
let selectedColor  = '#6366f1'    // currently selected colour in habit add form
let statsExpanded  = {}           // { habitId: false } — collapsed habit cards

// ── Token / protection state ──────────────────────────
let freezeTokens     = parseInt(localStorage.getItem('lm-tokens')        || '0')
let protectedDays    = JSON.parse(localStorage.getItem('lm-protected')   || '{}')
// { "2026-04-15": "token", "2026-04-10": "grace" }
let graceUsedMonth   = localStorage.getItem('lm-grace-month') || ''
// "YYYY-MM" — tracks if the free grace day was used this calendar month
let tokenAwardedDays = new Set(JSON.parse(localStorage.getItem('lm-token-awarded') || '[]'))
// set of date strings that already earned the 100%-completion token (prevent double-award)
let streakMilestones = new Set(JSON.parse(localStorage.getItem('lm-milestones')    || '[]'))
// set of streak lengths (30, 60, 90 …) that already earned the milestone bonus


// ──────────────────────────────────────────────────────────────
//  SECTION 2 — STORAGE
//  save() writes the current state to localStorage.
//  It's called every time todos or habits change.
// ──────────────────────────────────────────────────────────────

function save() {
  localStorage.setItem('lm-todos',          JSON.stringify(todos))
  localStorage.setItem('lm-habits',         JSON.stringify(habits))
  localStorage.setItem('lm-tokens',         String(freezeTokens))
  localStorage.setItem('lm-protected',      JSON.stringify(protectedDays))
  localStorage.setItem('lm-grace-month',    graceUsedMonth)
  localStorage.setItem('lm-token-awarded',  JSON.stringify([...tokenAwardedDays]))
  localStorage.setItem('lm-milestones',     JSON.stringify([...streakMilestones]))
}


// ──────────────────────────────────────────────────────────────
//  SECTION 3 — HELPERS
//  Small utility functions used throughout the app.
// ──────────────────────────────────────────────────────────────

// Returns today's date as "YYYY-MM-DD" (e.g. "2026-04-16")
function getToday() {
  return new Date().toISOString().split('T')[0]
}

// Generates a unique ID for each todo / habit
// Combines current timestamp + random number to avoid collisions
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// Returns an array of the last N date strings, oldest first
// e.g. getLastNDays(3) → ["2026-04-14", "2026-04-15", "2026-04-16"]
function getLastNDays(n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

// How many days in a given month?
function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate() }

// What weekday (0=Sun … 6=Sat) does a month start on?
function getFirstDayOfMonth(y, m) { return new Date(y, m, 1).getDay() }

// "2026-04-16" → "Wednesday, April 16, 2026"
function fmtDate(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

// "2026-04-16" → "Apr 16"
function fmtShort(ds) {
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  })
}

// Escape HTML special characters to prevent XSS when inserting user text into innerHTML
// e.g.  <script>  becomes  &lt;script&gt;  and is shown as text, not executed
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Returns true if a day counts toward the todo streak.
// Rules: the day has ≥50% todos completed, OR a token/grace protection was applied.
function isDayActive(ds) {
  if (protectedDays[ds]) return true          // token or grace covers this day
  const dayTodos = todos.filter(t => t.date === ds)
  if (dayTodos.length === 0) return false     // no tasks = no streak contribution
  const done = dayTodos.filter(t => t.completed).length
  return (done / dayTodos.length) >= 0.5      // ≥50% threshold
}


// ──────────────────────────────────────────────────────────────
//  SECTION 4 — STREAK CALCULATIONS
//  A streak = consecutive days with qualifying activity.
//  We walk backwards from today; stop at the first gap.
//  Day 0 (today) is skipped if empty — you might still finish.
// ──────────────────────────────────────────────────────────────

// Todo streak: counts consecutive days where isDayActive() is true.
// A day is active when ≥50% of that day's todos were completed,
// OR a freeze token / grace day protected it.
function todoStreak() {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (isDayActive(ds)) { streak++ }
    else { if (i === 0) continue; break }   // skip today if still in progress
  }
  return streak
}

// Per-habit streak: consecutive days the habit was checked
function habitStreak(habit) {
  const dateSet = new Set(habit.completedDates)
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (dateSet.has(ds)) { streak++ }
    else { if (i === 0) continue; break }
  }
  return streak
}

// Combined streak: counts days where ANYTHING was done (todo OR habit)
// Used in the calendar sidebar
function combinedStreak() {
  const active = new Set()
  todos.forEach(t => { if (t.completed && t.completedAt) active.add(t.completedAt) })
  habits.forEach(h => h.completedDates.forEach(d => active.add(d)))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (active.has(ds)) { streak++ }
    else { if (i === 0) continue; break }
  }
  return streak
}


// ──────────────────────────────────────────────────────────────
//  SECTION 4b — FREEZE TOKEN & GRACE DAY SYSTEM
// ──────────────────────────────────────────────────────────────

// Is today's streak at risk?  (< 50% done and not already protected)
function isStreakAtRisk() {
  const today = getToday()
  if (protectedDays[today]) return false
  const dayTodos = todos.filter(t => t.date === today)
  if (dayTodos.length === 0) return false
  const done = dayTodos.filter(t => t.completed).length
  return (done / dayTodos.length) < 0.5
}

// Can the user spend a token right now?
function canUseToken() {
  return freezeTokens > 0 && !protectedDays[getToday()]
}

// Can the user use the free monthly grace day right now?
function canUseGrace() {
  return graceUsedMonth !== getToday().slice(0, 7) && !protectedDays[getToday()]
}

// Spend 1 freeze token to protect today
function useToken() {
  if (!canUseToken()) return
  const today = getToday()
  freezeTokens--
  protectedDays[today] = 'token'
  save()
  updateHeader()
  renderTodo()
  renderCalendar()
}

// Use the free grace day to protect today (once per calendar month)
function useGrace() {
  if (!canUseGrace()) return
  const today = getToday()
  graceUsedMonth = today.slice(0, 7)
  protectedDays[today] = 'grace'
  save()
  updateHeader()
  renderTodo()
  renderCalendar()
}

// Check if the user just earned tokens after completing todos.
// Called every time a todo is toggled or added.
// +1 token when today reaches 100% completion (once per day)
// +2 tokens when streak hits a multiple of 30 (once per milestone)
function checkTokenEarning() {
  const today    = getToday()
  const dayTodos = todos.filter(t => t.date === today)
  let changed    = false

  // 100% completion reward
  if (dayTodos.length > 0) {
    const done = dayTodos.filter(t => t.completed).length
    if (done === dayTodos.length && !tokenAwardedDays.has(today)) {
      tokenAwardedDays.add(today)
      freezeTokens++
      changed = true
    }
  }

  // 30-day streak milestone reward
  const streak = todoStreak()
  if (streak > 0 && streak % 30 === 0 && !streakMilestones.has(streak)) {
    streakMilestones.add(streak)
    freezeTokens += 2
    changed = true
  }

  if (changed) { save(); updateHeader() }
}


// ──────────────────────────────────────────────────────────────
//  SECTION 5 — TODO TAB
// ──────────────────────────────────────────────────────────────

function renderTodo() {
  const today    = getToday()
  const isBrowse = browseDate !== today
  // Only show todos for the currently viewed date
  const dayTodos = todos.filter(t => t.date === browseDate)
  const done     = dayTodos.filter(t => t.completed).length
  const total    = dayTodos.length
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0
  const streak    = todoStreak()
  const atRisk    = !isBrowse && isStreakAtRisk()
  const protected_ = !isBrowse && protectedDays[today]

  document.getElementById('app-content').innerHTML = `
    <div class="section">

      ${isBrowse
        /* Browsing a past day — show a "back to today" banner */
        ? `<div class="browse-banner">
             <button class="browse-back-btn" onclick="goToToday()">← Back to Today</button>
             <span class="browse-date-label">Viewing: ${fmtDate(browseDate)}</span>
           </div>`
        /* Today — show the streak banner */
        : `<div class="streak-banner">
             <span class="streak-fire">🔥</span>
             <div>
               <div class="streak-count">${streak} day streak</div>
               <div class="streak-sub">Keep completing tasks daily!</div>
             </div>
           </div>`
      }

      ${atRisk ? `
        <div class="streak-risk-banner">
          <span>⚠️ <strong>Streak at risk!</strong> You need 50% of today's tasks done to keep it.</span>
          <div class="risk-btns">
            ${canUseToken() ? `<button class="risk-btn token-btn" onclick="useToken()">🛡️ Spend Token (${freezeTokens} left)</button>` : ''}
            ${canUseGrace() ? `<button class="risk-btn grace-btn" onclick="useGrace()">🎆 Use Free Grace Day</button>` : ''}
          </div>
        </div>
      ` : ''}

      ${protected_ ? `
        <div class="streak-protected-banner">
          ${protectedDays[today] === 'token'
            ? '🛡️ Streak protected by a freeze token today!'
            : '🎆 Free grace day applied — streak is safe!'}
        </div>
      ` : ''}

      <!-- Progress bar -->
      <div class="progress-card">
        <div class="progress-label">
          ${isBrowse ? 'That day' : 'Today'}: ${done} / ${total} tasks completed
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>

      <!-- Add task form — only shown for today, not when browsing past -->
      ${!isBrowse
        ? `<form class="add-form" onsubmit="addTodo(event)">
             <input id="todo-input" class="text-input"
               type="text" placeholder="Add a task for today..." autocomplete="off" />
             <button type="submit" class="btn-primary">Add</button>
           </form>`
        : ''
      }

      <!-- Task list -->
      <ul class="todo-list">
        ${dayTodos.length === 0
          ? `<p class="empty-msg">
               ${isBrowse ? 'No tasks were recorded for this day.' : 'No tasks yet — add one above!'}
             </p>`
          : dayTodos.map(t => `
              <li class="todo-item ${t.completed ? 'completed' : ''}">
                <button class="check-btn" onclick="toggleTodo('${t.id}')">
                  ${t.completed ? '✓' : '○'}
                </button>
                <span class="todo-text">${esc(t.text)}</span>
                ${!isBrowse
                  ? `<button class="delete-btn" onclick="deleteTodo('${t.id}')">×</button>`
                  : ''}
              </li>
            `).join('')
        }
      </ul>

    </div>
  `
  // Auto-focus the input when not browsing
  if (!isBrowse) document.getElementById('todo-input')?.focus()
}

// ── Todo actions ──────────────────────────────────────────

function addTodo(e) {
  e.preventDefault()
  const input = document.getElementById('todo-input')
  const text  = input.value.trim()
  if (!text) return
  todos.push({
    id: uid(),
    text,
    completed: false,
    date: browseDate,
    completedAt: null
  })
  save()
  checkTokenEarning()
  renderTodo()
  renderCalendar()
}

function toggleTodo(id) {
  const t = todos.find(t => t.id === id)
  if (!t) return
  t.completed   = !t.completed
  t.completedAt = t.completed ? t.date : null
  save()
  checkTokenEarning()
  renderTodo()
  renderCalendar()
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id)
  save()
  renderTodo()
  renderCalendar()
}

// Called by the "← Back to Today" button when browsing a past day
function goToToday() {
  browseDate     = getToday()
  calSelectedDay = null
  renderTodo()
  renderCalendar()
}


// ──────────────────────────────────────────────────────────────
//  SECTION 6 — HABITS TAB
// ──────────────────────────────────────────────────────────────

const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444']

function renderHabits() {
  const today = getToday()
  const days  = getLastNDays(habitRange)

  document.getElementById('app-content').innerHTML = `
    <div class="section">

      <!-- Header: title + range selector + add button -->
      <div class="section-header">
        <h2>Habits</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="range-btns">
            ${[7, 14, 30].map(r =>
              `<button class="range-btn ${habitRange === r ? 'active' : ''}"
                 onclick="setHabitRange(${r})">${r}d</button>`
            ).join('')}
          </div>
          <button class="btn-primary" onclick="toggleAddHabit()">
            ${showAddHabit ? 'Cancel' : '+ Add Habit'}
          </button>
        </div>
      </div>

      <!-- Add habit form (visible when showAddHabit is true) -->
      ${showAddHabit ? `
        <form class="add-form habit-form" onsubmit="addHabit(event)">
          <input id="habit-input" class="text-input" type="text"
            placeholder="Habit name (e.g. Exercise, Read, Meditate...)" autocomplete="off" />
          <div class="color-picker">
            <span class="color-label">Color:</span>
            ${COLORS.map(c => `
              <button type="button"
                class="color-dot ${c === selectedColor ? 'selected' : ''}"
                style="background:${c}"
                onclick="pickColor('${c}')">
              </button>
            `).join('')}
          </div>
          <button type="submit" class="btn-primary">Save Habit</button>
        </form>
      ` : ''}

      ${habits.length === 0 && !showAddHabit
        ? `<p class="empty-msg">No habits yet. Add one to start tracking!</p>`
        : ''
      }

      <!-- Habit grid -->
      ${habits.length > 0 ? `
        <div class="habit-grid">

          <!-- Column headers row -->
          <div class="habit-row habit-header">
            <div class="habit-name-col">Habit</div>
            ${days.map(d => `
              <div class="habit-day-col">
                <span class="day-letter">
                  ${new Date(d + 'T00:00:00').toLocaleDateString('en-US',{weekday:'short'}).charAt(0)}
                </span>
                <span class="day-num">${new Date(d + 'T00:00:00').getDate()}</span>
              </div>
            `).join('')}
            <div class="habit-streak-col">🔥</div>
            <div class="habit-actions-col"></div>
          </div>

          <!-- One row per habit -->
          ${habits.map(h => {
            const streak = habitStreak(h)
            return `
              <div class="habit-row">
                <div class="habit-name-col">
                  <span class="habit-dot" style="background:${h.color}"></span>
                  <span class="habit-name">${esc(h.name)}</span>
                </div>
                ${days.map(d => {
                  const done    = h.completedDates.includes(d)
                  const isToday = d === today
                  return `
                    <div class="habit-day-col">
                      <button
                        class="habit-check ${done ? 'done' : ''} ${isToday ? 'today-col' : ''}"
                        style="${done ? `background:${h.color};border-color:${h.color}` : ''}"
                        onclick="toggleHabit('${h.id}','${d}')">
                        ${done ? '✓' : ''}
                      </button>
                    </div>
                  `
                }).join('')}
                <div class="habit-streak-col">
                  <span class="streak-badge">${streak}</span>
                </div>
                <div class="habit-actions-col">
                  <button class="delete-btn" onclick="deleteHabit('${h.id}')">×</button>
                </div>
              </div>
            `
          }).join('')}

        </div>
      ` : ''}

    </div>
  `
  if (showAddHabit) document.getElementById('habit-input')?.focus()
}

// ── Habit actions ─────────────────────────────────────────

function toggleAddHabit() {
  showAddHabit = !showAddHabit
  renderHabits()
}

function pickColor(c) {
  selectedColor = c
  renderHabits()
}

function addHabit(e) {
  e.preventDefault()
  const name = document.getElementById('habit-input').value.trim()
  if (!name) return
  habits.push({
    id: uid(),
    name,
    color: selectedColor,
    completedDates: [],
    createdAt: getToday()
  })
  showAddHabit = false
  save()
  renderHabits()
  renderCalendar()
}

// Toggle a habit's completion for a specific date
function toggleHabit(habitId, date) {
  const h = habits.find(h => h.id === habitId)
  if (!h) return
  if (h.completedDates.includes(date)) {
    h.completedDates = h.completedDates.filter(d => d !== date)
  } else {
    h.completedDates.push(date)
  }
  save()
  renderHabits()
  renderCalendar()
}

function deleteHabit(id) {
  if (!confirm('Delete this habit and all its history?')) return
  habits = habits.filter(h => h.id !== id)
  save()
  renderHabits()
  renderCalendar()
}

function setHabitRange(r) {
  habitRange = r
  renderHabits()
}


// ──────────────────────────────────────────────────────────────
//  SECTION 7 — STATS TAB
//  Contains: line chart (SVG) + completion rate bars per todo/habit
// ──────────────────────────────────────────────────────────────

// ── Stats helper functions ────────────────────────────────

// Todo completion stats for the last N days
// Groups todos by day, counts total and done, returns { rate, done, total }
function getTodoStats(days) {
  const cutoff = getLastNDays(days)[0]  // earliest date to include
  const map = {}
  todos.forEach(t => {
    if (!t.date || t.date < cutoff) return
    if (!map[t.date]) map[t.date] = { total: 0, done: 0 }
    map[t.date].total++
    if (t.completed) map[t.date].done++
  })
  const all = Object.values(map)
  if (!all.length) return { rate: 0, done: 0, total: 0 }
  const total = all.reduce((s, d) => s + d.total, 0)
  const done  = all.reduce((s, d) => s + d.done,  0)
  return { rate: total ? Math.round(done / total * 100) : 0, done, total }
}

// Per-habit completion % for the last N days
// Only counts days since the habit was created
function getHabitRate(habit, days) {
  let done = 0, total = 0
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    if (ds < habit.createdAt) continue
    total++
    if (habit.completedDates.includes(ds)) done++
  }
  return total ? Math.round(done / total * 100) : 0
}

// Render a horizontal rate bar (returns HTML string)
function rateBar(rate, color = '#6366f1') {
  return `
    <div class="rate-bar-container">
      <div class="rate-bar">
        <div class="rate-fill" style="width:${rate}%;background:${color}"></div>
      </div>
      <span class="rate-label">${rate}%</span>
    </div>
  `
}

// ── SVG Line Chart ─────────────────────────────────────────
// We draw the chart manually using SVG coordinate math.
// viewBox="0 0 560 190" defines our coordinate system.
// Width scales to 100% of the container.
const CW = 560, CH = 190
const CP = { top: 16, right: 16, bottom: 32, left: 40 }
const CIW = CW - CP.left - CP.right   // inner width
const CIH = CH - CP.top  - CP.bottom  // inner height

// Map a data-point index to an X position in the SVG
function cx(i, total) {
  if (total <= 1) return CP.left + CIW / 2
  return CP.left + (i / (total - 1)) * CIW
}

// Map a percentage (0–100) to a Y position
// 100% → top (small Y),  0% → bottom (large Y)
function cy(pct) { return CP.top + (1 - pct / 100) * CIH }

// Build "M x,y L x,y ..." path string from array of {x,y} points
function linePath(pts) {
  return pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(' ')
}

// Build closed area path (goes along the line, drops to x-axis, returns)
function areaPath(pts) {
  if (pts.length < 2) return ''
  const bot = CP.top + CIH
  return `${linePath(pts)} L${pts[pts.length-1].x.toFixed(1)},${bot} L${pts[0].x.toFixed(1)},${bot} Z`
}

// Build the full SVG markup for the line chart
function buildChart() {
  const dates = getLastNDays(chartRange)
  const n     = dates.length

  // For each day, calculate completion % — null if no data exists for that day
  const todoPts = dates.map((date, i) => {
    const day = todos.filter(t => t.date === date)
    if (!day.length) return null
    const pct = Math.round(day.filter(t => t.completed).length / day.length * 100)
    return { x: cx(i, n), y: cy(pct), pct, date }
  }).filter(Boolean)

  const habitPts = dates.map((date, i) => {
    const active = habits.filter(h => h.createdAt <= date)
    if (!active.length) return null
    const pct = Math.round(
      active.filter(h => h.completedDates.includes(date)).length / active.length * 100
    )
    return { x: cx(i, n), y: cy(pct), pct, date }
  }).filter(Boolean)

  if (!todoPts.length && !habitPts.length) {
    return `<p class="empty-msg">Complete tasks and habits to see your chart.</p>`
  }

  // Choose evenly-spaced indices for the x-axis labels
  const lc = chartRange === 7 ? 7 : 6
  const labelIdx = Array.from({ length: lc }, (_, k) =>
    Math.round(k / (lc - 1) * (n - 1))
  )

  return `
    <svg width="100%" viewBox="0 0 ${CW} ${CH}"
      style="display:block;overflow:visible" aria-label="Daily progress chart">

      <!-- Horizontal gridlines at 0 / 25 / 50 / 75 / 100 % -->
      ${[0, 25, 50, 75, 100].map(tick => `
        <g>
          <line x1="${CP.left}" y1="${cy(tick)}" x2="${CW - CP.right}" y2="${cy(tick)}"
            stroke="${tick === 0 || tick === 100 ? '#e5e7eb' : '#f3f4f6'}" stroke-width="1"/>
          <text x="${CP.left - 6}" y="${cy(tick) + 4}"
            text-anchor="end" font-size="9" fill="#9ca3af">${tick}%</text>
        </g>
      `).join('')}

      <!-- X-axis date labels -->
      ${labelIdx.map(idx => `
        <text x="${cx(idx, n)}" y="${CH - 8}"
          text-anchor="middle" font-size="9" fill="#9ca3af">
          ${fmtShort(dates[idx])}
        </text>
      `).join('')}

      <!-- Habit: shaded area fill + line -->
      ${habitPts.length > 1 ? `
        <path d="${areaPath(habitPts)}" fill="#10b981" fill-opacity="0.08"/>
        <path d="${linePath(habitPts)}" fill="none" stroke="#10b981" stroke-width="2"
          stroke-linejoin="round" stroke-linecap="round"/>
      ` : ''}

      <!-- Todo: shaded area fill + line -->
      ${todoPts.length > 1 ? `
        <path d="${areaPath(todoPts)}" fill="#6366f1" fill-opacity="0.10"/>
        <path d="${linePath(todoPts)}" fill="none" stroke="#6366f1" stroke-width="2.5"
          stroke-linejoin="round" stroke-linecap="round"/>
      ` : ''}

      <!-- Habit data-point dots (hover shows tooltip) -->
      ${habitPts.map(p => `
        <circle cx="${p.x}" cy="${p.y}"
          r="${chartRange === 7 ? 4 : 3}" fill="#10b981">
          <title>${p.date}: ${p.pct}% habits done</title>
        </circle>
      `).join('')}

      <!-- Todo data-point dots -->
      ${todoPts.map(p => `
        <circle cx="${p.x}" cy="${p.y}"
          r="${chartRange === 7 ? 4 : 3}" fill="#6366f1">
          <title>${p.date}: ${p.pct}% todos done</title>
        </circle>
      `).join('')}

    </svg>
  `
}

// ── Render stats tab ──────────────────────────────────────

function renderStats() {
  const tw = getTodoStats(7)
  const tm = getTodoStats(30)
  const t3 = getTodoStats(90)
  const hasData = todos.length > 0 || habits.length > 0

  document.getElementById('app-content').innerHTML = `
    <div class="section">
      <h2>Your Progress</h2>

      ${!hasData
        ? `<p class="empty-msg">Complete some tasks and habits to see your stats!</p>`
        : ''
      }

      <!-- Line chart card -->
      ${hasData ? `
        <div class="chart-card">
          <div class="chart-header">
            <h3>Daily Progress</h3>
            <div class="range-btns">
              ${[7, 30, 90].map(r => `
                <button class="range-btn ${chartRange === r ? 'active' : ''}"
                  onclick="setChartRange(${r})">
                  ${r === 7 ? '7d' : r === 30 ? '30d' : '90d'}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="chart-legend">
            <span class="chart-legend-item">
              <span class="chart-legend-dot" style="background:#6366f1"></span>To-Do %
            </span>
            <span class="chart-legend-item">
              <span class="chart-legend-dot" style="background:#10b981"></span>Habit %
            </span>
          </div>
          ${buildChart()}
        </div>
      ` : ''}

      <!-- Todo completion bars -->
      ${todos.length > 0 ? `
        <div class="stats-card">
          <h3>✓ To-Do Completion</h3>
          <div class="stats-row">
            <span class="stats-period">7 days</span>
            ${rateBar(tw.rate)}
            <span class="stats-detail">${tw.done}/${tw.total}</span>
          </div>
          <div class="stats-row">
            <span class="stats-period">30 days</span>
            ${rateBar(tm.rate)}
            <span class="stats-detail">${tm.done}/${tm.total}</span>
          </div>
          <div class="stats-row">
            <span class="stats-period">90 days</span>
            ${rateBar(t3.rate)}
            <span class="stats-detail">${t3.done}/${t3.total}</span>
          </div>
        </div>
      ` : ''}

      <!-- Per-habit collapsible cards -->
      ${habits.map(h => {
        const streak   = habitStreak(h)
        const w = getHabitRate(h, 7)
        const m = getHabitRate(h, 30)
        const q = getHabitRate(h, 90)
        const label =
          w >= 85 ? 'Excellent! Keep it up!'  :
          w >= 60 ? 'Good progress!'           :
          w >= 30 ? 'Room to improve'          :
                    'Just getting started'
        // Default: expanded (statsExpanded[id] !== false)
        const open = statsExpanded[h.id] !== false

        return `
          <div class="stats-card">
            <h3 style="cursor:pointer" onclick="toggleStatCard('${h.id}')">
              <span class="habit-dot" style="background:${h.color}"></span>
              ${esc(h.name)}
              <span class="streak-inline">🔥 ${streak} day streak</span>
              <span style="margin-left:8px;font-size:11px;color:#9ca3af">${open ? '▲' : '▼'}</span>
            </h3>
            ${open ? `
              <p class="habit-eval" style="color:${h.color}">${label}</p>
              <div class="stats-row">
                <span class="stats-period">7 days</span>${rateBar(w, h.color)}
              </div>
              <div class="stats-row">
                <span class="stats-period">30 days</span>${rateBar(m, h.color)}
              </div>
              <div class="stats-row">
                <span class="stats-period">90 days</span>${rateBar(q, h.color)}
              </div>
            ` : ''}
          </div>
        `
      }).join('')}

    </div>
  `
}

// ── Stats actions ─────────────────────────────────────────

function setChartRange(r) {
  chartRange = r
  renderStats()
}

// Toggle whether a habit's stats card is collapsed
function toggleStatCard(id) {
  // undefined/true = expanded → clicking collapses (false)
  // false = collapsed → clicking expands (true)
  statsExpanded[id] = statsExpanded[id] === false ? true : false
  renderStats()
}


// ──────────────────────────────────────────────────────────────
//  SECTION 8 — CALENDAR SIDEBAR
//  Always visible on the right. Shows the current month.
//  Clicking a past day shows a detail panel of that day's activity.
//  If the Todo tab is active, it also navigates to that date.
// ──────────────────────────────────────────────────────────────

function renderCalendar() {
  const today = getToday()
  const streak = combinedStreak()

  // ── Build activity map: date → { todos: N, habits: N } ──
  // Used to show the coloured dots on each day
  const actMap = {}
  todos.forEach(t => {
    if (t.completed && t.completedAt) {
      if (!actMap[t.completedAt]) actMap[t.completedAt] = { todos: 0, habits: 0 }
      actMap[t.completedAt].todos++
    }
  })
  habits.forEach(h => h.completedDates.forEach(d => {
    if (!actMap[d]) actMap[d] = { todos: 0, habits: 0 }
    actMap[d].habits++
  }))

  // ── Build grid cells ──────────────────────────────────────
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay    = getFirstDayOfMonth(calYear, calMonth)
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)   // empty padding
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, ds })
  }

  const isCurrentMonth =
    calYear  === new Date().getFullYear() &&
    calMonth === new Date().getMonth()

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric'
  })

  // ── Day detail panel (shown when a day is clicked) ────────
  let detailHtml = ''
  if (calSelectedDay) {
    const dayTodos  = todos.filter(t => t.date === calSelectedDay)
    const dayHabits = habits
      .filter(h => h.createdAt <= calSelectedDay)
      .map(h => ({ ...h, done: h.completedDates.includes(calSelectedDay) }))
    const hasContent = dayTodos.length > 0 || dayHabits.length > 0

    detailHtml = `
      <div class="cal-detail">
        <div class="cal-detail-header">
          <span class="cal-detail-date">${fmtDate(calSelectedDay)}</span>
          <button class="cal-detail-close" onclick="closeCalDetail()">×</button>
        </div>

        ${!hasContent
          ? `<p class="cal-detail-empty">Nothing recorded for this day.</p>`
          : ''
        }

        ${dayTodos.length ? `
          <div class="cal-detail-section">
            <div class="cal-detail-section-title">✓ To-Dos</div>
            <ul class="cal-detail-list">
              ${dayTodos.map(t => `
                <li class="cal-detail-item ${t.completed ? 'done' : 'not-done'}">
                  <span class="cal-detail-check">${t.completed ? '✓' : '○'}</span>
                  <span class="cal-detail-text">${esc(t.text)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        ${dayHabits.length ? `
          <div class="cal-detail-section">
            <div class="cal-detail-section-title">◎ Habits</div>
            <ul class="cal-detail-list">
              ${dayHabits.map(h => `
                <li class="cal-detail-item ${h.done ? 'done' : 'not-done'}">
                  <span class="cal-detail-dot" style="background:${h.color}"></span>
                  <span class="cal-detail-text">${esc(h.name)}</span>
                  <span class="cal-detail-badge">${h.done ? '✓ done' : '✗ missed'}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `
  }

  document.getElementById('calendar').innerHTML = `
    <div class="cal-title">📅 Calendar &amp; Streaks</div>

    <!-- Overall streak -->
    <div class="cal-streak-row">
      <span class="cal-streak-fire">🔥</span>
      <span class="cal-streak-text">
        <strong>${streak}</strong>
        day streak
      </span>
    </div>

    <!-- Month navigation -->
    <div class="cal-nav">
      <button class="cal-nav-btn" onclick="calPrev()">‹</button>
      <span class="cal-month-label">${monthLabel}</span>
      <button class="cal-nav-btn" onclick="calNext()" ${isCurrentMonth ? 'disabled' : ''}>›</button>
    </div>

    <!-- Day grid -->
    <div class="cal-grid">
      ${'SMTWTFS'.split('').map(l => `<div class="cal-dow">${l}</div>`).join('')}

      ${cells.map(cell => {
        if (!cell) return `<div class="cal-day-empty"></div>`
        const { day, ds } = cell
        const isToday    = ds === today
        const isFuture   = ds > today
        const isSel      = ds === calSelectedDay
        const act        = actMap[ds]
        const hasTodo    = act?.todos > 0
        const hasHabit   = act?.habits > 0
        const hasAct     = (hasTodo || hasHabit) && !isFuture
        const isTokenDay = !isFuture && protectedDays[ds] === 'token'
        const isGraceDay = !isFuture && protectedDays[ds] === 'grace'

        return `
          <div
            class="cal-day
              ${isToday    ? 'cal-today'     : ''}
              ${isFuture   ? 'cal-future'    : ''}
              ${isSel      ? 'cal-selected'  : ''}
              ${hasAct     ? 'cal-active'    : ''}
              ${isTokenDay ? 'cal-token-day' : ''}
              ${isGraceDay ? 'cal-grace-day' : ''}
              ${!isFuture  ? 'cal-clickable' : ''}"
            ${!isFuture ? `onclick="calDayClick('${ds}')"` : ''}
            role="${!isFuture ? 'button' : ''}"
          >
            <span class="cal-day-num">${isGraceDay ? '🎆' : day}</span>
            ${isTokenDay ? `<div class="cal-dots"><span style="font-size:8px">🛡️</span></div>` : ''}
            ${!isTokenDay && hasAct ? `
              <div class="cal-dots">
                ${hasTodo  ? `<span class="cal-dot cal-dot-todo"></span>`  : ''}
                ${hasHabit ? `<span class="cal-dot cal-dot-habit"></span>` : ''}
              </div>
            ` : ''}
          </div>
        `
      }).join('')}
    </div>

    <!-- Legend -->
    <div class="cal-legend">
      <span class="cal-legend-item"><span class="cal-dot cal-dot-todo"></span> To-do</span>
      <span class="cal-legend-item"><span class="cal-dot cal-dot-habit"></span> Habit</span>
      <span class="cal-legend-item">🛡️ Token</span>
      <span class="cal-legend-item">🎆 Grace</span>
      <span class="cal-legend-item cal-legend-click">tap day to inspect</span>
    </div>

    ${detailHtml}
  `
}

// ── Calendar actions ──────────────────────────────────────

function calPrev() {
  if (calMonth === 0) { calYear--; calMonth = 11 }
  else calMonth--
  calSelectedDay = null
  renderCalendar()
}

function calNext() {
  if (calMonth === 11) { calYear++; calMonth = 0 }
  else calMonth++
  calSelectedDay = null
  renderCalendar()
}

// Called when the user clicks a day cell in the calendar
function calDayClick(ds) {
  if (ds > getToday()) return   // never navigate to the future

  // Toggle: clicking the same day again closes the detail panel
  calSelectedDay = calSelectedDay === ds ? null : ds

  // If the Todo tab is active, also switch it to show that day
  if (activeTab === 'todo') {
    browseDate = calSelectedDay || getToday()
    renderTodo()
  }

  renderCalendar()
}

function closeCalDetail() {
  calSelectedDay = null
  if (activeTab === 'todo') {
    browseDate = getToday()
    renderTodo()
  }
  renderCalendar()
}


// ──────────────────────────────────────────────────────────────
//  SECTION 9 — TAB SWITCHING
// ──────────────────────────────────────────────────────────────

// Listen for clicks on the tab bar
document.getElementById('tab-nav').addEventListener('click', e => {
  const btn = e.target.closest('[data-tab]')
  if (!btn) return
  switchTab(btn.dataset.tab)
})

function switchTab(tab) {
  activeTab  = tab
  browseDate = getToday()   // always start fresh on today when switching to Todo

  // Update active class on tab buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab)
  })

  // Render the new tab's content
  if (tab === 'todo')   renderTodo()
  if (tab === 'habits') renderHabits()
  if (tab === 'stats')  renderStats()
}


// ──────────────────────────────────────────────────────────────
//  SECTION 10 — INITIALISATION
//  Runs once when the page loads.
// ──────────────────────────────────────────────────────────────

// Show today's date and token balance in the header
function updateHeader() {
  document.getElementById('app-date').textContent =
    new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

  // Token badge — always visible in the header
  const el = document.getElementById('header-tokens')
  if (el) {
    el.innerHTML = `
      <div class="token-badge">
        🛡️ ${freezeTokens} token${freezeTokens !== 1 ? 's' : ''}
      </div>
    `
  }
}

// Initial render
updateHeader()
renderTodo()
renderCalendar()
