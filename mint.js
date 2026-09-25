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

  function snap() {
    var view = SPTV.view();
    if (!view) return;
    var s = SPTV.getState();
    view.toBlob(function (blob) {
      if (!blob) return;
      downloadBlob(blob, "superpepetv-ch" + s.id + ".png");
      SPTV.feedback("SNAP PNG");
    }, "image/png");
  }

  function metadata() {
    var s = SPTV.getState();
    var code = currentCode();
    var doc = {
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
    var blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    downloadBlob(blob, "superpepetv-ch" + s.id + ".json");
    SPTV.feedback("METADATA JSON");
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

  function rec() {
    if (recorder) return;
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
    var mime = pickMime();
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
      recorder = null;
      SPTV.feedback("REC FAILED");
      return;
    }
    var chunks = [];
    recorder.ondataavailable = function (ev) {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    recorder.onstop = function () {
      var type = recorder.mimeType || mime || "video/webm";
      var ext = type.indexOf("mp4") >= 0 ? "mp4" : "webm";
      var blob = new Blob(chunks, { type: type });
      var s = SPTV.getState();
      downloadBlob(blob, "superpepetv-ch" + s.id + "-rec." + ext);
      SPTV.feedback("REC SAVED");
      recorder = null;
      var status = $("record_status");
      if (status) status.textContent = "SAVED";
    };
    recorder.start();
    var left = 8;
    var status = $("record_status");
    if (status) status.textContent = "REC " + left;
    SPTV.feedback("REC 8s");
    var timer = setInterval(function () {
      left -= 1;
      if (status) status.textContent = left > 0 ? "REC " + left : "SAVING";
      if (left <= 0) {
        clearInterval(timer);
        if (recorder && recorder.state === "recording") recorder.stop();
      }
    }, 1000);
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
    snapBtn.addEventListener("click", snap);
    $("mint_snap").addEventListener("click", snap);
    $("rec_button").addEventListener("click", rec);
    $("mint_rec").addEventListener("click", rec);
    $("mint_button").addEventListener("click", open);
    $("mint_close").addEventListener("click", close);
    $("meta_button").addEventListener("click", metadata);
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
