# Chatter — connected starter

## What's included
- Email/password sign-up and log-in
- Username profiles
- Direct conversations and group creation
- Message sending and live message updates
- Read receipts and typing indicator wiring
- Responsive modern layout

## Install/update on GitHub
Upload the contents of this folder to the root of your existing `chatter` repository (main branch), replacing `index.html`, `styles.css`, and `app.js`. Keep `README.md`.

## Supabase setup
The browser app is configured with the project URL and publishable key supplied for this project. Publishable keys are intended for browser use; never add a `service_role` or secret key.

### Important: apply this SQL once in Supabase SQL Editor
The original database setup created the tables and most RLS policies. This extra SQL adds the UPDATE permission needed by typing indicators and enables realtime for the tables used by the app. Run each statement once:

```sql
create policy "Users can update their typing status"
on public.typing_indicators for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.typing_indicators;
alter publication supabase_realtime add table public.message_reads;
```

If Supabase says a policy or table is already in the publication, that item is already configured; don't keep rerunning the whole script.

## Auth settings
For a quick test, in Supabase Authentication > URL Configuration, set Site URL to your deployed website URL after deployment. During local testing you can use the local preview URL. If email confirmation is enabled, new users must confirm their email before logging in.

## Deploy
Use GitHub Pages only for static hosting if desired, or connect the repository to a static host such as Vercel. Set the deployed site URL in Supabase Authentication URL Configuration.

## Still to configure
Profile photo and voice-message uploads need a private Storage bucket and matching Storage policies. The UI placeholder is intentional until those policies are configured. Don't collect real/private messages from other people until you've tested access rules with two separate accounts.
