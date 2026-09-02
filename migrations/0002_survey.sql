create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  role text not null default 'recruiter',
  email text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members (user_id);

create table if not exists forms (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  created_by text not null,
  slug text not null unique,
  title text not null,
  description text not null default '',
  category text not null default 'pulse',
  schema_json text not null,
  status text not null default 'draft',
  mode text not null default 'classic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forms_workspace_idx on forms (workspace_id);
create index if not exists forms_status_idx on forms (status);
create index if not exists forms_slug_idx on forms (slug);

create table if not exists form_events (
  id text primary key,
  form_id text not null references forms(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists form_events_form_idx on form_events (form_id, created_at);

create table if not exists responses (
  id text primary key,
  form_id text not null references forms(id) on delete cascade,
  answers_json text not null,
  score integer,
  max_score integer,
  duration_ms integer,
  source text not null default 'web',
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists responses_form_idx on responses (form_id, created_at desc);
