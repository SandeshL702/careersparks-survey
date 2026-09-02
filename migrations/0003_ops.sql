create table if not exists workspace_settings (
  workspace_id text primary key references workspaces(id) on delete cascade,
  smtp_host text not null default 'smtp.hostinger.com',
  smtp_port integer not null default 465,
  smtp_user text not null default '',
  smtp_pass text not null default '',
  smtp_from text not null default '',
  notify_email text not null default '',
  thank_you_subject text not null default 'We received your {{form}} response',
  thank_you_body text not null default 'Hi {{name}},

Thank you for submitting {{form}}. CareerSparks has your response.

{{score_line}}

We will be in touch if there is a next step.

— CareerSparks',
  notify_subject text not null default 'New response: {{form}} — {{name}}',
  notify_body text not null default 'New response on {{form}}.

Name: {{name}}
Email: {{email}}
Phone: {{phone}}
Score: {{score}}
Source: {{source}}

Open the admin dashboard to review.',
  updated_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  form_id text references forms(id) on delete set null,
  response_id text,
  kind text not null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_ws_idx on email_outbox (workspace_id, created_at desc);

alter table responses add column if not exists reviewed boolean not null default false;
