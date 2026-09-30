// Node's default for an unhandled promise rejection is to exit the whole
// process — one stray rejected promise from any request would take the site
// down for every visitor. Log it and keep serving instead.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

export {};
