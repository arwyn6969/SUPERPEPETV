/* SUPERPEPE TV — eight station presets.
   Each preset: brush cast, motion grammar, effect stack, audio map.
   RAND reshuffles knobs inside the current station. It does not change the channel. */

var CHANNELS = [
  {
    id: "03",
    num: 3,
    callsign: "SWAMP CRT",
    palette: ["pepe", "gondola", "heart", "cat"],
    bg: ["#03160a", "#0c3a16"],
    motion: "crawl",
    cap: 12,
    speed: 0.38,
    fx: { crt: 0.95, vhs: 0.75, wave: 0.22, pixel: 0, poster: 0, dither: 0.15, mono: 0, glitch: 0.15, hueDrift: 0 },
    audio: { bass: "scale" }
  },
  {
    id: "07",
    num: 7,
    callsign: "STATIC KEK",
    palette: ["doge", "cat", "xcp", "sun", "sminem"],
    bg: ["#160018", "#3a0044"],
    motion: "static",
    cap: 16,
    speed: 1,
    fx: { crt: 0.45, vhs: 0.25, wave: 0.08, pixel: 0.15, poster: 0, dither: 0.35, mono: 0, glitch: 0.9, hueDrift: 0 },
    audio: { bass: "shake" }
  },
  {
    id: "13",
    num: 13,
    callsign: "LATE NIGHT",
    palette: ["wojak", "npc", "pepe"],
    bg: ["#070712", "#101828"],
    motion: "drift",
    cap: 9,
    speed: 0.45,
    fx: { crt: 0.55, vhs: 0.35, wave: 0.7, pixel: 0, poster: 0, dither: 0.2, mono: 1, glitch: 0.2, hueDrift: 0 },
    audio: { bass: "scale" }
  },
  {
    id: "21",
    num: 21,
    callsign: "SPORTS",
    palette: ["firedog", "swole", "sanic"],
    bg: ["#2a0606", "#6a140c"],
    motion: "punch",
    cap: 10,
    speed: 1.15,
    fx: { crt: 0.35, vhs: 0.2, wave: 0.05, pixel: 0, poster: 0, dither: 0, mono: 0, glitch: 0.25, hueDrift: 0 },
    audio: { bass: "punch" }
  },
  {
    id: "33",
    num: 33,
    callsign: "WEATHER",
    palette: ["cheems", "heart", "gondola"],
    bg: ["#0c1c28", "#3a5a68"],
    motion: "rain",
    cap: 18,
    speed: 0.85,
    fx: { crt: 0.4, vhs: 0.45, wave: 0.18, pixel: 0, poster: 0, dither: 0.1, mono: 0, glitch: 0.1, hueDrift: 0 },
    audio: { bass: "scale" }
  },
  {
    id: "69",
    num: 69,
    callsign: "INFOMERCIAL",
    palette: ["groyper", "sminem", "sun", "heart"],
    bg: ["#201018", "#682848"],
    motion: "bounce",
    cap: 11,
    speed: 0.9,
    fx: { crt: 0.3, vhs: 0.15, wave: 0.05, pixel: 0.55, poster: 0.85, dither: 0.45, mono: 0, glitch: 0.2, hueDrift: 0 },
    audio: { bass: "scale" }
  },
  {
    id: "88",
    num: 88,
    callsign: "NIGHTWATCH",
    palette: ["ufo", "sun", "xcp", "cat"],
    bg: ["#050818", "#12183a"],
    motion: "orbit",
    cap: 10,
    speed: 0.55,
    fx: { crt: 0.5, vhs: 0.3, wave: 0.28, pixel: 0, poster: 0, dither: 0.1, mono: 0, glitch: 0.35, hueDrift: 1 },
    audio: { bass: "scale" }
  },
  {
    id: "99",
    num: 99,
    callsign: "SNOW",
    palette: ["pepe", "sun"],
    bg: ["#1a1a1a", "#3a3a3a"],
    motion: "snow",
    cap: 2,
    speed: 0.2,
    fx: { crt: 0.7, vhs: 0.85, wave: 0.12, pixel: 0.2, poster: 0, dither: 0.8, mono: 1, glitch: 0.4, hueDrift: 0 },
    audio: { bass: "shake" }
  }
];
