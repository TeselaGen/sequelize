'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Toposort = require('toposort-class');
var _ = require('lodash');

var ModelManager = function () {
  function ModelManager(sequelize) {
    _classCallCheck(this, ModelManager);

    this.models = [];
    this.sequelize = sequelize;
  }

  _createClass(ModelManager, [{
    key: 'addModel',
    value: function addModel(model) {
      this.models.push(model);
      this.sequelize.models[model.name] = model;

      return model;
    }
  }, {
    key: 'removeModel',
    value: function removeModel(modelToRemove) {
      this.models = this.models.filter(function (model) {
        return model.name !== modelToRemove.name;
      });

      delete this.sequelize.models[modelToRemove.name];
    }
  }, {
    key: 'getModel',
    value: function getModel(against, options) {
      options = _.defaults(options || {}, {
        attribute: 'name'
      });

      var model = this.models.filter(function (model) {
        return model[options.attribute] === against;
      });

      return model ? model[0] : null;
    }
  }, {
    key: 'forEachModel',


    /**
     * Iterate over Models in an order suitable for e.g. creating tables. Will
     * take foreign key constraints into account so that dependencies are visited
     * before dependents.
     * @private
     */
    value: function forEachModel(iterator, options) {
      var models = {};
      var sorter = new Toposort();
      var sorted = void 0;
      var dep = void 0;

      options = _.defaults(options || {}, {
        reverse: true
      });

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        var _loop = function _loop() {
          var model = _step.value;

          var deps = [];
          var tableName = model.getTableName();

          if (_.isObject(tableName)) {
            tableName = tableName.schema + '.' + tableName.tableName;
          }

          models[tableName] = model;

          for (var attrName in model.rawAttributes) {
            if (model.rawAttributes.hasOwnProperty(attrName)) {
              var attribute = model.rawAttributes[attrName];

              if (attribute.references) {
                dep = attribute.references.model;

                if (_.isObject(dep)) {
                  dep = dep.schema + '.' + dep.tableName;
                }

                deps.push(dep);
              }
            }
          }

          deps = deps.filter(function (dep) {
            return tableName !== dep;
          });

          sorter.add(tableName, deps);
        };

        for (var _iterator = this.models[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
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

      sorted = sorter.sort();
      if (options.reverse) {
        sorted = sorted.reverse();
      }
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = sorted[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var name = _step2.value;

          iterator(models[name], name);
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
    }
  }, {
    key: 'all',
    get: function get() {
      return this.models;
    }
  }]);

  return ModelManager;
}();

module.exports = ModelManager;
module.exports.ModelManager = ModelManager;
module.exports.default = ModelManager;
//# sourceMappingURL=model-manager.js.map