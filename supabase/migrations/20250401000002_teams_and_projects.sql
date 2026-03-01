-- =============================================================================
-- Migration: Teams, Projects
-- Bağımlılık: companies, profiles, vehicles, campaigns
-- Teams: leader_id -> profiles(id), vehicle_id -> vehicles(id)
-- Projects: campaign_id -> campaigns(id), created_by -> profiles(id), completed_by -> profiles(id)
-- =============================================================================

-- 1) Teams – ekipler (lider, araç, onay durumu, manuel üyeler json)
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_ids uuid[] DEFAULT '{}',
  members_manual jsonb DEFAULT '[]',
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teams_company_code UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_teams_company_id ON public.teams (company_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams (leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_company_leader ON public.teams (company_id, leader_id);
COMMENT ON TABLE public.teams IS 'Teams; Team Leader sees only rows where leader_id = auth.uid().';

-- 2) Projects – projeler (kampanya, yıl, dış ID, durum, tamamlayan)
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  project_year int NOT NULL CHECK (project_year >= 2000 AND project_year <= 2100),
  external_project_id text NOT NULL,
  received_date date NOT NULL,
  name text,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_campaign_id ON public.projects (campaign_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_status ON public.projects (company_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_company_year_ext ON public.projects (company_id, project_year, external_project_id);
COMMENT ON TABLE public.projects IS 'Projects; key = (company, year, external_project_id).';
