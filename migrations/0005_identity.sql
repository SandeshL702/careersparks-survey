alter table responses add column if not exists respondent_user_id text;
alter table responses add column if not exists starred boolean not null default false;
alter table responses add column if not exists notes text not null default '';

create index if not exists responses_user_idx on responses (form_id, respondent_user_id);
