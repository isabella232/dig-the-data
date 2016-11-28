'use strict';

class Logger {
  constructor() {
    this.level = 0;
  }

  debug(...args) {
    if (this.level <= 0) console.log(...args);
  }

  info(...args) {
    if (this.level <= 1) console.log(...args);
  }

  warn(...args) {
    if (this.level <= 2) console.log(...args);
  }

  error(...args) {
    if (this.level <= 3) console.error(...args);
  }
}

module.exports = new Logger();
