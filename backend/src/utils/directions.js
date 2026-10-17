const { haversine, bearing, compassName } = require('./geo');

function turnWord(delta) {
  const abs = Math.abs(delta);
  if (abs < 25) return 'Continue straight';
  if (abs < 60) return delta > 0 ? 'Bear right' : 'Bear left';
  if (abs < 135) return delta > 0 ? 'Turn right' : 'Turn left';
  return delta > 0 ? 'Make a sharp right' : 'Make a sharp left';
}

function normalizeDelta(from, to) {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function buildSteps(points, destinationName) {
  if (points.length < 2) {
    return [{ instruction: `You are at ${destinationName}`, distance: 0, lat: points[0].lat, lng: points[0].lng }];
  }

  const legs = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    legs.push({
      from: points[i],
      to: points[i + 1],
      distance: haversine(points[i], points[i + 1]),
      bearing: bearing(points[i], points[i + 1]),
    });
  }

  const steps = [];
  let current = {
    instruction: `Head ${compassName(legs[0].bearing)}`,
    distance: legs[0].distance,
    lat: legs[0].from.lat,
    lng: legs[0].from.lng,
  };

  for (let i = 1; i < legs.length; i += 1) {
    const delta = normalizeDelta(legs[i - 1].bearing, legs[i].bearing);
    const word = turnWord(delta);
    if (word === 'Continue straight') {
      current.distance += legs[i].distance;
    } else {
      steps.push(current);
      current = {
        instruction: word,
        distance: legs[i].distance,
        lat: legs[i].from.lat,
        lng: legs[i].from.lng,
      };
    }
  }
  steps.push(current);

  const last = points[points.length - 1];
  steps.push({ instruction: `Arrive at ${destinationName}`, distance: 0, lat: last.lat, lng: last.lng });

  return steps.map((s) => ({ ...s, distance: Math.round(s.distance) }));
}

module.exports = { buildSteps };
