# Chatter

A responsive messaging-app starter built with plain HTML, CSS and JavaScript.

## Preview locally
Open `index.html` in a browser.

## Current status
This is the visual starter only. Messages are temporary and stored in browser memory. Accounts, real-time delivery, group chat, image uploads, voice messages, read receipts and typing indicators still need to be connected to Supabase.

## Security
Do not put a Supabase `service_role` or secret key in browser code. The browser app should use only the publishable key, with Row Level Security policies enabled on every exposed table before real user data is added.
