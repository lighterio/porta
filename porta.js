/**
 * Accept an app object, and serve its views.
 */
var porta = module.exports = function (app) {
  var chug = app.chug;

  chug.onceReady(function () {
    var views = app.views;

    // Iterate over the views building an array of key-value pair strings.
    var pairs = [];
    views.each(function (asset) {
      var compiled = asset.getCompiledContent();
      var minified = asset.getMinifiedContent();
      var key = compiled.key.replace(/"/g, '\\"');
      pairs.push(JSON.stringify(key) + ':' + minified.toString());
    });

    // If using Ltl, include escaping functions.
    var ltl = process.ltl;
    if (ltl) {
      pairs.push('$:' + ltl.$.toString());
      pairs.push('"&":' + ltl['&'].toString());
    }

    // TODO: Allow views to be separated into batches to reduce payload.
    var url = '/e.js';
    var asset = new chug.Asset(url);

    // Route the views with pre-zipping so clients can download them quickly.
    views.then(function () {
      var env = process.env.NODE_ENV || 'prod';
      var br = app.isDev ? '\n' : '';
      var tab = app.isDev ? '  ' : '';
      var js = 'Porta({' + br + tab + pairs.join(',' + br + tab) + br + '});';
      asset.setContent(js);
      if (!app.isDev) {
        asset.minify();
      }
      asset.route();
      var colorUrl = url.cyan || url;
      var logInfo = (app.log || console).info;
      logInfo('[Porta] Views routed to ' + colorUrl + '.');
      app.emit('views', js);
    });

  });
};

/**
 * Expose the Porta version via package.json lazy loading.
 */
Object.defineProperty(porta, 'version', {
  get: function () {
    return require(__dirname + '/package.json').version;
  }
});

/**
 * Expose the paths to Porta's front-end scripts.
 */
porta.jymin = __dirname + '/scripts/porta-jymin.js';
porta.client = __dirname + '/porta-client.js';
porta.clientMin = __dirname + '/porta-client.min.js';
