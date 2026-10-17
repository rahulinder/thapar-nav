(function () {
  const cfg = window.APP_CONFIG;
  const ROLE_KEY = 'thaparnav_role';

  const ROLES = {
    student: { label: 'Student', icon: '🎓' },
    staff: { label: 'Staff', icon: '💼' },
    visitor: { label: 'Visitor', icon: '👋' },
  };

  const CATEGORIES = {
    academic: { label: 'Academic', icon: '🏫' },
    hostel: { label: 'Hostels', icon: '🛏️' },
    food: { label: 'Food', icon: '🍽️' },
    admin: { label: 'Admin', icon: '🏛️' },
    library: { label: 'Library', icon: '📚' },
    sports: { label: 'Sports', icon: '⚽' },
    medical: { label: 'Medical', icon: '🏥' },
    gate: { label: 'Gates', icon: '🚪' },
    parking: { label: 'Parking', icon: '🅿️' },
    other: { label: 'Other', icon: '📍' },
  };

  const SHORTCUTS = {
    visitor: [
      { label: '🚪 Nearest gate', category: 'gate' },
      { label: '🏛️ Administration', category: 'admin' },
      { label: '🍽️ Food', category: 'food' },
    ],
    student: [
      { label: '🛏️ My hostel', category: 'hostel' },
      { label: '🏫 Classes', category: 'academic' },
      { label: '📚 Library', category: 'library' },
      { label: '🍽️ Food', category: 'food' },
    ],
    staff: [
      { label: '🏛️ Administration', category: 'admin' },
      { label: '🅿️ Parking', category: 'parking' },
      { label: '📚 Library', category: 'library' },
      { label: '🍽️ Food', category: 'food' },
    ],
  };

  const state = {
    role: null,
    places: [],
    byId: new Map(),
    activeCategory: null,
    map: null,
    markerLayer: null,
    userMarker: null,
    accuracyCircle: null,
    userPos: null,
    watchId: null,
    following: false,
    fixWaiters: [],
    selected: null,
    route: null,
    routeLayer: null,
    destMarker: null,
    startMarker: null,
    lastReroute: 0,
    rerouting: false,
  };

  const $ = (id) => document.getElementById(id);

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((key) => {
        if (key === 'class') el.className = props[key];
        else if (key.startsWith('on')) el.addEventListener(key.slice(2), props[key]);
        else el.setAttribute(key, props[key]);
      });
    }
    kids.flat().forEach((kid) => {
      if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
    });
    return el;
  }

  const catInfo = (c) => CATEGORIES[c] || CATEGORIES.other;
  const fmtDistance = (m) => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km');
  const fmtDuration = (s) => Math.max(1, Math.round(s / 60)) + ' min';

  let toastTimer = null;
  function toast(message, ms) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, ms || 4500);
  }

  function readRole() {
    try {
      const saved = localStorage.getItem(ROLE_KEY);
      return Object.keys(ROLES).includes(saved) ? saved : null;
    } catch (e) {
      return null;
    }
  }

  function saveRole(role) {
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch (e) {
      return;
    }
  }

  function showRoleScreen() {
    stopNavigation();
    $('app').hidden = true;
    $('role-screen').hidden = false;
  }

  function chooseRole(role) {
    state.role = role;
    saveRole(role);
    $('role-screen').hidden = true;
    $('app').hidden = false;
    startApp();
  }

  function pinIcon(icon, extra) {
    return L.divIcon({
      className: '',
      html: '<div class="pin ' + (extra || '') + '"><span>' + icon + '</span></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
  }

  function initMap() {
    if (state.map) {
      setTimeout(() => state.map.invalidateSize(), 50);
      return;
    }
    state.map = L.map('map').setView(cfg.CAMPUS_CENTER, cfg.DEFAULT_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);
    state.map.on('dragstart', () => {
      state.following = false;
    });
    setTimeout(() => state.map.invalidateSize(), 50);
  }

  async function startApp() {
    $('role-badge').textContent = ROLES[state.role].icon + ' ' + ROLES[state.role].label + ' ▾';
    initMap();
    stopNavigation();
    closeSheet();
    hideList();
    $('search').value = '';
    state.activeCategory = null;
    renderShortcuts();
    $('chips').replaceChildren(h('p', { class: 'muted pad' }, 'Loading places…'));
    try {
      await loadPlaces();
    } catch (err) {
      showLoadError(err);
      return;
    }
    renderChips();
    renderMarkers();
    fitPlaces();
  }

  async function loadPlaces() {
    const data = await Api.get('/api/places?role=' + encodeURIComponent(state.role) + '&limit=500');
    state.places = data.places;
    state.byId = new Map(state.places.map((p) => [p._id, p]));
  }

  function showLoadError(err) {
    $('chips').replaceChildren(
      h(
        'div',
        { class: 'load-error' },
        h('span', null, err.message),
        h('button', { class: 'secondary', type: 'button', onclick: startApp }, 'Try again')
      )
    );
  }

  function renderChips() {
    const box = $('chips');
    box.replaceChildren();
    const counts = {};
    state.places.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    const cats = Object.keys(counts).sort((a, b) => catInfo(a).label.localeCompare(catInfo(b).label));
    if (cats.length === 0) {
      box.append(h('p', { class: 'muted pad' }, 'No places have been added yet. Add them from the admin panel.'));
      return;
    }
    cats.forEach((c) => {
      const info = catInfo(c);
      box.append(
        h(
          'button',
          {
            class: 'cat-card' + (state.activeCategory === c ? ' active' : ''),
            type: 'button',
            onclick: () => toggleCategory(c),
          },
          h('span', { class: 'cat-icon' }, info.icon),
          h('span', { class: 'cat-label' }, info.label),
          h('span', { class: 'cat-count' }, String(counts[c]))
        )
      );
    });
  }

  function toggleCategory(category) {
    state.activeCategory = state.activeCategory === category ? null : category;
    renderChips();
    renderMarkers();
    fitPlaces();
  }

  function visiblePlaces() {
    return state.places.filter((p) => !state.activeCategory || p.category === state.activeCategory);
  }

  function renderMarkers() {
    state.markerLayer.clearLayers();
    visiblePlaces().forEach((p) => {
      L.marker([p.lat, p.lng], { icon: pinIcon(catInfo(p.category).icon), title: p.name })
        .on('click', () => openDetails(p))
        .addTo(state.markerLayer);
    });
  }

  function fitPlaces() {
    if (state.route) return;
    const list = visiblePlaces();
    if (list.length === 0) return;
    const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lng]));
    state.map.fitBounds(bounds.pad(0.15), { maxZoom: 18 });
  }

  function hideList() {
    $('suggestions').hidden = true;
    $('suggestions').replaceChildren();
  }

  function renderList(items, emptyText, onPick) {
    const ul = $('suggestions');
    ul.replaceChildren();
    if (items.length === 0) {
      ul.append(h('li', { class: 'empty' }, emptyText));
    } else {
      items.forEach((item) => {
        ul.append(
          h(
            'li',
            null,
            h(
              'button',
              { type: 'button', onclick: () => onPick(item) },
              h('span', { class: 'sg-icon' }, catInfo(item.category).icon),
              h('span', { class: 'sg-name' }, item.name),
              h('span', { class: 'sg-cat' }, catInfo(item.category).label)
            )
          )
        );
      });
    }
    ul.hidden = false;
  }

  async function pickSuggestion(item) {
    hideList();
    $('search').value = item.name;
    let place = state.byId.get(item._id);
    if (!place) {
      try {
        place = (await Api.get('/api/places/' + item._id)).place;
      } catch (err) {
        toast(err.message);
        return;
      }
    }
    openDetails(place);
  }

  let searchTimer = null;
  let searchSeq = 0;
  function onSearchInput() {
    clearTimeout(searchTimer);
    const q = $('search').value.trim();
    if (!q) {
      searchSeq += 1;
      hideList();
      return;
    }
    searchTimer = setTimeout(async () => {
      searchSeq += 1;
      const seq = searchSeq;
      try {
        const data = await Api.get(
          '/api/places/suggest?q=' + encodeURIComponent(q) + '&role=' + encodeURIComponent(state.role),
          { quiet: true }
        );
        if (seq === searchSeq) renderList(data.suggestions, 'No places match "' + q + '"', pickSuggestion);
      } catch (err) {
        if (seq === searchSeq) renderList([], 'Search failed. ' + err.message, pickSuggestion);
      }
    }, 220);
  }

  function renderShortcuts() {
    const box = $('shortcuts');
    box.replaceChildren();
    (SHORTCUTS[state.role] || []).forEach((sc) => {
      box.append(h('button', { class: 'pill', type: 'button', onclick: () => runShortcut(sc) }, sc.label));
    });
  }

  async function runShortcut(sc) {
    const list = state.places.filter((p) => p.category === sc.category);
    if (list.length === 0) {
      toast('No places in this category have been added for you yet.');
      return;
    }
    if (list.length === 1) {
      openDetails(list[0]);
      return;
    }
    try {
      const pos = await ensureLocation();
      const nearest = list.reduce((best, p) =>
        Geo.distance(pos, p) < Geo.distance(pos, best) ? p : best
      );
      toast('Nearest: ' + nearest.name);
      await navigateFromMe(nearest);
    } catch (err) {
      renderList(list, 'Nothing here', pickSuggestion);
      toast('Location is off, so pick a place from the list.');
    }
  }

  function openDetails(place) {
    state.selected = place;
    const info = catInfo(place.category);
    $('sheet-cat').textContent = info.icon + ' ' + info.label;
    $('sheet-name').textContent = place.name;
    $('sheet-desc').textContent = place.description || '';
    $('sheet-desc').hidden = !place.description;
    $('sheet-hours').textContent = place.openingHours ? 'Open: ' + place.openingHours : '';
    $('sheet-hours').hidden = !place.openingHours;

    const select = $('from-select');
    select.replaceChildren(h('option', { value: '' }, 'Or start from another place…'));
    state.places
      .filter((p) => p._id !== place._id)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => select.append(h('option', { value: p._id }, p.name)));

    updatePanels();
    state.map.flyTo([place.lat, place.lng], Math.max(state.map.getZoom(), 18), { duration: 0.6 });
  }

  function closeSheet() {
    state.selected = null;
    updatePanels();
  }

  function updatePanels() {
    $('sheet').hidden = !state.selected;
    $('nav-panel').hidden = !(state.route && !state.selected);
  }

  function setBusy(on) {
    $('busy').hidden = !on;
  }

  function startWatch() {
    if (state.watchId !== null) return;
    if (!('geolocation' in navigator)) throw new Error('This device does not support GPS location.');
    state.watchId = navigator.geolocation.watchPosition(onFix, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 20000,
    });
  }

  function drawUser() {
    const p = state.userPos;
    const latlng = [p.lat, p.lng];
    if (!state.userMarker) {
      state.userMarker = L.circleMarker(latlng, {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1a73e8',
        fillOpacity: 1,
      }).addTo(state.map);
    } else {
      state.userMarker.setLatLng(latlng);
    }
    if (p.accuracy && p.accuracy < 500) {
      if (!state.accuracyCircle) {
        state.accuracyCircle = L.circle(latlng, {
          radius: p.accuracy,
          stroke: false,
          fillColor: '#1a73e8',
          fillOpacity: 0.12,
        }).addTo(state.map);
      } else {
        state.accuracyCircle.setLatLng(latlng).setRadius(p.accuracy);
      }
    }
  }

  function onFix(pos) {
    state.userPos = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      time: Date.now(),
    };
    drawUser();
    state.fixWaiters.splice(0).forEach((w) => w.resolve(state.userPos));
    if (state.route) trackProgress();
    if (state.following && state.route) state.map.panTo([state.userPos.lat, state.userPos.lng]);
  }

  function onGeoError(err) {
    const messages = {
      1: 'Location permission was denied. Allow location for this site in your browser settings.',
      2: 'Your location is not available right now.',
      3: 'Getting your location took too long. Try again in an open area.',
    };
    const message = messages[err.code] || 'Could not get your location.';
    const waiters = state.fixWaiters.splice(0);
    waiters.forEach((w) => w.reject(new Error(message)));
    if (err.code === 1) {
      if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
      state.watchId = null;
      if (waiters.length === 0) toast(message);
    }
  }

  function ensureLocation() {
    if (state.userPos && state.watchId !== null) return Promise.resolve(state.userPos);
    return new Promise((resolve, reject) => {
      try {
        startWatch();
      } catch (err) {
        reject(err);
        return;
      }
      const waiter = { resolve, reject };
      state.fixWaiters.push(waiter);
      setTimeout(() => {
        const i = state.fixWaiters.indexOf(waiter);
        if (i >= 0) {
          state.fixWaiters.splice(i, 1);
          reject(new Error('Could not get your location. Move to an open area and try again.'));
        }
      }, 20000);
    });
  }

  async function onLocateClick() {
    const btn = $('locate-btn');
    btn.classList.add('pending');
    try {
      const pos = await ensureLocation();
      state.following = true;
      state.map.flyTo([pos.lat, pos.lng], Math.max(state.map.getZoom(), 18), { duration: 0.6 });
    } catch (err) {
      toast(err.message);
    } finally {
      btn.classList.remove('pending');
    }
  }

  async function navigateFromMe(place) {
    try {
      const pos = await ensureLocation();
      await startRoute({ lat: pos.lat, lng: pos.lng }, place, true);
    } catch (err) {
      toast(err.message);
    }
  }

  async function navigateFromPlace(place) {
    const fromId = $('from-select').value;
    if (!fromId) {
      toast('Choose a starting place first.');
      return;
    }
    try {
      await startRoute({ placeId: fromId }, place, false);
    } catch (err) {
      toast(err.message);
    }
  }

  async function startRoute(from, dest, live) {
    setBusy(true);
    try {
      const data = await Api.post('/api/route', { from, to: { placeId: dest._id } }, { quiet: true });
      applyRoute(data, dest, live, true);
    } finally {
      setBusy(false);
    }
  }

  function clearRouteLayers() {
    [state.routeLayer, state.destMarker, state.startMarker].forEach((layer) => {
      if (layer) state.map.removeLayer(layer);
    });
    state.routeLayer = null;
    state.destMarker = null;
    state.startMarker = null;
  }

  function applyRoute(data, dest, live, refit) {
    clearRouteLayers();
    const latlngs = data.path.map((p) => [p.lat, p.lng]);
    state.routeLayer = L.layerGroup([
      L.polyline(latlngs, { color: '#ffffff', weight: 10, opacity: 0.95 }),
      L.polyline(latlngs, { color: '#0f7b8a', weight: 5 }),
    ]).addTo(state.map);
    state.destMarker = L.marker([data.to.lat, data.to.lng], { icon: pinIcon('🏁', 'dest') }).addTo(state.map);
    if (!live) {
      state.startMarker = L.circleMarker([data.from.lat, data.from.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2e9e5b',
        fillOpacity: 1,
      }).addTo(state.map);
    }

    const cum = Geo.cumulative(data.path);
    state.route = {
      data,
      dest,
      live,
      cum,
      total: cum[cum.length - 1],
      stepIdx: data.steps.map((s) => Geo.nearestIndex(s, data.path)),
      arrived: false,
    };
    state.selected = null;
    updatePanels();
    renderNavPanel();
    updateNav(0);
    if (refit) state.map.fitBounds(L.latLngBounds(latlngs).pad(0.25));
    if (live) state.following = true;
  }

  function renderNavPanel() {
    const r = state.route;
    $('nav-dest').textContent = 'To ' + r.dest.name;
    $('nav-summary').textContent = fmtDistance(r.data.distance) + ' · ' + fmtDuration(r.data.duration);
    const list = $('nav-steps');
    list.replaceChildren();
    r.data.steps.forEach((s) => {
      list.append(
        h('li', null, s.instruction + (s.distance ? ' · ' + fmtDistance(s.distance) : ''))
      );
    });
  }

  function updateNav(along) {
    const r = state.route;
    const steps = r.data.steps;
    let cur = 0;
    for (let i = 0; i < steps.length; i += 1) {
      if (r.cum[r.stepIdx[i]] <= along + cfg.STEP_LEAD_METERS) cur = i;
    }
    $('nav-now').textContent = steps[cur].instruction;
    if (cur + 1 < steps.length) {
      const nextAt = r.cum[r.stepIdx[cur + 1]];
      const away = Math.max(0, nextAt - along);
      $('nav-next').textContent = 'Then: ' + steps[cur + 1].instruction + ' in ' + fmtDistance(away);
    } else {
      $('nav-next').textContent = '';
    }
    Array.from($('nav-steps').children).forEach((li, i) => {
      li.classList.toggle('current', i === cur);
      li.classList.toggle('done', i < cur);
    });
    if (r.live) {
      const remaining = Math.max(0, r.total - along);
      const speed = r.data.duration > 0 ? r.data.distance / r.data.duration : 1.3;
      $('nav-summary').textContent =
        fmtDistance(remaining) + ' left · ' + fmtDuration(remaining / speed);
    }
  }

  function trackProgress() {
    const r = state.route;
    if (!r || !r.live || r.arrived || !state.userPos) return;
    const user = state.userPos;

    if (Geo.distance(user, r.data.to) <= cfg.ARRIVE_METERS) {
      r.arrived = true;
      $('nav-now').textContent = 'You have arrived at ' + r.dest.name;
      $('nav-next').textContent = '';
      $('nav-summary').textContent = 'Arrived';
      toast('You have arrived at ' + r.dest.name);
      return;
    }

    const nearest = Geo.nearestOnPath(user, r.data.path, r.cum);
    const threshold = Math.min(80, Math.max(cfg.OFF_ROUTE_METERS, user.accuracy || 0));
    if (nearest.distance > threshold) {
      if (!state.rerouting && Date.now() - state.lastReroute > cfg.REROUTE_COOLDOWN_MS) reroute();
      return;
    }
    updateNav(nearest.along);
  }

  async function reroute() {
    const r = state.route;
    state.rerouting = true;
    state.lastReroute = Date.now();
    toast('You left the route. Finding a new one…', 3000);
    try {
      const data = await Api.post(
        '/api/route',
        { from: { lat: state.userPos.lat, lng: state.userPos.lng }, to: { placeId: r.dest._id } },
        { quiet: true }
      );
      if (state.route === r) applyRoute(data, r.dest, true, false);
    } catch (err) {
      toast(err.message);
    } finally {
      state.rerouting = false;
    }
  }

  function stopNavigation() {
    if (state.map) clearRouteLayers();
    state.route = null;
    state.rerouting = false;
    $('nav-steps').hidden = true;
    $('nav-toggle').textContent = 'Show all steps';
    updatePanels();
  }

  function toggleSteps() {
    const list = $('nav-steps');
    list.hidden = !list.hidden;
    $('nav-toggle').textContent = list.hidden ? 'Show all steps' : 'Hide steps';
  }

  function bindEvents() {
    document.querySelectorAll('.role-btn').forEach((btn) => {
      btn.addEventListener('click', () => chooseRole(btn.dataset.role));
    });
    $('role-badge').addEventListener('click', showRoleScreen);
    $('search').addEventListener('input', onSearchInput);
    $('search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = $('suggestions').querySelector('button');
        if (first) first.click();
      } else if (e.key === 'Escape') {
        hideList();
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.searchbox') && !e.target.closest('.pill')) hideList();
    });
    $('sheet-close').addEventListener('click', closeSheet);
    $('btn-nav-me').addEventListener('click', () => state.selected && navigateFromMe(state.selected));
    $('btn-nav-place').addEventListener('click', () => state.selected && navigateFromPlace(state.selected));
    $('nav-stop').addEventListener('click', stopNavigation);
    $('nav-toggle').addEventListener('click', toggleSteps);
    $('locate-btn').addEventListener('click', onLocateClick);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    if (typeof L === 'undefined') {
      $('role-screen').hidden = false;
      const msg = h('p', { class: 'fatal' }, 'The map could not load. Check your internet connection and refresh.');
      document.querySelector('.role-card').prepend(msg);
      document.querySelectorAll('.role-btn').forEach((b) => {
        b.disabled = true;
      });
      return;
    }
    const saved = readRole();
    if (saved) chooseRole(saved);
    else showRoleScreen();
  });
})();
