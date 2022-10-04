'use-strict';

function formatEnvToCliString(env) {
  let envString = '';
  Object.entries(env).forEach(([key, value]) => {
    envString += `${key}=${value}\n`;
  });
  return envString;
}

module.exports = { formatEnvToCliString };
