'use strict';

var cheerio = require('cheerio');
var esdocConfig = require('../.esdoc.json');

exports.onHandleHTML = function (ev) {
  var $ = cheerio.load(ev.data.html);

  var $title = $('head title');
  if ($title.text().indexOf(esdocConfig.title) === -1) {
    $title.text($title.text() + ' | ' + esdocConfig.title);
  }

  var $header = $('header');
  $header.prepend('<a href="/"><img src="manual/asset/logo-small.png" class="header-logo" /></a>');
  $header.append('<div class="search-container"><div class="gcse-search"></div></div>');
  $('head').append('<script type="text/javascript" async=true src="https://cse.google.com/cse.js?cx=015434599481993553871:zku_jjbxubw" />');

  $('.repo-url-github').after('<a href="http://sequelize-slack.herokuapp.com/" class="slack-link"><img class="slack-logo" src="manual/asset/slack.svg"/>Join us on Slack</a>');

  // remove unnecessary scripts
  var scripts = ['script/search_index.js', 'script/search.js', 'script/inherited-summary.js', 'script/test-summary.js', 'script/inner-link.js'];
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = scripts[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var script = _step.value;

      $('script[src="' + script + '"]').remove();
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  ev.data.html = $.html();
};