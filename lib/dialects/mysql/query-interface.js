'use strict';

/**
 Returns an object that treats MySQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

var _ = require('lodash');
var UnknownConstraintError = require('../../errors').UnknownConstraintError;

/**
  A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} columnName    The name of the attribute that we want to remove.
  @param  {Object} options
 @private
 */
function removeColumn(tableName, columnName, options) {
  var _this = this;

  options = options || {};

  return this.sequelize.query(this.QueryGenerator.getForeignKeyQuery(tableName, columnName), _.assign({ raw: true }, options)).spread(function (results) {
    //Exclude primary key constraint
    if (!results.length || results[0].constraint_name === 'PRIMARY') {
      // No foreign key constraints found, so we can remove the column
      return;
    }
    return _this.sequelize.query(_this.QueryGenerator.dropForeignKeyQuery(tableName, results[0].constraint_name), _.assign({ raw: true }, options));
  }).then(function () {
    return _this.sequelize.query(_this.QueryGenerator.removeColumnQuery(tableName, columnName), _.assign({ raw: true }, options));
  });
}

function removeConstraint(tableName, constraintName, options) {
  var _this2 = this;

  var sql = this.QueryGenerator.showConstraintsQuery(tableName, constraintName);

  return this.sequelize.query(sql, Object.assign({}, options, { type: this.sequelize.QueryTypes.SHOWCONSTRAINTS })).then(function (constraints) {
    var constraint = constraints[0];
    var query = void 0;
    if (constraint && constraint.constraintType) {
      if (constraint.constraintType === 'FOREIGN KEY') {
        query = _this2.QueryGenerator.dropForeignKeyQuery(tableName, constraintName);
      } else {
        query = _this2.QueryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName);
      }
    } else {
      throw new UnknownConstraintError('Constraint ' + constraintName + ' on table ' + tableName + ' does not exist');
    }

    return _this2.sequelize.query(query, options);
  });
}

exports.removeConstraint = removeConstraint;
exports.removeColumn = removeColumn;