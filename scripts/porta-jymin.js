/**
 * This file is used in conjunction with Jymin to form the Porta client.
 *
 * If you're already using Jymin, you can use this file with it.
 * Otherwise use ../porta-client.js which includes required Jymin functions.
 *
 * @use jymin/jymin.js
 */

/**
 * If a mobile build hasn't set the platform, assume "web".
 */
window._platform = window._platform || 'web'

/**
 * The Porta function accepts views and the initial state.
 */
window.Porta = function (viewsOrState) {

  // Add new views or state values.
  var isViews = false
  Jymin.each(viewsOrState, function (value, name) {
    isViews = Jymin.isFunction(value)
    var map = isViews ? Porta.views : Porta.state
    map[name] = value
  })

  // If we just populated views, set Porta up to listen for events.
  if (isViews && history.pushState) {
    Porta.listen()
  }

}

/**
 * Listen for events on links and forms.
 */
Porta.listen = function () {
  if (Porta.isListening) {
    return
  }

  // Signal that Porta is listening
  Jymin.isReady(Porta, 1)
  Porta.isListening = 1

  // When a same-domain link is clicked, fetch it via XMLHttpRequest.
  Jymin.on('a', 'click,touchend', function (a, event) {
    var href = Jymin.getAttribute(a, 'href')
    var url = Porta.getHref(a)
    var buttonNumber = event.which
    var isLeftClick = (!buttonNumber || (buttonNumber === 1))
    //+debug
    console.log('[Porta] Link ' + event.type + ' ' + href + ' -> ' + url)
    //-debug
    if (isLeftClick) {
      if (Jymin.startsWith(href, '#')) {
        //+debug
        console.log('[Porta] Scrolling to anchor: ' + href + '.')
        //-debug
        var name = href.substr(1)
        Jymin.scrollToAnchor(name)
        Jymin.historyReplace(url + href)
        Jymin.stopEvent(event)
      } else if (url && Porta.isSameDomain(url)) {
        //+debug
        console.log('[Porta] Loading URL: ' + url + '.')
        //-debug
        Jymin.preventDefault(event)
        Porta.load(url, 0, a)
      }
    } else if (!url) {
      Jymin.preventDefault(event)
    }
  })

  // When a same-domain link is hovered, prefetch it.
  // TODO: Use mouse movement to detect probable targets.
  Jymin.on('a', 'mouseover,touchstart', function (a) {
    if (!Jymin.hasClass(a, '_noPrefetch')) {
      var url = Porta.getHref(a)
      var isDifferentPage = (url !== Porta.removeHash(location))
      if (isDifferentPage && Porta.isSameDomain(url)) {
        Porta.prefetch(url)
      }
    }
  })

  // When an input changes, update the state.
  Jymin.on('input,select,textarea,button', 'keyup,mouseup,touchend,change', function (element) {
    Porta.set(element.name, Jymin.value(element))
  })

  // When a form button is clicked, update the state.
  Jymin.on('input,button', 'click,touchend', function (button) {
    if (button.type === 'submit') {
      Porta.set(button.name, Jymin.value(button))
    }
  })

  // When a form is submitted, gather its data and submit via XMLHttpRequest.
  Jymin.on('form', 'submit', function (form, event) {
    var url = Porta.removeHash(form.action || Porta.removeQuery(location))
    var enc = Jymin.getAttribute(form, 'enctype')
    var isGet = (Jymin.lower(form.method) === 'get')
    if (Porta.isSameDomain(url) && !/multipart/.test(enc)) {
      Jymin.preventDefault(event)

      var isValid = form._validate ? form._validate() : true
      if (!isValid) {
        return
      }

      // Get form data.
      var data = []
      Jymin.all(form, 'input,select,textarea,button', function (input) {
        var name = input.name
        var type = input.type
        var value = Jymin.value(input)
        var ignore = !name
        ignore = ignore || ((type === 'radio') && !value)
        ignore = ignore || ((type === 'submit') && (input !== form._clickedButton))
        if (!ignore) {
          function pushFormValue (value) {
            data.push(Jymin.escape(name) + '=' + Jymin.escape(value))
          }
          if (Jymin.isString(value)) {
            pushFormValue(value)
          } else {
            Jymin.each(value, pushFormValue)
          }
        }
      })
      url = Porta.appendData(url, 'v=' + Jymin.getTime())

      // For a get request, append data to the URL.
      if (isGet) {
        url = Porta.appendData(data.join('&'))
        data = 0

      // If posting, append a timestamp so we can repost with this base URL.
      } else {
        url = Porta.appendExtension(url)
        data = data.join('&')
      }

      // Submit form data to the URL.
      Porta.load(url, data, form)
    }
  })

  // When a user presses the back button, render the new URL.
  Jymin.onHistoryPop(function () {
    if (location !== Porta.destination) {
      console.log('[Porta] ' + location + ' !== ' + Porta.destination)
      Porta.load(location)
    }
  })

}

