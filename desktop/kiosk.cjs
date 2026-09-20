const { createHash } = require("node:crypto");

function pinHash(pin) {
  return createHash("sha256").update(String(pin).trim()).digest("hex");
}

function assertManagerPin(storedHash, pin) {
  if (!storedHash) return;
  if (typeof pin !== "string" || !/^\d{4,12}$/.test(pin.trim()))
    throw Error("PIN must be 4 to 12 digits");
  if (pinHash(pin) !== storedHash) throw Error("Incorrect PIN");
}

module.exports = { pinHash, assertManagerPin };
