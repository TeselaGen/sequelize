'use strict';

/**
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * This means that errors can be accessed using `Sequelize.ValidationError` or `sequelize.ValidationError`
 * The Base Error all Sequelize Errors inherit from.
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseError = function (_Error) {
  _inherits(BaseError, _Error);

  function BaseError(message) {
    _classCallCheck(this, BaseError);

    var _this = _possibleConstructorReturn(this, (BaseError.__proto__ || Object.getPrototypeOf(BaseError)).call(this, message));

    _this.name = 'SequelizeBaseError';
    _this.message = message;
    Error.captureStackTrace(_this, _this.constructor);
    return _this;
  }

  return BaseError;
}(Error);

exports.BaseError = BaseError;

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 */

var SequelizeScopeError = function (_BaseError) {
  _inherits(SequelizeScopeError, _BaseError);

  function SequelizeScopeError(parent) {
    _classCallCheck(this, SequelizeScopeError);

    var _this2 = _possibleConstructorReturn(this, (SequelizeScopeError.__proto__ || Object.getPrototypeOf(SequelizeScopeError)).call(this, parent));

    _this2.name = 'SequelizeScopeError';
    return _this2;
  }

  return SequelizeScopeError;
}(BaseError);

exports.SequelizeScopeError = SequelizeScopeError;

/**
 * Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
 * which is an array with 1 or more ValidationErrorItems, one for each validation that failed.
 *
 * @param {string} message Error message
 * @param {Array} [errors] Array of ValidationErrorItem objects describing the validation errors
 *
 * @property errors An array of ValidationErrorItems
 */

var ValidationError = function (_BaseError2) {
  _inherits(ValidationError, _BaseError2);

  function ValidationError(message, errors) {
    _classCallCheck(this, ValidationError);

    var _this3 = _possibleConstructorReturn(this, (ValidationError.__proto__ || Object.getPrototypeOf(ValidationError)).call(this, message));

    _this3.name = 'SequelizeValidationError';
    _this3.message = 'Validation Error';
    /**
     *
     * @type {ValidationErrorItem[]}
     */
    _this3.errors = errors || [];

    // Use provided error message if available...
    if (message) {
      _this3.message = message;

      // ... otherwise create a concatenated message out of existing errors.
    } else if (_this3.errors.length > 0 && _this3.errors[0].message) {
      _this3.message = _this3.errors.map(function (err) {
        return err.type + ': ' + err.message;
      }).join(',\n');
    }
    return _this3;
  }

  /**
   * Gets all validation error items for the path / field specified.
   *
   * @param {string} path The path to be checked for error items
   * @returns {ValidationErrorItem[]} Validation error items for the specified path
   */


  _createClass(ValidationError, [{
    key: 'get',
    value: function get(path) {
      return this.errors.reduce(function (reduced, error) {
        if (error.path === path) {
          reduced.push(error);
        }
        return reduced;
      }, []);
    }
  }]);

  return ValidationError;
}(BaseError);

exports.ValidationError = ValidationError;

/**
 * Thrown when attempting to update a stale model instance
 */

var OptimisticLockError = function (_BaseError3) {
  _inherits(OptimisticLockError, _BaseError3);

  function OptimisticLockError(options) {
    _classCallCheck(this, OptimisticLockError);

    options = options || {};
    options.message = options.message || 'Attempting to update a stale model instance: ' + options.modelName;

    var _this4 = _possibleConstructorReturn(this, (OptimisticLockError.__proto__ || Object.getPrototypeOf(OptimisticLockError)).call(this, options));

    _this4.name = 'SequelizeOptimisticLockError';
    _this4.message = options.message;
    /**
     * The name of the model on which the update was attempted
     * @type {string}
     */
    _this4.modelName = options.modelName;
    /**
     * The values of the attempted update
     * @type {object}
     */
    _this4.values = options.values;
    /**
     *
     * @type {object}
     */
    _this4.where = options.where;
    return _this4;
  }

  return OptimisticLockError;
}(BaseError);

exports.OptimisticLockError = OptimisticLockError;

/**
 * A base class for all database related errors.
 */

