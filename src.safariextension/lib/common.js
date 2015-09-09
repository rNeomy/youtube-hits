'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var config = require('./config');
}
/**** wrapper (end) ****/

/* options */
app.options.receive('changed', function (o) {
  config.set(o.pref, o.value);
  app.options.send('set', {
    pref: o.pref,
    value: config.get(o.pref)
  });
});
app.options.receive('get', function (pref) {
  app.options.send('set', {
    pref: pref,
    value: config.get(pref)
  });
});
app.options.receive('info', function () {
  app.options.send('info', {
    title: 'YouTube Hits',
    inshort: 'Find trending musics'
  });
});
app.options.receive('reset', function (name) {
  youtube.clear(name);
});

/* welcome page */
(function () {
  var version = config.welcome.version;
  if (app.version() !== version) {
    app.timer.setTimeout(function () {
      app.tab.open(
        'http://add0n.com/youtube-hits.html?v=' + app.version() +
        (version ? '&p=' + version + '&type=upgrade' : '&type=install')
      );
      config.welcome.version = app.version();
    }, config.welcome.timeout);
  }
})();
/**/

var youtube = (function () {
  function get (name) {
    return JSON.parse(app.storage.read(name) || '[]');
  }
  function set (name, ids) {
    ids = ids.filter(function (e, i, l) {
      return l.indexOf(e) === i;
    });
    ids = ids.slice(-1 * config.reddit.length[name]);  // maximum number of youtube ids to store
    app.storage.write(name, JSON.stringify(ids));
    if (name === 'ids') {
      app.button.badge = ids.length || '';
    }
  }
  return {
    get: get.bind(this, 'ids'),
    append: function (arr) {
      var trashed = get('trashed');
      arr = arr.filter(function (id) {
        return trashed.indexOf(id) === -1;
      });
      if (arr.length) {
        set('ids', [].concat.apply(get('ids'), arr));
      }
    },
    trash: function (id) {
      set('trashed', get('trashed').concat(id));

      var ids = get('ids');
      var i = ids.indexOf(id);
      ids.splice(i, 1);
      set('ids', ids);
    },
    clear: function (name) {
      app.storage.write(name, '');
      if (name === 'ids') {
        app.button.badge = '';
        app.storage.write('last-fetched', '');
      }
    }
  };
})();

app.button.onCommand(function () {
  var last = app.storage.read('last-fetched');
  var ids = youtube.get();

  if (last) {
    last = new Date(last);
    var now = new Date();
    if (now.getTime() - last.getTime() < 1 * 60 * 60 * 1000) {
      if (ids.length) {
        app.emit('open');
      }
      else {
        app.notify('YouTube Hits', 'No more hits for now! Hit me again later :)');
      }
    }
    else {
      if (ids.length) {
        app.emit('fetch', true);
        app.emit('open');
      }
      else {
        app.emit('fetch', false);
      }
    }
  }
  else {
    app.emit('fetch', false);
  }
});

app.on('open', function () {
  var ids = youtube.get();
  if (ids.length) {
    var i = Math.floor(Math.random() * ids.length);
    youtube.trash(ids[i]);
    app.tab.open('https://youtube.com/watch?v=' + ids[i]);
  }
  else {
    app.notify('YouTube Hits', 'Noting left! Please try again later');
  }
});

function wget (url) {
  var d = app.Promise.defer();
  var req = new app.XMLHttpRequest();
  req.onload = function () {
    if (req.responseText) {
      d.resolve(req.responseText);
    }
    else {
      d.reject(new Error('Empty Response'));
    }
  };
  req.onerror = function (e) {
    d.reject(e);
  };
  req.open('GET', url);
  req.send();
  return d.promise;
}

var tID;
function process (index, silent, sub, content) {
  var ids = [
    (content.match(/youtu\.be\/([^\"\'\&]+)/gm) || []).map(function (p) {
      return /youtu\.be\/([^\"\'\&]+)/.exec(p)[1];
    }),
    (content.match(/youtube\..{2,3}\/watch\?v\=([^\"\'\&]+)/gm) || []).map(function (p) {
      return /youtube\..{2,3}\/watch\?v\=([^\"\'\&]+)/.exec(p)[1];
    })
  ];
  ids = [].concat.apply([], ids);
  if (ids.length) {
    youtube.append(ids);
    if (!silent && index === 0) {
      app.emit('open');
    }
  }
  if (index === 0) {
    tID = app.timer.setTimeout(function () {
      app.emit('fetch', true);
    }, 30 * 60 * 1000);
    app.storage.write('last-fetched', (new Date()).toString());
  }
}
function fetch (silent) {
  app.timer.clearTimeout(tID);
  if (!silent) {
    app.notify('YouTube Hits', 'Fetching new hit songs\nPlease wait ...');
  }
  config.reddit.subscribed.forEach(function (sub, i) {
    wget('https://www.reddit.com' + sub + '/.rss').then(
      process.bind(this, i, silent, sub),
      function (e) {
        if (!silent) {
          app.notify('YouTube Hits', 'Cannot fetch new songs from ' + sub + '\n\n' + e);
        }
        if (i === 0) {
          tID = app.timer.setTimeout(function () {
            app.emit('fetch', true);
          }, 1 * 60 * 1000);
        }
      }
    );
  });
}
app.on('fetch', fetch);

/* init */
app.emit('fetch', true);
app.button.badge = youtube.get().length || '';
