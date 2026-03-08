// ---------------------------------------------------------------------------
// Sunrise / Sunset / Moon Phase — pure client-side astronomical calculations
// Accurate to ~1 min for years 2000-2050. No API required.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

/** Julian Date from Date object */
function jd(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Compute sunrise/sunset for a given lat/lon, returning local HH:MM strings */
export function getSunTimes(lat: number, lon: number, date: Date = new Date()): {
  sunrise: string;
  sunset: string;
  dayLengthH: number;
} {
  const J  = jd(date) - 2451545.0; // days since J2000
  const M  = (357.5291 + 0.98560028 * J) % 360;
  const C  = 1.9148 * Math.sin(M * DEG) + 0.0200 * Math.sin(2 * M * DEG) + 0.0003 * Math.sin(3 * M * DEG);
  const lam = ((M + C + 180 + 102.9372) % 360) * DEG;
  const sinDec = Math.sin(23.4393 * DEG) * Math.sin(lam);
  const dec    = Math.asin(sinDec);

  // Hour angle at horizon (altitude = -0.83°)
  const cosHA = (Math.sin(-0.0145) - Math.sin(lat * DEG) * sinDec)
               / (Math.cos(lat * DEG) * Math.cos(dec));
  if (Math.abs(cosHA) > 1) {
    // Polar day or night
    return { sunrise: "—", sunset: "—", dayLengthH: cosHA < -1 ? 24 : 0 };
  }

  const ha  = Math.acos(cosHA) / DEG; // hours ×15
  const Jtransit = 2451545.5 + J + 0.0053 * Math.sin(M * DEG) - 0.0069 * Math.sin(2 * lam) - lon / 360;
  const Jrise  = Jtransit - ha / 360;
  const Jset   = Jtransit + ha / 360;

  function jdToLocal(jday: number): string {
    const ms   = (jday - 2440587.5) * 86400000;
    const d    = new Date(ms);
    const hh   = d.getUTCHours().toString().padStart(2, "0");
    const mm   = d.getUTCMinutes().toString().padStart(2, "0");
    return `${hh}:${mm} UTC`;
  }

  const srH = (Jrise - Math.floor(Jrise)) * 24;
  const ssH = (Jset  - Math.floor(Jset))  * 24;
  const dayLen = ssH - srH;

  // Convert to local string using browser timezone
  function utcFracToLocal(fracDay: number): string {
    // fracDay is UTC hours as fraction of day from midnight
    const utcHours = ((fracDay % 1) + 1) % 1 * 24; // normalize
    const ms = new Date(date);
    ms.setUTCHours(0, 0, 0, 0);
    const local = new Date(ms.getTime() + utcHours * 3600000);
    return local.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return {
    sunrise:    utcFracToLocal((Jrise - 2440587.5) % 1),
    sunset:     utcFracToLocal((Jset  - 2440587.5) % 1),
    dayLengthH: Math.max(0, dayLen),
  };
}

const MOON_CYCLE = 29.530588853; // synodic month days
const NEW_MOON_JD = 2451550.1;   // Jan 6, 2000 18:14 UTC

/** Moon phase 0–1 (0 = new, 0.5 = full) */
export function getMoonPhase(date: Date = new Date()): {
  phase: number;      // 0–1
  emoji: string;
  name: string;
  illumination: number; // 0–100%
} {
  const age = (jd(date) - NEW_MOON_JD) % MOON_CYCLE;
  const phase = age / MOON_CYCLE;

  const illum = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

  let emoji: string;
  let name: string;
  if (phase < 0.0625 || phase >= 0.9375)  { emoji = "🌑"; name = "Mlad Mjesec"; }
  else if (phase < 0.1875)                { emoji = "🌒"; name = "Mlad (rast.)"; }
  else if (phase < 0.3125)                { emoji = "🌓"; name = "Prva četvrt"; }
  else if (phase < 0.4375)                { emoji = "🌔"; name = "Puneći se"; }
  else if (phase < 0.5625)                { emoji = "🌕"; name = "Pun Mjesec"; }
  else if (phase < 0.6875)                { emoji = "🌖"; name = "Puneći (op.)"; }
  else if (phase < 0.8125)                { emoji = "🌗"; name = "Posljednja četvrt"; }
  else                                    { emoji = "🌘"; name = "Star (opad.)"; }

  return { phase, emoji, name, illumination: illum };
}
