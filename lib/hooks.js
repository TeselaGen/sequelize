'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Utils = require('./utils');
var Promise = require('./promise');
var debug = Utils.getLogger().debugContext('hooks');

var hookTypes = {
  beforeValidate: { params: 2 },
  afterValidate: { params: 2 },
  validationFailed: { params: 3 },
  beforeCreate: { params: 2 },
  afterCreate: { params: 2 },
  beforeDestroy: { params: 2 },
  afterDestroy: { params: 2 },
  beforeRestore: { params: 2 },
  afterRestore: { params: 2 },
  beforeUpdate: { params: 2 },
  afterUpdate: { params: 2 },
  beforeSave: { params: 2, proxies: ['beforeUpdate', 'beforeCreate'] },
  afterSave: { params: 2, proxies: ['afterUpdate', 'afterCreate'] },
  beforeUpsert: { params: 2 },
  afterUpsert: { params: 2 },
  beforeBulkCreate: { params: 2 },
  afterBulkCreate: { params: 2 },
  beforeBulkDestroy: { params: 1 },
  afterBulkDestroy: { params: 1 },
  beforeBulkRestore: { params: 1 },
  afterBulkRestore: { params: 1 },
  beforeBulkUpdate: { params: 1 },
  afterBulkUpdate: { params: 1 },
  beforeFind: { params: 1 },
  beforeFindAfterExpandIncludeAll: { params: 1 },
  beforeFindAfterOptions: { params: 1 },
  afterFind: { params: 2 },
  beforeCount: { params: 1 },
  beforeDefine: { params: 2, sync: true },
  afterDefine: { params: 1, sync: true },
  beforeInit: { params: 2, sync: true },
  afterInit: { params: 1, sync: true },
  beforeConnect: { params: 1 },
  afterConnect: { params: 2 },
  beforeSync: { params: 1 },
  afterSync: { params: 1 },
  beforeBulkSync: { params: 1 },
  afterBulkSync: { params: 1 }
};
exports.hooks = hookTypes;

var hookAliases = {
  beforeDelete: 'beforeDestroy',
  afterDelete: 'afterDestroy',
  beforeBulkDelete: 'beforeBulkDestroy',
  afterBulkDelete: 'afterBulkDestroy',
  beforeConnection: 'beforeConnect'
};
exports.hookAliases = hookAliases;

/**
 * get array of current hook and its proxied hooks combined
 * @private
 */
var getProxiedHooks = function getProxiedHooks(hookType) {
  return hookTypes[hookType].proxies ? hookTypes[hookType].proxies.concat(hookType) : [hookType];
};

var Hooks = {
  replaceHookAliases: function replaceHookAliases(hooks) {
    Utils._.each(hooks, function (hooksArray, name) {
      // Does an alias for this hook name exist?
      var realHookName = hookAliases[name];
      if (realHookName) {
        // Add the hooks to the actual hook
        hooks[realHookName] = (hooks[realHookName] || []).concat(hooksArray);

        // Delete the alias
        delete hooks[name];
      }
    });

    return hooks;
  },
  runHooks: function runHooks(hooks) {
    var _this = this;

    if (!hooks) throw new Error('runHooks requires atleast 1 argument');

    var hookArgs = Utils.sliceArgs(arguments, 1);
    var hookType = void 0;

    if (typeof hooks === 'string') {
      hookType = hooks;
      hooks = this.options.hooks[hookType] || [];
      if (this.sequelize) hooks = hooks.concat(this.sequelize.options.hooks[hookType] || []);
    }

    if (!Array.isArray(hooks)) {
      hooks = [hooks];
    }

    // synchronous hooks
    if (hookTypes[hookType] && hookTypes[hookType].sync) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = hooks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var hook = _step.value;

          if ((typeof hook === 'undefined' ? 'undefined' : _typeof(hook)) === 'object') {
            hook = hook.fn;
          }

          debug('running hook(sync) ' + hookType);
          hook.apply(this, hookArgs);
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

      return;
    }

    // asynchronous hooks (default)
    return Promise.each(hooks, function (hook) {
      if ((typeof hook === 'undefined' ? 'undefined' : _typeof(hook)) === 'object') {
        hook = hook.fn;
      }

      debug('running hook ' + hookType);
      return Promise.resolve(hook.apply(_this, hookArgs));
    }).return();
  },
  hook: function hook() {
    return Hooks.addHook.apply(this, arguments);
  },


  /**
   * Add a hook to the model
   *
   * @param {String}    hookType
   * @param {String}    [name]    Provide a name for the hook function. It can be used to remove the hook later or to order hooks based on some sort of priority system in the future.
   * @param {Function}  fn        The hook function
   *
   * @memberOf Sequelize
   * @memberOf Sequelize.Model
   */
  addHook: function addHook(hookType, name, fn) {
    var _this2 = this;

    if (typeof name === 'function') {
      fn = name;
      name = null;
    }

    debug('adding hook ' + hookType);
    hookType = hookAliases[hookType] || hookType;

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    Utils._.each(hookType, function (type) {
      _this2.options.hooks[type] = _this2.options.hooks[type] || [];
      _this2.options.hooks[type].push(name ? { name: name, fn: fn } : fn);
    });

    return this;
  },


  /**
   * Remove hook from the model
   *
   * @param {String} hookType
   * @param {String|Function} name
   *
   * @memberOf Sequelize
   * @memberOf Sequelize.Model
   */
  removeHook: function removeHook(hookType, name) {
    hookType = hookAliases[hookType] || hookType;
    var isReference = typeof name === 'function' ? true : false;

    if (!this.hasHook(hookType)) {
      return this;
    }

    Utils.debug('removing hook ' + hookType);

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = hookType[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var type = _step2.value;

        this.options.hooks[type] = this.options.hooks[type].filter(function (hook) {
          if (isReference && typeof hook === 'function') {
            return hook !== name; // check if same method
          } else {
            return (typeof hook === 'undefined' ? 'undefined' : _typeof(hook)) === 'object' && hook.name !== name;
          }
        });
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

    return this;
  },


  /**
   * Check whether the mode has any hooks of this type
   *
   * @param {String}  hookType
   *
   * @alias hasHooks
   * @memberOf Sequelize
   * @memberOf Sequelize.Model
   */
  hasHook: function hasHook(hookType) {
    return this.options.hooks[hookType] && !!this.options.hooks[hookType].length;
  }
};
Hooks.hasHooks = Hooks.hasHook;

