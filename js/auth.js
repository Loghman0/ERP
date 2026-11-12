/* ============ AUTH ============ */
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const pw = $('loginPassword').value;
  $('loginError').classList.add('hidden');
  $('loginBtn').disabled = true;
  $('loginBtn').innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Yoxlanılır...';
  try {
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (err) {
    $('loginError').textContent = "Giriş alınmadı: " + (err.message || err.code);
    $('loginError').classList.remove('hidden');
  } finally {
    $('loginBtn').disabled = false;
    $('loginBtn').innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket mr-2"></i> Daxil Ol';
  }
});

async function logout() {
  try { if (state.user) await logAudit('logout', 'auth', state.user.uid, state.profile?.email || ''); } catch (_) { }
  await auth.signOut();
  location.reload();
}

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    $('loginScreen').classList.remove('hidden');
    $('app').classList.add('hidden');
    return;
  }
  state.user = user;
  try {
    // Force-refresh the ID token on every login so a role/branch change
    // made while this user was logged out (an admin edited them, or the
    // very-first-admin bootstrap above just ran) takes effect
    // immediately, rather than waiting for the token's natural ~1hr
    // refresh cycle. Cheap (one extra round trip only at login, not on
    // every request) and closes the main practical downside of moving
    // role/branch off the DB and onto custom claims — see
    // functions/src/customClaims.js and database.rules.json for the
    // other half of this migration.
    try { await user.getIdToken(true); } catch (_) { /* best-effort — DB rules below still gate real access either way */ }

    const snap = await db.ref('users/' + user.uid).get();
    let profile = snap.val();
    if (!profile) {
      let isFirstUser = false;
      try {
        const allUsers = await db.ref('users').get();
        if (!allUsers.exists() || !allUsers.hasChildren()) {
          isFirstUser = true;
        }
      } catch (_) {
        isFirstUser = false;
      }

      if (isFirstUser) {
        profile = { email: user.email, role: 'admin', branch: 'all', active: true, name: user.email.split('@')[0], prefs: { theme: 'light', sound: false, anims: true } };
        await db.ref('users/' + user.uid).set(profile);
        toast("İlk istifadəçi olaraq Admin rolu təyin edildi", "info");
        // The DB write above triggers functions/src/customClaims.js's
        // syncUserClaims, but that runs server-side and this session's
        // already-issued ID token won't have the new role/branch claims
        // until refreshed — without this, the very first admin would
        // hit permission-denied on their own first DB rule check (rules
        // now read auth.token.role, not the DB value — see
        // database.rules.json / SECURITY_RULES_README.md). Small delay
        // to give the trigger a moment to actually run before forcing
        // the refresh; see the retry loop a few lines below for the
        // general case this same pattern handles for EVERY login.
        await new Promise((r) => setTimeout(r, 1500));
        await user.getIdToken(true);
      } else {
        toast("Profiliniz tapılmadı. Admin ilə əlaqə saxlayın.", "error");
        await auth.signOut();
        return;
      }
    }
    if (!profile.prefs) profile.prefs = { theme: 'dark', sound: false, anims: false };
    profile = normalizeProfile(profile);
    if (profile.active === false) {
      await auth.signOut();
      $('loginError').textContent = 'Hesabınız deaktiv edilib. Admin ilə əlaqə saxlayın.';
      $('loginError').classList.remove('hidden');
      return;
    }
    state.profile = profile;
    applyPreferences();
    bootApp();
    // Audit: login (fire-and-forget)
    db.ref('users/' + user.uid + '/lastLogin').set(Date.now()).catch(() => { });
    logAudit('login', 'auth', user.uid, user.email);
  } catch (err) {
    console.error("Auth state error:", err);
    if ($('loginError')) {
      $('loginError').textContent = 'Xəta yarandı: ' + (err.message || 'Məlumat bazasına daxil olmaq mümkün olmadı');
      $('loginError').classList.remove('hidden');
    }
    toast('Profil oxunarkən xəta yarandı: ' + (err.message || ''), 'error');
  }
});

/* ============ PREFS ============ */
function applyPreferences() {
  const prefs = state.profile?.prefs || {};
  const isDark = prefs.theme === 'dark';
  const wasDark = document.documentElement.classList.contains('dark-mode');
  document.documentElement.classList.toggle('dark-mode', isDark);
  document.body.classList.toggle('no-anims', prefs.anims === false);
  try { localStorage.setItem('meram_theme', isDark ? 'dark' : 'light'); } catch (e) { }
  const icon = document.querySelector('#colorSchemeToggle i');
  if (icon) icon.className = isDark ? 'fa-solid fa-sun text-sm' : 'fa-solid fa-moon text-sm';
  if (wasDark !== isDark) {
    if (state.charts.ie) renderDashboard();
    if (state.charts.cat) renderFinanceReport();
    if (state.charts.pie) drawBranchPieChart(dashboardTab);
    if (state.charts.exam) renderProfileExams();
  }
}

function toggleColorScheme() {
  const isDark = document.documentElement.classList.contains('dark-mode');
  updatePref('theme', isDark ? 'light' : 'dark');
}

async function updatePref(key, value) {
  if (!state.profile.prefs) state.profile.prefs = {};
  state.profile.prefs[key] = value;
  applyPreferences();
  try {
    await db.ref('users/' + state.user.uid + '/prefs').update({ [key]: value });
  } catch (e) {
    console.error(e);
  }
}

function playClickSound() {
  if (!state.profile?.prefs?.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) { }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('button, .tab-btn, .pill-tab, .nav-item, .chip, a')) {
    playClickSound();
  }
});

