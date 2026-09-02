# CareerSparks Survey

Recruitment forms + admin dashboard for CareerSparks.

## 1-click install on Hostinger Business

WordPress / Softaculous auto-installer **cannot** run this app (it is Node.js, not PHP). Closest 1-click:

### A. Hostinger (2 minutes)

1. hPanel → **Websites** → **Add website** → **Node.js Web App**
2. Import GitHub repo `SandeshL702/careersparks-survey`
3. Node **22** · Build `npm run build:hostinger` · Start `npm start`
4. Deploy
5. hPanel → **Databases** → **MySQL** → Create (save name, user, password, host)

### B. Website pe Install (1 click)

Open `https://survey.careersparksco.in/install`

1. Paste MySQL details  
2. Choose admin email + password  
3. Press **Install CareerSparks**

Tables, admin account, and Job Requirement Form create ho jayenge. Phir footer **Staff** se login.

Push to `main` = auto rebuild.