var DatabaseError = function (_BaseError4) {
  _inherits(DatabaseError, _BaseError4);

  function DatabaseError(parent) {
    _classCallCheck(this, DatabaseError);

    var _this5 = _possibleConstructorReturn(this, (DatabaseError.__proto__ || Object.getPrototypeOf(DatabaseError)).call(this, parent.message));

    _this5.name = 'SequelizeDatabaseError';
    /**
     * @type {Error}
     */
    _this5.parent = parent;
    /**
     * @type {Error}
     */
    _this5.original = parent;
    /**
     * The SQL that triggered the error
     * @type {string}
     */
    _this5.sql = parent.sql;
    return _this5;
  }

  return DatabaseError;
}(BaseError);

exports.DatabaseError = DatabaseError;

/**
 * Thrown when a database query times out because of a deadlock
 */

var TimeoutError = function (_DatabaseError) {
  _inherits(TimeoutError, _DatabaseError);

  function TimeoutError(parent) {
    _classCallCheck(this, TimeoutError);

    var _this6 = _possibleConstructorReturn(this, (TimeoutError.__proto__ || Object.getPrototypeOf(TimeoutError)).call(this, parent));

    _this6.name = 'SequelizeTimeoutError';
    return _this6;
  }

  return TimeoutError;
}(DatabaseError);

exports.TimeoutError = TimeoutError;

/**
 * Thrown when a unique constraint is violated in the database
 */

var UniqueConstraintError = function (_ValidationError) {
  _inherits(UniqueConstraintError, _ValidationError);

  function UniqueConstraintError(options) {
    _classCallCheck(this, UniqueConstraintError);

    options = options || {};
    options.parent = options.parent || { sql: '' };
    options.message = options.message || options.parent.message || 'Validation Error';
    options.errors = options.errors || {};

    var _this7 = _possibleConstructorReturn(this, (UniqueConstraintError.__proto__ || Object.getPrototypeOf(UniqueConstraintError)).call(this, options.message, options.errors));

    _this7.name = 'SequelizeUniqueConstraintError';
    _this7.message = options.message;
    _this7.errors = options.errors;
    _this7.fields = options.fields;
    _this7.parent = options.parent;
    _this7.original = options.parent;
    _this7.sql = options.parent.sql;
    return _this7;
  }

  return UniqueConstraintError;
}(ValidationError);

exports.UniqueConstraintError = UniqueConstraintError;

/**
 * Thrown when a foreign key constraint is violated in the database
 */

var ForeignKeyConstraintError = function (_DatabaseError2) {
  _inherits(ForeignKeyConstraintError, _DatabaseError2);

  function ForeignKeyConstraintError(options) {
    _classCallCheck(this, ForeignKeyConstraintError);

    options = options || {};
    options.parent = options.parent || { sql: '' };

    var _this8 = _possibleConstructorReturn(this, (ForeignKeyConstraintError.__proto__ || Object.getPrototypeOf(ForeignKeyConstraintError)).call(this, options.parent));

    _this8.name = 'SequelizeForeignKeyConstraintError';

    _this8.message = options.message || options.parent.message || 'Database Error';
    _this8.fields = options.fields;
    _this8.table = options.table;
    _this8.value = options.value;
    _this8.index = options.index;
    return _this8;
  }

  return ForeignKeyConstraintError;
}(DatabaseError);

exports.ForeignKeyConstraintError = ForeignKeyConstraintError;

/**
 * Thrown when an exclusion constraint is violated in the database
 */

var ExclusionConstraintError = function (_DatabaseError3) {
  _inherits(ExclusionConstraintError, _DatabaseError3);

  function ExclusionConstraintError(options) {
    _classCallCheck(this, ExclusionConstraintError);

    options = options || {};
    options.parent = options.parent || { sql: '' };

    var _this9 = _possibleConstructorReturn(this, (ExclusionConstraintError.__proto__ || Object.getPrototypeOf(ExclusionConstraintError)).call(this, options.parent));

    _this9.name = 'SequelizeExclusionConstraintError';

    _this9.message = options.message || options.parent.message;
    _this9.constraint = options.constraint;
    _this9.fields = options.fields;
    _this9.table = options.table;
    return _this9;
  }

  return ExclusionConstraintError;
}(DatabaseError);

exports.ExclusionConstraintError = ExclusionConstraintError;

/**
 * Thrown when constraint name is not found in the database
 */

