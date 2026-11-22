CHATTER USERNAME + PASSWORD UPDATE

1. Upload index.html, styles.css and app.js to the ROOT of your existing GitHub repository,
   replacing the old files. Keep your other files.
2. In Supabase SQL Editor, run supabase-username-password-setup.sql once.
3. In Supabase Authentication > Providers > Email, turn OFF "Confirm email".
   This app uses a generated internal sign-in identifier so users can register with
   first name, last name, username and password without entering an email address.
4. Keep Email provider enabled. Do NOT enable anonymous sign-ins for this version.
5. After the settings are saved and GitHub Pages has updated, create a fresh account.

LOGIN:
Users log in using username + password. Supabase Auth stores and verifies the password;
the app never stores raw passwords. The Supabase JS client persists the login session
in browser storage, so users remain signed in on that same browser/device.

IMPORTANT LIMITATION:
Because no real email address is collected, password reset and account recovery are
not available. A user who forgets their password or loses browser/device data may lose
access to that account. Add a recovery method before relying on this for important chats.

USERNAME UNIQUENESS:
The SQL creates a case-insensitive unique index. The app checks availability before
registration, and the database prevents duplicate usernames even if two people try
the same name at once.
