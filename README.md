# CareerSparks Survey

**Live:** [survey.careersparksco.in](https://survey.careersparksco.in/)

Recruitment survey forms and a staff admin dashboard for CareerSparks.

Built for India hiring teams who need simple forms, not a heavy ATS.

## What it does

- Public survey / job-requirement forms
- Staff login and admin dashboard
- Answers stored in MySQL
- Runs as a Node.js app on Hostinger

## Stack

Node.js · TypeScript · MySQL · Better Auth

## Topics

`survey` · `recruitment` · `forms` · `nodejs` · `typescript` · `mysql` · `india`

## Run locally

1. Clone this repo
2. Copy `hostinger.env.example` → `.env` and fill your own DB + auth values (never commit `.env`)
3. `npm install`
4. `npm run build:hostinger` then `npm start`

## Deploy (Hostinger)

1. Add a **Node.js** website (not WordPress)
2. Connect this GitHub repo · Node **22**
3. Build: `npm run build:hostinger` · Start: `npm start`
4. Create a MySQL database in hPanel
5. Set environment variables from `hostinger.env.example` (use strong secrets)

Push to `main` rebuilds the site.

## Security notes

- Real passwords and secrets stay in Hostinger env vars — not in this repo
- `.env` is gitignored
- First-time setup should use your own secrets; rotate anything that was ever shared
