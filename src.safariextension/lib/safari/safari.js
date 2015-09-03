/* globals Q, safari, config, webkitNotifications */
'use strict';

var app = new EventEmitter();
app.globals = {
  browser: 'safari'
};

app.Promise = Q.promise;
app.Promise.defer = Q.defer;

// XMLHttpRequest
app.XMLHttpRequest = window.XMLHttpRequest;

app.storage = {
  read: function (id) {
    return safari.extension.settings[id] || null;
  },
  write: function (id, data) {
    safari.extension.settings[id] = data + '';
  }
};

app.getURL = function (path) {
  return safari.extension.baseURI + 'data/' + path;
};

app.button = (function () {
  var onCommand,
      toolbarItem = safari.extension.toolbarItems[0];
  safari.application.addEventListener('command', function (e) {
    if (e.command === 'toolbarbutton' && onCommand) {
      onCommand();
    }
  }, false);

  return {
    onCommand: function (c) {
      onCommand = c;
    },
    set label (val) { // jshint ignore: line
      toolbarItem.toolTip = val;
    },
    set icon (obj) {  // jshint ignore: line
      toolbarItem.image =
        safari.extension.baseURI + 'data/icons/safari/' +
        (obj.path.indexOf('disabled') === -1 ? 'on' : 'off') +
        '.png';
    },
    set badge (val) { // jshint ignore: line
      toolbarItem.badge = (val ? val : '') + '';
    }
  };
})();

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      safari.application.activeBrowserWindow.activeTab.url = url;
    }
    else {
      safari.application.activeBrowserWindow.openTab(inBackground ? 'background' : 'foreground').url = url;
    }
  },
  list: function () {
    var wins = safari.application.browserWindows;
    var tabs = wins.map(function (win) {
      return win.tabs;
    });
    tabs = tabs.reduce(function (p, c) {
      return p.concat(c);
    }, []);
    return new app.Promise(function (a) {a(tabs);});
  }
};

app.notify = function (title, text) {
  var notification = webkitNotifications.createNotification(
    safari.extension.baseURI + 'data/icons/48.png',  title,  text
  );
  notification.show();
  window.setTimeout(function () {
    notification.cancel();
  }, 5000);
};

app.version = function () {
  return safari.extension.displayVersion;
};

app.timer = window;

app.options = (function () {
  var callbacks = {};
  safari.application.addEventListener('message', function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data) {
      safari.application.browserWindows.forEach(function (browserWindow) {
        browserWindow.tabs.forEach(function (tab) {
          if (tab.page && tab.url.indexOf(safari.extension.baseURI + 'data/options/index.html') === 0) {
            tab.page.dispatchMessage(id, data);
          }
        });
      });
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();
