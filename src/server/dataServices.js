var studentService = require('./studentService');
var teacherService = require('./teacherService');
var subjectService = require('./subjectService');
var groupService   = require('./groupService');
var fieldService   = require('./fieldService');

var n3storage      = require('../storage/n3storage');
var getTypeUri     = require('./helpers').getTypeUri;

function CommonData() {
	this._storage = n3storage;
	this.getByType = function (type) {
		return this._storage
			.findByType(getTypeUri(type))
			.map(function (triple) {
				return triple.subject;
				});
	};
	this.getTypes = function () {
		return this._storage
		.getTypes()
		.map(function (triple) {
				return triple.subject;
			});
	}

}

module.exports = {
	students: studentService,
	teachers: teacherService,
	subjects: subjectService,
	groups: groupService,
	fields: fieldService,
	common: new CommonData()
};

