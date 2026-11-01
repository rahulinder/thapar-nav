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
- admin/: index.html (login), dashboard, campus-data, places-data, path-editor, import-places, settings, student-data-details (old static design, no longer linked), account-settings (.html), top-bar.html, side-bar.html, js/{config,dom,auth,api,login-page,shell,places-page,path-page,csv,import-rules,import-page}.js, css/, assets/
- Docs: README, SETUP-GUIDE, DATABASE-DESIGN, API-REFERENCE, CLIENT-GUIDE, ADMIN-GUIDE, HANDOFF-SUMMARY

## Backend facts
- CORS allow-list from CLIENT_ORIGINS (403 otherwise). Rate limits per 15 min: general 300, login 10, write 120, route 120. Admin passwords at least 10 characters. .env keys: MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGINS.
- backend/src/config/db.js has a DNS fallback (Google/Cloudflare) for Atlas SRV lookup failures. It works on my PC.
- API: POST /api/clients/ping {clientId,userType,name?,contact?} (public, write limiter); GET /api/clients?type=all|registered|guest&userType&q&page&limit<=100 (admin) -> {count,total,page,totals:{registered,guests},clients}; POST /api/auth/login {username,password} -> {token,expiresIn,admin}; GET /api/auth/me; PUT /api/auth/me {displayName,email,phone,avatar} (admin); PUT /api/auth/password {currentPassword,newPassword} (admin, wrong current password returns 400); GET/POST /api/places; GET/PUT/DELETE /api/places/:id (list params role, category, q, limit<=500, page, includeInactive=true with admin token; returns {count,total,page,places}); GET /api/paths/network, /junctions, /walkways (public); POST /api/places/bulk {mode:skip|update, places:[<=30]} (admin); POST/PUT/DELETE /api/paths/junctions[/:id] and /api/paths/walkways[/:id] (admin); GET /api/route (A*); GET /api/health. Errors: {error, details:[{field,message}]}; duplicates 409.
- Place fields: name (2-120, unique ignoring case), category (academic, hostel, food, admin, library, sports, medical, gate, parking, other), description, aliases (max 10), lat 30.3-30.4, lng 76.3-76.45, visibleTo (student/staff/visitor), openingHours, isEntrance, junction (id or null), isActive.
- Junction: label, lat, lng. Walkway: from, to, distanceMeters (server computed), bidirectional, drivable, driveBidirectional, name. Deleting a junction removes its walkways and unlinks its places. Editing walkways or junctions refreshes the routing graph.
- Known minor issue: list results from .lean() also contain nameKey and __v (not fixed).

