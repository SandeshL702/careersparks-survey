# CareerSparks Survey

Recruitment forms + admin dashboard for [CareerSparks](https://survey.careersparksco.in).

Yellow / black. Collect responses from WhatsApp, analyse in admin, one person per phone/email.

## Hostinger deploy (Business plan)

**Do not use WordPress / Softaculous / File Manager.** This is a Node.js app.

### 1. MySQL

hPanel → **Databases** → **MySQL** → Create. Save host, name, user, password.

### 2. Node.js Web App

hPanel → **Websites** → **Add website** → **Node.js Web App** → **Import Git Repository**

Connect this repo (`main`).

| Setting | Value |
|---|---|
| Node | 22 |
| Build | `npm run build:hostinger` |
| Start | `npm start` |
| Package manager | npm |

### 3. Environment variables

| Name | Value |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_PORT` | `3306` |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `BETTER_AUTH_URL` | `https://survey.careersparksco.in` |
| `BETTER_AUTH_SECRET` | 32+ random characters |
| `VITE_AUTH_ENABLED` | `true` |
| `ADMIN_EMAIL` | your login email |
| `ADMIN_PASSWORD` | strong password (set this — do not leave default) |
| `ADMIN_NAME` | `CareerSparks Admin` |

Optional thank-you mail: `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM`

### 4. Domain

Attach `survey.careersparksco.in`. SSL is automatic if the domain is on Hostinger.

### 5. First login

Open the site → scroll to the footer **Staff** link → sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Tables and the admin account are created on first start. Job Requirement Form is seeded.

Push to `main` → Hostinger rebuilds automatically.
