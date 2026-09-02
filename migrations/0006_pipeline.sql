alter table responses add column if not exists phone_digits text;
alter table responses add column if not exists stage text not null default 'new';

create index if not exists responses_phone_digits_idx on responses (form_id, phone_digits);
create index if not exists responses_email_idx on responses (form_id, respondent_email);
create index if not exists responses_stage_idx on responses (form_id, stage);