Porta.isListening = 0

Porta.views = {
  '$': function(v){return (!v&&v!==0?'':(typeof v=='object'?Jymin.stringify(v)||'':''+v)).replace(/</g,'&lt;');},
  '&': function(v){return Jymin.escape(!v&&v!==0?'':''+v);}
}

Porta.url = ''

Porta.viewName = ''

Porta.view = Jymin.no

Porta.state = {}

Porta.cache = {}

Porta.base = (window._href || location.protocol + '//' + location.host) + '/'

Porta.destination = 0

Porta.localStorageTtl = 1e9

Porta.isSameDomain = function (url) {
  return Jymin.startsWith(url, Porta.base)
}

Porta.removeHash = function (url) {
  return Jymin.ensureString(url).split('#')[0]
}

Porta.removeQuery = function (url) {
  return Jymin.ensureString(url).split('?')[0]
}

Porta.appendExtension = function (url) {
  return Porta.removeExtension(url).replace(/(\?|$)/, '.json$1')
}

Porta.appendData = function (url, data) {
  return Jymin.ensureString(url) + (url.indexOf('?') > -1 ? '&' : '?') + data
}

Porta.removeExtension = function (url) {
  return Jymin.ensureString(url).replace(/\.json/g, '')
}

Porta.getLocalTtl = function (data) {
  return data.localStorageTtl || Porta.localStorageTtl || -1
}

