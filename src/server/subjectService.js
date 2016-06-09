var n3storage    = require('../storage/n3storage').storage;
var N3Util       = require('N3').Util;

var helpers      = require('./helpers');
var getValue     = helpers.getValue;
var createTriple = helpers.createTriple;
var generateUri  = helpers.generateUri;

var vocabs       = require('linkeddata-vocabs');
var custom       = require('./customVocab');
var rdf          = vocabs.rdf;

function SubjectService () {
    this._storage = n3storage;
}

SubjectService.prototype.add = function (params) {
    var triples = this._composeTriples(null, params);
    return this._storage.addTriples(triples);
}

SubjectService.prototype.get = function (id) {
    return id ? this._findById(id) : this._findAll();
}

SubjectService.prototype.remove = function (id) {
    return this._storage.removeTriples(id, null, null, true);
}

SubjectService.prototype.update = function (id, params) {
    var triples = this._composeTriples(id, params);
    return this._storage.updateTriples(triples);
}

SubjectService.prototype._findById = function (id) {
    var matchingTriples = this._storage.find(id, null, null);
    return this._composeInstance(id, matchingTriples);
}

SubjectService.prototype._findAll = function () {
    var matchingTriples = this._storage.find(null, rdf.type, custom.get('Subject'));
    var subjects = [];
    matchingTriples.forEach(function (triple) {
        subjects.push(this._findById(triple.subject));
    }.bind(this));
    return subjects;
}

SubjectService.prototype._composeInstance = function (id, triples) {
    var subject = {};
    subject.id = id;
    triples.forEach(function (triple) {
        switch (triple.predicate) {
            case custom.get('name'):
                subject.name = getValue(triple.object);
                break;

            case custom.get('task'):
                subject.task = getValue(triple.object);
                break;

            case custom.get('teacher'):
                subject.teacher = getValue(triple.object);
                break;
        }
    });
    return student;
}

SubjectService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri(params.name);
    triples.push(createTriple(uniqueUri, rdf.type, custom.get('Subject')));

    if (params.name) {
        triples.push(createTriple(uniqueUri, custom.get('name'), N3Util.createLiteral(params.name)));
    }
    if (params.task) {
        triples.push(createTriple(uniqueUri, custom.get('task'), N3Util.createLiteral(params.task)));
    }
    if (params.teacher) {
        triples.push(createTriple(uniqueUri, custom.get('teacher'), params.teacher));
    }

    return triples;
};

module.exports = new SubjectService();