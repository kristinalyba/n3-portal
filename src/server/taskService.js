var n3storage    = require('../storage/n3storage').storage;
var N3Util       = require('N3').Util;

var helpers      = require('./helpers');
var getValue     = helpers.getValue;
var createTriple = helpers.createTriple;
var generateUri  = helpers.generateUri;

var vocabs       = require('linkeddata-vocabs');
var custom       = require('./customVocab');
var rdf          = vocabs.rdf;

function TaskService () {
    this._storage = n3storage;
}

TaskService.prototype.add = function (params) {
    var triples = this._composeTriples(null, params);
    return this._storage.addTriples(triples);
}

TaskService.prototype.get = function (id) {
    return id ? this._findById(id) : this._findAll();
}

TaskService.prototype.remove = function (id) {
    return this._storage.removeTriples(id, null, null, true);
}

TaskService.prototype.update = function (id, params) {
    var triples = this._composeTriples(id, params);
    return this._storage.updateTriples(triples);
}

TaskService.prototype._findById = function (id) {
    var matchingTriples = this._storage.find(id, null, null);
    return this._composeInstance(id, matchingTriples);
}

TaskService.prototype._findAll = function () {
    var matchingTriples = this._storage.find(null, rdf.type, custom.get('Task'));
    var tasks = [];
    matchingTriples.forEach(function (triple) {
        tasks.push(this._findById(triple.subject));
    }.bind(this));
    return tasks;
}

TaskService.prototype._composeInstance = function (id, triples) {
    var task = {};
    task.id = id;
    triples.forEach(function (triple) {
        switch (triple.predicate) {
            case custom.get('name'):
                task.name = getValue(triple.object);
                break;	

            case custom.get('type'):
                task.type = getValue(triple.object);
                break;

            case custom.get('grade'):
                task.grade = getValue(triple.object);
                break;
        }
    });
    return student;
}

TaskService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri(params.name);
    triples.push(createTriple(uniqueUri, rdf.type, custom.get('Task')));

    if (params.name) {
        triples.push(createTriple(uniqueUri, custom.get('name'), N3Util.createLiteral(params.name)));
    }
    if (params.type) {
        triples.push(createTriple(uniqueUri, custom.get('type'), N3Util.createLiteral(params.type)));
    }
    if (params.grade) {
        triples.push(createTriple(uniqueUri, custom.get('grade'), params.grade));
    }

    return triples;
};

module.exports = new TaskService();