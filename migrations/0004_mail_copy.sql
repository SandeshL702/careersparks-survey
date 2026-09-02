update workspace_settings
set thank_you_subject = 'Thank you for filling the form',
    thank_you_body = 'Hi {{name}},

Thank you for filling the form.

We have received your response for {{form}}.

{{score_line}}

— CareerSparks'
where thank_you_subject like 'We received your%';
