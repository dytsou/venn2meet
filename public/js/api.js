export async function createEvent(payload) {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error((await safeJsonError(response)) ?? "Failed to create event");
  }

  return response.json();
}

export async function fetchGrid(token) {
  const response = await fetch(`/api/events/${token}/grid`);
  if (!response.ok) {
    throw new Error((await safeJsonError(response)) ?? "Failed to fetch grid");
  }
  return response.json();
}

export async function patchAvailability(token, diff) {
  const response = await fetch(`/api/events/${token}/availability`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(diff)
  });

  if (!response.ok) {
    throw new Error((await safeJsonError(response)) ?? "Failed to sync availability");
  }

  return response.json();
}

async function safeJsonError(response) {
  try {
    const body = await response.json();
    return body.error;
  } catch {
    return null;
  }
}
