const https = require('https')

function checkForLatestVersion() {
  return new Promise((resolve, reject) => {
    https
      .get(
        'https://registry.npmjs.org/-/package/create-juno-dev-env/dist-tags',
        (res) => {
          if (res.statusCode === 200) {
            let body = ''
            // eslint-disable-next-line no-return-assign
            res.on('data', (data) => (body += data))
            res.on('end', () => {
              resolve(JSON.parse(body).latest)
            })
          } else {
            reject()
          }
        }
      )
      .on('error', () => {
        reject()
      })
  })
}

module.exports = { checkForLatestVersion }
