/* ============================================================
   COUNT365 — Email + password authentication (Supabase Auth)
   ============================================================ */
(function () {
  const $ = id => document.getElementById(id);
  const authEl = $('auth'), form = $('af'), emailEl = $('ae'), passEl = $('ap');
  const msgEl = $('amsg'), subBtn = $('asub'), seg = $('aseg');
  let mode = 'login';
  let userId = null;

  function say(text, isError) {
    msgEl.textContent = text || '';
    msgEl.classList.toggle('err', !!isError);
  }

  function setMode(m) {
    mode = m;
    seg.dataset.m = m;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    subBtn.textContent = m === 'login' ? 'Log in' : 'Create account';
    passEl.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    say('');
  }
  seg.querySelectorAll('button').forEach(b => { b.onclick = () => setMode(b.dataset.m); });

  if (!DB.configured) {
    say('Add your Supabase URL and anon key in config.js to enable login.', true);
    subBtn.disabled = true;
    return;
  }

  const auth = DB.client.auth;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    say('');
    const email = emailEl.value.trim();
    const password = passEl.value;
    if (!email || !password) { say('Enter your email and password.', true); return; }
    if (mode === 'signup' && password.length < 6) { say('Use at least 6 characters for the password.', true); return; }

    subBtn.disabled = true;
    try {
      if (mode === 'login') {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMode('login');
          say('Account created. Check your email to confirm it, then log in.');
        }
      }
    } catch (err) {
      say(err.message || 'Something went wrong. Try again.', true);
    } finally {
      subBtn.disabled = false;
    }
  });

  async function enter(session) {
    if (userId === session.user.id) return;
    userId = session.user.id;
    $('who').textContent = session.user.email;
    try {
      App.setData(await DB.loadYear(App.year));
      authEl.classList.add('off');
      passEl.value = '';
    } catch (err) {
      console.error(err);
      userId = null;
      say('Could not load your tasks. Log in again to retry.', true);
    }
  }

  function leave() {
    userId = null;
    $('who').textContent = '';
    App.setData({});
    authEl.classList.remove('off');
  }

  // setTimeout avoids calling Supabase inside its own auth callback
  auth.onAuthStateChange((event, session) => {
    if (session) setTimeout(() => enter(session), 0);
    else leave();
  });

  $('logout').onclick = () => auth.signOut();
})();
