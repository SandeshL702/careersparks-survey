# CareerSparks Survey

<p align="center">
  <a href="https://survey.careersparksco.in/"><strong>Live demo → survey.careersparksco.in</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/live-demo-0f766e?style=flat-square" alt="live" />
  <img src="https://img.shields.io/badge/stack-Node.js%20%2B%20MySQL-111827?style=flat-square" alt="stack" />
  <img src="https://img.shields.io/badge/for-India%20hiring%20teams-1d4ed8?style=flat-square" alt="india hiring" />
</p>

**CareerSparks Survey** is a recruitment survey app for Indian hiring teams.

Collect job requirements and candidate answers on a public form. Review everything in a staff admin dashboard. No heavy ATS. No SaaS lock-in.

## Why it exists

Most hiring tools are either Excel chaos or expensive ATS software.
This app sits in the middle: simple forms for recruiters, a clean admin for staff, MySQL on your own Hostinger plan.

## Features

| Area | What you get |
|---|---|
| Public forms | Job-requirement / recruitment surveys candidates can fill |
| Staff admin | Login, review responses, manage forms |
| Data | Answers stored in **MySQL** (your database) |
| Auth | Staff login with Better Auth |
| Hosting | Runs as a **Node.js** app on Hostinger |

## Live

Try it: **[https://survey.careersparksco.in/](https://survey.careersparksco.in/)**

## Stack

- Node.js 22
- TypeScript
- MySQL
- Better Auth

## Keywords (SEO)

recruitment survey · hiring forms · job requirement form · India HR tools · Node.js survey app · MySQL admin dashboard · CareerSparks

## Run locally

```bash
git clone https://github.com/SandeshL702/careersparks-survey.git
cd careersparks-survey
cp hostinger.env.example .env   # fill your own values — never commit .env
npm install
npm run build:hostinger
npm start
```

## Deploy on Hostinger

1. Add a **Node.js** website (not WordPress)
2. Connect this GitHub repo · Node **22**
3. Build command: `npm run build:hostinger`
4. Start command: `npm start`
5. Create MySQL in hPanel → put values in Hostinger env vars (see `hostinger.env.example`)

Push to `main` rebuilds production.

## Security

- Secrets live only in Hostinger environment variables
- `.env` is gitignored
- Use strong `BETTER_AUTH_SECRET` and admin passwords
- Do not commit real DB passwords or API keys

## License

Built for CareerSparks. Open for learning and reuse — keep secrets out of git.