var UnknownConstraintError = function (_DatabaseError4) {
  _inherits(UnknownConstraintError, _DatabaseError4);

  function UnknownConstraintError(message) {
    _classCallCheck(this, UnknownConstraintError);

    var parent = { message: message };

    var _this10 = _possibleConstructorReturn(this, (UnknownConstraintError.__proto__ || Object.getPrototypeOf(UnknownConstraintError)).call(this, parent));

    _this10.name = 'SequelizeUnknownConstraintError';
    _this10.message = message || 'The specified constraint does not exist';
    return _this10;
  }

  return UnknownConstraintError;
}(DatabaseError);

exports.UnknownConstraintError = UnknownConstraintError;

/**
 * Validation Error Item
 * Instances of this class are included in the `ValidationError.errors` property.
 *
 * @param {string} message An error message
 * @param {string} type The type of the validation error
 * @param {string} path The field that triggered the validation error
 * @param {string} value The value that generated the error
 */

var ValidationErrorItem = function ValidationErrorItem(message, type, path, value) {
  _classCallCheck(this, ValidationErrorItem);

  this.message = message || '';
  this.type = type || null;
  this.path = path || null;
  this.value = value !== undefined ? value : null;
};

exports.ValidationErrorItem = ValidationErrorItem;

/**
 * A base class for all connection related errors.
 */

var ConnectionError = function (_BaseError5) {
  _inherits(ConnectionError, _BaseError5);

  function ConnectionError(parent) {
    _classCallCheck(this, ConnectionError);

    var _this11 = _possibleConstructorReturn(this, (ConnectionError.__proto__ || Object.getPrototypeOf(ConnectionError)).call(this, parent ? parent.message : ''));

    _this11.name = 'SequelizeConnectionError';
    /**
     * The connection specific error which triggered this one
     * @type {Error}
     */
    _this11.parent = parent;
    _this11.original = parent;
    return _this11;
  }

  return ConnectionError;
}(BaseError);

exports.ConnectionError = ConnectionError;

/**
 * Thrown when a connection to a database is refused
 */

var ConnectionRefusedError = function (_ConnectionError) {
  _inherits(ConnectionRefusedError, _ConnectionError);

  function ConnectionRefusedError(parent) {
    _classCallCheck(this, ConnectionRefusedError);

    var _this12 = _possibleConstructorReturn(this, (ConnectionRefusedError.__proto__ || Object.getPrototypeOf(ConnectionRefusedError)).call(this, parent));

    _this12.name = 'SequelizeConnectionRefusedError';
    return _this12;
  }

  return ConnectionRefusedError;
}(ConnectionError);

exports.ConnectionRefusedError = ConnectionRefusedError;

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 */

var AccessDeniedError = function (_ConnectionError2) {
  _inherits(AccessDeniedError, _ConnectionError2);

  function AccessDeniedError(parent) {
    _classCallCheck(this, AccessDeniedError);

    var _this13 = _possibleConstructorReturn(this, (AccessDeniedError.__proto__ || Object.getPrototypeOf(AccessDeniedError)).call(this, parent));

    _this13.name = 'SequelizeAccessDeniedError';
    return _this13;
  }

  return AccessDeniedError;
}(ConnectionError);

exports.AccessDeniedError = AccessDeniedError;

/**
 * Thrown when a connection to a database has a hostname that was not found
 */

var HostNotFoundError = function (_ConnectionError3) {
  _inherits(HostNotFoundError, _ConnectionError3);

  function HostNotFoundError(parent) {
    _classCallCheck(this, HostNotFoundError);

    var _this14 = _possibleConstructorReturn(this, (HostNotFoundError.__proto__ || Object.getPrototypeOf(HostNotFoundError)).call(this, parent));

    _this14.name = 'SequelizeHostNotFoundError';
    return _this14;
  }

  return HostNotFoundError;
}(ConnectionError);

exports.HostNotFoundError = HostNotFoundError;

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 */

var HostNotReachableError = function (_ConnectionError4) {
  _inherits(HostNotReachableError, _ConnectionError4);

  function HostNotReachableError(parent) {
    _classCallCheck(this, HostNotReachableError);

    var _this15 = _possibleConstructorReturn(this, (HostNotReachableError.__proto__ || Object.getPrototypeOf(HostNotReachableError)).call(this, parent));

    _this15.name = 'SequelizeHostNotReachableError';
    return _this15;
  }

  return HostNotReachableError;
}(ConnectionError);

