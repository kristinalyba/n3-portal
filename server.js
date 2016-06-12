var express 	= require('express');
var bodyParser  = require('body-parser');

var dataService = require('./src/server/dataServices');
var students    = dataService.students;
var groups      = dataService.groups;
var teachers    = dataService.teachers;
var subjects    = dataService.subjects;
var tasks       = dataService.tasks;
var fields       = dataService.fields;
var common       = dataService.common;

var app = express();

// ======= BASIC SETUP =========
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ type: 'application/*+json' }));

var port = process.env.PORT || 1112;

app.use(express.static('./'));

//TODO: tidy everything up: add result handling - status codes, check for req data, ...
// ======= APIs ================
var apiRouter = express.Router();

apiRouter.get('/', function(req, res) {
    res.json({ message: 'Hoorray! api is working!!!!'});   
});

// =========Common ============
apiRouter.route('/getAllByType/:type')
    .get(function(req, res) {
        var result = common.getByType(req.params.type);
        res.json(result);
    });

apiRouter.route('/getAllTypes')
    .get(function(req, res) {
        var result = common.getTypes();
        res.json(result);
    });
// ========= Groups ===========
apiRouter.route('/groups')
    .get(function(req, res) {
    	var result = groups.get();
    	res.json(result);
    })
    .put(function(req, res) {
		//if (!req.body) return res.sendStatus(400);
        var result = groups.add(req.query);
        res.json(result);
    });

apiRouter.route('/groups/:id')
    .post(function(req, res) {
    	//if (!req.body) return res.sendStatus(400);
       	var result = groups.update(req.params.id, req.query);
    	res.json(result);
    })
    .get(function(req, res) {
    	var result = groups.get(req.params.id);
    	res.json(result);
    })
    .delete(function(req, res) {
    	var result = groups.remove(req.params.id);
    	res.json({ message: 'Successfully deleted' });
    });

// ========= Fields ===========
apiRouter.route('/fields')
    .get(function(req, res) {
        var result = fields.get();
        res.json(result);
    })
    .put(function(req, res) {
        //if (!req.body) return res.sendStatus(400);
        var result = fields.add(req.query);
        res.json(result);
    });

apiRouter.route('/fields/:id')
    .get(function(req, res) {
        var result = fields.get(req.params.id);
        res.json(result);
    })
    .delete(function(req, res) {
        var result = fields.remove(req.params.id);
        res.json({ message: 'Successfully deleted' });
    });

// ========= Students ===========
apiRouter.route('/students')
    .get(function(req, res) {
    	var response = students.get();
    	res.json(response);
    })
    .put(function(req, res) {
		//if (!req.body) return res.sendStatus(400);
        var response = students.add(req.query);
        res.json(response);
    });


apiRouter.route('/students/:id')
    .post(function(req, res) {
    	console.log('REQUEST body ', req.body);
    	//if (!req.body) return res.sendStatus(400);
    	//change to use req.body
       	var result = students.update(req.params.id, req.query);
    	res.json(result);
    })
    .get(function(req, res) {
    	var result = students.get(req.params.id);
    	res.json(result);
    })
    .delete(function(req, res) {
    	students.remove({id: req.params.id});
    	res.json({ message: 'Successfully deleted' });
    });


// ========= Subjects ===========
apiRouter.route('/subjects')
    .get(function(req, res) {
    	var result = subjects.get();
    	res.json(result);
    })
    .put(function(req, res) {
		//if (!req.body) return res.sendStatus(400);
        var result = subjects.add(req.query);
        res.json(result);
    });

apiRouter.route('/subjects/:id')
    .post(function(req, res) {
    	//if (!req.body) return res.sendStatus(400);
       	var result = subjects.update(req.params.id, req.query);
    	res.json(result);
    })
    .get(function(req, res) {
    	var result = subjects.get(req.params.id);
    	res.json(result);
    })
    .delete(function(req, res) {
    	var result = subjects.remove(req.params.id);
    	res.json({ message: 'Successfully deleted' });
    });

// ========= Teachers ===========
apiRouter.route('/teachers')
    .get(function(req, res) {
    	var result = teachers.get();
    	res.json(result);
    })
    .put(function(req, res) {
		//if (!req.body) return res.sendStatus(400);
        var result = teachers.add(req.query);
        res.json(result);
    });

apiRouter.route('/teachers/:id')
    .post(function(req, res) {
    	//if (!req.body) return res.sendStatus(400);
       	var result = teachers.update(req.params.id, req.query);
    	res.json(result);
    })
    .get(function(req, res) {
    	var result = teachers.get(req.params.id);
    	res.json(result);
    })
    .delete(function(req, res) {
    	var result = teachers.remove(req.params.id);
    	res.json({ message: 'Successfully deleted' });
    });


app.use('/api', apiRouter);

// ======== SERVER START ===============

var server = app.listen(port, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log("App listening at http://%s:%s", host, port);
});

