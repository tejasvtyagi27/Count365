/* ============================================================
   COUNT365 — Supabase data layer
   ============================================================ */
(function () {
  const cfg = window.COUNT365_CONFIG || {};
  const configured =
    !!cfg.SUPABASE_URL && !!cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes('YOUR-') && !cfg.SUPABASE_ANON_KEY.includes('YOUR-');

  const client = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const TASK_COLUMNS = 'id, day, text, done, routine_id';

  function check(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  window.DB = {
    configured: !!client,
    client,

    /** All tasks of the signed-in user for a year, as { "YYYY-MM-DD": [{id, t, done, rid}] } */
    async loadYear(year) {
      const PAGE = 1000;
      let rows = [], from = 0;
      for (;;) {
        const chunk = check(await client.from('tasks')
          .select(TASK_COLUMNS)
          .gte('day', year + '-01-01')
          .lte('day', year + '-12-31')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1));
        rows = rows.concat(chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }
      const map = {};
      rows.forEach(r => {
        (map[r.day] = map[r.day] || []).push({ id: r.id, t: r.text, done: r.done, rid: r.routine_id });
      });
      return map;
    },

    /** Insert a task; returns its new id. user_id is filled in by the database. */
    async add(day, text) {
      const row = check(await client.from('tasks').insert({ day, text }).select('id').single());
      return row.id;
    },

    /** Insert many tasks at once: rows = [{ day, text, routine_id? }]. Returns the saved rows. */
    async addMany(rows) {
      let out = [];
      for (let i = 0; i < rows.length; i += 500) {
        out = out.concat(check(await client.from('tasks')
          .insert(rows.slice(i, i + 500))
          .select(TASK_COLUMNS)));
      }
      return out;
    },

    async setDone(id, done) {
      if (!id) return;
      check(await client.from('tasks').update({ done }).eq('id', id));
    },

    async remove(id) {
      if (!id) return;
      check(await client.from('tasks').delete().eq('id', id));
    },

    /** Save a repeating task and create one task for each date. r = { text, start, end, days } */
    async createRoutine(r, dates) {
      const row = check(await client.from('routines')
        .insert({ text: r.text, start_day: r.start, end_day: r.end, weekdays: r.days })
        .select('id').single());
      try {
        const tasks = await window.DB.addMany(dates.map(day => ({ day, text: r.text, routine_id: row.id })));
        return { id: row.id, tasks };
      } catch (err) {
        // undo a half-finished save
        await client.from('tasks').delete().eq('routine_id', row.id);
        await client.from('routines').delete().eq('id', row.id);
        throw err;
      }
    },

    async listRoutines() {
      return check(await client.from('routines')
        .select('id, text, start_day, end_day, weekdays')
        .order('created_at', { ascending: false }));
    },

    /** Delete a repeating task and its tasks from fromDay onwards (past days are kept) */
    async removeRoutine(id, fromDay) {
      check(await client.from('tasks').delete().eq('routine_id', id).gte('day', fromDay));
      check(await client.from('routines').delete().eq('id', id));
    }
  };
})();