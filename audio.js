/* SUPERPEPE TV — one analyser for GEN drone, mic, camera, or a dropped file.
   Levels: rms, bass, mid, high, and a one-frame onset pulse. */

var SPTVAudio = (function () {
  var ctx = null;
  var master = null;
  var analyser = null;
  var freq = null;
  var genGain = null;
  var recNode = null;
  var streamNode = null;
  var elementGain = { VIDEO: null, AUDIO: null };
  var elementNode = { VIDEO: null, AUDIO: null };
  var prevBass = 0;
  var lastOnset = 0;
  var zeros = { rms: 0, bass: 0, mid: 0, high: 0, onset: 0 };

  var wantMute = false;

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch (err) {
      return false;
    }
    master = ctx.createGain();
    master.gain.value = wantMute ? 0 : 0.8;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    freq = new Uint8Array(analyser.frequencyBinCount);
    master.connect(analyser);
    master.connect(ctx.destination);
    var silent = ctx.createGain();
    silent.gain.value = 0;
    analyser.connect(silent);
    silent.connect(ctx.destination);
    recNode = ctx.createMediaStreamDestination();
    master.connect(recNode);

    var tone = ctx.createOscillator();
    tone.type = "sine";
    tone.frequency.value = 73;
    genGain = ctx.createGain();
    genGain.gain.value = 0;
    tone.connect(genGain);
    genGain.connect(master);
    tone.start();
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    var p = ctx.resume();
    if (p && p.catch) p.catch(function () {});
  }

  function setGen(on) {
    if (!genGain) return;
    genGain.gain.value = on ? 0.03 : 0;
  }

  function setMuted(muted) {
    wantMute = !!muted;
    if (!master) return;
    master.gain.value = wantMute ? 0 : 0.8;
  }

  function silenceElements() {
    if (elementGain.VIDEO) elementGain.VIDEO.gain.value = 0;
    if (elementGain.AUDIO) elementGain.AUDIO.gain.value = 0;
  }

  function attachStream(stream) {
    if (!ensure()) return;
    unlock();
    if (streamNode) {
      try { streamNode.disconnect(); } catch (err) {}
    }
    silenceElements();
    try {
      streamNode = ctx.createMediaStreamSource(stream);
      streamNode.connect(analyser);
      setGen(false);
    } catch (err) {
      setGen(true);
    }
  }

  function attachElement(el) {
    if (!ensure() || !el) return;
    unlock();
    if (streamNode) {
      try { streamNode.disconnect(); } catch (err) {}
      streamNode = null;
    }
    el.muted = false;
    var key = el.tagName === "VIDEO" ? "VIDEO" : "AUDIO";
    if (!elementNode[key]) {
      try {
        elementGain[key] = ctx.createGain();
        elementGain[key].gain.value = 0;
        elementNode[key] = ctx.createMediaElementSource(el);
        elementNode[key].connect(elementGain[key]);
        elementGain[key].connect(master);
      } catch (err) {
        elementNode[key] = null;
      }
    }
    silenceElements();
    if (elementGain[key]) elementGain[key].gain.value = 1;
    setGen(false);
  }

  function duck() {
    if (streamNode) {
      try { streamNode.disconnect(); } catch (err) {}
      streamNode = null;
    }
    silenceElements();
    setGen(false);
  }

  function useGen() {
    if (streamNode) {
      try { streamNode.disconnect(); } catch (err) {}
      streamNode = null;
    }
    silenceElements();
    setGen(true);
  }

  function band(a, b) {
    var n = analyser.frequencyBinCount;
    var i0 = Math.max(0, a | 0);
    var i1 = Math.min(n, b | 0);
    var acc = 0;
    var count = 0;
    for (var i = i0; i < i1; i++) {
      acc += freq[i];
      count++;
    }
    return count ? acc / count / 255 : 0;
  }

  function levels() {
    if (!analyser || !ctx || ctx.state !== "running") return zeros;
    analyser.getByteFrequencyData(freq);
    var bass = band(1, 8);
    var mid = band(8, 40);
    var high = band(40, 140);
    var rms = bass * 0.5 + mid * 0.35 + high * 0.15;
    var flux = bass - prevBass;
    prevBass = prevBass * 0.85 + bass * 0.15;
    var now = performance.now();
    var onset = 0;
    if (flux > 0.08 && now - lastOnset > 160) {
      lastOnset = now;
      onset = Math.max(0, Math.min(1, flux * 5));
    }
    return { rms: rms, bass: bass, mid: mid, high: high, onset: onset };
  }

  function recordStream() {
    if (!recNode) return null;
    return recNode.stream;
  }

  return {
    unlock: unlock,
    levels: levels,
    useGen: useGen,
    duck: duck,
    attachStream: attachStream,
    attachElement: attachElement,
    setMuted: setMuted,
    recordStream: recordStream
  };
})();
