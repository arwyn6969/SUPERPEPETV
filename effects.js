/* SUPERPEPE TV — live post stack.
   Scanlines, VHS tracking and glitch are drawImage bands, not a full-frame
   pixel walk. Posterize/dither hit a tiny buffer, and only when that channel asks. */

var SPTVEffects = (function () {
  var tiny = null;
  var tctx = null;
  var post = null;
  var pctx = null;
  var dither = null;
  var noise = null;
  var noiseAt = 0;

  function scratch(which, w, h) {
    var c = which === "tiny" ? tiny : post;
    if (!c) {
      c = document.createElement("canvas");
      if (which === "tiny") {
        tiny = c;
        tctx = c.getContext("2d", { willReadFrequently: true });
      } else {
        post = c;
        pctx = c.getContext("2d", { willReadFrequently: true });
      }
    }
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return which === "tiny" ? tctx : pctx;
  }

  function noiseTile(now) {
    if (!noise) {
      noise = document.createElement("canvas");
      noise.width = 128;
      noise.height = 96;
    }
    if (now - noiseAt > 90) {
      noiseAt = now;
      var nctx = noise.getContext("2d");
      var img = nctx.createImageData(128, 96);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      nctx.putImageData(img, 0, 0);
    }
    return noise;
  }

  function ditherTile() {
    if (dither) return dither;
    dither = document.createElement("canvas");
    dither.width = 64;
    dither.height = 64;
    var ctx = dither.getContext("2d");
    var img = ctx.createImageData(64, 64);
    var d = img.data;
    for (var y = 0; y < 64; y++) {
      for (var x = 0; x < 64; x++) {
        var on = ((x * 3 + y * 5) & 7) > 4;
        var i = (y * 64 + x) * 4;
        var v = on ? 0 : 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = on ? 90 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return dither;
  }

  function posterize(scene) {
    var dw = 80;
    var dh = 60;
    var ctx = scratch("post", dw, dh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene, 0, 0, dw, dh);
    var img = ctx.getImageData(0, 0, dw, dh);
    var d = img.data;
    var step = 85;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / step) * step;
      d[i + 1] = Math.round(d[i + 1] / step) * step;
      d[i + 2] = Math.round(d[i + 2] / step) * step;
    }
    ctx.putImageData(img, 0, 0);
    return post;
  }

  function composite(ctx, scene, opt) {
    var w = scene.width;
    var h = scene.height;
    var source = scene;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, opt.shakeX || 0, opt.shakeY || 0);
    ctx.imageSmoothingEnabled = !(opt.pixel > 0.3 || opt.poster > 0.4);

    if (opt.poster > 0.5 && (opt.frame % 3 === 0 || !post)) {
      source = posterize(scene);
    } else if (opt.poster > 0.5 && post) {
      source = post;
    }

    if (opt.pixel > 0.35) {
      var f = 3 + Math.round(opt.pixel * 7);
      var pw = Math.max(20, Math.round(w / f));
      var ph = Math.max(16, Math.round(h / f));
      var px = scratch("tiny", pw, ph);
      px.imageSmoothingEnabled = false;
      px.drawImage(source, 0, 0, pw, ph);
      source = tiny;
    }

    var bands = 22;
    var bh = Math.ceil(h / bands);
    var t = opt.t || 0;
    for (var i = 0; i < bands; i++) {
      var sy = Math.min(h - 1, Math.floor((i / bands) * source.height));
      var sh = Math.max(1, Math.floor(source.height / bands));
      var dy = i * bh;
      var dh = Math.min(bh, h - dy);
      if (dh <= 0) break;
      var wave = Math.sin(t * 2.4 + i * 0.55) * (opt.wave || 0) * 12;
      var track = 0;
      if ((opt.vhs || 0) > 0.25 && i === (Math.floor(t * 3) % bands)) {
        track = opt.vhs * 16;
      }
      var gl = 0;
      if ((opt.glitch || 0) > 0.42 && (i + Math.floor(t * 8)) % 6 === 0) {
        gl = (i % 2 ? 1 : -1) * opt.glitch * 20;
      }
      ctx.drawImage(source, 0, sy, source.width, sh, wave + track + gl, dy, w, dh);
    }

    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (var y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

    if ((opt.dither || 0) > 0.2) {
      ctx.globalAlpha = Math.min(0.45, opt.dither * 0.4);
      var tile = ditherTile();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tile, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    if ((opt.crt || 0) > 0.35) {
      ctx.globalAlpha = 0.07 * opt.crt;
      ctx.fillStyle = "#9dffb0";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    if ((opt.glitch || 0) > 0.72) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = (Math.floor(t * 12) % 2) ? "#d0ffd0" : "#042";
      var gy = Math.floor((Math.sin(t * 9) * 0.5 + 0.5) * h);
      ctx.fillRect(0, gy, w, 3);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { composite: composite, noiseTile: noiseTile };
})();
