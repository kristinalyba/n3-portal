/* */ 
var Transform = require('stream').Transform,
    util = require('util'),
    N3Parser = require('./N3Parser');
function N3StreamParser(options) {
  if (!(this instanceof N3StreamParser))
    return new N3StreamParser(options);
  Transform.call(this, {decodeStrings: true});
  this._readableState.objectMode = true;
  var self = this,
      parser = new N3Parser(options);
  parser.parse(function(error, triple) {
    triple && self.push(triple) || error && self.emit('error', error);
  }, this.emit.bind(this, 'prefix'));
  this._transform = function(chunk, encoding, done) {
    parser.addChunk(chunk);
    done();
  };
  this._flush = function(done) {
    parser.end();
    done();
  };
}
util.inherits(N3StreamParser, Transform);
module.exports = N3StreamParser;
