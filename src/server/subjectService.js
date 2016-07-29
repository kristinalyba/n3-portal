var n3storage    = require('../storage/n3storage');
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
    return this._storage.addTriples('subjects', triples);
}

SubjectService.prototype.get = function (id) {
    return id ? this._findById(id) : this._findAll();
}

SubjectService.prototype.remove = function (id) {
    return this._storage.removeTriples('subjects', id, null, null, true);
}

SubjectService.prototype.update = function (id, params) {
    var triples = this._composeTriples(id, params);
    return this._storage.updateTriples('subjects', triples);
}

SubjectService.prototype._findById = function (id) {
    var matchingTriples = this._storage.find(id, null, null);
    return this._composeInstance(id, matchingTriples);
}

SubjectService.prototype._findAll = function () {
    var matchingTriples = this._storage.find(null, rdf.type, custom.subject.Subject);
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
            case custom.subject.name:
                subject.name = getValue(triple.object);
                break;

            case custom.subject.field:
                subject.field = triple.object;
                break;
        }
    });
    return subject;
}

SubjectService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri('student#', params.name);
    triples.push(createTriple(uniqueUri, rdf.type, custom.subject.Subject));

    if (params.name) {
        triples.push(createTriple(uniqueUri, custom.subject.name, N3Util.createLiteral(params.name)));
    }
    if (params.field) {
        triples.push(createTriple(uniqueUri, custom.subject.field, N3Util.createLiteral(params.field)));
    }

    return triples;
};

module.exports = new SubjectService();