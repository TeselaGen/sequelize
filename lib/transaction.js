'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = require('./utils');

/**
 * The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 *
 * @see {@link Sequelize.transaction}
 */

var Transaction = function () {
  /**
   * @param {Sequelize} sequelize A configured sequelize Instance
   * @param {Object} options An object with options
   * @param {Boolean} options.autocommit Sets the autocommit property of the transaction.
   * @param {String} options.type=true Sets the type of the transaction.
   * @param {String} options.isolationLevel=true Sets the isolation level of the transaction.
   * @param {String} options.deferrable Sets the constraints to be deferred or immediately checked.
   */
  function Transaction(sequelize, options) {
    _classCallCheck(this, Transaction);

    this.sequelize = sequelize;
    this.savepoints = [];

    // get dialect specific transaction options
    var transactionOptions = sequelize.dialect.supports.transactionOptions || {};
    var generateTransactionId = this.sequelize.dialect.QueryGenerator.generateTransactionId;

    this.options = Utils._.extend({
      autocommit: transactionOptions.autocommit || null,
      type: sequelize.options.transactionType,
      isolationLevel: sequelize.options.isolationLevel,
      readOnly: false
    }, options || {});

    this.parent = this.options.transaction;
    this.id = this.parent ? this.parent.id : generateTransactionId();

    if (this.parent) {
      this.id = this.parent.id;
      this.parent.savepoints.push(this);
      this.name = this.id + '-savepoint-' + this.parent.savepoints.length;
    } else {
      this.id = this.name = generateTransactionId();
    }

    delete this.options.transaction;
  }

  /**
   * Commit the transaction
   *
   * @return {Promise}
   */


  _createClass(Transaction, [{
    key: 'commit',
    value: function commit() {
      var _this = this;

      if (this.finished) {
        return Utils.Promise.reject(new Error('Transaction cannot be committed because it has been finished with state: ' + this.finished));
      }

      this._clearCls();

      return this.sequelize.getQueryInterface().commitTransaction(this, this.options).finally(function () {
        _this.finished = 'commit';
        if (!_this.parent) {
          return _this.cleanup();
        }
        return null;
      });
    }

    /**
     * Rollback (abort) the transaction
     *
     * @return {Promise}
     */

  }, {
    key: 'rollback',
    value: function rollback() {
      var _this2 = this;

      if (this.finished) {
        return Utils.Promise.reject(new Error('Transaction cannot be rolled back because it has been finished with state: ' + this.finished));
      }

      this._clearCls();

      return this.sequelize.getQueryInterface().rollbackTransaction(this, this.options).finally(function () {
        if (!_this2.parent) {
          return _this2.cleanup();
        }
        return _this2;
      });
    }
  }, {
    key: 'prepareEnvironment',
    value: function prepareEnvironment() {
      var _this3 = this;

      var connectionPromise = void 0;

      if (this.parent) {
        connectionPromise = Utils.Promise.resolve(this.parent.connection);
      } else {
        var acquireOptions = { uuid: this.id };
        if (this.options.readOnly) {
          acquireOptions.type = 'SELECT';
        }
        connectionPromise = this.sequelize.connectionManager.getConnection(acquireOptions);
      }

      return connectionPromise.then(function (connection) {
        _this3.connection = connection;
        _this3.connection.uuid = _this3.id;
      }).then(function () {
        return _this3.begin();
      }).then(function () {
        return _this3.setDeferrable();
      }).then(function () {
        return _this3.setIsolationLevel();
      }).then(function () {
        return _this3.setAutocommit();
      }).catch(function (setupErr) {
        return _this3.rollback().finally(function () {
          throw setupErr;
        });
      }).tap(function () {
        if (_this3.sequelize.constructor._cls) {
          _this3.sequelize.constructor._cls.set('transaction', _this3);
        }
        return null;
      });
    }
  }, {
    key: 'begin',
    value: function begin() {
      return this.sequelize.getQueryInterface().startTransaction(this, this.options);
    }
  }, {
    key: 'setDeferrable',
    value: function setDeferrable() {
      if (this.options.deferrable) {
        return this.sequelize.getQueryInterface().deferConstraints(this, this.options);
      }
    }
  }, {
    key: 'setAutocommit',
    value: function setAutocommit() {
      return this.sequelize.getQueryInterface().setAutocommit(this, this.options.autocommit, this.options);
    }
  }, {
    key: 'setIsolationLevel',
    value: function setIsolationLevel() {
      return this.sequelize.getQueryInterface().setIsolationLevel(this, this.options.isolationLevel, this.options);
    }
  }, {
    key: 'cleanup',
    value: function cleanup() {
      var res = this.sequelize.connectionManager.releaseConnection(this.connection);
      this.connection.uuid = undefined;
      return res;
    }
  }, {
    key: '_clearCls',
    value: function _clearCls() {
      var cls = this.sequelize.constructor._cls;

      if (cls) {
        if (cls.get('transaction') === this) {
          cls.set('transaction', null);
        }
      }
    }

    /**
     * Types can be set per-transaction by passing `options.type` to `sequelize.transaction`.
     * Default to `DEFERRED` but you can override the default type by passing `options.transactionType` in `new Sequelize`.
     * Sqlite only.
     *
     * Pass in the desired level as the first argument:
     *
     * ```js
     * return sequelize.transaction({type: Sequelize.Transaction.TYPES.EXCLUSIVE}, transaction => {
     *
     *  // your transactions
     *
     * }).then(result => {
     *   // transaction has been committed. Do something after the commit if required.
     * }).catch(err => {
     *   // do something with the err.
     * });
     * ```
     * @property DEFERRED
     * @property IMMEDIATE
     * @property EXCLUSIVE
     */

  }, {
    key: 'LOCK',


    /**
     * @see {@link Transaction.LOCK}
     */
    get: function get() {
      return Transaction.LOCK;
    }
  }], [{
    key: 'TYPES',
    get: function get() {
      return {
        DEFERRED: 'DEFERRED',
        IMMEDIATE: 'IMMEDIATE',
        EXCLUSIVE: 'EXCLUSIVE'
      };
    }

    /**
     * Isolations levels can be set per-transaction by passing `options.isolationLevel` to `sequelize.transaction`.
     * Default to `REPEATABLE_READ` but you can override the default isolation level by passing `options.isolationLevel` in `new Sequelize`.
     *
     * Pass in the desired level as the first argument:
     *
     * ```js
     * return sequelize.transaction({isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE}, transaction => {
    *
    *  // your transactions
    *
    * }).then(result => {
    *   // transaction has been committed. Do something after the commit if required.
    * }).catch(err => {
    *   // do something with the err.
    * });
     * ```
     * @property READ_UNCOMMITTED
     * @property READ_COMMITTED
     * @property REPEATABLE_READ
     * @property SERIALIZABLE
     */

  }, {
    key: 'ISOLATION_LEVELS',
    get: function get() {
      return {
        READ_UNCOMMITTED: 'READ UNCOMMITTED',
        READ_COMMITTED: 'READ COMMITTED',
        REPEATABLE_READ: 'REPEATABLE READ',
        SERIALIZABLE: 'SERIALIZABLE'
      };
    }

    /**
     * Possible options for row locking. Used in conjunction with `find` calls:
     *
     * ```js
     * t1 // is a transaction
     * Model.findAll({
     *   where: ...,
     *   transaction: t1,
     *   lock: t1.LOCK...
     * });
     * ```
     *
     * Postgres also supports specific locks while eager loading by using OF:
     * ```js
     * UserModel.findAll({
     *   where: ...,
     *   include: [TaskModel, ...],
     *   transaction: t1,
     *   lock: {
     *     level: t1.LOCK...,
     *     of: UserModel
     *   }
     * });
     * ```
     * UserModel will be locked but TaskModel won't!
     *
     * @return {Object}
     * @property UPDATE
     * @property SHARE
     * @property KEY_SHARE Postgres 9.3+ only
     * @property NO_KEY_UPDATE Postgres 9.3+ only
     */

  }, {
    key: 'LOCK',
    get: function get() {
      return {
        UPDATE: 'UPDATE',
        SHARE: 'SHARE',
        KEY_SHARE: 'KEY SHARE',
        NO_KEY_UPDATE: 'NO KEY UPDATE'
      };
    }
  }]);

  return Transaction;
}();

module.exports = Transaction;
module.exports.Transaction = Transaction;
module.exports.default = Transaction;