'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('./../utils');
var Helpers = require('./helpers');
var _ = require('lodash');
var Association = require('./base');

/**
 * One-to-many association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.
 * If the association is aliased, use the alias instead, e.g. `User.hasMany(Project, { as: 'jobs' })` will be `user.getJobs()`.
 *
 * @see {@link Model.hasMany}
 */

var HasMany = function (_Association) {
  _inherits(HasMany, _Association);

  function HasMany(source, target, options) {
    _classCallCheck(this, HasMany);

    var _this = _possibleConstructorReturn(this, (HasMany.__proto__ || Object.getPrototypeOf(HasMany)).call(this, source, target, options));

    _this.associationType = 'HasMany';
    _this.targetAssociation = null;
    _this.sequelize = source.sequelize;
    _this.through = options.through;
    _this.isMultiAssociation = true;
    _this.foreignKeyAttribute = {};

    if (_this.options.through) {
      throw new Error('N:M associations are not supported with hasMany. Use belongsToMany instead');
    }

    /*
    * If self association, this is the target association
    */
    if (_this.isSelfAssociation) {
      _this.targetAssociation = _this;
    }

    if (_this.as) {
      _this.isAliased = true;

      if (_.isPlainObject(_this.as)) {
        _this.options.name = _this.as;
        _this.as = _this.as.plural;
      } else {
        _this.options.name = {
          plural: _this.as,
          singular: Utils.singularize(_this.as)
        };
      }
    } else {
      _this.as = _this.target.options.name.plural;
      _this.options.name = _this.target.options.name;
    }

    /*
    * Foreign key setup
    */
    if (_.isObject(_this.options.foreignKey)) {
      _this.foreignKeyAttribute = _this.options.foreignKey;
      _this.foreignKey = _this.foreignKeyAttribute.name || _this.foreignKeyAttribute.fieldName;
    } else if (_this.options.foreignKey) {
      _this.foreignKey = _this.options.foreignKey;
    }

    if (!_this.foreignKey) {
      _this.foreignKey = Utils.camelizeIf([Utils.underscoredIf(_this.source.options.name.singular, _this.source.options.underscored), _this.source.primaryKeyAttribute].join('_'), !_this.source.options.underscored);
    }

    if (_this.target.rawAttributes[_this.foreignKey]) {
      _this.identifierField = _this.target.rawAttributes[_this.foreignKey].field || _this.foreignKey;
      _this.foreignKeyField = _this.target.rawAttributes[_this.foreignKey].field || _this.foreignKey;
    }

    _this.sourceKey = _this.options.sourceKey || _this.source.primaryKeyAttribute;
    if (_this.target.rawAttributes[_this.sourceKey]) {
      _this.sourceKeyField = _this.source.rawAttributes[_this.sourceKey].field || _this.sourceKey;
    } else {
      _this.sourceKeyField = _this.sourceKey;
    }

    if (_this.source.fieldRawAttributesMap[_this.sourceKey]) {
      _this.sourceKeyAttribute = _this.source.fieldRawAttributesMap[_this.sourceKey].fieldName;
    } else {
      _this.sourceKeyAttribute = _this.source.primaryKeyAttribute;
    }
    _this.sourceIdentifier = _this.sourceKey;
    _this.associationAccessor = _this.as;

    // Get singular and plural names, trying to uppercase the first letter, unless the model forbids it
    var plural = Utils.uppercaseFirst(_this.options.name.plural);
    var singular = Utils.uppercaseFirst(_this.options.name.singular);

    _this.accessors = {
      get: 'get' + plural,
      set: 'set' + plural,
      addMultiple: 'add' + plural,
      add: 'add' + singular,
      create: 'create' + singular,
      remove: 'remove' + singular,
      removeMultiple: 'remove' + plural,
      hasSingle: 'has' + singular,
      hasAll: 'has' + plural,
      count: 'count' + plural
    };
    return _this;
  }

  // the id is in the target table
  // or in an extra table which connects two tables


  _createClass(HasMany, [{
    key: 'injectAttributes',
    value: function injectAttributes() {
      var newAttributes = {};
      var constraintOptions = _.clone(this.options); // Create a new options object for use with addForeignKeyConstraints, to avoid polluting this.options in case it is later used for a n:m
      newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
        type: this.options.keyType || this.source.rawAttributes[this.sourceKeyAttribute].type,
        allowNull: true
      });

      if (this.options.constraints !== false) {
        var target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
        constraintOptions.onDelete = constraintOptions.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
        constraintOptions.onUpdate = constraintOptions.onUpdate || 'CASCADE';
      }
      Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.source, this.target, constraintOptions, this.sourceKeyField);
      Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

      this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;
      this.foreignKeyField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

      this.target.refreshAttributes();
      this.source.refreshAttributes();

      Helpers.checkNamingCollision(this);

      return this;
    }
  }, {
    key: 'mixin',
    value: function mixin(obj) {
      var methods = ['get', 'count', 'hasSingle', 'hasAll', 'set', 'add', 'addMultiple', 'remove', 'removeMultiple', 'create'];
      var aliases = {
        hasSingle: 'has',
        hasAll: 'has',
        addMultiple: 'add',
        removeMultiple: 'remove'
      };

      Helpers.mixinMethods(this, obj, methods, aliases);
    }

    /**
     * Get everything currently associated with this, using an optional where clause.
     *
     * @param {Object} [options]
     * @param {Object} [options.where] An optional where clause to limit the associated models
     * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
     * @param {String} [options.schema] Apply a schema on the related model
     * @see {@link Model.findAll}  for a full explanation of options
     * @return {Promise<Array<Model>>}
     */

  }, {
    key: 'get',
    value: function get(instances, options) {
      var association = this;
      var where = {};
      var Model = association.target;
      var instance = void 0;
      var values = void 0;

      if (!Array.isArray(instances)) {
        instance = instances;
        instances = undefined;
      }

      options = Utils.cloneDeep(options) || {};

      if (association.scope) {
        _.assign(where, association.scope);
      }

      if (instances) {
        values = instances.map(function (instance) {
          return instance.get(association.sourceKey, { raw: true });
        });

        if (options.limit && instances.length > 1) {
          options.groupedLimit = {
            limit: options.limit,
            on: association,
            values: values
          };

          delete options.limit;
        } else {
          where[association.foreignKey] = {
            $in: values
          };
          delete options.groupedLimit;
        }
      } else {
        where[association.foreignKey] = instance.get(association.sourceKey, { raw: true });
      }

      options.where = options.where ? { $and: [where, options.where] } : where;

      if (options.hasOwnProperty('scope')) {
        if (!options.scope) {
          Model = Model.unscoped();
        } else {
          Model = Model.scope(options.scope);
        }
      }

      if (options.hasOwnProperty('schema')) {
        Model = Model.schema(options.schema, options.schemaDelimiter);
      }

      return Model.findAll(options).then(function (results) {
        if (instance) return results;

        var result = {};
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = instances[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _instance = _step.value;

            result[_instance.get(association.sourceKey, { raw: true })] = [];
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

        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = results[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _instance2 = _step2.value;

            result[_instance2.get(association.foreignKey, { raw: true })].push(_instance2);
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
      });
    }

    /**
     * Count everything currently associated with this, using an optional where clause.
     *
     * @param {Object} [options]
     * @param {Object} [options.where] An optional where clause to limit the associated models
     * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
     * @return {Promise<Integer>}
     */

  }, {
    key: 'count',
    value: function count(instance, options) {
      var association = this;
      var model = association.target;
      var sequelize = model.sequelize;

      options = Utils.cloneDeep(options);
      options.attributes = [[sequelize.fn('COUNT', sequelize.col(model.primaryKeyField)), 'count']];
      options.raw = true;
      options.plain = true;

      return association.get(instance, options).then(function (result) {
        return parseInt(result.count, 10);
      });
    }

    /**
     * Check if one or more rows are associated with `this`.
     *
     * @param {Model[]|Model|string[]|String|number[]|Number} [instance(s)]
     * @param {Object} [options] Options passed to getAssociations
     * @return {Promise}
     */

  }, {
    key: 'has',
    value: function has(sourceInstance, targetInstances, options) {
      var association = this;
      var where = {};

      if (!Array.isArray(targetInstances)) {
        targetInstances = [targetInstances];
      }

      options = _.assign({}, options, {
        scope: false,
        raw: true
      });

      where.$or = targetInstances.map(function (instance) {
        if (instance instanceof association.target) {
          return instance.where();
        } else {
          var _where = {};
          _where[association.target.primaryKeyAttribute] = instance;
          return _where;
        }
      });

      options.where = {
        $and: [where, options.where]
      };

      return association.get(sourceInstance, options).then(function (associatedObjects) {
        return associatedObjects.length === targetInstances.length;
      });
    }

    /**
     * Set the associated models by passing an array of persisted instances or their primary keys. Everything that is not in the passed array will be un-associated
     *
     * @param {Array<Model|String|Number>} [newAssociations] An array of persisted instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations.
     * @param {Object} [options] Options passed to `target.findAll` and `update`.
     * @param {Object} [options.validate] Run validation for the join model
     * @return {Promise}
     */

  }, {
    key: 'set',
    value: function set(sourceInstance, targetInstances, options) {
      var association = this;

      if (targetInstances === null) {
        targetInstances = [];
      } else {
        targetInstances = association.toInstanceArray(targetInstances);
      }

      return association.get(sourceInstance, _.defaults({ scope: false, raw: true }, options)).then(function (oldAssociations) {
        var promises = [];
        var obsoleteAssociations = oldAssociations.filter(function (old) {
          return !_.find(targetInstances, function (obj) {
            return obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute];
          });
        });
        var unassociatedObjects = targetInstances.filter(function (obj) {
          return !_.find(oldAssociations, function (old) {
            return obj[association.target.primaryKeyAttribute] === old[association.target.primaryKeyAttribute];
          });
        });
        var updateWhere = void 0;
        var update = void 0;

        if (obsoleteAssociations.length > 0) {
          update = {};
          update[association.foreignKey] = null;

          updateWhere = {};

          updateWhere[association.target.primaryKeyAttribute] = obsoleteAssociations.map(function (associatedObject) {
            return associatedObject[association.target.primaryKeyAttribute];
          });

          promises.push(association.target.unscoped().update(update, _.defaults({
            where: updateWhere
          }, options)));
        }

        if (unassociatedObjects.length > 0) {
          updateWhere = {};

          update = {};
          update[association.foreignKey] = sourceInstance.get(association.sourceKey);

          _.assign(update, association.scope);
          updateWhere[association.target.primaryKeyAttribute] = unassociatedObjects.map(function (unassociatedObject) {
            return unassociatedObject[association.target.primaryKeyAttribute];
          });

          promises.push(association.target.unscoped().update(update, _.defaults({
            where: updateWhere
          }, options)));
        }

        return Utils.Promise.all(promises).return(sourceInstance);
      });
    }

    /**
     * Associate one or more target rows with `this`. This method accepts a Model / string / number to associate a single row,
     * or a mixed array of Model / string / numbers to associate multiple rows.
     *
     * @param {Model[]|Model|string[]|string|number[]|number} [newAssociation(s)]
     * @param {Object} [options] Options passed to `target.update`.
     * @return {Promise}
     */

  }, {
    key: 'add',
    value: function add(sourceInstance, targetInstances, options) {
      if (!targetInstances) return Utils.Promise.resolve();

      var association = this;
      var update = {};
      var where = {};

      options = options || {};

      targetInstances = association.toInstanceArray(targetInstances);

      update[association.foreignKey] = sourceInstance.get(association.sourceKey);
      _.assign(update, association.scope);

      where[association.target.primaryKeyAttribute] = targetInstances.map(function (unassociatedObject) {
        return unassociatedObject.get(association.target.primaryKeyAttribute);
      });

      return association.target.unscoped().update(update, _.defaults({ where: where }, options)).return(sourceInstance);
    }

    /**
     * Un-associate one or several target rows.
     *
     * @param {Model[]|Model|String[]|string|Number[]|number} [oldAssociatedInstance(s)]
     * @param {Object} [options] Options passed to `target.update`
     * @return {Promise}
     */

  }, {
    key: 'remove',
    value: function remove(sourceInstance, targetInstances, options) {
      var association = this;
      var update = {};
      var where = {};

      options = options || {};
      targetInstances = association.toInstanceArray(targetInstances);

      update[association.foreignKey] = null;

      where[association.foreignKey] = sourceInstance.get(association.sourceKey);
      where[association.target.primaryKeyAttribute] = targetInstances.map(function (targetInstance) {
        return targetInstance.get(association.target.primaryKeyAttribute);
      });

      return association.target.unscoped().update(update, _.defaults({ where: where }, options)).return(this);
    }

    /**
     * Create a new instance of the associated model and associate it with this.
     *
     * @param {Object} [values]
     * @param {Object} [options] Options passed to `target.create`.
     * @return {Promise}
     */

  }, {
    key: 'create',
    value: function create(sourceInstance, values, options) {
      var association = this;

      options = options || {};

      if (Array.isArray(options)) {
        options = {
          fields: options
        };
      }

      if (values === undefined) {
        values = {};
      }

      if (association.scope) {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = Object.keys(association.scope)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var attribute = _step3.value;

            values[attribute] = association.scope[attribute];
            if (options.fields) options.fields.push(attribute);
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

      values[association.foreignKey] = sourceInstance.get(association.sourceKey);
      if (options.fields) options.fields.push(association.foreignKey);
      return association.target.create(values, options);
    }
  }]);

  return HasMany;
}(Association);

module.exports = HasMany;
module.exports.HasMany = HasMany;
module.exports.default = HasMany;