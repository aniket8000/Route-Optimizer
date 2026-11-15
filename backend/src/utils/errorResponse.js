// the raw error message is handy while developing, but in production it can leak
// internals (upstream urls, db errors) - render sets NODE_ENV=production for us
export function errorResponse(message, err) {
  if (process.env.NODE_ENV === "production") return { error: message };
  return { error: message, details: err.message };
}
