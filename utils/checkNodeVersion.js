'use-strict';

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');

function checkNodeVersion(packageName) {
  const packageJsonPath = path.resolve(
    process.cwd(),
    'node_modules',
    packageName,
    'package.json',
  );

  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const packageJson = require(packageJsonPath);
  if (!packageJson.engines || !packageJson.engines.node) {
    return;
  }

  if (!semver.satisfies(process.version, packageJson.engines.node)) {
    console.error(
      chalk.red(
        'You are running Node %s.\n'
          + 'Create Juno Dev Env requires Node %s or higher. \n'
          + 'Please update your version of Node.',
      ),
      process.version,
      packageJson.engines.node,
    );
    process.exit(1);
  }
}

module.exports = { checkNodeVersion };
