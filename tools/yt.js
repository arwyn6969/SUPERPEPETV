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
      if (!url) return;
      var id = parseId(url);
      if (!id) {
        window.alert("NEED A YOUTUBE URL");
        return;
      }
      var screen = document.getElementById("screen");
      if (!screen) return;
      if (!frame) {
        frame = document.createElement("iframe");
        frame.title = "YouTube";
        frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
        frame.setAttribute("allowfullscreen", "true");
        frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;z-index:2;background:#000";
        screen.appendChild(frame);
      }
      frame.style.display = "block";
      frame.src = "https://www.youtube.com/embed/" + id + "?autoplay=1";
    },
    exit: function () {
      if (!frame) return;
      frame.src = "about:blank";
      frame.style.display = "none";
    }
  };
})();
