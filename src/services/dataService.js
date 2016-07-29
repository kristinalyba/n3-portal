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
		return this.client.put('students?' + serialize(params));
	}

	updateStudent (params) {
		return this.client.post('students?' + encodeURIComponent(params));
	}

	deleteStudent (id) {
		return this.client.delete('students/' + encodeURIComponent(id));
	}

	// groups
	getGroup (id) {
		return this.client.get('groups/' + encodeURIComponent(id));
	}

	getGroups () {
		return this.client.get('groups');
	}

	//teachers
	getTeacher (id) {
		return this.client.get('teachers/' + encodeURIComponent(id));
	}

	getTeachers () {
		return this.client.get('teachers');
	}

	createTeacher (params) {
		return this.client.put('teachers?' + encodeURIComponent(params));
	}

	updateTeacher (params) {
		return this.client.post('teachers?' + encodeURIComponent(params));
	}

	deleteTeacher (id) {
		return this.client.delete('teachers/' + encodeURIComponent(id));
	}

	//subjects
	getSubject (id) {
		return this.client.get('subjects/' + encodeURIComponent(id));
	}

	getSubjects () {
		return this.client.get('subjects');
	}

	createSubject (params) {
		return this.client.put('subjects?' + encodeURIComponent(params));
	}

	updateSubject (params) {
		return this.client.post('subjects?' + encodeURIComponent(id));
	}

	deleteSubject (id) {
		return this.client.delete('subjects/' + encodeURIComponent(id));
	}

	//commomn

	getAllByType (type) {
		return this.client.get('getAllByType/' + encodeURIComponent(type));
	}

	getAllTypes () {
		return this.client.get('getAllTypes');
	}

}

function serialize (obj) {
  var str = [];
  for(var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}


