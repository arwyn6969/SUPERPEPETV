/* SUPERPEPE TV — SNAP, REC, SPTV1 codes, objkt metadata.
   Token shape: SPTV1.<16 hex seed><2 hex channel><4 hex variation><4 hex crc16> */

var SPTVMint = (function () {
  function crc16(str) {
    var c = 0xffff;
    for (var i = 0; i < str.length; i++) {
      c ^= str.charCodeAt(i) << 8;
      for (var b = 0; b < 8; b++) {
        if (c & 0x8000) c = ((c << 1) ^ 0x1021) & 0xffff;
        else c = (c << 1) & 0xffff;
      }
    }
    return c.toString(16).padStart(4, "0");
  }

  function encode(seed, channel, variation) {
    var s = String(seed || "").toLowerCase().replace(/[^0-9a-f]/g, "");
    if (s.length < 16) s = (s + "0000000000000000").slice(0, 16);
    else s = s.slice(0, 16);
    var body = s + (channel & 255).toString(16).padStart(2, "0") + (variation & 0xffff).toString(16).padStart(4, "0");
    return "SPTV1." + body + crc16(body);
  }

  function decode(text) {
    if (!text) return null;
    var m = String(text).trim().toUpperCase().match(/SPTV1\.([0-9A-F]{26})/);
    if (!m) return null;
    var raw = m[1].toLowerCase();
    var body = raw.slice(0, 22);
    var sum = raw.slice(22);
    if (crc16(body) !== sum) return null;
    return {
      seed: body.slice(0, 16),
      channel: parseInt(body.slice(16, 18), 16),
      variation: parseInt(body.slice(18, 22), 16)
    };
  }

  function $(id) { return document.getElementById(id); }

  function downloadBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 800);
  }

  function currentCode() {
    if (!window.SPTV) return "";
    var s = SPTV.getState();
    return encode(s.seed, s.channel, s.variation);
  }

  function refreshCode() {
    var area = $("code_area");
    if (area && document.activeElement !== area) area.value = currentCode();
  }

  function showRec(text) {
    var el = $("rec_bug");
    if (el) el.textContent = text || "";
    var status = $("record_status");
    if (status) status.textContent = text || "";
  }

  function snap(done) {
    var view = SPTV.view();
    if (!view) return;
    var s = SPTV.getState();
    view.toBlob(function (blob) {
      if (!blob) return;
      if (done) done(blob);
      else {
        downloadBlob(blob, "superpepetv-ch" + s.id + ".png");
        SPTV.feedback("SNAP PNG");
      }
    }, "image/png");
  }

  function metaDoc() {
    var s = SPTV.getState();
    var code = currentCode();
    return {
      name: "SUPERPEPE TV — CH " + s.id + " " + s.callsign,
      description: "SUPERPEPE TV channel CH " + s.id + " " + s.callsign + ". Seed code " + code + ". Interactive HTML on objkt. No fxhash.",
      code: code,
      attributes: [
        { name: "Channel", value: "CH " + s.id },
        { name: "Callsign", value: s.callsign },
        { name: "Code", value: code },
        { name: "Variation", value: String(s.variation) }
      ]
    };
  }

  function crc32(bytes) {
    var c = ~0;
    for (var i = 0; i < bytes.length; i++) {
      c ^= bytes[i];
      for (var k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  }

  function zipStore(files) {
    var parts = [];
    var central = [];
    var offset = 0;
    for (var f = 0; f < files.length; f++) {
      var name = new TextEncoder().encode(files[f].name);
      var data = files[f].data;
      var crc = crc32(data);
      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(8, 0, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      var cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    }
    var centralSize = 0;
    for (var c = 0; c < central.length; c++) centralSize += central[c].length;
    var eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, files.length, true);
    eocd.setUint16(10, files.length, true);
    eocd.setUint32(12, centralSize, true);
    eocd.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(eocd.buffer)]), { type: "application/zip" });
  }

  function pickMime() {
    if (!window.MediaRecorder) return "";
    var types = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  var recorder = null;

  function armRecorder(stream, done, cleanup) {
    var mime = pickMime();
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
      recorder = null;
      if (cleanup) cleanup();
      SPTV.feedback("REC FAILED");
      return;
    }
    var chunks = [];
    var rec = recorder;
    var timer = null;
    function finish() {
      if (cleanup) cleanup();
      cleanup = null;
    }
    rec.ondataavailable = function (ev) {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    rec.onerror = function () {
      clearInterval(timer);
      finish();
      if (recorder === rec) recorder = null;
      showRec("");
      SPTV.feedback("REC FAILED");
    };
    rec.onstop = function () {
      clearInterval(timer);
      finish();
      var type = rec.mimeType || mime || "video/webm";
      var ext = type.indexOf("mp4") >= 0 ? "mp4" : "webm";
      if (recorder === rec) recorder = null;
      showRec("");
      if (!chunks.length) {
        SPTV.feedback("REC EMPTY");
        return;
      }
      var blob = new Blob(chunks, { type: type });
      if (done) done(blob, ext);
      else {
        var s = SPTV.getState();
        downloadBlob(blob, "superpepetv-ch" + s.id + "-rec." + ext);
        SPTV.feedback("REC SAVED");
      }
    };
    var videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) videoTrack.addEventListener("ended", function () {
      if (recorder === rec && recorder.state === "recording") recorder.stop();
    });
    rec.start();
    var left = 8;
    showRec("REC " + left);
    SPTV.feedback("REC 8s");
    timer = setInterval(function () {
      left -= 1;
      showRec(left > 0 ? "REC " + left : "SAVING");
      if (left <= 0) {
        clearInterval(timer);
        if (recorder && recorder.state === "recording") recorder.stop();
      }
    }, 1000);
  }

  function recYouTube(done) {
    var md = navigator.mediaDevices;
    if (!md || !md.getDisplayMedia || !window.MediaRecorder) {
      SPTV.feedback("REC NOT IN THIS BROWSER");
      return;
    }
    SPTV.feedback("SHARE THIS TAB AND ITS AUDIO");
    md.getDisplayMedia({
      video: { frameRate: 30 },
      audio: true,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "exclude"
    }).then(function (display) {
      var screen = $("screen");
      var box = screen.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var cap = document.createElement("canvas");
      cap.width = Math.max(2, Math.round(box.width * dpr));
      cap.height = Math.max(2, Math.round(box.height * dpr));
      var cctx = cap.getContext("2d");
      var vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.srcObject = display;
      vid.style.cssText = "position:fixed;left:-9999px;width:8px;height:8px";
      document.body.appendChild(vid);
      var play = vid.play();
      if (play && play.catch) play.catch(function () {});
      var running = true;
      function paint() {
        if (!running) return;
        if (vid.readyState >= 2 && vid.videoWidth) {
          var now = screen.getBoundingClientRect();
          var sx = vid.videoWidth / (window.innerWidth || now.width);
          var sy = vid.videoHeight / (window.innerHeight || now.height);
          cctx.drawImage(vid, now.left * sx, now.top * sy, Math.max(1, now.width * sx), Math.max(1, now.height * sy), 0, 0, cap.width, cap.height);
        }
        requestAnimationFrame(paint);
      }
      paint();
      var stream = cap.captureStream(30);
      display.getAudioTracks().forEach(function (track) { stream.addTrack(track); });
      if (!display.getAudioTracks().length) {
        var status = $("mint_status");
        if (status) status.textContent = "NO TAB AUDIO. TICK SHARE AUDIO.";
      }
      armRecorder(stream, done, function () {
        running = false;
        display.getTracks().forEach(function (track) { track.stop(); });
        vid.srcObject = null;
        vid.remove();
      });
    }, function () {
      SPTV.feedback("SHARE CANCELLED");
    });
  }

  function rec(done) {
    if (recorder) return;
    var state = SPTV.getState();
    if (state && state.source === "YT") return recYouTube(done);
    var view = SPTV.view();
    if (!view || !view.captureStream || !window.MediaRecorder) {
      SPTV.feedback("REC NOT IN THIS BROWSER");
      return;
    }
    var stream = view.captureStream(30);
    var audio = SPTVAudio && SPTVAudio.recordStream();
    if (audio) {
      audio.getAudioTracks().forEach(function (track) { stream.addTrack(track); });
    }
    armRecorder(stream, done);
  }

  function pack() {
    if (recorder) return;
    var s = SPTV.getState();
    showRec("SNAP");
    snap(function (png) {
      rec(function (clip, ext) {
        Promise.all([png.arrayBuffer(), clip.arrayBuffer()]).then(function (bufs) {
          var json = new TextEncoder().encode(JSON.stringify(metaDoc(), null, 2));
          var zip = zipStore([
            { name: "cover.png", data: new Uint8Array(bufs[0]) },
            { name: "clip." + ext, data: new Uint8Array(bufs[1]) },
            { name: "metadata.json", data: json }
          ]);
          downloadBlob(zip, "superpepetv-ch" + s.id + "-pack.zip");
          var code = currentCode();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).catch(function () {});
          }
          var status = $("mint_status");
          if (status) status.textContent = "ZIP SAVED. CODE COPIED.";
          SPTV.feedback("PACK SAVED");
          window.open("https://objkt.com/create", "_blank", "noopener");
        });
      });
    });
  }

  function copyCode() {
    var text = ($("code_area") && $("code_area").value) || currentCode();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        SPTV.feedback("COPIED");
      }, function () { SPTV.feedback("COPY BLOCKED"); });
      return;
    }
    SPTV.feedback("COPY BLOCKED");
  }

  function importCode() {
    var text = $("code_area") ? $("code_area").value : "";
    var decoded = decode(text);
    if (!decoded) {
      SPTV.feedback("BAD SPTV1 CODE");
      var status = $("mint_status");
      if (status) status.textContent = "CHECKSUM FAILED";
      return;
    }
    var ok = SPTV.applyImport(decoded);
    var statusOk = $("mint_status");
    if (statusOk) statusOk.textContent = ok ? "IMPORTED" : "CHANNEL OUT OF RANGE";
  }

  function open() {
    refreshCode();
    var panel = $("mint_panel");
    if (panel) panel.classList.remove("hidden");
  }

  function close() {
    var panel = $("mint_panel");
    if (panel) panel.classList.add("hidden");
  }

  function boot() {
    if (typeof document === "undefined" || !document.getElementById) return;
    var snapBtn = $("snap_button");
    if (!snapBtn) return;
    snapBtn.addEventListener("click", function () { snap(); });
    $("mint_snap").addEventListener("click", function () { snap(); });
    $("rec_button").addEventListener("click", function () { rec(); });
    $("mint_rec").addEventListener("click", function () { rec(); });
    $("mint_pack").addEventListener("click", pack);
    $("mint_button").addEventListener("click", open);
    $("mint_close").addEventListener("click", close);
    $("code_copy").addEventListener("click", copyCode);
    $("code_import").addEventListener("click", importCode);
    var q = new URLSearchParams(location.search).get("code");
    if (q) {
      var decoded = decode(q);
      if (decoded) SPTV.applyImport(decoded);
    }
    refreshCode();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }

  return {
    encode: encode,
    decode: decode,
    refreshCode: refreshCode,
    snap: snap,
    rec: rec,
    open: open,
    close: close
  };
})();
