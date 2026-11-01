# COUNT365

Achieve goals with daily efforts. A 365-day tracker with email + password login.
Static site (HTML/CSS/JS) hosted on Vercel, data and auth on Supabase.

## Files

| File | Purpose |
|---|---|
| `index.html`, `style.css` | Page and styling |
| `script.js` | The app: month/year views, day sheet, tasks |
| `db.js` | Reads and writes tasks in Supabase |
| `auth.js` | Sign up, log in, log out, session handling |
| `routines.js` | The "Repeating tasks" panel |
| `build.js` | Reads your keys from environment variables and builds `dist/` |
| `.env.example` | Template for your local `.env` (the real `.env` is never committed) |
| `supabase/schema.sql` | Database table and security rules |
| `vercel.json`, `package.json` | Vercel build settings |

## Features

- **Carry over:** open today or a future day. If the day before has unfinished tasks, a button offers to copy them in. The original day keeps its own record.
- **Repeating tasks:** the "Repeating tasks" button in the sidebar lets you pick a task, a start and end date, and the weekdays. One task is created for every matching day, and you can tick each one separately.
  Deleting a repeating task removes its tasks from today onwards and keeps past days.
  The site shows the current year, so days after 31 December are saved now and appear when the new year starts.

**Updating an existing project:** run the new `supabase/schema.sql` in the Supabase SQL Editor again. It is safe to repeat and adds the `routines` table.

## About the keys

The Supabase **anon (publishable) key** is designed to be public. It is sent to every visitor's
browser, so it can never be fully hidden on a static site, with or without a `.env` file.
Your data is protected by the Row Level Security rules in `supabase/schema.sql`, not by hiding the key.
Keeping it in `.env` and Vercel environment variables simply keeps it out of your GitHub repository
and makes it easy to change per environment.

The **service_role / secret key** must never be used here. `build.js` refuses to build if it detects one.

## Setup

### 1. Supabase
1. Create a project at https://supabase.com.
2. Open **SQL Editor -> New query**, paste all of `supabase/schema.sql`, click **Run**.
3. Open **Project Settings -> API** and copy the **Project URL** and the **anon public** key.
4. Open **Authentication -> Providers** and make sure **Email** is enabled (it is by default).
   While testing you can switch off **Confirm email** so sign-up logs you straight in.

### 2. Run locally
1. Copy `.env.example` to `.env` and paste your two values.
2. Run:

```
npm run dev
```

Open the address it prints, sign up, add a task, refresh: the task should still be there.

### 3. Deploy on Vercel
1. Push this folder to GitHub (`.env` and `dist/` are ignored automatically).
2. On https://vercel.com click **Add New -> Project** and import the repository.
3. Before deploying, open **Environment Variables** and add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Click **Deploy**. Vercel runs `node build.js` and publishes `dist/` (settings come from `vercel.json`).

If you change a variable later, redeploy so the build picks it up.

### 4. Tell Supabase your live address
In Supabase open **Authentication -> URL Configuration**:
- **Site URL**: your Vercel address, for example `https://count365.vercel.app`
- **Redirect URLs**: add `https://count365.vercel.app/**` and `http://localhost:3000/**`

### 5. Test on two devices
Sign up on your laptop, add a task, then log in with the same email on your phone. The task should appear.

## Notes
- Tasks added before this version were stored only in that browser and are not copied to Supabase.
- Supabase's built-in email sender allows only a few emails per hour. For real users, add your own SMTP provider under **Authentication -> SMTP Settings**.
- Not included yet: forgot-password flow.