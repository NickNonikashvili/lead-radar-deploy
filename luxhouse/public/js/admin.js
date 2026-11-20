/* Luxhouse — enquiry inbox actions. */
(function () {
  "use strict";

  function call(method, id, body) {
    return fetch("/admin/api/inquiries/" + encodeURIComponent(id), {
      method: method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      if (!res.ok) throw new Error("Request failed (" + res.status + ")");
      return res.json();
    });
  }

  document.querySelectorAll("[data-lead]").forEach(function (card) {
    var id = card.getAttribute("data-lead");
    var state = card.querySelector("[data-state]");
    var select = card.querySelector("[data-status-select]");
    var notes = card.querySelector("[data-notes]");

    function show(message, isError) {
      state.textContent = message;
      state.classList.toggle("is-error", Boolean(isError));
    }

    function save() {
      show("Saving…");
      call("PATCH", id, { status: select.value, notes: notes.value })
        .then(function (res) {
          card.setAttribute("data-status", res.item.status);
          show("Saved");
        })
        .catch(function (err) { show(err.message, true); });
    }

    card.querySelector("[data-save-lead]").addEventListener("click", save);
    select.addEventListener("change", save);

    card.querySelector("[data-delete-lead]").addEventListener("click", function () {
      if (!window.confirm("Delete this enquiry permanently?")) return;
      show("Deleting…");
      call("DELETE", id)
        .then(function () { card.remove(); })
        .catch(function (err) { show(err.message, true); });
    });
  });
})();
