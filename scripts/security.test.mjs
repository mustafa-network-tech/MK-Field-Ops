import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => fs.readFileSync(path, 'utf8');
const roles = ['companyManager', 'projectManager', 'teamLeader', 'superAdmin'];
function memoryStorage() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), values };
}
function loadTs(path, imports = {}, globals = {}, suffix = '') {
  const source = (read(path) + suffix).replaceAll('import.meta.env', '({ PROD: true, DEV: false })');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => {
    if (!(key in imports)) throw new Error(`Unexpected dependency: ${key}`);
    return imports[key];
  }, console, ...globals }, { filename: path });
  return exports;
}
function fixture({ role = 'teamLeader', status = 'approved', missing = false, configured = true, profileError = false, authError = false, defer } = {}) {
  const localStorage = memoryStorage(), sessionStorage = memoryStorage();
  const { store } = loadTs('src/lib/storage/store.ts', {}, { localStorage, sessionStorage });
  let signouts = 0;
  const profile = missing ? null : { id: 'user-1', company_id: role === 'superAdmin' ? null : 'company-1', role, role_approval_status: status, full_name: 'Test', can_see_prices: false };
  const authUser = { id: 'user-1', email: 'test@example.invalid', user_metadata: { role: 'superAdmin', company_id: 'foreign-company', role_approval_status: 'approved' } };
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() {
    if (defer) await defer.promise;
    return { data: profile, error: profileError ? new Error('DB denied') : null };
  } };
  const supabase = configured ? {
    auth: {
      async signInWithPassword() { return { data: { user: authUser }, error: authError ? new Error('invalid credentials') : null }; },
      async getUser() { return { data: { user: authUser }, error: authError ? new Error('expired token') : null }; },
      async signOut() { signouts++; return { error: null }; },
    },
    from(name) { assert.equal(name, 'profiles'); return query; },
  } : null;
  const { authService } = loadTs('src/features/auth/services/authService.ts', {
    '@/lib/storage/store': { store }, '@/lib/supabase/supabaseClient': { supabase },
    '@/lib/supabase/supabaseSyncService': { async fetchCompanyDataFromSupabase() { return { ok: true }; } },
  });
  return { authService, store, localStorage, sessionStorage, profile, authUser, signouts: () => signouts };
}

