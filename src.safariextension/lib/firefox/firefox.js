'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    buttons       = require('sdk/ui/button/action'),
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    notifications = require('sdk/notifications'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    loader        = require('@loader/options'),
    array         = require('sdk/util/array'),
    unload        = require('sdk/system/unload'),
    xhr           = require('sdk/net/xhr'),
    {on, off, once, emit} = require('sdk/event/core'),
    {Cu}          = require('chrome'),
    config        = require('../config');

Cu.import('resource://gre/modules/Promise.jsm');

exports.globals = {
  browser: 'firefox'
};

// Promise
exports.Promise = Promise;

// XMLHttpRequest
exports.XMLHttpRequest = xhr.XMLHttpRequest;

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

//toolbar button
exports.button = (function () {
  var callback;
  var button = buttons.ActionButton({
    id: self.name,
    label: 'YouTube Hits',
    icon: {
      '18': './icons/16.png',
      '36': './icons/32.png'
    },
    onClick: function() {
      if (callback) {
        callback();
      }
    }
  });
  return {
    onCommand: function (c) {
      callback = c;
    },
    set label (val) {
      button.label = val;
    },
    set badge (val) {
      if (config.ui.badge) {
        button.badge = val;
      }
    }
  };
})();

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false' || !isNaN(prefs[id])) ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  }
};

exports.getURL = function (path) {
  return loader.prefixURI + loader.name + '/' + path;
};

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground === 'undefined' ? false : inBackground
      });
    }
  },
  list: function () {
    var temp = [];
    for each (var tab in tabs) {
      temp.push(tab);
    }
    return Promise.resolve(temp);
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.notify = function (title, text) {
  notifications.notify({
    title: title,
    text: text,
    iconURL: data.url('icons/32.png')
  });
};

exports.options = (function () {
  var workers = [], options_arr = [];
  pageMod.PageMod({
    include: data.url('options/index.html'),
    contentScriptFile: [data.url('options/firefox/firefox.js'), data.url('options/index.js')],
    contentScriptWhen: 'ready',
    contentScriptOptions: {
      base: loader.prefixURI + loader.name + '/'
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });

      options_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  sp.on('openOptions', function() {
    exports.tab.open(data.url('options/index.html'));
  });
  unload.when(function () {
    exports.tab.list().then(function (tabs) {
      tabs.forEach(function (tab) {
        if (tab.url === data.url('options/index.html')) {
          tab.close();
        }
      });
    });
  });

  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        if (!worker || !worker.url) {
          return;
        }
        worker.port.emit(id, data);
      });
    },
    receive: (id, callback) => options_arr.push([id, callback])
  };
})();
