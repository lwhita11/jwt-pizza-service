const config = require('./config');
const fetch = require('node-fetch');
const os = require('os');

let requestCounts = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
  TOTAL: 0,
};

let totalLatency = 0;

// Middleware to track request metrics
function requestTracker(req, res, next) {
  const start = process.hrtime(); // Start time for latency calculation

  res.on('finish', () => {
    const end = process.hrtime(start); // End time for latency
    const latencyMs = (end[0] * 1000) + (end[1] / 1e6); // Convert to milliseconds
    totalLatency += latencyMs;

    requestCounts[req.method] = (requestCounts[req.method] || 0) + 1;
    requestCounts.TOTAL++;
  });

  next();
}

// Periodically send metrics to Grafana
setInterval(() => {
  sendMetricToGrafana('requests', requestCounts.TOTAL, 'sum', '1');
  sendMetricToGrafana('latency', totalLatency, 'sum', 'ms');
  sendMetricToGrafana('cpu', getCpuUsagePercentage(), 'gauge', '%');
  sendMetricToGrafana('memory', getMemoryUsagePercentage(), 'gauge', '%');
}, 10000); // Sends metrics every 10 seconds

// Function to send metrics to Grafana
function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
  }

  const body = JSON.stringify(metric);
  fetch(`${config.metrics.url}`, {
    method: 'POST',
    body: body,
    headers: { Authorization: `Bearer ${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
        });
      } else {
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

// Get CPU and memory usage
function getCpuUsagePercentage() {
  return ((os.loadavg()[0] / os.cpus().length) * 100).toFixed(2);
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  return (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2);
}

module.exports = { requestTracker };