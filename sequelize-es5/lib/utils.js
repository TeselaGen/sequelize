'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DataTypes = require('./data-types');
var SqlString = require('./sql-string');
var _ = require('lodash').runInContext(); // Prevent anyone messing with template settings by creating a fresh copy
var parameterValidator = require('./utils/parameter-validator');
var Logger = require('./utils/logger');
var uuid = require('uuid');
var Promise = require('./promise');
var primitives = ['string', 'number', 'boolean'];

var inflection = require('inflection');
var logger = new Logger();

exports.Promise = Promise;
exports._ = _;
exports.debug = logger.debug.bind(logger);
exports.deprecate = logger.deprecate.bind(logger);
exports.warn = logger.warn.bind(logger);
exports.getLogger = function () {
  return logger;
};

function useInflection(_inflection) {
  inflection = _inflection;
}
exports.useInflection = useInflection;

function camelizeIf(str, condition) {
  var result = str;

  if (condition) {
    result = camelize(str);
  }

  return result;
}
exports.camelizeIf = camelizeIf;

function underscoredIf(str, condition) {
  var result = str;

  if (condition) {
    result = underscore(str);
  }

  return result;
}
exports.underscoredIf = underscoredIf;

function isPrimitive(val) {
  return primitives.indexOf(typeof val === 'undefined' ? 'undefined' : _typeof(val)) !== -1;
}
exports.isPrimitive = isPrimitive;

// Same concept as _.merge, but don't overwrite properties that have already been assigned
function mergeDefaults(a, b) {
  var _this = this;

  return _.mergeWith(a, b, function (objectValue) {
    // If it's an object, let _ handle it this time, we will be called again for each property
    if (!_this._.isPlainObject(objectValue) && objectValue !== undefined) {
      return objectValue;
    }
  });
}
exports.mergeDefaults = mergeDefaults;

