'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var validator = require('./utils/validator-extras').validator;
var extendModelValidations = require('./utils/validator-extras').extendModelValidations;
var Utils = require('./utils');
var sequelizeError = require('./errors');
var Promise = require('./promise');
var DataTypes = require('./data-types');
var _ = require('lodash');

/**
 * The Main Instance Validator.
 *
 * @param {Instance} modelInstance The model instance.
 * @param {Object} options A dict with options.
 * @constructor
 * @private
 */

var InstanceValidator = function () {
  function InstanceValidator(modelInstance, options) {
    _classCallCheck(this, InstanceValidator);

    options = _.clone(options) || {};

    if (options.fields && !options.skip) {
      options.skip = Utils._.difference(Object.keys(modelInstance.constructor.attributes), options.fields);
    }

    // assign defined and default options
    this.options = Utils._.defaults(options, {
      skip: [],
      hooks: true
    });

    this.modelInstance = modelInstance;

    /**
     * Exposes a reference to validator.js. This allows you to add custom validations using `validator.extend`
     * @name validator
     * @private
     */
    this.validator = validator;

    /**
     *  All errors will be stored here from the validations.
     *
     * @type {Array} Will contain keys that correspond to attributes which will
     *   be Arrays of Errors.
     * @private
     */
    this.errors = [];

    /**
     * @type {boolean} Indicates if validations are in progress
     * @private
     */
    this.inProgress = false;

    extendModelValidations(modelInstance);
  }

  /**
   * The main entry point for the Validation module, invoke to start the dance.
   *
   * @return {Promise}
   * @private
   */


  _createClass(InstanceValidator, [{
    key: '_validate',
    value: function _validate() {
      var _this = this;

      if (this.inProgress) {
        throw new Error('Validations already in progress.');
      }
      this.inProgress = true;

      return Promise.all([this._builtinValidators(), this._customValidators()].map(function (promise) {
        return promise.reflect();
      })).then(function () {
        if (_this.errors.length) {
          throw new sequelizeError.ValidationError(null, _this.errors);
        }
      });
    }

    /**
     * Invoke the Validation sequence and run validation hooks if defined
     *   - Before Validation Model Hooks
     *   - Validation
     *   - On validation success: After Validation Model Hooks
     *   - On validation failure: Validation Failed Model Hooks
     *
     * @return {Promise}
     * @private
     */

  }, {
    key: 'validate',
    value: function validate() {
      return this.options.hooks ? this._validateAndRunHooks() : this._validate();
    }

    /**
     * Invoke the Validation sequence and run hooks
     *   - Before Validation Model Hooks
     *   - Validation
     *   - On validation success: After Validation Model Hooks
     *   - On validation failure: Validation Failed Model Hooks
     *
     * @return {Promise}
     * @private
     */

  }, {
    key: '_validateAndRunHooks',
    value: function _validateAndRunHooks() {
      var _this2 = this;

      var runHooks = this.modelInstance.constructor.runHooks.bind(this.modelInstance.constructor);
      return runHooks('beforeValidate', this.modelInstance, this.options).then(function () {
        return _this2._validate().catch(function (error) {
          return runHooks('validationFailed', _this2.modelInstance, _this2.options, error).then(function (newError) {
            throw newError || error;
          });
        });
      }).then(function () {
        return runHooks('afterValidate', _this2.modelInstance, _this2.options);
      }).return(this.modelInstance);
    }

    /**
     * Will run all the built-in validators.
     *
     * @return {Promise(Array.<Promise.PromiseInspection>)} A promise from .reflect().
     * @private
     */

  }, {
    key: '_builtinValidators',
    value: function _builtinValidators() {
      var _this3 = this;

      // promisify all attribute invocations
      var validators = [];
      Utils._.forIn(this.modelInstance.rawAttributes, function (rawAttribute, field) {
        if (_this3.options.skip.indexOf(field) >= 0) {
          return;
        }

        var value = _this3.modelInstance.dataValues[field];

        if (!rawAttribute._autoGenerated && !rawAttribute.autoIncrement) {
          // perform validations based on schema
          _this3._validateSchema(rawAttribute, field, value);
        }

        if (_this3.modelInstance.validators.hasOwnProperty(field)) {
          validators.push(_this3._builtinAttrValidate.call(_this3, value, field).reflect());
        }
      });

      return Promise.all(validators);
    }

    /**
     * Will run all the custom validators.
     *
     * @return {Promise(Array.<Promise.PromiseInspection>)} A promise from .reflect().
     * @private
     */

  }, {
    key: '_customValidators',
    value: function _customValidators() {
      var _this4 = this;

      var validators = [];
      Utils._.each(this.modelInstance._modelOptions.validate, function (validator, validatorType) {
        if (_this4.options.skip.indexOf(validatorType) >= 0) {
          return;
        }

        var valprom = _this4._invokeCustomValidator(validator, validatorType)
        // errors are handled in settling, stub this
        .catch(function () {}).reflect();

        validators.push(valprom);
      });

      return Promise.all(validators);
    }

    /**
     * Validate a single attribute with all the defined built-in validators.
     *
     * @param {*} value Anything.
     * @param {string} field The field name.
     * @return {Promise} A promise, will always resolve,
     *   auto populates error on this.error local object.
     * @private
     */

  }, {
    key: '_builtinAttrValidate',
    value: function _builtinAttrValidate(value, field) {
      var _this5 = this;

      // check if value is null (if null not allowed the Schema pass will capture it)
      if (value === null || typeof value === 'undefined') {
        return Promise.resolve();
      }

      // Promisify each validator
      var validators = [];
      Utils._.forIn(this.modelInstance.validators[field], function (test, validatorType) {

        if (['isUrl', 'isURL', 'isEmail'].indexOf(validatorType) !== -1) {
          // Preserve backwards compat. Validator.js now expects the second param to isURL and isEmail to be an object
          if ((typeof test === 'undefined' ? 'undefined' : _typeof(test)) === 'object' && test !== null && test.msg) {
            test = {
              msg: test.msg
            };
          } else if (test === true) {
            test = {};
          }
        }

        // Check for custom validator.
        if (typeof test === 'function') {
          return validators.push(_this5._invokeCustomValidator(test, validatorType, true, value, field).reflect());
        }

        var validatorPromise = _this5._invokeBuiltinValidator(value, test, validatorType, field);
        // errors are handled in settling, stub this
        validatorPromise.catch(function () {});
        validators.push(validatorPromise.reflect());
      });

      return Promise.all(validators).then(function (results) {
        return _this5._handleReflectedResult(field, value, results);
      });
    }

    /**
     * Prepare and invoke a custom validator.
     *
     * @param {Function} validator The custom validator.
     * @param {string} validatorType the custom validator type (name).
     * @param {boolean=} optAttrDefined Set to true if custom validator was defined
     *   from the Attribute
     * @return {Promise} A promise.
     * @private
     */

  }, {
    key: '_invokeCustomValidator',
    value: function _invokeCustomValidator(validator, validatorType, optAttrDefined, optValue, optField) {
      var _this6 = this;

      var validatorFunction = null; // the validation function to call
      var isAsync = false;

      var validatorArity = validator.length;
      // check if validator is async and requires a callback
      var asyncArity = 1;
      var errorKey = validatorType;
      var invokeArgs = void 0;
      if (optAttrDefined) {
        asyncArity = 2;
        invokeArgs = optValue;
        errorKey = optField;
      }
      if (validatorArity === asyncArity) {
        isAsync = true;
      }

      if (isAsync) {
        if (optAttrDefined) {
          validatorFunction = Promise.promisify(validator.bind(this.modelInstance, invokeArgs));
        } else {
          validatorFunction = Promise.promisify(validator.bind(this.modelInstance));
        }
        return validatorFunction().catch(function (e) {
          return _this6._pushError(false, errorKey, e, optValue);
        });
      } else {
        return Promise.try(function () {
          return validator.call(_this6.modelInstance, invokeArgs);
        }).catch(function (e) {
          return _this6._pushError(false, errorKey, e, optValue);
        });
      }
    }

    /**
     * Prepare and invoke a build-in validator.
     *
     * @param {*} value Anything.
     * @param {*} test The test case.
     * @param {string} validatorType One of known to Sequelize validators.
     * @param {string} field The field that is being validated
     * @return {Object} An object with specific keys to invoke the validator.
     * @private
     */

  }, {
    key: '_invokeBuiltinValidator',
    value: function _invokeBuiltinValidator(value, test, validatorType, field) {
      var _this7 = this;

      return Promise.try(function () {
        // Cast value as string to pass new Validator.js string requirement
        var valueString = String(value);
        // check if Validator knows that kind of validation test
        if (typeof validator[validatorType] !== 'function') {
          throw new Error('Invalid validator function: ' + validatorType);
        }
        var validatorArgs = _this7._extractValidatorArgs(test, validatorType, field);
        if (!validator[validatorType].apply(validator, [valueString].concat(validatorArgs))) {
          // extract the error msg
          throw new Error(test.msg || 'Validation ' + validatorType + ' on ' + field + ' failed');
        }
      });
    }

    /**
     * Will extract arguments for the validator.
     *
     * @param {*} test The test case.
     * @param {string} validatorType One of known to Sequelize validators.
     * @param {string} field The field that is being validated.
     * @private
     */

  }, {
    key: '_extractValidatorArgs',
    value: function _extractValidatorArgs(test, validatorType, field) {
      var validatorArgs = test.args || test;
      var isLocalizedValidator = typeof validatorArgs !== 'string' && (validatorType === 'isAlpha' || validatorType === 'isAlphanumeric' || validatorType === 'isMobilePhone');

      if (!Array.isArray(validatorArgs)) {
        if (validatorType === 'isImmutable') {
          validatorArgs = [validatorArgs, field];
        } else if (isLocalizedValidator || validatorType === 'isIP') {
          validatorArgs = [];
        } else {
          validatorArgs = [validatorArgs];
        }
      } else {
        validatorArgs = validatorArgs.slice(0);
      }
      return validatorArgs;
    }

    /**
     * Will validate a single field against its schema definition (isnull).
     *
     * @param {Object} rawAttribute As defined in the Schema.
     * @param {string} field The field name.
     * @param {*} value anything.
     * @private
     */

  }, {
    key: '_validateSchema',
    value: function _validateSchema(rawAttribute, field, value) {
      var error = void 0;

      if (rawAttribute.allowNull === false && (value === null || value === undefined)) {
        var validators = this.modelInstance.validators[field];
        var errMsg = validators ? (validators.notNull || {}).msg : field + ' cannot be null';
        error = new sequelizeError.ValidationErrorItem(errMsg, 'notNull Violation', field, value);
        this.errors.push(error);
      }

      if (rawAttribute.type === DataTypes.STRING || rawAttribute.type instanceof DataTypes.STRING || rawAttribute.type === DataTypes.TEXT || rawAttribute.type instanceof DataTypes.TEXT) {
        if (Array.isArray(value) || _.isObject(value) && !(value instanceof Utils.SequelizeMethod) && !Buffer.isBuffer(value)) {
          error = new sequelizeError.ValidationErrorItem(field + ' cannot be an array or an object', 'string violation', field, value);
          this.errors.push(error);
        }
      }
    }

    /**
     * Handles the returned result of a Promise.reflect.
     *
     * If errors are found it populates this.error.
     *
     * @param {string} field The attribute name.
     * @param {string|number} value The data value.
     * @param {Array.<Promise.PromiseInspection>} Promise inspection objects.
     * @private
     */

  }, {
    key: '_handleReflectedResult',
    value: function _handleReflectedResult(field, value, promiseInspections) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = promiseInspections[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var promiseInspection = _step.value;

          if (promiseInspection.isRejected()) {
            var rejection = promiseInspection.error();
            this._pushError(true, field, rejection, value);
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

    /**
     * Signs all errors retaining the original.
     *
     * @param {boolean} isBuiltin Determines if error is from builtin validator.
     * @param {string} errorKey The error key to assign on this.errors object.
     * @param {Error|string} rawError The original error.
     * @param {string|number} value The data that triggered the error.
     * @private
     */

  }, {
    key: '_pushError',
    value: function _pushError(isBuiltin, errorKey, rawError, value) {
      var message = rawError.message || rawError || 'Validation error';
      var error = new sequelizeError.ValidationErrorItem(message, 'Validation error', errorKey, value);
      error[InstanceValidator.RAW_KEY_NAME] = rawError;

      this.errors.push(error);
    }
  }]);

  return InstanceValidator;
}();
/**
 * @define {string} The error key for arguments as passed by custom validators
 * @private
 */


InstanceValidator.RAW_KEY_NAME = '__raw';

module.exports = InstanceValidator;
module.exports.InstanceValidator = InstanceValidator;
module.exports.default = InstanceValidator;