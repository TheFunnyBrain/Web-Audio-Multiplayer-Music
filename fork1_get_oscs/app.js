var mongojs = require("mongojs");
var db = mongojs('localhost:27017/myGame', ['account','progress']);

var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started.");

var SOCKET_LIST = {};

var seq = [
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
];	
var newseq;

var Entity = function(){
	var self = {
		x:250,
		y:250,
		waveType:"sine",
		currentNote:0,
		spdX:0,
		spdY:0,
		id:"",
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updateWaveType = function(){
		self.waveType = "";
	}
	self.updateNoteChoice = function() {
		self.currentNote = 0;
	}
	self.updatePosition = function(){
		self.x += self.spdX;
		self.y += self.spdY;
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}
	return self;
}

var Player = function(id){
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		
		if(self.pressingAttack){
			self.shootBullet(self.mouseAngle);
		}
	}
	self.shootBullet = function(angle){
		var b = Bullet(self.id,angle);
		b.x = self.x;
		b.y = self.y;
	}
	
	self.updateSpd = function(){
		if(self.pressingRight)
			self.spdX = self.maxSpd;
		else if(self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
		
		if(self.pressingUp)
			self.spdY = -self.maxSpd;
		else if(self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;		
	}
	
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			waveType:"sine",
			currentNote:self.currentNote,
			number:self.number,
		}
	}
	self.getUpdatePack = function(){
	return {
		id:self.id,
		x:self.x,
		y:self.y,
		waveType:self.waveType,
		currentNote:self.currentNote,
	}
}
	Player.list[id] = self;
	
	initPack.player.push(self.getInitPack());
	return self;
}
Player.list = {};
Player.onConnect = function(socket){
	var player = Player(socket.id);
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
	socket.on('waveTypeChange',function(data){
		player.waveType = data;
	})

	socket.on('noteChoice',function(data){
		player.currentNote= data;
		console.log("Socket made it!");
		console.log("data reads like this: " + data);
	})
	
	socket.emit('init',{
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
	})	
}
Player.getAllInitPack = function() {
	var players = [];
	for (var i in Player.list)
		players.push(Player.list[i].getInitPack());
		return players;
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}
Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack())	
	}
	return pack;
}


var Bullet = function(parent,angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI) * 10;
	self.spdY = Math.sin(angle/180*Math.PI) * 10;
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();
		
		for(var i in Player.list){
			var p = Player.list[i];
			if(self.getDistance(p) < 32 && self.parent !== p.id){
				//handle collision. ex: hp--;
				self.toRemove = true;
			}
		}
	}
	self.getInitPack = function(){
		return{
		id:self.id,
		x:self.x,
		y:self.y,
		waveType:self.waveType,
		currentNote:self.currentNote,
		};
	}
	self.getUpdatePack = function(){
		return{
		id:self.id,
		x:self.x,
		y:self.y,
		waveType:self.waveType,
		currentNote:self.currentNote,		
		};		
	}
	
	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());
	return self;
}
Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove){
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else
			pack.push(bullet.getUpdatePack());		
	}
	return pack;
}

Bullet.getAllInitPack = function() {
	var bullets = [];
	for (var i in bullets.list)
		bullets.push(Bullet.list[i].getInitPack());
	
	return bullets;
}

var DEBUG = true;

var isValidPassword = function(data,cb){
	db.account.find({username:data.username,password:data.password},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});
}
var isUsernameTaken = function(data,cb){
	db.account.find({username:data.username},function(err,res){
		if(res.length > 0)
			cb(true);
		else
			cb(false);
	});
}
var addUser = function(data,cb){
	db.account.insert({username:data.username,password:data.password},function(err){
		cb();
	});
}


var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	socket.on('signIn',function(data){
		
		isValidPassword(data,function(res){
			if(res){
				Player.onConnect(socket);
				socket.emit('signInResponse',{success:true});
				
					if (seqUpdatedInit){
						socket.emit('seqFromServer', seqUpdatedInit);
					}
			} else {
				socket.emit('signInResponse',{success:false});			
			}
		});
	});
	socket.on('signUp',function(data){
		isUsernameTaken(data,function(res){
			if(res){
				socket.emit('signUpResponse',{success:false});		
			} else {
				addUser(data,function(){
					socket.emit('signUpResponse',{success:true});		
						if (seqUpdatedInit){
							socket.emit('seqFromServer', seqUpdatedInit);
						}					
				});
			}
		});		
	});
	
	
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	socket.on('sendMsgToServer',function(data){
		var playerName = ("" + socket.id).slice(2,7);
		for(var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',playerName + ': ' + data);
		}
	});
	
	socket.on('evalServer',function(data){
		if(!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);		
	});
	
});

var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};



io.sockets.on('connection', function(socket)
		{

		socket.on('seqChanged',function(data){
		var sequpdated = data;
		getSeqInit(sequpdated);
		console.log("sequpdated reads like this: " + sequpdated);
			for(var i in SOCKET_LIST){
				var socket = SOCKET_LIST[i];
				socket.emit('seqFromServer',sequpdated);
				console.log("In emit: " + sequpdated);
			}
		
	})	
});

var seqUpdatedInit = [
  [0,1,0,1,0,1,0,1],
  [0,1,0,0,0,0,0,0],
  [0,1,0,0,0,0,0,0]
];
console.log(seqUpdatedInit);


function getSeqInit(currentseq){
	seqUpdatedInit = currentseq;
	console.log(seqUpdatedInit);
}

//pack making
setInterval(function(){
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
		//socket.emit('seqFromServer',newseq);
		//console.log("In emit: " + newseq);
	}
	initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];
	
	
},1000/25);

// TIMER SETUP

//SERVER
	
var seq = [
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
];	



//SEND SEQ to Clients
	
var start = new Date().getTime(),
    time = 0,
    now = '0.0';

function instance()
{
    time += 100;

    now = Math.floor(time / 100) / 10;
    if(Math.round() == now) { now += '.0'; }


    var diff = (new Date().getTime() - start) - time;
	//console.log("Now readings should be evenly between the other console log: " + now)
    setTimeout(instance, (100 - diff));
}

setTimeout(instance, 100);

var step = 0;
var interval = 0.125;
var matrix;
	
var wait_time = 0.25;
var got_up_to;
	
	
setInterval(function(){

    // how far into the future will we schedule? 
    // we schedule beyond the next wait time as we cannot 
    // rely on it being exactly 'wait_time' ms before 
    // we get woken up again, therefore put in a few
    // extra events on the scheduler to cover any delays
	
	//this is the threshold for lateness?
    var max_future_time = now + (wait_time  * 0.1);
	
	//don't understand this bit??
    if (got_up_to > now) {
		// already scheduled up to this point
        now = got_up_to;
    }
    
	// hmm so when now is less than the maximum it adds a step?
    while (now <= max_future_time){
        step ++;
		//console.log("sending, is it erratic? " + "Step is :" + step + "clock is: " + now);

		//emit step to client here? Then client does the if statement on receipt?
			for(var i in SOCKET_LIST){
				var socket = SOCKET_LIST[i];
				socket.emit('stepSent',step,now);
				//console.log("sending, is it erratic? " + "Step is :" + step + "clock is: " + now);
			}
        now += interval;
    }
    got_up_to = now;
    
}, 1000 * wait_time);



// this code will wake up every (wait_time) ms 
// and schedule a load of drum triggers on the clock
// each time, remembering where it scheduled to in the future
// so it does not repeat anything



//drumclock











