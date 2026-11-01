/* MathJax settings for the static study-guide pages (learn/*). A file instead of an inline script, so those pages can
   forbid inline scripts in their Content-Security-Policy. MathJax itself loads next, StudyCat's own copy of 3.2.2
   (assets/vendor/mathjax); if that cannot be had, jsDelivr's. */
addEventListener('error', function (e) {
  var t = e.target; if (!t || t.id !== 'MathJax-script' || window.__mjCdn) return; window.__mjCdn = 1;
  var c = document.createElement('script'); c.async = true; c.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js'; document.head.appendChild(c);
}, true);
window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']], processEscapes: true }, svg: { fontCache: 'global' }, options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] } };
