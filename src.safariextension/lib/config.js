'use strict';

var isFirefox = typeof require !== 'undefined', config;
if (isFirefox) {
  var app = require('./firefox/firefox');
  config = exports;
}
else {
  config = {};
}

config.options = {
  get subreddits () {
    return app.storage.read('subreddits') || '/r/Music';
  },
  set subreddits (val) {
    val = val.split(/\s*\,\s*/)
    .map(function (sub) {
      return sub.trim().replace('https://www.reddit.com', '').replace('/.rss', '').replace(/\/$/, '');
    })
    .filter(function (o, i, l) {
      return l.indexOf(o) === i && o.indexOf('/r/') === 0;
    })
    .join(', ');
    app.storage.write('subreddits', val);
  }
};

config.popup = {
  get width () {
    return +app.storage.read('width') || 200;
  },
  set width (val) {
    val = +val;
    if (val < 200) {
      val = 200;
    }
    app.storage.write('width', val);
  },
  get height () {
    return +app.storage.read('height') || 200;
  },
  set height (val) {
    val = +val;
    if (val < 200) {
      val = 200;
    }
    app.storage.write('height', val);
  }
};

config.ui = {
  badge: true,
  backgroundColor: '#3366CC',
};

config.welcome = {
  get version () {
    return app.storage.read('version');
  },
  set version (val) {
    app.storage.write('version', val);
  },
  timeout: 3,
  get show () {
    return app.storage.read('show') === 'false' ? false : true; // default is true
  },
  set show (val) {
    app.storage.write('show', val);
  }
};

config.reddit = {
  subscribed: config.options.subreddits.split(', '),
  length: {
    trashed: 400,
    ids: 200
  }
};

// Complex get and set
config.get = function (name) {
  return name.split('.').reduce(function (p, c) {
    return p[c];
  }, config);
};
config.set = function (name, value) {
  function set(name, value, scope) {
    name = name.split('.');
    if (name.length > 1) {
      set.call((scope || this)[name.shift()], name.join('.'), value)
    }
    else {
      this[name[0]] = value;
    }
  }
  set(name, value, config);
};
