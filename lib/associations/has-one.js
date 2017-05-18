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
 * One-to-one association
 *
 * In the API reference below, add the name of the association to the method, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
 * This is almost the same as `belongsTo` with one exception - The foreign key will be defined on the target model.
 *
 * @see {@link Model.hasOne}
 */

var HasOne = function (_Association) {
  _inherits(HasOne, _Association);

  function HasOne(source, target, options) {
    _classCallCheck(this, HasOne);

    var _this = _possibleConstructorReturn(this, (HasOne.__proto__ || Object.getPrototypeOf(HasOne)).call(this, source, target, options));

    _this.associationType = 'HasOne';
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
      _this.foreignKey = Utils.camelizeIf([Utils.underscoredIf(Utils.singularize(_this.options.as || _this.source.name), _this.target.options.underscored), _this.source.primaryKeyAttribute].join('_'), !_this.source.options.underscored);
    }

    _this.sourceIdentifier = _this.source.primaryKeyAttribute;
    _this.sourceKey = _this.source.primaryKeyAttribute;
    _this.sourceKeyIsPrimary = _this.sourceKey === _this.source.primaryKeyAttribute;

    _this.associationAccessor = _this.as;
    _this.options.useHooks = options.useHooks;

    if (_this.target.rawAttributes[_this.foreignKey]) {
      _this.identifierField = _this.target.rawAttributes[_this.foreignKey].field || _this.foreignKey;
    }

    // Get singular name, trying to uppercase the first letter, unless the model forbids it
    var singular = Utils.uppercaseFirst(_this.options.name.singular);

    _this.accessors = {
      get: 'get' + singular,
      set: 'set' + singular,
      create: 'create' + singular
    };
    return _this;
  }

  // the id is in the target table


  _createClass(HasOne, [{
    key: 'injectAttributes',
    value: function injectAttributes() {
      var newAttributes = {};
      var keyType = this.source.rawAttributes[this.source.primaryKeyAttribute].type;

      newAttributes[this.foreignKey] = _.defaults({}, this.foreignKeyAttribute, {
        type: this.options.keyType || keyType,
        allowNull: true
      });
      Utils.mergeDefaults(this.target.rawAttributes, newAttributes);

      this.identifierField = this.target.rawAttributes[this.foreignKey].field || this.foreignKey;

      if (this.options.constraints !== false) {
        var target = this.target.rawAttributes[this.foreignKey] || newAttributes[this.foreignKey];
        this.options.onDelete = this.options.onDelete || (target.allowNull ? 'SET NULL' : 'CASCADE');
        this.options.onUpdate = this.options.onUpdate || 'CASCADE';
      }

      Helpers.addForeignKeyConstraints(this.target.rawAttributes[this.foreignKey], this.source, this.target, this.options);

      // Sync attributes and setters/getters to Model prototype
      this.target.refreshAttributes();

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
     * @param {String|Boolean} [options.scope] Apply a scope on the related model, or remove its default scope by passing false
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
        where[association.foreignKey] = {
          $in: instances.map(function (instance) {
            return instance.get(association.sourceKey);
          })
        };
      } else {
        where[association.foreignKey] = instance.get(association.sourceKey);
      }

      if (association.scope) {
        _.assign(where, association.scope);
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

              result[_instance.get(association.sourceKey, { raw: true })] = null;
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

              result[_instance2.get(association.foreignKey, { raw: true })] = _instance2;
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
     * @param {Model|String|Number} [newAssociation] An persisted instance or the primary key of a persisted instance to associate with this. Pass `null` or `undefined` to remove the association.
     * @param {Object} [options] Options passed to getAssociation and `target.save`
     * @return {Promise}
     */

  }, {
    key: 'set',
    value: function set(sourceInstance, associatedInstance, options) {
      var association = this;

      var alreadyAssociated = void 0;

      options = _.assign({}, options, {
        scope: false
      });

      return sourceInstance[association.accessors.get](options).then(function (oldInstance) {
        // TODO Use equals method once #5605 is resolved
        alreadyAssociated = oldInstance && associatedInstance && _.every(association.target.primaryKeyAttributes, function (attribute) {
          return oldInstance.get(attribute, { raw: true }) === (associatedInstance.get ? associatedInstance.get(attribute, { raw: true }) : associatedInstance);
        });

        if (oldInstance && !alreadyAssociated) {
          oldInstance[association.foreignKey] = null;
          return oldInstance.save(_.extend({}, options, {
            fields: [association.foreignKey],
            allowNull: [association.foreignKey],
            association: true
          }));
        }
      }).then(function () {
        if (associatedInstance && !alreadyAssociated) {
          if (!(associatedInstance instanceof association.target)) {
            var tmpInstance = {};
            tmpInstance[association.target.primaryKeyAttribute] = associatedInstance;
            associatedInstance = association.target.build(tmpInstance, {
              isNewRecord: false
            });
          }

          _.assign(associatedInstance, association.scope);
          associatedInstance.set(association.foreignKey, sourceInstance.get(association.sourceIdentifier));

          return associatedInstance.save(options);
        }

        return null;
      });
    }

    /**
     * Create a new instance of the associated model and associate it with this.
     *
     * @param {Object} [values]
     * @param {Object} [options] Options passed to `target.create` and setAssociation.
     * @see {@link Model#create} for a full explanation of options
     * @return {Promise}
     */

  }, {
    key: 'create',
    value: function create(sourceInstance, values, options) {
      var association = this;

      values = values || {};
      options = options || {};

      if (association.scope) {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
          for (var _iterator3 = Object.keys(association.scope)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var attribute = _step3.value;

            values[attribute] = association.scope[attribute];
            if (options.fields) {
              options.fields.push(attribute);
            }
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

      values[association.foreignKey] = sourceInstance.get(association.sourceIdentifier);
      if (options.fields) {
        options.fields.push(association.foreignKey);
      }

      return association.target.create(values, options);
    }
  }]);

  return HasOne;
}(Association);

module.exports = HasOne;
//# sourceMappingURL=has-one.js.map