/* ================================================================== */
/* ============ EARLY THEME APPLICATION (no flash of wrong theme) ==== */
/* ================================================================== */
/* Applies the saved theme before first paint. Light is the default;
   dark is opt-in, so this only ever ADDS 'dark-mode' — it never removes
   it, since removing a class that isn't there is a no-op anyway and
   "light" needs no class at all.

   This is a separate external file (rather than an inline <script>
   block back in index.html) so it loads as early as possible in <head>
   and runs before the page's visible content paints — preserving "no
   flash of wrong theme" regardless of load order elsewhere. (This
   project briefly had a Content-Security-Policy that required external
   script files for this exact reason; the CSP itself has since been
   removed, but keeping this as its own file is still good practice
   either way.) */
(function () {
  try {
    var t = localStorage.getItem('meram_theme');
    if (t === 'dark') document.documentElement.classList.add('dark-mode');
  } catch (e) { }
})();
