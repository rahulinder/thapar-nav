# Client guide (C)

The client is plain HTML, CSS and JavaScript in the `client/` folder. There is nothing to install or build.

## Run it on your computer

1. Start the backend: in `backend`, run `npm run dev` (it listens on port 5000).
2. In `backend/.env`, make sure `CLIENT_ORIGINS` contains the address the client will use. For VS Code's Live Server that is `http://127.0.0.1:5500` and `http://localhost:5500`, both already in `.env.example`.
3. Open the `client` folder in VS Code, right-click `login.html`, and choose **Open with Live Server**. (Without VS Code, run `python -m http.server 5500` inside `client` and open `http://localhost:5500/login.html`.)

If the pages show "The server refused this website", the address in your browser is missing from `CLIENT_ORIGINS`. Add it, restart the backend, and reload.

## How the pages connect

```
login.html  ->  user-option.html  ->  index.html (home)  ->  places.html (see all)
 (name, optional)  (student / teacher / visitor)   |
                                                    +-> menu.html, support.html
```

Opening `index.html` or `places.html` without a saved user type sends you to `login.html` first. The choice is remembered on that device until you use Logout in the menu.

## What each part does

| File | What it does |
|---|---|
| `js/config.js` | The one place for settings: server address, campus centre, timeouts, category colours and names. **After you deploy the backend, change `PRODUCTION_API_URL` here to your Render address.** |
| `js/api.js` | Asks the backend for places. Waits up to 25 seconds, tries up to 3 times, and turns errors into readable messages. |
| `js/places-store.js` | Saves the last places on the device. The page shows them instantly while fresh data loads, and keeps them if the server is down. |
| `js/status-bar.js` | The message strip under the search bar ("The server is waking up..."). |
| `js/roles.js`, `storage.js` | Remember the user type and optional name on the device. |
| `js/search.js`, `search-box.js` | Search by name, other names, category or description, with a suggestion list you can use with the keyboard. |
| `js/cards.js` | Builds the place cards, the loading placeholders and the error card. |
| `js/place-panel.js` | The details sheet that slides up when you tap a card or a map pin. |
| `js/map.js` | The map (Leaflet and OpenStreetMap): pins, your position, zooming to a place. |
| `js/home.js`, `places-page.js`, `role-page.js`, `login-page.js`, `menu-page.js` | One script per page, joining the parts above. |
| `js/route.js` | Start Route opens Google Maps walking directions for now. The built-in routes arrive with item D. |
| `css/base.css` | Look shared by all pages: header, search, cards, nav bar, details sheet. |
| `css/index.css`, `places.css`, `user-option.css`, `login.css`, `menu.css` | Page-specific looks, kept close to your original design. |

## What changed from your original pages

- Cards, sections and the map are now filled from the database instead of typed by hand. Each user type sees only the places allowed for it.
- The login page keeps the name box but no longer has a phone number box, because nothing uses it. Only the name is saved, on the device.
- "Teacher" on screen means the `staff` type in the database.
- "Setting" in the menu became "Change user type", since that is what it does.
- The old `hostels.html` page became `places.html`, with category buttons built from the real categories instead of only Boys and Girls.
- `support.html` is new, with short help text, because the Support icon had no page.
- The 6 MB hostel photo was shrunk to about 100 KB and unused doodle images were removed, so the pages load fast on a phone.
- Place cards use the hostel photo only for hostels. Other categories get a colour tint, because the database has no photo field yet.

## Admin pages

The `admin/` folder holds your admin designs with their image and link paths fixed so every page opens. They are not connected to the backend yet; that is item E. The old accommodations script talked to the previous Java server, so it was left out.
