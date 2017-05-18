'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractConnectionManager = require('../abstract/connection-manager');
var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('connection:pg');
var Promise = require('../../promise');
var sequelizeErrors = require('../../errors');
var semver = require('semver');
var dataTypes = require('../../data-types');
var moment = require('moment-timezone');

var ConnectionManager = function (_AbstractConnectionMa) {
  _inherits(ConnectionManager, _AbstractConnectionMa);

  function ConnectionManager(dialect, sequelize) {
    _classCallCheck(this, ConnectionManager);

    var _this = _possibleConstructorReturn(this, (ConnectionManager.__proto__ || Object.getPrototypeOf(ConnectionManager)).call(this, dialect, sequelize));

    _this.sequelize = sequelize;
    _this.sequelize.config.port = _this.sequelize.config.port || 5432;
    try {
      var pgLib = void 0;
      if (sequelize.config.dialectModulePath) {
        pgLib = require(sequelize.config.dialectModulePath);
      } else {
        pgLib = require('pg');
      }
      _this.lib = sequelize.config.native ? pgLib.native : pgLib;
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install \'' + (sequelize.config.dialectModulePath || 'pg') + '\' module manually');
      }
      throw err;
    }

    _this.refreshTypeParser(dataTypes.postgres);
    return _this;
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types


  _createClass(ConnectionManager, [{
    key: '_refreshTypeParser',
    value: function _refreshTypeParser(dataType) {
      var _this2 = this;

      if (dataType.types.postgres.oids) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          var _loop = function _loop() {
            var oid = _step.value;

            _this2.lib.types.setTypeParser(oid, function (value) {
              return dataType.parse(value, oid, _this2.lib.types.getTypeParser);
            });
          };

          for (var _iterator = dataType.types.postgres.oids[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            _loop();
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

      if (dataType.types.postgres.array_oids) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          var _loop2 = function _loop2() {
            var oid = _step2.value;

            _this2.lib.types.setTypeParser(oid, function (value) {
              return _this2.lib.types.arrayParser.create(value, function (v) {
                return dataType.parse(v, oid, _this2.lib.types.getTypeParser);
              }).parse();
            });
          };

          for (var _iterator2 = dataType.types.postgres.array_oids[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            _loop2();
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
    }
  }, {
    key: 'connect',
    value: function connect(config) {
      var _this3 = this;

      config.user = config.username;
      var connectionConfig = Utils._.pick(config, ['user', 'password', 'host', 'database', 'port']);

      if (config.dialectOptions) {
        Utils._.merge(connectionConfig, Utils._.pick(config.dialectOptions, [
        // see [http://www.postgresql.org/docs/9.3/static/runtime-config-logging.html#GUC-APPLICATION-NAME]
        'application_name',
        // choose the SSL mode with the PGSSLMODE environment variable
        // object format: [https://github.com/brianc/node-postgres/blob/master/lib/connection.js#L79]
        // see also [http://www.postgresql.org/docs/9.3/static/libpq-ssl.html]
        'ssl',
        // In addition to the values accepted by the corresponding server,
        // you can use "auto" to determine the right encoding from the
        // current locale in the client (LC_CTYPE environment variable on Unix systems)
        'client_encoding',
        // !! DONT SET THIS TO TRUE !!
        // (unless you know what you're doing)
        // see [http://www.postgresql.org/message-id/flat/bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com#bc9549a50706040852u27633f41ib1e6b09f8339d845@mail.gmail.com]
        'binary']));
      }

      return new Promise(function (resolve, reject) {
        var connection = new _this3.lib.Client(connectionConfig);
        var responded = false;

        connection.connect(function (err) {
          if (err) {
            if (err.code) {
              switch (err.code) {
                case 'ECONNREFUSED':
                  reject(new sequelizeErrors.ConnectionRefusedError(err));
                  break;
                case 'ENOTFOUND':
                  reject(new sequelizeErrors.HostNotFoundError(err));
                  break;
                case 'EHOSTUNREACH':
                  reject(new sequelizeErrors.HostNotReachableError(err));
                  break;
                case 'EINVAL':
                  reject(new sequelizeErrors.InvalidConnectionError(err));
                  break;
                default:
                  reject(new sequelizeErrors.ConnectionError(err));
                  break;
              }
            } else {
              reject(new sequelizeErrors.ConnectionError(err));
            }
            return;
          }
          responded = true;
          debug('connection acquired');
          resolve(connection);
        });

        // If we didn't ever hear from the client.connect() callback the connection timeout, node-postgres does not treat this as an error since no active query was ever emitted
        connection.on('end', function () {
          debug('connection timeout');
          if (!responded) {
            reject(new sequelizeErrors.ConnectionTimedOutError(new Error('Connection timed out')));
          }
        });

        // Don't let a Postgres restart (or error) to take down the whole app
        connection.on('error', function (err) {
          debug('connection error ' + err.code);
          connection._invalid = true;
        });
      }).tap(function (connection) {
        // Disable escape characters in strings, see https://github.com/sequelize/sequelize/issues/3545
        var query = '';

        if (_this3.sequelize.options.databaseVersion !== 0 && semver.gte(_this3.sequelize.options.databaseVersion, '8.2.0')) {
          query += 'SET standard_conforming_strings=on;';
        }

        if (!_this3.sequelize.config.keepDefaultTimezone) {
          var isZone = !!moment.tz.zone(_this3.sequelize.options.timezone);
          if (isZone) {
            query += 'SET client_min_messages TO warning; SET TIME ZONE \'' + _this3.sequelize.options.timezone + '\';';
          } else {
            query += 'SET client_min_messages TO warning; SET TIME ZONE INTERVAL \'' + _this3.sequelize.options.timezone + '\' HOUR TO MINUTE;';
          }
        }

        // oids for hstore and geometry are dynamic - so select them at connection time
        var supportedVersion = _this3.sequelize.options.databaseVersion !== 0 && semver.gte(_this3.sequelize.options.databaseVersion, '8.3.0');
        if (dataTypes.HSTORE.types.postgres.oids.length === 0 && supportedVersion) {
          query += 'SELECT typname, oid, typarray FROM pg_type WHERE typtype = \'b\' AND typname IN (\'hstore\', \'geometry\', \'geography\')';
        }

        return new Promise(function (resolve, reject) {
          connection.query(query).on('error', function (err) {
            return reject(err);
          }).on('row', function (row) {
            var type = void 0;
            if (row.typname === 'geometry') {
              type = dataTypes.postgres.GEOMETRY;
            } else if (row.typname === 'hstore') {
              type = dataTypes.postgres.HSTORE;
            } else if (row.typname === 'geography') {
              type = dataTypes.postgres.GEOGRAPHY;
            }

            type.types.postgres.oids.push(row.oid);
            type.types.postgres.array_oids.push(row.typarray);

            _this3._refreshTypeParser(type);
          }).on('end', function () {
            return resolve();
          });
        });
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect(connection) {
      return new Promise(function (resolve) {
        connection.end();
        resolve();
      });
    }
  }, {
    key: 'validate',
    value: function validate(connection) {
      return connection._invalid === undefined;
    }
  }]);

  return ConnectionManager;
}(AbstractConnectionManager);

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;