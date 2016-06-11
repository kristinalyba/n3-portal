module.exports = {
	field: {
		Field: get('field', 'Field'),
		name: get('field', 'name')
	},
	group: {
		Group: get('group', 'Group'),
		name: get('group', 'name'),
		yearStarted: get('group', 'yearStarted'),
		curator: get('group', 'curator'),
		students: get('group', 'students'),
		subjects: get('group', 'subjects')
	},
	student: {
		Student: get('student', 'Student'),
		belongsToGroup: get('student', 'belongsToGroup')
	},
	subject: {
		Subject: get('subject', 'Subject'),
		name: get('subject', 'name'),
		field: get('subject', 'field')
	},
	teacher: {
		Teacher: get('teacher', 'Teacher'),
		teachesSubject: get('teacher', 'teachesSubject'),
		title: get('teacher', 'title')
	},
	vocab: {
		Person: get('vocab', 'Person'),
		firstName: get('vocab', 'firstName'),
		lastName: get('vocab', 'lastName'),
		fullName: get('vocab', 'fullName'),
		dateOfBirth: get('vocab', 'dateOfBirth'),
		mobilePhone: get('vocab', 'mobilePhone'),
		email: get('vocab', 'email')
	}

}

function get(vocab, entity) {
	return vocab + '#' + entity;
}