## Status
| Item | Status |
|---|---|
| A setup guide + DB design | Done |
| B backend | Done |
| C client (role pick, map, places, search, details, cache, "server waking up" notice) | Done |
| E1 admin login (username/password, token in sessionStorage, guarded pages, logout, name in top bar) | Done |
| E2 places manager (search, filter, add, in-row edit, delete) | Done |
| E3 walking-paths map editor (add/move/delete junctions, draw walkways, edit flags and names, link places to junctions, overview warnings) | Done |
| D1 live GPS (client/index.html: locate button; map.js: watch, accuracy circle, hideUser; home.js: watchPosition tracking, pauses when tab hidden, permission/no-signal messages) | Done, syntax-checked only, not browser-tested |
| D2 route drawing (route.js handler; Start Route calls /api/route from GPS, or from the first entrance place if off campus; blue line, distance/time banner, clear button, Google Maps fallback on error; places page redirects to index.html?route=<id>) | Done, syntax-checked only, not browser-tested |
| D3 directions (client/js/directions.js builds steps from route coordinates; Directions button in route banner shows the list) | Done, step builder unit-tested, UI not browser-tested |
| D4 from/to (route planner under the map: From and To search boxes, My location button, Change button in banner, directions button on map) | Done, not browser-tested |
| D5 off-route re-route (home.js checkRouteProgress: only for GPS-start routes; re-routes after 3 fixes more than 35 m off the line, 15 s cooldown, ignores fixes worse than 60 m accuracy, shows arrival banner within 25 m; constants in config.js) | Done, distance helper unit-tested, not browser-tested |
| User data (admin/user-data.html, side-bar item 2; lists all clients: name, contact, user type, created on; tabs All/Registered/Guests, search, user-type filter, load more; backend Client model, POST /api/clients/ping public, GET /api/clients admin; client login now asks name + phone/email, or Continue as guest; home page pings once per session with a random clientId from localStorage) | Done, validation smoke-tested only, not run against Atlas or a browser |
| D6 role shortcuts | Not started |
| Admin settings + account settings (campus-data layout; settings now only has Account Settings; account page: profile picture upload resized to 96px JPEG, username read-only, name/email/phone inline edit, change password; backend Admin got displayName/email/phone/avatar, PUT /api/auth/me, PUT /api/auth/password; top bar shows name and picture) | Done; account page browser-tested with a mocked API (Playwright), not run against Atlas. Set profile details with: node scripts/set-admin-profile.js <username> <email> <phone> [name] |
| E4 bulk CSV import (admin/import-places.html; backend POST /api/places/bulk; preview, validation, skip/update existing, handles non-UTF-8 files) | Done |
| F deployment (GitHub, Render backend and static site, set PRODUCTION_API_URL in client/js/config.js and admin/js/config.js, add site addresses to CLIENT_ORIGINS) | Not started |
| G extras (PWA, offline, dark mode, feedback) | Not started |

## Testing so far
D1 to D5 were only syntax-checked (no Leaflet or real GPS available in the test sandbox). Test it on your phone or with Chrome DevTools > Sensors.

E1, E2, E3 and E4 passed real-browser Playwright tests (45 + 34 + 32 checks) against the real Express app with a fake in-memory database. They have NOT been run against my real Atlas database. Admin dashboard stats, student-data-details and account-settings pages are still static designs.

## Notes for the next item
- My campus data is in places-fixed.csv (104 places: hostels, blocks, food, gates, sports, other). Import it with E4 if not yet done, then draw paths (E3) and link places.
- Data flow for navigation: places have a junction link; the network of junctions and walkways must be drawn (E3) and places linked before /api/route can work. The client shows "No places yet" until places are added in the admin panel.
- First step in a new chat: unzip thapar-nav-ABC.zip, then thapar-nav-E.zip, thapar-nav-E3.zip, thapar-nav-E4.zip and thapar-nav-D1.zip and thapar-nav-D2.zip and thapar-nav-D3-D4.zip and thapar-nav-D5.zip and thapar-nav-settings.zip and thapar-nav-userdata.zip and thapar-nav-account.zip and thapar-nav-account-fix.zip over it (later zips overwrite earlier files), skim the code and docs, then ask which item to build.
- Do not ask me to paste database credentials, and do not store them. If I shared them in a chat earlier, I should change my Atlas password.

## Admin logo link
- admin/top-bar.html: the top bar logo is wrapped in a link to dashboard.html (id logo-link), so it works on every admin page loaded through shell.js. Not browser-tested.

## Top bar name across admin pages
- admin/js/shell.js: top bar shows admin.displayName (falls back to username) and the profile picture on every admin page, from the saved session, then refreshes from GET /api/auth/me once per page load and re-saves the session. Not browser-tested.

