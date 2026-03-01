// Scheduled payroll period rollover: ensure active period per company (Option B – Edge Function).
// Schedule: daily (e.g. 00:05 UTC or per your cron). For each company, compute local date in
// company timezone and call ensure_active_payroll_period(company_id, p_today).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getLocalDateInTimezone(ianaTimezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const results: { companyId: string; timezone: string; localDate: string; periodId?: string; error?: string }[] = [];

  try {
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('id, timezone')
      .not('payroll_start_day', 'is', null);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch companies', detail: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const list = companies ?? [];

    for (const company of list) {
      const companyId = company.id;
      const timezone = company.timezone ?? 'Europe/Istanbul';
      const pToday = getLocalDateInTimezone(timezone);

      try {
        const { data: periodId, error: rpcError } = await supabase.rpc('ensure_active_payroll_period', {
          p_company_id: companyId,
          p_today: pToday,
        });

        if (rpcError) {
          results.push({ companyId, timezone, localDate: pToday, error: rpcError.message });
          continue;
        }
        results.push({ companyId, timezone, localDate: pToday, periodId: periodId ?? undefined });
      } catch (e) {
        results.push({ companyId, timezone, localDate: pToday, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: list.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
