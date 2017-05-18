'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var AbstractDialect = require('../abstract');
var ConnectionManager = require('./connection-manager');
var Query = require('./query');
var QueryGenerator = require('./query-generator');
var DataTypes = require('../../data-types').postgres;

var PostgresDialect = function (_AbstractDialect) {
  _inherits(PostgresDialect, _AbstractDialect);

  function PostgresDialect(sequelize) {
    _classCallCheck(this, PostgresDialect);

    var _this = _possibleConstructorReturn(this, (PostgresDialect.__proto__ || Object.getPrototypeOf(PostgresDialect)).call(this));

    _this.sequelize = sequelize;
    _this.connectionManager = new ConnectionManager(_this, sequelize);
    _this.QueryGenerator = _.extend({}, QueryGenerator, {
      options: sequelize.options,
      _dialect: _this,
      sequelize: sequelize
    });
    return _this;
  }

  return PostgresDialect;
}(AbstractDialect);

PostgresDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'DEFAULT VALUES': true,
  'EXCEPTION': true,
  'ON DUPLICATE KEY': false,
  'ORDER NULLS': true,
  returnValues: {
    returning: true
  },
  bulkDefault: true,
  schemas: true,
  lock: true,
  lockOf: true,
  lockKey: true,
  lockOuterJoinFailure: true,
  forShare: 'FOR SHARE',
  index: {
    concurrently: true,
    using: 2,
    where: true
  },
  NUMERIC: true,
  ARRAY: true,
  RANGE: true,
  GEOMETRY: true,
  GEOGRAPHY: true,
  JSON: true,
  JSONB: true,
  HSTORE: true,
  deferrableConstraints: true,
  searchPath: true
});

ConnectionManager.prototype.defaultVersion = '9.4.0';
PostgresDialect.prototype.Query = Query;
PostgresDialect.prototype.DataTypes = DataTypes;
PostgresDialect.prototype.name = 'postgres';
PostgresDialect.prototype.TICK_CHAR = '"';
PostgresDialect.prototype.TICK_CHAR_LEFT = PostgresDialect.prototype.TICK_CHAR;
PostgresDialect.prototype.TICK_CHAR_RIGHT = PostgresDialect.prototype.TICK_CHAR;

module.exports = PostgresDialect;
module.exports.default = PostgresDialect;
module.exports.PostgresDialect = PostgresDialect;