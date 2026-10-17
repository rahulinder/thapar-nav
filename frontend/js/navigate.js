// 1. Initialize the map
// Hides the +/- buttons and the OpenStreetMap footer
const map = L.map('map', {
    zoomControl: false,
    attributionControl: false 
}).setView([30.3547, 76.3621], 15); // Default camera set to Thapar University

// 2. Load the visual map tiles from OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

// 3. Ask the browser for the user's location and auto-pan the camera to it
map.locate({ setView: true, maxZoom: 16 });

// 4. If the user clicks "Allow", place a marker at their exact coordinates
map.on('locationfound', function(e) {
    L.marker(e.latlng).addTo(map)
        .bindPopup("You are here!").openPopup();
});

// 5. If the user clicks "Deny" or the GPS fails, fallback to Main Gate
map.on('locationerror', function(e) {
    console.log("Location access denied or unavailable. Defaulting to Main Gate.");
    L.marker([30.3547, 76.3621]).addTo(map)
        .bindPopup("Main Gate").openPopup();
});

// 6. Force Leaflet to recalculate the map size (Fixes the Flexbox rendering bug)
setTimeout(() => {
    map.invalidateSize();
}, 100);