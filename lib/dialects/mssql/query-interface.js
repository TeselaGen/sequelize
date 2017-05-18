'use strict';

/**
 Returns an object that treats MSSQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

/**
  A wrapper that fixes MSSQL's inability to cleanly remove columns from existing tables if they have a default constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries
 @private
 */

var removeColumn = function removeColumn(tableName, attributeName, options) {
  var _this = this;

  options = Object.assign({ raw: true }, options || {});

  var findConstraintSql = this.QueryGenerator.getDefaultConstraintQuery(tableName, attributeName);
  return this.sequelize.query(findConstraintSql, options).spread(function (results) {
    if (!results.length) {
      // No default constraint found -- we can cleanly remove the column
      return;
    }
    var dropConstraintSql = _this.QueryGenerator.dropConstraintQuery(tableName, results[0].name);
    return _this.sequelize.query(dropConstraintSql, options);
  }).then(function () {
    var findForeignKeySql = _this.QueryGenerator.getForeignKeyQuery(tableName, attributeName);
    return _this.sequelize.query(findForeignKeySql, options);
  }).spread(function (results) {
    if (!results.length) {
      // No foreign key constraints found, so we can remove the column
      return;
    }
    var dropForeignKeySql = _this.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name);
    return _this.sequelize.query(dropForeignKeySql, options);
  }).then(function () {
    //Check if the current column is a primaryKey
    var primaryKeyConstraintSql = _this.QueryGenerator.getPrimaryKeyConstraintQuery(tableName, attributeName);
    return _this.sequelize.query(primaryKeyConstraintSql, options);
  }).spread(function (result) {
    if (!result.length) {
      return;
    }
    var dropConstraintSql = _this.QueryGenerator.dropConstraintQuery(tableName, result[0].constraintName);
    return _this.sequelize.query(dropConstraintSql, options);
  }).then(function () {
    var removeSql = _this.QueryGenerator.removeColumnQuery(tableName, attributeName);
    return _this.sequelize.query(removeSql, options);
  });
};

module.exports = {
  removeColumn: removeColumn
};
//# sourceMappingURL=query-interface.js.map