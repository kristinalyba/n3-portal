import {inject} from 'aurelia-framework';
import {DataService} from '../services/dataService';

@inject(DataService)
export class Search {
	constructor(dataService) {
		this.name = 'Groups';
		this.dataService = dataService;
		this.type = 'Search by type';
		this.searchPattern = '';
	}
	activate (params) {
		this.dataService.getAllTypes().then(res => {
			this.types = JSON.parse(res.response);
		});
	}

	searchByType (type) {
		this.type = type;
		this.dataService.getAllByType(type).then(res => {
			this.searchList = JSON.parse(res.response);
		});
	}
}
