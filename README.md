# ChatPlay Trivia

A neon arcade-style multiplayer trivia web app for up to 10 friends, powered by Supabase.

## Included
- Create a room and receive a 6-character code
- Join with a nickname
- Lobby roster with live player updates
- 10 trivia questions, 20-second timer, 10 points per correct answer
- Host-controlled question progression and final scoreboard
- Server-side answer checking through Supabase RPC functions

## 1. Configure Supabase
1. Open your Supabase project.
2. Go to **SQL Editor → New query**.
3. Review `supabase/schema.sql`. It drops and recreates the prototype game tables (`questions`, `game_rooms`, `players`, `answers`). Back up anything important first.
4. Run the SQL script.
5. In **Project Settings → API**, copy the Project URL and the Publishable key (or legacy anon key).

The SQL script inserts ten sample questions. Do not put a `service_role` or secret key in the browser app.

## 2. Run locally
1. Install Node.js 20 or later.
2. Extract this ZIP.
3. Copy `.env.example` to `.env`.
4. Set:
   - `VITE_SUPABASE_URL` to your Project URL
   - `VITE_SUPABASE_ANON_KEY` to your Publishable key
5. In this folder, run:
   ```bash
   npm install
   npm run dev
   ```
6. Open the local address printed by Vite.

## 3. Publish a shareable link with Netlify
1. Create a GitHub account if you do not have one.
2. Create a new GitHub repository and upload the contents of this folder.
3. In Netlify, choose **Add new site → Import an existing project** and connect the repository.
4. Build command: `npm run build`
5. Publish directory: `dist`
6. In Netlify site settings, add the two environment variables from `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy. Your Netlify URL is the link to share.

You can also deploy with Vercel using build command `npm run build`, output directory `dist`, and the same environment variables.

## Important MVP notes
- The room code is a join secret; share it only with invited players.
- This is a lightweight anonymous MVP. It does not include account authentication, reconnect identity recovery, anti-cheat/rate limiting, moderation, or payment features.
- The app uses a host-controlled “Next question” button. The 20-second deadline is enforced by the database when answers are submitted, but the host advances the round.
- The public lobby/player read policies expose nicknames and scores to anyone who can reach the Supabase project. Add stricter room membership policies and authenticated player sessions before using this for sensitive/private groups.
- The frontend never reads the answer key directly; correctness is checked in a database function.
