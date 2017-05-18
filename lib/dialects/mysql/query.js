'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('../../utils');
var debug = Utils.getLogger().debugContext('sql:mysql');
var AbstractQuery = require('../abstract/query');
var uuid = require('uuid');
var sequelizeErrors = require('../../errors.js');
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
    _this.uuid = uuid.v4();
    _this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false,
      showWarnings: false
    }, options || {});

    _this.checkLoggingOption();
    return _this;
  }

  _createClass(Query, [{
    key: 'run',
    value: function run(sql) {
      var _this2 = this;

      this.sql = sql;

      //do we need benchmark for this query execution
      var benchmark = this.sequelize.options.benchmark || this.options.benchmark;
      var showWarnings = this.sequelize.options.showWarnings || this.options.showWarnings;

      var queryBegin = void 0;
      if (benchmark) {
        queryBegin = Date.now();
      } else {
        this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);
      }

      debug('executing(' + (this.connection.uuid || 'default') + ') : ' + this.sql);

      return new Utils.Promise(function (resolve, reject) {
        _this2.connection.query({ sql: _this2.sql }, function (err, results) {
          debug('executed(' + (_this2.connection.uuid || 'default') + ') : ' + _this2.sql);

          if (benchmark) {
            _this2.sequelize.log('Executed (' + (_this2.connection.uuid || 'default') + '): ' + _this2.sql, Date.now() - queryBegin, _this2.options);
          }

          if (err) {
            err.sql = sql;

            reject(_this2.formatError(err));
          } else {
            resolve(results);
          }
        }).setMaxListeners(100);
      })
      // Log warnings if we've got them.
      .then(function (results) {
        if (showWarnings && results && results.warningStatus > 0) {
          return _this2.logWarnings(results);
        }
        return results;
      })
      // Return formatted results...
      .then(function (results) {
        return _this2.formatResults(results);
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
    value: function formatResults(data) {
      var result = this.instance;

      if (this.isInsertQuery(data)) {
        this.handleInsertQuery(data);

        if (!this.instance) {
          // handle bulkCreate AI primiary key
          if (data.constructor.name === 'ResultSetHeader' && this.model && this.model.autoIncrementField && this.model.autoIncrementField === this.model.primaryKeyAttribute && this.model.rawAttributes[this.model.primaryKeyAttribute]) {
            var startId = data[this.getInsertIdField()];
            result = [];
            for (var i = startId; i < startId + data.affectedRows; i++) {
              result.push(_defineProperty({}, this.model.rawAttributes[this.model.primaryKeyAttribute].field, i));
            }
          } else {
            result = data[this.getInsertIdField()];
          }
        }
      }

      if (this.isSelectQuery()) {
        result = this.handleSelectQuery(data);
      } else if (this.isShowTablesQuery()) {
        result = this.handleShowTablesQuery(data);
      } else if (this.isDescribeQuery()) {
        result = {};

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = data[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _result = _step.value;

            var enumRegex = /^enum/i;
            result[_result.Field] = {
              type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.Type.toUpperCase(),
              allowNull: _result.Null === 'YES',
              defaultValue: _result.Default,
              primaryKey: _result.Key === 'PRI'
            };
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
      } else if (this.isShowIndexesQuery()) {
        result = this.handleShowIndexesQuery(data);
      } else if (this.isCallQuery()) {
        result = data[0];
      } else if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
        result = data.affectedRows;
      } else if (this.isVersionQuery()) {
        result = data[0].version;
      } else if (this.isForeignKeysQuery()) {
        result = data;
      } else if (this.isInsertQuery() || this.isUpdateQuery()) {
        result = [result, data.affectedRows];
      } else if (this.isShowConstraintsQuery()) {
        result = data;
      } else if (this.isRawQuery()) {
        // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
        result = [data, data];
      }

      return result;
    }
  }, {
    key: 'logWarnings',
    value: function logWarnings(results) {
      var _this3 = this;

      return this.run('SHOW WARNINGS').then(function (warningResults) {
        var warningMessage = 'MySQL Warnings (' + (_this3.connection.uuid || 'default') + '): ';
        var messages = [];
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = warningResults[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _warningRow = _step2.value;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
              for (var _iterator3 = _warningRow[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var _warningResult = _step3.value;

                if (_warningResult.hasOwnProperty('Message')) {
                  messages.push(_warningResult.Message);
                } else {
                  var _iteratorNormalCompletion4 = true;
                  var _didIteratorError4 = false;
                  var _iteratorError4 = undefined;

                  try {
                    for (var _iterator4 = _warningResult.keys()[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                      var _objectKey = _step4.value;

                      messages.push([_objectKey, _warningResult[_objectKey]].join(': '));
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

        _this3.sequelize.log(warningMessage + messages.join('; '), _this3.options);

        return results;
      });
    }
  }, {
    key: 'formatError',
    value: function formatError(err) {
      var _this4 = this;

      switch (err.errno || err.code) {
        case 1062:
          {
            var match = err.message.match(/Duplicate entry '(.*)' for key '?((.|\s)*?)'?$/);

            var fields = {};
            var message = 'Validation error';
            var values = match ? match[1].split('-') : undefined;
            var uniqueKey = this.model && this.model.uniqueKeys[match[2]];

            if (uniqueKey) {
              if (uniqueKey.msg) message = uniqueKey.msg;
              fields = Utils._.zipObject(uniqueKey.fields, values);
            } else {
              fields[match[2]] = match[1];
            }

            var errors = [];
            Utils._.forOwn(fields, function (value, field) {
              errors.push(new sequelizeErrors.ValidationErrorItem(_this4.getUniqueConstraintErrorMessage(field), 'unique violation', field, value));
            });

            return new sequelizeErrors.UniqueConstraintError({ message: message, errors: errors, parent: err, fields: fields });
          }
        case 1451:
          {
            var _match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(?: ON .*)?\)$/);

            return new sequelizeErrors.ForeignKeyConstraintError({
              fields: null,
              index: _match ? _match[3] : undefined,
              parent: err
            });
          }
        case 1452:
          {
            var _match2 = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(.*)\)$/);

            return new sequelizeErrors.ForeignKeyConstraintError({
              fields: null,
              index: _match2 ? _match2[1] : undefined,
              parent: err
            });
          }
        default:
          return new sequelizeErrors.DatabaseError(err);
      }
    }
  }, {
    key: 'handleShowIndexesQuery',
    value: function handleShowIndexesQuery(data) {
      // Group by index name, and collect all fields
      data = _.reduce(data, function (acc, item) {
        if (!(item.Key_name in acc)) {
          acc[item.Key_name] = item;
          item.fields = [];
        }

        acc[item.Key_name].fields[item.Seq_in_index - 1] = {
          attribute: item.Column_name,
          length: item.Sub_part || undefined,
          order: item.Collation === 'A' ? 'ASC' : undefined
        };
        delete item.column_name;

        return acc;
      }, {});

      return Utils._.map(data, function (item) {
        return {
          primary: item.Key_name === 'PRIMARY',
          fields: item.fields,
          name: item.Key_name,
          tableName: item.Table,
          unique: item.Non_unique !== 1,
          type: item.Index_type
        };
      });
    }
  }]);

  return Query;
}(AbstractQuery);

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;