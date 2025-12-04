(function (window, document) {
  if (typeof window.metaSGWScriptLoader === 'function') return window.metaSGWScriptLoader;

  var cacheTokens = {};
  window.metaSGWScriptLoader = function (url, successHandler, failureHandler) {
    if (typeof url !== 'string') return;

    successHandler = typeof successHandler === 'function' ? successHandler : function () {};
    failureHandler = typeof failureHandler === 'function' ? failureHandler : function () {};

    if (cacheTokens[url]) {
      cacheTokens[url].successHandlers.push(successHandler);
      if (!cacheTokens[url].successHandlers.push.loaded) cacheTokens[url].failureHandlers.push(failureHandler);
    } else {
      cacheTokens[url] = { successHandlers: [successHandler], failureHandlers: [failureHandler] };
      var scriptElement = document.createElement('script');
      scriptElement.onload = function () {
        for (var successHandlers = cacheTokens[url].successHandlers, i = 0; i < successHandlers.length; i++) {
          window.setTimeout(successHandlers[i], 0);
        }
        successHandlers.push = function (successHandler) {
          window.setTimeout(successHandler, 0);
        };
        successHandlers.push.loaded = true;
      };
      scriptElement.onerror = function () {
        for (var failureHandlers = cacheTokens[url].failureHandlers, i = 0; i < failureHandlers.length; i++) {
          window.setTimeout(failureHandlers[i], 0);
        }
        cacheTokens[url] = null;
      };
      scriptElement.async = true;
      scriptElement.src = url;
      var firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode.insertBefore(scriptElement, firstScript);
    }
  };
})(window, document);
