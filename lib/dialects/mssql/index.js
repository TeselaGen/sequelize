'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var AbstractDialect = require('../abstract');
var ConnectionManager = require('./connection-manager');
var Query = require('./query');
var QueryGenerator = require('./query-generator');
var DataTypes = require('../../data-types').mssql;

var MssqlDialect = function (_AbstractDialect) {
  _inherits(MssqlDialect, _AbstractDialect);

  function MssqlDialect(sequelize) {
    _classCallCheck(this, MssqlDialect);

    var _this = _possibleConstructorReturn(this, (MssqlDialect.__proto__ || Object.getPrototypeOf(MssqlDialect)).call(this));

    _this.sequelize = sequelize;
    _this.connectionManager = new ConnectionManager(_this, sequelize);
    _this.QueryGenerator = _.extend({}, QueryGenerator, {
      options: sequelize.options,
      _dialect: _this,
      sequelize: sequelize
    });
    return _this;
  }

  return MssqlDialect;
}(AbstractDialect);

MssqlDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'DEFAULT': true,
  'DEFAULT VALUES': true,
  'LIMIT ON UPDATE': true,
  'ORDER NULLS': false,
  lock: false,
  transactions: true,
  migrations: false,
  upserts: true,
  returnValues: {
    output: true
  },
  schemas: true,
  autoIncrement: {
    identityInsert: true,
    defaultValue: false,
    update: false
  },
  constraints: {
    restrict: false,
    default: true
  },
  index: {
    collate: false,
    length: false,
    parser: false,
    type: true,
    using: false,
    where: true
  },
  NUMERIC: true,
  tmpTableTrigger: true
});

ConnectionManager.prototype.defaultVersion = '12.0.2000'; // SQL Server 2014 Express
MssqlDialect.prototype.Query = Query;
MssqlDialect.prototype.name = 'mssql';
MssqlDialect.prototype.TICK_CHAR = '"';
MssqlDialect.prototype.TICK_CHAR_LEFT = '[';
MssqlDialect.prototype.TICK_CHAR_RIGHT = ']';
MssqlDialect.prototype.DataTypes = DataTypes;

module.exports = MssqlDialect;