'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Utils = require('../../utils');
var util = require('util');
var Transaction = require('../../transaction');
var _ = require('lodash');
var MySqlQueryGenerator = require('../mysql/query-generator');
var AbstractQueryGenerator = require('../abstract/query-generator');

var QueryGenerator = {
  __proto__: MySqlQueryGenerator,
  options: {},
  dialect: 'sqlite',

  createSchema: function createSchema() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },
  showSchemasQuery: function showSchemasQuery() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },
  versionQuery: function versionQuery() {
    return 'SELECT sqlite_version() as `version`';
  },
  createTableQuery: function createTableQuery(tableName, attributes, options) {
    var _this = this;

    options = options || {};

    var primaryKeys = [];
    var needsMultiplePrimaryKeys = Utils._.values(attributes).filter(function (definition) {
      return _.includes(definition, 'PRIMARY KEY');
    }).length > 1;
    var attrArray = [];

    for (var attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        var dataType = attributes[attr];
        var containsAutoIncrement = Utils._.includes(dataType, 'AUTOINCREMENT');

        if (containsAutoIncrement) {
          dataType = dataType.replace(/BIGINT/, 'INTEGER');
        }

        var dataTypeString = dataType;
        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          if (Utils._.includes(dataType, 'INTEGER')) {
            // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            dataTypeString = containsAutoIncrement ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INTEGER PRIMARY KEY';
          }

          if (needsMultiplePrimaryKeys) {
            primaryKeys.push(attr);
            dataTypeString = dataType.replace(/PRIMARY KEY/, 'NOT NULL');
          }
        }
        attrArray.push(this.quoteIdentifier(attr) + ' ' + dataTypeString);
      }
    }

    var table = this.quoteTable(tableName);
    var attrStr = attrArray.join(', ');
    var pkString = primaryKeys.map(function (pk) {
      return _this.quoteIdentifier(pk);
    }).join(', ');

    if (options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, function (columns) {
        if (!columns.singleField) {
          // If it's a single field its handled in column def, not as an index
          attrStr += ', UNIQUE (' + columns.fields.map(function (field) {
            return _this.quoteIdentifier(field);
          }).join(', ') + ')';
        }
      });
    }

    if (pkString.length > 0) {
      attrStr += ', PRIMARY KEY (' + pkString + ')';
    }

    var sql = 'CREATE TABLE IF NOT EXISTS ' + table + ' (' + attrStr + ');';
    return this.replaceBooleanDefaults(sql);
  },
  booleanValue: function booleanValue(value) {
    return value ? 1 : 0;
  },


  /**
   * Check whether the statmement is json function or simple path
   *
   * @param   {String}  stmt  The statement to validate
   * @returns {Boolean}       true if the given statement is json function
   * @throws  {Error}         throw if the statement looks like json function but has invalid token
   */
  checkValidJsonStatement: function checkValidJsonStatement(stmt) {
    if (!_.isString(stmt)) {
      return false;
    }

    // https://sqlite.org/json1.html
    var jsonFunctionRegex = /^\s*(json(?:_[a-z]+){0,2})\([^)]*\)/i;
    var tokenCaptureRegex = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;

    var currentIndex = 0;
    var openingBrackets = 0;
    var closingBrackets = 0;
    var hasJsonFunction = false;
    var hasInvalidToken = false;

    while (currentIndex < stmt.length) {
      var string = stmt.substr(currentIndex);
      var functionMatches = jsonFunctionRegex.exec(string);
      if (functionMatches) {
        currentIndex += functionMatches[0].indexOf('(');
        hasJsonFunction = true;
        continue;
      }

      var tokenMatches = tokenCaptureRegex.exec(string);
      if (tokenMatches) {
        var capturedToken = tokenMatches[1];
        if (capturedToken === '(') {
          openingBrackets++;
        } else if (capturedToken === ')') {
          closingBrackets++;
        } else if (capturedToken === ';') {
          hasInvalidToken = true;
          break;
        }
        currentIndex += tokenMatches[0].length;
        continue;
      }

      break;
    }

    // Check invalid json statement
    hasInvalidToken |= openingBrackets !== closingBrackets;
    if (hasJsonFunction && hasInvalidToken) {
      throw new Error('Invalid json statement: ' + stmt);
    }

    // return true if the statement has valid json function
    return hasJsonFunction;
  },


  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {String}               column  The JSON column
   * @param   {String|Array<String>} [path]  The path to extract (optional)
   * @returns {String}                       The generated sql query
   * @private
   */
  jsonPathExtractionQuery: function jsonPathExtractionQuery(column, path) {
    var paths = _.toPath(path);
    var pathStr = this.escape(['$'].concat(paths).join('.').replace(/\.(\d+)(?:(?=\.)|$)/g, function (_, digit) {
      return '[' + digit + ']';
    }));

    var quotedColumn = this.isIdentifierQuoted(column) ? column : this.quoteIdentifier(column);
    return 'json_extract(' + quotedColumn + ', ' + pathStr + ')';
  },
  handleSequelizeMethod: function handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    var _this2 = this;

    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        var conditions = this.parseConditionObject(smth.conditions).map(function (condition) {
          return _this2.jsonPathExtractionQuery(_.first(condition.path), _.tail(condition.path)) + ' = \'' + condition.value + '\'';
        });

        return conditions.join(' AND ');
      } else if (smth.path) {
        var str = void 0;

        // Allow specifying conditions using the sqlite json functions
        if (this.checkValidJsonStatement(smth.path)) {
          str = smth.path;
        } else {
          // Also support json property accessors
          var paths = _.toPath(smth.path);
          var column = paths.shift();
          str = this.jsonPathExtractionQuery(column, paths);
        }

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
        }

        return str;
      }
    } else if (smth instanceof Utils.Cast) {
      if (/timestamp/i.test(smth.type)) {
        smth.type = 'datetime';
      }
    }
    return AbstractQueryGenerator.handleSequelizeMethod.call(this, smth, tableName, factory, options, prepend);
  },
  addColumnQuery: function addColumnQuery(table, key, dataType) {
    var attributes = {};
    attributes[key] = dataType;
    var fields = this.attributesToSQL(attributes, { context: 'addColumn' });
    var attribute = this.quoteIdentifier(key) + ' ' + fields[key];

    var sql = 'ALTER TABLE ' + this.quoteTable(table) + ' ADD ' + attribute + ';';

    return this.replaceBooleanDefaults(sql);
  },
  showTablesQuery: function showTablesQuery() {
    return "SELECT name FROM `sqlite_master` WHERE type='table' and name!='sqlite_sequence';";
  },
  upsertQuery: function upsertQuery(tableName, insertValues, updateValues, where, rawAttributes, options) {
    options.ignoreDuplicates = true;

    var sql = this.insertQuery(tableName, insertValues, rawAttributes, options) + ' ' + this.updateQuery(tableName, updateValues, where, options, rawAttributes);

    return sql;
  },
  updateQuery: function updateQuery(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

    var modelAttributeMap = {};
    var values = [];

    if (attributes) {
      _.each(attributes, function (attribute, key) {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (var key in attrValueHash) {
      var value = attrValueHash[key];
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'UPDATE' }));
    }

    return 'UPDATE ' + this.quoteTable(tableName) + ' SET ' + values.join(',') + ' ' + this.whereQuery(where, options);
  },
  deleteQuery: function deleteQuery(tableName, where, options, model) {
    options = options || {};
    _.defaults(options, this.options);

    var whereClause = this.getWhereConditions(where, null, model, options);
    if (whereClause) {
      whereClause = ' WHERE ' + whereClause;
    }

    return 'DELETE FROM ' + this.quoteTable(tableName) + whereClause;
  },
  attributesToSQL: function attributesToSQL(attributes) {
    var result = {};

    for (var name in attributes) {
      var dataType = attributes[name];
      var fieldName = dataType.field || name;

      if (Utils._.isObject(dataType)) {
        var sql = dataType.type.toString();

        if (dataType.hasOwnProperty('allowNull') && !dataType.allowNull) {
          sql += ' NOT NULL';
        }

        if (Utils.defaultValueSchemable(dataType.defaultValue)) {
          // TODO thoroughly check that DataTypes.NOW will properly
          // get populated on all databases as DEFAULT value
          // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
          sql += ' DEFAULT ' + this.escape(dataType.defaultValue, dataType);
        }

        if (dataType.unique === true) {
          sql += ' UNIQUE';
        }

        if (dataType.primaryKey) {
          sql += ' PRIMARY KEY';

          if (dataType.autoIncrement) {
            sql += ' AUTOINCREMENT';
          }
        }

        if (dataType.references) {
          var referencesTable = this.quoteTable(dataType.references.model);

          var referencesKey = void 0;
          if (dataType.references.key) {
            referencesKey = this.quoteIdentifier(dataType.references.key);
          } else {
            referencesKey = this.quoteIdentifier('id');
          }

          sql += ' REFERENCES ' + referencesTable + ' (' + referencesKey + ')';

          if (dataType.onDelete) {
            sql += ' ON DELETE ' + dataType.onDelete.toUpperCase();
          }

          if (dataType.onUpdate) {
            sql += ' ON UPDATE ' + dataType.onUpdate.toUpperCase();
          }
        }

        result[fieldName] = sql;
      } else {
        result[fieldName] = dataType;
      }
    }

    return result;
  },
  findAutoIncrementField: function findAutoIncrementField(factory) {
    var fields = [];

    for (var name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        var definition = factory.attributes[name];
        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },
  showIndexesQuery: function showIndexesQuery(tableName) {
    return 'PRAGMA INDEX_LIST(' + this.quoteTable(tableName) + ')';
  },
  showConstraintsQuery: function showConstraintsQuery(tableName, constraintName) {
    var sql = 'SELECT sql FROM sqlite_master WHERE tbl_name=\'' + tableName + '\'';

    if (constraintName) {
      sql += ' AND sql LIKE \'%' + constraintName + '%\'';
    }

    return sql + ';';
  },
  removeIndexQuery: function removeIndexQuery(tableName, indexNameOrAttributes) {
    var indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    return 'DROP INDEX IF EXISTS ' + this.quoteIdentifier(indexName);
  },
  describeTableQuery: function describeTableQuery(tableName, schema, schemaDelimiter) {
    var table = {
      _schema: schema,
      _schemaDelimiter: schemaDelimiter,
      tableName: tableName
    };
    return 'PRAGMA TABLE_INFO(' + this.quoteTable(this.addSchema(table)) + ');';
  },
  describeCreateTableQuery: function describeCreateTableQuery(tableName) {
    return 'SELECT sql FROM sqlite_master WHERE tbl_name=\'' + tableName + '\';';
  },
  removeColumnQuery: function removeColumnQuery(tableName, attributes) {

    attributes = this.attributesToSQL(attributes);

    var backupTableName = void 0;
    if ((typeof tableName === 'undefined' ? 'undefined' : _typeof(tableName)) === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }

    var quotedTableName = this.quoteTable(tableName);
    var quotedBackupTableName = this.quoteTable(backupTableName);
    var attributeNames = Object.keys(attributes).join(', ');

    return this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE') + ('INSERT INTO ' + quotedBackupTableName + ' SELECT ' + attributeNames + ' FROM ' + quotedTableName + ';') + ('DROP TABLE ' + quotedTableName + ';') + this.createTableQuery(tableName, attributes) + ('INSERT INTO ' + quotedTableName + ' SELECT ' + attributeNames + ' FROM ' + quotedBackupTableName + ';') + ('DROP TABLE ' + quotedBackupTableName + ';');
  },
  _alterConstraintQuery: function _alterConstraintQuery(tableName, attributes, createTableSql) {
    var backupTableName = void 0;

    attributes = this.attributesToSQL(attributes);

    if ((typeof tableName === 'undefined' ? 'undefined' : _typeof(tableName)) === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }
    var quotedTableName = this.quoteTable(tableName);
    var quotedBackupTableName = this.quoteTable(backupTableName);
    var attributeNames = Object.keys(attributes).join(', ');

    return createTableSql.replace('CREATE TABLE ' + quotedTableName, 'CREATE TABLE ' + quotedBackupTableName) + ('INSERT INTO ' + quotedBackupTableName + ' SELECT ' + attributeNames + ' FROM ' + quotedTableName + ';') + ('DROP TABLE ' + quotedTableName + ';') + ('ALTER TABLE ' + quotedBackupTableName + ' RENAME TO ' + quotedTableName + ';');
  },
  renameColumnQuery: function renameColumnQuery(tableName, attrNameBefore, attrNameAfter, attributes) {
    var _this3 = this;

    var backupTableName = void 0;

    attributes = this.attributesToSQL(attributes);

    if ((typeof tableName === 'undefined' ? 'undefined' : _typeof(tableName)) === 'object') {
      backupTableName = {
        tableName: tableName.tableName + '_backup',
        schema: tableName.schema
      };
    } else {
      backupTableName = tableName + '_backup';
    }

    var quotedTableName = this.quoteTable(tableName);
    var quotedBackupTableName = this.quoteTable(backupTableName);
    var attributeNamesImport = Object.keys(attributes).map(function (attr) {
      return attrNameAfter === attr ? _this3.quoteIdentifier(attrNameBefore) + ' AS ' + _this3.quoteIdentifier(attr) : _this3.quoteIdentifier(attr);
    }).join(', ');
    var attributeNamesExport = Object.keys(attributes).map(function (attr) {
      return _this3.quoteIdentifier(attr);
    }).join(', ');

    return this.createTableQuery(backupTableName, attributes).replace('CREATE TABLE', 'CREATE TEMPORARY TABLE') + ('INSERT INTO ' + quotedBackupTableName + ' SELECT ' + attributeNamesImport + ' FROM ' + quotedTableName + ';') + ('DROP TABLE ' + quotedTableName + ';') + this.createTableQuery(tableName, attributes) + ('INSERT INTO ' + quotedTableName + ' SELECT ' + attributeNamesExport + ' FROM ' + quotedBackupTableName + ';') + ('DROP TABLE ' + quotedBackupTableName + ';');
  },
  startTransactionQuery: function startTransactionQuery(transaction) {
    if (transaction.parent) {
      return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
    }

    return 'BEGIN ' + transaction.options.type + ' TRANSACTION;';
  },
  setAutocommitQuery: function setAutocommitQuery() {
    // SQLite does not support SET autocommit
    return null;
  },
  setIsolationLevelQuery: function setIsolationLevelQuery(value) {
    switch (value) {
      case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
        return '-- SQLite is not able to choose the isolation level REPEATABLE READ.';
      case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
        return 'PRAGMA read_uncommitted = ON;';
      case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
        return 'PRAGMA read_uncommitted = OFF;';
      case Transaction.ISOLATION_LEVELS.SERIALIZABLE:
        return "-- SQLite's default isolation level is SERIALIZABLE. Nothing to do.";
      default:
        throw new Error('Unknown isolation level: ' + value);
    }
  },
  replaceBooleanDefaults: function replaceBooleanDefaults(sql) {
    return sql.replace(/DEFAULT '?false'?/g, 'DEFAULT 0').replace(/DEFAULT '?true'?/g, 'DEFAULT 1');
  },
  quoteIdentifier: function quoteIdentifier(identifier) {
    if (identifier === '*') return identifier;
    return Utils.addTicks(Utils.removeTicks(identifier, '`'), '`');
  },


  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {String} tableName  The name of the table.
   * @return {String}            The generated sql query.
   * @private
   */
  getForeignKeysQuery: function getForeignKeysQuery(tableName) {
    return 'PRAGMA foreign_key_list(' + tableName + ')';
  }
};

module.exports = QueryGenerator;
//# sourceMappingURL=query-generator.js.map