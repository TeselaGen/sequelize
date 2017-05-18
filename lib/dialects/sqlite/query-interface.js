'use strict';

var Utils = require('../../utils');
var Promise = require('../../promise');
var UnknownConstraintError = require('../../errors').UnknownConstraintError;

/**
 Returns an object that treats SQLite's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

/**
  A wrapper that fixes SQLite's inability to remove columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but without the obsolete column.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function removeColumn(tableName, attributeName, options) {
  var _this = this;

  options = options || {};

  return this.describeTable(tableName, options).then(function (fields) {
    delete fields[attributeName];

    var sql = _this.QueryGenerator.removeColumnQuery(tableName, fields);
    var subQueries = sql.split(';').filter(function (q) {
      return q !== '';
    });

    return Promise.each(subQueries, function (subQuery) {
      return _this.sequelize.query(subQuery + ';', Utils._.assign({ raw: true }, options));
    });
  });
}
exports.removeColumn = removeColumn;

/**
  A wrapper that fixes SQLite's inability to change columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a modified version of the respective column.

  @method changeColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {Object} attributes An object with the attribute's name as key and it's options as value object.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function changeColumn(tableName, attributes, options) {
  var _this2 = this;

  var attributeName = Object.keys(attributes)[0];
  options = options || {};

  return this.describeTable(tableName, options).then(function (fields) {
    fields[attributeName] = attributes[attributeName];

    var sql = _this2.QueryGenerator.removeColumnQuery(tableName, fields);
    var subQueries = sql.split(';').filter(function (q) {
      return q !== '';
    });

    return Promise.each(subQueries, function (subQuery) {
      return _this2.sequelize.query(subQuery + ';', Utils._.assign({ raw: true }, options));
    });
  });
}
exports.changeColumn = changeColumn;

/**
  A wrapper that fixes SQLite's inability to rename columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a renamed version of the respective column.

  @method renameColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {String} attrNameBefore The name of the attribute before it was renamed.
  @param  {String} attrNameAfter The name of the attribute after it was renamed.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
  var _this3 = this;

  options = options || {};

  return this.describeTable(tableName, options).then(function (fields) {
    fields[attrNameAfter] = Utils._.clone(fields[attrNameBefore]);
    delete fields[attrNameBefore];

    var sql = _this3.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields);
    var subQueries = sql.split(';').filter(function (q) {
      return q !== '';
    });

    return Promise.each(subQueries, function (subQuery) {
      return _this3.sequelize.query(subQuery + ';', Utils._.assign({ raw: true }, options));
    });
  });
}
exports.renameColumn = renameColumn;

function removeConstraint(tableName, constraintName, options) {
  var _this4 = this;

  var createTableSql = void 0;

  return this.showConstraint(tableName, constraintName).then(function (constraints) {
    var constraint = constraints[0];

    if (constraint) {
      createTableSql = constraint.sql;
      constraint.constraintName = _this4.QueryGenerator.quoteIdentifier(constraint.constraintName);
      var constraintSnippet = ', CONSTRAINT ' + constraint.constraintName + ' ' + constraint.constraintType + ' ' + constraint.constraintCondition;

      if (constraint.constraintType === 'FOREIGN KEY') {
        var referenceTableName = _this4.QueryGenerator.quoteTable(constraint.referenceTableName);
        constraint.referenceTableKeys = constraint.referenceTableKeys.map(function (columnName) {
          return _this4.QueryGenerator.quoteIdentifier(columnName);
        });
        var referenceTableKeys = constraint.referenceTableKeys.join(', ');
        constraintSnippet += ' REFERENCES ' + referenceTableName + ' (' + referenceTableKeys + ')';
        constraintSnippet += ' ON UPDATE ' + constraint.updateAction;
        constraintSnippet += ' ON DELETE ' + constraint.deleteAction;
      }

      createTableSql = createTableSql.replace(constraintSnippet, '');
      createTableSql += ';';

      return _this4.describeTable(tableName, options);
    } else {
      throw new UnknownConstraintError('Constraint ' + constraintName + ' on table ' + tableName + ' does not exist');
    }
  }).then(function (fields) {
    var sql = _this4.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
    var subQueries = sql.split(';').filter(function (q) {
      return q !== '';
    });

    return Promise.each(subQueries, function (subQuery) {
      return _this4.sequelize.query(subQuery + ';', Utils._.assign({ raw: true }, options));
    });
  });
}
exports.removeConstraint = removeConstraint;

function addConstraint(tableName, options) {
  var _this5 = this;

  var constraintSnippet = this.QueryGenerator.getConstraintSnippet(tableName, options);
  var describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);
  var createTableSql = void 0;

  return this.sequelize.query(describeCreateTableSql, options).then(function (constraints) {
    var sql = constraints[0].sql;
    var index = sql.length - 1;
    //Replace ending ')' with constraint snippet - Simulates String.replaceAt
    //http://stackoverflow.com/questions/1431094
    createTableSql = sql.substr(0, index) + (', ' + constraintSnippet + ')') + sql.substr(index + 1) + ';';

    return _this5.describeTable(tableName, options);
  }).then(function (fields) {
    var sql = _this5.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
    var subQueries = sql.split(';').filter(function (q) {
      return q !== '';
    });

    return Promise.each(subQueries, function (subQuery) {
      return _this5.sequelize.query(subQuery + ';', Utils._.assign({ raw: true }, options));
    });
  });
}
exports.addConstraint = addConstraint;
//# sourceMappingURL=query-interface.js.map