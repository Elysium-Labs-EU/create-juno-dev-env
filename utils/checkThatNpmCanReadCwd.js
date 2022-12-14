'use-strict';

const chalk = require('chalk');
const spawn = require('cross-spawn');

// See https://github.com/facebook/create-react-app/pull/3355
function checkThatNpmCanReadCwd() {
  const cwd = process.cwd();
  let childOutput = null;
  try {
    // Note: intentionally using spawn over exec since
    // the problem doesn't reproduce otherwise.
    // `npm config list` is the only reliable way I could find
    // to reproduce the wrong path. Just printing process.cwd()
    // in a Node process was not enough.
    childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
  } catch (err) {
    // Something went wrong spawning node.
    // Not great, but it means we can't do this check.
    // We might fail later on, but let's continue.
    return true;
  }
  if (typeof childOutput !== 'string') {
    return true;
  }
  const lines = childOutput.split('\n');
  // `npm config list` output includes the following line:
  // "; cwd = C:\path\to\current\dir" (unquoted)
  // I couldn't find an easier way to get it.
  const prefix = '; cwd = ';
  const foundLine = lines.find((line) => line.startsWith(prefix));
  if (typeof foundLine !== 'string') {
    // Fail gracefully. They could remove it.
    return true;
  }
  const npmCWD = foundLine.substring(prefix.length);
  if (npmCWD === cwd) {
    return true;
  }
  console.error(
    chalk.red(
      'Could not start an npm process in the right directory.\n\n'
        + `The current directory is: ${chalk.bold(cwd)}\n`
        + `However, a newly started npm process runs in: ${chalk.bold(
          npmCWD,
        )}\n\n`
        + 'This is probably caused by a misconfigured system terminal shell.',
    ),
  );
  if (process.platform === 'win32') {
    console.error(
      `${chalk.red(
        'On Windows, this can usually be fixed by running:\n\n',
      )}  ${chalk.cyan(
        'reg',
      )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n`
        + `  ${chalk.cyan(
          'reg',
        )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n${chalk.red(
          'Try to run the above two lines in the terminal.\n',
        )}${chalk.red(
          'To learn more about this problem, read: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/',
        )}`,
    );
  }
  return false;
}

module.exports = { checkThatNpmCanReadCwd };
