'use strict';

var stores = new Map();

module.exports = function (dialect) {

  if (!stores.has(dialect)) {
    stores.set(dialect, new Map());
  }

  return {
    clear: function clear() {
      stores.get(dialect).clear();
    },
    refresh: function refresh(dataType) {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = dataType.types[dialect][Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var type = _step.value;

          stores.get(dialect).set(type, dataType.parse);
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
    },
    get: function get(type) {
      return stores.get(dialect).get(type);
    }
  };
};
//# sourceMappingURL=parserStore.js.map