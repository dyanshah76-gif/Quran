// Prayer times and sky colours for the adhkar page. Everything is computed on
// the device from the date and the coordinates; nothing is downloaded.
//
// Prayer times follow the PrayTimes.org method (Hamid Zarrabi-Zadeh): sun
// position from the Julian date, Fajr and Isha from a sun angle below the
// horizon, Asr from the shadow length, and the "angle-based" rule when the sun
// never goes deep enough below the horizon (Paris in summer).

export const METHODS = {
  mwl: { fajr: 18, isha: 17 }, // Muslim World League
  uoif: { fajr: 12, isha: 12 }, // Musulmans de France (UOIF)
  isna: { fajr: 15, isha: 15 }, // Islamic Society of North America
};

export const PARIS = { lat: 48.8566, lng: 2.3522 };

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const dsin = (d) => Math.sin(rad(d));
const dcos = (d) => Math.cos(rad(d));
const dtan = (d) => Math.tan(rad(d));
const darcsin = (x) => deg(Math.asin(x));
const darccos = (x) => deg(Math.acos(x));
const darctan2 = (y, x) => deg(Math.atan2(y, x));
const darccot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => a - b * Math.floor(a / b);
const fixAngle = (a) => fix(a, 360);
const fixHour = (h) => fix(h, 24);

function julian(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

function sunPosition(jd) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15;
  return { decl: darcsin(dsin(e) * dsin(l)), eqt: q / 15 - fixHour(ra) };
}

// Times for the local calendar day of `date`, as Date objects.
export function prayerTimes(date, lat, lng, methodKey = 'mwl', asrFactor = 1) {
  const method = METHODS[methodKey] || METHODS.mwl;
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const jDate = julian(y, m, d) - lng / (15 * 24);
  const sun = (portion) => sunPosition(jDate + portion);
  const midDay = (portion) => fixHour(12 - sun(portion).eqt);
  const angleTime = (angle, portion, before) => {
    const decl = sun(portion).decl;
    const x = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
    if (x < -1 || x > 1) return NaN; // the sun never reaches this angle today
    const h = darccos(x) / 15;
    return midDay(portion) + (before ? -h : h);
  };
  const asrTime = (portion) => {
    const decl = sun(portion).decl;
    return angleTime(-darccot(asrFactor + dtan(Math.abs(lat - decl))), portion, false);
  };

  const guess = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  let t = { ...guess };
  for (let i = 0; i < 2; i += 1) {
    const p = {};
    for (const key of Object.keys(t)) p[key] = (Number.isNaN(t[key]) ? guess[key] : t[key]) / 24;
    t = {
      fajr: angleTime(method.fajr, p.fajr, true),
      sunrise: angleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(p.asr),
      sunset: angleTime(0.833, p.sunset, false),
      isha: angleTime(method.isha, p.isha, false),
    };
  }
  for (const key of Object.keys(t)) t[key] -= lng / 15; // local solar time -> UTC hours

  // High latitudes: Fajr no earlier than sunrise minus (angle / 60) of the
  // night, Isha no later than sunset plus the same portion.
  const night = fixHour(t.sunrise - t.sunset);
  const limit = (time, base, angle, before) => {
    const portion = (angle / 60) * night;
    const diff = before ? fixHour(base - time) : fixHour(time - base);
    if (Number.isNaN(time) || diff > portion) return base + (before ? -portion : portion);
    return time;
  };
  t.fajr = limit(t.fajr, t.sunrise, method.fajr, true);
  t.isha = limit(t.isha, t.sunset, method.isha, false);

  const midnightUtc = Date.UTC(y, m - 1, d);
  const out = {};
  for (const [key, hours] of Object.entries(t)) out[key] = new Date(midnightUtc + Math.round(hours * 60) * 60000);
  out.maghrib = out.sunset;
  return out;
}

// Where `now` falls between two prayer times. Segments: 'fajr' (Fajr to
// sunrise), 'morning' (sunrise to Dhuhr), 'day' (Dhuhr to Asr), 'evening' (Asr
// to Maghrib), 'dusk' (Maghrib to Isha), 'night' (Isha to Fajr).
export function periodAt(now, lat, lng, methodKey, asrFactor) {
  const events = [];
  const days = {};
  for (const offset of [-1, 0, 1]) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    const times = prayerTimes(day, lat, lng, methodKey, asrFactor);
    days[offset] = times;
    events.push(
      ['fajr', times.fajr],
      ['morning', times.sunrise],
      ['day', times.dhuhr],
      ['evening', times.asr],
      ['dusk', times.maghrib],
      ['night', times.isha],
    );
  }
  events.sort((a, b) => a[1] - b[1]);
  let i = events.findIndex((event) => event[1] > now) - 1;
  if (i < 0) i = 0;
  const [segment, start] = events[i];
  const end = events[i + 1][1];
  const t = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return { segment, t, start, end, today: days[0], yesterday: days[-1], tomorrow: days[1] };
}

// Sky colours: four stops from the top of the screen (zenith) to the bottom
// (horizon), with key frames inside each segment. After Fajr the sky goes
// from deep blue to a pale band and a rose glow, then gold at sunrise; clear
// blue by day; from Asr it warms to pink at Maghrib; then dusk and night.
const NIGHT = ['#060a1c', '#0b1230', '#121a3f', '#1a2349'];
const SUNRISE = ['#3a64a6', '#86a7d4', '#e6d2c6', '#ffd39b'];
const NOON = ['#2c6cbc', '#6ea7df', '#b7d9f3', '#e3f1fb'];
const ASR = ['#3a76bf', '#80b3e2', '#cde1ef', '#f2e9d3'];
const MAGHRIB = ['#38448d', '#9c78ad', '#ea95aa', '#f5a07d'];

const SKY = {
  night: [[0, NIGHT], [1, NIGHT]],
  fajr: [
    [0, ['#080e26', '#121c42', '#22305c', '#3a4774']],
    [0.4, ['#0f1a40', '#24386b', '#5a6a99', '#a99fb5']],
    [0.75, ['#1f3468', '#4a68a2', '#a7b1cf', '#efb99c']],
    [1, SUNRISE],
  ],
  morning: [[0, SUNRISE], [0.35, ['#3c74bf', '#8fbae6', '#d6e7f4', '#f8e8cb']], [1, NOON]],
  day: [[0, NOON], [1, ASR]],
  evening: [
    [0, ASR],
    [0.45, ['#5679bd', '#b3bfdf', '#efd2cf', '#f8d2ae']],
    [0.8, ['#4b5ca6', '#bd98be', '#f1a8b4', '#f8b78e']],
    [1, MAGHRIB],
  ],
  dusk: [
    [0, MAGHRIB],
    [0.4, ['#212a63', '#594d8b', '#ad7198', '#d6898d']],
    [0.75, ['#111943', '#2a2c61', '#574876', '#7a5878']],
    [1, NIGHT],
  ],
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, f) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * f));
};

// Relative luminance (WCAG).
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function skyColors(segment, t) {
  const frames = SKY[segment] || SKY.night;
  let k = 0;
  while (k < frames.length - 2 && t > frames[k + 1][0]) k += 1;
  const [t0, c0] = frames[k];
  const [t1, c1] = frames[k + 1];
  const f = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const stops = c0.map((color, i) => mix(color, c1[i], f));
  let stars = 0;
  if (segment === 'night') stars = 1;
  else if (segment === 'dusk') stars = Math.max(0, (t - 0.4) / 0.6);
  else if (segment === 'fajr') stars = Math.max(0, 1 - t / 0.5);
  return { stops, stars, dark: luminance(stops[1]) < 0.2 };
}
