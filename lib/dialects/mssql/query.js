'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('sql:mssql');
var Promise = require('../../promise');
var AbstractQuery = require('../abstract/query');
var sequelizeErrors = require('../../errors.js');
var parserStore = require('../parserStore')('mssql');
var _ = require('lodash');

var Query = function (_AbstractQuery) {
  _inherits(Query, _AbstractQuery);

  function Query(connection, sequelize, options) {
    _classCallCheck(this, Query);

    var _this = _possibleConstructorReturn(this, (Query.__proto__ || Object.getPrototypeOf(Query)).call(this));

    _this.connection = connection;
    _this.instance = options.instance;
    _this.model = options.model;
    _this.sequelize = sequelize;
    _this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {});

    _this.checkLoggingOption();
    return _this;
  }

  _createClass(Query, [{
    key: 'getInsertIdField',
    value: function getInsertIdField() {
      return 'id';
    }
  }, {
    key: '_run',
    value: function _run(connection, sql) {
      var _this2 = this;

      this.sql = sql;

      //do we need benchmark for this query execution
      var benchmark = this.sequelize.options.benchmark || this.options.benchmark;
      var queryBegin = void 0;
      if (benchmark) {
        queryBegin = Date.now();
      } else {
        this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);
      }

      debug('executing(' + (this.connection.uuid || 'default') + ') : ' + this.sql);

      return new Promise(function (resolve, reject) {
        // TRANSACTION SUPPORT
        if (_.startsWith(_this2.sql, 'BEGIN TRANSACTION')) {
          connection.beginTransaction(function (err) {
            if (err) {
              reject(_this2.formatError(err));
            } else {
              resolve(_this2.formatResults());
            }
          }, _this2.options.transaction.name, Utils.mapIsolationLevelStringToTedious(_this2.options.isolationLevel, connection.lib));
        } else if (_.startsWith(_this2.sql, 'COMMIT TRANSACTION')) {
          connection.commitTransaction(function (err) {
            if (err) {
              reject(_this2.formatError(err));
            } else {
              resolve(_this2.formatResults());
            }
          });
        } else if (_.startsWith(_this2.sql, 'ROLLBACK TRANSACTION')) {
          connection.rollbackTransaction(function (err) {
            if (err) {
              reject(_this2.formatError(err));
            } else {
              resolve(_this2.formatResults());
            }
          }, _this2.options.transaction.name);
        } else if (_.startsWith(_this2.sql, 'SAVE TRANSACTION')) {
          connection.saveTransaction(function (err) {
            if (err) {
              reject(_this2.formatError(err));
            } else {
              resolve(_this2.formatResults());
            }
          }, _this2.options.transaction.name);
        } else {
          var results = [];
          var request = new connection.lib.Request(_this2.sql, function (err, rowCount) {

            debug('executed(' + (_this2.connection.uuid || 'default') + ') : ' + _this2.sql);

            if (benchmark) {
              _this2.sequelize.log('Executed (' + (_this2.connection.uuid || 'default') + '): ' + _this2.sql, Date.now() - queryBegin, _this2.options);
            }

            if (err) {
              err.sql = sql;
              reject(_this2.formatError(err));
            } else {
              resolve(_this2.formatResults(results, rowCount));
            }
          });

          request.on('row', function (columns) {
            var row = {};
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = columns[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var column = _step.value;

                var typeid = column.metadata.type.id;
                var parse = parserStore.get(typeid);
                var value = column.value;

                if (value !== null & !!parse) {
                  value = parse(value);
                }
                row[column.metadata.colName] = value;
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

            results.push(row);
          });

          connection.execSql(request);
        }
      });
    }
  }, {
    key: 'run',
    value: function run(sql, parameters) {
      var _this3 = this;

      return Promise.using(this.connection.lock(), function (connection) {
        return _this3._run(connection, sql, parameters);
      });
    }

    /**
     * High level function that handles the results of a query execution.
     *
     *
     * Example:
     *  query.formatResults([
     *    {
     *      id: 1,              // this is from the main table
     *      attr2: 'snafu',     // this is from the main table
     *      Tasks.id: 1,        // this is from the associated table
     *      Tasks.title: 'task' // this is from the associated table
     *    }
     *  ])
     *
     * @param {Array} data - The result of the query execution.
     * @private
     */

  }, {
    key: 'formatResults',
    value: function formatResults(data, rowCount) {
      var result = this.instance;
      if (this.isInsertQuery(data)) {
        this.handleInsertQuery(data);

        if (!this.instance) {
          if (this.options.plain) {
            // NOTE: super contrived. This just passes the newly added query-interface
            //       test returning only the PK. There isn't a way in MSSQL to identify
            //       that a given return value is the PK, and we have no schema information
            //       because there was no calling Model.
            var record = data[0];
            result = record[Object.keys(record)[0]];
          } else {
            result = data;
          }
        }
      }

      if (this.isShowTablesQuery()) {
        result = this.handleShowTablesQuery(data);
      } else if (this.isDescribeQuery()) {
        result = {};
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = data[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _result = _step2.value;

            if (_result.Default) {
              _result.Default = _result.Default.replace("('", '').replace("')", '').replace(/'/g, '');
            }

            result[_result.Name] = {
              type: _result.Type.toUpperCase(),
              allowNull: _result.IsNull === 'YES' ? true : false,
              defaultValue: _result.Default,
              primaryKey: _result.Constraint === 'PRIMARY KEY'
            };
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
      } else if (this.isShowIndexesQuery()) {
        result = this.handleShowIndexesQuery(data);
      } else if (this.isSelectQuery()) {
        result = this.handleSelectQuery(data);
      } else if (this.isUpsertQuery()) {
        //Use the same return value as that of MySQL & Postgres
        if (data[0].$action === 'INSERT') {
          result = 1;
        } else {
          result = 2;
        }
      } else if (this.isCallQuery()) {
        result = data[0];
      } else if (this.isBulkUpdateQuery()) {
        result = data.length;
      } else if (this.isBulkDeleteQuery()) {
        result = data[0] && data[0].AFFECTEDROWS;
      } else if (this.isVersionQuery()) {
        result = data[0].version;
      } else if (this.isForeignKeysQuery()) {
        result = data;
      } else if (this.isInsertQuery() || this.isUpdateQuery()) {
        result = [result, rowCount];
      } else if (this.isShowConstraintsQuery()) {
        result = this.handleShowConstraintsQuery(data);
      } else if (this.isRawQuery()) {
        // MSSQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
        result = [data, data];
      }

      return result;
    }
  }, {
    key: 'handleShowTablesQuery',
    value: function handleShowTablesQuery(results) {
      return results.map(function (resultSet) {
        return {
          tableName: resultSet.TABLE_NAME,
          schema: resultSet.TABLE_SCHEMA
        };
      });
    }
  }, {
    key: 'handleShowConstraintsQuery',
    value: function handleShowConstraintsQuery(data) {
      //Convert snake_case keys to camelCase as its generated by stored procedure
      return data.slice(1).map(function (result) {
        var constraint = {};
        for (var key in result) {
          constraint[_.camelCase(key)] = result[key];
        }
        return constraint;
      });
    }
  }, {
    key: 'formatError',
    value: function formatError(err) {
      var _this4 = this;

      var match = void 0;
      match = err.message.match(/Violation of UNIQUE KEY constraint '((.|\s)*)'. Cannot insert duplicate key in object '.*'.(:? The duplicate key value is \((.*)\).)?/);
      match = match || err.message.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'/);
      if (match && match.length > 1) {
        var fields = {};
        var uniqueKey = this.model && this.model.uniqueKeys[match[1]];
        var message = 'Validation error';

        if (uniqueKey && !!uniqueKey.msg) {
          message = uniqueKey.msg;
        }
        if (match[4]) {
          var values = match[4].split(',').map(function (part) {
            return part.trim();
          });
          if (uniqueKey) {
            fields = Utils._.zipObject(uniqueKey.fields, values);
          } else {
            fields[match[1]] = match[4];
          }
        }

        var errors = [];
        Utils._.forOwn(fields, function (value, field) {
          errors.push(new sequelizeErrors.ValidationErrorItem(_this4.getUniqueConstraintErrorMessage(field), 'unique violation', field, value));
        });

        return new sequelizeErrors.UniqueConstraintError({ message: message, errors: errors, parent: err, fields: fields });
      }

      match = err.message.match(/Failed on step '(.*)'.Could not create constraint. See previous errors./) || err.message.match(/The DELETE statement conflicted with the REFERENCE constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) || err.message.match(/The INSERT statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) || err.message.match(/The MERGE statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) || err.message.match(/The UPDATE statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./);
      if (match && match.length > 0) {
        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: match[1],
          parent: err
        });
      }

      match = err.message.match(/Could not drop constraint. See previous errors./);

      if (match && match.length > 0) {
        return new sequelizeErrors.UnknownConstraintError(match[1]);
      }

      return new sequelizeErrors.DatabaseError(err);
    }
  }, {
    key: 'isShowOrDescribeQuery',
    value: function isShowOrDescribeQuery() {
      var result = false;

      result = result || this.sql.toLowerCase().indexOf("select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'") === 0;
      result = result || this.sql.toLowerCase().indexOf('select tablename = t.name, name = ind.name,') === 0;
      result = result || this.sql.toLowerCase().indexOf('exec sys.sp_helpindex @objname') === 0;

      return result;
    }
  }, {
    key: 'isShowIndexesQuery',
    value: function isShowIndexesQuery() {
      return this.sql.toLowerCase().indexOf('exec sys.sp_helpindex @objname') === 0;
    }
  }, {
    key: 'handleShowIndexesQuery',
    value: function handleShowIndexesQuery(data) {
      // Group by index name, and collect all fields
      data = _.reduce(data, function (acc, item) {
        if (!(item.index_name in acc)) {
          acc[item.index_name] = item;
          item.fields = [];
        }

        Utils._.forEach(item.index_keys.split(','), function (column) {
          var columnName = column.trim();
          if (columnName.indexOf('(-)') !== -1) {
            columnName = columnName.replace('(-)', '');
          }

          acc[item.index_name].fields.push({
            attribute: columnName,
            length: undefined,
            order: column.indexOf('(-)') !== -1 ? 'DESC' : 'ASC',
            collate: undefined
          });
        });
        delete item.index_keys;
        return acc;
      }, {});

      return Utils._.map(data, function (item) {
        return {
          primary: item.index_name.toLowerCase().indexOf('pk') === 0,
          fields: item.fields,
          name: item.index_name,
          tableName: undefined,
          unique: item.index_description.toLowerCase().indexOf('unique') !== -1,
          type: undefined
        };
      });
    }
  }, {
    key: 'handleInsertQuery',
    value: function handleInsertQuery(results, metaData) {
      if (this.instance) {
        // add the inserted row id to the instance
        var autoIncrementField = this.model.autoIncrementField;
        var id = null;
        var autoIncrementFieldAlias = null;

        if (this.model.rawAttributes.hasOwnProperty(autoIncrementField) && this.model.rawAttributes[autoIncrementField].field !== undefined) autoIncrementFieldAlias = this.model.rawAttributes[autoIncrementField].field;

        id = id || results && results[0][this.getInsertIdField()];
        id = id || metaData && metaData[this.getInsertIdField()];
        id = id || results && results[0][autoIncrementField];
        id = id || autoIncrementFieldAlias && results && results[0][autoIncrementFieldAlias];

        this.instance[autoIncrementField] = id;
      }
    }
  }]);

  return Query;
}(AbstractQuery);

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
//# sourceMappingURL=query.js.map