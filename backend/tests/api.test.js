const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const TEST_URI = process.env.TEST_MONGODB_URI;
const skip = TEST_URI ? false : "Set TEST_MONGODB_URI to run the API tests";

const ALLOWED_ORIGIN = "http://localhost:5500";
const BASE = { lat: 30.3547, lng: 76.3621 };
const at = (dLat, dLng) => ({ lat: +(BASE.lat + dLat).toFixed(6), lng: +(BASE.lng + dLng).toFixed(6) });

let server;
let url;
let token;

async function call(method, path, { body, auth = true, headers = {}, raw } = {}) {
    const response = await fetch(url + path, {
        method,
        headers: {
            ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(auth && token ? { Authorization: "Bearer " + token } : {}),
            ...headers
        },
        body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }
    return { status: response.status, data, headers: response.headers };
}

test("API", { skip }, async (t) => {
    process.env.NODE_ENV = "test";
    const { createApp } = require("../src/app");
    const { connectDatabase, disconnectDatabase } = require("../src/config/db");
    const { Admin, Place, Junction, Walkway } = require("../src/models");

    t.after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.dropDatabase();
        }
        await disconnectDatabase();
    });

    await connectDatabase(TEST_URI);
    await mongoose.connection.dropDatabase();
    await Promise.all([Place.init(), Junction.init(), Walkway.init(), Admin.init()]);

    const env = {
        isProduction: false,
        jwtSecret: "test-secret-test-secret-test-secret-123",
        jwtExpiresIn: "1h",
        clientOrigins: [ALLOWED_ORIGIN]
    };
    const app = createApp(env, { limits: { login: 5 } });
    server = app.listen(0);
    url = "http://127.0.0.1:" + server.address().port;

    await Admin.create({
        username: "boss",
        passwordHash: await Admin.hashPassword("correct horse battery"),
        role: "superadmin"
    });

    await t.test("health and unknown routes", async () => {
        const health = await call("GET", "/api/health");
        assert.equal(health.status, 200);
        assert.equal(health.data.database, true);
        const missing = await call("GET", "/api/nope");
        assert.equal(missing.status, 404);
        assert.ok(missing.data.error);
        assert.equal(health.headers.get("x-powered-by"), null);
        assert.ok(health.headers.get("x-content-type-options"));
    });

    await t.test("CORS allows listed origins and rejects others", async () => {
        const ok = await call("GET", "/api/health", { headers: { Origin: ALLOWED_ORIGIN } });
        assert.equal(ok.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
        const bad = await call("GET", "/api/health", { headers: { Origin: "http://evil.example" } });
        assert.equal(bad.status, 403);
        assert.match(bad.data.error, /CLIENT_ORIGINS/);
    });

    await t.test("login rules", async () => {
        const noBody = await call("POST", "/api/auth/login", { body: {} });
        assert.equal(noBody.status, 400);
        const wrong = await call("POST", "/api/auth/login", { body: { username: "boss", password: "nope-nope-nope" } });
        assert.equal(wrong.status, 401);
        const unknown = await call("POST", "/api/auth/login", { body: { username: "ghost", password: "nope-nope-nope" } });
        assert.equal(unknown.status, 401);
        assert.equal(unknown.data.error, wrong.data.error);
        const injection = await call("POST", "/api/auth/login", { body: { username: { $ne: "x" }, password: { $ne: "x" } } });
        assert.equal(injection.status, 400);

        const ok = await call("POST", "/api/auth/login", { body: { username: "BOSS", password: "correct horse battery" } });
        assert.equal(ok.status, 200);
        assert.ok(ok.data.token);
        assert.equal(ok.data.admin.passwordHash, undefined);
        token = ok.data.token;

        const me = await call("GET", "/api/auth/me");
        assert.equal(me.status, 200);
        assert.equal(me.data.admin.username, "boss");
    });

    await t.test("login is rate limited", async () => {
        let last;
        for (let i = 0; i < 6; i += 1) {
            last = await call("POST", "/api/auth/login", { body: { username: "boss", password: "wrong-wrong-wrong" }, auth: false });
        }
        assert.equal(last.status, 429);
    });

    await t.test("writes need a valid admin token", async () => {
        const none = await call("POST", "/api/places", { auth: false, body: { name: "X Block", category: "academic", ...BASE } });
        assert.equal(none.status, 401);
        const forged = await call("POST", "/api/places", {
            auth: false,
            headers: { Authorization: "Bearer not.a.token" },
            body: { name: "X Block", category: "academic", ...BASE }
        });
        assert.equal(forged.status, 401);
        const jwt = require("jsonwebtoken");
        const unsigned = jwt.sign({ sub: String(new mongoose.Types.ObjectId()) }, "other-secret-other-secret-other-secret");
        const wrongKey = await call("DELETE", "/api/places/" + new mongoose.Types.ObjectId(), {
            auth: false,
            headers: { Authorization: "Bearer " + unsigned }
        });
        assert.equal(wrongKey.status, 401);
    });

    let library;
    let hostel;
    let hiddenFromVisitors;

    await t.test("create places and validate input", async () => {
        const created = await call("POST", "/api/places", {
            body: { name: "  Central Library ", category: "library", description: "Books", aliases: ["CL"], ...BASE }
        });
        assert.equal(created.status, 201);
        assert.equal(created.data.place.name, "Central Library");
        assert.deepEqual(created.data.place.visibleTo, ["student", "staff", "visitor"]);
        library = created.data.place;

        hostel = (await call("POST", "/api/places", {
            body: { name: "Hostel H", category: "hostel", visibleTo: ["student"], ...at(0.001, 0.001) }
        })).data.place;
        hiddenFromVisitors = hostel;

        const dup = await call("POST", "/api/places", { body: { name: "central library", category: "library", ...BASE } });
        assert.equal(dup.status, 409);

        const cases = [
            [{ category: "library", ...BASE }, /name/i],
            [{ name: "Valid Name", category: "castle", ...BASE }, /Category/],
            [{ name: "Valid Name", category: "library", lat: "abc", lng: BASE.lng }, /Latitude/],
            [{ name: "Valid Name", category: "library", lat: 12, lng: 12 }, /outside the campus/],
            [{ name: "Valid Name", category: "library", ...BASE, visibleTo: ["alien"] }, /role/i],
            [{ name: "Valid Name", category: "library", ...BASE, visibleTo: [] }, /visibleTo/],
            [{ name: "Valid Name", category: "library", ...BASE, junction: "123" }, /junction/i],
            [{ name: { $gt: "" }, category: "library", ...BASE }, /Name/]
        ];
        for (const [body, pattern] of cases) {
            const bad = await call("POST", "/api/places", { body });
            assert.equal(bad.status, 400, JSON.stringify(body));
            assert.match(bad.data.error, pattern);
        }

        const extra = await call("POST", "/api/places", {
            body: { name: "Extra Field Place", category: "other", ...at(0.002, 0), _id: "x", createdAt: "2000-01-01", admin: true }
        });
        assert.equal(extra.status, 201);
        assert.notEqual(extra.data.place._id, "x");
        assert.equal(extra.data.place.admin, undefined);
    });

    await t.test("list, filter and search places", async () => {
        const all = await call("GET", "/api/places", { auth: false });
        assert.equal(all.status, 200);
        assert.equal(all.data.count, 3);
        assert.deepEqual(all.data.places.map((p) => p.name), ["Central Library", "Extra Field Place", "Hostel H"]);

        const visitor = await call("GET", "/api/places?role=visitor", { auth: false });
        assert.ok(!visitor.data.places.some((p) => p.name === "Hostel H"));
        const student = await call("GET", "/api/places?role=student", { auth: false });
        assert.ok(student.data.places.some((p) => p.name === "Hostel H"));

        const byCategory = await call("GET", "/api/places?category=hostel", { auth: false });
        assert.equal(byCategory.data.count, 1);

        const byAlias = await call("GET", "/api/places?q=cl", { auth: false });
        assert.ok(byAlias.data.places.some((p) => p.name === "Central Library"));
        const multi = await call("GET", "/api/places?q=central%20lib", { auth: false });
        assert.equal(multi.data.count, 1);
        const regexChars = await call("GET", "/api/places?q=.*", { auth: false });
        assert.equal(regexChars.status, 200);
        assert.equal(regexChars.data.count, 0);

        const limited = await call("GET", "/api/places?limit=1&page=2", { auth: false });
        assert.equal(limited.data.count, 1);
        assert.equal(limited.data.total, 3);

        for (const bad of ["role=alien", "category[$ne]=x", "limit=0", "limit=9999", "role[]=student", "includeInactive=yes"]) {
            const response = await call("GET", "/api/places?" + bad, { auth: false });
            assert.equal(response.status, 400, bad);
        }
    });

    await t.test("get, update, hide and delete a place", async () => {
        const one = await call("GET", "/api/places/" + library._id, { auth: false });
        assert.equal(one.data.place.name, "Central Library");
        assert.equal((await call("GET", "/api/places/not-an-id", { auth: false })).status, 400);
        assert.equal((await call("GET", "/api/places/" + new mongoose.Types.ObjectId(), { auth: false })).status, 404);

        const updated = await call("PUT", "/api/places/" + library._id, { body: { description: "Updated", openingHours: "9 to 5" } });
        assert.equal(updated.status, 200);
        assert.equal(updated.data.place.description, "Updated");
        assert.equal(updated.data.place.name, "Central Library");

        const clash = await call("PUT", "/api/places/" + library._id, { body: { name: "Hostel H" } });
        assert.equal(clash.status, 409);
        const outside = await call("PUT", "/api/places/" + library._id, { body: { lat: 1 } });
        assert.equal(outside.status, 400);
        const noJunction = await call("PUT", "/api/places/" + library._id, { body: { junction: String(new mongoose.Types.ObjectId()) } });
        assert.equal(noJunction.status, 400);

        await call("PUT", "/api/places/" + hiddenFromVisitors._id, { body: { isActive: false } });
        const publicList = await call("GET", "/api/places", { auth: false });
        assert.ok(!publicList.data.places.some((p) => p.name === "Hostel H"));
        assert.equal((await call("GET", "/api/places/" + hostel._id, { auth: false })).status, 404);
        const adminList = await call("GET", "/api/places?includeInactive=true");
        assert.ok(adminList.data.places.some((p) => p.name === "Hostel H"));
        const sneaky = await call("GET", "/api/places?includeInactive=true", { auth: false });
        assert.ok(!sneaky.data.places.some((p) => p.name === "Hostel H"));

        const removed = await call("DELETE", "/api/places/" + hostel._id);
        assert.equal(removed.status, 200);
        assert.equal((await call("DELETE", "/api/places/" + hostel._id)).status, 404);
    });

    const J = {};
    const makeJunction = async (key, point) => {
        const r = await call("POST", "/api/paths/junctions", { body: { label: key, ...point } });
        assert.equal(r.status, 201);
        J[key] = r.data.junction;
    };
    const link = (a, b, extra = {}) => call("POST", "/api/paths/walkways", { body: { from: J[a]._id, to: J[b]._id, ...extra } });

    await t.test("junctions and walkways", async () => {
        await makeJunction("a", BASE);
        await makeJunction("b", at(0.001, 0));
        await makeJunction("c", at(0, 0.001));
        await makeJunction("d", at(0.001, 0.001));
        await makeJunction("far", at(0.02, 0.02));

        assert.equal((await call("POST", "/api/paths/junctions", { body: { lat: 5, lng: 5 } })).status, 400);
        assert.equal((await call("POST", "/api/paths/junctions", { auth: false, body: BASE })).status, 401);

        const ab = await link("a", "b");
        assert.equal(ab.status, 201);
        assert.ok(ab.data.walkway.distanceMeters > 105 && ab.data.walkway.distanceMeters < 117);
        assert.equal(ab.data.walkway.bidirectional, true);

        assert.equal((await link("b", "a")).status, 409);
        assert.equal((await link("a", "a")).status, 400);
        assert.equal((await call("POST", "/api/paths/walkways", { body: { from: J.a._id, to: String(new mongoose.Types.ObjectId()) } })).status, 400);
        assert.equal((await call("POST", "/api/paths/walkways", { body: { from: "x", to: "y" } })).status, 400);

        assert.equal((await link("b", "d")).status, 201);
        assert.equal((await link("a", "c")).status, 201);
        assert.equal((await link("c", "d")).status, 201);

        const network = await call("GET", "/api/paths/network", { auth: false });
        assert.equal(network.data.junctions.length, 5);
        assert.equal(network.data.walkways.length, 4);
    });

    await t.test("route finding", async () => {
        const toD = await call("GET", `/api/route?fromLat=${BASE.lat}&fromLng=${BASE.lng}&toLat=${at(0.001, 0.001).lat}&toLng=${at(0.001, 0.001).lng}`, { auth: false });
        assert.equal(toD.status, 200);
        const route = toD.data.route;
        assert.ok(route.distanceMeters > 200 && route.distanceMeters < 240);
        assert.ok(route.durationSeconds > 150 && route.durationSeconds < 200);
        assert.ok(route.coordinates.length >= 4);

        const placeToPlace = await call("PUT", "/api/places/" + library._id, { body: { junction: J.a._id } });
        assert.equal(placeToPlace.status, 200);
        const other = (await call("POST", "/api/places", { body: { name: "Gate 1", category: "gate", isEntrance: true, ...at(0.001, 0.001), junction: J.d._id } })).data.place;
        const viaPlaces = await call("GET", `/api/route?fromPlace=${library._id}&toPlace=${other._id}&role=visitor`, { auth: false });
        assert.equal(viaPlaces.status, 200);
        assert.equal(viaPlaces.data.route.from.name, "Central Library");
        assert.equal(viaPlaces.data.route.to.name, "Gate 1");

        const missing = await call("GET", `/api/route?fromPlace=${library._id}&toPlace=${new mongoose.Types.ObjectId()}`, { auth: false });
        assert.equal(missing.status, 404);

        const tooFar = await call("GET", `/api/route?fromLat=${at(0.02, 0.02).lat}&fromLng=${at(0.02, 0.02).lng}&toPlace=${other._id}`, { auth: false });
        assert.equal(tooFar.status, 404);

        const outside = await call("GET", `/api/route?fromLat=30.39&fromLng=76.42&toPlace=${other._id}`, { auth: false });
        assert.equal(outside.status, 422);

        const unreachable = await call("GET", `/api/route?fromPlace=${library._id}&toLat=${at(0.02, 0.02).lat}&toLng=${at(0.02, 0.02).lng}`, { auth: false });
        assert.equal(unreachable.status, 404);

        for (const bad of ["", "fromPlace=abc&toPlace=abc", `fromLat=1&toPlace=${other._id}`, `fromPlace=${library._id}&toPlace=${other._id}&role=alien`, `fromPlace[$ne]=1&toPlace=${other._id}`]) {
            const response = await call("GET", "/api/route?" + bad, { auth: false });
            assert.equal(response.status, 400, bad);
        }
    });

    await t.test("editing the network updates routes and cascades deletes", async () => {
        const before = await call("GET", `/api/route?fromPlace=${library._id}&toLat=${at(0.001, 0).lat}&toLng=${at(0.001, 0).lng}`, { auth: false });
        const distanceBefore = before.data.route.distanceMeters;

        const moved = await call("PUT", "/api/paths/junctions/" + J.b._id, { body: { ...at(0.0015, 0) } });
        assert.equal(moved.status, 200);
        assert.equal(moved.data.updatedWalkways, 2);
        const after = await call("GET", `/api/route?fromPlace=${library._id}&toLat=${at(0.0015, 0).lat}&toLng=${at(0.0015, 0).lng}`, { auth: false });
        assert.ok(after.data.route.distanceMeters > distanceBefore);

        const updatedWalkway = await call("PUT", "/api/paths/walkways/" + (await Walkway.findOne())._id, { body: { name: "Main path" } });
        assert.equal(updatedWalkway.status, 200);
        assert.equal(updatedWalkway.data.walkway.name, "Main path");

        const removed = await call("DELETE", "/api/paths/junctions/" + J.a._id);
        assert.equal(removed.status, 200);
        assert.equal(removed.data.removedWalkways, 2);
        const library2 = await call("GET", "/api/places/" + library._id, { auth: false });
        assert.equal(library2.data.place.junction, null);
        assert.equal((await Walkway.countDocuments()), 2);
    });

    await t.test("bad bodies", async () => {
        const badJson = await call("POST", "/api/places", { raw: "{not json" });
        assert.equal(badJson.status, 400);
        const huge = await call("POST", "/api/places", { raw: JSON.stringify({ name: "x".repeat(20000) }) });
        assert.equal(huge.status, 413);
    });
});
