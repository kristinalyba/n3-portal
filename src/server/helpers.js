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

//assume this is unique :)
//TODO: Make it unique
function generateUri(data) {
	return '#' + data + '123';
}