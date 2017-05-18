'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('sql:pg');
var AbstractQuery = require('../abstract/query');
var QueryTypes = require('../../query-types');
var Promise = require('../../promise');
var sequelizeErrors = require('../../errors.js');
var _ = require('lodash');

var Query = function (_AbstractQuery) {
  _inherits(Query, _AbstractQuery);

  function Query(client, sequelize, options) {
    _classCallCheck(this, Query);

    var _this = _possibleConstructorReturn(this, (Query.__proto__ || Object.getPrototypeOf(Query)).call(this));

    _this.client = client;
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

  /**
   * rewrite query with parameters
   * @private
   */


  _createClass(Query, [{
    key: 'run',
    value: function run(sql, parameters) {
      var _this2 = this;

      this.sql = sql;

      if (!Utils._.isEmpty(this.options.searchPath)) {
        this.sql = this.sequelize.queryInterface.QueryGenerator.setSearchPath(this.options.searchPath) + sql;
      }

      var query = parameters && parameters.length ? this.client.query(this.sql, parameters) : this.client.query(this.sql);
      var rows = [];
      var receivedError = false;

      //do we need benchmark for this query execution
      var benchmark = this.sequelize.options.benchmark || this.options.benchmark;

      var queryBegin = void 0;
      if (benchmark) {
        queryBegin = Date.now();
      } else {
        this.sequelize.log('Executing (' + (this.client.uuid || 'default') + '): ' + this.sql, this.options);
      }

      debug('executing(' + (this.client.uuid || 'default') + ') : ' + this.sql);

      return new Promise(function (resolve, reject) {
        query.on('row', function (row) {
          rows.push(row);
        });

        query.on('error', function (err) {

          // set the client so that it will be reaped if the connection resets while executing
          if (err.code === 'ECONNRESET') {
            _this2.client._invalid = true;
          }

          receivedError = true;
          err.sql = sql;
          reject(_this2.formatError(err));
        });

        query.on('end', function (result) {

          debug('executed(' + (_this2.client.uuid || 'default') + ') : ' + _this2.sql);

          if (benchmark) {
            _this2.sequelize.log('Executed (' + (_this2.client.uuid || 'default') + '): ' + _this2.sql, Date.now() - queryBegin, _this2.options);
          }

          if (receivedError) {
            return;
          }

          resolve([rows, sql, result]);
        });
      }).spread(function (rows, sql, result) {
        var results = rows;
        var isTableNameQuery = sql.indexOf('SELECT table_name FROM information_schema.tables') === 0;
        var isRelNameQuery = sql.indexOf('SELECT relname FROM pg_class WHERE oid IN') === 0;

        if (isRelNameQuery) {
          return rows.map(function (row) {
            return {
              name: row.relname,
              tableName: row.relname.split('_')[0]
            };
          });
        } else if (isTableNameQuery) {
          return rows.map(function (row) {
            return _.values(row);
          });
        }

        if (rows[0] && rows[0].sequelize_caught_exception !== undefined) {
          if (rows[0].sequelize_caught_exception !== null) {
            throw _this2.formatError({
              code: '23505',
              detail: rows[0].sequelize_caught_exception
            });
          } else {
            rows = rows.map(function (row) {
              delete row.sequelize_caught_exception;
              return row;
            });
          }
        }

        if (_this2.isShowIndexesQuery()) {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            var _loop = function _loop() {
              var result = _step.value;

              var attributes = /ON .*? (?:USING .*?\s)?\(([^]*)\)/gi.exec(result.definition)[1].split(',');

              // Map column index in table to column name
              var columns = _.zipObject(result.column_indexes, _this2.sequelize.queryInterface.QueryGenerator.fromArray(result.column_names));
              delete result.column_indexes;
              delete result.column_names;

              var field = void 0;
              var attribute = void 0;

              // Indkey is the order of attributes in the index, specified by a string of attribute indexes
              result.fields = result.indkey.split(' ').map(function (indKey, index) {
                field = columns[indKey];
                // for functional indices indKey = 0
                if (!field) {
                  return null;
                }
                attribute = attributes[index];
                return {
                  attribute: field,
                  collate: attribute.match(/COLLATE "(.*?)"/) ? /COLLATE "(.*?)"/.exec(attribute)[1] : undefined,
                  order: attribute.indexOf('DESC') !== -1 ? 'DESC' : attribute.indexOf('ASC') !== -1 ? 'ASC' : undefined,
                  length: undefined
                };
              }).filter(function (n) {
                return n !== null;
              });
              delete result.columns;
            };

            for (var _iterator = results[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
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

          return results;
        } else if (_this2.isForeignKeysQuery()) {
          result = [];
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = rows[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var row = _step2.value;

              var defParts = void 0;
              if (row.condef !== undefined && (defParts = row.condef.match(/FOREIGN KEY \((.+)\) REFERENCES (.+)\((.+)\)( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?( ON (UPDATE|DELETE) (CASCADE|RESTRICT))?/))) {
                row.id = row.constraint_name;
                row.table = defParts[2];
                row.from = defParts[1];
                row.to = defParts[3];
                var i = void 0;
                for (i = 5; i <= 8; i += 3) {
                  if (/(UPDATE|DELETE)/.test(defParts[i])) {
                    row['on_' + defParts[i].toLowerCase()] = defParts[i + 1];
                  }
                }
              }
              result.push(row);
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

          return result;
        } else if (_this2.isSelectQuery()) {
          // Postgres will treat tables as case-insensitive, so fix the case
          // of the returned values to match attributes
          if (_this2.options.raw === false && _this2.sequelize.options.quoteIdentifiers === false) {
            var attrsMap = _.reduce(_this2.model.attributes, function (m, v, k) {
              m[k.toLowerCase()] = k;
              return m;
            }, {});
            rows = _.map(rows, function (row) {
              return _.mapKeys(row, function (value, key) {
                var targetAttr = attrsMap[key];
                if (typeof targetAttr === 'string' && targetAttr !== key) {
                  return targetAttr;
                } else {
                  return key;
                }
              });
            });
          }
          return _this2.handleSelectQuery(rows);
        } else if (QueryTypes.DESCRIBE === _this2.options.type) {
          result = {};

          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;
          var _iteratorError3 = undefined;

          try {
            for (var _iterator3 = rows[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              var _result = _step3.value;

              result[_result.Field] = {
                type: _result.Type.toUpperCase(),
                allowNull: _result.Null === 'YES',
                defaultValue: _result.Default,
                special: _result.special ? _this2.sequelize.queryInterface.QueryGenerator.fromArray(_result.special) : [],
                primaryKey: _result.Constraint === 'PRIMARY KEY'
              };

              if (result[_result.Field].type === 'BOOLEAN') {
                result[_result.Field].defaultValue = { 'false': false, 'true': true }[result[_result.Field].defaultValue];

                if (result[_result.Field].defaultValue === undefined) {
                  result[_result.Field].defaultValue = null;
                }
              }

              if (typeof result[_result.Field].defaultValue === 'string') {
                result[_result.Field].defaultValue = result[_result.Field].defaultValue.replace(/'/g, '');

                if (result[_result.Field].defaultValue.indexOf('::') > -1) {
                  var split = result[_result.Field].defaultValue.split('::');
                  if (split[1].toLowerCase() !== 'regclass)') {
                    result[_result.Field].defaultValue = split[0];
                  }
                }
              }
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

          return result;
        } else if (_this2.isVersionQuery()) {
          return results[0].server_version;
        } else if (_this2.isShowOrDescribeQuery()) {
          return results;
        } else if (QueryTypes.BULKUPDATE === _this2.options.type) {
          if (!_this2.options.returning) {
            return parseInt(result.rowCount, 10);
          }

          return _this2.handleSelectQuery(rows);
        } else if (QueryTypes.BULKDELETE === _this2.options.type) {
          return parseInt(result.rowCount, 10);
        } else if (_this2.isUpsertQuery()) {
          return rows[0].sequelize_upsert;
        } else if (_this2.isInsertQuery() || _this2.isUpdateQuery()) {
          if (_this2.instance && _this2.instance.dataValues) {
            var _loop2 = function _loop2(key) {
              if (rows[0].hasOwnProperty(key)) {
                var record = rows[0][key];

                var attr = _.find(_this2.model.rawAttributes, function (attribute) {
                  return attribute.fieldName === key || attribute.field === key;
                });

                _this2.instance.dataValues[attr && attr.fieldName || key] = record;
              }
            };

            for (var key in rows[0]) {
              _loop2(key);
            }
          }

          return [_this2.instance || rows && (_this2.options.plain && rows[0] || rows) || undefined, result.rowCount];
        } else if (_this2.isRawQuery()) {
          return [rows, result];
        } else {
          return results;
        }
      });
    }
  }, {
    key: 'formatError',
    value: function formatError(err) {
      var _this3 = this;

      var match = void 0;
      var table = void 0;
      var index = void 0;
      var fields = void 0;
      var errors = void 0;
      var message = void 0;

      var code = err.code || err.sqlState;
      var errMessage = err.message || err.messagePrimary;
      var errDetail = err.detail || err.messageDetail;

      switch (code) {
        case '23503':
          index = errMessage.match(/violates foreign key constraint \"(.+?)\"/);
          index = index ? index[1] : undefined;
          table = errMessage.match(/on table \"(.+?)\"/);
          table = table ? table[1] : undefined;

          return new sequelizeErrors.ForeignKeyConstraintError({ message: errMessage, fields: null, index: index, table: table, parent: err });
        case '23505':
          // there are multiple different formats of error messages for this error code
          // this regex should check at least two
          if (errDetail && (match = errDetail.replace(/"/g, '').match(/Key \((.*?)\)=\((.*?)\)/))) {
            fields = _.zipObject(match[1].split(', '), match[2].split(', '));
            errors = [];
            message = 'Validation error';

            _.forOwn(fields, function (value, field) {
              errors.push(new sequelizeErrors.ValidationErrorItem(_this3.getUniqueConstraintErrorMessage(field), 'unique violation', field, value));
            });

            if (this.model && this.model.uniqueKeys) {
              _.forOwn(this.model.uniqueKeys, function (constraint) {
                if (_.isEqual(constraint.fields, Object.keys(fields)) && !!constraint.msg) {
                  message = constraint.msg;
                  return false;
                }
              });
            }

            return new sequelizeErrors.UniqueConstraintError({ message: message, errors: errors, parent: err, fields: fields });
          } else {
            return new sequelizeErrors.UniqueConstraintError({
              message: errMessage,
              parent: err
            });
          }

          break;
        case '23P01':
          match = errDetail.match(/Key \((.*?)\)=\((.*?)\)/);

          if (match) {
            fields = _.zipObject(match[1].split(', '), match[2].split(', '));
          }
          message = 'Exclusion constraint error';

          return new sequelizeErrors.ExclusionConstraintError({
            message: message,
            constraint: err.constraint,
            fields: fields,
            table: err.table,
            parent: err
          });

        default:
          return new sequelizeErrors.DatabaseError(err);
      }
    }
  }, {
    key: 'isForeignKeysQuery',
    value: function isForeignKeysQuery() {
      return (/SELECT conname as constraint_name, pg_catalog\.pg_get_constraintdef\(r\.oid, true\) as condef FROM pg_catalog\.pg_constraint r WHERE r\.conrelid = \(SELECT oid FROM pg_class WHERE relname = '.*' LIMIT 1\) AND r\.contype = 'f' ORDER BY 1;/.test(this.sql)
      );
    }
  }, {
    key: 'getInsertIdField',
    value: function getInsertIdField() {
      return 'id';
    }
  }], [{
    key: 'formatBindParameters',
    value: function formatBindParameters(sql, values, dialect) {
      var bindParam = [];
      if (Array.isArray(values)) {
        bindParam = values;
        sql = AbstractQuery.formatBindParameters(sql, values, dialect, { skipValueReplace: true })[0];
      } else {
        var i = 0;
        var seen = {};
        var replacementFunc = function replacementFunc(match, key, values) {
          if (seen[key] !== undefined) {
            return seen[key];
          }
          if (values[key] !== undefined) {
            i = i + 1;
            bindParam.push(values[key]);
            seen[key] = '$' + i;
            return '$' + i;
          }
          return undefined;
        };
        sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];
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