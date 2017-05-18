'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var depd = require('depd'),
    debug = require('debug'),
    _ = require('lodash');

var Logger = function () {
  function Logger(config) {
    _classCallCheck(this, Logger);

    this.config = _.extend({
      context: 'sequelize',
      debug: true
    }, config || {});

    this.depd = depd(this.config.context);
    this.debug = debug(this.config.context);
  }

  _createClass(Logger, [{
    key: 'deprecate',
    value: function deprecate(message) {
      this.depd(message);
    }
  }, {
    key: 'debug',
    value: function debug(message) {
      this.config.debug && this.debug(message);
    }
  }, {
    key: 'warn',
    value: function warn(message) {
      console.warn('(' + this.config.context + ') Warning: ' + message);
    }
  }, {
    key: 'debugContext',
    value: function debugContext(childContext) {
      if (!childContext) {
        throw new Error('No context supplied to debug');
      }
      return debug([this.config.context, childContext].join(':'));
    }
  }]);

  return Logger;
}();

module.exports = Logger;
//# sourceMappingURL=logger.js.map