var n3storage    = require('../storage/n3storage');
var N3Util       = require('N3').Util;

var helpers      = require('./helpers');
var getValue     = helpers.getValue;
var createTriple = helpers.createTriple;
var generateUri  = helpers.generateUri;

var vocabs       = require('linkeddata-vocabs');
var custom       = require('./customVocab');
var rdf          = vocabs.rdf;

function FieldService () {
    this._storage = n3storage;
}

FieldService.prototype.add = function (params) {
    var triples = this._composeTriples(null, params);
    return this._storage.addTriples('fields', triples);
}

FieldService.prototype.get = function (id) {
    return id ? this._findById(id) : this._findAll();
}

FieldService.prototype.remove = function (id) {
    return this._storage.removeTriples('fields', id, null, null, true);
}

FieldService.prototype._findById = function (id) {
    var matchingTriples = this._storage.find(id, null, null);
    return this._composeInstance(id, matchingTriples);
}

FieldService.prototype._findAll = function () {
    var matchingTriples = this._storage.find(null, rdf.type, custom.field.Field);
    var fields = [];
    matchingTriples.forEach(function (triple) {
        fields.push(this._findById(triple.subject));
    }.bind(this));
    return fields;
}

FieldService.prototype._composeInstance = function (id, triples) {
    var field = {};
    field.id = id;
    triples.forEach(function (triple) {
        if (triple.predicate === custom.field.name) {
            field.name = getValue(triple.object);
        }
    });
    return field;
}

FieldService.prototype._composeTriples = function(id, params) {
    var triples = [];
    var uniqueUri = id || generateUri(params.name);
    triples.push(createTriple(uniqueUri, rdf.type, custom.field.Field));

    if (params.name) {
        triples.push(createTriple(uniqueUri, custom.field.name, N3Util.createLiteral(params.name)));
    }
    return triples;
};

module.exports = new FieldService();