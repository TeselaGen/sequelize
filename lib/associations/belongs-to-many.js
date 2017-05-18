'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('./../utils');
var Helpers = require('./helpers');
var _ = require('lodash');
var Association = require('./base');
var BelongsTo = require('./belongs-to');
var HasMany = require('./has-many');
var HasOne = require('./has-one');
var AssociationError = require('../errors').AssociationError;

/**
 * Many-to-many association with a join table.
 *
 * When the join table has additional attributes, these can be passed in the options object:
 *
 * ```js
 * UserProject = sequelize.define('user_project', {
 *   role: Sequelize.STRING
 * });
 * User.belongsToMany(Project, { through: UserProject });
 * Project.belongsToMany(User, { through: UserProject });
 * // through is required!
 *
 * user.addProject(project, { through: { role: 'manager' }});
 * ```
 *
 * All methods allow you to pass either a persisted instance, its primary key, or a mixture:
 *
 * ```js
 * Project.create({ id: 11 }).then(function (project) {
 *   user.addProjects([project, 12]);
 * });
 * ```
 *
 * If you want to set several target instances, but with different attributes you have to set the attributes on the instance, using a property with the name of the through model:
 *
 * ```js
 * p1.UserProjects = {
 *   started: true
 * }
 * user.setProjects([p1, p2], { through: { started: false }}) // The default value is false, but p1 overrides that.
 * ```
 *
 * Similarly, when fetching through a join table with custom attributes, these attributes will be available as an object with the name of the through model.
 * ```js
 * user.getProjects().then(function (projects) {
   *   let p1 = projects[0]
   *   p1.UserProjects.started // Is this project started yet?
   * })
 * ```
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.belongsToMany(Project)` the getter will be `user.getProjects()`.
 *
 * @see {@link Model.belongsToMany}
 */

