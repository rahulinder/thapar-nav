const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { Place, Junction, Walkway, Admin } = require("../src/models");
const { distanceMeters } = require("../src/utils/geo");

const validPlace = () => ({
    name: "Central Library",
    category: "library",
    lat: 30.3547,
    lng: 76.3621
});

test("a minimal place is valid and gets defaults", () => {
    const place = new Place(validPlace());
    assert.equal(place.validateSync(), undefined);
    assert.deepEqual([...place.visibleTo], ["student", "staff", "visitor"]);
    assert.equal(place.isActive, true);
    assert.equal(place.isEntrance, false);
    assert.deepEqual([...place.aliases], []);
});

test("place rejects missing name, bad category and bad coordinates", () => {
    const error = new Place({ category: "castle", lat: 10, lng: 200 }).validateSync();
    assert.ok(error.errors.name);
    assert.ok(error.errors.category);
    assert.ok(error.errors.lat);
    assert.ok(error.errors.lng);
});

test("place rejects empty visibleTo and unknown roles", () => {
    const empty = new Place({ ...validPlace(), visibleTo: [] }).validateSync();
    assert.ok(empty.errors.visibleTo);
    const unknown = new Place({ ...validPlace(), visibleTo: ["alien"] }).validateSync();
    assert.ok(unknown.errors["visibleTo.0"]);
});

test("place limits aliases to ten", () => {
    const aliases = Array.from({ length: 11 }, (_, i) => `alias ${i}`);
    const error = new Place({ ...validPlace(), aliases }).validateSync();
    assert.ok(error.errors.aliases);
});

test("place trims whitespace", () => {
    const place = new Place({ ...validPlace(), name: "  Library  " });
    assert.equal(place.name, "Library");
});

test("junction requires coordinates inside the campus", () => {
    assert.equal(new Junction({ lat: 30.35, lng: 76.36 }).validateSync(), undefined);
    const error = new Junction({ lat: 0, lng: 0 }).validateSync();
    assert.ok(error.errors.lat);
    assert.ok(error.errors.lng);
});

test("walkway needs two different junctions and a distance", () => {
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    const good = new Walkway({ from: a, to: b, distanceMeters: 42 });
    assert.equal(good.validateSync(), undefined);
    assert.equal(good.bidirectional, true);

    const same = new Walkway({ from: a, to: a, distanceMeters: 42 }).validateSync();
    assert.ok(same.errors.to);

    const missing = new Walkway({}).validateSync();
    assert.ok(missing.errors.from);
    assert.ok(missing.errors.to);
    assert.ok(missing.errors.distanceMeters);

    const zero = new Walkway({ from: a, to: b, distanceMeters: 0 }).validateSync();
    assert.ok(zero.errors.distanceMeters);
});

test("admin usernames are lowercased and validated", () => {
    const ok = new Admin({ username: "  Campus.Admin ", passwordHash: "x" });
    assert.equal(ok.validateSync(), undefined);
    assert.equal(ok.username, "campus.admin");
    const bad = new Admin({ username: "a b", passwordHash: "x" }).validateSync();
    assert.ok(bad.errors.username);
});

test("admin passwords are hashed, verified and never serialised", async () => {
    const hash = await Admin.hashPassword("correct horse battery");
    assert.notEqual(hash, "correct horse battery");
    const admin = new Admin({ username: "boss", passwordHash: hash });
    assert.equal(await admin.verifyPassword("correct horse battery"), true);
    assert.equal(await admin.verifyPassword("wrong password!!"), false);
    assert.equal(await admin.verifyPassword(undefined), false);
    const json = admin.toJSON();
    assert.equal(json.passwordHash, undefined);
    assert.equal(json.username, "boss");
});

test("admin refuses short passwords", async () => {
    await assert.rejects(() => Admin.hashPassword("short"), /at least 10/);
});

test("distanceMeters is sensible", () => {
    const a = { lat: 30.3547, lng: 76.3621 };
    assert.equal(Math.round(distanceMeters(a, a)), 0);
    const d = distanceMeters(a, { lat: 30.3557, lng: 76.3621 });
    assert.ok(d > 105 && d < 117);
});
