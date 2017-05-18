'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('../../utils');
var Promise = require('../../promise');
var AbstractQuery = require('../abstract/query');
var sequelizeErrors = require('../../errors.js');
var parserStore = require('../parserStore')('oracle');
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
    _this.outFormat = options.outFormat || _this.sequelize.connectionManager.lib.OBJECT;
    return _this;
  }

  _createClass(Query, [{
    key: 'getInsertIdField',
    value: function getInsertIdField() {
      return 'id';
    }
  }, {
    key: '_run',
    value: function _run(connection, sql, parameters) {
      var self = this;

      if (parameters) {}
      //Nothing, just for eslint


      //We set the oracledb 
      var oracledb = self.sequelize.connectionManager.lib;
      //Regexp for the bind params
      var regex = new RegExp('([$][:][a-zA-Z_]+)[;]([a-zA-Z(0-9)[]+[$])');

      //We remove the / that escapes quotes
      if (sql.match(/^(SELECT|INSERT|DELETE)/)) {
        this.sql = sql.replace(/; *$/, '');
      } else {
        this.sql = sql;
      }

      //Method to generate the object for Oracle out bindings; format -> $:name;type$
      var regExResult = regex.exec(this.sql);
      var outParameters = {};

      while (regExResult !== null) {
        //if we have multiple params

        //We extract the name of the parameter to bind, removes the $: at the beginning
        var parameterName = regExResult[1].substring(2, regExResult[1].length);
        //We extract the type, removes the $ at the end
        var type = regExResult[2].substring(0, regExResult[2].length - 1);

        //We bind the type passed as argument to the real type
        switch (type) {
          case 'INTEGER':
          case 'NUMBER':
            outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
            break;
          case 'STRING':
            outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.STRING };
            break;
          default:
            //Default, we choose String 
            outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.STRING };
            break;
        }

        //Finally we replace the param in the sql by the correct format for Oracle:  $:name;type$ -> :name
        if (this.sql.indexOf(regExResult[0]) > -1 && this.sql.indexOf('\'' + regExResult[0] + '\'') > -1) {
          //if the parameters is between quotes
          this.sql = this.sql.replace('\'' + regExResult[0] + '\'', ':' + parameterName);
        } else {
          this.sql = this.sql.replace(regExResult[0], ':' + parameterName);
        }

        //We exec the regexp again to see if there are other parameters  
        regExResult = regex.exec(this.sql);
      }

      this.outParameters = outParameters;

      //do we need benchmark for this query execution
      var benchmark = this.sequelize.options.benchmark || this.options.benchmark;

      var queryBegin = void 0;
      if (benchmark) {
        queryBegin = Date.now();
      } else {
        this.sequelize.log('Executing (' + (connection.uuid || 'default') + '): ' + this.sql, this.options);
      }
      // console.log('Executing (' + (connection.uuid || 'default') + '): ' + this.sql);

      // TRANSACTION SUPPORT
      if (_.startsWith(self.sql, 'BEGIN TRANSACTION')) {
        self.autocommit = false;
        return Promise.resolve();
      } else if (_.startsWith(self.sql, 'SET AUTOCOMMIT ON')) {
        self.autocommit = true;
        return Promise.resolve();
      } else if (_.startsWith(self.sql, 'SET AUTOCOMMIT OFF')) {
        self.autocommit = false;
        return Promise.resolve();
      } else if (_.startsWith(self.sql, 'DECLARE x NUMBER')) {
        //Calling a stored procedure for bulkInsert with NO attributes, returns nothing
        if (self.autoCommit === undefined) {
          if (connection.uuid) {
            self.autoCommit = false;
          } else {
            self.autoCommit = true;
          }
        }
        return connection.execute(self.sql, outParameters, { autoCommit: self.autoCommit }).then(function () {
          return {};
        }).catch(function (error) {
          console.error(error.message);
          throw self.formatError(error);
        });
      } else if (_.startsWith(self.sql, 'BEGIN')) {
        //Call to stored procedures - BEGIN TRANSACTION has been treated before
        if (self.autoCommit === undefined) {
          if (connection.uuid) {
            self.autoCommit = false;
          } else {
            self.autoCommit = true;
          }
        }

        return connection.execute(self.sql, [], { outFormat: self.outFormat, autoCommit: self.autoCommit }).then(function (result) {
          if (!Array.isArray(result.outBinds)) {
            return [result.outBinds];
          }
          return result.outBinds;
        }).catch(function (error) {
          console.error(error.message);
          throw self.formatError(error);
        });
      } else if (_.startsWith(self.sql, 'COMMIT TRANSACTION')) {
        return connection.commit().then(function () {
          return {};
        }).catch(function (err) {
          throw self.formatError(err);
        });
      } else if (_.startsWith(self.sql, 'ROLLBACK TRANSACTION')) {
        return connection.rollback().then(function () {
          return {};
        }).catch(function (err) {
          throw self.formatError(err);
        });
      } else if (_.startsWith(self.sql, 'SET TRANSACTION')) {
        return Promise.resolve({});
      } else {
        // QUERY SUPPORT

        //As Oracle does everything in transaction, if autoCommit is not defined, we set it to true 
        if (self.autoCommit === undefined) {
          if (connection.uuid) {
            self.autoCommit = false;
          } else {
            self.autoCommit = true;
          }
        }
        if (Object.keys(self.outParameters).length > 0) {
          //If we have some mapping with parameters to do - INSERT queries 
          return connection.execute(self.sql, self.outParameters, { outFormat: self.outFormat, autoCommit: self.autoCommit }).then(function (result) {
            if (benchmark) {
              self.sequelize.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql, Date.now() - queryBegin, self.options);
            }
            //console.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql);

            //Specific case for insert
            if (_.includes(self.sql, 'INSERT INTO')) {

              //For returning into, oracle returns : {ID : [id]}, we need : [{ID : id}]
              //Treating the outbinds parameters
              var keys = Object.keys(self.outParameters);
              var key = keys[0];

              var row = {};
              //Treating the outbinds parameters
              row[key] = Array.isArray(result.outBinds[key]) ? result.outBinds[key][0] : result.outBinds[key];
              result = [row];
            } else if (!Array.isArray(result.outBinds)) {
              result = [result.outBinds];
            }

            var formatedResult = self.formatResults(result);

            return [formatedResult];
          }).catch(function (error) {
            // console.error(error.message);
            throw self.formatError(error);
          });
        } else {
          //Normal execution
          return connection.execute(self.sql, [], { outFormat: self.outFormat, autoCommit: self.autoCommit }).then(function (result) {
            if (benchmark) {
              self.sequelize.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql, Date.now() - queryBegin, self.options);
            }
            // console.log('Executed (' + (connection.uuid || 'default') + '): ' + self.sql);
            //const startId = metaData[query.getInsertIdField()] - metaData.changes + 1;
            var formatedResult = self.formatResults(result);

            return formatedResult === undefined ? {} : formatedResult;
          }).catch(function (error) {
            // console.dir(error);
            throw self.formatError(error);
          });
        }
      }
    }
  }, {
    key: 'run',
    value: function run(sql, parameters) {
      var self = this;

      // return Promise.using(this.connection.lock(), function (connection) {
      return self._run(this.connection, sql, parameters);
      // });
    }
  }, {
    key: 'formatResults',


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
     * Oracle format : 
     * { rows: //All rows
       [ [ 'Oracle Database 11g Enterprise Edition Release 11.2.0.1.0 - 64bit Production' ],
         [ 'PL/SQL Release 11.2.0.1.0 - Production' ],
         [ 'CORE\t11.2.0.1.0\tProduction' ],
         [ 'TNS for 64-bit Windows: Version 11.2.0.1.0 - Production' ],
         [ 'NLSRTL Version 11.2.0.1.0 - Production' ] ],
      resultSet: undefined,
      outBinds: undefined, //Used for dbms_put.line
      rowsAffected: undefined, //Number of rows affecter
      metaData: [ { name: 'BANNER' } ] }
    *
    * @param {Array} data - The result of the query execution.
    */
    value: function formatResults(data) {
      var _this2 = this;

      var result = this.instance;
      if (this.isInsertQuery(data)) {
        this.handleInsertQuery(data);
      } else if (this.isShowTablesQuery()) {
        result = this.handleShowTablesQuery(data.rows);
      } else if (this.isDescribeQuery()) {
        result = {};
        var options = this.options;
        var modelAttributes = [];
        if ('describeModelAttributes' in options) {
          //If we have the model attributes inside the options, we can use it to map the column names
          modelAttributes = Object.keys(this.options.describeModelAttributes);
        }
        data.rows.forEach(function (_result) {
          if (_result.Default) {
            _result.Default = _result.Default.replace("('", '').replace("')", '').replace(/'/g, ''); /* jshint ignore: line */
          }

          if (!(_result.COLUMN_NAME.toLowerCase() in result)) {
            var key = _result.COLUMN_NAME.toLowerCase();

            if (modelAttributes.length > 0) {
              for (var i = 0; i < modelAttributes.length; i++) {
                if (modelAttributes[i].toLowerCase() === key) {
                  key = modelAttributes[i];
                  i = modelAttributes.length;
                }
              }
            }

            result[key] = {
              type: _result.DATA_TYPE.toUpperCase(),
              allowNull: _result.NULLABLE === 'N' ? false : true,
              defaultValue: undefined,
              primaryKey: _result.PRIMARY === 'PRIMARY'
            };
          }
        });
      } else if (this.isShowIndexesQuery()) {
        result = this.handleShowIndexesQuery(data.rows);
      } else if (this.isSelectQuery()) {
        var rows = data.rows;
        var keys = [];
        var attrs = {};
        if (rows.length > 0) {
          keys = Object.keys(rows[rows.length - 1]); //we get the keys

          //Since Oracle returns the column name uppercase, we have to transform it to match the model definition
          if (!this.model) {
            //NO model, we will return everything in lowerCase, except for some specific cases
            if (this.isSelectCountQuery() && this.sql.toLowerCase().indexOf('group') === -1) {
              //We should pass here if we only have SELECT COUNT(*) FROM TABLE (WHERE)
              var match = this.sql.match(/.* AS (.*) FROM .*/i);
              if (match[1]) {
                //We use the alias
                var returnValue = {};
                returnValue[match[1]] = rows[0][match[1].toUpperCase()];
                return returnValue;
              }
              return { count: rows[0].COUNT };
            }
            var _finalRows = [];
            var rowKeys = Object.keys(rows[0]);
            if (rowKeys.length > 0) {
              rows.forEach(function (row) {
                var returnObject = {};
                rowKeys.forEach(function (rowKey) {
                  var outKey = '';
                  var mapKeys = [];
                  if (_this2.options && _this2.options.fieldMap) {
                    mapKeys = Object.keys(_this2.options.fieldMap);
                  }
                  if (_.includes(mapKeys, rowKey.toLowerCase())) {
                    //We have a fieldMap for the names
                    outKey = _this2.options.fieldMap[rowKey.toLowerCase()];
                  } else {
                    outKey = rowKey.toLowerCase();
                  }
                  var value = {};
                  if (outKey.indexOf('.') > -1) {
                    //If there are dots in the key, we create an object
                    _this2.convertStringToObj(outKey, row[rowKey], value);
                    returnObject = value;
                  } else {
                    returnObject[outKey] = row[rowKey];
                  }
                });

                //if plain, we have only one row and we don't want to return it into an array
                if (_this2.options.plain) {
                  _finalRows = returnObject;
                } else {
                  _finalRows.push(returnObject);
                }
              });

              return _finalRows;
            }
            return rows;
          }

          //We have a model, we will map the properties returned by Oracle to the field names in the model
          var attrKeys = Object.keys(this.model.attributes);
          attrKeys.forEach(function (attrKey) {
            //We map the fieldName in lowerCase to the real fieldName, makes it easy to rebuild the object
            var attribute = _this2.model.attributes[attrKey];
            //We generate an array like this : attribute(toLowerCase) : attribute(real case)
            attrs[attribute.fieldName.toLowerCase()] = attribute.fieldName;

            if (attribute.fieldName !== attribute.field) {
              //Specific case where field and fieldName are differents, in DB it's field, in model we want fieldName
              attrs[attribute.field.toLowerCase()] = attribute.fieldName;
            }
          });
        }
        var finalRows = [];

        for (var rowsIdx = 0; rowsIdx < rows.length; rowsIdx++) {
          var element = rows[rowsIdx];
          var newRow = {};

          for (var keysIdx = 0; keysIdx < keys.length; keysIdx++) {
            var key = keys[keysIdx];

            //Oracle returns everything in uppercase, so we have to transform this
            //As seen in development process, it only occurs for the first element, if it's foo.bar; foo will be uppercase, bar will be ok
            if (key.indexOf('.') > -1) {
              //We have the value of an include
              if (this.options && this.options.includeMap) {
                var name = '';
                var parts = key.split('.');
                //we have some includes, we have to map the names in returned row to includeMap
                var includeKeys = Object.keys(this.options.includeMap);
                for (var i = 0; i < includeKeys.length; i++) {
                  if (parts[0].toUpperCase() === includeKeys[i].toUpperCase()) {
                    parts.splice(0, 1); //We remove the first part
                    name = includeKeys[i] + '.' + parts.join('.');
                    break;
                  }
                }
                //We reset the value with the "good" name
                newRow[name] = element[key];
              }
            } else {
              //No include, classic property
              if (attrs[key.toLowerCase()] === undefined) {
                //If we don't have a mapping name provided (from the model), we take it from sql
                var firstIdx = -1;

                //We first start by checking if this is defined as an alias 
                if (this.sql.toUpperCase().indexOf('AS ' + key) > -1) {
                  //This is an alias, we take it
                  firstIdx = this.sql.toUpperCase().indexOf('AS ' + key) + 3;
                } else {
                  //No alias, we take the first occurence we find
                  firstIdx = this.sql.toUpperCase().indexOf(key);
                }

                var realKey = this.sql.substr(firstIdx, key.length);
                newRow[realKey] = element[key];
              } else {
                var typeid = this.model.attributes[attrs[key.toLowerCase()]].type.toLocaleString();

                //For some types, the "name" of the type is returned with the length, we remove it
                if (typeid.indexOf('(') > -1) {
                  typeid = typeid.substr(0, typeid.indexOf('('));
                }

                var parse = parserStore.get(typeid);
                var value = element[key];

                if (value !== null & !!parse) {
                  value = parse(value);
                }
                newRow[attrs[key.toLowerCase()]] = value;
              }
            }
          }
          finalRows.push(newRow);
        }

        data.rows = finalRows;

        result = this.handleSelectQuery(data.rows);
      } else if (this.isCallQuery()) {
        result = data.rows[0];
      } else if (this.isUpdateQuery()) {
        result = [result];
      } else if (this.isBulkUpdateQuery()) {
        result = data.rowsAffected;
      } else if (this.isBulkDeleteQuery()) {
        result = data.rowsAffected;
      } else if (this.isVersionQuery()) {
        var version = data.rows[0].VERSION;
        if (version) {
          var versions = version.split('.');
          result = versions[0] + '.' + versions[1] + '.' + versions[2];
        } else {
          result = '0.0.0';
        }
      } else if (this.isForeignKeysQuery()) {
        result = data.rows;
      } else if (this.isUpsertQuery()) {
        //Upsert Query, will return nothing
        result = undefined;
      } else if (this.isShowConstraintsQuery()) {
        result = this.handleShowConstraintsQuery(data);
      } else if (this.isRawQuery()) {
        var results = [];
        if (data && data.rows) {
          data.rows.forEach(function (rowData) {
            var rawValue = {};

            var keys = Object.keys(rowData);
            keys.forEach(function (key) {
              rawValue[key.toLowerCase()] = rowData[key];
            });

            results.push(rawValue);
          });
        }

        //Don't know why, but with this .spread works...
        result = [results, results];
      }

      return result;
    }
  }, {
    key: 'handleShowConstraintsQuery',
    value: function handleShowConstraintsQuery(data) {
      //Convert snake_case keys to camelCase as its generated by stored procedure
      return data.rows.map(function (result) {
        var constraint = {};
        for (var key in result) {
          constraint[_.camelCase(key)] = result[key].toLowerCase();
        }
        return constraint;
      });
    }

    /**
     * Convert string with dot notation to object
     * ie : a.b.c -> a{b{c}}
     */

  }, {
    key: 'convertStringToObj',
    value: function convertStringToObj(path, value, obj) {
      var parts = path.split('.');
      var part = void 0;
      var last = parts.pop();
      part = parts.shift();
      while (part) {
        if (_typeof(obj[part]) !== 'object') {
          obj[part] = {};
        }
        obj = obj[part];
        part = parts.shift();
      }
      obj[last] = value;
    }
  }, {
    key: 'isUpsertQuery',
    value: function isUpsertQuery() {
      return this.sql.startsWith('MERGE');
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
    key: 'formatError',
    value: function formatError(err) {
      var _this3 = this;

      var match = void 0;
      //ORA-00001: unique constraint (USER.XXXXXXX) violated
      match = err.message.match(/unique constraint ([\s\S]*) violated/);
      if (match && match.length > 1) {
        match[1] = match[1].replace('(', '').replace(')', '').split('.')[1]; //As we get (SEQUELIZE.UNIQNAME), we replace to have UNIQNAME
        var errors = [];
        var fields = [],
            message = 'Validation error',
            uniqueKey = null;

        if (this.model) {
          var uniqueKeys = Object.keys(this.model.uniqueKeys);

          var currKey = uniqueKeys.find(function (key) {
            //We check directly AND with quotes -> "a"" === a || "a" === "a"
            return key.toUpperCase() === match[1].toUpperCase() || key.toUpperCase() === '"' + match[1].toUpperCase() + '"';
          });

          if (currKey) {
            uniqueKey = this.model.uniqueKeys[currKey];
            fields = uniqueKey.fields;
          }

          if (uniqueKey && !!uniqueKey.msg) {
            message = uniqueKey.msg;
          }

          fields.forEach(function (field) {
            errors.push(new sequelizeErrors.ValidationErrorItem(_this3.getUniqueConstraintErrorMessage(field), 'unique violation', field, null));
          });
        }

        return new sequelizeErrors.UniqueConstraintError({
          message: message,
          errors: errors,
          err: err,
          fields: fields
        });
      }

      //ORA-02291: integrity constraint (string.string) violated - parent key not found / ORA-02292: integrity constraint (string.string) violated - child record found
      match = err.message.match(/ORA-02291/) || err.message.match(/ORA-02292/);
      if (match && match.length > 0) {
        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: match[1],
          parent: err
        });
      }

      return new sequelizeErrors.DatabaseError(err);
    }
  }, {
    key: 'isShowIndexesQuery',
    value: function isShowIndexesQuery() {
      return this.sql.indexOf('SELECT i.index_name,i.table_name, i.column_name, u.uniqueness') > -1;
    }
  }, {
    key: 'isSelectCountQuery',
    value: function isSelectCountQuery() {
      return this.sql.toUpperCase().indexOf('SELECT COUNT(*)') > -1;
    }
  }, {
    key: 'handleShowIndexesQuery',
    value: function handleShowIndexesQuery(data) {
      var acc = [];

      //We first treat the datas
      data.forEach(function (indexRecord) {

        //We create the object
        if (!acc[indexRecord.INDEX_NAME]) {
          acc[indexRecord.INDEX_NAME] = {
            unique: indexRecord.UNIQUENESS === 'UNIQUE' ? true : false,
            primary: indexRecord.INDEX_NAME.toLowerCase().indexOf('pk') === 0,
            name: indexRecord.INDEX_NAME.toLowerCase(),
            tableName: indexRecord.TABLE_NAME.toLowerCase(),
            type: undefined
          };
          acc[indexRecord.INDEX_NAME].fields = [];
        }

        //We create the fields
        acc[indexRecord.INDEX_NAME].fields.push({
          attribute: indexRecord.COLUMN_NAME,
          length: undefined,
          order: indexRecord.DESCEND,
          collate: undefined
        });
      });
      var returnIndexes = [];

      var accKeys = Object.keys(acc);
      accKeys.forEach(function (accKey) {
        returnIndexes.push(acc[accKey]);
      });

      return returnIndexes;
    }
  }, {
    key: 'handleInsertQuery',
    value: function handleInsertQuery(results, metaData) {
      if (this.instance && results.length > 0) {
        if ('pkReturnVal' in results[0]) {
          //The PK of the table is a reserved word (ex : uuid), we have to change the name in the result for the model to find the value correctly
          results[0][this.model.primaryKeyAttribute] = results[0].pkReturnVal;
          delete results[0].pkReturnVal;
        }
        // add the inserted row id to the instance
        var autoIncrementField = this.model.autoIncrementField;
        var autoIncrementFieldAlias = null,
            id = null;

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