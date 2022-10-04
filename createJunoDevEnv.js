'use-strict';

const { copyFile, constants, unlink } = require('node:fs');
const chalk = require('chalk');
const commander = require('commander');
const envinfo = require('envinfo');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const process = require('process');
const semver = require('semver');
const spawn = require('cross-spawn');
const { checkForLatestVersion } = require('./utils/checkForLatestVersion');
const { checkIfOnline } = require('./utils/checkIfOnline');
const { checkNpmVersion } = require('./utils/checkNpmVersion');
const { checkSetupVariables } = require('./utils/checkSetupVariables');
const { checkThatNpmCanReadCwd } = require('./utils/checkThatNpmCanReadCwd');
const { checkYarnVersion } = require('./utils/checkYarnVersion');
const { formatEnvToCliString } = require('./utils/formatEnvToCliString');

const packageJson = require('./package.json');

function isUsingYarn() {
  return (process.env.npm_config_user_agent || '').indexOf('yarn') === 0;
}

const projectGitURLFork = 'https://github.com/Elysium-Labs-EU/juno-core/fork';

function install({
  forkedRoot, yarnOrNPM, verbose, isOnline,
}) {
  return new Promise((resolve, reject) => {
    let command;
    let args;
    if (yarnOrNPM === 'yarn') {
      unlink('package-lock.json', (err) => {
        if (err) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
          // Silently fail when not able to find the file
          return;
        }
        console.log('package-lock.json was deleted');
      });
      command = 'yarnpkg';
      args = ['--exact'];
      if (!isOnline) {
        args.push('--offline');
      }
      //   if (usePnp) {
      //     args.push('--enable-pnp');
      //   }
      [].push.apply(args);

      // Explicitly set cwd() to work around issues like
      // https://github.com/facebook/create-react-app/issues/3326.
      // Unfortunately we can only do this for Yarn because npm support for
      // equivalent --prefix flag doesn't help with this issue.
      // This is why for npm, we run checkThatNpmCanReadCwd() early instead.
      args.push('--cwd');
      args.push(forkedRoot);

      if (!isOnline) {
        console.log(chalk.yellow('You appear to be offline.'));
        console.log(chalk.yellow('Falling back to the local Yarn cache.'));
        console.log();
      }
    } else {
      // To ensure we are in the correct directory, change it here.
      process.chdir(forkedRoot);
      unlink('yarn.lock', (err) => {
        if (err) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
          // Silently fail when not able to find the file
          return;
        }
        console.log('yarn.lock was deleted');
      });
      command = 'npm';
      args = [
        'install',
        '--no-audit', // https://github.com/facebook/create-react-app/issues/11174
        '--save',
        '--legacy-peer-deps', // For now we support legacy dependencies
        // '--save-exact',
        '--loglevel',
        'error',
      ];

      //   if (usePnp) {
      //     console.log(chalk.yellow("NPM doesn't support PnP."));
      //     console.log(chalk.yellow('Falling back to the regular installs.'));
      //     console.log();
      //   }
    }

    if (verbose) {
      args.push('--verbose');
    }

    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code !== 0) {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({
          command: `${command} ${args.join(' ')}`,
        });
        return;
      }
      resolve();
    });
  });
}

async function run({
  forkedRoot, version, verbose, yarnOrNPM,
}) {
  const isOnline = await checkIfOnline(yarnOrNPM);
  console.log('Installing packages. This might take a couple of minutes.');
  install({
    forkedRoot,
    yarnOrNPM,
    packageJson,
    verbose,
    isOnline,
  }).then(() => {
    if (version === 'cloud') {
      const cloudEnv = {
        VITE_BACKEND_URL: 'https://juno-backend-service-dev.herokuapp.com',
        VITE_USE_LOCAL_FRONTEND_CLOUD_BACKEND: true,
      };
      fs.writeFileSync(
        path.join(forkedRoot, '.env'),
        formatEnvToCliString(cloudEnv),
      );
    } else {
      const callback = (err) => {
        if (err) {
          throw err;
        }
        console.log('.env.example was copied to .env');
      };
      copyFile('.env.example', '.env', constants.COPYFILE_FICLONE, callback);
    }
    console.log('Done setting up Juno dev environment');
  });
}

