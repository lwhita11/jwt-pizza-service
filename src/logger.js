const config = require('./config.js');
const fetch = require('node-fetch');

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  log(level, type, logData) {
    const labels = {
      component: config.logging.source,
      level: level,
      type: type,
    };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString(); // nanosecond precision
  }

  sanitize(logData) {
    let str = typeof logData === 'string' ? logData : JSON.stringify(logData);
    return str.replace(/"password"\s*:\s*"[^"]*"/gi, '"password": "*****"');
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(config.logging.url, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) {
        res.text().then((text) => {
          console.error('Failed to send log to Grafana:', text);
        });
      }
    }).catch(err => {
      console.error('Error sending log to Grafana:', err);
    });
  }
}

module.exports = new Logger();