// An alternative to _.merge, which doesn't clone its arguments
// Cloning is a bad idea because options arguments may contain references to sequelize
// models - which again reference database libs which don't like to be cloned (in particular pg-native)
function merge() {
  var result = {};

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = arguments[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var obj = _step.value;

      _.forOwn(obj, function (value, key) {
        if (typeof value !== 'undefined') {
          if (!result[key]) {
            result[key] = value;
          } else if (_.isPlainObject(value) && _.isPlainObject(result[key])) {
            result[key] = merge(result[key], value);
          } else if (Array.isArray(value) && Array.isArray(result[key])) {
            result[key] = value.concat(result[key]);
          } else {
            result[key] = value;
          }
        }
      });
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

  return result;
}
exports.merge = merge;

function lowercaseFirst(s) {
  return s[0].toLowerCase() + s.slice(1);
}
exports.lowercaseFirst = lowercaseFirst;

function uppercaseFirst(s) {
  return s[0].toUpperCase() + s.slice(1);
}
exports.uppercaseFirst = uppercaseFirst;

function spliceStr(str, index, count, add) {
  return str.slice(0, index) + add + str.slice(index + count);
}
exports.spliceStr = spliceStr;

function camelize(str) {
  return str.trim().replace(/[-_\s]+(.)?/g, function (match, c) {
    return c.toUpperCase();
  });
}
exports.camelize = camelize;

function underscore(str) {
  return inflection.underscore(str);
}
exports.underscore = underscore;

function format(arr, dialect) {
  var timeZone = null;
  // Make a clone of the array beacuse format modifies the passed args
  return SqlString.format(arr[0], arr.slice(1), timeZone, dialect);
}
exports.format = format;

function formatNamedParameters(sql, parameters, dialect) {
  var timeZone = null;
  return SqlString.formatNamedParameters(sql, parameters, timeZone, dialect);
}
exports.formatNamedParameters = formatNamedParameters;

function cloneDeep(obj) {
  obj = obj || {};
  return _.cloneDeepWith(obj, function (elem) {
    // Do not try to customize cloning of arrays or POJOs
    if (Array.isArray(elem) || _.isPlainObject(elem)) {
      return undefined;
    }

    // Don't clone stuff that's an object, but not a plain one - fx example sequelize models and instances
    if ((typeof elem === 'undefined' ? 'undefined' : _typeof(elem)) === 'object') {
      return elem;
    }

    // Preserve special data-types like `fn` across clones. _.get() is used for checking up the prototype chain
    if (elem && typeof elem.clone === 'function') {
      return elem.clone();
    }
  });
}
exports.cloneDeep = cloneDeep;

/* Expand and normalize finder options */
function mapFinderOptions(options, Model) {
  if (Model._hasVirtualAttributes && Array.isArray(options.attributes)) {
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = options.attributes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var attribute = _step2.value;

        if (Model._isVirtualAttribute(attribute) && Model.rawAttributes[attribute].type.fields) {
          options.attributes = options.attributes.concat(Model.rawAttributes[attribute].type.fields);
        }
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

    options.attributes = _.without.apply(_, [options.attributes].concat(Model._virtualAttributes));
    options.attributes = _.uniq(options.attributes);
  }

  mapOptionFieldNames(options, Model);

  return options;
}
exports.mapFinderOptions = mapFinderOptions;

/* Used to map field names in attributes and where conditions */
function mapOptionFieldNames(options, Model) {
  if (Array.isArray(options.attributes)) {
    options.attributes = options.attributes.map(function (attr) {
      // Object lookups will force any variable to strings, we don't want that for special objects etc
      if (typeof attr !== 'string') return attr;
      // Map attributes to aliased syntax attributes
      if (Model.rawAttributes[attr] && attr !== Model.rawAttributes[attr].field) {
        return [Model.rawAttributes[attr].field, attr];
      }
      return attr;
    });
  }

  if (options.where && _.isPlainObject(options.where)) {
    options.where = mapWhereFieldNames(options.where, Model);
  }

  return options;
}
exports.mapOptionFieldNames = mapOptionFieldNames;

function mapWhereFieldNames(attributes, Model) {
  var attribute = void 0;
  var rawAttribute = void 0;

  if (attributes) {
    for (attribute in attributes) {
      rawAttribute = Model.rawAttributes[attribute];

      if (rawAttribute && rawAttribute.field !== rawAttribute.fieldName) {
        attributes[rawAttribute.field] = attributes[attribute];
        delete attributes[attribute];
      }

      if (_.isPlainObject(attributes[attribute]) && !(rawAttribute && (rawAttribute.type instanceof DataTypes.HSTORE || rawAttribute.type instanceof DataTypes.JSON))) {
        // Prevent renaming of HSTORE & JSON fields
        attributes[attribute] = mapOptionFieldNames({
          where: attributes[attribute]
        }, Model).where;
      }

      if (Array.isArray(attributes[attribute])) {
        attributes[attribute] = attributes[attribute].map(function (where) {
          if (_.isPlainObject(where)) {
            return mapWhereFieldNames(where, Model);
          }

          return where;
        });
      }
    }
  }

  return attributes;
}
exports.mapWhereFieldNames = mapWhereFieldNames;

/* Used to map field names in values */
function mapValueFieldNames(dataValues, fields, Model) {
  var values = {};

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = fields[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var attr = _step3.value;

      if (dataValues[attr] !== undefined && !Model._isVirtualAttribute(attr)) {
        // Field name mapping
        if (Model.rawAttributes[attr] && Model.rawAttributes[attr].field && Model.rawAttributes[attr].field !== attr) {
          values[Model.rawAttributes[attr].field] = dataValues[attr];
        } else {
          values[attr] = dataValues[attr];
        }
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

  return values;
}
exports.mapValueFieldNames = mapValueFieldNames;

function isColString(value) {
  return typeof value === 'string' && value.substr(0, 1) === '$' && value.substr(value.length - 1, 1) === '$';
}
exports.isColString = isColString;

function argsArePrimaryKeys(args, primaryKeys) {
  var result = args.length === Object.keys(primaryKeys).length;
  if (result) {
    _.each(args, function (arg) {
      if (result) {
        if (['number', 'string'].indexOf(typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) !== -1) {
          result = true;
        } else {
          result = arg instanceof Date || Buffer.isBuffer(arg);
        }
      }
    });
  }
  return result;
}
exports.argsArePrimaryKeys = argsArePrimaryKeys;

function canTreatArrayAsAnd(arr) {
  return arr.reduce(function (treatAsAnd, arg) {
    if (treatAsAnd) {
      return treatAsAnd;
    } else {
      return _.isPlainObject(arg);
    }
  }, false);
}
exports.canTreatArrayAsAnd = canTreatArrayAsAnd;

function combineTableNames(tableName1, tableName2) {
  return tableName1.toLowerCase() < tableName2.toLowerCase() ? tableName1 + tableName2 : tableName2 + tableName1;
}
exports.combineTableNames = combineTableNames;

function singularize(str) {
  return inflection.singularize(str);
}
exports.singularize = singularize;

function pluralize(str) {
  return inflection.pluralize(str);
}
exports.pluralize = pluralize;

function removeCommentsFromFunctionString(s) {
  s = s.replace(/\s*(\/\/.*)/g, '');
  s = s.replace(/(\/\*[\n\r\s\S]*?\*\/)/mg, '');

  return s;
}
exports.removeCommentsFromFunctionString = removeCommentsFromFunctionString;

function toDefaultValue(value) {
  if (typeof value === 'function') {
    var tmp = value();
    if (tmp instanceof DataTypes.ABSTRACT) {
      return tmp.toSql();
    } else {
      return tmp;
    }
  } else if (value instanceof DataTypes.UUIDV1) {
    return uuid.v1();
  } else if (value instanceof DataTypes.UUIDV4) {
    return uuid.v4();
  } else if (value instanceof DataTypes.NOW) {
    return now();
  } else if (_.isPlainObject(value) || _.isArray(value)) {
    return _.clone(value);
  } else {
    return value;
  }
}
exports.toDefaultValue = toDefaultValue;

/**
 * Determine if the default value provided exists and can be described
 * in a db schema using the DEFAULT directive.
 *
 * @param  {*} value Any default value.
 * @return {boolean} yes / no.
 * @private
 */
function defaultValueSchemable(value) {
  if (typeof value === 'undefined') {
    return false;
  }

  // TODO this will be schemable when all supported db
  // have been normalized for this case
  if (value instanceof DataTypes.NOW) {
    return false;
  }

  if (value instanceof DataTypes.UUIDV1 || value instanceof DataTypes.UUIDV4) {
    return false;
  }

  if (_.isFunction(value)) {
    return false;
  }

  return true;
}
exports.defaultValueSchemable = defaultValueSchemable;

function removeNullValuesFromHash(hash, omitNull, options) {
  var result = hash;

  options = options || {};
  options.allowNull = options.allowNull || [];

  if (omitNull) {
    var _hash = {};

    _.forIn(hash, function (val, key) {
      if (options.allowNull.indexOf(key) > -1 || key.match(/Id$/) || val !== null && val !== undefined) {
        _hash[key] = val;
      }
    });

    result = _hash;
  }

  return result;
}
exports.removeNullValuesFromHash = removeNullValuesFromHash;

function stack() {
  var orig = Error.prepareStackTrace;
  Error.prepareStackTrace = function (_, stack) {
    return stack;
  };
  var err = new Error();
  Error.captureStackTrace(err, stack);
  var errStack = err.stack;
  Error.prepareStackTrace = orig;
  return errStack;
}
exports.stack = stack;

function sliceArgs(args, begin) {
  begin = begin || 0;
  var tmp = new Array(args.length - begin);
  for (var i = begin; i < args.length; ++i) {
    tmp[i - begin] = args[i];
  }
  return tmp;
}
exports.sliceArgs = sliceArgs;

function now(dialect) {
  var now = new Date();
  if (['mysql', 'postgres', 'sqlite'].indexOf(dialect) === -1) {
    now.setMilliseconds(0);
  }
  return now;
}
exports.now = now;

// Note: Use the `quoteIdentifier()` and `escape()` methods on the
// `QueryInterface` instead for more portable code.

var TICK_CHAR = '`';
exports.TICK_CHAR = TICK_CHAR;

function addTicks(s, tickChar) {
  tickChar = tickChar || TICK_CHAR;
  return tickChar + removeTicks(s, tickChar) + tickChar;
}
exports.addTicks = addTicks;

function removeTicks(s, tickChar) {
  tickChar = tickChar || TICK_CHAR;
  return s.replace(new RegExp(tickChar, 'g'), '');
}
exports.removeTicks = removeTicks;

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 * @private
 */

var SequelizeMethod = function SequelizeMethod() {
  _classCallCheck(this, SequelizeMethod);
};

exports.SequelizeMethod = SequelizeMethod;

var Fn = function (_SequelizeMethod) {
  _inherits(Fn, _SequelizeMethod);

  function Fn(fn, args) {
    _classCallCheck(this, Fn);

    var _this2 = _possibleConstructorReturn(this, (Fn.__proto__ || Object.getPrototypeOf(Fn)).call(this));

    _this2.fn = fn;
    _this2.args = args;
    return _this2;
  }

  _createClass(Fn, [{
    key: 'clone',
    value: function clone() {
      return new Fn(this.fn, this.args);
    }
  }]);

  return Fn;
}(SequelizeMethod);

exports.Fn = Fn;

var Col = function (_SequelizeMethod2) {
  _inherits(Col, _SequelizeMethod2);

  function Col(col) {
    _classCallCheck(this, Col);

    var _this3 = _possibleConstructorReturn(this, (Col.__proto__ || Object.getPrototypeOf(Col)).call(this));

    if (arguments.length > 1) {
      col = _this3.sliceArgs(arguments);
    }
    _this3.col = col;
    return _this3;
  }

  return Col;
}(SequelizeMethod);

exports.Col = Col;

var Cast = function (_SequelizeMethod3) {
  _inherits(Cast, _SequelizeMethod3);

  function Cast(val, type) {
    _classCallCheck(this, Cast);

    var _this4 = _possibleConstructorReturn(this, (Cast.__proto__ || Object.getPrototypeOf(Cast)).call(this));

    _this4.val = val;
    _this4.type = (type || '').trim();
    return _this4;
  }

  return Cast;
}(SequelizeMethod);

exports.Cast = Cast;

var Literal = function (_SequelizeMethod4) {
  _inherits(Literal, _SequelizeMethod4);

  function Literal(val) {
    _classCallCheck(this, Literal);

    var _this5 = _possibleConstructorReturn(this, (Literal.__proto__ || Object.getPrototypeOf(Literal)).call(this));

    _this5.val = val;
    return _this5;
  }

  return Literal;
}(SequelizeMethod);

exports.Literal = Literal;

var Json = function (_SequelizeMethod5) {
  _inherits(Json, _SequelizeMethod5);

  function Json(conditionsOrPath, value) {
    _classCallCheck(this, Json);

    var _this6 = _possibleConstructorReturn(this, (Json.__proto__ || Object.getPrototypeOf(Json)).call(this));

    if (_.isObject(conditionsOrPath)) {
      _this6.conditions = conditionsOrPath;
    } else {
      _this6.path = conditionsOrPath;
      if (value) {
        _this6.value = value;
      }
    }
    return _this6;
  }

  return Json;
}(SequelizeMethod);

exports.Json = Json;

var Where = function (_SequelizeMethod6) {
  _inherits(Where, _SequelizeMethod6);

  function Where(attribute, comparator, logic) {
    _classCallCheck(this, Where);

    var _this7 = _possibleConstructorReturn(this, (Where.__proto__ || Object.getPrototypeOf(Where)).call(this));

    if (logic === undefined) {
      logic = comparator;
      comparator = '=';
    }

    _this7.attribute = attribute;
    _this7.comparator = comparator;
    _this7.logic = logic;
    return _this7;
  }

  return Where;
}(SequelizeMethod);

exports.Where = Where;

exports.validateParameter = parameterValidator;

exports.mapIsolationLevelStringToTedious = function (isolationLevel, tedious) {
  if (!tedious) {
    throw new Error('An instance of tedious lib should be passed to this function');
  }
  var tediousIsolationLevel = tedious.ISOLATION_LEVEL;
  switch (isolationLevel) {
    case 'READ_UNCOMMITTED':
      return tediousIsolationLevel.READ_UNCOMMITTED;
    case 'READ_COMMITTED':
      return tediousIsolationLevel.READ_COMMITTED;
    case 'REPEATABLE_READ':
      return tediousIsolationLevel.REPEATABLE_READ;
    case 'SERIALIZABLE':
      return tediousIsolationLevel.SERIALIZABLE;
    case 'SNAPSHOT':
      return tediousIsolationLevel.SNAPSHOT;
  }
};
//# sourceMappingURL=utils.js.map