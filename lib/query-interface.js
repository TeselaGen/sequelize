'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = require('./utils');
var _ = require('lodash');
var DataTypes = require('./data-types');
var SQLiteQueryInterface = require('./dialects/sqlite/query-interface');
var MSSSQLQueryInterface = require('./dialects/mssql/query-interface');
var MySQLQueryInterface = require('./dialects/mysql/query-interface');
var OracleQueryInterface = require('./dialects/oracle/query-interface');
var Transaction = require('./transaction');
var Promise = require('./promise');
var QueryTypes = require('./query-types');

/**
 * The interface that Sequelize uses to talk to all databases
 * @class QueryInterface
 * @private
 */

var QueryInterface = function () {
  function QueryInterface(sequelize) {
    _classCallCheck(this, QueryInterface);

    this.sequelize = sequelize;
    this.QueryGenerator = this.sequelize.dialect.QueryGenerator;
  }

  _createClass(QueryInterface, [{
    key: 'createSchema',
    value: function createSchema(schema, options) {
      options = options || {};
      var sql = this.QueryGenerator.createSchema(schema);
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'dropSchema',
    value: function dropSchema(schema, options) {
      options = options || {};
      var sql = this.QueryGenerator.dropSchema(schema);
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'dropAllSchemas',
    value: function dropAllSchemas(options) {
      var _this = this;

      options = options || {};

      if (!this.QueryGenerator._dialect.supports.schemas) {
        return this.sequelize.drop(options);
      } else {
        return this.showAllSchemas(options).map(function (schemaName) {
          return _this.dropSchema(schemaName, options);
        });
      }
    }
  }, {
    key: 'showAllSchemas',
    value: function showAllSchemas(options) {

      options = _.assign({}, options, {
        raw: true,
        type: this.sequelize.QueryTypes.SELECT
      });

      var showSchemasSql = this.QueryGenerator.showSchemasQuery();

      return this.sequelize.query(showSchemasSql, options).then(function (schemaNames) {
        return Utils._.flatten(Utils._.map(schemaNames, function (value) {
          return value.schema_name ? value.schema_name : value;
        }));
      });
    }
  }, {
    key: 'databaseVersion',
    value: function databaseVersion(options) {
      return this.sequelize.query(this.QueryGenerator.versionQuery(), _.assign({}, options, { type: QueryTypes.VERSION }));
    }
  }, {
    key: 'createTable',
    value: function createTable(tableName, attributes, options, model) {
      var _this2 = this;

      var keys = Object.keys(attributes);
      var keyLen = keys.length;
      var sql = '';
      var i = 0;

      options = _.clone(options) || {};

      attributes = Utils._.mapValues(attributes, function (attribute) {
        if (!Utils._.isPlainObject(attribute)) {
          attribute = { type: attribute, allowNull: true };
        }

        attribute = _this2.sequelize.normalizeAttribute(attribute);

        return attribute;
      });

      // Postgres requires a special SQL command for enums
      if (this.sequelize.options.dialect === 'postgres') {
        var promises = [];

        for (i = 0; i < keyLen; i++) {
          if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
            sql = this.QueryGenerator.pgListEnums(tableName, attributes[keys[i]].field || keys[i], options);
            promises.push(this.sequelize.query(sql, _.assign({}, options, { plain: true, raw: true, type: QueryTypes.SELECT })));
          }
        }

        return Promise.all(promises).then(function (results) {
          var promises = [];
          var enumIdx = 0;

          for (i = 0; i < keyLen; i++) {
            if (attributes[keys[i]].type instanceof DataTypes.ENUM) {
              // If the enum type doesn't exist then create it
              if (!results[enumIdx]) {
                sql = _this2.QueryGenerator.pgEnum(tableName, attributes[keys[i]].field || keys[i], attributes[keys[i]], options);
                promises.push(_this2.sequelize.query(sql, _.assign({}, options, { raw: true })));
              } else if (!!results[enumIdx] && !!model) {
                (function () {
                  var enumVals = _this2.QueryGenerator.fromArray(results[enumIdx].enum_value);
                  var vals = model.rawAttributes[keys[i]].values;

                  vals.forEach(function (value, idx) {
                    // reset out after/before options since it's for every enum value
                    var valueOptions = _.clone(options);
                    valueOptions.before = null;
                    valueOptions.after = null;

                    if (enumVals.indexOf(value) === -1) {
                      if (vals[idx + 1]) {
                        valueOptions.before = vals[idx + 1];
                      } else if (vals[idx - 1]) {
                        valueOptions.after = vals[idx - 1];
                      }
                      valueOptions.supportsSearchPath = false;
                      promises.push(_this2.sequelize.query(_this2.QueryGenerator.pgEnumAdd(tableName, keys[i], value, valueOptions), valueOptions));
                    }
                  });
                  enumIdx++;
                })();
              }
            }
          }

          if (!tableName.schema && (options.schema || !!model && model._schema)) {
            tableName = _this2.QueryGenerator.addSchema({
              tableName: tableName,
              _schema: !!model && model._schema || options.schema
            });
          }

          attributes = _this2.QueryGenerator.attributesToSQL(attributes, {
            context: 'createTable'
          });
          sql = _this2.QueryGenerator.createTableQuery(tableName, attributes, options);

          return Promise.all(promises).then(function () {
            return _this2.sequelize.query(sql, options);
          });
        });
      } else {
        if (!tableName.schema && (options.schema || !!model && model._schema)) {
          tableName = this.QueryGenerator.addSchema({
            tableName: tableName,
            _schema: !!model && model._schema || options.schema
          });
        }

        attributes = this.QueryGenerator.attributesToSQL(attributes, {
          context: 'createTable'
        });
        sql = this.QueryGenerator.createTableQuery(tableName, attributes, options);

        return this.sequelize.query(sql, options);
      }
    }
  }, {
    key: 'dropTable',
    value: function dropTable(tableName, options) {
      var _this3 = this;

      // if we're forcing we should be cascading unless explicitly stated otherwise
      options = _.clone(options) || {};
      options.cascade = options.cascade || options.force || false;

      var sql = this.QueryGenerator.dropTableQuery(tableName, options);

      return this.sequelize.query(sql, options).then(function () {
        var promises = [];

        // Since postgres has a special case for enums, we should drop the related
        // enum type within the table and attribute
        if (_this3.sequelize.options.dialect === 'postgres') {
          var instanceTable = _this3.sequelize.modelManager.getModel(tableName, { attribute: 'tableName' });

          if (instanceTable) {
            var getTableName = (!options || !options.schema || options.schema === 'public' ? '' : options.schema + '_') + tableName;

            var keys = Object.keys(instanceTable.rawAttributes);
            var keyLen = keys.length;

            for (var i = 0; i < keyLen; i++) {
              if (instanceTable.rawAttributes[keys[i]].type instanceof DataTypes.ENUM) {
                sql = _this3.QueryGenerator.pgEnumDrop(getTableName, keys[i]);
                options.supportsSearchPath = false;
                promises.push(_this3.sequelize.query(sql, _.assign({}, options, { raw: true })));
              }
            }
          }
        }

        return Promise.all(promises).get(0);
      });
    }
  }, {
    key: 'dropAllTables',
    value: function dropAllTables(options) {
      var _this4 = this;

      if (this.sequelize.options.dialect === 'oracle') {
        //With Oracle, we have to do chain drop constraint promises
        return OracleQueryInterface.dropAllTables.call(this, options);
      }

      options = options || {};
      var skip = options.skip || [];

      var dropAllTables = function dropAllTables(tableNames) {
        return Promise.each(tableNames, function (tableName) {
          // if tableName is not in the Array of tables names then dont drop it
          if (skip.indexOf(tableName.tableName || tableName) === -1) {
            return _this4.dropTable(tableName, _.assign({}, options, { cascade: true }));
          }
        });
      };

      return this.showAllTables(options).then(function (tableNames) {
        if (_this4.sequelize.options.dialect === 'sqlite') {
          return _this4.sequelize.query('PRAGMA foreign_keys;', options).then(function (result) {
            var foreignKeysAreEnabled = result.foreign_keys === 1;

            if (foreignKeysAreEnabled) {
              return _this4.sequelize.query('PRAGMA foreign_keys = OFF', options).then(function () {
                return dropAllTables(tableNames);
              }).then(function () {
                return _this4.sequelize.query('PRAGMA foreign_keys = ON', options);
              });
            } else {
              return dropAllTables(tableNames);
            }
          });
        } else {
          return _this4.getForeignKeysForTables(tableNames, options).then(function (foreignKeys) {
            var promises = [];

            tableNames.forEach(function (tableName) {
              var normalizedTableName = tableName;
              if (Utils._.isObject(tableName)) {
                normalizedTableName = tableName.schema + '.' + tableName.tableName;
              }

              foreignKeys[normalizedTableName].forEach(function (foreignKey) {
                var sql = _this4.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey);
                promises.push(_this4.sequelize.query(sql, options));
              });
            });

            return Promise.all(promises).then(function () {
              return dropAllTables(tableNames);
            });
          });
        }
      });
    }
  }, {
    key: 'dropAllEnums',
    value: function dropAllEnums(options) {
      var _this5 = this;

      if (this.sequelize.getDialect() !== 'postgres') {
        return Promise.resolve();
      }

      options = options || {};

      return this.pgListEnums(null, options).map(function (result) {
        return _this5.sequelize.query(_this5.QueryGenerator.pgEnumDrop(null, null, _this5.QueryGenerator.pgEscapeAndQuote(result.enum_name)), _.assign({}, options, { raw: true }));
      });
    }
  }, {
    key: 'pgListEnums',
    value: function pgListEnums(tableName, options) {
      options = options || {};
      var sql = this.QueryGenerator.pgListEnums(tableName);
      return this.sequelize.query(sql, _.assign({}, options, { plain: false, raw: true, type: QueryTypes.SELECT }));
    }
  }, {
    key: 'renameTable',
    value: function renameTable(before, after, options) {
      options = options || {};
      var sql = this.QueryGenerator.renameTableQuery(before, after);
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'showAllTables',
    value: function showAllTables(options) {
      options = _.assign({}, options, {
        raw: true,
        type: QueryTypes.SHOWTABLES
      });

      var showTablesSql = this.QueryGenerator.showTablesQuery();
      return this.sequelize.query(showTablesSql, options).then(function (tableNames) {
        return Utils._.flatten(tableNames);
      });
    }
  }, {
    key: 'describeTable',
    value: function describeTable(tableName, options) {
      var schema = null;
      var schemaDelimiter = null;

      if (typeof options === 'string') {
        schema = options;
      } else if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object' && options !== null) {
        schema = options.schema || null;
        schemaDelimiter = options.schemaDelimiter || null;
      }

      if ((typeof tableName === 'undefined' ? 'undefined' : _typeof(tableName)) === 'object' && tableName !== null) {
        schema = tableName.schema;
        tableName = tableName.tableName;
      }

      var sql = this.QueryGenerator.describeTableQuery(tableName, schema, schemaDelimiter);

      if (this.sequelize.options.dialect === 'oracle') {
        options = OracleQueryInterface.addOptionsForDescribe.call(this, tableName, options);
      }

      return this.sequelize.query(sql, _.assign({}, options, { type: QueryTypes.DESCRIBE })).then(function (data) {
        // If no data is returned from the query, then the table name may be wrong.
        // Query generators that use information_schema for retrieving table info will just return an empty result set,
        // it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
        if (Utils._.isEmpty(data)) {
          return Promise.reject('No description found for "' + tableName + '" table. Check the table name and schema; remember, they _are_ case sensitive.');
        } else {
          return Promise.resolve(data);
        }
      });
    }
  }, {
    key: 'addColumn',
    value: function addColumn(table, key, attribute, options) {
      if (!table || !key || !attribute) {
        throw new Error('addColumn takes atleast 3 arguments (table, attribute name, attribute definition)');
      }

      options = options || {};
      attribute = this.sequelize.normalizeAttribute(attribute);
      return this.sequelize.query(this.QueryGenerator.addColumnQuery(table, key, attribute), options);
    }
  }, {
    key: 'removeColumn',
    value: function removeColumn(tableName, attributeName, options) {
      options = options || {};
      switch (this.sequelize.options.dialect) {
        case 'sqlite':
          // sqlite needs some special treatment as it cannot drop a column
          return SQLiteQueryInterface.removeColumn.call(this, tableName, attributeName, options);
        case 'mssql':
          // mssql needs special treatment as it cannot drop a column with a default or foreign key constraint
          return MSSSQLQueryInterface.removeColumn.call(this, tableName, attributeName, options);
        case 'mysql':
          // mysql needs special treatment as it cannot drop a column with a foreign key constraint
          return MySQLQueryInterface.removeColumn.call(this, tableName, attributeName, options);
        case 'oracle':
          //oracle needs special treatment as it cannot drop a column with a constraint
          return OracleQueryInterface.removeColumn.call(this, tableName, attributeName, options);
        default:
          return this.sequelize.query(this.QueryGenerator.removeColumnQuery(tableName, attributeName), options);
      }
    }
  }, {
    key: 'changeColumn',
    value: function changeColumn(tableName, attributeName, dataTypeOrOptions, options) {
      var attributes = {};
      options = options || {};

      if (Utils._.values(DataTypes).indexOf(dataTypeOrOptions) > -1) {
        attributes[attributeName] = { type: dataTypeOrOptions, allowNull: true };
      } else {
        attributes[attributeName] = dataTypeOrOptions;
      }

      attributes[attributeName].type = this.sequelize.normalizeDataType(attributes[attributeName].type);

      if (this.sequelize.options.dialect === 'sqlite') {
        // sqlite needs some special treatment as it cannot change a column
        return SQLiteQueryInterface.changeColumn.call(this, tableName, attributes, options);
      } else {
        var query = this.QueryGenerator.attributesToSQL(attributes);
        var sql = this.QueryGenerator.changeColumnQuery(tableName, query);

        return this.sequelize.query(sql, options);
      }
    }
  }, {
    key: 'renameColumn',
    value: function renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
      var _this6 = this;

      options = options || {};
      return this.describeTable(tableName, options).then(function (data) {
        if (!data[attrNameBefore]) {
          throw new Error('Table ' + tableName + ' doesn\'t have the column ' + attrNameBefore);
        }

        data = data[attrNameBefore] || {};

        var _options = {};

        _options[attrNameAfter] = {
          attribute: attrNameAfter,
          type: data.type,
          allowNull: data.allowNull,
          defaultValue: data.defaultValue
        };

        // fix: a not-null column cannot have null as default value
        if (data.defaultValue === null && !data.allowNull) {
          delete _options[attrNameAfter].defaultValue;
        }

        if (_this6.sequelize.options.dialect === 'sqlite') {
          // sqlite needs some special treatment as it cannot rename a column
          return SQLiteQueryInterface.renameColumn.call(_this6, tableName, attrNameBefore, attrNameAfter, options);
        } else {
          var sql = _this6.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, _this6.QueryGenerator.attributesToSQL(_options));
          return _this6.sequelize.query(sql, options);
        }
      });
    }
  }, {
    key: 'addIndex',
    value: function addIndex(tableName, attributes, options, rawTablename) {
      // Support for passing tableName, attributes, options or tableName, options (with a fields param which is the attributes)
      if (!Array.isArray(attributes)) {
        rawTablename = options;
        options = attributes;
        attributes = options.fields;
      }
      // testhint argsConform.end

      if (!rawTablename) {
        // Map for backwards compat
        rawTablename = tableName;
      }

      options = Utils.cloneDeep(options);
      options.fields = attributes;
      var sql = this.QueryGenerator.addIndexQuery(tableName, options, rawTablename);
      return this.sequelize.query(sql, _.assign({}, options, { supportsSearchPath: false }));
    }
  }, {
    key: 'showIndex',
    value: function showIndex(tableName, options) {
      var sql = this.QueryGenerator.showIndexesQuery(tableName, options);
      return this.sequelize.query(sql, _.assign({}, options, { type: QueryTypes.SHOWINDEXES }));
    }
  }, {
    key: 'nameIndexes',
    value: function nameIndexes(indexes, rawTablename) {
      return this.QueryGenerator.nameIndexes(indexes, rawTablename);
    }
  }, {
    key: 'getForeignKeysForTables',
    value: function getForeignKeysForTables(tableNames, options) {
      var _this7 = this;

      options = options || {};

      if (tableNames.length === 0) {
        return Promise.resolve({});
      }

      return Promise.map(tableNames, function (tableName) {
        return _this7.sequelize.query(_this7.QueryGenerator.getForeignKeysQuery(tableName, _this7.sequelize.config.database), options).get(0);
      }).then(function (results) {
        var result = {};

        tableNames.forEach(function (tableName, i) {
          if (Utils._.isObject(tableName)) {
            tableName = tableName.schema + '.' + tableName.tableName;
          }

          result[tableName] = Utils._.compact(results[i]).map(function (r) {
            return r.constraint_name;
          });
        });

        return result;
      });
    }
  }, {
    key: 'removeIndex',
    value: function removeIndex(tableName, indexNameOrAttributes, options) {
      options = options || {};
      var sql = this.QueryGenerator.removeIndexQuery(tableName, indexNameOrAttributes);
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'addConstraint',
    value: function addConstraint(tableName, attributes, options, rawTablename) {
      if (!Array.isArray(attributes)) {
        rawTablename = options;
        options = attributes;
        attributes = options.fields;
      }

      if (!options.type) {
        throw new Error('Constraint type must be specified through options.type');
      }

      if (!rawTablename) {
        // Map for backwards compat
        rawTablename = tableName;
      }

      options = Utils.cloneDeep(options);
      options.fields = attributes;

      if (this.sequelize.dialect.name === 'sqlite') {
        return SQLiteQueryInterface.addConstraint.call(this, tableName, options, rawTablename);
      } else {
        var sql = this.QueryGenerator.addConstraintQuery(tableName, options, rawTablename);
        return this.sequelize.query(sql, options);
      }
    }
  }, {
    key: 'showConstraint',
    value: function showConstraint(tableName, options) {
      var sql = this.QueryGenerator.showConstraintsQuery(tableName, options);
      return this.sequelize.query(sql, Object.assign({}, options, { type: QueryTypes.SHOWCONSTRAINTS }));
    }
  }, {
    key: 'removeConstraint',
    value: function removeConstraint(tableName, constraintName, options) {
      options = options || {};

      switch (this.sequelize.options.dialect) {
        case 'mysql':
          //Mysql does not support DROP CONSTRAINT. Instead DROP PRIMARY, FOREIGN KEY, INDEX should be used
          return MySQLQueryInterface.removeConstraint.call(this, tableName, constraintName, options);
        case 'sqlite':
          return SQLiteQueryInterface.removeConstraint.call(this, tableName, constraintName, options);
        default:
          var sql = this.QueryGenerator.removeConstraintQuery(tableName, constraintName);
          return this.sequelize.query(sql, options);
      }
    }
  }, {
    key: 'insert',
    value: function insert(instance, tableName, values, options) {
      options = Utils.cloneDeep(options);
      options.hasTrigger = instance && instance.constructor.options.hasTrigger;
      var sql = this.QueryGenerator.insertQuery(tableName, values, instance && instance.constructor.rawAttributes, options);

      options.type = QueryTypes.INSERT;
      options.instance = instance;

      return this.sequelize.query(sql, options).then(function (results) {
        if (instance) results[0].isNewRecord = false;
        return results;
      });
    }
  }, {
    key: 'upsert',
    value: function upsert(tableName, valuesByField, updateValues, where, model, options) {
      var wheres = [];
      var attributes = Object.keys(valuesByField);
      var indexes = [];
      var indexFields = void 0;

      options = _.clone(options);

      if (!Utils._.isEmpty(where)) {
        wheres.push(where);
      }

      // Lets combine uniquekeys and indexes into one
      indexes = Utils._.map(model.options.uniqueKeys, function (value) {
        return value.fields;
      });

      Utils._.each(model.options.indexes, function (value) {
        if (value.unique) {
          // fields in the index may both the strings or objects with an attribute property - lets sanitize that
          indexFields = Utils._.map(value.fields, function (field) {
            if (Utils._.isPlainObject(field)) {
              return field.attribute;
            }
            return field;
          });
          indexes.push(indexFields);
        }
      });

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = indexes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var index = _step.value;

          if (Utils._.intersection(attributes, index).length === index.length) {
            where = {};
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
              for (var _iterator2 = index[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var field = _step2.value;

                where[field] = valuesByField[field];
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

            wheres.push(where);
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

      where = { $or: wheres };

      options.type = QueryTypes.UPSERT;
      options.raw = true;

      var sql = this.QueryGenerator.upsertQuery(tableName, valuesByField, updateValues, where, model.rawAttributes, options);
      return this.sequelize.query(sql, options).then(function (rowCount) {
        if (rowCount === undefined) {
          return rowCount;
        }

        // MySQL returns 1 for inserted, 2 for updated http://dev.mysql.com/doc/refman/5.0/en/insert-on-duplicate.html. Postgres has been modded to do the same

        return rowCount === 1;
      });
    }
  }, {
    key: 'bulkInsert',
    value: function bulkInsert(tableName, records, options, attributes) {
      options = _.clone(options) || {};
      options.type = QueryTypes.INSERT;
      var sql = this.QueryGenerator.bulkInsertQuery(tableName, records, options, attributes);
      return this.sequelize.query(sql, options).then(function (results) {
        return results[0];
      });
    }
  }, {
    key: 'update',
    value: function update(instance, tableName, values, identifier, options) {
      options = _.clone(options || {});
      options.hasTrigger = !!(instance && instance._modelOptions && instance._modelOptions.hasTrigger);

      var sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, instance.constructor.rawAttributes);

      options.type = QueryTypes.UPDATE;

      options.instance = instance;
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'bulkUpdate',
    value: function bulkUpdate(tableName, values, identifier, options, attributes) {
      options = Utils.cloneDeep(options);
      if ((typeof identifier === 'undefined' ? 'undefined' : _typeof(identifier)) === 'object') identifier = Utils.cloneDeep(identifier);

      var sql = this.QueryGenerator.updateQuery(tableName, values, identifier, options, attributes);
      var table = Utils._.isObject(tableName) ? tableName : { tableName: tableName };
      var model = Utils._.find(this.sequelize.modelManager.models, { tableName: table.tableName });

      options.model = model;
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'delete',
    value: function _delete(instance, tableName, identifier, options) {
      var _this8 = this;

      var cascades = [];
      var sql = this.QueryGenerator.deleteQuery(tableName, identifier, null, instance.constructor);

      options = _.clone(options) || {};

      // Check for a restrict field
      if (!!instance.constructor && !!instance.constructor.associations) {
        var keys = Object.keys(instance.constructor.associations);
        var length = keys.length;
        var association = void 0;

        for (var i = 0; i < length; i++) {
          association = instance.constructor.associations[keys[i]];
          if (association.options && association.options.onDelete && association.options.onDelete.toLowerCase() === 'cascade' && association.options.useHooks === true) {
            cascades.push(association.accessors.get);
          }
        }
      }

      return Promise.each(cascades, function (cascade) {
        return instance[cascade](options).then(function (instances) {
          // Check for hasOne relationship with non-existing associate ("has zero")
          if (!instances) {
            return Promise.resolve();
          }

          if (!Array.isArray(instances)) instances = [instances];

          return Promise.each(instances, function (instance) {
            return instance.destroy(options);
          });
        });
      }).then(function () {
        options.instance = instance;
        return _this8.sequelize.query(sql, options);
      });
    }
  }, {
    key: 'bulkDelete',
    value: function bulkDelete(tableName, identifier, options, model) {
      options = Utils.cloneDeep(options);
      options = _.defaults(options, { limit: null });
      if ((typeof identifier === 'undefined' ? 'undefined' : _typeof(identifier)) === 'object') identifier = Utils.cloneDeep(identifier);

      var sql = this.QueryGenerator.deleteQuery(tableName, identifier, options, model);
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'select',
    value: function select(model, tableName, options) {
      options = Utils.cloneDeep(options);
      options.type = QueryTypes.SELECT;
      options.model = model;

      return this.sequelize.query(this.QueryGenerator.selectQuery(tableName, options, model), options);
    }
  }, {
    key: 'increment',
    value: function increment(instance, tableName, values, identifier, options) {
      var sql = this.QueryGenerator.arithmeticQuery('+', tableName, values, identifier, options.attributes);

      options = _.clone(options) || {};

      options.type = QueryTypes.UPDATE;
      options.instance = instance;
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'decrement',
    value: function decrement(instance, tableName, values, identifier, options) {
      var sql = this.QueryGenerator.arithmeticQuery('-', tableName, values, identifier, options.attributes);

      options = _.clone(options) || {};

      options.type = QueryTypes.UPDATE;
      options.instance = instance;
      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'rawSelect',
    value: function rawSelect(tableName, options, attributeSelector, Model) {
      if (options.schema) {
        tableName = this.QueryGenerator.addSchema({
          tableName: tableName,
          _schema: options.schema
        });
      }

      options = Utils.cloneDeep(options);
      options = _.defaults(options, {
        raw: true,
        plain: true,
        type: QueryTypes.SELECT
      });

      var sql = this.QueryGenerator.selectQuery(tableName, options, Model);

      if (attributeSelector === undefined) {
        throw new Error('Please pass an attribute selector!');
      }

      return this.sequelize.query(sql, options).then(function (data) {
        if (!options.plain) {
          return data;
        }

        var result = data ? data[attributeSelector] : null;

        if (options && options.dataType) {
          var dataType = options.dataType;

          if (dataType instanceof DataTypes.DECIMAL || dataType instanceof DataTypes.FLOAT) {
            result = parseFloat(result);
          } else if (dataType instanceof DataTypes.INTEGER || dataType instanceof DataTypes.BIGINT) {
            result = parseInt(result, 10);
          } else if (dataType instanceof DataTypes.DATE) {
            if (!Utils._.isNull(result) && !Utils._.isDate(result)) {
              result = new Date(result);
            }
          } else if (dataType instanceof DataTypes.STRING) {
            // Nothing to do, result is already a string.
          }
        }

        return result;
      });
    }
  }, {
    key: 'createTrigger',
    value: function createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray, options) {
      var sql = this.QueryGenerator.createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray);
      options = options || {};
      if (sql) {
        return this.sequelize.query(sql, options);
      } else {
        return Promise.resolve();
      }
    }
  }, {
    key: 'dropTrigger',
    value: function dropTrigger(tableName, triggerName, options) {
      var sql = this.QueryGenerator.dropTrigger(tableName, triggerName);
      options = options || {};

      if (sql) {
        return this.sequelize.query(sql, options);
      } else {
        return Promise.resolve();
      }
    }
  }, {
    key: 'renameTrigger',
    value: function renameTrigger(tableName, oldTriggerName, newTriggerName, options) {
      var sql = this.QueryGenerator.renameTrigger(tableName, oldTriggerName, newTriggerName);
      options = options || {};

      if (sql) {
        return this.sequelize.query(sql, options);
      } else {
        return Promise.resolve();
      }
    }
  }, {
    key: 'createFunction',
    value: function createFunction(functionName, params, returnType, language, body, options) {
      var sql = this.QueryGenerator.createFunction(functionName, params, returnType, language, body, options);
      options = options || {};

      if (sql) {
        return this.sequelize.query(sql, options);
      } else {
        return Promise.resolve();
      }
    }
  }, {
    key: 'dropFunction',
    value: function dropFunction(functionName, params, options) {
      var sql = this.QueryGenerator.dropFunction(functionName, params);
      options = options || {};

      if (sql) {
        return this.sequelize.query(sql, options);
      } else {
        return Promise.resolve();
      }
    }
  }, {
    key: 'renameFunction',
    value: function renameFunction(oldFunctionName, params, newFunctionName, options) {
      var sql = this.QueryGenerator.renameFunction(oldFunctionName, params, newFunctionName);
      options = options || {};

      if (sql) {
        return this.sequelize.query(sql, options);
      } else {
        return Promise.resolve();
      }
    }

    // Helper methods useful for querying

    /**
     * Escape an identifier (e.g. a table or attribute name). If force is true,
     * the identifier will be quoted even if the `quoteIdentifiers` option is
     * false.
     * @private
     */

  }, {
    key: 'quoteIdentifier',
    value: function quoteIdentifier(identifier, force) {
      return this.QueryGenerator.quoteIdentifier(identifier, force);
    }
  }, {
    key: 'quoteTable',
    value: function quoteTable(identifier) {
      return this.QueryGenerator.quoteTable(identifier);
    }

    /**
     * Split an identifier into .-separated tokens and quote each part.
     * If force is true, the identifier will be quoted even if the
     * `quoteIdentifiers` option is false.
     * @private
     */

  }, {
    key: 'quoteIdentifiers',
    value: function quoteIdentifiers(identifiers, force) {
      return this.QueryGenerator.quoteIdentifiers(identifiers, force);
    }

    /**
     * Escape a value (e.g. a string, number or date)
     * @private
     */

  }, {
    key: 'escape',
    value: function escape(value) {
      return this.QueryGenerator.escape(value);
    }
  }, {
    key: 'setAutocommit',
    value: function setAutocommit(transaction, value, options) {
      if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to set autocommit for a transaction without transaction object!');
      }
      if (transaction.parent) {
        // Not possible to set a seperate isolation level for savepoints
        return Promise.resolve();
      }

      options = _.assign({}, options, {
        transaction: transaction.parent || transaction
      });

      var sql = this.QueryGenerator.setAutocommitQuery(value, {
        parent: transaction.parent
      });

      if (!sql) return Promise.resolve();

      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'setIsolationLevel',
    value: function setIsolationLevel(transaction, value, options) {
      if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to set isolation level for a transaction without transaction object!');
      }

      if (transaction.parent || !value) {
        // Not possible to set a seperate isolation level for savepoints
        return Promise.resolve();
      }

      options = _.assign({}, options, {
        transaction: transaction.parent || transaction
      });

      var sql = this.QueryGenerator.setIsolationLevelQuery(value, {
        parent: transaction.parent
      });

      if (!sql) return Promise.resolve();

      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'startTransaction',
    value: function startTransaction(transaction, options) {
      if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to start a transaction without transaction object!');
      }

      options = _.assign({}, options, {
        transaction: transaction.parent || transaction
      });
      options.transaction.name = transaction.parent ? transaction.name : undefined;
      var sql = this.QueryGenerator.startTransactionQuery(transaction);

      return this.sequelize.query(sql, options);
    }
  }, {
    key: 'deferConstraints',
    value: function deferConstraints(transaction, options) {
      options = _.assign({}, options, {
        transaction: transaction.parent || transaction
      });

      var sql = this.QueryGenerator.deferConstraintsQuery(options);

      if (sql) {
        return this.sequelize.query(sql, options);
      }

      return Promise.resolve();
    }
  }, {
    key: 'commitTransaction',
    value: function commitTransaction(transaction, options) {
      if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to commit a transaction without transaction object!');
      }
      if (transaction.parent) {
        // Savepoints cannot be committed
        return Promise.resolve();
      }

      options = _.assign({}, options, {
        transaction: transaction.parent || transaction,
        supportsSearchPath: false
      });

      var sql = this.QueryGenerator.commitTransactionQuery(transaction);
      var promise = this.sequelize.query(sql, options);

      transaction.finished = 'commit';

      return promise;
    }
  }, {
    key: 'rollbackTransaction',
    value: function rollbackTransaction(transaction, options) {
      if (!transaction || !(transaction instanceof Transaction)) {
        throw new Error('Unable to rollback a transaction without transaction object!');
      }

      options = _.assign({}, options, {
        transaction: transaction.parent || transaction,
        supportsSearchPath: false
      });
      options.transaction.name = transaction.parent ? transaction.name : undefined;
      var sql = this.QueryGenerator.rollbackTransactionQuery(transaction);
      var promise = this.sequelize.query(sql, options);

      transaction.finished = 'rollback';

      return promise;
    }
  }]);

  return QueryInterface;
}();

module.exports = QueryInterface;
module.exports.QueryInterface = QueryInterface;
module.exports.default = QueryInterface;