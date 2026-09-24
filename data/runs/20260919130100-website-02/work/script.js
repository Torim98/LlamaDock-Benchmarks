/* ===== Nachtfalter – Kontaktformular ===== */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  var thanks = document.getElementById("form-thanks");
  var thanksTitle = document.getElementById("thanks-title");
  var nameInput = document.getElementById("name");

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var fields = [
    {
      input: nameInput,
      error: document.getElementById("name-error"),
      message: "Bitte gib deinen Namen ein.",
      isValid: function (value) {
        return value.trim().length > 0;
      }
    },
    {
      input: document.getElementById("email"),
      error: document.getElementById("email-error"),
      message: "Bitte gib eine gültige E-Mail-Adresse ein, z. B. du@beispiel.de.",
      isValid: function (value) {
        return emailPattern.test(value.trim());
      }
    },
    {
      input: document.getElementById("message"),
      error: document.getElementById("message-error"),
      message: "Bitte gib eine kurze Nachricht ein.",
      isValid: function (value) {
        return value.trim().length > 0;
      }
    }
  ];

  function renderError(field, showError) {
    if (showError) {
      field.error.textContent = field.message;
      field.error.hidden = false;
      field.input.setAttribute("aria-invalid", "true");
    } else {
      field.error.hidden = true;
      field.error.textContent = "";
      field.input.removeAttribute("aria-invalid");
    }
  }

  /* Fehlermeldung verschwindet, sobald der Benutzer wieder tippt */
  fields.forEach(function (field) {
    field.input.addEventListener("input", function () {
      if (!field.error.hidden) {
        renderError(field, false);
      }
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault(); /* kein Neuladen der Seite */

    var allValid = true;

    fields.forEach(function (field) {
      var valid = field.isValid(field.input.value);
      renderError(field, !valid);
      if (!valid) {
        allValid = false;
      }
    });

    if (allValid) {
      thanksTitle.textContent = "Vielen Dank, " + nameInput.value.trim() + "!";
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
    }
  });
})();
