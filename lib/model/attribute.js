'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Attribute = function Attribute(options) {
  _classCallCheck(this, Attribute);

  if (options.type === undefined) options = { type: options };
  this.type = options.type;
};

module.exports = Attribute;
module.exports.Attribute = Attribute;
module.exports.default = Attribute;
//# sourceMappingURL=attribute.js.map