## Client home: shortcuts removed, satellite view
- client/index.html and home.js: the shortcuts bar above the map is gone (client/js/shortcuts.js and ROLE_SHORTCUTS in config.js are now unused).
- Satellite toggle (layers button under the directions button): map.js has toggleSatellite() switching between OpenStreetMap and Esri World Imagery tiles (https://server.arcgisonline.com). Not browser-tested.

## Optional other names (aliases) in places form
- admin/js/places-page.js: the add/edit place detail row has an "Add other names" checkbox; the Other names field shows only when ticked (ticked automatically when the place already has other names). Unticked saves an empty alias list. Not browser-tested.

## User Data page fix (missing files)
- The committed repo referenced files that were not committed: admin/js/user-data-page.js (page stayed on Loading), backend/src/models/Client.js plus its export in models/index.js (controller uses Client), and client-side visit registration.
- Added: user-data-page.js (tabs All/Registered/Guests, search, user type filter, Load more, calls GET /api/clients); Client model (clientId, userType, name, contact, isGuest, visitCount, lastSeenAt); client/js/visits.js (random clientId in localStorage, POST /api/clients/ping once per session and role); roles.js requireRole calls registerVisit; login-page.js now reads name and contact (validated phone or email) and the guest button clears both. client/js/config.js is untouched.
- Not tested against Atlas or a browser.

## Client: greeting and menu drawer
- #role-note on the home page now shows only "Hi <name>" (larger, 32px, bold) and is hidden when there is no name; the user type text and Change link are removed (change user type is still in the menu).
- Menu button (nav bar on index.html and places.html) opens a drawer that slides in from the right covering 75% of the page, same items as menu.html (Home, Change user type, Support, Logout), with a backdrop, close button and Escape to close. Files: client/js/menu-drawer.js, client/css/drawer.css. menu.html still exists as a fallback. Drawer open/close checked in a real browser with a test page; not checked on the real pages.

## Client: background, scrollbars, satellite default, support overlay
- Background #f0f6fc on html and body in base.css, menu.css, places.css (also the sticky category bar), drawer.css (login.css and user-option.css already used it). Old cream #fdf0d5 is gone.
- Scrollbars hidden everywhere on the client (scrollbar-width none and ::-webkit-scrollbar display none in base.css, menu.css, login.css, user-option.css, drawer.css). Scrolling still works.
- Map starts in satellite view (map.js satelliteOn = true, Esri imagery added first; the layers button starts active and switches to OpenStreetMap).
- Support: clicking Support in the nav bar or the menu drawer opens an overlay with Email nav.support@thapar.edu and Contact 9876543210 (menu-drawer.js, drawer.css). support.html (fallback page) now shows only those two lines, FAQs removed.
- #role-note margin is 0.
- Overlay, drawer, background and hidden scrollbar checked in a real browser on a test page; map default not checked (Leaflet CDN blocked in sandbox).

## Client: dark mode
- New client/css/dark.css (all overrides under html[data-theme="dark"], light styles untouched) and client/js/theme.js (plain script, loaded in the head of index, places, login, menu, support, user-option so there is no light flash).
- Default follows the phone/computer setting (prefers-color-scheme) until the user chooses; the choice is saved in localStorage key thaparNav.theme ("dark" or "light").
- Toggle: "Dark mode" / "Light mode" item in the menu drawer (menu-drawer.js) and on menu.html (menu-page.js), placed above Logout.
- Dark map view inverts the OpenStreetMap tiles only; satellite imagery is never inverted (uses :has()). Login logo swaps to the white-name version and the dark doodle is used on the login page.
- Checked in a real browser: login, role page, menu, drawer, home page layout, persistence across pages, no console errors. Not checked: the map tiles (Leaflet CDN blocked in the sandbox), places and place panel with real data, real phones.

## Client: greeting above the map
- #role-note now sits directly under the search header, above the status line, route banner and map (client/index.html); margin 0, padding 8px 16px 0 so it does not touch the screen edge (client/css/index.css). Not browser-tested.
- Admin dark mode idea is dropped (already removed in the repo).

## Route button radius
- client/css/base.css: .card-details .route-button border-radius is now 32px (was 16px).

## Dashboard quick cards (from Figma)
- Figma file NxHqkY7QE851D9kvQECtyp, frames 267:1940 (default) to 267:1944 (hover). Figma exposed no keyframe data, so the transition is built from the two frames: 0.4s ease (assumed).
- admin/dashboard.html: the content inside #main-container is replaced by a .quick-cards grid (top bar and sidebar untouched, shell.js still loads them). One card so far: Hostels, links to places-data.html?category=hostel. Inter 700 font link added.
- admin/css/dashboard.css: old dashboard content styles (search bar, stats, quick links, etc.) removed; new .quick-card styles. Card 256x160, radius 32, gradient 58deg to 238deg on hover/focus (animated with @property --card-angle), title slides 35px right, icon slides up from below the card.
- The icon uses the existing assets/admin-panel/dashboard/boys-hostel.svg (looks identical to the design); the Figma asset URL could not be downloaded from the sandbox.
- Checked in a real browser on a test page (both states match the frames); not checked with login and shell.js.

## Dashboard: #main-container removed
- admin/dashboard.html: .quick-cards now sits directly in #dashboard-body next to the sidebar; the #main-container wrapper and its dark panel styles are gone from dashboard.html and dashboard.css (no other admin file used it from dashboard.css).
- Not browser-tested with login.

## Dashboard: five quick cards (from Figma)
- Frames (default -> hover): Shops 267:1931->1948, Parks & Grounds 267:1926->1951, Classes 267:1935->1955, Visitors 267:1921->1959 (plus Hostels from before).
- admin/dashboard.html: five .quick-card links; admin/css/dashboard.css: per-card custom properties (colors, gradient angles, icon hover position). Parks, Classes and Visitors start at 238deg and flip to 58deg on hover (Hostels and Shops are the opposite). Shops icon rests at top 60px on hover, the others at 57px.
- Icons needed in admin/assets/admin-panel/dashboard/ (exported from Figma by the user, 36x36): shops-icon.png (node 267:1950), parks-icon.svg (267:1953), classes-icon.svg (267:1957), visitors-icon.svg (267:1961). The sandbox cannot download Figma assets, so these files are NOT in the zip; Hostels reuses boys-hostel.svg.
- Links are guesses: Shops -> category=food, Parks -> category=other, Classes -> category=academic, Visitors -> user-data.html.
- Checked in a real browser with placeholder icons; not checked with login.

## Dashboard: two columns
- admin/css/dashboard.css: .quick-cards grid is exactly 2 columns of 256px.
- Icons still missing from the repo: shops-icon.png, parks-icon.svg, classes-icon.svg, visitors-icon.svg must be exported from Figma by the user into admin/assets/admin-panel/dashboard/ (Figma assets cannot be downloaded in the sandbox and copying image data by hand corrupts it).

## Admin path editor: satellite default
- admin/js/path-page.js: the map (drawing walkways and junctions) now opens in Esri World Imagery satellite view (max native zoom 18, stretched to 20); a Satellite / Map switch (Leaflet layer control, top right) swaps back to OpenStreetMap. Not browser-tested (Leaflet CDN blocked in sandbox).

## Admin: sidebar icon centring
- admin/css/side-bar.css: .icons-img margin-left changed from 18px to 20px so the 32px icon is centred in the 72px collapsed button. Measured in a real browser: all five icons now have 0px horizontal offset.

## Client Profile page
- New: client/profile.html, client/css/profile.css, client/js/profile-page.js
- Changed: client/js/visits.js (adds syncVisit), client/js/menu-drawer.js and client/menu.html (Profile link)
- Shows Name, Contact, User type, each with an Edit button. Saves to this device and updates the admin User Data list.

## Route card in map, top bar gradient
- #role-note moved inside #cards-section so it scrolls away with content.
- Route banner, steps and planner now live inside .card-details in the map container (index.html, index.css). The map container grows to 80dvh while #route-banner is visible (CSS :has); Leaflet resizes via the existing ResizeObserver.
- Client top bar uses linear-gradient(to right, #0d1117, #001636) instead of the doodle image (base.css).

## Page scroll, collapsing search, expand map
- Page now scrolls as a whole (html overflow and fixed heights removed in index.css) so the mobile browser bar can hide; top bar is sticky.
- While a route is active the search bar collapses to a #search-toggle icon; tapping it reopens the bar (body.search-open, home.js).
- #expand-button toggles #home-map.is-expanded (about full screen height).

## Expanded map hides bars
- body.map-expanded hides #logo-and-search and #nav-bar; the map fills the viewport (index.css, home.js).

## Route hides bars
- Search-icon collapse removed. While #route-banner is visible the top bar and nav bar are hidden and the map fills the viewport (index.css), same as expanded; the card sits at the bottom.

## Welcome typewriter
- #role-note types "Hi <name>, Welcome to Thapar" once, then fades and hides. Flag thaparNav.welcomed in localStorage (home.js, index.css) stops it from ever showing again.

## Remove user
- DELETE /api/clients/:id (admin, Mongo id) deletes the Client record; 404 if missing. User Data page has a Remove button per row with a confirm dialog and then reloads the list. Note: a removed person's device is not blocked and re-registers on its next visit.

## Role first, then login; roll number for students
- Flow: no role -> user-option.html -> (first choice only) login.html -> next. thaparNav.pendingLogin flag (roles.js) sends role-chosen-but-not-logged-in users to login; existing users are unaffected. Change user type from the menu skips login. Logout goes to user-option.html.
- Students are asked for a roll number (5-15 letters/digits, stored uppercase as thaparNav.rollNo); others give phone or email. Profile page row switches between Contact and Roll no. by role.
- Backend: Client.rollNo; POST /api/clients/ping accepts rollNo; students need name + rollNo to count as registered, others name + contact; list search also matches rollNo. Admin User Data shows roll no. or contact in one column.
- Deploy backend and admin along with the client.

## Login: Skip button
- client/js/login-page.js: for student and teacher (staff) the guest button reads "Skip"; visitors still see "Continue as guest". Behaviour is unchanged (clears name, contact and roll number, then continues). Label checked in a real browser for all three roles.

## Drivable walkways
- Walkway model gains drivable (default false) and driveBidirectional (default true; false means one-way from -> to). POST/PUT /api/paths/walkways accept both (strict booleans).
- Admin path editor: Draw mode panel has checkboxes (walk both ways, drivable, drivable both ways) applied to each new walkway; Select mode panel edits them. Routing (A*) still ignores drivable - no vehicle routing yet.

## Walking / Driving routes
- GET /api/route accepts mode=walking|driving (default walking). Driving only uses walkways with drivable=true, direction from driveBidirectional (false = one-way from -> to); junctions with no drivable walkway are not part of the driving graph, so endpoints snap to the nearest road junction within 400 m. Driving speed assumed 5.5 m/s (about 20 km/h). Response includes mode. Separate cached graph per mode (routing.js, pathfinding.js).
- Client route card has a Walking / Driving switch (default Walking); switching re-requests the route; closing the route resets to Walking. Google Maps fallback uses the chosen mode.

## Client: route card and map buttons
- Route card (client/js/home.js showBanner, client/css/index.css): order is now title and time, Walking/Driving switch, then action buttons. "Clear route" has class danger (red, bold). Buttons share the row width.
- Map buttons (client/index.html, css/index.css): route, layer, expand and locate are wrapped in #map-tools and stacked on the right (top 44px, clear of the attribution). Dark mode styles added in css/dark.css.
- First-visit tooltips: labels beside each button for 8 seconds or until the first tap on the buttons; localStorage key thaparNav.mapHintSeen. Delete the key to see them again.
- Checked in a real browser with a fake banner (layout, tooltips, no console errors). Not checked: real route data, Leaflet map (CDN blocked in the sandbox), dark mode visuals, real phones.

## Client: "Who are you?" page and profile avatar/logout
- user-option.html: heading is now "Who are you?"; each option has a short description under its label (.role-text in css/user-option.css).
- profile.html, js/profile-page.js, css/profile.css: round avatar with the first letter of the name (G for guest, updates after editing the name) and a red "Log out" button (clears role and name, goes to user-option.html). Dark mode avatar in css/dark.css.
- Checked in a real browser at 390px: both pages, avatar letter, logout redirect, no console errors. Not checked: dark mode visuals.

## Admin: dashboard counts and path editor markings
- Dashboard cards show a count under the title (hostels, shops, places, buildings, visitors) via admin/js/dashboard-page.js; counts come from GET /places?category=...&includeInactive=true&limit=1 (total) and GET /clients?userType=visitor&limit=1; hidden if a request fails.
- Path editor (path-page.js, path-editor.css): drivable walkways get a green translucent underlay; one-way walking shows a blue/purple arrow, one-way driving a green arrow, both pointing toward the "to" junction. Decorations rebuild only when a walkway's data or endpoints change, and are removed with the walkway.

## Compact map credit
- The Esri/OpenStreetMap credit is collapsed into a small "i" button on the client map (map.js, css/index.css); tapping it shows the credit for 5 seconds. It is not removed, because the imagery and map data terms require a visible credit.

## Who are you? descriptions removed
- The short <small> description under each option in client/user-option.html is gone; the heading and .role-text layout stay.

## Login background
- The doodle background image is removed from the client login page (client/css/login.css); the page uses the plain #f0f6fc background.

## Wheelchair removed
- All wheelchair/accessible handling is gone: Walkway.wheelchairAccessible, the accessible route option and response field, the path editor checkbox and purple line colour, tests and docs. Old walkway documents may still carry a wheelchairAccessible field in MongoDB; it is ignored and harmless.

## Edit history (admin)
- Backend: models/EditLog.js, services/audit.js (record, snapshot, diff), controllers/auditController.js, routes/audit.js, mounted at GET /api/audit (admin; filters entity, action, q, page, limit<=100). placesController (create, update, delete, photo set/remove, CSV bulk import) and pathsController (junction and walkway create, update, delete) write one entry each; updates store field-by-field from/to and skip entries when nothing changed. Entries keep the admin name and item name as text, so they survive renames and deletes. A failed log write never blocks the edit.
- Admin: Settings now has an "Edit History" card -> admin/edit-history.html (+ css/edit-history.css, js/edit-history-page.js, listEditHistory in js/api.js). Tabs All/Places/Walkways/Junctions, action filter, search by name or admin, Load more.
- Not logged: user (client) removals, admin profile edits, and edits made directly in MongoDB. Entries are never edited or deleted by the app.
- Tested with the real Express app and an in-memory stand-in for the database (create/update/delete of place, junction, walkway; filters, search, paging, access control: 21 checks) and the real admin page in a browser. Not run against Atlas. tests/api.test.js was not extended (needs a real test database).

## Admin: Home in sidebar
- admin/side-bar.html: new Home item (assets/admin-panel/side-bar/home.svg) between Menu and User Data, links to dashboard.html. It highlights on the dashboard through the existing markActiveLink in shell.js. Checked in a real browser: icon centred, link works, active highlight, order Menu, Home, User Data, Campus Data, Settings, Logout.

## Edit history card on the path editor
- admin/path-editor.html: a second card (#history-card, data-limit="10") sits below the map card with the same Edit History list (tabs All/Places/Walkways/Junctions, action filter, search, Load more, 10 rows at a time). It reuses js/edit-history-page.js and the same element ids; styles are scoped under #history-card in css/path-editor.css. The Settings > Edit History page is unchanged and still works.
- admin/js/api.js: after any successful POST/PUT/DELETE to /places or /paths the page dispatches a "data-edited" event; edit-history-page.js listens and reloads the list 0.8 s later, so new edits appear straight away.
- Checked in a real browser with a stand-in API: card below the map, rows, tabs, and auto-refresh after creating a junction. The map itself was not visible in the test (Leaflet CDN blocked in the sandbox).

## Edit history column names
- Table headers are now Date, Admin's Name, Action, Alteration, Details (were When, Who, Action, What, Details) in admin/edit-history.html and in the history card in admin/path-editor.html. Text change only; checked by reading both files, not re-run in a browser.

## Location gallery
- New PlaceImage collection; Place.gallery is an ordered id list (max 8). Endpoints: GET/POST /api/places/:id/gallery, DELETE /api/places/:id/gallery/:imageId (see API-REFERENCE.md).
- Admin Places row: "Location gallery" section sits below "Photo of the location"; adds and removals are staged and applied on Save.
- Client place panel: a thumbnail strip under the main photo; tapping a thumbnail shows it in the main (1:1) photo.
- This patch also includes the 1:1 panel photo (base.css) and the Places table wrapping fix (places-data.css, places-page.js), in case they were not yet pushed.

## Client home: map background plus draggable places sheet
- The map (#home-map) is fixed full-screen behind everything. The "Places on campus" sheet (#places-sheet) overlays it and holds the greeting (#role-note), My places and all category sections; it scrolls inside.
- Sheet has three heights (small, half, full): drag the handle or tap it to cycle (client/js/sheet.js, new). It hides while a route is planned or running and when the map is expanded.
- Files: client/index.html, client/css/index.css (appended block), client/js/sheet.js. No backend change.

## Recent searches in the search dropdown
- Recent searches no longer show in the home sheet. They appear in a dropdown under the top search bar only while the empty search box is focused, with a Clear button; hidden otherwise. Saved places stay in the sheet.
- Files: client/js/search-box.js (recent/onClearRecent options, used only by the top search bar), client/js/home.js, client/css/base.css (appended styles).

## Client top bar: 80px
- #logo-and-search is now 80px tall (was about 88px): padding 8px 16px, logo 35px wide (64px tall), #search-bar 64px tall (48px pill). Sticky offset of #hostel-category in places.css changed from 88px to 80px.
- Files: client/css/base.css, client/css/places.css.

## Client: nav bar removed, hamburger menu, emergency numbers
- The bottom #nav-bar is removed from index.html and places.html. A hamburger link (#menu-toggle, href menu.html) sits right of the search bar in the top bar and opens the side drawer (menu-drawer.js intercepts links to menu.html). Home and Support remain inside the drawer.
- Support overlay (built in client/js/menu-drawer.js) now has two groups: Technical Support (email nav.support@thapar.edu, contact 9876543210, unchanged) and Emergency (Ambulance 9182736405 / 9282726258, Security 9392048204 / 9587340524, each a tel: link).
- Bottom padding of the home sheet body and places list reduced from 120px to 32px since the bar is gone.
- Files: client/index.html, client/places.html, client/js/menu-drawer.js, client/css/base.css, index.css, places.css, drawer.css.

## Client: pin popups, route loading styles (repo gap fixed)
- Tapping a pin now opens a small popup (name, category, Details and Directions buttons) instead of the full panel (client/js/map.js buildPopup, createCampusMap gets onRoute; home.js already passed it).
- Added the missing CSS in client/css/index.css: route spinner and skeleton shown while a route is being found, #map-message box, .pin-popup styles. Also the map now fills the full screen height when expanded or routing (the old calc(100vh - 32px) left a 32px strip).
- Files: client/js/map.js, client/css/index.css. Built on 2e4f99c.

## Font: Inter, bolder text
- Inter is now the project font (client and admin). Every page loads Inter 400-800 from Google Fonts with a system fallback; every font-family uses Inter (client/css/style.css untouched).
- Text is one step bolder: pages that set the font also set body, input, button, select and textarea to weight 500, and every explicit weight moved up one step (400/424/450 to 500, 500 to 600, 600 to 700, 700 to 800).
- Files: all client and admin HTML pages with stylesheets, and the CSS files that set a font or weight. Built on 67104b1.

## Admin: fixed sidebar, top bar hides on scroll
- Layout (not position: sticky): on every shell page the body is a full-height flex column (admin/css/side-bar.css). Only the content next to the sidebar scrolls (#dashboard-body > the non-sidebar child, overflow-y auto); the sidebar column never moves.
- Top bar (admin/css/top-bar.css + watchScroll in admin/js/shell.js): scrolling down hides it (its container collapses to 0 height, the sidebar and content grow to fill), scrolling up or returning near the top shows it again. It only hides when the page is tall enough to scroll at least 160px, and ignores scroll events for 400ms after toggling to avoid flicker.
- Files: admin/css/side-bar.css, admin/css/top-bar.css, admin/js/shell.js. Built on 250f350.

## Card spacing and concentric corners
- Place cards (client/css/base.css, .cards.place-card): one --card-inset (16px) now drives the left, right and bottom gap of the details block and the top-left badge; the card radius is 48px and the Start Route button radius is card radius minus inset (32px, equal to half its 64px height), so the gap to the card corner is the same all the way round. Card shadow is now symmetric (0 4px 12px) instead of offset 4px 4px.
- Built on fcc0602.

## base.css regression repaired
- The repo's client/css/base.css had reverted to an older version (Google Sans Flex, 72px logo and auto-height top bar, no gallery strip, no 1:1 panel photo, no recent-search dropdown or hamburger styles, old alias wrapping). It is rebuilt from the last good version plus the current experimental card style (.cards.place-card block, --card-inset, --card-radius).
- Restored: 1:1 .panel-photo, .panel-gallery styles, 80px top bar and 35px logo, Inter, alias nowrap and shrink styles, .suggestion-head/.suggestion-clear, #menu-toggle.
- client/index.html also gets the "Explore Campus" sheet title (it was not applied in the repo). All other files were checked and are intact. Built on 78f7c52.

## Dashboard quick-card gap
- .quick-cards (admin/css/dashboard.css) now has grid-auto-rows: 160px and align-content: start, so the row gap stays 16px like the column gap. Before, the grid rows stretched to fill the scrolling content area (since the shell layout change), leaving a large vertical gap. Built on 9322857.

## Card style variants (smaller cards)
- Client place cards are 280px square (were 320px) in both variants (client/css/base.css .cards width/height).
- experimental/client/css/base.css: current photo-first card (name over the photo, white pill Start Route, 16px inset, concentric 48px/32px corners).
- original/client/css/base.css: the earlier card with the white details box over the photo (the whole "EXPERIMENT" block removed).
- Copy ONE of the two base.css files over client/css/base.css. Built on c9872a9.

## Smaller alias
- The alias in brackets on place cards is now 14px at full size (was 17-18px) and can shrink down to 9px (was 10px) to stay beside the name: client/js/cards.js (ALIAS_MAX 14, ALIAS_MIN 9) and client/css/base.css. Built on a65b04c.

## Name and alias aligned at the bottom
- On place cards the name and the alias now sit on the same text baseline (client/css/base.css): .location-name uses align-items flex-end, and the alias gets bottom padding of 0.24 x (name size - alias size) so its baseline matches the name's. --name-size is 24px (original card) or 26px (experimental card). Built on dcbc3cf.

## Expand/shrink map button removed
- The expand/shrink map button is removed from the client home map: the button in client/index.html, its click handler in client/js/home.js, and its #expand-button styles in client/css/index.css. Map tools are now Plan a route, Map or satellite, My location. The route view still takes the full screen. Built on 1a999b8.

## Keep-alive workflow (live repo)
- .github/workflows/keep-alive.yml: a GitHub Actions schedule calls https://thapar-nav.onrender.com/api/health every 10 minutes so the free Render backend does not sleep (it sleeps after about 15 minutes idle). Can also be run by hand from the Actions tab (workflow_dispatch).
- Put it in the live repo (thapar-nav) only, not developing-thapar-nav (Render free hours would run out if both stay awake). GitHub may delay scheduled runs and turns schedules off after 60 days with no repo activity (re-enable in the Actions tab).
