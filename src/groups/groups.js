import {inject} from 'aurelia-framework';
import {DataService} from '../services/dataService';
import {Router} from 'aurelia-router';

@inject(DataService, Router)
export class Groups {
	constructor(dataService, router) {
		this.name = 'Groups';
		this.dataService = dataService;
		this.router = router;
		this.activeId = '';
	}

	activate() {
		this.dataService.getGroups().then(res => {
			var groups = JSON.parse(res.response);
			var promises = {};
			groups.sort(function(a,b) {return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);} );
			this.groups = groups;
			this.group = this.groups.length ? this.groups[0] : {};
			this.activeId = this.group.id;
		});
	}

	showGroup(id) {
		this.group = this.groups.find(group => group.id === id);
		this.activeId = this.group.id;
	};

	navigateToStudent(editMode) {
		this.router.navigateToRoute('student', {groupId: this.group.id, edit: editMode});
	}

	navigateToGroup(editMode) {
		this.router.navigateToRoute('group', {groupId: this.group.id, edit: editMode});
	}
}