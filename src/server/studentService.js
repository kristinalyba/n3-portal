var n3storage    = require('../storage/n3storage').storage;
var N3Util       = require('N3').Util;

var helpers      = require('./helpers');
var getValue     = helpers.getValue;
var createTriple = helpers.createTriple;
var generateUri  = helpers.generateUri;

var vocabs       = require('linkeddata-vocabs');
var custom       = require('./customVocab');
var rdf          = vocabs.rdf;

function StudentService () {
    this._storage = n3storage;
}

StudentService.prototype.add = function (params) {
    var triples = this._composeTriples(null, params);
    return this._storage.addTriples(triples);
}

StudentService.prototype.get = function (id) {
    return id ? this._findById(id) : this._findAll();
}

StudentService.prototype.remove = function (id) {
    return this._storage.removeTriples(id, null, null, true);
}

StudentService.prototype.update = function (id, params) {
    var triples = this._composeTriples(id, params);
    return this._storage.updateTriples(triples);
}

StudentService.prototype._findById = function (id) {
    var matchingTriples = this._storage.find(id, null, null);
    return this._composeInstance(id, matchingTriples);
}

StudentService.prototype._findAll = function () {
    var matchingTriples = this._storage.find(null, rdf.type, custom.get('Student'));
    var students = [];
    matchingTriples.forEach(function (triple) {
        students.push(this._findById(triple.subject));
    }.bind(this));
    return students;
}

StudentService.prototype._composeInstance = function (id, triples) {
    var student = {};
    student.id = id;
    triples.forEach(function (triple) {
        switch (triple.predicate) {
            case custom.get('firstName'):
                student.firstName = getValue(triple.object);
                break;

            case custom.get('lastName'):
                student.lastName = getValue(triple.object);
                break;

            case custom.get('fullName'):
                student.fullName = getValue(triple.object);
                break;

            case custom.get('dateOfBirth'):
                student.dateOfBirth = getValue(triple.object);
                break;

            case custom.get('mobilePhone'):
                student.mobilePhone = getValue(triple.object);
                break;

            case custom.get('email'):
                student.email = getValue(triple.object);
                break;

            case custom.get('belongsToGroup'):
                student.groupName = triple.object;
                break;
        }
    });
    return student;
}

StudentService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri(params.firstName + params.lastName);
    triples.push(createTriple(uniqueUri, rdf.type, custom.get('Student')));
    triples.push(createTriple(uniqueUri, custom.get('fullName'), params.firstName + ' ' + params.lastName));

    if (params.firstName) {
        triples.push(createTriple(uniqueUri, custom.get('firstName'), N3Util.createLiteral(params.firstName)));
    }
    if (params.lastName) {
        triples.push(createTriple(uniqueUri, custom.get('lastName'), N3Util.createLiteral(params.lastName)));
    }
    if (params.dateOfBirth) {
        triples.push(createTriple(uniqueUri, custom.get('dateOfBirth'), N3Util.createLiteral(params.dateOfBirth)));
    }
    if (params.mobilePhone) {
        triples.push(createTriple(uniqueUri, custom.get('mobilePhone'), N3Util.createLiteral(params.mobilePhone)));
    }
    if (params.email) {
        triples.push(createTriple(uniqueUri, custom.get('email'), N3Util.createLiteral(params.email)));
    }
    if (params.belongsToGroup) {
        triples.push(createTriple(uniqueUri, custom.get('belongsToGroup'), params.belongsToGroup));
    }
    if (params.studies) {
        triples.push(createTriple(uniqueUri, custom.get('studies'), N3Util.createLiteral(params.studies)));
    }

    return triples;
};

module.exports = new StudentService();