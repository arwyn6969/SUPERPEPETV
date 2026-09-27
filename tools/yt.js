/* Hosted worker only. npm run zip does not ship this file.
   Loaded by tools/worker.js on the Cloudflare host. */
(function () {
  window.SPTV_HOSTED = true;

  function parseId(url) {
    var m = String(url || "").match(/(?:youtu\.be\/|(?:v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  var frame = null;

  window.SPTVYouTube = {
    enter: function () {
      var url = window.prompt("PASTE A YOUTUBE URL");
      if (!url) return false;
      var id = parseId(url);
      if (!id) {
        window.alert("NEED A YOUTUBE URL");
        return false;
      }
      var screen = document.getElementById("screen");
      if (!screen) return false;
      if (!frame) {
        frame = document.createElement("iframe");
        frame.id = "ytframe";
        frame.title = "YouTube";
        frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
        frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;z-index:0;background:#000;pointer-events:auto";
        screen.insertBefore(frame, screen.firstChild);
      }
      frame.style.display = "block";
      frame.src = "https://www.youtube.com/embed/" + id + "?autoplay=1&playsinline=1&rel=0&modestbranding=1";
      return true;
    },
    look: function (opt) {
      if (!frame || frame.style.display === "none") return;
      opt = opt || {};
      var shift = Math.sin((opt.t || 0) * 2.4) * (opt.wave || 0) * 10;
      var gl = (opt.glitch || 0) > 0.18 ? Math.sin((opt.t || 0) * 13) * opt.glitch * 14 : 0;
      frame.style.filter = opt.filter && opt.filter !== "none" ? opt.filter : "none";
      frame.style.transform = "translate(" + (((opt.shakeX || 0) + shift + gl).toFixed(1)) + "px," + ((opt.shakeY || 0).toFixed(1)) + "px)";
    },
    exit: function () {
      if (!frame) return;
      frame.src = "about:blank";
      frame.style.display = "none";
      frame.style.filter = "none";
      frame.style.transform = "none";
    }
  };
})();
