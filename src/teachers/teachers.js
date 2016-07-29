import {inject} from 'aurelia-framework';
import {DataService} from '../services/dataService';
import {Router} from 'aurelia-router';

@inject(DataService, Router)
export class Teachers {
	constructor(dataService, router) {
		this.name = 'Teachers';
		this.dataService = dataService;
		this.router = router;
	}

	activate() {
		this.dataService.getTeachers().then(res => {
			var teachers = JSON.parse(res.response);
			teachers.sort(function(a,b) {return (a.lastName > b.lastName) ? 1 : ((b.lastName > a.lastName) ? -1 : 0);} );
			this.teachers = teachers;
		});
	}

	remove(id) {
		this.dataService.removeTeacher(id);
	};

	navigateToTeacher(id, editMode) {
		this.router.navigateToRoute('teacher', {id: id, edit: editMode});
	}
}