const TOKEN_BYTES = 16;

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes)
    .map((n) => String.fromCharCode(n))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generatePublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return toBase64Url(bytes);
}

export function generateParticipantId(): string {
  return crypto.randomUUID();
}
