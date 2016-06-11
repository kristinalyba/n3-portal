var N3Util = require('N3').Util;

module.exports = {
	getValue: getValue,
	createTriple: createTriple,
	generateUri: generateUri
};

function getValue(uri) {
	var value = null;
	if (N3Util.isLiteral(uri)) {
		value = N3Util.getLiteralValue(uri);
	}
	return value;
}

function createTriple(subject, predicate, object) {
	return {
		subject: subject,
		predicate: predicate,
		object: object
	}
};


function generateUri(prefix, data) {
	return prefix + data + guid();
}

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}