/**
 * Company logo upload to Supabase Storage (bucket: company-logos).
 * Accepts PNG, JPG, SVG; max 2MB. Returns public URL for companies.logo_url.
 *
 * Create the bucket in Supabase Dashboard: Storage → New bucket → name "company-logos" → Public.
 */

const BUCKET = 'company-logos';
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.svg'];

export function isAllowedLogoFile(file: File): { ok: true } | { ok: false; error: string } {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return { ok: false, error: 'Only PNG, JPG and SVG are allowed.' };
  }
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.svg')) {
    return { ok: false, error: 'Invalid file type.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'File must be 2MB or smaller.' };
  }
  return { ok: true };
}

export async function uploadCompanyLogo(
  file: File,
  companyId: string
): Promise<{ url: string } | { error: string }> {
  const { supabase } = await import('./supabaseClient');
  if (!supabase) {
    return { error: 'Storage is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
  }

  const check = isAllowedLogoFile(file);
  if (!check.ok) return { error: check.error };

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const path = `${companyId}/${Date.now()}${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    if (error.message?.includes('Bucket not found') || error.message?.includes('does not exist')) {
      return { error: 'BUCKET_NOT_FOUND' };
    }
    return { error: error.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
