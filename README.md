# Thapar-Nav

Campus navigation web app for Thapar, for students, staff and visitors.

## Folders

| Folder | What goes in it |
|---|---|
| `client/` | The pages students, teachers and visitors see (HTML, CSS, JavaScript) |
| `admin/` | The admin pages for managing places and paths (design only for now) |
| `backend/` | The server and database code (Node.js, Express, MongoDB) |
| `backend/src/models/` | Database shapes: Place, Junction, Walkway, Admin |
| `backend/src/config/` | Settings loader, database connection, fixed lists |
| `backend/src/routes/`, `controllers/`, `services/` | The API: what each address does |
| `backend/src/middleware/` | Login check, input check, security, error messages |
| `backend/src/utils/` | Helpers, including the shortest-path (A*) code |
| `backend/scripts/` | One-off tools, such as creating an admin |
| `backend/tests/` | Automatic checks for the models |

## Quick start

```
cd backend
npm install
copy .env.example .env      (Windows)   or   cp .env.example .env   (Mac/Linux)
npm test
npm run create-admin
npm run dev
```

The API then answers at http://localhost:5000/api/health. See `API-REFERENCE.md` for every address.

Read `CLIENT-GUIDE.md` to run and understand the client pages, `SETUP-GUIDE.md`, `API-REFERENCE.md` for the full step-by-step setup and `DATABASE-DESIGN.md` for how the data is organised.
