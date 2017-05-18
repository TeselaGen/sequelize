'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('sql:sqlite');
var Promise = require('../../promise');
var AbstractQuery = require('../abstract/query');
var QueryTypes = require('../../query-types');
var sequelizeErrors = require('../../errors.js');
var parserStore = require('../parserStore')('sqlite');

var Query = function (_AbstractQuery) {
  _inherits(Query, _AbstractQuery);

  function Query(database, sequelize, options) {
    _classCallCheck(this, Query);

    var _this = _possibleConstructorReturn(this, (Query.__proto__ || Object.getPrototypeOf(Query)).call(this));

    _this.database = database;
    _this.sequelize = sequelize;
    _this.instance = options.instance;
    _this.model = options.model;
    _this.options = _.extend({
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
      return 'lastID';
    }

    /**
     * rewrite query with parameters
     * @private
     */

  }, {
    key: '_collectModels',
    value: function _collectModels(include, prefix) {
      var ret = {};

      if (include) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = include[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _include = _step.value;

            var key = void 0;
            if (!prefix) {
              key = _include.as;
            } else {
              key = prefix + '.' + _include.as;
            }
            ret[key] = _include.model;

            if (_include.include) {
              _.merge(ret, this._collectModels(_include.include, key));
            }
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

      return ret;
    }
  }, {
    key: 'run',
    value: function run(sql, parameters) {
      var _this2 = this;

      this.sql = sql;
      var method = this.getDatabaseMethod();
      if (method === 'exec') {
        // exec does not support bind parameter
        sql = AbstractQuery.formatBindParameters(sql, this.options.bind, this.options.dialect, { skipUnescape: true })[0];
        this.sql = sql;
      }

      //do we need benchmark for this query execution
      var benchmark = this.sequelize.options.benchmark || this.options.benchmark;

      var queryBegin = void 0;
      if (benchmark) {
        queryBegin = Date.now();
      } else {
        this.sequelize.log('Executing (' + (this.database.uuid || 'default') + '): ' + this.sql, this.options);
      }

      debug('executing(' + (this.database.uuid || 'default') + ') : ' + this.sql);

      return new Promise(function (resolve) {
        var columnTypes = {};
        _this2.database.serialize(function () {
          var executeSql = function executeSql() {
            if (_this2.sql.indexOf('-- ') === 0) {
              return resolve();
            } else {
              resolve(new Promise(function (resolve, reject) {
                var query = _this2;
                // cannot use arrow function here because the function is bound to the statement
                function afterExecute(err, results) {
                  debug('executed(' + (query.database.uuid || 'default') + ') : ' + query.sql);

                  if (benchmark) {
                    query.sequelize.log('Executed (' + (query.database.uuid || 'default') + '): ' + query.sql, Date.now() - queryBegin, query.options);
                  }

                  if (err) {
                    err.sql = query.sql;
                    reject(query.formatError(err));
                  } else {
                    var metaData = this;
                    var result = query.instance;

                    // add the inserted row id to the instance
                    if (query.isInsertQuery(results, metaData)) {
                      query.handleInsertQuery(results, metaData);
                      if (!query.instance) {
                        // handle bulkCreate AI primary key
                        if (metaData.constructor.name === 'Statement' && query.model && query.model.autoIncrementField && query.model.autoIncrementField === query.model.primaryKeyAttribute && query.model.rawAttributes[query.model.primaryKeyAttribute]) {
                          var startId = metaData[query.getInsertIdField()] - metaData.changes + 1;
                          result = [];
                          for (var i = startId; i < startId + metaData.changes; i++) {
                            result.push(_defineProperty({}, query.model.rawAttributes[query.model.primaryKeyAttribute].field, i));
                          }
                        } else {
                          result = metaData[query.getInsertIdField()];
                        }
                      }
                    }

                    if (query.sql.indexOf('sqlite_master') !== -1) {
                      if (query.sql.indexOf('SELECT sql FROM sqlite_master WHERE tbl_name') !== -1) {
                        result = results;
                        if (result && result[0] && result[0].sql.indexOf('CONSTRAINT') !== -1) {
                          result = query.parseConstraintsFromSql(results[0].sql);
                        }
                      } else {
                        result = results.map(function (resultSet) {
                          return resultSet.name;
                        });
                      }
                    } else if (query.isSelectQuery()) {
                      if (!query.options.raw) {
                        // This is a map of prefix strings to models, e.g. user.projects -> Project model
                        var prefixes = query._collectModels(query.options.include);

                        results = results.map(function (result) {
                          return _.mapValues(result, function (value, name) {
                            var model = void 0;
                            if (name.indexOf('.') !== -1) {
                              var lastind = name.lastIndexOf('.');

                              model = prefixes[name.substr(0, lastind)];

                              name = name.substr(lastind + 1);
                            } else {
                              model = query.options.model;
                            }

                            var tableName = model.getTableName().toString().replace(/`/g, '');
                            var tableTypes = columnTypes[tableName] || {};

                            if (tableTypes && !(name in tableTypes)) {
                              // The column is aliased
                              _.forOwn(model.rawAttributes, function (attribute, key) {
                                if (name === key && attribute.field) {
                                  name = attribute.field;
                                  return false;
                                }
                              });
                            }

                            return tableTypes[name] ? query.applyParsers(tableTypes[name], value) : value;
                          });
                        });
                      }

                      result = query.handleSelectQuery(results);
                    } else if (query.isShowOrDescribeQuery()) {
                      result = results;
                    } else if (query.sql.indexOf('PRAGMA INDEX_LIST') !== -1) {
                      result = query.handleShowIndexesQuery(results);
                    } else if (query.sql.indexOf('PRAGMA INDEX_INFO') !== -1) {
                      result = results;
                    } else if (query.sql.indexOf('PRAGMA TABLE_INFO') !== -1) {
                      // this is the sqlite way of getting the metadata of a table
                      result = {};

                      var defaultValue = void 0;
                      var _iteratorNormalCompletion2 = true;
                      var _didIteratorError2 = false;
                      var _iteratorError2 = undefined;

                      try {
                        for (var _iterator2 = results[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                          var _result = _step2.value;

                          if (_result.dflt_value === null) {
                            // Column schema omits any "DEFAULT ..."
                            defaultValue = undefined;
                          } else if (_result.dflt_value === 'NULL') {
                            // Column schema is a "DEFAULT NULL"
                            defaultValue = null;
                          } else {
                            defaultValue = _result.dflt_value;
                          }

                          result[_result.name] = {
                            type: _result.type,
                            allowNull: _result.notnull === 0,
                            defaultValue: defaultValue,
                            primaryKey: _result.pk !== 0
                          };

                          if (result[_result.name].type === 'TINYINT(1)') {
                            result[_result.name].defaultValue = { '0': false, '1': true }[result[_result.name].defaultValue];
                          }

                          if (typeof result[_result.name].defaultValue === 'string') {
                            result[_result.name].defaultValue = result[_result.name].defaultValue.replace(/'/g, '');
                          }
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
                    } else if (query.sql.indexOf('PRAGMA foreign_keys;') !== -1) {
                      result = results[0];
                    } else if (query.sql.indexOf('PRAGMA foreign_keys') !== -1) {
                      result = results;
                    } else if (query.sql.indexOf('PRAGMA foreign_key_list') !== -1) {
                      result = results;
                    } else if ([QueryTypes.BULKUPDATE, QueryTypes.BULKDELETE].indexOf(query.options.type) !== -1) {
                      result = metaData.changes;
                    } else if (query.options.type === QueryTypes.UPSERT) {
                      result = undefined;
                    } else if (query.options.type === QueryTypes.VERSION) {
                      result = results[0].version;
                    } else if (query.options.type === QueryTypes.RAW) {
                      result = [results, metaData];
                    } else if (query.isUpdateQuery() || query.isInsertQuery()) {
                      result = [result, metaData.changes];
                    }

                    resolve(result);
                  }
                }

                if (method === 'exec') {
                  // exec does not support bind parameter
                  _this2.database[method](_this2.sql, afterExecute);
                } else {
                  if (!parameters) parameters = [];
                  _this2.database[method](_this2.sql, parameters, afterExecute);
                }
              }));
              return null;
            }
          };

          if (_this2.getDatabaseMethod() === 'all') {
            var tableNames = [];
            if (_this2.options && _this2.options.tableNames) {
              tableNames = _this2.options.tableNames;
            } else if (/FROM `(.*?)`/i.exec(_this2.sql)) {
              tableNames.push(/FROM `(.*?)`/i.exec(_this2.sql)[1]);
            }

            // If we already have the metadata for the table, there's no need to ask for it again
            tableNames = _.filter(tableNames, function (tableName) {
              return !(tableName in columnTypes) && tableName !== 'sqlite_master';
            });

            if (!tableNames.length) {
              return executeSql();
            } else {
              return Promise.map(tableNames, function (tableName) {
                return new Promise(function (resolve) {
                  tableName = tableName.replace(/`/g, '');
                  columnTypes[tableName] = {};

                  _this2.database.all('PRAGMA table_info(`' + tableName + '`)', function (err, results) {
                    if (!err) {
                      var _iteratorNormalCompletion3 = true;
                      var _didIteratorError3 = false;
                      var _iteratorError3 = undefined;

                      try {
                        for (var _iterator3 = results[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                          var result = _step3.value;

                          columnTypes[tableName][result.name] = result.type;
                        }
                      } catch (err) {
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion3 && _iterator3.return) {
                            _iterator3.return();
                          }
                        } finally {
                          if (_didIteratorError3) {
                            throw _iteratorError3;
                          }
                        }
                      }
                    }
                    resolve();
                  });
                });
              }).then(executeSql);
            }
          } else {
            return executeSql();
          }
        });
      });
    }
  }, {
    key: 'parseConstraintsFromSql',
    value: function parseConstraintsFromSql(sql) {
      var constraints = sql.split('CONSTRAINT ');
      var referenceTableName = void 0,
          referenceTableKeys = void 0,
          updateAction = void 0,
          deleteAction = void 0;
      constraints.splice(0, 1);
      constraints = constraints.map(function (constraintSql) {
        //Parse foreign key snippets
        if (constraintSql.indexOf('REFERENCES') !== -1) {
          //Parse out the constraint condition form sql string
          updateAction = constraintSql.match(/ON UPDATE (CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT){1}/);
          deleteAction = constraintSql.match(/ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT){1}/);

          if (updateAction) {
            updateAction = updateAction[1];
          }

          if (deleteAction) {
            deleteAction = deleteAction[1];
          }

          var referencesRegex = /REFERENCES.+\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/;
          var referenceConditions = constraintSql.match(referencesRegex)[0].split(' ');
          referenceTableName = Utils.removeTicks(referenceConditions[1]);
          var columnNames = referenceConditions[2];
          columnNames = columnNames.replace(/\(|\)/g, '').split(', ');
          referenceTableKeys = columnNames.map(function (column) {
            return Utils.removeTicks(column);
          });
        }

        var constraintCondition = constraintSql.match(/\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)/)[0];
        constraintSql = constraintSql.replace(/\(.+\)/, '');
        var constraint = constraintSql.split(' ');

        if (constraint[1] === 'PRIMARY' || constraint[1] === 'FOREIGN') {
          constraint[1] += ' KEY';
        }

        return {
          constraintName: Utils.removeTicks(constraint[0]),
          constraintType: constraint[1],
          updateAction: updateAction,
          deleteAction: deleteAction,
          sql: sql.replace(/\"/g, '\`'), //Sqlite returns double quotes for table name
          constraintCondition: constraintCondition,
          referenceTableName: referenceTableName,
          referenceTableKeys: referenceTableKeys
        };
      });

      return constraints;
    }
  }, {
    key: 'applyParsers',
    value: function applyParsers(type, value) {
      if (type.indexOf('(') !== -1) {
        // Remove the length part
        type = type.substr(0, type.indexOf('('));
      }
      type = type.replace('UNSIGNED', '').replace('ZEROFILL', '');
      type = type.trim().toUpperCase();
      var parse = parserStore.get(type);

      if (value !== null && parse) {
        return parse(value, { timezone: this.sequelize.options.timezone });
      }
      return value;
    }
  }, {
    key: 'formatError',
    value: function formatError(err) {

      switch (err.code) {
        case 'SQLITE_CONSTRAINT':
          {
            var match = err.message.match(/FOREIGN KEY constraint failed/);
            if (match !== null) {
              return new sequelizeErrors.ForeignKeyConstraintError({
                parent: err
              });
            }

            var fields = [];

            // Sqlite pre 2.2 behavior - Error: SQLITE_CONSTRAINT: columns x, y are not unique
            match = err.message.match(/columns (.*?) are/);
            if (match !== null && match.length >= 2) {
              fields = match[1].split(', ');
            } else {

              // Sqlite post 2.2 behavior - Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: table.x, table.y
              match = err.message.match(/UNIQUE constraint failed: (.*)/);
              if (match !== null && match.length >= 2) {
                fields = match[1].split(', ').map(function (columnWithTable) {
                  return columnWithTable.split('.')[1];
                });
              }
            }

            var errors = [];
            var message = 'Validation error';

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
              for (var _iterator4 = fields[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                var field = _step4.value;

                errors.push(new sequelizeErrors.ValidationErrorItem(this.getUniqueConstraintErrorMessage(field), 'unique violation', field, this.instance && this.instance[field]));
              }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                  _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }

            if (this.model) {
              _.forOwn(this.model.uniqueKeys, function (constraint) {
                if (_.isEqual(constraint.fields, fields) && !!constraint.msg) {
                  message = constraint.msg;
                  return false;
                }
              });
            }

            return new sequelizeErrors.UniqueConstraintError({ message: message, errors: errors, parent: err, fields: fields });
          }
        case 'SQLITE_BUSY':
          return new sequelizeErrors.TimeoutError(err);

        default:
          return new sequelizeErrors.DatabaseError(err);
      }
    }
  }, {
    key: 'handleShowIndexesQuery',
    value: function handleShowIndexesQuery(data) {
      var _this3 = this;

      // Sqlite returns indexes so the one that was defined last is returned first. Lets reverse that!
      return this.sequelize.Promise.map(data.reverse(), function (item) {
        item.fields = [];
        item.primary = false;
        item.unique = !!item.unique;
        item.constraintName = item.name;
        return _this3.run('PRAGMA INDEX_INFO(`' + item.name + '`)').then(function (columns) {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = columns[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              var column = _step5.value;

              item.fields[column.seqno] = {
                attribute: column.name,
                length: undefined,
                order: undefined
              };
            }
          } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
              }
            } finally {
              if (_didIteratorError5) {
                throw _iteratorError5;
              }
            }
          }

          return item;
        });
      });
    }
  }, {
    key: 'getDatabaseMethod',
    value: function getDatabaseMethod() {
      if (this.isUpsertQuery()) {
        return 'exec'; // Needed to run multiple queries in one
      } else if (this.isInsertQuery() || this.isUpdateQuery() || this.isBulkUpdateQuery() || this.sql.toLowerCase().indexOf('CREATE TEMPORARY TABLE'.toLowerCase()) !== -1 || this.options.type === QueryTypes.BULKDELETE) {
        return 'run';
      } else {
        return 'all';
      }
    }
  }], [{
    key: 'formatBindParameters',
    value: function formatBindParameters(sql, values, dialect) {
      var bindParam = void 0;
      if (Array.isArray(values)) {
        bindParam = {};
        values.forEach(function (v, i) {
          bindParam['$' + (i + 1)] = v;
        });
        sql = AbstractQuery.formatBindParameters(sql, values, dialect, { skipValueReplace: true })[0];
      } else {
        bindParam = {};
        if ((typeof values === 'undefined' ? 'undefined' : _typeof(values)) === 'object') {
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;
          var _iteratorError6 = undefined;

          try {
            for (var _iterator6 = Object.keys(values)[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              var k = _step6.value;

              bindParam['$' + k] = values[k];
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        }
        sql = AbstractQuery.formatBindParameters(sql, values, dialect, { skipValueReplace: true })[0];
      }
      return [sql, bindParam];
    }
  }]);

  return Query;
}(AbstractQuery);

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
//# sourceMappingURL=query.js.map