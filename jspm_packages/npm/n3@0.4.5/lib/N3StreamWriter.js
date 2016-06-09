/* */ 
var Transform = require('stream').Transform,
    util = require('util'),
    N3Writer = require('./N3Writer');
function N3StreamWriter(options) {
  if (!(this instanceof N3StreamWriter))
    return new N3StreamWriter(options);
  Transform.call(this, {encoding: 'utf8'});
  this._writableState.objectMode = true;
  var self = this;
  var writer = new N3Writer({
    write: function(chunk, encoding, callback) {
      self.push(chunk);
      callback && callback();
    },
    end: function(callback) {
      self.push(null);
      callback && callback();
    }
  }, options);
  this._transform = function(triple, encoding, done) {
    writer.addTriple(triple, done);
  };
  this._flush = function(done) {
    writer.end(done);
  };
}
util.inherits(N3StreamWriter, Transform);
module.exports = N3StreamWriter;
