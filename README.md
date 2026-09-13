# RUMC Full-Stack Website

A working local full-stack college website foundation.

## Requirements

- Node.js 18+ (20+ recommended)
- Internet connection for the demo remote images and Google Maps iframe

## Run

1. Open a terminal in this folder.
2. Install dependencies:

```bash
npm install
```

3. Start:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## Demo accounts

Admin:
- Username: `admin`
- Password: `admin123`

Student:
- Username: `RUMC001`
- Password: `student123`

**Change these credentials and `JWT_SECRET` before any real/public deployment.**

## What is included

- Responsive homepage
- About / academics sections
- Dynamic notices from SQLite
- Dynamic events
- Dynamic gallery
- Admission enquiry form saved to SQLite
- Student login
- Student dashboard
- Demo student result data
- Admin login
- Admin dashboard
- Admission application list
- Student list
- Publish/delete notices
- SQLite database automatically created as `data.db`
- JWT authentication
- Password hashing with bcryptjs

## Production notes

This is a development/educational foundation, not an official college system.

Before public deployment:
- Verify all institutional facts, contacts, EIIN and branding.
- Change default credentials.
- Set a strong `JWT_SECRET` environment variable.
- Add HTTPS.
- Add rate limiting, CSRF protection where appropriate, validation, audit logs and backups.
- Add role/permission management.
- Add proper file upload storage if you want administrators to upload images/PDF notices.
- Use a production database such as PostgreSQL/MySQL if required by the hosting environment.
