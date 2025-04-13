const config = require('./config.js');
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
let currentUsers = 0;
let authSuccesses = 0;
let pizzas = 0;
let failures = 0;
let authFailures = 0;
let revenue = 0.0;

// Middleware to track request metrics
function requestTracker(req, res, next) {
  const start = process.hrtime(); // Start time for latency calculation

  res.on('finish', () => {
    const end = process.hrtime(start); // End time for latency
    const latencyMs = (end[0] * 1000) + (end[1] / 1e6); // Convert to milliseconds
    totalLatency += latencyMs;

    requestCounts[req.method] = (requestCounts[req.method] || 0) + 1;
    requestCounts.TOTAL++;
    if (req.path.includes('/login')) currentUsers++;
    if (req.path.includes('/logout')) currentUsers = Math.max(0, currentUsers - 1);
  });

  next();
}

// // Periodically send metrics to Grafana
// setInterval(() => {
//   sendMetricToGrafana('requests', requestCounts.TOTAL, 'sum', '1');
//   sendMetricToGrafana('latency', totalLatency, 'sum', 'ms');
//   sendMetricToGrafana('cpu', getCpuUsagePercentage(), 'gauge', '%');
//   sendMetricToGrafana('memory', getMemoryUsagePercentage(), 'gauge', '%');
// }, 10000); // Sends metrics every 10 seconds

let metricsInterval;
function startMetrics() {
  if (!metricsInterval) {
    metricsInterval = setInterval(() => {
      sendMetricToGrafana('requests', requestCounts.TOTAL, 'sum', '1');
      sendMetricToGrafana('Get requests', requestCounts.GET, 'sum', '1');
      sendMetricToGrafana('Post requests', requestCounts.POST, 'sum', '1');
      sendMetricToGrafana('PUT requests', requestCounts.PUT, 'sum', '1');
      sendMetricToGrafana('Delete requests', requestCounts.DELETE, 'sum', '1');
      sendMetricToGrafana('latency', totalLatency, 'sum', 'ms');
      sendMetricToGrafana('cpu', getCpuUsagePercentage(), 'gauge', '%');
      sendMetricToGrafana('memory', getMemoryUsagePercentage(), 'gauge', '%');
      sendMetricToGrafana('current_users', currentUsers, 'gauge', 'count');
      sendMetricToGrafana('auth_successes', authSuccesses, 'sum', 'count');
      sendMetricToGrafana('pizzas_per_minute', pizzas, 'sum', 'count');
      sendMetricToGrafana('pizza_failures', failures, 'sum', 'count');
      sendMetricToGrafana('authFailures', authFailures, 'sum', 'count');
      sendMetricToGrafana('revenue_per_minute', revenue, 'sum', 'count');
      authSuccesses = 0;
      pizzas = 0;
      failures = 0;
      authFailures = 0;
      requestCounts.GET = 0;
      requestCounts.POST = 0;
      requestCounts.Put = 0;
      requestCounts.DELETE = 0;
      requestCounts.TOTAL = 0;
      revenue = 0.0;
      totalLatency = 0;
    }, 100000);
  }
}

function stopMetrics() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
      }
    
}

function incrementSuccesses() {
  authSuccesses++;
}

function incrementPizzas() {
  pizzas++;
}

function incrementAuthFailures() {
  authFailures++;
}

function incrementFailures() {
  failures++;
}

function incrementRevenue(value) {
  revenue = revenue + value;
}

function incrementUsers() {
  currentUsers++;
}

function decrementUsers() {
  currentUsers = Math.max(currentUsers - 1, 0);
}

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
                        asDouble: parseFloat(metricValue),
                        timeUnixNano: Date.now() * 1000000,
                        "attributes": [
                            {
                               "key": "source",
                               "value": { "stringValue": "jwt-pizza-service" }
                            }
                         ]
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

module.exports = { requestTracker, startMetrics, stopMetrics, incrementSuccesses, incrementPizzas, incrementFailures, incrementAuthFailures, incrementRevenue, incrementUsers, decrementUsers };