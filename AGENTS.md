# SUPERPEPE TV

Vanilla HTML, CSS, and JS. No React, no bundler, no framework.

This is a television, not a music-staff composer. Do not port sequencer, tempo, swing, stamps-as-notes, or the staff canvas from SUPERPEPEPAINT.

- Portrait card is 400×560. Do not switch it to landscape.
- objkt.com only. No fxhash, no `zip:fx`, no fxhash adapter.
- The NFT zip (`npm run zip`) has `index.html` at the root, relative paths only, and zero runtime network requests. YouTube stays in `tools/yt.js` and is stripped from the zip.
- Ship the curated data-URI brushes in `brushes.js` (16–24). Do not put the heavy `brushes/` PNGs in the zip.
- Generative layout is a mulberry32 seeded from `$bootloader.hash` plus channel plus variation, so an `SPTV1.` code replays. Use `$bootloader.capture()` only after sprites are ready and controls are hidden.
- Keep the post stack on drawImage bands. Full-frame `getImageData` is for posterize on a downscaled buffer, not every pixel every frame.
- Same spirit as PEPEPAINT: small, readable, smallest change that works.
