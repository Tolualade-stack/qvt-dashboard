# PRIME

Every campaign. Live. A campaign dashboard for agencies: each brand is a "world" showing the status of
its content, ads and reports, with updates logged as they happen and anything overdue flagged
with who to escalate to. QVT Media is the founding pilot partner.

## Built with

- **Next.js**: the web app (pages and server logic).
- **Supabase**: the database and logins. Access rules are enforced inside the database.
- **Netlify**: hosts the live site.
- **Google Sheets API**: reads (never writes) the performance reporting sheet.

## Running it on your own computer

1. Install [Node.js](https://nodejs.org) (LTS version).
2. In this folder, run `npm install` once.
3. Copy `.env.example` to `.env.local` and fill in the keys (see the comments in that file).
   `.env.local` is never uploaded to GitHub.
4. Run `npm run dev` and open http://localhost:3000.

## What is not in this repository

The client process documents (`docs/`) and the original brief are kept off GitHub on purpose.
