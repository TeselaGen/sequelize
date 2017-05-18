'use strict';

var Utils = require('./../utils');

function checkNamingCollision(association) {
  if (association.source.rawAttributes.hasOwnProperty(association.as)) {
    throw new Error('Naming collision between attribute \'' + association.as + '\' and association \'' + association.as + '\' on model ' + association.source.name + '. To remedy this, change either foreignKey or as in your association definition');
  }
}
exports.checkNamingCollision = checkNamingCollision;

function addForeignKeyConstraints(newAttribute, source, target, options, key) {
  // FK constraints are opt-in: users must either set `foreignKeyConstraints`
  // on the association, or request an `onDelete` or `onUpdate` behaviour

  if (options.foreignKeyConstraint || options.onDelete || options.onUpdate) {

    // Find primary keys: composite keys not supported with this approach
    var primaryKeys = Utils._.chain(source.rawAttributes).keys().filter(function (key) {
      return source.rawAttributes[key].primaryKey;
    }).map(function (key) {
      return source.rawAttributes[key].field || key;
    }).value();

    if (primaryKeys.length === 1) {
      if (source._schema) {
        newAttribute.references = {
          model: source.sequelize.queryInterface.QueryGenerator.addSchema({
            tableName: source.tableName,
            _schema: source._schema,
            _schemaDelimiter: source._schemaDelimiter
          })
        };
      } else {
        newAttribute.references = { model: source.tableName };
      }

      newAttribute.references.key = key || primaryKeys[0];
      newAttribute.onDelete = options.onDelete;
      newAttribute.onUpdate = options.onUpdate;
    }
  }
}
exports.addForeignKeyConstraints = addForeignKeyConstraints;

/**
 * Mixin (inject) association methods to model prototype
 *
 * @private
 * @param {Object} Association instance
 * @param {Object} Model prototype
 * @param {Array} Method names to inject
 * @param {Object} Mapping between model and association method names
 */
function mixinMethods(association, obj, methods, aliases) {
  aliases = aliases || {};

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = methods[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var method = _step.value;

      // don't override custom methods
      if (!obj[association.accessors[method]]) {
        (function () {
          var realMethod = aliases[method] || method;

          obj[association.accessors[method]] = function () {
            var instance = this;
            var args = [instance].concat(Array.from(arguments));

            return association[realMethod].apply(association, args);
          };
        })();
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
exports.mixinMethods = mixinMethods;
//# sourceMappingURL=helpers.js.map