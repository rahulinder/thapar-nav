const mongoose = require('mongoose');
const { connectDb } = require('../src/config/db');
const Place = require('../src/models/Place');
const Junction = require('../src/models/Junction');
const Walkway = require('../src/models/Walkway');
const { haversine } = require('../src/utils/geo');

const junctionData = [
  { key: 'gate', label: 'Main Gate', lat: 30.35205, lng: 76.36335 },
  { key: 'j1', label: 'Gate Road Junction', lat: 30.35290, lng: 76.36420 },
  { key: 'j2', label: 'Central Crossing', lat: 30.35400, lng: 76.36500 },
  { key: 'j3', label: 'Library Crossing', lat: 30.35480, lng: 76.36420 },
  { key: 'j4', label: 'Academic Block Crossing', lat: 30.35480, lng: 76.36600 },
  { key: 'j5', label: 'Hostel Road Junction', lat: 30.35600, lng: 76.36520 },
  { key: 'j6', label: 'Food Court Junction', lat: 30.35330, lng: 76.36620 },
];

const edges = [
  ['gate', 'j1'],
  ['j1', 'j2'],
  ['j2', 'j3'],
  ['j2', 'j4'],
  ['j2', 'j6'],
  ['j4', 'j5'],
  ['j3', 'j5'],
];

const placeData = [
  { name: 'Main Gate', category: 'gate', lat: 30.35205, lng: 76.36335, isEntrance: true, aliases: ['Gate 1', 'Entrance'], description: 'Main entrance to the campus.' },
  { name: 'Central Library', category: 'library', lat: 30.35490, lng: 76.36410, aliases: ['Library'], description: 'Books, reading halls and study spaces.', openingHours: '8:00 AM - 8:00 PM' },
  { name: 'Academic Block A', category: 'academic', lat: 30.35485, lng: 76.36610, aliases: ['LT Block', 'Block A'], description: 'Lecture theatres and classrooms.' },
  { name: 'Boys Hostel H', category: 'hostel', lat: 30.35610, lng: 76.36530, visibleTo: ['student'], description: 'Hostel for students.' },
  { name: 'Food Court', category: 'food', lat: 30.35325, lng: 76.36630, aliases: ['Canteen', 'Cafeteria'], description: 'Snacks and meals.', openingHours: '8:00 AM - 9:00 PM' },
  { name: 'Administration Office', category: 'admin', lat: 30.35395, lng: 76.36510, visibleTo: ['staff', 'visitor'], description: 'Registrar and general administration.' },
  { name: 'Health Centre', category: 'medical', lat: 30.35300, lng: 76.36410, description: 'First aid and basic medical care.' },
];

async function main() {
  await connectDb();

  await Promise.all([Place.deleteMany({}), Junction.deleteMany({}), Walkway.deleteMany({})]);

  const junctions = await Junction.insertMany(junctionData.map(({ label, lat, lng }) => ({ label, lat, lng })));
  const byKey = new Map(junctionData.map((j, i) => [j.key, junctions[i]]));

  const walkways = edges.map(([a, b]) => {
    const from = byKey.get(a);
    const to = byKey.get(b);
    return { from: from._id, to: to._id, distance: haversine(from, to) };
  });
  await Walkway.insertMany(walkways);
  await Place.insertMany(placeData);

  console.log(`Seeded ${placeData.length} places, ${junctions.length} junctions, ${walkways.length} walkways.`);
  console.log('These are sample coordinates. Replace them with real campus data from the admin panel.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
