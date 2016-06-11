var n3storage    = require('../storage/n3storage');
var N3Util       = require('N3').Util;

var helpers      = require('./helpers');
var getValue     = helpers.getValue;
var createTriple = helpers.createTriple;
var generateUri  = helpers.generateUri;

var vocabs       = require('linkeddata-vocabs');
var custom       = require('./customVocab');
var rdf          = vocabs.rdf;

function TeacherService () {
    this._storage = n3storage;
}

TeacherService.prototype.add = function (params) {
    var triples = this._composeTriples(null, params);
    return this._storage.addTriples('teachers', triples);
}

TeacherService.prototype.get = function (id) {
    return id ? this._findById(id) : this._findAll();
}

TeacherService.prototype.remove = function (id) {
    return this._storage.removeTriples('teachers', id, null, null, true);
}

TeacherService.prototype.update = function (id, params) {
    var triples = this._composeTriples('teachers', id, params);
    return this._storage.updateTriples(triples);
}

TeacherService.prototype._findById = function (id) {
    var matchingTriples = this._storage.find(id, null, null);
    return this._composeInstance(id, matchingTriples);
}

TeacherService.prototype._findAll = function () {
    var matchingTriples = this._storage.find(null, rdf.type, custom.teacher.Teacher);
    var teachers = [];
    matchingTriples.forEach(function (triple) {
        teachers.push(this._findById(triple.subject));
    }.bind(this));
    return teachers;
}

TeacherService.prototype._composeInstance = function (id, triples) {
    var teacher = {};
    teacher.id = id;
    triples.forEach(function (triple) {
        switch (triple.predicate) {
            case custom.vocab.firstName:
                teacher.firstName = getValue(triple.object);
                break;

            case custom.vocab.lastName:
                teacher.lastName = getValue(triple.object);
                break;

            case custom.vocab.fullName:
                teacher.fullName = getValue(triple.object);
                break;

            case custom.vocab.dateOfBirth:
                teacher.dateOfBirth = getValue(triple.object);
                break;

            case custom.vocab.mobilePhone:
                teacher.mobilePhone = getValue(triple.object);
                break;

            case custom.vocab.email:
                teacher.email = getValue(triple.object);
                break;

            case custom.teacher.teachesSubject:
                teacher.teachesSubject = triple.object;
                break;

            case custom.teacher.title:
                teacher.title = triple.object;
                break;
        }
    });
    return teacher;
}

TeacherService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri(params.firstName + params.lastName);
    triples.push(createTriple(uniqueUri, rdf.type, custom.teacher.Teacher));
    triples.push(createTriple(uniqueUri, custom.vocab.fullName, params.firstName + ' ' + params.lastName));

    if (params.firstName) {
        triples.push(createTriple(uniqueUri, custom.vocab.firstName, N3Util.createLiteral(params.firstName)));
    }
    if (params.lastName) {
        triples.push(createTriple(uniqueUri, custom.vocab.lastName, N3Util.createLiteral(params.lastName)));
    }
    if (params.dateOfBirth) {
        triples.push(createTriple(uniqueUri, custom.vocab.dateOfBirth, N3Util.createLiteral(params.dateOfBirth)));
    }
    if (params.mobilePhone) {
        triples.push(createTriple(uniqueUri, custom.vocab.mobilePhone, N3Util.createLiteral(params.mobilePhone)));
    }
    if (params.email) {
        triples.push(createTriple(uniqueUri, custom.vocab.email, N3Util.createLiteral(params.email)));
    }
    if (params.teachesSubject) {
        triples.push(createTriple(uniqueUri, custom.teacher.teachesSubject, params.teachesSubject));
    }
    if (params.title) {
        triples.push(createTriple(uniqueUri, custom.teacher.title, N3Util.createLiteral(params.title)));
    }

    return triples;
};

module.exports = new TeacherService();