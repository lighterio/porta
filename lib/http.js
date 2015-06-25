var http = require('http')

/**
 * Append the Porta count to the redirect.
 */
http.ServerResponse.prototype.redirect = function (location) {
  var res = this
  // If this is an XMLHttpRequest from Porta, indicate it in the redirect URL.
  if (res.request.query.porta) {
    location += (location.indexOf('?') < 0 ? '?' : '&') + 'porta=r'
  }
  res.statusCode = 302
  res.setHeader('location', location)
  res.end()
}
