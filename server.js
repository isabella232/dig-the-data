'use strict';

const config = require('./lib/config'),
  app = require('./lib/app');

app.listen(config.port, config.ip, () => {
  console.log(`Listening on port ${config.port}!`);
});
