/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
const chalk = require('chalk');
const commander = require('commander');
// const dns = require('dns');
const envinfo = require('envinfo');
const { execSync } = require('child_process');
const fs = require('fs-extra');
// const hyperquest = require('hyperquest');
// const prompts = require('prompts');
const os = require('os');
const path = require('path');
const semver = require('semver');
const spawn = require('cross-spawn');
// const tmp = require('tmp');
// const { unpack } = require('tar-pack');
// const url = require('url');
// const validateProjectName = require('validate-npm-package-name');
const { checkSetupVariables } = require('./utils/checkSetupVariables');
const { checkForLatestVersion } = require('./utils/checkForLatestVersion');
const { checkThatNpmCanReadCwd } = require('./utils/checkThatNpmCanReadCwd');
const { checkNpmVersion } = require('./utils/checkNpmVersion');
const { checkYarnVersion } = require('./utils/checkYarnVersion');

const packageJson = require('./package.json');

function isUsingYarn() {
  return (process.env.npm_config_user_agent || '').indexOf('yarn') === 0;
}

const projectName = 'testRun';
const projectGitURL = 'https://github.com/Elysium-Labs-EU/juno-core';

function install({
  root, yarnOrNPM, dependencies, verbose, isOnline,
}) {
  return new Promise((resolve, reject) => {
    let command;
    let args;
    if (yarnOrNPM === 'yarn') {
      command = 'yarnpkg';
      args = ['add', '--exact'];
      if (!isOnline) {
        args.push('--offline');
      }
      //   if (usePnp) {
      //     args.push('--enable-pnp');
      //   }
      [].push.apply(args, dependencies);

      // Explicitly set cwd() to work around issues like
      // https://github.com/facebook/create-react-app/issues/3326.
      // Unfortunately we can only do this for Yarn because npm support for
      // equivalent --prefix flag doesn't help with this issue.
      // This is why for npm, we run checkThatNpmCanReadCwd() early instead.
      args.push('--cwd');
      args.push(root);

      if (!isOnline) {
        console.log(chalk.yellow('You appear to be offline.'));
        console.log(chalk.yellow('Falling back to the local Yarn cache.'));
        console.log();
      }
    } else {
      command = 'npm';
      args = [
        'install',
        '--no-audit', // https://github.com/facebook/create-react-app/issues/11174
        '--save',
        '--save-exact',
        '--loglevel',
        'error',
      ].concat(dependencies);

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

function run({
  root,
  appName,
  version,
  verbose,
  originalDirectory,
  yarnOrNPM,
}) {
  console.log({
    root,
    appName,
    version,
    verbose,
    originalDirectory,
    yarnOrNPM,
  });

  const detectedOS = os.platform();
  if (detectedOS === 'win32') {
    // Windows uses different command types.
  }
  //   fs.ensureDirSync(appName);
  fs.readdir(root, (err) => {
    console.log('we are here now');

    install({
      root,
      yarnOrNPM,
      dependencies: [],
      verbose,
      isOnline: true,
    });
    console.error(err);
  });

//   envinfo
//     .run(
//       {
//         System: ['OS', 'CPU'],
//         Binaries: ['Node', 'npm', 'Yarn'],
//         // npmPackages: ['react', 'react-dom', 'react-scripts'],
//       },
//       {
//         duplicates: true,
//         showNotFound: true,
//       },
//     )
//     .then((value) => {
//       console.log(value.System);
//       //   if(value.system)
//     });
}

async function createEnv(name, verbose, version, template, useYarn, usePnp) {
  const root = path.resolve(name);
  const appName = path.basename(root);

  try {
    const response = await checkSetupVariables();
    console.log('response', response);
    if (!response.userHasForked) {
      console.log(
        `Please fork the repository first and restart the installer - ${chalk.green(
          projectGitURL,
        )}.`,
      );
      process.exit(1);
    }

    // Cancel the installation flow if something is missing in the response.
    // if (
    //   response?.forkFolderLocation === undefined
    //   || response?.cloudOrLocalVersion === undefined
    //   || response?.yarnOrNPM === undefined
    // ) {
    //   console.log('Please restart installer, invalid answers detected.');
    //   process.exit(1);
    // }

    // Create/check the folder here
    fs.ensureDirSync(name);
    // if (!isSafeToCreateProjectIn(root, name)) {
    //   process.exit(1);
    // }
    // console.log();

    console.log(
      `Configuring Juno dev environment in ${chalk.green(
        response.forkFolderLocation,
      )}.`,
    );
    console.log();

    //   eslint-disable-next-line no-shadow
    // const packageJson = {
    //   name: appName,
    //   version: '0.1.0',
    //   private: true,
    // };
    // fs.writeFileSync(
    //   path.join(root, 'package.json'),
    //   JSON.stringify(packageJson, null, 2) + os.EOL,
    // );

    const originalDirectory = process.cwd();
    process.chdir(root);
    if (!useYarn && !checkThatNpmCanReadCwd()) {
      process.exit(1);
    }

    if (!useYarn) {
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
    } else if (usePnp) {
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
          usePnp = false;
        }
        if (!yarnInfo.hasMaxYarnPnp) {
          console.log(
            chalk.yellow(
              'The --use-pnp flag is no longer necessary with yarn 2 and will be deprecated and removed in a future release.\n',
            ),
          );
          // 2 supports PnP by default and breaks when trying to use the flag
          usePnp = false;
        }
      }
    }

    run({
      root: response.forkFolderLocation,
      appName,
      version: response.cloudOrLocalVersion,
      verbose,
      originalDirectory,
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
    .arguments('<project-directory>')
    .usage(`${chalk.green('<project-directory>')} [options]`)
    // .action((name) => {
    //   projectName = name;
    // })
    .option('--verbose', 'print additional logs')
    .option('--info', 'print environment debug info')
    .option('--use-pnp')
    .allowUnknownOption()
    .on('--help', () => {
      console.log(`Only ${chalk.green('<project-directory>')} is required.`);
      console.log();
      console.log(
        `      - a local path relative to the current working directory: ${chalk.green(
          'file:../my-react-scripts',
        )}`,
      );
      console.log();
      console.log();
      console.log(
        '    If you have any problems, do not hesitate to file an issue:',
      );
      console.log(
        `      ${chalk.cyan(
          'https://github.com/facebook/create-react-app/issues/new',
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
          npmPackages: ['react', 'react-dom', 'react-scripts'],
          npmGlobalPackages: ['create-react-app'],
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
        return execSync('npm view create-react-app version').toString().trim();
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
          projectName,
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
