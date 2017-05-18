'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractConnectionManager = require('../abstract/connection-manager');
var ResourceLock = require('./resource-lock');
var Promise = require('../../promise');
var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('connection:mssql');
var debugTedious = Utils.getLogger().debugContext('connection:mssql:tedious');
var sequelizeErrors = require('../../errors');
var parserStore = require('../parserStore')('mssql');
var _ = require('lodash');

var ConnectionManager = function (_AbstractConnectionMa) {
  _inherits(ConnectionManager, _AbstractConnectionMa);

  function ConnectionManager(dialect, sequelize) {
    _classCallCheck(this, ConnectionManager);

    var _this = _possibleConstructorReturn(this, (ConnectionManager.__proto__ || Object.getPrototypeOf(ConnectionManager)).call(this, dialect, sequelize));

    _this.sequelize = sequelize;
    _this.sequelize.config.port = _this.sequelize.config.port || 1433;
    try {
      if (sequelize.config.dialectModulePath) {
        _this.lib = require(sequelize.config.dialectModulePath);
      } else {
        _this.lib = require('tedious');
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install tedious package manually');
      }
      throw err;
    }
    return _this;
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types


  _createClass(ConnectionManager, [{
    key: '_refreshTypeParser',
    value: function _refreshTypeParser(dataType) {
      parserStore.refresh(dataType);
    }
  }, {
    key: '_clearTypeParser',
    value: function _clearTypeParser() {
      parserStore.clear();
    }
  }, {
    key: 'connect',
    value: function connect(config) {
      var _this2 = this;

      return new Promise(function (resolve, reject) {
        var connectionConfig = {
          userName: config.username,
          password: config.password,
          server: config.host,
          options: {
            port: config.port,
            database: config.database
          }
        };

        if (config.dialectOptions) {
          // only set port if no instance name was provided
          if (config.dialectOptions.instanceName) {
            delete connectionConfig.options.port;
          }

          // The 'tedious' driver needs domain property to be in the main Connection config object
          if (config.dialectOptions.domain) {
            connectionConfig.domain = config.dialectOptions.domain;
          }

          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = Object.keys(config.dialectOptions)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var key = _step.value;

              connectionConfig.options[key] = config.dialectOptions[key];
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

        var connection = new _this2.lib.Connection(connectionConfig);
        var connectionLock = new ResourceLock(connection);
        connection.lib = _this2.lib;

        connection.on('connect', function (err) {
          if (!err) {
            debug('connection acquired');
            resolve(connectionLock);
            return;
          }

          if (!err.code) {
            reject(new sequelizeErrors.ConnectionError(err));
            return;
          }

          switch (err.code) {
            case 'ESOCKET':
              if (_.includes(err.message, 'connect EHOSTUNREACH')) {
                reject(new sequelizeErrors.HostNotReachableError(err));
              } else if (_.includes(err.message, 'connect ENETUNREACH')) {
                reject(new sequelizeErrors.HostNotReachableError(err));
              } else if (_.includes(err.message, 'connect EADDRNOTAVAIL')) {
                reject(new sequelizeErrors.HostNotReachableError(err));
              } else if (_.includes(err.message, 'getaddrinfo ENOTFOUND')) {
                reject(new sequelizeErrors.HostNotFoundError(err));
              } else if (_.includes(err.message, 'connect ECONNREFUSED')) {
                reject(new sequelizeErrors.ConnectionRefusedError(err));
              } else {
                reject(new sequelizeErrors.ConnectionError(err));
              }
              break;
            case 'ER_ACCESS_DENIED_ERROR':
            case 'ELOGIN':
              reject(new sequelizeErrors.AccessDeniedError(err));
              break;
            case 'EINVAL':
              reject(new sequelizeErrors.InvalidConnectionError(err));
              break;
            default:
              reject(new sequelizeErrors.ConnectionError(err));
              break;
          }
        });

        if (config.dialectOptions && config.dialectOptions.debug) {
          connection.on('debug', debugTedious);
        }

        if (config.pool.handleDisconnects) {
          connection.on('error', function (err) {
            switch (err.code) {
              case 'ESOCKET':
              case 'ECONNRESET':
                _this2.pool.destroy(connectionLock);
            }
          });
        }
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect(connectionLock) {
      var connection = connectionLock.unwrap();

      // Dont disconnect a connection that is already disconnected
      if (connection.closed) {
        return Promise.resolve();
      }

      return new Promise(function (resolve) {
        connection.on('end', resolve);
        connection.close();
        debug('connection closed');
      });
    }
  }, {
    key: 'validate',
    value: function validate(connectionLock) {
      var connection = connectionLock.unwrap();
      return connection && connection.loggedIn;
    }
  }]);

  return ConnectionManager;
}(AbstractConnectionManager);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
//# sourceMappingURL=connection-manager.js.map