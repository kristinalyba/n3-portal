var N3            = require('N3');
var fs            = require('fs');
var replaceStream = require('replacestream');
var vocabs        = require('linkeddata-vocabs');
var path          = require('path');

var CUSTOM_PREFIX = 'custom.n3#';
var EMPTY_PREFIX = '#';

function N3Storage () {
	this._storage = N3.Store();
	this._storagePath = path.join(__dirname + '/storage.n3');
	this._prefixes = { prefixes: {
		cstm: CUSTOM_PREFIX,
		'': EMPTY_PREFIX,
		rdf: vocabs.rdf
	}};

	var parser = N3.Parser(),
		rdfStream = fs.createReadStream(this._storagePath);
		
	parser.parse(rdfStream, function (error, triple, prefixes) {
	    if (error) {
	    	console.log(error);
	    }

	    if(triple)
	    {
	    	this._storage.addTriple(triple.subject, triple.predicate, triple.object);
	    }
	 }.bind(this));

	console.log('===============Storage initialized================');
}

N3Storage.prototype.find = function (subject, predicate, object) {
	return this._storage.find(subject, predicate, object);
}

N3Storage.prototype.addTriples = function (triples) {
	var writeStream = fs.createWriteStream(this._storagePath, {'flags': 'a'});
	writeStream.write('\n', 'utf8');
	var writer = N3.Writer(writeStream, this._prefixes);

	writer.addTriples(triples);
	writer.end();

	writeStream.on('error', function (error) {console.log(error)} );
	writeStream.on('finish', function () {
		this._storage.addTriples(triples);
		return true;
	}.bind(this));
}

N3Storage.prototype.addList = function (subject, predicate, object) {
	var writeStream = fs.createWriteStream(this._storagePath, {'flags': 'a'});
	writeStream.write('\n', 'utf8');
	var writer = N3.Writer(writeStream, this._prefixes);

	var list = writer.list(object);
	writer.addTriples(subject, predicate, list);
	writer.end();

	writeStream.on('error', function (error) {console.log(error)} );
	writeStream.on('finish', function () {
		this._storage.addTriples(subject, predicate, list);
		return true;
	}.bind(this));
}

//isObject is a flag to specify if to remove whole object with this subject or just triple
N3Storage.prototype.removeTriples = function (subject, predicate, object, isObject) {
   	return this._traverseStorage({subject: subject, predicate: predicate, object: object}, removeTripleFn, {isObject: isObject});
}

//newValue is a new value for triple with subject and predicate
N3Storage.prototype.updateTriple = function (subject, predicate, object, newValue) {
	return this._traverseStorage({subject: subject, predicate: predicate, object: object}, updateTripleFn, {newValue: newValue});
}

N3Storage.prototype._traverseStorage = function (targetTriple, filterFn, opts) {
	var self = this;
	var tempStoragePath = self._storagePath + '_temp';
	fs.rename(self._storagePath, tempStoragePath, function () {
		var parser = N3.Parser();
		var writeStream = fs.createWriteStream(self._storagePath, {'flags': 'a'});
		var writer = N3.Writer(writeStream, self._prefixes);
		var rdfStream = fs.createReadStream(tempStoragePath);
		var triples = [];
		parser.parse(rdfStream, function (error, nextTriple, prefixes) {
		    if (error) {
		    	console.log(error);
		    }

		    if(nextTriple)
			{
				var filtered = filterFn(targetTriple, nextTriple, opts);
				if (filtered) { 
					triples.push(filtered);
				}
			} else {
				//finished, write to storage and close the stream
				writer.addTriples(triples);
				writer.end();
			}
	 	});
	 	writeStream.on('error', function (error) {
	 		console.log(error);
	 		fs.rename(tempStoragePath, self._storagePath, function (error) {
	 			console.log(error);
	 			fs.unlink(tempStoragePath, function(error) {
				  if (error) throw error;
				  console.log('Traversing failed. Removing temp folder.');
				});
	 		});
	 	});
	 	writeStream.on('finish', function () {
	 		fs.unlink(tempStoragePath, function (error) {
				if (error) throw error;
				console.log('Traversing finished. Removinng temp folder.');
				return true;
			});
	 	});
	});
};

N3Storage.prototype.getList = function (node, res) {
	var res = res || [];
	var list = this._storage.find(node);
	var firstVal = list[0].object;
	var restVal = list[1].object;
	res.push(firstVal);
	while(restVal !== vocabs.rdf.nil) {
		return this.getList(restVal, res);
	}
	return res;
};

////////////////////////
////// HELPERS /////////

function updateTripleFn (targetTriple, nextTriple, opts) {
	var resultTriple = null;
	if (!equel(targetTriple, nextTriple)){
    	resultTriple = nextTriple;
    } else {
    	var parseObject = nextTriple.object.split('#');
    	var length = parseObject.length;
    	parseObject[length - 1] = opts.newValue;
    	nextTriple.object = parseObject.join('#');
    	resultTriple = nextTriple;
    }
    return resultTriple;
}

function removeTripleFn (targetTriple, nextTriple, opts) {
	var resultTriple = null;
	if (opts.isObject) {
		if (nextTriple.subject !== targetTriple.subject){
	    	resultTriple = nextTriple;
	    }
	} else {
		if (!equel(targetTriple, nextTriple)) {
			resultTriple = nextTriple;
		}
	}
    return resultTriple;
}

function equel(first, next) {
	return (first.subject === next.subject) && (first.predicate === next.predicate) && (first.object === next.object);
}

////////////////////////
////// EXPORTS /////////

module.exports = {
		storage: new N3Storage()
	}