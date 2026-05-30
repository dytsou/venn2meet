import { createEvent } from "./api.js";

const defaultStart = new Date();
defaultStart.setUTCHours(8, 0, 0, 0);

const defaultEnd = new Date(defaultStart.getTime() + 24 * 60 * 60 * 1000);

function toInputValue(date) {
  return date.toISOString().slice(0, 16);
}

function bindDefaultValues(form) {
  const startInput = form.querySelector("[name=startIso]");
  const endInput = form.querySelector("[name=endIso]");
  const timezoneInput = form.querySelector("[name=timezone]");

  if (startInput && !startInput.value) {
    startInput.value = toInputValue(defaultStart);
  }

  if (endInput && !endInput.value) {
    endInput.value = toInputValue(defaultEnd);
  }

  if (timezoneInput && !timezoneInput.value) {
    timezoneInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
}

function readForm(form) {
  const data = new FormData(form);
  return {
    title: String(data.get("title") || "").trim(),
    timezone: String(data.get("timezone") || "UTC").trim(),
    startIso: new Date(String(data.get("startIso"))).toISOString(),
    endIso: new Date(String(data.get("endIso"))).toISOString(),
    granularityMinutes: Number(data.get("granularityMinutes"))
  };
}

export function mountCreateForm() {
  const form = document.querySelector("#create-event-form");
  const errorEl = document.querySelector("#create-error");
  if (!(form instanceof HTMLFormElement) || !(errorEl instanceof HTMLElement)) {
    return;
  }

  bindDefaultValues(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";

    const submit = form.querySelector("button[type=submit]");
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = true;
    }

    try {
      const payload = readForm(form);
      const result = await createEvent(payload);
      window.location.assign(result.url);
    } catch (error) {
      errorEl.textContent = (error instanceof Error ? error.message : "Unable to create event");
      if (submit instanceof HTMLButtonElement) {
        submit.disabled = false;
      }
    }
  });
}
