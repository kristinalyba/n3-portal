/* */ 
var globalRequire = require;
require = function() {};
var exports = module.exports = {
  Lexer: require('./lib/N3Lexer'),
  Parser: require('./lib/N3Parser'),
  Writer: require('./lib/N3Writer'),
  Store: require('./lib/N3Store'),
  StreamParser: require('./lib/N3StreamParser'),
  StreamWriter: require('./lib/N3StreamWriter'),
  Util: require('./lib/N3Util')
};
Object.keys(exports).forEach(function(submodule) {
  Object.defineProperty(exports, submodule, {
    configurable: true,
    enumerable: true,
    get: function() {
      delete exports[submodule];
      return exports[submodule] = globalRequire('./lib/N3' + submodule);
    }
  });
});
