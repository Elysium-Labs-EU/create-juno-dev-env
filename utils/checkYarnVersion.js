const { execSync } = require('child_process')
const semver = require('semver')

function checkYarnVersion() {
  const minYarnPnp = '1.12.0'
  const maxYarnPnp = '2.0.0'
  let hasMinYarnPnp = false
  let hasMaxYarnPnp = false
  let yarnVersion = null
  try {
    yarnVersion = execSync('yarnpkg --version').toString().trim()
    if (semver.valid(yarnVersion)) {
      hasMinYarnPnp = semver.gte(yarnVersion, minYarnPnp)
      hasMaxYarnPnp = semver.lt(yarnVersion, maxYarnPnp)
    } else {
      // Handle non-semver compliant yarn version strings, which yarn currently
      // uses for nightly builds. The regex truncates anything after the first
      // dash. See #5362.
      const trimmedYarnVersionMatch = /^(.+?)[-+].+$/.exec(yarnVersion)
      if (trimmedYarnVersionMatch) {
        const trimmedYarnVersion = trimmedYarnVersionMatch.pop()
        hasMinYarnPnp = semver.gte(trimmedYarnVersion, minYarnPnp)
        hasMaxYarnPnp = semver.lt(trimmedYarnVersion, maxYarnPnp)
      }
    }
  } catch (err) {
    // ignore
  }
  return {
    hasMinYarnPnp,
    hasMaxYarnPnp,
    yarnVersion,
  }
}

module.exports = { checkYarnVersion }
