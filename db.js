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

  function check(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  window.DB = {
    configured: !!client,
    client,

    /** All tasks of the signed-in user for a year, as { "YYYY-MM-DD": [{id, t, done}] } */
    async loadYear(year) {
      const PAGE = 1000;
      let rows = [], from = 0;
      for (;;) {
        const chunk = check(await client.from('tasks')
          .select('id, day, text, done')
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
      rows.forEach(r => { (map[r.day] = map[r.day] || []).push({ id: r.id, t: r.text, done: r.done }); });
      return map;
    },

    /** Insert a task; returns its new id. user_id is filled in by the database. */
    async add(day, text) {
      const row = check(await client.from('tasks').insert({ day, text }).select('id').single());
      return row.id;
    },

    async setDone(id, done) {
      if (!id) return;
      check(await client.from('tasks').update({ done }).eq('id', id));
    },

    async remove(id) {
      if (!id) return;
      check(await client.from('tasks').delete().eq('id', id));
    }
  };
})();
