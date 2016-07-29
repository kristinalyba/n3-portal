import {inject} from 'aurelia-framework';
import {DataService} from '../services/dataService';
import {Router} from 'aurelia-router';

@inject(DataService, Router)
export class Student {
	constructor(dataService, router) {
		this.dataService = dataService;
		this.router = router;
		this.formData = {};
	}

	activate (params) {
		// handle editing or create new student modes
		this.dataService.getAllByType('Group').then(res => {
			this.groups = JSON.parse(res.response);
		});
	}

	addStudent () {
		var data = {};
		if (this.formData.firstName) {
			data.firstName = this.formData.firstName;
		}		
		if (this.formData.lastName) {
			data.lastName = this.formData.lastName;
		}		
		if (this.formData.dateOfBirth) {
			data.dateOfBirth = this.formData.dateOfBirth;
		}		
		if (this.formData.mobilePhone) {
			data.mobilePhone = this.formData.mobilePhone;
		}		
		if (this.formData.email) {
			data.email = this.formData.email;
		}
		if (this.formData.belongsToGroup) {
			data.belongsToGroup = this.formData.belongsToGroup;
		}
		this.dataService.createStudent(this.formData);
		this.router.navigateToRoute('groups');
	}
}