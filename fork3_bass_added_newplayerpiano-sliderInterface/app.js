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

var leadSeq = [
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
];

var bassSeq = [
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
];	
var newLeadSeq;
var leadStepSequencerLegatoBoolValue = false;

var newBassSeq;
var bassStepSequencerLegatoBoolValue = false;


var Entity = function(){
	var self = {
		x:250,
		y:250,
		waveType:"sine",
		currentNote:0,
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
		//this needs to become the nexus received from player
		self.x;
		self.y;
	}
	return self;
}

var Player = function(id){
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	
	var super_update = self.update;
	self.update = function(){
		super_update();
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
	socket.on('playerPosChange',function(data){
		console.log(data);
		player.x = data[0];
		player.y = data[1];
		console.log("player.x reads: " + player.x);
		console.log("data.x is: " + data[0] + " , this is what was received, does player get updated?");
		console.log("player.y should read: " + player.y);
		console.log("data.y is: " + data[1]);
	});
	socket.on('waveTypeChange',function(data){
		player.waveType = data;
	})
socket.on('leadStepLegatoBoolChange',function(data){
		leadStepSequencerLegatoBoolValue = data;
		console.log("lead bool received");
		console.log(data);
	})

socket.on('basstepLegatoBoolChange',function(data){
		bassStepSequencerLegatoBoolValue = data;
		console.log("bass bool received");
		console.log(data);
	})
	socket.on('noteChoice',function(data){
		player.currentNote= data;
		console.log("Socket made it!");
		console.log("data reads like this: " + data);
	})
	
	socket.emit('init',{
		player:Player.getAllInitPack(),
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
				
					if (leadSeqUpdatedInit){
						socket.emit('leadSeqFromServer', leadSeqUpdatedInit);
						//console.log('new user! leadSeqUpdatedInit reads:' + leadSeqUpdatedInit)
					}
					
					if (bassSeqUpdatedInit){
						socket.emit('bassSeqFromServer', bassSeqUpdatedInit);
						//console.log('new user! bassSeqUpdatedInit reads:' + bassSeqUpdatedInit)
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
						if (leadSeqUpdatedInit){
							socket.emit('leadSeqFromServer', leadSeqUpdatedInit);
						}								
						if (bassSeqUpdatedInit){
							socket.emit('bassSeqFromServer', bassSeqUpdatedInit);
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

var initPack = {player:[]};
var removePack = {player:[]};



io.sockets.on('connection', function(socket)
		{
//lead only
		socket.on('leadSeqChanged',function(data){
		var leadSequpdated = data;
		getLeadSeqInit(data);
		console.log("leadSequpdated reads like this: " + leadSequpdated);
			for(var i in SOCKET_LIST){
				var socket = SOCKET_LIST[i];
				socket.emit('leadSeqFromServer',leadSequpdated);
				//console.log("In emit: " + leadSequpdated);
			}
	})			
//bass only
	socket.on('bassSeqChanged',function(data){
		var bassSequpdated = data;
		getBassSeqInit(data);
		console.log("bassSequpdated reads like this: " + bassSequpdated);
			for(var i in SOCKET_LIST){
				var socket = SOCKET_LIST[i];
				socket.emit('bassSeqFromServer',bassSequpdated);
				//console.log("In emit: " + bassSequpdated);
			}
	})	
});

var leadSeqUpdatedInit = [
  [0,1,0,1,0,1,0,1],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0]
];
console.log("Lead seq: " + leadSeqUpdatedInit);


function getLeadSeqInit(leadCurrentseq){
	leadSeqUpdatedInit = leadCurrentseq;
	console.log(leadSeqUpdatedInit);
}

var bassSeqUpdatedInit = [
  [0,0,1,0,1,0,1,0],
  [0,0,0,0,0,0,0,0],
  [1,0,0,0,0,0,0,0]
];
console.log("bass seq: " + bassSeqUpdatedInit);


function getBassSeqInit(bassCurrentseq){
	bassSeqUpdatedInit = bassCurrentseq;
	console.log(bassSeqUpdatedInit);
}

//pack making
setInterval(function(){
	var pack = {
		player:Player.update(),
	}
	
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
		//socket.emit('leadSeqFromServer',newLeadSeq);
		//console.log("In emit: " + newLeadSeq);
	}
	initPack.player = [];
	removePack.player = [];
	
	
},1000/25);

// TIMER SETUP

//SERVER
	
var leadSeq = [
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
    [0, 0, 0, 0, 0, 0, 0, 0], 
];	

var bassSeq = [
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
	
//legato bools
var leadStepSequencerLegatoBoolValue = false;

var newLeadSeqLegatoBoolValue = false;

var bassStepSequencerLegatoBoolValue = false;

var newBassSeqLegatoBoolValue = false;


setInterval(function(){
	
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
			//lead
			if(newLeadSeqLegatoBoolValue != leadStepSequencerLegatoBoolValue){
				//console.log("sending.....");
				for(var i in SOCKET_LIST){
					var socket = SOCKET_LIST[i];
					socket.emit('leadSeqLegatoBoolSent',leadStepSequencerLegatoBoolValue);
					//console.log("sending: " + leadStepSequencerLegatoBoolValue);
			}
			newLeadSeqLegatoBoolValue = leadStepSequencerLegatoBoolValue;
			}
			//bass
			if(newBassSeqLegatoBoolValue != bassStepSequencerLegatoBoolValue){
				//console.log("sending.....");
				for(var i in SOCKET_LIST){
					var socket = SOCKET_LIST[i];
					socket.emit('bassSeqLegatoBoolSent',bassStepSequencerLegatoBoolValue);
					//console.log("sending: " + bassStepSequencerLegatoBoolValue);
			}
			newLeadSeqLegatoBoolValue = leadStepSequencerLegatoBoolValue;
		}	
		
		
		
        now += interval;
    }
    got_up_to = now;
    
}, 1000 * wait_time);










