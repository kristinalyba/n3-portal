var studentService = require('./studentService');
var teacherService = require('./teacherService');
var subjectService = require('./subjectService');
var groupService   = require('./groupService');
var fieldService   = require('./fieldService');

module.exports = {
	students: studentService,
	teachers: teacherService,
	subjects: subjectService,
	groups: groupService,
	fields: fieldService
};