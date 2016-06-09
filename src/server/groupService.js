var n3storage      = require('../storage/n3storage').storage;
var N3Util         = require('N3').Util;
var studentService = require('./studentService');

var helpers      = require('./helpers');
var getValue     = helpers.getValue;
var createTriple = helpers.createTriple;
var generateUri  = helpers.generateUri;

var vocabs       = require('linkeddata-vocabs');
var custom       = require('./customVocab');
var rdf          = vocabs.rdf;

function GroupService () {
	this._storage = n3storage;
}

GroupService.prototype.add = function (params) {
	var triples = this._composeTriples(null, params);
	return this._storage.addTriples(triples);
}

GroupService.prototype.get = function (id) {
	return id ? this._findById(id) : this._findAll();
}

GroupService.prototype.remove = function (id) {
	return this._storage.removeTriples(id, null, null, true);
}

GroupService.prototype.update = function (id, params) {
    var triples = this._composeTriples(id, params);
    //special case for groups - it is a list
    if(params.students) {
        this._storage.removeTriples(id, custom.get('studends'), null, false);
        this._storage.addList(id, custom.get('students'), params.students);
    }
    return this._storage.updateTriples(triples);
}

GroupService.prototype._findById = function (id) {
	var matchingTriples = this._storage.find(id, null, null);
	return this._composeInstance(id, matchingTriples);
}

GroupService.prototype._findAll = function () {
	var matchingTriples = this._storage.find(null, rdf.type, custom.get('Group'));
	var groups = [];
	matchingTriples.forEach(function (triple) {
		groups.push(this._findById(triple.subject));
	}.bind(this));
	return groups;
}

GroupService.prototype._composeInstance = function (id, triples) {
	var self = this;
	var group = {};
	group.id = id;
	triples.forEach(function (triple) {
		switch (triple.predicate) {
			case custom.get('name'):
				group.name = getValue(triple.object);
				break;

			case custom.get('yearStarted'):
				group.yearStarted = getValue(triple.object);
				break;

			case custom.get('curator'):
				group.curator = getValue(triple.object);
				break;

			case custom.get('students'):
				group.students = self._fillStudentsList(triple.object);
				break;

			case custom.get('subjects'):
				group.subjects = self._storage.getList(triple.object);
				break;
		}
	});
	return group;
}

GroupService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri(params.name);
    triples.push(createTriple(uniqueUri, rdf.type, custom.get('Group')));

    if (params.name) {
        triples.push(createTriple(uniqueUri, custom.get('name'), N3Util.createLiteral(params.name)));
    }
    if (params.yearStarted) {
        triples.push(createTriple(uniqueUri, custom.get('yearStarted'), N3Util.createLiteral(params.yearStarted)));
    }
    if (params.curator) {
        triples.push(createTriple(uniqueUri, custom.get('curator'), params.curator));
    }
    return triples;
};

GroupService.prototype._fillStudentsList = function (nodeUri) {
	var list = this._storage.getList(nodeUri);
	var students = [];
	list.forEach(function (studentUri) {
		students.push(studentService.get(studentUri));
	});
	return students;
}

module.exports = new GroupService();