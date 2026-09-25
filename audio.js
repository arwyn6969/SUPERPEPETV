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
  var elementNode = null;
  var elementGain = null;
  var prevBass = 0;
  var lastOnset = 0;
  var zeros = { rms: 0, bass: 0, mid: 0, high: 0, onset: 0 };

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
    master.gain.value = 0.9;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    freq = new Uint8Array(analyser.frequencyBinCount);
    master.connect(analyser);
    analyser.connect(ctx.destination);
    recNode = ctx.createMediaStreamDestination();
    master.connect(recNode);

    var o1 = ctx.createOscillator();
    var o2 = ctx.createOscillator();
    o1.type = "triangle";
    o2.type = "square";
    o1.frequency.value = 55;
    o2.frequency.value = 82.5;
    genGain = ctx.createGain();
    genGain.gain.value = 0.07;
    o1.connect(genGain);
    o2.connect(genGain);
    genGain.connect(master);
    o1.start();
    o2.start();

    var lfo = ctx.createOscillator();
    var lfoGain = ctx.createGain();
    lfo.frequency.value = 0.55;
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain);
    lfoGain.connect(o1.frequency);
    lfo.start();

    var buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3200;
    var ng = ctx.createGain();
    ng.gain.value = 0.012;
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(genGain);
    noise.start();
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    var p = ctx.resume();
    if (p && p.catch) p.catch(function () {});
  }

  function setGen(on) {
    if (!genGain) return;
    genGain.gain.value = on ? 0.07 : 0;
  }

  function setMuted(muted) {
    if (!master) return;
    master.gain.value = muted ? 0 : 0.9;
  }

  function attachStream(stream) {
    if (!ensure()) return;
    unlock();
    if (streamNode) {
      try { streamNode.disconnect(); } catch (err) {}
    }
    try {
      streamNode = ctx.createMediaStreamSource(stream);
      streamNode.connect(master);
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
    if (!elementNode) {
      try {
        elementGain = ctx.createGain();
        elementNode = ctx.createMediaElementSource(el);
        elementNode.connect(elementGain);
        elementGain.connect(master);
      } catch (err) {
        elementNode = null;
      }
    }
    if (elementGain) elementGain.gain.value = 1;
    setGen(false);
  }

  function useGen() {
    if (streamNode) {
      try { streamNode.disconnect(); } catch (err) {}
      streamNode = null;
    }
    if (elementGain) elementGain.gain.value = 0;
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
    attachStream: attachStream,
    attachElement: attachElement,
    setMuted: setMuted,
    recordStream: recordStream
  };
})();
