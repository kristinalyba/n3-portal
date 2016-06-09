export class Student {
	constructor() {
		this.data = {};

	}
	activate (params) {
		// handle editing or create new student modes
		this.data.groupId = params.groupId;
		this.data.edit = params.edit;
	}
}