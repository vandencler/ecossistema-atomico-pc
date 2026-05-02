
/**
 * Simple Throttler to limit concurrent executions and manage a waiting queue.
 * Used to protect the ERP mirror from saturation.
 */
class Throttler {
  constructor(name, maxConcurrent, maxQueue) {
    this.name = name;
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
    this.running = 0;
    this.queue = [];
    this.totalThrottled = 0;
    this.totalRejected = 0;
  }

  async run(fn) {
    if (this.running >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        this.totalRejected++;
        const err = new Error(`THROTTLE_REJECTED: ${this.name} queue is full (${this.maxQueue})`);
        err.code = 'THROTTLE_REJECTED';
        throw err;
      }

      this.totalThrottled++;
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject, started: Date.now() });
      });
    }

    return this._execute(fn);
  }

  async _execute(fn) {
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this._next();
    }
  }

  _next() {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      // Check if the item in queue hasn't timed out? 
      // For now, just run it.
      this._execute(next.fn).then(next.resolve).catch(next.reject);
    }
  }

  getStats() {
    return {
      name: this.name,
      running: this.running,
      queued: this.queue.length,
      totalThrottled: this.totalThrottled,
      totalRejected: this.totalRejected
    };
  }
}

module.exports = Throttler;