function applyTo(target) {
  Utils._.mixin(target, Hooks);

  var allHooks = Object.keys(hookTypes).concat(Object.keys(hookAliases));
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    var _loop = function _loop() {
      var hook = _step3.value;

      target[hook] = function (name, callback) {
        return this.addHook(hook, name, callback);
      };
    };

    for (var _iterator3 = allHooks[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      _loop();
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
exports.applyTo = applyTo;

/**
 * A hook that is run before validation
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name beforeValidate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after validation
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name afterValidate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run when validation fails
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, error. Error is the
 * SequelizeValidationError. If the callback throws an error, it will replace the original validation error.
 * @name validationFailed
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before creating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeCreate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after creating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name afterCreate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before creating or updating a single instance, It proxies `beforeCreate` and `beforeUpdate`
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeSave
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before upserting
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeUpsert
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after upserting
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name afterUpsert
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after creating or updating a single instance, It proxies `afterCreate` and `afterUpdate`
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name afterSave
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before destroying a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name beforeDestroy
 * @alias beforeDelete
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after destroying a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name afterDestroy
 * @alias afterDelete
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before restoring a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name beforeRestore
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after restoring a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name afterRestore
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before updating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name beforeUpdate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after updating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name afterUpdate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before creating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instances, options
 * @name beforeBulkCreate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after creating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instances, options
 * @name afterBulkCreate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before destroying instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name beforeBulkDestroy
 * @alias beforeBulkDelete
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after destroying instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name afterBulkDestroy
 * @alias afterBulkDelete
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before restoring instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name beforeBulkRestore
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after restoring instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name afterBulkRestore
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before updating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeBulkUpdate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after updating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name afterBulkUpdate
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before a find (select) query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFind
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFindAfterExpandIncludeAll
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before a find (select) query, after all option parsing is complete
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFindAfterOptions
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run after a find (select) query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance(s), options
 * @name afterFind
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before a count query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeCount
 * @memberOf Sequelize.Model
 */

/**
 * A hook that is run before a define call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeDefine
 * @memberOf Sequelize
 */

/**
 * A hook that is run after a define call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with factory
 * @name afterDefine
 * @memberOf Sequelize
 */

/**
 * A hook that is run before Sequelize() call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with config, options
 * @name beforeInit
 * @memberOf Sequelize
 */

/**
 * A hook that is run after Sequelize() call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with sequelize
 * @name afterInit
 * @memberOf Sequelize
 */

/**
 * A hook that is run before a connection is created
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with config passed to connection
 * @name beforeConnect
 * @memberOf Sequelize
 */

/**
 * A hook that is run after a connection is created
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with the connection object and thye config passed to connection
 * @name afterConnect
 * @memberOf Sequelize
 */

/**
 * A hook that is run before Model.sync call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options passed to Model.sync
 * @name beforeSync
 * @memberOf Sequelize
 */

/**
 * A hook that is run after Model.sync call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options passed to Model.sync
 * @name afterSync
 * @memberOf Sequelize
 */

/**
 * A hook that is run before sequelize.sync call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options passed to sequelize.sync
 * @name beforeBulkSync
 * @memberOf Sequelize
 */

/**
 * A hook that is run after sequelize.sync call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options passed to sequelize.sync
 * @name afterBulkSync
 * @memberOf Sequelize
 */
//# sourceMappingURL=hooks.js.map