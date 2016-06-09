export class Home {
	configureRouter(config, router) {
	    config.map([
	      { route: ['', 'planned'], name: 'planned', moduleId: './planned', href: '#/home/planned'},
	      { route: 'schedule', name: 'schedule', moduleId: './schedule', href: '#/home/schedule'},
	      { route: 'updates', name: 'updates', moduleId: './updates', href: '#/home/updates'},
	      { route: 'notifications', name: 'notifications', moduleId: './notifications', href: '#/home/notifications'},
	    ]);
		this.router = router;
	}
}