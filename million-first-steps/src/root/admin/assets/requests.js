/* Requests module (request page): quick follow-up dates and Ctrl/⌘+Enter to add a note.
   [data-date-target="#input"] holds buttons with data-date="Y-m-d" ("" clears); they fill the date field. */
(function () {
  'use strict';
  var d = document;

  d.querySelectorAll('[data-date-target]').forEach(function (box) {
    var input = d.querySelector(box.getAttribute('data-date-target'));
    if (!input) return;
    var buttons = box.querySelectorAll('[data-date]');
    function mark() {
      buttons.forEach(function (b) {
        var on = input.value !== '' && b.getAttribute('data-date') === input.value;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    box.hidden = false;
    mark();
    box.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-date]') : null;
      if (!b) return;
      e.preventDefault();
      input.value = b.getAttribute('data-date') || '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      mark();
    });
    input.addEventListener('input', mark);
    input.addEventListener('change', mark);
  });

  var note = d.getElementById('note-body');
  if (note && note.form) {
    note.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && note.value.trim() !== '') {
        e.preventDefault();
        if (note.form.requestSubmit) note.form.requestSubmit(); else note.form.submit();
      }
    });
  }
})();
