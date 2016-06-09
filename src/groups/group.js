export class Group {
	constructor () {
		this.editMode = false;
	}

	activate (params) {
		this.editMode = params.edit;
	}
}