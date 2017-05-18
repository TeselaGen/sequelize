'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var AbstractDialect = require('../abstract');
var ConnectionManager = require('./connection-manager');
var Query = require('./query');
var QueryGenerator = require('./query-generator');
var DataTypes = require('../../data-types').sqlite;

var SqliteDialect = function (_AbstractDialect) {
  _inherits(SqliteDialect, _AbstractDialect);

  function SqliteDialect(sequelize) {
    _classCallCheck(this, SqliteDialect);

    var _this = _possibleConstructorReturn(this, (SqliteDialect.__proto__ || Object.getPrototypeOf(SqliteDialect)).call(this));

    _this.sequelize = sequelize;
    _this.connectionManager = new ConnectionManager(_this, sequelize);
    _this.QueryGenerator = _.extend({}, QueryGenerator, {
      options: sequelize.options,
      _dialect: _this,
      sequelize: sequelize
    });
    return _this;
  }

  return SqliteDialect;
}(AbstractDialect);

SqliteDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'DEFAULT': false,
  'DEFAULT VALUES': true,
  'UNION ALL': false,
  'IGNORE': ' OR IGNORE',
  index: {
    using: false
  },
  transactionOptions: {
    type: true,
    autocommit: false
  },
  constraints: {
    addConstraint: false,
    dropConstraint: false
  },
  joinTableDependent: false,
  groupedLimit: false,
  ignoreDuplicates: ' OR IGNORE',
  JSON: true
});

ConnectionManager.prototype.defaultVersion = '3.8.0';
SqliteDialect.prototype.Query = Query;
SqliteDialect.prototype.DataTypes = DataTypes;
SqliteDialect.prototype.name = 'sqlite';
SqliteDialect.prototype.TICK_CHAR = '`';
SqliteDialect.prototype.TICK_CHAR_LEFT = SqliteDialect.prototype.TICK_CHAR;
SqliteDialect.prototype.TICK_CHAR_RIGHT = SqliteDialect.prototype.TICK_CHAR;

module.exports = SqliteDialect;
module.exports.SqliteDialect = SqliteDialect;
module.exports.default = SqliteDialect;
//# sourceMappingURL=index.js.map