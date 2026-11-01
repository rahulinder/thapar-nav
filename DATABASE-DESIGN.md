# Database design (A2)

MongoDB stores data as documents grouped into collections. There are four collections. Mongoose models in `backend/src/models/` define and check each one.

## Overview

```
Place ──(optional)──> Junction <──── Walkway ────> Junction
                      (a point on a path)   (a footpath between two points)

Admin   (separate, only for logging in to the admin panel)
```

- **Places** are what people search for: a hostel, the library, a gate.
- **Junctions** are points on campus footpaths: corners, crossings, doors.
- **Walkways** connect two junctions. Together they form a graph the route finder walks through.
- **Admins** are the people allowed to add, edit and delete data.

## Place (`places`)

| Field | Type | Rules |
|---|---|---|
| name | text | required, 2 to 120 characters, unique ignoring upper/lower case |
| category | text | required, one of: academic, hostel, food, admin, library, sports, medical, gate, parking, other |
| description | text | up to 1000 characters |
| aliases | list of text | other names people use, up to 10 |
| lat, lng | numbers | required, must fall inside the campus area |
| visibleTo | list of roles | any of student, staff, visitor; at least one; defaults to all three |
| openingHours | text | optional, such as `8 AM to 8 PM` |
| isEntrance | true or false | marks gates and entrances |
| junction | link to a Junction | the nearest path point, used to start or end a route; empty until paths are drawn |
| isActive | true or false | hides a place without deleting it |

Indexes: category, role visibility, and a hidden lowercase copy of the name (`nameKey`) that keeps names unique whatever the capital letters.

## Junction (`junctions`)

| Field | Type | Rules |
|---|---|---|
| label | text | optional name for you, such as `Library crossing` |
| lat, lng | numbers | required, inside the campus area |

## Walkway (`walkways`)

| Field | Type | Rules |
|---|---|---|
| from, to | links to Junctions | both required and different from each other |
| distanceMeters | number | required, above zero; the server will calculate it later from the two junctions |
| bidirectional | true or false | defaults to true, meaning it can be walked both ways |
| drivable | true or false | defaults to false |
| driveBidirectional | true or false | defaults to true; false means one-way from `from` to `to` for driving |
| name | text | optional |

The same pair of junctions can only be joined once (`from` plus `to` is unique).

## Admin (`admins`)

| Field | Type | Rules |
|---|---|---|
| username | text | required, unique, stored lowercase, letters, numbers, dot, dash, underscore |
| passwordHash | text | the scrambled password, never the real one; hidden from normal queries |
| role | text | `admin` or `superadmin` |
| isActive | true or false | lets you disable an account |
| lastLoginAt | date | set when the admin logs in |

Passwords must be at least 10 characters. Use `Admin.hashPassword(...)` to create a hash and `admin.verifyPassword(...)` to check a login. The hash never appears in JSON output.

## Campus area limit

Latitude and longitude values are accepted only inside a box around the campus, set in `backend/src/config/constants.js` (`CAMPUS_BOUNDS`). This catches typos such as swapped numbers. If a real campus point is rejected, widen the box there.

## Every record also has

`_id` (unique id made by MongoDB), `createdAt` and `updatedAt` (filled in automatically).

## EditLog (edit history)

One document per add, change or delete of a place, junction or walkway: `admin` (who, as an Admin id), `adminName` (their name at that moment, so old entries stay readable if the name changes), `action` (created, updated, deleted), `entity` (place, junction, walkway), `entityId`, `entityName` (name or label at that moment, so deleted items can still be identified), `summary`, `changes` (`field`, `from`, `to`) and `createdAt`. If saving a log entry fails, the edit itself still goes through and the error is printed to the server log.

## PlaceImage

One document per gallery image: `place` (Place id, indexed), `data` (Buffer), `contentType`, timestamps. `Place.gallery` is the ordered list of PlaceImage ids (max 8). Deleting a place deletes its images.
