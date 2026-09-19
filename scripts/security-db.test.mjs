// Actual PostgreSQL engine in memory. No Supabase URL, production data or network.
// This focused fixture covers auth/onboarding schema, not the entire production schema.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const sql = name => fs.readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const companyId = randomUUID(), otherCompanyId = randomUUID();
const users = {};
let baseline;
async function asRole(role, id, callback) {
  assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
  return db.transaction(async tx => {
    await tx.exec(`SET LOCAL ROLE ${role}`);
    await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [id ?? '', role]);
    return callback(tx);
  });
}
async function signup(meta = {}) {
  const id = randomUUID();
  await db.query('INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)', [id, `${id}@example.invalid`, JSON.stringify(meta)]);
  return id;
}
async function profile(id) { return (await db.query('SELECT * FROM public.profiles WHERE id = $1', [id])).rows[0]; }

before(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE public.companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text,
      created_at timestamptz DEFAULT now(), pending_plan text, plan_end_date timestamptz);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), company_id uuid REFERENCES companies(id),
      role text, full_name text, role_approval_status text NOT NULL DEFAULT 'pending', email text, can_see_prices boolean);
    CREATE TABLE public.pending_signups (id uuid PRIMARY KEY, status text);
    CREATE FUNCTION public.try_claim_pending_signup(p_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
    CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  `);
  for (const name of [
    '20250607000001_company_join_and_plan',
    '20260325000003_profiles_self_update_guard',
    '20260325000012_super_admin_global_scope',
    '20260325000013_profiles_rls_no_recursion',
    '20260325000014_rls_break_profiles_cross_table_recursion',
    '20260325000016_company_plan_user_limits_join',
    '20260325000017_user_limits_approved_only',
  ]) await db.exec(sql(name));
  // Latest approval/capacity implementation includes the existing per-company override.
  // Snapshot RPCs later in this migration belong to the wider company schema.
  await db.exec(sql('20260329000001_super_admin_company_user_limit').split('DROP FUNCTION IF EXISTS public.get_my_company_snapshot();')[0]);
  await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role');
  await db.query("INSERT INTO companies (id,name,join_code,plan) VALUES ($1,'Test company','1234','enterprise'), ($2,'Other company','9876','enterprise')", [companyId, otherCompanyId]);
  // Existing legitimate profiles, created before the migration, must remain byte-for-byte intact.
  for (const role of ['companyManager', 'projectManager', 'teamLeader', 'superAdmin']) {
    users[role] = await signup({ role, company_id: role === 'superAdmin' ? null : companyId, role_approval_status: 'approved', full_name: role });
  }
  baseline = (await db.query('SELECT * FROM profiles ORDER BY id')).rows;
  await db.exec(sql('20260919000001_auth_security_hardening'));
});
after(async () => { await db.close(); });

test('migration preserves every existing legitimate DB profile', async () => {
  assert.deepEqual((await db.query('SELECT * FROM profiles ORDER BY id')).rows, baseline);
});
test('all four legitimate roles can still read their own DB profile through RLS', async () => {
  for (const [role, id] of Object.entries(users)) {
    const result = await asRole('authenticated', id, tx => tx.query('SELECT role, role_approval_status FROM profiles WHERE id=$1', [id]));
    assert.equal(result.rows[0].role, role);
    assert.equal(result.rows[0].role_approval_status, 'approved');
  }
});
for (const role of ['superAdmin', 'companyManager', 'projectManager', 'teamLeader']) {
  test(`SQL signup ignores forged ${role}, company and approval metadata`, async () => {
    const id = await signup({ role, company_id: companyId, join_company_id: otherCompanyId, role_approval_status: 'approved', can_see_prices: true });
    const row = await profile(id);
    assert.equal(row.role, null); assert.equal(row.company_id, null); assert.equal(row.role_approval_status, 'pending');
    assert.equal((await db.query('SELECT * FROM join_requests WHERE user_id = $1', [id])).rows.length, 0);
  });
}
test('validated signup credentials create only a pending join request', async () => {
  const id = await signup({ join_company_name: 'Test company', join_code: '1234', role: 'superAdmin', role_approval_status: 'approved' });
  const row = await profile(id);
  assert.equal(row.role, null); assert.equal(row.company_id, null); assert.equal(row.role_approval_status, 'pending');
  const requests = (await db.query('SELECT * FROM join_requests WHERE user_id=$1', [id])).rows;
  assert.equal(requests.length, 1); assert.equal(requests[0].status, 'pending'); assert.equal(requests[0].company_id, companyId);
});
test('invalid join credentials cannot create a request or account', async () => {
  const beforeCount = (await db.query('SELECT count(*) AS n FROM auth.users')).rows[0].n;
  await assert.rejects(signup({ join_company_name: 'Test company', join_code: '0000' }), /Invalid company join credentials/);
  assert.equal((await db.query('SELECT count(*) AS n FROM auth.users')).rows[0].n, beforeCount);
});
test('authenticated users cannot recreate or upsert their privileged profile', async () => {
  const id = await signup();
  await assert.rejects(asRole('authenticated', id, tx => tx.query(
    "INSERT INTO profiles(id,role,role_approval_status) VALUES($1,'superAdmin','approved') ON CONFLICT(id) DO UPDATE SET role='superAdmin',role_approval_status='approved'", [id])), /permission denied/);
});
test('self role/company/approval/permission escalation and identity replacement fail', async () => {
  for (const assignment of ["role='companyManager'", `company_id='${otherCompanyId}'`, "role_approval_status='rejected'", 'can_see_prices=true', `id='${randomUUID()}'`]) {
    await assert.rejects(asRole('authenticated', users.teamLeader, tx => tx.query(`UPDATE profiles SET ${assignment} WHERE id=$1`, [users.teamLeader])), /forbidden|immutable/);
  }
});
test('companyManager cannot turn another company user into superAdmin', async () => {
  await assert.rejects(asRole('authenticated', users.companyManager, tx => tx.query(
    "UPDATE profiles SET role='superAdmin', company_id=NULL WHERE id=$1", [users.teamLeader])), /trusted server\/database/);
});
test('approved CM can still manage an existing team member permission', async () => {
  await asRole('authenticated', users.companyManager, tx => tx.query('UPDATE profiles SET can_see_prices=true WHERE id=$1', [users.teamLeader]));
  assert.equal((await profile(users.teamLeader)).can_see_prices, true);
});
test('trusted service_role can assign a global administrator explicitly', async () => {
  const id = await signup();
  await asRole('service_role', null, tx => tx.query("UPDATE profiles SET role='superAdmin', company_id=NULL, role_approval_status='approved' WHERE id=$1", [id]));
  assert.equal((await profile(id)).role, 'superAdmin');
});
test('CM approval accepts a legitimate request and rejects superAdmin assignment', async () => {
  const id = await signup({ join_company_name: 'Test company', join_code: '1234' });
  const req = (await db.query('SELECT id FROM join_requests WHERE user_id=$1', [id])).rows[0].id;
  const denied = await asRole('authenticated', users.companyManager, tx => tx.query('SELECT approve_join_request($1,$2) AS ok', [req, 'superAdmin']));
  assert.equal(denied.rows[0].ok, false);
  const allowed = await asRole('authenticated', users.companyManager, tx => tx.query('SELECT approve_join_request($1,$2) AS ok', [req, 'teamLeader']));
  assert.equal(allowed.rows[0].ok, true);
  const row = await profile(id);
  assert.equal(row.role, 'teamLeader'); assert.equal(row.company_id, companyId); assert.equal(row.role_approval_status, 'approved');
});
test('pending CM is not authorized by approval RPC or role/company helpers', async () => {
  const id = await signup();
  await db.query("UPDATE profiles SET role='companyManager',company_id=$1 WHERE id=$2", [companyId, id]);
  const result = await asRole('authenticated', id, tx => tx.query('SELECT get_my_profile_role() AS role, get_my_profile_company_id() AS company, approve_join_request($1,$2) AS approved', [randomUUID(), 'teamLeader']));
  assert.deepEqual(result.rows[0], { role: null, company: null, approved: false });
});
test('approval still respects the existing superAdmin per-company user limit override', async () => {
  const id = await signup({ join_company_name: 'Test company', join_code: '1234' });
  const req = (await db.query('SELECT id FROM join_requests WHERE user_id=$1', [id])).rows[0].id;
  await db.query('UPDATE companies SET max_users_override=1 WHERE id=$1', [companyId]);
  try {
    const result = await asRole('authenticated', users.companyManager, tx => tx.query('SELECT approve_join_request($1,$2) AS ok', [req, 'teamLeader']));
    assert.equal(result.rows[0].ok, false);
    assert.equal((await profile(id)).role_approval_status, 'pending');
  } finally { await db.query('UPDATE companies SET max_users_override=NULL WHERE id=$1', [companyId]); }
});
test('legacy pending join profiles already linked to this company remain approvable', async () => {
  const id = await signup({ join_company_name: 'Test company', join_code: '1234' });
  await db.query('UPDATE profiles SET company_id=$1 WHERE id=$2', [companyId, id]);
  const req = (await db.query('SELECT id FROM join_requests WHERE user_id=$1', [id])).rows[0].id;
  const result = await asRole('authenticated', users.companyManager, tx => tx.query('SELECT approve_join_request($1,$2) AS ok', [req, 'projectManager']));
  assert.equal(result.rows[0].ok, true);
});
test('join RPC never moves an existing privileged user to another company', async () => {
  const result = await asRole('authenticated', users.companyManager, tx => tx.query("SELECT request_join_company('Other company','9876') AS result"));
  assert.equal(result.rows[0].result.ok, false);
  assert.equal((await profile(users.companyManager)).company_id, companyId);
});
test('detached user can request membership without gaining company or role', async () => {
  const id = await signup();
  const result = await asRole('authenticated', id, tx => tx.query("SELECT request_join_company('Other company','9876') AS result"));
  assert.equal(result.rows[0].result.ok, true);
  assert.equal((await profile(id)).company_id, null);
  assert.equal((await profile(id)).role_approval_status, 'pending');
});
for (const role of ['anon', 'authenticated']) test(`${role}: direct unpaid company creation denied`, async () => {
  await assert.rejects(asRole(role, users.companyManager, tx => tx.query("INSERT INTO companies(name,join_code,plan) VALUES('Unpaid','1111','enterprise')")), /permission denied/);
});
test('even an old service-role mock endpoint cannot claim a signup', async () => {
  await assert.rejects(asRole('service_role', null, tx => tx.query('SELECT try_claim_pending_signup($1)', [randomUUID()])), /permission denied/);
  assert.equal((await db.query('SELECT try_claim_pending_signup($1) AS ok', [randomUUID()])).rows[0].ok, false);
});
