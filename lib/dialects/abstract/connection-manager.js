'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Pooling = require('generic-pool');
var Promise = require('../../promise');
var _ = require('lodash');
var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('pool');
var semver = require('semver');
var timers = require('timers');

var defaultPoolingConfig = {
  max: 5,
  min: 0,
  idle: 10000,
  acquire: 10000,
  handleDisconnects: true
};

var ConnectionManager = function () {
  function ConnectionManager(dialect, sequelize) {
    _classCallCheck(this, ConnectionManager);

    var config = _.cloneDeep(sequelize.config);

    this.sequelize = sequelize;
    this.config = config;
    this.dialect = dialect;
    this.versionPromise = null;
    this.poolError = null;
    this.dialectName = this.sequelize.options.dialect;

    if (config.pool === false) {
      throw new Error('Support for pool:false was removed in v4.0');
    }

    config.pool = _.defaults(config.pool || {}, defaultPoolingConfig, {
      validate: this._validate.bind(this),
      Promise: Promise
    });

    // Save a reference to the bound version so we can remove it with removeListener
    this.onProcessExit = this.onProcessExit.bind(this);

    process.on('exit', this.onProcessExit);

    this.initPools();
  }

  _createClass(ConnectionManager, [{
    key: 'refreshTypeParser',
    value: function refreshTypeParser(dataTypes) {
      var _this = this;

      _.each(dataTypes, function (dataType) {
        if (dataType.hasOwnProperty('parse')) {
          if (dataType.types[_this.dialectName]) {
            _this._refreshTypeParser(dataType);
          } else {
            throw new Error('Parse function not supported for type ' + dataType.key + ' in dialect ' + _this.dialectName);
          }
        }
      });
    }
  }, {
    key: 'onProcessExit',
    value: function onProcessExit() {
      var _this2 = this;

      if (!this.pool) {
        return Promise.resolve();
      }

      return this.pool.drain(function () {
        debug('connection drain due to process exit');
        return _this2.pool.clear();
      });
    }
  }, {
    key: 'close',
    value: function close() {
      // Remove the listener, so all references to this instance can be garbage collected.
      process.removeListener('exit', this.onProcessExit);

      // Mark close of pool
      this.getConnection = function getConnection() {
        return Promise.reject(new Error('ConnectionManager.getConnection was called after the connection manager was closed!'));
      };

      return this.onProcessExit();
    }
  }, {
    key: 'initPools',
    value: function initPools() {
      var _this3 = this;

      var config = this.config;

      if (!config.replication) {
        this.pool = Pooling.createPool({
          create: function create() {
            return new Promise(function (resolve) {
              _this3._connect(config).tap(function () {
                _this3.poolError = null;
              }).then(resolve).catch(function (e) {
                // dont throw otherwise pool will release _dispense call
                // which will call _connect even if error is fatal
                // https://github.com/coopernurse/node-pool/issues/161
                _this3.poolError = e;
              });
            });
          },
          destroy: function destroy(connection) {
            return _this3._disconnect(connection).tap(function () {
              debug('connection destroy');
            });
          },
          validate: config.pool.validate
        }, {
          Promise: config.pool.Promise,
          max: config.pool.max,
          min: config.pool.min,
          testOnBorrow: true,
          autostart: false,
          acquireTimeoutMillis: config.pool.acquire,
          idleTimeoutMillis: config.pool.idle
        });

        this.pool.on('factoryCreateError', function (error) {
          _this3.poolError = error;
        });

        debug('pool created max/min: ' + config.pool.max + '/' + config.pool.min + ' with no replication');
        return;
      }

      var reads = 0;

      if (!Array.isArray(config.replication.read)) {
        config.replication.read = [config.replication.read];
      }

      // Map main connection config
      config.replication.write = _.defaults(config.replication.write, _.omit(config, 'replication'));

      // Apply defaults to each read config
      config.replication.read = _.map(config.replication.read, function (readConfig) {
        return _.defaults(readConfig, _.omit(_this3.config, 'replication'));
      });

      // custom pooling for replication (original author @janmeier)
      this.pool = {
        release: function release(client) {
          if (client.queryType === 'read') {
            return _this3.pool.read.release(client);
          } else {
            return _this3.pool.write.release(client);
          }
        },
        acquire: function acquire(priority, queryType, useMaster) {
          useMaster = _.isUndefined(useMaster) ? false : useMaster;
          if (queryType === 'SELECT' && !useMaster) {
            return _this3.pool.read.acquire(priority);
          } else {
            return _this3.pool.write.acquire(priority);
          }
        },
        destroy: function destroy(connection) {
          debug('connection destroy');
          return _this3.pool[connection.queryType].destroy(connection);
        },
        clear: function clear() {
          debug('all connection clear');
          return Promise.join(_this3.pool.read.clear(), _this3.pool.write.clear());
        },
        drain: function drain() {
          return Promise.join(_this3.pool.write.drain(), _this3.pool.read.drain());
        },
        read: Pooling.createPool({
          create: function create() {
            var nextRead = reads++ % config.replication.read.length; // round robin config
            return new Promise(function (resolve) {
              _this3._connect(config.replication.read[nextRead]).tap(function (connection) {
                connection.queryType = 'read';
                _this3.poolError = null;
                resolve(connection);
              }).catch(function (e) {
                _this3.poolError = e;
              });
            });
          },
          destroy: function destroy(connection) {
            return _this3._disconnect(connection);
          },
          validate: config.pool.validate
        }, {
          Promise: config.pool.Promise,
          max: config.pool.max,
          min: config.pool.min,
          testOnBorrow: true,
          autostart: false,
          acquireTimeoutMillis: config.pool.acquire,
          idleTimeoutMillis: config.pool.idle
        }),
        write: Pooling.createPool({
          create: function create() {
            return new Promise(function (resolve) {
              _this3._connect(config.replication.write).then(function (connection) {
                connection.queryType = 'write';
                _this3.poolError = null;
                return resolve(connection);
              }).catch(function (e) {
                _this3.poolError = e;
              });
            });
          },
          destroy: function destroy(connection) {
            return _this3._disconnect(connection);
          },
          validate: config.pool.validate
        }, {
          Promise: config.pool.Promise,
          max: config.pool.max,
          min: config.pool.min,
          testOnBorrow: true,
          autostart: false,
          acquireTimeoutMillis: config.pool.acquire,
          idleTimeoutMillis: config.pool.idle
        })
      };

      this.pool.read.on('factoryCreateError', function (error) {
        _this3.poolError = error;
      });

      this.pool.write.on('factoryCreateError', function (error) {
        _this3.poolError = error;
      });
    }
  }, {
    key: 'getConnection',
    value: function getConnection(options) {
      var _this4 = this;

      options = options || {};

      var promise = void 0;
      if (this.sequelize.options.databaseVersion === 0) {
        if (this.versionPromise) {
          promise = this.versionPromise;
        } else {
          promise = this.versionPromise = this._connect(this.config.replication.write || this.config).then(function (connection) {
            var _options = {};
            _options.transaction = { connection: connection }; // Cheat .query to use our private connection
            _options.logging = function () {};
            _options.logging.__testLoggingFn = true;

            return _this4.sequelize.databaseVersion(_options).then(function (version) {
              _this4.sequelize.options.databaseVersion = semver.valid(version) ? version : _this4.defaultVersion;
              _this4.versionPromise = null;

              return _this4._disconnect(connection);
            });
          }).catch(function (err) {
            _this4.versionPromise = null;
            throw err;
          });
        }
      } else {
        promise = Promise.resolve();
      }

      return promise.then(function () {
        return new Promise(function (resolve, reject) {
          var connectionPromise = _this4.pool.acquire(options.priority, options.type, options.useMaster);
          var connectionTimer = timers.setInterval(function () {
            var evictTimer = false;

            if (connectionPromise.isFulfilled()) {
              resolve(connectionPromise);
              debug('connection acquire');
              evictTimer = true;
            } else if (_this4.poolError) {
              reject(_this4.poolError);
              _this4.poolError = null;
              evictTimer = true;
            } else if (connectionPromise.isRejected()) {
              connectionPromise.catch(reject);
              evictTimer = true;
            }

            if (evictTimer) {
              timers.clearInterval(connectionTimer);
            }
          }, 0);
        });
      });
    }
  }, {
    key: 'releaseConnection',
    value: function releaseConnection(connection) {
      return this.pool.release(connection).tap(function () {
        debug('connection released');
      });
    }
  }, {
    key: '_connect',
    value: function _connect(config) {
      var _this5 = this;

      return this.sequelize.runHooks('beforeConnect', config).then(function () {
        return _this5.dialect.connectionManager.connect(config);
      }).then(function (connection) {
        return _this5.sequelize.runHooks('afterConnect', connection, config).return(connection);
      });
    }
  }, {
    key: '_disconnect',
    value: function _disconnect(connection) {
      return this.dialect.connectionManager.disconnect(connection);
    }
  }, {
    key: '_validate',
    value: function _validate(connection) {
      if (!this.dialect.connectionManager.validate) return true;
      return this.dialect.connectionManager.validate(connection);
    }
  }]);

  return ConnectionManager;
}();

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;