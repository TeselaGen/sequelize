'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractConnectionManager = require('../abstract/connection-manager');
var SequelizeErrors = require('../../errors');
var Utils = require('../../utils');
var DataTypes = require('../../data-types').mysql;
var momentTz = require('moment-timezone');
var debug = Utils.getLogger().debugContext('connection:mysql');
var parserMap = new Map();

/**
 * MySQL Connection Managger
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MySQL specific connections
 * Use https://github.com/sidorares/node-mysql2 to connect with MySQL server
 *
 * @extends AbstractConnectionManager
 * @return Class<ConnectionManager>
 * @private
 */

var ConnectionManager = function (_AbstractConnectionMa) {
  _inherits(ConnectionManager, _AbstractConnectionMa);

  function ConnectionManager(dialect, sequelize) {
    _classCallCheck(this, ConnectionManager);

    var _this = _possibleConstructorReturn(this, (ConnectionManager.__proto__ || Object.getPrototypeOf(ConnectionManager)).call(this, dialect, sequelize));

    _this.sequelize = sequelize;
    _this.sequelize.config.port = _this.sequelize.config.port || 3306;
    try {
      if (sequelize.config.dialectModulePath) {
        _this.lib = require(sequelize.config.dialectModulePath);
      } else {
        _this.lib = require('mysql2');
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install mysql2 package manually');
      }
      throw err;
    }

    _this.refreshTypeParser(DataTypes);
    return _this;
  }

  // Update parsing when the user has added additional, custom types


  _createClass(ConnectionManager, [{
    key: '_refreshTypeParser',
    value: function _refreshTypeParser(dataType) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = dataType.types.mysql[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var type = _step.value;

          parserMap.set(type, dataType.parse);
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
    }
  }, {
    key: '_clearTypeParser',
    value: function _clearTypeParser() {
      parserMap.clear();
    }
  }, {
    key: 'connect',


    /**
     * Connect with MySQL database based on config, Handle any errors in connection
     * Set the pool handlers on connection.error
     * Also set proper timezone once conection is connected
     *
     * @return Promise<Connection>
     * @private
     */
    value: function connect(config) {
      var _this2 = this;

      var connectionConfig = {
        host: config.host,
        port: config.port,
        user: config.username,
        flags: '-FOUND_ROWS',
        password: config.password,
        database: config.database,
        timezone: this.sequelize.options.timezone,
        typeCast: ConnectionManager._typecast.bind(this),
        bigNumberStrings: false,
        supportBigNumbers: true
      };

      if (config.dialectOptions) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = Object.keys(config.dialectOptions)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var key = _step2.value;

            connectionConfig[key] = config.dialectOptions[key];
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }

      return new Utils.Promise(function (resolve, reject) {
        var connection = _this2.lib.createConnection(connectionConfig);

        var errorHandler = function errorHandler(e) {
          // clean up connect event if there is error
          connection.removeListener('connect', connectHandler);
          reject(e);
        };

        var connectHandler = function connectHandler() {
          // clean up error event if connected
          connection.removeListener('error', errorHandler);
          resolve(connection);
        };

        connection.once('error', errorHandler);
        connection.once('connect', connectHandler);
      }).then(function (connection) {

        if (config.pool.handleDisconnects) {
          // Connection to the MySQL server is usually
          // lost due to either server restart, or a
          // connection idle timeout (the wait_timeout
          // server variable configures this)
          //
          // See [stackoverflow answer](http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection)
          connection.on('error', function (err) {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
              // Remove it from read/write pool
              _this2.pool.destroy(connection);
            }
            debug('connection error ' + err.code);
          });
        }

        debug('connection acquired');
        return connection;
      }).then(function (connection) {
        return new Utils.Promise(function (resolve, reject) {
          // set timezone for this connection
          // but named timezone are not directly supported in mysql, so get its offset first
          var tzOffset = _this2.sequelize.options.timezone;
          tzOffset = /\//.test(tzOffset) ? momentTz.tz(tzOffset).format('Z') : tzOffset;

          connection.query('SET time_zone = \'' + tzOffset + '\'', function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(connection);
            }
          });
        });
      }).catch(function (err) {
        if (err.code) {
          switch (err.code) {
            case 'ECONNREFUSED':
              throw new SequelizeErrors.ConnectionRefusedError(err);
            case 'ER_ACCESS_DENIED_ERROR':
              throw new SequelizeErrors.AccessDeniedError(err);
            case 'ENOTFOUND':
              throw new SequelizeErrors.HostNotFoundError(err);
            case 'EHOSTUNREACH':
              throw new SequelizeErrors.HostNotReachableError(err);
            case 'EINVAL':
              throw new SequelizeErrors.InvalidConnectionError(err);
            default:
              throw new SequelizeErrors.ConnectionError(err);
          }
        } else {
          throw new SequelizeErrors.ConnectionError(err);
        }
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect(connection) {

      // Dont disconnect connections with CLOSED state
      if (connection._closing) {
        debug('connection tried to disconnect but was already at CLOSED state');
        return Utils.Promise.resolve();
      }

      return new Utils.Promise(function (resolve, reject) {
        connection.end(function (err) {
          if (err) {
            reject(new SequelizeErrors.ConnectionError(err));
          } else {
            debug('connection disconnected');
            resolve();
          }
        });
      });
    }
  }, {
    key: 'validate',
    value: function validate(connection) {
      return connection && connection._fatalError === null && connection._protocolError === null && !connection._closing;
    }
  }], [{
    key: '_typecast',
    value: function _typecast(field, next) {
      if (parserMap.has(field.type)) {
        return parserMap.get(field.type)(field, this.sequelize.options, next);
      }
      return next();
    }
  }]);

  return ConnectionManager;
}(AbstractConnectionManager);

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
//# sourceMappingURL=connection-manager.js.map