# Setup guide (A1)

Follow these in order. Each step says how to check it worked.

## 1. Install the tools

1. **VS Code**: https://code.visualstudio.com
2. **Node.js (LTS version)**: https://nodejs.org. Choose the one labelled LTS.
3. **Git**: https://git-scm.com/downloads

Open a terminal (in VS Code: Terminal, then New Terminal) and check:

```
node --version
npm --version
git --version
```

Each should print a version number. Node must be 18 or higher.

## 2. Create accounts (all free)

- GitHub: https://github.com
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Render: https://render.com (sign up with your GitHub account)

## 3. Put the project in a folder

Unzip this project so you have a folder named `thapar-nav` with `client`, `admin` and `backend` inside. Open that folder in VS Code (File, then Open Folder).

## 4. Install the backend packages

```
cd backend
npm install
```

This creates a `node_modules` folder. Never upload it; `.gitignore` already blocks it.

## 5. Create your private settings file

The file `backend/.env.example` is a template. Make a copy named `.env`:

- Windows: `copy .env.example .env`
- Mac or Linux: `cp .env.example .env`

Open `.env` and fill in the values later, when the database exists (step 7). `.env` holds secrets and is blocked from Git. Never share it.

## 6. Run the checks

```
npm test
```

You should see `# pass 11` and `# fail 0`. This tests the database shapes without needing the internet.

## 7. Create the database on MongoDB Atlas

1. Log in to Atlas and create a project called `thapar-nav`.
2. Create a cluster and pick the free **M0** tier. Choose the region closest to you.
3. When asked, create a **database user**. Pick a username and a password made of letters and numbers only, and save them somewhere safe.
4. Open **Network Access**, then **Add IP Address**, then **Allow access from anywhere** (`0.0.0.0/0`). Render's addresses change, so this is needed.
5. Open **Database**, then **Connect**, then **Drivers**. Copy the connection string. It looks like `mongodb+srv://user:<password>@cluster0.xxxxx.mongodb.net/`.
6. In `backend/.env`, set `MONGODB_URI` to that string. Replace `<password>` with your real password and add `thapar-nav` after the final slash, like `...mongodb.net/thapar-nav?retryWrites=true&w=majority`.
7. Set `JWT_SECRET` to a long random text. You can generate one with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Atlas creates the collections by itself the first time the backend saves data, so there is nothing else to set up here.

## 8. Put the project on GitHub

Create an empty repository on GitHub (no README), then in the `thapar-nav` folder:

```
git init
git add .
git status
git commit -m "Initial project structure"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/YOUR-REPO.git
git push -u origin main
```

Run `git status` before committing and check that neither `.env` nor `node_modules` is listed. If either shows up, stop and ask.

## 9. Start the server (after step 7)

```
cd backend
npm run create-admin
npm run dev
```

`create-admin` asks for a username and a password and saves the admin in your database. `dev` starts the server and restarts it when you change a file. You should see `Server listening on port 5000` and `Database connected`. Open http://localhost:5000/api/health in a browser; it should show `"status":"ok"`.

The first run of `npm test` does not touch your database. To run the full API tests too, you need a separate empty test database (never your real one), then set `TEST_MONGODB_URI` to its address before `npm test`.

## Common problems

- **`npm` is not recognised**: close and reopen the terminal after installing Node.
- **Server stops with "Invalid settings"**: a value is missing in `backend/.env`; the message names it.
- **"Could not connect to the database"**: check the password in `MONGODB_URI` and that Atlas Network Access allows `0.0.0.0/0`.
- **Browser says CORS or the API replies 403**: add the address of your page (for example `http://localhost:5500`) to `CLIENT_ORIGINS` in `.env` and restart.
- **`npm install` fails**: check the internet connection and that you are inside `backend`.
- **Tests fail with "Cannot find module"**: run `npm install` again inside `backend`.