for (const role of roles) {
  test(`${role}: valid DB profile survives login and restore; metadata cannot override it`, async () => {
    const f = fixture({ role });
    assert.equal((await f.authService.login('test@example.invalid', 'password')).ok, true);
    assert.equal(f.authService.getVerifiedUser().role, role);
    assert.equal(await f.authService.restoreSession(), true);
    assert.equal(f.authService.getVerifiedUser().role, role);
    assert.equal(f.authService.getVerifiedUser().canSeePrices, false);
  });
  test(`metadata ${role} cannot create authority when the DB profile is absent`, async () => {
    const f = fixture({ missing: true });
    f.authUser.user_metadata.role = role;
    assert.equal((await f.authService.login('test@example.invalid', 'password')).ok, false);
    assert.equal(await f.authService.restoreSession(), false);
    assert.equal(f.authService.getVerifiedUser(), undefined);
  });
  for (const status of ['pending', 'rejected']) test(`${role}/${status}: login and restore denied`, async () => {
    const f = fixture({ role, status });
    assert.equal((await f.authService.login('test@example.invalid', 'password')).ok, false);
    assert.equal(await f.authService.restoreSession(), false);
    assert.equal(f.authService.getVerifiedUser(), undefined);
    assert.ok(f.signouts() > 0);
  });
}
for (const options of [{ missing: true }, { profileError: true }, { authError: true }, { configured: false }]) {
  test(`failed restore clears stale user, tenant data and legacy passwords: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    f.localStorage.setItem('tf_current_user_id', 'attacker');
    f.localStorage.setItem('tf_users', '[{"id":"attacker","role":"superAdmin","passwordHash":"cGFzcw=="}]');
    f.localStorage.setItem('tf_jobs', '[{"private":"data"}]');
    f.sessionStorage.setItem('mkops_paid_signup_session_v1', '{"password":"plaintext"}');
    f.localStorage.setItem('locale', 'tr');
    assert.equal(await f.authService.restoreSession(), false);
    assert.equal(f.store.getCurrentUser(), undefined);
    assert.equal(f.localStorage.getItem('tf_jobs'), null);
    assert.equal(f.localStorage.getItem('tf_users'), null);
    assert.equal(f.sessionStorage.getItem('mkops_paid_signup_session_v1'), null);
    assert.equal(f.localStorage.getItem('locale'), 'tr');
  });
}
test('missing production Supabase never attempts local password auth or signup', async () => {
  const f = fixture({ configured: false });
  assert.equal((await f.authService.login('test@example.invalid', 'password')).ok, false);
  assert.equal((await f.authService.registerNewCompany({})).ok, false);
  assert.equal((await f.authService.registerExistingCompany({ email: 'test@example.invalid', companyName: 'Test', joinCode: '1234' })).ok, false);
});
test('invalid role, membership or mismatched identity cannot restore', async () => {
  for (const patch of [{ role: 'owner' }, { company_id: null }, { id: 'foreign-user' }, { role: 'superAdmin', company_id: 'company-1' }]) {
    const f = fixture(); Object.assign(f.profile, patch);
    assert.equal(await f.authService.restoreSession(), false);
  }
});
test('cache tampering does not change the verified in-memory session', async () => {
  const f = fixture(); await f.authService.restoreSession();
  f.store.updateUser('user-1', { role: 'superAdmin', canSeePrices: true });
  const copy = f.authService.getVerifiedUser(); copy.role = 'superAdmin';
  assert.equal(f.authService.getVerifiedUser().role, 'teamLeader');
  assert.equal(f.authService.getVerifiedUser().canSeePrices, false);
});
test('a valid restore removes legacy password hashes without erasing valid tenant cache', async () => {
  const f = fixture();
  f.localStorage.setItem('tf_users', '[{"id":"user-1","companyId":"company-1","passwordHash":"cGFzcw=="}]');
  f.localStorage.setItem('tf_jobs', '[{"id":"job-1","companyId":"company-1"}]');
  assert.equal(await f.authService.restoreSession(), true);
  assert.equal(f.store.getCurrentUser().passwordHash, '');
  assert.equal(JSON.parse(f.localStorage.getItem('tf_jobs'))[0].id, 'job-1');
});
test('a late tenant sync cannot repopulate cache after logout', async () => {
  const f = fixture();
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const query = { select() { return this; }, eq() { return waiting; } };
  const sync = loadTs('src/lib/supabase/supabaseSyncService.ts', {
    '@/lib/storage/store': { store: f.store },
    '@/lib/supabase/supabaseClient': { supabase: { from() { return query; } } },
    '@/features/companies/services/companyService': { async fetchCompanyLanguageFromSupabase() {} },
  });
  const pending = sync.fetchCompanyDataFromSupabase('company-1');
  await Promise.resolve(); f.authService.logout(); release({ data: [], error: null });
  assert.equal((await pending).ok, false);
  assert.equal(f.localStorage.getItem('tf_jobs'), null);
});
test('an in-flight restore cannot resurrect a session after logout', async () => {
  let release;
  const defer = { promise: new Promise(resolve => { release = resolve; }) };
  const f = fixture({ defer }); const pending = f.authService.restoreSession();
  await Promise.resolve(); f.authService.logout(); release();
  assert.equal(await pending, false);
  assert.equal(f.authService.getVerifiedUser(), undefined);
  assert.equal(f.store.getCurrentUser(), undefined);
});
test('revocation of an established DB approval invalidates the session', async () => {
  const f = fixture(); assert.equal(await f.authService.restoreSession(), true);
  f.profile.role_approval_status = 'rejected';
  assert.equal(await f.authService.restoreSession(), false);
  assert.equal(f.authService.getVerifiedUser(), undefined);
});
test('paid signup client functions reject before making any request', async () => {
  const api = loadTs('src/lib/api/paidSignupApi.ts');
  await assert.rejects(api.createPendingSignupApi({}), /paidSignupDisabled/);
  await assert.rejects(api.mockPaymentSuccessApi({}), /paidSignupDisabled/);
});
for (const route of ['create-pending-signup', 'mock-payment-success', 'supabase-functions']) {
  test(`Vercel ${route}: all methods reject even with a forged secret or completed signup`, async () => {
    const { default: handler } = await import(`../api/${route}.js`);
    for (const method of ['POST', 'GET', 'OPTIONS']) {
      let status, body;
      const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
      await handler({ method, headers: { 'x-mock-payment-secret': 'forged' }, body: { status: 'completed' } }, res);
      assert.equal(status, 503); assert.equal(body.ok, false);
    }
  });
}
test('shared Node activation cannot touch an admin client', async () => {
  const { activatePaidSignup } = await import('../api/lib/activatePaidSignupNode.js');
  const poison = new Proxy({}, { get() { throw new Error('Admin client accessed'); } });
  assert.equal((await activatePaidSignup(poison, {})).ok, false);
});
for (const name of ['create-pending-signup', 'mock-payment-success']) {
  test(`Edge ${name}: runtime rejects without credentials or network access`, async () => {
    let handler;
    loadTs(`supabase/functions/${name}/index.ts`, {}, { Deno: { serve(fn) { handler = fn; } }, Response });
    const response = await handler(new Request('https://example.invalid', { method: 'POST' }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
  });
}
test('legacy checkout password storage is removed, never restored or written', () => {
  for (const [path, key, get, set] of [
    ['paidSignupSession', 'mkops_paid_signup_session_v1', 'getPaidSignupSession', 'setPaidSignupSession'],
    ['pendingNewCompanySignup', 'mkfieldops_pending_new_company_v1', 'getPendingNewCompanySignup', 'setPendingNewCompanySignup'],
  ]) {
    const sessionStorage = memoryStorage(); sessionStorage.setItem(key, '{"password":"plaintext"}');
    const api = loadTs(`src/lib/storage/${path}.ts`, {}, { sessionStorage });
    assert.equal(api[get](), null); assert.equal(sessionStorage.getItem(key), null);
    assert.throws(() => api[set]({ password: 'plaintext' }), /paidSignupDisabled/);
    assert.equal(sessionStorage.getItem(key), null);
  }
});
test('all private guards wait for profile verification; provider cannot bootstrap from cache', () => {
  const guards = read('src/app/router/AppRoutes.tsx');
  for (const name of ['ProtectedRoute', 'SuperAdminRoute', 'PendingJoinRoute', 'PublicOnlyRoute', 'RootRoute']) {
    const start = guards.indexOf(`function ${name}(`);
    assert.match(guards.slice(start, guards.indexOf('\n}', start)), /if \(!authReady\) return null/);
  }
  const provider = read('src/app/providers/AppContext.tsx');
  assert.doesNotMatch(provider, /store\.getCurrentUser/);
  assert.match(provider, /authService\.getVerifiedUser/);
  assert.doesNotMatch(read('src/features/auth/pages/Register.tsx'), /state:.*password/);
});
test('private guards execute correctly for unresolved, anonymous and all four verified roles', () => {
  let context;
  const jsx = (type, props) => ({ type, props });
  const { testGuards: guards } = loadTs('src/app/router/AppRoutes.tsx', {
    react: { lazy: () => 'LazyComponent' },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-router-dom': { Navigate: 'Navigate', Outlet: 'Outlet' },
    '@/app/providers/AppContext': { useApp: () => context },
    '@/app/layouts/Layout': { Layout: 'Layout' },
  }, {}, '\nexport const testGuards = { ProtectedRoute, SuperAdminRoute, PendingJoinRoute };');
  context = { authReady: false, user: { role: 'superAdmin' } };
  for (const guard of Object.values(guards)) assert.equal(guard({ children: 'private' }), null);
  context = { authReady: true, user: undefined };
  for (const guard of Object.values(guards)) assert.equal(guard({ children: 'private' }).props.to, '/login');
  for (const role of roles) {
    context = { authReady: true, user: { role, companyId: role === 'superAdmin' ? '' : 'company-1' } };
    const app = guards.ProtectedRoute({ children: 'private' });
    const admin = guards.SuperAdminRoute({ children: 'admin' });
    assert.equal(role === 'superAdmin' ? app.props.to : app.props.children, role === 'superAdmin' ? '/super-admin' : 'private');
    assert.equal(role === 'superAdmin' ? admin.props.children : admin.props.to, role === 'superAdmin' ? 'admin' : '/');
  }
});
test('production JS and source maps contain no mock-payment secret or local password fallback', () => {
  const files = fs.readdirSync('dist/assets').filter(name => /\.(js|map)$/.test(name));
  assert.ok(files.length > 0, 'Run npm run build first');
  for (const file of files) {
    const source = read(`dist/assets/${file}`);
    assert.doesNotMatch(source, /VITE_MOCK_PAYMENT_SECRET|x-mock-payment-secret|hashPassword|checkPassword|SECURITY_TEST_PAYMENT_SECRET_SENTINEL/);
  }
});
