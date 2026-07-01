/**
 * Simple in-memory retry queue with exponential backoff
 * Processes jobs sequentially with max 3 retries per job
 * Backoff schedule: 5s, 15s, 45s
 */

class RetryQueue {
  constructor() {
    this.jobs = [];
    this.processing = false;
  }

  add(job) {
    if (typeof job !== 'function') {
      throw new Error('Job must be a function');
    }
    this.jobs.push({
      execute: job,
      retries: 0,
      maxRetries: 3
    });
    this.process();
  }

  async process() {
    if (this.processing || this.jobs.length === 0) {
      return;
    }

    this.processing = true;

    while (this.jobs.length > 0) {
      const jobWrapper = this.jobs[0];
      const { execute, retries, maxRetries } = jobWrapper;

      try {
        await execute();
        this.jobs.shift(); // Remove on success
      } catch (error) {
        if (retries < maxRetries) {
          jobWrapper.retries += 1;
          const delays = [5000, 15000, 45000]; // 5s, 15s, 45s
          const delay = delays[retries];

          console.log(
            `[RetryQueue] Job failed (attempt ${retries + 1}/${maxRetries}). Retrying in ${delay}ms...`
          );
          console.error(`[RetryQueue] Error: ${error.message}`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Max retries exceeded
          console.error(
            `[RetryQueue] Job failed after ${maxRetries} retries. Giving up.`
          );
          console.error(`[RetryQueue] Final error: ${error.message}`);
          console.error(`[RetryQueue] Job context: ${error.stack}`);
          this.jobs.shift();
        }
      }
    }

    this.processing = false;
  }
}

module.exports = new RetryQueue();
