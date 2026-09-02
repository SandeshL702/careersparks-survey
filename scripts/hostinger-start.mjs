/**
 * Hostinger Node.js Web App entry.
 * hPanel start command: `npm start`
 */
process.env.NITRO_PORT = process.env.NITRO_PORT || process.env.PORT || "3000";
process.env.NITRO_HOST = process.env.NITRO_HOST || process.env.HOST || "0.0.0.0";
await import("../.output/server/index.mjs");
