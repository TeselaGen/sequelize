'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractConnectionManager = require('../abstract/connection-manager');
var Promise = require('../../promise');
var sequelizeErrors = require('../../errors');
var parserStore = require('../parserStore')('oracle');

var ConnectionManager = function (_AbstractConnectionMa) {
  _inherits(ConnectionManager, _AbstractConnectionMa);

  function ConnectionManager(dialect, sequelize) {
    _classCallCheck(this, ConnectionManager);

    var _this = _possibleConstructorReturn(this, (ConnectionManager.__proto__ || Object.getPrototypeOf(ConnectionManager)).call(this, dialect, sequelize));

    _this.sequelize = sequelize;
    _this.sequelize.config.port = _this.sequelize.config.port || 1521;
    try {
      if (sequelize.config.dialectModulePath) {
        _this.lib = require(sequelize.config.dialectModulePath);
      } else {
        _this.lib = require('oracledb');
        _this.lib.maxRows = 1000;

        if (sequelize.config && 'dialectOptions' in sequelize.config) {
          var dialectOptions = sequelize.config.dialectOptions;
          if (dialectOptions && 'maxRows' in dialectOptions) {
            _this.lib.maxRows = sequelize.config.dialectOptions.maxRows;
          }

          if (dialectOptions && 'fetchAsString' in dialectOptions) {
            _this.lib.fetchAsString = sequelize.config.dialectOptions.fetchAsString;
          }
        }
        _this.lib.Promise = Promise;
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install oracledb package manually');
      }
      throw err;
    }

    return _this;
  }

  /**
  * Method for checking the config object passed and generate the full database if not fully passed
  * With dbName, host and port, it generates a string like this : 'host:port/dbname' 
  */


  _createClass(ConnectionManager, [{
    key: 'checkConfigObject',
    value: function checkConfigObject(config) {
      //A connectString should be defined
      if (config.database.length === 0) {
        var errorToThrow = 'The database cannot be blank, you must specify the database name (which correspond to the service name';
        errorToThrow += '\n from tnsnames.ora : (HOST = mymachine.example.com)(PORT = 1521)(SERVICE_NAME = orcl)';
        throw new Error(errorToThrow);
      }

      if (!config.host || config.host.length === 0) {
        throw new Error('You have to specify the host');
      }

      //The connectString has a special format, we check it
      //ConnectString format is : host:[port]/service_name
      if (config.database.indexOf('/') === -1) {

        var connectString = config.host;

        if (config.port && config.port !== 0) {
          connectString += ':' + config.port;
        } else {
          connectString += ':1521'; //Default port number
        }
        connectString += '/' + config.database;
        config.database = connectString;
      }
    }

    // Expose this as a method so that the parsing may be updated when the user has added additional, custom types

  }, {
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
      var self = this;
      return new Promise(function (resolve, reject) {

        var connectionConfig = {
          user: config.username,
          host: config.host,
          port: config.port,
          database: config.database,
          password: config.password,
          externalAuth: config.externalAuth,
          stmtCacheSize: 0
        };

        //We check if there dialect options
        if ('dialectOptions' in config) {
          var dialectOptions = config.dialectOptions;

          //If stmtCacheSize is defined, we set it
          if ('stmtCacheSize' in dialectOptions) {
            connectionConfig.stmtCacheSize = dialectOptions.stmtCacheSize;
          }
        }

        //Check the config object
        self.checkConfigObject(connectionConfig);

        //We assume that the database has been correctly formed
        connectionConfig.connectString = connectionConfig.database;

        if (config.dialectOptions) {
          Object.keys(config.dialectOptions).forEach(function (key) {
            connectionConfig[key] = config.dialectOptions[key];
          });
        }

        return self.lib.getConnection(connectionConfig).then(function (connection) {
          //TODO Oracle - connection pooling
          //Not relevant, node-oracledb considers it if multiple connections are opened / closed; while testing, a few connections are created and closed.
          resolve(connection);
        }).catch(function (err) {
          if (err) {
            //We split to get the error number; it comes as ORA-XXXXX: 
            var errorCode = err.message.split(':');
            errorCode = errorCode[0];

            if (errorCode) {
              switch (errorCode) {
                case 'ORA-28000':
                  //Account locked
                  reject(new sequelizeErrors.ConnectionRefusedError(err));
                  break;
                case 'ORA-01017':
                  reject(new sequelizeErrors.AccessDeniedError(err));
                  break;
                case 'ORA-12154':
                  reject(new sequelizeErrors.HostNotReachableError(err)); //ORA-12154: TNS:could not resolve the connect identifier specified
                  break;
                case 'ORA-12514': // ORA-12514: TNS:listener does not currently know of service requested in connect descriptor
                case 'ORA-12541':
                  //ORA-12541: TNS:No listener
                  //We can't send this kind of error, so we send 'login / password invalid'
                  err.message = 'ORA-01017 : invalid username/password; logon denied';
                  reject(new sequelizeErrors.AccessDeniedError(err));
                  break;
                case 'EINVAL':
                  //TODO
                  reject(new sequelizeErrors.InvalidConnectionError(err));
                  break;
                default:
                  reject(new sequelizeErrors.ConnectionError(err));
                  break;
              }
            } else {
              reject(new sequelizeErrors.ConnectionError(err));
            }

            reject(err); //Unknown error, we throw it anyway
          }
        });
      }).tap(function (connection) {
        //TODO Oracle - see if relevant
        /*if(self.sequelize.options.timezone) {
          return connection.execute("ALTER DATABASE SET time_zone = '" + self.sequelize.options.timezone + "'")
          .then(result => {
            return Promise.resolve(connection);
          });
        }*/
        return Promise.resolve(connection);
      });
    }
  }, {
    key: 'disconnect',
    value: function disconnect(connection) {
      return connection.release().then(function () {
        return true;
      }).catch(function (err) {
        throw new sequelizeErrors.ConnectionError(err);
      });
    }
  }, {
    key: 'validate',
    value: function validate(connection) {
      return connection && ['disconnected', 'protocol_error'].indexOf(connection.state) === -1;
    }
  }]);

  return ConnectionManager;
}(AbstractConnectionManager);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
//# sourceMappingURL=connection-manager.js.map