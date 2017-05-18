'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var AbstractDialect = require('../abstract');
var ConnectionManager = require('./connection-manager');
var Query = require('./query');
var QueryGenerator = require('./query-generator');
var DataTypes = require('../../data-types').oracle;

var OracleDialect = function (_AbstractDialect) {
  _inherits(OracleDialect, _AbstractDialect);

  function OracleDialect(sequelize) {
    _classCallCheck(this, OracleDialect);

    var _this = _possibleConstructorReturn(this, (OracleDialect.__proto__ || Object.getPrototypeOf(OracleDialect)).call(this));

    _this.sequelize = sequelize;
    _this.connectionManager = new ConnectionManager(_this, sequelize);
    _this.connectionManager.initPools();
    _this.QueryGenerator = _.extend({}, QueryGenerator, {
      options: sequelize.options,
      _dialect: _this,
      sequelize: sequelize
    });
    return _this;
  }

  return OracleDialect;
}(AbstractDialect);

OracleDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  'IGNORE': ' IGNORE',
  lock: false,
  forShare: ' IN SHARE MODE',
  index: {
    collate: false,
    length: false,
    parser: false,
    type: false,
    using: false
  },
  constraints: {
    restrict: false
  },
  returnValues: false,
  'ORDER NULLS': true,
  ignoreDuplicates: ' IGNORE',
  schemas: true,
  updateOnDuplicate: true,
  indexViaAlter: false,
  NUMERIC: true,
  upserts: false,
  GEOMETRY: false
});

ConnectionManager.prototype.defaultVersion = '12.1.0.2.0';
OracleDialect.prototype.Query = Query;
OracleDialect.prototype.QueryGenerator = QueryGenerator;
OracleDialect.prototype.DataTypes = DataTypes;
OracleDialect.prototype.name = 'oracle';
OracleDialect.prototype.TICK_CHAR = '';
OracleDialect.prototype.TICK_CHAR_LEFT = OracleDialect.prototype.TICK_CHAR;
OracleDialect.prototype.TICK_CHAR_RIGHT = OracleDialect.prototype.TICK_CHAR;

module.exports = OracleDialect;