const CONTACT_ENDPOINT =
  "https://vey-contact-form.elevare-app-dev.workers.dev/contact";

const TURNSTILE_SITE_KEY = "0x4AAAAAAEJM9uw-G0dqmsfq";

let turnstileWidgetId = null;
let turnstileToken = "";

const form = document.getElementById("contact-form");
const statusElement = document.getElementById("contact-status");
const submitButton = document.getElementById("contact-submit");

if (form && statusElement && submitButton) {
  initializeTurnstile();
  form.addEventListener("submit", handleSubmit);
}

function initializeTurnstile() {
  if (!window.turnstile) {
    setStatus(
      "The security check could not be loaded. Please refresh the page or contact support@veydarts.com.",
      "error",
    );
    return;
  }

  turnstileWidgetId = window.turnstile.render("#contact-turnstile", {
    sitekey: TURNSTILE_SITE_KEY,
    action: "contact_form",
    theme: "dark",
    size: "flexible",
    appearance: "interaction-only",
    callback(token) {
      turnstileToken = token;
      clearStatusIfSecurityError();
    },
    "expired-callback"() {
      turnstileToken = "";
    },
    "timeout-callback"() {
      turnstileToken = "";
    },
    "error-callback"() {
      turnstileToken = "";
      setStatus(
        "The security check could not be completed. Please try again.",
        "error",
        "security",
      );
    },
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  clearStatus();

  if (!form.reportValidity()) {
    return;
  }

  if (!turnstileToken) {
    setStatus(
      "Please complete the security check before sending your message.",
      "error",
      "security",
    );
    return;
  }

  const formData = new FormData(form);

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    turnstileToken,
  };

  setSubmitting(true);

  try {
    const response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || result?.ok !== true) {
      throw new ContactFormError(result?.code, response.status);
    }

    form.reset();
    resetTurnstile();

    setStatus(
      "Your message has been sent. We will get back to you as soon as possible.",
      "success",
    );
  } catch (error) {
    resetTurnstile();

    const message =
      error instanceof ContactFormError
        ? messageForError(error)
        : "We could not send your message right now. Please try again later or email support@veydarts.com.";

    setStatus(message, "error");
  } finally {
    setSubmitting(false);
  }
}

function resetTurnstile() {
  turnstileToken = "";

  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId);
  }
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.classList.toggle("is-loading", isSubmitting);
  submitButton.setAttribute("aria-busy", String(isSubmitting));
}

function setStatus(message, type, source = "general") {
  statusElement.textContent = message;
  statusElement.dataset.type = type;
  statusElement.dataset.source = source;
  statusElement.hidden = false;
}

function clearStatus() {
  statusElement.textContent = "";
  statusElement.removeAttribute("data-type");
  statusElement.removeAttribute("data-source");
  statusElement.hidden = true;
}

function clearStatusIfSecurityError() {
  if (statusElement.dataset.source === "security") {
    clearStatus();
  }
}

function messageForError(error) {
  switch (error.code) {
    case "invalid_input":
      return "Please check the form fields and try again.";
    case "verification_failed":
      return "The security check could not be verified. Please try again.";
    case "verification_unavailable":
      return "The security check is temporarily unavailable. Please try again shortly.";
    case "rate_limited":
      return "Too many requests were sent in a short time. Please wait a minute and try again.";
    case "daily_limit_reached":
      return "The contact form has reached its temporary daily limit. Please email support@veydarts.com instead.";
    case "payload_too_large":
      return "Your message is too large. Please shorten it and try again.";
    case "delivery_failed":
      return "We could not deliver your message right now. Please try again later or email support@veydarts.com.";
    case "service_unavailable":
      return "The contact form is temporarily unavailable. Please try again later or email support@veydarts.com.";
    default:
      if (error.status === 429) {
        return "Too many requests were sent. Please wait and try again.";
      }

      return "We could not send your message right now. Please try again later or email support@veydarts.com.";
  }
}

class ContactFormError extends Error {
  constructor(code, status) {
    super(code || "contact_form_error");
    this.name = "ContactFormError";
    this.code = code || "unknown";
    this.status = status;
  }
}