exports.HostNotReachableError = HostNotReachableError;

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 */

var InvalidConnectionError = function (_ConnectionError5) {
  _inherits(InvalidConnectionError, _ConnectionError5);

  function InvalidConnectionError(parent) {
    _classCallCheck(this, InvalidConnectionError);

    var _this16 = _possibleConstructorReturn(this, (InvalidConnectionError.__proto__ || Object.getPrototypeOf(InvalidConnectionError)).call(this, parent));

    _this16.name = 'SequelizeInvalidConnectionError';
    return _this16;
  }

  return InvalidConnectionError;
}(ConnectionError);

exports.InvalidConnectionError = InvalidConnectionError;

/**
 * Thrown when a connection to a database times out
 */

var ConnectionTimedOutError = function (_ConnectionError6) {
  _inherits(ConnectionTimedOutError, _ConnectionError6);

  function ConnectionTimedOutError(parent) {
    _classCallCheck(this, ConnectionTimedOutError);

    var _this17 = _possibleConstructorReturn(this, (ConnectionTimedOutError.__proto__ || Object.getPrototypeOf(ConnectionTimedOutError)).call(this, parent));

    _this17.name = 'SequelizeConnectionTimedOutError';
    return _this17;
  }

  return ConnectionTimedOutError;
}(ConnectionError);

exports.ConnectionTimedOutError = ConnectionTimedOutError;

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 */

var InstanceError = function (_BaseError6) {
  _inherits(InstanceError, _BaseError6);

  function InstanceError(message) {
    _classCallCheck(this, InstanceError);

    var _this18 = _possibleConstructorReturn(this, (InstanceError.__proto__ || Object.getPrototypeOf(InstanceError)).call(this, message));

    _this18.name = 'SequelizeInstanceError';
    _this18.message = message;
    return _this18;
  }

  return InstanceError;
}(BaseError);

exports.InstanceError = InstanceError;

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 */

var EmptyResultError = function (_BaseError7) {
  _inherits(EmptyResultError, _BaseError7);

  function EmptyResultError(message) {
    _classCallCheck(this, EmptyResultError);

    var _this19 = _possibleConstructorReturn(this, (EmptyResultError.__proto__ || Object.getPrototypeOf(EmptyResultError)).call(this, message));

    _this19.name = 'SequelizeEmptyResultError';
    _this19.message = message;
    return _this19;
  }

  return EmptyResultError;
}(BaseError);

exports.EmptyResultError = EmptyResultError;

/**
 * Thrown when an include statement is improperly constructed (see message for details)
 */

var EagerLoadingError = function (_BaseError8) {
  _inherits(EagerLoadingError, _BaseError8);

  function EagerLoadingError(message) {
    _classCallCheck(this, EagerLoadingError);

    var _this20 = _possibleConstructorReturn(this, (EagerLoadingError.__proto__ || Object.getPrototypeOf(EagerLoadingError)).call(this, message));

    _this20.name = 'SequelizeEagerLoadingError';
    _this20.message = message;
    return _this20;
  }

  return EagerLoadingError;
}(BaseError);

exports.EagerLoadingError = EagerLoadingError;

/**
 * Thrown when an association is improperly constructed (see message for details)
 */

var AssociationError = function (_BaseError9) {
  _inherits(AssociationError, _BaseError9);

  function AssociationError(message) {
    _classCallCheck(this, AssociationError);

    var _this21 = _possibleConstructorReturn(this, (AssociationError.__proto__ || Object.getPrototypeOf(AssociationError)).call(this, message));

    _this21.name = 'SequelizeAssociationError';
    _this21.message = message;
    return _this21;
  }

  return AssociationError;
}(BaseError);

exports.AssociationError = AssociationError;
/**
 * Thrown when a query is passed invalid options (see message for details)
 */

var QueryError = function (_BaseError10) {
  _inherits(QueryError, _BaseError10);

  function QueryError(message) {
    _classCallCheck(this, QueryError);

    var _this22 = _possibleConstructorReturn(this, (QueryError.__proto__ || Object.getPrototypeOf(QueryError)).call(this, message));

    _this22.name = 'SequelizeQueryError';
    _this22.message = message;
    return _this22;
  }

  return QueryError;
}(BaseError);

exports.QueryError = QueryError;