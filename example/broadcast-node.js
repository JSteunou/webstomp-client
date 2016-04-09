var readline = require('readline');
// for real you will do require('webstomp-client')
var webstomp = require('../dist/webstomp');
// you can use any WebSocket client library you want
// just carefully read for each one specificities
var WebSocket = require('ws');



var rl = readline.createInterface(process.stdin, process.stdout),
    url = 'ws://localhost:15674/ws',
    login = 'guest', password = 'guest',
    options = {debug: false, protocols: webstomp.VERSIONS.supportedProtocols()};

var users = [
    {
        name: 'user 1',
        client: webstomp.over(new WebSocket(url), options)
    },
    {
        name: 'user 2',
        client: webstomp.over(new WebSocket(url), options)
    }
];
var master = {
    name: 'palpatine',
    client: webstomp.over(new WebSocket(url), options)
};

function onMessage(user, msg) {
    console.log('MESSAGE', user.name, msg.body);
}
function onError(user, err) {
    console.log('DISCONNECTED', user.name, err);
}
function onConnect(user) {
    console.log('CONNECTED', user.name);
    user.client.subscribe('/topic/webstomp-chat-example', onMessage.bind(this, user));
}
function onMasterConnect(master) {
    rl.setPrompt('something to broadcast? > ');
    rl.prompt();
    rl.on('line', function(line) {
        master.client.send('/topic/webstomp-chat-example', line.trim());
    });
    rl.on('close', function() {
        console.log('bye bye');
        master.client.disconnect();
        users.forEach(function(user) {
            user.client.disconnect();
        });
    });
}

users.forEach(function(user) {
    user.client.connect(login, password, onConnect.bind(this, user), onError.bind(this, user));
});

master.client.connect(login, password, onMasterConnect.bind(this, master), onError.bind(this, master));
