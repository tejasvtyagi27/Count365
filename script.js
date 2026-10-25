/* ============================================================
   COUNT365 — Main Application Script
   ============================================================ */

(function () {

  /* ----------------------------------------------------------
     1. DATA & CONSTANTS
  ---------------------------------------------------------- */

  const CURRENT_YEAR = new Date().getFullYear();
  // Tasks of the signed-in user, keyed by "YYYY-MM-DD".
  // Filled from Supabase after login (see db.js and auth.js).
  let data = {};

  /** Save a task's done-state to Supabase; revert the UI if it fails */
  function syncDone(task, day, li) {
    const wanted = task.done;
    (task.ready || Promise.resolve())
      .then(() => DB.setDone(task.id, wanted))
      .catch(err => {
        console.error(err);
        task.done = !wanted;
        li.classList.toggle('done', task.done);
        if (openDay === day) updateRing();
        paintCell(day);
        updateStats();
        showToast('Could not save. Check your connection.');
      });
  }

  /** Delete a task in Supabase */
  function removeRemote(task) {
    (task.ready || Promise.resolve())
      .then(() => DB.remove(task.id))
      .catch(err => {
        console.error(err);
        showToast('Could not delete. Reload and try again.');
      });
  }

  // Month names, weekday abbreviations, per-month hue values, easing curve
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  const WEEKDAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTH_HUES  = [202,222,244,268,294,320,344,6,18,28,44,214];
  const EASE        = 'cubic-bezier(.2,.8,.2,1)';

  // Build an array of every day in the year
  const totalDays = Math.round(
    (new Date(CURRENT_YEAR, 11, 31) - new Date(CURRENT_YEAR, 0, 0)) / 864e5
  );

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(CURRENT_YEAR, 0, 1 + i);
    days.push({ d, k: iso(d), m: d.getMonth(), i, el: null });
  }

  /* ----------------------------------------------------------
     2. UTILITY HELPERS
  ---------------------------------------------------------- */

  /** Format a Date as "YYYY-MM-DD" */
  function iso(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  /** Shorthand for document.getElementById */
  function $(id) { return document.getElementById(id); }

  /** Create a DOM element with optional class and text */
  function mk(tag, cls, txt) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined) el.textContent = txt;
    return el;
  }

  /** Get tasks array for a given day key */
  function getTasks(key) { return data[key] || []; }

  /** Get completion percentage for a day (null if no tasks) */
  function getPct(key) {
    const t = getTasks(key);
    if (!t.length) return null;
    return Math.round(t.filter(x => x.done).length / t.length * 100);
  }

  /** Classify a day key as 'past', 'today', or 'future' */
  function getState(key) {
    return key < todayKey ? 'past' : key === todayKey ? 'today' : 'future';
  }

  /** Animate a number counter from its previous value to a new value */
  function tweenNumber(el, targetValue) {
    const fromValue = +(el.dataset.v) || 0;
    el.dataset.v = targetValue;
    if (fromValue === targetValue) { el.textContent = targetValue; return; }

    const t0 = performance.now();
    (function tick(t) {
      const progress   = Math.min(1, (t - t0) / 800);
      const eased      = 1 - Math.pow(1 - progress, 3);
      el.textContent   = Math.round(fromValue + (targetValue - fromValue) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ----------------------------------------------------------
     3. VIEW STATE
  ---------------------------------------------------------- */

  let todayKey = iso(new Date());
  let mode     = 'month';          // 'month' | 'year'
  let viewMonth = new Date().getMonth();
  let openDay   = null;            // currently open day object
  let originX   = 0;               // click origin for veil animation
  let originY   = 0;

  /* ----------------------------------------------------------
     4. GRID & STATS RENDERING
  ---------------------------------------------------------- */

  /** Paint a single day cell with current task state */
  function paintCell(day) {
    const el = day.el;
    if (!el) return;

    const pct   = getPct(day.k);
    const state = getState(day.k);

    el.className = 'cell ' + state
      + (pct === null ? ' empty' : '')
      + (pct === 100  ? ' perfect' : '');

    el.querySelector('.fill').style.height = (pct || 0) + '%';

    const label = el.querySelector('.lab');
    label.innerHTML = '';
    label.appendChild(mk('span', 'wd',  WEEKDAYS[day.d.getDay()]));
    label.appendChild(mk('span', 'num', day.d.getDate()));
    if (pct !== null) label.appendChild(mk('span', 'pct', pct + '%'));
  }

  /** Update the sidebar stats counters */
  function updateStats() {
    const dayIndex = days.findIndex(x => x.k === todayKey) + 1;
    let perfectCount = 0;
    let doneCount    = 0;

    days.forEach(x => {
      const t = getTasks(x.k);
      doneCount += t.filter(y => y.done).length;
      if (t.length && getPct(x.k) === 100) perfectCount++;
    });

    tweenNumber($('s1'), dayIndex);
    tweenNumber($('s3'), perfectCount);
    tweenNumber($('s4'), doneCount);

    $('l1').textContent = 'Day of ' + totalDays;
    $('yb').style.width  = (dayIndex / totalDays * 100) + '%';
  }

  /** Update month name, navigation buttons, and grid animation */
  function updateChrome(direction) {
    const isYearMode = mode === 'year';
    const label      = isYearMode ? 'Whole year' : MONTH_NAMES[viewMonth];
    const nameEl     = $('mname');

    if (nameEl.textContent !== label) {
      nameEl.textContent = label;
      nameEl.animate([
        { opacity: 0, transform: `translateY(${direction >= 0 ? 22 : -22}px)`, filter: 'blur(6px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' }
      ], { duration: 650, easing: EASE });
    }

    $('myear').textContent = CURRENT_YEAR;
    $('ghost').textContent = isYearMode ? CURRENT_YEAR : MONTH_NAMES[viewMonth];

    // Segment control
    $('seg').dataset.m = mode;
    document.querySelectorAll('#seg button').forEach(b => {
      b.classList.toggle('on', b.dataset.m === mode);
    });

    // Month chips
    document.querySelectorAll('#chips button').forEach((b, i) => {
      b.classList.toggle('on', !isYearMode && i === viewMonth);
    });

    // Prev/Next buttons
    $('pv').disabled = !isYearMode && viewMonth === 0;
    $('nx').disabled = !isYearMode && viewMonth === 11;

    // Slide the grid in from the correct direction
    if (direction !== 0) {
      grid.animate([
        { opacity: 0, transform: `translateX(${direction * 60}px) scale(.97)` },
        { opacity: 1, transform: 'none' }
      ], { duration: 700, easing: EASE });
    }
  }

  /** Rebuild the hex grid from scratch */
  function buildGrid(direction) {
    days.forEach(x => { x.el = null; });

    const isYearMode  = mode === 'year';
    const stageWidth  = Math.min($('stage').clientWidth, 1100);
    const gap         = isYearMode ? 3 : 5;
    let cols, cellWidth, dayList;

    if (isYearMode) {
      cellWidth = innerWidth < 640 ? 24 : 34;
      cols      = Math.max(8, Math.floor((stageWidth - (cellWidth + gap) / 2) / (cellWidth + gap)));
      dayList   = days;
    } else {
      cols      = 7;
      cellWidth = Math.max(38, Math.min(92, Math.floor(stageWidth / 7.5) - gap));
      dayList   = days.filter(x => x.m === viewMonth);
    }

    const cellHeight = Math.round(cellWidth * 1.1547);
    const root       = document.documentElement.style;
    root.setProperty('--w',   cellWidth  + 'px');
    root.setProperty('--h',   cellHeight + 'px');
    root.setProperty('--gap', gap        + 'px');
    root.setProperty('--mt',  Math.round(-cellHeight * 0.25 + gap * 0.8) + 'px');

    grid.className = isYearMode ? 'mini' : '';
    grid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    let row;

    dayList.forEach((day, n) => {
      // Start a new row
      if (n % cols === 0) {
        row = mk('div', 'row');
        // Offset every other row for the honeycomb effect
        if (Math.floor(n / cols) % 2 === 1) {
          row.style.marginLeft = (cellWidth + gap) / 2 + 'px';
        }
        fragment.appendChild(row);
      }

      const cell = mk('div', 'cell');
      cell.style.setProperty('--c', MONTH_HUES[day.m]);
      cell.style.setProperty('--d',
        (isYearMode ? n * 4 : ((n % cols) + Math.floor(n / cols)) * 45) + 'ms'
      );
      cell.innerHTML = `
        <button class="hex-btn">
          <span class="bg"></span>
          <span class="fill"></span>
          <span class="lab"></span>
        </button>`;
      cell.querySelector('button').setAttribute('aria-label',
        MONTH_NAMES[day.m] + ' ' + day.d.getDate()
      );
      cell.dataset.i = day.i;
      day.el         = cell;
      row.appendChild(cell);
      paintCell(day);
    });

    grid.appendChild(fragment);
    updateChrome(direction === undefined ? 0 : direction);
    updateStats();
  }

  /** Smoothly scroll to a day and animate it */
  function pulseDay(day) {
    if (!day || !day.el) return;
    day.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    day.el.querySelector('.hex-btn').animate([
      { transform: 'scale(1)' },
      { transform: 'scale(2) rotate(20deg)' },
      { transform: 'scale(1)' }
    ], { duration: 800, easing: EASE });
  }

  /* ----------------------------------------------------------
     5. NAVIGATION — MONTH / YEAR MODE
  ---------------------------------------------------------- */

  function goToMonth(index) {
    if (index < 0 || index > 11) return;
    if (mode === 'year') {
      pulseDay(days.find(x => x.m === index));
      return;
    }
    if (index === viewMonth) return;
    const direction = index > viewMonth ? 1 : -1;
    viewMonth = index;
    buildGrid(direction);
  }

  function setMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;
    buildGrid(1);
    if (newMode === 'year') {
      setTimeout(() => pulseDay(days.find(x => x.k === todayKey)), 900);
    }
  }

  /* ----------------------------------------------------------
     6. EVENT WIRING — NAVIGATION CONTROLS
  ---------------------------------------------------------- */

  const grid = $('grid');

  // Month chip buttons
  const chipsContainer = $('chips');
  MONTH_NAMES.forEach((name, i) => {
    const btn = mk('button', '', name.slice(0, 3));
    btn.onclick = () => goToMonth(i);
    chipsContainer.appendChild(btn);
  });

  $('pv').onclick = () => goToMonth(viewMonth - 1);
  $('nx').onclick = () => goToMonth(viewMonth + 1);

  document.querySelectorAll('#seg button').forEach(btn => {
    btn.onclick = () => setMode(btn.dataset.m);
  });

  // Initial build
  buildGrid(0);

  // Rebuild on window resize (debounced)
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => buildGrid(0), 200);
  });

  /* ----------------------------------------------------------
     7. CURSOR GLOW EFFECT
  ---------------------------------------------------------- */

  const tooltip = $('tip');
  const spot    = $('spot');

  addEventListener('mousemove', e => {
    spot.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`;
  });

  /* ----------------------------------------------------------
     8. TOOLTIP ON GRID HOVER
  ---------------------------------------------------------- */

  grid.addEventListener('mousemove', e => {
    const cell = e.target.closest('.cell');
    if (!cell) { tooltip.classList.remove('on'); return; }

    const day  = days[cell.dataset.i];
    const pct  = getPct(day.k);
    const t    = getTasks(day.k);
    const info = t.length
      ? ` – ${t.length} task${t.length > 1 ? 's' : ''} – ${pct}%`
      : '';

    tooltip.textContent = WEEKDAYS[day.d.getDay()] + ', '
      + day.d.getDate() + ' ' + MONTH_NAMES[day.m] + info;
    tooltip.style.left  = Math.min(e.clientX + 14, innerWidth - 230) + 'px';
    tooltip.style.top   = (e.clientY + 16) + 'px';
    tooltip.classList.add('on');
  });

  grid.addEventListener('mouseleave', () => tooltip.classList.remove('on'));

  /* ----------------------------------------------------------
     9. DAY SHEET — OPEN / CLOSE
  ---------------------------------------------------------- */

  const veil  = $('veil');
  const sheet = $('sheet');
  const list  = $('list');
  const input = $('in');

  /** Update the progress ring and task count inside the sheet */
  function updateRing() {
    const t   = getTasks(openDay.k);
    const pct = getPct(openDay.k) || 0;
    const done = t.filter(x => x.done).length;

    $('rp').style.strokeDashoffset = 214 - 214 * pct / 100;
    $('rt').textContent   = pct + '%';
    $('tb').style.width   = pct + '%';
    $('cnt').textContent  = t.length ? `${done} of ${t.length} done` : '';
  }

  /** Remove the empty-state placeholder if any real tasks exist */
  function syncEmptyState() {
    const empty = list.querySelector('.emp');
    if (empty) empty.remove();
  }

  /** Confetti burst when a day reaches 100% */
  function burst() {
    const ringRect  = $('rp').getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const colors    = ['#d4b67a', '#f1d9a0', '#d9a3b8', '#ece6d8'];

    for (let i = 0; i < 30; i++) {
      const particle = mk('i', 'sp');
      particle.style.left       = (ringRect.left - sheetRect.left + 33) + 'px';
      particle.style.top        = (ringRect.top  - sheetRect.top  + 33) + 'px';
      particle.style.background = colors[i % 4];
      particle.style.setProperty('--x', (Math.random() * 360 - 180) + 'px');
      particle.style.setProperty('--y', (Math.random() * 320 - 140) + 'px');
      particle.style.setProperty('--r', (Math.random() * 540) + 'deg');
      sheet.appendChild(particle);
      setTimeout(n => n.remove(), 1400, particle);
    }
  }

  /** Build a single task list item */
  function buildTaskItem(taskObj, taskArray, delay) {
    const li = mk('li', taskObj.done ? 'done' : '');

    if (delay !== undefined) {
      li.style.animationDelay = delay + 'ms';
    } else {
      li.style.animation = 'slide .6s cubic-bezier(.2,1,.3,1)';
    }

    // Checkbox button
    const checkBtn = mk('button', 'chk');
    checkBtn.type  = 'button';
    checkBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
    checkBtn.setAttribute('aria-label', 'Toggle done');
    checkBtn.onclick = () => {
      const prevPct  = getPct(openDay.k);
      taskObj.done   = !taskObj.done;
      li.classList.toggle('done', taskObj.done);
      syncDone(taskObj, openDay, li);
      updateRing();
      paintCell(openDay);
      updateStats();
      if (getPct(openDay.k) === 100 && prevPct !== 100) burst();
    };

    // Delete button
    const delBtn = mk('button', 'del', '✕');
    delBtn.type  = 'button';
    delBtn.setAttribute('aria-label', 'Delete task');
    delBtn.onclick = () => {
      li.classList.add('out');
      setTimeout(() => {
        const idx = taskArray.indexOf(taskObj);
        if (idx > -1) taskArray.splice(idx, 1);
        if (!taskArray.length) delete data[openDay.k];
        removeRemote(taskObj);
        li.remove();
        syncEmptyState();
        updateRing();
        paintCell(openDay);
        updateStats();
      }, 300);
    };

    li.appendChild(checkBtn);
    li.appendChild(mk('span', 'tx', taskObj.t));
    li.appendChild(delBtn);
    return li;
  }

  /** Populate the sheet with the open day's data */
  function fillSheet() {
    const d = openDay.d;

    $('wk').textContent = d.toLocaleDateString(undefined, { weekday: 'long' });
    $('dt').textContent = d.getDate() + ' ' + MONTH_NAMES[d.getMonth()];
    $('mark').textContent = d.getDate();

    list.innerHTML = '';
    const taskList = getTasks(openDay.k);
    taskList.forEach((task, n) => {
      list.appendChild(buildTaskItem(task, taskList, 300 + n * 70));
    });

    syncEmptyState();
    updateRing();

    $('dp').disabled = openDay.i === 0;
    $('dn').disabled = openDay.i === totalDays - 1;
  }

  /** Open the day sheet at a specific day index */
  function openSheet(dayIndex, clickX, clickY) {
    const wasOpen = !!openDay;
    openDay = days[dayIndex];
    fillSheet();

    if (wasOpen) {
      // Already open — just slide to new day content
      $('pg').animate([
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 450, easing: EASE });
      return;
    }

    // Animate the veil open using clip-path from click origin
    originX = clickX;
    originY = clickY;
    veil.getAnimations().forEach(a => a.cancel());
    veil.classList.add('on');
    veil.setAttribute('aria-hidden', 'false');

    const radius = Math.hypot(
      Math.max(clickX, innerWidth  - clickX),
      Math.max(clickY, innerHeight - clickY)
    );

    veil.animate([
      { clipPath: `circle(0px at ${clickX}px ${clickY}px)` },
      { clipPath: `circle(${radius}px at ${clickX}px ${clickY}px)` }
    ], { duration: 750, easing: EASE, fill: 'both' });

    sheet.animate([
      { transform: 'translateX(70px)', opacity: 0 },
      { transform: 'none',             opacity: 1 }
    ], { duration: 750, delay: 180, easing: EASE, fill: 'backwards' });

    setTimeout(() => input.focus({ preventScroll: true }), 700);
  }

  /** Close the day sheet */
  function closeSheet() {
    if (!openDay) return;
    const radius = Math.hypot(
      Math.max(originX, innerWidth  - originX),
      Math.max(originY, innerHeight - originY)
    );
    openDay = null;

    const anim = veil.animate([
      { clipPath: `circle(${radius}px at ${originX}px ${originY}px)` },
      { clipPath: `circle(0px at ${originX}px ${originY}px)` }
    ], { duration: 550, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });

    anim.onfinish = () => {
      veil.classList.remove('on');
      veil.setAttribute('aria-hidden', 'true');
      veil.getAnimations().forEach(a => a.cancel());
    };
  }

  /** Step to the previous or next day from the sheet */
  function stepDay(delta) {
    const nextIndex = openDay.i + delta;
    if (nextIndex < 0 || nextIndex >= totalDays) return;
    const nextDay = days[nextIndex];
    // Switch month view if necessary
    if (mode === 'month' && nextDay.m !== viewMonth) {
      viewMonth = nextDay.m;
      buildGrid(delta);
    }
    openSheet(nextIndex);
  }

  /* ----------------------------------------------------------
     10. EVENT WIRING — SHEET
  ---------------------------------------------------------- */

  grid.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    openSheet(+cell.dataset.i, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  $('close').onclick = closeSheet;
  $('dp').onclick    = () => stepDay(-1);
  $('dn').onclick    = () => stepDay(1);

  veil.addEventListener('click', e => {
    if (e.target === veil) closeSheet();
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSheet();
    } else if (!openDay && mode === 'month' && document.activeElement.tagName !== 'INPUT') {
      if (e.key === 'ArrowLeft')  goToMonth(viewMonth - 1);
      if (e.key === 'ArrowRight') goToMonth(viewMonth + 1);
    }
  });

  /* ----------------------------------------------------------
     11. ADD TASK FORM
  ---------------------------------------------------------- */

  $('f').addEventListener('submit', e => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value || !openDay) return;

    const day      = openDay;
    const taskList = (data[day.k] = data[day.k] || []);
    const newTask  = { id: null, t: value, done: false };
    taskList.push(newTask);
    input.value = '';

    const emptyEl = list.querySelector('.emp');
    if (emptyEl) emptyEl.remove();

    const li = buildTaskItem(newTask, taskList);
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;

    // Save to Supabase; undo the task locally if saving fails
    newTask.ready = DB.add(day.k, value)
      .then(id => { newTask.id = id; })
      .catch(err => {
        console.error(err);
        const idx = taskList.indexOf(newTask);
        if (idx > -1) taskList.splice(idx, 1);
        if (!taskList.length) delete data[day.k];
        li.remove();
        if (openDay === day) updateRing();
        paintCell(day);
        updateStats();
        showToast('Could not save the task. Please try again.');
      });
    updateRing();
    paintCell(openDay);
    updateStats();
  });

  /* ----------------------------------------------------------
     12. TOAST NOTIFICATIONS
  ---------------------------------------------------------- */

  const toastEl = $('toast');

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('on');
    setTimeout(() => toastEl.classList.remove('on'), 4000);
  }

  /* ----------------------------------------------------------
     13. LIVE CLOCK & DAY ROLLOVER
  ---------------------------------------------------------- */

  function tick() {
    const now  = new Date();
    const key  = iso(now);

    // Handle midnight rollover
    if (key !== todayKey) {
      if (now.getFullYear() !== CURRENT_YEAR) {
        location.reload();
        return;
      }
      const prevDay = days.find(x => x.k === todayKey);
      todayKey = key;
      paintCell(prevDay);
      paintCell(days.find(x => x.k === todayKey));
      updateStats();
    }

    // Countdown to end of day
    const midnight    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msLeft      = midnight - now;
    const pad         = n => String(n).padStart(2, '0');
    $('s2').textContent = pad(Math.floor(msLeft / 36e5))
      + ':' + pad(Math.floor(msLeft % 36e5 / 6e4))
      + ':' + pad(Math.floor(msLeft % 6e4  / 1e3));
  }

  /* ----------------------------------------------------------
     14. PUBLIC API (used by auth.js)
  ---------------------------------------------------------- */

  window.App = {
    year: CURRENT_YEAR,
    /** Replace all tasks (after login or logout) and redraw */
    setData(map) {
      if (openDay) closeSheet();
      data = map || {};
      buildGrid(0);
    }
  };

  tick();
  setInterval(tick, 1000);

})();