async function createEnv(verbose) {
  const root = path.resolve();

  try {
    const response = await checkSetupVariables();
    if (!response.userHasForked) {
      console.log(
        `Please fork the repository first and restart the installer - ${chalk.green(
          projectGitURLFork,
        )} .`,
      );
      process.exit(1);
    }

    // Cancel the installation flow if something is missing in the response.
    if (
      response?.forkFolderLocation === undefined
      || response?.cloudOrLocalVersion === undefined
      || response?.yarnOrNPM === undefined
    ) {
      console.log('Please restart installer, invalid answers detected.');
      process.exit(1);
    }

    console.log(
      `Configuring Juno dev environment in ${chalk.green(
        response.forkFolderLocation,
      )} using ${chalk.green(response.yarnOrNPM)}.`,
    );
    console.log();

    process.chdir(root);
    if (response.yarnOrNPM === 'npm' && !checkThatNpmCanReadCwd()) {
      process.exit(1);
    }

    if (response.yarnOrNPM === 'npm') {
      const npmInfo = checkNpmVersion();
      if (!npmInfo.hasMinNpm) {
        if (npmInfo.npmVersion) {
          console.log(
            chalk.yellow(
              `You are using npm ${npmInfo.npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n`
                + 'Please update to npm 6 or higher for a better, fully supported experience.\n',
            ),
          );
        }
      }
    } else {
      const yarnInfo = checkYarnVersion();
      if (yarnInfo.yarnVersion) {
        if (!yarnInfo.hasMinYarnPnp) {
          console.log(
            chalk.yellow(
              `You are using Yarn ${yarnInfo.yarnVersion} together with the --use-pnp flag, but Plug'n'Play is only supported starting from the 1.12 release.\n\n`
                + 'Please update to Yarn 1.12 or higher for a better, fully supported experience.\n',
            ),
          );
          // 1.11 had an issue with webpack-dev-middleware, so better not use PnP with it
          // (never reached stable, but still)
          //   usePnp = false;
        }
        if (!yarnInfo.hasMaxYarnPnp) {
          console.log(
            chalk.yellow(
              'The --use-pnp flag is no longer necessary with yarn 2 and will be deprecated and removed in a future release.\n',
            ),
          );
          // 2 supports PnP by default and breaks when trying to use the flag
          //   usePnp = false;
        }
      }
    }

    run({
      forkedRoot: `${root}/${response.forkFolderLocation}`,
      version: response.cloudOrLocalVersion,
      verbose,
      yarnOrNPM: response.yarnOrNPM,
    });
  } catch (err) {
    console.log(err);
  }
}

// eslint-disable-next-line consistent-return
function init() {
  const program = new commander.Command(packageJson.name)
    .version(packageJson.version)
    .option('--verbose', 'print additional logs')
    .option('--info', 'print environment debug info')
    .option('--use-pnp')
    .allowUnknownOption()
    .on('--help', () => {
      console.log(
        `      - a local path relative to the current working directory: ${chalk.green(
          'file:../my-juno-scripts',
        )}`,
      );
      console.log();
      console.log();
      console.log(
        '    If you have any problems, do not hesitate to file an issue:',
      );
      console.log(
        `      ${chalk.cyan(
          'https://github.com/Elysium-Labs-EU/create-juno-dev-env/issues/new',
        )}`,
      );
      console.log();
    })
    .parse(process.argv);

  if (program.info) {
    console.log(chalk.bold('\nEnvironment Info:'));
    console.log(
      `\n  current version of ${packageJson.name}: ${packageJson.version}`,
    );
    console.log(`  running from ${__dirname}`);
    return envinfo
      .run(
        {
          System: ['OS', 'CPU'],
          Binaries: ['Node', 'npm', 'Yarn'],
          Browsers: [
            'Chrome',
            'Edge',
            'Internet Explorer',
            'Firefox',
            'Firefox Developer Edition',
            'Safari',
          ],
        },
        {
          duplicates: true,
          showNotFound: true,
        },
      )
      .then(console.log);
  }

  // We first check the registry directly via the API, and if that fails, we try
  // the slower `npm view [package] version` command.
  //
  // This is important for users in environments where direct access to npm is
  // blocked by a firewall, and packages are provided exclusively via a private
  // registry.
  checkForLatestVersion()
    .catch(() => {
      try {
        return execSync('npm view create-juno-dev-env version')
          .toString()
          .trim();
      } catch (e) {
        return null;
      }
    })
    .then((latest) => {
      if (latest && semver.lt(packageJson.version, latest)) {
        console.log();
        console.error(
          chalk.yellow(
            `You are running \`create-juno-dev-env\` ${packageJson.version}, which is behind the latest release (${latest}).\n\n`
              + 'We recommend always using the latest version of create-juno-dev-env if possible.',
          ),
        );
        console.log();
      } else {
        const useYarn = isUsingYarn();
        createEnv(
          program.verbose,
          program.scriptsVersion,
          program.template,
          useYarn,
          program.usePnp,
        );
      }
    });
}

module.exports = {
  init,
};
