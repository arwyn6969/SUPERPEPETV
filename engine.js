/* SUPERPEPE TV — stamp field, channel snow, camera blit, remote.
   Generative placement comes from the seed. Live bursts come from the analyser.
   Idle motion is time-based so a silent NFT is never a still frame. */

var SPTV = (function () {
  var HOST_URL = "https://superpepetv.mrarwyn.workers.dev";
  var W = 360;
  var H = 312;
  var brushes = {};
  var view, ctx, scene, sctx, video;
  var frame = 0;
  var t0 = 0;
  var lastDemo = 0;
  var mediaGen = 0;
  var gradKey = "";
  var grad = null;
  var standbyDrawn = false;

  var state = {
    channel: 1,
    variation: 1,
    seed: "0000000000000000",
    source: "GEN",
    power: true,
    stream: null,
    audioEl: null,
    fileUrl: "",
    snowUntil: 0,
    knobs: null,
    stamps: [],
    recording: false
  };

  function $(id) { return document.getElementById(id); }

  function hash32(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor() {
    var ch = CHANNELS[state.channel];
    return mulberry32(hash32(state.seed + "|SPTV|" + ch.id + "|" + state.variation));
  }

  function bootSeed() {
    if (window.$bootloader && $bootloader.hash) return $bootloader.hash.slice(0, 16);
    var s = "";
    for (var i = 0; i < 16; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  function clamp01(n) { return Math.max(0, Math.min(1, n)); }

  function preload(cb) {
    var left = BRUSHES.length;
    function done(img) {
      if (img._sptv) return;
      img._sptv = true;
      left -= 1;
      if (left === 0) cb();
    }
    for (var i = 0; i < BRUSHES.length; i++) {
      (function (b) {
        var img = new Image();
        brushes[b.id] = img;
        img.onload = function () { done(img); };
        img.onerror = function () { done(img); };
        img.src = b.img;
        if (img.complete) done(img);
      })(BRUSHES[i]);
    }
  }

  function findChannel(code) {
    if (code == null || code === "") return -1;
    var raw = String(code).toLowerCase().replace(/^ch/, "");
    var n = parseInt(raw, 10);
    for (var i = 0; i < CHANNELS.length; i++) {
      if (CHANNELS[i].id === raw.padStart(2, "0") || CHANNELS[i].num === n) return i;
    }
    return -1;
  }

  function makeStamp(ch, palette, rnd, burst) {
    return {
      id: palette[Math.floor(rnd() * palette.length) % palette.length],
      px: rnd(),
      py: rnd(),
      phase: rnd() * Math.PI * 2,
      freq: 0.35 + rnd() * 1.5,
      amp: 0.03 + rnd() * 0.12,
      spin: (rnd() - 0.5) * 1.2,
      base: (burst ? 0.8 : 0.42) + rnd() * 0.75,
      life: burst ? 0.35 + rnd() * 0.55 : 0,
      born: performance.now(),
      burst: !!burst
    };
  }

  function buildField() {
    var ch = CHANNELS[state.channel];
    var rnd = rngFor();
    var palette = ch.palette.slice();
    var rot = Math.floor(rnd() * palette.length);
    palette = palette.slice(rot).concat(palette.slice(0, rot));
    if (rnd() > 0.5) palette.reverse();
    var stamps = [];
    for (var i = 0; i < ch.cap; i++) stamps.push(makeStamp(ch, palette, rnd, false));
    state.stamps = stamps;
    state.knobs = {
      speed: ch.speed * (0.7 + rnd() * 0.6),
      crt: clamp01(ch.fx.crt * (0.8 + rnd() * 0.35)),
      vhs: clamp01(ch.fx.vhs * (0.75 + rnd() * 0.4)),
      wave: clamp01(ch.fx.wave * (0.65 + rnd() * 0.6)),
      pixel: clamp01(ch.fx.pixel * (0.7 + rnd() * 0.5)),
      poster: ch.fx.poster,
      dither: clamp01(ch.fx.dither * (0.7 + rnd() * 0.5)),
      mono: ch.fx.mono,
      glitch: ch.fx.glitch,
      hueDrift: ch.fx.hueDrift
    };
  }

  function feedback(text) {
    var box = $("feedback_dialog");
    var row = $("feedback_text");
    if (!box || !row) return;
    row.textContent = text;
    box.classList.add("visible");
    clearTimeout(feedback._t);
    feedback._t = setTimeout(function () { box.classList.remove("visible"); }, 1400);
  }

  function channelLabel() {
    var ch = CHANNELS[state.channel];
    return "CH " + ch.id + "  " + ch.callsign;
  }

  function updateChrome() {
    var ch = CHANNELS[state.channel];
    var bug = $("bug");
    if (bug) bug.textContent = "CH " + ch.id + "\n" + ch.callsign;
    var src = $("src_bug");
    if (src) src.textContent = state.source;
    var power = $("power_button");
    if (power) power.setAttribute("aria-pressed", state.power ? "true" : "false");
    ["cam_button", "mic_button", "file_button"].forEach(function (id, i) {
      var el = $(id);
      if (!el) return;
      var name = ["CAM", "MIC", "FILE"][i];
      el.setAttribute("aria-pressed", state.source === name ? "true" : "false");
    });
    document.body.classList.toggle("standby", !state.power);
    var open = $("open_app");
    if (open) open.href = HOST_URL + "/?ch=" + ch.id;
    if (window.SPTVMint) SPTVMint.refreshCode();
    setFeatures();
  }

  function setFeatures() {
    if (!window.$bootloader || !$bootloader.setFeatures) return;
    var ch = CHANNELS[state.channel];
    $bootloader.setFeatures({
      Channel: "CH " + ch.id,
      Callsign: ch.callsign,
      Variation: state.variation,
      Source: "GEN"
    });
  }

  function showNotice(text, withLink) {
    var box = $("notice");
    var label = $("notice_text");
    var link = $("open_app");
    if (!box) return;
    label.textContent = text;
    if (link) link.classList.toggle("hidden", !withLink);
    box.classList.remove("hidden");
  }

  function hideNotice() {
    var box = $("notice");
    if (box) box.classList.add("hidden");
  }

  function stopStream() {
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
  }

  function clearPicture() {
    if (!video) return;
    video.pause();
    video.srcObject = null;
    video.removeAttribute("src");
  }

  function stopFileAudio() {
    if (state.audioEl) {
      state.audioEl.pause();
      state.audioEl = null;
    }
    if (state.fileUrl) {
      URL.revokeObjectURL(state.fileUrl);
      state.fileUrl = "";
    }
  }

  function beginMedia() {
    mediaGen += 1;
    return mediaGen;
  }

  function dropStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (track) { track.stop(); });
  }

  function useGen() {
    beginMedia();
    stopStream();
    clearPicture();
    stopFileAudio();
    if (window.SPTVYouTube) SPTVYouTube.exit();
    state.source = "GEN";
    if (window.SPTVAudio) SPTVAudio.useGen();
    hideNotice();
    updateChrome();
  }

  function failSoft(msg) {
    useGen();
    showNotice(msg + " — STAYING ON GEN", true);
    feedback(msg);
  }

  function setChannel(index, snow) {
    var n = CHANNELS.length;
    state.channel = ((index % n) + n) % n;
    if (snow) state.snowUntil = performance.now() + 420;
    buildField();
    updateChrome();
    feedback(channelLabel());
  }

  function setPower(on) {
    state.power = !!on;
    if (window.SPTVAudio) SPTVAudio.setMuted(!state.power);
    if (video) {
      if (!state.power) video.pause();
      else if ((state.source === "CAM" || state.source === "FILE") && (video.srcObject || video.src)) video.play();
    }
    updateChrome();
    feedback(state.power ? "POWER ON" : "STANDBY");
  }

  function cycleSource() {
    var list = ["GEN", "CAM", "MIC", "FILE"];
    if (window.SPTV_HOSTED) list.push("YT");
    var i = list.indexOf(state.source);
    var next = list[(i + 1) % list.length];
    setSource(next);
  }

  function setSource(src) {
    if (src === "GEN") return useGen();
    if (src === "CAM") return startCam();
    if (src === "MIC") return startMic();
    if (src === "FILE") {
      var input = $("file_input");
      if (input) input.click();
      return;
    }
    if (src === "YT") {
      if (!window.SPTV_HOSTED || !window.SPTVYouTube) {
        showNotice("YOUTUBE IS ON THE HOSTED SET ONLY", true);
        feedback("YT IS HOSTED ONLY");
        return;
      }
      beginMedia();
      stopStream();
      clearPicture();
      state.source = "YT";
      SPTVYouTube.enter();
      if (window.SPTVAudio) SPTVAudio.useGen();
      updateChrome();
    }
  }

  function startCam() {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia || !window.isSecureContext) {
      failSoft("CAMERA BLOCKED");
      return;
    }
    var ticket = beginMedia();
    md.getUserMedia({ video: { facingMode: "user" }, audio: true }).then(function (stream) {
      if (ticket !== mediaGen) { dropStream(stream); return; }
      armCam(stream, true);
    }, function () {
      if (ticket !== mediaGen) return;
      md.getUserMedia({ video: true, audio: false }).then(function (stream) {
        if (ticket !== mediaGen) { dropStream(stream); return; }
        armCam(stream, false);
        feedback("CAM ON  MIC OFF");
      }, function () {
        if (ticket === mediaGen) failSoft("CAMERA BLOCKED");
      });
    });
  }

  function armCam(stream, withAudio) {
    stopStream();
    stopFileAudio();
    if (window.SPTVYouTube) SPTVYouTube.exit();
    state.stream = stream;
    state.source = "CAM";
    video.srcObject = stream;
    video.muted = true;
    var play = video.play();
    if (play && play.catch) play.catch(function () {});
    if (withAudio && window.SPTVAudio) SPTVAudio.attachStream(stream);
    else if (window.SPTVAudio) SPTVAudio.useGen();
    hideNotice();
    updateChrome();
    feedback("CAMERA");
  }

  function startMic() {
    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia || !window.isSecureContext) {
      failSoft("MIC BLOCKED");
      return;
    }
    var ticket = beginMedia();
    md.getUserMedia({ audio: true, video: false }).then(function (stream) {
      if (ticket !== mediaGen) { dropStream(stream); return; }
      stopStream();
      clearPicture();
      stopFileAudio();
      if (window.SPTVYouTube) SPTVYouTube.exit();
      state.stream = stream;
      state.source = "MIC";
      if (window.SPTVAudio) SPTVAudio.attachStream(stream);
      hideNotice();
      updateChrome();
      feedback("MIC");
    }, function () {
      if (ticket === mediaGen) failSoft("MIC BLOCKED");
    });
  }

  function onFile(file) {
    if (!file) return;
    beginMedia();
    stopStream();
    clearPicture();
    stopFileAudio();
    if (window.SPTVYouTube) SPTVYouTube.exit();
    var url = URL.createObjectURL(file);
    state.fileUrl = url;
    state.source = "FILE";
    var isVideo = file.type.indexOf("video/") === 0 || /\.(mp4|webm|mov|mkv|ogv)$/i.test(file.name);
    if (isVideo) {
      video.src = url;
      video.muted = true;
      video.loop = true;
      video.play().then(function () {
        if (window.SPTVAudio) SPTVAudio.attachElement(video);
      }, function () { feedback("PRESS PLAY — FILE BLOCKED"); });
    } else {
      var audio = new Audio();
      audio.src = url;
      audio.loop = true;
      state.audioEl = audio;
      audio.play().then(function () {
        if (window.SPTVAudio) SPTVAudio.attachElement(audio);
      }, function () { feedback("PRESS A KEY — AUDIO BLOCKED"); });
    }
    hideNotice();
    updateChrome();
    feedback("FILE");
  }

  function vary() {
    state.variation = (state.variation + 1 + Math.floor(Math.random() * 240)) & 0xffff;
    buildField();
    updateChrome();
    feedback("VARIATION " + state.variation.toString(16).toUpperCase());
  }

  function place(st, ch, t, levels) {
    if (st.burst) {
      var age = (performance.now() - st.born) / 1000;
      if (age >= st.life) return null;
    }
    var k = state.knobs.speed;
    var x = st.px;
    var y = st.py;
    if (ch.motion === "crawl") {
      x = (st.px + t * 0.045 * k * st.freq) % 1;
      y = st.py + Math.sin(t * st.freq + st.phase) * st.amp;
    } else if (ch.motion === "static") {
      x = st.px + Math.sin(t * 11 * st.freq + st.phase) * 0.012;
      y = st.py + Math.cos(t * 9 * st.freq) * 0.012;
    } else if (ch.motion === "drift") {
      x = st.px + Math.sin(t * 0.28 * st.freq + st.phase) * 0.16;
      y = st.py + Math.cos(t * 0.2 * st.freq + st.phase) * 0.1;
    } else if (ch.motion === "punch") {
      x = (st.px + t * 0.16 * k) % 1;
      y = 0.28 + Math.abs(Math.sin(t * 3.2 * st.freq + st.phase)) * 0.5;
    } else if (ch.motion === "rain") {
      y = (st.py + t * 0.18 * k * st.freq) % 1;
      x = st.px + Math.sin(t * 1.4 + st.phase) * 0.04;
    } else if (ch.motion === "bounce") {
      x = 0.12 + (Math.sin(t * k * st.freq + st.phase) * 0.5 + 0.5) * 0.76;
      y = 0.18 + Math.abs(Math.sin(t * 1.5 * st.freq + st.px * 4)) * 0.62;
    } else if (ch.motion === "orbit") {
      var ang = t * 0.45 * k * st.freq + st.phase;
      x = 0.5 + Math.cos(ang) * (0.12 + st.amp + st.px * 0.22);
      y = 0.48 + Math.sin(ang * 1.25) * (0.12 + st.amp);
    } else {
      x = st.px + Math.sin(t * 0.25 + st.phase) * 0.03;
      y = st.py;
    }
    var punch = ch.audio.bass === "punch" ? 0.95 : ch.audio.bass === "shake" ? 0.45 : 0.32;
    var scale = st.base * (1 + (levels.bass || 0) * punch);
    if (st.burst) {
      var u = ((performance.now() - st.born) / 1000) / st.life;
      scale *= 1.35 * (1 - u);
    }
    return {
      x: x * W,
      y: y * H,
      scale: scale,
      rot: st.phase + t * st.spin
    };
  }

  function burst(ch, n) {
    var palette = ch.palette;
    for (var i = 0; i < n; i++) {
      state.stamps.push(makeStamp(ch, palette, Math.random, true));
    }
    var limit = ch.cap + 8;
    var i = 0;
    while (state.stamps.length > limit && i < state.stamps.length) {
      if (state.stamps[i].burst) state.stamps.splice(i, 1);
      else i += 1;
    }
  }

  function demoLevels(t, now, live) {
    if (state.source !== "GEN") return live;
    if (live.rms > 0.045) return live;
    var onset = 0;
    if (Math.sin(t * 1.65) > 0.96 && now - lastDemo > 420) {
      lastDemo = now;
      onset = 0.8;
    }
    return {
      rms: 0.28,
      bass: 0.22 + 0.28 * Math.abs(Math.sin(t * 2.05)),
      mid: 0.12 + 0.12 * Math.sin(t * 0.7 + 1),
      high: 0.05 + 0.2 * Math.max(0, Math.sin(t * 6.5)),
      onset: onset
    };
  }

  function drawSnow(amount) {
    var tile = SPTVEffects.noiseTile(performance.now());
    sctx.globalAlpha = amount;
    var ox = (performance.now() / 28) % 128;
    sctx.drawImage(tile, -ox, 0, W + 128, H);
    sctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!t0) t0 = now;
    if (!state.power) {
      if (!standbyDrawn) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        standbyDrawn = true;
      }
      frame += 1;
      return;
    }
    standbyDrawn = false;
    var t = (now - t0) / 1000;
    var ch = CHANNELS[state.channel];
    var kn = state.knobs;
    var live = window.SPTVAudio ? SPTVAudio.levels() : { rms: 0, bass: 0, mid: 0, high: 0, onset: 0 };
    var levels = demoLevels(t, now, live);
    if (state.power && levels.onset > 0.5 && ch.motion !== "snow") burst(ch, 2 + Math.floor(levels.onset * 3));

    var hue = ((levels.mid || 0) * 70 + t * (kn.hueDrift || 0) * 28) % 360;
    var filter = "none";
    if (kn.mono) filter = "grayscale(1) contrast(1.2)";
    else if (kn.hueDrift || levels.mid > 0.05) filter = "hue-rotate(" + hue.toFixed(1) + "deg)";
    if (kn.crt > 0.6) filter = (filter === "none" ? "" : filter + " ") + "contrast(" + (1.05 + kn.crt * 0.35).toFixed(2) + ") saturate(" + (1 + kn.crt * 0.4).toFixed(2) + ")";
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    if ("filter" in sctx && sctx.filter !== filter) sctx.filter = filter;

    if (gradKey !== ch.id) {
      grad = sctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, ch.bg[0]);
      grad.addColorStop(1, ch.bg[1]);
      gradKey = ch.id;
    }
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, W, H);
    var sweep = ((t * 36) % (H + 30)) - 15;
    sctx.fillStyle = "rgba(190,255,170,0.045)";
    sctx.fillRect(0, sweep, W, 16);

    var showVideo = (state.source === "CAM" || state.source === "FILE") && video && video.readyState >= 2 && video.videoWidth;
    if (showVideo) {
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var sc = Math.max(W / vw, H / vh);
      var dw = vw * sc;
      var dh = vh * sc;
      sctx.save();
      sctx.beginPath();
      sctx.ellipse(W / 2, H / 2, W * 0.46, H * 0.46, 0, 0, Math.PI * 2);
      sctx.clip();
      sctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
      sctx.restore();
    }

    if (ch.motion === "snow") drawSnow(0.88);
    if (now < state.snowUntil) {
      drawSnow(1);
      var u = (state.snowUntil - now) / 420;
      if (u > 0.72) {
        sctx.fillStyle = "rgba(255,255,255," + ((u - 0.72) / 0.28) + ")";
        sctx.fillRect(0, 0, W, H);
      }
    } else if (state.source !== "YT") {
      sctx.imageSmoothingEnabled = false;
      var kept = [];
      var dropped = false;
      for (var i = 0; i < state.stamps.length; i++) {
        var st = state.stamps[i];
        var p = place(st, ch, t, levels);
        if (!p) { dropped = true; continue; }
        kept.push(st);
        var img = brushes[st.id];
        if (!img || !img.complete || !img.naturalWidth) continue;
        var size = 54 * p.scale;
        sctx.save();
        sctx.translate(p.x, p.y);
        sctx.rotate(p.rot);
        sctx.drawImage(img, -size / 2, -size / 2, size, size);
        sctx.restore();
      }
      if (dropped) state.stamps = kept;
    }
    if ("filter" in sctx) sctx.filter = "none";

    var shakeAmp = (levels.bass || 0) * (ch.audio.bass === "shake" ? 7 : ch.audio.bass === "punch" ? 5 : 2);
    var shakeX = 0;
    var shakeY = 0;
    if (shakeAmp > 0.8) {
      shakeX = (Math.random() - 0.5) * shakeAmp;
      shakeY = (Math.random() - 0.5) * shakeAmp * 0.6;
    }
    var glitch = Math.max(kn.glitch * 0.15, (levels.high || 0) * kn.glitch);
    SPTVEffects.composite(ctx, scene, {
      t: t,
      frame: frame,
      wave: kn.wave,
      vhs: kn.vhs,
      glitch: glitch,
      pixel: kn.pixel,
      poster: kn.poster,
      dither: kn.dither,
      crt: kn.crt,
      shakeX: shakeX,
      shakeY: shakeY
    });

    var vb = $("vu_b");
    var vm = $("vu_m");
    var vh = $("vu_h");
    if (vb && (frame & 1) === 0) {
      vb.style.transform = "scaleY(" + (0.08 + levels.bass).toFixed(3) + ")";
      vm.style.transform = "scaleY(" + (0.08 + levels.mid).toFixed(3) + ")";
      vh.style.transform = "scaleY(" + (0.08 + levels.high).toFixed(3) + ")";
    }
    frame += 1;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    draw(now);
    if (frame === 10 && window.$bootloader && $bootloader.isCapture && !$bootloader._captured) {
      setFeatures();
      $bootloader.capture();
    }
  }

  function fit() {
    var card = $("card");
    if (!card) return;
    var s = Math.min(window.innerWidth / 400, window.innerHeight / 560);
    card.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }

  function toggleHelp() {
    var el = $("info_overlay");
    if (!el) return;
    el.classList.toggle("visible");
  }

  function toggleHide() {
    document.body.classList.toggle("hide-ui");
    feedback(document.body.classList.contains("hide-ui") ? "CONTROLS HIDDEN" : "CONTROLS");
  }

  function bind() {
    $("power_button").addEventListener("click", function () { setPower(!state.power); });
    $("source_button").addEventListener("click", cycleSource);
    $("help_button").addEventListener("click", toggleHelp);
    $("ch_prev").addEventListener("click", function () { setChannel(state.channel - 1, true); });
    $("ch_next").addEventListener("click", function () { setChannel(state.channel + 1, true); });
    $("cam_button").addEventListener("click", function () { setSource("CAM"); });
    $("mic_button").addEventListener("click", function () { setSource("MIC"); });
    $("file_button").addEventListener("click", function () { setSource("FILE"); });
    $("rand_button").addEventListener("click", vary);
    $("file_input").addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (file) onFile(file);
      ev.target.value = "";
    });
    $("notice_close").addEventListener("click", hideNotice);

    document.addEventListener("dragover", function (ev) { ev.preventDefault(); });
    document.addEventListener("drop", function (ev) {
      ev.preventDefault();
      var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (file) onFile(file);
    });

    document.addEventListener("pointerdown", function () {
      if (window.SPTVAudio) SPTVAudio.unlock();
    }, { once: false });

    document.addEventListener("keydown", function (ev) {
      var tag = ev.target && ev.target.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      var k = ev.key;
      if (k >= "1" && k <= "8") {
        setChannel(Number(k) - 1, true);
        ev.preventDefault();
      } else if (k === "0") {
        setChannel(findChannel("99"), true);
      } else if (k === "ArrowLeft") {
        setChannel(state.channel - 1, true);
        ev.preventDefault();
      } else if (k === "ArrowRight") {
        setChannel(state.channel + 1, true);
        ev.preventDefault();
      } else if (k === "h" || k === "H") {
        toggleHide();
      } else if (k === "?" || (k === "/" && ev.shiftKey)) {
        toggleHelp();
      } else if (k === "s" || k === "S") {
        if (window.SPTVMint) SPTVMint.snap();
      } else if (k === "v" || k === "V" || k === "d" || k === "D") {
        if (window.SPTVMint) SPTVMint.open();
      } else if (k === "Escape") {
        var info = $("info_overlay");
        if (info) info.classList.remove("visible");
        if (window.SPTVMint) SPTVMint.close();
      } else if (k === " ") {
        ev.preventDefault();
        if (window.SPTVAudio) SPTVAudio.unlock();
      }
    });
  }

  function getState() {
    var ch = CHANNELS[state.channel];
    return {
      seed: state.seed,
      channel: state.channel,
      id: ch.id,
      callsign: ch.callsign,
      variation: state.variation,
      source: state.source,
      power: state.power
    };
  }

  function applyImport(decoded) {
    if (!decoded) return false;
    if (decoded.channel < 0 || decoded.channel >= CHANNELS.length) return false;
    state.seed = decoded.seed;
    state.channel = decoded.channel;
    state.variation = decoded.variation & 0xffff;
    state.snowUntil = performance.now() + 420;
    buildField();
    updateChrome();
    feedback("IMPORTED " + channelLabel());
    return true;
  }

  function start() {
    view = $("view");
    ctx = view.getContext("2d", { alpha: false });
    view.width = W;
    view.height = H;
    scene = document.createElement("canvas");
    scene.width = W;
    scene.height = H;
    sctx = scene.getContext("2d", { alpha: false });
    video = $("cam");
    state.seed = bootSeed();
    state.variation = hash32(state.seed + "|var") & 0xffff;
    var q = new URLSearchParams(location.search);
    var fromCh = findChannel(q.get("ch"));
    state.channel = fromCh >= 0 ? fromCh : 1;
    if (window.$bootloader && $bootloader.isCapture) document.body.classList.add("capture");
    buildField();
    bind();
    fit();
    window.addEventListener("resize", fit);
    updateChrome();
    state.snowUntil = performance.now() + 380;
    preload(function () {
      requestAnimationFrame(loop);
    });
  }

  return {
    start: start,
    getState: getState,
    applyImport: applyImport,
    setFeatures: setFeatures,
    view: function () { return view; },
    feedback: feedback,
    host: HOST_URL
  };
})();

SPTV.start();
