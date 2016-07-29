export class App {
  configureRouter(config, router) {
    config.title = 'Teacher\'s Portal';
    config.map([
      { route: ['','home'], name: 'home', moduleId: 'home/home', nav: true, title:'Home' },
      { route: 'groups', name: 'groups', moduleId: 'groups/groups', nav: true, title:'Groups' },
      { route: 'teachers', name: 'teachers', moduleId: 'teachers/teachers', nav: true, title:'Teachers' },
      { route: 'subjects', name: 'subjects', moduleId: 'subjects/subjects', nav: true, title:'Subjects' },
      { route: 'search', name: 'search', moduleId: 'search/search', nav: true, title:'Search' },
      { route: 'login', name: 'login', moduleId: 'login/login' },
      { route: 'student', name: 'student', moduleId: 'students/student' },
      { route: 'teacher', name: 'teacher', moduleId: 'teachers/teacher' },
      { route: 'group', name: 'group', moduleId: 'groups/group' }
    ]);

    this.router = router;
  }
}