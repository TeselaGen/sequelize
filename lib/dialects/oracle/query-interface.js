'use strict';

var Utils = require('../../utils');
var _ = require('lodash');
var Promise = require('../../promise');

/**
 Returns an object that treats Oracle's inabilities to do certain queries.
 */

/**
  A wrapper that fixes Oracle's inability to cleanly drop constraints on multiple tables if the calls are made at the same time 
  @param  {Object} options
 */
var dropAllTables = function dropAllTables(options) {
  var _this = this;

  options = options || {};
  var skip = options.skip || [];

  //As oracle uppercase all tables names, we create a mapping array with everything in upperCase
  var upperSkip = skip.map(function (table) {
    return table.toUpperCase();
  });

  var dropAllTablesFct = function dropAllTablesFct(tableNames) {
    return Promise.each(tableNames, function (tableName) {
      // if tableName is not in the Array of tables names then dont drop it
      if (Object.keys(tableName).length > 0) {
        if (upperSkip.indexOf(tableName.tableName) === -1) {
          return _this.dropTable(tableName, _.assign({}, options, { cascade: true }));
        }
      } else {
        if (upperSkip.indexOf(tableName) === -1) {
          return _this.dropTable(tableName, _.assign({}, options, { cascade: true }));
        }
      }
    });
  };

  //Function to make each call to drop indexes / FK / PK... 
  //Mandatory for Oracle as it could try to delete a PK and a FK at the same time on different tables and causes issues with the DB
  var doAfter = function doAfter(promises, idx, sequelizeInstance) {
    if (promises.length > 0) {

      if (idx < promises.length) {
        var elem = promises[idx];
        idx++;
        //While elements, we execute the query
        return sequelizeInstance.query(elem.sql, elem.options).then(function () {
          return doAfter(promises, idx, sequelizeInstance);
        });
      } else {
        //Done, we get out
        return Promise.resolve({});
      }
    } else {
      return Promise.resolve({});
    }
  };

  return this.showAllTables(options).then(function (tableNames) {
    return _this.getForeignKeysForTables(tableNames, options).then(function (foreignKeys) {
      var promises = [];

      tableNames.forEach(function (tableName) {
        var normalizedTableName = tableName;
        if (Utils._.isObject(tableName)) {
          normalizedTableName = tableName.schema + '.' + tableName.tableName;
        }

        foreignKeys[normalizedTableName].forEach(function (foreignKey) {
          var sql = _this.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey);
          //Instead of calling the promises, we set all parameters into an array
          promises.push({ sql: sql, options: options });
        });
      });

      return doAfter(promises, 0, _this.sequelize).then(function () {
        return dropAllTablesFct(tableNames);
      });
    });
  });
};

/**
  A wrapper that fixes Oracle's inability to cleanly remove columns from existing tables if they have a default constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries
 @private
 */
var removeColumn = function removeColumn(tableName, attributeName, options) {
  var _this2 = this;

  options = Object.assign({ raw: true }, options || {});

  var constraintsSql = [];

  //We start by searching if the primary key is an identity
  var descriptionTableQuery = this.QueryGenerator.isIdentityPrimaryKey(tableName);
  return this.sequelize.query(descriptionTableQuery, options).spread(function (PKResult) {

    for (var i = 0; i < PKResult.length; i++) {
      //We iterate through the primary keys to determine if we are working on it
      if (PKResult[i].column_name === attributeName.toUpperCase()) {
        //The column we are working on is in the PK AND is an identity column, we have to drop the identity 
        var dropIdentitySql = _this2.QueryGenerator.dropIdentityColumn(tableName, attributeName);
        constraintsSql.push({
          sql: dropIdentitySql,
          options: options
        });
        break;
      }
    }

    //This method return all constraints on a table with a given attribute
    var findConstraintSql = _this2.QueryGenerator.getConstraintsOnColumn(tableName, attributeName);
    return _this2.sequelize.query(findConstraintSql, options).spread(function (results) {
      if (!results.length && constraintsSql.length === 0) {
        // No default constraint found -- we can cleanly remove the column
        return;
      }

      //Function to execute the different remove one by one
      var deleteRecursively = function deleteRecursively(constraints, idx, sequelizeInstance) {
        if (constraints.length > 0) {
          if (idx < constraints.length) {
            var elem = constraints[idx];
            idx++;
            //While elements, we execute the query
            return sequelizeInstance.query(elem.sql, elem.options).then(function () {
              return deleteRecursively(constraints, idx, sequelizeInstance);
            });
          } else {
            //Done, we get out
            return Promise.resolve({});
          }
        } else {
          return Promise.resolve({});
        }
      };

      results.forEach(function (result) {
        //For each constraint, we get the sql
        constraintsSql.push({
          sql: _this2.QueryGenerator.dropConstraintQuery(tableName, result.constraint_name),
          options: options
        });
      });

      // const dropConstraintSql = this.QueryGenerator.dropConstraintQuery(tableName, results[0].name);
      return deleteRecursively(constraintsSql, 0, _this2.sequelize);
    }).then(function () {
      var removeSql = _this2.QueryGenerator.removeColumnQuery(tableName, attributeName);
      return _this2.sequelize.query(removeSql, options);
    });
  });
};

/**
 * A wrapper that adds the currentModel of the describe in options
 * This is used for mapping the real column names to those returned by Oracle
 */
var addOptionsForDescribe = function addOptionsForDescribe(tableName, options) {
  if (this.sequelize && this.sequelize.models && Object.keys(this.sequelize.models).length > 0) {
    var keys = Object.keys(this.sequelize.models);
    var i = 0,
        found = false;
    while (i < keys.length && !found) {
      var model = this.sequelize.models[keys[i]];
      if (model.tableName === tableName) {
        if (options) {
          options['describeModelAttributes'] = model.attributes;
        } else {
          options = {
            'describeModelAttributes': model.attributes
          };
        }
        found = true;
      }
      i++;
    }
  }
  return options;
};

module.exports = {
  dropAllTables: dropAllTables,
  removeColumn: removeColumn,
  addOptionsForDescribe: addOptionsForDescribe
};
//# sourceMappingURL=query-interface.js.map