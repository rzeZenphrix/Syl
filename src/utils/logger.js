// Logger utility for moderation events
const fs = require('fs');
const path = require('path');
const logFile = path.resolve(__dirname, '../../logs.txt');

function logEvent(event) {
  const line = `[${new Date().toISOString()}] ${event}\n`;
  fs.appendFileSync(logFile, line);
}

module.exports = { logEvent };
