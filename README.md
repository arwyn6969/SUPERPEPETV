# SUPERPEPE TV

An old-school Pepe television. Eight generative channels play inside a PEPEPAINT-styled **400×560** portrait card. Each channel is a brush cast, a motion grammar, and a CRT / VHS / glitch stack. The picture can follow the microphone, the camera, or a file you drop on the set.

This is **not** a music-staff composer. objkt.com only. **fxhash is not used.**

## Run it

From this folder:

```bash
python3 -m http.server 8080
```

Open the page and press a key or the card if you want the GEN drone. The picture moves even when the browser blocks sound.

Keys: `1`–`8` channels, `0` snow, left/right change channel, `h` hides the deck (needed for bootloader capture), `?` help, `s` snap PNG, `v` or `d` mint dialog.

## Channels

| Key | Channel | Callsign |
|---|---|---|
| 1 | CH 03 | SWAMP CRT |
| 2 | CH 07 | STATIC KEK |
| 3 | CH 13 | LATE NIGHT |
| 4 | CH 21 | SPORTS |
| 5 | CH 33 | WEATHER |
| 6 | CH 69 | INFOMERCIAL |
| 7 | CH 88 | NIGHTWATCH |
| 8 / 0 | CH 99 | SNOW |

`RAND` deals a new variation of the **current** station. The `SPTV1.` code stores seed + channel + variation, so the same code comes back the same.

`?ch=07` opens that station. `?code=SPTV1....` imports a code.

## Mint on objkt

The token is an **interactive HTML zip**, plus a cover PNG, plus an optional short video.

```bash
npm test
npm run zip
```

`dist/superpepetv.zip` has `index.html` at the root, relative paths only, fonts and brushes inlined, and no YouTube, CDN, or fxhash. The checker rejects external script or stylesheet URLs.

1. In the set, `SNAP` saves a cover PNG. `REC` saves about eight seconds of the screen (and audio, if the browser allows it). `MINT` also writes a metadata JSON with the `SPTV1.` code.
2. On [objkt.com](https://objkt.com/create): create → your collection → upload the **zip** as the artefact and the PNG as the cover. Paste the code into the description. Editions and royalties are yours.
3. Capture mode (`?c=true` with a bootloader seed) hides the controls and calls `$bootloader.capture()` after the sprites are on screen. GEN keeps moving so the thumbnail is not a still.

YouTube is **not** in the zip. Camera and microphone use `getUserMedia` only — nothing is uploaded — but objkt’s iframe usually blocks them. The set stays on GEN, shows a notice, and offers **OPEN THE APP** to the hosted worker with `?ch=` so the same station opens where the camera is allowed.

## Hosted set (Cloudflare)

The worker is the same card plus a hosted-only YouTube source. It sends:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`

```bash
npm run hosted
npx wrangler deploy --config tools/wrangler.toml
```

Intended URL: `https://arwyn.party/SUPERPEPETV/`

`tools/worker.js` injects `yt.js` into `index.html`. `npm run zip` does not include that file. A sovereign Tezos FA2 collection is later work, not this version.

## Credits

- PEPEPAINT V1 by Nathan Gregg — MIT. Art, fonts, visual system.
- unscii by viznut.
- SUPERPEPEPAINT by arwyn6969 — mint and host patterns.
- SUPERPEPE TV — MIT, same terms.

## License

MIT. See [LICENSE](LICENSE).
