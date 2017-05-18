'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Utils = require('./../utils');
var Helpers = require('./helpers');
var _ = require('lodash');
var Transaction = require('../transaction');
var Association = require('./base');

/**
 * One-to-one association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.belongsTo(Project)` the getter will be `user.getProject()`.
 *
 * @see {@link Model.belongsTo}
 */

var BelongsTo = function (_Association) {
  _inherits(BelongsTo, _Association);

  function BelongsTo(source, target, options) {
    _classCallCheck(this, BelongsTo);

    var _this = _possibleConstructorReturn(this, (BelongsTo.__proto__ || Object.getPrototypeOf(BelongsTo)).call(this, source, target, options));

    _this.associationType = 'BelongsTo';
    _this.isSingleAssociation = true;
    _this.foreignKeyAttribute = {};

    if (_this.as) {
      _this.isAliased = true;
      _this.options.name = {
        singular: _this.as
      };
    } else {
      _this.as = _this.target.options.name.singular;
      _this.options.name = _this.target.options.name;
    }

    if (_.isObject(_this.options.foreignKey)) {
      _this.foreignKeyAttribute = _this.options.foreignKey;
      _this.foreignKey = _this.foreignKeyAttribute.name || _this.foreignKeyAttribute.fieldName;
    } else if (_this.options.foreignKey) {
      _this.foreignKey = _this.options.foreignKey;
    }

    if (!_this.foreignKey) {
      _this.foreignKey = Utils.camelizeIf([Utils.underscoredIf(_this.as, _this.source.options.underscored), _this.target.primaryKeyAttribute].join('_'), !_this.source.options.underscored);
    }

    _this.identifier = _this.foreignKey;

    if (_this.source.rawAttributes[_this.identifier]) {
      _this.identifierField = _this.source.rawAttributes[_this.identifier].field || _this.identifier;
    }

    _this.targetKey = _this.options.targetKey || _this.target.primaryKeyAttribute;
    _this.targetKeyField = _this.target.rawAttributes[_this.targetKey].field || _this.targetKey;
    _this.targetKeyIsPrimary = _this.targetKey === _this.target.primaryKeyAttribute;

    _this.targetIdentifier = _this.targetKey;
    _this.associationAccessor = _this.as;
    _this.options.useHooks = options.useHooks;

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    var singular = Utils.uppercaseFirst(_this.options.name.singular);

    _this.accessors = {
      get: 'get' + singular,
      set: 'set' + singular,
      create: 'create' + singular
    };
    return _this;
  }

  // the id is in the source table


  _createClass(BelongsTo, [{
    key: 'injectAttributes',
    value: function injectAttributes() {
      var newAttributes = {};

      newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
        type: this.options.keyType || this.target.rawAttributes[this.targetKey].type,
        allowNull: true
      });

      if (this.options.constraints !== false) {
        var source = this.source.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
        this.options.onDelete = this.options.onDelete || (source.allowNull ? 'SET NULL' : 'NO ACTION');
        this.options.onUpdate = this.options.onUpdate || 'CASCADE';
      }

      Helpers.addForeignKeyConstraints(newAttributes[this.foreignKey], this.target, this.source, this.options, this.targetKeyField);
      Utils.mergeDefaults(this.source.rawAttributes, newAttributes);

      this.identifierField = this.source.rawAttributes[this.foreignKey].field || this.foreignKey;

      this.source.refreshAttributes();

      Helpers.checkNamingCollision(this);

      return this;
    }
  }, {
    key: 'mixin',
    value: function mixin(obj) {
      var methods = ['get', 'set', 'create'];

      Helpers.mixinMethods(this, obj, methods);
    }

    /**
     * Get the associated instance.
     *
     * @param {Object} [options]
     * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false.
     * @param {String} [options.schema] Apply a schema on the related model
     * @see {@link Model.findOne} for a full explanation of options
     * @return {Promise<Model>}
     */

  }, {
    key: 'get',
    value: function get(instances, options) {
      var association = this;
      var where = {};
      var Target = association.target;
      var instance = void 0;

      options = Utils.cloneDeep(options);

      if (options.hasOwnProperty('scope')) {
        if (!options.scope) {
          Target = Target.unscoped();
        } else {
          Target = Target.scope(options.scope);
        }
      }

      if (options.hasOwnProperty('schema')) {
        Target = Target.schema(options.schema, options.schemaDelimiter);
      }

      if (!Array.isArray(instances)) {
        instance = instances;
        instances = undefined;
      }

      if (instances) {
        where[association.targetKey] = {
          $in: instances.map(function (instance) {
            return instance.get(association.foreignKey);
          })
        };
      } else {
        if (association.targetKeyIsPrimary && !options.where) {
          return Target.findById(instance.get(association.foreignKey), options);
        } else {
          where[association.targetKey] = instance.get(association.foreignKey);
          options.limit = null;
        }
      }

      options.where = options.where ? { $and: [where, options.where] } : where;

      if (instances) {
        return Target.findAll(options).then(function (results) {
          var result = {};
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = instances[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var _instance = _step.value;

              result[_instance.get(association.foreignKey, { raw: true })] = null;
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

              result[_instance2.get(association.targetKey, { raw: true })] = _instance2;
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

      return Target.findOne(options);
    }

    /**
     * Set the associated model.
     *
     * @param {Model|String|Number} [newAssociation] An persisted instance or the primary key of an instance to associate with this. Pass `null` or `undefined` to remove the association.
     * @param {Object} [options] Options passed to `this.save`
     * @param {Boolean} [options.save=true] Skip saving this after setting the foreign key if false.
     * @return {Promise}
     */

  }, {
    key: 'set',
    value: function set(sourceInstance, associatedInstance, options) {
      var association = this;

      options = options || {};

      var value = associatedInstance;
      if (associatedInstance instanceof association.target) {
        value = associatedInstance[association.targetKey];
      }

      sourceInstance.set(association.foreignKey, value);

      if (options.save === false) return;

      options = _.extend({
        fields: [association.foreignKey],
        allowNull: [association.foreignKey],
        association: true
      }, options);

      // passes the changed field to save, so only that field get updated.
      return sourceInstance.save(options);
    }

    /**
     * Create a new instance of the associated model and associate it with this.
     *
     * @param {Object} [values]
     * @param {Object} [options] Options passed to `target.create` and setAssociation.
     * @see {@link Model#create}  for a full explanation of options
     * @return {Promise}
     */

  }, {
    key: 'create',
    value: function create(sourceInstance, values, fieldsOrOptions) {
      var association = this;

      var options = {};

      if ((fieldsOrOptions || {}).transaction instanceof Transaction) {
        options.transaction = fieldsOrOptions.transaction;
      }
      options.logging = (fieldsOrOptions || {}).logging;

      return association.target.create(values, fieldsOrOptions).then(function (newAssociatedObject) {
        return sourceInstance[association.accessors.set](newAssociatedObject, options);
      });
    }
  }]);

  return BelongsTo;
}(Association);

module.exports = BelongsTo;
module.exports.BelongsTo = BelongsTo;
module.exports.default = BelongsTo;