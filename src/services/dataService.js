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
		return this.client.get('students/' + encodeURIComponent(id));
	}

	getStudents () {
		return this.client.get('students');
	}

	createStudent (params) {
		return this.client.put('students?firstName=Allo&lastName=Garaj&mobilePhone=kuku');
	}

	updateStudent (params) {
		return this.client.post(encodeURIComponent(id));
	}

	deleteStudent (id) {
		return this.client.delete(encodeURIComponent(id));
	}

	// groups
	getGroup (id) {
		return this.client.get('groups/' + encodeURIComponent(id));
	}

	getGroups () {
		return this.client.get('groups');
	}

	getAllByType (type) {
		return this.client.get('getAllByType/' + encodeURIComponent(type));
	}

	getAllTypes () {
		return this.client.get('getAllTypes');
	}

	createGroup () {

	}

	updateGroup () {

	}

	delereGroup () {

	}

}



