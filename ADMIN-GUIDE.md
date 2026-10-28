# Admin panel guide (E1 + E2)

## Open it
1. Start the backend: `cd backend` then `npm start`.
2. Open `admin/index.html` with VS Code Live Server (for example http://127.0.0.1:5500/admin/index.html).
3. Make sure `CLIENT_ORIGINS` in `backend/.env` contains the address you opened, for example `http://127.0.0.1:5500`. Restart the backend after changing it.

## Log in
Use the username and password you made with `npm run create-admin`. The old numeric Admin ID is gone because the server uses usernames. You stay logged in until you close the tab or the login expires (`JWT_EXPIRES_IN`).

## Manage places
Campus Data, then any card, opens the Places page. "All Places" shows everything, including inactive places.
- Search box and category filter narrow the list.
- Pencil icon: the inputs in that same row become editable. A second line appears with description, other names, opening hours and entrance. Save (or press Enter) stores it. Cancel (or press Esc) undoes it.
- Bin icon: asks first, then deletes.
- "Add place" opens a blank green row at the top.
- Latitude must be 30.3 to 30.4 and longitude 76.3 to 76.45.

## After deploying
Set `PRODUCTION_API_URL` in `admin/js/config.js` to your Render backend address, and add the admin site address to `CLIENT_ORIGINS` on Render.

## Removed
`accommodations-data.html`, its css, and `js/topbar-and-sidebar.js` (replaced by the Places page and `js/shell.js`).

## Walking paths (E3)
Campus Data, then "Walking Paths", opens a map editor. Routes for visitors are built from the dots and lines you draw here.
1. Add junction: click the map to drop a dot at gates, corners, bends and building entrances. Zoom in for accuracy.
2. Draw walkway: click one dot, then the next. Keep clicking to chain walkways. Esc stops.
3. Select & move: click a dot, line or place. Drag a blue dot to move it (connected walkway lengths update by themselves). Dots can be named, lines can be one-way or drivable, and both can be deleted.
4. Link places: click a place square, then "Link to nearest junction". Orange squares are not linked yet and routes cannot reach them.
5. Click empty map space to see the overview. It warns about separate unconnected parts, red dots with no walkway, and unlinked places.
Deleting a dot also deletes its walkways and unlinks its places (you are asked first).

## Importing places from a CSV file (E4)
Campus Data, then "Import Places (CSV)" (or the "Import CSV" button on the Places page).
1. Choose your file. Click "Download template" to see the layout. Required columns: `name`, `category`, `lat`, `lng`. Optional: `description`, `aliases` (separate with ; ), `visibleTo` (for example `student, staff, visitor`), `openingHours`, `isEntrance`, `isActive`.
2. Read the preview. Green is new, yellow already exists, red has a problem (the note says what to fix). "Show only rows with problems" helps.
3. Choose what happens to names that already exist: skip them, or update them.
4. Click Import. Rows with problems are never imported. The page shows how many were added, updated, skipped or failed.
Tips: the words "null", "none" and "-" in a cell are treated as empty. Save the file as "CSV UTF-8" so accents like é survive. `places-fixed.csv` is a cleaned copy of your sheet that imports with no problems.


## Adding a photo to a place

Click Add place or the edit icon, then use "Photo of the location" in the lower part of the row. Choose a JPEG, PNG or WebP file. Large photos are shrunk automatically. Click Save to upload it. Use Remove photo and Save to delete it.