Porta.getHref = function (a) {
  var href = Porta.removeHash(a.href)
  // Make sure mobile apps request data from the external API.
  return href.replace(/^file:\/\//, window._href)
}

Porta.prefetch = function (url) {
  // Only proceed if it's not already prefetched.
  if (!Porta.cache[url]) {
    //+env:debug
    console.log('[Porta] Prefetching "' + url + '".')
    //-env:debug

    // Create a callback queue to execute when data arrives.
    Porta.cache[url] = [function (response) {
      //+env:debug
      console.log('[Porta] Caching contents for prefetched URL "' + url + '".')
      //-env:debug

      // Cache the response so data can be used without a queue.
      Porta.cache[url] = response

      // Remove the data after 10 seconds, or the given TTL.
      var ttl = response.ttl || 1e4
      setTimeout(function () {
        // Only delete if it's not a new callback queue.
        if (!Jymin.isArray(Porta.cache[url])) {
          //+env:debug
          console.log('[Porta] Removing "' + url + '" from prefetch cache.')
          //-env:debug
          delete Porta.cache[url]
        }
      }, ttl)
    }]
    Porta.getJson(url)
  }
}

/**
 * Load a URL via GET request.
 */
Porta.load = function (url, data, sourceElement) {
  var target
  var viewName
  Porta.destination = Porta.removeExtension(url)

  // Stop the Mimo base URL from loading.
  if (/\/m\.html/.test(url)) {
    return
  }

  // If the URL is being loaded for a link or form, paint the target.
  if (sourceElement) {
    target = Jymin.getData(sourceElement, '_portaTarget')
    viewName = Jymin.getData(sourceElement, '_portaView')
    if (target) {
      Jymin.all(target, function (element) {
        Jymin.addClass(element, '_portaTarget')
      })
    }
  }

  //+env:debug
  console.log('[Porta] Loading "' + url + '".')
  //-env:debug

  // Set all spinners in the page to their loading state.
  Jymin.all('._spinner,._portaTarget', function (spinner) {
    Jymin.addClass(spinner, '_loading')
  })

  function handler (state, url) {
    Porta.renderResponse(viewName, state, target, url)
  }

  // A resource is either a cached response, a callback queue, or nothing.
  var resource = Porta.cache[url]

  // If there's no resource, start the JSON request.
  if (!resource) {
    //+env:debug
    console.log('[Porta] Creating callback queue for "' + url + '".')
    //-env:debug
    Porta.cache[url] = [handler]
    Porta.getJson(url, data)

  // If the "resource" is a callback queue, then pushing means listening.
  } else if (Jymin.isArray(resource)) {
    //+env:debug
    console.log('[Porta] Queueing callback for "' + url + '".')
    //-env:debug
    resource.push(handler)

  // If the resource exists and isn't an array, render it.
  } else {
    //+env:debug
    console.log('[Porta] Found prePorta.cached response for "' + url + '".')
    //-env:debug
    handler(resource, url)
  }
}

/**
 * Request JSON, then execute any callbacks that have been waiting for it.
 */
Porta.getJson = function (url, data) {
  //+env:debug
  console.log('[Porta] Fetching response for "' + url + '".')
  //-env:debug

  // Indicate with a URL param that Porta is requesting data, so we'll get JSON.
  var jsonUrl = Porta.appendExtension(url)

  // When data is received, Porta.cache the response and execute callbacks.
  function onComplete (data) {
    var queue = Porta.cache[url]
    Porta.cache[url] = data
    //+env:debug
    console.log('[Porta] Running ' + queue.length + ' callback(s) for "' + url + '".')
    //-env:debug
    Jymin.each(queue, function (callback) {
      callback(data, url)
    })

    // If the response can live in local storage, store it.
    var localStorageTtl = Porta.getLocalTtl(data)
    if (localStorageTtl > -1 && !data.cacheTime) {
      data.cacheTime = Jymin.getTime()
      Jymin.store(url, data)
    }
  }

  // TODO: Find a better way to prevent Cordova iOS from initially loading a bogus URL.
  if (!/\/Containers\/Bundle\//.test(jsonUrl)) {

    // Fire the JSON request.
    Jymin.get(jsonUrl, data, onComplete, onComplete)

    // Also try to get cached data from local storage.
    var data = Jymin.fetch(url)
    if (data) {
      var localStorageTtl = Porta.getLocalTtl(data)
      Porta.cacheTime = data.cacheTime
      var isEternal = (localStorageTtl === 0)
      var isFresh = (Porta.cacheTime + localStorageTtl >= Jymin.getTime())
      if (isEternal || isFresh) {
        var tempUrl = Porta.destination
        onComplete(data)
        Porta.destination = tempUrl
      }
    }
  }
}

// Render a template with the given state, and display the resulting HTML.
Porta.renderResponse = function (viewName, state, target, requestUrl) {
  viewName = viewName || state.view
  state = state || {}
  target = target || state._target

  var responseUrl = Porta.removeExtension(state.url || requestUrl)
  var view = Porta.views[viewName]

  // If there's a view name, the connection succeeded.
  if (viewName) {
    delete state._offline

  // Otherwise, we're offline.
  } else {
    state._offline = true

    // Try to infer the view name from the URL.
    viewName = responseUrl
      // Remove the protocol and server.
      .replace(/.*?\/\/.*?\//, '')
      // Remove the query string.
      .replace(/\?.*$/, '')

    // A main page's view name might need "index" to be appended.
    view = Porta.views[viewName]
    if (!view) {
      viewName = (viewName ? viewName + '/' : '') + 'index'
      view = Porta.views[viewName]

      // If we're not able to guess the view from the URL, use the current view.
      // If there is no current view.
      if (!view) {
        viewName = Porta.viewName || 'error0'
        view = Porta.views[viewName]
      }
    }
  }

  // Make sure the URL we render is the last one we tried to load.
  if (responseUrl === Porta.destination) {

    // Remember what's been rendered.
    Porta.state = state
    Porta.viewName = viewName
    Porta.view = view
    Porta.url = responseUrl

    var html

    // Reset any spinners.
    Jymin.all('._spinner,._portaTarget', function (spinner) {
      Jymin.removeClass(spinner, '_loading')
    })

    // If we received HTML, try rendering it.
    if (Jymin.trim(state)[0] === '<') {
      html = state
      //+env:debug
      console.log('[Porta] Rendering HTML string')
      //-env:debug

    // If the state refers to a view that we have, render it.
    } else if (view) {
      Jymin.startTime('ltl')
      html = view.call(Porta.views, state)
      Jymin.endTime('ltl')
      //+env:debug
      console.log('[Porta] Rendering view "' + viewName + '".')
      //-env:debug

    // If we can't find a corresponding view, navigate the old-fashioned way.
    } else {
      //+env:debug
      Jymin.error('[Porta] View "' + viewName + '" not found. Changing location.')
      //-env:debug
      window.location = responseUrl
      return
    }

  }

  // If there's HTML to render, push it into the page.
  if (html) {

    Jymin.startTime('push')
    var targetElement = Jymin.pushHtml(html, target)
    Jymin.endTime('push')

    // If there's a title in the state, write it to the document.
    var title = Porta.state._title
    if (title) {
      document.title = title
    }

    // Change the location bar to reflect where we are now.
    var isSamePage = Porta.removeQuery(responseUrl) === Porta.removeQuery(location.href)
    var historyMethod = isSamePage ? Jymin.historyReplace : Jymin.historyPush
    historyMethod(responseUrl)

    // If we render this page again, we'll want fresh data.
    delete Porta.cache[requestUrl]

    // Remove the target for the next rendering.
    delete Porta.state._target

    // Trigger an event to allow code to execute when stuff renders.
    Jymin.emit('render', targetElement)
  }
}

/**
 * Get a sub-state from a dot-delimited path.
 *
 * @param  {String} path  A dot-delimited object key path.
 * @return {Object}       The value at that path (or an empty object).
 */
Porta.get = function (path) {
  var scope = Porta.state = Porta.state || {}
  var trail = path.split(/\./)
  var length = trail.length
  for (var index = 0; index < length; index++) {
    var key = trail[index]
    scope = scope[key] = scope[key] || {}
  }
  return scope
}

/**
 * Set a sub-state at a dot-delimited path.
 *
 * @param  {String} path   A dot-delimited object key path.
 * @param  {Object} value  The value to set it to.
 */
Porta.set = function (path, value) {
  if (path) {
    var state = Porta.state = Porta.state || {}
    var scope = state
    var trail = path.split(/\./)
    var last = trail.length - 1
    for (var index = 0; index < last; index++) {
      var key = trail[index]
      scope = scope[key] = scope[key] || {}
    }
    key = trail[last]
    if (scope[key] !== value) {
      if (value === null) {
        delete scope[key]
      } else {
        scope[key] = value
      }
      Jymin.setTimer('render', Porta.render, 1)
    }
  }
}

/**
 * Render or re-render a view with a given state.
 *
 * @param  {String} viewName  Optional name of the view to render.
 * @param  {Object} state     Optional state to replace the existing state.
 */
Porta.render = function (viewName, state) {
  Porta.destination = location.href
  viewName = viewName || Porta.viewName
  state = state || Porta.state
  Jymin.startTime('render')
  Porta.renderResponse(viewName, state, 0, Porta.destination)
  Jymin.endTime('render')
  Jymin.beamTimes()
}

/**
 * Insert a script to load views.
 */
if (window._platform == 'web') {
  Jymin.js((window._href || '') + '/p.js?v=CACHE_BUST')
}
