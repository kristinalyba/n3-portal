import {HttpClient} from 'aurelia-http-client';

export class DataService {
	constructor () {
		this.client = new HttpClient()
		.configure(x => {
		    x.withBaseUrl('api/');
		  });
		}

	// students
	getStudent (id) {
		return this.client.get('students/' + id);
	}

	getStudents () {
		return this.client.get('students');
	}

	createStudent (params) {
		return this.client.put('students?firstName=Allo&lastName=Garaj&mobilePhone=kuku');
	}

	updateStudent (params) {
		return this.client.post(params);
	}

	deleteStudent (id) {
		return this.client.delete(id);
	}

	// groups
	getGroup (id) {
		return this.client.get('groups/' + id);
	}

	getGroups () {
		return this.client.get('groups');
	}

	createGroup () {

	}

	updateGroup () {

	}

	delereGroup () {

	}

}



