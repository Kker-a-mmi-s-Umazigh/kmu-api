import validator from "validator";

const URL_OPTIONS = {
  require_protocol: true,
  protocols: ["http", "https"],
};

export const normalizeOptionalUrl = (value, fieldName) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    const error = new Error(`Invalid URL for ${fieldName}`);
    error.code = "INVALID_URL";
    throw error;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (!validator.isURL(trimmed, URL_OPTIONS)) {
    const error = new Error(`Invalid URL for ${fieldName}`);
    error.code = "INVALID_URL";
    throw error;
  }

  return trimmed;
};
