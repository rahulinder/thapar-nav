# HANDOFF: Thapar-Nav

Paste this file into a new Claude chat and attach the project zips. Read it fully, then wait for me to name the next item. Do not build anything until I do.

## About me and how to work with me
- I know HTML and CSS, I am a beginner at JavaScript and new to deployment. Explain simply, step by step.
- No comments in generated code.
- Never commit or push. Give me the git commands to run myself.
- Keep my existing design and look. Do not redesign pages.
- Deliver files as zips with project-relative paths, and ALWAYS include an updated HANDOFF-SUMMARY.md (this file) in every zip.
- Build only the item I ask for (my usage limit runs out quickly). Test in a real browser when possible and say plainly what could not be tested.

## Project
Campus navigation web app for Thapar. Users: students, teachers (role `staff`) and visitors find places and navigate to them. Admins manage data.

Stack (fixed; MongoDB and Render must stay): plain HTML/CSS/JS (ES modules) client with Leaflet 1.9.4 + OpenStreetMap; Node.js + Express 4 + Mongoose 8 backend on MongoDB Atlas; JWT (HS256) + bcrypt admin login; Render hosting (backend Web Service + static site); GitHub.

## Folder layout (thapar-nav/)
- backend/: src/{app,config,controllers,middleware,models,routes,services,utils}, scripts/create-admin.js, tests/, server.js
- client/: login, user-option, index, places, menu, support (.html), js/, css/, assets/
- admin/: index.html (login), dashboard, campus-data, places-data, path-editor, import-places, settings, student-data-details, account-settings (.html), top-bar.html, side-bar.html, js/{config,dom,auth,api,login-page,shell,places-page,path-page,csv,import-rules,import-page}.js, css/, assets/
- Docs: README, SETUP-GUIDE, DATABASE-DESIGN, API-REFERENCE, CLIENT-GUIDE, ADMIN-GUIDE, HANDOFF-SUMMARY

## Backend facts
- CORS allow-list from CLIENT_ORIGINS (403 otherwise). Rate limits per 15 min: general 300, login 10, write 120, route 120. Admin passwords at least 10 characters. .env keys: MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGINS.
- backend/src/config/db.js has a DNS fallback (Google/Cloudflare) for Atlas SRV lookup failures. It works on my PC.
- API: POST /api/auth/login {username,password} -> {token,expiresIn,admin}; GET /api/auth/me; GET/POST /api/places; GET/PUT/DELETE /api/places/:id (list params role, category, q, limit<=500, page, includeInactive=true with admin token; returns {count,total,page,places}); GET /api/paths/network, /junctions, /walkways (public); POST /api/places/bulk {mode:skip|update, places:[<=30]} (admin); POST/PUT/DELETE /api/paths/junctions[/:id] and /api/paths/walkways[/:id] (admin); GET /api/route (A*); GET /api/health. Errors: {error, details:[{field,message}]}; duplicates 409.
- Place fields: name (2-120, unique ignoring case), category (academic, hostel, food, admin, library, sports, medical, gate, parking, other), description, aliases (max 10), lat 30.3-30.4, lng 76.3-76.45, visibleTo (student/staff/visitor), openingHours, isEntrance, junction (id or null), isActive.
- Junction: label, lat, lng. Walkway: from, to, distanceMeters (server computed), bidirectional, wheelchairAccessible, name. Deleting a junction removes its walkways and unlinks its places. Editing walkways or junctions refreshes the routing graph.
- Known minor issue: list results from .lean() also contain nameKey and __v (not fixed).

## Status
| Item | Status |
|---|---|
| A setup guide + DB design | Done |
| B backend | Done |
| C client (role pick, map, places, search, details, cache, "server waking up" notice) | Done |
| Satellite map view (client/js/map.js: Esri World Imagery tiles by default, Map/Satellite toggle button under the locate button, choice saved in localStorage key thaparNav.mapStyle; config.js DEFAULT_MAP_STYLE; css in index.css). Admin path editor map is still street-only | Done, switching and saving browser-tested with a Leaflet stand-in, real tiles not seen |
| E1 admin login (username/password, token in sessionStorage, guarded pages, logout, name in top bar) | Done |
| E2 places manager (search, filter, add, in-row edit, delete) | Done |
| E3 walking-paths map editor (add/move/delete junctions, draw walkways, edit flags and names, link places to junctions, overview warnings) | Done |
| D1 live GPS (client/index.html: locate button; map.js: watch, accuracy circle, hideUser; home.js: watchPosition tracking, pauses when tab hidden, permission/no-signal messages) | Done, syntax-checked only, not browser-tested |
| D2 route drawing (route.js handler; Start Route calls /api/route from GPS, or from the first entrance place if off campus; blue line, distance/time banner, clear button, Google Maps fallback on error; places page redirects to index.html?route=<id>) | Done, syntax-checked only, not browser-tested |
| D3 directions (client/js/directions.js builds steps from route coordinates; Directions button in route banner shows the list) | Done, step builder unit-tested, UI not browser-tested |
| D4 from/to (route planner under the map: From and To search boxes, My location button, Change button in banner, directions button on map) | Done, not browser-tested |
| D5 off-route re-route (client/js/offroute.js: distance to route line, 3 bad GPS fixes in a row beyond max(35 m, 1.5 x accuracy), 20 s cooldown, auto re-route from GPS, arrival banner within 25 m; only for routes started from GPS) | Done, tracker logic unit-tested (12 checks), UI not browser-tested |
| D6 role shortcuts (chips under search, per role from ROLE_SHORTCUTS in config.js; each routes to the nearest place of that category from GPS or the first entrance; chips refresh when you move 100 m; client/js/shortcuts.js) | Done, nearest-place logic unit-tested, UI not browser-tested |
| E4 bulk CSV import (admin/import-places.html; backend POST /api/places/bulk; preview, validation, skip/update existing, handles non-UTF-8 files) | Done |
| F deployment (GitHub, Render backend and static site, set PRODUCTION_API_URL in client/js/config.js and admin/js/config.js, add site addresses to CLIENT_ORIGINS) | Not started |
| G extras (PWA, offline, dark mode, feedback) | Not started |

## Repair note
The zip I received had home.js importing setRouteHandler, openInGoogleMaps (route.js), fetchRoute (api.js) and map.drawRoute/clearRoute (map.js) that did not exist. They were added in the D5 work: route.js now has the handler plus Google Maps fallback, api.js has fetchRoute (reads body.route), map.js draws a blue polyline. If your own copy already has these, keep yours and only merge offroute.js and the home.js changes.

## Testing so far
D1, D2, D3 and D4 were only syntax-checked (no Leaflet or real GPS available in the test sandbox). Test it on your phone or with Chrome DevTools > Sensors.

E1, E2, E3 and E4 passed real-browser Playwright tests (45 + 34 + 32 checks) against the real Express app with a fake in-memory database. They have NOT been run against my real Atlas database. Admin dashboard stats, settings, student-data-details and account-settings pages are still static designs.

## Notes for the next item
- My campus data is in places-fixed.csv (104 places: hostels, blocks, food, gates, sports, other). Import it with E4 if not yet done, then draw paths (E3) and link places.
- Data flow for navigation: places have a junction link; the network of junctions and walkways must be drawn (E3) and places linked before /api/route can work. The client shows "No places yet" until places are added in the admin panel.
- First step in a new chat: unzip thapar-nav.zip, (later zips overwrite earlier files), skim the code and docs, then ask which item to build.
- Do not ask me to paste database credentials, and do not store them. If I shared them in a chat earlier, I should change my Atlas password.
