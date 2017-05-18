'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractConnectionManager = require('../abstract/connection-manager');
var Promise = require('../../promise');
var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('connection:sqlite');
var dataTypes = require('../../data-types').sqlite;
var sequelizeErrors = require('../../errors');
var parserStore = require('../parserStore')('sqlite');

var ConnectionManager = function (_AbstractConnectionMa) {
  _inherits(ConnectionManager, _AbstractConnectionMa);

  function ConnectionManager(dialect, sequelize) {
    _classCallCheck(this, ConnectionManager);

    var _this = _possibleConstructorReturn(this, (ConnectionManager.__proto__ || Object.getPrototypeOf(ConnectionManager)).call(this, dialect, sequelize));

    _this.sequelize = sequelize;
    _this.config = sequelize.config;
    _this.dialect = dialect;
    _this.dialectName = _this.sequelize.options.dialect;
    _this.connections = {};

    // We attempt to parse file location from a connection uri but we shouldn't match sequelize default host.
    if (_this.sequelize.options.host === 'localhost') delete _this.sequelize.options.host;

    try {
      if (sequelize.config.dialectModulePath) {
        _this.lib = require(sequelize.config.dialectModulePath).verbose();
      } else {
        _this.lib = require('sqlite3').verbose();
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install sqlite3 package manually');
      }
      throw err;
    }

    _this.refreshTypeParser(dataTypes);
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
    key: 'getConnection',
    value: function getConnection(options) {
      var _this2 = this;

      options = options || {};
      options.uuid = options.uuid || 'default';
      options.inMemory = (this.sequelize.options.storage || this.sequelize.options.host || ':memory:') === ':memory:' ? 1 : 0;

      var dialectOptions = this.sequelize.options.dialectOptions;
      options.readWriteMode = dialectOptions && dialectOptions.mode;

      if (this.connections[options.inMemory || options.uuid]) {
        return Promise.resolve(this.connections[options.inMemory || options.uuid]);
      }

      return new Promise(function (resolve, reject) {
        _this2.connections[options.inMemory || options.uuid] = new _this2.lib.Database(_this2.sequelize.options.storage || _this2.sequelize.options.host || ':memory:', options.readWriteMode || _this2.lib.OPEN_READWRITE | _this2.lib.OPEN_CREATE, // default mode
        function (err) {
          if (err) {
            if (err.code === 'SQLITE_CANTOPEN') return reject(new sequelizeErrors.ConnectionError(err));
            return reject(new sequelizeErrors.ConnectionError(err));
          }
          debug('connection acquired ' + options.uuid);
          resolve(_this2.connections[options.inMemory || options.uuid]);
        });
      }).tap(function (connection) {
        if (_this2.sequelize.config.password) {
          // Make it possible to define and use password for sqlite encryption plugin like sqlcipher
          connection.run('PRAGMA KEY=' + _this2.sequelize.escape(_this2.sequelize.config.password));
        }
        if (_this2.sequelize.options.foreignKeys !== false) {
          // Make it possible to define and use foreign key constraints unless
          // explicitly disallowed. It's still opt-in per relation
          connection.run('PRAGMA FOREIGN_KEYS=ON');
        }
      });
    }
  }, {
    key: 'releaseConnection',
    value: function releaseConnection(connection, force) {
      if (connection.filename === ':memory:' && force !== true) return;

      if (connection.uuid) {
        connection.close();
        debug('connection released ' + connection.uuid);
        delete this.connections[connection.uuid];
      }
    }
  }]);

  return ConnectionManager;
}(AbstractConnectionManager);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
//# sourceMappingURL=connection-manager.js.map