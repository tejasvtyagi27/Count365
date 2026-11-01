/* ============================================================
   COUNT365 — Repeating tasks panel
   Create a task that repeats on chosen weekdays between two dates,
   and manage the ones you already created.
   ============================================================ */
(function () {
  const $ = id => document.getElementById(id);
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];          // week starts on Monday
  const MAX_RANGE_DAYS = 400;

  const panel = $('rep'), form = $('rf'), textEl = $('rtext');
  const fromEl = $('rfrom'), toEl = $('rto'), goBtn = $('rgo'), msgEl = $('rmsg');
  const listEl = $('rlist'), daysEl = $('rdays');
  let selected = new Set(ORDER);

  /* ---------- small helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(s) {
    return parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function say(text, isError) {
    msgEl.textContent = text || '';
    msgEl.classList.toggle('err', !!isError);
  }
  function sortedDays(arr) {
    return arr.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  }
  function daysLabel(arr) {
    const key = sortedDays(arr).join(',');
    if (arr.length === 7) return 'Every day';
    if (key === '1,2,3,4,5,6') return 'Mon–Sat';
    if (key === '1,2,3,4,5') return 'Mon–Fri';
    if (key === '6,0') return 'Weekends';
    return sortedDays(arr).map(d => DAY_NAMES[d]).join(', ');
  }

  /* ---------- date range -> list of "YYYY-MM-DD" ---------- */
  function compute() {
    const a = fromEl.value, b = toEl.value;
    if (!a || !b) return { list: [], err: '' };
    const start = parse(a), end = parse(b);
    if (end < start) return { list: [], err: 'The end date must be on or after the start date.' };
    if (Math.round((end - start) / 864e5) > MAX_RANGE_DAYS) {
      return { list: [], err: 'Choose a range of up to ' + MAX_RANGE_DAYS + ' days.' };
    }
    const list = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (selected.has(d.getDay())) list.push(iso(d));
    }
    return { list, err: '' };
  }

  function paintButton(list) {
    goBtn.textContent = list.length
      ? 'Add ' + list.length + ' task' + (list.length > 1 ? 's' : '')
      : 'Add to timeline';
    goBtn.disabled = !list.length;
  }

  function refresh() {
    const c = compute();
    say(c.err, !!c.err);
    paintButton(c.list);
    return c.list;
  }

  /* ---------- weekday pills ---------- */
  ORDER.forEach(d => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.d = d;
    b.textContent = DAY_NAMES[d];
    b.onclick = () => {
      if (selected.has(d)) selected.delete(d); else selected.add(d);
      syncPills();
      refresh();
    };
    daysEl.appendChild(b);
  });

  function syncPills() {
    daysEl.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', selected.has(+b.dataset.d));
    });
  }

  $('rpre').addEventListener('click', e => {
    const p = e.target.dataset && e.target.dataset.p;
    if (!p) return;
    selected = new Set(p === 'all' ? ORDER : p === 'monsat' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]);
    syncPills();
    refresh();
  });

  [fromEl, toEl].forEach(el => el.addEventListener('input', refresh));

  /* ---------- list of existing repeating tasks ---------- */
  function renderList(rows) {
    listEl.innerHTML = '';
    $('rlh').hidden = !rows.length;
    rows.forEach(r => {
      const item = document.createElement('div');
      item.className = 'ri';

      const info = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'rit';
      title.textContent = r.text;
      const meta = document.createElement('div');
      meta.className = 'rim';
      meta.textContent = fmt(r.start_day) + ' – ' + fmt(r.end_day) + ' · ' + daysLabel(r.weekdays);
      info.appendChild(title);
      info.appendChild(meta);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'rdel';
      del.textContent = '✕';
      del.setAttribute('aria-label', 'Delete repeating task');
      del.onclick = async () => {
        const ok = window.confirm('Remove "' + r.text + '" from today onwards? Past days stay as they are.');
        if (!ok) return;
        del.disabled = true;
        try {
          const from = App.today();
          await DB.removeRoutine(r.id, from);
          App.removeRoutineTasks(r.id, from);
          await load();
        } catch (err) {
          console.error(err);
          say('Could not remove it. Try again.', true);
          del.disabled = false;
        }
      };

      item.appendChild(info);
      item.appendChild(del);
      listEl.appendChild(item);
    });
  }

  async function load() {
    try { renderList(await DB.listRoutines()); }
    catch (err) { console.error(err); renderList([]); }
  }

  /* ---------- save ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = textEl.value.trim();
    const list = refresh();
    if (!text) { say('Enter the task.', true); return; }
    if (!list.length) { if (!msgEl.textContent) say('Pick at least one day and a valid date range.', true); return; }

    goBtn.disabled = true;
    try {
      const res = await DB.createRoutine(
        { text, start: fromEl.value, end: toEl.value, days: sortedDays([...selected]) },
        list
      );
      App.addTasks(res.tasks);
      textEl.value = '';
      await load();
      say('Added ' + res.tasks.length + ' task' + (res.tasks.length > 1 ? 's' : '') + ' to your timeline.');
    } catch (err) {
      console.error(err);
      say((err && err.message) || 'Could not save. Try again.', true);
    }
    paintButton(compute().list);
  });

  /* ---------- open / close ---------- */
  function openPanel() {
    const today = App.today();
    fromEl.min = toEl.min = today;
    fromEl.value = today;
    toEl.value = addDays(today, 29);
    textEl.value = '';
    selected = new Set(ORDER);
    syncPills();
    refresh();
    panel.classList.remove('off');
    load();
    setTimeout(() => textEl.focus({ preventScroll: true }), 350);
  }
  function closePanel() { panel.classList.add('off'); }

  $('repbtn').onclick = openPanel;
  $('rclose').onclick = closePanel;
  panel.addEventListener('click', e => { if (e.target === panel) closePanel(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.classList.contains('off')) closePanel(); });
})();