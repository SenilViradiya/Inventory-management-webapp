const cron = require('node-cron');
const { runExpiryCheck } = require('./expiryService');
const PreAggregationService = require('./preAggregationService');

// Simple in-memory status tracking. For production use, persist status in DB.
const status = {
  lastRun: null,
  lastDurationMs: null,
  lastError: null,
  running: false
};

async function executeExpiryJob(options = { retries: 2, backoffMs: 2000 }) {
  if (status.running) return status;
  status.running = true;
  status.lastError = null;
  const start = Date.now();

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      await runExpiryCheck();
      status.lastRun = new Date();
      status.lastDurationMs = Date.now() - start;
      status.running = false;
      return status;
    } catch (err) {
      status.lastError = err.message || String(err);
      if (attempt < options.retries) {
        await new Promise(r => setTimeout(r, options.backoffMs));
      } else {
        status.running = false;
        throw err;
      }
    }
  }
}

function scheduleDaily(cronExpression = '0 2 * * *') {
  // default: run at 02:00 every day
  const expiryJob = cron.schedule(cronExpression, () => {
    executeExpiryJob().catch(err => console.error('Scheduled expiry job failed:', err));
  }, { scheduled: true });

  // Schedule pre-aggregation at 03:00 daily
  const aggregationJob = cron.schedule('0 3 * * *', () => {
    PreAggregationService.generateDailySnapshot(new Date(Date.now() - 24 * 60 * 60 * 1000))
      .then(() => console.log('Daily analytics snapshot generated'))
      .catch(err => console.error('Daily aggregation failed:', err));
  }, { scheduled: true });

  return { expiryJob, aggregationJob };
}

function getStatus() {
  return status;
}

module.exports = { executeExpiryJob, scheduleDaily, getStatus };
