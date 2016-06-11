var N3            = require('N3');
var fs            = require('fs');
var replaceStream = require('replacestream');
var vocabs        = require('linkeddata-vocabs');
var path          = require('path');

var FIELD_PREFIX        = 'field#';
var GROUP_PREFIX        = 'group#';
var STUDENT_PREFIX      = 'student#';
var SUBJECT_PREFIX      = 'subject#';
var TEACHER_PREFIX      = 'teacher#';
var CUSTOM_VOCAB_PREFIX = 'vocab#';


function N3Storage () {
    this._storage = N3.Store();
    this._prefixes = { prefixes: {
        field: FIELD_PREFIX,
        group: GROUP_PREFIX,
        student: STUDENT_PREFIX,
        subject: SUBJECT_PREFIX,
        teacher: TEACHER_PREFIX,
        vocab: CUSTOM_VOCAB_PREFIX,
        rdfs: vocabs.rdf,
        xsd: vocabs.xsd,
        rdf: vocabs.rdf,
        owl: vocabs.owl
    }};

    this._initStorage();
};

N3Storage.prototype._initStorage = function () {
    var self = this;
    self._entities = {
        'students': path.join(__dirname + '/student.n3'),
        'fields': path.join(__dirname + '/field.n3'),
        'subjects': path.join(__dirname + '/subject.n3'),
        'groups': path.join(__dirname + '/group.n3'),
        'teachers': path.join(__dirname + '/teacher.n3'),
        'vocab': path.join(__dirname + '/vocabulary.n3')
    };

    var parser = N3.Parser();

    //parse all entity storages to Storage graph in memory
    Object.keys(self._entities).forEach(function (entityName) {
        var rdfStream = fs.createReadStream(self._entities[entityName]);

        parser.parse(rdfStream, function (error, triple, prefixes) {
            if (error) {
                console.log(error);
            }

            if(triple)
            {
                self._storage.addTriple(triple.subject, triple.predicate, triple.object);
                console.log(triple);
            }
        });
    });
};

N3Storage.prototype.find = function (subject, predicate, object) {
    return this._storage.find(subject, predicate, object);
};

N3Storage.prototype.addTriples = function (entityName, triples) {
    var writeStream = fs.createWriteStream(this._entities[entityName], {'flags': 'a'});
    writeStream.write('\n', 'utf8');
    var writer = N3.Writer(writeStream, this._prefixes);

    writer.addTriples(triples);
    writer.end();

    writeStream.on('error', function (error) {console.log(error)} );
    writeStream.on('finish', function () {
        this._storage.addTriples(triples);
        return true;
    }.bind(this));
};

N3Storage.prototype.addList = function (entityName, subject, predicate, object) {
    var writeStream = fs.createWriteStream(this._entities[entityName], {'flags': 'a'});
    writeStream.write('\n', 'utf8');
    var writer = N3.Writer(writeStream, this._prefixes);

    var list = writer.list(object);
    writer.addTriples(subject, predicate, list);
    writer.end();

    writeStream.on('error', function (error) {console.log(error)} );
    writeStream.on('finish', function () {
        this._storage.addTriples(subject, predicate, list);
        return true;
    }.bind(this));
};

//isObject is a flag to specify if to remove whole object with this subject or just triple
N3Storage.prototype.removeTriples = function (entityName, subject, predicate, object, isObject) {
    return this._traverseStorage(entityName, {subject: subject, predicate: predicate, object: object}, removeTripleFn, {isObject: isObject});
};

//newValue is a new value for triple with subject and predicate
N3Storage.prototype.updateTriple = function (entityName, subject, predicate, object, newValue) {
    return this._traverseStorage(entityName, {subject: subject, predicate: predicate, object: object}, updateTripleFn, {newValue: newValue});
};

N3Storage.prototype._traverseStorage = function (entityName, targetTriple, filterFn, opts) {
    var self = this;
    var tempStoragePath = self._entities[entityName] + '_temp';
    fs.rename(self._entities[entityName], tempStoragePath, function () {
        var parser = N3.Parser();
        var writeStream = fs.createWriteStream(self._entities[entityName], {'flags': 'a'});
        var writer = N3.Writer(writeStream, self._prefixes);
        var rdfStream = fs.createReadStream(tempStoragePath);
        var triples = [];
        parser.parse(rdfStream, function (error, nextTriple, prefixes) {
            if (error) {
                console.log(error);
            }

            if(nextTriple)
            {
                var filtered = filterFn(targetTriple, nextTriple, opts);
                if (filtered) { 
                    triples.push(filtered);
                }
            } else {
                //finished, write to storage and close the stream
                writer.addTriples(triples);
                writer.end();
            }
        });
        writeStream.on('error', function (error) {
            console.log(error);
            fs.rename(tempStoragePath, self._entities[entityName], function (error) {
                console.log(error);
                fs.unlink(tempStoragePath, function(error) {
                  if (error) throw error;
                  console.log('Traversing failed. Removing temp folder.');
                });
            });
        });
        writeStream.on('finish', function () {
            fs.unlink(tempStoragePath, function (error) {
                if (error) throw error;
                console.log('Traversing finished. Removinng temp folder.');
                return true;
            });
        });
    });
};

N3Storage.prototype.getList = function (node, res) {
    var res = res || [];
    var list = this._storage.find(node);
    var firstVal = list[0].object;
    var restVal = list[1].object;
    res.push(firstVal);
    while(restVal !== vocabs.rdf.nil) {
        return this.getList(restVal, res);
    }
    return res;
};
//////////////////////////
/////Reasoning methods////

N3Storage.prototype.isOfType = function (subject, type) {
    var self = this;
    var findType = self._storage.find(subject, vocabs.rdf.type, null);
    var nodeType = findType.length && findType[0].object;

    var inherits =
        subject === type ||
        nodeType === type ||
        self._storage.find(subject, vocabs.rdfs.subClassOf, type).length > 0;

    if (!nodeType && !inherits) {
        return false;
    }

    return inherits || self.isOfType(nodeType, type);
};

N3Storage.prototype.findByType = function (type) {
    var self = this;
    return self._storage.find(null, vocabs.rdf.type)
        .filter(function (triple) {
            return triple.object !== vocabs.owl.Class && self.isOfType(triple.subject, type);
        });
}


////////////////////////
////// HELPERS /////////

function updateTripleFn (targetTriple, nextTriple, opts) {
    var resultTriple = null;
    if (!equel(targetTriple, nextTriple)){
        resultTriple = nextTriple;
    } else {
        var parseObject = nextTriple.object.split('#');
        var length = parseObject.length;
        parseObject[length - 1] = opts.newValue;
        nextTriple.object = parseObject.join('#');
        resultTriple = nextTriple;
    }
    return resultTriple;
}

function removeTripleFn (targetTriple, nextTriple, opts) {
    var resultTriple = null;
    if (opts.isObject) {
        if (nextTriple.subject !== targetTriple.subject){
            resultTriple = nextTriple;
        }
    } else {
        if (!equel(targetTriple, nextTriple)) {
            resultTriple = nextTriple;
        }
    }
    return resultTriple;
}

function equel(first, next) {
    return (first.subject === next.subject) && (first.predicate === next.predicate) && (first.object === next.object);
}

////////////////////////
////// EXPORTS /////////

module.exports = new N3Storage();