var BelongsToMany = function (_Association) {
  _inherits(BelongsToMany, _Association);

  function BelongsToMany(source, target, options) {
    _classCallCheck(this, BelongsToMany);

    var _this = _possibleConstructorReturn(this, (BelongsToMany.__proto__ || Object.getPrototypeOf(BelongsToMany)).call(this, source, target, options));

    if (_this.options.through === undefined || _this.options.through === true || _this.options.through === null) {
      throw new AssociationError('belongsToMany must be given a through option, either a string or a model');
    }

    if (!_this.options.through.model) {
      _this.options.through = {
        model: options.through
      };
    }

    _this.associationType = 'BelongsToMany';
    _this.targetAssociation = null;
    _this.sequelize = source.sequelize;
    _this.through = _.assign({}, _this.options.through);
    _this.isMultiAssociation = true;
    _this.doubleLinked = false;

    if (!_this.as && _this.isSelfAssociation) {
      throw new AssociationError('\'as\' must be defined for many-to-many self-associations');
    }

    if (_this.as) {
      _this.isAliased = true;

      if (Utils._.isPlainObject(_this.as)) {
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

    _this.combinedTableName = Utils.combineTableNames(_this.source.tableName, _this.isSelfAssociation ? _this.as || _this.target.tableName : _this.target.tableName);

    /*
    * If self association, this is the target association - Unless we find a pairing association
    */
    if (_this.isSelfAssociation) {
      _this.targetAssociation = _this;
    }

    /*
    * Default/generated foreign/other keys
    */
    if (_.isObject(_this.options.foreignKey)) {
      _this.foreignKeyAttribute = _this.options.foreignKey;
      _this.foreignKey = _this.foreignKeyAttribute.name || _this.foreignKeyAttribute.fieldName;
    } else {
      if (!_this.options.foreignKey) {
        _this.foreignKeyDefault = true;
      }

      _this.foreignKeyAttribute = {};
      _this.foreignKey = _this.options.foreignKey || Utils.camelizeIf([Utils.underscoredIf(_this.source.options.name.singular, _this.source.options.underscored), _this.source.primaryKeyAttribute].join('_'), !_this.source.options.underscored);
    }

    if (_.isObject(_this.options.otherKey)) {
      _this.otherKeyAttribute = _this.options.otherKey;
      _this.otherKey = _this.otherKeyAttribute.name || _this.otherKeyAttribute.fieldName;
    } else {
      if (!_this.options.otherKey) {
        _this.otherKeyDefault = true;
      }

      _this.otherKeyAttribute = {};
      _this.otherKey = _this.options.otherKey || Utils.camelizeIf([Utils.underscoredIf(_this.isSelfAssociation ? Utils.singularize(_this.as) : _this.target.options.name.singular, _this.target.options.underscored), _this.target.primaryKeyAttribute].join('_'), !_this.target.options.underscored);
    }

    /*
    * Find paired association (if exists)
    */
    _.each(_this.target.associations, function (association) {
      if (association.associationType !== 'BelongsToMany') return;
      if (association.target !== _this.source) return;

      if (_this.options.through.model === association.options.through.model) {
        _this.paired = association;
        association.paired = _this;
      }
    });

    if (typeof _this.through.model === 'string') {
      if (!_this.sequelize.isDefined(_this.through.model)) {
        _this.through.model = _this.sequelize.define(_this.through.model, {}, _.extend(_this.options, {
          tableName: _this.through.model,
          indexes: [], //we don't want indexes here (as referenced in #2416)
          paranoid: false, // A paranoid join table does not make sense
          validate: {} // Don't propagate model-level validations
        }));
      } else {
        _this.through.model = _this.sequelize.model(_this.through.model);
      }
    }

    _this.options = Object.assign(_this.options, _.pick(_this.through.model.options, ['timestamps', 'createdAt', 'updatedAt', 'deletedAt', 'paranoid']));

    if (_this.paired) {
      if (_this.otherKeyDefault) {
        _this.otherKey = _this.paired.foreignKey;
      }
      if (_this.paired.otherKeyDefault) {
        // If paired otherKey was inferred we should make sure to clean it up before adding a new one that matches the foreignKey
        if (_this.paired.otherKey !== _this.foreignKey) {
          delete _this.through.model.rawAttributes[_this.paired.otherKey];
        }
        _this.paired.otherKey = _this.foreignKey;
        _this.paired.foreignIdentifier = _this.foreignKey;
        delete _this.paired.foreignIdentifierField;
      }
    }

    if (_this.through) {
      _this.throughModel = _this.through.model;
    }

    _this.options.tableName = _this.combinedName = _this.through.model === Object(_this.through.model) ? _this.through.model.tableName : _this.through.model;

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


  _createClass(BelongsToMany, [{
    key: 'injectAttributes',
    value: function injectAttributes() {
      var _this2 = this;

      this.identifier = this.foreignKey;
      this.foreignIdentifier = this.otherKey;

      // remove any PKs previously defined by sequelize
      // but ignore any keys that are part of this association (#5865)
      _.each(this.through.model.rawAttributes, function (attribute, attributeName) {
        if (attribute.primaryKey === true && attribute._autoGenerated === true) {
          if (attributeName === _this2.foreignKey || attributeName === _this2.otherKey) {
            // this key is still needed as it's part of the association
            // so just set primaryKey to false
            attribute.primaryKey = false;
          } else {
            delete _this2.through.model.rawAttributes[attributeName];
          }
          _this2.primaryKeyDeleted = true;
        }
      });

      var sourceKey = this.source.rawAttributes[this.source.primaryKeyAttribute];
      var sourceKeyType = sourceKey.type;
      var sourceKeyField = sourceKey.field || this.source.primaryKeyAttribute;
      var targetKey = this.target.rawAttributes[this.target.primaryKeyAttribute];
      var targetKeyType = targetKey.type;
      var targetKeyField = targetKey.field || this.target.primaryKeyAttribute;
      var sourceAttribute = _.defaults({}, this.foreignKeyAttribute, { type: sourceKeyType });
      var targetAttribute = _.defaults({}, this.otherKeyAttribute, { type: targetKeyType });

      if (this.primaryKeyDeleted === true) {
        targetAttribute.primaryKey = sourceAttribute.primaryKey = true;
      } else if (this.through.unique !== false) {
        var uniqueKey = [this.through.model.tableName, this.foreignKey, this.otherKey, 'unique'].join('_');
        targetAttribute.unique = sourceAttribute.unique = uniqueKey;
      }

      if (!this.through.model.rawAttributes[this.foreignKey]) {
        this.through.model.rawAttributes[this.foreignKey] = {
          _autoGenerated: true
        };
      }

      if (!this.through.model.rawAttributes[this.otherKey]) {
        this.through.model.rawAttributes[this.otherKey] = {
          _autoGenerated: true
        };
      }

      if (this.options.constraints !== false) {
        sourceAttribute.references = {
          model: this.source.getTableName(),
          key: sourceKeyField
        };
        // For the source attribute the passed option is the priority
        sourceAttribute.onDelete = this.options.onDelete || this.through.model.rawAttributes[this.foreignKey].onDelete;
        sourceAttribute.onUpdate = this.options.onUpdate || this.through.model.rawAttributes[this.foreignKey].onUpdate;

        if (!sourceAttribute.onDelete) sourceAttribute.onDelete = 'CASCADE';
        if (!sourceAttribute.onUpdate) sourceAttribute.onUpdate = 'CASCADE';

        targetAttribute.references = {
          model: this.target.getTableName(),
          key: targetKeyField
        };
        // But the for target attribute the previously defined option is the priority (since it could've been set by another belongsToMany call)
        targetAttribute.onDelete = this.through.model.rawAttributes[this.otherKey].onDelete || this.options.onDelete;
        targetAttribute.onUpdate = this.through.model.rawAttributes[this.otherKey].onUpdate || this.options.onUpdate;

        if (!targetAttribute.onDelete) targetAttribute.onDelete = 'CASCADE';
        if (!targetAttribute.onUpdate) targetAttribute.onUpdate = 'CASCADE';
      }

      this.through.model.rawAttributes[this.foreignKey] = _.extend(this.through.model.rawAttributes[this.foreignKey], sourceAttribute);
      this.through.model.rawAttributes[this.otherKey] = _.extend(this.through.model.rawAttributes[this.otherKey], targetAttribute);

      this.identifierField = this.through.model.rawAttributes[this.foreignKey].field || this.foreignKey;
      this.foreignIdentifierField = this.through.model.rawAttributes[this.otherKey].field || this.otherKey;

      if (this.paired && !this.paired.foreignIdentifierField) {
        this.paired.foreignIdentifierField = this.through.model.rawAttributes[this.paired.otherKey].field || this.paired.otherKey;
      }

      this.through.model.refreshAttributes();

      this.toSource = new BelongsTo(this.through.model, this.source, {
        foreignKey: this.foreignKey
      });
      this.manyFromSource = new HasMany(this.source, this.through.model, {
        foreignKey: this.foreignKey
      });
      this.oneFromSource = new HasOne(this.source, this.through.model, {
        foreignKey: this.foreignKey,
        as: this.through.model.name
      });

      this.toTarget = new BelongsTo(this.through.model, this.target, {
        foreignKey: this.otherKey
      });
      this.manyFromTarget = new HasMany(this.target, this.through.model, {
        foreignKey: this.otherKey
      });
      this.oneFromTarget = new HasOne(this.target, this.through.model, {
        foreignKey: this.otherKey,
        as: this.through.model.name
      });

      if (this.paired && this.paired.otherKeyDefault) {
        this.paired.toTarget = new BelongsTo(this.paired.through.model, this.paired.target, {
          foreignKey: this.paired.otherKey
        });

        this.paired.oneFromTarget = new HasOne(this.paired.target, this.paired.through.model, {
          foreignKey: this.paired.otherKey,
          as: this.paired.through.model.name
        });
      }

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
    value: function get(instance, options) {
      options = Utils.cloneDeep(options) || {};

      var association = this;
      var through = association.through;
      var scopeWhere = void 0;
      var throughWhere = void 0;

      if (association.scope) {
        scopeWhere = _.clone(association.scope);
      }

      options.where = {
        $and: [scopeWhere, options.where]
      };

      if (Object(through.model) === through.model) {
        throughWhere = {};
        throughWhere[association.foreignKey] = instance.get(association.source.primaryKeyAttribute);

        if (through.scope) {
          _.assign(throughWhere, through.scope);
        }

        //If a user pass a where on the options through options, make an "and" with the current throughWhere
        if (options.through && options.through.where) {
          throughWhere = {
            $and: [throughWhere, options.through.where]
          };
        }

        options.include = options.include || [];
        options.include.push({
          association: association.oneFromTarget,
          attributes: options.joinTableAttributes,
          required: true,
          where: throughWhere
        });
      }

      var model = association.target;
      if (options.hasOwnProperty('scope')) {
        if (!options.scope) {
          model = model.unscoped();
        } else {
          model = model.scope(options.scope);
        }
      }

      if (options.hasOwnProperty('schema')) {
        model = model.schema(options.schema, options.schemaDelimiter);
      }

      return model.findAll(options);
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
      options.attributes = [[sequelize.fn('COUNT', sequelize.col([association.target.name, model.primaryKeyAttribute].join('.'))), 'count']];
      options.joinTableAttributes = [];
      options.raw = true;
      options.plain = true;

      return association.get(instance, options).then(function (result) {
        return parseInt(result.count, 10);
      });
    }

    /**
     * Check if one or more instance(s) are associated with this. If a list of instances is passed, the function returns true if _all_ instances are associated
     *
     * @param {Model[]|Model|string[]|String|number[]|Number} [instance(s)] Can be an array of instances or their primary keys
     * @param {Object} [options] Options passed to getAssociations
     * @return {Promise<boolean>}
     */

  }, {
    key: 'has',
    value: function has(sourceInstance, instances, options) {
      var association = this;
      var where = {};

      if (!Array.isArray(instances)) {
        instances = [instances];
      }

      options = _.assign({
        raw: true
      }, options, {
        scope: false
      });

      where.$or = instances.map(function (instance) {
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
        return associatedObjects.length === instances.length;
      });
    }

    /**
     * Set the associated models by passing an array of instances or their primary keys. Everything that it not in the passed array will be un-associated.
     *
     * @param {Array<Model|String|Number>} [newAssociations] An array of persisted instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations.
     * @param {Object} [options] Options passed to `through.findAll`, `bulkCreate`, `update` and `destroy`
     * @param {Object} [options.validate] Run validation for the join model
     * @param {Object} [options.through] Additional attributes for the join table.
     * @return {Promise}
     */

  }, {
    key: 'set',
    value: function set(sourceInstance, newAssociatedObjects, options) {
      options = options || {};

      var association = this;
      var sourceKey = association.source.primaryKeyAttribute;
      var targetKey = association.target.primaryKeyAttribute;
      var identifier = association.identifier;
      var foreignIdentifier = association.foreignIdentifier;
      var where = {};

      if (newAssociatedObjects === null) {
        newAssociatedObjects = [];
      } else {
        newAssociatedObjects = association.toInstanceArray(newAssociatedObjects);
      }

      where[identifier] = sourceInstance.get(sourceKey);
      _.assign(where, association.through.scope);

      return association.through.model.findAll(_.defaults({ where: where, raw: true }, options)).then(function (currentRows) {
        var obsoleteAssociations = [];
        var promises = [];
        var defaultAttributes = options.through || {};

        // Don't try to insert the transaction as an attribute in the through table
        defaultAttributes = _.omit(defaultAttributes, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields', 'logging']);

        var unassociatedObjects = newAssociatedObjects.filter(function (obj) {
          return !_.find(currentRows, function (currentRow) {
            return currentRow[foreignIdentifier] === obj.get(targetKey);
          });
        });

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          var _loop = function _loop() {
            var currentRow = _step.value;

            var newObj = _.find(newAssociatedObjects, function (obj) {
              return currentRow[foreignIdentifier] === obj.get(targetKey);
            });

            if (!newObj) {
              obsoleteAssociations.push(currentRow);
            } else {
              var throughAttributes = newObj[association.through.model.name];
              // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
              if (throughAttributes instanceof association.through.model) {
                throughAttributes = {};
              }

              var _where3 = {};
              var attributes = _.defaults({}, throughAttributes, defaultAttributes);

              _where3[identifier] = sourceInstance.get(sourceKey);
              _where3[foreignIdentifier] = newObj.get(targetKey);

              if (Object.keys(attributes).length) {
                promises.push(association.through.model.update(attributes, _.extend(options, { where: _where3 })));
              }
            }
          };

          for (var _iterator = currentRows[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            _loop();
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

        if (obsoleteAssociations.length > 0) {
          var _where2 = {};
          _where2[identifier] = sourceInstance.get(sourceKey);
          _where2[foreignIdentifier] = obsoleteAssociations.map(function (obsoleteAssociation) {
            return obsoleteAssociation[foreignIdentifier];
          });

          promises.push(association.through.model.destroy(_.defaults({ where: _where2 }, options)));
        }

        if (unassociatedObjects.length > 0) {
          var bulk = unassociatedObjects.map(function (unassociatedObject) {
            var attributes = {};

            attributes[identifier] = sourceInstance.get(sourceKey);
            attributes[foreignIdentifier] = unassociatedObject.get(targetKey);

            attributes = _.defaults(attributes, unassociatedObject[association.through.model.name], defaultAttributes);

            _.assign(attributes, association.through.scope);

            return attributes;
          });

          promises.push(association.through.model.bulkCreate(bulk, _.assign({ validate: true }, options)));
        }

        return Utils.Promise.all(promises);
      });
    }

    /**
     * Associate one ore several rows with `this`.
     *
     * @param {Model[]|Model|string[]|string|number[]|Number} [newAssociation(s)] A single instance or primary key, or a mixed array of persisted instances or primary keys
     * @param {Object} [options] Options passed to `through.findAll`, `bulkCreate` and `update`
     * @param {Object} [options.validate] Run validation for the join model.
     * @param {Object} [options.through] Additional attributes for the join table.
     * @return {Promise}
     */

  }, {
    key: 'add',
    value: function add(sourceInstance, newInstances, options) {
      // If newInstances is null or undefined, no-op
      if (!newInstances) return Utils.Promise.resolve();

      options = _.clone(options) || {};

      var association = this;
      var sourceKey = association.source.primaryKeyAttribute;
      var targetKey = association.target.primaryKeyAttribute;
      var identifier = association.identifier;
      var foreignIdentifier = association.foreignIdentifier;
      var defaultAttributes = _.omit(options.through || {}, ['transaction', 'hooks', 'individualHooks', 'ignoreDuplicates', 'validate', 'fields', 'logging']);

      newInstances = association.toInstanceArray(newInstances);

      var where = {};
      where[identifier] = sourceInstance.get(sourceKey);
      where[foreignIdentifier] = newInstances.map(function (newInstance) {
        return newInstance.get(targetKey);
      });

      _.assign(where, association.through.scope);

      return association.through.model.findAll(_.defaults({ where: where, raw: true }, options)).then(function (currentRows) {
        var promises = [];
        var unassociatedObjects = [];
        var changedAssociations = [];
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          var _loop2 = function _loop2() {
            var obj = _step2.value;

            var existingAssociation = _.find(currentRows, function (current) {
              return current[foreignIdentifier] === obj.get(targetKey);
            });

            if (!existingAssociation) {
              unassociatedObjects.push(obj);
            } else {
              var throughAttributes = obj[association.through.model.name];
              var attributes = _.defaults({}, throughAttributes, defaultAttributes);

              if (_.some(Object.keys(attributes), function (attribute) {
                return attributes[attribute] !== existingAssociation[attribute];
              })) {
                changedAssociations.push(obj);
              }
            }
          };

          for (var _iterator2 = newInstances[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            _loop2();
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

        if (unassociatedObjects.length > 0) {
          var bulk = unassociatedObjects.map(function (unassociatedObject) {
            var throughAttributes = unassociatedObject[association.through.model.name];
            var attributes = _.defaults({}, throughAttributes, defaultAttributes);

            attributes[identifier] = sourceInstance.get(sourceKey);
            attributes[foreignIdentifier] = unassociatedObject.get(targetKey);

            _.assign(attributes, association.through.scope);

            return attributes;
          });

          promises.push(association.through.model.bulkCreate(bulk, _.assign({ validate: true }, options)));
        }

        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = changedAssociations[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var assoc = _step3.value;

            var throughAttributes = assoc[association.through.model.name];
            var attributes = _.defaults({}, throughAttributes, defaultAttributes);
            var _where4 = {};
            // Quick-fix for subtle bug when using existing objects that might have the through model attached (not as an attribute object)
            if (throughAttributes instanceof association.through.model) {
              throughAttributes = {};
            }

            _where4[identifier] = sourceInstance.get(sourceKey);
            _where4[foreignIdentifier] = assoc.get(targetKey);

            promises.push(association.through.model.update(attributes, _.extend(options, { where: _where4 })));
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

        return Utils.Promise.all(promises);
      });
    }

    /**
     * Un-associate one or more instance(s).
     *
     * @param {Model|String|Number} [oldAssociated] Can be an Instance or its primary key, or a mixed array of instances and primary keys
     * @param {Object} [options] Options passed to `through.destroy`
     * @return {Promise}
     */

  }, {
    key: 'remove',
    value: function remove(sourceInstance, oldAssociatedObjects, options) {
      var association = this;

      options = options || {};

      oldAssociatedObjects = association.toInstanceArray(oldAssociatedObjects);

      var where = {};
      where[association.identifier] = sourceInstance.get(association.source.primaryKeyAttribute);
      where[association.foreignIdentifier] = oldAssociatedObjects.map(function (newInstance) {
        return newInstance.get(association.target.primaryKeyAttribute);
      });

      return association.through.model.destroy(_.defaults({ where: where }, options));
    }

    /**
     * Create a new instance of the associated model and associate it with this.
     *
     * @param {Object} [values]
     * @param {Object} [options] Options passed to create and add
     * @param {Object} [options.through] Additional attributes for the join table
     * @return {Promise}
     */

  }, {
    key: 'create',
    value: function create(sourceInstance, values, options) {
      var association = this;

      options = options || {};
      values = values || {};

      if (Array.isArray(options)) {
        options = {
          fields: options
        };
      }

      if (association.scope) {
        _.assign(values, association.scope);
        if (options.fields) {
          options.fields = options.fields.concat(Object.keys(association.scope));
        }
      }

      // Create the related model instance
      return association.target.create(values, options).then(function (newAssociatedObject) {
        return sourceInstance[association.accessors.add](newAssociatedObject, _.omit(options, ['fields'])).return(newAssociatedObject);
      });
    }
  }]);

  return BelongsToMany;
}(Association);

module.exports = BelongsToMany;
module.exports.BelongsToMany = BelongsToMany;
module.exports.default = BelongsToMany;
//# sourceMappingURL=belongs-to-many.js.map