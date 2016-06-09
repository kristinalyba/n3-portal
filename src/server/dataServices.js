var studentService = require('./studentService');
var teacherService = require('./teacherService');
var subjectService = require('./subjectService');
var groupService   = require('./groupService');
var taskService    = require('./taskService');


module.exports = {
	students: studentService,
	teachers: teacherService,
	subjects: subjectService,
	groups: groupService,
	tasks: taskService
};