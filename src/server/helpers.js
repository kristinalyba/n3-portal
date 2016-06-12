var N3Util = require('N3').Util;
var customVocabulary = require('./customVocab')

module.exports = {
	getValue: getValue,
	createTriple: createTriple,
	generateUri: generateUri,
	getTypeUri: getTypeUri
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

function getTypeUri (type) {
	if(type.indexOf('#') > -1) {
		console.log('returned');
		return type;
	}

	var typeUri = type;
	Object.keys(customVocabulary).forEach( function (vocabName) {
		var vocab = customVocabulary[vocabName];
		if (vocab[type]) {
			typeUri = vocab[type];
		}
	});

	return typeUri;
}