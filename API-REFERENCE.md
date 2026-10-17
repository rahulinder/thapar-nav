# API reference (B)

Base address while testing on your computer: `http://localhost:5000`. All paths below start with `/api`. Everything is JSON.

Errors always look like `{ "error": "Readable message" }`, sometimes with a `details` list.

| Status | Meaning |
|---|---|
| 400 | Input was wrong (message says which field) |
| 401 | Not logged in, or token expired |
| 403 | Website not allowed (CORS), or not enough rights |
| 404 | Not found, or no walking path exists |
| 409 | Already exists (duplicate name, duplicate walkway) |
| 413 | Request body too large |
| 422 | Point is too far from campus footpaths |
| 429 | Too many requests, wait a few minutes |
| 503 | Footpath network empty, or database not ready |

Admin-only calls need the header `Authorization: Bearer <token>` (get the token from login).

## Health

`GET /api/health` returns `{ "status": "ok", "database": true }`. Also useful as the keep-alive address later.

## Login (B5)

`POST /api/auth/login` with `{ "username": "...", "password": "..." }` returns `{ token, expiresIn, admin }`. At most 10 attempts per 15 minutes per address.

`GET /api/auth/me` (admin) returns `{ admin }`.

Create the first admin from the `backend` folder: `npm run create-admin` (asks for username and password). Add the word `superadmin` after the username to make a super admin: `npm run create-admin -- boss superadmin`.

## Places (B2)

| Call | Who | What |
|---|---|---|
| `GET /api/places` | everyone | List places |
| `GET /api/places/:id` | everyone | One place, returns `{ place }` |
| `POST /api/places` | admin | Add a place, returns `{ place }` with status 201 |
| `PUT /api/places/:id` | admin | Change any of the fields, send only what changes |
| `DELETE /api/places/:id` | admin | Delete a place |

List options (all optional, put them after `?` and join with `&`):

| Option | Example | Meaning |
|---|---|---|
| role | `role=student` | Only places visible to that role |
| category | `category=hostel` | One category |
| q | `q=central lib` | Search words in name, aliases and description |
| limit | `limit=50` | Page size, 1 to 500, default 100 |
| page | `page=2` | Page number |
| includeInactive | `includeInactive=true` | Also hidden places, only works with an admin token |

The list returns `{ count, total, page, places }`.

Place fields: `name`, `category`, `description`, `aliases`, `lat`, `lng`, `visibleTo`, `openingHours`, `isEntrance`, `junction`, `isActive`. Names must be unique, ignoring capital letters.

## Footpath network (B3)

| Call | Who | What |
|---|---|---|
| `GET /api/paths/network` | everyone | All junctions and walkways in one go |
| `GET /api/paths/junctions` | everyone | Junction list |
| `POST /api/paths/junctions` | admin | `{ lat, lng, label }` |
| `PUT /api/paths/junctions/:id` | admin | `{ lat, lng, label }`, also recalculates connected walkway lengths |
| `DELETE /api/paths/junctions/:id` | admin | Also deletes its walkways and unlinks places |
| `GET /api/paths/walkways` | everyone | Walkway list |
| `POST /api/paths/walkways` | admin | `{ from, to, name, bidirectional, wheelchairAccessible }`, length is calculated by the server |
| `PUT /api/paths/walkways/:id` | admin | Change `name`, `bidirectional`, `wheelchairAccessible` |
| `DELETE /api/paths/walkways/:id` | admin | Delete a walkway |

## Route finding (B4)

`GET /api/route`

Start: `fromPlace=<place id>` or `fromLat=..&fromLng=..`
Destination: `toPlace=<place id>` or `toLat=..&toLng=..`
Optional: `role=student` (destination and start places must be visible to the role), `accessible=true` (avoid walkways marked not wheelchair accessible).

Returns:

```
{ "route": {
    "distanceMeters": 412.3,
    "durationSeconds": 317,
    "accessible": false,
    "from": { "type": "place", "name": "...", "lat": 0, "lng": 0 },
    "to":   { "type": "point", "lat": 0, "lng": 0 },
    "coordinates": [ { "lat": 30.3547, "lng": 76.3621 }, ... ]
} }
```

`coordinates` is the line to draw on the map, in order. Walking time uses 1.3 metres per second. A point that is more than 400 metres from any junction returns 422.

## Security (B6)

- Passwords are stored scrambled (bcrypt). Login errors never say whether the username or the password was wrong.
- Tokens use HS256 and expire (`JWT_EXPIRES_IN`, default 8 hours).
- Only websites listed in `CLIENT_ORIGINS` may call the API from a browser.
- Request limits per address per 15 minutes: 300 general, 10 login, 120 changes, 120 route searches.
- Every input is checked, odd shapes such as `category[$ne]=x` are rejected, and search text is escaped.
- Request bodies are limited to 10 KB. Security headers are added by Helmet.

## POST /api/places/bulk (admin only)
Adds or updates up to 30 places in one request. Used by the admin Import page.

Body: `{ "mode": "skip" | "update", "places": [ { name, category, lat, lng, ... } ] }`

- `skip` (default) leaves a place alone when its name already exists. `update` overwrites it with the new values.
- Each place is checked on its own. One bad row does not stop the others.
- Response: `{ created, updated, skipped, failed, results: [ { index, status, id?, error? } ] }`
