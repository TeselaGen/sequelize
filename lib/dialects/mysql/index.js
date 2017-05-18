'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _ = require('lodash');
var AbstractDialect = require('../abstract');
var ConnectionManager = require('./connection-manager');
var Query = require('./query');
var QueryGenerator = require('./query-generator');
var DataTypes = require('../../data-types').mysql;

var MysqlDialect = function (_AbstractDialect) {
  _inherits(MysqlDialect, _AbstractDialect);

  function MysqlDialect(sequelize) {
    _classCallCheck(this, MysqlDialect);

    var _this = _possibleConstructorReturn(this, (MysqlDialect.__proto__ || Object.getPrototypeOf(MysqlDialect)).call(this));

    _this.sequelize = sequelize;
    _this.connectionManager = new ConnectionManager(_this, sequelize);
    _this.QueryGenerator = _.extend({}, QueryGenerator, {
      options: sequelize.options,
      _dialect: _this,
      sequelize: sequelize
    });
    return _this;
  }

  return MysqlDialect;
}(AbstractDialect);

MysqlDialect.prototype.supports = _.merge(_.cloneDeep(AbstractDialect.prototype.supports), {
  'VALUES ()': true,
  'LIMIT ON UPDATE': true,
  'IGNORE': ' IGNORE',
  lock: true,
  forShare: 'LOCK IN SHARE MODE',
  index: {
    collate: false,
    length: true,
    parser: true,
    type: true,
    using: 1
  },
  constraints: {
    dropConstraint: false,
    check: false
  },
  ignoreDuplicates: ' IGNORE',
  updateOnDuplicate: true,
  indexViaAlter: true,
  NUMERIC: true,
  GEOMETRY: true
});

ConnectionManager.prototype.defaultVersion = '5.6.0';
MysqlDialect.prototype.Query = Query;
MysqlDialect.prototype.QueryGenerator = QueryGenerator;
MysqlDialect.prototype.DataTypes = DataTypes;
MysqlDialect.prototype.name = 'mysql';
MysqlDialect.prototype.TICK_CHAR = '`';
MysqlDialect.prototype.TICK_CHAR_LEFT = MysqlDialect.prototype.TICK_CHAR;
MysqlDialect.prototype.TICK_CHAR_RIGHT = MysqlDialect.prototype.TICK_CHAR;

module.exports = MysqlDialect;
//# sourceMappingURL=index.js.map